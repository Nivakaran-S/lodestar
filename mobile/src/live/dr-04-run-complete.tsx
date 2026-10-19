// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-04 Run complete (P4, phone)
import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { finishDeliveredTrips } from '@/model/actions';
import { isUnsent, useOutbox, useRun } from '@/model/hooks';
import { labelParts, minutesUntil, tripSummary } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L21":{"to":"dr-28-end-of-shift-summary","kind":"go"},"N0":{"to":"dr-01-today-s-run","kind":"nav"},"N1":{"to":"dr-21-records","kind":"nav"},"N2":{"to":"dr-23-dispatch-notices","kind":"nav"}}};

export default function ScreenDr04RunComplete() {
  const { name: depotName } = useDepots();
  const { view } = useRun();
  const { waiting, synced, attention, summary } = useOutbox();
  const sum = tripSummary(view);
  const trip = sum.trip;
  const allDone = !!trip && sum.delivered.length === sum.stops.length;
  const issues = sum.short.length + sum.exceptions + attention.length;
  const backIn = minutesUntil(trip?.returnTime);
  const stopName = (id: string) => sum.stops.find(x => x.id === id)?.outlet?.name;
  // The last stop is delivered: the trip is finished (Trips SetStatus COMPLETE through the outbox, once per trip;
  // the server records the return time and the fuel used). Nothing else sets a trip COMPLETE.
  const doneTrips = (view?.trips ?? []).filter(t => {
    const own = (view?.stops ?? []).filter(x => x.tripId === t.id);
    return own.length > 0 && own.every(x => x.status === 'DELIVERED');
  });
  const doneKey = doneTrips.map(t => t.id).join(',');
  useEffect(() => {
    if (view && doneKey) void finishDeliveredTrips(view.trips, view.stops).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey]);
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v46}>
        <View style={s.v8}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v5}>
            <Text style={s.t4}>{trip ? `Trip ${trip.tripNumber} · ` : 'Trip · '}<Text style={s.t3}>{trip?.vehicleId ?? '—'}</Text></Text>
          </View>
          <View style={s.v7}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t6} numberOfLines={1} testID="sync-chip">{waiting.length ? `${waiting.length} to send` : summary.lastSyncedAt ? `Synced ${hm(summary.lastSyncedAt)}` : 'Nothing to send'}</Text>
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v38}>
          <View style={s.v18}>
            <View style={s.v12}>
              <View style={s.v9}>
                <Icon xml={X2} width={28} height={28} style={s.v1} />
              </View>
              <View style={s.v11}>
                <Text style={s.t10} testID="run-done-title">{trip ? (allDone ? `Trip ${trip.tripNumber} done` : `Trip ${trip.tripNumber} · ${sum.delivered.length} of ${sum.stops.length} delivered`) : 'No run loaded'}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t13} testID="run-summary">
                {trip
                  ? [
                      sum.startedAt ? `Started ${hm(sum.startedAt)}` : '',
                      sum.endedAt ? `last stop ${hm(sum.endedAt)}` : '',
                      `${sum.delivered.length} of ${plural(sum.stops.length, 'stop')} delivered`,
                      `${sum.unitsDelivered} of ${sum.unitsOrdered} units`,
                    ].filter(Boolean).join(' · ')
                  : 'Sign in to see your run'}
              </Text>
            </View>
            <View style={s.v17}>
              <View style={s.v7}>
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={s.t6} numberOfLines={1}>{waiting.length ? `${plural(waiting.length, 'record')} waiting to send` : `All ${plural(synced.length, 'record')} synced${summary.lastSyncedAt ? ` ${hm(summary.lastSyncedAt)}` : ''}`}</Text>
              </View>
              <View style={s.v16}>
                <View style={s.v14} />
                <Text style={s.t15} numberOfLines={1}>{issues ? plural(issues, 'exception') : 'No exceptions'}</Text>
              </View>
            </View>
          </View>
          <View style={s.v35}>
            <View style={s.v21}>
              <View style={s.v11}>
                <Text style={s.t19}>{waiting.length ? 'Delivered · some still on this phone' : 'Delivered stops'}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t20}>{`${sum.unitsDelivered}/${sum.unitsOrdered} units`}</Text>
              </View>
            </View>
            <View style={s.v34}>
              {sum.delivered.length ? (
                sum.delivered.map((st, i) => (
                  <View key={st.id} style={i === 0 ? s.v30 : s.v31} testID={`done-stop-${i}`}>
                    <View style={s.v22}>
                      <Icon xml={X3} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v26}>
                      <View>
                        <Text style={s.t23}>{`Stop ${st.stopSeq} · ${st.outlet?.name ?? st.outletId}`}</Text>
                      </View>
                      <View style={s.v25}>
                        <Text style={s.t24}>{[st.arrivalActual ? `Arrival ${hm(st.arrivalActual)}` : '', st.pod ? `POD ${st.pod.unitsDelivered}/${st.pod.unitsOrdered}` : '', st.pod?.receiverName ? `signed ${st.pod.receiverName}` : ''].filter(Boolean).join(' · ') || '—'}</Text>
                      </View>
                    </View>
                    <View style={s.v29}>
                      <View style={s.v28}>
                        <Text style={s.t27} numberOfLines={1}>{isUnsent(waiting, st.id) ? 'on phone' : hm(st.pod?.syncedAt) || hm(st.leaveActual) || '✓'}</Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={s.v30}>
                  <View style={s.v26}>
                    <Text style={s.t24}>{"No stops delivered yet"}</Text>
                  </View>
                </View>
              )}
              {sum.short.map(st => (
                <View key={`short-${st.id}`} style={s.v33}>
                  <View style={s.v32}>
                    <Icon xml={X4} width={22} height={22} style={s.v1} />
                  </View>
                  <View style={s.v26}>
                    <View>
                      <Text style={s.t23}>{`Short at ${st.outlet?.name ?? st.outletId}`}</Text>
                    </View>
                    <View style={s.v25}>
                      <View style={s.v11}>
                        <Text style={s.t24}><Text style={s.t3}>{st.orderId}</Text>{`: ${st.pod!.unitsDelivered} of ${st.pod!.unitsOrdered} delivered${st.pod!.exceptions?.length ? ` · ${plural(st.pod!.exceptions.length, 'exception')}` : ''}`}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
              {attention.map(it => {
                const [head, code] = labelParts(it.label);
                return (
                  <View key={it.id} style={s.v33}>
                    <View style={s.v32}>
                      <Icon xml={X4} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v26}>
                      <View>
                        <Text style={s.t23}>{it.status === 'synced' ? 'Dispatch change, resolved' : 'Not accepted by the server'}</Text>
                      </View>
                      <View style={s.v25}>
                        <View style={s.v11}>
                          <Text style={s.t24}>{head}<Text style={s.t3}>{code || stopName(it.ref ?? '') || ''}</Text>{it.conflict ? `: ${it.conflict}` : ''}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={s.v35}>
            <View style={s.v21}>
              <View style={s.v11}>
                <Text style={s.t19}>{"Next"}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t20}>{sum.nextTrip ? `Trip ${sum.nextTrip.tripNumber} today` : trip ? `No Trip ${trip.tripNumber + 1} today` : '—'}</Text>
              </View>
            </View>
            <View style={s.v34}>
              <View style={s.v30}>
                <View style={s.v32}>
                  <Icon xml={X5} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v26}>
                  <View>
                    <Text style={s.t23}>{sum.nextTrip ? `Trip ${sum.nextTrip.tripNumber} · ${titleCase(sum.nextTrip.brand)} · ${sum.nextTrip.district}` : trip ? `Return to ${depotName(trip.depot)}` : 'Return to depot'}</Text>
                  </View>
                  <View style={s.v25}>
                    <Text style={s.t24}>{sum.nextTrip ? (sum.nextTrip.departTime ? `departs ${hm(sum.nextTrip.departTime)}` : 'departure not set yet') : trip?.returnTime ? `back ~${hm(trip.returnTime)}` : 'return time not planned'}</Text>
                  </View>
                </View>
                <View style={s.v29}>
                  <View>
                    <Text style={s.t36}>{!sum.nextTrip && backIn > 0 ? `${backIn} min` : '—'}</Text>
                  </View>
                  <View>
                    <Text style={s.t37}>{"to go"}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v42}>
          <Tap
            lk="L21"
            style={s.v41}
            testID="end-shift"
            onPress={async () => {
              if (view) await finishDeliveredTrips(view.trips, view.stops);
              return true;
            }}
          >
            <Grad g={G0} style={s.v39} />
            <Icon xml={X6} width={22} height={22} style={s.v1} />
            <Text style={s.t40}>{"End shift"}</Text>
          </Tap>
        </View>
        <View style={s.v45}>
          <Tap lk="N0" style={s.v44}>
            <Icon xml={X7} width={24} height={24} style={s.v1} />
            <Text style={s.t43}>{"Run"}</Text>
          </Tap>
          <Tap lk="N1" style={s.v44}>
            <Icon xml={X8} width={24} height={24} style={s.v1} />
            <Text style={s.t20}>{"Records"}</Text>
          </Tap>
          <Tap lk="N2" style={s.v44}>
            <Icon xml={X9} width={24} height={24} style={s.v1} />
            <Text style={s.t20}>{"Dispatch"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"28\" height=\"28\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 16v-4M12 8h.01\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 21V8l9-5 9 5v13\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M7 21v-8h10v8M7 17h10\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t6: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v9: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":52,"height":52,"backgroundColor":"#0d2a20","borderRadius":26},
  t10: {"color":"#f2f4fa","fontSize":38,"lineHeight":39.9,"letterSpacing":-1.1,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexShrink":1},
  v12: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14},
  t13: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v14: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#ff8a7a","borderRadius":3.5},
  t15: {"color":"#ff8a7a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  v18: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t19: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t20: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v21: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v22: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#0d2a20","borderRadius":14},
  t23: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t24: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v25: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t27: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5},
  v29: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v34: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  t36: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t37: {"color":"#7f89a3","fontSize":13,"lineHeight":16,"fontFamily":"Inter_600SemiBold"},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":8},
  v39: {"borderRadius":18},
  t40: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  t43: {"color":"#f5b83d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v44: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  v45: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#0b1122","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v46: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
