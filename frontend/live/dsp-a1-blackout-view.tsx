'use client';
// DSP-A1 Blackout view, live. Markup and classes from the generated design (frontend/screens/dsp-a1-blackout-view.tsx).
// Data: the run date's trips in the depots in view (stops with ETA, late risk and service minutes, the outlet's
// window, the vehicle and driver) and each trip's signal state (components/live/degradation.tsx): a trip whose
// latest signal event is a loss is shown as predicted, never as on time. The hero card and the trip's row open
// DSP-A1b (provisional deferral) for its riskiest open stop. "Send SMS to driver" and "Warn stores" send
// Lodestar notices (Notifications/Lodestar.Send); "Call" dials the driver's phone from the directory.
// The design's hill-corridor map is not drawn: there are no GPS pings or learned signal-loss zones to plot.
import { useState } from 'react';
import { useScreenNav } from '@/components/ScreenShell';
import Btn from '@/components/live/Btn';
import { PlanSide } from '@/components/live/chrome';
import {
  minutesSince, openStops, riskiestStop, sendNotice, skipAfter, useDriver, useRunTrips, useSignal, useStoreManagers, type SignalEvent,
} from '@/components/live/degradation';
import { Ic } from '@/components/live/icons';
import { usePlanScope, runStamp } from '@/components/live/plan-data';
import { Empty, ErrorBanner, Skeleton } from '@/components/live/states';
import { fmtClock, fmtNum, fmtTime, title } from '@/lib/format';
import { useAction } from '@/lib/odata/hooks';
import type { Trip, TripStop } from '@/lib/odata/types';
import { useFocusId } from '@/lib/workday';
import { useDepots } from '@/components/live/depots';

const vehicleKind = (t: Trip) => (t.vehicle ? `${t.vehicle.tempClass === 'CHILLED' ? 'Reefer' : 'Dry'} ${t.vehicle.type === 'VAN' ? 'van' : 'truck'}` : 'Vehicle');
const riskColor = (p: number) => (p >= 50 ? '#D92D20' : p >= 30 ? '#F5B83D' : '#10B981');
const lastActual = (t: Trip) =>
  (t.stops ?? []).flatMap(s => [s.arrivalActual, s.leaveActual]).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))).at(-1) ?? (t.status !== 'PLANNED' ? t.departTime : null);

/** The trips table (also drawn, dimmed, behind DSP-A1b). */
export function TripsTable({ trips, signal, onOpen, compact }: { trips: Trip[]; signal: Map<string, SignalEvent>; onOpen?: (t: Trip) => void; compact?: boolean }) {
  const { name: depotName } = useDepots();
  return (
    <div className="d-table">
      <div className="d-tr d-tr--head">
        <span className="d-td" style={{ width: compact ? '140px' : '160px' }}>{"Vehicle · route"}</span>
        <span className="d-td" style={{ width: compact ? '180px' : '170px' }}>{"Status"}</span>
        <span className="d-td" style={{ width: compact ? '88px' : '86px' }}>{"Last ping"}</span>
        <span className="d-td" style={{ width: '50px' }}>{"Stops"}</span>
        {!compact && <span className="d-td" style={{ width: '90px' }}>{"Next stop"}</span>}
        <span className="d-td" style={{ flex: '1' }}>{"Late risk"}</span>
      </div>
      {trips.map(t => {
        const lost = signal.get(t.id)?.lost ? signal.get(t.id)! : null;
        const stops = t.stops ?? [];
        const done = stops.filter(s => s.status === 'DELIVERED').length;
        const next = openStops(t)[0];
        const risk = riskiestStop(t)?.lateRiskPct ?? null;
        const ping = lost ? `${fmtClock(lost.at)} · ${minutesSince(lost.at)}m` : fmtClock(lastActual(t));
        return (
          <div key={t.id} className={`d-tr${lost ? ' g-dash-row' : ''}`} data-trip={t.id} {...(lost && onOpen ? { 'data-lk': 'L46', onClickCapture: () => onOpen(t) } : {})}>
            <span className="d-td" style={{ width: compact ? '140px' : '160px' }}><b className="id">{t.vehicleId}</b>{" "}<span className="t-3">{t.district}</span></span>
            <span className="d-td" style={{ width: compact ? '180px' : '170px' }}>
              {lost ? <span className="m-pill m-pill--offline" style={{ height: '26px' }}>{"Unknown · predicted"}</span>
                : t.status === 'COMPLETE' ? <span className="m-tag m-tag--ok"><span className="dot" />Trip {t.tripNumber} done</span>
                : t.status === 'ENROUTE' ? <span className="m-tag m-tag--info"><span className="dot" />{"En route"}</span>
                : <span className="m-tag m-tag--brand"><span className="dot" />{title(t.status)}</span>}
            </span>
            <span className={`d-td${lost ? ' g-muted' : ''}`} style={{ width: compact ? '88px' : '86px' }}>{ping}</span>
            <span className="d-td" style={{ width: '50px' }}>{done}/{stops.length}</span>
            {!compact && <span className={`d-td${next ? ' id' : ''}`} style={{ width: '90px' }}>{next ? next.outletId : depotName(t.depot)}</span>}
            {risk === null || t.status === 'COMPLETE' ? (
              <span className="d-td t-3" style={{ flex: '1' }}>{"·"}</span>
            ) : (
              <span className="d-td hstack" style={{ flex: '1', gap: '10px' }}>
                {!compact && <span className="g-mini"><div style={{ width: `${risk}%`, background: riskColor(risk) }} /></span>}
                {lost ? <b style={{ color: 'var(--st-exception-fg)' }}>{risk}%</b> : `${risk}%`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The blackout hero for one silent trip. */
export function BlackoutHero({ trip, lost, stop, onOpen }: { trip: Trip; lost: SignalEvent; stop?: TripStop; onOpen?: () => void }) {
  const mins = minutesSince(lost.at);
  const chilled = stop?.order?.tempClass === 'CHILLED';
  return (
    <div className="g-dhero" data-p="1" {...(onOpen ? { 'data-lk': 'L25', onClickCapture: onOpen } : {})} data-testid="blackout-hero">
      <div className="g-dhero__a">
        <div className="hstack" style={{ gap: '10px' }}>
          <div className="d-eyebrow" style={{ whiteSpace: 'nowrap' }}>
            <Ic n="van" className="ic ic--sm" /><span className="id">{trip.vehicleId}</span><span className="m-sep" />{` ${vehicleKind(trip)} `}
            {trip.driver?.name && <><span className="m-sep" />{` ${trip.driver.name}`}</>}
          </div>
          <div className="spacer" />
          <span className="m-pill m-pill--offline"><Ic n="wifi-off" className="ic ic--sm" />{"Predicted, not live"}</span>
        </div>
        <div className="g-dhero__v">Unknown since {fmtClock(lost.at)}</div>
        <span className="d-sub">
          Last seen{lost.location ? ` at ${lost.location}` : ''}, {mins} min without a ping.{lost.note ? ` ${lost.note}.` : ''} The {trip.vehicle?.type === 'TRUCK' ? 'truck' : 'van'} is on Trip {trip.tripNumber} to {trip.district}.
        </span>
      </div>
      {stop && stop.lateRiskPct !== null && stop.lateRiskPct !== undefined && (
        <div className="g-dhero__b" data-p="3">
          <span className="g-lbl"><span className="id">{stop.outletId}</span>{` late risk${chilled ? ' · chilled' : ''}${stop.outlet?.windowClose ? `, window closes ${stop.outlet.windowClose}` : ''}`}</span>
          <div className="g-risk">{stop.lateRiskPct}%</div>
          <div className="g-bar"><div style={{ width: `${stop.lateRiskPct}%`, background: 'linear-gradient(90deg,#F04438,#B42318)' }} /></div>
          <span style={{ fontSize: '13px', lineHeight: '1.45', color: 'var(--text-2)' }}>{"Rising because we can't hear from the van, not because it's known to be late."}</span>
        </div>
      )}
    </div>
  );
}

function Panel({ trip, lost }: { trip: Trip; lost: SignalEvent }) {
  const { name: depotName } = useDepots();
  const nav = useScreenNav();
  const driver = useDriver(trip.driverId);
  const open = openStops(trip);
  const managers = useStoreManagers(open.map(s => s.outletId));
  const stop = riskiestStop(trip);
  const stops = [...(trip.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq);
  const orders = stops.map(s => s.order).filter(Boolean);
  const kg = orders.reduce((n, o) => n + (o?.kg ?? 0), 0);
  const m3 = orders.reduce((n, o) => n + (o?.m3 ?? 0), 0);
  const last = open.at(-1);
  const end = last?.etaModel ? new Date(new Date(last.etaModel).getTime() + (last.serviceMinPredicted ?? 0) * 60_000).toISOString() : null;
  const skip = skipAfter(stop?.outlet?.windowClose);
  const [sent, setSent] = useState<{ sms?: string; stores?: string }>({});

  const sms = useAction<void, unknown>(
    c => sendNotice(c, {
      recipientId: trip.driverId!,
      tripId: trip.id,
      payload: { title: 'Message from dispatch', message: stop && skip ? `Skip ${stop.outletId} if after ${skip}` : 'Call dispatch when you have signal', vehicleId: trip.vehicleId },
    }),
    { onSuccess: () => { setSent(s => ({ ...s, sms: fmtTime(new Date()) })); nav.notify(`Sent to ${trip.driver?.name ?? 'the driver'}: it is delivered when the phone has signal.`); } },
  );
  const warn = useAction<void, unknown>(
    async c => {
      for (const m of managers.data ?? []) {
        const s = open.find(x => x.outletId === m.outletId);
        await sendNotice(c, {
          recipientId: m.id,
          tripId: trip.id,
          outletId: m.outletId ?? undefined,
          payload: {
            title: s?.order?.tempClass === 'CHILLED' ? 'Chilled order may arrive late' : 'Order may arrive late',
            message: 'The van is in a low-signal area. This is not a cancellation.',
            orderId: s?.orderId, outletId: m.outletId, vehicleId: trip.vehicleId,
          },
        });
      }
    },
    { onSuccess: () => { setSent(s => ({ ...s, stores: fmtTime(new Date()) })); nav.notify(`${managers.data?.length ?? 0} store${managers.data?.length === 1 ? '' : 's'} warned: possible delay.`); } },
  );
  const phone = driver.data?.phone;
  const firstName = (trip.driver?.name ?? driver.data?.name ?? '').split(' ')[0];

  return (
    <div className="d-panel">
      <div className="d-card" style={{ flex: '1' }} data-testid="blackout-panel">
        <div className="d-card__head" style={{ minHeight: '64px', paddingTop: '6px' }}>
          <div className="m-row__lead g-lead--off" style={{ width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--st-offline-bd)', color: 'var(--st-offline-fg)' }}><Ic n="van" /></div>
          <div className="vstack" style={{ gap: '1px', flex: '1', minWidth: '0' }}>
            <span className="d-card__title"><span className="id">{trip.vehicleId}</span>{` · ${vehicleKind(trip)}`}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Trip {trip.tripNumber} · {title(trip.brand)} · {trip.district}</span>
          </div>
          <span className="m-pill m-pill--offline" style={{ height: '26px' }}>{"Unknown"}</span>
        </div>
        <div className="g-sect" data-p="2">
          <span className="g-lbl">{"Confirmed"}</span>
          {trip.loadRecord?.loadedAt && (
            <div className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{fmtClock(trip.loadRecord.loadedAt)}</b>{` Loaded · ${orders.length} order${orders.length === 1 ? '' : 's'} · ${fmtNum(kg)} kg · ${fmtNum(m3, 1)} m³`}</span></div>
          )}
          {trip.departTime && <div className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{fmtClock(trip.departTime)}</b>{` Departed ${depotName(trip.depot)}`}</span></div>}
          {stops.filter(s => s.arrivalActual).map(s => (
            <div key={s.id} className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{fmtClock(s.arrivalActual)}</b>{' At '}<span className="id">{s.outletId}</span>{s.status === 'DELIVERED' ? ' · delivered' : ''}</span></div>
          ))}
          <div className="g-li"><span className="g-mark g-mark--ok"><Ic n="check" /></span><span><b>{fmtClock(lost.at)}</b>{` Last ping${lost.location ? ` at ${lost.location}` : ''}${trip.reeferTempC !== null && trip.reeferTempC !== undefined ? ` · reefer ${trip.reeferTempC} °C` : ''}`}</span></div>
        </div>
        {open.length > 0 && (
          <div className="g-sect g-sect--pred">
            <span className="g-lbl">{"Predicted · not confirmed"}</span>
            {open.map((s, i) => (
              <div key={s.id} className="g-li">
                <span className="g-mark g-mark--pred" />
                <span className="t-2">
                  <b style={{ color: 'var(--text)' }}>{s.etaModel ? `~${fmtClock(s.etaModel)}` : s.etaPlan ? fmtClock(s.etaPlan) : '—'}</b>
                  {i === 0 && s.serviceMinPredicted ? <>{' At '}<span className="id">{s.outletId}</span>{`, on site (service ${s.serviceMinPredicted} min predicted)`}</> : <>{' Arrive '}<span className="id">{s.outletId}</span>{s.outlet?.windowClose ? ` · window closes ${s.outlet.windowClose}` : ''}</>}
                </span>
              </div>
            ))}
            {end && <div className="g-li"><span className="g-mark g-mark--pred" /><span className="t-2"><b style={{ color: 'var(--text)' }}>~{fmtClock(end)}</b>{` Trip ${trip.tripNumber} done · ${stops.length} stop${stops.length === 1 ? '' : 's'}, ${orders.length} order${orders.length === 1 ? '' : 's'}`}</span></div>}
            {open[0]?.etaPlan && <span style={{ fontSize: '13px', lineHeight: '1.45', color: 'var(--text-3)' }}>Plan {fmtClock(open[0].etaPlan)}{open[0].etaModel ? ` · model ~${fmtClock(open[0].etaModel)}` : ''}.</span>}
          </div>
        )}
        <div className="g-sect" data-p="4" style={{ gap: '8px' }}>
          <span className="g-lbl">{"Act without the van's data link"}</span>
          <ErrorBanner compact error={sms.error ?? warn.error ?? managers.error} />
          <Btn className="d-btn d-btn--primary" style={{ height: '44px' }} testId="send-sms" busy={sms.pending} disabled={!trip.driverId} onClick={() => void sms.run()}
            title={trip.driverId ? undefined : 'No driver on this trip'}>
            <Ic n="message" />{sent.sms ? `Sent to driver ${sent.sms}` : 'Send SMS to driver'}
          </Btn>
          {phone ? (
            <a className="d-btn" href={`tel:${phone}`} onClick={e => e.stopPropagation()} data-testid="call-driver"><Ic n="call" />Call {firstName || 'driver'}</a>
          ) : (
            <Btn className="d-btn" disabled onClick={() => undefined} title="No phone number in the directory"><Ic n="call" />Call {firstName || 'driver'}</Btn>
          )}
          <Btn className="d-btn" testId="warn-stores" busy={warn.pending} disabled={!managers.data?.length} onClick={() => void warn.run()}>
            <Ic n="bell" />{sent.stores ? `Stores warned ${sent.stores}` : 'Warn stores: possible delay'}
          </Btn>
        </div>
        <div className="spacer" />
        <div style={{ padding: '0 18px 18px' }}>
          <div className="g-note-d" style={{ background: 'var(--tint-brand)', color: 'var(--brand-700)' }}>
            <Ic n="shield-check" className="ic ic--sm" />
            <span><b>{"Honesty rule:"}</b>{" Lodestar never shows \"on time\" for a vehicle it can't hear from. Predictions stay dashed until a real ping confirms them."}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Trips and signal state for the P5 blackout screens; `focus` picks the silent trip to show. */
export function useBlackout() {
  const scope = usePlanScope();
  const trips = useRunTrips(scope.tripsFilter);
  const signal = useSignal(trips.data);
  const [focusTrip, setFocusTrip] = useFocusId('trip');
  const [, setFocusOrder] = useFocusId('order');
  const all = trips.data ?? [];
  const silent = all.filter(t => signal.byTrip.get(t.id)?.lost);
  const trip = silent.find(t => t.id === focusTrip) ?? silent[0];
  const rows = [...silent, ...all.filter(t => !silent.includes(t) && t.status !== 'PLANNED')].slice(0, 12);
  const open = (t: Trip) => {
    setFocusTrip(t.id);
    setFocusOrder(riskiestStop(t)?.orderId ?? null);
  };
  return { scope, trips, signal, silent, trip, rows, open };
}

export default function LiveDspA1BlackoutView() {
  const { name: depotName } = useDepots();
  const { scope, trips, signal, silent, trip, rows, open } = useBlackout();
  const { runDate, active, depots, depot, setDepot } = scope;
  const all = trips.data ?? [];
  const onRoad = all.filter(t => t.status === 'ENROUTE');
  const stops = all.flatMap(t => t.stops ?? []);
  const lost = trip ? signal.byTrip.get(trip.id)! : null;

  return (
    <div className="frame frame--desktop mode-dispatcher" data-name="DSP-A1 Blackout view">
      <div className="d-app">
        <PlanSide active="N4" />
        <div className="d-main">
          <div className="d-head">
            <div className="d-head__txt">
              <div className="d-eyebrow">
                {active.length > 1 ? 'Both depots ' : `${depotName(active[0])} `}<span className="m-sep" />
                {` ${runStamp(runDate, ', ')} `}<span className="m-sep" />
                {` ${onRoad.length} on the road · ${onRoad.length - silent.filter(t => t.status === 'ENROUTE').length} reporting live · ${stops.filter(s => s.status === 'DELIVERED').length} of ${stops.length} stops confirmed`}
              </div>
              <div className="d-h1">{"Live operations"}</div>
            </div>
            {depots.length > 1 && (
              <div className="d-toolbar">
                {[null, ...depots].map(d => (
                  <span key={d ?? 'all'} className={`d-filter lv-click${depot === d ? ' is-on' : ''}`} role="button" tabIndex={0}
                    onClick={e => { e.stopPropagation(); setDepot(d); }} onKeyDown={e => { if (e.key === 'Enter') setDepot(d); }}>
                    {d ? depotName(d) : 'All depots'}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ErrorBanner error={trips.error ?? signal.error} onRetry={() => { void trips.refresh(); void signal.refresh(); }} />
          {!trips.data && !trips.error ? <Skeleton rows={4} /> : (
            <div className="d-split">
              <div className="vstack" style={{ gap: '16px', flex: '1', minWidth: '0' }}>
                {trip && lost ? (
                  <BlackoutHero trip={trip} lost={lost} stop={riskiestStop(trip)} onOpen={() => open(trip)} />
                ) : (
                  <Empty icon="wifi" title="Every vehicle is reporting" text="When a vehicle goes quiet it shows here as predicted, never as on time." />
                )}
                <div className="d-card" style={{ flex: '1' }}>
                  {rows.length ? <TripsTable trips={rows} signal={signal.byTrip} onOpen={open} /> : <Empty title="No trips on the road" text="No trip of this run date has left the depot yet." icon="navigate" />}
                </div>
              </div>
              {trip && lost && <Panel trip={trip} lost={lost} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
