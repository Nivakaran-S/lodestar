// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-28 End of shift summary · phone (P4, phone)
// The day's run from the cached run and the outbox. Distance and fuel used per shift are not recorded
// anywhere, and the next run date is not known until the plan arrives: those rows are left out.
// "Fuel this week" is the vehicle's own counter (Vehicles usedLThisWeek / weeklyLFuel).
import { Text, View, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { hm } from '@/lib/time';
import { plural, signOutTo } from '@/lodestar/live';
import { finishDeliveredTrips } from '@/model/actions';
import { network } from '@/offline/network';
import { queue, sync } from '@/model/platform';
import { useClaims, useOutbox, useRun, type RunView } from '@/model/hooks';
import type { Trip, TripStop, Vehicle } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

// Close shift → DR-06 (P4): the finished trips are completed, the outbox is sent while there is signal, then the
// driver is signed out (anything still unsent stays on the phone and goes after the next sign-in).
const nav: ScreenNav = {"links":{"L22":{"to":"dr-06-sign-in","kind":"nav"}}};

type Fuel = Vehicle & { usedLThisWeek?: number | null; weeklyLFuel?: number | null };

/** Night and daylight differ only in colour: the frame, the icon strokes, the gradients and the styles. */
export type Dr28Theme = { bg: string; X1: string; X2: string; X4: string; bar: GradSpec[]; cta: GradSpec[]; s: Sheet<typeof s> };
/** A style sheet with the same keys as this one: tN are text styles, vN view styles. */
type Sheet<T> = { [K in keyof T]: K extends `t${string}` ? TextStyle : ViewStyle };
type Themed = { t: Dr28Theme };

export default function ScreenDr28EndOfShiftSummary() {
  return <Dr28Body t={night} />;
}

/** The one DR-28 body, rendered by the night screen and by the daylight one with their own theme. */
export function Dr28Body({ t }: { t: Dr28Theme }) {
  const { name: depotName } = useDepots();
  const { s, X2 } = t;
  const claims = useClaims();
  const run = useRun();
  const { waiting } = useOutbox();
  const v = run.view;
  const trips = v?.trips ?? [];
  const stops = v?.stops ?? [];
  const delivered = stops.filter(st => st.status === 'DELIVERED');
  const orders = new Set(stops.map(st => st.orderId)).size;
  const problems = problemStops(delivered);
  const lastTrip = trips.at(-1) ?? null;
  const vehicle = (lastTrip?.vehicle ?? null) as Fuel | null;
  const done = !!v && stops.length > 0 && delivered.length === stops.length;
  const heading = shiftHeading(!!claims, run.loading && !v, done, delivered.length, stops.length);
  return (
    <Frame bg={t.bg} nav={nav} style={s.v0}>
      <View style={s.v47}>
        <ShiftHeader t={t} waiting={waiting.length} />
        <Scroll style={s.v4} contentStyle={s.v42}>
          <View style={s.v13}>
            <View style={s.v11}>
              <View style={s.v8}>
                <Icon xml={X2} width={28} height={28} style={s.v1} />
              </View>
              <View style={s.v10}>
                <Text style={s.t9} testID="shift-heading">{heading}</Text>
              </View>
            </View>
            {lastTrip ? (
              <View>
                <Text style={s.t12}>{shiftTimes(trips, stops, lastTrip, depotName)}</Text>
              </View>
            ) : null}
          </View>
          <ShiftCounts t={t} stops={stops.length} orders={orders} problems={problems.length} />
          {vehicle ? <LoggedCard t={t} vehicle={vehicle} exText={exceptionText(problems)} /> : null}
        </Scroll>
        <CloseShiftBar t={t} view={v} claims={claims} />
      </View>
    </Frame>
  );
}

/** Delivered stops with a recorded exception or fewer units than ordered. */
function problemStops(delivered: TripStop[]): TripStop[] {
  return delivered.filter(st => st.pod && ((st.pod.exceptions?.length ?? 0) > 0 || st.pod.unitsDelivered < st.pod.unitsOrdered));
}

/** The first problem: its recorded exception, else the units short. */
function exceptionText(problems: TripStop[]): string {
  const first = problems[0]?.pod ?? null;
  if (!first) return '';
  return first.exceptions?.[0]?.description ?? `${first.unitsOrdered - first.unitsDelivered} short at ${problems[0].outlet?.name ?? problems[0].outletId}`;
}

/** "Back at <depot> <time> · out since <time>", else the depot. */
function shiftTimes(trips: Trip[], stops: TripStop[], lastTrip: Trip, depotName: (code: string) => string): string {
  const depot = depotName(lastTrip.depot);
  // departure and return times are set when the plan is made: they count only once the trip has left / come back
  const out = trips.filter(x => x.status === 'ENROUTE' || x.status === 'COMPLETE').map(x => x.departTime).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b))[0];
  const back = lastTrip.status !== 'COMPLETE' ? undefined : lastTrip.returnTime ?? stops.map(st => st.leaveActual).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b)).at(-1);
  return [back ? `Back at ${depot} ${hm(back)}` : '', out ? `out since ${hm(out)}` : ''].filter(Boolean).join(' · ') || depot;
}

function shiftHeading(signedIn: boolean, loading: boolean, done: boolean, delivered: number, stops: number): string {
  if (!signedIn) return 'Sign in to see your shift';
  if (loading) return 'Loading…';
  return done ? 'Shift done' : `${delivered} of ${plural(stops, 'stop')} done`;
}

/** The vehicle's fuel used this week as a share of its weekly quota (0–100), when both are known. */
function fuelPct(used: number | null | undefined, quota: number | null | undefined): number | null {
  if (typeof used !== 'number' || typeof quota !== 'number' || quota <= 0) return null;
  return Math.min(100, Math.round((used / quota) * 100));
}

function ShiftHeader({ t, waiting }: Themed & { waiting: number }) {
  const { s } = t;
  return (
    <View style={s.v7}>
      <View style={s.v2}>
        <Icon xml={X0} width={36} height={36} style={s.v1} />
      </View>
      <View style={s.v4}>
        <Text style={s.t3}>{"End of shift"}</Text>
      </View>
      <View style={s.v6}>
        <Icon xml={t.X1} width={14} height={14} style={s.v1} />
        <Text style={s.t5} numberOfLines={1} testID="shift-sync">{waiting ? `${waiting} to send` : 'All synced'}</Text>
      </View>
    </View>
  );
}

function ShiftCounts({ t, stops, orders, problems }: Themed & { stops: number; orders: number; problems: number }) {
  const { s } = t;
  return (
    <View style={s.v19}>
      <View style={s.v16}>
        <View>
          <Text style={s.t14} testID="shift-stops">{String(stops)}</Text>
        </View>
        <View>
          <Text style={s.t15}>{stops === 1 ? 'Stop' : "Stops"}</Text>
        </View>
      </View>
      <View style={s.v17}>
        <View>
          <Text style={s.t14}>{String(orders)}</Text>
        </View>
        <View>
          <Text style={s.t15}>{orders === 1 ? 'Order' : 'Orders'}</Text>
        </View>
      </View>
      <View style={s.v17}>
        <View>
          <Text style={problems ? s.t18 : s.t14}>{String(problems)}</Text>
        </View>
        <View>
          <Text style={s.t15}>{problems === 1 ? "Exception" : 'Exceptions'}</Text>
        </View>
      </View>
    </View>
  );
}

function LoggedCard({ t, vehicle, exText }: Themed & { vehicle: Fuel; exText: string }) {
  const { s } = t;
  const used = vehicle.usedLThisWeek;
  const quota = vehicle.weeklyLFuel;
  const pct = fuelPct(used, quota);
  return (
    <View style={s.v34}>
      <View style={s.v23}>
        <View style={s.v10}>
          <Text style={s.t20}>{"Logged"}</Text>
        </View>
        <View style={s.v10}>
          <Text style={s.t22}><Text style={s.t21}>{vehicle.id}</Text></Text>
        </View>
      </View>
      <View style={s.v33}>
        {pct !== null ? (
          <View style={[s.v32, x.first]}>
            <View style={s.v28}>
              <View style={s.v10}>
                <Text style={s.t24}>{"Fuel this week"}</Text>
              </View>
              <View style={s.v10}>
                <Text style={s.t25}>{`${used} / ${quota} L`}</Text>
              </View>
            </View>
            <View style={s.v31}>
              <View style={[s.v30, { width: `${pct}%` }]}>
                <Grad g={t.bar} style={s.v29} />
              </View>
            </View>
          </View>
        ) : null}
        {exText ? (
          <View style={pct !== null ? s.v27 : s.v26}>
            <View style={s.v10}>
              <Text style={s.t24}>{"Exception"}</Text>
            </View>
            <View style={s.v10}>
              <Text style={s.t25}>{exText}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CloseShiftBar({ t, view, claims }: Themed & { view: RunView | null; claims: ReturnType<typeof useClaims> }) {
  const { s } = t;
  return (
    <View style={s.v46}>
      <Tap
        lk="L22"
        style={s.v45}
        onPress={async () => {
          if (!view) return true; // prototype mode: just navigate
          await finishDeliveredTrips(view.trips, view.stops);
          if (network.get().online) await sync.flush().catch(() => undefined);
          const left = claims ? queue.pending(claims.sub).length : 0;
          if (left) showToast(`${plural(left, 'record')} stay on this phone · they send after you sign in`);
          return signOutTo('dr-06-sign-in');
        }}
      >
        <Grad g={t.cta} style={s.v43} />
        <Icon xml={t.X4} width={22} height={22} style={s.v1} />
        <Text style={s.t44}>{"Close shift"}</Text>
      </Tap>
    </View>
  );
}

const x = StyleSheet.create({ first: { borderTopWidth: 0 } });

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"28\" height=\"28\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v8: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":52,"height":52,"backgroundColor":"#0d2a20","borderRadius":26},
  t9: {"color":"#f2f4fa","fontSize":38,"lineHeight":39.9,"letterSpacing":-1.1,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexShrink":1},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14},
  t12: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t14: {"color":"#f2f4fa","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t15: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderLeftWidth":1,"borderLeftColor":"#1b2338"},
  t18: {"color":"#ff8a7a","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v19: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t20: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t21: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t22: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v23: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t24: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  t25: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v26: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  v27: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v28: {"flexDirection":"row","justifyContent":"space-between","alignItems":"stretch"},
  v29: {"borderRadius":4},
  v30: {"flexShrink":1,"width":"70%","borderRadius":4},
  v31: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#1a2340","borderRadius":4,"overflow":"hidden"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"paddingTop":12,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v33: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v35: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t36: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t37: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v38: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v40: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v41: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v43: {"borderRadius":18},
  t44: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v47: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
});

export const night: Dr28Theme = { bg: '#070b16', X1, X2, X4, bar: G0, cta: G1, s };
