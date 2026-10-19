'use client';
// DSP-A1b Provisional deferral, live. Markup and classes from the generated design
// (frontend/screens/dsp-a1b-provisional-deferral.tsx): the blackout view, dimmed, under a drawer.
// The order is the one DSP-A1 opened (focus 'order', else the riskiest open stop of the silent trip). Confirming
// creates a provisional deferral (POST Deferrals {isProvisional: true, reason, rescheduledDate, notes}), tells the
// order's store "at risk" and the driver "skip it if after …" (Notifications/Lodestar.Send). When the vehicle
// syncs, a delivery record for the order reverses the provisional deferral (backend/apps/sync: field evidence
// wins). A protected order (deferred on the previous run) is never deferred: the API refuses, and so does this.
// The design's "1.1 m³ held on VEH058" is not shown: the planner has no capacity hold on a later run.
import { useState } from 'react';
import { useScreenNav } from '@/components/ScreenShell';
import { runStamp } from '@/components/live/plan-data';
import Btn from '@/components/live/Btn';
import { PlanSide } from '@/components/live/chrome';
import { riskiestStop, sendNotice, skipAfter, useNextRunDay, useStoreManagers } from '@/components/live/degradation';
import { Ic } from '@/components/live/icons';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { fmtClock, fmtNum, fmtRunDate } from '@/lib/format';
import { useAction } from '@/lib/odata/hooks';
import type { Deferral, DeferralReason } from '@/lib/odata/types';
import { useFocusId } from '@/lib/workday';
import { BlackoutHero, TripsTable, useBlackout } from './dsp-a1-blackout-view';
import { useDepots } from '@/components/live/depots';

const REASONS: Array<[DeferralReason, string]> = [
  ['CAP_TIME', 'Fresh window at risk'],
  ['WINDOW', 'Arrival misses the window'],
  ['CAP_REEFER', 'Not enough reefer space'],
  ['ACCESS', "Vehicle can't reach the outlet"],
  ['FUEL', 'Weekly fuel quota exceeded'],
  ['VEH_DOWN', 'Vehicle failed or in workshop'],
];
const code = (r: string) => r.replace('_', '-');

export default function LiveDspA1bProvisionalDeferral() {
  const { name: depotName } = useDepots();
  const nav = useScreenNav();
  const { scope, trips, signal, trip, rows } = useBlackout();
  const [orderId] = useFocusId('order');
  const lost = trip ? signal.byTrip.get(trip.id) : undefined;
  const stop = trip ? (trip.stops ?? []).find(s => s.orderId === orderId && s.status !== 'DELIVERED') ?? riskiestStop(trip) : undefined;
  const order = stop?.order;
  const next = useNextRunDay(scope.runDate);
  const managers = useStoreManagers(stop ? [stop.outletId] : []);
  const [reason, setReason] = useState<DeferralReason>('CAP_TIME');
  const [to, setTo] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const deferTo = to ?? next ?? '';
  const skip = skipAfter(stop?.outlet?.windowClose);
  const note = notes ?? (lost ? `Vehicle unreachable since ${fmtClock(lost.at)}.${order?.tempClass === 'CHILLED' && stop?.outlet?.windowClose ? ` Chilled goods must not miss the ${stop.outlet.windowClose} window.` : ''}` : '');
  const chilled = order?.tempClass === 'CHILLED';
  const storeTitle = chilled ? 'Chilled order may arrive late' : 'Order may arrive late';
  const storeText = `The van is in a low-signal area. We've held a ${deferTo ? fmtRunDate(deferTo) : 'later'} slot just in case.`;

  const make = useAction<void, Deferral>(
    async c => {
      const d = await c.create<Deferral>('Deferrals', {
        orderId: stop!.orderId, reason, notes: note.trim() || null, rescheduledDate: deferTo ? `${deferTo}T00:00:00.000Z` : null, isProvisional: true,
      });
      for (const m of managers.data ?? []) {
        await sendNotice(c, {
          recipientId: m.id, tripId: trip!.id, outletId: stop!.outletId,
          payload: { title: storeTitle, message: `${storeText} This is not a cancellation.`, orderId: stop!.orderId, outletId: stop!.outletId, rescheduledDate: deferTo },
        });
      }
      if (trip!.driverId && skip) {
        await sendNotice(c, { recipientId: trip!.driverId, tripId: trip!.id, payload: { title: 'Message from dispatch', message: `Skip ${stop!.outletId} if after ${skip}`, orderId: stop!.orderId } });
      }
      return d;
    },
    { onSuccess: () => { nav.go('L26'); } },
  );

  const done = Boolean(make.data);
  const blocked = Boolean(order?.deferredYesterday);

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-A1b Provisional deferral">
      <div className="d-app">
        <PlanSide active="N4" />
        <div className="g-dim" aria-hidden>
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {scope.active.length > 1 ? 'Both depots ' : `${depotName(scope.active[0])} `}<span className="m-sep" />
                {` ${runStamp(scope.runDate, ', ')} `}
              </div>
              <div className="d-h1">{"Live operations"}</div>
            </div>
          </div>
          {trip && lost && <BlackoutHero trip={trip} lost={lost} stop={stop} />}
          {rows.length > 0 && <div className="d-card"><TripsTable trips={rows.slice(0, 5)} signal={signal.byTrip} compact /></div>}
        </div>
        <div className="g-drawer" role="dialog" aria-label="Provisional deferral" data-testid="provisional-drawer">
          {!trips.data && !trips.error ? <Skeleton rows={4} /> : !trip || !lost || !stop ? (
            <div className="vstack" style={{ gap: '12px', padding: '18px 26px' }}>
              <div className="hstack" style={{ gap: '10px' }}>
                <div className="spacer" />
                <div className="m-iconbtn" style={{ width: '34px', height: '34px', background: '#F4F5F9', boxShadow: 'none' }} data-lk="C"><Ic n="x" /></div>
              </div>
              <ErrorBanner error={trips.error ?? signal.error} onRetry={() => void trips.refresh()} />
              <Empty icon="wifi" title="No silent vehicle" text="Every vehicle is reporting: there is no order to defer provisionally." />
            </div>
          ) : (
            <>
              <div className="vstack" style={{ gap: '6px', padding: '18px 26px 12px' }} data-p="1">
                <div className="hstack" style={{ gap: '10px' }}>
                  <span className="m-tag m-tag--warn"><Ic n="clock" />{"Defer order · vehicle unreachable"}</span>
                  <div className="spacer" />
                  <div className="m-iconbtn" style={{ width: '34px', height: '34px', background: '#F4F5F9', boxShadow: 'none' }} data-lk="C"><Ic n="x" /></div>
                </div>
                <div className="d-h1" style={{ fontSize: '26px' }}>{"Defer "}<span className="id">{stop.orderId}</span>{` to ${deferTo ? fmtRunDate(deferTo) : '…'}?`}</div>
                <div className="hstack" style={{ gap: '10px', fontSize: '14px', color: 'var(--text-2)' }}>
                  <span><span className="id">{stop.outletId}</span>{` ${stop.outlet?.name ?? ''}${order ? ` · ${order.units} units · ${fmtNum(order.kg)} kg · ${fmtNum(order.m3, 1)} m³` : ''}`}</span>
                  {order && <span className={`m-tag ${chilled ? 'm-tag--cold' : 'm-tag--brand'}`}><Ic n={chilled ? 'snow' : 'box'} />{chilled ? 'Chilled' : 'Ambient'}</span>}
                </div>
              </div>
              <div style={{ padding: '0 26px' }}>
                <div className="vstack" style={{ gap: '6px', padding: '16px 18px', borderRadius: '18px', background: '#FFFBF3', border: '1.5px dashed var(--st-deferred-bd)' }}>
                  <span className="hstack" style={{ gap: '8px', fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '800', color: 'var(--st-deferred-fg)' }}><Ic n="clock" />{"This will be provisional"}</span>
                  <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text)' }}>
                    {`${trip.vehicleId} is offline and this order may already be delivered: it is predicted at `}<span className="id">{stop.outletId}</span>
                    {`${stop.etaModel ? ` ~${fmtClock(stop.etaModel)}` : ''}. The deferral stays provisional until ${trip.vehicleId} syncs. If a delivery record arrives, it wins, and you'll be asked to confirm the undo.`}
                  </span>
                  <span className="hstack" style={{ gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                    <span className="m-pill m-pill--offline" style={{ height: '24px', fontSize: '12px' }}>On {trip.vehicleId} · stop {stop.stopSeq}</span>last ping {fmtClock(lost.at)}
                  </span>
                </div>
              </div>
              <div className="vstack" style={{ gap: '8px', padding: '14px 26px 0' }} data-p="2">
                <span className="g-lbl">{"What happens when you confirm"}</span>
                <div className="g-li"><span className="g-mark g-mark--n">{"1"}</span><span><b>{`${stop.outletId} told "at risk"`}</b>{', not "cancelled" (preview below)'}</span></div>
                {trip.driverId && skip && <div className="g-li"><span className="g-mark g-mark--n">{"2"}</span><span><b>SMS to {trip.driver?.name?.split(' ')[0] ?? 'the driver'}:</b>{` "Skip ${stop.outletId} if after ${skip}" · delivery tracked`}</span></div>}
                <div className="g-li"><span className="g-mark g-mark--n">{trip.driverId && skip ? '3' : '2'}</span><span><b>When {trip.vehicleId} syncs</b>{", its records are checked against this first"}</span></div>
              </div>
              <div className="vstack" style={{ gap: '8px', padding: '14px 26px 0' }} data-p="3">
                <div className="hstack" style={{ gap: '10px', alignItems: 'flex-start' }}>
                  <label className="g-field" style={{ flex: '1' }}>
                    <span>{"Reason code"}</span>
                    <select className="g-input lv-input" value={reason} onChange={e => setReason(e.target.value as DeferralReason)} data-testid="reason">
                      {REASONS.map(([r, l]) => <option key={r} value={r}>{`${code(r)} · ${l}`}</option>)}
                    </select>
                  </label>
                  <label className="g-field" style={{ width: '160px' }}>
                    <span>{"Defer to"}</span>
                    <input className="g-input lv-input" type="date" value={deferTo} min={next} onChange={e => setTo(e.target.value)} data-testid="defer-to" />
                  </label>
                </div>
                <textarea className="g-input lv-input" style={{ height: 'auto', minHeight: '44px', padding: '10px 12px', color: 'var(--text-2)', resize: 'vertical' }} aria-label="Note" value={note} onChange={e => setNotes(e.target.value)} data-testid="note" />
                <div className="g-li" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  <span style={{ color: blocked ? 'var(--st-exception-fg)' : 'var(--st-delivered-fg)', display: 'flex' }}><Ic n={blocked ? 'alert' : 'check'} /></span>
                  <span>{blocked ? `${stop.outletId} was deferred yesterday: protected, it can't be deferred again` : `${stop.outletId} not deferred yesterday · counts as a skip only if confirmed`}</span>
                </div>
              </div>
              <div className="vstack" style={{ gap: '6px', padding: '12px 26px 0' }} data-p="4">
                <span className="g-lbl">{"Store will see · Lodestar Store"}</span>
                <div className="vstack" style={{ gap: '3px', padding: '12px 14px', borderRadius: '16px', background: '#F4F5F9' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '800' }}>{storeTitle}</span>
                  <span style={{ fontSize: '13px', lineHeight: '1.45', color: 'var(--text-2)' }}>{`${storeText} `}<b style={{ color: 'var(--text)' }}>{"This is not a cancellation."}</b></span>
                </div>
              </div>
              <div style={{ padding: '10px 26px 0' }}><ErrorBanner compact error={make.error ?? managers.error} /></div>
              <div className="spacer" />
              <div className="hstack" style={{ gap: '8px', padding: '14px 26px', borderTop: '1px solid var(--hair)' }}>
                <div className="d-btn d-btn--ghost" data-lk="L47">{"Cancel"}</div>
                <div className="spacer" />
                {!done && <div className="d-btn" data-lk="L48">{"Wait for the signal"}</div>}
                <Btn
                  className="d-btn d-btn--primary"
                  style={{ background: 'linear-gradient(135deg,#D97706 0%,#B45309 100%)', boxShadow: '0 6px 16px rgba(180,83,9,.28)' }}
                  testId="make-provisional"
                  busy={make.pending}
                  disabled={done || blocked || !deferTo || managers.loading}
                  onClick={() => void make.run()}
                >
                  <Ic n="clock" />{done ? 'Provisional deferral made' : 'Make provisional deferral'}
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
