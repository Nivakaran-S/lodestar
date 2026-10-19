// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-32 Run moved to a new phone · phone (P4, phone)
// DR-01 opens this when the server holds records of today's run that this phone never saved (another phone worked
// it) and this phone has not saved the run yet. Everything shown comes from the server; "Download today's run"
// saves it here (DR-13).
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { useClaims, useOutbox, useParam, useRun } from '@/model/hooks';
import { movedRun, useDispatchNotices, useRunMarks, useServerEvents } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L238":{"to":"dr-13-saving-run-for-offline","kind":"go"}}};

export default function ScreenDr32RunMovedToANewPhone() {
  const claims = useClaims();
  const param = useParam('trip');
  const run = useRun();
  const v = run.view;
  const trip = v?.trips.find(t => t.id === param) ?? v?.trip ?? null;
  const stops = v ? v.stops.filter(st => st.tripId === trip?.id) : [];
  const visits = new Set(stops.map(st => st.stopSeq)).size;
  const shortfalls = trip?.loadRecord?.shortfalls ?? [];
  const { items } = useOutbox();
  const marks = useRunMarks(trip?.id);
  const events = useServerEvents((v?.trips ?? []).map(t => t.id));
  const { lastSynced } = movedRun(events.data, items, marks.saved);
  const latest = useDispatchNotices().list[0];
  const accepted = trip?.loadRecord?.releasedAt ?? trip?.departTime;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v35}>
        <View style={s.v6}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"New phone"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v30}>
          <View style={s.v10}>
            <View>
              <Text style={s.t7}>{claims ? `Signed in · ${claims.name ?? claims.username}` : 'Not signed in'}</Text>
            </View>
            <View>
              <Text style={s.t8} testID="moved-heading">{trip ? "Today's run is ready to download" : run.loading ? 'Loading…' : 'No run today'}</Text>
            </View>
            <View>
              <Text style={s.t9}>{"Restored from the server. Save it here before you leave hub Wi-Fi."}</Text>
            </View>
          </View>
          {trip ? (
            <View style={s.v25}>
              <View style={s.v15}>
                <View style={s.v12}>
                  <Text style={s.t11}>{"Restored from the server"}</Text>
                </View>
                <View style={s.v12}>
                  <Text style={s.t14}><Text style={s.t13}>{trip.vehicleId}</Text></Text>
                </View>
              </View>
              <View style={s.v24}>
                <View style={s.v22}>
                  <View style={s.v16}>
                    <Icon xml={X1} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v20}>
                    <View>
                      <Text style={s.t17}>{`Plan v${trip.planVersion} · ${plural(visits, 'stop')}`}</Text>
                    </View>
                    <View style={s.v19}>
                      <Text style={s.t18}>{`Trip ${trip.tripNumber} · ${titleCase(trip.brand)} · ${trip.district}`}</Text>
                    </View>
                  </View>
                  <View style={s.v21}>
                    <Icon xml={X2} width={14} height={14} style={s.v1} />
                  </View>
                </View>
                <View style={s.v23}>
                  <View style={s.v16}>
                    <Icon xml={X3} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v20}>
                    <View>
                      <Text style={s.t17}>{accepted ? `Load released ${hm(accepted)}` : 'Load not released yet'}</Text>
                    </View>
                    <View style={s.v19}>
                      <Text style={s.t18}>{`${plural(new Set(stops.map(st => st.orderId)).size, 'order')}${shortfalls.length ? ` · ${plural(shortfalls.length, 'shortfall')} noted` : ''}`}</Text>
                    </View>
                  </View>
                  <View style={s.v21}>
                    <Icon xml={X2} width={14} height={14} style={s.v1} />
                  </View>
                </View>
                {latest ? (
                  <View style={s.v23}>
                    <View style={s.v16}>
                      <Icon xml={X4} width={19} height={19} style={s.v1} />
                    </View>
                    <View style={s.v20}>
                      <View>
                        <Text style={s.t17}>{"Dispatch notices"}</Text>
                      </View>
                      <View style={s.v19}>
                        <Text style={s.t18}>{`${latest.title} ${hm(latest.at)}`}</Text>
                      </View>
                    </View>
                    <View style={s.v21}>
                      <Icon xml={X2} width={14} height={14} style={s.v1} />
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
          {lastSynced ? (
            <View style={s.v29}>
              <Icon xml={X5} width={20} height={20} style={s.v26} />
              <View style={s.v28}>
                <View>
                  <Text style={s.t27} testID="old-phone">{`Old phone last synced ${hm(lastSynced)}`}</Text>
                </View>
                <View>
                  <Text style={s.t9}>{"Anything saved after that is still on it. Hand the old phone to the depot; admin will recover or revoke it."}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v34}>
          <Tap lk="L238" style={s.v33} to={trip ? { to: 'dr-13-saving-run-for-offline', params: { trip: trip.id } } : undefined}>
            <Grad g={G0} style={s.v31} />
            <Icon xml={X6} width={22} height={22} style={s.v1} />
            <Text style={s.t32}>{"Download today's run"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m12 2 10 5-10 5L2 7z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m2 17 10 5 10-5M2 12l10 5 10-5\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t8: {"color":"#f2f4fa","fontSize":32,"lineHeight":35.2,"letterSpacing":-1,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t9: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t11: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v12: {"flexShrink":1},
  t13: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t14: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v16: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t17: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t18: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v19: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v20: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v21: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v24: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v26: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t27: {"color":"#ffc266","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v29: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#2e2208","borderRadius":18},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v31: {"borderRadius":18},
  t32: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v35: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
