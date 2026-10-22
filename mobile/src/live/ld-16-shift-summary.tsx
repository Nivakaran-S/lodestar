// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-16 Shift summary · phone (P3, phone)
// The loader's night at the depot: released trips from the bay queue (with their load records), order lines
// per trip, and tonight's flags. Shift hours and the team-lead role are not in the data: left out.
import { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { signOutTo } from '@/lodestar/live';
import { collectFlags, isReleased, onTime, useFlagRecords, useTripLineCounts } from '@/model/dock';
import { useBayQueue, useClaims, useNotifications, useOutbox } from '@/model/hooks';
import { Frame, PhoneOnly, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L208":{"to":"ld-06-sign-in","kind":"go"},"N0":{"to":"ld-01-dock-queue","kind":"nav"},"N1":{"to":"ld-13-flags-tab","kind":"nav"}}};

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

export default function ScreenLd16ShiftSummary() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const bay = useBayQueue();
  const date = bay.data?.date;
  const depot = bay.data?.depot ?? claims?.depots[0];
  const trips = useMemo(() => bay.data?.trips ?? [], [bay.data]);
  const { items } = useOutbox();
  const records = useFlagRecords(date);
  const notes = useNotifications();
  const flags = useMemo(() => collectFlags(records.data ?? [], items, notes.data).filter(f => f.day === date), [records.data, items, notes.data, date]);
  const released = trips.filter(t => isReleased(t, items));
  const onDock = trips.find(t => !isReleased(t, items));
  const lineCounts = useTripLineCounts(trips.map(t => t.id)).data ?? {};
  const shortOf = (tripId: string) => flags.filter(f => f.tripId === tripId);
  const loadedLines = released.reduce((n, t) => n + Math.max(0, (lineCounts[t.id] ?? 0) - shortOf(t.id).length), 0);
  const late = released.filter(t => onTime(t) === false).length;
  const timed = released.filter(t => onTime(t) !== undefined).length;
  const open = flags.filter(f => !f.ack).length;
  const name = claims?.name ?? claims?.username;
  const empty = !claims ? 'Sign in to see your shift' : bay.loading && !bay.data ? 'Loading your shift…' : bay.error && !bay.data ? 'No signal · shift not saved yet' : '';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v54}>
        <View style={s.v11}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Shift"}</Text>
          </View>
          <View style={s.v10}>
            <View style={s.v6}>
              <Text style={s.t5}>{initials(name) || "—"}</Text>
            </View>
            <View style={s.v9}>
              <View>
                <Text style={s.t7} numberOfLines={1}>{name ?? "Not signed in"}</Text>
              </View>
              <View>
                <Text style={s.t8} numberOfLines={1}>{"Loader"}</Text>
              </View>
            </View>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v46}>
          <View style={s.v22}>
            <Grad g={G0} style={s.v12} />
            <View>
              <Text style={s.t13}>{empty || [date ? dayLabel(date) : '', depot ? depotName(depot) : ''].filter(Boolean).join(' · ')}</Text>
            </View>
            <View style={s.v19}>
              <View style={s.v16}>
                <Text style={s.t15} testID="released-count">{String(released.length)}<Text style={s.t14}>{" released"}</Text></Text>
              </View>
              {timed ? (
                <View style={s.v18}>
                  <Icon xml={X1} width={18} height={18} style={s.v1} />
                  <Text style={s.t17} numberOfLines={1}>{late ? `${late} late` : "All on time"}</Text>
                </View>
              ) : null}
            </View>
            {onDock ? (
              <View>
                <Text style={s.t21}><Text style={s.t20}>{onDock.vehicleId}</Text>{` is still on the dock${onDock.bay ? ` at ${onDock.bay}` : ''}.${onDock.departTime ? ` It departs ${hm(onDock.departTime)}.` : ''}`}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.v27}>
            <View style={s.v25}>
              <View>
                <Text style={s.t23}>{String(loadedLines)}</Text>
              </View>
              <View>
                <Text style={s.t24}>{loadedLines === 1 ? 'line loaded' : "lines loaded"}</Text>
              </View>
            </View>
            <View style={s.v26}>
              <View>
                <Text style={s.t23}>{String(flags.length)}</Text>
              </View>
              <View>
                <Text style={s.t24}>{flags.length === 1 ? "flag raised" : 'flags raised'}</Text>
              </View>
            </View>
            <View style={s.v26}>
              <View>
                <Text style={s.t23}>{String(open)}</Text>
              </View>
              <View>
                <Text style={s.t24}>{"left open"}</Text>
              </View>
            </View>
          </View>
          {released.length ? (
            <View style={s.v45}>
              <View style={s.v30}>
                <View style={s.v16}>
                  <Text style={s.t28}>{"Released tonight"}</Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t29}>{"departure"}</Text>
                </View>
              </View>
              <View style={s.v44}>
                {released.map((t, i) => {
                  const total = lineCounts[t.id];
                  const shorts = shortOf(t.id);
                  const acked = shorts.filter(f => f.ack).length;
                  const mine = !!claims && t.loadRecord?.loaderId === claims.sub;
                  const left = t.loadRecord?.releasedAt ?? t.departTime;
                  const ok = onTime(t);
                  const lines = total === undefined ? '' : shorts.length ? `${total - shorts.length} of ${total} · ${shorts.length} short${acked === shorts.length ? ", ack'd" : ''}` : `${total} of ${total} lines`;
                  return (
                    <View key={t.id} style={i === 0 ? s.v40 : s.v43} testID={`released-${i}`}>
                      <View style={mine ? s.v42 : s.v32}>
                        <Text style={mine ? s.t41 : s.t31}>{t.bay ?? '—'}</Text>
                      </View>
                      <View style={s.v37}>
                        <View>
                          <Text style={s.t34}><Text style={s.t33}>{t.vehicleId}</Text>{` · ${t.district}`}</Text>
                        </View>
                        {lines ? (
                          <View style={s.v36}>
                            <Text style={s.t35}>{lines}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={s.v39}>
                        <View>
                          <Text style={s.t38}>{left ? hm(left) : '—'}</Text>
                        </View>
                        {ok !== undefined ? (
                          <View>
                            <Text style={s.t24}>{ok ? "on time" : 'late'}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v50}>
          <Tap lk="L208" style={s.v49} onPress={() => signOutTo('ld-06-sign-in')}>
            <Grad g={G1} style={s.v47} />
            <Icon xml={X2} width={22} height={22} style={s.v1} />
            <Text style={s.t48}>{"Sign out"}</Text>
          </Tap>
        </View>
        <PhoneOnly>
        <View style={s.v53}>
          <Tap lk="N0" style={s.v51}>
            <Icon xml={X3} width={24} height={24} style={s.v1} />
            <Text style={s.t29}>{"Dock"}</Text>
          </Tap>
          <Tap lk="N1" style={s.v51}>
            <Icon xml={X4} width={24} height={24} style={s.v1} />
            <Text style={s.t29}>{"Flags"}</Text>
          </Tap>
          <View style={s.v51}>
            <Icon xml={X5} width={24} height={24} style={s.v1} />
            <Text style={s.t52}>{"Shift"}</Text>
          </View>
        </View>
        </PhoneOnly>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 21V8l9-5 9 5v13\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M7 21v-8h10v8M7 17h10\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#1e2766","p":0},{"c":"#141b4d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_800ExtraBold"},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":34,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  t7: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_700Bold"},
  t8: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexDirection":"column","alignItems":"stretch","flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":12,"paddingLeft":5,"height":44,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v12: {"borderRadius":24},
  t13: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t14: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t15: {"color":"#ffffff","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v16: {"flexShrink":1},
  t17: {"color":"#ffffff","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"rgba(255, 255, 255, 0.14)","borderRadius":14},
  v19: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t20: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t21: {"color":"#b9c0e6","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v22: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"borderRadius":24,"boxShadow":"rgba(20, 27, 77, 0.28) 0px 12px 32px 0px"},
  t23: {"color":"#0a0f1a","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t24: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderLeftWidth":1,"borderLeftColor":"#e3e6ed"},
  v27: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"overflow":"hidden"},
  t28: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t31: {"color":"#3b4cca","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v32: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t33: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t34: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t35: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v36: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v37: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t38: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v39: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v40: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  t41: {"color":"#ffcb5c","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v42: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#141b4d","borderRadius":14},
  v43: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v44: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v45: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v47: {"borderRadius":18},
  t48: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v49: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v51: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  t52: {"color":"#141b4d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v53: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#ffffff","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v54: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
