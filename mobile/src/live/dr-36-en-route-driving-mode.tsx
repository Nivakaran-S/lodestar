// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-36 En route · driving mode · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { hm, until } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { arriveAtStop } from '@/model/actions';
import { useOutbox, useRun } from '@/model/hooks';
import { openMaps, useNet } from '@/model/run';
import { LATE_RISK_PCT } from '@/model/preferences';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L13":{"to":"dr-02-stop-arrival","kind":"go"},"L245":{"to":"dr-38-report-a-delay","kind":"go"},"L246":{"to":"dr-37-reefer-temperature-alert","kind":"go"}}};

export default function ScreenDr36EnRouteDrivingMode() {
  const { name: depotName } = useDepots();
  const { view, updatedAt } = useRun();
  const { waiting } = useOutbox();
  const net = useNet();
  const trip = view?.trip ?? null;
  const stops = view?.tripStops ?? [];
  const stop = view?.current ?? null;
  const o = stop?.outlet;
  const seq = stop ? stops.indexOf(stop) + 1 : 0;
  const left = stops.filter(x => x.status !== 'DELIVERED').length;
  const prev = stop ? [...stops.slice(0, stops.indexOf(stop))].reverse().find(x => x.status === 'DELIVERED') : stops.at(-1);
  const reefer = trip?.loadRecord?.reeferTempC ?? trip?.reeferTempC ?? null;
  const reeferOk = reefer === null || (reefer >= 0 && reefer <= 5);
  const late = (stop?.lateRiskPct ?? 0) >= LATE_RISK_PCT;
  const band = stop?.etaModelBandEarly && stop?.etaModelBandLate ? `likely ${hm(stop.etaModelBandEarly)}–${hm(stop.etaModelBandLate)}` : '';
  const risk = stop?.lateRiskPct != null ? `late risk ${stop.lateRiskPct}%` : '';
  const win = o ? `window ${o.windowOpen}–${o.windowClose}` : '';
  const dock = titleCase(o?.dockType).toLowerCase();
  const soon = until(stop?.etaModel);
  const say = stop
    ? [
        `Next stop ${seq} of ${stops.length}: ${o?.name ?? stop.outletId}, ${stop.outletId}.`,
        stop.etaModel ? `Arriving about ${hm(stop.etaModel)}${soon ? `, ${soon}` : ''}.` : '',
        o ? `Window ${o.windowOpen} to ${o.windowClose}.` : '',
        late ? `Late risk ${stop.lateRiskPct} percent.` : '',
        `${plural(left, 'stop')} left.`,
      ].filter(Boolean).join(' ')
    : trip ? 'All stops on this trip are delivered.' : 'No run loaded yet.';
  const arriveTo = stop ? { to: 'dr-02-stop-arrival', params: { stop: stop.id } } : trip && view ? 'dr-04-run-complete' : undefined;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v55}>
        <View style={s.v8}>
          <View style={s.v3}>
            <Icon xml={X0} width={18} height={18} style={s.v1} />
            <Text style={s.t2} numberOfLines={1}>{"Driving mode"}</Text>
          </View>
          <Tap lk="L246" style={s.v7}>
            <Icon xml={X1} width={18} height={18} style={s.v1} />
            <View style={s.v5}>
              <Text style={s.t4} numberOfLines={1} testID="reefer-temp">{reefer !== null ? `Reefer ${reefer}\u00a0°C` : 'Reefer —'}</Text>
            </View>
            {reefer !== null ? <Text style={s.t6} numberOfLines={1}>{reeferOk ? '· OK' : '· check'}</Text> : null}
          </Tap>
        </View>
        <Scroll style={s.v45} contentStyle={s.v46}>
          <View style={s.v13}>
            <View>
              <Text style={s.t9}>{stop ? `Next stop · ${seq} of ${stops.length}` : trip ? 'All stops delivered' : 'Next stop'}</Text>
            </View>
            <View>
              <Text style={s.t10} testID="next-outlet">{o?.name ?? stop?.outletId ?? '—'}</Text>
            </View>
            <View>
              <Text style={s.t12}><Text style={s.t11}>{stop?.outletId ?? '—'}</Text>{[win, dock].filter(Boolean).map(x => ` · ${x}`).join('')}</Text>
            </View>
          </View>
          <View style={s.v18}>
            <View style={s.v5}>
              <Text style={s.t14} testID="next-eta">{stop?.etaModel ? `~${hm(stop.etaModel)}` : '—'}</Text>
            </View>
            <View style={s.v17}>
              <View>
                <Text style={s.t15} numberOfLines={1}>{"ETA"}</Text>
              </View>
              <View>
                <Text style={s.t16} numberOfLines={1}>{[band, risk].filter(Boolean).join(' · ') || (stop?.etaPlan ? `plan ${hm(stop.etaPlan)}` : ' ')}</Text>
              </View>
            </View>
          </View>
          <View style={s.v36}>
            <View style={s.v25}>
              <View style={s.v19} />
              <View style={s.v20} />
              <View style={s.v19} />
              <View style={s.v21} />
              <View style={s.v22}>
                <Icon xml={X2} width={20} height={20} style={s.v1} />
              </View>
              <View style={s.v23} />
              <View style={s.v24} />
            </View>
            <View style={s.v35}>
              <View style={s.v28}>
                <View>
                  <Text style={s.t26}>{trip ? `${depotName(trip.depot)}` : 'Depot'}</Text>
                </View>
                <Text style={s.t27}>{trip?.departTime ? `left ${hm(trip.departTime)}` : '—'}</Text>
              </View>
              <View style={s.v31}>
                <View>
                  <Text style={s.t29}>{prev ? (prev.outlet?.name ?? prev.outletId) : 'Stops left'}</Text>
                </View>
                <Text style={s.t30}>{prev ? (prev.leaveActual ? `delivered ${hm(prev.leaveActual)}` : 'delivered') : String(left)}</Text>
              </View>
              <View style={s.v34}>
                <View>
                  <Text style={s.t32}>{o?.name ?? stop?.outletId ?? '—'}</Text>
                </View>
                <Text style={s.t33}>{stop?.etaModel ? `~${hm(stop.etaModel)}` : '—'}</Text>
              </View>
            </View>
          </View>
          <View style={s.v40}>
            <Icon xml={X3} width={20} height={20} style={s.v37} />
            <View style={s.v39}>
              <View>
                <Text style={s.t38} testID="net-note">
                  {net.online
                    ? `Online${updatedAt ? ` · run saved on phone ${hm(new Date(updatedAt).toISOString())}` : ''}${waiting.length ? ` · ${waiting.length} to send` : ''}`
                    : `No signal since ${hm(net.since)} · run saved on phone${waiting.length ? ` · ${waiting.length} waiting` : ''}`}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.v44}>
            <Tap say={say} style={s.v41} to={null} testID="say-next">
              <Icon xml={X4} width={18} height={18} style={s.v1} />
              <Text style={s.t16}>{stop ? `Voice: next stop${soon ? ` ${soon}` : stop.etaModel ? ` ~${hm(stop.etaModel)}` : ''}` : 'Voice: read aloud'}</Text>
            </Tap>
            <Tap style={s.v43} to={null} onPress={() => openMaps(stop ? [stop] : [])} testID="open-maps">
              <Icon xml={X5} width={16} height={16} style={s.v1} />
              <Text style={s.t42} numberOfLines={1}>{"Open in Maps"}</Text>
            </Tap>
          </View>
        </Scroll>
        <View style={s.v54}>
          <Tap
            lk="L13"
            style={s.v49}
            disabled={DRIVER_APP && !stop && !trip}
            to={arriveTo}
            onPress={async () => {
              // TripStops Arrive (queued; sent with the next sync)
              if (stop && !stop.arrivalActual && stop.status !== 'DELIVERED') await arriveAtStop(stop);
            }}
          >
            <Grad g={G0} style={s.v47} />
            <Icon xml={X6} width={22} height={22} style={s.v1} />
            <Text style={s.t48}>{stop ? `Arrived at stop ${seq}` : trip ? 'Run complete' : 'Arrived at stop'}</Text>
          </Tap>
          <View style={s.v51}>
            {/* the design locked this button while the van moves; this build reads no motion, so it is always ready */}
            <Text style={s.t50}>{"Tap once you have parked at the stop"}</Text>
          </View>
          <Tap lk="L245" style={s.v53} to={stop ? { to: 'dr-38-report-a-delay', params: { stop: stop.id } } : undefined}>
            <Icon xml={X7} width={22} height={22} style={s.v1} />
            <Text style={s.t52}>{"Report a delay"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 17V7a2 2 0 0 1 2-2h10l4 5h1a2 2 0 0 1 2 2v5h-2\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 17h6\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"7\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"17\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M15 5v5h4\" fill=\"none\" stroke=\"#1a1300\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11 5 6 9H2v6h4l5 4V5Z\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  t2: {"color":"#b5bdd1","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v3: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":1},
  t4: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v5: {"flexShrink":1},
  t6: {"color":"#5ee0a8","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":16,"paddingLeft":14,"height":48,"backgroundColor":"#0d2a20","borderRadius":24},
  v8: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":60},
  t9: {"color":"#7f89a3","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  t10: {"color":"#f2f4fa","fontSize":46,"lineHeight":46.9,"letterSpacing":-1.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t11: {"color":"#f2f4fa","letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t12: {"color":"#b5bdd1","fontSize":17,"lineHeight":25.5,"fontFamily":"Inter_600SemiBold"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6},
  t14: {"color":"#ffcb5c","fontSize":76,"lineHeight":68.4,"letterSpacing":-3,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t15: {"color":"#f2f4fa","fontSize":16,"lineHeight":24,"fontFamily":"Inter_800ExtraBold"},
  t16: {"color":"#b5bdd1","fontSize":14,"lineHeight":21,"fontFamily":"Inter_600SemiBold"},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexShrink":1,"paddingBottom":4},
  v18: {"flexDirection":"row","alignItems":"flex-end","rowGap":16,"columnGap":16},
  v19: {"flexShrink":0,"width":16,"height":16,"backgroundColor":"#5ee0a8","borderRadius":8},
  v20: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":5,"backgroundColor":"#5ee0a8","borderRadius":2.5},
  v21: {"flexGrow":0.35,"flexShrink":1,"flexBasis":"0%","height":0,"borderTopWidth":3,"borderTopColor":"#57534e","borderStyle":"dashed"},
  v22: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#f5b83d","borderRadius":18},
  v23: {"flexGrow":0.65,"flexShrink":1,"flexBasis":"0%","height":5,"backgroundColor":"#1a2340","borderRadius":2.5},
  v24: {"flexShrink":0,"width":20,"height":20,"borderWidth":3,"borderColor":"#ffcb5c","borderRadius":10},
  v25: {"flexDirection":"row","alignItems":"center","height":36},
  t26: {"color":"#f2f4fa","fontSize":14,"lineHeight":18.9,"fontFamily":"Inter_700Bold"},
  t27: {"color":"#7f89a3","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_600SemiBold"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":1,"columnGap":1,"flexShrink":1},
  t29: {"color":"#f2f4fa","fontSize":14,"lineHeight":18.9,"textAlign":"center","fontFamily":"Inter_700Bold"},
  t30: {"color":"#7f89a3","fontSize":13,"lineHeight":17.6,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v31: {"flexDirection":"column","alignItems":"center","rowGap":1,"columnGap":1,"flexShrink":1},
  t32: {"color":"#f2f4fa","fontSize":14,"lineHeight":18.9,"textAlign":"right","fontFamily":"Inter_700Bold"},
  t33: {"color":"#7f89a3","fontSize":13,"lineHeight":17.6,"textAlign":"right","fontFamily":"Inter_600SemiBold"},
  v34: {"flexDirection":"column","alignItems":"flex-end","rowGap":1,"columnGap":1,"flexShrink":1},
  v35: {"flexDirection":"row","justifyContent":"space-between","alignItems":"stretch","rowGap":8,"columnGap":8},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  v37: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t38: {"color":"#d6cfc7","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v40: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  v41: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"minHeight":24},
  t42: {"color":"#a9b4ff","fontSize":15,"lineHeight":22.5,"textDecorationLine":"underline","fontFamily":"Inter_700Bold"},
  v43: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":0,"height":48},
  v44: {"flexDirection":"column","alignItems":"flex-start","rowGap":4,"columnGap":4},
  v45: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":6,"paddingRight":20,"paddingBottom":8,"paddingLeft":20},
  v47: {"borderRadius":18},
  t48: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v49: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18},
  t50: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v51: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":6,"columnGap":6},
  t52: {"color":"#f2f4fa","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v53: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"backgroundColor":"#1a2340","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  v54: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v55: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
