// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-34 Voice pack downloading · phone (P4, phone)
// The app downloads no voice: read-aloud uses the phone's own voices (expo-speech). This screen checks the phone
// for a voice in the app language: checking → ready (voice name) or none, with the designed fallback "text still
// works". The design's progress bar maps to checking → done. "Skip voice for today" turns read aloud off.
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel } from '@/lib/time';
import { setSettings, useSettings, LANGUAGE_NAMES, type AppLanguage } from '@/lib/settings';
import { today } from '@/model/hooks';
import { useVoiceCheck } from '@/lodestar/voice';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L279":{"to":"dr-13-saving-run-for-offline","kind":"go"},"L280":{"to":"dr-13-saving-run-for-offline","kind":"go"}}};

const ENGLISH_NAME: Record<AppLanguage, string> = { en: 'English', si: 'Sinhala', ta: 'Tamil' };

export default function ScreenDr34VoicePackDownloading() {
  const { language } = useSettings();
  const voice = useVoiceCheck(language);
  const state = voice.checking ? 'checking' : voice.available ? 'ready' : 'none';
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v45}>
        <View style={s.v6}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{dayLabel(today()) || '—'}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v38}>
          <View style={s.v19}>
            <View>
              <Text style={s.t8}>{state === 'checking' ? 'Checking for the ' : state === 'ready' ? 'The ' : 'No '}<Text><Text style={x[language]}>{LANGUAGE_NAMES[language]}</Text></Text>{state === 'ready' ? ' voice is ready for read-aloud' : ' voice for read-aloud'}</Text>
            </View>
            <View style={s.v14}>
              <View style={s.v11}>
                <Text style={s.t10} testID="voice-state">{state === 'checking' ? 'Checking' : state === 'ready' ? 'Ready' : 'None'}<Text style={s.t9}>{""}</Text></Text>
              </View>
              <View style={s.v13}>
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={s.t12} numberOfLines={1}>{"This phone"}</Text>
              </View>
            </View>
            <View style={s.v17}>
              <View style={[s.v16, { width: state === 'checking' ? '30%' : '100%' }]}>
                <Grad g={G0} style={s.v15} />
              </View>
            </View>
            <View>
              <Text style={s.t18} testID="voice-name">{state === 'checking' ? 'Looking for a voice on this phone…' : state === 'ready' ? `${voice.voiceName ?? 'Phone voice'} · comes with the phone · works offline` : `${voice.count} voices on this phone, none for ${ENGLISH_NAME[language]}`}</Text>
            </View>
          </View>
          <View style={s.v27}>
            <View style={s.v25}>
              <View style={s.v20}>
                <Icon xml={X2} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v24}>
                <View>
                  <Text style={s.t21}>{"Speaks from this phone"}</Text>
                </View>
                <View style={s.v23}>
                  <Text style={s.t22}>{"No signal needed anywhere on the run"}</Text>
                </View>
              </View>
            </View>
            <View style={s.v26}>
              <View style={s.v20}>
                <Icon xml={X3} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v24}>
                <View>
                  <Text style={s.t21}>{"Only when the van is stopped"}</Text>
                </View>
                <View style={s.v23}>
                  <Text style={s.t22}>{"A short chime while moving"}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v31}>
            <Icon xml={X4} width={20} height={20} style={s.v28} />
            <View style={s.v30}>
              <View>
                <Text style={s.t29}>{"Your run works without it; text is always shown"}</Text>
              </View>
              <View>
                <Text style={s.t18}>{"Every stop, window and note shows on screen with or without a voice."}</Text>
              </View>
            </View>
          </View>
          <View style={s.v37}>
            <View style={s.v33}>
              <View style={s.v11}>
                <Text style={s.t32}>{state === 'ready' ? 'Stops are spoken and shown' : 'Until it is ready, stops show'}</Text>
              </View>
            </View>
            <View style={s.v36}>
              <View style={s.v35}>
                <Icon xml={X5} width={20} height={20} style={s.v1} />
                <Text style={s.t34} numberOfLines={1}>{state === 'ready' ? 'Voice ready, text is shown too' : 'Voice not downloaded, text still works'}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v44}>
          <Tap lk="L279" style={s.v41}>
            <Grad g={G1} style={s.v39} />
            <Text style={s.t40}>{"Continue"}</Text>
            <Icon xml={X6} width={22} height={22} style={s.v1} />
          </Tap>
          <Tap lk="L280" style={s.v43} onPress={() => setSettings({ readAloud: false })}>
            <Text style={s.t42}>{"Skip voice for today"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  en: { fontFamily: 'Inter_700Bold' },
  si: { fontFamily: 'NotoSansSinhala_700Bold' },
  ta: { fontFamily: 'NotoSansTamil_700Bold' },
});

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11 5 6 9H2v6h4l5 4V5Z\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"fontFamily":"NotoSansSinhala_600SemiBold"},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"NotoSansSinhala_600SemiBold"},
  t9: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t10: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v11: {"flexShrink":1},
  t12: {"color":"#6cc4f5","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0b2233","borderRadius":14},
  v14: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v15: {"borderRadius":4},
  v16: {"flexShrink":1,"width":"64%","borderRadius":4},
  v17: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#1a2340","borderRadius":4,"overflow":"hidden"},
  t18: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v19: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  v20: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t21: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t22: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v23: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v25: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v26: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v27: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v28: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t29: {"color":"#5ee0a8","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v31: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#0d2a20","borderRadius":18},
  t32: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v33: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t34: {"color":"#b5bdd1","fontSize":14,"lineHeight":14,"fontFamily":"Inter_700Bold"},
  v35: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":16,"paddingLeft":14,"height":48,"borderWidth":1,"borderColor":"#3b4666","borderStyle":"dashed","borderRadius":24},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"stretch","paddingRight":16,"paddingLeft":16},
  v37: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":10,"paddingBottom":16},
  v39: {"borderRadius":18},
  t40: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t42: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v43: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v44: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v45: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
