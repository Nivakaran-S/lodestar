import { ODataError } from '@/lib/odata';
import { memoryQueueStorage, OfflineQueue, summarize, type QueueItem } from '@/offline/queue';
import { SyncEngine } from '@/offline/sync';

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let now = Date.parse('2026-04-07T04:40:00Z');
const clock = () => (now += 1000);

function fakeClient() {
  return { action: jest.fn(), create: jest.fn(), list: jest.fn(async () => ({ value: [] as any[] })) };
}

async function setup(opts: { online?: boolean; sub?: string | null } = {}) {
  const storage = memoryQueueStorage();
  const queue = new OfflineQueue(storage, uuid, clock);
  await queue.ready();
  const client = fakeClient();
  const onSynced = jest.fn();
  let online = opts.online ?? true;
  const engine = new SyncEngine(queue, client as any, { sub: () => (opts.sub === undefined ? 'u-1' : opts.sub), online: () => online, now: clock, onSynced });
  return { storage, queue, client, engine, onSynced, setOnline: (v: boolean) => (online = v) };
}

const arrival = (q: OfflineQueue, seq = 1) =>
  q.enqueue('ARRIVAL', { sub: 'u-1', tripId: 'T1', ref: `S${seq}`, label: 'Arrival', payload: { stopSeq: seq, time: '2026-04-07T04:41:00Z', stopId: `S${seq}` } });
const pod = (q: OfflineQueue) =>
  q.enqueue('POD_SAVE', { sub: 'u-1', tripId: 'T1', ref: 'S1', label: 'POD', payload: { orderId: 'O1', units: 31, unitsOrdered: 34, stopId: 'S1' } });

describe('OfflineQueue', () => {
  it('saves every write with a client UUID and the time it was saved', async () => {
    const { queue, storage } = await setup();
    const item = await arrival(queue);
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(item.savedAt)).not.toBeNaN();
    expect(item.status).toBe('pending');
    expect(storage.rows.get(item.id)).toMatchObject({ kind: 'ARRIVAL', status: 'pending' });
    expect(summarize(queue.list())).toMatchObject({ pending: 1, attention: 0 });
  });

  it('enqueueUnless checks and saves as one step: two callers at the same moment queue one write', async () => {
    const storage = memoryQueueStorage();
    // a slow disk: the item reaches the list only after put resolves
    const put = storage.put.bind(storage);
    storage.put = async (item: QueueItem) => {
      await new Promise(r => setTimeout(r, 5));
      await put(item);
    };
    const queue = new OfflineQueue(storage, uuid, clock);
    await queue.ready();
    const loading = (label: string) =>
      queue.enqueueUnless('TRIP_STATUS', { sub: 'u-1', tripId: 'T1', label, payload: { tripId: 'T1', status: 'LOADING' } }, i => i.kind === 'TRIP_STATUS' && i.tripId === 'T1');
    const [a, b] = await Promise.all([loading('Loading · T1'), loading('Loading · VEH042')]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(queue.list().filter(i => i.kind === 'TRIP_STATUS')).toHaveLength(1);
    expect(storage.rows.size).toBe(1);
  });

  it('survives a restart; a write left "sending" goes back to pending', async () => {
    const { queue, storage } = await setup();
    const item = await arrival(queue);
    await queue.update(item.id, { status: 'sending' });
    const reopened = new OfflineQueue(storage, uuid, clock);
    await reopened.ready();
    expect(reopened.list()).toEqual([expect.objectContaining({ id: item.id, status: 'pending' })]);
  });
});

describe('SyncEngine', () => {
  it('replays driver events through PushBatch with their ids, oldest first', async () => {
    const { queue, client, engine, onSynced } = await setup();
    const a = await arrival(queue);
    const p = await pod(queue);
    client.action.mockResolvedValue({ synced: 2, duplicates: 0, rejected: 0, conflicts: 0, results: [{ id: a.id, eventType: 'ARRIVAL', status: 'APPLIED' }, { id: p.id, eventType: 'POD_SAVE', status: 'APPLIED' }] });

    const r = await engine.flush();

    expect(client.action).toHaveBeenCalledTimes(1);
    const [path, body] = client.action.mock.calls[0];
    expect(path).toBe('OfflineEvents/Lodestar.PushBatch');
    expect(body.events.map((e: any) => [e.id, e.eventType, e.tripId])).toEqual([[a.id, 'ARRIVAL', 'T1'], [p.id, 'POD_SAVE', 'T1']]);
    expect(body.events[0].payload).toEqual({ stopSeq: 1, time: '2026-04-07T04:41:00Z' }); // local stopId stays on the phone
    expect(body.events[1].savedAt).toBe(p.savedAt);
    expect(r).toMatchObject({ attempted: 2, synced: 2, offline: false });
    expect(queue.list().every(i => i.status === 'synced' && i.syncedAt)).toBe(true);
    expect(onSynced).toHaveBeenCalled();
  });

  it('is idempotent: a replayed event the server already has counts as synced', async () => {
    const { queue, client, engine } = await setup();
    const a = await arrival(queue);
    client.action.mockResolvedValue({ results: [{ id: a.id, eventType: 'ARRIVAL', status: 'DUPLICATE' }] });
    await engine.flush();
    expect(queue.list()[0]).toMatchObject({ status: 'synced' });
    client.action.mockClear();
    await engine.flush();
    expect(client.action).not.toHaveBeenCalled(); // nothing pending: never sent twice
  });

  it('keeps and shows the conflict note of an applied event and refusals', async () => {
    const { queue, client, engine } = await setup();
    const p = await pod(queue);
    const a = await arrival(queue, 9);
    client.action.mockResolvedValue({
      results: [
        { id: p.id, eventType: 'POD_SAVE', status: 'APPLIED', conflict: 'Provisional deferral reversed — field evidence wins' },
        { id: a.id, eventType: 'ARRIVAL', status: 'REJECTED', reason: 'Trip is not assigned to your vehicle' },
      ],
    });
    const r = await engine.flush();
    expect(r).toMatchObject({ synced: 1, conflicts: 1, rejected: 1 });
    expect(queue.list().find(i => i.id === p.id)).toMatchObject({ status: 'synced', conflict: expect.stringContaining('field evidence wins') });
    expect(queue.list().find(i => i.id === a.id)).toMatchObject({ status: 'rejected', conflict: 'Trip is not assigned to your vehicle' });
    expect(summarize(queue.list()).attention).toBe(2);
    await queue.acknowledge();
    expect(summarize(queue.list()).attention).toBe(0);
  });

  it('keeps everything pending while offline and sends once the signal is back', async () => {
    const { queue, client, engine, setOnline } = await setup({ online: false });
    const a = await arrival(queue);
    expect(await engine.flush()).toMatchObject({ offline: true, attempted: 0 });
    expect(client.action).not.toHaveBeenCalled();
    setOnline(true);
    client.action.mockResolvedValue({ results: [{ id: a.id, eventType: 'ARRIVAL', status: 'APPLIED' }] });
    await engine.flush();
    expect(queue.list()[0].status).toBe('synced');
  });

  it('a network failure mid-flush leaves the writes pending for the next try', async () => {
    const { queue, client, engine } = await setup();
    await arrival(queue);
    client.action.mockRejectedValue(new ODataError(0, 'NetworkError', 'No connection to the server'));
    const r = await engine.flush();
    expect(r.offline).toBe(true);
    expect(queue.list()[0]).toMatchObject({ status: 'pending', attempts: 1, lastError: 'No connection to the server' });
  });

  it('retries a refused batch one event at a time so one bad event does not block the rest', async () => {
    const { queue, client, engine } = await setup();
    const a = await arrival(queue);
    const p = await pod(queue);
    client.action
      .mockRejectedValueOnce(new ODataError(400, 'BadRequest', 'events[1].payload.units must be a non-negative integer'))
      .mockResolvedValueOnce({ results: [{ id: a.id, eventType: 'ARRIVAL', status: 'APPLIED' }] })
      .mockRejectedValueOnce(new ODataError(400, 'BadRequest', 'events[0].payload.units must be a non-negative integer'));
    await engine.flush();
    expect(queue.list().find(i => i.id === a.id)?.status).toBe('synced');
    expect(queue.list().find(i => i.id === p.id)?.status).toBe('rejected');
  });

  it('sends nothing for another user or when signed out', async () => {
    const { queue, client, engine } = await setup({ sub: null });
    await arrival(queue);
    await engine.flush();
    expect(client.action).not.toHaveBeenCalled();
  });

  it('replays loader and store writes as their OData calls with an Idempotency-Key', async () => {
    const { queue, client, engine } = await setup();
    const rel = await queue.enqueue('RELEASE', { sub: 'u-1', tripId: 'T1', label: 'Release', payload: { tripId: 'T1', bay: 'K2', sealNumber: 'S-9', reeferTempC: 3 } });
    const sf = await queue.enqueue('SHORTFALL', { sub: 'u-1', tripId: 'T1', label: 'Shortfall', payload: { tripId: 'T1', loadRecordId: 'LR1', bay: 'K2', shortfalls: [{ item: 'Yoghurt', qtyOrdered: 8, qtyLoaded: 6, reason: 'short' }] } });
    const rc = await queue.enqueue('RECEIPT', { sub: 'u-1', label: 'Receipt', payload: { orderId: 'O1', unitsReceived: 31, unitsExpected: 34 } });
    client.action.mockResolvedValue({});
    await engine.flush();
    const calls = client.action.mock.calls.map(c => [c[0], c[2]?.idempotencyKey]);
    expect(calls).toEqual([
      ["Trips('T1')/Lodestar.Release", rel.id],
      ["LoadRecords('LR1')/Lodestar.RecordShortfalls", sf.id],
      ["Orders('O1')/Lodestar.ConfirmReceipt", rc.id],
    ]);
    expect(client.action.mock.calls[0][1]).toEqual({ sealNumber: 'S-9', reeferTempC: 3 });
    expect(queue.list().every(i => i.status === 'synced')).toBe(true);
  });

  it('records the load first when the release needs it; a 409 otherwise is a conflict', async () => {
    const { queue, client, engine } = await setup();
    await queue.enqueue('RELEASE', { sub: 'u-1', tripId: 'T1', label: 'Release', payload: { tripId: 'T1', bay: 'K2', sealNumber: 'S-9' } });
    client.action.mockRejectedValueOnce(new ODataError(409, 'Conflict', 'The trip has no load record yet; record the load first')).mockResolvedValueOnce({});
    client.create.mockResolvedValue({ id: 'LR9' });
    await engine.flush();
    expect(client.create).toHaveBeenCalledWith('LoadRecords', { tripId: 'T1', bay: 'K2' }, expect.anything());
    expect(queue.list()[0].status).toBe('synced');

    // a genuine conflict is never reported as sent
    const warm = await queue.enqueue('RELEASE', { sub: 'u-1', tripId: 'T2', label: 'Release', payload: { tripId: 'T2', sealNumber: 'S-1', reeferTempC: 9 } });
    client.action.mockRejectedValueOnce(new ODataError(409, 'Conflict', "The reefer reads 9 °C, above 5 °C: it can't depart"));
    await engine.flush();
    expect(queue.list().find(i => i.id === warm.id)).toMatchObject({ status: 'conflict', conflict: "The reefer reads 9 °C, above 5 °C: it can't depart" });
  });

  it("a release of a trip that has left already is done: quietly for this phone's own repeat, with a note otherwise", async () => {
    const { queue, client, engine } = await setup();
    const first = await queue.enqueue('RELEASE', { sub: 'u-1', tripId: 'T1', label: 'Release', payload: { tripId: 'T1', sealNumber: 'S-9' } });
    const repeat = await queue.enqueue('RELEASE', { sub: 'u-1', tripId: 'T1', label: 'Release', payload: { tripId: 'T1', sealNumber: 'S-9' } });
    client.action.mockResolvedValueOnce({}).mockRejectedValueOnce(new ODataError(409, 'Conflict', 'A ENROUTE trip cannot be released'));
    await engine.flush();
    expect(queue.list().find(i => i.id === first.id)).toMatchObject({ status: 'synced', conflict: null });
    expect(queue.list().find(i => i.id === repeat.id)).toMatchObject({ status: 'synced', conflict: null });

    const elsewhere = await queue.enqueue('RELEASE', { sub: 'u-1', tripId: 'T3', label: 'Release', payload: { tripId: 'T3', sealNumber: 'S-2' } });
    client.action.mockRejectedValueOnce(new ODataError(409, 'Conflict', 'A COMPLETE trip cannot be released'));
    await engine.flush();
    expect(queue.list().find(i => i.id === elsewhere.id)).toMatchObject({ status: 'synced', conflict: 'The trip had already been released' });
    expect(summarize(queue.list()).attention).toBe(1); // shown, not hidden
  });

  it('sends the dock starting a trip as Trips SetStatus LOADING; a trip that already moved on is not a conflict', async () => {
    const { queue, client, engine } = await setup();
    const st = await queue.enqueue('TRIP_STATUS', { sub: 'u-1', tripId: 'T1', label: 'Loading', payload: { tripId: 'T1', status: 'LOADING' } });
    client.action.mockResolvedValueOnce({});
    await engine.flush();
    expect(client.action).toHaveBeenCalledWith("Trips('T1')/Lodestar.SetStatus", { status: 'LOADING' }, { idempotencyKey: st.id });
    expect(queue.list()[0]).toMatchObject({ status: 'synced', conflict: null });

    const late = await queue.enqueue('TRIP_STATUS', { sub: 'u-1', tripId: 'T2', label: 'Loading', payload: { tripId: 'T2', status: 'LOADING' } });
    client.action.mockRejectedValueOnce(new ODataError(409, 'Conflict', 'A ENROUTE trip cannot move to LOADING'));
    await engine.flush();
    expect(queue.list().find(i => i.id === late.id)).toMatchObject({ status: 'synced', conflict: null });
  });

  it('keeps a vehicle-fault report on the phone with no signal and sends Trips ReportVehicleFault when it is back', async () => {
    const { queue, client, engine, setOnline } = await setup({ online: false });
    const vf = await queue.enqueue('VEHICLE_FAULT', { sub: 'u-1', tripId: 'T1', label: 'Vehicle fault', payload: { tripId: 'T1', fault: 'NOT_COOLING', reeferTempC: 9 } });
    await engine.flush();
    expect(client.action).not.toHaveBeenCalled();
    expect(queue.list()[0].status).toBe('pending');
    setOnline(true);
    client.action.mockResolvedValueOnce({ vehicleStatus: 'WORKSHOP' });
    await engine.flush();
    expect(client.action).toHaveBeenCalledWith("Trips('T1')/Lodestar.ReportVehicleFault", { fault: 'NOT_COOLING', reeferTempC: 9 }, { idempotencyKey: vf.id });
    expect(queue.list()[0].status).toBe('synced');

    const gone = await queue.enqueue('VEHICLE_FAULT', { sub: 'u-1', tripId: 'T2', label: 'Vehicle fault', payload: { tripId: 'T2', fault: 'ENGINE' } });
    client.action.mockRejectedValueOnce(new ODataError(409, 'Conflict', 'A ENROUTE trip has already left the dock'));
    await engine.flush();
    expect(client.action).toHaveBeenLastCalledWith("Trips('T2')/Lodestar.ReportVehicleFault", { fault: 'ENGINE' }, { idempotencyKey: gone.id });
    expect(queue.list().find(i => i.id === gone.id)).toMatchObject({ status: 'conflict' });
  });

  it('runs one flush at a time', async () => {
    const { queue, client, engine } = await setup();
    const a = await arrival(queue);
    let release!: (v: unknown) => void;
    client.action.mockReturnValue(new Promise(r => (release = r)));
    const one = engine.flush();
    const two = engine.flush();
    release({ results: [{ id: a.id, eventType: 'ARRIVAL', status: 'APPLIED' }] });
    expect(await one).toBe(await two);
    expect(client.action).toHaveBeenCalledTimes(1);
  });
});

export type { QueueItem };
