// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-07 Start shift · phone (P3, phone)
// Gloves mode (wider touch areas on every button) and Loud alerts (vibrate and read plan changes aloud) are
// settings of this phone (src/lib/settings), applied by the runtime's Tap and the realtime notices.
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { setSettings, useSettings } from '@/lib/settings';
import { useBayQueue, useClaims } from '@/model/hooks';
import { nextToLoad, useMyBay } from '@/model/dock';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L188":{"to":"ld-08-quick-tips","kind":"go"}}};

export default function ScreenLd07StartShift() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const set = useSettings();
  const { data, loading } = useBayQueue();
  const trips = data?.trips ?? [];
  const depot = data?.depot ?? claims?.depots[0];
  const hub = depot ? `${depotName(depot)}` : '—';
  const name = claims?.name ?? claims?.username ?? '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '—';
  const [bay, setBay] = useMyBay();
  const next = nextToLoad(trips, bay);
  const toLoad = trips.filter(t => t.status === 'PLANNED' || t.status === 'LOADING');
  // a vehicle can run more than one trip: count both ("11 trips · 9 vehicles"), never trips as vehicles
  const vehiclesToLoad = new Set(toLoad.map(t => t.vehicleId)).size;
  const toLoadText = toLoad.length === vehiclesToLoad ? `${plural(vehiclesToLoad, 'vehicle')} to load` : `${plural(toLoad.length, 'trip')} · ${plural(vehiclesToLoad, 'vehicle')} to load`;
  const departs = trips.map(t => t.departTime).filter((d): d is string => !!d).sort((a, b) => a.localeCompare(b));
  const span = departs.length ? `${hm(departs[0])}–${hm(departs[departs.length - 1])}` : '—';
  const tiles = trips.slice(0, 4);
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v49}>
        <View style={s.v11}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{hub}</Text>
          </View>
          <View style={s.v10}>
            <View style={s.v6}>
              <Text style={s.t5}>{initials}</Text>
            </View>
            <View style={s.v9}>
              <View>
                <Text style={s.t7} numberOfLines={1}>{name || 'Not signed in'}</Text>
              </View>
              <View>
                <Text style={s.t8} numberOfLines={1}>{"Loader"}</Text>
              </View>
            </View>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v44}>
          <View style={s.v15}>
            <View style={s.v13}>
              <Text style={s.t12}>{[data ? dayLabel(data.date) : '', depot ? hub : ''].filter(Boolean).join(' · ') || '—'}</Text>
            </View>
            <View>
              <Text style={s.t14}>{"Start your shift"}</Text>
            </View>
          </View>
          <View style={s.v21}>
            <Grad g={G0} style={s.v16} />
            <View>
              <Text style={s.t17}>{data && !data.isToday ? 'Last run day' : 'Departures today'}</Text>
            </View>
            <View>
              <Text style={s.t18}>{span}</Text>
            </View>
            <View>
              <Text style={s.t20}>{loading && !data ? 'Loading the bay queue…' : `${toLoadText}${next ? ' · first out ' : ''}`}{next ? <Text style={s.t19}>{`${next.vehicleId}${next.departTime ? ` at ${hm(next.departTime)}` : ''}`}</Text> : null}</Text>
            </View>
          </View>
          <View style={s.v33}>
            <View style={s.v25}>
              <View style={s.v23}>
                <Text style={s.t22}>{"Your bay"}</Text>
              </View>
              <View style={s.v23}>
                <Text style={s.t24}>{"change any time"}</Text>
              </View>
            </View>
            <View style={s.v32}>
              {tiles.length ? tiles.map(t => {
                const mine = t.id === next?.id;
                return (
                  <Tap key={t.id} style={mine ? s.v31 : s.v28} to={null} onPress={() => setBay(t.bay ?? null)} disabled={!t.bay} testID={mine ? 'my-bay' : `bay-${t.bay ?? t.id}`}>
                    <View>
                      <Text style={mine ? s.t29 : s.t26}>{t.bay ?? '—'}</Text>
                    </View>
                    <View>
                      <Text style={mine ? s.t30 : s.t27}>{t.vehicleId}</Text>
                    </View>
                  </Tap>
                );
              }) : (
                <View style={s.v28}>
                  <View>
                    <Text style={s.t26}>{'—'}</Text>
                  </View>
                  <View>
                    <Text style={s.t27}>{loading ? 'Loading' : 'No trips'}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <View style={s.v43}>
            <Tap style={s.v41} testID="glovesMode" onPress={() => setSettings({ glovesMode: !set.glovesMode })}>
              <View style={s.v34}>
                <Icon xml={X1} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v38}>
                <View>
                  <Text style={s.t35}>{"Gloves mode"}</Text>
                </View>
                <View style={s.v37}>
                  <Text style={s.t36}>{"Big buttons, no swipes"}</Text>
                </View>
              </View>
              <View style={set.glovesMode ? s.v40 : SWITCH_OFF} accessibilityRole="switch" accessibilityState={{ checked: set.glovesMode }}>
                <View style={s.v39} />
              </View>
            </Tap>
            <Tap style={s.v42} testID="loudAlerts" onPress={() => setSettings({ loudAlerts: !set.loudAlerts })}>
              <View style={s.v34}>
                <Icon xml={X2} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v38}>
                <View>
                  <Text style={s.t35}>{"Loud alerts"}</Text>
                </View>
                <View style={s.v37}>
                  <Text style={s.t36}>{"Vibrate and sound on plan changes"}</Text>
                </View>
              </View>
              <View style={set.loudAlerts ? s.v40 : SWITCH_OFF} accessibilityRole="switch" accessibilityState={{ checked: set.loudAlerts }}>
                <View style={s.v39} />
              </View>
            </Tap>
          </View>
        </Scroll>
        <View style={s.v48}>
          <Tap lk="L188" style={s.v47}>
            <Grad g={G1} style={s.v45} />
            <Icon xml={X3} width={22} height={22} style={s.v1} />
            <Text style={s.t46}>{next?.bay ? `Start shift at Bay ${next.bay}` : 'Start shift'}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#1e2766","p":0},{"c":"#141b4d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const SWITCH_OFF = { flexDirection: 'row', alignItems: 'center', flexShrink: 0, padding: 3, width: 56, height: 34, backgroundColor: '#d3d8e3', borderRadius: 17 } as const;

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
  t12: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t14: {"color":"#0a0f1a","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v16: {"borderRadius":24},
  t17: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t18: {"color":"#ffffff","fontSize":42,"lineHeight":42,"letterSpacing":-1.3,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t19: {"color":"#ffffff","fontFamily":"Inter_700Bold"},
  t20: {"color":"#b9c0e6","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"borderRadius":24,"boxShadow":"rgba(20, 27, 77, 0.28) 0px 12px 32px 0px"},
  t22: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v23: {"flexShrink":1},
  t24: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v25: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t26: {"color":"#0a0f1a","fontSize":24,"lineHeight":36,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t27: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v28: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":2,"columnGap":2,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":80,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgba(15, 20, 50, 0.06) 0px 1px 2px 0px"},
  t29: {"color":"#ffcb5c","fontSize":24,"lineHeight":36,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t30: {"color":"#c9cfe8","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v31: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":2,"columnGap":2,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":80,"backgroundColor":"#141b4d","borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 6px 16px 0px"},
  v32: {"flexDirection":"row","alignItems":"stretch","rowGap":10,"columnGap":10,"marginRight":16,"marginLeft":16},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v34: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t35: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t36: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v37: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v39: {"flexShrink":1,"width":28,"height":28,"backgroundColor":"#ffffff","borderRadius":14,"boxShadow":"rgba(0, 0, 0, 0.2) 0px 1px 3px 0px"},
  v40: {"flexDirection":"row","justifyContent":"flex-end","alignItems":"center","flexShrink":0,"paddingTop":3,"paddingRight":3,"paddingBottom":3,"paddingLeft":3,"width":56,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  v41: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v42: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v43: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v44: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v45: {"borderRadius":18},
  t46: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v47: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v48: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v49: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
