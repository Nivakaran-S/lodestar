// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-12 Plan changed · phone (P3, phone)
// The load sheet opens this when dispatch publishes a re-plan while a trip is being loaded (route params `trip`,
// `plan`): the vehicle's trip in the new plan and the order lines whose stop changed, checked against the lines
// already ticked on this phone. Positions are shown by stop (the truck layout is not in the data); the dispatcher's
// name is not in the plan, and "why" shows the plan's own note when there is one.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { usePlanChange, useTicks } from '@/model/dock';
import { useClaims, useParam } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L202":{"to":"ld-02-load-sheet","kind":"go"}}};

const where = (seq: number | null) => (seq === null ? 'Off this van' : `Stop ${seq}`);

export default function ScreenLd12PlanChanged() {
  const claims = useClaims();
  const tripId = useParam('trip');
  const planId = useParam('plan');
  const q = usePlanChange(tripId, planId);
  const ch = q.data;
  const before = ch?.before ?? null;
  const after = ch?.after ?? before;
  const plan = ch?.plan ?? null;
  const t = useTicks(before?.id, before?.status);
  const moved = ch?.moved ?? [];
  const loaded = moved.filter(m => t.isTicked(m.line.id));
  const first = moved[0];
  const at = plan?.publishedAt ?? plan?.approvedAt ?? plan?.createdAt;
  const version = plan?.version ?? after?.planVersion;
  const empty = !claims ? 'Sign in to see the change' : q.loading && !ch ? 'Loading the new plan…' : 'No change for this vehicle';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v44}>
        <View style={s.v8}>
          <View style={s.v1} />
          <View style={s.v4}>
            <Text style={s.t3}><Text style={s.t2}>{after?.vehicleId ?? '—'}</Text>{after?.bay ? ` · Bay ${after.bay}` : ''}</Text>
          </View>
          {version ? (
            <View style={s.v7}>
              <View style={s.v5} />
              <Text style={s.t6} numberOfLines={1}>{`Plan v${version}`}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v39}>
          <View style={s.v13}>
            <View>
              <Text style={s.t9} testID="changed-at">{plan ? `Plan changed${at ? ` ${hm(at)}` : ''} · dispatch` : empty}</Text>
            </View>
            <View>
              <Text style={s.t11} testID="moved-count">{String(moved.length)}<Text style={s.t10}>{moved.length === 1 ? 'item moved' : "items moved"}</Text></Text>
            </View>
            {ch ? (
              <View>
                <Text style={s.t12}>{!moved.length ? 'Nothing on your sheet moved.' : loaded.length ? `${loaded.length} already loaded: take ${loaded.length === 1 ? 'it' : 'them'} off. Everything else is the same.` : `${moved.length === 1 ? 'It is not' : 'None is'} loaded yet, so nothing comes off the truck. Everything else is the same.`}</Text>
              </View>
            ) : null}
          </View>
          {moved.length ? (
            <View style={s.v31}>
              <View style={s.v17}>
                <View style={s.v15}>
                  <Text style={s.t14}>{`What moved · v${before?.planVersion ?? '—'} → v${version ?? '—'}`}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t16}>{`${moved.length} of ${ch?.lines ?? moved.length} ${(ch?.lines ?? moved.length) === 1 ? 'line' : 'lines'}`}</Text>
                </View>
              </View>
              <View style={s.v30}>
                {moved.map((m, i) => (
                  <View key={m.line.id} style={i === 0 ? s.v28 : s.v29} testID={`moved-${i}`}>
                    <View style={s.v19}>
                      <Icon xml={X0} width={22} height={22} style={s.v18} />
                    </View>
                    <View style={s.v24}>
                      <View>
                        <Text style={s.t20}>{m.line.name}</Text>
                      </View>
                      <View style={s.v23}>
                        <View style={s.v15}>
                          <Text style={s.t21}>{where(m.from)}</Text>
                        </View>
                        <Icon xml={X1} width={14} height={14} style={s.v18} />
                        <View style={s.v15}>
                          <Text style={s.t22}>{where(m.to)}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={s.v27}>
                      <View>
                        <Text style={s.t25}>{String(m.line.qty)}</Text>
                      </View>
                      <View>
                        <Text style={s.t26}>{m.line.qty === 1 ? "unit" : "units"}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {plan ? (
            <View style={s.v38}>
              {plan.notes || plan.explanation ? (
                <View style={s.v34}>
                  <View style={s.v15}>
                    <Text style={s.t32}>{"Why"}</Text>
                  </View>
                  <View style={s.v15}>
                    <Text style={s.t33}>{plan.notes ?? plan.explanation}</Text>
                  </View>
                </View>
              ) : null}
              {first?.outletId ? (
                <View style={plan.notes || plan.explanation ? s.v36 : s.v34}>
                  <View style={s.v15}>
                    <Text style={s.t32}>{"Store"}</Text>
                  </View>
                  <View style={s.v15}>
                    <Text style={s.t33}><Text style={s.t35}>{first.outletId}</Text></Text>
                  </View>
                </View>
              ) : null}
              {before && version && before.planVersion !== version ? (
                <View style={s.v36}>
                  <View style={s.v15}>
                    <Text style={s.t32}>{`Your v${before.planVersion} printout`}</Text>
                  </View>
                  <View style={s.v15}>
                    <Text style={s.t37}>{"Out of date"}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </Scroll>
        <View style={s.v43}>
          <Tap lk="L202" style={s.v42} to={after ? { to: 'ld-02-load-sheet', params: { trip: after.id } } : undefined}>
            <Grad g={G0} style={s.v40} />
            <Icon xml={X2} width={22} height={22} style={s.v18} />
            <Text style={s.t41}>{version ? `Got it, load v${version}` : 'Got it'}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"width":40},
  t2: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t3: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#b45309","borderRadius":3.5},
  t6: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#fff1d6","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t9: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t11: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t12: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#fff1d6","borderRadius":24},
  t14: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexShrink":1},
  t16: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v18: {"flexShrink":0,"overflow":"hidden"},
  v19: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#fff1d6","borderRadius":14},
  t20: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#4a5467","fontSize":13,"lineHeight":18.2,"textDecorationLine":"line-through","fontFamily":"Inter_500Medium"},
  t22: {"color":"#0a0f1a","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_700Bold"},
  v23: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t25: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t26: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v27: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v30: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v31: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  t32: {"color":"#344054","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  t33: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v34: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  t35: {"color":"#344054","letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v36: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  t37: {"color":"#b42318","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v38: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v40: {"borderRadius":18},
  t41: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v42: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v44: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
