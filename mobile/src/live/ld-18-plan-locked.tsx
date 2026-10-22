// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-18 Plan locked · phone (P3, phone)
// The load sheet opens this while dispatch works on a re-plan for the trip's depot and day (a newer draft plan):
// the sheet waits, and the next lines to load are shown. When the re-plan is published, "plan changed" (LD-12)
// opens. The dispatcher's name and a time estimate are not in the data, and there is no dispatch phone number in
// the loader's data ("Call dispatch" left out).
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { titleCase } from '@/lodestar/live';
import { loadGroups, shortfallFor, tempLabel, useOpenRePlan, useRePlanAlert, useTicks } from '@/model/dock';
import { useClaims, useLoadSheet } from '@/model/hooks';
import type { OrderLineItem } from '@/model/types';
import { Frame, Icon, Scroll, Tap, openScreen, type ScreenNav } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L65":{"to":"ld-12-plan-changed","kind":"go"},"B":{"to":"ld-01-dock-queue","kind":"back"}}};

export default function ScreenLd18PlanLocked() {
  const claims = useClaims();
  const sheet = useLoadSheet();
  const data = sheet.data;
  const trip = data?.trip ?? null;
  const draft = useOpenRePlan(trip).data ?? null;
  useRePlanAlert(trip?.depot, planId => trip && openScreen('ld-12-plan-changed', { trip: trip.id, plan: planId }, 'nav'));
  const t = useTicks(sheet.tripId, sheet.data?.trip?.status);
  const accounted = (l: OrderLineItem) => t.isTicked(l.id) || !!shortfallFor(sheet.shortfalls, l);
  const groups = loadGroups(data, accounted);
  const lines = groups.flatMap(g => g.lines);
  const done = lines.filter(accounted).length;
  const next = lines.filter(l => !accounted(l)).slice(0, 2);
  const empty = !claims ? 'Sign in to see the load sheet' : sheet.loading && !data ? 'Loading…' : 'No trip being loaded';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v41}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}><Text style={s.t3}>{trip?.vehicleId ?? '—'}</Text>{trip?.bay ? ` · Bay ${trip.bay}` : ''}</Text>
          </View>
          {trip ? (
            <View style={s.v7}>
              <Text style={s.t6} numberOfLines={1}>{`Plan v${trip.planVersion}`}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v5} contentStyle={s.v35}>
          <View style={s.v15}>
            <View style={s.v12}>
              <View style={s.v9}>
                <Icon xml={X1} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v11}>
                <Text style={s.t10} testID="locked-at">{draft ? `Sheet locked ${hm(draft.createdAt)}` : trip ? 'Sheet open' : empty}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t13}>{draft ? "Plan is being changed" : 'No change in progress'}</Text>
            </View>
            {trip ? (
              <View>
                <Text style={s.t14}>{"Dispatch is editing "}<Text style={s.t3}>{trip.vehicleId}</Text>{". The new version lands here the moment it is published."}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.v19}>
            <Icon xml={X2} width={20} height={20} style={s.v16} />
            <View style={s.v18}>
              <View>
                <Text style={s.t17}>{"Nothing to undo"}</Text>
              </View>
              <View>
                <Text style={s.t14}>{"Leave what's on the truck. New ticks wait for the new version."}</Text>
              </View>
            </View>
          </View>
          {trip ? (
            <View style={s.v34}>
              <View style={s.v22}>
                <View style={s.v11}>
                  <Text style={s.t20}>{`${titleCase(trip.brand)} · ${trip.district} · next up`}</Text>
                </View>
                <View style={s.v11}>
                  <Text style={s.t21}>{`${done} of ${lines.length} loaded`}</Text>
                </View>
              </View>
              <View style={s.v33}>
                {next.map((l, i) => (
                  <View key={l.id} style={i === 0 ? s.v31 : s.v32}>
                    <View style={s.v23}>
                      <Icon xml={X3} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v28}>
                      <View>
                        <Text style={s.t24}>{l.name}</Text>
                      </View>
                      <View style={s.v27}>
                        <Text style={s.t25}>{tempLabel(l.tempClass)}</Text>
                        <View style={s.v26} />
                        <Text style={s.t25}>{`${Math.round(l.kg * 10) / 10} kg`}</Text>
                      </View>
                    </View>
                    <View style={s.v30}>
                      <View>
                        <Text style={s.t29}>{String(l.qty)}</Text>
                      </View>
                      <View>
                        <Text style={s.t10}>{l.qty === 1 ? "unit" : "units"}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v40}>
          <Tap lk="L65" style={s.v37} to={draft ? null : trip ? { to: 'ld-02-load-sheet', params: { trip: trip.id } } : undefined} testID="waiting">
            <Icon xml={X3} width={22} height={22} style={s.v1} />
            <Text style={s.t36}>{draft ? "Waiting for the new plan" : 'Back to the load sheet'}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0369a1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#0369a1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 16v-4M12 8h.01\" fill=\"none\" stroke=\"#0369a1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t6: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e9ecf2","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v9: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t10: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v11: {"flexShrink":1},
  v12: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12},
  t13: {"color":"#0a0f1a","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t14: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  v16: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t17: {"color":"#0369a1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v18: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v19: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#e2f0fa","borderRadius":18},
  t20: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e9ecf2","borderRadius":14},
  t24: {"color":"#344054","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t25: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v26: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  v27: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t29: {"color":"#344054","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v30: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#f4f6fa"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#f4f6fa","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v33: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  t36: {"color":"#344054","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"backgroundColor":"#e9ecf2","borderRadius":18},
  t38: {"color":"#344054","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v39: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v41: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
