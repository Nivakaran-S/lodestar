'use client';
// The plan board's lanes (DSP-02, DSP-12): one lane per vehicle with up to two trip cards, built from real Trips
// or from a planning-agent draft. Markup and classes from the DSP-02 design.
import { useMemo } from 'react';
import { Ic } from './icons';
import { type AgentConfig, useAgentConfig } from './settings-data';
import { fmtClock, fmtNum, pct, title } from '@/lib/format';
import { useQuery } from '@/lib/odata/hooks';
import type { AgentRunDetail, AgentTrip, Order, Trip, Vehicle } from '@/lib/odata/types';
import { depotFilter } from '@/lib/workday';
import { PLAN_EVENTS } from './plan-data';
import { loadTone, usePlanningRules } from './planning-rules';

export /** One card on the board, from a real trip or from the agent's draft. */
interface Card {
  id: string;
  vehicleId: string;
  tripNo: number;
  brand: string;
  district: string;
  chilled: boolean;
  stops: number;
  firstOutlet?: string;
  kg: number;
  m3: number;
  minutes: number;
  departs?: string | null;
  status?: string;
}

/** The planning agent's limits (AgentRuns/Lodestar.AgentConfig); undefined while they load. */
export type PlanLimits = AgentConfig['limits'] | undefined;

/** A trip's minute budget for its brand, from the agent's limits (Fresh window or the Style/Tech day). */
export const budget = (brand: string, limits: PlanLimits): number | undefined =>
  limits ? (brand === 'FRESH' ? limits.freshMinutesBudget : limits.otherMinutesBudget) : undefined;

/** The board's second-trip column head: "Trip 2 · max N trips a day" with N from the agent's limits. */
export const tripTwoHead = (limits: PlanLimits) => `Trip 2 · max ${limits?.maxTripsPerVehicle ?? '—'} trips a day`;

/** Load class by the planning service's level (PlanningRules.load.warnPct). */
function capClass(used: number, cap: number, warnPct: number | undefined) {
  const t = loadTone(used, cap, warnPct);
  return t === 'ok' ? '' : t;
}

/** A draft time ("03:39", Colombo) on the run date as an instant; full timestamps pass through. */
export function draftTime(day: string | undefined, t: string | null | undefined): string | null {
  if (!t) return null;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return t;
  return day ? `${day.slice(0, 10)}T${t.padStart(5, '0')}:00+05:30` : null;
}

/** A card or lane that opens its trip (the plan board's trip drawer) on click and with Enter. */
const opener = (open?: () => void) => open ? {
  role: 'button', tabIndex: 0, style: { cursor: 'pointer' },
  onClick: (e: React.MouseEvent) => { e.stopPropagation(); open(); },
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } },
} : {};

export function TripCard({ c, v, limits, onOpen }: { c: Card; v?: Vehicle; limits?: PlanLimits; onOpen?: (c: Card) => void }) {
  const warnPct = usePlanningRules().data?.load.warnPct;
  const kgCls = capClass(c.kg, v?.capacityKg ?? 0, warnPct);
  const m3Cls = capClass(c.m3, v?.capacityM3 ?? 0, warnPct);
  return (
    <div className={`x-trip x-trip--${c.brand.toLowerCase()}`} data-trip={c.id} {...opener(onOpen && (() => onOpen(c)))}>
      <div className="x-trip__head">
        <span className="x-trip__t">{title(c.brand)} · {c.district}</span>
        {c.chilled ? <span className="m-tag m-tag--cold"><Ic n="snow" />{"Chilled"}</span> : <span className="m-tag"><span className="dot" style={{ color: '#98A1B3' }} />{"Dry"}</span>}
        <span className="spacer" />
        <span className="x-trip__min"><b>{c.minutes}</b>{c.brand === 'FRESH' ? 'min' : `/ ${budget(c.brand, limits) ?? '—'} min`}</span>
      </div>
      <div className="x-trip__meta">
        <Ic n="pin" />
        {c.stops} stop{c.stops === 1 ? '' : 's'}
        {c.firstOutlet ? <> · <span className="id">{c.firstOutlet}</span>{c.stops > 1 ? ` +${c.stops - 1}` : ''}</> : null}
        {c.departs ? ` · departs ${fmtClock(c.departs)}` : ''}
        {c.status ? ` · ${title(c.status)}` : ''}
      </div>
      <div className="x-caps">
        <div className="x-cap">
          <div className="x-cap__h"><span>{"kg"}</span><b className={kgCls}>{fmtNum(c.kg)} / {fmtNum(v?.capacityKg)}</b></div>
          <div className="x-cap__t"><div className={kgCls} style={{ width: `${pct(c.kg, v?.capacityKg)}%` }} /></div>
        </div>
        <div className="x-cap">
          <div className="x-cap__h"><span>{"m³"}</span><b className={m3Cls}>{fmtNum(c.m3, 1)} / {fmtNum(v?.capacityM3, 1)}</b></div>
          <div className="x-cap__t"><div className={m3Cls} style={{ width: `${pct(c.m3, v?.capacityM3)}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

export function Lane({ vehicleId, cards, v, limits, onOpen }: { vehicleId: string; cards: Card[]; v?: Vehicle; limits?: PlanLimits; onOpen?: (c: Card) => void }) {
  // the booklet's two budgets: Fresh trips share one (270 min), Style and Tech trips the other (480 min). The lane shows
  // the group closest to its limit; a vehicle with both says so under the bar.
  const groups = (['FRESH', 'OTHER'] as const)
    .map(g => ({ g, minutes: cards.filter(c => (c.brand === 'FRESH') === (g === 'FRESH')).reduce((s, c) => s + c.minutes, 0), max: budget(g === 'FRESH' ? 'FRESH' : 'STYLE', limits) }))
    .filter(x => cards.some(c => (c.brand === 'FRESH') === (x.g === 'FRESH')));
  const bind = [...groups].sort((a, b) => (b.max ? b.minutes / b.max : 0) - (a.max ? a.minutes / a.max : 0))[0];
  const minutes = bind?.minutes ?? 0;
  const max = bind?.max ?? budget('FRESH', limits);
  const other = groups.find(x => x !== bind);
  const reefer = v?.tempClass === 'CHILLED';
  return (
    <div className="x-lane" data-vehicle={vehicleId}>
      <div className="x-veh" {...opener(onOpen && cards[0] && (() => onOpen(cards[0])))} aria-label={onOpen ? `Open ${vehicleId}'s trip` : undefined}>
        <div className="x-veh__id"><span className={`x-veh__ic${reefer ? '' : ' x-veh__ic--dry'}`}><Ic n={v?.type === 'VAN' ? 'van' : 'truck'} /></span><span className="id">{vehicleId}</span></div>
        <div className="x-veh__type">{reefer ? 'Reefer' : 'Dry'} {v?.type === 'VAN' ? 'van' : 'truck'} · {fmtNum(v?.capacityM3, 1)} m³</div>
        <div className="x-veh__min"><span>{minutes}<small>/ {max ?? '—'} min</small></span></div>
        <div className="x-veh__bar"><div style={{ width: `${pct(minutes, max)}%` }} /></div>
        {other && <div className="x-veh__type" data-testid="other-budget">{other.g === 'FRESH' ? 'Fresh' : 'Style/Tech'} {other.minutes}/{other.max ?? '—'} min</div>}
        {v && <div className="x-veh__fuel"><span className="hstack" style={{ gap: '5px' }}><Ic n="fuel" /><b>{v.usedLThisWeek}</b>/ {v.weeklyLFuel} L</span></div>}
      </div>
      {cards.slice(0, 2).map(c => <TripCard key={c.id} c={c} v={v} limits={limits} onOpen={onOpen} />)}
    </div>
  );
}

/** The board foot: "30 more: 4 reefer trucks · 1 reefer van · 23 dry trucks · 2 ambient vans". */
export function idleSummary(idle: Vehicle[]): string {
  const kinds: Array<[string, (v: Vehicle) => boolean]> = [
    ['reefer truck', v => v.tempClass === 'CHILLED' && v.type !== 'VAN'],
    ['reefer van', v => v.tempClass === 'CHILLED' && v.type === 'VAN'],
    ['dry truck', v => v.tempClass !== 'CHILLED' && v.type !== 'VAN'],
    ['ambient van', v => v.tempClass !== 'CHILLED' && v.type === 'VAN'],
  ];
  const parts = kinds.map(([label, is]) => [label, idle.filter(is).length] as const).filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}${n === 1 ? '' : 's'}`);
  return `${idle.length} more${parts.length ? `: ${parts.join(' · ')}` : ''}`;
}

/** Cards for the board: the agent draft's trips when `draft` is given, else the run date's real trips. */
export function useBoardCards(opts: { draft: AgentRunDetail | null; tripsFilter?: string; ordersFilter?: string; active: readonly string[] }) {
  const { draft, tripsFilter, ordersFilter, active } = opts;
  const trips = useQuery<Trip[]>(tripsFilter ? `board:${tripsFilter}` : null, c =>
    c.all<Trip>('Trips', { filter: tripsFilter, expand: 'stops($select=id,orderId,outletId,stopSeq,status)', orderby: 'vehicleId,tripNumber' }),
  { refreshOn: ['eta_update', ...PLAN_EVENTS] });
  const orders = useQuery<Order[]>(ordersFilter ? `sizes:${ordersFilter}` : null, c => c.all<Order>('Orders', { filter: ordersFilter, select: 'id,kg,m3,status' }),
  { refreshOn: PLAN_EVENTS });
  const fleet = useQuery<Vehicle[]>(`fleet:${active.join(',')}`, c => c.all<Vehicle>('Vehicles', { filter: depotFilter('depot', active) }));
  const config = useAgentConfig();
  const vehicles = useMemo(() => new Map((fleet.data ?? []).map(v => [v.id, v])), [fleet.data]);
  const sizes = useMemo(() => new Map((orders.data ?? []).map(o => [o.id, o])), [orders.data]);

  const cards: Card[] = useMemo(() => {
    if (draft?.plan?.trips) {
      return draft.plan.trips.map((t: AgentTrip) => ({
        id: t.id, vehicleId: t.vehicleId, tripNo: t.tripNo, brand: t.brand, district: t.district, chilled: t.chilled,
        stops: t.orderIds.length, firstOutlet: t.stops?.[0]?.outletId, kg: t.kg, m3: t.m3, minutes: t.minutes,
        departs: draftTime(typeof draft.runDate === 'string' ? draft.runDate : undefined, t.departs),
      }));
    }
    return (trips.data ?? []).map(t => {
      const stops = [...(t.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq);
      const kg = stops.reduce((s, st) => s + (sizes.get(st.orderId)?.kg ?? 0), 0);
      const m3 = stops.reduce((s, st) => s + (sizes.get(st.orderId)?.m3 ?? 0), 0);
      return {
        id: t.id, vehicleId: t.vehicleId, tripNo: t.tripNumber, brand: t.brand, district: t.district,
        chilled: vehicles.get(t.vehicleId)?.tempClass === 'CHILLED', stops: new Set(stops.map(s => s.outletId)).size,
        firstOutlet: stops[0]?.outletId, kg, m3, minutes: t.planMinutes ?? 0, departs: t.departTime, status: t.status,
      };
    });
  }, [draft, trips.data, sizes, vehicles]);

  const lanes = useMemo(() => {
    const m = new Map<string, Card[]>();
    cards.forEach(c => m.set(c.vehicleId, [...(m.get(c.vehicleId) ?? []), c].sort((a, b) => a.tripNo - b.tripNo)));
    return [...m.entries()];
  }, [cards]);
  const down = (fleet.data ?? []).filter(v => v.status === 'WORKSHOP');
  const idle = (fleet.data ?? []).filter(v => v.status !== 'WORKSHOP' && !lanes.some(([id]) => id === v.id));
  return { trips, orders, fleet, vehicles, cards, lanes, down, idle, limits: config.data?.limits as PlanLimits, loading: !draft && !trips.data && !trips.error };
}
