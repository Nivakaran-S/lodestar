// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-12 Pre-trip vehicle check · phone (P4, phone)
// The driver ticks each walk-around check and types the reefer reading from the display (the camera only takes a
// photo that stays on the phone). "Checks done" queues a VEHICLE_CHECK report to dispatch through the outbox.
import { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { CameraBox, useCamera } from '@/lodestar/camera';
import { plural } from '@/lodestar/live';
import { reeferOf } from '@/model/dock';
import { reportToDispatch } from '@/model/field-reports';
import { useOnline, useRun } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { TEMP_KEYBOARD } from '@/lib/keyboard';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L240":{"to":"dr-13-saving-run-for-offline","kind":"go"},"B":{"to":"dr-11-load-handover-received","kind":"back"}}};

/** A chilled load needs the reefer at or below this (as on the design, LD-04 and LD-09). */
const MAX_CHILLED_C = 4;
const parseTemp = (v: string) => {
  const n = Number(v.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};
type Check = 'reefer' | 'seal' | 'fuel' | 'tyres' | 'lights';
const ITEMS: [Check, string][] = [['reefer', 'Reefer temperature'], ['seal', 'Seal'], ['fuel', 'Fuel'], ['tyres', 'Tyres'], ['lights', 'Lights and wipers']];

export default function ScreenDr12PreTripVehicleCheck() {
  const { view } = useRun();
  const online = useOnline();
  const trip = view?.trip ?? null;
  const cam = useCamera();
  const [text, setText] = useState('');
  const [readAt, setReadAt] = useState<string | null>(null);
  const [photoAt, setPhotoAt] = useState<string | null>(null);
  const [ticks, setTicks] = useState<Record<Check, boolean>>({ reefer: false, seal: false, fuel: false, tyres: false, lights: false });
  const chilled = trip?.vehicle ? trip.vehicle.tempClass === 'CHILLED' : true;
  const dock = reeferOf(trip, trip?.loadRecord);
  const reading = parseTemp(text);
  const tooWarm = chilled && reading !== undefined && reading > MAX_CHILLED_C;
  const seal = trip?.sealNumber ?? trip?.loadRecord?.sealNumber ?? null;
  const done = ITEMS.filter(([k]) => ticks[k]).length;
  const stops = view?.tripStops.length ?? 0;
  const toggle = (k: Check) => {
    setTicks(t => ({ ...t, [k]: !t[k] }));
    return false;
  };
  const items = () => ITEMS.map(([k, item]) => ({ item, ok: ticks[k] }));

  const photo = async () => {
    if (!cam.granted) {
      if (!(await cam.ensure())) showToast('No camera · type the reading from the display', 'error');
      return false;
    }
    // read the display from the photo (OCR); the person checks the value, typing stays the fallback
    const read = await cam.read('temperature');
    if (read?.value) {
      setText(read.value);
      setPhotoAt(new Date().toISOString());
      showToast(`Read ${read.value}\u00a0°C from the photo · check it`);
    } else showToast("Couldn't read the display · type the reading", 'error');
    return false;
  };

  const send = async (ok: boolean) => {
    if (!trip) throw new Error('No trip on this phone yet');
    const note = [reading !== undefined ? `Reefer ${reading}\u00a0°C` : '', photoAt ? 'display photo kept on the phone' : ''].filter(Boolean).join(' · ');
    await reportToDispatch(trip.id, { report: 'VEHICLE_CHECK', ok, items: items(), ...(note ? { note } : {}) }, trip.id, { vehicleId: trip.vehicleId });
    showToast(online ? 'Sent to dispatch' : 'Saved · sends when signal returns');
  };

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v43}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Pre-trip check"}</Text>
          </View>
          <View style={s.v7}>
            <View style={s.v6}>
              <Text style={s.t5} numberOfLines={1}>{trip?.vehicleId ?? "—"}</Text>
            </View>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v36}>
          <View style={s.v16}>
            <View>
              <Text style={s.t9}>{`Reefer · your reading${readAt ? ` ${hm(readAt)}` : ""}`}</Text>
            </View>
            <View style={s.v14}>
              <View style={[s.v6, x.row]}>
                <TextInput
                  value={text}
                  onChangeText={v => {
                    setText(v);
                    setReadAt(new Date().toISOString());
                  }}
                  placeholder="—"
                  placeholderTextColor="#7f89a3"
                  keyboardType={TEMP_KEYBOARD}
                  style={[s.t10, x.input]}
                  testID="reefer-reading"
                />
                <Text style={s.t10}>{"\u00a0°C"}</Text>
              </View>
              {reading !== undefined && chilled ? (
                <View style={tooWarm ? x.warmPill : s.v13}>
                  <View style={tooWarm ? x.warmDot : s.v11} />
                  <Text style={tooWarm ? x.warmText : s.t12} numberOfLines={1}>{tooWarm ? "Too warm" : "Cold enough"}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={s.t15}>{chilled ? `Must be ≤\u00a0${MAX_CHILLED_C}\u00a0°C.${dock !== undefined ? ` Dock read ${dock}\u00a0°C${trip?.loadRecord?.loadedAt ? ` at ${hm(trip.loadRecord.loadedAt)}` : ""}.` : " No dock reading yet."}` : "Dry load · no reefer reading needed."}</Text>
            </View>
          </View>
          <View style={s.v35}>
            <View style={s.v19}>
              <View style={s.v6}>
                <Text style={s.t17}>{"Walk-around"}</Text>
              </View>
              <View style={s.v6}>
                <Text style={s.t18} testID="checks-done">{`${done} of ${ITEMS.length} done`}</Text>
              </View>
            </View>
            <View style={s.v34}>
              <View style={s.v30}>
                <CameraBox cam={cam} style={s.v20}>
                  <Icon xml={X1} width={22} height={22} style={s.v1} />
                </CameraBox>
                <View style={s.v28}>
                  <View>
                    <Text style={s.t21}>{"Reefer temperature"}</Text>
                  </View>
                  <View style={s.v26}>
                    <View style={s.v23}>
                      <Icon xml={X2} width={14} height={14} style={s.v1} />
                      <Text style={s.t22} numberOfLines={1}>{reading !== undefined ? `${reading}\u00a0°C` : "—"}</Text>
                    </View>
                    <View style={s.v24} />
                    <Text style={s.t25}>{chilled ? `needs ≤\u00a0${MAX_CHILLED_C}\u00a0°C` : "dry load"}</Text>
                  </View>
                  <Tap style={s.v26} onPress={photo} to={null} testID="reefer-photo">
                    <View style={s.v23}>
                      <Icon xml={X3} width={14} height={14} style={s.v1} />
                      <Text style={s.t27} numberOfLines={1}>{photoAt ? `Display photo ${hm(photoAt)} · on the phone` : "Read from display photo"}</Text>
                    </View>
                  </Tap>
                </View>
                <Tap style={ticks.reefer ? s.v29 : x.off} onPress={() => toggle('reefer')} to={null} testID="check-reefer">
                  {ticks.reefer ? <Icon xml={X4} width={20} height={20} style={s.v1} /> : null}
                </Tap>
              </View>
              <View style={s.v33}>
                <View style={s.v31}>
                  <Icon xml={X5} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v28}>
                  <View>
                    <Text style={s.t21}>{"Seal "}<Text style={s.t32}>{seal ?? "—"}</Text></Text>
                  </View>
                  <View style={s.v26}>
                    <View style={s.v23}>
                      <Icon xml={X3} width={14} height={14} style={s.v1} />
                      <Text style={s.t27} numberOfLines={1}>{seal ? "Check the seal on the door matches" : "No seal recorded at the dock"}</Text>
                    </View>
                  </View>
                </View>
                <Tap style={ticks.seal ? s.v29 : x.off} onPress={() => toggle('seal')} to={null} testID="check-seal">
                  {ticks.seal ? <Icon xml={X4} width={20} height={20} style={s.v1} /> : null}
                </Tap>
              </View>
              <View style={s.v33}>
                <View style={s.v31}>
                  <Icon xml={X6} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v28}>
                  <View>
                    <Text style={s.t21}>{"Fuel"}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{stops ? `Enough for today's ${plural(stops, "stop")} and back` : "Enough for today's run and back"}</Text>
                  </View>
                </View>
                <Tap style={ticks.fuel ? s.v29 : x.off} onPress={() => toggle('fuel')} to={null} testID="check-fuel">
                  {ticks.fuel ? <Icon xml={X4} width={20} height={20} style={s.v1} /> : null}
                </Tap>
              </View>
              <View style={s.v33}>
                <View style={s.v31}>
                  <Icon xml={X7} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v28}>
                  <View>
                    <Text style={s.t21}>{"Tyres"}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{"Pressure and tread look fine"}</Text>
                  </View>
                </View>
                <Tap style={ticks.tyres ? s.v29 : x.off} onPress={() => toggle('tyres')} to={null} testID="check-tyres">
                  {ticks.tyres ? <Icon xml={X4} width={20} height={20} style={s.v1} /> : null}
                </Tap>
              </View>
              <View style={s.v33}>
                <View style={s.v31}>
                  <Icon xml={X8} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v28}>
                  <View>
                    <Text style={s.t21}>{"Lights and wipers"}</Text>
                  </View>
                  <View style={s.v26}>
                    <Text style={s.t25}>{"Hill roads: check fog lights too"}</Text>
                  </View>
                </View>
                <Tap style={ticks.lights ? s.v29 : x.off} onPress={() => toggle('lights')} to={null} testID="check-lights">
                  {ticks.lights ? <Icon xml={X4} width={20} height={20} style={s.v1} /> : null}
                </Tap>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v42}>
          <Tap
            lk="L240"
            style={s.v39}
            onPress={async () => {
              if (!trip) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
              if (done < ITEMS.length) {
                showToast("Tick each check, or tap Something's wrong", 'error');
                return false;
              }
              if (chilled && reading === undefined) {
                showToast('Type the reefer reading first', 'error');
                return false;
              }
              await send(!tooWarm);
              return true;
            }}
          >
            <Grad g={G0} style={s.v37} />
            <Icon xml={X9} width={22} height={22} style={s.v1} />
            <Text style={s.t38}>{"Checks done"}</Text>
          </Tap>
          <Tap
            style={s.v41}
            to={null}
            testID="vehicle-wrong"
            onPress={async () => {
              await send(false);
              return false;
            }}
          >
            <Icon xml={X10} width={18} height={18} style={s.v1} />
            <Text style={s.t40}>{"Something's wrong with the van"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { minWidth: 48, padding: 0, margin: 0 },
  off: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexShrink: 0, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#3b4666' },
  warmPill: { flexDirection: 'row', alignItems: 'center', columnGap: 6, flexShrink: 1, paddingHorizontal: 12, height: 28, backgroundColor: '#2e2208', borderRadius: 14 },
  warmDot: { width: 7, height: 7, backgroundColor: '#ffc266', borderRadius: 3.5 },
  warmText: { color: '#ffc266', fontSize: 13, lineHeight: 19.5, fontFamily: 'Inter_700Bold' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M19 3v4M17 5h4\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 3v6M12 15v6M3 12h6M15 12h6\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v6: {"flexShrink":1},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#1a2340","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#5ee0a8","borderRadius":3.5},
  t12: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v14: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t15: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t17: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t18: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v19: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v20: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#082b33","borderRadius":14},
  t21: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t22: {"color":"#67e3f9","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v24: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t25: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v26: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  t27: {"color":"#a9b4ff","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_600SemiBold"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#0d2a20","borderRadius":18},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t32: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v34: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v37: {"borderRadius":18},
  t38: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v39: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t40: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v43: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
