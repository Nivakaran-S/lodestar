// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-19 Stop 2 arrival · Hawa Eliya · phone (P4, phone)
// Live: the stop after the current one (or route param `stop`), same behaviour as DR-02.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { arriveAtStop } from '@/model/actions';
import { isUnsent, useOutbox, useStop } from '@/model/hooks';
import { stopGroup } from '@/model/run';
import { LATE_RISK_PCT } from '@/model/preferences';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L19":{"to":"dr-20-stop-2-proof-of-delivery","kind":"go"},"L259":{"to":"dr-17-report-a-problem","kind":"go"},"B":{"to":"dr-36-en-route-driving-mode","kind":"back"}}};

export default function ScreenDr19Stop2ArrivalHawaEliya() {
  const { stop, view, lines } = useStop(1);
  const { waiting } = useOutbox();
  const o = stop?.outlet;
  const order = stop?.order;
  const total = view?.tripStops.length ?? 0;
  const arrived = stop?.arrivalActual;
  const unsent = isUnsent(waiting, stop?.id);
  const late = (stop?.lateRiskPct ?? 0) >= LATE_RISK_PCT;
  // every order dropped at this stop (e.g. chilled + dry), chilled first; delivery starts with the first one still open
  const group = stopGroup(view?.tripStops ?? [], stop);
  const first = group.find(r => r.status !== 'DELIVERED') ?? stop;
  const chilled = group.some(r => r.order?.tempClass === 'CHILLED');
  const access = o ? [titleCase(o.dockType), titleCase(o.parking) ? `${titleCase(o.parking)} parking` : ''].filter(Boolean).join(' · ') : '';
  const params = stop ? { stop: stop.id } : undefined;
  const podParams = first ? { stop: first.id } : undefined;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v48}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{stop ? `Stop ${stop.stopSeq} of ${total}` : 'Stop'}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1} testID="outbox-chip">{`${waiting.length} waiting`}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v41}>
          <View style={s.v21}>
            <View>
              <Text style={s.t9}>{stop ? `Stop ${stop.stopSeq} · ${o ? `Waypoint ${titleCase(o.brand)}` : 'Outlet'} · ` : ''}<Text style={s.t8}>{stop?.outletId ?? '—'}</Text></Text>
            </View>
            <View>
              <Text style={s.t10} testID="stop-outlet">{o?.name ?? '—'}</Text>
            </View>
            <View style={s.v17}>
              <View style={s.v13}>
                <Text style={s.t12}>{"Window "}<Text style={s.t11}>{o ? `${o.windowOpen}–${o.windowClose}` : '—'}</Text></Text>
              </View>
              <View style={s.v16}>
                <View style={s.v14} />
                <Text style={s.t15} numberOfLines={1}>{late ? `Late risk ${stop?.lateRiskPct}%` : 'In window'}</Text>
              </View>
            </View>
            <View style={s.v20}>
              <Icon xml={X2} width={16} height={16} style={s.v1} />
              <View style={s.v13}>
                <Text style={s.t19}>{arrived ? 'Arrived ' : 'ETA '}<Text style={s.t18}>{arrived ? hm(arrived) : stop?.etaModel ? `~${hm(stop.etaModel)}` : '—'}</Text>{arrived ? (unsent ? ' · saved on this phone' : ' · time saved') : ' · arrival is saved when you start'}</Text>
              </View>
            </View>
          </View>
          <View style={s.v32}>
            <View style={s.v24}>
              <View style={s.v13}>
                <Text style={s.t22}>{"Where to unload"}</Text>
              </View>
              <View style={s.v13}>
                <Text style={s.t23}>{"written by the store"}</Text>
              </View>
            </View>
            <View style={s.v31}>
              <View style={s.v30}>
                <View style={s.v25}>
                  <Icon xml={X3} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v29}>
                  <View>
                    <Text style={s.t26}>{access || '—'}</Text>
                  </View>
                  <View style={s.v28}>
                    <Text style={s.t27}>{o?.accessNote ?? 'No access note from the store'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v32}>
            <View style={s.v24}>
              <View style={s.v13}>
                <Text style={s.t22}>{group.length ? `To drop · ${plural(group.length, 'order')}` : 'To drop'}</Text>
              </View>
              {chilled ? (
                <View style={s.v34}>
                  <Icon xml={X4} width={14} height={14} style={s.v1} />
                  <Text style={s.t33} numberOfLines={1}>{"Chilled"}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.v31}>
              {group.some(r => r.order) ? (
                group.map((r, i) => {
                  const ro = r.order;
                  if (!ro) return null;
                  const cold = ro.tempClass === 'CHILLED';
                  const n = r.orderId === order?.id ? lines.length : 0;
                  return (
                    <View key={r.id} style={i === 0 ? s.v30 : [s.v30, x.rowLine]} testID={`drop-${r.orderId}`}>
                      <View style={cold ? s.v35 : s.v25}>
                        <Icon xml={cold ? X5 : X3} width={22} height={22} style={s.v1} />
                      </View>
                      <View style={s.v29}>
                        <View>
                          <Text style={s.t26}>{cold ? 'Chilled' : 'Dry'}</Text>
                        </View>
                        <View style={s.v28}>
                          <View style={s.v13}>
                            <Text style={s.t36}>{ro.id}</Text>
                          </View>
                          <View style={s.v37} />
                          <Text style={s.t27}>{r.status === 'DELIVERED' ? 'delivered' : n ? plural(n, 'line') : cold ? 'chilled' : 'ambient'}</Text>
                        </View>
                      </View>
                      <View style={s.v40}>
                        <View>
                          <Text style={s.t38}>{String(ro.units)}</Text>
                        </View>
                        <View>
                          <Text style={s.t39}>{"units"}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={s.v30}>
                  <Text style={s.t27}>{"—"}</Text>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v47}>
          <Tap
            lk="L19"
            style={s.v44}
            to={podParams ? { to: 'dr-20-stop-2-proof-of-delivery', params: podParams } : undefined}
            onPress={async () => {
              // arriving here: TripStops Arrive for the stop's orders (queued, sent with the next sync)
              for (const r of group) if (!r.arrivalActual && r.status !== 'DELIVERED') await arriveAtStop(r);
            }}
          >
            <Grad g={G0} style={s.v42} />
            <Text style={s.t43}>{group.length && group.every(r => r.status === 'DELIVERED') ? 'View delivery' : "Start delivery"}</Text>
            <Icon xml={X6} width={22} height={22} style={s.v1} />
          </Tap>
          <Tap lk="L259" style={s.v46} to={params ? { to: 'dr-17-report-a-problem', params } : undefined}>
            <Icon xml={X7} width={18} height={18} style={s.v1} />
            <Text style={s.t45}>{"Report a problem at this stop"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 17V7a2 2 0 0 1 2-2h10l4 5h1a2 2 0 0 1 2 2v5h-2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 17h6\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"7\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"17\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M15 5v5h4\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const x = StyleSheet.create({ rowLine: { borderTopWidth: 1, borderTopColor: '#1b2338' } });

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"color":"#f2f4fa","fontSize":40,"lineHeight":42,"letterSpacing":-1.2,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t11: {"color":"#f2f4fa","fontVariant":["tabular-nums"],"fontFamily":"JetBrainsMono_700Bold"},
  t12: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexShrink":1},
  v14: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#5ee0a8","borderRadius":3.5},
  t15: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t18: {"color":"#f2f4fa","fontFamily":"Inter_700Bold"},
  t19: {"color":"#b5bdd1","fontSize":14,"lineHeight":21,"fontFamily":"Inter_600SemiBold"},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t22: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t23: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v24: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v25: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t26: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t27: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v28: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v29: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v31: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  t33: {"color":"#67e3f9","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v34: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v35: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#082b33","borderRadius":14},
  t36: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v37: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t38: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t39: {"color":"#7f89a3","fontSize":13,"lineHeight":16,"fontFamily":"Inter_600SemiBold"},
  v40: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":8},
  v42: {"borderRadius":18},
  t43: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v44: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t45: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v46: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v47: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v48: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
