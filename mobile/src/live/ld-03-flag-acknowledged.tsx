// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-03 Flag acknowledged · phone (P3, phone)
// After a shortfall flag (route params `trip`, `item`): dispatch's answer (SHORTFALL_ACK), the lines still to
// load and the next one to tick (the bottom button opens the scan for it, LD-10).
// The ack carries who and when only, so the design's "credit raised, follow-up" line is left out.
import { Text, View, StyleSheet } from 'react-native';
import { hm, until } from '@/lib/time';
import { ackFor, loadGroups, ordinal, shortfallFor, tempLabel, useTicks } from '@/model/dock';
import { useClaims, useLoadSheet, useNotifications, useParam } from '@/model/hooks';
import type { OrderLineItem } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L201":{"to":"ld-10-scan-a-line","kind":"go"},"L9":{"to":"ld-04-release-vehicle","kind":"go"},"B":{"to":"ld-03-flag-shortfall","kind":"back"}}};

export default function ScreenLd03FlagAcknowledged() {
  const claims = useClaims();
  const sheet = useLoadSheet();
  const item = useParam('item');
  const notes = useNotifications();
  const data = sheet.data;
  const trip = data?.trip;
  const t = useTicks(sheet.tripId, sheet.data?.trip?.status);
  const flagged = (l: OrderLineItem) => shortfallFor(sheet.shortfalls, l);
  const accounted = (l: OrderLineItem) => t.isTicked(l.id) || !!flagged(l);
  const groups = loadGroups(data, accounted);
  const lines = groups.flatMap(g => g.lines);
  const total = lines.length;
  const done = lines.filter(accounted).length;
  const current = lines.find(l => !accounted(l)) ?? null;
  const flag = (item ? sheet.shortfalls.find(f => f.item === item) : undefined) ?? sheet.shortfalls.at(-1);
  const ack = trip && flag ? ackFor(notes.data, trip.id, flag.item) : undefined;
  const by = typeof ack?.payload?.by === 'string' ? (ack.payload.by as string) : '';
  const group = groups.find(g => g.lines.some(l => l.name === flag?.item)) ?? groups.find(g => g.ticked < g.lines.length) ?? groups[0] ?? null;
  const groupFlags = group ? group.lines.filter(l => !!flagged(l)) : [];
  const groupTicked = group ? group.lines.filter(l => t.isTicked(l.id) && !flagged(l)) : [];
  const groupLeft = group ? group.lines.filter(l => !accounted(l)) : [];
  const lastTicked = groupTicked.at(-1);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const firstDone = groups.find(g => g.lines.length && g.ticked === g.lines.length);
  const unsent = !!flag && !sheet.data?.loadRecord?.shortfalls?.some(x => x.item === flag.item);
  const toRelease = trip ? { to: 'ld-04-release-vehicle', params: { trip: trip.id } } : undefined;
  const empty = !claims ? 'Sign in to see this flag' : sheet.loading && !data ? 'Loading…' : 'No flag on this trip';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v56}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2} to={trip ? { to: 'ld-03-flag-shortfall', params: { trip: trip.id }, kind: 'back' } : undefined}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}><Text style={s.t3}>{trip?.vehicleId ?? '—'}</Text>{trip?.bay ? ` · Bay ${trip.bay}` : ''}</Text>
          </View>
          {trip ? (
            <View style={s.v7}>
              <Text style={s.t6} numberOfLines={1}>{`Plan v${trip.planVersion}`}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v5} contentStyle={s.v51}>
          <Tap lk="L9" style={s.v13} to={toRelease}>
            <Icon xml={X1} width={20} height={20} style={s.v9} />
            <View style={s.v12}>
              <View>
                <Text style={s.t10} testID="ack-line">{!flag ? empty : ack ? `Acknowledged by ${by ? `${by} (dispatch)` : 'dispatch'} ${hm(ack.sentAt)}` : unsent ? 'Flag saved on this phone · sends with signal' : 'Flag sent · waiting for dispatch'}</Text>
              </View>
              {flag ? (
                <View>
                  <Text style={s.t11}>{`${flag.item}: ${flag.qtyLoaded} of ${flag.qtyOrdered} loaded · ${flag.reason}`}</Text>
                </View>
              ) : null}
            </View>
          </Tap>
          <View style={s.v23}>
            <View style={s.v19}>
              <View style={s.v16}>
                <Text style={s.t15} testID="accounted">{String(done)}<Text style={s.t14}>{` of ${total} accounted`}</Text></Text>
              </View>
              <View style={s.v18}>
                <Text style={s.t17} numberOfLines={1}>{total - done ? `${total - done} to go` : 'All in'}</Text>
              </View>
            </View>
            <View style={s.v22}>
              <View style={[s.v21, { width: `${pct}%` }]}>
                <Grad g={G0} style={s.v20} />
              </View>
            </View>
            <View>
              <Text style={s.t11}>{[firstDone ? `Stop ${firstDone.stop.stopSeq} all in` : '', trip?.departTime ? `departs ${hm(trip.departTime)}${until(trip.departTime) ? `, ${until(trip.departTime)}` : ''}` : ''].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          {group ? (
            <View style={s.v50}>
              <View style={s.v26}>
                <View style={s.v16}>
                  <Text style={s.t24}>{`${ordinal(group.order)} · Stop ${group.stop.stopSeq} · ${group.stop.outlet?.name ?? group.stop.outletId}`}</Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t25}>{`${group.ticked} of ${group.lines.length}`}</Text>
                </View>
              </View>
              <View style={s.v49}>
                {groupFlags.map((l, i) => {
                  const sf = flagged(l)!;
                  const a = trip ? ackFor(notes.data, trip.id, sf.item) : undefined;
                  return (
                    <View key={l.id} style={i === 0 ? s.v39 : [s.v39, x.border]}>
                      <View style={s.v27}>
                        <Icon xml={X2} width={22} height={22} style={s.v1} />
                      </View>
                      <View style={s.v34}>
                        <View>
                          <Text style={s.t28}>{l.name}</Text>
                        </View>
                        <View style={s.v33}>
                          <View style={s.v30}>
                            <Text style={s.t29} numberOfLines={1}>{`Short ${Math.max(0, sf.qtyOrdered - sf.qtyLoaded)}`}</Text>
                          </View>
                          {a ? (
                            <View style={s.v32}>
                              <Icon xml={X3} width={14} height={14} style={s.v1} />
                              <Text style={s.t31} numberOfLines={1}>{`Ack'd ${hm(a.sentAt)}`}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={s.v37}>
                        <View>
                          <Text style={s.t35}>{`${sf.qtyLoaded}/${l.qty}`}</Text>
                        </View>
                        <View>
                          <Text style={s.t36}>{l.qty === 1 ? "unit" : "units"}</Text>
                        </View>
                      </View>
                      <View style={s.v38}>
                        <Icon xml={X4} width={22} height={22} style={s.v1} />
                      </View>
                    </View>
                  );
                })}
                {lastTicked ? (
                  <View style={s.v44}>
                    <View style={s.v40}>
                      <Icon xml={X5} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v34}>
                      <View>
                        <Text style={s.t28}>{lastTicked.name}</Text>
                      </View>
                      <View style={s.v33}>
                        <View style={s.v32}>
                          <Icon xml={X6} width={14} height={14} style={s.v1} />
                          <Text style={s.t41} numberOfLines={1}>{tempLabel(lastTicked.tempClass)}</Text>
                        </View>
                        {groupTicked.length > 1 ? <View style={s.v42} /> : null}
                        {groupTicked.length > 1 ? <Text style={s.t43}>{`+${groupTicked.length - 1} ${groupTicked.length === 2 ? 'line' : 'lines'} done`}</Text> : null}
                      </View>
                    </View>
                    <View style={s.v37}>
                      <View>
                        <Text style={s.t35}>{String(lastTicked.qty)}</Text>
                      </View>
                      <View>
                        <Text style={s.t36}>{lastTicked.qty === 1 ? "unit" : "units"}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                {groupLeft.map((l, i) => (
                  <View key={l.id} style={i === 0 ? s.v48 : s.v44} testID={`left-${l.id}`}>
                    <View style={s.v45} />
                    <View style={s.v34}>
                      <View>
                        <Text style={s.t28}>{l.name}</Text>
                      </View>
                      <View style={s.v33}>
                        <View style={s.v32}>
                          <View style={s.v46} />
                          <Text style={s.t47} numberOfLines={1}>{tempLabel(l.tempClass)}</Text>
                        </View>
                        <View style={s.v42} />
                        <Text style={s.t43}>{`${Math.round(l.kg * 10) / 10} kg`}</Text>
                      </View>
                    </View>
                    <View style={s.v37}>
                      <View>
                        <Text style={s.t35}>{String(l.qty)}</Text>
                      </View>
                      <View>
                        <Text style={s.t36}>{l.qty === 1 ? "unit" : "units"}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v55}>
          {current ? (
            <Tap lk="L201" style={s.v54} to={trip ? { to: 'ld-10-scan-a-line', params: { trip: trip.id, line: current.id } } : undefined} testID="tick-next">
              <Grad g={G1} style={s.v52} />
              <Icon xml={X7} width={22} height={22} style={s.v1} />
              <Text style={s.t53}>{`Tick ${current.name}`}</Text>
            </Tap>
          ) : (
            <Tap style={s.v54} to={toRelease} testID="to-release">
              <Grad g={G1} style={s.v52} />
              <Icon xml={X7} width={22} height={22} style={s.v1} />
              <Text style={s.t53}>{trip ? `Release ${trip.vehicleId}` : 'Release'}</Text>
            </Tap>
          )}
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({ border: { borderTopWidth: 1, borderTopColor: '#e3e6ed' } });

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t6: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v9: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t10: {"color":"#047857","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t11: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v12: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v13: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#e3f6ec","borderRadius":18},
  t14: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t15: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v16: {"flexShrink":1},
  t17: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e6e9f8","borderRadius":14},
  v19: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v20: {"borderRadius":4},
  v21: {"flexShrink":1,"width":"82%","borderRadius":4},
  v22: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#e9ecf2","borderRadius":4,"overflow":"hidden"},
  v23: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  t24: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t25: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v26: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#fff1d6","borderRadius":14},
  t28: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#b42318","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":9,"paddingLeft":9,"height":24,"backgroundColor":"#fde8e5","borderRadius":12},
  t31: {"color":"#047857","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v33: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t35: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t36: {"color":"#4a5467","fontSize":12,"lineHeight":18,"fontFamily":"Inter_600SemiBold"},
  v37: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":56,"height":56,"backgroundColor":"#b42318","borderRadius":16},
  v39: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#fff1d6"},
  v40: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  t41: {"color":"#0e7490","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v42: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  t43: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderRadius":14,"boxShadow":"rgb(143, 152, 170) 0px 0px 0px 2.5px inset"},
  v46: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#344054","borderRadius":3.5},
  t47: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v48: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e6e9f8","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v49: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v51: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v52: {"borderRadius":18},
  t53: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v54: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v55: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v56: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
