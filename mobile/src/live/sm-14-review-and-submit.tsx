// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// SM-14 Review & submit · phone (P1, phone)
import { Text, View, StyleSheet } from 'react-native';
import { network } from '@/offline/network';
import { addDays, dayLabel } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { placeOrder } from '@/model/actions';
import { useClaims, useStoreDay } from '@/model/hooks';
import { byClass, clearDraft, cutoffFor, left, toOrderLines, totals, useNow, useOrderDraft, useOrderWindow } from '@/model/store-face';
import { Frame, Grad, Icon, Scroll, Tap, openScreen, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L83":{"to":"sm-01-received","kind":"go"},"L84":{"to":"sm-13-new-order","kind":"go"}}};

export default function ScreenSm14ReviewAndSubmit() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const day = useStoreDay();
  const outlet = day.data?.outlet ?? null;
  const { draft, runDate, ratio } = useOrderDraft();
  const { dry, chilled } = byClass(draft?.lines ?? []);
  const tDry = totals(dry, ratio);
  const tChilled = totals(chilled, ratio);
  const all = totals(draft?.lines ?? [], ratio);
  const orders = [tDry.units, tChilled.units].filter(n => n > 0).length;
  const now = useNow();
  // closed by dispatch (DSP-01 "Close orders") or past the 4:00 PM cut-off: the design's "Orders closed" (SM-23)
  const dispatchClosed = useOrderWindow(runDate)?.closed === true;
  const remaining = dispatchClosed ? '' : left(cutoffFor(runDate), now);

  const submit = async () => {
    if (!claims || !draft) return true; // design preview: follow the prototype
    if (!outlet) throw new Error('Store details not loaded yet. Open Today once with signal.');
    if (!orders) throw new Error('Add at least one line');
    if (!remaining) { openScreen('sm-23-orders-closed'); return false; } // past 4:00 PM: the design's "Orders closed"
    // one order per temperature class (dry and chilled travel apart), as the desk's SM-01 sends them
    const since = new Date().toISOString();
    await placeOrder(outlet, runDate, toOrderLines(draft.lines), draft.notes, ratio);
    await clearDraft();
    const online = network.get().online;
    // no signal: the orders wait in the outbox as drafts (SM-25); with signal they are received (SM-01), on the
    // run date the server gave them
    openScreen(online ? 'sm-01-received' : 'sm-25-offline-draft-saved', { runDate, since });
    setTimeout(() => showToast(online ? `${plural(orders, 'order')} sent for ${dayLabel(runDate)}` : 'Saved on this phone · it sends when there is signal'), 350);
    return false;
  };

  return (
    <Frame bg="#f4f5f9" nav={nav} style={s.v0}>
      <View style={s.v37}>
        <View style={s.v7}>
          <Tap lk="L84" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <View>
              <Text style={s.t3}>{"Review"}</Text>
            </View>
            <View>
              <Text style={s.t4} numberOfLines={1}>{`${dayLabel(runDate)}${outlet ? ` · ${depotName(outlet.depot)} run` : ''}`}</Text>
            </View>
          </View>
          <View style={s.v6} />
        </View>
        <Scroll style={s.v29} contentStyle={s.v30}>
          <View style={s.v11}>
            <View>
              <Text style={s.t4}>{`You're ordering for ${dayLabel(runDate)}`}</Text>
            </View>
            <View>
              <Text style={s.t9} testID="review-units">{String(all.units)}<Text style={s.t8}>{all.units === 1 ? " unit" : " units"}</Text></Text>
            </View>
            <View>
              <Text style={s.t10}>{draft ? `${plural(orders, 'order')} · ${all.kg} kg · ${all.m3} m³${outlet ? ` · delivery window ${outlet.windowOpen}–${outlet.windowClose}` : ''}` : claims ? 'No draft yet · start a new order' : 'Sign in to review your order'}</Text>
            </View>
          </View>
          <View style={s.v23}>
            <View style={s.v20}>
              <View style={s.v12}>
                <Icon xml={X1} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t13}>{"Dry order"}</Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t14}>{plural(tDry.lines, 'line')}</Text>
                  <View style={s.v15} />
                  <Text style={s.t14}>{`${tDry.kg} kg`}</Text>
                  <View style={s.v15} />
                  <Text style={s.t14}>{`${tDry.m3} m³`}</Text>
                </View>
              </View>
              <View style={s.v19}>
                <View>
                  <Text style={s.t18}>{String(tDry.units)}</Text>
                </View>
                <View>
                  <Text style={s.t4}>{"units"}</Text>
                </View>
              </View>
              <Icon xml={X2} width={18} height={18} style={s.v1} />
            </View>
            <View style={s.v22}>
              <View style={s.v21}>
                <Icon xml={X3} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v17}>
                <View>
                  <Text style={s.t13}>{"Chilled order"}</Text>
                </View>
                <View style={s.v16}>
                  <Text style={s.t14}>{plural(tChilled.lines, 'line')}</Text>
                  <View style={s.v15} />
                  <Text style={s.t14}>{`${tChilled.kg} kg`}</Text>
                  <View style={s.v15} />
                  <Text style={s.t14}>{`${tChilled.m3} m³`}</Text>
                </View>
              </View>
              <View style={s.v19}>
                <View>
                  <Text style={s.t18}>{String(tChilled.units)}</Text>
                </View>
                <View>
                  <Text style={s.t4}>{"units"}</Text>
                </View>
              </View>
              <Icon xml={X2} width={18} height={18} style={s.v1} />
            </View>
          </View>
          <View style={s.v23}>
            <View style={s.v27}>
              <View style={s.v25}>
                <Text style={s.t24}>{"Delivery window"}</Text>
              </View>
              <View style={s.v25}>
                <Text style={s.t26}>{outlet ? `${outlet.windowOpen}–${outlet.windowClose}` : '—'}</Text>
              </View>
            </View>
            <View style={s.v28}>
              <View style={s.v25}>
                <Text style={s.t24}>{"Dock"}</Text>
              </View>
              <View style={s.v25}>
                <Text style={s.t26}>{outlet ? [outlet.dockType, outlet.accessNote].filter(Boolean).join(' · ') || '—' : '—'}</Text>
              </View>
            </View>
            <View style={s.v28}>
              <View style={s.v25}>
                <Text style={s.t24}>{"Arrival window"}</Text>
              </View>
              <View style={s.v25}>
                <Text style={s.t26}>{`by 7 PM ${dayLabel(addDays(runDate, -1))}`}</Text>
              </View>
            </View>
            <View style={s.v28}>
              <View style={s.v25}>
                <Text style={s.t24}>{"Changes"}</Text>
              </View>
              <View style={s.v25}>
                <Text style={s.t26}>{remaining ? `open until 4:00 PM ${dayLabel(addDays(runDate, -1))}` : 'closed'}</Text>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v36}>
          <Tap lk="L83" style={s.v33} onPress={submit}>
            <Grad g={G0} style={s.v31} />
            <Icon xml={X4} width={22} height={22} style={s.v1} />
            <Text style={s.t32}>{draft ? `Submit ${plural(orders, 'order')}` : 'Submit order'}</Text>
          </Tap>
          <View style={s.v35}>
            <Text style={s.t34}>{`${remaining ? `${remaining} before cutoff` : 'Past the cutoff'}${tChilled.units ? ' · chilled travels in a reefer' : ''}`}</Text>
          </View>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"color":"#101828","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  t4: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v5: {"flexDirection":"column","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexShrink":0,"width":40},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t9: {"color":"#101828","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t10: {"color":"#475467","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v11: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  v12: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#eff1f7","borderRadius":14},
  t13: {"color":"#101828","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t14: {"color":"#475467","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v15: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#636c80","borderRadius":1.5,"opacity":0.6},
  v16: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v17: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t18: {"color":"#101828","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v19: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v21: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f7fb","borderRadius":14},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#eceef3"},
  v23: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  t24: {"color":"#475467","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  v25: {"flexShrink":1},
  t26: {"color":"#101828","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v27: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  v28: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#eceef3"},
  v29: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v31: {"borderRadius":18},
  t32: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(59, 76, 202, 0.28) 0px 8px 20px 0px"},
  t34: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"textAlign":"center","fontFamily":"Inter_400Regular"},
  v35: {"paddingBottom":2},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f4f5f9"},
  v37: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f4f5f9"},
});
