// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-06 Sign in · phone (P4, phone). As designed: the mobile number the depot has on file, typed on the drawn
// keypad; "Send code" (L229) asks the realm's direct-grant flow for a 6-digit SMS code and opens DR-07.
import { Text, View, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { groupLocal, phoneSignIn } from '@/auth/direct';
import { useAccessProblem, useDeviceId, useDirectSignIn } from '@/lodestar/live';
import { Keypad, typeKey } from '@/lodestar/keypad';
import { Grad, Icon, openScreen, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { DeskButton, DeskField, DeskFrame, DeskHead, DeskSmall, ICONS } from '@/lodestar/desk-auth';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L229":{"to":"dr-07-verify-code","kind":"go"}}};

export default function ScreenDr06SignIn() {
  const flow = useDirectSignIn('run');
  const problem = useAccessProblem();
  const device = useDeviceId();
  const saved = useStore(phoneSignIn);
  const [digits, setDigits] = useState(saved.face === 'run' ? saved.digits : '');
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (digits.replace(/^0/, '').length < 9) {
      setError('Enter your 9-digit mobile number, like 77 123 4567.');
      return false;
    }
    setError(null);
    const r = await flow.sendCode(digits);
    if (!r.ok && r.error === 'code_sent') return true;
    if (!r.ok) setError(r.description);
    return false;
  };

  // Desktop/tablet browser: the DSP-06 desk sign-in card (desk-auth.tsx), the number typed in a field.
  const desk = (
    <>
      <DeskHead app="run" title="Sign in with your phone" sub="Use the mobile number your depot has for you. We'll text you a 6-digit code." error={error} note={problem?.message} />
      <DeskField
        label="Mobile number" icon={ICONS.phone} prefix="+94" testID="phone-input" value={digits} placeholder="77 123 4567"
        keyboardType="phone-pad" maxLength={10} autoFocus onChangeText={v => setDigits(v.replace(/\D/g, '').slice(0, 10))}
        onSubmitEditing={() => void send().then(ok => ok && openScreen('dr-07-verify-code'))}
      />
      <DeskButton lk="L229" label={flow.busy ? 'Sending…' : 'Send code'} onPress={send} disabled={flow.busy} />
      <DeskSmall>{'The code comes by SMS, so a weak signal is fine.'}</DeskSmall>
      {device ? <DeskSmall testID="device-id">{`This phone: ${device}`}</DeskSmall> : null}
    </>
  );

  return (
    <DeskFrame app="run" bg="#070b16" nav={nav} style={s.v0} desk={desk}>
      <View style={s.v31}>
        <View style={s.v6}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Lodestar Run"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v21}>
          <View style={s.v9}>
            <View>
              <Text style={s.t7}>{"Sign in with your phone"}</Text>
            </View>
            <View>
              <Text style={s.t8}>{"Use the mobile number your depot has for you. We'll text you a 6-digit code."}</Text>
            </View>
          </View>
          <View style={s.v17}>
            <View style={s.v13}>
              <View style={s.v11}>
                <Text style={s.t10}>{"LK"}</Text>
              </View>
              <Text style={s.t12}>{"+94"}</Text>
            </View>
            <View style={s.v16}>
              {/* the caret sits after what is typed; in an empty field it sits at the start, before the placeholder */}
              {digits ? null : <View style={[s.v15, { marginLeft: 0, marginRight: 3 }]} testID="phone-caret" />}
              <Text style={[s.t14, digits ? null : { opacity: 0.45 }]} numberOfLines={1} testID="phone-value">{digits ? groupLocal(digits) : "77 123 4567"}</Text>
              {digits ? <View style={s.v15} testID="phone-caret" /> : null}
            </View>
          </View>
          <View style={s.v20}>
            <Icon xml={X1} width={16} height={16} style={s.v18} />
            <View style={s.v11}>
              <Text style={[s.t19, error ? { color: '#fda29b' } : null]} testID="sign-in-note">
                {error ?? problem?.message ?? "The code comes by SMS, so a weak signal is fine."}
              </Text>
            </View>
          </View>
          {device ? (
            <View style={s.v20}>
              <View style={s.v11}><Text style={s.t19} numberOfLines={1} testID="device-id">{`This phone: ${device}`}</Text></View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v25}>
          <Tap lk="L229" style={s.v24} onPress={send} disabled={flow.busy}>
            <Grad g={G0} style={s.v22} />
            <Text style={s.t23}>{flow.busy ? "Sending…" : "Send code"}</Text>
            <Icon xml={X2} width={22} height={22} style={s.v1} />
          </Tap>
        </View>
        <Keypad
          wrap={s.v30} row={s.v28} keyStyle={s.v27} blank={s.v29} text={s.t26}
          back={{ xml: X3, size: 26, style: s.v1 }}
          onKey={k => (k === 'enter' ? void send().then(ok => ok && openScreen('dr-07-verify-code')) : setDigits(d => typeKey(d, k, 10)))}
        />
      </View>
    </DeskFrame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"16\" height=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"26\" height=\"26\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m18 9-6 6M12 9l6 6\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t8: {"color":"#b5bdd1","fontSize":15,"lineHeight":21.8,"fontFamily":"Inter_400Regular"},
  v9: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t10: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v11: {"flexShrink":1},
  t12: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":64,"backgroundColor":"#121a2e","borderRadius":18},
  t14: {"color":"#f2f4fa","fontSize":22,"lineHeight":33,"letterSpacing":0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexShrink":1,"marginLeft":3,"width":2,"height":26,"backgroundColor":"#f5b83d"},
  v16: {"flexDirection":"row","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingRight":18,"paddingLeft":18,"height":64,"backgroundColor":"#121a2e","borderRadius":18,"boxShadow":"rgb(245, 184, 61) 0px 0px 0px 2px inset"},
  v17: {"flexDirection":"row","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"marginRight":16,"marginLeft":16},
  v18: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t19: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v20: {"flexDirection":"row","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":10,"paddingBottom":16},
  v22: {"borderRadius":18},
  t23: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  t26: {"color":"#f2f4fa","fontSize":24,"lineHeight":36,"fontFamily":"PlusJakartaSans_700Bold"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":56,"backgroundColor":"#1a2340","borderRadius":14},
  v28: {"flexDirection":"row","alignItems":"stretch","rowGap":8,"columnGap":8},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":56,"borderRadius":14},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":10,"paddingRight":12,"paddingBottom":4,"paddingLeft":12,"backgroundColor":"#0a0f1e","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v31: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
