// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-08 Permissions · phone (P4, phone)
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { notificationPermission, requestNotifications, type NotifyPermission } from '@/lib/notify-permission';
import { useCamera } from '@/lodestar/camera';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L235":{"to":"dr-09-language","kind":"go"},"B":{"to":"dr-07-verify-code","kind":"back"}}};

export default function ScreenDr08Permissions() {
  const cam = useCamera();
  const [notify, setNotify] = useState<NotifyPermission | null>(null);
  useEffect(() => {
    let live = true;
    void notificationPermission().then(p => { if (live) setNotify(p); });
    return () => { live = false; };
  }, []);
  const allowCamera = async () => {
    if (!(await cam.ensure())) showToast('Camera not allowed. Photos stay optional; you can type everything.', 'error');
    return false;
  };
  const allowNotify = async () => {
    const r = await requestNotifications();
    setNotify(r);
    if (r === 'denied') showToast('Notifications are blocked. Allow them in the phone settings to get plan changes with the app closed.', 'error');
    else if (r === 'unsupported') showToast("This device can't show notifications. Notices still appear in the app.");
    return false;
  };
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v33}>
        <View style={s.v6}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Set up"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v28}>
          <View style={s.v10}>
            <View style={s.v8}>
              <Text style={s.t7}>{"Step 1 of 3"}</Text>
            </View>
            <View>
              <Text style={s.t9}>{"What the app asks for"}</Text>
            </View>
          </View>
          <View style={s.v22}>
            <View style={s.v18}>
              <View style={s.v11}>
                <Icon xml={X1} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v15}>
                <View>
                  <Text style={s.t12}>{"Location"}</Text>
                </View>
                <View style={s.v14}>
                  <Text style={s.t13}>{"Not used by this build: arrival time is saved at each stop, even with no signal, but no place."}</Text>
                </View>
              </View>
              <View style={[s.v17, s.off]} testID="location-off">
                <Text style={[s.t16, s.offText]} numberOfLines={1}>{"Not used"}</Text>
              </View>
            </View>
            <View style={s.v19}>
              <View style={s.v11}>
                <Icon xml={X3} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v15}>
                <View>
                  <Text style={s.t12}>{"Camera"}</Text>
                </View>
                <View style={s.v14}>
                  <Text style={s.t13}>{"Photos of damaged goods and proof of delivery."}</Text>
                </View>
              </View>
              {cam.granted ? (
                <View style={s.v17} testID="camera-on">
                  <Icon xml={X2} width={14} height={14} style={s.v1} />
                  <Text style={s.t16} numberOfLines={1}>{"On"}</Text>
                </View>
              ) : (
                <Tap style={s.v21} to={null} onPress={allowCamera} testID="allow-camera">
                  <Text style={s.t20}>{"Allow"}</Text>
                </Tap>
              )}
            </View>
            <View style={s.v19}>
              <View style={s.v11}>
                <Icon xml={X4} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v15}>
                <View>
                  <Text style={s.t12}>{"Notifications"}</Text>
                </View>
                <View style={s.v14}>
                  <Text style={s.t13}>{"Plan changes from dispatch, even with the app closed."}</Text>
                </View>
              </View>
              {notify === 'granted' ? (
                <View style={s.v17} testID="notify-on">
                  <Icon xml={X2} width={14} height={14} style={s.v1} />
                  <Text style={s.t16} numberOfLines={1}>{"On"}</Text>
                </View>
              ) : (
                <Tap style={s.v21} to={null} onPress={allowNotify} testID="allow-notify">
                  <Text style={s.t20}>{notify === 'denied' ? 'Blocked' : 'Allow'}</Text>
                </Tap>
              )}
            </View>
          </View>
          <View style={s.v27}>
            <Icon xml={X5} width={20} height={20} style={s.v23} />
            <View style={s.v26}>
              <View>
                <Text style={s.t24}>{"No location tracking"}</Text>
              </View>
              <View>
                <Text style={s.t25}>{"This build never reads your location, on or off shift."}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v32}>
          <Tap lk="L235" style={s.v31}>
            <Grad g={G0} style={s.v29} />
            <Text style={s.t30}>{"Continue"}</Text>
            <Icon xml={X6} width={22} height={22} style={s.v1} />
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 12 2 2 4-4\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  off: { backgroundColor: '#1a2340' },
  offText: { color: '#b5bdd1' },
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t9: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v11: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t12: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t13: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v14: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t16: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v19: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  t20: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v21: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"paddingRight":20,"paddingLeft":20,"height":56,"backgroundColor":"#1a2340","borderRadius":16},
  v22: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v23: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t24: {"color":"#6cc4f5","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t25: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v27: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#0b2233","borderRadius":18},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":10,"paddingBottom":16},
  v29: {"borderRadius":18},
  t30: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v33: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
