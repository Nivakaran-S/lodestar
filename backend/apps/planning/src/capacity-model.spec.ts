import { MlClient } from '@lodestar/platform';
import { CapacityService, isoYearWeek } from './capacity.service';
import { demandWape, measureDemand } from './planning-rules';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AT = new Date('2026-10-03T09:00:00Z'); // Sat 3 Oct 2026 (Colombo): the outlook starts on Mon 28 Sep (W40)

function prismaStub(historyDays = 5) {
  const history = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].slice(0, historyDays).flatMap((d) => [
    { runDate: day(d), tempClass: 'CHILLED', _sum: { m3: 10 } },
    { runDate: day(d), tempClass: 'AMBIENT', _sum: { m3: 20 } },
  ]);
  const cal = ['2026-09-28', '2026-09-29', '2026-10-05', '2026-10-06'].map((d) => ({ date: day(d), isOperating: true, festivalRamp: 0, isPayday: false, festivalName: null, monsoon: 1 }));
  // the calendar runs to the end of W41 (a closed Sunday), so both weeks are whole weeks of the outlook
  cal.push({ date: day('2026-10-11'), isOperating: false, festivalRamp: 0, isPayday: false, festivalName: null, monsoon: 1 });
  return {
    order: { groupBy: jest.fn().mockResolvedValue(history) },
    vehicle: { findMany: jest.fn().mockResolvedValue([{ capacityM3: 26.4 }]) },
    calendar: { findMany: jest.fn().mockResolvedValue(cal) },
    demandForecast: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

function ml(weeks: any[] | null) {
  const c = Object.assign(new MlClient(), { baseUrl: 'http://ml:8000' });
  const forecastWeeks = jest.spyOn(c, 'forecastWeeks').mockResolvedValue(weeks);
  return { c, forecastWeeks };
}

const modelWeek = (weekStart: string, brand: string, totalM3: number, chilledM3: number) => ({
  depot: 'KANDY', brand, ...isoYearWeek(weekStart), weekStart, horizon: 28, totalM3, chilledM3, calendarFrom: 'request',
});

describe('capacity outlook with the demand model (DSP-05)', () => {
  it('uses the model per week (sum over brands), keeps the weeks[] shape and stores forecasts of weeks ahead', async () => {
    const prisma = prismaStub();
    const { c, forecastWeeks } = ml(['2026-09-28', '2026-10-05'].flatMap((ws) => [
      modelWeek(ws, 'FRESH', 300.4, 120.2), modelWeek(ws, 'STYLE', 100, 0), modelWeek(ws, 'TECH', 50, 0),
    ]));
    const out = await new CapacityService(prisma as any, c).getCapacityOutlook('KANDY', AT);
    const [asked, calendar] = forecastWeeks.mock.calls[0];
    expect(asked).toHaveLength(6);
    expect(asked[0]).toEqual({ depot: 'KANDY', brand: 'FRESH', isoYear: 2026, isoWeek: 40 });
    expect(calendar[0]).toEqual({ date: '2026-09-28', isOperating: true, isPayday: false, festivalRamp: 0, festivalName: null, monsoon: 1 });
    expect(out.basis.method).toBe('model');
    expect(out.weeks.map((w) => [w.week, w.estimatedTotalM3, w.estimatedChilledDemandM3, w.operatingDays])).toEqual([['W40', 450, 120, 2], ['W41', 450, 120, 2]]);
    expect(Object.keys(out.weeks[0]).sort()).toEqual(['estimatedChilledDemandM3', 'estimatedTotalM3', 'festival', 'hasPayday', 'operatingDays', 'reeferCapacityM3', 'reeferVehiclesAvailable', 'week', 'weekStart']);
    // W40 has started (no honest forecast to keep); W41 is ahead
    expect(prisma.demandForecast.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.demandForecast.upsert.mock.calls[0][0]).toMatchObject({
      where: { depot_weekStart_source: { depot: 'KANDY', weekStart: day('2026-10-05'), source: 'model' } },
      create: { depot: 'KANDY', source: 'model', totalM3: 450, chilledM3: 120 },
    });
  });

  it('falls back to the history median when the model does not answer', async () => {
    const prisma = prismaStub();
    const out = await new CapacityService(prisma as any, ml(null).c).getCapacityOutlook('KANDY', AT);
    expect(out.basis.method).toBe('history-median');
    expect(out.weeks.map((w) => w.estimatedTotalM3)).toEqual([60, 60]); // median 30 m³ a day × 2 operating days
    expect(prisma.demandForecast.upsert.mock.calls[0][0].create.source).toBe('history-median');
  });

  it('forecasts with the model even when order history is too short for the heuristic', async () => {
    const { c } = ml(['2026-09-28', '2026-10-05'].flatMap((ws) => ['FRESH', 'STYLE', 'TECH'].map((b) => modelWeek(ws, b, 10, 0))));
    const out = await new CapacityService(prismaStub(0) as any, c).getCapacityOutlook('KANDY', AT);
    expect(out.reason).toBeNull();
    expect(out.weeks.map((w) => w.estimatedTotalM3)).toEqual([30, 30]);
    const none = await new CapacityService(prismaStub(0) as any, ml(null).c).getCapacityOutlook('KANDY', AT);
    expect(none.weeks).toEqual([]);
    expect(none.reason).toMatch(/Only 0 past run dates/);
  });

  it('never fails the outlook when the forecast cannot be stored (table not migrated yet)', async () => {
    const prisma = prismaStub();
    prisma.demandForecast.upsert.mockRejectedValue(new Error('relation "planning.DemandForecast" does not exist'));
    const out = await new CapacityService(prisma as any, ml(null).c).getCapacityOutlook('KANDY', AT);
    expect(out.weeks).toHaveLength(2);
  });
});

describe('demand WAPE (measureModels)', () => {
  it('is Σ|F − A| / Σ A over the scored weeks', () => {
    expect(demandWape([
      { depot: 'KANDY', weekStart: day('2026-09-07'), forecastM3: 110, actualM3: 100 },
      { depot: 'KANDY', weekStart: day('2026-09-14'), forecastM3: 80, actualM3: 100 },
    ])).toEqual({ value: 15, n: 2 });
    expect(demandWape([]).value).toBeNull();
  });

  it('scores the model forecasts of finished weeks against delivered order volume', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { depot: 'KANDY', weekStart: day('2026-09-14'), source: 'model', totalM3: 90 },
      { depot: 'KANDY', weekStart: day('2026-09-14'), source: 'history-median', totalM3: 50 },
    ]);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { m3: 100 } });
    const out = await measureDemand({ demandForecast: { findMany }, order: { aggregate } } as any, ['KANDY'], AT);
    expect(out).toEqual({ source: 'model', measured: { value: 10, n: 1 } });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ depot: { in: ['KANDY'] } });
    expect(aggregate.mock.calls[0][0].where.runDate).toEqual({ gte: day('2026-09-14'), lt: day('2026-09-21') });
  });

  it('does not score a week whose orders miss some of its operating days', async () => {
    const findMany = jest.fn().mockResolvedValue([{ depot: 'KANDY', weekStart: day('2026-09-14'), source: 'model', totalM3: 900 }]);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { m3: 100 } });
    const prisma = {
      demandForecast: { findMany },
      calendar: { count: jest.fn().mockResolvedValue(6) },
      order: { aggregate, groupBy: jest.fn().mockResolvedValue([{ runDate: day('2026-09-15') }]) },
    };
    const out = await measureDemand(prisma as any, ['KANDY'], AT);
    expect(out.measured).toMatchObject({ value: null, n: 0, reason: expect.stringMatching(/1 depot-week only partly recorded/) });
    expect(aggregate).not.toHaveBeenCalled();
    // with every operating day recorded it is scored
    prisma.order.groupBy.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ runDate: day(`2026-09-1${4 + i}`) })));
    expect((await measureDemand(prisma as any, ['KANDY'], AT)).measured).toEqual({ value: 800, n: 1 });
  });
});
