// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-04 Release vehicle (P3, phone)
import { useEffect, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { hm, until } from '@/lib/time';
import { releaseVehicle } from '@/model/actions';
import { ackFor, loadGroups, reeferOf, shortfallFor, useTicks } from '@/model/dock';
import { precoolReading } from '@/model/field-reports';
import { useClaims, useLoadSheet, useNotifications, useOnline } from '@/model/hooks';
import type { OrderLineItem } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L10":{"to":"ld-15-handover-confirmed","kind":"go"},"L206":{"to":"ld-15-handover-confirmed","kind":"go"},"B":{"to":"ld-02-load-sheet","kind":"back"}}};

const MAX_CHILLED_C = 4;
const START_C = MAX_CHILLED_C - 1;
const initials = (name?: string | null) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

export default function ScreenLd04ReleaseVehicle() {
  const claims = useClaims();
  const online = useOnline();
  const sheet = useLoadSheet();
  const notes = useNotifications();
  const data = sheet.data;
  const trip = data?.trip;
  const lr = data?.loadRecord;
  const t = useTicks(sheet.tripId, sheet.data?.trip?.status);
  const [sealSel, setSeal] = useState<string | null>(null);
  const [tempSel, setTemp] = useState<number | null>(null);
  // the reading confirmed on LD-09 (pre-cool check), as LD-22 uses it
  const [precool, setPrecool] = useState<number | null>(null);
  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId) return;
    let live = true;
    void precoolReading(tripId).then(v => live && setPrecool(v));
    return () => {
      live = false;
    };
  }, [tripId]);
  const seal = sealSel ?? lr?.sealNumber ?? trip?.sealNumber ?? '';
  const temp = tempSel ?? precool ?? reeferOf(trip, lr);
  const chilled = trip?.vehicle?.tempClass === 'CHILLED';
  const flagged = (l: OrderLineItem) => shortfallFor(sheet.shortfalls, l);
  const groups = loadGroups(data, l => t.isTicked(l.id) || !!flagged(l));
  const lines = groups.flatMap(g => g.lines);
  const total = lines.length;
  const short = lines.filter(l => !!flagged(l)).length;
  const ticked = lines.filter(l => t.isTicked(l.id) && !flagged(l)).length;
  const accounted = ticked + short;
  const acks = sheet.shortfalls.map(sf => (trip ? ackFor(notes.data, trip.id, sf.item) : undefined)).filter(Boolean);
  const lastAck = acks.map(a => a!.sentAt).sort((a, b) => a.localeCompare(b)).at(-1);
  const driver = trip?.driver?.name ?? null;
  const checks = {
    lines: !!data && total > 0 && accounted === total,
    order: !!data && total > 0 && accounted === total,
    reefer: !!data && (!chilled || (temp !== undefined && temp <= MAX_CHILLED_C)),
    seal: !!seal.trim(),
    driver: !!driver,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const checkCount = Object.keys(checks).length;
  const firstStop = groups.at(-1)?.stop;
  const lastStop = groups[0]?.stop;
  const done: Target | undefined = trip ? { to: 'ld-15-handover-confirmed', params: { trip: trip.id } } : undefined;

  const release = trip
    ? async () => {
        if (sheet.released) return;
        if (!seal.trim()) throw new Error('Enter the seal number first');
        if (chilled && temp === undefined) throw new Error('Read the reefer first');
        if (chilled && temp !== undefined && temp > MAX_CHILLED_C) throw new Error(`Reefer reads ${temp} °C · above ${MAX_CHILLED_C} °C, it can't depart`);
        await releaseVehicle(trip, seal, temp);
        setTimeout(() => showToast(online ? `${trip.vehicleId} released · sending` : 'Release saved on this phone · sends when there is signal'), 350);
      }
    : undefined;
  // not read yet: the first tap on either button sets a passing reading a margin under the limit, then steps from there
  const bump = (d: number) => setTemp(temp === undefined ? START_C : Math.round((temp + d) * 10) / 10);

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v47}>
        <View style={s.v9}>
          <Tap lk="B" style={s.v2} to={trip ? { to: 'ld-02-load-sheet', params: { trip: trip.id }, kind: 'back' } : undefined}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}>{"Release "}<Text style={s.t3}>{trip?.vehicleId ?? "—"}</Text></Text>
          </View>
          <View style={s.v8}>
            <View style={s.v6} />
            <Text style={s.t7} numberOfLines={1}>{sheet.released ? "Release saved" : !data ? "—" : checks.lines ? "Loaded" : "Loading"}</Text>
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v42}>
          <Tap lk="L206" style={s.v19} onPress={release} to={done}>
            <Grad g={G0} style={s.v10} />
            <View>
              <Text style={s.t11}>{trip?.departTime ? `Departs ${hm(trip.departTime)}${until(trip.departTime) ? ` · ${until(trip.departTime)}` : ""}` : !claims ? "Sign in to release a vehicle" : sheet.loading && !data ? "Loading…" : "Departs —"}</Text>
            </View>
            <View style={s.v17}>
              <View style={s.v14}>
                <Text style={s.t13}>{data ? String(passed) : "—"}<Text style={s.t12}>{` of ${checkCount} checks`}</Text></Text>
              </View>
              <View style={s.v16}>
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={s.t15} numberOfLines={1}>{!data ? "—" : passed === checkCount ? "Ready to release" : `${checkCount - passed} to check`}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t18}>{`Run, dock notice and seal number go to ${driver ? `${driver.split(" ")[0]}'s` : "the driver's"} phone the moment you release.`}</Text>
            </View>
          </Tap>
          <View style={s.v41}>
            <View style={s.v22}>
              <View style={s.v14}>
                <Text style={s.t20}>{"Release checklist"}</Text>
              </View>
              <View style={s.v14}>
                <Text style={s.t21}>{!data ? "" : passed === checkCount ? "all passed" : `${passed} of ${checkCount} passed`}</Text>
              </View>
            </View>
            <View style={s.v40}>
              <View style={s.v28}>
                <View style={s.v23}>
                  {checks.lines ? <Icon xml={X2} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v27}>
                  <View>
                    <Text style={s.t24}>{!data ? "Lines accounted" : checks.lines ? `All ${total} lines accounted` : `${accounted} of ${total} lines accounted`}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{data ? `${ticked} loaded · ${short} short${short ? (lastAck ? `, ack'd ${hm(lastAck)}` : ", waiting for dispatch") : ""}` : "—"}</Text>
                  </View>
                </View>
              </View>
              <View style={s.v29}>
                <View style={s.v23}>
                  {checks.order ? <Icon xml={X2} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v27}>
                  <View>
                    <Text style={s.t24}>{"Loaded in stop order"}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{lastStop && firstStop ? (lastStop.id === firstStop.id ? `Stop ${lastStop.stopSeq} only` : `Stop ${lastStop.stopSeq} at the front · Stop ${firstStop.stopSeq} by the doors`) : "—"}</Text>
                  </View>
                </View>
              </View>
              <View style={s.v29}>
                <View style={s.v23}>
                  {checks.reefer ? <Icon xml={X2} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v27}>
                  <View>
                    <Text style={s.t24}>{"Reefer checked"}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{chilled ? `Needs ≤ ${MAX_CHILLED_C} °C${lr?.loadedAt ? ` · read ${hm(lr.loadedAt)}` : ""}` : data ? "Ambient load" : "—"}</Text>
                  </View>
                </View>
                <View style={x.temp}>
                  <Tap style={x.step} to={null} onPress={() => bump(-0.5)} testID="reefer-minus">
                    <Text style={s.t30}>{"−"}</Text>
                  </Tap>
                  <View style={s.v32}>
                    <View>
                      <Text style={s.t30} testID="reefer-temp">{temp !== undefined ? `${temp} °C` : "— °C"}</Text>
                    </View>
                    <View>
                      <Text style={s.t31}>{temp === undefined ? "not read" : checks.reefer ? "passes" : "too warm"}</Text>
                    </View>
                  </View>
                  <Tap style={x.step} to={null} onPress={() => bump(0.5)} testID="reefer-plus">
                    <Text style={s.t30}>{"+"}</Text>
                  </Tap>
                </View>
              </View>
              <View style={s.v29}>
                <View style={s.v23}>
                  {checks.seal ? <Icon xml={X2} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v27}>
                  <View>
                    <Text style={s.t24}>{"Doors sealed"}</Text>
                  </View>
                  <View style={s.v26}>
                    <View style={s.v34}>
                      <Icon xml={X3} width={13} height={13} style={s.v1} />
                      <TextInput
                        value={seal}
                        onChangeText={setSeal}
                        placeholder="Seal number"
                        placeholderTextColor="#8f98aa"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!sheet.released}
                        style={[s.t33, x.input]}
                        testID="seal-input"
                      />
                    </View>
                    <View style={s.v36}>
                      <Icon xml={X4} width={14} height={14} style={s.v1} />
                      <Text style={s.t35} numberOfLines={1}>{checks.seal ? "Matches the number on the seal" : "Type the number on the seal"}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={s.v29}>
                <View style={s.v38}>
                  <Text style={s.t37}>{initials(driver) || "—"}</Text>
                </View>
                <View style={s.v27}>
                  <View>
                    <Text style={s.t24}>{driver ? `Hand over to ${driver}` : data ? "No driver assigned yet" : "Hand over to the driver"}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{trip?.vehicle ? `Driver · ${trip.vehicle.tempClass === "CHILLED" ? "reefer " : ""}${trip.vehicle.type === "VAN" ? "van" : "truck"}` : "Driver"}</Text>
                    <View style={s.v14}>
                      <Text style={s.t39}>{trip?.vehicleId ?? "—"}</Text>
                    </View>
                  </View>
                </View>
                {/* every check that counts in the header shows its tick, the driver's too */}
                <View style={s.v23} testID="driver-check">
                  {checks.driver ? <Icon xml={X2} width={22} height={22} style={s.v1} /> : null}
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v46}>
          <Tap lk="L10" style={s.v45} onPress={release} to={done}>
            <Grad g={G1} style={s.v43} />
            <Icon xml={X5} width={22} height={22} style={s.v1} />
            <Text style={s.t44}>{trip ? (sheet.released ? `${trip.vehicleId} released · see handover` : `Release ${trip.vehicleId} to driver`) : "Release to driver"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  temp: { flexDirection: 'row', alignItems: 'center', columnGap: 8, flexShrink: 0 },
  step: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#e9ecf2' },
  input: { minWidth: 110, paddingVertical: 0, paddingHorizontal: 0, borderWidth: 0 },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"13\" height=\"13\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M19 3v4M17 5h4\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15 18H9\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"17\" cy=\"18\" r=\"2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"7\" cy=\"18\" r=\"2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#1e2766","p":0},{"c":"#141b4d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#3b4cca","borderRadius":3.5},
  t7: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e6e9f8","borderRadius":14},
  v9: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v10: {"borderRadius":24},
  t11: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t12: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t13: {"color":"#ffffff","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v14: {"flexShrink":1},
  t15: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t18: {"color":"#b9c0e6","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v19: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"borderRadius":24,"boxShadow":"rgba(20, 27, 77, 0.28) 0px 12px 32px 0px"},
  t20: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  t24: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t25: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v26: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  t30: {"color":"#0e7490","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t31: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v32: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  t33: {"color":"#0a0f1a","fontSize":13,"lineHeight":18.2,"fontFamily":"JetBrainsMono_700Bold"},
  v34: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":9,"paddingLeft":9,"height":26,"backgroundColor":"#e9ecf2","borderRadius":8},
  t35: {"color":"#3b4cca","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_600SemiBold"},
  v36: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  t37: {"color":"#1a1300","fontSize":14,"lineHeight":21,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#f5b83d","borderRadius":14},
  t39: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v40: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v43: {"borderRadius":18},
  t44: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v47: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
