// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-14 Re-plan received · phone (P3, phone)
// Reefer down (P5): opened when dispatch publishes a re-plan for the depot (plan_published, route param `plan`).
// The vehicle that can't depart is the depot's vehicle in the workshop; "where the goods go" are the re-plan's
// trips still to load. Which stores were told is not in the plan: that line is left out.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { deferredCount, useRePlan } from '@/model/dock';
import { useBayQueue, useClaims, useParam } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L33":{"to":"sm-b1-store-later-arrival-notice","kind":"go"},"B":{"to":"ld-01-dock-queue","kind":"back"}}};

const r1 = (n: number) => Math.round(n * 10) / 10;

export default function ScreenLd14RePlanReceived() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const planId = useParam('plan');
  const bay = useBayQueue();
  const depot = bay.data?.depot ?? claims?.depots[0];
  const q = useRePlan(depot, planId);
  const plan = q.data?.plan ?? null;
  // the changed lines: the orders the vehicle that can't depart had in the version before, where they go now
  const moved = new Set(q.data?.moved ?? []);
  const allStops = q.data?.stops ?? [];
  const stops = moved.size ? allStops.filter(st => moved.has(st.orderId)) : allStops;
  const down = q.data?.down[0] ?? null;
  const trips = (q.data?.trips ?? []).filter(t => (t.status === 'PLANNED' || t.status === 'LOADING') && (!moved.size || stops.some(st => st.tripId === t.id)));
  const stopsOf = (id: string) => stops.filter(st => st.tripId === id);
  const going = trips.map(t => ({ t, stops: stopsOf(t.id), m3: stopsOf(t.id).reduce((n, st) => n + (st.order?.m3 ?? 0), 0) }));
  const orders = going.reduce((n, g) => n + g.stops.length, 0);
  const m3 = going.reduce((n, g) => n + g.m3, 0);
  const deferred = deferredCount(plan);
  const at = plan?.publishedAt ?? plan?.approvedAt ?? null;
  const empty = !claims ? 'Sign in to see the re-plan' : q.loading && !q.data ? 'Loading the re-plan…' : 'No re-plan yet';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v47}>
        <View style={s.v9}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            {down ? (
              <Text style={s.t4}><Text style={s.t3}>{down.id}</Text>{` · ${depotName(down.depot)}`}</Text>
            ) : (
              // no vehicle in the workshop: a re-plan for another reason, headed by the depot, not a bare dash
              <Text style={s.t4}><Text style={s.t3}>{depot ? depotName(depot) : 'Re-plan'}</Text></Text>
            )}
          </View>
          {down ? (
            <View style={s.v8}>
              <View style={s.v6} />
              <Text style={s.t7} numberOfLines={1}>{"Can't depart"}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v5} contentStyle={s.v42}>
          <View style={s.v14}>
            <Icon xml={X1} width={20} height={20} style={s.v10} />
            <View style={s.v13}>
              <View>
                <Text style={s.t11} testID="replan-at">{plan ? `Dispatch re-planned${at ? ` ${hm(at)}` : ''}` : empty}</Text>
              </View>
              {plan ? (
                <View>
                  <Text style={s.t12}>{`Plan v${plan.version}${down?.workshopNote ? ` · ${down.workshopNote}` : ''}`}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {plan ? (
            <View style={s.v22}>
              <View>
                <Text style={s.t15}>{[depot ? depotName(depot) : '', down ? `${down.id} is in the workshop` : ''].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={s.v21}>
                <View style={s.v18}>
                  <Text style={s.t17}>{String(orders)}<Text style={s.t16}>{orders === 1 ? 'order to load' : 'orders to load'}</Text></Text>
                </View>
                {deferred !== undefined ? (
                  <View style={s.v20}>
                    <Text style={s.t19} numberOfLines={1}>{`${deferred} deferred`}</Text>
                  </View>
                ) : null}
              </View>
              <View>
                <Text style={s.t12}>{"Goods stay in the cold room until each vehicle is at its bay."}</Text>
              </View>
            </View>
          ) : null}
          {going.length ? (
            <View style={s.v41}>
              <View style={s.v25}>
                <View style={s.v18}>
                  <Text style={s.t23}>{"Where the goods go"}</Text>
                </View>
                <View style={s.v18}>
                  <Text style={s.t24}>{`${r1(m3)} m³`}</Text>
                </View>
              </View>
              <View style={s.v40}>
                {going.map((g, i) => (
                  <View key={g.t.id} style={i === 0 ? s.v37 : s.v39} testID={`goes-${i}`}>
                    <View style={s.v27}>
                      <Text style={s.t26}>{g.t.bay ?? '—'}</Text>
                    </View>
                    <View style={s.v34}>
                      <View>
                        <Text style={s.t29}><Text style={s.t28}>{g.t.vehicleId}</Text>{` · Trip ${g.t.tripNumber} ${g.t.district}`}</Text>
                      </View>
                      <View style={s.v33}>
                        {g.stops.slice(0, 3).map((st, j) => (
                          <View key={st.id} style={x.row}>
                            {j > 0 ? <Text style={s.t31}>{"+"}</Text> : null}
                            <View style={s.v18}>
                              <Text style={s.t30}>{st.outletId}</Text>
                            </View>
                          </View>
                        ))}
                        {g.stops.length > 3 ? <Text style={s.t31}>{`+${g.stops.length - 3}`}</Text> : null}
                        {g.t.departTime ? <View style={s.v32} /> : null}
                        {g.t.departTime ? <Text style={s.t31}>{hm(g.t.departTime)}</Text> : null}
                      </View>
                    </View>
                    <View style={s.v36}>
                      <View>
                        <Text style={s.t35}>{String(r1(g.m3))}</Text>
                      </View>
                      <View>
                        <Text style={s.t15}>{"m³"}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v46}>
          <Tap lk="L33" style={s.v45} to={{ to: 'ld-01-dock-queue', kind: 'nav' }}>
            <Grad g={G0} style={s.v43} />
            <Icon xml={X4} width={22} height={22} style={s.v1} />
            <Text style={s.t44}>{"Got it, back to the dock"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', columnGap: 6 } });

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#b42318","borderRadius":3.5},
  t7: {"color":"#b42318","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#fde8e5","borderRadius":14},
  v9: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v10: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t11: {"color":"#047857","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t12: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v14: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#e3f6ec","borderRadius":18},
  t15: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t16: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t17: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v18: {"flexShrink":1},
  t19: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  v21: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  v22: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  t23: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t24: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v25: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t26: {"color":"#3b4cca","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t28: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t29: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t30: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t31: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v32: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  v33: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t35: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v36: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v37: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#ddf4f9","borderRadius":14},
  v39: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v40: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v43: {"borderRadius":18},
  t44: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v47: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
