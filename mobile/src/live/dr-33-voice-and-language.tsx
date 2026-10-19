// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-33 Voice and language · phone (P4, phone)
// The app language (screens and voice) and "Read aloud at stops" are this phone's settings (@/lib/settings).
// The voice row is the phone's own voice for that language (Speech.getAvailableVoicesAsync); "Play a test line"
// opens the stop read aloud (DR-35), which speaks the current stop in that voice. Screen text stays English.
import { Text, View, StyleSheet } from 'react-native';
import { setSettings, useSettings, LANGUAGE_NAMES, type AppLanguage } from '@/lib/settings';
import { useVoiceCheck } from '@/lodestar/voice';
import { Frame, Icon, Scroll, Tap, type ScreenNav } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L270":{"to":"dr-35-stop-arrival-speaking","kind":"go"},"L271":{"to":"dr-24-settings-me","kind":"go"}}};

export default function ScreenDr33VoiceAndLanguage() {
  const { language, readAloud } = useSettings();
  const voice = useVoiceCheck(language);
  const pick = (l: AppLanguage) => () => {
    void setSettings({ language: l });
    return false;
  };
  const seg = (l: AppLanguage) => (language === l ? s.v15 : s.v12);
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v42}>
        <View style={s.v6}>
          <Tap lk="L271" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Language and voice"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v38}>
          <View style={s.v19}>
            <View style={s.v10}>
              <View style={s.v8}>
                <Text style={s.t7}>{"Language"}</Text>
              </View>
              <View style={s.v8}>
                <Text style={s.t9}>{"screens and voice"}</Text>
              </View>
            </View>
            <View style={s.v18}>
              <Tap to={null} onPress={pick('en')} style={seg('en')} testID="lang-en">
                <Text style={[s.t11, language === 'en' && x.on]}>{"English"}</Text>
              </Tap>
              <Tap to={null} onPress={pick('si')} style={seg('si')} testID="lang-si">
                <Text style={[s.t14, language !== 'si' && x.off]}><Text style={s.t13}>{"සිංහල"}</Text></Text>
              </Tap>
              <Tap to={null} onPress={pick('ta')} style={seg('ta')} testID="lang-ta">
                <Text style={[s.t17, language === 'ta' && x.on]}><Text style={s.t16}>{"தமிழ்"}</Text></Text>
              </Tap>
            </View>
          </View>
          <View style={s.v31}>
            <Tap to={null} onPress={() => { void setSettings({ readAloud: !readAloud }); return false; }} style={s.v27} testID="read-aloud-toggle">
              <View style={s.v20}>
                <Icon xml={X1} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v24}>
                <View>
                  <Text style={s.t21}>{"Read aloud at stops"}</Text>
                </View>
                <View style={s.v23}>
                  <Text style={s.t22}>{readAloud ? "Speaks the stop, the dock and what comes off first" : "Off · stops are shown, not spoken"}</Text>
                </View>
              </View>
              <View style={[s.v26, !readAloud && x.toggleOff]} testID={readAloud ? 'read-aloud-on' : 'read-aloud-off'}>
                <View style={s.v25} />
              </View>
            </Tap>
            <View style={s.v30}>
              <View style={s.v28}>
                <Icon xml={X2} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v24}>
                <View>
                  <Text style={s.t21}>{"Only when stopped"}</Text>
                </View>
                <View style={s.v23}>
                  <Text style={s.t22}>{"Always on. While the van moves you hear a short chime, nothing more."}</Text>
                </View>
              </View>
              <View style={s.v29}>
                <View style={s.v25} />
              </View>
            </View>
          </View>
          <View style={s.v19}>
            <View style={s.v10}>
              <View style={s.v8}>
                <Text style={s.t7}>{"Speed"}</Text>
              </View>
              <View style={s.v8}>
                <Text style={s.t9}>{"normal suits most drivers"}</Text>
              </View>
            </View>
            <View style={s.v18}>
              <View style={s.v12}>
                <Text style={s.t11}>{"Slower"}</Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t32}>{"Normal"}</Text>
              </View>
              <View style={s.v12}>
                <Text style={s.t11}>{"Faster"}</Text>
              </View>
            </View>
          </View>
          <View style={s.v31}>
            <View style={s.v27}>
              <View style={voice.available ? s.v33 : s.v28}>
                <Icon xml={X3} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v24}>
                <View>
                  <Text style={s.t34} testID="voice-pack"><Text><Text style={x[language]}>{LANGUAGE_NAMES[language]}</Text></Text>{voice.checking ? ' voice · checking this phone…' : voice.available ? ' voice on this phone · works offline' : ' voice not on this phone · text still works'}</Text>
                </View>
                <View style={s.v23}>
                  <Text style={s.t22}>{voice.checking ? '—' : voice.available ? `${voice.voiceName ?? 'Phone voice'} · ${voice.count} voices on this phone` : `${voice.count} voices on this phone, none for this language`}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v37}>
            <View style={s.v8}>
              <Text style={s.t36}>{"Voices come with the phone and speak with no signal. Without one, every stop still shows as text."}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v41}>
          <Tap lk="L270" style={s.v40}>
            <Icon xml={X4} width={22} height={22} style={s.v1} />
            <Text style={s.t39}>{"Play a test line"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  on: { color: '#ffffff' },
  off: { color: '#b5bdd1' },
  toggleOff: { justifyContent: 'flex-start', backgroundColor: '#2c3760' },
  en: { fontFamily: 'Inter_700Bold' },
  si: { fontFamily: 'NotoSansSinhala_700Bold' },
  ta: { fontFamily: 'NotoSansTamil_700Bold' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11 5 6 9H2v6h4l5 4V5Z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11 5 6 9H2v6h4l5 4V5Z\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14\" fill=\"none\" stroke=\"#ffcb5c\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v8: {"flexShrink":1},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v10: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t11: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":48,"borderRadius":10},
  t13: {"fontFamily":"NotoSansSinhala_700Bold"},
  t14: {"color":"#ffffff","fontSize":15,"lineHeight":22.5,"fontFamily":"NotoSansSinhala_700Bold"},
  v15: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":48,"backgroundColor":"#2c3760","borderRadius":10},
  t16: {"fontFamily":"NotoSansTamil_700Bold"},
  t17: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"NotoSansTamil_700Bold"},
  v18: {"flexDirection":"row","alignItems":"stretch","rowGap":4,"columnGap":4,"paddingTop":4,"paddingRight":4,"marginRight":16,"paddingBottom":4,"paddingLeft":4,"marginLeft":16,"backgroundColor":"#1a2340","borderRadius":14},
  v19: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v20: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#161d3d","borderRadius":14},
  t21: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t22: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v23: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v25: {"flexShrink":1,"width":26,"height":26,"backgroundColor":"#111522","borderRadius":13},
  v26: {"flexDirection":"row","justifyContent":"flex-end","alignItems":"center","flexShrink":0,"paddingTop":3,"paddingRight":3,"paddingBottom":3,"paddingLeft":3,"width":52,"height":32,"backgroundColor":"#f5b83d","borderRadius":16},
  v27: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v28: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#1a2340","borderRadius":14},
  v29: {"flexDirection":"row","justifyContent":"flex-end","alignItems":"center","flexShrink":0,"paddingTop":3,"paddingRight":3,"paddingBottom":3,"paddingLeft":3,"width":52,"height":32,"backgroundColor":"#f5b83d","borderRadius":16,"opacity":0.5},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v31: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t32: {"color":"#ffffff","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#0d2a20","borderRadius":14},
  t34: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t35: {"fontFamily":"NotoSansTamil_600SemiBold"},
  t36: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"NotoSansTamil_600SemiBold"},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":0},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":10,"paddingBottom":16},
  t39: {"color":"#f2f4fa","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v40: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"backgroundColor":"#1a2340","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v42: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
