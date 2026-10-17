// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-19 Empty queue · phone (P3, phone)
// Shown after a handover when nothing is left for the loader's bays: the depot's latest published plan, the
// vehicles this loader released, and the trips still on the dock at other bays. "Help load …" opens that trip
// (LD-18 shows it locked while a re-plan is open, else leads to its load sheet).
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { signOutTo, titleCase } from '@/lodestar/live';
import { isReleased, onTime, useLatestPlan, useRePlanAlert } from '@/model/dock';
import { useBayQueue, useClaims, useOutbox } from '@/model/hooks';
import { Frame, PhoneOnly, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L211":{"to":"ld-18-plan-locked","kind":"go"},"N0":{"to":"ld-01-dock-queue","kind":"nav"},"N1":{"to":"ld-13-flags-tab","kind":"nav"},"N2":{"to":"ld-16-shift-summary","kind":"nav"}}};

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

export default function ScreenLd19EmptyQueue() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const bay = useBayQueue();
  const { items } = useOutbox();
  const date = bay.data?.date;
  const depot = bay.data?.depot ?? claims?.depots[0];
  useRePlanAlert(depot);
  const plan = useLatestPlan(depot, date).data ?? null;
  const trips = bay.data?.trips ?? [];
  const mine = trips.filter(t => isReleased(t, items) && (t.loadRecord?.loaderId === claims?.sub || items.some(i => i.kind === 'RELEASE' && i.tripId === t.id)));
  const myBays = [...new Set(mine.map(t => t.bay).filter((b): b is string => !!b))];
  const onDock = trips.filter(t => !isReleased(t, items) && (t.status === 'PLANNED' || t.status === 'LOADING'));
  const others = onDock.filter(t => !t.bay || !myBays.includes(t.bay));
  const help = others[0] ?? null;
  const brands = [...new Set(mine.map(t => titleCase(t.brand)))];
  const late = mine.some(t => onTime(t) === false);
  const name = claims?.name ?? claims?.username;
  const empty = !claims ? 'Sign in to see your queue' : bay.loading && !bay.data ? 'Loading the bay queue…' : '';
  const body = [
    mine.length ? `All ${mine.length} ${brands.length === 1 ? `${brands[0]} ` : ''}${mine.length === 1 ? 'vehicle' : 'vehicles'} left${late ? '' : ' on time'}.` : '',
    `Nothing else is planned for ${myBays.length ? `Bay ${myBays.join(', ')}` : 'your bay'} tonight.`,
  ].filter(Boolean).join(' ');
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v47}>
        {/* the Dock desktop shell has its own header (depot, title, user chip) */}
        <PhoneOnly>
          <View style={s.v11}>
            <View style={s.v2}>
              <Icon xml={X0} width={36} height={36} style={s.v1} />
            </View>
            <View style={s.v4}>
              <Text style={s.t3}>{depot ? depotName(depot) : 'Dock'}</Text>
            </View>
            <Tap style={s.v10} to={null} onPress={() => signOutTo('ld-06-sign-in')} testID="switch-user">
              <View style={s.v6}>
                <Text style={s.t5}>{initials(name) || "—"}</Text>
              </View>
              <View style={s.v9}>
                <View>
                  <Text style={s.t7} numberOfLines={1}>{name ?? "Not signed in"}</Text>
                </View>
                <View>
                  <Text style={s.t8} numberOfLines={1}>{"Switch user"}</Text>
                </View>
              </View>
            </Tap>
          </View>
        </PhoneOnly>
        <Scroll style={s.v4} contentStyle={s.v39}>
          {plan ? (
            <View style={s.v16}>
              <Icon xml={X1} width={20} height={20} style={s.v12} />
              <View style={s.v15}>
                <View>
                  <Text style={s.t13}>{`Plan v${plan.version} · you're on the latest`}</Text>
                </View>
                {plan.publishedAt ?? plan.approvedAt ? (
                  <View>
                    <Text style={s.t14}>{`Published ${hm(plan.publishedAt ?? plan.approvedAt)} ${dayLabel(plan.publishedAt ?? plan.approvedAt).split(' ')[0]} by dispatch`}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
          <View style={s.v20}>
            <Icon xml={X2.replace('>K2</text>', `>${(myBays[0] ?? '').replace(/[<>&]/g, '')}</text>`)} width={240} height={132} style={s.v17} />
            <View>
              <Text style={s.t18} testID="queue-empty">{empty || "Your queue is empty"}</Text>
            </View>
            {empty ? null : (
              <View>
                <Text style={s.t19}>{body}</Text>
              </View>
            )}
          </View>
          {others.length ? (
            <View style={s.v38}>
              <View style={s.v24}>
                <View style={s.v22}>
                  <Text style={s.t21}>{`Still on the dock · ${others.length}`}</Text>
                </View>
                <View style={s.v22}>
                  <Text style={s.t23}>{"other bays"}</Text>
                </View>
              </View>
              <View style={s.v37}>
                {others.map((t, i) => (
                  <View key={t.id} style={i === 0 ? s.v36 : [s.v36, x.border]} testID={`on-dock-${i}`}>
                    <View style={s.v26}>
                      <Text style={s.t25}>{t.bay ?? '—'}</Text>
                    </View>
                    <View style={s.v32}>
                      <View>
                        <Text style={s.t28}><Text style={s.t27}>{t.vehicleId}</Text>{` · ${titleCase(t.brand)}`}</Text>
                      </View>
                      <View style={s.v31}>
                        <View style={s.v30}>
                          <Icon xml={X3} width={14} height={14} style={s.v1} />
                          <Text style={s.t29} numberOfLines={1}>{t.district}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={s.v35}>
                      <View>
                        <Text style={s.t33}>{t.departTime ? hm(t.departTime) : '—'}</Text>
                      </View>
                      <View>
                        <Text style={s.t34}>{titleCase(t.status)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Scroll>
        {help ? (
          <View style={s.v43}>
            <Tap lk="L211" style={s.v42} to={{ to: 'ld-18-plan-locked', params: { trip: help.id } }} testID="help-load">
              <Grad g={G0} style={s.v40} />
              <Icon xml={X4} width={22} height={22} style={s.v1} />
              <Text style={s.t41}>{`Help load ${help.vehicleId}${help.bay ? ` at ${help.bay}` : ''}`}</Text>
            </Tap>
          </View>
        ) : null}
        <PhoneOnly>
        <View style={s.v46}>
          <Tap lk="N0" style={s.v45}>
            <Icon xml={X5} width={24} height={24} style={s.v1} />
            <Text style={s.t44}>{"Dock"}</Text>
          </Tap>
          <Tap lk="N1" style={s.v45}>
            <Icon xml={X6} width={24} height={24} style={s.v1} />
            <Text style={s.t23}>{"Flags"}</Text>
          </Tap>
          <Tap lk="N2" style={s.v45}>
            <Icon xml={X7} width={24} height={24} style={s.v1} />
            <Text style={s.t23}>{"Shift"}</Text>
          </Tap>
        </View>
        </PhoneOnly>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({ border: { borderTopWidth: 1, borderTopColor: '#e3e6ed' } });

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg width=\"240\" height=\"132\" viewBox=\"0 0 240 132\" data-name=\"Empty bay illustration\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"> <circle cx=\"120\" cy=\"64\" r=\"60\" fill=\"#e6e9f8\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle> <rect x=\"62\" y=\"34\" width=\"116\" height=\"68\" rx=\"12\" fill=\"#ffffff\" stroke=\"#8f98aa\" stroke-width=\"2\" stroke-dasharray=\"7, 6\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect> <text x=\"120\" y=\"76\" font-size=\"22\" font-weight=\"800\" text-anchor=\"middle\" fill=\"#8f98aa\" font-family=\"Plus Jakarta Sans\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\">K2</text> <path d=\"M184 14 L187.6 26.4 L200 30 L187.6 33.6 L184 46 L180.4 33.6 L168 30 L180.4 26.4 Z\" fill=\"#f5b83d\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> <path d=\"M28 126 H212\" stroke=\"#c9cfdb\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-dasharray=\"12, 9\" fill=\"#000000\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path> </svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"9\" cy=\"8\" r=\"4\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M1 21a8 8 0 0 1 16 0M16 4a4 4 0 0 1 0 8M23 21a8 8 0 0 0-5-7.4\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 21V8l9-5 9 5v13\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M7 21v-8h10v8M7 17h10\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 6v6l4 2\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_800ExtraBold"},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":34,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  t7: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_700Bold"},
  t8: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexDirection":"column","alignItems":"stretch","flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":12,"paddingLeft":5,"height":44,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  v12: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t13: {"color":"#047857","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t14: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v16: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#e3f6ec","borderRadius":18},
  v17: {"flexShrink":1,"overflow":"hidden"},
  t18: {"color":"#0a0f1a","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"textAlign":"center","fontFamily":"PlusJakartaSans_800ExtraBold"},
  t19: {"color":"#344054","fontSize":15,"lineHeight":21.8,"textAlign":"center","fontFamily":"Inter_400Regular"},
  v20: {"flexDirection":"column","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":28,"paddingLeft":28},
  t21: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v22: {"flexShrink":1},
  t23: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v24: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t25: {"color":"#3b4cca","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v26: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t27: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t28: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#b45309","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v31: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t33: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t34: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v35: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v36: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v37: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v39: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v40: {"borderRadius":18},
  t41: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v42: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  t44: {"color":"#141b4d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v45: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  v46: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#ffffff","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v47: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
