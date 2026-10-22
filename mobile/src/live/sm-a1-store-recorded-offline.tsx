// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// SM-A1 Store · recorded offline · phone (P5, phone)
// Dead zone (P5): a delivery whose proof was saved with no signal (POD_RECORDED_OFFLINE, PODs savedOffline) shows
// when it happened at the store, when it reached the server, and the store's receipt against the driver's POD.
import { Fragment } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm, isoDay } from '@/lib/time';
import { plural } from '@/lodestar/live';
import { useClaims, useNotifications, useOutbox, useParam, usePods } from '@/model/hooks';
import { STEPS, isCounted, orderCredit, podFor, receiptFor, timeline, useDelivery } from '@/model/store-face';
import type { POD } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L30":{"to":"sm-20-credit-note-detail","kind":"go"}}};

export default function ScreenSmA1StoreRecordedOffline() {
  const claims = useClaims();
  const param = useParam('order');
  const d = useDelivery();
  const pods = usePods();
  const notes = useNotifications();
  const { items } = useOutbox();
  const offline = (notes.data ?? []).filter(n => n.type === 'POD_RECORDED_OFFLINE');
  const notice = offline.find(n => !param || n.payload?.orderId === param) ?? null;
  const orderId = param ?? (typeof notice?.payload?.orderId === 'string' ? (notice.payload.orderId as string) : undefined) ?? pods.data?.find(p => p.savedOffline)?.tripStop?.orderId;
  const all = d.data?.orders ?? [];
  const order = all.find(o => o.id === orderId) ?? null;
  const date = isoDay(order?.runDate);
  const sameDay = order ? all.filter(o => isoDay(o.runDate) === date) : [];
  // the store's count: on the server (Orders ConfirmReceipt), else waiting on this phone
  const rows = sameDay
    .map(o => {
      const receipt = receiptFor(items, o.id);
      const counted = isCounted(o) ? (o.unitsReceived ?? 0) : receipt ? Number(receipt.payload.unitsReceived) : undefined;
      const countedAt = o.receiptSavedAt ?? receipt?.savedAt;
      return { o, pod: podFor(pods.data, o.id) as POD | undefined, counted, countedAt };
    })
    .filter(r => r.pod);
  const pod = podFor(pods.data, orderId) ?? rows[0]?.pod ?? null;
  const savedAt = (typeof notice?.payload?.savedAt === 'string' ? (notice.payload.savedAt as string) : undefined) ?? pod?.savedAt;
  const syncedAt = (typeof notice?.payload?.syncedAt === 'string' ? (notice.payload.syncedAt as string) : undefined) ?? pod?.syncedAt ?? notice?.sentAt;
  const receipts = rows.filter(r => r.counted !== undefined);
  const firstReceipt = receipts.map(r => r.countedAt).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))[0];
  const matches = rows.every(r => r.counted === undefined || r.counted === r.pod!.unitsDelivered);
  const credits = rows.map(r => ({ r, c: orderCredit(r.o, r.pod) }));
  const creditRow = credits.find(x => x.c.creditNoteId) ?? null;
  const credit = creditRow ? { creditNoteId: creditRow.c.creditNoteId, orderId: creditRow.r.o.id } : null;
  const creditUnits = credits.reduce((n, x) => n + x.c.units, 0);
  const { times } = timeline(order);
  const empty = !claims ? 'Sign in to see your delivery' : d.loading || pods.loading ? 'Loading…' : 'No delivery recorded offline';
  return (
    <Frame bg="#f4f5f9" nav={nav} style={s.v0}>
      <View style={s.v51}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v5}>
            <Text style={s.t4}>{d.outlet ? `${d.outlet.district} · ` : ''}<Text style={s.t3}>{d.outlet?.id ?? claims?.outletId ?? ''}</Text></Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={20} height={20} style={s.v1} />
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v42}>
          <View style={s.v16}>
            <View style={s.v12}>
              <View style={s.v9}>
                <Text style={s.t8}>{order ? `Your delivery · ${dayLabel(date)}` : empty}</Text>
              </View>
              {pod ? (
                <View style={s.v11}>
                  <Text style={s.t10} numberOfLines={1}>{"Recorded offline"}</Text>
                </View>
              ) : null}
            </View>
            {savedAt ? (
              <View>
                <Text style={s.t14} testID="delivered-at">{hm(savedAt)}<Text style={s.t13}>{" delivered"}</Text></Text>
              </View>
            ) : null}
            {syncedAt ? (
              <View>
                <Text style={s.t15}>{`Synced ${hm(syncedAt)}. We show when it happened at your store, not when it reached us.`}</Text>
              </View>
            ) : null}
          </View>
          {rows.length ? (
            <View style={s.v34}>
              <View style={s.v19}>
                <View style={s.v9}>
                  <Text style={s.t17}>{firstReceipt ? `Your receipt ${hm(firstReceipt)} vs driver's POD` : receipts.length ? "Your receipt vs driver's POD" : "Driver's POD"}</Text>
                </View>
                {receipts.length ? (
                  <View style={s.v18}>
                    <Icon xml={X2} width={14} height={14} style={s.v1} />
                    <Text style={s.t8} numberOfLines={1}>{matches ? "Match" : 'Check'}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.v33}>
                {rows.map((r, i) => {
                  const p = r.pod!;
                  const short = Math.max(0, p.unitsOrdered - p.unitsDelivered);
                  const counted = r.counted;
                  return (
                    <View key={r.o.id} style={i === 0 ? s.v27 : s.v29} testID={`match-${i}`}>
                      <View style={s.v25}>
                        <View style={s.v22}>
                          <View style={s.v9}>
                            <Text style={s.t20}>{r.o.id}</Text>
                          </View>
                          <View style={s.v18}>
                            <Text style={r.o.tempClass === 'CHILLED' ? s.t28 : s.t21} numberOfLines={1}>{r.o.tempClass === 'CHILLED' ? 'Chilled' : "Dry"}</Text>
                          </View>
                        </View>
                        <View style={s.v24}>
                          <Text style={s.t23}>{short ? `${short} short` : `All ${plural(p.unitsDelivered, 'unit')} received`}</Text>
                        </View>
                        {(p.exceptions ?? []).map((e, j) => (
                          <View key={j} style={s.v24}>
                            <Text style={s.t23}>{e.description ?? `${e.qty ?? e.unitsShort ?? ''} ${e.item ?? e.type ?? ''}`.trim()}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={s.v9}>
                        <Text style={s.t26}>{`${counted ?? '—'} ${counted === undefined || counted === p.unitsDelivered ? '=' : '≠'} ${p.unitsDelivered}`}</Text>
                      </View>
                    </View>
                  );
                })}
                {pod?.receiverName ? (
                  <View style={s.v29}>
                    <View style={s.v31}>
                      <Grad g={G0} style={s.v30} />
                      <Icon xml={X3} width={14} height={14} style={s.v1} />
                    </View>
                    <View style={s.v25}>
                      {pod.photoUrl ? (
                        <View>
                          <Text style={s.t32}>{"Driver photo attached"}</Text>
                        </View>
                      ) : null}
                      <View style={s.v24}>
                        <Text style={s.t23}>{`Received by ${pod.receiverName} · signed ${hm(pod.savedAt)}`}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
          {order ? (
            <View style={s.v34}>
              <View style={s.v33}>
                <View style={s.v41}>
                  <View style={s.v40}>
                    <View style={s.v35} />
                    {STEPS.map((step, i) => (
                      <Fragment key={step.status}>
                        <View style={s.v39}>
                          <View style={s.v36}>
                            <Icon xml={X4} width={12} height={12} style={s.v1} />
                          </View>
                          <View>
                            <Text style={s.t37}>{step.label}</Text>
                          </View>
                          <View>
                            <Text style={s.t38}>{i === 0 ? `${dayLabel(order.orderedAt).split(' ')[0]} ${times[0]}` : i === 4 && savedAt ? hm(savedAt) : '·'}</Text>
                          </View>
                        </View>
                      </Fragment>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v50}>
          <View style={s.v46}>
            <View style={s.v43}>
              <Icon xml={X5} width={18} height={18} style={s.v1} />
            </View>
            <View style={s.v9}>
              <Text style={s.t45}><Text style={s.t44}>{"Nothing else to do."}</Text>{credit ? " Credit note " : ''}{credit ? <Text style={s.t3}>{credit.creditNoteId}</Text> : null}{credit ? ` covers ${plural(creditUnits, 'unit')}.` : ''}</Text>
            </View>
          </View>
          <Tap lk="L30" style={s.v49} to={order || pod ? { to: 'sm-20-credit-note-detail', params: { order: credit?.orderId ?? order?.id ?? pod?.tripStop?.orderId ?? '' } } : undefined}>
            <Grad g={G1} style={s.v47} />
            <Text style={s.t48}>{"View receipt & credit note"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#047857\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"12\" height=\"12\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":45,"at":null,"repeat":true,"stops":[{"c":"#eff1f7","p":0},{"c":"#eff1f7","p":null,"px":8},{"c":"#f7f8fc","p":null,"px":8},{"c":"#f7f8fc","p":null,"px":16}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#101828","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexShrink":1},
  t10: {"color":"#57534e","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#ffffff","borderWidth":1,"borderColor":"#a8a29e","borderStyle":"dashed","borderRadius":14},
  v12: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t13: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t14: {"color":"#101828","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t15: {"color":"#475467","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#e8f8f0","borderRadius":24},
  t17: {"color":"#101828","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v19: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t20: {"color":"#101828","fontSize":14,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t21: {"color":"#475467","fontSize":13,"lineHeight":16.9,"fontFamily":"Inter_600SemiBold"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t23: {"color":"#475467","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v24: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t26: {"color":"#101828","fontSize":18,"lineHeight":27,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v27: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":54},
  t28: {"color":"#0e7490","fontSize":13,"lineHeight":16.9,"fontFamily":"Inter_600SemiBold"},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":54,"borderTopWidth":1,"borderTopColor":"#eceef3"},
  v30: {"borderRadius":12},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"borderRadius":12},
  t32: {"color":"#101828","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  v33: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  v35: {"flexShrink":1,"position":"absolute","top":10,"right":32.6,"bottom":57.1,"left":32.6,"width":"80%","height":2,"backgroundColor":"#047857","borderRadius":1},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#047857","borderWidth":2,"borderColor":"#047857","borderRadius":11,"boxShadow":"rgba(4, 120, 87, 0.25) 0px 2px 6px 0px"},
  t37: {"color":"#101828","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  t38: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_400Regular"},
  v39: {"flexDirection":"column","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":0,"width":"20%","zIndex":1},
  v40: {"flexDirection":"row","alignItems":"flex-start","flexShrink":1,"width":"100%"},
  v41: {"flexDirection":"row","justifyContent":"center","alignItems":"stretch","paddingTop":12,"paddingRight":8,"paddingBottom":10,"paddingLeft":8},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":4,"paddingBottom":16},
  v43: {"flexDirection":"row","alignItems":"stretch","flexShrink":1},
  t44: {"color":"#101828","fontFamily":"Inter_700Bold"},
  t45: {"color":"#475467","fontSize":14,"lineHeight":21,"fontFamily":"Inter_400Regular"},
  v46: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":8,"columnGap":8},
  v47: {"borderRadius":18},
  t48: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v49: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(59, 76, 202, 0.28) 0px 8px 20px 0px"},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f4f5f9"},
  v51: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f4f5f9"},
});
