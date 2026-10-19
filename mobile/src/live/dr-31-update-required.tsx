// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-31 Update required · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { applyUpdate, useVersion } from '@/lib/version';
import { hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { useClaims, useOutbox, useRun } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L277":{"to":"dr-04-run-complete","kind":"go"},"L278":{"to":"dr-04-run-complete","kind":"go"}}};

export default function ScreenDr31UpdateRequired() {
  const { name: depotName } = useDepots();
  const { current, minimum } = useVersion();
  const claims = useClaims();
  const { view, updatedAt } = useRun();
  const { waiting } = useOutbox();
  const depot = view?.trip?.depot ?? claims?.depots[0];
  const update = async () => {
    if (await applyUpdate()) return true;
    showToast(`This build (${current}) is still below ${minimum ?? 'the minimum'}. Install the new version to carry on.`, 'error');
    return false;
  };
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v28}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"App update"}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1}>{updatedAt ? `Synced ${hm(new Date(updatedAt).toISOString())}` : 'Not synced'}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v21}>
          <View style={s.v11}>
            <View>
              <Text style={s.t8}>{`Lodestar Run ${minimum ?? '—'} · this phone has ${current}`}</Text>
            </View>
            <View>
              <Text style={s.t9}>{"Update after your run"}</Text>
            </View>
            <View>
              <Text style={s.t10}>{"This version works until the run is complete. Nothing changes during your trip."}</Text>
            </View>
          </View>
          <View style={s.v20}>
            <View style={s.v17}>
              <View style={s.v12}>
                <Icon xml={X2} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v16}>
                <View>
                  <Text style={s.t13}>{"Today's run stays as it is"}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t14}>{`Stops, records and sync keep working on ${current}.${waiting.length ? ` ${plural(waiting.length, 'record')} still to send.` : ''}`}</Text>
                </View>
              </View>
            </View>
            <View style={s.v19}>
              <View style={s.v18}>
                <Icon xml={X3} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v16}>
                <View>
                  <Text style={s.t13}>{"Update on depot Wi-Fi"}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t14}>{depot ? `Back at ${depotName(depot)}, once your records are sent.` : 'Back at the depot, once your records are sent.'}</Text>
                </View>
              </View>
            </View>
            <View style={s.v19}>
              <View style={s.v18}>
                <Icon xml={X4} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v16}>
                <View>
                  <Text style={s.t13}>{"We'll remind you"}</Text>
                </View>
                <View style={s.v15}>
                  <Text style={s.t14}>{"Again the next time you sign in."}</Text>
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v27}>
          <Tap lk="L277" style={s.v24}>
            <Grad g={G0} style={s.v22} />
            <Text style={s.t23}>{"Continue run"}</Text>
            <Icon xml={X5} width={22} height={22} style={s.v1} />
          </Tap>
          <Tap lk="L278" style={s.v26} onPress={update}>
            <Text style={s.t25}>{"Update on depot Wi-Fi"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t9: {"color":"#f2f4fa","fontSize":32,"lineHeight":35.2,"letterSpacing":-1,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t10: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v11: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#0d2a20","borderRadius":14},
  t13: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t14: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v15: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v17: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#1a2340","borderRadius":14},
  v19: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":76,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v20: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v21: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v22: {"borderRadius":18},
  t23: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t25: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v26: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v28: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
