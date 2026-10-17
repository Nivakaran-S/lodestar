'use client';
// SM-02 Deliveries, live. Markup and classes from the generated design (frontend/screens/sm-02-deliveries.tsx).
// Data: the outlet's TripStops (with Trip, Order and POD) — the API returns only stops of the outlet in the
// token — the next delivery's ETA band and late risk, its order thread, the week's orders, and unread
// Notifications ("Got it" marks them read). Realtime: everything the store:<outlet> and user rooms carry
// (notification, eta_update and arrivals, credit_note_issued, signal_lost/back, trip_released, plan_published)
// refreshes the screen. The order card counts down to the cut-off of the next run still open for orders (the next
// operating day on the Calendar), moving on by itself at 4:00 PM.
// Receipt: once the delivery is in, the side panel asks for the store's count of each order and an optional
// issue (the phone's SM-03 count and SM-18 report issue, on the desk): Orders('…')/Lodestar.ConfirmReceipt
// records the count and the issue as the receipt note; a short count gets a credit note and a POD exception.
import { useMemo, useState } from 'react';
import Btn from '@/components/live/Btn';
import { StoreTop, useMyOutlet } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import PodPhoto, { PodSignature } from '@/components/live/PodPhoto';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { isCounted, leftText, noticeText, orderCredit, STORE_EVENTS, useNextRun } from '@/components/live/store-data';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addDays, daysAgo, fmtClock, fmtDay, fmtRunDate, fmtTime, LATE_RISK_PCT, title } from '@/lib/format';
import { colomboDay, CUTOFF_LABEL } from '@/lib/workday';
import { useAction, useQuery } from '@/lib/odata/hooks';
import type { Notification, Order, Trip, TripStop } from '@/lib/odata/types';
import { useDepots } from '@/components/live/depots';

const PILL: Record<string, [string, string]> = {
  RECEIVED: ['m-pill--brand', 'Received'], PLANNED: ['m-pill--brand', 'Planned'], LOADED: ['m-pill--loaded', 'Loading'],
  ENROUTE: ['m-pill--info', 'On the way'], DELIVERED: ['m-pill--ok', 'Delivered'], DEFERRED: ['m-pill--warn', 'Deferred'],
  EXCEPTION: ['m-pill--bad', 'Exception'], CANCELLED: ['', 'Cancelled'],
};
const STEPS = ['RECEIVED', 'PLANNED', 'LOADED', 'ENROUTE', 'DELIVERED'];
/** Orders('…')/Lodestar.ConfirmReceipt accepts these (backend RECEIVABLE_STATUSES). */
const RECEIVABLE = ['LOADED', 'ENROUTE', 'DELIVERED', 'EXCEPTION'];
/** SM-18 "What's wrong?" */
const ISSUES = ['Short', 'Damaged', 'Temperature', 'Wrong item'] as const;

type Receipt = { order: Order; units: number; note?: string };
type Issue = { orderId: string; kind: (typeof ISSUES)[number]; note: string };

/** The receipt note of one order: the short count and the reported issue, if any. */
export function receiptNote(order: Pick<Order, 'id' | 'units'>, counted: number, issue: Issue | null): string | undefined {
  const parts = [
    counted < order.units ? `${order.units - counted} short at receipt` : '',
    issue?.orderId === order.id ? `${issue.kind}${issue.note.trim() ? `: ${issue.note.trim()}` : ''}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || undefined;
}

/** The delivery is in: count each order, report an issue, confirm (SM-03 and SM-18 on the desk). */
function ReceiptCard({ stops, onDone, hub }: { stops: TripStop[]; onDone: () => void; hub: string }) {
  const orders = stops.map(s => s.order).filter((o): o is Order => !!o && o.status !== 'CANCELLED');
  const open = orders.filter(o => o.unitsReceived == null && RECEIVABLE.includes(o.status));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [issue, setIssue] = useState<Issue | null>(null);
  const confirm = useAction<Receipt[], unknown>(async (c, list) => {
    const savedAt = new Date().toISOString();
    for (const r of list) {
      await c.action('Orders', r.order.id, 'ConfirmReceipt', { unitsReceived: r.units, unitsExpected: r.order.units, savedAt, ...(r.note ? { note: r.note } : {}) });
    }
  }, { onSuccess: onDone });

  if (!orders.length) return null;
  if (!open.length) {
    if (orders.some(o => o.unitsReceived == null)) return null;
    const got = orders.reduce((n, o) => n + (o.unitsReceived ?? 0), 0);
    const want = orders.reduce((n, o) => n + (o.unitsExpected ?? o.units), 0);
    const credit = orders.map(o => orderCredit(o, stops.find(s => s.orderId === o.id)?.pod)).find(c => c.creditNoteId)?.creditNoteId;
    return (
      <div className="d-card" data-testid="receipt-done">
        <div className="ncard" style={{ gap: '6px' }}>
          <span className="ncard__meta" style={{ color: 'var(--st-delivered-fg)' }}><Ic n="check" className="ic ic--sm" />{"Receipt confirmed"}</span>
          <span className="ncard__p">You counted <b>{got} of {want}</b> units{credit ? <> · credit note <span className="id">{credit}</span></> : null}.</span>
          {orders.filter(o => o.receiptNote).map(o => <span key={o.id} className="ncard__p"><span className="id">{o.id}</span> {o.receiptNote}</span>)}
        </div>
      </div>
    );
  }
  const countOf = (o: Order) => counts[o.id] ?? o.units;
  const bump = (o: Order, d: number) => setCounts(c => ({ ...c, [o.id]: Math.max(0, Math.min(o.units, countOf(o) + d)) }));
  const short = open.reduce((n, o) => n + o.units - countOf(o), 0);
  const submit = () => void confirm.run(open.map(o => ({ order: o, units: countOf(o), note: receiptNote(o, countOf(o), issue) })));
  const pick = (kind: Issue['kind']) => issue && setIssue({ ...issue, kind });
  return (
    <div className="d-card" data-testid="receipt">
      <div className="ncard">
        <span className="ncard__meta" style={{ color: 'var(--brand-600)' }}><Ic n="box" className="ic ic--sm" />{"Delivery in · count it"}</span>
        <span className="ncard__t">{"Confirm receipt"}</span>
        {open.map(o => (
          <div key={o.id} className="between" style={{ gap: '10px' }} data-receipt={o.id}>
            <span className="vstack" style={{ gap: '2px', minWidth: '0' }}>
              <span className="id" style={{ color: 'var(--text)' }}>{o.id}</span>
              <span className="t-3" style={{ fontSize: '12.5px' }}>{o.tempClass === 'CHILLED' ? 'Chilled' : 'Dry'} · {o.units} ordered</span>
            </span>
            <span className="qty">
              <Btn className="qty__b" title={`One less for ${o.id}`} onClick={() => bump(o, -1)}><Ic n="minus" /></Btn>
              <span className="qty__v" aria-label={`${o.id} count`} data-testid={`receipt-count-${o.id}`}>{countOf(o)}</span>
              <Btn className="qty__b" title={`One more for ${o.id}`} onClick={() => bump(o, 1)}><Ic n="plus" /></Btn>
            </span>
          </div>
        ))}
        {issue ? (
          <div className="vstack" style={{ gap: '8px' }} data-testid="issue">
            <span className="d-kpi__l">{"Report an issue · what's wrong?"}</span>
            {open.length > 1 && (
              <select className="lv-input lv-field" aria-label="Order with the issue" value={issue.orderId} onChange={e => setIssue({ ...issue, orderId: e.target.value })} onClick={e => e.stopPropagation()}>
                {open.map(o => <option key={o.id} value={o.id}>{o.id}</option>)}
              </select>
            )}
            <div className="m-seg" style={{ margin: '0', flexWrap: 'wrap' }} role="radiogroup" aria-label="What's wrong?">
              {ISSUES.map(k => (
                <span key={k} role="radio" aria-checked={issue.kind === k} tabIndex={0} className={`m-seg__i lv-click${issue.kind === k ? ' is-on' : ''}`} style={{ height: '32px', fontSize: '13px' }}
                  onClick={e => { e.stopPropagation(); pick(k); }} onKeyDown={e => { if (e.key === 'Enter') pick(k); }}>{k}</span>
              ))}
            </div>
            <textarea className="lv-input lv-field" aria-label={`Note for ${hub}`} placeholder={`Note for ${hub} · optional`} maxLength={400} value={issue.note} onChange={e => setIssue({ ...issue, note: e.target.value })} onClick={e => e.stopPropagation()} />
          </div>
        ) : (
          <Btn className="lv-link" testId="report-issue" onClick={() => setIssue({ orderId: open[0].id, kind: short ? 'Short' : 'Damaged', note: '' })}>{"Report an issue"}</Btn>
        )}
        <ErrorBanner error={confirm.error} />
        <Btn className="d-btn d-btn--primary" testId="confirm-receipt" busy={confirm.pending} onClick={submit}>
          {short ? `Confirm · ${short} to credit` : 'Confirm receipt'}
        </Btn>
      </div>
    </div>
  );
}

function Thread({ order, stop, trip, stale = false }: { order: Order; stop?: TripStop; trip?: Trip; stale?: boolean }) {
  const at = Math.max(0, STEPS.indexOf(order.status === 'DEFERRED' || order.status === 'EXCEPTION' ? 'PLANNED' : order.status));
  const times = [fmtDay(order.orderedAt), order.status === 'RECEIVED' ? '' : 'planned', trip?.bay ? `bay ${trip.bay}` : '', trip?.departTime ? fmtClock(trip.departTime) : '', stop?.arrivalActual ? fmtClock(stop.arrivalActual) : stop?.etaModelBandEarly ? `${fmtClock(stop.etaModelBandEarly)}–${fmtClock(stop.etaModelBandLate)}` : ''];
  return (
    <div className="thread thread--wide">
      {STEPS.flatMap((st, i) => {
        const done = i < at || order.status === 'DELIVERED';
        const now = i === at && order.status !== 'DELIVERED';
        const step = (
          <div key={st} className={`thread__step ${done ? 'is-done' : now ? 'is-now' : ''}`}>
            <div className="thread__node">{done ? <Ic n="check" /> : now ? <Ic n="box" /> : null}</div>
            <div className="thread__label">{['Received', 'Planned', 'Loading', 'En route', 'Delivered'][i]}</div>
            <div className="thread__time">{now && !stale ? 'now' : times[i]}</div>
          </div>
        );
        return i < STEPS.length - 1 ? [step, <div key={`${st}-bar`} className={`thread__bar${i < at || order.status === 'DELIVERED' ? ' is-done' : ''}`} />] : [step];
      })}
    </div>
  );
}

export default function LiveSm02Deliveries() {
  const { name: depotName } = useDepots();
  const { session } = useAuth();
  const outlet = useMyOutlet();
  const outletId = session?.outletId;
  const [range, setRange] = useState<7 | 28>(7);

  const stops = useQuery<TripStop[]>(outletId ? `store-stops:${outletId}` : null, async c =>
    (await c.list<TripStop>('TripStops', { filter: `outletId eq '${outletId}'`, expand: 'trip,order,pod', orderby: 'etaPlan desc', top: 20 })).value,
  { refreshOn: STORE_EVENTS });
  // the week (or 4 weeks) back from today's business date in Colombo, and the orders booked ahead
  const since = daysAgo(range);
  const orders = useQuery<Order[]>(outletId ? `store-week:${outletId}:${since}` : null, async c =>
    (await c.list<Order>('Orders', { filter: `outletId eq '${outletId}' and runDate ge ${since}T00:00:00Z`, expand: 'tripStop($expand=pod)', orderby: 'runDate desc,id', top: 60 })).value,
  { refreshOn: STORE_EVENTS });
  const notes = useQuery<Notification[]>('store-unread', async c =>
    (await c.list<Notification>('Notifications', { filter: 'readAt eq null', orderby: 'sentAt desc', top: 3 })).value,
  { refreshOn: STORE_EVENTS });
  const markRead = useAction<string, unknown>((c, id) => c.action('Notifications', id, 'MarkRead'), { onSuccess: () => void notes.refresh() });

  // The delivery to show: the next one not yet delivered from today on, else the latest. A stop of a past run that
  // was never closed is history, not "today's delivery".
  const sorted = useMemo(() => [...(stops.data ?? [])].sort((a, b) => String(a.etaPlan ?? '').localeCompare(String(b.etaPlan ?? ''))), [stops.data]);
  const todayIso = colomboDay();
  const runDay = (s: TripStop) => (s.trip?.runDate ? String(s.trip.runDate).slice(0, 10) : s.etaPlan ? colomboDay(new Date(s.etaPlan)) : '');
  const open = sorted.filter(s => s.status !== 'DELIVERED' && runDay(s) >= todayIso);
  const current = open[0] ?? sorted[sorted.length - 1];
  const currentDay = current ? runDay(current) : '';
  const heading = !current || current.status === 'DELIVERED' || currentDay < todayIso ? 'Latest delivery' : currentDay === todayIso ? "Today's delivery" : 'Next delivery';
  // a past run that was never closed: its ETA, departure and late risk are history, not a live forecast
  const stale = !!current && current.status !== 'DELIVERED' && currentDay < todayIso;
  const sameRun = current ? sorted.filter(s => s.tripId === current.tripId && s.outletId === current.outletId) : [];
  // The receipt to count: the latest delivery that is in and not counted yet (a later run may already be planned),
  // else the receipt of the latest delivery that is in (confirmed).
  const arrived = sorted.filter(s => s.status === 'DELIVERED' || !!s.arrivalActual);
  const uncounted = arrived.filter(s => s.order && s.order.unitsReceived == null && RECEIVABLE.includes(s.order.status));
  const receiptTrip = uncounted.length ? uncounted[uncounted.length - 1].tripId : arrived.length ? arrived[arrived.length - 1].tripId : null;
  const receiptRun = receiptTrip ? arrived.filter(s => s.tripId === receiptTrip) : [];
  const trip = current?.trip;
  const order = current?.order;
  const risk = current?.lateRiskPct ?? null;
  const o = outlet.data;
  const units = sameRun.reduce((s, x) => s + (x.order?.units ?? 0), 0);
  const depot = o?.depot ?? trip?.depot;
  const hub = depot ? depotName(depot) : 'the hub';
  const vans = new Set(sameRun.map(s => s.tripId)).size;
  // the next run still open for orders: tomorrow's until its 4:00 PM cut-off today (Colombo), then the next
  // operating day; kept current as the clock passes the cut-off
  const next = useNextRun();
  const nextRun = next.runDate;
  const closesOn = addDays(nextRun, -1);
  const today = colomboDay(new Date(next.now));
  const closesWhen = closesOn === today ? 'today' : closesOn === addDays(today, 1) ? 'tomorrow' : `on ${fmtRunDate(closesOn)}`;

  return (
    <div className="frame frame--desktop mode-store" data-name="SM-02 Deliveries · desktop">
      <div className="s-shell">
        <StoreTop active="deliveries" avatarLk="L128" />
        <div className="d-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {current ? fmtRunDate(trip?.runDate ?? current.etaPlan) : 'No delivery yet'}
                <span className="m-sep" />{` ${sameRun.length} order${sameRun.length === 1 ? '' : 's'} `}
                {trip && <><span className="m-sep" />{` ${vans} van${vans === 1 ? '' : 's'} `}</>}
                {current && <><span className="m-sep" />{stale ? ` from ${hub}, never closed` : ` live from ${hub}`}</>}
              </div>
              <div className="d-h1">{heading}</div>
            </div>
            {trip && <span className={`m-pill ${PILL[trip.status === 'ENROUTE' ? 'ENROUTE' : trip.status === 'COMPLETE' ? 'DELIVERED' : 'LOADED'][0]}`}><span className="dot" />{trip.status === 'LOADING' ? `Loading at ${hub}` : title(trip.status)}{trip.bay ? ` · Bay ${trip.bay}` : ''}</span>}
          </div>
          <ErrorBanner error={stops.error ?? orders.error ?? notes.error ?? markRead.error} onRetry={() => { void stops.refresh(); void orders.refresh(); }} />
          <div className="hstack" style={{ gap: '18px', alignItems: 'stretch' }}>
            <div className="d-card" style={{ flex: '1' }} data-testid="next-delivery">
              {!stops.data && !stops.error && <Skeleton rows={2} />}
              {stops.data && !current && <Empty title="No deliveries yet" text="Your next delivery shows here once it is planned." icon="van-2" />}
              {current && (
                <>
                  <div className="arr">
                    <div className="vstack" style={{ gap: '10px', width: '430px', flexShrink: '0' }}>
                      <span className="d-kpi__l">{current.status === 'DELIVERED' ? 'Arrived' : stale ? 'Planned arrival' : 'Expected arrival'} · you&apos;re stop {current.stopSeq}</span>
                      <span className="arr__v" data-testid="eta">
                        {current.arrivalActual ? fmtClock(current.arrivalActual) : current.etaModelBandEarly && current.etaModelBandLate ? `${fmtClock(current.etaModelBandEarly)}–${fmtClock(current.etaModelBandLate)}` : fmtClock(current.etaModel ?? current.etaPlan)}
                      </span>
                      <span className="d-sub">
                        {"ETA "}<b style={{ color: 'var(--text)' }}>~{fmtClock(current.etaModel ?? current.etaPlan)}</b>
                        {current.etaPlan ? ` · plan ${fmtClock(current.etaPlan)}` : ''}
                        {trip ? <> · <span className="id">{trip.vehicleId}</span></> : null}
                        {trip?.departTime && !stale ? ` · departs ~${fmtClock(trip.departTime)}` : ''}
                      </span>
                      {risk !== null && current.status !== 'DELIVERED' && !stale && (
                        <span className={`m-tag ${risk >= LATE_RISK_PCT ? 'm-tag--warn' : 'm-tag--ok'}`}><span className="dot" />{risk >= LATE_RISK_PCT ? 'At risk' : 'On time'} for your {o?.windowClose ?? ''} window · late risk {risk}%</span>
                      )}
                    </div>
                    <div className="arr__plan">
                      <span className="d-kpi__l" style={{ paddingBottom: '2px' }}>{"Receiving plan"}</span>
                      <div className="plan-i"><span className="plan-i__lead"><Ic n="people" /></span><span><b>Staff at the door</b> from {current.etaModelBandEarly ? fmtClock(current.etaModelBandEarly) : o?.windowOpen}</span></div>
                      {sameRun.some(s => s.order?.tempClass === 'CHILLED') && (
                        <div className="plan-i"><span className="plan-i__lead plan-i__lead--cold"><Ic n="snow" /></span><span><b>Chilled first</b>, to the cold room ({sameRun.filter(s => s.order?.tempClass === 'CHILLED').map((s, i) => <span key={s.id}>{i ? ', ' : ''}<span className="id">{s.orderId}</span></span>)})</span></div>
                      )}
                      {o?.accessNote && <div className="plan-i"><span className="plan-i__lead plan-i__lead--plain"><Ic n="van-3" /></span><span>{o.accessNote}</span></div>}
                    </div>
                  </div>
                  <div className="arr__foot">
                    {order && <Thread order={order} stop={current} trip={trip} stale={stale} />}
                    <div className="spacer" />
                    <div className="vstack" style={{ gap: '8px' }}>
                      {sameRun.map(s => (
                        <div key={s.id} className="ord-mini">
                          {s.order?.tempClass === 'CHILLED' ? <span className="m-tag m-tag--cold"><Ic n="snow" />{"Chilled"}</span> : <span className="m-tag"><span className="dot" />{"Dry"}</span>}
                          <span className="id" style={{ color: 'var(--text)' }}>{s.orderId}</span>
                          {isCounted(s.order) && s.order!.unitsReceived! < (s.order!.unitsExpected ?? s.order!.units)
                            ? <span style={{ color: 'var(--st-deferred-fg)', fontWeight: '700' }}>{s.order!.unitsReceived} of {s.order!.unitsExpected ?? s.order!.units}</span>
                            : s.pod && s.pod.unitsDelivered !== s.pod.unitsOrdered
                              ? <span style={{ color: 'var(--st-deferred-fg)', fontWeight: '700' }}>{s.pod.unitsDelivered} of {s.pod.unitsOrdered}</span>
                              : <span>{s.order?.units ?? 0} units</span>}
                          {s.pod && <PodPhoto pod={s.pod} label={`the drop of ${s.orderId}`} width={40} height={30} />}
                          {s.pod?.signatureUrl && <PodSignature pod={s.pod} width={56} height={24} />}
                        </div>
                      ))}
                      <span className="t-3" style={{ fontSize: '12.5px' }}>{units} units in this delivery</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="d-panel">
              {receiptRun.length > 0 && <ReceiptCard stops={receiptRun} hub={hub} onDone={() => { void stops.refresh(); void orders.refresh(); }} />}
              {notes.data?.length === 0 && (
                <div className="d-card"><div className="ncard" style={{ gap: '6px' }}><span className="ncard__meta"><Ic n="check" className="ic ic--sm" />{"Nothing needs your attention"}</span></div></div>
              )}
              {notes.data?.map(n => (
                <div key={n.id} className="d-card d-card--warn" data-notification={n.id}>
                  <div className="ncard">
                    <span className="ncard__meta"><Ic n="alert" className="ic ic--sm" />Needs your attention · {fmtTime(n.sentAt)}</span>
                    <span className="ncard__t">{title(n.type)}</span>
                    <span className="ncard__p" data-testid="notice-text">{noticeText(n)}</span>
                    <div className="hstack" style={{ gap: '10px', marginTop: '4px' }}>
                      <Btn className="d-btn d-btn--primary" style={{ height: '36px' }} busy={markRead.pending} onClick={() => void markRead.run(n.id)}>{"Got it"}</Btn>
                    </div>
                  </div>
                </div>
              ))}
              <div className="d-card" data-lk="L124">
                <div className="ncard" style={{ gap: '6px' }}>
                  <span className="ncard__meta" style={{ color: 'var(--brand-600)' }} data-testid="next-run"><Ic n="clock" className="ic ic--sm" />{fmtRunDate(nextRun)} orders close {CUTOFF_LABEL} {closesWhen}{leftText(next.msLeft) ? ` · ${leftText(next.msLeft)} left` : ''}</span>
                  <span className="ncard__p">Start from your last order. <b style={{ color: 'var(--brand-600)' }}>Start {fmtRunDate(nextRun).split(' ')[0]} order</b></span>
                </div>
              </div>
            </div>
          </div>
          <div className="d-card" style={{ flex: '1' }}>
            <div className="d-card__head">
              <span className="d-card__title">{range === 7 ? 'This week' : 'Last 4 weeks'}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{"every order, delivery and receipt in one list"}</span>
              <div className="spacer" />
              <div className="m-seg" style={{ margin: '0', width: '260px' }}>
                {([7, 28] as const).map(r => (
                  <span key={r} className={`m-seg__i lv-click${range === r ? ' is-on' : ''}`} style={{ height: '30px', fontSize: '13px' }} role="button" tabIndex={0}
                    onClick={e => { e.stopPropagation(); setRange(r); }} onKeyDown={e => { if (e.key === 'Enter') setRange(r); }}>
                    {r === 7 ? 'This week' : 'Last 4 weeks'}
                  </span>
                ))}
              </div>
            </div>
            <div className="wk-row wk-row--head" data-lk="L125">
              <span className="c" style={{ width: '120px' }}>{"Delivery day"}</span>
              <span className="c" style={{ width: '130px' }}>{"Order"}</span>
              <span className="c" style={{ width: '120px' }}>{"Temperature"}</span>
              <span className="c" style={{ width: '110px' }}>{"Units"}</span>
              <span className="c" style={{ width: '150px' }}>{"Status"}</span>
              <span className="c" style={{ width: '150px' }}>{"Arrival"}</span>
              <span className="c" style={{ flex: '1' }}>{"Receipt"}</span>
            </div>
            {!orders.data && !orders.error && <Skeleton rows={3} />}
            {orders.data?.length === 0 && <Empty title="No orders in this period" />}
            {orders.data?.map(x => {
              const [cls, label] = PILL[x.status] ?? ['', x.status];
              const st = x.tripStop;
              const sel = Boolean(st && st.id === current?.id);
              const credit = orderCredit(x, st?.pod);
              const receipt = isCounted(x)
                ? `Counted ${x.unitsReceived} of ${x.unitsExpected ?? x.units}${credit.creditNoteId ? ` · ${credit.creditNoteId}, ${credit.units} credited` : ''}`
                : x.status === 'DELIVERED' ? (credit.creditNoteId ? `Delivered · ${credit.creditNoteId}` : 'Delivered · count it') : 'after delivery';
              return (
                <div key={x.id} className={`wk-row${sel ? ' wk-row--sel' : ''}`} data-order={x.id}>
                  <span className={`c${sel ? ' fw7' : ''}`} style={{ width: '120px' }}>{fmtRunDate(x.runDate)}</span>
                  <span className="c id" style={{ width: '130px' }}>{x.id}</span>
                  <span className="c" style={{ width: '120px' }}>{x.tempClass === 'CHILLED' ? <span className="m-tag m-tag--cold"><span className="dot" />{"Chilled"}</span> : <span className="m-tag"><span className="dot" />{"Ambient"}</span>}</span>
                  <span className="c" style={{ width: '110px' }}>{x.units}</span>
                  <span className="c" style={{ width: '150px' }}><span className={`m-pill ${cls}`}><span className="dot" />{label}</span></span>
                  <span className={`c${sel ? ' fw7' : ''}`} style={{ width: '150px' }}>{st?.arrivalActual ? fmtClock(st.arrivalActual) : st?.etaModelBandEarly ? `${fmtClock(st.etaModelBandEarly)}–${fmtClock(st.etaModelBandLate)}` : '—'}</span>
                  <span className="c" style={{ flex: '1', color: credit.creditNoteId ? 'var(--st-deferred-fg)' : x.status === 'DELIVERED' ? 'var(--st-delivered-fg)' : 'var(--text-3)', fontWeight: x.status === 'DELIVERED' ? '700' : undefined }}>
                    {receipt}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
