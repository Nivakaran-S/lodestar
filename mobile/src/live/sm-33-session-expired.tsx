// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// SM-33 Session expired · phone (P1, phone)
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { plural, useAccessProblem, useDeviceId, useSignIn } from '@/lodestar/live';
import { cutoffFor, left, nextRunDate, totals, useDraft, useNow } from '@/model/store-face';
import { Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { DeskButton, DeskFrame, DeskHead, DeskInset, DeskSmall } from '@/lodestar/desk-auth';

const nav: ScreenNav = {"links":{"L113":{"to":"sm-05-sign-in","kind":"go"}}};

export default function ScreenSm33SessionExpired() {
  const { signIn, ready, busy } = useSignIn('store');
  const problem = useAccessProblem();
  const device = useDeviceId();
  const { draft } = useDraft();
  const now = useNow();
  const runDate = draft?.runDate ?? nextRunDate(now);
  const remaining = left(cutoffFor(runDate), now);
  // Desktop/tablet browser: the desk card (desk-auth.tsx) with the same facts as the phone screen.
  const desk = (
    <>
      <DeskHead app="store" title="You've been signed out" sub={problem?.message ?? 'For security, Lodestar signs you out after a long time without use, or after a change to your account.'} />
      <DeskInset
        title={draft ? `${dayLabel(draft.runDate)} order · draft` : 'No order draft in this browser'} right={draft ? 'Kept' : undefined} tone={draft ? 'ok' : 'plain'}
        testID="desk-draft"
      >
        {draft ? `${plural(totals(draft.lines).units, 'unit')} · saved ${hm(draft.savedAt)}` : undefined}
      </DeskInset>
      <DeskInset title={`Orders for ${dayLabel(runDate)} close at 4:00 PM`} right={remaining || 'Closed'} tone={remaining ? 'warn' : 'plain'} />
      <DeskButton lk="L113" label={busy ? 'Signing in…' : 'Sign in again'} onPress={signIn} disabled={!ready || busy} testID="desk-sign-in" />
      <DeskSmall>{draft ? 'Sign in again to send the draft. It takes about a minute.' : 'Sign in again to continue. It takes about a minute.'}</DeskSmall>
    </>
  );
  return (
    <DeskFrame app="store" bg="#f4f5f9" nav={nav} style={s.v0} desk={desk}>
      <View style={s.v35}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v5}>
            <View>
              <Text style={s.t3}>{"Lodestar Store"}</Text>
            </View>
            <View>
              <Text style={s.t4} numberOfLines={1} testID="device-id">{[draft?.outletId, device ? `phone ${device.slice(0, 8)}` : ''].filter(Boolean).join(' · ') || 'Signed out'}</Text>
            </View>
          </View>
          <View style={s.v6} />
        </View>
        <Scroll style={s.v29} contentStyle={s.v30}>
          <View style={s.v11}>
            <Icon xml={X1} width={160} height={112} style={s.v8} />
            <View>
              <Text style={s.t9}>{"You've been signed out"}</Text>
            </View>
            <View>
              <Text style={s.t10} testID="access-problem">{problem?.message ?? "For security, Lodestar signs you out after a long time without use, or after a change to your account."}</Text>
            </View>
          </View>
          <View style={s.v21}>
            <View style={s.v20}>
              <View style={s.v12}>
                <Icon xml={X2} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t13}>{draft ? `${dayLabel(draft.runDate)} order · draft` : 'No order draft on this phone'}</Text>
                </View>
                {draft ? (
                  <View style={s.v16}>
                    <Text style={s.t14}>{plural(totals(draft.lines).units, 'unit')}</Text>
                    <View style={s.v15} />
                    <Text style={s.t14}>{`saved ${hm(draft.savedAt)}`}</Text>
                  </View>
                ) : null}
              </View>
              {draft ? (
                <View style={s.v19}>
                  <Icon xml={X3} width={14} height={14} style={s.v1} />
                  <Text style={s.t18} numberOfLines={1}>{"Kept"}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.v28}>
            <View style={s.v26}>
              <View style={s.v23}>
                <Icon xml={X4} width={18} height={18} style={s.v1} />
                <Text style={s.t22}>{`Orders for ${dayLabel(runDate)} close at 4:00 PM`}</Text>
              </View>
              <View style={s.v25}>
                <Text style={s.t24}>{remaining || 'Closed'}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t27}>{draft ? 'Sign in again to send the draft. It takes about a minute.' : 'Sign in again to continue. It takes about a minute.'}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v34}>
          <Tap lk="L113" style={s.v33} onPress={signIn} disabled={!ready || busy}>
            <Grad g={G0} style={s.v31} />
            <Text style={s.t32}>{busy ? 'Signing in…' : 'Sign in again'}</Text>
          </Tap>
        </View>
      </View>
    </DeskFrame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#047857\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 160 112\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"160\" height=\"112\" xmlns=\"http://www.w3.org/2000/svg\"> <rect x=\"50\" y=\"4\" width=\"60\" height=\"104\" rx=\"14\" fill=\"#eef0ff\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect> <rect x=\"58\" y=\"16\" width=\"44\" height=\"80\" rx=\"8\" fill=\"#ffffff\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect> <path d=\"M71 52v-7a9 9 0 0 1 18 0v7\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <rect x=\"64\" y=\"51\" width=\"32\" height=\"28\" rx=\"7\" fill=\"#3b4cca\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect> <circle cx=\"80\" cy=\"64\" r=\"4\" fill=\"#f5b83d\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle> <circle cx=\"130\" cy=\"30\" r=\"15\" fill=\"#f5b83d\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle> <path d=\"M130 22v8l5 3\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <path d=\"M26 56 L28 62.5 L34.5 64.5 L28 66.5 L26 73 L24 66.5 L17.5 64.5 L24 62.5 Z\" fill=\"#f5b83d\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> </svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#101828","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  t4: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v5: {"flexDirection":"column","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexShrink":0,"width":40},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v8: {"flexShrink":1,"overflow":"hidden"},
  t9: {"color":"#101828","fontSize":26,"lineHeight":29.1,"letterSpacing":-0.6,"textAlign":"center","fontFamily":"PlusJakartaSans_800ExtraBold"},
  t10: {"color":"#475467","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_400Regular"},
  v11: {"flexDirection":"column","alignItems":"center","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#eff1f7","borderRadius":14},
  t13: {"color":"#101828","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t14: {"color":"#475467","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v15: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#636c80","borderRadius":1.5,"opacity":0.6},
  v16: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t18: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v19: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":56},
  v21: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  t22: {"color":"#b45309","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":1},
  t24: {"color":"#b45309","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v25: {"flexShrink":1},
  v26: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t27: {"color":"#475467","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":16,"paddingRight":18,"marginRight":16,"paddingBottom":16,"paddingLeft":18,"marginLeft":16,"backgroundColor":"#fff4e0","borderRadius":18},
  v29: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v31: {"borderRadius":18},
  t32: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(59, 76, 202, 0.28) 0px 8px 20px 0px"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f4f5f9"},
  v35: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f4f5f9"},
});
