'use client';
// DSP-A2 Reconcile conflict, live. Markup and classes from the generated design (frontend/screens/dsp-a2-reconcile-conflict.tsx).
// After a silent vehicle syncs, the sync service has already applied its records and resolved conflicts by the
// rule "signed field evidence wins" (backend/apps/sync: a POD for an order reverses its provisional deferral;
// a stop left without a POD is put in front of a dispatcher). This screen shows that sync for one trip:
//  - the trip: the one DSP-A1 had open if it has a conflict note on its OfflineEvents, else the latest such trip;
//  - OfflineEvents of the trip and OfflineEvents/Lodestar.SyncStatus(tripId) (received, applied, needs review);
//  - per conflicting order: the dispatcher's provisional deferral (Deferrals) vs the field record (the stop's POD).
// "Resolve: keep the delivery" closes the dispatcher's side: a deferral still open is dismissed (SUGGESTED) or
// reversed (CONFIRMED), and the store and the driver are told the outcome (Notifications/Lodestar.Send).
// Not built: "Keep my deferral" (no API reinstates a deferral the field evidence reversed) and the GPS lines.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useScreenNav } from '@/components/ScreenShell';
import Btn from '@/components/live/Btn';
import { PlanSide } from '@/components/live/chrome';
import { sendNotice, useStoreManagers } from '@/components/live/degradation';
import { useBlackout } from './dsp-a1-blackout-view';
import { Ic } from '@/components/live/icons';
import PodPhoto from '@/components/live/PodPhoto';
import { usePlanScope } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { useAuth } from '@/lib/auth/AuthProvider';
import { initials } from '@/lib/auth/session';
import { fmtClock, fmtDay, fmtNum, fmtRunDate } from '@/lib/format';
import { useAction, useEntity, useQuery } from '@/lib/odata/hooks';
import type { Deferral, OfflineEvent, Trip, TripStop } from '@/lib/odata/types';
import { depotFilter, useFocusId } from '@/lib/workday';
import { useDepots } from '@/components/live/depots';

interface SyncStatus { total: number; synced: number; pending: number; conflicts: number; needsReview: number; lastSyncedAt?: string | null }

const code = (r: string) => r.replace('_', '-');
const P = (e: OfflineEvent) => (e.payload ?? {}) as Record<string, unknown>;
const signal = (e: OfflineEvent) => (e.eventType === 'STATUS_CHANGE' ? String(P(e).status ?? '') : '');

/** The stop an offline event is about (by order id, else stop number). */
function stopOf(e: OfflineEvent, stops: TripStop[]): TripStop | undefined {
  const p = P(e);
  if (typeof p.orderId === 'string') return stops.find(s => s.orderId === p.orderId);
  if (typeof p.stopSeq === 'number') return stops.find(s => s.stopSeq === p.stopSeq && (!p.outletId || s.outletId === p.outletId));
  return undefined;
}

function syncedLabel(e: OfflineEvent, stops: TripStop[]) {
  const p = P(e);
  const s = stopOf(e, stops);
  switch (e.eventType) {
    case 'ARRIVAL': return <>{"Arrival "}<span className="id">{s?.outletId ?? String(p.outletId ?? '')}</span></>;
    case 'LEAVE': return <>{"Left "}<span className="id">{s?.outletId ?? String(p.outletId ?? '')}</span></>;
    case 'POD_SAVE': return <>{"POD "}<span className="id">{String(p.orderId ?? s?.orderId ?? '')}</span>{s?.pod ? ` · ${s.pod.unitsDelivered}/${s.pod.unitsOrdered}` : typeof p.units === 'number' ? ` · ${p.units}` : ''}</>;
    case 'PHOTO': return <>{`Photo${typeof p.note === 'string' ? ` · ${p.note}` : ''}`}{s ? <>{' · '}<span className="id">{s.outletId}</span></> : null}</>;
    default: return <>{String(p.status ?? e.eventType).toLowerCase().replace(/_/g, ' ')}</>;
  }
}

const span = (from?: string | null, to?: string | null) => {
  if (!from || !to) return '';
  const m = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
};

export default function LiveDspA2ReconcileConflict() {
  const { name: depotName } = useDepots();
  const nav = useScreenNav();
  const { session } = useAuth();
  const { active } = usePlanScope();
  const ops = useBlackout();
  const onRoad = (ops.trips.data ?? []).filter(x => x.status === 'ENROUTE');
  const reporting = onRoad.filter(x => !ops.signal.byTrip.get(x.id)?.lost).length;
  const [focus] = useFocusId('trip');
  const latest = useQuery<OfflineEvent[]>(`a2-latest:${active.join(',')}`, c =>
    c.list<OfflineEvent>('OfflineEvents', { filter: ['conflictNote ne null', depotFilter('trip/depot', active)].filter(Boolean).join(' and '), orderby: 'savedAt desc', top: 20 }).then(p => p.value),
  { refreshOn: ['notification', 'signal_back'] });
  // trips that synced records saved offline, conflict or not (a clean sync is shown too: its stops and photos)
  const recent = useQuery<OfflineEvent[]>(`a2-recent:${active.join(',')}`, c =>
    c.list<OfflineEvent>('OfflineEvents', { filter: depotFilter('trip/depot', active) || undefined, orderby: 'savedAt desc', top: 50 }).then(p => p.value),
  { refreshOn: ['notification', 'signal_back'] });
  // the trip DSP-A1 had open; else the latest trip with a conflict; else the latest trip that synced
  const conflictTrips = [...new Set((latest.data ?? []).map(e => e.tripId).filter(Boolean))] as string[];
  const syncedTrips = [...new Set((recent.data ?? []).map(e => e.tripId).filter(Boolean))] as string[];
  const tripId = (focus && (conflictTrips.includes(focus) || syncedTrips.includes(focus)) ? focus : conflictTrips[0] ?? syncedTrips[0]) ?? null;
  const trip = useEntity<Trip>('Trips', tripId, { expand: 'stops($expand=pod,outlet($select=id,name),order($select=id,units,kg,m3,tempClass)),driver' }, { refreshOn: ['notification'] });
  const events = useQuery<OfflineEvent[]>(tripId ? `a2-events:${tripId}` : null, c => c.all<OfflineEvent>('OfflineEvents', { filter: `tripId eq '${tripId}'`, orderby: 'savedAt asc' }), { refreshOn: ['notification'] });
  const status = useQuery<SyncStatus>(tripId ? `a2-status:${tripId}` : null, c => c.fn<SyncStatus>('OfflineEvents', null, 'SyncStatus', { tripId: tripId! }));

  const stops = useMemo(() => [...(trip.data?.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq), [trip.data]);
  const all = events.data ?? [];
  const conflicts = all.filter(e => e.conflictNote);
  const orderIds = [...new Set(conflicts.map(e => stopOf(e, stops)?.orderId).filter(Boolean))] as string[];
  const deferrals = useQuery<Deferral[]>(orderIds.length ? `a2-deferrals:${orderIds.join(',')}` : null, c =>
    c.all<Deferral>('Deferrals', { filter: `orderId in (${orderIds.map(i => `'${i}'`).join(',')})` }),
  { refreshOn: ['notification'] });
  // the conflict to decide: one with a provisional deferral first, else the first one that needs review
  const defer = (deferrals.data ?? []).find(d => d.isProvisional) ?? deferrals.data?.[0];
  const main = (defer && conflicts.find(e => stopOf(e, stops)?.orderId === defer.orderId)) ?? conflicts.find(e => !e.conflictResolved) ?? conflicts[0];
  const stop = main ? stopOf(main, stops) ?? stops.find(s => s.orderId === defer?.orderId) : undefined;
  const pod = stop?.pod;
  const managers = useStoreManagers(stop ? [stop.outletId] : []);
  const [resolved, setResolved] = useState(false);

  const lostAt = all.find(e => signal(e) === 'SIGNAL_LOST');
  const backAt = [...all].reverse().find(e => signal(e) === 'SIGNAL_BACK');
  const syncedAt = status.data?.lastSyncedAt ?? backAt?.syncedAt ?? backAt?.savedAt;
  const records = all.filter(e => e.eventType !== 'STATUS_CHANGE');
  const clean = records.filter(e => !e.conflictNote);
  const needYou = resolved ? 0 : Math.max(status.data?.needsReview ?? 0, main ? 1 : 0);
  const t = trip.data;
  const driverName = t?.driver?.name ?? 'the driver';
  const deliveredAt = stop?.arrivalActual ?? pod?.savedAt;

  const resolve = useAction<void, unknown>(
    async c => {
      if (defer?.status === 'SUGGESTED') await c.action('Deferrals', defer.id, 'Dismiss');
      else if (defer?.status === 'CONFIRMED') await c.action('Deferrals', defer.id, 'Reverse', { notes: 'Field evidence wins: delivery confirmed by the synced POD' });
      const message = `Delivered ${fmtClock(deliveredAt)}.${defer ? ` Please ignore the ${fmtClock(defer.createdAt)} at-risk notice.` : ''}`;
      for (const m of managers.data ?? []) {
        await sendNotice(c, { recipientId: m.id, tripId: t!.id, outletId: stop!.outletId, payload: { title: 'Delivery confirmed', message, orderId: stop!.orderId, outletId: stop!.outletId } });
      }
      if (t?.driverId) {
        await sendNotice(c, { recipientId: t.driverId, tripId: t.id, payload: { title: 'Message from dispatch', message: `Your delivery record for ${stop!.outletId} stands: ${stop!.orderId} delivered.`, orderId: stop!.orderId } });
      }
    },
    { onSuccess: () => { setResolved(true); void deferrals.refresh(); nav.go('L29'); } },
  );

  const loading = (!latest.data && !latest.error) || (!recent.data && !recent.error) || (tripId && !trip.data && !trip.error) || (tripId && !events.data && !events.error);
  const error = latest.error ?? trip.error ?? events.error ?? status.error ?? deferrals.error;

  const timeline: Array<{ at: string; text: ReactNode; dot?: CSSProperties }> = [];
  if (t?.departTime) timeline.push({ at: t.departTime, text: <>{`Departed ${depotName(t.depot)} on `}<span className="id">{t.vehicleId}</span></> });
  if (lostAt) timeline.push({ at: lostAt.savedAt, text: `Last ping${P(lostAt).location ? ` · ${P(lostAt).location}` : ''}` });
  if (defer) timeline.push({ at: defer.createdAt, dot: { background: 'var(--st-deferred-fg)' }, text: <><b>{defer.isProvisional ? 'Provisional deferral' : 'Deferral'}</b>{' · '}<span className="id">{code(defer.reason)}</span></> });
  if (pod) timeline.push({ at: pod.savedAt, dot: { background: 'var(--st-delivered-fg)' }, text: <><b>{"Delivered"}</b>{` by ${driverName} · POD ${pod.unitsDelivered}/${pod.unitsOrdered} `}{pod.syncedAt ? <span className="t-3">(received {fmtClock(pod.syncedAt)})</span> : null}</> });
  if (main) timeline.push({ at: main.syncedAt ?? main.savedAt, dot: { background: resolved || main.conflictResolved ? 'var(--st-delivered-fg)' : 'var(--st-exception-fg)' }, text: <><b>{"Conflict detected"}</b>{` · ${main.conflictNote}`}</> });
  if (defer && defer.status === 'REVERSED') timeline.push({ at: defer.updatedAt ?? defer.createdAt, dot: { background: 'var(--st-delivered-fg)' }, text: <><b>{"Deferral reversed"}</b>{defer.notes ? ` · ${defer.notes}` : ''}</> });
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-A2 Reconcile conflict">
      <div className="d-app">
        <PlanSide active="N4" />
        <div className="d-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {"Live operations "}<span className="m-sep" />{" Sync"}
                {t && <>{' · '}<span className="id">{t.vehicleId}</span></>}
                {syncedAt && <><span className="m-sep" />{` ${fmtDay(syncedAt)}, ${fmtClock(syncedAt)}`}</>}
              </div>
              <div className="d-h1" data-testid="a2-title">
                {loading ? 'Loading the sync…' : !main ? (tripId && all.length ? 'Synced: nothing needs your decision' : 'No sync conflicts') : needYou ? `${needYou} conflict${needYou === 1 ? '' : 's'} need${needYou === 1 ? 's' : ''} your decision` : 'Conflict resolved: field evidence kept'}
              </div>
            </div>
            {ops.trips.data && <span className="m-pill m-pill--ok"><span className="dot" />{reporting} reporting live</span>}
          </div>
          <ErrorBanner error={error} onRetry={() => { void latest.refresh(); void trip.refresh(); void events.refresh(); }} />
          {loading ? <Skeleton rows={4} /> : !tripId || (!main && !all.length) ? (
            <Empty icon="cloud-check" title="Nothing to reconcile" text="When a vehicle syncs records it saved without signal, any conflict with a change made meanwhile shows here." />
          ) : !main ? (
            <>
              <div className="g-dbanner g-dbanner--info" data-p="1" data-testid="a2-clean">
                <Ic n="wifi" />
                <span>
                  <b>{`${t?.vehicleId ?? 'The vehicle'} synced${syncedAt ? ` at ${fmtClock(syncedAt)}` : ''}`}</b>
                  {` · ${status.data?.total ?? all.length} records received · `}<b>{`${clean.length} applied automatically`}</b>{' · none need you'}
                </span>
              </div>
              <div className="d-card" data-p="2">
                <div className="d-card__head">
                  <span style={{ color: 'var(--st-delivered-fg)', display: 'flex' }}><Ic n="cloud-check" /></span>
                  <span className="d-card__title">{"Stops on "}<span className="id">{t?.vehicleId}</span>{` · ${driverName}`}</span>
                </div>
                <div className="vstack" style={{ gap: '0', padding: '0 18px 12px' }}>
                  {stops.map(st => (
                    <div key={st.id} className="hstack" style={{ gap: '12px', padding: '8px 0', borderTop: '1px solid var(--line, #EEF0F6)' }} data-testid={`a2-stop-${st.stopSeq}`}>
                      <span className="id" style={{ width: '24px' }}>{st.stopSeq}</span>
                      <span style={{ flex: '1', minWidth: '0' }}><span className="id">{st.outletId}</span>{` ${st.outlet?.name ?? ''} · `}<span className="id">{st.orderId}</span></span>
                      {st.pod ? (
                        <>
                          <PodPhoto pod={st.pod} label={`the drop at ${st.outletId}`} />
                          <span style={{ fontSize: '13px', color: 'var(--text-2)', width: '220px' }}>
                            {`Delivered · POD ${st.pod.unitsDelivered}/${st.pod.unitsOrdered}${st.pod.receiverName ? ` · ${st.pod.receiverName}` : ''}${st.pod.savedOffline ? ' · captured offline' : ''}`}
                          </span>
                        </>
                      ) : (
                        <span className="m-pill" style={{ height: '24px', fontSize: '12px' }}>{st.status.toLowerCase()}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="d-card">
                <div className="d-card__head">
                  <span style={{ color: 'var(--st-delivered-fg)', display: 'flex' }}><Ic n="cloud-check" /></span>
                  <span className="d-card__title">{"Synced without conflict"}</span>
                  <div className="spacer" />
                  <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{clean.length}{syncedAt ? ` at ${fmtClock(syncedAt)}` : ''}</span>
                </div>
                <div className="vstack" style={{ gap: '0', padding: '0 18px 12px' }}>
                  {clean.map(e => (
                    <div key={e.id} className="g-li" style={{ padding: '5px 0' }}>
                      <span className="g-mark g-mark--ok"><Ic n="check" /></span>
                      <span style={{ flex: '1' }}>{syncedLabel(e, stops)}</span>
                      <span className="t-3">{fmtClock(e.savedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="g-dbanner g-dbanner--info" data-p="1">
                <Ic n="wifi" />
                <span>
                  <b>{`${t?.vehicleId} back online${syncedAt ? ` at ${fmtClock(syncedAt)}` : ''}`}</b>
                  {`${backAt && P(backAt).location ? ` ${/^near/i.test(String(P(backAt).location)) ? String(P(backAt).location).replace(/^Near/, 'near') : `near ${P(backAt).location}`}` : ''} · ${status.data?.total ?? all.length} records received · `}
                  <b>{`${clean.length} applied automatically`}</b>{` · ${needYou} need${needYou === 1 ? 's' : ''} you`}
                </span>
                <div className="spacer" />
                {lostAt && syncedAt && <span>{`Offline ${fmtClock(lostAt.savedAt)} to ${fmtClock(syncedAt)} · ${span(lostAt.savedAt, syncedAt)}`}</span>}
              </div>
              <div className="d-split">
                <div className="vstack" style={{ gap: '14px', flex: '1', minWidth: '0' }}>
                  <div className="hstack" style={{ gap: '10px' }}>
                    <span style={{ color: 'var(--st-deferred-fg)', display: 'flex' }}><Ic n="split" /></span>
                    <span className="d-card__title">{"Conflict on "}<span className="id">{stop?.orderId}</span>{" · "}<span className="id">{stop?.outletId}</span>{` ${stop?.outlet?.name ?? ''}`}</span>
                    {stop?.order && <span className={`m-tag ${stop.order.tempClass === 'CHILLED' ? 'm-tag--cold' : 'm-tag--brand'}`}><Ic n={stop.order.tempClass === 'CHILLED' ? 'snow' : 'box'} />{`${stop.order.tempClass === 'CHILLED' ? 'Chilled' : 'Ambient'} · ${stop.order.units} units · ${fmtNum(stop.order.kg)} kg · ${fmtNum(stop.order.m3, 1)} m³`}</span>}
                    <div className="spacer" />
                    {needYou ? <span className="m-pill m-pill--warn">{"Needs your decision"}</span> : <span className="m-pill m-pill--ok">{"Resolved"}</span>}
                  </div>
                  <div className="hstack" style={{ gap: '0', alignItems: 'stretch' }} data-p="2">
                    <div className="g-cmp g-cmp--plan">
                      <div className="g-cmp__who">
                        <span className="g-av">{initials(session?.name ?? '')}</span>
                        <span>{defer ? `Your change · ${fmtClock(defer.createdAt)}` : 'Your change'}</span>
                        <div className="spacer" />
                        {defer?.isProvisional && <span className="m-pill m-pill--warn" style={{ height: '24px', fontSize: '12px' }}>{"Provisional"}</span>}
                      </div>
                      <div className="g-cmp__what" style={{ color: 'var(--text-2)' }}>{defer ? `Deferred to ${defer.rescheduledDate ? fmtRunDate(defer.rescheduledDate) : 'the next run'}` : 'Provisional deferral'}</div>
                      {defer && <div className="g-ev"><Ic n="history" /><span>{"Reason "}<b className="id">{code(defer.reason)}</b>{defer.notes ? ` · "${defer.notes}"` : ''}</span></div>}
                      {!defer && <div className="g-ev"><Ic n="history" /><span>{main.conflictNote}</span></div>}
                      <div className="g-ev"><Ic n="wifi-off" /><span>{"Field evidence at the time: "}<b>{"none"}</b>{" (vehicle offline)"}</span></div>
                    </div>
                    <div className="g-vs">{"vs"}</div>
                    <div className="g-cmp g-cmp--field">
                      <div className="g-cmp__who">
                        <span className="g-av" style={{ background: '#141B4D', color: '#FFFFFF' }}>{initials(driverName)}</span>
                        <span>{`Field record${pod ? ` · ${fmtClock(pod.savedAt)}` : ''}${pod?.savedOffline ? ' · captured offline' : ''}`}</span>
                        <div className="spacer" />
                        {pod && <span className="m-pill m-pill--ok" style={{ height: '24px', fontSize: '12px' }}><Ic n="shield-check" />{"Evidence"}</span>}
                      </div>
                      <div className="g-cmp__what" style={{ color: pod ? 'var(--st-delivered-fg)' : 'var(--st-exception-fg)', fontSize: '24px' }}>
                        {pod ? `Delivered at ${stop?.outletId} · POD ${pod.unitsDelivered}/${pod.unitsOrdered}` : `No proof of delivery at ${stop?.outletId ?? 'the stop'}`}
                      </div>
                      {pod && (
                        <div className="hstack" style={{ gap: '10px' }}>
                          <PodPhoto pod={pod} label={`the drop at ${stop?.outletId ?? 'the stop'}`} />
                          <div className="vstack" style={{ gap: '1px', fontSize: '13px', color: 'var(--text-2)' }}>
                            <span>{pod.photoCount ? (pod.photoCount > 1 ? `${pod.photoCount} photos` : 'Photo') : pod.photoUrl ? 'Photo' : 'No photo'}{pod.receiverName ? ` · received by ${pod.receiverName}` : ''}</span>
                            <span>{`by ${driverName}`}</span>
                          </div>
                        </div>
                      )}
                      {pod?.syncedAt && <div className="g-ev"><Ic n="cloud-check" /><span>{"Synced "}<b>{fmtClock(pod.syncedAt)}</b></span></div>}
                    </div>
                  </div>
                  <div className="d-card" style={{ flex: '1', background: 'linear-gradient(180deg,#F1FBF6 0%,#FFFFFF 100%)', boxShadow: '0 0 0 1.5px var(--st-delivered-bd), 0 8px 24px rgba(4,120,87,.08)' }} data-p="3">
                    <div className="vstack" style={{ gap: '6px', padding: '18px 20px 8px' }}>
                      <div className="hstack" style={{ gap: '10px' }}>
                        <span className="g-okdot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--st-delivered-fg)', color: '#FFFFFF' }}><Ic n="check" /></span>
                        <span className="d-h1" style={{ fontSize: '22px' }}>{pod ? 'Recommended: keep the delivery' : 'Review the stop'}</span>
                      </div>
                      <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-2)', paddingLeft: '40px' }}>
                        <b style={{ color: 'var(--text)' }}>{"Rule: signed field evidence wins."}</b>{" A POD with signature, photo and GPS at the store beats a plan edit made without contact with the field."}
                      </span>
                    </div>
                    {pod && (
                      <div className="g-res" style={{ padding: '4px 20px 6px 60px' }}>
                        <div className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{"Keep delivery:"}</b>{" "}<span className="id">{stop?.orderId}</span>{` → Delivered ${fmtClock(deliveredAt)}`}</span></div>
                        <div className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{"Undo provisional deferral:"}</b>{` no skip recorded against ${stop?.outletId}`}</span></div>
                        <div className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{`Correct ${stop?.outletId}:`}</b>{` "Delivered ${fmtClock(deliveredAt)}.${defer ? ` Please ignore the ${fmtClock(defer.createdAt)} at-risk notice.` : ''}"`}</span></div>
                        <div className="g-li"><span className="g-mark" style={{ background: '#EEF0F6', color: 'var(--text-3)' }}><Ic n="lock" /></span><span><b>{"Keep both events in the audit log"}</b>{" "}<span className="t-3">{"(always on)"}</span></span></div>
                      </div>
                    )}
                    <div className="spacer" />
                    <ErrorBanner compact error={resolve.error} />
                    {pod && (
                      <div className="hstack g-resolve" style={{ gap: '10px', padding: '12px 20px 18px 60px', flexWrap: 'wrap', rowGap: '8px' }} data-p="4">
                        <Btn
                          className="d-btn d-btn--primary"
                          style={{ height: '44px', padding: '0 22px', background: 'linear-gradient(135deg,#10B981 0%,#047857 100%)', boxShadow: '0 6px 16px rgba(4,120,87,.28)' }}
                          testId="resolve"
                          busy={resolve.pending}
                          disabled={resolved || managers.loading}
                          onClick={() => void resolve.run()}
                        >
                          <Ic n="check" />{resolved ? 'Resolved: delivery kept' : 'Resolve: keep the delivery'}
                        </Btn>
                        <div className="spacer" />
                        <span className="d-sub" style={{ fontSize: '13px', lineHeight: '1.4', width: '160px', marginLeft: '16px' }}>{`${driverName.split(' ')[0]} and ${stop?.outletId} are told the outcome automatically`}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="d-panel" style={{ width: '340px' }}>
                  <div className="d-card">
                    <div className="d-card__head">
                      <Ic n="history" />
                      <span className="d-card__title">{"Audit log · "}<span className="id">{stop?.orderId}</span></span>
                      <span className="spacer" />
                      <span className="m-tag m-tag--ok" style={{ fontSize: '12.5px' }}><Ic n="shield-check" />{"Tamper-evident"}</span>
                    </div>
                    <div className="vstack" style={{ gap: '0', padding: '0 18px 12px' }}>
                      {timeline.map((x, i) => (
                        <div key={i} className="g-audit">
                          <span className="g-audit__t">{fmtClock(x.at)}</span>
                          <span className="g-audit__rail"><i style={x.dot} /></span>
                          <span>{x.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="d-card" style={{ flex: '1' }}>
                    <div className="d-card__head">
                      <span style={{ color: 'var(--st-delivered-fg)', display: 'flex' }}><Ic n="cloud-check" /></span>
                      <span className="d-card__title">{"Synced without conflict"}</span>
                      <div className="spacer" />
                      <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{clean.length}{syncedAt ? ` at ${fmtClock(syncedAt)}` : ''}</span>
                    </div>
                    <div className="vstack" style={{ gap: '0', padding: '0 18px 12px' }}>
                      {clean.length === 0 && <span className="t-3" style={{ fontSize: '13px' }}>{"No other records."}</span>}
                      {clean.map(e => (
                        <div key={e.id} className="g-li" style={{ padding: '5px 0' }}>
                          <span className="g-mark g-mark--ok"><Ic n="check" /></span>
                          <span style={{ flex: '1' }}>{syncedLabel(e, stops)}</span>
                          <span className="t-3">{fmtClock(e.savedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
