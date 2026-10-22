// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-35 Stop arrival · speaking (P4, phone)
// The current stop (route param `stop`, else the run's current stop: useStop, as DR-02) read aloud with the phone's
// voice in the app language (expo-speech): outlet, window, access and note, what to drop. It speaks by itself on
// open when read aloud is on; the speaking bar stops it and goes back to the stop; a tap on the spoken text replays
// it. The words are the stop's own (English text, spoken in the chosen language's voice).
import { useEffect, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useSettings, LANGUAGE_NAMES } from '@/lib/settings';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { speakIn, stopSpeaking, useSpeaking } from '@/lodestar/voice';
import { arriveAtStop } from '@/model/actions';
import { isUnsent, useOutbox, useStop } from '@/model/hooks';
import { stopGroup } from '@/model/run';
import { LATE_RISK_PCT } from '@/model/preferences';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L281":{"to":"dr-02-stop-arrival","kind":"go"},"L282":{"to":"dr-03-proof-of-delivery","kind":"go"},"L283":{"to":"dr-17-report-a-problem","kind":"go"},"B":{"to":"dr-02-stop-arrival","kind":"back"}}};

export default function ScreenDr35StopArrivalSpeaking() {
  const { stop, view, lines } = useStop();
  const { waiting } = useOutbox();
  const { language, readAloud } = useSettings();
  const speaking = useSpeaking();
  const o = stop?.outlet;
  const order = stop?.order;
  const total = view?.tripStops.length ?? 0;
  const arrived = stop?.arrivalActual;
  const unsent = isUnsent(waiting, stop?.id);
  const late = (stop?.lateRiskPct ?? 0) >= LATE_RISK_PCT;
  // every order dropped at this stop, chilled first (as DR-02)
  const group = stopGroup(view?.tripStops ?? [], stop);
  const first = group.find(r => r.status !== 'DELIVERED') ?? stop;
  const chilled = group.some(r => r.order?.tempClass === 'CHILLED');
  const access = o ? [titleCase(o.dockType), titleCase(o.parking) ? `${titleCase(o.parking)} parking` : ''].filter(Boolean).join(' · ') : '';
  const lead = stop ? `${o?.name ?? stop.outletId}, ${stop.outletId}.` : '';
  const rest = stop
    ? [
        o ? `Window ${o.windowOpen} to ${o.windowClose}.` : '',
        access ? `${access}.` : '',
        o?.accessNote ? `${o.accessNote}.` : '',
        group.some(r => r.order)
          ? `To drop: ${group.filter(r => r.order).map(r => `${r.order!.tempClass === 'CHILLED' ? 'chilled' : 'dry'} order ${r.order!.id}, ${plural(r.order!.units, 'unit')}`).join('; then ')}.`
          : '',
      ].filter(Boolean).join(' ')
    : '';
  const say = stop ? `Stop ${stop.stopSeq}, ${lead} ${rest}` : '';

  // speaks by itself once per stop when read aloud is on; stops when the screen closes
  const spokenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!readAloud || !say || !stop || spokenFor.current === stop.id) return;
    spokenFor.current = stop.id;
    speakIn(say, language);
  }, [readAloud, say, stop, language]);
  useEffect(() => () => stopSpeaking(), []);

  const params = stop ? { stop: stop.id } : undefined;
  const podParams = first ? { stop: first.id } : undefined;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v66}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2} to={params ? { to: 'dr-02-stop-arrival', params, kind: 'back' } : undefined} onPress={stopSpeaking}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{stop ? `Stop ${stop.stopSeq} of ${total}` : 'Stop'}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1}>{unsent ? 'Saved on phone' : stop?.status === 'DELIVERED' ? 'Delivered' : arrived ? 'Arrived' : 'On the way'}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v59}>
          <View style={s.v35}>
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
            <Tap lk="L281" style={s.v29} to={params ? { to: 'dr-02-stop-arrival', params } : undefined} onPress={stopSpeaking}>
              <View style={s.v28}>
                <Icon xml={X3} width={20} height={20} style={s.v1} />
                <Text style={s.t21} numberOfLines={1}>{speaking ? "Speaking ·" : "Read aloud ·"}</Text>
                <View style={s.v13}>
                  <Text style={[s.t23, x[language]]} numberOfLines={1}>{LANGUAGE_NAMES[language]}</Text>
                </View>
                {speaking ? (
                  <View style={s.v27}>
                    <View style={s.v24} />
                    <View style={s.v25} />
                    <View style={s.v26} />
                  </View>
                ) : null}
              </View>
            </Tap>
            <Tap to={null} group style={s.v34} disabled={!say} onPress={() => { speakIn(say, language); return false; }} testID="replay">
              <View style={s.v13}>
                <Text style={[s.t33, x.body]} testID="spoken-text">{stop ? <><Text style={s.t31}>{`Stop ${stop.stopSeq}, `}</Text><Text style={[s.t32, x.bold]}>{lead}</Text>{` ${rest}`}</> : 'No stop loaded yet.'}</Text>
              </View>
            </Tap>
          </View>
          <View style={s.v49}>
            <View style={s.v38}>
              <View style={s.v13}>
                <Text style={s.t36}>{"Where to unload"}</Text>
              </View>
              <View style={s.v13}>
                <Text style={s.t37}>{"written by the store"}</Text>
              </View>
            </View>
            <View style={s.v48}>
              <View style={s.v44}>
                <View style={s.v39}>
                  <Icon xml={X4} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v43}>
                  <View>
                    <Text style={s.t40}>{access || '—'}</Text>
                  </View>
                  <View style={s.v42}>
                    <Text style={s.t41}>{o?.accessNote ?? 'No access note from the store'}</Text>
                  </View>
                </View>
              </View>
              {o?.address ? (
                <View style={s.v47}>
                  <View style={s.v39}>
                    <Icon xml={X5} width={22} height={22} style={s.v1} />
                  </View>
                  <View style={s.v43}>
                    <View>
                      <Text style={s.t40}>{o.address}</Text>
                    </View>
                    <View style={s.v42}>
                      <Text style={s.t41}>{o.district}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.v49}>
            <View style={s.v38}>
              <View style={s.v13}>
                <Text style={s.t36}>{group.length ? `To drop · ${plural(group.length, 'order')}` : 'To drop'}</Text>
              </View>
              {chilled ? (
                <View style={s.v51}>
                  <Icon xml={X7} width={14} height={14} style={s.v1} />
                  <Text style={s.t50} numberOfLines={1}>{"Chilled first"}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.v48}>
              {group.some(r => r.order) ? (
                group.map((r, i) => {
                  const ro = r.order;
                  if (!ro) return null;
                  const cold = ro.tempClass === 'CHILLED';
                  const n = r.orderId === order?.id ? lines.length : 0;
                  return (
                    <View key={r.id} style={i === 0 ? s.v44 : [s.v44, x.rowLine]}>
                      <View style={cold ? s.v52 : s.v39}>
                        <Icon xml={cold ? X8 : X9} width={22} height={22} style={s.v1} />
                      </View>
                      <View style={s.v43}>
                        <View>
                          <Text style={s.t40}>{cold ? 'Chilled' : 'Dry'}</Text>
                        </View>
                        <View style={s.v42}>
                          <View style={s.v13}>
                            <Text style={s.t53}>{ro.id}</Text>
                          </View>
                          <View style={s.v54} />
                          <Text style={s.t41}>{r.status === 'DELIVERED' ? 'delivered' : n ? plural(n, 'line') : cold ? 'chilled' : 'ambient'}</Text>
                        </View>
                      </View>
                      <View style={s.v57}>
                        <View>
                          <Text style={s.t55}>{String(ro.units)}</Text>
                        </View>
                        <View>
                          <Text style={s.t56}>{"units"}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={s.v44}>
                  <Text style={s.t41}>{"—"}</Text>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v65}>
          <Tap
            lk="L282"
            style={s.v62}
            to={podParams ? { to: 'dr-03-proof-of-delivery', params: podParams } : undefined}
            onPress={async () => {
              stopSpeaking();
              // arriving here: TripStops Arrive for the stop's orders (queued, as DR-02)
              for (const r of group) if (!r.arrivalActual && r.status !== 'DELIVERED') await arriveAtStop(r);
            }}
          >
            <Grad g={G0} style={s.v60} />
            <Text style={s.t61}>{group.length && group.every(r => r.status === 'DELIVERED') ? 'View delivery' : "Start delivery"}</Text>
            <Icon xml={X10} width={22} height={22} style={s.v1} />
          </Tap>
          <Tap lk="L283" style={s.v64} to={params ? { to: 'dr-17-report-a-problem', params } : undefined} onPress={stopSpeaking}>
            <Icon xml={X11} width={18} height={18} style={s.v1} />
            <Text style={s.t63}>{"Report a problem at this stop"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  body: { fontFamily: 'Inter_400Regular' },
  bold: { fontFamily: 'Inter_700Bold' },
  en: { fontFamily: 'Inter_700Bold' },
  si: { fontFamily: 'NotoSansSinhala_700Bold' },
  ta: { fontFamily: 'NotoSansTamil_700Bold' },
  rowLine: { borderTopWidth: 1, borderTopColor: '#1b2338' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 17V7a2 2 0 0 1 2-2h10l4 5h1a2 2 0 0 1 2 2v5h-2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 17h6\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"7\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"17\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M15 5v5h4\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"8\" r=\"4\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M4 21a8 8 0 0 1 16 0\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X11 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
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
  t8: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"color":"#f2f4fa","fontSize":38,"lineHeight":39.9,"letterSpacing":-1.1,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
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
  t21: {"color":"#f2f4fa","fontSize":15,"lineHeight":15,"fontFamily":"Inter_700Bold"},
  t22: {"fontFamily":"NotoSansSinhala_700Bold"},
  t23: {"color":"#f2f4fa","fontSize":15,"lineHeight":15,"fontFamily":"NotoSansSinhala_700Bold"},
  v24: {"flexShrink":1,"width":3,"height":6,"backgroundColor":"#ffcb5c","borderRadius":1.5},
  v25: {"flexShrink":1,"width":3,"height":13,"backgroundColor":"#ffcb5c","borderRadius":1.5},
  v26: {"flexShrink":1,"width":3,"height":9,"backgroundColor":"#ffcb5c","borderRadius":1.5},
  v27: {"flexDirection":"row","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0,"height":14},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":16,"paddingLeft":14,"height":48,"backgroundColor":"#2e2208","borderRadius":24,"boxShadow":"rgb(245, 184, 61) 0px 0px 0px 1.5px inset"},
  v29: {"flexDirection":"row","justifyContent":"flex-end","alignItems":"center","rowGap":10,"columnGap":10},
  t30: {"fontFamily":"NotoSansSinhala_400Regular"},
  t31: {"color":"#b5bdd1","letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t32: {"color":"#f2f4fa","fontFamily":"NotoSansSinhala_700Bold"},
  t33: {"color":"#7f89a3","fontSize":13,"lineHeight":18.9,"fontFamily":"NotoSansSinhala_400Regular"},
  v34: {"flexDirection":"row","alignItems":"stretch","paddingTop":1,"paddingBottom":1,"paddingLeft":11,"boxShadow":"rgb(245, 184, 61) 3px 0px 0px 0px inset"},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":5,"columnGap":5,"flexShrink":0,"paddingTop":10,"paddingRight":20,"marginRight":16,"paddingBottom":10,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t36: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t37: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v38: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v39: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t40: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t41: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v42: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":58},
  t45: {"color":"#f2f4fa","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  v46: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":18,"paddingLeft":18,"height":56,"backgroundColor":"#1a2340","borderRadius":16},
  v47: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":4,"paddingRight":16,"paddingBottom":4,"paddingLeft":16,"minHeight":58,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v48: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v49: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexShrink":0},
  t50: {"color":"#67e3f9","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v51: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v52: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#082b33","borderRadius":14},
  t53: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v54: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t55: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t56: {"color":"#7f89a3","fontSize":13,"lineHeight":16,"fontFamily":"Inter_600SemiBold"},
  v57: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v58: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":58,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v59: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"paddingTop":4,"paddingBottom":8},
  v60: {"borderRadius":18},
  t61: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v62: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t63: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v64: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v65: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexShrink":0,"paddingTop":8,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v66: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
