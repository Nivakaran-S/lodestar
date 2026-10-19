// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-16 Store code entry · phone (P4, phone)
// Instead of a signature: the designed keypad enters the store's 4-digit code for the day, checked on the phone
// (dailyStoreCode, no signal needed). Confirming completes the stop (POD) and tells dispatch, both through the outbox.
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { completeStop } from '@/model/actions';
import { afterPod } from '@/model/run';
import { dailyStoreCode, reportToDispatch, stopContext } from '@/model/field-reports';
import { useOnline, useParam, useStop } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L258":{"to":"dr-19-stop-2-arrival-hawa-eliya","kind":"go"},"B":{"to":"dr-03-proof-of-delivery","kind":"back"}}};

const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

export default function ScreenDr16StoreCodeEntry() {
  const { stop, view, trip } = useStop();
  const online = useOnline();
  const unitsParam = useParam('units');
  const damaged = Number(useParam('damaged') ?? '');
  const damageNote = useParam('note');
  const [code, setCode] = useState('');
  const order = stop?.order;
  const expected = stop && view ? dailyStoreCode(stop.outletId, view.date) : null;
  const full = code.length === 4;
  const match = full && code === expected;
  const target: Target | undefined = stop ? afterPod(view, stop, { offlineScreen: false }) : undefined;
  const press = (d: string) => {
    setCode(c => (c.length < 4 ? c + d : c));
    return false;
  };
  const back = () => {
    setCode(c => c.slice(0, -1));
    return false;
  };
  const key = (d: string) => (
    <Tap key={d} style={s.v30} onPress={() => press(d)} to={null} testID={`key-${d}`}>
      <Text style={s.t29}>{d}</Text>
    </Tap>
  );

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v34}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Store code"}</Text>
          </View>
          {!online ? (
            <View style={s.v6}>
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t5} numberOfLines={1}>{"Offline"}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v24}>
          <View style={s.v13}>
            <View style={s.v11}>
              <Text style={s.t8}>{stop ? `Stop ${stop.stopSeq} ·` : "Stop — ·"}</Text>
              <View style={s.v10}>
                <Text style={s.t9}>{stop?.outletId ?? "—"}</Text>
              </View>
              <Text style={s.t8}>{"· instead of a signature"}</Text>
            </View>
            <View>
              <Text style={s.t12}>{`Ask ${stop?.outlet?.name ?? "the store"} for today's store code`}</Text>
            </View>
          </View>
          <View style={s.v16}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[s.v15, full && !match ? x.wrong : null, !full ? x.blank : null]}>
                <Text style={s.t14} testID={`code-${i}`}>{code[i] ?? " "}</Text>
              </View>
            ))}
          </View>
          {match ? (
            <View style={s.v21}>
              <View style={s.v20} testID="code-match">
                <Icon xml={X2} width={14} height={14} style={s.v17} />
                <Text style={s.t18} numberOfLines={1}>{"Matches"}</Text>
                <View style={s.v10}>
                  <Text style={s.t19} numberOfLines={1}>{stop?.outletId ?? "—"}</Text>
                </View>
                <Text style={s.t18} numberOfLines={1}>{"· no signal needed"}</Text>
              </View>
            </View>
          ) : full ? (
            <View style={s.v21}>
              <View style={s.v20}>
                <Text style={x.wrongText} numberOfLines={1}>{"Not today's code · check with the store"}</Text>
              </View>
            </View>
          ) : null}
          <View style={s.v23}>
            <Icon xml={X3} width={16} height={16} style={s.v17} />
            <View style={s.v10}>
              <Text style={s.t22}>{"The store sees today's code in its Lodestar Store app. It changes every day."}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v28}>
          <Tap
            lk="L258"
            style={s.v27}
            disabled={!!stop && !match}
            to={target}
            onPress={async () => {
              if (!stop || !order) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
              const units = unitsParam !== undefined && Number.isFinite(Number(unitsParam)) ? Number(unitsParam) : order.units;
              await completeStop(stop, {
                unitsDelivered: units,
                unitsOrdered: order.units,
                receiverName: `Store code ${code}`,
                ...(damaged > 0 ? { exceptions: [{ type: 'DAMAGED', description: damageNote || `${damaged} damaged` }] } : {}),
              });
              await reportToDispatch(stop.tripId, { report: 'STORE_CODE', stopId: stop.id, orderId: stop.orderId, code }, stop.id, stopContext(stop, trip?.vehicleId));
              showToast(online ? 'Sent to dispatch' : 'Saved · sends when signal returns');
              return true;
            }}
          >
            <Grad g={G0} style={s.v25} />
            <Icon xml={X4} width={22} height={22} style={s.v1} />
            <Text style={s.t26}>{"Confirm with store code"}</Text>
          </Tap>
        </View>
        <View style={s.v33}>
          {KEYS.map(row => (
            <View key={row[0]} style={s.v31}>
              {row.map(key)}
            </View>
          ))}
          <View style={s.v31}>
            <View style={s.v32} />
            {key('0')}
            <Tap style={s.v32} onPress={back} to={null} testID="key-back">
              <Icon xml={X5} width={26} height={26} style={s.v1} />
            </Tap>
          </View>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  blank: { boxShadow: 'rgb(59, 70, 102) 0px 0px 0px 2px inset' },
  wrong: { boxShadow: 'rgb(255, 138, 122) 0px 0px 0px 2px inset' },
  wrongText: { color: '#ff8a7a', fontSize: 13, lineHeight: 18.9, fontFamily: 'Inter_600SemiBold' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 16v-4M12 8h.01\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"26\" height=\"26\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m18 9-6 6M12 9l6 6\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
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
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v10: {"flexShrink":1},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t12: {"color":"#f2f4fa","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t14: {"color":"#f2f4fa","fontSize":40,"lineHeight":60,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":84,"backgroundColor":"#121a2e","borderRadius":20,"boxShadow":"rgb(94, 224, 168) 0px 0px 0px 2px inset"},
  v16: {"flexDirection":"row","alignItems":"stretch","rowGap":12,"columnGap":12,"flexShrink":0,"marginRight":28,"marginLeft":28},
  v17: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t18: {"color":"#5ee0a8","fontSize":13,"lineHeight":18.9,"fontFamily":"Inter_600SemiBold"},
  t19: {"color":"#5ee0a8","fontSize":13,"lineHeight":18.9,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v21: {"flexDirection":"row","justifyContent":"center","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t22: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v23: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":10,"paddingBottom":16},
  v25: {"borderRadius":18},
  t26: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  t29: {"color":"#f2f4fa","fontSize":24,"lineHeight":36,"fontFamily":"PlusJakartaSans_700Bold"},
  v30: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":56,"backgroundColor":"#1a2340","borderRadius":14},
  v31: {"flexDirection":"row","alignItems":"stretch","rowGap":8,"columnGap":8},
  v32: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":56,"borderRadius":14},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":10,"paddingRight":12,"paddingBottom":4,"paddingLeft":12,"backgroundColor":"#0a0f1e","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v34: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
