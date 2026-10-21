// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-25 Signed out at shift end · phone (P3, phone)
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { useAccessProblem, useDeviceId, useSignIn } from '@/lodestar/live';
import { useTickCount } from '@/model/dock';
import { useOutbox } from '@/model/hooks';
import type { Shortfall } from '@/model/types';
import { Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { DeskButton, DeskFrame, DeskHead, DeskInset, DeskSmall } from '@/lodestar/desk-auth';

const nav: ScreenNav = {"links":{"L214":{"to":"ld-06-sign-in","kind":"go"}}};

export default function ScreenLd25SignedOutAtShiftEnd() {
  const { signIn, ready, busy } = useSignIn('dock');
  const problem = useAccessProblem();
  const device = useDeviceId();
  const { items, waiting } = useOutbox();
  const live = items.filter(i => i.status !== 'rejected');
  const releases = live.filter(i => i.kind === 'RELEASE');
  // the newest SHORTFALL write of each trip carries that trip's full list
  const latestFlags = new Map<string, Shortfall[]>();
  for (const i of live) if (i.kind === 'SHORTFALL' && i.tripId) latestFlags.set(i.tripId, (i.payload.shortfalls as Shortfall[]) ?? []);
  const flags = [...latestFlags.values()].flat();
  const lastFlag = flags.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '')).at(-1);
  const lastFlagWrite = live.filter(i => i.kind === 'SHORTFALL').at(-1);
  const lastRelease = releases.at(-1);
  const linesLoaded = useTickCount(releases.map(r => r.tripId ?? '').filter(Boolean));
  const unsent = waiting.length;
  const state = (status?: string) => (status === 'synced' ? 'sent' : status === 'conflict' ? 'needs a look' : 'on this phone');

  // Desktop/tablet browser (a dock tablet or a desk): the desk card with the shift's tally.
  const desk = (
    <>
      <DeskHead app="dock" title="Signed out at shift end" sub={problem ? `${problem.message}${hm(problem.at) ? ` · ${hm(problem.at)}` : ''}` : `Signed out${device ? ` · ${device.slice(0, 8)}` : ''}`} />
      <DeskInset title={unsent ? `${unsent} still on this device` : 'Nothing lost'} right={unsent ? 'Waiting' : 'Saved'} tone={unsent ? 'warn' : 'ok'} testID="desk-unsent">
        {unsent ? 'They send after the next sign-in here. Keep this browser open until they go.' : 'Everything from your shift is saved at the hub. Safe to hand the tablet on.'}
      </DeskInset>
      <DeskInset title={`${releases.length} released · ${flags.length} ${flags.length === 1 ? 'flag' : 'flags'} raised · ${unsent} left unsent`} testID="desk-tally">
        {`Last release ${lastRelease ? `${lastRelease.label.replace(/^Release · /, '')} · ${state(lastRelease.status)}` : '—'}`}
        {lastFlag ? `
Flag ${lastFlag.item} short ${Math.max(0, lastFlag.qtyOrdered - lastFlag.qtyLoaded)} · ${state(lastFlagWrite?.status)}` : ''}
        {releases.length ? `
Lines loaded ${linesLoaded}` : ''}
      </DeskInset>
      <DeskButton lk="L214" label={busy ? 'Signing in…' : 'Sign in for a new shift'} onPress={signIn} disabled={!ready || busy} testID="desk-sign-in" />
      <DeskSmall>{'Loaders and dock leads only. Use your staff ID and Dock PIN.'}</DeskSmall>
    </>
  );
  return (
    <DeskFrame app="dock" bg="#f2f4f8" nav={nav} style={s.v0} desk={desk}>
      <View style={s.v31}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Lodestar Dock"}</Text>
          </View>
          <View style={s.v6}>
            <Text style={s.t5} numberOfLines={1}>{"Signed out"}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v26}>
          <View style={s.v13}>
            <View style={s.v8}>
              <Icon xml={X1} width={42} height={42} style={s.v1} />
            </View>
            <View style={s.v10}>
              <Text style={s.t9} testID="sign-out-reason">{problem ? `${problem.message}${hm(problem.at) ? ` · ${hm(problem.at)}` : ""}` : `Signed out${device ? ` · phone ${device.slice(0, 8)}` : ""}`}</Text>
            </View>
            <View>
              <Text style={s.t11}>{unsent ? `${unsent} still on this phone` : "Nothing lost"}</Text>
            </View>
            <View>
              <Text style={s.t12}>{unsent ? "They send after the next sign-in on this phone. Keep the app installed until they go." : "Everything from your shift is saved at the hub. Safe to hand the phone on."}</Text>
            </View>
          </View>
          <View style={s.v18}>
            <View style={s.v16}>
              <View>
                <Text style={s.t14} testID="count-released">{String(releases.length)}</Text>
              </View>
              <View>
                <Text style={s.t15}>{"released"}</Text>
              </View>
            </View>
            <View style={s.v17}>
              <View>
                <Text style={s.t14} testID="count-flags">{String(flags.length)}</Text>
              </View>
              <View>
                <Text style={s.t15}>{flags.length === 1 ? "flag raised" : "flags raised"}</Text>
              </View>
            </View>
            <View style={s.v17}>
              <View>
                <Text style={s.t14} testID="count-unsent">{String(unsent)}</Text>
              </View>
              <View>
                <Text style={s.t15}>{"left unsent"}</Text>
              </View>
            </View>
          </View>
          <View style={s.v25}>
            <View style={s.v23}>
              <View style={s.v20}>
                <Text style={s.t19}>{"Last release"}</Text>
              </View>
              <View style={s.v20}>
                {lastRelease ? (
                  <Text style={s.t22}><Text style={s.t21}>{lastRelease.label.replace(/^Release · /, "")}</Text>{` · ${state(lastRelease.status)}`}</Text>
                ) : (
                  <Text style={s.t22}>{"—"}</Text>
                )}
              </View>
            </View>
            <View style={s.v24}>
              <View style={s.v20}>
                <Text style={s.t19}>{"Flag"}</Text>
              </View>
              <View style={s.v20}>
                <Text style={s.t22}>{lastFlag ? `${lastFlag.item} short ${Math.max(0, lastFlag.qtyOrdered - lastFlag.qtyLoaded)} · ${state(lastFlagWrite?.status)}` : "—"}</Text>
              </View>
            </View>
            <View style={s.v24}>
              <View style={s.v20}>
                <Text style={s.t19}>{"Lines loaded"}</Text>
              </View>
              <View style={s.v20}>
                <Text style={s.t22}>{releases.length ? String(linesLoaded) : "—"}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v30}>
          <Tap lk="L214" style={s.v29} onPress={signIn} disabled={!ready || busy}>
            <Grad g={G0} style={s.v27} />
            <Text style={s.t28}>{busy ? "Signing in…" : "Sign in for a new shift"}</Text>
            <Icon xml={X2} width={22} height={22} style={s.v1} />
          </Tap>
        </View>
      </View>
    </DeskFrame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"42\" height=\"42\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e9ecf2","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v8: {"flexDirection":"row","justifyContent":"center","alignItems":"center","marginBottom":10,"width":84,"height":84,"backgroundColor":"#047857","borderRadius":42,"boxShadow":"rgb(227, 246, 236) 0px 0px 0px 10px"},
  t9: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t11: {"color":"#0a0f1a","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"textAlign":"center","fontFamily":"PlusJakartaSans_800ExtraBold"},
  t12: {"color":"#344054","fontSize":15,"lineHeight":21.8,"textAlign":"center","fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"column","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":8,"paddingRight":28,"paddingLeft":28},
  t14: {"color":"#0a0f1a","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t15: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderLeftWidth":1,"borderLeftColor":"#e3e6ed"},
  v18: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"overflow":"hidden"},
  t19: {"color":"#344054","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  v20: {"flexShrink":1},
  t21: {"color":"#344054","letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t22: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v23: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  v24: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v25: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v27: {"borderRadius":18},
  t28: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v31: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
