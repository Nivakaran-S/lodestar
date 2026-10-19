// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-01 Dock queue (P3, phone)
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm, until } from '@/lib/time';
import { plural, signOutTo, titleCase } from '@/lodestar/live';
import { nextToLoad, useMyBay, useRePlanAlert } from '@/model/dock';
import { useBayQueue, useClaims, useOutbox } from '@/model/hooks';
import type { Trip } from '@/model/types';
import { Frame, PhoneOnly, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L6":{"to":"ld-02-load-sheet","kind":"go"},"L190":{"to":"ld-09-pre-cool-check","kind":"go"},"N1":{"to":"ld-13-flags-tab","kind":"nav"},"N2":{"to":"ld-16-shift-summary","kind":"nav"}}};

const STATUS: Record<string, string> = { PLANNED: 'Planned', LOADING: 'Loading', ENROUTE: 'Released', COMPLETE: 'Back' };

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

const kind = (t: Trip) => `${t.vehicle?.tempClass === 'CHILLED' ? 'Reefer ' : ''}${t.vehicle?.type === 'VAN' ? 'van' : t.vehicle ? 'truck' : ''}`.trim();

export default function ScreenLd01DockQueue() {
  const { name: depotName, loading: depotsLoading } = useDepots();
  const claims = useClaims();
  const { data, loading, error } = useBayQueue();
  const { waiting } = useOutbox();
  const trips = data?.trips ?? [];
  const [bay] = useMyBay();
  const next = nextToLoad(trips, bay);
  const depot = data?.depot ?? claims?.depots[0];
  // a re-plan published for this depot while the queue is open (P5) opens LD-14
  useRePlanAlert(depot);
  const releasing = (id: string) => waiting.some(i => i.kind === 'RELEASE' && i.tripId === id);
  const empty = !claims ? 'Sign in to see your bay queue' : loading && !data ? 'Loading the bay queue…' : error && !data ? 'No signal · bay queue not saved yet' : trips.length ? '' : 'No trips to load';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v60}>
        <View style={s.v11}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{depot && !depotsLoading ? depotName(depot) : 'Lodestar Dock'}</Text>
          </View>
          <Tap style={s.v10} to={null} onPress={() => signOutTo('ld-06-sign-in')} testID="switch-user">
            <View style={s.v6}>
              <Text style={s.t5}>{initials(claims?.name ?? claims?.username) || '—'}</Text>
            </View>
            <View style={s.v9}>
              <View>
                <Text style={s.t7} numberOfLines={1}>{claims?.name ?? claims?.username ?? 'Not signed in'}</Text>
              </View>
              <View>
                <Text style={s.t8} numberOfLines={1}>{"Switch user"}</Text>
              </View>
            </View>
          </Tap>
        </View>
        <Scroll style={s.v4} contentStyle={s.v52}>
          <View style={s.v15}>
            <Icon xml={X1} width={20} height={20} style={s.v12} />
            <View style={s.v14}>
              <View>
                <Text style={s.t13} testID="plan-banner">{data ? `${next?.planVersion ? `Plan v${next.planVersion} · ` : ''}${dayLabel(data.date)}${data.isToday ? '' : ' · last run day'}${waiting.length ? ` · ${waiting.length} to send` : ''}` : empty || ' '}</Text>
              </View>
            </View>
          </View>
          <Tap lk="L6" style={s.v24} to={next ? { to: 'ld-02-load-sheet', params: { trip: next.id } } : undefined}>
            <Grad g={G0} style={s.v16} />
            <View>
              <Text style={s.t17}>{next ? `Next at bay ${next.bay ?? '—'}` : 'Next at your bay'}</Text>
            </View>
            <View style={s.v22}>
              <View style={s.v19}>
                <Text style={s.t18} testID="next-vehicle">{next?.vehicleId ?? '—'}</Text>
              </View>
              {next ? (
                <View style={s.v21}>
                  <Icon xml={X2} width={14} height={14} style={s.v1} />
                  <Text style={s.t20} numberOfLines={1}>{until(next.departTime) || hm(next.departTime) || STATUS[next.status]}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={s.t23}>{next ? [kind(next), next.district, plural(next.stops?.length ?? 0, 'order')].filter(Boolean).join(' · ') : empty || 'All trips released'}</Text>
            </View>
          </Tap>
          <View style={s.v51}>
            <View style={s.v27}>
              <View style={s.v19}>
                <Text style={s.t25}>{`Loading · ${trips.length}`}</Text>
              </View>
              <View style={s.v19}>
                <Text style={s.t26}>{"by bay"}</Text>
              </View>
            </View>
            <View style={s.v50}>
              {trips.map((t, i) => {
                const mine = t.id === next?.id;
                return (
                  <Tap key={t.id} style={mine ? s.v46 : i === 0 ? s.v42 : s.v48} to={{ to: 'ld-02-load-sheet', params: { trip: t.id } }} testID={`bay-row-${i}`}>
                    <View style={mine ? s.v44 : s.v29}>
                      <Text style={mine ? s.t43 : s.t28}>{t.bay ?? '—'}</Text>
                    </View>
                    <View style={s.v38}>
                      <View>
                        <Text style={s.t31}><Text style={s.t30}>{t.vehicleId}</Text>{` · ${t.district}`}</Text>
                      </View>
                      <View style={s.v37}>
                        <View style={s.v33}>
                          <Icon xml={X3} width={14} height={14} style={s.v1} />
                          <Text style={s.t32} numberOfLines={1}>{kind(t) || titleCase(t.brand)}</Text>
                        </View>
                        <View style={s.v34} />
                        <View style={s.v33}>
                          <View style={s.v35} />
                          <Text style={s.t36} numberOfLines={1}>{releasing(t.id) ? 'Release saved' : STATUS[t.status] ?? t.status}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={s.v41}>
                      <View>
                        <Text style={s.t39}>{hm(t.departTime) || '—'}</Text>
                      </View>
                      <View>
                        <Text style={s.t40}>{until(t.departTime) || plural(t.stops?.length ?? 0, 'order')}</Text>
                      </View>
                    </View>
                  </Tap>
                );
              })}
            </View>
          </View>
        </Scroll>
        <View style={s.v56}>
          <Tap lk="L190" style={s.v55} to={next ? { to: 'ld-09-pre-cool-check', params: { trip: next.id } } : undefined}>
            <Grad g={G1} style={s.v53} />
            <Icon xml={X5} width={22} height={22} style={s.v1} />
            <Text style={s.t54}>{next ? `Start loading ${next.vehicleId}` : 'Start loading'}</Text>
          </Tap>
        </View>
        <PhoneOnly>
        <View style={s.v59}>
          <View style={s.v58}>
            <Icon xml={X6} width={24} height={24} style={s.v1} />
            <Text style={s.t57}>{"Dock"}</Text>
          </View>
          <Tap lk="N1" style={s.v58}>
            <Icon xml={X7} width={24} height={24} style={s.v1} />
            <Text style={s.t26}>{"Flags"}</Text>
          </Tap>
          <Tap lk="N2" style={s.v58}>
            <Icon xml={X8} width={24} height={24} style={s.v1} />
            <Text style={s.t26}>{"Shift"}</Text>
          </Tap>
        </View>
        </PhoneOnly>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 21V8l9-5 9 5v13\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M7 21v-8h10v8M7 17h10\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#1e2766","p":0},{"c":"#141b4d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_800ExtraBold"},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":34,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  t7: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_700Bold"},
  t8: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexDirection":"column","alignItems":"stretch","flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":12,"paddingLeft":5,"height":44,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v12: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t13: {"color":"#047857","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v14: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v15: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#e3f6ec","borderRadius":18},
  v16: {"borderRadius":24},
  t17: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t18: {"color":"#ffffff","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v19: {"flexShrink":1},
  t20: {"color":"#ffffff","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v21: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"rgba(255, 255, 255, 0.14)","borderRadius":14},
  v22: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t23: {"color":"#b9c0e6","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"borderRadius":24,"boxShadow":"rgba(20, 27, 77, 0.28) 0px 12px 32px 0px"},
  t25: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t26: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v27: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t28: {"color":"#3b4cca","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t30: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t31: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t32: {"color":"#0e7490","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v34: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  v35: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#0369a1","borderRadius":3.5},
  t36: {"color":"#0369a1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v37: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t39: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t40: {"color":"#4a5467","fontSize":12,"lineHeight":18,"fontFamily":"Inter_600SemiBold"},
  v41: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v42: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  t43: {"color":"#ffcb5c","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v44: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#141b4d","borderRadius":14},
  t45: {"color":"#141b4d","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_700Bold"},
  v46: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e6e9f8","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  t47: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v48: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  t49: {"color":"#b45309","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v50: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v51: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v52: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v53: {"borderRadius":18},
  t54: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v55: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v56: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  t57: {"color":"#141b4d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v58: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  v59: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#ffffff","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v60: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
