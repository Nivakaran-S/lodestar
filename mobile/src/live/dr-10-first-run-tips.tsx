// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-10 First-run tips · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { markOnboardingSeen } from '@/lib/settings';
import { useClaims, useParam } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L237":{"to":"dr-11-load-handover-received","kind":"go"},"B":{"to":"dr-09-language","kind":"back"}}};

export default function ScreenDr10FirstRunTips() {
  const sub = useClaims()?.sub;
  // opened from Settings (DR-24 Help and safety tips): Got it goes back there instead of on to the load handover
  const fromSettings = useParam('from') === 'settings';
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v29}>
        <View style={s.v6}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Set up"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v24}>
          <View style={s.v10}>
            <View style={s.v8}>
              <Text style={s.t7}>{"Step 3 of 3"}</Text>
            </View>
            <View>
              <Text style={s.t9}>{"Use it only when you're stopped"}</Text>
            </View>
          </View>
          <View style={s.v20}>
            <View style={s.v16}>
              <View style={s.v11}>
                <Icon xml={X1} width={24} height={24} style={s.v1} />
              </View>
              <View style={s.v15}>
                <View>
                  <Text style={s.t12}>{"Stopped, not driving"}</Text>
                </View>
                <View style={s.v14}>
                  <Text style={s.t13}>{"While the van moves, you only see the next stop in big type. Buttons wait until you stop."}</Text>
                </View>
              </View>
            </View>
            <View style={s.v18}>
              <View style={s.v17}>
                <Icon xml={X2} width={24} height={24} style={s.v1} />
              </View>
              <View style={s.v15}>
                <View>
                  <Text style={s.t12}>{"Works without signal"}</Text>
                </View>
                <View style={s.v14}>
                  <Text style={s.t13}>{"Your run is saved on this phone. Records send by themselves when signal returns."}</Text>
                </View>
              </View>
            </View>
            <View style={s.v18}>
              <View style={s.v19}>
                <Icon xml={X3} width={24} height={24} style={s.v1} />
              </View>
              <View style={s.v15}>
                <View>
                  <Text style={s.t12}>{"Call, don't type"}</Text>
                </View>
                <View style={s.v14}>
                  <Text style={s.t13}>{"Dispatch sends notices to you. To talk, tap Call dispatch."}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v23}>
            <View style={s.v21} />
            <View style={s.v21} />
            <View style={s.v22} />
          </View>
        </Scroll>
        <View style={s.v28}>
          <Tap lk="L237" style={s.v27} to={fromSettings ? { to: 'dr-24-settings-me', kind: 'back' } : undefined} onPress={async () => { await markOnboardingSeen(sub); return true; }}>
            <Grad g={G0} style={s.v25} />
            <Text style={s.t26}>{"Got it"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 9v6M15 9v6\" fill=\"none\" stroke=\"#ffc266\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
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
  v11: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":52,"height":52,"backgroundColor":"#2e2208","borderRadius":16},
  t12: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t13: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v14: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v17: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":52,"height":52,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":16},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v19: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":52,"height":52,"backgroundColor":"#0d2a20","borderRadius":16},
  v20: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v21: {"flexShrink":1,"width":8,"height":8,"backgroundColor":"#1a2340","borderRadius":4},
  v22: {"flexShrink":1,"width":24,"height":8,"backgroundColor":"#f5b83d","borderRadius":4},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":10,"paddingBottom":16},
  v25: {"borderRadius":18},
  t26: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v29: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
