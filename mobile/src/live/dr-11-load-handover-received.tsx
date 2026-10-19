// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-11 Load handover received · phone (P4, phone)
// Opens when the dock releases the van (trip_released) for the trip in route param `trip`: what was loaded, the
// seal, the reefer reading at release, and any shortfall. Accepting is recorded on this phone, then the pre-trip
// vehicle check (DR-12). The loader's name is not in the driver's data, so the release line names the bay and time only.
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import * as api from '@/model/api';
import { ackFor } from '@/model/dock';
import { useClaims, useNotifications, useParam, useRun } from '@/model/hooks';
import { useQuery } from '@/model/query';
import { setRunMark } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L239":{"to":"dr-12-pre-trip-vehicle-check","kind":"go"}}};

const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

export default function ScreenDr11LoadHandoverReceived() {
  const claims = useClaims();
  const param = useParam('trip');
  const run = useRun();
  const v = run.view;
  const trip = v?.trips.find(t => t.id === param) ?? v?.trip ?? null;
  const stops = v ? v.stops.filter(st => st.tripId === trip?.id) : [];
  const orderIds = stops.map(st => st.orderId);
  const lines = useQuery(orderIds.length ? `lines.${orderIds.join(',')}` : null, c => api.orderLines(c, orderIds), { persist: true }).data ?? [];
  const notes = useNotifications().data;
  const lr = trip?.loadRecord ?? null;
  const shortfalls = lr?.shortfalls ?? [];
  const sf = shortfalls[0];
  const ack = trip && sf ? ackFor(notes, trip.id, sf.item) : undefined;
  const [seen, setSeen] = useState(false);
  const kg = stops.reduce((n, st) => n + (st.order?.kg ?? 0), 0);
  const m3 = stops.reduce((n, st) => n + (st.order?.m3 ?? 0), 0);
  const cap = trip?.vehicle;
  const reefer = lr?.reeferTempC ?? trip?.reeferTempC;
  // released means the dock released it (load record, or the trip already en route), not the plan's departure time
  const released = !!trip && (!!lr?.releasedAt || trip.status === 'ENROUTE' || trip.status === 'COMPLETE');
  const releasedAt = released ? (lr?.releasedAt ?? trip?.departTime) : undefined;
  // nothing to accept until the dock has released the load (seal number, reefer temperature)
  const notYet = !!trip && !released;
  const shortOf = (orderId: string) => shortfalls.filter(x => !x.orderId || x.orderId === orderId).reduce((n, x) => n + Math.max(0, x.qtyOrdered - x.qtyLoaded), 0);
  const shortStop = sf ? stops.find(st => st.orderId === sf.orderId) : undefined;
  const empty = !claims ? 'Sign in to see your load' : run.loading && !v ? 'Loading…' : 'No load released yet';

  const accept = async () => {
    if (!trip) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
    if (shortfalls.length && !seen) throw new Error("Tick \"I've seen the shortfall\" first");
    await setRunMark('accepted', trip.id);
    return true;
  };

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v46}>
        <View style={s.v8}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Load handover"}</Text>
          </View>
          {trip ? (
            <View style={s.v7}>
              <View style={s.v6}>
                <Text style={s.t5} numberOfLines={1}>{trip.vehicleId}</Text>
              </View>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v41}>
          <View style={s.v17}>
            <View>
              <Text style={s.t9} testID="released-line">{trip ? [released ? 'Released' : 'Still loading at the dock', trip.bay ? `Bay ${trip.bay}` : '', releasedAt ? hm(releasedAt) : ''].filter(Boolean).join(' · ') : empty}</Text>
            </View>
            {trip ? (
              <View style={s.v15}>
                <View style={s.v6}>
                  <Text style={s.t11}>{String(stops.length)}<Text style={s.t10}>{stops.length === 1 ? 'order' : "orders"}</Text></Text>
                </View>
                {lr?.sealNumber ?? trip.sealNumber ? (
                  <View style={s.v14}>
                    <View style={s.v12} />
                    <Text style={s.t13} numberOfLines={1}>{"Sealed"}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {trip ? (
              <View>
                <Text style={s.t16}>{[plural(lines.length, 'line'), cap?.capacityKg ? `${n0(kg)} of ${n0(cap.capacityKg)} kg` : `${n0(kg)} kg`, cap?.capacityM3 ? `${n0(m3)} of ${n0(cap.capacityM3)} m³` : `${n0(m3)} m³`].join(' · ')}</Text>
              </View>
            ) : null}
          </View>
          {sf ? (
            <View style={s.v26}>
              <View style={s.v23}>
                <View style={s.v18}>
                  <Icon xml={X1} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v22}>
                  <View>
                    <Text style={s.t19}>{`${plural(shortfalls.length, 'shortfall')} · ${sf.item}`}</Text>
                  </View>
                  <View style={s.v21}>
                    <Text style={s.t20}>{`${sf.qtyOrdered - sf.qtyLoaded} of ${sf.qtyOrdered} short (${sf.reason}).${ack ? ` Dispatch acknowledged ${hm(ack.sentAt)}.` : ''}`}</Text>
                  </View>
                </View>
              </View>
              <Tap style={s.v25} to={null} onPress={() => setSeen(x => !x)} testID="seen-shortfall">
                <View style={s.v22}>
                  <View>
                    <Text style={s.t19}>{"I've seen the shortfall"}</Text>
                  </View>
                  {shortStop?.order ? (
                    <View style={s.v21}>
                      <Text style={s.t20}>{`Stop ${shortStop.stopSeq} will expect ${shortStop.order.units - shortOf(shortStop.orderId)}, not ${shortStop.order.units}`}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={seen ? s.v24 : x.box}>
                  {seen ? <Icon xml={X2} width={20} height={20} style={s.v1} /> : null}
                </View>
              </Tap>
            </View>
          ) : null}
          {stops.length ? (
            <View style={s.v40}>
              <View style={s.v30}>
                <View style={s.v6}>
                  <Text style={s.t27}>{"On the van"}</Text>
                </View>
                {typeof reefer === 'number' ? (
                  <View style={s.v29}>
                    <Icon xml={X3} width={14} height={14} style={s.v1} />
                    <Text style={s.t28} numberOfLines={1}>{`Reefer ${reefer}\u00a0°C`}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.v39}>
                {stops.map((st, i) => {
                  const chilled = st.order?.tempClass === 'CHILLED';
                  const short = shortOf(st.orderId);
                  const units = st.order?.units ?? 0;
                  return (
                    <View key={st.id} style={i === 0 ? s.v36 : s.v38} testID={`handover-${i}`}>
                      <View style={chilled ? s.v31 : s.v37}>
                        <Icon xml={chilled ? X4 : X5} width={19} height={19} style={s.v1} />
                      </View>
                      <View style={s.v22}>
                        <View>
                          <Text style={s.t19}>{`Stop ${st.stopSeq} · ${chilled ? 'chilled' : 'dry'}`}</Text>
                        </View>
                        <View style={s.v21}>
                          <View style={s.v6}>
                            <Text style={s.t32}>{st.orderId}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.v35}>
                        <View>
                          <Text style={s.t33}>{String(units - short)}</Text>
                        </View>
                        <View>
                          <Text style={s.t34}>{short ? `of ${units}` : "units"}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v45}>
          <Tap lk="L239" style={s.v44} onPress={accept} disabled={notYet} to={trip ? { to: 'dr-12-pre-trip-vehicle-check', params: { trip: trip.id } } : undefined}>
            <Grad g={G0} style={s.v42} />
            <Icon xml={X6} width={22} height={22} style={s.v1} />
            <Text style={s.t43}>{notYet ? 'Waiting for the dock to release' : 'Accept load'}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({ box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#4a5467' } });

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v6: {"flexShrink":1},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#1a2340","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t11: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#5ee0a8","borderRadius":3.5},
  t13: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v14: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v15: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t16: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#2e2208","borderRadius":14},
  t19: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t20: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v21: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v22: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"backgroundColor":"#2e2208"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#0d2a20","borderRadius":18},
  v25: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v26: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t27: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t28: {"color":"#67e3f9","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#082b33","borderRadius":12},
  t32: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t33: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t34: {"color":"#7f89a3","fontSize":13,"lineHeight":16,"fontFamily":"Inter_600SemiBold"},
  v35: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v36: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#161d3d","borderRadius":12},
  v38: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v39: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":4,"paddingBottom":16},
  v42: {"borderRadius":18},
  t43: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v44: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v45: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v46: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
