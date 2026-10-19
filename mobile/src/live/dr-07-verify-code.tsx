// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-07 Verify code · phone (P4, phone). The 6-digit code for the number typed on DR-06, typed on the drawn keypad
// (or filled from the SMS); "Verify" (L230) posts it to the token endpoint and opens the run. "Resend in 0:24"
// (L34) opens DR-29 (resend, voice call, ask dispatch) as designed.
import { Text, View, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { clock, fullNumber, phoneSignIn } from '@/auth/direct';
import { useCountdown } from '@/auth/countdown';
import { useAccessProblem, useDirectSignIn } from '@/lodestar/live';
import { Keypad, typeKey } from '@/lodestar/keypad';
import { Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { DeskButton, DeskField, DeskFrame, DeskHead, DeskLink, DeskOr, DeskSmall, ICONS } from '@/lodestar/desk-auth';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L34":{"to":"dr-29-can-t-sign-in","kind":"go"},"L230":{"to":"dr-08-permissions","kind":"go"},"L231":{"to":"dr-06-sign-in","kind":"go"}}};

export default function ScreenDr07VerifyCode() {
  const flow = useDirectSignIn('run');
  const problem = useAccessProblem();
  const p = useStore(phoneSignIn);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const left = useCountdown(p.resendAt);

  const verify = async (value = code) => {
    if (!p.digits) {
      setError('Send a code from the sign-in screen first.');
      return false;
    }
    if (value.length !== 6) {
      setError('Enter all 6 digits.');
      return false;
    }
    setError(null);
    const r = await flow.verifyCode(value);
    if (!r.ok) {
      setCode('');
      setError(r.description);
    }
    return false; // the run opens through enterApp
  };

  const onKey = (k: Parameters<typeof typeKey>[1]) => {
    if (k === 'enter') return void verify();
    const next = typeKey(code, k, 6);
    setCode(next);
    if (next.length === 6 && code.length === 5) void verify(next);
  };

  // Desktop/tablet browser: the DSP-06 desk sign-in card (desk-auth.tsx), the code typed in a field.
  const desk = (
    <>
      <DeskHead
        app="run" title="Enter the code" error={error} note={problem?.message}
        sub={`${p.step?.method === 'voice' ? 'Calling' : 'Sent by SMS to'} ${p.digits ? fullNumber(p.digits) : 'your phone'}.`}
      />
      <DeskField
        label="6-digit code" icon={ICONS.key} testID="code-input" value={code} placeholder="000000" keyboardType="number-pad" maxLength={6}
        autoFocus autoComplete="one-time-code" onSubmitEditing={() => void verify()}
        onChangeText={v => {
          const next = v.replace(/\D/g, '').slice(0, 6);
          setCode(next);
          if (next.length === 6 && code.length < 6) void verify(next);
        }}
        right={<DeskLink lk="L34" label={left > 0 ? `Resend in ${clock(left)}` : 'Resend code'} />}
      />
      {p.step?.demoCode ? <DeskSmall testID="demo-code">{`Demo: your code is ${p.step.demoCode}`}</DeskSmall> : null}
      <DeskButton lk="L230" label={flow.busy ? 'Checking…' : 'Verify'} onPress={() => verify()} disabled={flow.busy} />
      <DeskOr />
      <DeskButton lk="L231" secondary icon={ICONS.back} label="Use a different number" />
    </>
  );

  return (
    <DeskFrame app="run" bg="#070b16" nav={nav} style={s.v0} desk={desk}>
      <View style={s.v30}>
        <View style={s.v6}>
          <Tap lk="L231" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Verify"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v20}>
          <View style={s.v10}>
            <View>
              <Text style={s.t7}>{"Enter the code"}</Text>
            </View>
            <View>
              <Text style={[s.t9, error ? { color: '#fda29b' } : null]} testID="sign-in-note">
                {error ?? problem?.message ?? <>{p.step?.method === 'voice' ? "Calling " : "Sent to "}<Text style={s.t8}>{p.digits ? fullNumber(p.digits) : "your phone"}</Text></>}
              </Text>
            </View>
          </View>
          <View style={s.v13} testID="code-boxes">
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={[s.v12, i === code.length ? { borderWidth: 2, borderColor: '#5b8def' } : null]}>
                <Text style={s.t11}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </View>
          <View style={s.v19}>
            <View style={s.v16}>
              <Icon xml={X1} width={14} height={14} style={s.v14} />
              <Text style={s.t15} numberOfLines={1} testID="demo-code">{p.step?.demoCode ? `Demo: your code is ${p.step.demoCode}` : "Filled from SMS"}</Text>
            </View>
            <Tap lk="L34" style={s.v18}>
              <Text style={s.t17}>{left > 0 ? `Resend in ${clock(left)}` : "Resend code"}</Text>
            </Tap>
          </View>
        </Scroll>
        <View style={s.v24}>
          <Tap lk="L230" style={s.v23} onPress={() => verify()} disabled={flow.busy}>
            <Grad g={G0} style={s.v21} />
            <Icon xml={X2} width={22} height={22} style={s.v1} />
            <Text style={s.t22}>{flow.busy ? "Checking…" : "Verify"}</Text>
          </Tap>
        </View>
        <Keypad wrap={s.v29} row={s.v27} keyStyle={s.v26} blank={s.v28} text={s.t25} back={{ xml: X3, size: 26, style: s.v1 }} onKey={onKey} />
      </View>
    </DeskFrame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"26\" height=\"26\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m18 9-6 6M12 9l6 6\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t8: {"color":"#f2f4fa","fontFamily":"Inter_700Bold"},
  t9: {"color":"#b5bdd1","fontSize":15,"lineHeight":21.8,"fontFamily":"Inter_400Regular"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t11: {"color":"#f2f4fa","fontSize":28,"lineHeight":42,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":64,"backgroundColor":"#121a2e","borderRadius":16,"boxShadow":"rgb(94, 224, 168) 0px 0px 0px 2px inset"},
  v13: {"flexDirection":"row","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"marginRight":20,"marginLeft":20},
  v14: {"flexShrink":0,"marginTop":2,"overflow":"hidden"},
  t15: {"color":"#5ee0a8","fontSize":13,"lineHeight":18.9,"fontFamily":"Inter_600SemiBold"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  t17: {"color":"#7f89a3","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v18: {"flexShrink":1},
  v19: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-start","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  v20: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":10,"paddingBottom":16},
  v21: {"borderRadius":18},
  t22: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v23: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  t25: {"color":"#f2f4fa","fontSize":24,"lineHeight":36,"fontFamily":"PlusJakartaSans_700Bold"},
  v26: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":56,"backgroundColor":"#1a2340","borderRadius":14},
  v27: {"flexDirection":"row","alignItems":"stretch","rowGap":8,"columnGap":8},
  v28: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%","height":56,"borderRadius":14},
  v29: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":10,"paddingRight":12,"paddingBottom":4,"paddingLeft":12,"backgroundColor":"#0a0f1e","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v30: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
