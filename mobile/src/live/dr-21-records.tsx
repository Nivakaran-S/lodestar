// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-21 Records · phone (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { needsAttention } from '@/offline/queue';
import { useClaims, today, useOutbox, usePods, useRun } from '@/model/hooks';
import { itemDetail, itemMix, itemState, newestFirst } from '@/model/run';
import { Frame, Icon, Scroll, Tap, type ScreenNav } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L262":{"to":"dr-22-record-detail-pod","kind":"go"},"L263":{"to":"dr-26-sync-in-progress","kind":"go"},"N0":{"to":"dr-01-today-s-run","kind":"nav"},"N2":{"to":"dr-23-dispatch-notices","kind":"nav"}}};

export default function ScreenDr21Records() {
  const claims = useClaims();
  const { view } = useRun();
  const pods = usePods();
  const { items, waiting, synced, attention, summary } = useOutbox();
  const list = pods.data ?? [];
  const records = newestFirst(items);
  const stopOf = (id: string) => view?.stops.find(x => x.id === id);
  const lastPodSync = list.map(p => p.syncedAt ?? '').sort((a, b) => a.localeCompare(b)).at(-1);
  const vehicle = claims?.vehicleId ?? view?.trip?.vehicleId;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v38}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{"Records"}</Text>
          </View>
          <Tap lk="L263" style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1} testID="records-chip">{waiting.length ? `${waiting.length} waiting` : attention.length ? `${attention.length} to check` : 'All synced'}</Text>
          </Tap>
        </View>
        <Scroll style={s.v4} contentStyle={s.v34}>
          <View style={s.v14}>
            <View style={s.v12}>
              <Text style={s.t8}>{dayLabel(view?.date ?? today())}</Text>
              <View style={s.v9} />
              <View style={s.v11}>
                <Text style={s.t10}>{vehicle ?? '—'}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t13}>{!claims ? 'Sign in to see your records' : items.length ? `${synced.length} of ${items.length} synced` : `${list.length} proofs of delivery`}</Text>
            </View>
          </View>
          <View style={s.v30}>
            <View style={s.v17}>
              <View style={s.v11}>
                <Text style={s.t15}>{`Proof of delivery · ${list.length}`}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t16}>{lastPodSync ? `synced ${hm(lastPodSync)}` : pods.fromCache ? 'saved on phone' : ''}</Text>
              </View>
            </View>
            <View style={s.v29}>
              {list.length ? (
                list.map((p, i) => {
                  const st = stopOf(p.tripStopId);
                  const chilled = st?.order?.tempClass === 'CHILLED';
                  const temp = st?.order ? (chilled ? ' · chilled' : ' · dry') : '';
                  const short = p.unitsOrdered - p.unitsDelivered;
                  const ex = p.exceptions?.length ?? 0;
                  // the list is the driver's latest PODs, not only this run's: an older one carries its own day
                  const podDay = p.savedAt && dayLabel(p.savedAt) !== dayLabel(view?.date ?? today()) ? ` · ${dayLabel(p.savedAt)}` : '';
                  return (
                    <Tap
                      key={p.id}
                      lk={i === 0 ? 'L262' : undefined}
                      testID={i === 0 ? undefined : `pod-row-${i}`}
                      style={i === 0 ? s.v26 : s.v28}
                      to={{ to: 'dr-22-record-detail-pod', params: { pod: p.id } }}
                    >
                      <View style={chilled ? s.v18 : s.v27}>
                        <Icon xml={chilled ? X2 : X4} width={19} height={19} style={s.v1} />
                      </View>
                      <View style={s.v22}>
                        <View>
                          <Text style={s.t19}>{`Stop ${p.tripStop?.stopSeq ?? st?.stopSeq ?? '—'}${temp}${podDay}`}</Text>
                        </View>
                        <View style={s.v21}>
                          <View style={s.v11}>
                            <Text style={s.t20}>{p.tripStop?.orderId ?? st?.orderId ?? '—'}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.v25}>
                        <View>
                          <Text style={s.t23}>{`${p.unitsDelivered}/${p.unitsOrdered}`}</Text>
                        </View>
                        {short > 0 || ex > 0 ? (
                          <View>
                            <Text style={s.t24}>{short > 0 ? `${short} short` : `${ex} exception${ex === 1 ? '' : 's'}`}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Icon xml={X3} width={18} height={18} style={s.v1} />
                    </Tap>
                  );
                })
              ) : (
                <Tap lk="L262" style={s.v26}>
                  <View style={s.v27}>
                    <Icon xml={X4} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v22}>
                    <View>
                      <Text style={s.t19}>{!claims ? 'Sign in to see your records' : pods.loading ? 'Loading…' : 'No proofs of delivery yet'}</Text>
                    </View>
                  </View>
                  <Icon xml={X3} width={18} height={18} style={s.v1} />
                </Tap>
              )}
            </View>
          </View>
          <View style={s.v30}>
            <View style={s.v17}>
              <View style={s.v11}>
                <Text style={s.t15}>{"On this phone"}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t16}>{itemMix(records) || (summary.lastSyncedAt ? `synced ${hm(summary.lastSyncedAt)}` : '')}</Text>
              </View>
            </View>
            <View style={s.v29}>
              {records.length ? (
                records.map((it, i) => {
                  const warn = needsAttention(it) || it.status === 'conflict' || it.status === 'rejected';
                  return (
                    <View key={it.id} style={i === 0 ? s.v26 : s.v28} testID={`record-row-${i}`}>
                      <View style={warn ? s.v33 : s.v31}>
                        <Icon xml={warn ? X7 : it.kind === 'POD_SAVE' ? X6 : X5} width={19} height={19} style={s.v1} />
                      </View>
                      <View style={s.v22}>
                        <View>
                          <Text style={s.t19}>{`${it.label} ${hm(it.savedAt)}`}</Text>
                        </View>
                        <View style={s.v21}>
                          <Text style={s.t32}>{[itemDetail(it), itemState(it), it.conflict ?? ''].filter(Boolean).join(' · ')}</Text>
                        </View>
                      </View>
                      <Icon xml={X3} width={18} height={18} style={s.v1} />
                    </View>
                  );
                })
              ) : (
                <View style={s.v26}>
                  <View style={s.v31}>
                    <Icon xml={X5} width={19} height={19} style={s.v1} />
                  </View>
                  <View style={s.v22}>
                    <View>
                      <Text style={s.t19}>{"Nothing saved on this phone"}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v37}>
          <Tap lk="N0" style={s.v35}>
            <Icon xml={X8} width={24} height={24} style={s.v1} />
            <Text style={s.t16}>{"Run"}</Text>
          </Tap>
          <View style={s.v35}>
            <Icon xml={X9} width={24} height={24} style={s.v1} />
            <Text style={s.t36}>{"Records"}</Text>
          </View>
          <Tap lk="N2" style={s.v35}>
            <Icon xml={X10} width={24} height={24} style={s.v1} />
            <Text style={s.t16}>{"Dispatch"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 12 2 2 4-4\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ff8a7a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#ff8a7a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#ff8a7a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 12v9M8 16l4-4 4 4\" fill=\"none\" stroke=\"#f5b83d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#7f89a3\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#7f89a3","borderRadius":1.5,"opacity":0.6},
  t10: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v11: {"flexShrink":1},
  v12: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t13: {"color":"#f2f4fa","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v14: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t15: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t16: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#082b33","borderRadius":12},
  t19: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t20: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v21: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v22: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t23: {"color":"#f2f4fa","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t24: {"color":"#ff8a7a","fontSize":13,"lineHeight":16,"fontFamily":"Inter_700Bold"},
  v25: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v26: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#161d3d","borderRadius":12},
  v28: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v29: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v30: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v31: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t32: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v33: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#321210","borderRadius":12},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v35: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  t36: {"color":"#f5b83d","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v37: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":12,"paddingBottom":2,"paddingLeft":12,"backgroundColor":"#0b1122","borderTopWidth":1,"borderTopColor":"#1b2338"},
  v38: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
});
