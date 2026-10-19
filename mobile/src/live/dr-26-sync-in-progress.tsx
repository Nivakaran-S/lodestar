// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-26 Sync in progress · phone (P4, phone)
// Live: the sync engine's progress over the outbox. Signed out (design preview) it auto-advances like the
// prototype; signed in it moves on to DR-27 only when a finished sync left something to check.
import { useEffect, useMemo, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { openScreen } from '@/lodestar/runtime';
import { useClaims, useOutbox } from '@/model/hooks';
import { itemDetail, labelParts, useNet, useSyncStatus } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"N0":{"to":"dr-01-today-s-run","kind":"nav"},"N1":{"to":"dr-21-records","kind":"nav"},"N2":{"to":"dr-23-dispatch-notices","kind":"nav"}},"auto":{"to":"dr-27-sync-conflict-notice"}};

export default function ScreenDr26SyncInProgress() {
  const claims = useClaims();
  const { items, waiting, synced, attention } = useOutbox();
  const status = useSyncStatus();
  const net = useNet();
  const total = items.length;
  const pct = total ? Math.round((synced.length / total) * 100) : 0;
  const frameNav = useMemo<ScreenNav>(() => (claims ? { links: nav.links } : nav), [claims]);
  const wasRunning = useRef(status.running);
  useEffect(() => {
    if (claims && wasRunning.current && !status.running && attention.length) openScreen('dr-27-sync-conflict-notice');
    wasRunning.current = status.running;
  }, [claims, status.running, attention.length]);
  return (
    <Frame bg="#070b16" nav={frameNav} style={s.v0}>
      <View style={s.v42}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Sync"}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1} testID="sync-state">{status.running ? 'Sending' : waiting.length ? (net.online ? 'Waiting' : 'No signal') : 'Done'}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v38}>
          <View style={s.v19}>
            <View>
              <Text style={s.t8}>{net.online ? `Online since ${hm(net.since)}` : `No signal since ${hm(net.since)}`}{status.lastRunAt ? ` · last sync ${hm(status.lastRunAt)}` : ''}</Text>
            </View>
            <View style={s.v14}>
              <View style={s.v11}>
                <Text style={s.t10} testID="sync-count">{`${synced.length} of ${total}`}<Text style={s.t9}>{"sent"}</Text></Text>
              </View>
              <View style={s.v13}>
                <Text style={s.t12} numberOfLines={1}>{`${waiting.length} waiting`}</Text>
              </View>
            </View>
            <View style={s.v17}>
              <View style={[s.v16, { width: `${pct}%` as `${number}%` }]}>
                <Grad g={G0} style={s.v15} />
              </View>
            </View>
            <View>
              <Text style={s.t18}>{waiting.length && !net.online ? 'Sends by itself when signal returns.' : "No need to wait. It finishes by itself."}</Text>
            </View>
          </View>
          <View style={s.v37}>
            <View style={s.v22}>
              <View style={s.v11}>
                <Text style={s.t20}>{"Sending in this order"}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t21}>{"oldest first"}</Text>
              </View>
            </View>
            <View style={s.v36}>
              {items.length ? (
                items.map((it, i) => {
                  const [head, code] = labelParts(it.label);
                  const sending = it.status === 'sending';
                  const pod = it.kind === 'POD_SAVE';
                  return (
                    <View key={it.id} style={sending ? s.v34 : i === 0 ? s.v30 : s.v31} testID={`sync-row-${i}`}>
                      <View style={pod ? s.v32 : s.v23}>
                        <Icon xml={pod ? X5 : it.kind === 'ARRIVAL' || it.kind === 'LEAVE' ? X2 : X8} width={19} height={19} style={s.v1} />
                      </View>
                      <View style={s.v28}>
                        <View>
                          <Text style={s.t25}>{head}<Text style={s.t24}>{code}</Text></Text>
                        </View>
                        <View style={s.v27}>
                          <Text style={s.t26}>{`${itemDetail(it)}${sending ? ' · sending now' : it.status === 'conflict' || it.status === 'rejected' ? ` · ${it.status === 'conflict' ? 'conflict' : 'refused'}` : ''}`}</Text>
                        </View>
                      </View>
                      {it.status === 'synced' ? (
                        <View style={s.v29}>
                          <Icon xml={X3} width={20} height={20} style={s.v1} />
                        </View>
                      ) : sending ? (
                        <View style={s.v33}>
                          <Icon xml={X6} width={20} height={20} style={s.v1} />
                        </View>
                      ) : (
                        <View style={s.v35}>
                          <Icon xml={X7} width={18} height={18} style={s.v1} />
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={s.v30}>
                  <View style={s.v28}>
                    <Text style={s.t26}>{"Nothing to send"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v41}>
          <Tap lk="N0" style={s.v39}>
            <Icon xml={X9} width={24} height={24} style={s.v1} />
            <Text style={s.t21}>{"Run"}</Text>
          </Tap>
          <Tap lk="N1" style={s.v39}>
            <Icon xml={X10} width={24} height={24} style={s.v1} />
            <Text style={s.t40}>{"Records"}</Text>
          </Tap>
          <Tap lk="N2" style={s.v39}>
            <Icon xml={X11} width={24} height={24} style={s.v1} />
            <Text style={s.t21}>{"Dispatch"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 12a9 9 0 1 1-3-6.7L21 8\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M21 3v5h-5\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 12a9 9 0 1 1-3-6.7L21 8\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M21 3v5h-5\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X11 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#6cc4f5","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0b2233","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t9: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t10: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexShrink":1},
  t12: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v14: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v15: {"borderRadius":4},
  v16: {"flexShrink":1,"width":"43%","borderRadius":4},
  v17: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#1a2340","borderRadius":4,"overflow":"hidden"},
  t18: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v19: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t20: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t24: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t25: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t26: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v27: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#0d2a20","borderRadius":18},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#082b33","borderRadius":12},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#0b2233","borderRadius":18},
  v34: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"backgroundColor":"#161d3d","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v35: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"borderWidth":1,"borderColor":"#3b4666","borderStyle":"dashed","borderRadius":18},
  v36: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v37: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v39: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  t40: {"color":"#f5b83d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v41: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#0b1122","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v42: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
