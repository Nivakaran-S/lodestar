// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-01 Today's run (P4, phone)
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { firstName } from '@/auth/claims';
import { dayLabel, greeting, hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { isUnsent, today, useClaims, useOnline, useOutbox, useRun, type RunView } from '@/model/hooks';
import { movedRun, useReleasedNotice, useRunMarks, useServerEvents } from '@/model/run';
import { LATE_RISK_PCT } from '@/model/preferences';
import { finishDeliveredTrips, startTrip, tripStatusOf } from '@/model/actions';
import type { Shortfall, TripStop } from '@/model/types';
import { setSettings, type ScreenTheme } from '@/lib/settings';
import { Frame, Grad, Icon, Scroll, Tap, openScreen, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L12":{"to":"dr-36-en-route-driving-mode","kind":"go"},"L41":{"to":"dr-15-route-overview","kind":"go"},"L243":{"to":"dr-24-settings-me","kind":"go"},"N1":{"to":"dr-21-records","kind":"nav"},"N2":{"to":"dr-23-dispatch-notices","kind":"nav"}}};

/**
 * Night and daylight differ in colour (frame, icon strokes, gradient, styles), in the route card's link to their own
 * DR-15, in the theme the toggle switches to, and the night route card carries a map icon (X3 in v11) the daylight one has not.
 */
export type Dr01Theme = {
  bg: string; nav: ScreenNav; route: string; toggle: ScreenTheme; cta: GradSpec[];
  X1: string; X2: string; X3?: string; X4: string; X5: string; X6: string; X7: string; X8: string; X9: string; X10: string;
  s: Omit<Sheet<typeof s>, 'v11'> & { v11?: ViewStyle };
};
/** A style sheet with the same keys as this one: tN are text styles, vN view styles. */
type Sheet<T> = { [K in keyof T]: K extends `t${string}` ? TextStyle : ViewStyle };

type Outbox = ReturnType<typeof useOutbox>;
/** One outlet visit: its first row and every order row with the same stopSeq. */
type StopGroup = { st: TripStop; rows: TripStop[] };
type Themed = { t: Dr01Theme };

export default function ScreenDr01TodaySRun() {
  return <Dr01Body t={night} />;
}

/** The one DR-01 body, rendered by the night screen and by the daylight one with their own theme. */
export function Dr01Body({ t }: { t: Dr01Theme }) {
  const { s } = t;
  const claims = useClaims();
  const online = useOnline();
  const { view, updatedAt, fromCache, loading, error } = useRun();
  const { waiting, items } = useOutbox();
  useRunHandoffs(view, items);
  const trip = view?.trip ?? null;
  const stops = view?.tripStops ?? [];
  const groups = groupStops(stops);
  const current = view?.current ?? null;
  const shortfalls = trip?.loadRecord?.shortfalls ?? [];
  const name = firstName(claims);
  const status = runStatus(!!claims, view, loading, !!error);
  return (
    <Frame bg={t.bg} nav={t.nav} style={s.v0}>
      <View style={s.v55}>
        <RunHeader t={t} day={runDay(view)} chip={netChip(online, waiting.length)} />
        <Scroll style={s.v4} contentStyle={s.v47}>
          <View style={s.v10}>
            <View>
              <Text style={s.t9}>{name ? `${greeting()}, ${name}` : greeting()}</Text>
            </View>
            {status ? (
              <View>
                <Text style={s.t18} testID="run-status">{status}</Text>
              </View>
            ) : null}
          </View>
          <NextStopCard t={t} current={current} title={nextStopTitle(current, stops[0], !!trip)} />
          <TripStops t={t} view={view} groups={groups} current={current} waiting={waiting} />
          {shortfalls[0] ? <ShortfallCard t={t} first={shortfalls[0]} count={shortfalls.length} /> : null}
          <View style={s.v46}>
            {/* the crossed-out signal only when there is no signal: online, the run is simply saved on the phone */}
            <Icon xml={online ? savedIcon(t.X6) : t.X6} width={20} height={20} style={s.v41} />
            <View style={s.v43}>
              <View>
                <Text style={s.t45}>{savedText(waiting.length, updatedAt, fromCache, online)}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <StartTripBar t={t} view={view} items={items} />
        <RunTabs t={t} />
      </View>
    </Frame>
  );
}

/** The dock releasing the van (DR-11) or the run moving to this phone (DR-32) opens their screen. */
function useRunHandoffs(view: RunView | null, items: Outbox['items']) {
  const trip = view?.trip ?? null;
  // the dock releases the van while the run is open: the load handover (DR-11)
  const [since] = useState(() => new Date().toISOString());
  const tripIds = (view?.trips ?? []).map(t => t.id);
  const released = useReleasedNotice(tripIds, since);
  const releasedTrip = String(released?.payload.tripId ?? released?.payload.id ?? '');
  useEffect(() => {
    if (releasedTrip) openScreen('dr-11-load-handover-received', { trip: releasedTrip });
  }, [releasedTrip]);
  // the server has records of today's run that this phone never saved: the run moved to this phone (DR-32)
  const marks = useRunMarks(trip?.id);
  const events = useServerEvents(tripIds);
  const moved = movedRun(events.data, items, marks.saved).moved;
  const movedTrip = marks.loaded && moved ? trip?.id : undefined;
  useEffect(() => {
    if (movedTrip) openScreen('dr-32-run-moved-to-a-new-phone', { trip: movedTrip }, 'nav');
  }, [movedTrip]);
}

/** One stop per outlet visit: a stop can carry several orders (e.g. chilled + dry), stored as rows with the same stopSeq. */
function groupStops(stops: TripStop[]): StopGroup[] {
  return stops.reduce<StopGroup[]>((acc, st) => {
    const g = acc.find(x => x.st.stopSeq === st.stopSeq);
    if (g) g.rows.push(st); else acc.push({ st, rows: [st] });
    return acc;
  }, []);
}

function runStatus(signedIn: boolean, view: RunView | null, loading: boolean, failed: boolean): string {
  if (!signedIn) return 'Sign in to see your run';
  if (view) return view.isToday ? '' : `Last run · ${dayLabel(view.date)}`;
  if (loading) return 'Loading your run…';
  return failed ? 'No signal · nothing saved yet' : '';
}

function runDay(view: RunView | null): string {
  if (!view) return dayLabel(today());
  return `${dayLabel(view.date)}${view.trip ? ` · ${view.trip.vehicleId}` : ''}`;
}

function netChip(online: boolean, waiting: number): string {
  if (!online) return `Offline · ${waiting} saved`;
  return waiting ? `${waiting} to send` : 'Offline-ready';
}

function nextStopTitle(current: TripStop | null, first: TripStop | undefined, hasTrip: boolean): string {
  if (current) return `${current.stopSeq === first?.stopSeq ? 'First stop' : 'Next stop'} · ${current.outlet?.name ?? current.outletId}`;
  return hasTrip ? 'All stops delivered' : 'No stops yet';
}

function savedText(waiting: number, updatedAt: number | null | undefined, fromCache: boolean | undefined, online: boolean): string {
  if (waiting) return `${plural(waiting, 'record')} waiting to send`;
  const at = updatedAt ? hm(new Date(updatedAt).toISOString()) : '';
  if (!online) return at ? `No signal · your run is on this phone (saved ${at})` : 'No signal · the run opens once it has loaded';
  if (at) return `Saved on this phone ${at} · keeps working if the signal drops${fromCache ? ' (from this phone)' : ''}`;
  return 'Saved on this phone once loaded, for when the signal drops';
}

/** A check in the colour of the no-signal icon, for "saved on this phone" while online. */
function savedIcon(noSignal: string): string {
  const c = /stroke="(#[0-9a-fA-F]{6})"/.exec(noSignal)?.[1] ?? '#d6cfc7';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M20 6 9 17l-5-5"/></svg>`;
}

function stopState(unsent: boolean, delivered: boolean, units: number, orders: number): string {
  if (unsent) return 'Saved on phone';
  if (delivered) return 'Delivered';
  return units ? plural(units, 'unit') : plural(orders, 'order');
}

function stopTime(st: TripStop, delivered: boolean): string {
  if (delivered) return hm(st.leaveActual) || '✓';
  return st.etaModel ? `~${hm(st.etaModel)}` : '—';
}

function RunHeader({ t, day, chip }: Themed & { day: string; chip: string }) {
  const { s } = t;
  return (
    <View style={s.v8}>
      <Tap lk="L243" style={s.v2}>
        <Icon xml={X0} width={36} height={36} style={s.v1} />
      </Tap>
      <View style={s.v4}>
        <Text style={s.t3} testID="run-day" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{day}</Text>
      </View>
      <View style={s.v6} testID="net-chip">
        <Icon xml={t.X1} width={14} height={14} style={s.v1} />
        <Text style={s.t5} numberOfLines={1}>{chip}</Text>
      </View>
      <Tap style={s.v7} to={null} onPress={() => void setSettings({ theme: t.toggle })} testID="theme-toggle">
        <Icon xml={t.X2} width={20} height={20} style={s.v1} />
      </Tap>
    </View>
  );
}

function NextStopCard({ t, current, title }: Themed & { current: TripStop | null; title: string }) {
  const { s, X3 } = t;
  return (
    <Tap lk={t.route} style={s.v19}>
      {X3 ? (
        // its own button: reads the next stop aloud (the rest of the card opens the route)
        <Tap to={null} say={nextStopSpeech(current, title)} style={s.v11} testID="read-next-stop">
          <Icon xml={X3} width={20} height={20} style={s.v1} />
        </Tap>
      ) : null}
      <View>
        <Text style={s.t12}>{title}</Text>
      </View>
      <View style={s.v17}>
        <View style={s.v15}>
          <Text style={s.t14}>{current ? <>{current.etaModel ? `~${hm(current.etaModel)}` : '—'}<Text style={s.t13}>{"ETA"}</Text></> : title === 'All stops delivered' ? 'Run complete' : '—'}</Text>
        </View>
        {current ? (
          <View style={s.v6}>
            <View style={s.v16} />
            <Text style={s.t5} numberOfLines={1}>{(current.lateRiskPct ?? 0) < LATE_RISK_PCT ? 'In window' : `Late risk ${current.lateRiskPct}%`}</Text>
          </View>
        ) : null}
      </View>
      <View>
        <Text style={s.t18}>{current ? `Plan ${hm(current.etaPlan) || '—'} · model ~${hm(current.etaModel) || '—'}` : ' '}</Text>
      </View>
    </Tap>
  );
}

/** What the speaker on the next-stop card reads: the stop and its ETA. */
function nextStopSpeech(current: TripStop | null, title: string): string {
  if (!current) return title;
  const eta = current.etaModel ? `, estimated arrival ${hm(current.etaModel)}` : '';
  return `${title}${eta}.`;
}

function TripStops({ t, view, groups, current, waiting }: Themed & { view: RunView | null; groups: StopGroup[]; current: TripStop | null; waiting: Outbox['waiting'] }) {
  const { s } = t;
  const trip = view?.trip ?? null;
  const trips = view?.trips.length ?? 0;
  return (
    <View style={s.v40}>
      <View style={s.v22}>
        <View style={s.v15}>
          <Text style={s.t20}>{trip ? `Trip ${trip.tripNumber} · ${titleCase(trip.brand)} · ${trip.district}` : 'Trip'}</Text>
        </View>
        <View style={s.v15}>
          <Text style={s.t21}>{trip ? `${plural(groups.length, 'stop')}${trips > 1 ? ` · ${plural(trips, 'trip')}` : ''}` : ''}</Text>
        </View>
      </View>
      <View style={s.v39}>
        {groups.map((g, i) => (
          <StopRow key={g.st.id} t={t} group={g} first={i === 0} isCurrent={g.st.stopSeq === current?.stopSeq} waiting={waiting} />
        ))}
      </View>
    </View>
  );
}

function StopRow({ t, group: { st, rows }, first, isCurrent, waiting }: Themed & { group: StopGroup; first: boolean; isCurrent: boolean; waiting: Outbox['waiting'] }) {
  const { s } = t;
  const delivered = rows.every(r => r.status === 'DELIVERED');
  const unsent = rows.some(r => isUnsent(waiting, r.id));
  const units = rows.reduce((n, r) => n + (r.order?.units ?? 0), 0);
  return (
    <Tap style={first ? s.v35 : s.v38} to={{ to: 'dr-02-stop-arrival', params: { stop: st.id } }} testID={`stop-${st.stopSeq}`}>
      <View style={isCurrent ? s.v24 : s.v37}>
        <Text style={isCurrent ? s.t23 : s.t36}>{delivered ? '✓' : String(st.stopSeq)}</Text>
      </View>
      <View style={s.v31}>
        <View>
          <Text style={s.t25}>{st.outlet?.name ?? st.outletId}</Text>
        </View>
        <View style={s.v30}>
          <View style={s.v15}>
            <Text style={s.t26}>{st.outletId}</Text>
          </View>
          <View style={s.v27} />
          <View style={s.v29}>
            <Icon xml={t.X4} width={14} height={14} style={s.v1} />
            <Text style={s.t28} numberOfLines={1} testID={`stop-${st.stopSeq}-state`}>{stopState(unsent, delivered, units, rows.length)}</Text>
          </View>
        </View>
      </View>
      <View style={s.v34}>
        <View>
          <Text style={s.t32}>{stopTime(st, delivered)}</Text>
        </View>
        <View>
          <Text style={s.t33}>{st.outlet ? `${st.outlet.windowOpen}–${st.outlet.windowClose}` : ''}</Text>
        </View>
      </View>
    </Tap>
  );
}

function ShortfallCard({ t, first, count }: Themed & { first: Shortfall; count: number }) {
  const { s } = t;
  return (
    <View style={s.v44}>
      <Icon xml={t.X5} width={20} height={20} style={s.v41} />
      <View style={s.v43}>
        <View>
          <Text style={s.t42}>{`${Math.max(0, first.qtyOrdered - first.qtyLoaded)} ${first.item} short${count > 1 ? ` · +${count - 1} more` : ''}`}</Text>
        </View>
        <View>
          <Text style={s.t18}>{first.reason || 'Flagged at loading'}</Text>
        </View>
      </View>
    </View>
  );
}

function StartTripBar({ t, view, items }: Themed & { view: RunView | null; items: Outbox['items'] }) {
  const { s } = t;
  const trip = view?.trip ?? null;
  const marks = useRunMarks(trip?.id);
  // no trip assigned (or still loading): the driver's app has nothing to start; a design preview keeps the prototype
  if ((!view || !trip) && DRIVER_APP) return null;
  // a finished run has nothing left to start
  if (view?.stops.length && view.stops.every(st => st.status === 'DELIVERED')) return null;
  // The dock's release (seal number, reefer temperature) puts the trip en route. Until then there is nothing to
  // start: the driver waits for it, and the release opens the load handover on this phone (DR-11).
  const status = trip ? tripStatusOf(trip, items) : null;
  const waiting = status === 'PLANNED' || status === 'LOADING';
  const begun = !!trip && !!view?.stops.some(st => st.tripId === trip.id && (st.arrivalActual || st.status === 'DELIVERED'));
  // released but the load not yet taken over on this phone (the release came before sign-in): the handover and the
  // pre-trip check come first, as they do when the release notice opens them
  const handover = !!trip && !waiting && !begun && marks.loaded && !marks.accepted;
  const label = waiting ? 'Waiting for the dock to release' : handover ? 'Review the load' : begun ? 'Continue trip' : 'Start trip';
  return (
    <View style={s.v51}>
      <Tap
        lk="L12"
        style={s.v50}
        disabled={waiting}
        to={handover && trip ? { to: 'dr-11-load-handover-received', params: { trip: trip.id } } : undefined}
        onPress={async () => {
          if (!trip || !view) return true; // design preview: follow the prototype
          if (handover) return true;
          // the trips before this one are finished (Trip 2 starts after Trip 1), then this one is en route
          await finishDeliveredTrips(view.trips.filter(x => x.tripNumber < trip.tripNumber), view.stops);
          await startTrip(trip);
          return true;
        }}
      >
        <Grad g={t.cta} style={s.v48} />
        <Icon xml={t.X7} width={22} height={22} style={s.v1} />
        <Text style={s.t49}>{label}</Text>
      </Tap>
    </View>
  );
}

function RunTabs({ t }: Themed) {
  const { s } = t;
  return (
    <View style={s.v54}>
      <View style={s.v53}>
        <Icon xml={t.X8} width={24} height={24} style={s.v1} />
        <Text style={s.t52}>{"Run"}</Text>
      </View>
      <Tap lk="N1" style={s.v53}>
        <Icon xml={t.X9} width={24} height={24} style={s.v1} />
        <Text style={s.t21}>{"Records"}</Text>
      </Tap>
      <Tap lk="N2" style={s.v53}>
        <Icon xml={t.X10} width={24} height={24} style={s.v1} />
        <Text style={s.t21}>{"Dispatch"}</Text>
      </Tap>
    </View>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11 5 6 9H2v6h4l5 4V5Z\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t9: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v11: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"position":"absolute","top":14,"right":14,"bottom":93.8,"left":288,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t12: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t13: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t14: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexShrink":1},
  v16: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#5ee0a8","borderRadius":3.5},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t18: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v19: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t20: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t23: {"color":"#1a1300","fontSize":16,"lineHeight":24,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#f5b83d","borderRadius":14},
  t25: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t26: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v27: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t28: {"color":"#67e3f9","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v30: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v31: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t32: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t33: {"color":"#7f89a3","fontSize":13,"lineHeight":16,"fontFamily":"Inter_600SemiBold"},
  v34: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v35: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  t36: {"color":"#a9b4ff","fontSize":16,"lineHeight":24,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  v38: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v39: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v41: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t42: {"color":"#ffc266","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v44: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#2e2208","borderRadius":18},
  t45: {"color":"#d6cfc7","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v46: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  v47: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v48: {"borderRadius":18},
  t49: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v50: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v51: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  t52: {"color":"#f5b83d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v53: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  v54: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#0b1122","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v55: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));

export const night: Dr01Theme = { bg: '#070b16', nav, route: 'L41', toggle: 'day', cta: G0, X1, X2, X3, X4, X5, X6, X7, X8, X9, X10, s };
