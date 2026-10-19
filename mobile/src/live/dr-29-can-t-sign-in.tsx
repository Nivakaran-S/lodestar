// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-29 Can't sign in · phone (P4, phone)
// Live: when the code was sent and to which number, a new code (L232, 30 s cooldown) or a voice call reading it out
// (L233), both back to DR-07; asking dispatch (dialer); the session problem (expired, revoked, …) when there is one.
import { Text, View, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { fullNumber, phoneSignIn } from '@/auth/direct';
import { useCountdown } from '@/auth/countdown';
import { hm } from '@/lib/time';
import { plural, useAccessProblem, useDeviceId, useDirectSignIn } from '@/lodestar/live';
import { useOutbox } from '@/model/hooks';
import { openDialer } from '@/model/run';
import { Grad, Icon, openScreen, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { DeskFrame } from '@/lodestar/desk-auth';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L232":{"to":"dr-07-verify-code","kind":"go"},"L233":{"to":"dr-07-verify-code","kind":"go"},"L234":{"to":"dr-07-verify-code","kind":"go"}}};

const TITLES = { expired: 'Your session ended', revoked: 'This phone was removed', unregistered: 'This phone is not registered', denied: 'No Lodestar Run access', failed: "Sign-in didn't finish" } as const;

export default function ScreenDr29CanTSignIn() {
  const flow = useDirectSignIn('run');
  const p = useStore(phoneSignIn);
  const left = useCountdown(p.resendAt);
  const [error, setError] = useState<string | null>(null);
  // Resend (L232) and voice call (L233) go back to DR-07 with a new code; without a number typed yet, to DR-06.
  const again = (channel?: 'voice') => async () => {
    if (!p.digits) {
      openScreen('dr-06-sign-in', undefined, 'nav');
      return false;
    }
    if (left > 0) {
      setError(`You can ask for a new code in ${left} s.`);
      return false;
    }
    setError(null);
    const r = await flow.sendCode(p.digits, channel);
    if (!r.ok && r.error === 'code_sent') return true;
    if (!r.ok) setError(r.description);
    return false;
  };
  const problem = useAccessProblem();
  const device = useDeviceId();
  const { waiting } = useOutbox();
  return (
    <DeskFrame app="run" bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v33}>
        <View style={s.v6}>
          <Tap lk="L234" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Sign-in help"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v26}>
          <View style={s.v11}>
            <View style={s.v8}>
              <Text style={s.t7} numberOfLines={1} testID="device-id">{p.sentAt && p.digits ? `Code sent ${hm(new Date(p.sentAt).toISOString())} to ${fullNumber(p.digits)}` : `This phone · ${device ?? '…'}`}</Text>
            </View>
            <View>
              <Text style={s.t9} testID="problem-title">{problem ? TITLES[problem.kind] : "Didn't get a code?"}</Text>
            </View>
            <View>
              <Text style={s.t10} testID="problem-message">{error ?? (problem ? `${problem.message}${problem.at ? ` (${hm(problem.at)})` : ''}` : left > 0 ? `A new code can be sent in ${left} s. If SMS keeps failing, try one of these.` : 'A new code is ready to send now. If SMS keeps failing, try one of these.')}</Text>
            </View>
          </View>
          <View style={s.v20}>
            <Tap lk="L233" style={s.v17} testID="help-sign-in" onPress={again('voice')} disabled={flow.busy}>
              <View style={s.v12}>
                <Icon xml={X1} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v16}>
                <View>
                  <Text style={s.t13}>{"Get the code by voice call"}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t14}>{"An automatic call reads out the 6 digits."}</Text>
                </View>
              </View>
              <Icon xml={X2} width={18} height={18} style={s.v1} />
            </Tap>
            <Tap style={s.v19} to={null} onPress={() => openDialer()} testID="call-dispatch">
              <View style={s.v18}>
                <Icon xml={X3} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v16}>
                <View>
                  <Text style={s.t13}>{"Ask dispatch to verify you"}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t14}>{"Call your depot's dispatch with this phone's ID. They confirm it's you and unlock sign-in."}</Text>
                </View>
              </View>
              <Icon xml={X2} width={18} height={18} style={s.v1} />
            </Tap>
          </View>
          <View style={s.v25}>
            <Icon xml={X4} width={20} height={20} style={s.v21} />
            <View style={s.v24}>
              <View>
                <Text style={s.t22}>{"Run already saved on this phone?"}</Text>
              </View>
              <View>
                <Text style={s.t23}>{waiting.length ? `Keep delivering. ${plural(waiting.length, 'record')} wait on this phone until you sign in.` : 'Keep delivering. You only need to sign in to send records.'}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v32}>
          <Tap lk="L232" style={s.v29} onPress={again()} disabled={flow.busy}>
            <Grad g={G0} style={s.v27} />
            <Icon xml={X5} width={22} height={22} style={s.v1} />
            <Text style={s.t28}>{flow.busy ? 'Sending…' : p.digits ? 'Resend code' : 'Sign in again'}</Text>
          </Tap>
          <View style={s.v31}>
            <Text style={s.t30}>{"Codes can take up to 2 minutes on a weak signal."}</Text>
          </View>
        </View>
      </View>
    </DeskFrame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 12 2 2 4-4\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 12a9 9 0 1 1-3-6.7L21 8\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M21 3v5h-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
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
  t10: {"color":"#b5bdd1","fontSize":15,"lineHeight":21.8,"fontFamily":"Inter_400Regular"},
  v11: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#1a2340","borderRadius":14},
  t13: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t14: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v15: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v17: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#0d2a20","borderRadius":14},
  v19: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v20: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v21: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t22: {"color":"#d6cfc7","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t23: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v25: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":10,"paddingBottom":16},
  v27: {"borderRadius":18},
  t28: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t30: {"color":"#7f89a3","fontSize":13,"lineHeight":18.2,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":6,"columnGap":6},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v33: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
