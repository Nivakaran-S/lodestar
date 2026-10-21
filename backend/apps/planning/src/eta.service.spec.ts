import { runDateRange } from '@lodestar/platform';
import { EtaService, explainLateRisk } from './eta.service';
import { CapacityService } from './capacity.service';
import { dayRange } from './planning.service';

/** ETA and late risk in Sri Lanka time, whatever the server TZ (run with TZ=UTC and TZ=America/New_York). */
describe('EtaService in Asia/Colombo time', () => {
  const eta = new EtaService({} as any);
  const lk = (hhmm: string, date = '2026-04-07') => new Date(`${date}T${hhmm}:00+05:30`);

  it('derives the planned hour from etaPlan in Colombo time', () => {
    // 05:10 Colombo is 23:40 UTC the day before: a UTC server would read hour 23.
    const r = eta.computeModelEta({ etaPlan: lk('05:10'), roadClass: 'hill', isMonsoon: true, windowClose: '08:00' });
    expect(r.lateRiskPct).toBe(20); // before 6 AM, monsoon
    expect(r.etaModel.getTime() - lk('05:10').getTime()).toBe(29 * 60_000);
  });

  it('flags a model ETA within 30 min of the 08:00 window close (Colombo)', () => {
    // 07:00 Colombo + 42 min = 07:42 → past 07:30 → +30 %. On a UTC server getHours() would say 02:12.
    const r = eta.computeModelEta({ etaPlan: lk('07:00'), roadClass: 'hill', isMonsoon: true, windowClose: '08:00' });
    expect(r.etaModel.toISOString()).toBe('2026-04-07T02:12:00.000Z');
    expect(r.lateRiskPct).toBe(83);
  });

  it('does not flag an early ETA even when the server clock is far off Colombo', () => {
    const r = eta.computeModelEta({ etaPlan: lk('05:00'), roadClass: 'urban', isMonsoon: false, windowClose: '08:00' });
    expect(r.lateRiskPct).toBe(8);
  });

  it('plan ETA adds minutes on the instant (no local-time arithmetic)', () => {
    const at = eta.computePlanEta({
      departTime: lk('03:30'), depotToDistMin: 120, priorStopServiceMins: 29, priorInterStopMins: 10, interStopMin: 6, serviceMin: 20,
    });
    expect(at.toISOString()).toBe(lk('06:15').toISOString());
  });

  it('run-date windows are the stored calendar date', () => {
    expect(dayRange('2026-04-07')).toEqual(runDateRange('2026-04-07'));
    expect(dayRange(new Date('2026-04-07T00:00:00Z')).iso).toBe('2026-04-07');
    // An instant late on 6 Apr UTC is already 7 Apr in Colombo.
    expect(dayRange(new Date('2026-04-06T19:00:00Z')).iso).toBe('2026-04-07');
  });

  it('capacity outlook weeks are Mondays from the current week, forecast from order history', async () => {
    const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const history = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].flatMap((d, i) => [
      { runDate: day(d), tempClass: 'CHILLED', _sum: { m3: 10 + i } },
      { runDate: day(d), tempClass: 'AMBIENT', _sum: { m3: 20 } },
    ]);
    const prisma = {
      order: { groupBy: jest.fn().mockResolvedValue(history) },
      vehicle: { findMany: jest.fn().mockResolvedValue([{ capacityM3: 26.4 }, { capacityM3: 7 }]) },
      calendar: {
        findMany: jest.fn().mockResolvedValue([
          { date: day('2026-09-28'), isOperating: true, festivalRamp: 0, isPayday: false, festivalName: null },
          { date: day('2026-09-29'), isOperating: true, festivalRamp: 0.5, isPayday: true, festivalName: 'Vap' },
          { date: day('2026-10-04'), isOperating: false, festivalRamp: 0, isPayday: false, festivalName: null },
        ]),
      },
    };
    // Sat 3 Oct 2026 (Colombo): the outlook starts on Mon 28 Sep (W40)
    const out = await new CapacityService(prisma as any).getCapacityOutlook('KANDY', new Date('2026-10-03T09:00:00Z'));
    expect(prisma.order.groupBy.mock.calls[0][0].where.runDate.lt.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    expect(out.basis).toMatchObject({ historyDays: 5, historyFrom: '2026-09-28', historyTo: '2026-10-02', medianChilledM3PerDay: 12, medianTotalM3PerDay: 32 });
    expect(out.weeks).toEqual([{
      week: 'W40', weekStart: '2026-09-28', operatingDays: 2,
      estimatedChilledDemandM3: 30, estimatedTotalM3: 80, // median × (1 + 1.5)
      reeferVehiclesAvailable: 2, reeferCapacityM3: 33.4, hasPayday: true, festival: 'Vap',
    }]);
    expect(out.uncoveredWeeks).toEqual(['W41', 'W42', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49']);
  });

  it('capacity outlook leaves out a week the calendar stops inside (a part week is no shortfall)', async () => {
    const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const history = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].map((d) => ({ runDate: day(d), tempClass: 'CHILLED', _sum: { m3: 10 } }));
    const week = (from: string, n: number) => Array.from({ length: n }, (_, i) => ({
      date: new Date(new Date(`${from}T00:00:00Z`).getTime() + i * 86400000), isOperating: true, festivalRamp: 0, isPayday: false, festivalName: null,
    }));
    const prisma = {
      order: { groupBy: jest.fn().mockResolvedValue(history) },
      vehicle: { findMany: jest.fn().mockResolvedValue([{ capacityM3: 26.4 }]) },
      calendar: { findMany: jest.fn().mockResolvedValue([...week('2026-09-28', 7), ...week('2026-10-05', 3)]) }, // ends Wed 7 Oct
    };
    const out = await new CapacityService(prisma as any).getCapacityOutlook('KANDY', new Date('2026-10-03T09:00:00Z'));
    expect(out.weeks.map((w) => w.week)).toEqual(['W40']);
    expect(out.uncoveredWeeks[0]).toBe('W41');
  });

  it('capacity outlook forecasts nothing without enough history', async () => {
    const prisma = { order: { groupBy: jest.fn().mockResolvedValue([]) }, vehicle: { findMany: jest.fn() }, calendar: { findMany: jest.fn() } };
    const out = await new CapacityService(prisma as any).getCapacityOutlook('KANDY', new Date('2026-10-03T09:00:00Z'));
    expect(out.weeks).toEqual([]);
    expect(out.reason).toMatch(/Only 0 past run dates/);
    expect(prisma.calendar.findMany).not.toHaveBeenCalled();
  });
});

/** DSP-15: the late-risk parts add up to the stored figure, the same way computeModelEta sets it. */
describe('explainLateRisk', () => {
  const lk = (hhmm: string) => new Date(`2026-04-07T${hhmm}:00+05:30`);

  it('splits a monsoon hill stop into base, window and road parts', () => {
    const r = explainLateRisk({ roadClass: 'hill', isMonsoon: true, plannedHour: 5, etaModel: lk('07:28'), windowClose: '07:45', actual: 61 });
    expect(r.parts.map(p => p.value)).toEqual([20, 30, 11]);
    expect(r.parts.reduce((s, p) => s + p.value, 0)).toBe(61);
    expect(r.planned).toBe(50);
  });

  it('matches computeModelEta for the planned figure', () => {
    const eta = new EtaService({} as any);
    const m = eta.computeModelEta({ etaPlan: lk('07:00'), roadClass: 'hill', isMonsoon: true, windowClose: '08:00' });
    const r = explainLateRisk({ roadClass: 'hill', isMonsoon: true, plannedHour: 7, etaModel: m.etaModel, windowClose: '08:00', actual: m.lateRiskPct });
    expect(r.planned).toBe(m.lateRiskPct);
    expect(r.parts[2].value).toBe(0);
  });

  it('has no parts without a planned arrival or a stored figure', () => {
    expect(explainLateRisk({ roadClass: 'urban', isMonsoon: false, plannedHour: null, etaModel: null, windowClose: '08:00', actual: 8 }).parts).toEqual([]);
  });

  it('reads the stop, its road class and the monsoon flag', async () => {
    const prisma = {
      tripStop: { findUnique: jest.fn().mockResolvedValue({ id: 's2', etaPlan: lk('05:01'), etaModel: lk('07:28'), lateRiskPct: 61, trip: { depot: 'KANDY', runDate: new Date('2026-04-07T00:00:00Z') }, outlet: { district: 'Nuwara Eliya', windowClose: '07:45' } }) },
      districtTravel: { findUnique: jest.fn().mockResolvedValue({ roadClass: 'hill' }) },
      calendar: { findUnique: jest.fn().mockResolvedValue({ monsoon: 1 }) },
    };
    const r = await new EtaService(prisma as any).explainStop('s2');
    expect(r).toMatchObject({ depot: 'KANDY', roadClass: 'hill', monsoon: true, plannedHour: 5, base: 20 });
    expect(r!.parts.map(p => p.value)).toEqual([20, 30, 11]);
  });

  it('returns null for an unknown stop', async () => {
    const prisma = { tripStop: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(new EtaService(prisma as any).explainStop('x')).resolves.toBeNull();
  });
});
