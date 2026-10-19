// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-38 Report a delay · phone (P4, phone)
// The driver picks a reason and the expected delay; the screen works out the next stop's new ETA and which
// remaining stop would miss its window from the run's ETAs. "Send when possible" queues a DELAY report to
// dispatch through the outbox (the back arrow leaves without reporting).
import { Fragment, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { reportToDispatch, stopContext } from '@/model/field-reports';
import { useOnline, useRun } from '@/model/hooks';
import type { TripStop } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L249":{"to":"dr-36-en-route-driving-mode","kind":"go"},"L250":{"to":"dr-36-en-route-driving-mode","kind":"go"}}};

type Reason = 'LANDSLIDE' | 'RAIN_FOG' | 'TRAFFIC' | 'VEHICLE_ISSUE' | 'OTHER';
const STEP = 5;
const MAX_MIN = 240;

/** "6:45" / "07:45" → minutes of the day. */
const dayMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const later = (s: TripStop, minutes: number) => {
  const eta = s.etaModel ?? s.etaPlan;
  return eta ? new Date(Date.parse(eta) + minutes * 60_000).toISOString() : null;
};

export default function ScreenDr38ReportADelay() {
  const { view } = useRun();
  const online = useOnline();
  const [reason, setReason] = useState<Reason | null>(null);
  const [minutes, setMinutes] = useState(10);
  const trip = view?.trip ?? null;
  const current = view?.current ?? null;
  const open = (view?.tripStops ?? []).filter(x => x.status !== 'DELIVERED');
  const newEta = current ? later(current, minutes) : null;
  const risk = open.map(x => {
    const eta = later(x, minutes);
    const close = x.outlet?.windowClose ?? '';
    const slack = eta && close ? dayMin(close) - dayMin(hm(eta)) : NaN;
    return { stop: x, close, slack };
  }).filter(r => Number.isFinite(r.slack)).sort((a, b) => a.slack - b.slack)[0];
  const ids = open.map(x => x.outletId);
  const step = (d: number) => {
    setMinutes(m => Math.max(STEP, Math.min(MAX_MIN, m + d)));
    return false;
  };
  const chip = (r: Reason, label: string, icon: string) => (
    <Tap key={r} style={reason === r ? s.v16 : s.v15} onPress={() => {
      setReason(r);
      return false;
    }} to={null} testID={`reason-${r}`}>
      <Icon xml={icon} width={20} height={20} style={s.v1} />
      <Text style={s.t14} numberOfLines={1}>{label}</Text>
    </Tap>
  );

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v48}>
        <View style={s.v7}>
          <Tap lk="L250" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Report a delay"}</Text>
          </View>
          {!online ? (
            <View style={s.v6}>
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t5} numberOfLines={1}>{"Offline"}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v43}>
          <View style={s.v13}>
            <View style={s.v11}>
              <Text style={s.t8}>{current ? `On the way to stop ${current.stopSeq} ·` : "No stop left on this run ·"}</Text>
              <View style={s.v10}>
                <Text style={s.t9}>{current?.outletId ?? "—"}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t12}>{"What's slowing you?"}</Text>
            </View>
          </View>
          <View style={s.v17}>
            {chip('LANDSLIDE', 'Landslide or rock fall', X2)}
            {chip('RAIN_FOG', 'Heavy rain or fog', X3)}
            {chip('TRAFFIC', 'Traffic', X4)}
            {chip('VEHICLE_ISSUE', 'Vehicle issue', X5)}
            {chip('OTHER', 'Other', X6)}
          </View>
          <View style={s.v30}>
            <View style={s.v29}>
              <View style={s.v21}>
                <View>
                  <Text style={s.t18}>{"Expected delay"}</Text>
                </View>
                <View style={s.v20}>
                  <Text style={s.t19}>{current ? (newEta ? `Stop ${current.stopSeq} now ~${hm(newEta)}` : `Stop ${current.stopSeq} · no ETA yet`) : "—"}</Text>
                </View>
              </View>
              <View style={s.v28}>
                <Tap style={s.v23} onPress={() => step(-STEP)} to={null} testID="delay-minus">
                  <Text style={s.t22}>{"−"}</Text>
                </Tap>
                <View style={s.v27}>
                  <Text style={s.t24} testID="delay-minutes">{`+${minutes}`}</Text>
                  <View style={s.v26}>
                    <Text style={s.t25}>{"min"}</Text>
                  </View>
                </View>
                <Tap style={s.v23} onPress={() => step(STEP)} to={null} testID="delay-plus">
                  <Text style={s.t22}>{"+"}</Text>
                </Tap>
              </View>
            </View>
          </View>
          <View style={s.v42}>
            <View style={s.v33}>
              <View style={s.v10}>
                <Text style={s.t31}>{"What happens"}</Text>
              </View>
              <View style={s.v10}>
                <Text style={s.t32}>{online ? "when you send" : "when signal returns"}</Text>
              </View>
            </View>
            <View style={s.v41}>
              <View style={s.v35}>
                <View style={s.v34}>
                  <Icon xml={X7} width={19} height={19} style={s.v1} />
                </View>
                <View style={s.v21}>
                  <View>
                    <Text style={s.t18}>{"Dispatch"}</Text>
                  </View>
                  <View style={s.v20}>
                    <Text style={s.t19}>{"New ETA and your reason"}</Text>
                  </View>
                </View>
                <View style={s.v6}>
                  <Text style={s.t5} numberOfLines={1}>{online ? "On send" : "Queued"}</Text>
                </View>
              </View>
              <View style={s.v37}>
                <View style={s.v34}>
                  <Icon xml={X8} width={19} height={19} style={s.v1} />
                </View>
                <View style={s.v21}>
                  <View>
                    <Text style={s.t18}>
                      {ids.length ? ids.slice(0, 2).map((id, i) => (
                        <Fragment key={id + i}>
                          {i ? " and " : ""}
                          <Text style={s.t36}>{id}</Text>
                        </Fragment>
                      )) : "No stores left"}
                      {ids.length > 2 ? ` +${ids.length - 2} more` : ""}
                    </Text>
                  </View>
                  <View style={s.v20}>
                    <Text style={s.t19}>{"Stores get a new ETA from dispatch"}</Text>
                  </View>
                </View>
                <View style={s.v6}>
                  <Text style={s.t5} numberOfLines={1}>{online ? "On send" : "Queued"}</Text>
                </View>
              </View>
              <View style={s.v37}>
                <View style={s.v38}>
                  <Icon xml={X9} width={19} height={19} style={s.v1} />
                </View>
                <View style={s.v21}>
                  <View>
                    <Text style={s.t18}>{risk ? <><Text style={s.t36}>{risk.stop.outletId}</Text>{" late risk"}</> : "Late risk"}</Text>
                  </View>
                  <View style={s.v20}>
                    <Text style={s.t19}>{risk ? `Window closes ${risk.close}` : "No ETAs or windows to compare"}</Text>
                  </View>
                </View>
                {risk ? (
                  <View style={s.v40}>
                    <Text style={s.t39} numberOfLines={1} testID="late-risk">{risk.slack < 0 ? "Now high" : risk.slack < 15 ? "Tight" : "Still on time"}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v47}>
          <Tap
            lk="L249"
            style={s.v46}
            disabled={!!trip && !reason}
            onPress={async () => {
              if (!trip) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
              if (!reason) return false;
              await reportToDispatch(trip.id, { report: 'DELAY', reason, minutes, ...(current ? { stopId: current.id, orderId: current.orderId, newEta } : {}) }, trip.id, stopContext(current, trip.vehicleId));
              showToast(online ? 'Sent to dispatch' : 'Saved · sends when signal returns');
              return true;
            }}
          >
            <Grad g={G0} style={s.v44} />
            <Icon xml={X10} width={22} height={22} style={s.v1} />
            <Text style={s.t45}>{"Send when possible"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m8 3 4 8 5-5 5 15H2L8 3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M16 17H7M17 21H9\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"7\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M9 17h6\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"17\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m22 2-7 20-4-9-9-4Z\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M22 2 11 13\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
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
  t14: {"color":"#f2f4fa","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":18,"paddingLeft":14,"height":52,"backgroundColor":"#121a2e","borderRadius":16},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":18,"paddingLeft":14,"height":52,"backgroundColor":"#2e2208","borderRadius":16,"boxShadow":"rgb(245, 184, 61) 0px 0px 0px 2px inset"},
  v17: {"flexDirection":"row","flexWrap":"wrap","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"marginRight":16,"marginLeft":16},
  t18: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t19: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v20: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t22: {"color":"#f2f4fa","fontSize":26,"lineHeight":39,"fontFamily":"Inter_700Bold"},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"width":52,"height":52,"backgroundColor":"#0a0f1e","borderRadius":14},
  t24: {"color":"#f2f4fa","fontSize":22,"lineHeight":33,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t25: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_700Bold"},
  v26: {"flexShrink":1,"marginLeft":3},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"minWidth":72},
  v28: {"flexDirection":"row","alignItems":"center","flexShrink":1,"paddingTop":4,"paddingRight":4,"paddingBottom":4,"paddingLeft":4,"backgroundColor":"#1a2340","borderRadius":18},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v30: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t31: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t32: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v33: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v34: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":12},
  v35: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  t36: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  v37: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#2e2208","borderRadius":12},
  t39: {"color":"#ffc266","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v40: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#2e2208","borderRadius":14},
  v41: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":10,"paddingBottom":16},
  v44: {"borderRadius":18},
  t45: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v46: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v47: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v48: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
