// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-23 Plan changed · Dock tablet (P3, tablet)
// The tablet load sheet opens this when dispatch publishes a re-plan for the trip being loaded (route params
// `trip`, `plan`): the order lines whose stop changed, from the two versions, against the lines ticked here.
// Not built: the truck top-view drawing (positions are not in the data), printing, and the dispatcher's name.
import { Text, View, StyleSheet } from 'react-native';
import { hm, until } from '@/lib/time';
import { signOutTo, titleCase } from '@/lodestar/live';
import { usePlanChange, useTicks } from '@/model/dock';
import { useClaims, useParam } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L226":{"to":"ld-21-bay-overview","kind":"go"}}};

const where = (seq: number | null) => (seq === null ? 'Off this van' : `Stop ${seq}`);
const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

export default function ScreenLd23PlanChanged() {
  const claims = useClaims();
  const tripId = useParam('trip');
  const planId = useParam('plan');
  const q = usePlanChange(tripId, planId);
  const ch = q.data;
  const before = ch?.before ?? null;
  const after = ch?.after ?? before;
  const plan = ch?.plan ?? null;
  const t = useTicks(before?.id, before?.status);
  const moved = ch?.moved ?? [];
  const loaded = moved.filter(m => t.isTicked(m.line.id));
  const first = moved[0];
  const at = plan?.publishedAt ?? plan?.approvedAt ?? plan?.createdAt;
  const version = plan?.version ?? after?.planVersion;
  const ticked = Object.keys(t.map).length;
  const name = claims?.name ?? claims?.username;
  const unchanged = Math.max(0, (ch?.lines ?? 0) - moved.length);
  const empty = !claims ? 'Sign in to see the change' : q.loading && !ch ? 'Loading the new plan…' : 'No change for this vehicle';
  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v69}>
        <View style={s.v22}>
          <View style={s.v6}>
            <Icon xml={X2} width={36} height={36} style={s.v3} />
          </View>
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{after ? [after.bay ? `Bay ${after.bay}` : '', titleCase(after.brand), after.district].filter(Boolean).join(' · ') : '—'}</Text>
            </View>
            <View>
              <Text style={s.t9} numberOfLines={1}><Text style={s.t8}>{after?.vehicleId ?? '—'}</Text>{after?.vehicle ? ` · ${after.vehicle.tempClass === 'CHILLED' ? 'Reefer' : 'Dry'} ${after.vehicle.type === 'VAN' ? 'van' : 'truck'}` : ''}</Text>
            </View>
          </View>
          <View style={s.v11} />
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{after?.departTime ? `Departs ${hm(after.departTime)}` : 'Departs —'}</Text>
            </View>
            <View>
              <Text style={s.t9} numberOfLines={1}>{until(after?.departTime) || ' '}</Text>
            </View>
          </View>
          <View style={s.v11} />
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{"Loaded"}</Text>
            </View>
            <View>
              <Text style={s.t9} numberOfLines={1}>{ch ? `${ticked} of ${ch.lines} lines` : '—'}</Text>
            </View>
          </View>
          <View style={s.v12} />
          {version ? (
            <View style={s.v15}>
              <View style={s.v13} />
              <Text style={s.t14} numberOfLines={1}>{`Plan v${version} · new`}</Text>
            </View>
          ) : null}
          <Tap style={s.v21} to={null} onPress={() => signOutTo('ld-20-shared-sign-in')} testID="switch-user">
            <View style={s.v17}>
              <Text style={s.t16}>{initials(name) || '—'}</Text>
            </View>
            <View style={s.v20}>
              <View>
                <Text style={s.t18} numberOfLines={1}>{name ?? 'Not signed in'}</Text>
              </View>
              <View>
                <Text style={s.t19} numberOfLines={1}>{"Switch user"}</Text>
              </View>
            </View>
          </Tap>
        </View>
        <Scroll style={s.v12} contentStyle={s.v60}>
          <View style={s.v35}>
            <View style={s.v27}>
              <View>
                <Text style={s.t23} testID="changed-at">{plan ? `Plan changed${at ? ` ${hm(at)}` : ''} · dispatch` : empty}</Text>
              </View>
              <View>
                <Text style={s.t25}>{String(moved.length)}<Text style={s.t24}>{moved.length === 1 ? 'item moved' : "items moved"}</Text></Text>
              </View>
              {ch ? (
                <View>
                  <Text style={s.t26}>{`${!moved.length ? 'Nothing on your sheet moved.' : loaded.length ? `${loaded.length} already loaded: take ${loaded.length === 1 ? 'it' : 'them'} off.` : `${moved.length === 1 ? 'It is not' : 'None is'} loaded yet, so nothing comes off the truck.`} The other ${unchanged} lines are unchanged.`}</Text>
                </View>
              ) : null}
            </View>
            {plan ? (
              <View style={s.v34}>
                {plan.notes || plan.explanation ? (
                  <View style={s.v30}>
                    <View style={s.v2}>
                      <Text style={s.t28}>{"Why"}</Text>
                    </View>
                    <View style={s.v2}>
                      <Text style={s.t29}>{plan.notes ?? plan.explanation}</Text>
                    </View>
                  </View>
                ) : null}
                {first?.outletId ? (
                  <View style={plan.notes || plan.explanation ? s.v32 : s.v30}>
                    <View style={s.v2}>
                      <Text style={s.t28}>{"Store"}</Text>
                    </View>
                    <View style={s.v2}>
                      <Text style={s.t29}><Text style={s.t31}>{first.outletId}</Text></Text>
                    </View>
                  </View>
                ) : null}
                {before && version && before.planVersion !== version ? (
                  <View style={s.v32}>
                    <View style={s.v2}>
                      <Text style={s.t28}>{`Your v${before.planVersion} printout`}</Text>
                    </View>
                    <View style={s.v2}>
                      <Text style={s.t33}>{"Out of date"}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          {moved.length ? (
            <View style={s.v59}>
              <View style={s.v54}>
                <View style={s.v38}>
                  <View style={s.v2}>
                    <Text style={s.t36}>{`What moved · v${before?.planVersion ?? '—'} → v${version ?? '—'}`}</Text>
                  </View>
                  <View style={s.v2}>
                    <Text style={s.t37}>{`${moved.length} of ${ch?.lines ?? moved.length} lines`}</Text>
                  </View>
                </View>
                <View style={s.v53}>
                  {moved.map((m, i) => (
                    <View key={m.line.id} style={i === 0 ? s.v51 : s.v52} testID={`moved-${i}`}>
                      <View style={s.v39}>
                        <Icon xml={X3} width={22} height={22} style={s.v3} />
                      </View>
                      <View style={s.v44}>
                        <View>
                          <Text style={s.t40}>{m.line.name}</Text>
                        </View>
                        <View style={s.v43}>
                          <Text style={s.t41}>{`${Math.round(m.line.kg * 10) / 10} kg`}</Text>
                          <View style={s.v42} />
                          <Text style={s.t41}>{t.isTicked(m.line.id) ? 'loaded' : "not loaded yet"}</Text>
                        </View>
                      </View>
                      <View style={s.v48}>
                        <View style={s.v46}>
                          <View>
                            <Text style={s.t37}>{`v${before?.planVersion ?? ''}`}</Text>
                          </View>
                          <View>
                            <Text style={s.t45}>{where(m.from)}</Text>
                          </View>
                        </View>
                        <Icon xml={X4} width={18} height={18} style={s.v3} />
                        <View style={s.v46}>
                          <View>
                            <Text style={s.t37}>{`v${version ?? ''}`}</Text>
                          </View>
                          <View>
                            <Text style={s.t47}>{where(m.to)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.v50}>
                        <View>
                          <Text style={s.t49}>{String(m.line.qty)}</Text>
                        </View>
                        <View>
                          <Text style={s.t7}>{"units"}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v68}>
          <View style={s.v62}>
            <Icon xml={X6} width={18} height={18} style={s.v3} />
            <Text style={s.t61}>{moved.length ? 'Sheet stays locked until you tap Got it.' : 'Nothing to take off: your sheet is unchanged.'}</Text>
          </View>
          <View style={s.v12} />
          <Tap lk="L226" style={s.v67} to={after ? { to: 'ld-21-bay-overview', params: { trip: after.id } } : undefined}>
            <Grad g={G0} style={s.v65} />
            <Icon xml={X8} width={22} height={22} style={s.v3} />
            <Text style={s.t66}>{version ? `Got it, load v${version}` : 'Got it'}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X2 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14M12 5l7 7-7 7\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  t1: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontVariant":["tabular-nums"],"fontFamily":"JetBrainsMono_600SemiBold"},
  v2: {"flexShrink":1},
  v3: {"flexShrink":0,"overflow":"hidden"},
  v4: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1},
  v5: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":28},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t7: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t8: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#0a0f1a","fontSize":19,"lineHeight":28.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v11: {"flexShrink":0,"width":1,"height":36,"backgroundColor":"#e3e6ed"},
  v12: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v13: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#b45309","borderRadius":3.5},
  t14: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#fff1d6","borderRadius":14},
  t16: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_800ExtraBold"},
  v17: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":34,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  t18: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_700Bold"},
  t19: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_600SemiBold"},
  v20: {"flexDirection":"column","alignItems":"stretch","flexShrink":1},
  v21: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":12,"paddingLeft":5,"height":44,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":18,"columnGap":18,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":72},
  t23: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t24: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t25: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t26: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"paddingBottom":20,"paddingLeft":20,"backgroundColor":"#fff1d6","borderRadius":24},
  t28: {"color":"#344054","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  t29: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  t31: {"color":"#344054","letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v32: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  t33: {"color":"#b42318","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v34: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v35: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"flexShrink":0,"width":404},
  t36: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t37: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v38: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":4,"paddingLeft":4},
  v39: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#fff1d6","borderRadius":14},
  t40: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t41: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v42: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  v43: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v44: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t45: {"color":"#4a5467","fontSize":15,"lineHeight":22.5,"textDecorationLine":"line-through","fontFamily":"Inter_600SemiBold"},
  v46: {"flexDirection":"column","alignItems":"stretch","rowGap":1,"columnGap":1,"flexShrink":1},
  t47: {"color":"#b45309","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_800ExtraBold"},
  v48: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0},
  t49: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v50: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0,"width":52},
  v51: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60},
  v52: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v53: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v54: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v55: {"flexShrink":1,"overflow":"hidden"},
  v56: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  t57: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v58: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":1,"paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v59: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v60: {"flexDirection":"row","alignItems":"stretch","rowGap":18,"columnGap":18,"paddingTop":4,"paddingRight":22,"paddingBottom":12,"paddingLeft":22},
  t61: {"color":"#344054","fontSize":14,"lineHeight":21,"fontFamily":"Inter_600SemiBold"},
  v62: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":1},
  t63: {"color":"#0a0f1a","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v64: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":20,"paddingLeft":20,"height":58,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  v65: {"borderRadius":18},
  t66: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v67: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":24,"paddingLeft":24,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v68: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":84},
  v69: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
