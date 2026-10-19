// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-37 Reefer temperature alert · phone (P4, phone)
// There is no reefer telemetry: the driver types the reading on the reefer display. The line runs from the dock's
// pre-cool reading (load record) to the driver's reading, against the 4\u00a0°C limit. Both ways out queue a
// REEFER_TEMP report to dispatch through the outbox (when a reading was typed) and go back to driving.
import { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { reeferOf } from '@/model/dock';
import { reportToDispatch } from '@/model/field-reports';
import { useOnline, useRun } from '@/model/hooks';
import { openDialer } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { TEMP_KEYBOARD } from '@/lib/keyboard';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L247":{"to":"dr-36-en-route-driving-mode","kind":"go"},"L248":{"to":"dr-36-en-route-driving-mode","kind":"go"}}};

const MAX_CHILLED_C = 4;
const parseTemp = (v: string) => {
  const n = Number(v.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};

/** The dock reading → the driver's reading, with the dashed limit (302 × 60, as the design's chart). */
function trend(points: number[], warm: boolean): string {
  const lo = Math.min(0, ...points) - 1;
  const hi = Math.max(MAX_CHILLED_C + 4, ...points) + 1;
  const y = (t: number) => (60 - ((t - lo) / (hi - lo)) * 60).toFixed(1);
  const xs = points.length > 1 ? points.map((_, i) => ((i / (points.length - 1)) * 296 + 3).toFixed(1)) : ['299'];
  const colour = warm ? '#ffc266' : '#5ee0a8';
  const path = points.map((t, i) => `${i ? 'L' : 'M'}${xs[i]} ${y(t)}`).join(' ');
  const dots = points.map((t, i) => `<circle cx="${xs[i]}" cy="${y(t)}" r="3" fill="${colour}"/>`).join('');
  return `<svg viewBox="0 0 302 60" width="302" height="60" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="302" y1="${y(MAX_CHILLED_C)}" y2="${y(MAX_CHILLED_C)}" stroke="#7f89a3" stroke-width="1.5" stroke-dasharray="4 4"/>${points.length > 1 ? `<path d="${path}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linecap="round"/>` : ''}${dots}</svg>`;
}

export default function ScreenDr37ReeferTemperatureAlert() {
  const { view } = useRun();
  const online = useOnline();
  const trip = view?.trip ?? null;
  const [text, setText] = useState('');
  const [readAt, setReadAt] = useState<string | null>(null);
  const reading = parseTemp(text);
  const dock = reeferOf(trip, trip?.loadRecord);
  const chilledVan = trip?.vehicle ? trip.vehicle.tempClass === 'CHILLED' : true;
  const onBoard = (view?.tripStops ?? []).filter(x => x.status !== 'DELIVERED' && x.order?.tempClass === 'CHILLED').length;
  const warm = reading !== undefined && reading > MAX_CHILLED_C;
  const points = [dock, reading].filter((t): t is number => t !== undefined);

  const send = async (action: string, need: boolean) => {
    if (!trip) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
    if (reading === undefined) {
      if (!need) return true;
      showToast('Type the reading on the reefer display first', 'error');
      return false;
    }
    await reportToDispatch(trip.id, { report: 'REEFER_TEMP', tempC: reading, action, ...(dock !== undefined ? { note: `Dock read ${dock}\u00a0°C` } : {}) }, trip.id, { vehicleId: trip.vehicleId });
    showToast(online ? 'Sent to dispatch' : 'Saved · sends when signal returns');
    return true;
  };

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v46}>
        <View style={s.v8}>
          <Tap lk="L248" style={s.v2} onPress={() => send('KEEP_DRIVING', false)}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}>{"Reefer · "}<Text style={s.t3}>{trip?.vehicleId ?? "—"}</Text></Text>
          </View>
          {!online ? (
            <View style={s.v7}>
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t6} numberOfLines={1}>{"Offline"}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v5} contentStyle={s.v39}>
          <View style={s.v12}>
            <View style={s.v10}>
              <Text style={s.t9}>{`${chilledVan ? "Chilled load" : "Dry van"} · ${onBoard ? `${plural(onBoard, "chilled order")} on board` : "no chilled orders on board"}`}</Text>
            </View>
            <View>
              <Text style={s.t11}>{reading === undefined ? `Read the reefer display, needs ≤\u00a0${MAX_CHILLED_C}\u00a0°C` : warm ? `Reefer at ${reading}\u00a0°C, needs ≤\u00a0${MAX_CHILLED_C}\u00a0°C` : `Reefer at ${reading}\u00a0°C, within ≤\u00a0${MAX_CHILLED_C}\u00a0°C`}</Text>
            </View>
          </View>
          <View style={s.v22}>
            <View style={s.v18}>
              <View style={[s.v15, x.row]}>
                <TextInput
                  value={text}
                  onChangeText={v => {
                    setText(v);
                    setReadAt(new Date().toISOString());
                  }}
                  placeholder="—"
                  placeholderTextColor="#7f89a3"
                  keyboardType={TEMP_KEYBOARD}
                  style={[s.t14, x.input]}
                  testID="reefer-reading"
                />
                <Text style={s.t14}>{"\u00a0°C"}<Text style={s.t13}>{"now"}</Text></Text>
              </View>
              {reading !== undefined ? (
                <View style={warm ? s.v17 : x.okPill}>
                  {warm ? <Icon xml={X2} width={14} height={14} style={s.v1} /> : null}
                  <Text style={warm ? s.t16 : x.okText} numberOfLines={1}>{warm ? "Too warm" : "Cold enough"}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.v21}>
              {points.length ? <Icon xml={trend(points, warm)} width={302} height={60} style={s.v19} /> : null}
              <View style={s.v20}>
                <View style={s.v15}>
                  <Text style={s.t9}>{dock !== undefined ? `Dock${trip?.loadRecord?.loadedAt ? ` ${hm(trip.loadRecord.loadedAt)}` : ""} · ${dock}\u00a0°C` : "No dock reading"}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t9}>{`dashed line = ${MAX_CHILLED_C}\u00a0°C limit`}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={warm ? s.t16 : s.t9}>{readAt && reading !== undefined ? hm(readAt) : "—"}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v35}>
            <View style={s.v25}>
              <View style={s.v15}>
                <Text style={s.t23}>{"What to do"}</Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t24}>{"keep driving until safe"}</Text>
              </View>
            </View>
            <View style={s.v34}>
              <View style={s.v32}>
                <View style={s.v27}>
                  <Text style={s.t26}>{"1"}</Text>
                </View>
                <View style={s.v31}>
                  <View>
                    <Text style={s.t28}>{"Pull over when safe"}</Text>
                  </View>
                  <View style={s.v30}>
                    <Text style={s.t29}>{"Not on a bend or the narrow pass"}</Text>
                  </View>
                </View>
              </View>
              <View style={s.v33}>
                <View style={s.v27}>
                  <Text style={s.t26}>{"2"}</Text>
                </View>
                <View style={s.v31}>
                  <View>
                    <Text style={s.t28}>{"Check the rear door seal"}</Text>
                  </View>
                  <View style={s.v30}>
                    <Text style={s.t29}>{"Close it fully, look for a gap"}</Text>
                  </View>
                </View>
              </View>
              <View style={s.v33}>
                <View style={s.v27}>
                  <Text style={s.t26}>{"3"}</Text>
                </View>
                <View style={s.v31}>
                  <View>
                    <Text style={s.t28}>{"Set the reefer to 2\u00a0°C"}</Text>
                  </View>
                  <View style={s.v30}>
                    <Text style={s.t29}>{`It should read ≤\u00a0${MAX_CHILLED_C}\u00a0°C in about 10 min`}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v38}>
            <Icon xml={X4} width={16} height={16} style={s.v36} />
            <View style={s.v15}>
              <Text style={s.t37}>{online ? "Your reading is logged on this phone and sent to dispatch when you leave this screen." : "Your reading is logged on this phone and sent to dispatch when signal returns."}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v45}>
          <Tap lk="L247" style={s.v42} onPress={() => send(warm ? 'CHECKED_STILL_WARM' : 'CHECKED_BACK_IN_RANGE', true)}>
            <Grad g={G0} style={s.v40} />
            <Icon xml={X5} width={22} height={22} style={s.v1} />
            <Text style={s.t41}>{reading === undefined ? "Checked, log the reading" : warm ? `Checked, still ${reading}\u00a0°C` : `Checked, back to ${reading}\u00a0°C`}</Text>
          </Tap>
          <Tap style={s.v44} to={null} onPress={() => openDialer()} testID="call-dispatch">
            <Icon xml={X6} width={18} height={18} style={s.v1} />
            <Text style={s.t43}>{"Call dispatch when signal"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { minWidth: 48, padding: 0, margin: 0 },
  okPill: { flexDirection: 'row', alignItems: 'center', columnGap: 6, flexShrink: 1, paddingHorizontal: 12, height: 28, backgroundColor: '#0d2a20', borderRadius: 14 },
  okText: { color: '#5ee0a8', fontSize: 13, lineHeight: 19.5, fontFamily: 'Inter_700Bold' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t6: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t11: {"color":"#f2f4fa","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t13: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t14: {"color":"#ffc266","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexShrink":1},
  t16: {"color":"#ffc266","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#2e2208","borderRadius":14},
  v18: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v19: {"flexShrink":1,"overflow":"hidden"},
  v20: {"flexDirection":"row","justifyContent":"space-between","alignItems":"stretch"},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6},
  v22: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#2e2208","borderRadius":24,"boxShadow":"rgb(107, 74, 18) 0px 0px 0px 1.5px inset"},
  t23: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t24: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v25: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t26: {"color":"#a9b4ff","fontSize":16,"lineHeight":24,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#161d3d","borderRadius":12},
  t28: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v30: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v31: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v34: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v36: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t37: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v38: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":10,"paddingBottom":16},
  v40: {"borderRadius":18},
  t41: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v42: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t43: {"color":"#d6cfc7","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v44: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":52,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  v45: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v46: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
