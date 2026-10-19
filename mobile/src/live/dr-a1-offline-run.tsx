// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-A1 Offline run (P5, phone)
// Live: the run as saved on this phone (cached query) with the unsent writes laid over it.
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { arriveAtStop } from '@/model/actions';
import { isUnsent, useOutbox, useRun } from '@/model/hooks';
import { useNet } from '@/model/run';
import { LATE_RISK_PCT } from '@/model/preferences';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L23":{"to":"dr-a2-pod-saved-offline","kind":"go"},"N0":{"to":"dr-01-today-s-run","kind":"nav"},"N1":{"to":"dr-21-records","kind":"nav"},"N2":{"to":"dr-23-dispatch-notices","kind":"nav"}}};

export default function ScreenDrA1OfflineRun() {
  const { view, updatedAt, fromCache, loading } = useRun();
  const { waiting } = useOutbox();
  const net = useNet();
  const trip = view?.trip ?? null;
  const stops = view?.tripStops ?? [];
  const stop = view?.current ?? null;
  const o = stop?.outlet;
  const seq = stop ? stops.indexOf(stop) + 1 : 0;
  const late = (stop?.lateRiskPct ?? 0) >= LATE_RISK_PCT;
  const savedAt = updatedAt ? hm(new Date(updatedAt).toISOString()) : '';
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v57}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{trip ? `Trip ${trip.tripNumber} · ${titleCase(trip.brand)}` : 'Trip'}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1} testID="outbox-waiting">{`${waiting.length} waiting`}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v46}>
          <View style={s.v12}>
            <View style={s.v10}>
              <Icon xml={X2} width={14} height={14} style={s.v1} />
              <Text style={s.t8} testID="net-since">{net.online ? `Online since ${hm(net.since)}` : `No signal since ${hm(net.since)}`}</Text>
              <View style={s.v9} />
              <Text style={s.t8}>{savedAt ? `run saved ${savedAt}${fromCache ? ' · from this phone' : ''}` : loading ? 'saving run…' : 'run not saved yet'}</Text>
            </View>
            <View>
              <Text style={s.t11}>{view ? (net.online ? 'Your run is saved here too' : 'Offline, and your run is saved here') : 'Open your run once with signal to keep it here'}</Text>
            </View>
          </View>
          <View style={s.v25}>
            <View>
              <Text style={s.t8}>{stop ? `Next · stop ${seq} of ${stops.length} · ${o?.name ?? stop.outletId}` : trip ? 'All stops delivered' : 'Next stop'}</Text>
            </View>
            <View style={s.v19}>
              <View style={s.v15}>
                <Text style={s.t14}>{stop?.etaModel ? hm(stop.etaModel) : '—'}<Text style={s.t13}>{"ETA"}</Text></Text>
              </View>
              {stop ? (
                <View style={s.v18}>
                  <View style={s.v16} />
                  <Text style={s.t17} numberOfLines={1}>{late ? `Late risk ${stop.lateRiskPct}%` : 'In window'}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={s.t21}><Text style={s.t20}>{stop?.outletId ?? '—'}</Text>{[o ? `${o.windowOpen}–${o.windowClose}` : '', stop?.serviceMinPredicted ? `unload ${stop.serviceMinPredicted} min` : ''].filter(Boolean).map(x => ` · ${x}`).join('')}</Text>
            </View>
            <View style={s.v24}>
              <Icon xml={X3} width={14} height={14} style={s.v22} />
              <View style={s.v15}>
                <Text style={s.t23}>{stop ? `Plan ${hm(stop.etaPlan) || '—'} · model ${hm(stop.etaModel) || '—'}${savedAt ? `, as saved on this phone at ${savedAt}` : ''}.` : 'Times show here once the run is saved.'}</Text>
              </View>
            </View>
          </View>
          <View style={s.v45}>
            <View style={s.v28}>
              <View style={s.v15}>
                <Text style={s.t26}>{"Stops on this trip"}</Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t27}>{plural(stops.length, 'order')}</Text>
              </View>
            </View>
            <View style={s.v44}>
              {stops.map((st, i) => {
                const cur = st.id === stop?.id;
                const done = st.status === 'DELIVERED';
                const chilled = st.order?.tempClass === 'CHILLED';
                return (
                  <View key={st.id} style={i === 0 ? s.v39 : s.v43} testID={`offline-stop-${i}`}>
                    <View style={cur ? s.v30 : s.v41}>
                      <Text style={cur ? s.t29 : s.t40}>{done ? '✓' : String(st.stopSeq)}</Text>
                    </View>
                    <View style={s.v36}>
                      <View>
                        <Text style={s.t31}>{st.outlet?.name ?? st.outletId}</Text>
                      </View>
                      <View style={s.v35}>
                        <View style={s.v15}>
                          <Text style={s.t42}>{st.outletId}</Text>
                        </View>
                        <View style={s.v9} />
                        <View style={s.v33}>
                          <Text style={chilled ? s.t34 : s.t32} numberOfLines={1}>
                            {isUnsent(waiting, st.id) ? 'Saved on phone' : done && st.pod ? `Delivered ${st.pod.unitsDelivered} of ${st.pod.unitsOrdered}` : st.order ? `${chilled ? 'Chilled' : 'Dry'} ${st.order.units}` : '1 order'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={s.v38}>
                      <View>
                        <Text style={s.t37}>{done ? hm(st.leaveActual) || '✓' : hm(st.etaModel) || '—'}</Text>
                      </View>
                      <View>
                        <Text style={s.t8}>{st.outlet ? `by ${st.outlet.windowClose}` : ''}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Scroll>
        <View style={s.v53}>
          <View style={s.v51}>
            <Tap
              lk="L23"
              style={s.v49}
              disabled={DRIVER_APP && !stop}
              to={stop ? { to: 'dr-02-stop-arrival', params: { stop: stop.id } } : undefined}
              onPress={async () => {
                // TripStops Arrive, saved on the phone until there is signal
                if (stop && !stop.arrivalActual && stop.status !== 'DELIVERED') await arriveAtStop(stop);
              }}
            >
              <Grad g={G0} style={s.v47} />
              <Icon xml={X4} width={22} height={22} style={s.v1} />
              <Text style={s.t48}>{stop ? (stop.arrivalActual ? `At stop ${seq} · continue` : `Arrived at stop ${seq}`) : 'Arrived at stop'}</Text>
            </Tap>
            <View style={s.v50}>
              <Icon xml={X5} width={22} height={22} style={s.v1} />
            </View>
          </View>
          <View>
            <Text style={s.t52}>{"Calls and SMS can work where data doesn't"}</Text>
          </View>
        </View>
        <View style={s.v56}>
          <Tap lk="N0" style={s.v55}>
            <Icon xml={X6} width={24} height={24} style={s.v1} />
            <Text style={s.t54}>{"Run"}</Text>
          </Tap>
          <Tap lk="N1" style={s.v55}>
            <Icon xml={X7} width={24} height={24} style={s.v1} />
            <Text style={s.t27}>{"Records"}</Text>
          </Tap>
          <Tap lk="N2" style={s.v55}>
            <Icon xml={X8} width={24} height={24} style={s.v1} />
            <Text style={s.t27}>{"Dispatch"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t11: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"paddingRight":20,"paddingLeft":20},
  t13: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t14: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexShrink":1},
  v16: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#5ee0a8","borderRadius":3.5},
  t17: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v19: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t20: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t21: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v22: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t23: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_400Regular"},
  v24: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"paddingTop":10,"borderTopWidth":1,"borderTopColor":"#57534e","borderStyle":"dashed"},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t26: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t27: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v28: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t29: {"color":"#1a1300","fontSize":16,"lineHeight":24,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v30: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#f5b83d","borderRadius":14},
  t31: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t32: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  t34: {"color":"#67e3f9","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v35: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t37: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v38: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v39: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  t40: {"color":"#a9b4ff","fontSize":16,"lineHeight":24,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t42: {"color":"#b5bdd1","fontSize":14,"lineHeight":19.6,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v43: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v44: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v45: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":18,"columnGap":18,"paddingTop":4,"paddingBottom":16},
  v47: {"borderRadius":18},
  t48: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v49: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v50: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"width":58,"height":58,"backgroundColor":"#1a2340","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  v51: {"flexDirection":"row","alignItems":"stretch","rowGap":10,"columnGap":10},
  t52: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v53: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  t54: {"color":"#f5b83d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v55: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  v56: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#0b1122","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v57: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
