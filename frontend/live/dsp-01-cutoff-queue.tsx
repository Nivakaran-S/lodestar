'use client';
// DSP-01 Cutoff queue, live. Markup and classes from the generated design (frontend/screens/dsp-01-cutoff-queue.tsx).
// Data: Orders of the run date (paged, filter chips, $search), Vehicles for capacity. "Agent drafting" starts a
// planning-agent run (POST AgentRuns) and follows the design link to DSP-22.
// Before the 4:00 PM cutoff, while the run the queue fills for has no orders yet in the depot(s) in view, the
// queue is the designed empty state DSP-21 (Empty queue before cutoff): the screen moves there.
// "Close orders" closes the run in view for the depot being drafted (Orders/Lodestar.CloseOrders): the orders service
// then refuses new orders for it (422 OrdersClosed) and the stores show "orders closed"; "Reopen orders" undoes it.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScreenNav } from '@/components/ScreenShell';
import Btn from '@/components/live/Btn';
import { PlanSide, useCount } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { useOpenRun, usePlanScope, useStartAgentRun } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton, Spinner } from '@/components/live/states';
import { BRAND_LETTER, dayFilter, fmtClock, fmtNum, fmtRunDate, isoDay, title } from '@/lib/format';
import { useAction, useEntitySet, useQuery } from '@/lib/odata/hooks';
import { valueOf } from '@/lib/odata/client';
import type { Order, OrderWindow, Vehicle } from '@/lib/odata/types';
import { depotFilter, useAgentRunId, useFocusId } from '@/lib/workday';
import { useCutoffLabel } from '@/components/live/planning-rules';
import { useDepots } from '@/components/live/depots';

type Chip = 'all' | 'chilled' | 'van' | 'mall' | 'flagged';
const CHIP_FILTER: Record<Chip, string | undefined> = {
  all: undefined,
  chilled: "tempClass eq 'CHILLED'",
  van: "outlet/parking eq 'VAN_ONLY'",
  mall: "outlet/dockType eq 'MALL_BAY'",
  flagged: "(deferredYesterday eq true or status eq 'EXCEPTION' or deferralScore ge 91)",
};
const LIVE_STATUSES = "status ne 'CANCELLED'";
/** A new order (store app, phone order), a published plan or any alert changes the queue; a 30 s poll covers a dropped socket. */
const QUEUE_EVENTS = ['notification', 'order_created', 'plan_published'];
const QUEUE_POLL_MS = 30_000;
export const EMPTY_QUEUE = '/plan/dsp-21-empty-queue-before-cutoff';

/**
 * DSP-01 shows DSP-21 instead when, before the open run's cutoff, that run has no orders in view. `inView` is the
 * run date DSP-01 shows; `queued` its order count, `unplanned` how many of them are still Received, `openCount` the
 * open run's (when it is another date). An earlier run still holding unplanned orders is real work: its queue shows.
 */
export function isEmptyBeforeCutoff(p: { before: boolean; openRun: string; inView: string | undefined; queued: number | undefined; unplanned?: number; openCount: number | undefined }): boolean {
  if (!p.before) return false;
  if (p.inView === p.openRun) return p.queued === 0;
  if (p.inView && p.unplanned !== 0) return false; // still loading, or orders on this run wait to be planned
  if (!p.inView || p.inView < p.openRun) return p.openCount === 0;
  return false; // a later run date is pinned: show its queue
}

const isProtected = (o: Order) => o.deferredYesterday || (o.deferralScore ?? 0) >= 91;
const DOCK: Record<string, string> = { REAR_DOCK: 'rear dock', STREET: 'street', MALL_BAY: 'mall bay' };

function Why({ o }: { o: Order }) {
  if (isProtected(o)) return <span className="m-pill m-pill--warn"><Ic n="shield-check" />Protected{o.deferredYesterday ? ' · deferred yesterday' : ''}</span>;
  if (o.status === 'EXCEPTION') return <span className="m-pill m-pill--bad"><Ic n="alert" />Exception{o.notes ? ` · ${o.notes}` : ''}</span>;
  return (
    <>
      {o.outlet?.parking === 'VAN_ONLY' && <span className="m-tag m-tag--brand"><Ic n="van" />van_only</span>}
      {o.outlet?.dockType === 'MALL_BAY' && <span className="m-tag m-tag--info"><Ic n="store" />Mall window</span>}
      <span className="t-3">{o.notes ?? (o.daysSince ? `${o.daysSince} day${o.daysSince === 1 ? '' : 's'} since last delivery` : '')}</span>
    </>
  );
}

export default function LiveDsp01CutoffQueue() {
  const cutoffLabel = useCutoffLabel();
  const { name: depotName, short: depotShort } = useDepots();
  const nav = useScreenNav();
  const router = useRouter();
  const scope = usePlanScope();
  const { runDate, ordersFilter, active, depot } = scope;
  const [chip, setChip] = useState<Chip>('all');
  const [search, setSearch] = useState('');
  const [, setRunId] = useAgentRunId();
  const [, setOrder] = useFocusId('order');

  const base = ordersFilter ? `${ordersFilter} and ${LIVE_STATUSES}` : null;
  const queue = useEntitySet<Order>(
    'Orders',
    base ? { filter: [base, CHIP_FILTER[chip]].filter(Boolean).join(' and '), expand: 'outlet', orderby: 'deferredYesterday desc,deferralScore desc,id', top: 50, count: true, search: search.trim() || undefined } : null,
    { refreshOn: QUEUE_EVENTS },
  );
  const all = useQuery<Order[]>(base ? `queue-all:${base}` : null, c =>
    c.all<Order>('Orders', { filter: base!, select: 'id,brand,tempClass,m3,kg,status,deferredYesterday,deferralScore', expand: 'outlet($select=parking,dockType)' }),
  { refreshOn: QUEUE_EVENTS, pollMs: QUEUE_POLL_MS });
  // The poll reads the whole queue (the counts); the visible page reloads only when that changed, so a page the
  // dispatcher expanded with "Show more" is kept while nothing moved.
  const signature = all.data ? all.data.map(o => `${o.id}:${o.status}`).join(',') : null;
  const seen = useRef<string | null>(null);
  const reloadPage = queue.refresh;
  useEffect(() => {
    if (signature === null) return;
    if (seen.current !== null && seen.current !== signature) void reloadPage();
    seen.current = signature;
  }, [signature, reloadPage]);
  const fleet = useQuery<Vehicle[]>(`fleet:${active.join(',')}`, c => c.all<Vehicle>('Vehicles', { filter: depotFilter('depot', active) }));

  const open = useOpenRun();
  const otherRun = runDate !== open.runDate && (!runDate || runDate < open.runDate);
  const openCount = useCount('Orders', otherRun && !scope.loadingDate ? [dayFilter('runDate', open.runDate), depotFilter('outlet/depot', active), LIVE_STATUSES].filter(Boolean).join(' and ') : null, QUEUE_EVENTS);
  const emptyBeforeCutoff = !open.loading && !scope.loadingDate && isEmptyBeforeCutoff({ before: open.before, openRun: open.runDate, inView: runDate, queued: all.data?.length, unplanned: all.data?.filter(o => o.status === 'RECEIVED').length, openCount });
  useEffect(() => {
    if (emptyBeforeCutoff && !new URLSearchParams(window.location.search).get('runDate')) router.replace(EMPTY_QUEUE);
  }, [emptyBeforeCutoff, router]);

  const orders = all.data ?? [];
  const brands = { FRESH: 0, STYLE: 0, TECH: 0 } as Record<string, number>;
  orders.forEach(o => (brands[o.brand] = (brands[o.brand] ?? 0) + 1));
  const chilledOpen = orders.filter(o => o.tempClass === 'CHILLED' && !['DEFERRED', 'EXCEPTION'].includes(o.status));
  const demand = chilledOpen.reduce((s, o) => s + (o.m3 ?? 0), 0);
  const vehicles = fleet.data ?? [];
  const ready = vehicles.filter(v => v.status !== 'WORKSHOP');
  const workshop = vehicles.filter(v => v.status === 'WORKSHOP');
  const capacity = ready.filter(v => v.tempClass === 'CHILLED').reduce((s, v) => s + v.capacityM3, 0);
  const gap = capacity - demand;
  const counts: Record<Chip, number> = {
    all: orders.length,
    chilled: orders.filter(o => o.tempClass === 'CHILLED').length,
    van: orders.filter(o => o.outlet?.parking === 'VAN_ONLY').length,
    mall: orders.filter(o => o.outlet?.dockType === 'MALL_BAY').length,
    flagged: orders.filter(o => isProtected(o) || o.status === 'EXCEPTION').length,
  };
  const vans = ready.filter(v => v.type === 'VAN');

  const draftDepot = depot ?? active[0];
  // DSP-22 opens at once and shows the draft while the agent works; the run it drafted is opened when it is done
  const start = useStartAgentRun(run => setRunId(run.id), { track: true });
  const startDraft = () => {
    setRunId(null);
    void start.run({ depot: draftDepot!, runDate: runDate! });
    nav.go('L1');
  };
  // a busy day can take a while on a small VM: show how long the draft has been running
  const drafting = useElapsed(start.pending);

  // Dispatch may close orders for the run explicitly (the time cut-off still applies on its own).
  const day = runDate ? isoDay(runDate) : null;
  const orderWindow = useQuery<OrderWindow>(draftDepot && day ? `order-window:${draftDepot}:${day}` : null, async c =>
    valueOf<OrderWindow>(await c.fn('Orders', null, 'OrderWindow', { runDate: day!, depot: draftDepot! })),
  { refreshOn: ['order_window'] });
  const closedRun = orderWindow.data?.closed === true;
  const toggleOrders = useAction<boolean, OrderWindow>(
    async (c, close) => valueOf<OrderWindow>(await c.action('Orders', null, close ? 'CloseOrders' : 'ReopenOrders', { depot: draftDepot!, runDate: day! })),
    { onSuccess: () => void orderWindow.refresh() },
  );

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-01 Cutoff queue">
      <div className="d-app">
        <PlanSide active="N1" />
        <div className="d-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {closedRun
                  ? `Orders closed by dispatch${orderWindow.data?.closedAt ? ` at ${fmtClock(orderWindow.data.closedAt)}` : ''}`
                  : `Orders closed ${cutoffLabel}`}
                <span className="m-sep" />
                {active.map(d => depotName(d)).join(' + ')}
              </div>
              <div className="d-h1">Cutoff queue for {runDate ? fmtRunDate(runDate) : '…'}</div>
            </div>
            {closedRun && <span className="m-pill m-pill--warn" data-testid="orders-closed"><Ic n="lock" />{"Orders closed"}</span>}
            <Btn
              className="d-btn"
              testId={closedRun ? 'reopen-orders' : 'close-orders'}
              busy={toggleOrders.pending}
              disabled={!day || !draftDepot || !orderWindow.data}
              onClick={() => void toggleOrders.run(!closedRun)}
            >
              <Ic n={closedRun ? 'refresh' : 'lock'} />
              {closedRun ? 'Reopen orders' : `Close orders${active.length > 1 && draftDepot ? ` · ${depotName(draftDepot) ?? draftDepot}` : ''}`}
            </Btn>
            {!closedRun && <span className="d-btn" data-lk="L151"><Ic n="call" />{"Log phone order"}</span>}
            <Btn
              className="d-btn d-btn--primary"
              testId="start-agent"
              busy={start.pending}
              disabled={!runDate || !draftDepot}
              onClick={startDraft}
            >
              <Ic n="sparkle-plus" />
              {start.pending ? `Agent drafting… ${drafting}` : `Draft the plan with the agent${active.length > 1 ? ` · ${depotName(draftDepot!) ?? draftDepot}` : ''}`}
            </Btn>
          </div>
          {toggleOrders.error && <ErrorBanner error={toggleOrders.error} />}
          {start.error && <ErrorBanner error={start.error} onRetry={startDraft} />}
          {scope.noPlans && <Empty title="No run date yet" text="There are no plans to queue orders against." icon="calendar" />}
          <div className="d-kpis">
            <div className="d-kpi d-kpi--hero x-kpi-xl" style={{ flex: '1' }}>
              <span className="d-kpi__l">{"Confirmed orders"}</span>
              <span className="d-kpi__v" data-testid="queue-total">{all.data ? orders.length : '…'}<small>{"orders"}</small></span>
              <div className="x-brands">
                <span><span className="x-dot" style={{ background: '#4ADE80' }} />{"Fresh "}<b>{brands.FRESH}</b></span>
                <span><span className="x-dot" style={{ background: '#F472B6' }} />{"Style "}<b>{brands.STYLE}</b></span>
                <span><span className="x-dot" style={{ background: '#CBD5E1' }} />{"Tech "}<b>{brands.TECH}</b></span>
              </div>
            </div>
            <div className={`d-kpi x-kpi-xl${gap < 0 ? ' d-kpi--alert' : ''}`} style={{ flex: '1.75' }}>
              <span className="d-kpi__l" style={gap < 0 ? { color: 'var(--st-exception-fg)' } : undefined}>{gap < 0 ? 'Chilled capacity gap' : 'Chilled capacity'}</span>
              <div className="x-kpi-row">
                <span className="d-kpi__v" style={gap < 0 ? { color: 'var(--st-exception-fg)' } : undefined}>{gap < 0 ? '−' : '+'}{fmtNum(Math.abs(gap), 1)}<small>{"m³"}</small></span>
                <div className="x-kpi-side"><span><b>{fmtNum(demand, 1)} m³</b>{" needed"}</span><span><b>{fmtNum(capacity, 1)} m³</b>{" on reefers ready"}</span></div>
              </div>
              <div className="x-gap">
                <div style={{ width: `${demand > 0 ? Math.min(100, (capacity / Math.max(demand, capacity)) * 100) : 100}%`, background: 'var(--chilled-fg)' }} />
                {gap < 0 && <div style={{ flex: '1', background: 'var(--st-exception-fg)' }} />}
              </div>
              <span className="d-kpi__s">{"The planning agent frees reefer space first, then proposes deferrals."}</span>
            </div>
            <div className="d-kpi" style={{ justifyContent: 'space-between' }}>
              <span className="d-kpi__l">{"Vehicles ready"}</span>
              <span className="d-kpi__v">{ready.length}<small>/ {vehicles.length}</small></span>
              <span className="d-kpi__s">
                {workshop.length ? <>In workshop: {workshop.slice(0, 3).map((v, i) => <span key={v.id}>{i ? ', ' : ''}<span className="id">{v.id}</span></span>)}{workshop.length > 3 ? ` +${workshop.length - 3}` : ''}</> : 'None in workshop'}
              </span>
            </div>
            <div className="d-kpi" style={{ justifyContent: 'space-between' }}>
              <span className="d-kpi__l">{"Access limits"}</span>
              <span className="d-kpi__v">{counts.van}<small>{"van_only"}</small> {counts.mall}<small>{"mall"}</small></span>
              <span className="d-kpi__s">{vans.length} vans at {active.map(d => depotShort(d)).join(' + ')}, {vans.filter(v => v.tempClass === 'CHILLED').length} reefer</span>
            </div>
          </div>
          <div className="d-card" style={{ flex: '1', minHeight: '0' }}>
            <div className="d-card__head">
              <span className="d-card__title">{"Queue"}</span>
              <div className="d-toolbar" style={{ marginLeft: '10px' }}>
                {([['all', 'All'], ['chilled', 'Chilled'], ['van', 'van_only'], ['mall', 'Mall window'], ['flagged', 'Flagged']] as Array<[Chip, string]>).map(([k, label]) => (
                  <span
                    key={k}
                    className={`d-filter lv-click${chip === k ? ' is-on' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={chip === k}
                    onClick={e => { e.stopPropagation(); setChip(k); }}
                    onKeyDown={e => { if (e.key === 'Enter') setChip(k); }}
                  >
                    {label} <b>{counts[k]}</b>
                  </span>
                ))}
              </div>
              <span className="spacer" />
              <span className="x-meta t-3">{"Sorted: "}<b className="t-2" style={{ fontWeight: '700' }}>{"needs attention first"}</b></span>
              <span className="d-search" style={{ width: '230px' }}>
                <Ic n="filter" />
                <input className="lv-input" aria-label="Search orders" placeholder="Order, outlet or note" value={search} onChange={e => setSearch(e.target.value)} />
              </span>
            </div>
            {queue.error && <ErrorBanner error={queue.error} onRetry={queue.refresh} />}
            {!queue.data && !queue.error && <Skeleton rows={5} />}
            {queue.data?.length === 0 && <Empty title="The queue is empty" text={search || chip !== 'all' ? 'No orders match this filter.' : 'No orders for this run date yet.'} />}
            {queue.data && queue.data.length > 0 && (
              <div className="d-table" data-testid="queue">
                <div className="d-tr d-tr--head">
                  <span className="d-td" style={{ width: '108px' }}>{"Order"}</span>
                  <span className="d-td" style={{ width: '214px' }}>{"Outlet"}</span>
                  <span className="d-td" style={{ width: '96px' }}>{"Temperature"}</span>
                  <span className="d-td" style={{ width: '146px' }}>{"Size"}</span>
                  <span className="d-td" style={{ width: '104px' }}>{"Window"}</span>
                  <span className="d-td" style={{ flex: '1' }}>{"Why it matters"}</span>
                  <span className="d-td" style={{ width: '96px' }}>{"Status"}</span>
                </div>
                {queue.data.map(o => (
                  <div key={o.id} className={`d-tr x-tr2${isProtected(o) ? ' d-tr--warn' : ''}`} data-lk="L150" data-order={o.id} onClickCapture={() => setOrder(o.id)}>
                    <span className="d-td id" style={{ width: '108px' }}>{o.id}</span>
                    <span className="d-td x-outlet" style={{ width: '214px' }}>
                      <span className={`bb bb--${o.brand.toLowerCase()} x-bb`}>{BRAND_LETTER[o.brand]}</span>
                      <span className="x-outlet__t">
                        <b>{o.outlet?.name ?? o.outletId}</b>
                        <span><span className="id">{o.outletId}</span> · {o.outlet?.district} · {DOCK[o.outlet?.dockType ?? ''] ?? ''}</span>
                      </span>
                    </span>
                    <span className="d-td" style={{ width: '96px' }}>
                      {o.tempClass === 'CHILLED'
                        ? <span className="m-tag m-tag--cold"><Ic n="snow-heavy" />{"Chilled"}</span>
                        : <span className="m-tag"><span className="dot" style={{ color: '#98A1B3' }} />{"Ambient"}</span>}
                    </span>
                    <span className="d-td mono" style={{ width: '146px' }}>{fmtNum(o.m3, 1)} m³ · {fmtNum(o.kg)} kg</span>
                    <span className="d-td mono" style={{ width: '104px' }}>{o.outlet ? `${o.outlet.windowOpen}–${o.outlet.windowClose}` : '—'}</span>
                    <span className="d-td x-meta" style={{ flex: '1', minWidth: '0' }}><Why o={o} /></span>
                    <span className="d-td t-2" style={{ width: '96px' }}>{title(o.status)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="spacer" />
            <div className="x-tfoot">
              <span>Showing <b>{queue.data?.length ?? 0}</b> of <b>{queue.count ?? '…'}</b>{chip === 'all' && !search ? ' · all received' : ''}</span>
              <span className="spacer" />
              {queue.hasMore && (
                queue.loadingMore ? <Spinner label="Loading more…" /> : (
                  <Btn className="x-link" onClick={() => void queue.loadMore()}>{"Show more"}<Ic n="chevron-right" /></Btn>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** mm:ss since `running` became true (empty when not running), ticking once a second. */
function useElapsed(running: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => { clearInterval(t); setElapsed(0); };
  }, [running]);
  if (!running) return '';
  return `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
}
