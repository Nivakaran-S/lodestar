// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-17 Report a problem · phone (P4, phone)
// The driver picks what is wrong at the stop. Damaged goods goes on to DR-18 for the count and photo; every other
// problem is queued straight to dispatch (PROBLEM report through the outbox) and the driver is back at the stop.
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { reportToDispatch, stopContext } from '@/model/field-reports';
import { useOnline, useStop } from '@/model/hooks';
import { openDialer } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L253":{"to":"dr-18-problem-detail-damaged-goods","kind":"go"},"L254":{"to":"dr-02-stop-arrival","kind":"go"}}};

type Problem = 'STORE_CLOSED' | 'ACCESS_BLOCKED' | 'RECEIVER_REFUSED' | 'DAMAGED_GOODS' | 'TEMPERATURE' | 'OTHER';

export default function ScreenDr17ReportAProblem() {
  const { stop, trip } = useStop();
  const online = useOnline();
  const [problem, setProblem] = useState<Problem | null>(null);
  const damaged = problem === 'DAMAGED_GOODS';
  const params = stop ? { stop: stop.id } : undefined;
  const toStop: Target | undefined = params ? { to: 'dr-02-stop-arrival', params } : undefined;
  const next: Target | undefined = damaged ? (params ? { to: 'dr-18-problem-detail-damaged-goods', params: { ...params, problem: 'DAMAGED_GOODS' } } : undefined) : toStop;
  const tile = (p: Problem, label: string, icon: string, iconBox = s.v12) => {
    const on = problem === p;
    return (
      <Tap key={p} style={on ? s.v16 : s.v14} onPress={() => {
        setProblem(p);
        return false;
      }} to={null} testID={`problem-${p}`}>
        <View style={on ? s.v15 : iconBox}>
          <Icon xml={icon} width={22} height={22} style={s.v1} />
        </View>
        <Text style={s.t13}>{label}</Text>
      </Tap>
    );
  };

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v30}>
        <View style={s.v7}>
          <Tap lk="L254" style={s.v2} to={toStop}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{stop ? `Stop ${stop.stopSeq} · ${stop.outlet?.name ?? stop.outletId}` : "Stop —"}</Text>
          </View>
          {!online ? (
            <View style={s.v6}>
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t5} numberOfLines={1}>{"Offline"}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v23}>
          <View style={s.v11}>
            <View style={s.v9}>
              <Text style={s.t8}>{"Report a problem"}</Text>
            </View>
            <View>
              <Text style={s.t10}>{"What's wrong at this stop?"}</Text>
            </View>
          </View>
          <View style={s.v18}>
            {tile('STORE_CLOSED', 'Store closed', X2)}
            {tile('ACCESS_BLOCKED', 'Access blocked', X3)}
            {tile('RECEIVER_REFUSED', 'Receiver refused', X4)}
            {tile('DAMAGED_GOODS', 'Damaged goods', X5)}
            {tile('TEMPERATURE', 'Temperature', X6, s.v17)}
            {tile('OTHER', 'Something else', X7)}
          </View>
          <View style={s.v22}>
            <Icon xml={X8} width={16} height={16} style={s.v19} />
            <View style={s.v21}>
              <Text style={s.t20}>{online ? "Saved on the phone and sent to dispatch now." : "Saved on the phone now. Dispatch gets it when signal returns."}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v29}>
          <Tap
            lk="L253"
            style={s.v26}
            disabled={!!stop && !problem}
            to={next}
            onPress={async () => {
              if (!stop) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
              if (!problem) return false;
              if (problem === 'DAMAGED_GOODS') return true;
              await reportToDispatch(stop.tripId, { report: 'PROBLEM', problem, stopId: stop.id, orderId: stop.orderId }, stop.id, stopContext(stop, trip?.vehicleId));
              showToast(online ? 'Sent to dispatch' : 'Saved · sends when signal returns');
              return true;
            }}
          >
            <Grad g={G0} style={s.v24} />
            <Text style={s.t25}>{"Next"}</Text>
            <Icon xml={X9} width={22} height={22} style={s.v1} />
          </Tap>
          <Tap style={s.v28} to={null} onPress={() => openDialer()} testID="call-dispatch">
            <Icon xml={X10} width={18} height={18} style={s.v1} />
            <Text style={s.t27}>{"Call dispatch instead"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"m4.9 4.9 14.2 14.2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"2\" y=\"7\" width=\"20\" height=\"6\" rx=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 7l-3 6M13 7l-3 6M19 7l-3 6M5 13v8M19 13v8\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"9\" cy=\"8\" r=\"4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M1 21a8 8 0 0 1 16 0\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m17 8 5 5M22 8l-5 5\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t10: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":44,"height":44,"backgroundColor":"#1a2340","borderRadius":14},
  t13: {"color":"#f2f4fa","fontSize":16,"lineHeight":20,"fontFamily":"Inter_700Bold"},
  v14: {"flexDirection":"column","justifyContent":"space-between","alignItems":"stretch","flexShrink":1,"paddingTop":16,"paddingRight":16,"paddingBottom":16,"paddingLeft":16,"width":166,"height":112,"backgroundColor":"#121a2e","borderRadius":20},
  v15: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":44,"height":44,"backgroundColor":"#f5b83d","borderRadius":14},
  v16: {"flexDirection":"column","justifyContent":"space-between","alignItems":"stretch","flexShrink":1,"paddingTop":16,"paddingRight":16,"paddingBottom":16,"paddingLeft":16,"width":166,"height":112,"backgroundColor":"#2e2208","borderRadius":20,"boxShadow":"rgb(245, 184, 61) 0px 0px 0px 2px inset"},
  v17: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":44,"height":44,"backgroundColor":"#082b33","borderRadius":14},
  v18: {"flexDirection":"row","flexWrap":"wrap","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"marginRight":16,"marginLeft":16},
  v19: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t20: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v21: {"flexShrink":1},
  v22: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v23: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":10,"paddingBottom":16},
  v24: {"borderRadius":18},
  t25: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v26: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t27: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v28: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v29: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v30: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
