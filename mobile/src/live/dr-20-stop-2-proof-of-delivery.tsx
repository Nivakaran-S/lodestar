// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-20 Stop 2 proof of delivery · phone (P4, phone)
// Live: the POD of the stop after the current one (or route param `stop`), same behaviour as DR-03.
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { useCallback, useState } from 'react';
import { hm } from '@/lib/time';
import { CameraBox, useCamera } from '@/lodestar/camera';
import { plural } from '@/lodestar/live';
import { showToast } from '@/lodestar/runtime';
import { completeStop, queuePodPhoto, queuePodSignature } from '@/model/actions';
import { SignaturePad } from '@/lodestar/signature';
import { afterPod } from '@/model/run';
import { useOnline, useOutbox, useStop } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L20":{"to":"dr-04-run-complete","kind":"go"},"L260":{"to":"dr-16-store-code-entry","kind":"go"},"B":{"to":"dr-19-stop-2-arrival-hawa-eliya","kind":"back"}}};

export default function ScreenDr20Stop2ProofOfDelivery() {
  const { stop, trip, view, lines } = useStop(1);
  const online = useOnline();
  const order = stop?.order;
  const pod = stop?.pod ?? null;
  const chilled = order?.tempClass === 'CHILLED';
  const shortfalls = trip?.loadRecord?.shortfalls ?? [];
  const short = lines.reduce((n, l) => {
    const sf = shortfalls.find(x => x.item === l.name);
    return n + (sf ? Math.max(0, sf.qtyOrdered - sf.qtyLoaded) : 0);
  }, 0);
  const ordered = order?.units ?? 0;
  const [units, setUnits] = useState<number | null>(null);
  const [receiver, setReceiver] = useState('');
  // the receiver signs on the pad (or the store code on DR-16 stands in): Complete stop needs one of them
  const [signature, setSignature] = useState<{ svg: string; at: string } | null>(null);
  const sign = useCallback((svg: string | null) => setSignature(svg ? { svg, at: new Date().toISOString() } : null), []);
  // the photo of the drop: compressed, saved in the outbox and uploaded with signal (POD_PHOTO); the server links it to the POD
  const cam = useCamera();
  const { items } = useOutbox();
  const photos = items.filter(i => i.kind === 'POD_PHOTO' && i.payload.kind !== 'SIGNATURE' && i.ref === stop?.id && i.status !== 'rejected');
  const lastPhoto = photos[photos.length - 1];
  const photoAt = lastPhoto?.payload.takenAt ?? lastPhoto?.savedAt ?? null;
  const photo = async () => {
    if (!cam.granted) {
      if (!(await cam.ensure())) showToast('No camera · the count and the name are enough', 'error');
      return false;
    }
    const pic = await cam.capturePhoto();
    if (!pic) showToast('No photo taken · the count and the name are enough', 'error');
    else if (stop) {
      await queuePodPhoto(stop, pic);
      showToast(online ? 'Photo saved · sending' : 'Photo saved on this phone · sends with signal');
    }
    return false;
  };
  const count = units ?? pod?.unitsDelivered ?? Math.max(0, ordered - short);
  const delivered = stop?.status === 'DELIVERED';

  const step = (d: number) => setUnits(Math.max(0, Math.min(ordered, count + d)));
  const missing = Math.max(0, ordered - count);
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v51}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Proof of delivery"}</Text>
          </View>
          <View style={s.v6}>
            <Icon xml={X1} width={14} height={14} style={s.v1} />
            <Text style={s.t5} numberOfLines={1}>{online ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <Scroll style={s.v4} contentStyle={s.v44}>
          <View style={s.v18}>
            <View>
              <Text style={s.t9}>{`Received · ${chilled ? 'chilled' : 'dry'} `}<Text style={s.t8}>{order?.id ?? '—'}</Text></Text>
            </View>
            <View style={s.v16}>
              <View style={s.v12}>
                <Text style={s.t11} testID="pod-count">{String(count)}<Text style={s.t10}>{`of ${ordered}`}</Text></Text>
              </View>
              <View style={s.v15}>
                <View style={s.v13} />
                <Text style={s.t14} numberOfLines={1}>{missing ? `${missing} short` : order ? 'All received' : '—'}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t17}>{stop ? `${stop.outlet?.name ?? 'Outlet'} · ` : ''}<Text style={s.t8}>{stop?.outletId ?? '—'}</Text>{short ? ` · ${short} short at the dock, locked` : ' · counted with the store'}</Text>
            </View>
          </View>
          <View style={s.v32}>
            <View style={s.v26}>
              <View style={s.v19}>
                <Icon xml={X2} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v23}>
                <View>
                  <Text style={s.t20}>{`${plural(lines.length, 'line')} · ${missing ? `${missing} short` : 'all counted'}`}</Text>
                </View>
                <View style={s.v22}>
                  <Text style={s.t21}>{missing ? 'units received of ordered' : 'none short or damaged'}</Text>
                </View>
              </View>
              <View style={s.v25}>
                <Tap style={s.v2} onPress={() => step(-1)} to={null} testID="units-minus">
                  <Text style={s.t20}>{"−"}</Text>
                </Tap>
                <View style={s.v12}>
                  <Text style={s.t24}>{`${count}/${ordered}`}</Text>
                </View>
                <Tap style={s.v2} onPress={() => step(1)} to={null} testID="units-plus">
                  <Text style={s.t20}>{"+"}</Text>
                </Tap>
              </View>
            </View>
            <View style={s.v31}>
              {/* the viewfinder (a sample photo is never drawn: empty until the camera is on) */}
              <CameraBox cam={cam} style={[s.v28, x.empty]} testID="drop-camera" />
              <View style={s.v23}>
                <View>
                  <Text style={s.t20}>{"Photo of the drop"}</Text>
                </View>
                <View style={s.v22}>
                  <Text style={s.t21} testID="drop-photo-state">{photoAt ? `${hm(photoAt)} · ${lastPhoto?.status === 'synced' ? 'sent' : 'saved on phone'}${photos.length > 1 ? ` · ${photos.length} photos` : ''}` : pod?.photoCount ? `${plural(pod.photoCount, 'photo')} · sent` : pod?.photoUrl ? `${hm(pod.savedAt)} · ${pod.savedOffline ? 'saved on phone' : 'sent'}` : 'Optional · none yet'}</Text>
                </View>
              </View>
              <Tap style={s.v30} onPress={photo} to={null} testID="drop-photo">
                <Icon xml={X5} width={20} height={20} style={s.v1} />
                <Text style={s.t29}>{cam.granted ? 'Take' : 'Add'}</Text>
              </Tap>
            </View>
          </View>
          <View style={s.v43}>
            <View style={s.v35}>
              <View style={s.v12}>
                <Text style={s.t33}>{"Received by store receiving"}</Text>
              </View>
              <View style={s.v12}>
                <Text style={s.t34}><Text style={s.t8}>{stop?.outletId ?? '—'}</Text></Text>
              </View>
            </View>
            <View style={s.v42}>
              <View style={s.v41}>
                <TextInput
                  value={receiver || pod?.receiverName || ''}
                  onChangeText={setReceiver}
                  placeholder="Name of the person receiving"
                  placeholderTextColor="#7f89a3"
                  style={[s.t20, { paddingTop: 12, paddingBottom: 4 }]}
                  testID="receiver-name"
                  autoCorrect={false}
                  autoCapitalize="words"
                  autoComplete="name"
                />
                <View style={{ paddingBottom: 12 }}>
                  <SignaturePad
                    onChange={sign}
                    caption={signature ? `Signed ${hm(signature.at)} · ${online ? 'sent when you complete' : 'saved on phone'}` : pod ? `Saved ${hm(pod.savedAt)}${pod.savedOffline ? ' · saved on phone' : ''}` : 'Receiver signs above the line'}
                  />
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v50}>
          <Tap
            lk="L20"
            style={[s.v47, !signature && !delivered ? { opacity: 0.55 } : null]}
            to={stop ? afterPod(view, stop) : undefined}
            onPress={async () => {
              if (!stop || !order) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
              if (delivered) return true;
              if (!signature) {
                showToast("Ask the receiver to sign · or use the store code if they can't", 'error');
                return false;
              }
              await queuePodSignature(stop, { svg: signature.svg, signedAt: signature.at, signedBy: receiver.trim() || undefined });
              await completeStop(stop, { unitsDelivered: count, unitsOrdered: ordered, receiverName: receiver.trim() || undefined });
              showToast(online ? 'Stop completed · sending' : 'Saved on this phone · sends when there is signal');
              return true;
            }}
          >
            <Grad g={G0} style={s.v45} />
            <Icon xml={X7} width={22} height={22} style={s.v1} />
            <Text style={s.t46}>{delivered ? 'Next' : "Complete stop"}</Text>
          </Tap>
          <Tap lk="L260" style={s.v49} to={stop ? { to: 'dr-16-store-code-entry', params: { stop: stop.id } } : undefined}>
            <Icon xml={X8} width={18} height={18} style={s.v1} />
            <Text style={s.t48}>{"Can't sign? Use store OTP"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 4 3 2 3-2M9 20l3-2 3 2\" fill=\"none\" stroke=\"#67e3f9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M11 18h2\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const x = StyleSheet.create({ empty: { backgroundColor: '#1a2340' } });

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t10: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t11: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v12: {"flexShrink":1},
  v13: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#5ee0a8","borderRadius":3.5},
  t14: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  v16: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t17: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v18: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  v19: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#082b33","borderRadius":14},
  t20: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v22: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v23: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t24: {"color":"#5ee0a8","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v25: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1},
  v26: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v27: {"overflow":"hidden"},
  v28: {"flexShrink":0,"width":56,"height":56,"borderRadius":14,"overflow":"hidden"},
  t29: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":2,"columnGap":2,"flexShrink":0,"width":56,"height":56,"borderWidth":1,"borderColor":"#3b4666","borderStyle":"dashed","borderRadius":14},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t33: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t34: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v35: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v36: {"position":"absolute","top":6,"bottom":46,"left":30,"right":80,"overflow":"hidden"},
  v37: {"position":"absolute","top":71,"right":16,"bottom":40,"left":16,"height":1,"backgroundColor":"#3b4666"},
  v38: {"position":"absolute","top":80.5,"right":108.9,"bottom":12,"left":16},
  v39: {"flexDirection":"row","alignItems":"center","paddingRight":12,"paddingLeft":12,"position":"absolute","top":10,"right":10,"bottom":70,"left":242.1,"height":32,"backgroundColor":"#1a2340","borderRadius":10},
  v40: {"flexShrink":1,"height":112,"backgroundColor":"#0a0f1e","borderRadius":16,"overflow":"hidden"},
  v41: {"flexDirection":"column","alignItems":"stretch","paddingTop":14,"paddingRight":16,"paddingBottom":12,"paddingLeft":16},
  v42: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v44: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":8},
  v45: {"borderRadius":18},
  t46: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v47: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  t48: {"color":"#b5bdd1","fontSize":15,"lineHeight":22.5,"letterSpacing":-0.1,"fontFamily":"Inter_700Bold"},
  v49: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":44,"borderRadius":18},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v51: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
