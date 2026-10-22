// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-30 Load sheet · speaking (P3, phone)
// The load sheet of the trip (route param `trip`, else the bay's loading trip: useLoadSheet, as LD-02) read aloud
// with the phone's voice in the app language (expo-speech): trip, vehicle, bay, lines and stops, then the next line
// to load. It speaks by itself on open when read aloud is on; the speaking bar stops it and goes back to the load
// sheet; "Tick …" opens the scan for that line (LD-10). The words are the sheet's own (English text, spoken in the
// chosen language's voice).
import { useEffect, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useSettings, LANGUAGE_NAMES } from '@/lib/settings';
import { hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { speakIn, stopSpeaking, useSpeaking } from '@/lodestar/voice';
import { useClaims, useLoadSheet } from '@/model/hooks';
import { loadGroups, ordinal, reeferOf, shortfallFor, tempLabel, useMarkLoading, useRePlanAlert, useTicks } from '@/model/dock';
import type { OrderLineItem } from '@/model/types';
import { truckSvg } from '@/lodestar/truck';
import { TruckDiagram } from '@/lodestar/truck-view';
import { Frame, Grad, Icon, Scroll, Tap, openScreen, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L219":{"to":"ld-10-scan-a-line","kind":"go"},"L220":{"to":"ld-02-load-sheet","kind":"go"},"B":{"to":"ld-02-load-sheet","kind":"back"}}};

const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

export default function ScreenLd30LoadSheetSpeaking() {
  const claims = useClaims();
  const sheet = useLoadSheet();
  const data = sheet.data;
  const trip = data?.trip;
  const t = useTicks(sheet.tripId, sheet.data?.trip?.status);
  useMarkLoading(data?.trip, !!data?.loadRecord || sheet.shortfalls.length > 0 || Object.keys(t.map).length > 0);
  const { language, readAloud } = useSettings();
  useRePlanAlert(trip?.depot, planId => trip && openScreen('ld-12-plan-changed', { trip: trip.id, plan: planId }));
  const speaking = useSpeaking();
  const flagged = (l: OrderLineItem) => shortfallFor(sheet.shortfalls, l);
  const accounted = (l: OrderLineItem) => t.isTicked(l.id) || !!flagged(l);
  const groups = loadGroups(data, accounted);
  const truck = truckSvg(groups);
  const lines = groups.flatMap(g => g.lines);
  const total = lines.length;
  const done = lines.filter(accounted).length;
  const current = lines.find(l => !accounted(l)) ?? null;
  const gi = groups.findIndex(g => g.ticked < g.lines.length);
  const currentGroup = gi >= 0 ? groups[gi]! : null;
  const prevGroup = gi > 0 ? groups[gi - 1]! : gi < 0 && groups.length ? groups[groups.length - 1]! : null;
  const temp = reeferOf(trip, data?.loadRecord);
  const kg = data ? data.stops.reduce((n, st) => n + (st.order?.kg ?? 0), 0) : 0;
  const m3 = data ? data.stops.reduce((n, st) => n + (st.order?.m3 ?? 0), 0) : 0;
  const capKg = trip?.vehicle?.capacityKg;
  const capM3 = trip?.vehicle?.capacityM3;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const empty = !claims ? 'Sign in to see the load sheet' : sheet.loading && !data ? 'Loading the load sheet…' : !data ? 'No trip to load' : 'No lines on this trip';
  const nextLine = current && currentGroup
    ? `Next: ${current.name}, ${plural(current.qty, 'unit')}, stop ${currentGroup.stop.stopSeq}, ${currentGroup.stop.outletId}${current.tempClass === 'CHILLED' ? ', chilled' : ''}.`
    : total ? 'All lines loaded.' : '';
  const say = data && trip
    ? [
        `Trip ${trip.tripNumber ?? trip.id}, vehicle ${trip.vehicleId}${trip.bay ? `, bay ${trip.bay}` : ''}${trip.departTime ? `, departs ${hm(trip.departTime)}` : ''}.`,
        `${plural(total, 'line')} for ${plural(data.stops.length, 'stop')}, ${done} loaded.`,
        nextLine,
      ].filter(Boolean).join(' ')
    : '';

  // speaks by itself once per trip when read aloud is on; stops when the screen closes
  const spokenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!readAloud || !say || !trip || spokenFor.current === trip.id) return;
    spokenFor.current = trip.id;
    speakIn(say, language);
  }, [readAloud, say, trip, language]);
  useEffect(() => () => stopSpeaking(), []);

  const sheetTo = (kind: 'go' | 'back') => (trip ? { to: 'ld-02-load-sheet', params: { trip: trip.id }, kind } : undefined);
  const groupTitle = (g: NonNullable<typeof currentGroup>) => `${ordinal(g.order)} · Stop ${g.stop.stopSeq} · ${g.stop.outlet?.name ?? g.stop.outletId}`;

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v70}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2} to={sheetTo('back')} onPress={stopSpeaking}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}><Text style={s.t3}>{trip?.vehicleId ?? "—"}</Text>{trip?.departTime ? ` · departs ${hm(trip.departTime)}` : ""}</Text>
          </View>
          <View style={s.v7}>
            <Text style={s.t6} numberOfLines={1}>{trip ? `Plan v${trip.planVersion}` : "Plan —"}</Text>
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v47}>
          <View style={s.v27}>
            <View style={s.v14}>
              <View style={s.v11}>
                <Text style={s.t10} testID="lines-done">{String(done)}<Text style={s.t9}>{` of ${plural(total, 'line')}`}</Text></Text>
              </View>
              <View style={s.v13}>
                <Text style={s.t12} numberOfLines={1}>{total ? `${total - done} to go${trip?.bay ? ` · bay ${trip.bay}` : ''}` : '—'}</Text>
              </View>
            </View>
            <View style={s.v17}>
              <View style={[s.v16, { width: `${pct}%` }]}>
                <Grad g={G0} style={s.v15} />
              </View>
            </View>
            <View style={s.v24}>
              {truck ? <TruckDiagram xml={truck} style={s.v18} /> : null}
              <View style={s.v23}>
                <Text style={s.t19}>{"Cab left, rear doors right"}</Text>
                <View style={s.v20} />
                <View style={s.v22}>
                  <Icon xml={X2} width={14} height={14} style={s.v1} />
                  <Text style={s.t21} numberOfLines={1}>{temp !== undefined ? `reefer ${temp} °C` : trip?.vehicle?.tempClass === 'CHILLED' ? 'reefer —' : 'ambient'}</Text>
                </View>
              </View>
            </View>
            <View>
              <Text style={s.t26}>{"Weight "}<Text style={s.t25}>{capKg ? `${n0(kg)} / ${n0(capKg)} kg` : `${n0(kg)} kg`}</Text>{capKg ? ` (${Math.round((kg / capKg) * 100)}%)` : ''}{" · Volume "}<Text style={s.t25}>{capM3 ? `${n0(m3)} / ${n0(capM3)} m³` : `${n0(m3)} m³`}</Text></Text>
            </View>
          </View>
          {prevGroup ? (
            <View style={s.v37}>
              <View style={s.v36}>
                <View style={s.v28}>
                  <Icon xml={X3} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v32}>
                  <View>
                    <Text style={s.t29}>{groupTitle(prevGroup)}</Text>
                  </View>
                  <View style={s.v23}>
                    <View style={s.v11}>
                      <Text style={s.t30}>{prevGroup.stop.outletId}</Text>
                    </View>
                    <View style={s.v20} />
                    <Text style={s.t31}>{prevGroup.ticked === prevGroup.lines.length ? 'all loaded' : 'loading'}</Text>
                  </View>
                </View>
                <View style={s.v35}>
                  <View>
                    <Text style={s.t33}>{`${prevGroup.ticked}/${prevGroup.lines.length}`}</Text>
                  </View>
                  <View>
                    <Text style={s.t34}>{"lines"}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
          <View style={s.v46}>
            <View style={s.v40}>
              <View style={s.v11}>
                <Text style={s.t38}>{currentGroup ? groupTitle(currentGroup) : total ? 'All lines loaded' : empty}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t39}>{currentGroup ? `${currentGroup.ticked} of ${currentGroup.lines.length}` : ''}</Text>
              </View>
            </View>
            {current ? (
              <View style={s.v45}>
                <View style={s.v44}>
                  <View style={s.v41} />
                  <View style={s.v32}>
                    <View>
                      <Text style={s.t29} testID="next-line">{current.name}</Text>
                    </View>
                    <View style={s.v23}>
                      {tempLabel(current.tempClass) ? (
                        <View style={s.v22}>
                          <Icon xml={X2} width={14} height={14} style={s.v1} />
                          <Text style={s.t42} numberOfLines={1}>{tempLabel(current.tempClass)}</Text>
                        </View>
                      ) : null}
                      <View style={s.v20} />
                      <Text style={s.t31}>{`${n0(current.kg)} kg`}</Text>
                    </View>
                  </View>
                  <View style={s.v35}>
                    <View>
                      <Text style={s.t33}>{String(current.qty)}</Text>
                    </View>
                    <View>
                      <Text style={s.t34}>{current.qty === 1 ? "unit" : "units"}</Text>
                    </View>
                  </View>
                  <View style={s.v43}>
                    <Icon xml={X4} width={22} height={22} style={s.v1} />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </Scroll>
        <View style={s.v69}>
          <Tap to={null} group style={s.v54} disabled={!say} onPress={() => { speakIn(say, language); return false; }} testID="replay">
            {speaking ? (
              <View style={s.v51}>
                <View style={s.v48} />
                <View style={s.v49} />
                <View style={s.v50} />
              </View>
            ) : null}
            <View style={s.v11}>
              <Text style={[s.t53, x.body]} testID="spoken-text">{say || empty}</Text>
            </View>
          </Tap>
          <View style={s.v65}>
            <Tap lk="L220" style={s.v61} to={sheetTo('go')} onPress={stopSpeaking}>
              <Icon xml={X5} width={22} height={22} style={s.v1} />
              <View style={s.v11}>
                <Text style={[s.t56, x.bold]} numberOfLines={1}>{speaking ? "Speaking · " : "Read aloud · "}<Text><Text style={x[language]}>{LANGUAGE_NAMES[language]}</Text></Text></Text>
              </View>
              {speaking ? (
                <View style={s.v60}>
                  <View style={s.v57} />
                  <View style={s.v58} />
                  <View style={s.v59} />
                </View>
              ) : null}
            </Tap>
            <View style={s.v64}>
              <View>
                <Text style={s.t62}>{speaking ? "Tap to stop" : "Tap the text to replay"}</Text>
              </View>
              <View>
                <Text style={s.t63}>{"This phone, offline"}</Text>
              </View>
            </View>
          </View>
          <Tap lk="L219" style={s.v68} disabled={!current} to={trip && current ? { to: 'ld-10-scan-a-line', params: { trip: trip.id, line: current.id } } : undefined} onPress={stopSpeaking}>
            <Grad g={G1} style={s.v66} />
            <Icon xml={X6} width={22} height={22} style={s.v1} />
            <Text style={s.t67}>{current ? `Tick ${current.name}` : 'All lines ticked'}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  body: { fontFamily: 'Inter_600SemiBold' },
  bold: { fontFamily: 'Inter_800ExtraBold' },
  en: { fontFamily: 'Inter_800ExtraBold' },
  si: { fontFamily: 'NotoSansSinhala_800ExtraBold' },
  ta: { fontFamily: 'NotoSansTamil_800ExtraBold' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
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
  t9: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t10: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexShrink":1},
  t12: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e6e9f8","borderRadius":14},
  v14: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v15: {"borderRadius":4},
  v16: {"flexShrink":1,"width":"64%","borderRadius":4},
  v17: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#e9ecf2","borderRadius":4,"overflow":"hidden"},
  v18: {"flexShrink":1,"overflow":"hidden"},
  t19: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v20: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  t21: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v23: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"paddingTop":2},
  t25: {"fontFamily":"Inter_700Bold"},
  t26: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingTop":12,"paddingRight":20,"marginRight":16,"paddingBottom":12,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  v28: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  t29: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t30: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t31: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t33: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t34: {"color":"#4a5467","fontSize":12,"lineHeight":18,"fontFamily":"Inter_600SemiBold"},
  v35: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v36: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e3f6ec"},
  v37: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  t38: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t39: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v40: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderRadius":14,"boxShadow":"rgb(143, 152, 170) 0px 0px 0px 2.5px inset"},
  t42: {"color":"#0e7490","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v43: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":56,"height":56,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgb(216, 221, 230) 0px 0px 0px 1.5px inset"},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e6e9f8"},
  v45: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v47: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"paddingTop":4,"paddingBottom":8},
  v48: {"flexShrink":1,"width":4,"height":6,"backgroundColor":"#f5b83d","borderRadius":2},
  v49: {"flexShrink":1,"width":4,"height":12,"backgroundColor":"#f5b83d","borderRadius":2},
  v50: {"flexShrink":1,"width":4,"height":9,"backgroundColor":"#f5b83d","borderRadius":2},
  v51: {"flexDirection":"row","alignItems":"flex-end","rowGap":3,"columnGap":3,"flexShrink":0,"marginTop":4,"height":14},
  t52: {"fontFamily":"NotoSansTamil_600SemiBold"},
  t53: {"color":"#0a0f1a","fontSize":15,"lineHeight":21.8,"fontFamily":"NotoSansTamil_600SemiBold"},
  v54: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":14,"paddingBottom":11,"paddingLeft":14,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgb(245, 184, 61) 0px 0px 0px 2px inset"},
  t55: {"fontFamily":"NotoSansTamil_800ExtraBold"},
  t56: {"color":"#ffffff","fontSize":16,"lineHeight":24,"letterSpacing":-0.2,"fontFamily":"NotoSansTamil_800ExtraBold"},
  v57: {"flexShrink":1,"width":4,"height":8,"backgroundColor":"#ffcb5c","borderRadius":2},
  v58: {"flexShrink":1,"width":4,"height":18,"backgroundColor":"#ffcb5c","borderRadius":2},
  v59: {"flexShrink":1,"width":4,"height":12,"backgroundColor":"#ffcb5c","borderRadius":2},
  v60: {"flexDirection":"row","alignItems":"flex-end","rowGap":3,"columnGap":3,"flexShrink":0,"height":18},
  v61: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":22,"paddingLeft":18,"height":56,"backgroundColor":"#141b4d","borderRadius":28,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 6px 16px 0px"},
  t62: {"color":"#344054","fontSize":13,"lineHeight":16.9,"fontFamily":"Inter_700Bold"},
  t63: {"color":"#4a5467","fontSize":13,"lineHeight":16.9,"fontFamily":"Inter_600SemiBold"},
  v64: {"flexDirection":"column","alignItems":"stretch","rowGap":1,"columnGap":1,"flexShrink":1},
  v65: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12},
  v66: {"borderRadius":18},
  t67: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v68: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v69: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingTop":8,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v70: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
