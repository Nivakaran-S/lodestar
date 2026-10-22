// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-17 Offline dock Wi-Fi · phone (P3, phone)
import { Text, View, StyleSheet } from 'react-native';
import { ago, hm } from '@/lib/time';
import { loadGroups, shortfallFor, tempLabel, useTicks } from '@/model/dock';
import { useClaims, useLoadSheet, useOnline, useOutbox } from '@/model/hooks';
import { sync } from '@/model/platform';
import type { QueueKind } from '@/offline/queue';
import type { OrderLineItem } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L210":{"to":"ld-02-load-sheet","kind":"go"},"B":{"to":"ld-01-dock-queue","kind":"back"}}};

const KIND: Partial<Record<QueueKind, string>> = { SHORTFALL: 'Flag', RELEASE: 'Release', ARRIVAL: 'Arrival', LEAVE: 'Departure', POD_SAVE: 'Proof of delivery', RECEIPT: 'Receipt', ORDER: 'Order' };
const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

export default function ScreenLd17OfflineDockWiFi() {
  const claims = useClaims();
  const online = useOnline();
  const { waiting, summary, syncing } = useOutbox();
  const sheet = useLoadSheet();
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
  const group = current ? groups.find(g => g.lines.includes(current)) : undefined;
  const oldest = summary.oldestPendingAt;

  const sendNow = async () => {
    if (!claims) throw new Error('Sign in to send what is waiting');
    if (!online) throw new Error('No signal · it sends by itself when Wi-Fi is back');
    if (!waiting.length) {
      showToast('Nothing waiting · all sent');
      return;
    }
    await sync.flush();
    showToast('Sending what was saved on this phone');
  };

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v50}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}><Text style={s.t3}>{trip?.vehicleId ?? "—"}</Text>{trip?.departTime ? ` · departs ${hm(trip.departTime)}` : ""}</Text>
          </View>
          <View style={s.v7}>
            <Text style={s.t6} numberOfLines={1} testID="net-state">{online ? (syncing ? "Sending" : "Online") : "Offline"}</Text>
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v45}>
          <Tap lk="L210" style={s.v13} to={trip ? { to: "ld-02-load-sheet", params: { trip: trip.id } } : undefined}>
            <Icon xml={X1} width={20} height={20} style={s.v9} />
            <View style={s.v12}>
              <View>
                <Text style={s.t10}>{online ? (waiting.length ? "Dock Wi-Fi back · sending" : "Dock Wi-Fi on · all sent") : `Dock Wi-Fi lost${oldest ? ` · saving since ${hm(oldest)}` : ""}`}</Text>
              </View>
              <View>
                <Text style={s.t11}>{"Keep loading. Ticks save on this phone and send when Wi-Fi is back."}</Text>
              </View>
            </View>
          </Tap>
          <View style={s.v20}>
            <View style={s.v17}>
              <View style={s.v16}>
                <Text style={s.t15}>{data ? String(done) : "—"}<Text style={s.t14}>{` of ${total} ${total === 1 ? 'line' : 'lines'}`}</Text></Text>
              </View>
              <Tap style={s.v7} to={null} onPress={sendNow} disabled={syncing} testID="send-now">
                <Text style={s.t6} numberOfLines={1}>{waiting.length ? (online ? `Send ${waiting.length} now` : `${waiting.length} to send`) : "All sent"}</Text>
              </Tap>
            </View>
            <View style={s.v19}>
              <View style={[s.v18, { width: `${total ? Math.round((done / total) * 100) : 0}%` }]} />
            </View>
            <View>
              <Text style={s.t11}>{oldest ? `Oldest waiting since ${hm(oldest)} (${ago(oldest)}). Flags and releases send in the order they were saved.` : "Flags and releases wait on this phone and send in order when Wi-Fi is back."}</Text>
            </View>
          </View>
          <View style={s.v36}>
            <View style={s.v23}>
              <View style={s.v16}>
                <Text style={s.t21}>{`Saved on this phone · ${waiting.length}`}</Text>
              </View>
              <View style={s.v16}>
                <Text style={s.t22}>{"not sent yet"}</Text>
              </View>
            </View>
            <View style={s.v35}>
              {waiting.length ? (
                waiting.map((i, n) => (
                  <View key={i.id} style={n === 0 ? s.v33 : s.v34} testID={`waiting-row-${n}`}>
                    <View style={s.v24}>
                      <Icon xml={X2} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v29}>
                      <View>
                        <Text style={s.t25}>{i.label}</Text>
                      </View>
                      <View style={s.v28}>
                        <Text style={s.t26}>{KIND[i.kind] ?? i.kind}</Text>
                        <View style={s.v27} />
                        <Text style={s.t26}>{`saved ${hm(i.savedAt)}`}</Text>
                      </View>
                    </View>
                    <View style={s.v32}>
                      <View style={s.v30} />
                      <Text style={s.t31} numberOfLines={1}>{i.status === "sending" ? "Sending" : "Waiting"}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={s.v33}>
                  <View style={s.v29}>
                    <Text style={s.t26}>{claims ? "Nothing waiting · everything is sent" : "Sign in to see what is waiting"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <View style={s.v36}>
            <View style={s.v23}>
              <View style={s.v16}>
                <Text style={s.t21}>{"Next"}</Text>
              </View>
              <View style={s.v16}>
                <Text style={s.t22}>{group ? `Stop ${group.stop.stopSeq}${current ? ` · ${tempLabel(current.tempClass).toLowerCase()}` : ""}` : ""}</Text>
              </View>
            </View>
            <View style={s.v35}>
              {current ? (
                <View style={s.v44}>
                  <Tap style={x.tapRow} to={null} onPress={() => t.tick(current.id)} testID="next-line">
                    <View style={s.v37} />
                    <View style={s.v29}>
                      <View>
                        <Text style={s.t25}>{current.name}</Text>
                      </View>
                      <View style={s.v28}>
                        <View style={s.v32}>
                          <View style={s.v38} />
                          <Text style={s.t39} numberOfLines={1}>{tempLabel(current.tempClass)}</Text>
                        </View>
                        <View style={s.v27} />
                        <Text style={s.t26}>{`${n0(current.kg)} kg`}</Text>
                      </View>
                    </View>
                    <View style={s.v42}>
                      <View>
                        <Text style={s.t40}>{current.qty}</Text>
                      </View>
                      <View>
                        <Text style={s.t41}>{current.qty === 1 ? "unit" : "units"}</Text>
                      </View>
                    </View>
                  </Tap>
                  <Tap style={s.v43} to={trip ? { to: "ld-03-flag-shortfall", params: { trip: trip.id, item: current.name } } : null} testID="flag-next">
                    <Icon xml={X3} width={22} height={22} style={s.v1} />
                  </Tap>
                </View>
              ) : (
                <View style={s.v44}>
                  <View style={s.v29}>
                    <Text style={s.t26}>{!claims ? "Sign in to see the load sheet" : data ? (total ? "All lines loaded" : "No lines on this trip") : "No load sheet saved on this phone"}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v49}>
          <Tap style={s.v48} to={current ? null : trip ? { to: "ld-04-release-vehicle", params: { trip: trip.id } } : null} onPress={current ? () => t.tick(current.id) : undefined} disabled={!current && !trip} testID="tick-next">
            <Grad g={G0} style={s.v46} />
            <Icon xml={X4} width={22} height={22} style={s.v1} />
            <Text style={s.t47} numberOfLines={1}>{current ? `Tick ${current.name}` : trip ? "Release vehicle" : "Tick line"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  tapRow: { flexDirection: 'row', alignItems: 'center', columnGap: 14, flexGrow: 1, flexShrink: 1, flexBasis: '0%' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#57534e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#57534e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#57534e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#57534e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#57534e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t6: {"color":"#57534e","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v9: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t10: {"color":"#57534e","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t11: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v12: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v13: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"borderWidth":1,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":18},
  t14: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t15: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v16: {"flexShrink":1},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v18: {"flexShrink":1,"width":"73%","backgroundColor":"#78716c","borderRadius":4},
  v19: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#e9ecf2","borderRadius":4,"overflow":"hidden"},
  v20: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"borderWidth":1,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":24},
  t21: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t22: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v23: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderRadius":14,"boxShadow":"rgb(168, 162, 158) 0px 0px 0px 1.5px inset"},
  t25: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t26: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v27: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  v28: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v29: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v30: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#57534e","borderRadius":3.5},
  t31: {"color":"#57534e","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v34: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v35: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderRadius":14,"boxShadow":"rgb(143, 152, 170) 0px 0px 0px 2.5px inset"},
  v38: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#344054","borderRadius":3.5},
  t39: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  t40: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t41: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v42: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v43: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":56,"height":56,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgb(216, 221, 230) 0px 0px 0px 1.5px inset"},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e6e9f8"},
  v45: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v46: {"borderRadius":18},
  t47: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v48: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v49: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v50: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
