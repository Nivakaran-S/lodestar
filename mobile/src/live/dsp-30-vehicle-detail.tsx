// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DSP-30 Vehicle detail · phone (P2, phone)
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { titleCase } from '@/lodestar/live';
import { useClaims, useOnline, useVehicle } from '@/model/hooks';
import { useSignalLost, minutesOfBudget, useAgentConfig, useStoreManagers, warnStores } from '@/model/plan';
import type { Trip } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L62":{"to":"dsp-31-call-or-sms-driver","kind":"go"},"B":{"to":"dsp-29-live-routes","kind":"back"}}};

const STATUS: Record<Trip['status'], string> = { PLANNED: 'Planned', LOADING: 'Loading', ENROUTE: 'En route', COMPLETE: 'Complete' };

export default function ScreenDsp30VehicleDetail() {
  const { name: depotName } = useDepots();
  const cfg = useAgentConfig().data;
  const claims = useClaims();
  const { data, id, loading, error } = useVehicle();
  const lost = useSignalLost();
  const vehicle = data?.vehicle ?? null;
  const trips = data?.trips ?? [];
  const stops = data?.stops ?? [];
  const trip = trips.find(t => t.status === 'ENROUTE') ?? trips.find(t => t.status !== 'COMPLETE') ?? trips.at(-1) ?? null;
  const driver = trip?.driver?.name ?? trips.find(t => t.driver)?.driver?.name ?? null;
  const tripStops = trip ? stops.filter(x => x.tripId === trip.id) : [];
  const done = tripStops.filter(x => x.status === 'DELIVERED').length;
  const next = tripStops.find(x => x.status !== 'DELIVERED') ?? null;
  const lostAt = id ? lost.get(id) : undefined;
  // "Warn stores": the store managers of the trip's stops not yet delivered, from the user directory
  const online = useOnline();
  const openStops = tripStops.filter(x => x.status !== 'DELIVERED');
  const managers = useStoreManagers(openStops.map(x => x.outletId));
  const [warned, setWarned] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);
  const warn = async () => {
    if (!trip || !managers.data?.length) return false;
    if (!online) throw new Error('Warning stores needs signal');
    setWarning(true);
    try {
      const n = await warnStores(trip, openStops, managers.data);
      setWarned(hm(new Date().toISOString()));
      showToast(`${n} store${n === 1 ? '' : 's'} warned: possible delay`);
      return false;
    } finally {
      setWarning(false);
    }
  };

  const kind = vehicle ? `${vehicle.tempClass === 'CHILLED' ? 'Reefer' : 'Ambient'} ${vehicle.type.toLowerCase()}` : '';
  const lead = !claims ? 'Sign in to see this vehicle' : vehicle ? `${kind} · ${driver ?? 'no driver yet'}` : loading ? 'Loading…' : error ? 'No signal · nothing saved yet' : 'Loading…';
  const chip = lostAt ? 'Predicted' : vehicle ? titleCase(vehicle.status) : '—';
  const headline = lostAt
    ? `Unknown since ${hm(lostAt)}`
    : vehicle?.status === 'WORKSHOP'
      ? 'In the workshop'
      : trip
        ? `${STATUS[trip.status]} · ${done}/${tripStops.length}`
        : vehicle
          ? 'No trip today'
          : '—';
  const detail =
    vehicle?.workshopNote ||
    (next
      ? `Next ${next.outlet?.name ?? next.outletId}${next.etaModel ? ` ~${hm(next.etaModel)}` : ''}${next.lateRiskPct !== null && next.lateRiskPct !== undefined ? `, late risk ${next.lateRiskPct}%` : ''}.${lostAt ? ' Never shown as on time until a ping confirms.' : ''}`
      : trip
        ? 'All stops delivered.'
        : '');

  return (
    <Frame bg="#f4f5f9" nav={nav} style={s.v0}>
      <View style={s.v41}>
        <View style={s.v6}>
          <Tap lk="B" style={s.v3}>
            <Icon xml={X0} width={22} height={22} style={s.v1} />
            <Text style={s.t2}>{"Live"}</Text>
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}>{id ?? '—'}</Text>
          </View>
        </View>
        <Scroll style={s.v9} contentStyle={s.v34}>
          <View style={s.v15}>
            <View style={s.v12}>
              <View style={s.v8}>
                <Text style={s.t7}>{lead}</Text>
              </View>
              <View style={s.v9} />
              <View style={s.v11}>
                <Text style={s.t10} numberOfLines={1}>{chip}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t13} testID="vehicle-headline">{headline}</Text>
            </View>
            {detail ? (
              <View>
                <Text style={s.t14}>{detail}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.v17}>
            <Icon xml={X1} width={342} height={150} style={s.v16} />
          </View>
          {trips.map(t => {
            const ts = stops.filter(x => x.tripId === t.id);
            const lr = t.loadRecord;
            return (
              <View key={t.id} style={s.v33}>
                <View style={s.v20}>
                  <View style={s.v8}>
                    <Text style={s.t18}>{`Trip ${t.tripNumber} · ${titleCase(t.brand)} · ${t.district}`}</Text>
                  </View>
                  <View style={s.v8}>
                    <Text style={s.t19}>{minutesOfBudget(t.planMinutes, t.brand, cfg)}</Text>
                  </View>
                </View>
                <View style={s.v32}>
                  <View style={s.v27}>
                    {t.departTime ? (
                      <View style={s.v21}>
                        <Icon xml={X2} width={21} height={21} style={s.v1} />
                      </View>
                    ) : (
                      <View style={s.v30}>
                        <Text style={s.t29}>{"0"}</Text>
                      </View>
                    )}
                    <View style={s.v24}>
                      <View>
                        <Text style={s.t22}>{`${t.departTime ? 'Departed' : 'Leaves'} ${depotName(t.depot)}`}</Text>
                      </View>
                      <View>
                        <Text style={s.t23}>{[`${ts.length} ${ts.length === 1 ? 'order' : 'orders'}`, (lr?.bay ?? t.bay) ? `bay ${lr?.bay ?? t.bay}` : undefined, (lr?.reeferTempC ?? t.reeferTempC) !== null && (lr?.reeferTempC ?? t.reeferTempC) !== undefined ? `reefer ${lr?.reeferTempC ?? t.reeferTempC} °C` : undefined, STATUS[t.status]].filter(Boolean).join(' · ')}</Text>
                      </View>
                    </View>
                    <View style={s.v26}>
                      <View>
                        <Text style={s.t25}>{hm(t.departTime)}</Text>
                      </View>
                    </View>
                  </View>
                  {ts.map(st => {
                    const delivered = st.status === 'DELIVERED';
                    return (
                      <View key={st.id} style={s.v28}>
                        {delivered ? (
                          <View style={s.v21}>
                            <Icon xml={X2} width={21} height={21} style={s.v1} />
                          </View>
                        ) : (
                          <View style={s.v30}>
                            <Text style={s.t29}>{String(st.stopSeq)}</Text>
                          </View>
                        )}
                        <View style={s.v24}>
                          <View>
                            <Text style={s.t22}><Text style={s.t31}>{st.outletId}</Text>{st.outlet?.name ? ` ${st.outlet.name}` : ''}</Text>
                          </View>
                          <View>
                            <Text style={s.t23}>
                              {[
                                delivered ? `Delivered ${hm(st.leaveActual ?? st.arrivalActual)}`.trim() : titleCase(st.status),
                                st.etaPlan ? `plan ${hm(st.etaPlan)}` : undefined,
                                !delivered && st.outlet?.windowClose ? `window to ${st.outlet.windowClose}` : undefined,
                                !delivered && st.lateRiskPct !== null && st.lateRiskPct !== undefined ? `late risk ${st.lateRiskPct}%` : undefined,
                              ].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                        </View>
                        <View style={s.v26}>
                          <View>
                            {delivered ? (
                              <Text style={s.t25}>{hm(st.leaveActual ?? st.arrivalActual)}</Text>
                            ) : (
                              <Text style={s.t10}>{st.etaModel ? `~${hm(st.etaModel)}` : '—'}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Scroll>
        <View style={s.v40}>
          <Tap lk="L62" style={s.v37} to={id && vehicle ? { to: 'dsp-31-call-or-sms-driver', params: { vehicle: id } } : undefined}>
            <Grad g={G0} style={s.v35} />
            <Icon xml={X3} width={22} height={22} style={s.v1} />
            <Text style={s.t36}>{driver ? `Call or SMS ${driver.split(' ')[0]}` : "Call or SMS driver"}</Text>
          </Tap>
          <Tap style={s.v39} onPress={warn} disabled={warning || !managers.data?.length} testID="warn-stores">
            <Text style={s.t38}>{warning ? "Warning stores…" : warned ? `Stores warned ${warned}` : "Warn stores: possible delay"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m15 18-6-6 6-6\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg width=\"342\" height=\"150\" viewBox=\"0 0 342 150\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"> <rect width=\"342\" height=\"150\" fill=\"#dce8f0\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect> <path d=\"M0 150 L0 110 C 60 90 90 104 140 80 C 190 56 240 70 290 46 C 310 38 330 40 342 36 L342 150 Z\" fill=\"#cfe0d5\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <path d=\"M120 150 C 170 110 220 118 260 96 C 290 80 320 84 342 76 L342 150 Z\" fill=\"#c2d6c8\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <ellipse cx=\"200\" cy=\"64\" rx=\"62\" ry=\"34\" fill=\"#57534e\" opacity=\"0.07\" stroke=\"#a8a29e\" stroke-width=\"1.5\" stroke-dasharray=\"5, 5\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></ellipse> <path d=\"M34 120 C 70 112 100 98 150 72\" stroke=\"#0369a1\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <path d=\"M150 72 C 200 50 240 44 268 52 S 300 70 310 74\" stroke=\"#57534e\" stroke-width=\"3\" fill=\"none\" stroke-dasharray=\"6, 6\" stroke-linecap=\"round\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <rect x=\"24\" y=\"110\" width=\"20\" height=\"20\" rx=\"6\" fill=\"#141b4d\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect> <circle cx=\"150\" cy=\"72\" r=\"8\" fill=\"#ffffff\" stroke=\"#0369a1\" stroke-width=\"3\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle> <circle cx=\"268\" cy=\"52\" r=\"7\" fill=\"#ffffff\" stroke=\"#57534e\" stroke-width=\"2\" stroke-dasharray=\"3, 3\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle> <circle cx=\"310\" cy=\"74\" r=\"7\" fill=\"#ffffff\" stroke=\"#57534e\" stroke-width=\"2\" stroke-dasharray=\"3, 3\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle>     </svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"21\" height=\"21\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  t2: {"color":"#3b4cca","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  v3: {"flexDirection":"row","alignItems":"center","rowGap":2,"columnGap":2,"flexShrink":1},
  t4: {"color":"#0f1422","fontSize":16,"lineHeight":24,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%","marginRight":58},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#57534e","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v8: {"flexShrink":1},
  v9: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t10: {"color":"#57534e","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":14},
  v12: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t13: {"color":"#0f1422","fontSize":32,"lineHeight":35.8,"letterSpacing":-0.8,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t14: {"color":"#4a5467","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"borderWidth":2,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":24},
  v16: {"overflow":"hidden"},
  v17: {"flexShrink":0,"marginRight":16,"marginLeft":16,"height":150,"backgroundColor":"#dce8f0","borderRadius":20,"overflow":"hidden"},
  t18: {"color":"#0f1422","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t19: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v20: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v21: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":42,"height":42,"backgroundColor":"#e8f8f0","borderRadius":14},
  t22: {"color":"#0f1422","fontSize":15.5,"lineHeight":20.2,"fontFamily":"Inter_700Bold"},
  t23: {"color":"#4a5467","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_400Regular"},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t25: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v26: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v27: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":11,"paddingRight":16,"paddingBottom":11,"paddingLeft":16,"minHeight":64},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":11,"paddingRight":16,"paddingBottom":11,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#eceef3"},
  t29: {"color":"#57534e","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v30: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":42,"height":42,"borderWidth":1,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":14},
  t31: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  v32: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":18,"columnGap":18,"paddingTop":4,"paddingBottom":12},
  v35: {"borderRadius":18},
  t36: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(59, 76, 202, 0.28) 0px 8px 20px 0px"},
  t38: {"color":"#4a5467","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v39: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f4f5f9"},
  v41: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f4f5f9"},
});
