import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { Brand, OrderStatus, TempClass, VehicleStatus } from '@prisma/client';
import { addBusinessDays, businessDate, businessWeekday, MlClient, runDateRange, runDateValue, toBusinessDate } from '@lodestar/platform';
import { OUTLOOK_WEEKS } from './planning-rules';

/** Past run dates of orders the outlook needs before it forecasts anything. */
export const MIN_HISTORY_DAYS = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** ISO 8601 week number of a YYYY-MM-DD date. */
export function isoWeek(day: string): number {
  const d = new Date(`${day}T00:00:00Z`);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
}

/** ISO 8601 year and week of a YYYY-MM-DD date (the year of its Thursday). */
export function isoYearWeek(day: string): { isoYear: number; isoWeek: number } {
  const d = new Date(`${day}T00:00:00Z`);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
  return { isoYear: t.getUTCFullYear(), isoWeek: isoWeek(day) };
}

/** The brands the demand model forecasts per depot; a depot's week is their sum. */
const BRANDS: Brand[] = [Brand.FRESH, Brand.STYLE, Brand.TECH];

interface CalendarDay {
  date: Date;
  isOperating: boolean;
  festivalRamp: number;
  isPayday: boolean;
  festivalName: string | null;
  monsoon?: number | null;
}

/**
 * Capacity Service
 * Computes available reefer capacity for a depot/date and flags shortfalls.
 * (chilled demand of a run date vs the m³ of the depot's available reefers).
 */
@Injectable()
export class CapacityService {
  private readonly logger = new Logger(CapacityService.name);

  constructor(
    private prisma: PrismaService,
    private ml: MlClient = new MlClient(),
  ) {}

  async getReeferCapacity(depot: string) {
    const reeferVehicles = await this.prisma.vehicle.findMany({
      where: { depot, tempClass: TempClass.CHILLED, status: VehicleStatus.AVAILABLE },
    });
    const totalKg = reeferVehicles.reduce((s, v) => s + v.capacityKg, 0);
    const totalM3 = reeferVehicles.reduce((s, v) => s + v.capacityM3, 0);
    return { vehicles: reeferVehicles, totalKg, totalM3 };
  }

  async getChilledDemand(depot: string, runDate: Date) {
    // Run dates are stored as UTC midnight of their Sri Lanka calendar date (never server-local).
    const { start: startOf, end: endOf } = runDateRange(runDate);

    const agg = await this.prisma.order.aggregate({
      where: {
        runDate: { gte: startOf, lt: endOf },
        tempClass: TempClass.CHILLED,
        outlet: { depot },
        status: { notIn: ['DEFERRED', 'EXCEPTION', 'CANCELLED'] as any },
      },
      _sum: { m3: true, kg: true },
      _count: { id: true },
    });

    return {
      m3: agg._sum.m3 ?? 0,
      kg: agg._sum.kg ?? 0,
      orders: agg._count.id,
    };
  }

  /**
   * DSP-05 capacity outlook: OUTLOOK_WEEKS ISO weeks from the current week. Weeks the Calendar does not cover yet
   * are listed in `uncoveredWeeks`, never guessed. Reefer capacity is the m³ of the depot's available chilled
   * vehicles.
   *
   * The weekly volume comes from the demand model (ML service, Adagard Task 2A: total and chilled m³ per depot ×
   * brand) when it answers (basis.method 'model'); otherwise (ML_URL unset, the service down or slow, the week
   * outside the model's horizon) from the heuristic (basis.method 'history-median'): the median total and chilled
   * m³ of the depot's past run dates (Orders, cancelled ones left out), each operating day in the Calendar adding
   * that median × (1 + its festival_ramp). The heuristic needs MIN_HISTORY_DAYS run dates; with fewer and no model
   * it returns no weeks and says why. The forecast of each week that has not started is stored (DemandForecast)
   * so measureModels can score its WAPE once the week is over.
   */
  async getCapacityOutlook(depot: string, at: Date = new Date()) {
    const today = businessDate(at);
    const monday = addBusinessDays(today, -((businessWeekday(today) + 6) % 7));
    const history = await this.prisma.order.groupBy({
      by: ['runDate', 'tempClass'],
      where: { runDate: { lt: runDateValue(today) }, outlet: { depot }, status: { not: OrderStatus.CANCELLED } },
      _sum: { m3: true },
    });
    const days = new Map<string, { total: number; chilled: number }>();
    for (const h of history) {
      const iso = toBusinessDate(h.runDate);
      const d = days.get(iso) ?? { total: 0, chilled: 0 };
      d.total += h._sum.m3 ?? 0;
      if (h.tempClass === TempClass.CHILLED) d.chilled += h._sum.m3 ?? 0;
      days.set(iso, d);
    }
    const isos = [...days.keys()].sort();
    const basis = {
      historyDays: isos.length,
      historyFrom: isos[0] ?? null,
      historyTo: isos[isos.length - 1] ?? null,
      minHistoryDays: MIN_HISTORY_DAYS,
      medianTotalM3PerDay: isos.length ? round1(median([...days.values()].map((d) => d.total))) : null,
      medianChilledM3PerDay: isos.length ? round1(median([...days.values()].map((d) => d.chilled))) : null,
      method: 'history-median' as 'model' | 'history-median',
    };
    const tooLittleHistory = () => ({
      depot, weeks: [], uncoveredWeeks: [], basis,
      reason: `Only ${isos.length} past run date${isos.length === 1 ? '' : 's'} of orders; the forecast needs ${MIN_HISTORY_DAYS}.`,
    });
    if (isos.length < MIN_HISTORY_DAYS && !this.ml.enabled) return tooLittleHistory();

    const reefers = await this.prisma.vehicle.findMany({
      where: { depot, tempClass: TempClass.CHILLED, status: VehicleStatus.AVAILABLE },
      select: { capacityM3: true },
    });
    const reeferCapacityM3 = round1(reefers.reduce((s, v) => s + v.capacityM3, 0));
    const lastWeekEnd = addBusinessDays(monday, OUTLOOK_WEEKS * 7);
    const calendar: CalendarDay[] = await this.prisma.calendar.findMany({
      where: { date: { gte: runDateValue(monday), lt: runDateValue(lastWeekEnd) } },
      select: { date: true, isOperating: true, festivalRamp: true, isPayday: true, festivalName: true, monsoon: true },
    });

    const covered: { week: string; weekStart: string; calDays: CalendarDay[] }[] = [];
    const uncoveredWeeks: string[] = [];
    // A week the calendar stops inside (it ends before that week's Saturday) is not forecast: the model's figure is a
    // whole week's m³, while the reefer trips would only count the few days the calendar has, a false shortfall.
    const calendarEnd = calendar.reduce((m, d) => { const iso = toBusinessDate(d.date); return iso > m ? iso : m; }, '');
    for (let w = 0; w < OUTLOOK_WEEKS; w++) {
      const weekStart = addBusinessDays(monday, w * 7);
      const weekEnd = addBusinessDays(weekStart, 7);
      const week = `W${isoWeek(weekStart)}`;
      const calDays = calendar.filter((d) => { const iso = toBusinessDate(d.date); return iso >= weekStart && iso < weekEnd; });
      if (!calDays.length || calendarEnd < addBusinessDays(weekStart, 5)) { uncoveredWeeks.push(week); continue; }
      covered.push({ week, weekStart, calDays });
    }

    const model = await this.modelWeeks(depot, covered.map((c) => c.weekStart), calendar);
    if (!model && isos.length < MIN_HISTORY_DAYS) return tooLittleHistory();
    if (model) basis.method = 'model';
    const weeks = covered.map(({ week, weekStart, calDays }) => {
      const open = calDays.filter((d) => d.isOperating);
      const ramp = open.reduce((s, d) => s + 1 + d.festivalRamp, 0);
      const m = model?.get(weekStart);
      return {
        week,
        weekStart,
        operatingDays: open.length,
        estimatedChilledDemandM3: Math.round(m ? m.chilled : basis.medianChilledM3PerDay! * ramp),
        estimatedTotalM3: Math.round(m ? m.total : basis.medianTotalM3PerDay! * ramp),
        reeferVehiclesAvailable: reefers.length,
        reeferCapacityM3,
        hasPayday: calDays.some((d) => d.isPayday),
        festival: calDays.find((d) => d.festivalName)?.festivalName ?? null,
      };
    });
    await this.storeForecasts(depot, today, weeks, basis.method);
    return { depot, weeks, uncoveredWeeks, basis, reason: null };
  }

  /** The demand model's total and chilled m³ per week start (summed over the brands), or null (heuristic). */
  private async modelWeeks(depot: string, weekStarts: string[], calendar: CalendarDay[]) {
    if (!this.ml.enabled || !weekStarts.length) return null;
    const asked = weekStarts.flatMap((ws) => BRANDS.map((brand) => ({ depot, brand: String(brand), ...isoYearWeek(ws) })));
    const out = await this.ml.forecastWeeks(asked, calendar.map((d) => ({
      date: toBusinessDate(d.date), isOperating: d.isOperating, isPayday: d.isPayday, festivalRamp: d.festivalRamp,
      festivalName: d.festivalName, monsoon: d.monsoon ? 1 : 0,
    })));
    if (!out || out.length !== asked.length) return null;
    const byWeek = new Map<string, { total: number; chilled: number }>();
    for (const f of out) {
      const w = byWeek.get(f.weekStart) ?? { total: 0, chilled: 0 };
      w.total += f.totalM3;
      w.chilled += f.chilledM3;
      byWeek.set(f.weekStart, w);
    }
    return weekStarts.every((ws) => byWeek.has(ws)) ? byWeek : null;
  }

  /**
   * Keep the forecast of every week that has not started yet (the latest one before the week begins wins), so
   * measureModels can score it against the volume delivered once the week is over. Best effort: the outlook
   * never fails on it.
   */
  private async storeForecasts(
    depot: string,
    today: string,
    weeks: { weekStart: string; estimatedTotalM3: number; estimatedChilledDemandM3: number }[],
    source: string,
  ) {
    const ahead = weeks.filter((w) => w.weekStart > today);
    if (!ahead.length || !this.prisma.demandForecast) return;
    try {
      for (const w of ahead) {
        const weekStart = runDateValue(w.weekStart);
        const data = { totalM3: w.estimatedTotalM3, chilledM3: w.estimatedChilledDemandM3, forecastAt: new Date() };
        await this.prisma.demandForecast.upsert({
          where: { depot_weekStart_source: { depot, weekStart, source } },
          create: { depot, weekStart, source, ...data },
          update: data,
        });
      }
    } catch (e) {
      this.logger.warn(`Demand forecast not stored for ${depot}: ${(e as Error).message}`);
    }
  }
}
