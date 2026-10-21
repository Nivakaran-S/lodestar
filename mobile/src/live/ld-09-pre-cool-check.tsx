// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-09 Pre-cool check · phone (P3, phone)
// The loader reads the reefer display (the camera shows it; the photo stays on the phone) and types the reading;
// there is no reading by AI and no reefer telemetry. Confirming queues PRECOOL for the load record.
import { useEffect, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { CameraBox, useCamera } from '@/lodestar/camera';
import { reeferOf } from '@/model/dock';
import { precoolReading, recordPrecool } from '@/model/field-reports';
import { useClaims, useLoadSheet } from '@/model/hooks';
import type { Trip } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';
import { TEMP_KEYBOARD } from '@/lib/keyboard';

const nav: ScreenNav = {"links":{"L192":{"to":"ld-02-load-sheet","kind":"go"},"L193":{"to":"ld-b1-vehicle-can-t-depart","kind":"go"},"B":{"to":"ld-01-dock-queue","kind":"back"}}};

/** A chilled load needs the reefer at or below this before loading (as on the design and LD-04). */
const MAX_CHILLED_C = 4;
const kind = (t?: Trip) => (t?.vehicle ? `${t.vehicle.tempClass === 'CHILLED' ? 'reefer ' : ''}${t.vehicle.type === 'VAN' ? 'van' : 'truck'}` : '');
const parseTemp = (v: string) => {
  const n = Number(v.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};

export default function ScreenLd09PreCoolCheck() {
  const claims = useClaims();
  const sheet = useLoadSheet();
  const trip = sheet.data?.trip;
  const cam = useCamera();
  const [text, setText] = useState('');
  const [photoAt, setPhotoAt] = useState<string | null>(null);
  const [doors, setDoors] = useState(false);
  const [floor, setFloor] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId) return;
    let live = true;
    void precoolReading(tripId).then(v => live && setSaved(v));
    return () => {
      live = false;
    };
  }, [tripId]);
  const chilled = trip?.vehicle ? trip.vehicle.tempClass === 'CHILLED' : true;
  const temp = parseTemp(text) ?? saved ?? reeferOf(trip, sheet.data?.loadRecord);
  const typed = parseTemp(text);
  const reeferOk = temp !== undefined && (!chilled || temp <= MAX_CHILLED_C);
  const tooWarm = chilled && temp !== undefined && temp > MAX_CHILLED_C;
  const done = [reeferOk, doors, floor].filter(Boolean).length;
  const empty = !claims ? 'Sign in to check a vehicle' : sheet.loading && !sheet.data ? 'Loading…' : !trip ? 'No trip to load' : '';
  const params = trip ? { trip: trip.id } : undefined;
  const toSheet: Target | undefined = params ? { to: 'ld-02-load-sheet', params } : undefined;
  const toFault: Target | undefined = params ? { to: 'ld-b1-vehicle-can-t-depart', params } : undefined;

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
      showToast(`Read ${read.value} °C from the photo · check it`);
    } else showToast("Couldn't read the display · type the reading", 'error');
    return false;
  };

  const save = async (reading: number) => {
    if (!trip) throw new Error(empty || 'No trip to load');
    await recordPrecool(trip, reading);
    setSaved(reading);
  };

  const start = async () => {
    if (!trip) throw new Error(empty || 'No trip to load');
    if (temp === undefined) throw new Error('Type the reefer reading first');
    if (tooWarm) {
      showToast(`Reefer reads ${temp} °C · above ${MAX_CHILLED_C} °C, report it`, 'error');
      return false;
    }
    if (!doors || !floor) throw new Error('Tick the doors and the floor first');
    if (typed !== undefined || saved === null) await save(temp);
    return true;
  };

  const report = async () => {
    if (trip && typed !== undefined) await save(typed);
    return true;
  };

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v47}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}><Text style={s.t3}>{trip?.vehicleId ?? "—"}</Text>{trip?.bay ? ` · Bay ${trip.bay}` : ""}</Text>
          </View>
          <View style={s.v7}>
            <Text style={s.t6} numberOfLines={1}>{trip ? `Plan v${trip.planVersion}` : "Plan —"}</Text>
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v40}>
          <View style={s.v13}>
            <View style={s.v11}>
              <Text style={s.t9}>{trip ? `${trip.bay ? `At Bay ${trip.bay}` : "No bay"}${trip.departTime ? ` · departs ${hm(trip.departTime)}` : ""}` : empty || "—"}</Text>
              <View style={s.v10} />
              <Text style={s.t9}>{kind(trip) || "—"}</Text>
            </View>
            <View>
              <Text style={s.t12}>{"Check the van first"}</Text>
            </View>
          </View>
          <View style={s.v27}>
            {cam.granted ? <CameraBox cam={cam} style={x.cam} /> : null}
            <View style={s.v18}>
              <View style={s.v15}>
                <View>
                  <Text style={s.t9}>{"Reefer reads"}</Text>
                </View>
                <View style={x.row}>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={temp !== undefined ? String(temp) : "—"}
                    placeholderTextColor="#8f98aa"
                    keyboardType={TEMP_KEYBOARD}
                    style={[s.t14, x.input]}
                    testID="reefer-reading"
                  />
                  <Text style={s.t14}>{" °C"}</Text>
                </View>
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t9}>{"Needs"}</Text>
                </View>
                <View>
                  <Text style={s.t16}>{chilled ? `≤ ${MAX_CHILLED_C} °C` : "Ambient"}</Text>
                </View>
              </View>
            </View>
            <Tap style={s.v22} to={null} onPress={photo} testID="reefer-photo">
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t19} numberOfLines={1}>{cam.granted ? (photoAt ? `Display photo ${hm(photoAt)} ·` : "Take a display photo ·") : "Read from display photo ·"}</Text>
              <View style={s.v21}>
                <Text style={s.t20} numberOfLines={1}>{"confirm"}</Text>
              </View>
            </Tap>
            <View style={s.v26}>
              <View style={s.v24}>
                <Icon xml={X2} width={14} height={14} style={s.v1} />
                <Text style={s.t23} numberOfLines={1}>{chilled ? `Set-point ≤ ${MAX_CHILLED_C} °C` : "Ambient · no set-point"}</Text>
              </View>
              <View style={s.v10} />
              <Text style={s.t25}>{saved !== null ? `confirmed ${saved} °C on this phone` : "not confirmed yet"}</Text>
            </View>
          </View>
          <View style={s.v39}>
            <View style={s.v30}>
              <View style={s.v21}>
                <Text style={s.t28}>{"Before you load"}</Text>
              </View>
              <View style={s.v21}>
                <Text style={s.t29}>{`${done} of 3 done`}</Text>
              </View>
            </View>
            <View style={s.v38}>
              <View style={s.v36}>
                <View style={s.v31}>
                  {reeferOk ? <Icon xml={X3} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v35}>
                  <View>
                    <Text style={s.t32}>{chilled ? `Reefer at or below ${MAX_CHILLED_C} °C` : "Reading taken"}</Text>
                  </View>
                  <View style={s.v34}>
                    <Text style={s.t33}>{temp === undefined ? "Type the reading from the display" : tooWarm ? `Reads ${temp} °C · too warm to load` : photoAt ? `Read from the display photo ${hm(photoAt)}` : `Reads ${temp} °C`}</Text>
                  </View>
                </View>
              </View>
              <Tap style={s.v37} to={null} onPress={() => setDoors(v => !v)} testID="check-doors">
                <View style={s.v31}>
                  {doors ? <Icon xml={X3} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v35}>
                  <View>
                    <Text style={s.t32}>{"Doors and seals intact"}</Text>
                  </View>
                  <View style={s.v34}>
                    <Text style={s.t33}>{"No tears, doors close tight"}</Text>
                  </View>
                </View>
              </Tap>
              <Tap style={s.v37} to={null} onPress={() => setFloor(v => !v)} testID="check-floor">
                <View style={s.v31}>
                  {floor ? <Icon xml={X3} width={22} height={22} style={s.v1} /> : null}
                </View>
                <View style={s.v35}>
                  <View>
                    <Text style={s.t32}>{"Floor clean and dry"}</Text>
                  </View>
                  <View style={s.v34}>
                    <Text style={s.t33}>{"Nothing left from the last run"}</Text>
                  </View>
                </View>
              </Tap>
            </View>
          </View>
        </Scroll>
        <View style={s.v46}>
          <Tap lk="L192" style={s.v43} onPress={start} to={toSheet}>
            <Grad g={G0} style={s.v41} />
            <Icon xml={X4} width={22} height={22} style={s.v1} />
            <Text style={s.t42}>{`Start loading ${trip?.vehicleId ?? ""}`.trim()}</Text>
          </Tap>
          <Tap lk="L193" style={s.v45} onPress={report} to={toFault}>
            <Icon xml={X5} width={22} height={22} style={s.v1} />
            <Text style={s.t44}>{`Above ${MAX_CHILLED_C} °C? Report it`}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M19 3v4M17 5h4\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

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
  t9: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v10: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t12: {"color":"#0a0f1a","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t14: {"color":"#0e7490","fontSize":56,"lineHeight":56,"letterSpacing":-1.7,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexShrink":1},
  t16: {"color":"#0a0f1a","fontSize":26,"lineHeight":39,"letterSpacing":-0.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v17: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":1},
  v18: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t19: {"color":"#3b4cca","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_600SemiBold"},
  t20: {"color":"#3b4cca","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_800ExtraBold"},
  v21: {"flexShrink":1},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"marginTop":-2},
  t23: {"color":"#0e7490","fontSize":13,"lineHeight":18.9,"fontFamily":"Inter_600SemiBold"},
  v24: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  t25: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v26: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":8,"columnGap":8},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  t28: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  t32: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t33: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v34: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v36: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v37: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v38: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v41: {"borderRadius":18},
  t42: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v43: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  t44: {"color":"#344054","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v47: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});

const x = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 1, minWidth: 0 },
  // a browser input is ~200px wide by default: on a phone that pushed "°C" over the "Needs" column
  input: { width: 132, minWidth: 64, flexShrink: 1, padding: 0, margin: 0, borderBottomWidth: 2, borderBottomColor: '#cfd5e1' },
  cam: { height: 160, borderRadius: 16, backgroundColor: '#0a0f1a' },
});
