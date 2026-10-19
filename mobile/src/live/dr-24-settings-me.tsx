// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-24 Settings · me · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { LANGUAGE_NAMES, setSettings, useSettings, type ScreenTheme } from '@/lib/settings';
import { hm } from '@/lib/time';
import { appVersion } from '@/lib/version';
import { plural, signOutTo, titleCase, useDeviceId } from '@/lodestar/live';
import { useClaims, useOutbox, useRun } from '@/model/hooks';
import { Frame, Icon, Scroll, Tap, type ScreenNav } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L35":{"to":"dr-01-today-s-run-daylight","kind":"go"},"L37":{"to":"dr-31-update-required","kind":"go"},"L268":{"to":"dr-33-voice-and-language","kind":"go"},"L269":{"to":"dr-06-sign-in","kind":"go"},"B":{"to":"dr-01-today-s-run","kind":"back"}}};

export default function ScreenDr24SettingsMe() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const device = useDeviceId();
  const { view, updatedAt } = useRun();
  const { waiting } = useOutbox();
  const settings = useSettings();
  // the segment saves the setting; only Day follows the designed link to the daylight run
  const pick = (theme: ScreenTheme) => async () => {
    await setSettings({ theme });
    return theme === 'day';
  };
  const seg = (theme: ScreenTheme) => settings.theme === theme;
  const name = claims?.name ?? claims?.username ?? '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '—';
  const trip = view?.trip ?? null;
  const vehicle = trip?.vehicle;
  const vehicleId = claims?.vehicleId ?? trip?.vehicleId;
  const depot = trip?.depot ?? claims?.depots[0];
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v38}>
        <View style={s.v6}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Settings"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v37}>
          <View style={s.v13}>
            <View style={s.v8}>
              <Text style={s.t7}>{initials}</Text>
            </View>
            <View style={s.v12}>
              <View>
                <Text style={s.t9} testID="me-name">{name || 'Not signed in'}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t10}>{claims ? ['Driver', depot ? `${depotName(depot)}` : ''].filter(Boolean).join(' · ') : 'Sign in to see your details'}</Text>
              </View>
            </View>
          </View>
          <View style={s.v23}>
            <View style={s.v17}>
              <View style={s.v15}>
                <Text style={s.t14}>{"Night or day screen"}</Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t16}>{"auto follows sunrise"}</Text>
              </View>
            </View>
            <View style={s.v22}>
              <Tap lk="L35" style={seg('auto') ? s.v19 : s.v21} onPress={pick('auto')} testID="theme-auto">
                <Text style={seg('auto') ? s.t18 : s.t20}>{"Auto"}</Text>
              </Tap>
              <Tap lk="L35" style={seg('night') ? s.v19 : s.v21} onPress={pick('night')} testID="theme-night">
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={seg('night') ? s.t18 : s.t20}>{"Night"}</Text>
              </Tap>
              <Tap lk="L35" style={seg('day') ? s.v19 : s.v21} onPress={pick('day')} testID="lk-L35">
                <Icon xml={X2} width={14} height={14} style={s.v1} />
                <Text style={seg('day') ? s.t18 : s.t20}>{"Day"}</Text>
              </Tap>
            </View>
          </View>
          <View style={s.v32}>
            <Tap lk="L268" style={s.v28}>
              <View style={s.v24}>
                <Icon xml={X3} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v12}>
                <View>
                  <Text style={s.t25}>{"Language and voice"}</Text>
                </View>
                <View style={s.v11}>
                  <Text style={s.t10}>{`Read aloud at stops · ${settings.readAloud ? 'on' : 'off'}`}</Text>
                </View>
              </View>
              <View style={s.v15}>
                <Text style={s.t27} numberOfLines={1}><Text style={s.t26} testID="me-language">{LANGUAGE_NAMES[settings.language]}</Text></Text>
              </View>
              <Icon xml={X4} width={18} height={18} style={s.v1} />
            </Tap>
            <View style={s.v31}>
              <View style={s.v24}>
                <Icon xml={X5} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v12}>
                <View>
                  <Text style={s.t25}>{"Vehicle today"}</Text>
                </View>
                <View style={s.v11}>
                  <Text style={s.t10}>{vehicle ? `${vehicle.tempClass === 'CHILLED' ? 'Reefer ' : ''}${titleCase(vehicle.type).toLowerCase()} · ${vehicle.capacityKg.toLocaleString('en-US')} kg · ${vehicle.capacityM3.toFixed(1)} m³` : vehicleId ? 'Details load with your run' : 'No vehicle assigned'}</Text>
                </View>
              </View>
              <View style={s.v15}>
                <Text style={s.t30} numberOfLines={1}><Text style={s.t29} testID="me-vehicle">{vehicleId ?? '—'}</Text></Text>
              </View>
            </View>
            <View style={s.v31}>
              <View style={s.v24}>
                <Icon xml={X6} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v12}>
                <View>
                  <Text style={s.t25}>{"Saved on this phone"}</Text>
                </View>
                <View style={s.v11}>
                  <Text style={s.t10}>{updatedAt ? `Today's run · saved ${hm(new Date(updatedAt).toISOString())}` : 'Run not saved yet'}</Text>
                </View>
              </View>
              <View style={s.v15}>
                <Text style={s.t30} numberOfLines={1}>{waiting.length ? `${plural(waiting.length, 'record')} to send` : 'all sent'}</Text>
              </View>
            </View>
            <Tap style={s.v31} to={{ to: 'dr-10-first-run-tips', params: { from: 'settings' } }} testID="help-tips">
              <View style={s.v24}>
                <Icon xml={X7} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v12}>
                <View>
                  <Text style={s.t25}>{"Help and safety tips"}</Text>
                </View>
              </View>
              <Icon xml={X4} width={18} height={18} style={s.v1} />
            </Tap>
            <View style={s.v31}>
              <View style={s.v24}>
                <Icon xml={X6} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v12}>
                <View>
                  <Text style={s.t25}>{"This phone"}</Text>
                </View>
                <View style={s.v11}>
                  <Text style={s.t10} numberOfLines={1} testID="device-id">{device ?? '…'}</Text>
                </View>
              </View>
            </View>
          </View>
          <Tap lk="L269" style={s.v32} onPress={() => signOutTo('dr-06-sign-in')}>
            <View style={s.v28}>
              <View style={s.v33}>
                <Icon xml={X8} width={19} height={19} style={s.v1} />
              </View>
              <View style={s.v12}>
                <View>
                  <Text style={s.t34}>{"Sign out"}</Text>
                </View>
                <View style={s.v11}>
                  <Text style={s.t10}>{waiting.length ? `${plural(waiting.length, 'unsent record')} stay on the phone` : 'Unsent records stay on the phone'}</Text>
                </View>
              </View>
            </View>
          </Tap>
          <Tap lk="L37" style={s.v36}>
            <Text style={s.t35} testID="app-version">{`Lodestar Run ${appVersion()} · works offline`}</Text>
          </Tap>
        </Scroll>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 17V7a2 2 0 0 1 2-2h10l4 5h1a2 2 0 0 1 2 2v5h-2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 17h6\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"7\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"17\" cy=\"17\" r=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M15 5v5h4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ff8a7a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\" fill=\"none\" stroke=\"#ff8a7a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#1a1300","fontSize":22,"lineHeight":33,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v8: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":60,"height":60,"backgroundColor":"#f5b83d","borderRadius":20},
  t9: {"color":"#f2f4fa","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t10: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v11: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v12: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t14: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexShrink":1},
  t16: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t18: {"color":"#ffffff","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v19: {"flexDirection":"row","columnGap":6,"justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":48,"backgroundColor":"#2c3760","borderRadius":10},
  t20: {"color":"#b5bdd1","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v21: {"flexDirection":"row","columnGap":6,"justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":48,"borderRadius":10},
  v22: {"flexDirection":"row","alignItems":"stretch","rowGap":4,"columnGap":4,"paddingTop":4,"paddingRight":4,"marginRight":16,"paddingBottom":4,"paddingLeft":4,"marginLeft":16,"backgroundColor":"#1a2340","borderRadius":14},
  v23: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t25: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t26: {"fontFamily":"NotoSansSinhala_600SemiBold"},
  t27: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"NotoSansSinhala_600SemiBold"},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  t29: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t30: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_600SemiBold"},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#321210","borderRadius":12},
  t34: {"color":"#ff8a7a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t35: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":0},
  v37: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":10,"paddingBottom":16},
  v38: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
