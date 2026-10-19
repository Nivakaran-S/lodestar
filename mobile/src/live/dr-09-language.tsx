// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-09 Language · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { setSettings, useSettings, type AppLanguage } from '@/lib/settings';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L236":{"to":"dr-10-first-run-tips","kind":"go"},"B":{"to":"dr-08-permissions","kind":"back"}}};

export default function ScreenDr09Language() {
  const { language } = useSettings();
  const pick = (l: AppLanguage) => async () => {
    await setSettings({ language: l });
    return false;
  };
  const check = (l: AppLanguage) =>
    language === l ? (
      <View style={s.v18}>
        <Icon xml={X1} width={17} height={17} style={s.v1} />
      </View>
    ) : (
      <View style={s.v23} />
    );
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v40}>
        <View style={s.v6}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Set up"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v33}>
          <View style={s.v11}>
            <View style={s.v9}>
              <Text style={s.t7}>{"Step 2 of 3"}</Text>
              <View style={s.v8} />
              <Text style={s.t7}>{"optional"}</Text>
            </View>
            <View>
              <Text style={s.t10}>{"Choose your language"}</Text>
            </View>
          </View>
          <View style={s.v28}>
            <Tap style={language === 'en' ? s.v19 : s.v24} to={null} onPress={pick('en')} testID="lang-en">
              <View style={s.v13}>
                <Text style={s.t12}>{"A"}</Text>
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t14}>{"English"}</Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t15}>{language === 'en' ? "Current" : "English"}</Text>
                </View>
              </View>
              {check('en')}
            </Tap>
            <Tap style={language === 'si' ? s.v19 : s.v24} to={null} onPress={pick('si')} testID="lang-si">
              <View style={s.v13}>
                <Text style={s.t21}><Text style={s.t20}>{"අ"}</Text></Text>
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t22}><Text style={s.t20}>{"සිංහල"}</Text></Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t15}>{language === 'si' ? "Current" : "Sinhala"}</Text>
                </View>
              </View>
              {check('si')}
            </Tap>
            <Tap style={language === 'ta' ? s.v19 : s.v24} to={null} onPress={pick('ta')} testID="lang-ta">
              <View style={s.v13}>
                <Text style={s.t26}><Text style={s.t25}>{"அ"}</Text></Text>
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t27}><Text style={s.t25}>{"தமிழ்"}</Text></Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t15}>{language === 'ta' ? "Current" : "Tamil"}</Text>
                </View>
              </View>
              {check('ta')}
            </Tap>
          </View>
          <View style={s.v32}>
            <Icon xml={X2} width={16} height={16} style={s.v29} />
            <View style={s.v31}>
              <Text style={s.t30}>{"Store names, order numbers and times stay the same in every language."}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v39}>
          <Tap lk="L236" style={s.v36}>
            <Grad g={G0} style={s.v34} />
            <Text style={s.t35}>{"Continue"}</Text>
            <Icon xml={X3} width={22} height={22} style={s.v1} />
          </Tap>
          <Tap lk="L236" style={s.v38} testID="skip">
            <Text style={s.t37}>{"Skip for now"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"17\" height=\"17\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 16v-4M12 8h.01\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
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
  v8: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  v9: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t10: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t12: {"color":"#a9b4ff","fontSize":21,"lineHeight":31.5,"fontFamily":"Inter_700Bold"},
  v13: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t14: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t15: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v16: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":30,"height":30,"backgroundColor":"#f5b83d","borderRadius":15},
  v19: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"backgroundColor":"#161d3d"},
  t20: {"fontFamily":"NotoSansSinhala_700Bold"},
  t21: {"color":"#a9b4ff","fontSize":21,"lineHeight":31.5,"fontFamily":"NotoSansSinhala_700Bold"},
  t22: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"NotoSansSinhala_700Bold"},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":30,"height":30,"borderWidth":2,"borderColor":"#3b4666","borderRadius":15},
  v24: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  t25: {"fontFamily":"NotoSansTamil_700Bold"},
  t26: {"color":"#a9b4ff","fontSize":21,"lineHeight":31.5,"fontFamily":"NotoSansTamil_700Bold"},
  t27: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"NotoSansTamil_700Bold"},
  v28: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v29: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t30: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v31: {"flexShrink":1},
  v32: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":10,"paddingBottom":16},
  v34: {"borderRadius":18},
  t35: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t37: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v40: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
