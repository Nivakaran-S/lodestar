// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-A2 POD saved offline (P5, phone)
// Live: route param `stop` → that stop's POD_SAVE write in the outbox; the rest of the outbox below.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { useOutbox, useStop } from '@/model/hooks';
import { itemDetail, labelParts, useNet } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L24":{"app":"Lodestar Plan (desktop)","screen":"DSP-A1 Blackout view"},"B":{"to":"dr-a1-offline-run","kind":"back"}}};

export default function ScreenDrA2PodSavedOffline() {
  const { stop, view } = useStop();
  const { items, waiting, syncing } = useOutbox();
  const net = useNet();
  const podItem = stop ? items.filter(i => i.kind === 'POD_SAVE' && i.ref === stop.id).at(-1) : undefined;
  const sent = podItem?.status === 'synced';
  const next = view?.current ?? null;
  const seq = stop && view ? view.tripStops.indexOf(stop) + 1 : 0;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v44}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{stop ? `Stop ${seq || stop.stopSeq} · ${stop.outlet?.name ?? stop.outletId}` : 'Stop'}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1} testID="outbox-waiting">{`${waiting.length} waiting`}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v38}>
          <View style={s.v16}>
            <View style={s.v12}>
              <View style={s.v8}>
                <Icon xml={X2} width={18} height={18} style={s.v1} />
              </View>
              <View style={s.v11}>
                <Text style={s.t10}><Text style={s.t9}>{stop?.outletId ?? '—'}</Text>{" · proof of delivery recorded"}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t14} testID="pod-saved-at">{sent ? 'Sent' : 'Saved on phone'}{"\n"}<Text style={s.t13}>{podItem ? `at ${hm(sent ? podItem.syncedAt : podItem.savedAt)}` : stop?.pod ? `at ${hm(stop.pod.savedAt)}` : '—'}</Text></Text>
            </View>
            <View>
              <Text style={s.t15}>{sent ? 'The server has it. Nothing else to do.' : podItem?.status === 'conflict' || podItem?.status === 'rejected' ? `Needs a look: ${podItem.conflict ?? 'not accepted'}` : 'Will sync by itself when signal returns. Nothing else to do.'}</Text>
            </View>
          </View>
          <View style={s.v32}>
            <View style={s.v20}>
              <View style={s.v11}>
                <Text style={s.t17}>{`Waiting to sync · ${waiting.length}`}</Text>
              </View>
              <View style={s.v19}>
                <Icon xml={X3} width={14} height={14} style={s.v1} />
                <Text style={s.t18} numberOfLines={1}>{syncing ? 'Sending' : waiting.length ? 'All queued' : 'Nothing waiting'}</Text>
              </View>
            </View>
            <View style={s.v31}>
              {waiting.length ? (
                waiting.map((it, i) => {
                  const [head, code] = labelParts(it.label);
                  const icon = it.kind === 'ARRIVAL' || it.kind === 'LEAVE' ? X4 : it.kind === 'POD_SAVE' ? (it.ref === stop?.id ? X6 : X5) : X7;
                  return (
                    <View key={it.id} style={i === 0 ? s.v27 : s.v29} testID={`waiting-row-${i}`}>
                      <View style={it.ref === stop?.id && it.kind === 'POD_SAVE' ? s.v30 : s.v21}>
                        <Icon xml={icon} width={18} height={18} style={s.v1} />
                      </View>
                      <View style={s.v26}>
                        <View>
                          <Text style={s.t23}>{head}<Text style={s.t22}>{code}</Text></Text>
                        </View>
                        <View style={s.v25}>
                          <Text style={s.t24}>{`${itemDetail(it)} · saved ${hm(it.savedAt)}`}</Text>
                        </View>
                      </View>
                      <View style={s.v19}>
                        <Icon xml={X3} width={14} height={14} style={s.v1} />
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={s.v27}>
                  <View style={s.v26}>
                    <Text style={s.t24}>{"Everything on this phone has been sent"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <View style={s.v37}>
            <Icon xml={X8} width={20} height={20} style={s.v33} />
            <View style={s.v36}>
              <View>
                <Text style={s.t34}>{net.online ? `Online since ${hm(net.since)}` : `No signal since ${hm(net.since)}`}</Text>
              </View>
              <View>
                <Text style={s.t35}>{"Kept safe through a restart until the server confirms."}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v43}>
          <Tap lk="L24" style={s.v41} to={view ? (next ? 'dr-36-en-route-driving-mode' : 'dr-04-run-complete') : undefined}>
            <Grad g={G0} style={s.v39} />
            <Icon xml={X9} width={22} height={22} style={s.v1} />
            <Text style={s.t40}>{next ? `Next: ${next.outlet?.name ?? next.outletId}${next.etaModel ? ` · ${hm(next.etaModel)}` : ''}` : view ? 'Run complete' : 'Next stop'}</Text>
          </Tap>
          <View>
            <Text style={s.t42}>{"The store gets its receipt as soon as this syncs"}</Text>
          </View>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#07140f\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#07140f\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v8: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":32,"height":32,"backgroundColor":"#5ee0a8","borderRadius":16},
  t9: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t10: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v11: {"flexShrink":1},
  v12: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10},
  t13: {"color":"#5ee0a8"},
  t14: {"color":"#f2f4fa","fontSize":34,"lineHeight":36.7,"letterSpacing":-1,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t15: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"paddingTop":18,"paddingRight":20,"marginRight":16,"paddingBottom":18,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t17: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t18: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v19: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v20: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v21: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#1a2340","borderRadius":12},
  t22: {"fontSize":14,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t23: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t24: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v25: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v27: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":54},
  t28: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_700Bold"},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":54,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v30: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#082b33","borderRadius":12},
  v31: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  v33: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t34: {"color":"#d6cfc7","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t35: {"color":"#7f89a3","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v37: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":4,"paddingBottom":16},
  v39: {"borderRadius":18},
  t40: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t42: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v44: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
