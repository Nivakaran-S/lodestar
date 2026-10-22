// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-13 Flags tab · phone (P3, phone)
import { useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { addDays, dayLabel, hm } from '@/lib/time';
import { signOutTo } from '@/lodestar/live';
import { collectFlags, useFlagRecords, type Flag } from '@/model/dock';
import { useBayQueue, useClaims, useNotifications, useOutbox } from '@/model/hooks';
import { Frame, PhoneOnly, Icon, Scroll, Tap, type ScreenNav } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L203":{"to":"ld-03-flag-shortfall","kind":"go"},"N0":{"to":"ld-01-dock-queue","kind":"nav"},"N2":{"to":"ld-16-shift-summary","kind":"nav"}}};

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');
const shortBy = (f: Flag) => Math.max(0, f.shortfall.qtyOrdered - f.shortfall.qtyLoaded);

export default function ScreenLd13FlagsTab() {
  const claims = useClaims();
  const bay = useBayQueue();
  const date = bay.data?.date;
  const records = useFlagRecords(date);
  const notes = useNotifications();
  const { items } = useOutbox();
  const [hub, setHub] = useState(false);
  const all = useMemo(() => collectFlags(records.data ?? [], items, notes.data), [records.data, items, notes.data]);
  const shown = hub ? all : all.filter(f => !claims || f.loaderId === claims.sub);
  const tonight = date ? shown.filter(f => f.day === date) : [];
  const weekAgo = date ? addDays(date, -7) : '';
  const earlier = date ? shown.filter(f => f.day < date && f.day >= weekAgo).slice(0, 10) : [];
  const open = tonight.filter(f => !f.ack).length;
  const answered = tonight.filter(f => f.ack);
  const last = answered[0];
  const lastMin = last?.ack && last.shortfall.at ? Math.max(0, Math.round((Date.parse(last.ack.sentAt) - Date.parse(last.shortfall.at)) / 60_000)) : null;
  const next = bay.data?.trips.find(t => t.status === 'PLANNED' || t.status === 'LOADING');
  const name = claims?.name ?? claims?.username;
  const empty = !claims ? 'Sign in to see your flags' : records.loading && !records.data ? 'Loading flags…' : records.error && !records.data ? 'No signal · flags not saved yet' : '';
  const unsentCount = tonight.filter(f => f.unsent).length;

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v50}>
        {/* the Dock desktop shell has its own header (depot, title, user chip) */}
        <PhoneOnly>
          <View style={s.v11}>
            <View style={s.v2}>
              <Icon xml={X0} width={36} height={36} style={s.v1} />
            </View>
            <View style={s.v4}>
              <Text style={s.t3}>{"Flags"}</Text>
            </View>
            <Tap style={s.v10} to={null} onPress={() => signOutTo('ld-06-sign-in')} testID="switch-user">
              <View style={s.v6}>
                <Text style={s.t5}>{initials(name) || "—"}</Text>
              </View>
              <View style={s.v9}>
                <View>
                  <Text style={s.t7} numberOfLines={1}>{name ?? "Not signed in"}</Text>
                </View>
                <View>
                  <Text style={s.t8} numberOfLines={1}>{"Switch user"}</Text>
                </View>
              </View>
            </Tap>
          </View>
        </PhoneOnly>
        <Scroll style={s.v4} contentStyle={s.v46}>
          <Tap lk="L203" style={s.v20} to={next ? { to: "ld-03-flag-shortfall", params: { trip: next.id } } : undefined}>
            <View>
              <Text style={s.t12}>{hub ? "Hub flags tonight" : "Your flags tonight"}</Text>
            </View>
            <View style={s.v18}>
              <View style={s.v15}>
                <Text style={s.t14}>{claims ? String(open) : "—"}<Text style={s.t13}>{" open"}</Text></Text>
              </View>
              <View style={s.v17}>
                <Icon xml={X1} width={18} height={18} style={s.v1} />
                <Text style={s.t16} numberOfLines={1}>{`${answered.length} answered`}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t19} testID="flags-note">
                {empty ||
                  (unsentCount
                    ? `${unsentCount} ${unsentCount === 1 ? "flag is" : "flags are"} still on this phone · ${unsentCount === 1 ? "it sends" : "they send"} when there is signal.`
                    : last?.ack
                      ? `Dispatch answered your ${hm(last.shortfall.at) || ""} flag${lastMin !== null ? ` in ${lastMin} ${lastMin === 1 ? "minute" : "minutes"}` : ""}.`
                      : open
                        ? "Waiting for dispatch to answer."
                        : "No flags tonight.")}
              </Text>
            </View>
          </Tap>
          <View style={s.v25}>
            <Tap style={hub ? s.v24 : s.v22} to={null} onPress={() => setHub(false)} testID="flags-mine">
              <Text style={hub ? s.t23 : s.t21}>{"Mine"}</Text>
            </Tap>
            <Tap style={hub ? s.v22 : s.v24} to={null} onPress={() => setHub(true)} testID="flags-hub">
              <Text style={hub ? s.t21 : s.t23}>{"Whole hub"}</Text>
            </Tap>
          </View>
          <View style={s.v39}>
            <View style={s.v28}>
              <View style={s.v15}>
                <Text style={s.t26}>{"Tonight"}</Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t27}>{dayLabel(date) || "—"}</Text>
              </View>
            </View>
            <View style={s.v38}>
              {tonight.length ? (
                tonight.map((f, i) => (
                  <Tap key={f.key} style={[s.v37, i > 0 && x.border]} to={{ to: "ld-03-flag-shortfall", params: { trip: f.tripId, item: f.shortfall.item } }} testID={`flag-row-${i}`}>
                    <View style={s.v29}>
                      <Icon xml={X2} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v36}>
                      <View>
                        <Text style={s.t30}>{f.shortfall.item}</Text>
                      </View>
                      <View style={s.v35}>
                        <View style={s.v32}>
                          <Text style={s.t31} numberOfLines={1}>{`Short ${shortBy(f)}`}</Text>
                        </View>
                        <View style={s.v33} />
                        <View style={s.v15}>
                          <Text style={s.t34}>{f.vehicleId ?? f.shortfall.reason}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[s.v17, !f.ack && x.waitPill]}>
                      <Text style={[s.t16, !f.ack && x.waitText]} numberOfLines={1}>{f.ack ? `Ack'd ${hm(f.ack.sentAt)}` : f.unsent ? "On this phone" : "Open"}</Text>
                    </View>
                  </Tap>
                ))
              ) : (
                <View style={s.v37}>
                  <View style={s.v36}>
                    <Text style={s.t41}>{empty || "No flags tonight"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <View style={s.v39}>
            <View style={s.v28}>
              <View style={s.v15}>
                <Text style={s.t26}>{"Earlier this week"}</Text>
              </View>
            </View>
            <View style={s.v38}>
              {earlier.length ? (
                earlier.map((f, i) => (
                  <View key={f.key} style={i === 0 ? s.v44 : s.v45}>
                    <View style={s.v40}>
                      <Icon xml={X3} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v36}>
                      <View>
                        <Text style={s.t30}>{`${f.shortfall.item} · short ${shortBy(f)}`}</Text>
                      </View>
                      <View style={s.v35}>
                        <View style={s.v15}>
                          <Text style={s.t34}>{f.vehicleId ?? "—"}</Text>
                        </View>
                        <View style={s.v33} />
                        <Text style={s.t41}>{dayLabel(f.day)}</Text>
                      </View>
                    </View>
                    <View style={s.v32}>
                      <View style={s.v42} />
                      <Text style={s.t43} numberOfLines={1}>{f.ack ? "Answered" : "No answer"}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={s.v44}>
                  <View style={s.v36}>
                    <Text style={s.t41}>{empty || "Nothing earlier this week"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <PhoneOnly>
        <View style={s.v49}>
          <Tap lk="N0" style={s.v47}>
            <Icon xml={X4} width={24} height={24} style={s.v1} />
            <Text style={s.t27}>{"Dock"}</Text>
          </Tap>
          <View style={s.v47}>
            <Icon xml={X5} width={24} height={24} style={s.v1} />
            <Text style={s.t48}>{"Flags"}</Text>
          </View>
          <Tap lk="N2" style={s.v47}>
            <Icon xml={X6} width={24} height={24} style={s.v1} />
            <Text style={s.t27}>{"Shift"}</Text>
          </Tap>
        </View>
        </PhoneOnly>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  border: { borderTopWidth: 1, borderTopColor: '#e3e6ed' },
  waitPill: { backgroundColor: '#FFF4E0' },
  waitText: { color: '#b45309' },
});

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 12a9 9 0 1 0 3-6.7L3 8\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 3v5h5M12 7v5l4 2\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 21V8l9-5 9 5v13\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M7 21v-8h10v8M7 17h10\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

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
  t12: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t13: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t14: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexShrink":1},
  t16: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  v18: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t19: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v20: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  t21: {"color":"#0a0f1a","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":36,"backgroundColor":"#ffffff","borderRadius":10,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 3px 0px"},
  t23: {"color":"#344054","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":36,"borderRadius":10},
  v25: {"flexDirection":"row","alignItems":"stretch","rowGap":4,"columnGap":4,"flexShrink":0,"paddingTop":4,"paddingRight":4,"marginRight":16,"paddingBottom":4,"paddingLeft":4,"marginLeft":16,"backgroundColor":"#e9ecf2","borderRadius":14},
  t26: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t27: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v28: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#fde8e5","borderRadius":14},
  t30: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t31: {"color":"#b42318","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v33: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  t34: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v35: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v37: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v38: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v40: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e9ecf2","borderRadius":14},
  t41: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v42: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#047857","borderRadius":3.5},
  t43: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v45: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v47: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  t48: {"color":"#141b4d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v49: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#ffffff","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v50: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
