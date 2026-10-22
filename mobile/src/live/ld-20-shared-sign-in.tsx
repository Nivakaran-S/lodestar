// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-20 Shared sign in · tablet (P3, tablet)
import { Text, View, StyleSheet } from 'react-native';
import { useAccessProblem, useDeviceId, useSignIn } from '@/lodestar/live';
import { today } from '@/model/hooks';
import { dayLabel, hm } from '@/lib/time';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L221":{"to":"ld-21-bay-overview","kind":"go"}}};

export default function ScreenLd20SharedSignIn() {
  const { signIn, ready, busy } = useSignIn('dock');
  const problem = useAccessProblem();
  const device = useDeviceId();
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v53}>
        <Scroll style={s.v51} contentStyle={s.v52}>
          <View style={s.v19}>
            <Grad g={G0} />
            <View style={s.v10}>
              <Icon xml={X2} width={44} height={44} style={s.v6} />
              <View style={s.v9}>
                <View>
                  <Text style={s.t7}>{"Lodestar Dock"}</Text>
                </View>
                <View>
                  <Text style={s.t8}>{"Shared terminal"}</Text>
                </View>
              </View>
            </View>
            <View style={s.v11} />
            <View>
              <Text style={s.t12}>{hm(new Date().toISOString())}</Text>
            </View>
            <View>
              <Text style={s.t13}>{dayLabel(today())}</Text>
            </View>
            <View style={s.v11} />
            <View style={s.v18}>
              <Icon xml={X4} width={18} height={18} style={s.v3} />
              <Text style={s.t17}>{problem?.message ?? "Shared terminal. Sign out when you leave the bay."}</Text>
            </View>
          </View>
          <View style={s.v50}>
            <View style={s.v23}>
              <View style={s.v21}>
                <Text style={s.t20}>{"Each loader signs in with their own account"}</Text>
              </View>
              <View>
                <Text style={s.t22}>{"Who's loading?"}</Text>
              </View>
            </View>
            <View style={s.v49}>
              <View style={s.v48}>
                <View style={s.v38}>
                  <View style={s.v2}>
                    <Text style={s.t35}>{"This terminal "}<Text style={s.t34} testID="device-id">{device ?? "…"}</Text></Text>
                  </View>
                </View>
                <Tap lk="L221" style={s.v47} onPress={signIn} disabled={!ready || busy}>
                  <Grad g={G1} style={s.v45} />
                  <Text style={s.t46}>{busy ? "Signing in…" : "Sign in"}</Text>
                  <Icon xml={X6} width={22} height={22} style={s.v3} />
                </Tap>
              </View>
            </View>
          </View>
        </Scroll>
      </View>
    </Frame>
  );
}

const X2 = "<svg viewBox=\"0 0 32 32\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"44\" height=\"44\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b9c0e6\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"9\" cy=\"8\" r=\"4\" fill=\"none\" stroke=\"#b9c0e6\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M1 21a8 8 0 0 1 16 0M16 4a4 4 0 0 1 0 8M23 21a8 8 0 0 0-5-7.4\" fill=\"none\" stroke=\"#b9c0e6\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":170,"at":null,"repeat":false,"stops":[{"c":"#26318a","p":0},{"c":"#141b4d","p":0.55},{"c":"#0a0f2e","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  t1: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontVariant":["tabular-nums"],"fontFamily":"JetBrainsMono_600SemiBold"},
  v2: {"flexShrink":1},
  v3: {"flexShrink":0,"overflow":"hidden"},
  v4: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1},
  v5: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":28},
  v6: {"flexShrink":1,"overflow":"hidden"},
  t7: {"color":"#ffffff","fontSize":22,"lineHeight":33,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t8: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12},
  v11: {"flexGrow":1,"flexBasis":"0%"},
  t12: {"color":"#ffffff","fontSize":88,"lineHeight":88,"letterSpacing":-3.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t13: {"color":"#b9c0e6","fontSize":16,"lineHeight":24,"fontFamily":"Inter_600SemiBold"},
  t14: {"color":"#ffcb5c","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  t15: {"color":"#ffcb5c","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"marginTop":8},
  t17: {"color":"#b9c0e6","fontSize":13,"lineHeight":18.9,"fontFamily":"Inter_400Regular"},
  v18: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8},
  v19: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":28,"paddingRight":28,"paddingBottom":28,"paddingLeft":28,"width":320},
  t20: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v21: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t22: {"color":"#0a0f1a","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v23: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6},
  t24: {"color":"#1a1300","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_800ExtraBold"},
  v25: {"flexDirection":"row","justifyContent":"center","alignItems":"center","marginBottom":4,"width":44,"height":44,"backgroundColor":"#f5b83d","borderRadius":22},
  t26: {"color":"#ffffff","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  t27: {"color":"#c9cfe8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v28: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":4,"columnGap":4,"flexShrink":1,"width":154,"height":118,"backgroundColor":"#141b4d","borderRadius":20,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  t29: {"color":"#141b4d","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_800ExtraBold"},
  v30: {"flexDirection":"row","justifyContent":"center","alignItems":"center","marginBottom":4,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":22},
  t31: {"color":"#0a0f1a","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  v32: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":4,"columnGap":4,"flexShrink":1,"width":154,"height":118,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.06) 0px 1px 2px 0px"},
  v33: {"flexDirection":"row","flexWrap":"wrap","alignItems":"stretch","rowGap":12,"columnGap":12,"flexShrink":0,"width":320},
  t34: {"color":"#0a0f1a","fontFamily":"Inter_800ExtraBold"},
  t35: {"color":"#344054","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_600SemiBold"},
  v36: {"flexShrink":1,"width":16,"height":16,"backgroundColor":"#141b4d","borderRadius":8,"boxShadow":"rgb(20, 27, 77) 0px 0px 0px 2px inset"},
  v37: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"flexShrink":1,"paddingTop":4},
  v38: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","height":32},
  t39: {"color":"#0a0f1a","fontSize":26,"lineHeight":39,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v40: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":76,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgba(15, 20, 50, 0.08) 0px 1px 2px 0px"},
  v41: {"flexDirection":"row","alignItems":"stretch","rowGap":10,"columnGap":10},
  t42: {"color":"#344054","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  v43: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":76,"borderRadius":16},
  v44: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10},
  v45: {"borderRadius":18},
  t46: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v47: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v48: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v49: {"flexDirection":"row","alignItems":"stretch","rowGap":28,"columnGap":28},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":22,"columnGap":22,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":28,"paddingRight":32,"paddingBottom":28,"paddingLeft":32},
  v51: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v52: {"flexDirection":"row","alignItems":"stretch"},
  v53: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
