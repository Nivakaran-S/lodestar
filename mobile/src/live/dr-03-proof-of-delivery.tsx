// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-03 Proof of delivery (P4, phone)
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { Fragment, useCallback, useState } from 'react';
import { hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { showToast } from '@/lodestar/runtime';
import { completeStop, queuePodSignature } from '@/model/actions';
import { SignaturePad } from '@/lodestar/signature';
import { afterPod } from '@/model/run';
import { useOnline, useStop, useParam } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L15":{"to":"sm-02-order-status-and-eta","kind":"go"},"L257":{"to":"dr-16-store-code-entry","kind":"go"},"B":{"to":"dr-02-stop-arrival","kind":"back"}}};

export default function ScreenDr03ProofOfDelivery() {
  const { stop, trip, view, lines } = useStop();
  const online = useOnline();
  const order = stop?.order;
  const chilled = order?.tempClass === 'CHILLED';
  const shortfalls = trip?.loadRecord?.shortfalls ?? [];
  const short = lines.reduce((n, l) => n + Math.max(0, (shortfalls.find(x => x.item === l.name)?.qtyOrdered ?? 0) - (shortfalls.find(x => x.item === l.name)?.qtyLoaded ?? 0)), 0);
  const ordered = order?.units ?? 0;
  const [units, setUnits] = useState<number | null>(null);
  const [receiver, setReceiver] = useState('');
  // the receiver signs on the pad (or the store code on DR-16 stands in): Complete stop needs one of them
  const [signature, setSignature] = useState<{ svg: string; at: string } | null>(null);
  const sign = useCallback((svg: string | null) => setSignature(svg ? { svg, at: new Date().toISOString() } : null), []);
  // damaged goods reported on DR-18 come back here and are recorded with the proof of delivery
  const damaged = Number(useParam('damaged') ?? '') || 0;
  const damagedItem = useParam('item');
  const damageNote = useParam('note');
  const damage = damaged > 0 ? [{ type: 'DAMAGED', description: damageNote || `${damaged} × ${damagedItem ?? 'item'} damaged` }] : [];
  const count = units ?? stop?.pod?.unitsDelivered ?? Math.max(0, ordered - short);
  const delivered = stop?.status === 'DELIVERED';

  const step = (d: number) => setUnits(Math.max(0, Math.min(ordered, count + d)));
  // a step is done by what happened, not by its planned time: the departure time is set when the plan is made
  const out = trip?.status === 'ENROUTE' || trip?.status === 'COMPLETE';
  const timeline: [string, string | null | undefined, boolean][] = [
    ['Planned', trip?.planVersion ? `v${trip.planVersion}` : null, !!trip?.planVersion],
    ['Loaded', hm(trip?.loadRecord?.loadedAt), !!trip?.loadRecord?.loadedAt || out],
    ['En route', hm(trip?.departTime), out],
    ['Arrived', hm(stop?.arrivalActual), !!stop?.arrivalActual],
    ['Delivered', delivered ? hm(stop?.leaveActual) || '✓' : null, delivered],
  ];
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v82}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Proof of delivery"}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1}>{online ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v75}>
          <View style={s.v32}>
            <View>
              <Text style={s.t9}>{`Received · ${chilled ? 'chilled' : 'dry'} `}<Text style={s.t8}>{order?.id ?? '—'}</Text></Text>
            </View>
            <View style={s.v16}>
              <View style={s.v12}>
                <Text style={s.t11} testID="pod-count">{String(count)}<Text style={s.t10}>{`of ${ordered}`}</Text></Text>
              </View>
              {count < ordered ? (
                <View style={s.v15}>
                  <View style={s.v13} />
                  <Text style={s.t14} numberOfLines={1}>{`${ordered - count} short`}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={s.t17}>{short ? `${short} short at the dock, locked` : stop?.outlet?.name ?? ' '}</Text>
            </View>
            <View style={s.v31}>
              <View style={s.v30}>
                {timeline.map(([label, at, done], i) => (
                  <Fragment key={label}>
                    {i ? <View style={done ? s.v21 : s.v27} /> : null}
                    <View style={s.v20}>
                      <View style={done ? s.v18 : s.v28}>{done ? <Icon xml={X2} width={12} height={12} style={s.v1} /> : null}</View>
                      <View>
                        <Text style={done ? s.t19 : s.t29} numberOfLines={1}>{label}</Text>
                      </View>
                      <View>
                        <Text style={s.t9} numberOfLines={1}>{at || '·'}</Text>
                      </View>
                    </View>
                  </Fragment>
                ))}
              </View>
            </View>
          </View>
          <View style={s.v62}>
            <View style={s.v36}>
              <View style={s.v12}>
                <Text style={s.t33}>{`${chilled ? 'Chilled' : 'Dry'} · ${plural(lines.length, 'line')}${chilled ? ' · unload first' : ''}`}</Text>
              </View>
            </View>
            <View style={s.v61}>
              <View style={s.v50}>
                <View style={s.v40}>
                  <View>
                    <Text style={s.t37}>{"Units received"}</Text>
                  </View>
                  <View style={s.v39}>
                    <Text style={s.t38}>{`ordered ${ordered}`}</Text>
                  </View>
                </View>
                <View style={s.v49}>
                  <Tap style={s.v46} onPress={() => step(-1)} to={null} testID="units-minus">
                    <Text style={s.t45}>{"−"}</Text>
                  </Tap>
                  <View style={s.v48}>
                    <Text style={s.t47}>{String(count)}</Text>
                  </View>
                  <Tap style={s.v46} onPress={() => step(1)} to={null} testID="units-plus">
                    <Text style={s.t45}>{"+"}</Text>
                  </Tap>
                </View>
              </View>
              {lines.map(l => {
                const sf = shortfalls.find(x => x.item === l.name);
                return (
                  <View key={l.id} style={s.v44}>
                    <View style={s.v40}>
                      <View>
                        <Text style={s.t37}>{l.name}</Text>
                      </View>
                      {sf ? (
                        <View style={s.v39}>
                          <Icon xml={X5} width={14} height={14} style={s.v1} />
                          <Text style={s.t38}>{`${Math.max(0, sf.qtyOrdered - sf.qtyLoaded)} short at loading`}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={s.v43}>
                      <View style={s.v12}>
                        <Text style={s.t41}>{String(sf ? sf.qtyLoaded : l.qty)}</Text>
                      </View>
                      <Text style={s.t42}>{`of ${l.qty}`}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={s.v62}>
            <View style={s.v36}>
              <View style={s.v12}>
                <Text style={s.t33}>{"Received by"}</Text>
              </View>
              <View style={s.v12}>
                <Text style={s.t68}>{"receiving"}</Text>
              </View>
            </View>
            <View style={s.v61}>
              <View style={s.v74}>
                <TextInput
                  value={receiver || stop?.pod?.receiverName || ''}
                  onChangeText={setReceiver}
                  placeholder="Name of the person receiving"
                  placeholderTextColor="#7f89a3"
                  style={[s.t37, { paddingVertical: 12 }]}
                  testID="receiver-name"
                  autoCorrect={false}
                  autoCapitalize="words"
                  autoComplete="name"
                />
                <SignaturePad
                  onChange={sign}
                  caption={signature ? `Signed ${hm(signature.at)} · ${online ? 'sent when you complete' : 'saved on phone'}` : delivered ? 'Signed already · sign again to replace' : 'Receiver signs above the line'}
                />
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v81}>
          <Tap
            lk="L15"
            style={[s.v78, !signature && !delivered ? { opacity: 0.55 } : null]}
            to={stop ? afterPod(view, stop) : undefined}
            onPress={async () => {
              if (!stop || !order) return true; // prototype mode: just navigate
              if (!signature && !delivered) {
                showToast("Ask the receiver to sign · or use the store code if they can't", 'error');
                return false;
              }
              if (signature) await queuePodSignature(stop, { svg: signature.svg, signedAt: signature.at, signedBy: (receiver || stop.pod?.receiverName || '').trim() || undefined });
              // a delivered stop can be corrected: the POD is saved again (the server upserts it)
              await completeStop(stop, { unitsDelivered: count, unitsOrdered: ordered, receiverName: (receiver || '').trim() || undefined, ...(damage.length ? { exceptions: damage } : {}) });
              showToast(online ? (delivered ? 'Delivery updated · sending' : 'Stop completed · sending') : 'Saved on this phone · sends when there is signal');
              return true;
            }}
          >
            <Grad g={G0} style={s.v76} />
            <Icon xml={X12} width={22} height={22} style={s.v1} />
            <Text style={s.t77}>{delivered ? 'Update delivery' : "Complete stop"}</Text>
          </Tap>
          <Tap lk="L257" style={s.v80} to={stop ? { to: 'dr-16-store-code-entry', params: { stop: stop.id, units: String(count), ...(damaged ? { damaged: String(damaged), note: damageNote ?? '' } : {}) } } : undefined}>
            <Icon xml={X13} width={18} height={18} style={s.v1} />
            <Text style={s.t79}>{"Can't sign? Use store OTP"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"12\" height=\"12\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X12 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X13 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = StyleSheet.create({
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
  t10: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t11: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexShrink":1},
  v13: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#ff8a7a","borderRadius":3.5},
  t14: {"color":"#ff8a7a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#321210","borderRadius":14},
  v16: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t17: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#5ee0a8","borderWidth":2,"borderColor":"#5ee0a8","borderRadius":11,"boxShadow":"rgba(4, 120, 87, 0.25) 0px 2px 6px 0px"},
  t19: {"color":"#f2f4fa","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v20: {"flexDirection":"column","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1,"width":62},
  v21: {"flexShrink":0,"marginTop":10,"marginRight":-16,"marginLeft":-16,"width":36,"height":2,"backgroundColor":"#5ee0a8"},
  v22: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#ffc266","borderWidth":2,"borderColor":"#ffc266","borderRadius":11},
  t23: {"color":"#ffc266","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_800ExtraBold"},
  v24: {"flexShrink":0,"marginTop":10,"marginRight":-16,"marginLeft":-16,"width":36,"height":2,"backgroundColor":"#ffc266"},
  v25: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#6cc4f5","borderWidth":2,"borderColor":"#6cc4f5","borderRadius":11,"boxShadow":"rgb(12, 42, 64) 0px 0px 0px 5px, rgba(3, 105, 161, 0.3) 0px 4px 10px 0px"},
  t26: {"color":"#6cc4f5","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_800ExtraBold"},
  v27: {"flexShrink":0,"marginTop":10,"marginRight":-16,"marginLeft":-16,"width":36,"height":2,"backgroundColor":"#3b4666"},
  v28: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#0a0f1e","borderWidth":2,"borderColor":"#3b4666","borderRadius":11},
  t29: {"color":"#7f89a3","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v30: {"flexDirection":"row","alignItems":"flex-start","flexShrink":1},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"stretch","paddingTop":14,"marginTop":2,"marginRight":-12,"marginLeft":-12,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t33: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t34: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v35: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v36: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t37: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t38: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v39: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t41: {"color":"#f2f4fa","fontSize":22,"lineHeight":33,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t42: {"color":"#b5bdd1","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v43: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":0,"paddingRight":14,"paddingLeft":14,"height":56,"borderWidth":1,"borderColor":"#3b4666","borderStyle":"dashed","borderRadius":16},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  t45: {"color":"#f2f4fa","fontSize":26,"lineHeight":39,"fontFamily":"Inter_700Bold"},
  v46: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"width":52,"height":52,"backgroundColor":"#0a0f1e","borderRadius":14},
  t47: {"color":"#f2f4fa","fontSize":28,"lineHeight":42,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v48: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"minWidth":48},
  v49: {"flexDirection":"row","alignItems":"center","flexShrink":1,"paddingTop":4,"paddingRight":4,"paddingBottom":4,"paddingLeft":4,"backgroundColor":"#1a2340","borderRadius":18},
  v50: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v51: {"overflow":"hidden"},
  v52: {"flexShrink":0,"width":56,"height":56,"borderRadius":14,"boxShadow":"rgb(255, 138, 122) 0px 0px 0px 2px","overflow":"hidden"},
  t53: {"color":"#ff8a7a","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v54: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t55: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v56: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":2,"columnGap":2,"flexShrink":0,"width":56,"height":56,"borderWidth":1,"borderColor":"#3b4666","borderStyle":"dashed","borderRadius":14},
  t57: {"color":"#a9b4ff","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_600SemiBold"},
  t58: {"color":"#a9b4ff","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_800ExtraBold"},
  v59: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1,"flexBasis":"100%","paddingLeft":70},
  v60: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":4,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#321210","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v61: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v62: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v63: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t64: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t65: {"color":"#5ee0a8","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v66: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1},
  v67: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t68: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v69: {"position":"absolute","top":6,"bottom":42,"left":30,"right":65,"overflow":"hidden"},
  v70: {"position":"absolute","top":71,"right":16,"bottom":40,"left":16,"height":1,"backgroundColor":"#3b4666"},
  v71: {"position":"absolute","top":80.5,"right":107.9,"bottom":12,"left":16},
  v72: {"flexDirection":"row","alignItems":"center","paddingRight":12,"paddingLeft":12,"position":"absolute","top":10,"right":10,"bottom":70,"left":242.1,"height":32,"backgroundColor":"#1a2340","borderRadius":10},
  v73: {"flexShrink":1,"height":112,"backgroundColor":"#0a0f1e","borderRadius":16,"overflow":"hidden"},
  v74: {"flexDirection":"column","alignItems":"stretch","paddingTop":14,"paddingRight":16,"paddingBottom":12,"paddingLeft":16},
  v75: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":4,"paddingBottom":8},
  v76: {"borderRadius":18},
  t77: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v78: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t79: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v80: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v81: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v82: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
});
