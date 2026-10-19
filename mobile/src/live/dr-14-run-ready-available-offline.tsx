// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-14 Run ready · available offline · phone (P4, phone)
// What DR-13 saved on this phone for the trip (route param `trip`), read back from the cache with no signal. The
// plan's publish time is not in the driver's data, and plan changes are not sent by SMS: both left out.
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import * as api from '@/model/api';
import { today, useParam, useRun } from '@/model/hooks';
import { useQuery } from '@/model/query';
import { useRunMarks } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L242":{"to":"dr-01-today-s-run","kind":"go"}}};

const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function ScreenDr14RunReadyAvailableOffline() {
  const param = useParam('trip');
  const run = useRun();
  const v = run.view;
  const trip = v?.trips.find(t => t.id === param) ?? v?.trip ?? null;
  const stops = v ? v.stops.filter(st => st.tripId === trip?.id) : [];
  const orderIds = [...new Set(stops.map(st => st.orderId))];
  const lines = useQuery(orderIds.length ? `lines.${orderIds.join(',')}` : null, c => api.orderLines(c, orderIds), { persist: true }).data;
  const marks = useRunMarks(trip?.id);
  const visits = stops.filter((st, i) => stops.findIndex(x => x.stopSeq === st.stopSeq) === i);
  const shortfalls = trip?.loadRecord?.shortfalls ?? [];
  const notes = visits.filter(st => st.outlet?.accessNote || st.outlet?.dockType).length;
  const bytes = JSON.stringify(run.data ?? null).length + JSON.stringify(lines ?? null).length;
  const savedAt = marks.saved ?? (run.updatedAt ? new Date(run.updatedAt).toISOString() : null);
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v34}>
        <View style={s.v6}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{dayLabel(v?.date ?? today())}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v29}>
          <View style={s.v13}>
            <View style={s.v10}>
              <View style={s.v7}>
                <Icon xml={X1} width={26} height={26} style={s.v1} />
              </View>
              <View style={s.v9}>
                <Text style={s.t8} testID="offline-ready">{trip ? "Available offline" : run.loading ? 'Loading…' : 'Nothing saved yet'}</Text>
              </View>
            </View>
            {savedAt ? (
              <View>
                <Text style={s.t12}>{"Saved "}<Text style={s.t11}>{hm(savedAt)}</Text>{" on this phone. Everything below works with no signal."}</Text>
              </View>
            ) : null}
          </View>
          {trip ? (
            <View style={s.v26}>
              <View style={s.v16}>
                <View style={s.v9}>
                  <Text style={s.t14}>{"Saved on this phone"}</Text>
                </View>
                <View style={s.v9}>
                  <Text style={s.t15}>{kb(bytes)}</Text>
                </View>
              </View>
              <View style={s.v25}>
                <View style={s.v23}>
                  <View style={s.v17}>
                    <Icon xml={X2} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v21}>
                    <View>
                      <Text style={s.t18}>{`Route · ${plural(visits.length, 'stop')}`}</Text>
                    </View>
                    <View style={s.v20}>
                      <Text style={s.t19}>{visits.map(st => st.outlet?.name ?? st.outletId).join(', ')}</Text>
                    </View>
                  </View>
                  <View style={s.v22}>
                    <Icon xml={X3} width={14} height={14} style={s.v1} />
                  </View>
                </View>
                <View style={s.v24}>
                  <View style={s.v17}>
                    <Icon xml={X4} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v21}>
                    <View>
                      <Text style={s.t18}>{`${plural(orderIds.length, 'order')}${lines ? ` · ${plural(lines.length, 'line')}` : ''}`}</Text>
                    </View>
                    {shortfalls.length ? (
                      <View style={s.v20}>
                        <Text style={s.t19}>{`${plural(shortfalls.length, 'shortfall')} noted`}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={s.v22}>
                    <Icon xml={X3} width={14} height={14} style={s.v1} />
                  </View>
                </View>
                {notes ? (
                  <View style={s.v24}>
                    <View style={s.v17}>
                      <Icon xml={X5} width={19} height={19} style={s.v1} />
                    </View>
                    <View style={s.v21}>
                      <View>
                        <Text style={s.t18}>{"Store notes and photos"}</Text>
                      </View>
                      <View style={s.v20}>
                        <Text style={s.t19}>{"Dock directions"}</Text>
                      </View>
                    </View>
                    <View style={s.v22}>
                      <Icon xml={X3} width={14} height={14} style={s.v1} />
                    </View>
                  </View>
                ) : null}
                <View style={s.v24}>
                  <View style={s.v17}>
                    <Icon xml={X6} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v21}>
                    <View>
                      <Text style={s.t18}>{`Plan v${trip.planVersion}`}</Text>
                    </View>
                  </View>
                  <View style={s.v22}>
                    <Icon xml={X3} width={14} height={14} style={s.v1} />
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v33}>
          <Tap lk="L242" style={s.v32}>
            <Grad g={G0} style={s.v30} />
            <Text style={s.t31}>{"Open today's run"}</Text>
            <Icon xml={X8} width={22} height={22} style={s.v1} />
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#07140f\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"26\" height=\"26\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#07140f\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 3-6 3v15l6-3 6 3 6-3V3l-6 3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 3v15M15 6v15\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m12 2 10 5-10 5L2 7z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m2 17 10 5 10-5M2 12l10 5 10-5\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v7: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":48,"height":48,"backgroundColor":"#5ee0a8","borderRadius":24},
  t8: {"color":"#f2f4fa","fontSize":32,"lineHeight":35.2,"letterSpacing":-1,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v9: {"flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14},
  t11: {"color":"#f2f4fa","fontFamily":"Inter_700Bold"},
  t12: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#0d2a20","borderRadius":24},
  t14: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t15: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v16: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v17: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t18: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t19: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v20: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v24: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v25: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v27: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  v28: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v29: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":4,"paddingBottom":16},
  v30: {"borderRadius":18},
  t31: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v32: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v34: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
