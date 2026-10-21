'use client';
// SM-01 Place order, live. Markup and classes from the generated design (frontend/screens/sm-01-place-order.tsx).
// Starts from the outlet's last dry and chilled orders (Orders + OrderLineItems), the store adjusts quantities or
// adds items, and "Submit" sends POST /Orders with lineItems — one order per temperature class, for the outlet
// in the user's token (the API refuses any other outlet). The Calendar row of the run date feeds the festival card.
// The run offered is the next one still open for orders: tomorrow until its 4:00 PM cut-off (Colombo), then the
// day after, never a day the operating Calendar closes (the next operating day instead); it moves on by itself as
// the clock passes the cut-off. A closed date picked by hand cannot be submitted, nor a run dispatch has closed
// (Orders/Lodestar.OrderWindow: the "orders closed" banner). After a run's cut-off the API
// still takes the order and moves it to the next open operating run; the screen then shows the run date and note
// the API returned instead of moving on.
// The lines are kept in this browser tab as the store edits them (components/live/order-draft.ts). When the server
// cannot be reached on Submit (network error or 5xx), the screen moves to SM-36 Service unavailable, which keeps
// the draft and sends it as soon as the server answers; "Keep editing" there comes back here with the draft.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScreenNav } from '@/components/ScreenShell';
import Btn from '@/components/live/Btn';
import { StoreTop, useMyOutlet } from '@/components/live/chrome';
import { Ic } from '@/components/live/icons';
import { clearOrderDraft, isUnreachable, loadOrderDraft, saveOrderDraft, sendOrderDraft, type DraftLine, type OrderDraft } from '@/components/live/order-draft';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { nextOpenDay, useNextRun } from '@/components/live/store-data';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addDays, fmtNum, fmtRunDate, isoDay } from '@/lib/format';
import { colomboDay, CUTOFF_LABEL, cutoffFor } from '@/lib/workday';
import { useAction, useQuery } from '@/lib/odata/hooks';
import type { Order, OrderLineItem, OrderWindow, TempClass } from '@/lib/odata/types';
import { valueOf } from '@/lib/odata/client';
import { useDepots } from '@/components/live/depots';

type Line = DraftLine;
export const SERVICE_UNAVAILABLE = '/store/sm-36-service-unavailable';

const DEFAULT_M3_PER_KG = 0.0045;

function toLines(order: Order | undefined): Line[] {
  return (order?.lineItems ?? []).map((li: OrderLineItem) => ({
    key: li.id,
    name: li.name,
    last: li.qty,
    qty: li.qty,
    unitKg: li.qty ? li.kg / li.qty : li.kg,
  }));
}

/** "Tuesday" for a run date (stored as UTC midnight). */
const weekday = (v: string) => new Date(v).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
/** "08:00" as the boards write an opening time: "8:00". */
const clock = (hhmm: string) => hhmm.replace(/^0(?=\d:)/, '');

function LineTable({ title, cls, lines, setLines, note, tempClass, lastLabel }: {
  title: string; cls: string; lines: Line[]; setLines: (l: Line[]) => void; note: string; tempClass: TempClass; lastLabel: string;
}) {
  const [name, setName] = useState('');
  const [kg, setKg] = useState('');
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const weight = lines.reduce((s, l) => s + l.qty * l.unitKg, 0);
  const bump = (k: string, d: number) => setLines(lines.map(l => (l.key === k ? { ...l, qty: Math.max(0, l.qty + d) } : l)));
  const add = () => {
    const unitKg = Number(kg);
    if (!name.trim() || !(unitKg > 0)) return;
    setLines([...lines, { key: `new-${Date.now()}`, name: name.trim(), last: 0, qty: 1, unitKg }]);
    setName('');
    setKg('');
  };
  return (
    <div className="d-card" style={{ flex: '1' }} data-testid={`lines-${tempClass.toLowerCase()}`}>
      <div className="d-card__head">
        <span className="d-card__title">{title}</span>
        <span className={`m-tag ${cls}`}>{tempClass === 'CHILLED' ? <Ic n="snow" /> : <span className="dot" />}{tempClass === 'CHILLED' ? 'Chilled' : 'Ambient'}</span>
        <div className="spacer" />
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{note}</span>
      </div>
      <div className="ot-row ot-row--head">
        <span className="ot-item">{"Item"}</span>
        <span className="ot-last">{lastLabel}</span>
        <span className="ot-sug">{"kg / unit"}</span>
        <span className="ot-qty">{"Qty"}</span>
        <span className="ot-kg">{"kg"}</span>
      </div>
      {lines.length === 0 && <Empty title="No lines yet" text="Add the items for this order below." icon="plus" />}
      {lines.map(l => (
        <div key={l.key} className="ot-row" data-line={l.name}>
          <span className="ot-item"><b>{l.name}</b><span>{l.last ? `last ${l.last}` : 'new'}</span></span>
          <span className="ot-last">{l.last || '—'}</span>
          <span className="ot-sug">{fmtNum(l.unitKg, 1)}</span>
          <span className="ot-qty">
            <span className="qty">
              <Btn className="qty__b" title={`Less ${l.name}`} onClick={() => bump(l.key, -1)}><Ic n="minus" /></Btn>
              <span className="qty__v" aria-label={`${l.name} quantity`}>{l.qty}</span>
              <Btn className="qty__b" title={`More ${l.name}`} onClick={() => bump(l.key, 1)}><Ic n="plus" /></Btn>
            </span>
          </span>
          <span className="ot-kg">{fmtNum(l.qty * l.unitKg, 1)}</span>
        </div>
      ))}
      <div className="ot-row ot-row--add">
        <Ic n="plus" className="ic ic--sm" />
        <input className="lv-input" style={{ flex: '2' }} aria-label={`New ${title.toLowerCase()} item`} placeholder="Add item" value={name} onChange={e => setName(e.target.value)} />
        <input className="lv-input" style={{ flex: '1' }} aria-label="kg per unit" placeholder="kg / unit" inputMode="decimal" value={kg} onChange={e => setKg(e.target.value)} />
        <Btn className="x-link" onClick={add} disabled={!name.trim() || !(Number(kg) > 0)}>{"Add"}</Btn>
      </div>
      <div className="ot-row ot-row--total">
        <span className="ot-item"><b>{"Total"}</b><span>{tempClass === 'CHILLED' ? 'kept separate so it can travel in a reefer' : 'every operating day'}</span></span>
        <span className="ot-qty">{units}</span>
        <span className="ot-kg">{fmtNum(weight, 1)}</span>
      </div>
    </div>
  );
}

export default function LiveSm01PlaceOrder() {
  const { name: depotName } = useDepots();
  const router = useRouter();
  const nav = useScreenNav();
  const { session } = useAuth();
  const outlet = useMyOutlet();
  const outletId = session?.outletId;
  // a draft kept in this tab (edited earlier, or waiting on SM-36) comes back as it was
  const [saved] = useState(() => loadOrderDraft(outletId));
  // the next run still open for orders (cut-off and operating Calendar); a date the store picked by hand wins
  const next = useNextRun();
  const tomorrow = addDays(colomboDay(new Date(next.now)), 1);
  const [picked, setPicked] = useState<string | null>(() => (saved && saved.runDate >= tomorrow ? saved.runDate : null));
  const runDate = picked && picked >= tomorrow ? picked : next.runDate;
  const setRunDate = (d: string) => setPicked(d >= tomorrow ? d : null);
  const [sent, setSent] = useState<NonNullable<OrderDraft['sent']>>(saved?.sent ?? {});
  const [moved, setMoved] = useState<Order[] | null>(null);

  const history = useQuery<Order[]>(outletId ? `order-base:${outletId}` : null, async c =>
    (await c.list<Order>('Orders', { filter: `outletId eq '${outletId}' and status ne 'CANCELLED'`, expand: 'lineItems', orderby: 'runDate desc', top: 12 })).value);
  const lastDry = history.data?.find(o => o.tempClass === 'AMBIENT');
  const lastChilled = history.data?.find(o => o.tempClass === 'CHILLED');
  const [dry, setDry] = useState<Line[] | null>(saved?.dry ?? null);
  const [chilled, setChilled] = useState<Line[] | null>(saved?.chilled ?? null);
  const dryLines = dry ?? toLines(lastDry);
  const chilledLines = chilled ?? toLines(lastChilled);
  // the order the lines start from: "Last Tue" column, "started from last Tuesday"
  const startFrom = lastDry ?? lastChilled;
  const lastLabel = startFrom ? `Last ${fmtRunDate(startFrom.runDate).split(' ')[0]}` : 'Last order';
  const calendar = useQuery<{ festivalName?: string | null; festivalRamp?: number; isOperating?: boolean } | null>(`calendar:${runDate}`, async c =>
    (await c.list<{ festivalName?: string; festivalRamp?: number; isOperating?: boolean }>('Calendar', { filter: `date eq ${runDate}T00:00:00Z`, top: 1 })).value[0] ?? null);

  const ratio = useMemo(() => {
    const base = (history.data ?? []).filter(o => o.kg > 0);
    const kg = base.reduce((s, o) => s + o.kg, 0);
    const m3 = base.reduce((s, o) => s + o.m3, 0);
    return kg > 0 && m3 > 0 ? m3 / kg : DEFAULT_M3_PER_KG;
  }, [history.data]);

  const sum = (lines: Line[]) => ({
    units: lines.reduce((s, l) => s + l.qty, 0),
    kg: Math.round(lines.reduce((s, l) => s + l.qty * l.unitKg, 0) * 10) / 10,
  });
  const d = sum(dryLines);
  const ch = sum(chilledLines);
  // one order per temperature class (dry and chilled travel apart), each with its item lines
  const orders = [d.units ? 1 : 0, ch.units ? 1 : 0].reduce((a, b) => a + b, 0);
  const items = [...dryLines, ...chilledLines].filter(l => l.qty > 0).length;
  const itemsLabel = `${items} item${items === 1 ? '' : 's'}`;
  const cutoff = cutoffFor(runDate);
  const msLeft = cutoff.getTime() - next.now;
  const late = msLeft <= 0;
  // a day the operating Calendar closes has no run: it cannot be ordered for
  const closedDay = next.closed.has(runDate) || calendar.data?.isOperating === false;
  // dispatch may close a run before its cut-off (DSP-01 "Close orders"): the API then refuses orders for it
  const orderWindow = useQuery<OrderWindow>(outletId ? `store-window:${runDate}` : null, async c =>
    valueOf<OrderWindow>(await c.fn('Orders', null, 'OrderWindow', { runDate })), { refreshOn: ['order_window'] });
  const dispatchClosed = orderWindow.data?.closed === true;

  const draftNow = (): OrderDraft | null =>
    outletId && outlet.data ? { outletId, brand: outlet.data.brand, runDate, dry: dryLines, chilled: chilledLines, ratio, savedAt: Date.now(), sent } : null;
  const edited = dry !== null || chilled !== null;
  useEffect(() => {
    if (!edited || !outletId || !outlet.data) return;
    saveOrderDraft({ outletId, brand: outlet.data.brand, runDate, dry: dry ?? toLines(lastDry), chilled: chilled ?? toLines(lastChilled), ratio, savedAt: Date.now(), sent });
  }, [edited, outletId, outlet.data, runDate, dry, chilled, lastDry, lastChilled, ratio, sent]);

  const submit = useAction<void, Order[]>(async c => {
    const draft = draftNow();
    if (!draft) throw new Error('Your outlet could not be loaded.');
    const created = await sendOrderDraft(c, draft, (tempClass, order) => {
      // remember each class that went through, so a retry after a failure never sends it twice
      setSent(s => ({ ...s, [tempClass]: order.id }));
      draft.sent = { ...draft.sent, [tempClass]: order.id };
    }).catch(e => {
      if (isUnreachable(e)) saveOrderDraft({ ...draft, savedAt: Date.now() });
      throw e;
    });
    if (!created.length) {
      // an earlier submit already sent every class with items (the draft remembers it): go on to the history
      const done = Object.values(draft.sent ?? {}).filter((id): id is string => Boolean(id));
      if (done.length) return done.map(id => ({ id, runDate: draft.runDate }) as Order);
      throw new Error('Add at least one item with a quantity.');
    }
    return created;
  }, {
    onSuccess: created => {
      clearOrderDraft(outletId);
      nav.notify(`Received: ${created.map(o => o.id).join(', ')}`);
      // the API moved an order placed after the cutoff to a later run: say so before moving on
      if (created.some(o => isoDay(o.runDate) !== runDate)) setMoved(created);
      else router.push('/store/sm-27-orders-and-history');
    },
  });

  // the server is not there: SM-36 keeps the draft and sends it when the server answers
  useEffect(() => {
    if (isUnreachable(submit.error)) router.push(`${SERVICE_UNAVAILABLE}?from=${encodeURIComponent('/store/sm-01-place-order')}`);
  }, [submit.error, router]);

  const o = outlet.data;
  const h = Math.max(0, Math.floor(msLeft / 3_600_000));
  const m = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));

  return (
    <div className="frame frame--desktop mode-store" data-name="SM-01 Place order · desktop">
      <div className="s-shell">
        <StoreTop active="order" />
        <div className="d-main" style={{ paddingBottom: '20px' }}>
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {"New order "}
                {o && <><span className="m-sep" />{` ${depotName(o.depot)} run `}</>}
                <span className="m-sep" />{startFrom ? ` started from last ${weekday(startFrom.runDate)}` : ' first order'}
              </div>
              <div className="d-h1">Order for {fmtRunDate(runDate)}</div>
              <div className="d-sub">
                {o ? `Delivered before your ${clock(o.windowClose)} opening · window ${o.windowOpen}–${o.windowClose} · ${o.dockType.toLowerCase().replace('_', ' ')}, ${o.parking.toLowerCase().replace('_', ' ')} access · ` : ''}
                {"delivery date "}
                {/* the browser's own date box sizes and draws its icon differently everywhere: show the date and our
                    calendar icon, with the real input laid transparently over both so a click anywhere opens the picker */}
                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--brand-600)', fontWeight: 700, cursor: 'pointer', verticalAlign: 'bottom' }}>
                  <span data-testid="delivery-date">{fmtRunDate(runDate)}</span>
                  <Ic n="calendar" className="ic ic--sm" />
                  <input type="date" aria-label="Delivery date" value={runDate} min={tomorrow} onChange={e => setRunDate(e.target.value || next.runDate)}
                    onClick={e => { try { e.currentTarget.showPicker?.(); } catch { /* already open, or not allowed */ } }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 }} />
                </label>
              </div>
            </div>
            <div className="vstack" style={{ gap: '2px', alignItems: 'flex-end', marginRight: '4px' }}>
              <span className="fw7" style={{ fontSize: '14px', color: 'var(--text)' }} data-testid="order-summary">
                {orders} order{orders === 1 ? '' : 's'} · {itemsLabel} · {d.units + ch.units} units · {fmtNum(d.kg + ch.kg)} kg · {fmtNum((d.kg + ch.kg) * ratio, 1)} m³
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{"\"Received\" with order numbers at once"}</span>
            </div>
            <Btn className="d-btn d-btn--primary" style={{ padding: '0 20px' }} testId="submit-order" busy={submit.pending} disabled={!orders || !o || Boolean(moved) || closedDay || dispatchClosed} onClick={() => void submit.run()}>
              <Ic n="send" />Submit {orders} order{orders === 1 ? '' : 's'}{items ? ` · ${itemsLabel}` : ''}
            </Btn>
          </div>
          <ErrorBanner error={submit.error ?? history.error ?? outlet.error} onRetry={history.error ? history.refresh : undefined} />
          {dispatchClosed && (
            <div className="lv-banner lv-banner--warn" role="status" data-testid="orders-closed">
              <Ic n="lock" />
              <div className="lv-banner__txt">
                <b>Orders closed for the {fmtRunDate(runDate)} run</b>
                <span>Dispatch closed this run{orderWindow.data?.reason ? ` (${orderWindow.data.reason})` : ''}. Pick a later delivery date, or call the depot for anything urgent.</span>
              </div>
            </div>
          )}
          {moved && (
            <div className="lv-banner lv-banner--warn" role="status" data-testid="order-moved">
              <Ic n="clock" />
              <div className="lv-banner__txt">
                <b>Received: {moved.map(x => `${x.id} for ${fmtRunDate(x.runDate)}`).join(', ')}</b>
                <span>{moved.find(x => x.notes)?.notes}</span>
              </div>
              <Btn className="d-btn d-btn--ghost lv-btn" onClick={() => router.push('/store/sm-27-orders-and-history')}>{"See your orders"}</Btn>
            </div>
          )}
          <div className="d-kpis">
            <div className="d-kpi d-kpi--hero" style={{ flex: '1.75', gap: '8px' }}>
              <div className="between"><span className="d-kpi__l"><Ic n="clock" className="ic ic--sm" />{`Orders close at ${CUTOFF_LABEL}`}</span><span className="d-kpi__l">for the {fmtRunDate(runDate)} run</span></div>
              <span className="d-kpi__v cd__v">{late ? 'Closed' : `${h} h ${m} m`}<small>{late ? '' : 'left'}</small></span>
              <div className="m-progress cd__bar"><div style={{ width: `${late ? 100 : Math.max(0, Math.min(100, 100 - (msLeft / 86_400_000) * 100))}%` }} /></div>
              <span className="d-kpi__s">{late ? <>This run is closed. Submit now and the order goes to the next open run, <b style={{ color: '#FFFFFF' }}>{fmtRunDate(next.runDate)}</b>.</> : <>After {CUTOFF_LABEL} this order goes to the <b style={{ color: '#FFFFFF' }}>{fmtRunDate(nextOpenDay(addDays(runDate, 1), next.closed))} run</b></>}</span>
            </div>
            <div className="d-kpi">
              <span className="d-kpi__l"><span className="m-tag"><span className="dot" />{"Dry order"}</span><span className="m-sep" />{dryLines.length} lines</span>
              <span className="d-kpi__v">{d.units}<small>{"units"}</small></span>
              <span className="d-kpi__s">{fmtNum(d.kg)} kg · {fmtNum(d.kg * ratio, 1)} m³ · every operating day</span>
            </div>
            <div className="d-kpi">
              <span className="d-kpi__l"><span className="m-tag m-tag--cold"><Ic n="snow" />{"Chilled order"}</span><span className="m-sep" />{chilledLines.length} lines</span>
              <span className="d-kpi__v">{ch.units}<small>{"units"}</small></span>
              <span className="d-kpi__s">{fmtNum(ch.kg)} kg · {fmtNum(ch.kg * ratio, 1)} m³ · travels in a reefer</span>
            </div>
            {closedDay ? (
              <div className="d-kpi d-kpi--fest" data-testid="closed-day"><span className="d-kpi__l">{calendar.data?.festivalName ?? 'Calendar'}</span><span className="d-kpi__v">{"Closed"}</span><span className="d-kpi__s">No run on this date. The next operating day is {fmtRunDate(nextOpenDay(addDays(runDate, 1), next.closed))}.</span></div>
            ) : calendar.data?.festivalName ? (
              <div className="d-kpi d-kpi--fest">
                <span className="d-kpi__l"><Ic n="sparkle" className="ic ic--sm" />{calendar.data.festivalName}</span>
                <span className="d-kpi__v">{calendar.data.festivalRamp ? `+${Math.round(calendar.data.festivalRamp * 100)}%` : '—'}</span>
                <span className="d-kpi__s">{"Festival ramp on the operating calendar."}</span>
              </div>
            ) : null}
          </div>
          {!history.data && !history.error ? <Skeleton rows={4} /> : (
            <div className="hstack" style={{ gap: '16px', alignItems: 'stretch', flex: '1', minHeight: '0' }}>
              <LineTable title="Dry order" cls="" lines={dryLines} setLines={setDry} note="every operating day" tempClass="AMBIENT" lastLabel={lastLabel} />
              <LineTable title="Chilled order" cls="m-tag--cold" lines={chilledLines} setLines={setChilled} note="needs a reefer" tempClass="CHILLED" lastLabel={lastLabel} />
            </div>
          )}
          {lastDry && <span className="t-3" style={{ fontSize: '12.5px' }}>Started from {lastDry.id}{lastChilled ? ` and ${lastChilled.id}` : ''} ({fmtRunDate(isoDay(lastDry.runDate))}).</span>}
        </div>
      </div>
    </div>
  );
}
