// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-27 Sync conflict notice · phone (P4, phone)
// Live: outbox writes that need attention (server conflict notes, refusals); "Got it" acknowledges them,
// a refused write can be discarded.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { useOutbox, useRun } from '@/model/hooks';
import { queue } from '@/model/platform';
import { labelParts } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L273":{"to":"dr-04-run-complete","kind":"go"},"B":{"to":"dr-23-dispatch-notices","kind":"back"}}};

export default function ScreenDr27SyncConflictNotice() {
  const { view } = useRun();
  const { attention, waiting } = useOutbox();
  const first = attention[0];
  const kept = first?.status === 'synced';
  const stopOf = (ref?: string) => view?.stops.find(x => x.id === ref);
  const firstStop = stopOf(first?.ref);
  const [head, code] = first ? labelParts(first.label) : ['', ''];
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v40}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Sync"}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1} testID="attention-count">{first ? (kept && attention.length === 1 ? `Resolved ${hm(first.syncedAt)}` : `${attention.length} to check`) : 'Nothing to check'}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v33}>
          <View style={s.v12}>
            {first ? (
              <View>
                <Text style={s.t9}>{`${firstStop?.outlet?.name ?? head.replace(/ · $/, '')} · `}<Text style={s.t8}>{firstStop?.orderId ?? code}</Text></Text>
              </View>
            ) : null}
            <View>
              <Text style={s.t10}>{!first ? 'Nothing needs you' : kept ? 'Your delivery record was kept' : 'This record was not accepted'}</Text>
            </View>
            <View>
              <Text style={s.t11}>{!first ? 'Every record from this phone went through as saved.' : first.conflict ?? (kept ? 'Dispatch changed this while you had no signal. Nothing for you to do.' : 'The server refused it. Discard it, or tell dispatch.')}</Text>
            </View>
          </View>
          <View style={s.v27}>
            <View style={s.v15}>
              <View style={s.v14}>
                <Text style={s.t13}>{"What happened"}</Text>
              </View>
            </View>
            <View style={s.v26}>
              {attention.length ? (
                attention.map((it, i) => {
                  const ok = it.status === 'synced';
                  return (
                    <View key={it.id} style={i === 0 ? s.v23 : s.v25} testID={`attention-row-${i}`}>
                      <View style={ok ? s.v24 : s.v16}>
                        <Icon xml={ok ? X3 : X2} width={22} height={22} style={s.v1} />
                      </View>
                      <View style={s.v20}>
                        <View>
                          <Text style={s.t17}>{`${it.label} · ${hm(it.savedAt)}`}</Text>
                        </View>
                        <View style={s.v19}>
                          <Text style={s.t18}>{it.conflict ?? it.lastError ?? (ok ? 'Applied with a change' : 'Not accepted')}</Text>
                        </View>
                      </View>
                      {ok ? (
                        <View style={s.v22}>
                          <Icon xml={X1} width={14} height={14} style={s.v1} />
                          <Text style={s.t9} numberOfLines={1}>{"Kept"}</Text>
                        </View>
                      ) : (
                        <Tap style={s.v22} to={null} testID={`discard-${i}`} onPress={() => queue.discard(it.id)}>
                          <Text style={s.t21} numberOfLines={1}>{"Discard"}</Text>
                        </Tap>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={s.v23}>
                  <View style={s.v24}>
                    <Icon xml={X3} width={22} height={22} style={s.v1} />
                  </View>
                  <View style={s.v20}>
                    <Text style={s.t18}>{"No conflicts"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <View style={s.v32}>
            <View style={s.v30}>
              <View style={s.v14}>
                <Text style={s.t28}>{firstStop ? 'Order' : 'To check'}</Text>
              </View>
              <View style={s.v14}>
                <Text style={s.t29}>{firstStop ? titleCase(firstStop.status) : plural(attention.length, 'record')}</Text>
              </View>
            </View>
            <View style={s.v31}>
              <View style={s.v14}>
                <Text style={s.t28}>{"Still on this phone"}</Text>
              </View>
              <View style={s.v14}>
                <Text style={s.t29}>{plural(waiting.length, 'record')}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v39}>
          <Tap
            lk="L273"
            style={s.v36}
            to={view ? (view.current ? 'dr-01-today-s-run' : 'dr-04-run-complete') : undefined}
            onPress={() => queue.acknowledge(attention.map(i => i.id))}
          >
            <Grad g={G0} style={s.v34} />
            <Text style={s.t35}>{"Got it"}</Text>
          </Tap>
          <View style={s.v38}>
            <Text style={s.t37}>{"A signed delivery always beats an offline plan change."}</Text>
          </View>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M16 2v4M8 2v4M3 10h18\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"color":"#f2f4fa","fontSize":32,"lineHeight":35.2,"letterSpacing":-1,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t11: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v12: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#0d2a20","borderRadius":24},
  t13: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v14: {"flexShrink":1},
  v15: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v16: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#1a2340","borderRadius":14},
  t17: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t18: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v19: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v20: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t21: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#0d2a20","borderRadius":14},
  v25: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v26: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  t28: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  t29: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  v31: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v34: {"borderRadius":18},
  t35: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t37: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":6,"columnGap":6},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v40: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
