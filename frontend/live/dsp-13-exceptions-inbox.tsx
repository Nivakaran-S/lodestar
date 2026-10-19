'use client';
// DSP-13 Exceptions inbox, live. Markup and classes from the generated design (frontend/screens/dsp-13-exceptions-inbox.tsx).
// Data: the open exceptions (Orders in EXCEPTION, TripStops at late risk, unread alert Notifications), the alerts
// handled today (read Notifications), the selected item's Trip with its stops. Actions: Notifications('…')/
// Lodestar.MarkRead ("Mark handled"; on a loader's shortfall flag, "Acknowledge": the loader is told) and
// Notifications/Lodestar.Send to the outlet's store manager ("Message store").
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScreenNav } from '@/components/ScreenShell';
import Btn from '@/components/live/Btn';
import { PlanSide } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { p5Link, useMessageStore, usePlanScope, useExceptions, type ExceptionItem, runStamp } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { fmtClock, fmtTime } from '@/lib/format';
import { usePlanningRules } from '@/components/live/planning-rules';
import { useAction, useEntity, useQuery } from '@/lib/odata/hooks';
import type { Notification, Outlet, Trip } from '@/lib/odata/types';
import { useFocusId } from '@/lib/workday';
import { useDepots } from '@/components/live/depots';

type Tab = 'open' | 'resolved' | 'all';
const LEAD: Record<ExceptionItem['tone'], [string, 'store' | 'clock' | 'wifi-off', string, string]> = {
  bad: ['dx-lead--bad', 'store', 'm-pill--bad', 'Needs you'],
  warn: ['dx-lead--warn', 'clock', 'm-pill--warn', 'Watch'],
  off: ['dx-lead--off', 'wifi-off', 'm-pill--offline', 'Expected'],
};
const SOURCE: Record<ExceptionItem['source'], string> = { order: 'Order exception', stop: 'Late risk', notification: 'Alert', sync: 'Sync conflict' };

export default function LiveDsp13ExceptionsInbox() {
  const riskPct = usePlanningRules().data?.lateRisk.alertPct;
  const { name: depotName } = useDepots();
  const nav = useScreenNav();
  const router = useRouter();
  const [, setFocusTrip] = useFocusId('trip');
  const [, setFocusVehicle] = useFocusId('vehicle');
  const { runDate, ordersFilter, active } = usePlanScope();
  const open = useExceptions(runDate, ordersFilter, active);
  const resolved = useQuery<Notification[]>('resolved-today', async c => {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    return (await c.list<Notification>('Notifications', { filter: `readAt ne null and readAt ge ${since}`, orderby: 'readAt desc', top: 20 })).value;
  }, { refreshOn: ['notification'] });
  const [tab, setTab] = useState<Tab>('open');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const openItems = (open.data ?? []).filter(x => match(`${x.title} ${x.meta} ${x.outletId ?? ''} ${x.orderId ?? ''}`));
  const doneItems = (resolved.data ?? []).filter(n => match(`${n.type} ${JSON.stringify(n.payload ?? {})}`));
  const sel = useMemo(() => openItems.find(x => x.id === selId) ?? openItems[0], [openItems, selId]);

  const trip = useEntity<Trip>('Trips', sel?.tripId ?? null, { expand: 'stops' }, { refreshOn: ['eta_update'] });
  const outlet = useEntity<Outlet>('Outlets', sel?.outletId ?? null);
  const stops = [...(trip.data?.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq);
  const stop = stops.find(s => s.orderId === sel?.orderId) ?? stops.find(s => s.outletId === sel?.outletId);
  const doneStops = stops.filter(s => s.status === 'DELIVERED').length;

  const markRead = useAction<string, unknown>((c, id) => c.action('Notifications', id, 'MarkRead'), {
    onSuccess: () => { void open.refresh(); void resolved.refresh(); },
  });
  const sendToStore = useMessageStore(names => { nav.notify(`Sent to ${names}`); setMessage(''); nav.go('L164'); });

  const counts = { open: open.data?.length ?? 0, resolved: resolved.data?.length ?? 0 };
  const showOpen = tab !== 'resolved';
  const showDone = tab !== 'open';

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-13 Exceptions inbox · desktop">
      <div className="d-app">
        <PlanSide active="N5" />
        <div className="dx-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {runStamp(runDate)}
                <span className="m-sep" />{active.length > 1 ? 'Both depots' : depotName(active[0])}
                <span className="m-sep" />{"Loader flags, store reports, vehicles, late risk"}
              </div>
              <div className="d-h1">{counts.open} open exception{counts.open === 1 ? '' : 's'}</div>
            </div>
            <div className="d-toolbar">
              {([['open', 'Open', counts.open], ['resolved', 'Resolved today', counts.resolved], ['all', 'All', counts.open + counts.resolved]] as Array<[Tab, string, number]>).map(([k, l, n]) => (
                <span key={k} className={`d-filter lv-click${tab === k ? ' is-on' : ''}`} role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); setTab(k); }} onKeyDown={e => { if (e.key === 'Enter') setTab(k); }}>
                  {l} <b>{n}</b>
                </span>
              ))}
            </div>
          </div>
          <ErrorBanner error={open.error ?? resolved.error ?? markRead.error ?? sendToStore.error} onRetry={() => { void open.refresh(); void resolved.refresh(); }} />
          <div className="dx-hrow" style={{ flex: '1' }}>
            <div className="dx-card" style={{ width: '450px', flexShrink: '0' }} data-testid="inbox">
              <div className="dx-card__head">
                <span className="dx-card__title">{"Inbox"}</span>
                <span className="spacer" />
                <span className="d-search" style={{ width: '200px' }}>
                  <Ic n="filter" className="ic ic--sm" />
                  <input className="lv-input" aria-label="Search exceptions" placeholder="Vehicle, outlet, order" value={q} onChange={e => setQ(e.target.value)} />
                </span>
              </div>
              {showOpen && <div className="dx-grp">{"Open · most urgent first"}</div>}
              {showOpen && !open.data && !open.error && <Skeleton rows={3} />}
              {showOpen && open.data && openItems.length === 0 && <Empty title="Inbox zero" text="Nothing open right now." />}
              {showOpen && openItems.map(x => (
                <div
                  key={x.id}
                  className={`dx-lrow lv-click${sel?.id === x.id ? ' dx-lrow--sel' : ''}${x.tone === 'off' ? ' dx-lrow--off' : ''}`}
                  data-exception={x.id}
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); setSelId(x.id); }}
                  onKeyDown={e => { if (e.key === 'Enter') setSelId(x.id); }}
                >
                  <span className={`dx-lead ${LEAD[x.tone][0]}`}><Ic n={LEAD[x.tone][1]} /></span>
                  <div className="dx-lrow__main">
                    <span className="dx-lrow__t">{x.title}</span>
                    <span className="dx-lrow__m">{SOURCE[x.source]} · {x.meta}</span>
                  </div>
                  <div className="dx-lrow__tr"><span className={`m-pill ${LEAD[x.tone][2]}`}>{LEAD[x.tone][3]}</span></div>
                </div>
              ))}
              {showDone && <div className="dx-grp">{"Resolved today"}</div>}
              {showDone && !resolved.data && !resolved.error && <Skeleton rows={2} />}
              {showDone && resolved.data && doneItems.length === 0 && <span className="dx-t13" style={{ padding: '8px 16px' }}>Nothing resolved yet today.</span>}
              {showDone && doneItems.map(n => (
                <div key={n.id} className="dx-lrow">
                  <span className="dx-lead dx-lead--ok"><Ic n="check" /></span>
                  <div className="dx-lrow__main">
                    <span className="dx-lrow__t">{n.type.charAt(0) + n.type.slice(1).toLowerCase().replace(/_/g, ' ')}</span>
                    <span className="dx-lrow__m">{n.tripId ? <span className="id">{n.tripId}</span> : null} · {fmtTime(n.sentAt)}</span>
                  </div>
                  <div className="dx-lrow__tr"><span className="m-tag m-tag--ok"><Ic n="check" />Handled {fmtClock(n.readAt)}</span></div>
                </div>
              ))}
              <div className="spacer" />
              <div className="x-tfoot"><span>{`Rules: late risk ${riskPct ?? '…'}% or more, order exceptions, loader and vehicle alerts`}</span></div>
            </div>
            <div className="dx-col" style={{ flex: '1', gap: '16px' }}>
              {!sel ? (
                <div className="dx-card" style={{ flex: '1' }}><Empty title="Nothing selected" text="Pick an exception on the left." icon="list" /></div>
              ) : (
                <>
                  <div className="dx-hero dx-hero--soft" style={{ gap: '10px' }} data-testid="exception-detail">
                    <div className="dx-hero__l">
                      <span className={`m-pill ${LEAD[sel.tone][2]}`}><Ic n={LEAD[sel.tone][1]} />{SOURCE[sel.source]}</span>
                      <span className="spacer" />
                      {outlet.data ? <>{outlet.data.name} · <span className="id">{outlet.data.id}</span> · {outlet.data.dockType.toLowerCase().replace('_', ' ')}</> : sel.outletId}
                    </div>
                    <div className="dx-h1xl">{sel.title}</div>
                    <div className="dx-hero__m">
                      {outlet.data ? <>Window <b>{outlet.data.windowOpen}–{outlet.data.windowClose}</b>. </> : null}
                      {sel.meta}
                    </div>
                    <div className="dx-stats" style={{ paddingTop: '6px' }}>
                      <div className="dx-stat"><b style={{ color: 'var(--st-exception-fg)' }}>{stop?.lateRiskPct ?? (sel.value ? sel.value.replace('%', '') : '—')}{stop?.lateRiskPct !== undefined || sel.value ? '%' : ''}</b><span>{"late risk"}</span></div>
                      <div className="dx-stat"><b>{stop?.etaModel ? fmtClock(stop.etaModel) : '—'}</b><span>{"model ETA"}</span></div>
                      <div className="dx-stat"><b>{stops.length ? `${doneStops} / ${stops.length}` : '—'}</b><span>{"stops done"}</span></div>
                      <div className="dx-stat"><b>{trip.data?.vehicleId ?? '—'}</b><span>{"vehicle"}</span></div>
                    </div>
                  </div>
                  <div className="dx-hrow" style={{ flex: '1' }}>
                    <div className="dx-card" style={{ flex: '1' }}>
                      <div className="dx-card__head"><span className="dx-card__title">{"What happened"}</span></div>
                      <div className="dx-card__body" style={{ gap: '0' }}>
                        {[
                          sel.at ? { t: sel.at, title: SOURCE[sel.source], m: sel.meta } : null,
                          stop?.etaPlan ? { t: stop.etaPlan, title: 'Planned arrival', m: `Stop ${stop.stopSeq} of ${stops.length}` } : null,
                          stop?.etaModel ? { t: stop.etaModel, title: 'Model ETA', m: stop.etaModelBandEarly && stop.etaModelBandLate ? `Band ${fmtClock(stop.etaModelBandEarly)}–${fmtClock(stop.etaModelBandLate)}` : '' } : null,
                          stop?.arrivalActual ? { t: stop.arrivalActual, title: 'Arrived', m: stop.leaveActual ? `Left ${fmtClock(stop.leaveActual)}` : '' } : null,
                        ].filter((e): e is { t: string; title: string; m: string } => Boolean(e)).map((e, i, arr) => (
                          <div key={i} className="dx-stop">
                            <div className="dx-stop__rail">
                              <span className="dx-stop__n" style={{ width: '12px', height: '12px', marginTop: '5px', background: 'var(--brand-600)' }} />
                              {i < arr.length - 1 && <span className="dx-stop__line" />}
                            </div>
                            <div className="dx-stop__main" style={{ paddingBottom: '12px' }}>
                              <div className="dx-stop__t"><span className="mono" style={{ fontSize: '14px' }}>{fmtClock(e.t)}</span>{e.title}</div>
                              <div className="dx-stop__m" style={{ whiteSpace: 'normal' }}>{e.m}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="dx-card" style={{ flex: '1' }}>
                      <div className="dx-card__head"><span className="dx-card__title">{"Message the store"}</span></div>
                      <div className="dx-card__body" style={{ gap: '10px' }}>
                        <div className="dx-inset dx-inset--brand" style={{ gap: '4px', padding: '14px 16px' }}>
                          <b style={{ fontSize: '14px' }}>{sel.outletId ? `Store manager of ${sel.outletId}` : 'No outlet on this exception'}</b>
                          <textarea className="lv-input dx-t13" aria-label="Message to the store" placeholder="What the store should know or do" value={message} onChange={e => setMessage(e.target.value)} />
                        </div>
                        {sel.notificationId && (
                          <Btn className="d-btn" busy={markRead.pending} testId="mark-handled" onClick={() => void markRead.run(sel.notificationId!)}><Ic n="check" />{sel.type === 'SHORTFALL_FLAGGED' ? 'Acknowledge' : 'Mark handled'}</Btn>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="x-foot">
                    <span>Assigned to <b>you</b></span>
                    <span className="spacer" />
                    <span className="d-btn" data-lk="L164"><Ic n="navigate" />{"Live operations"}</span>
                    {(() => {
                      // signal loss, vehicle fault and sync conflicts are handled on their P5 screens (DSP-A1, DSP-B1, DSP-A2)
                      const to = p5Link(sel);
                      if (!to) return null;
                      return (
                        <Btn className="d-btn" testId="open-p5" onClick={() => {
                          if (to.focus?.[0] === 'trip') setFocusTrip(to.focus[1]);
                          if (to.focus?.[0] === 'vehicle') setFocusVehicle(to.focus[1]);
                          router.push(to.href);
                        }}>
                          <Ic n="arrow-right" />{to.label}
                        </Btn>
                      );
                    })()}
                    <Btn
                      className="d-btn d-btn--primary"
                      testId="message-store"
                      busy={sendToStore.pending}
                      disabled={!sel.outletId || !message.trim()}
                      onClick={() => void sendToStore.run({ outletId: sel.outletId!, text: message.trim(), tripId: sel.tripId })}
                    >
                      <Ic n="message" />{"Message store"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
