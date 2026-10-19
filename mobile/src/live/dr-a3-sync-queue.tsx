// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-A3 Sync queue (P5, phone)
// Live: the phone's outbox in sending order, with a "send now" (sync.flush) control.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { showToast } from '@/lodestar/runtime';
import { useOutbox } from '@/model/hooks';
import { itemDetail, itemMix, itemState, labelParts, sendNow, useNet } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"N0":{"to":"dr-01-today-s-run","kind":"nav"},"N1":{"to":"dr-21-records","kind":"nav"},"N2":{"to":"dr-23-dispatch-notices","kind":"nav"}},"auto":{"app":"Lodestar Plan (desktop)","screen":"DSP-A2 Reconcile conflict"}};

export default function ScreenDrA3SyncQueue() {
  const { items, waiting, synced, syncing } = useOutbox();
  const net = useNet();
  const total = items.length;
  const pct = total ? Math.round((synced.length / total) * 100) : 100;
  const noted = items.filter(i => i.conflict).at(-1);
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v48}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Sync"}</Text>
          </View>
          <Tap
            style={s.v6}
            testID="send-now"
            to={null}
            disabled={syncing}
            onPress={async () => {
              showToast(await sendNow());
            }}
          >
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1}>{syncing ? 'Sending…' : waiting.length ? 'Send now' : 'All synced'}</Text>
          </Tap>
        </View>
        <Scroll style={s.v4} contentStyle={s.v44}>
          <View style={s.v17}>
            <View>
              <Text style={s.t8}>{net.online ? `Online since ${hm(net.since)}` : `No signal since ${hm(net.since)} · records stay on this phone`}</Text>
            </View>
            <View style={s.v12}>
              <View style={s.v11}>
                <Text style={s.t10} testID="outbox-synced">{`${synced.length} of ${total}`}<Text style={s.t9}>{"synced"}</Text></Text>
              </View>
              <View style={s.v6}>
                <Text style={s.t5} numberOfLines={1} testID="outbox-waiting">{`${waiting.length} waiting`}</Text>
              </View>
            </View>
            <View style={s.v15}>
              <View style={[s.v14, { width: `${pct}%` as `${number}%` }]}>
                <Grad g={G0} style={s.v13} />
              </View>
            </View>
            <View>
              <Text style={s.t16}>{total ? `${itemMix(items)} · oldest first` : 'Nothing saved on this phone'}</Text>
            </View>
          </View>
          {noted ? (
            <View style={s.v22}>
              <Icon xml={X2} width={20} height={20} style={s.v18} />
              <View style={s.v21}>
                <View>
                  <Text style={s.t20}>{labelParts(noted.label)[0]}<Text style={s.t19}>{labelParts(noted.label)[1]}</Text>{`: ${noted.conflict}`}</Text>
                </View>
                <View>
                  <Text style={s.t16}>{noted.status === 'synced' ? `Resolved ${hm(noted.syncedAt)}. Nothing for you to do.` : 'Not accepted. Check it on the conflict screen.'}</Text>
                </View>
              </View>
            </View>
          ) : null}
          <View style={s.v40}>
            <View style={s.v25}>
              <View style={s.v11}>
                <Text style={s.t23}>{"Sent in this order"}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t24}>{"oldest first"}</Text>
              </View>
            </View>
            <View style={s.v39}>
              {items.length ? (
                items.map((it, i) => {
                  const [head, code] = labelParts(it.label);
                  const warn = !!it.conflict || it.status === 'conflict' || it.status === 'rejected';
                  const box = warn ? s.v36 : it.kind === 'POD_SAVE' ? s.v35 : s.v26;
                  const icon = warn ? X6 : it.kind === 'POD_SAVE' ? X5 : X3;
                  return (
                    <View key={it.id} style={i === 0 ? s.v33 : s.v34} testID={`outbox-row-${i}`}>
                      <View style={box}>
                        <Icon xml={icon} width={18} height={18} style={s.v1} />
                      </View>
                      <View style={s.v31}>
                        <View>
                          <Text style={s.t28}>{head}<Text style={s.t27}>{code}</Text></Text>
                        </View>
                        <View style={s.v30}>
                          <Text style={s.t29}>{`${itemDetail(it)} · saved ${hm(it.savedAt)}`}</Text>
                          {warn ? (
                            <>
                              <View style={s.v37} />
                              <View style={s.v32}>
                                <Text style={s.t38} numberOfLines={1}>{it.status === 'synced' ? 'heads-up' : itemState(it)}</Text>
                              </View>
                            </>
                          ) : null}
                        </View>
                      </View>
                      <View style={s.v32}>
                        {it.status === 'synced' ? <Icon xml={X1} width={14} height={14} style={s.v1} /> : null}
                        <Text style={s.t8} numberOfLines={1}>{it.status === 'synced' ? hm(it.syncedAt) || 'sent' : itemState(it)}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={s.v33}>
                  <View style={s.v31}>
                    <Text style={s.t29}>{"No records waiting or sent from this phone"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v47}>
          <Tap lk="N0" style={s.v45}>
            <Icon xml={X9} width={24} height={24} style={s.v1} />
            <Text style={s.t24}>{"Run"}</Text>
          </Tap>
          <Tap lk="N1" style={s.v45}>
            <Icon xml={X10} width={24} height={24} style={s.v1} />
            <Text style={s.t46}>{"Records"}</Text>
          </Tap>
          <Tap lk="N2" style={s.v45}>
            <Icon xml={X11} width={24} height={24} style={s.v1} />
            <Text style={s.t24}>{"Dispatch"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3M21 3l-7.83 7.83\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X11 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#10b981","p":0},{"c":"#047857","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t9: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t10: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexShrink":1},
  v12: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v13: {"borderRadius":4},
  v14: {"flexShrink":1,"width":"100%","borderRadius":4},
  v15: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#1a2340","borderRadius":4,"overflow":"hidden"},
  t16: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#0d2a20","borderRadius":24},
  v18: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t19: {"color":"#b5bdd1","letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t20: {"color":"#ffc266","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v22: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#2e2208","borderRadius":18},
  t23: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t24: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v25: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v26: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#1a2340","borderRadius":12},
  t27: {"fontSize":14,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t28: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v30: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v31: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":54},
  v34: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":54,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v35: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#082b33","borderRadius":12},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#2e2208","borderRadius":12},
  v37: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t38: {"color":"#ffc266","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v39: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#1a2340","borderRadius":14},
  t42: {"color":"#5ee0a8","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v43: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v44: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":4,"paddingBottom":16},
  v45: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  t46: {"color":"#f5b83d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v47: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#0b1122","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v48: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
