'use client';
// DSP-04 Live operations, live. Markup and classes from the generated design (frontend/screens/dsp-04-live-operations.tsx).
// Data: Trips of the run date with their TripStops (ETA, late risk, status), Orders for the order thread, the
// exceptions list, and realtime: the screen joins the trip:<id> rooms, so eta_update, signal_lost/back and
// notifications refresh it as they happen (plus a 30 s safety poll). A signal loss, vehicle fault or sync conflict
// opens its P5 screen (DSP-A1, DSP-B1, DSP-A2). The legend opens DSP-15, the late-risk explainer.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colomboDay, useFocusId } from '@/lib/workday';
import { PlanSide } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { p5Link, usePlanScope, useExceptions, type ExceptionItem, runStamp } from '@/components/live/plan-data';
import Btn from '@/components/live/Btn';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { BRAND_LETTER, fmtClock, fmtDay, pct } from '@/lib/format';
import { usePlanningRules } from '@/components/live/planning-rules';
import { useAction, useQuery, useRealtimeRooms, useRealtimeStatus } from '@/lib/odata/hooks';
import type { Order, Trip, TripStop } from '@/lib/odata/types';
import { useDepots } from '@/components/live/depots';

/** At or over the planning service's late-risk alert level (PlanningRules.lateRisk.alertPct); unknown level = no. */
const atRisk = (p: number, risk: number | undefined) => risk !== undefined && p >= risk;
type Filter = 'all' | 'risk' | 'exc';
const ATT: Record<ExceptionItem['tone'], { cls: string; bg: string; fg: string; icon: 'alert' | 'clock' | 'wifi-off' }> = {
  bad: { cls: 'x-att--bad', bg: 'var(--tint-bad)', fg: 'var(--st-exception-fg)', icon: 'alert' },
  warn: { cls: 'x-att--warn', bg: 'var(--tint-warn)', fg: 'var(--st-deferred-fg)', icon: 'clock' },
  off: { cls: 'x-att--off', bg: '#EFEDEA', fg: 'var(--st-offline-fg)', icon: 'wifi-off' },
};
const STATUS_PILL: Record<string, [string, string]> = {
  PLANNED: ['m-pill--brand', 'Planned'],
  LOADING: ['m-pill--brand', 'Loading'],
  ENROUTE: ['m-pill--info', 'En route'],
  COMPLETE: ['m-pill--ok', 'Complete'],
};

const remaining = (t: Trip) => (t.stops ?? []).filter(s => !['DELIVERED', 'CANCELLED'].includes(s.status));
const maxRisk = (t: Trip) => Math.max(0, ...remaining(t).map(s => s.lateRiskPct ?? 0));
const hasException = (t: Trip) => (t.stops ?? []).some(s => s.status === 'EXCEPTION');

function riskTag(p: number, risk: number | undefined) {
  return <span className={`m-tag ${atRisk(p, risk) ? 'm-tag--warn' : 'm-tag--ok'}`}><span className="dot" />late {p}%</span>;
}

function Route({ t, selected, onSelect, risk }: { t: Trip; selected: boolean; onSelect: () => void; risk: number | undefined }) {
  const stops = [...(t.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq);
  const done = stops.filter(s => s.status === 'DELIVERED').length;
  const next = stops.find(s => !['DELIVERED', 'CANCELLED'].includes(s.status));
  const [cls, label] = hasException(t) ? ['m-pill--bad', 'Exception'] : STATUS_PILL[t.status] ?? ['', t.status];
  return (
    <div
      className={`x-route lv-click${selected ? ' is-sel' : ''}`}
      data-trip={t.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
    >
      <div className="x-route__r1">
        <span className={`bb bb--${t.brand.toLowerCase()} x-bb`}>{BRAND_LETTER[t.brand]}</span>
        <span className="id fw7">{t.vehicleId}</span>
        <span className="x-route__a">{t.district} · T{t.tripNumber}</span>
        <span className="spacer" />
        <span className={`m-pill ${cls}`}><span className="dot" />{label}</span>
      </div>
      <div className="x-route__r2">
        <div className="x-prog">
          {stops.map(s => <div key={s.id} className={s.status === 'DELIVERED' ? 'd' : s.status === 'EXCEPTION' ? 'x' : s.id === next?.id ? 'n' : ''} />)}
        </div>
        <span className="x-route__c">{done}/{stops.length}</span>
        <span className="x-route__n">
          {next ? <>Next <span className="id">{next.outletId}</span> {next.etaModel ? `~${fmtClock(next.etaModel)}` : next.etaPlan ? fmtClock(next.etaPlan) : ''}</> : t.returnTime ? `Back ${fmtClock(t.returnTime)}` : 'All stops done'}
        </span>
        <span className="spacer" />
        {next && riskTag(maxRisk(t), risk)}
      </div>
    </div>
  );
}

function Thread({ order, stop, trip }: { order?: Order; stop?: TripStop; trip: Trip }) {
  const delivered = stop?.status === 'DELIVERED';
  const enroute = trip.status === 'ENROUTE' || trip.status === 'COMPLETE';
  const loaded = trip.status !== 'PLANNED';
  const step = (on: boolean, now: boolean, label: string, time: string, icon: 'check' | 'navigate' = 'check') => (
    <div className={`thread__step ${on ? 'is-done' : now ? 'is-now' : ''}`}>
      <div className="thread__node">{on || now ? <Ic n={now && !on ? icon : 'check'} /> : null}</div>
      <div className="thread__label">{label}</div>
      <div className="thread__time">{time}</div>
    </div>
  );
  return (
    <div className="thread">
      {step(true, false, 'Received', order ? fmtDay(order.orderedAt) : '')}
      <div className="thread__bar is-done" />
      {step(true, false, 'Planned', `v${trip.planVersion}`)}
      <div className={`thread__bar${loaded ? ' is-done' : ''}`} />
      {step(loaded, false, 'Loaded', trip.bay ? `bay ${trip.bay}` : '')}
      <div className={`thread__bar${enroute ? ' is-done' : ''}`} />
      {step(enroute && delivered, enroute && !delivered, 'En route', trip.departTime ? fmtClock(trip.departTime) : '', 'navigate')}
      <div className={`thread__bar${delivered ? ' is-done' : ''}`} />
      {step(delivered, false, 'Delivered', stop?.arrivalActual ? fmtClock(stop.arrivalActual) : stop?.etaModel ? `~${fmtClock(stop.etaModel)}` : '·')}
    </div>
  );
}

export default function LiveDsp04LiveOperations() {
  const RISK = usePlanningRules().data?.lateRisk.alertPct;
  const { name: depotName } = useDepots();
  const router = useRouter();
  const [, setFocusTrip] = useFocusId('trip');
  const [, setFocusVehicle] = useFocusId('vehicle');
  const openP5 = (to: NonNullable<ReturnType<typeof p5Link>>) => {
    if (to.focus?.[0] === 'trip') setFocusTrip(to.focus[1]);
    if (to.focus?.[0] === 'vehicle') setFocusVehicle(to.focus[1]);
    router.push(to.href);
  };
  const scope = usePlanScope();
  const { runDate, tripsFilter, ordersFilter, active } = scope;
  const live = useRealtimeStatus();
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);

  const trips = useQuery<Trip[]>(tripsFilter ? `ops:${tripsFilter}` : null, c =>
    c.all<Trip>('Trips', { filter: tripsFilter, expand: 'stops', orderby: 'depot,vehicleId,tripNumber' }),
  { refreshOn: ['eta_update', 'signal_lost', 'signal_back', 'notification', 'plan_published', 'trip_released'], pollMs: 30_000 });
  useRealtimeRooms((trips.data ?? []).slice(0, 60).map(t => `trip:${t.id}`));
  const orders = useQuery<Order[]>(ordersFilter ? `ops-orders:${ordersFilter}` : null, c => c.all<Order>('Orders', { filter: ordersFilter, select: 'id,status,orderedAt,units,tempClass,outletId' }), {
    refreshOn: ['eta_update', 'notification', 'plan_published', 'order_created'], pollMs: 30_000,
  });
  const exceptions = useExceptions(runDate, ordersFilter, active);
  const markRead = useAction<string, unknown>((c, id) => c.action('Notifications', id, 'MarkRead'), { onSuccess: () => void exceptions.refresh() });

  const all = useMemo(() => trips.data ?? [], [trips.data]);
  const shown = all.filter(t => (filter === 'risk' ? atRisk(maxRisk(t), RISK) : filter === 'exc' ? hasException(t) : true));
  const selected = all.find(t => t.id === sel) ?? shown[0];
  const stops = [...(selected?.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq);
  const focusStop = stops.find(s => s.status !== 'DELIVERED') ?? stops[0];
  const byOrder = new Map((orders.data ?? []).map(o => [o.id, o]));
  const allStops = all.flatMap(t => t.stops ?? []);
  const delivered = allStops.filter(s => s.status === 'DELIVERED');
  const onTime = delivered.filter(s => !s.etaModelBandLate || !s.arrivalActual || new Date(s.arrivalActual) <= new Date(s.etaModelBandLate)).length;
  const offline = (exceptions.data ?? []).filter(x => x.tone === 'off').length;
  const top = (exceptions.data ?? []).slice(0, 3);
  const groups = active.map(d => [d, shown.filter(t => t.depot === d)] as const).filter(([, ts]) => ts.length);

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-04 Live operations">
      <div className="d-app">
        <PlanSide active="N4" />
        <div className="d-main" style={{ gap: '16px' }}>
          <div className="d-head" style={{ alignItems: 'center' }}>
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {runStamp(runDate, ', ')}
                <span className="m-sep" />
                {active.length > 1 ? 'Both depots' : depotName(active[0])}
                <span className="m-sep" />
                <span className={`m-tag ${live === 'connected' ? 'm-tag--ok' : 'm-tag--warn'}`} data-testid="live-status">
                  <span className="dot" />{runDate && runDate < colomboDay() ? 'Past run' : live === 'connected' ? 'Live' : 'Reconnecting'} · updated {fmtClock(new Date())}
                </span>
              </div>
              <div className="d-h1" style={{ fontSize: '28px' }}>
                {top.length ? `${exceptions.data!.length} thing${exceptions.data!.length === 1 ? ' needs' : 's need'} you now` : 'All routes running'}
              </div>
            </div>
            <div className="hstack" style={{ gap: '0' }}>
              <div className="x-stat"><b style={{ color: 'var(--st-delivered-fg)' }}>{delivered.length ? `${pct(onTime, delivered.length)}%` : '—'}</b><span>{"On time"}</span></div>
              <div className="x-stat"><b>{delivered.length}<small>/ {allStops.length}</small></b><span>{"Stops delivered"}</span></div>
              <div className="x-stat"><b style={{ color: 'var(--st-offline-fg)' }}>{offline}</b><span>{"Offline, expected"}</span></div>
            </div>
          </div>
          <ErrorBanner error={trips.error ?? exceptions.error ?? markRead.error} onRetry={() => { void trips.refresh(); void exceptions.refresh(); }} />
          <div className="hstack" style={{ gap: '16px', alignItems: 'stretch', flexShrink: 0 }}>
            {!exceptions.data && !exceptions.error && <Skeleton rows={1} />}
            {exceptions.data?.length === 0 && <Empty title="Nothing needs you" text="No exceptions, late risks or signal losses right now." />}
            {top.map(x => (
              <div key={x.id} className={`x-att ${ATT[x.tone].cls}`} style={{ flex: '1 1 0', minWidth: 0 }} data-exception={x.id}>
                <div className="x-att__top">
                  <span className="x-att__lead" style={{ background: ATT[x.tone].bg, color: ATT[x.tone].fg }}><Ic n={ATT[x.tone].icon} /></span>
                  <div className="x-att__main">
                    <span className="x-att__t">{x.title}</span>
                    <span className="x-att__m" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{x.meta}</span>
                  </div>
                </div>
                <div className="x-att__b">
                  {x.tone === 'off' ? <>Shown as <b>predicted</b>, never as on time. PODs save on the phone and sync when the signal is back.</> : x.value ? <>Late risk <b>{x.value}</b> on this stop.</> : 'Open exception.'}
                </div>
                {/* three cards share the row: their buttons wrap rather than push the last card off screen */}
                <div className="x-att__acts" style={{ flexWrap: 'wrap' }}>
                  {x.tripId && <Btn className="d-btn d-btn--ghost" onClick={() => setSel(x.tripId!)}><Ic n="eye" />{"Show the route"}</Btn>}
                  {x.notificationId && (
                    <Btn className="d-btn" busy={markRead.pending} onClick={() => void markRead.run(x.notificationId!)}><Ic n="check" />{"Mark handled"}</Btn>
                  )}
                  {p5Link(x) ? <Btn className="d-btn" onClick={() => openP5(p5Link(x)!)}><Ic n="arrow-right" />{p5Link(x)!.label}</Btn> : <span className="d-btn d-btn--ghost" data-lk="L163">{"Exceptions inbox"}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="hstack" style={{ gap: '16px', alignItems: 'stretch', flex: '1', minHeight: '0' }}>
            <div className="d-card" style={{ width: '364px', flexShrink: '0' }} data-testid="routes">
              <div className="d-card__head" style={{ minHeight: '50px', gap: '6px' }}>
                <span className="d-card__title" style={{ marginRight: '4px' }}>{"Routes"}</span>
                {([['all', 'All', all.length], ['risk', 'At risk', all.filter(t => atRisk(maxRisk(t), RISK)).length], ['exc', 'Exceptions', all.filter(hasException).length]] as Array<[Filter, string, number]>).map(([k, l, n]) => (
                  <span key={k} className={`d-filter lv-click${filter === k ? ' is-on' : ''}`} style={{ height: '30px', padding: '0 11px' }} role="button" tabIndex={0}
                    onClick={e => { e.stopPropagation(); setFilter(k); }} onKeyDown={e => { if (e.key === 'Enter') setFilter(k); }}>
                    {l} <b>{n}</b>
                  </span>
                ))}
              </div>
              {!trips.data && !trips.error && <Skeleton rows={4} />}
              {trips.data && shown.length === 0 && <Empty title="No routes" text={all.length ? 'No route matches this filter.' : 'No trips for this run date.'} icon="navigate" />}
              {groups.map(([d, ts]) => (
                <div key={d} className="vstack" style={{ gap: '0' }}>
                  <div className="x-grp"><Ic n="depot" className="ic ic--sm" />{depotName(d)}<span className="spacer" />{ts.length} routes</div>
                  {ts.map(t => <Route key={t.id} t={t} selected={selected?.id === t.id} onSelect={() => setSel(t.id)} risk={RISK} />)}
                </div>
              ))}
            </div>
            <div className="x-map">
              <div className="x-maplegend" style={{ top: '14px', bottom: 'auto' }} data-lk="L162">
                <span><i />{"Live position"}</span>
                <span><i className="amber" />{`Late risk ${RISK ?? '…'}% or more`}</span>
                <span><i className="dash" />{"Predicted, no signal"}</span>
              </div>
              {selected && (
                <div className="x-drawer" data-testid="route-drawer">
                  <div className="hstack" style={{ gap: '10px' }}>
                    <span className="x-veh__ic"><Ic n="van" /></span>
                    <span className="id fw8" style={{ fontSize: '15px' }}>{selected.vehicleId}</span>
                    <span className="x-meta t-2">
                      {selected.driver?.name ? `${selected.driver.name} · ` : ''}{depotName(selected.depot)} · Trip {selected.tripNumber} · {selected.brand.charAt(0) + selected.brand.slice(1).toLowerCase()} · {selected.district}
                    </span>
                    <span className="spacer" />
                    <span className="m-pill">{selected.id}</span>
                  </div>
                  <div className="hstack" style={{ gap: '20px', alignItems: 'flex-start' }}>
                    <div className="vstack" style={{ gap: '0', width: '284px', flexShrink: '0' }}>
                      {stops.map(s => (
                        <div key={s.id} className="x-stoprow" data-stop={s.id}>
                          <span className="x-n">{s.stopSeq}</span>
                          <span className="id">{s.outletId}</span>
                          <span className="t-3">{s.status === 'DELIVERED' ? 'delivered' : s.status.toLowerCase()}</span>
                          <span className="spacer" />
                          <b>{s.arrivalActual ? fmtClock(s.arrivalActual) : s.etaModel ? `~${fmtClock(s.etaModel)}` : s.etaPlan ? fmtClock(s.etaPlan) : '—'}</b>
                          {s.lateRiskPct !== null && s.lateRiskPct !== undefined && <span className={`m-tag ${atRisk(s.lateRiskPct, RISK) ? 'm-tag--warn' : 'm-tag--ok'}`}><span className="dot" />{s.lateRiskPct}%</span>}
                        </div>
                      ))}
                      {focusStop?.etaPlan && <div className="x-note" style={{ paddingTop: '6px' }}>Plan {fmtClock(focusStop.etaPlan)}{focusStop.etaModel ? ` · model ~${fmtClock(focusStop.etaModel)}` : ''}</div>}
                    </div>
                    {focusStop && (
                      <div className="vstack" style={{ gap: '8px', flex: '1', minWidth: '0' }}>
                        <div className="x-meta">
                          <span className="id fw7" style={{ color: 'var(--text)' }}>{focusStop.orderId}</span>
                          <span className="t-3">{focusStop.outletId} {byOrder.get(focusStop.orderId)?.tempClass === 'CHILLED' ? 'chilled' : 'ambient'} · {byOrder.get(focusStop.orderId)?.units ?? '—'} units</span>
                        </div>
                        <Thread order={byOrder.get(focusStop.orderId)} stop={focusStop} trip={selected} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

