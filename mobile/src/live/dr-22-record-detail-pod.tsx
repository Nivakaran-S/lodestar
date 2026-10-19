// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-22 Record detail · POD · phone (P4, phone)
// One proof of delivery (route param `pod`, else the newest): the server's record, or the one still on this
// phone, with the receiver's signature (the server's SVG, or the one still in the outbox). The store's own count is
// not readable by the driver: left out.
import { Image, Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import * as api from '@/model/api';
import { useClaims, useOutbox, useParam, usePods, useRun } from '@/model/hooks';
import { base64ToBytes } from '@/offline/sync';
import { SignatureView } from '@/lodestar/signature';
import { useQuery } from '@/model/query';
import type { POD } from '@/model/types';
import { Frame, Icon, Scroll, Tap, type ScreenNav } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L265":{"to":"dr-21-records","kind":"go"}}};

export default function ScreenDr22RecordDetailPod() {
  const claims = useClaims();
  const param = useParam('pod');
  const pods = usePods();
  const run = useRun();
  const id = param ?? pods.data?.[0]?.id;
  const remote = id && !id.startsWith('local-');
  const q = useQuery<POD>(remote ? `pod.${id}` : null, c => api.pod(c, id!), { persist: true });
  const stops = run.view?.stops ?? [];
  const stopOfLocal = stops.find(st => st.pod?.id === id);
  const pod: POD | null = q.data ?? pods.data?.find(p => p.id === id) ?? stopOfLocal?.pod ?? null;
  const stop = stops.find(st => st.id === pod?.tripStopId) ?? stopOfLocal ?? null;
  const ts = pod?.tripStop ?? stop;
  const ex = pod?.exceptions ?? [];
  const gap = pod ? Math.max(0, pod.unitsOrdered - pod.unitsDelivered) : 0;
  const credited = pod ? gap || ex.reduce((n, e) => n + (e.qty ?? 0), 0) : 0;
  const chip = ex[0] ? `${ex[0].qty ?? 1} ${(ex[0].type ?? 'exception').toLowerCase().replace(/_/g, ' ')}` : gap ? `${gap} short` : '';
  // the gap is only worth a note when the exceptions don't already explain it (1 tray crushed = the 1 short)
  const explained = ex.reduce((n, e) => n + (e.qty ?? 0), 0);
  const notes = [gap > explained && ex.length ? `${gap - explained} short` : '', ...ex.map(e => e.description ?? e.item ?? '').filter(Boolean)].filter(Boolean).join(' · ');
  const synced = pod?.syncedAt ?? (pod && !pod.savedOffline && !stopOfLocal ? pod.savedAt : null);
  // the signature: the one still on this phone (outbox), else the server's stored SVG
  const { items } = useOutbox();
  const localSig = [...items].reverse().find(i => i.kind === 'POD_PHOTO' && i.payload.kind === 'SIGNATURE' && i.ref === (pod?.tripStopId ?? stop?.id) && typeof i.payload.dataBase64 === 'string');
  const sigPath = pod?.signatureUrl && /^\/media\/pod-photos\/[\w-]+$/.test(pod.signatureUrl) ? pod.signatureUrl : null;
  const sigQ = useQuery<string>(!localSig && sigPath ? `sig.${sigPath}` : null, c => c.request<string>('GET', sigPath!, { headers: { Accept: 'image/svg+xml' } }).then(r => String(r.data)), { persist: true });
  const sigSvg = localSig ? String.fromCharCode(...base64ToBytes(localSig.payload.dataBase64)) : sigQ.data && /^<svg[\s>]/.test(sigQ.data) ? sigQ.data : null;
  const signedAt = localSig?.payload.takenAt ?? pod?.signedAt ?? null;
  const empty = !claims ? 'Sign in to see your records' : q.loading || pods.loading ? 'Loading…' : 'No record selected';
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v37}>
        <View style={s.v7}>
          <Tap lk="L265" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Proof of delivery"}</Text>
          </View>
          {pod ? (
            <View style={s.v6}>
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t5} numberOfLines={1} testID="pod-sync">{synced ? `Synced ${hm(synced)}` : 'Saved on this phone'}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v36}>
          <View style={s.v18}>
            <View>
              <Text style={s.t9}>{pod ? `${[ts ? `Stop ${ts.stopSeq}` : '', stop?.outlet?.name ?? ts?.outletId ?? '', stop?.order?.tempClass ? titleCase(stop.order.tempClass === 'AMBIENT' ? 'DRY' : stop.order.tempClass).toLowerCase() : ''].filter(Boolean).join(' · ')} ` : empty}{pod ? <Text style={s.t8}>{ts?.orderId ?? ''}</Text> : null}</Text>
            </View>
            {pod ? (
              <View style={s.v16}>
                <View style={s.v12}>
                  <Text style={s.t11} testID="pod-units">{String(pod.unitsDelivered)}<Text style={s.t10}>{`of ${pod.unitsOrdered}`}</Text></Text>
                </View>
                {chip ? (
                  <View style={s.v15}>
                    <View style={s.v13} />
                    <Text style={s.t14} numberOfLines={1}>{chip}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {notes ? (
              <View>
                <Text style={s.t17}>{notes}</Text>
              </View>
            ) : null}
          </View>
          {pod?.photoUrl ? (
            <View style={s.v25}>
              <View style={s.v21}>
                <View style={s.v12}>
                  <Text style={s.t19}>{"Photo"}</Text>
                </View>
                <View style={s.v12}>
                  <Text style={s.t20}>{hm(pod.savedAt)}</Text>
                </View>
              </View>
              <View style={s.v24}>
                <View style={s.v23}>
                  <Image source={{ uri: pod.photoUrl }} style={[s.v22, x.photo]} resizeMode="cover" />
                </View>
              </View>
            </View>
          ) : null}
          {pod?.receiverName || sigSvg || signedAt ? (
            <View style={s.v25}>
              <View style={s.v21}>
                <View style={s.v12}>
                  <Text style={s.t19} testID="signed-by">{pod?.receiverName ? `Signed by ${pod.receiverName}` : 'Signed'}</Text>
                </View>
                <View style={s.v12}>
                  <Text style={s.t20}>{"receiving"}</Text>
                </View>
              </View>
              <View style={s.v24}>
                <View style={s.v30}>
                  <SignatureView svg={sigSvg} caption={signedAt || sigSvg ? `Signed ${hm(signedAt ?? pod?.savedAt)}` : `Received ${hm(pod?.savedAt)} · no signature`} />
                </View>
              </View>
            </View>
          ) : null}
          {pod ? (
            <View style={s.v25}>
              <View style={s.v21}>
                <View style={s.v12}>
                  <Text style={s.t19}>{"Record"}</Text>
                </View>
              </View>
              <View style={s.v24}>
                {[
                  ts?.arrivalActual ? ['Arrived', hm(ts.arrivalActual)] : null,
                  ['Signed', hm(signedAt ?? pod.savedAt)],
                  ['Synced', synced ? hm(synced) : 'not yet'],
                ]
                  .filter((r): r is string[] => !!r)
                  .map(([k, v], i) => (
                    <View key={k} style={i === 0 ? s.v33 : s.v34}>
                      <View style={s.v12}>
                        <Text style={s.t31}>{k}</Text>
                      </View>
                      <View style={s.v12}>
                        <Text style={s.t32}>{v}</Text>
                      </View>
                    </View>
                  ))}
                {pod.creditNoteId ? (
                  <View style={s.v34}>
                    <View style={s.v12}>
                      <Text style={s.t31}>{`Credit note · ${plural(credited, 'unit')}`}</Text>
                    </View>
                    <View style={s.v12}>
                      <Text style={s.t35}>{pod.creditNoteId}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </Scroll>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({ photo: { width: '100%', height: 176 } });

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t11: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexShrink":1},
  v13: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#ff8a7a","borderRadius":3.5},
  t14: {"color":"#ff8a7a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#321210","borderRadius":14},
  v16: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t17: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v18: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  t19: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t20: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v21: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v22: {"flexShrink":1,"overflow":"hidden"},
  v23: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":176,"overflow":"hidden"},
  v24: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v26: {"position":"absolute","top":6,"bottom":42,"left":30,"right":65,"overflow":"hidden"},
  v27: {"position":"absolute","top":71,"right":16,"bottom":40,"left":16,"height":1,"backgroundColor":"#3b4666"},
  v28: {"position":"absolute","top":80.5,"right":218.2,"bottom":12,"left":16},
  v29: {"flexShrink":1,"height":112,"backgroundColor":"#0a0f1e","borderRadius":16,"overflow":"hidden"},
  v30: {"flexDirection":"column","alignItems":"stretch","paddingTop":14,"paddingRight":16,"paddingBottom":12,"paddingLeft":16},
  t31: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_400Regular"},
  t32: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"Inter_700Bold"},
  v33: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48},
  v34: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":48,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  t35: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"fontVariant":["tabular-nums"],"fontFamily":"JetBrainsMono_700Bold"},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v37: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
