'use client';
// DSP-08 Today overview, live. Markup and classes from the generated design (frontend/screens/dsp-08-today-overview.tsx).
// Data: Orders ($count by status), Trips, Vehicles, Plans of the run date per depot, the exceptions list
// (Orders/TripStops/Notifications) and the morning's notifications as the timeline. Updates on realtime events.
// Offline (DSP-24): when the desk loses the API, the offline banner shows under the header, the numbers freeze at
// what was last loaded and are marked "Not live". DSP-24 renders this screen with `offlineView`.
import { useAuth } from '@/lib/auth/AuthProvider';
import { colomboDay } from '@/lib/workday';
import { dayFilter, fmtClock, fmtNum, fmtRunDate, fmtTime, pct, planNote } from '@/lib/format';
import { useQuery } from '@/lib/odata/hooks';
import type { Notification, Plan, Trip, Vehicle } from '@/lib/odata/types';
import { PlanSide, useCount } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { OfflineBanner, useOffline } from '@/components/live/offline';
import { usePlanScope, useExceptions, type ExceptionItem } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { useRealtimeStatus } from '@/lib/odata/hooks';
import { useDepots } from '@/components/live/depots';
import { useRouter } from 'next/navigation';

const LEAD: Record<ExceptionItem['tone'], { cls: string; icon: 'store' | 'clock' | 'wifi-off' }> = {
  bad: { cls: 'dx-lead--bad', icon: 'store' },
  warn: { cls: 'dx-lead--warn', icon: 'clock' },
  off: { cls: 'dx-lead--off', icon: 'wifi-off' },
};

const PLAN_PILL: Record<string, string> = {
  PUBLISHED: 'm-pill--ok',
  APPROVED: 'm-pill--ok',
  NEEDS_APPROVAL: 'm-pill--warn',
  DRAFT: 'm-pill--brand',
  REJECTED: 'm-pill--bad',
};

function DepotCard({ depot, runDate }: { depot: string; runDate: string }) {
  const { name: depotName } = useDepots();
  const day = dayFilter('runDate', runDate);
  const scope = `${day} and outlet/depot eq '${depot}'`;
  const total = useCount('Orders', `${scope} and status ne 'CANCELLED'`, ['notification']);
  const deferred = useCount('Orders', `${scope} and status eq 'DEFERRED'`, ['notification']);
  const delivered = useCount('Orders', `${scope} and status eq 'DELIVERED'`, ['notification', 'eta_update']);
  const plan = useQuery<Plan | null>(`plan:${depot}:${runDate}`, async c => {
    const page = await c.list<Plan>('Plans', {
      filter: `depot eq '${depot}' and ${day}`,
      orderby: 'version desc',
      top: 1,
    });
    return page.value[0] ?? null;
  });
  const fleet = useQuery<Vehicle[]>(`fleet:${depot}`, c => c.all<Vehicle>('Vehicles', { filter: `depot eq '${depot}'`, select: 'id,status' }));
  const trips = useCount('Trips', `depot eq '${depot}' and ${day} and status eq 'ENROUTE'`, ['eta_update']);
  const vehicles = fleet.data ?? [];
  const workshop = vehicles.filter(v => v.status === 'WORKSHOP').length;
  const served = total === undefined || deferred === undefined ? undefined : total - deferred;
  const p = plan.data;
  return (
    <div className="dx-card" style={{ flex: '1' }} data-testid={`depot-${depot}`}>
      <div className="dx-card__head">
        <span className="dx-lead"><Ic n="depot" /></span>
        <div className="vstack" style={{ gap: '0' }}>
          <span className="dx-card__title">{depotName(depot)}</span>
          <span className="dx-t13">{trips ?? '…'} vehicles out</span>
        </div>
        <span className="spacer" />
        {p ? (
          <span className={`m-pill ${PLAN_PILL[p.status] ?? ''}`}><span className="dot" />Plan v{p.version} {p.status === 'PUBLISHED' || p.status === 'APPROVED' ? 'live' : p.status.toLowerCase().replace('_', ' ')}</span>
        ) : (
          <span className="m-pill">{plan.loading ? 'Loading plan…' : 'No plan yet'}</span>
        )}
      </div>
      <div className="dx-card__body">
        <div className="dx-stats">
          <div className="dx-stat"><b>{total ?? '…'}</b><span>{served ?? '…'} served · {deferred ?? '…'} deferred</span></div>
          <div className="dx-stat"><b>{delivered ?? '…'}<small>/ {served ?? '…'}</small></b><span>delivered</span></div>
          <div className="dx-stat"><b>{fleet.data ? `${vehicles.length - workshop}/${vehicles.length}` : '…'}</b><span>{!fleet.data ? '' : workshop ? `${workshop} in workshop` : 'all ready'}</span></div>
        </div>
        <div className="dx-bar"><div className="dx-g-ok" style={{ width: `${pct(delivered, served ?? 0)}%` }} /></div>
        {planNote(p?.explanation ?? p?.notes) ? (
          <div className="dx-t14" style={{ whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{planNote(p?.explanation ?? p?.notes)}</div>
        ) : null}
      </div>
    </div>
  );
}

const DOT: Record<string, string> = {
  BLACKOUT_DETECTED: '#FFFFFF',
  SIGNAL_LOST: '#FFFFFF',
  REEFER_FAIL: 'var(--st-exception-fg)',
  SHORTFALL_ACK: 'var(--star-500)',
  POD_MATCHED: 'var(--st-delivered-fg)',
  SIGNAL_BACK: 'var(--st-delivered-fg)',
};

export default function LiveDsp08TodayOverview({ offlineView = false }: { offlineView?: boolean } = {}) {
  const { name: depotName } = useDepots();
  const router = useRouter();
  // DSP-24 shows this screen inside its own design, which has no L147/L149 links: those go by the router there
  const link = (lk: 'L147' | 'L149') => (offlineView
    ? { role: 'button', tabIndex: 0, onClick: () => router.push(lk === 'L147' ? '/plan/dsp-13-exceptions-inbox' : '/plan/dsp-04-live-operations') }
    : { 'data-lk': lk });
  const { session } = useAuth();
  const conn = useOffline();
  const frozen = conn.offline;
  const asAt = conn.lastOkAt ? fmtClock(new Date(conn.lastOkAt)) : conn.since ? fmtClock(new Date(conn.since)) : null;
  const scope = usePlanScope();
  const { runDate, ordersFilter, tripsFilter, active } = scope;
  const live = useRealtimeStatus();
  const total = useCount('Orders', ordersFilter ? `${ordersFilter} and status ne 'CANCELLED'` : null, ['notification']);
  const delivered = useCount('Orders', ordersFilter ? `${ordersFilter} and status eq 'DELIVERED'` : null, ['notification', 'eta_update']);
  const trips = useQuery<Trip[]>(tripsFilter ? `trips:${tripsFilter}` : null, c => c.all<Trip>('Trips', { filter: tripsFilter, select: 'id,status,vehicleId' }), {
    refreshOn: ['eta_update', 'notification'],
  });
  const onTime = useQuery<{ onTime: number; done: number }>(runDate ? `ontime:${runDate}:${active.join(',')}` : null, async c => {
    const stops = await c.all<{ arrivalActual?: string | null; etaModelBandLate?: string | null; etaPlan?: string | null }>('TripStops', {
      filter: [dayFilter('trip/runDate', runDate!), 'arrivalActual ne null', active.length === 1 ? `trip/depot eq '${active[0]}'` : undefined]
        .filter(Boolean)
        .join(' and '),
      select: 'arrivalActual,etaModelBandLate,etaPlan',
    });
    const ok = stops.filter(s => !s.etaModelBandLate || new Date(s.arrivalActual!) <= new Date(s.etaModelBandLate)).length;
    return { onTime: ok, done: stops.length };
  });
  const exceptions = useExceptions(runDate, ordersFilter, active);
  const timeline = useQuery<Notification[]>('timeline', async c => (await c.list<Notification>('Notifications', { orderby: 'sentAt desc', top: 7 })).value.reverse(), {
    refreshOn: ['notification'],
  });

  const out = (trips.data ?? []).filter(t => t.status === 'ENROUTE').length;
  const complete = (trips.data ?? []).filter(t => t.status === 'COMPLETE').length;
  const firstName = (session?.name ?? '').split(' ')[0];
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Colombo' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const open = exceptions.data?.length ?? 0;
  // with no run from today on, the desk reviews the latest plan's day: say so, and do not call a past run live
  const today = colomboDay();
  const past = !!runDate && runDate < today;

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name={offlineView ? 'DSP-24 Offline banner · desktop' : 'DSP-08 Today overview · desktop'}>
      <div className="d-app">
        <PlanSide active="N0" bellLk={offlineView ? undefined : 'L148'} />
        <div className="dx-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {past ? `${fmtRunDate(today)} · ${fmtTime(new Date())} · showing the ${fmtRunDate(runDate)} run` : `${runDate ? fmtRunDate(runDate) : '…'} · ${fmtTime(new Date())}`}
                <span className="m-sep" />
                {active.length > 1 ? 'Both depots' : depotName(active[0])}
              </div>
              <div className="d-h1">{greeting}{firstName ? `, ${firstName}` : ''}</div>
            </div>
            {frozen
              ? <span className="d-btn d-btn--disabled" aria-disabled="true"><Ic n="navigate" />Open live operations</span>
              : <span className="d-btn" {...link('L149')}><Ic n="navigate" />Open live operations</span>}
            <span className="d-btn d-btn--primary" {...link('L147')}><Ic n="alert" />{open ? `Triage ${open} exception${open === 1 ? '' : 's'}` : 'Exceptions inbox'}</span>
          </div>
          <OfflineBanner lk={offlineView ? 'L174' : undefined} always={offlineView} />
          {scope.dateError && !frozen && <ErrorBanner error={scope.dateError} />}
          {scope.noPlans && <Empty title="No runs planned yet" text="Once orders are planned for a run date, today's picture shows here." icon="calendar" />}
          <div className="dx-hrow">
            <div className={`dx-hero${frozen ? ' dx-hero--off' : ''}`} style={{ flex: '1.25' }} data-state={frozen ? 'offline' : 'live'}>
              <div className="dx-hero__l">
                {runDate ? fmtRunDate(runDate) : ''} run · {frozen ? `delivered, as at ${asAt ?? 'last load'}` : past ? 'delivered' : 'delivered so far'}
                <span className="spacer" />
                {past && !frozen ? (
                  <span className="m-tag" style={{ color: '#B9C0E6' }}><Ic n="clock" />{"Past run"}</span>
                ) : frozen ? (
                  <span className="m-pill m-pill--offline"><Ic n="wifi-off" />{"Not live"}</span>
                ) : (
                  <span className="m-tag" style={{ color: live === 'connected' ? '#6EE7B7' : '#B9C0E6' }} {...link('L149')}>
                    <span className="dot" />{live === 'connected' ? 'Live' : 'Reconnecting'} · {fmtClock(new Date())}
                  </span>
                )}
              </div>
              <div className="dx-display" data-testid="delivered" style={frozen ? { color: 'var(--text)' } : undefined}>{delivered ?? '…'}<small>of {total ?? '…'} orders</small></div>
              {frozen ? (
                <div className="dx-bar" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--st-offline-bd)' }}><div style={{ width: `${pct(delivered, total)}%`, background: '#A8A29E' }} /></div>
              ) : (
                <div className="dx-bar dx-bar--dark"><div className="dx-g-ok" style={{ width: `${pct(delivered, total)}%` }} /></div>
              )}
              <div className="dx-stats">
                <div className="dx-stat" style={frozen ? undefined : { borderColor: 'rgba(255,255,255,.12)' }}>
                  <b>{onTime.data?.done ? `${pct(onTime.data.onTime, onTime.data.done)}%` : '—'}</b><span style={frozen ? undefined : { color: '#B9C0E6' }}>on time</span>
                </div>
                <div className="dx-stat" style={frozen ? undefined : { borderColor: 'rgba(255,255,255,.12)' }}><b>{out}</b><span style={frozen ? undefined : { color: '#B9C0E6' }}>vehicles out</span></div>
                <div className="dx-stat" style={frozen ? undefined : { borderColor: 'rgba(255,255,255,.12)' }}><b>{fmtNum(trips.data?.length ?? 0)}</b><span style={frozen ? undefined : { color: '#B9C0E6' }}>trips planned</span></div>
              </div>
              <div className="dx-hero__m">
                {frozen ? 'Numbers freeze while the desk is offline. Nothing is guessed as delivered.' : <><b>{complete}</b> trips complete, <b>{out}</b> on the road.</>}
              </div>
            </div>
            <div className="dx-card" style={{ flex: '1' }}>
              <div className="dx-card__head">
                <span className="dx-card__title">Needs you</span>
                <span className={`m-pill ${open ? 'm-pill--bad' : 'm-pill--ok'}`}>{open} open</span>
                <span className="spacer" />
                <span className="x-link" {...link('L147')}>Exceptions inbox<Ic n="chevron-right" /></span>
              </div>
              {exceptions.error && <ErrorBanner compact error={exceptions.error} onRetry={exceptions.refresh} />}
              {!exceptions.data && !exceptions.error && <Skeleton rows={3} />}
              {exceptions.data?.length === 0 && <Empty title="Nothing needs you" text="No exceptions, late risks or alerts right now." />}
              {exceptions.data?.slice(0, 3).map(x => (
                <div key={x.id} className={`dx-lrow${x.tone === 'off' ? ' dx-lrow--off' : ''}`}>
                  <span className={`dx-lead ${LEAD[x.tone].cls}`}><Ic n={LEAD[x.tone].icon} /></span>
                  <div className="dx-lrow__main">
                    <span className="dx-lrow__t">{x.title}</span>
                    <span className="dx-lrow__m">{x.meta}</span>
                  </div>
                  <div className="dx-lrow__tr">
                    {x.value ? (
                      <><span className="dx-lrow__v" style={{ color: x.tone === 'bad' ? 'var(--st-exception-fg)' : 'var(--st-deferred-fg)' }}>{x.value}</span>{x.valueLabel}</>
                    ) : (
                      <span className={`m-pill ${x.tone === 'off' ? 'm-pill--offline' : 'm-pill--bad'}`}>{x.tone === 'off' ? 'Expected' : 'Open'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* the column is as tall as the window: these keep their own height (the pane scrolls), else a short window
              squeezes them by a few px and the card bodies turn into tiny scrollers */}
          {runDate && (
            <div className="dx-hrow" style={{ flexShrink: 0 }}>
              {active.map(d => (
                <DepotCard key={d} depot={d} runDate={runDate} />
              ))}
            </div>
          )}
          <div className="dx-card" style={{ flexShrink: 0 }}>
            <div className="dx-card__head"><span className="dx-card__title">This morning</span><span className="dx-t13">your latest notices</span></div>
            <div className="dx-card__body" style={{ flexDirection: 'row', gap: '10px' }}>
              {timeline.error && <ErrorBanner compact error={timeline.error} onRetry={timeline.refresh} />}
              {!timeline.data && !timeline.error && <Skeleton rows={1} />}
              {timeline.data?.length === 0 && <span className="dx-t13">No notices yet today.</span>}
              {timeline.data?.map(n => (
                <div key={n.id} className="vstack" style={{ gap: '6px', flex: '1', minWidth: '0' }}>
                  <div className="hstack" style={{ gap: '0' }}>
                    <span
                      style={{
                        display: 'block', width: '14px', height: '14px', borderRadius: '50%', flexShrink: '0',
                        background: DOT[n.type] ?? 'var(--brand-600)',
                        border: DOT[n.type] === '#FFFFFF' ? '2px dashed var(--st-offline-bd)' : undefined,
                      }}
                    />
                    <span style={{ display: 'block', flex: '1', height: '2px', background: 'var(--hair)' }} />
                  </div>
                  <b className="mono" style={{ fontSize: '14px', color: 'var(--text)' }}>{fmtClock(n.sentAt)}</b>
                  <span style={{ fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.type.charAt(0) + n.type.slice(1).toLowerCase().replace(/_/g, ' ')}
                  </span>
                  <span className="dx-t13" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {String((n.payload as Record<string, unknown> | null)?.outletId ?? (n.payload as Record<string, unknown> | null)?.vehicleId ?? n.tripId ?? '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
