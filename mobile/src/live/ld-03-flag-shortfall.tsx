// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-03 Flag shortfall (P3, phone)
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { CameraBox, useCamera } from '@/lodestar/camera';
import { recordShortfall } from '@/model/actions';
import { loadGroups, markLoading, shortfallFor, tempLabel } from '@/model/dock';
import { useClaims, useLoadSheet, useOnline, useParam } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L8":{"to":"ld-03-flag-acknowledged","kind":"go"},"C":{"to":"ld-02-load-sheet","kind":"back"}}};

const REASONS = ['Out of stock', 'Damaged', 'Wrong item', 'Temperature'] as const;

export default function ScreenLd03FlagShortfall() {
  const claims = useClaims();
  const online = useOnline();
  const sheet = useLoadSheet();
  const itemParam = useParam('item');
  const data = sheet.data;
  const trip = data?.trip;
  const ordered = loadGroups(data, () => false).flatMap(g => g.lines);
  const [picked, setPicked] = useState<string | null>(null);
  const want = picked ?? itemParam;
  const line = (want ? ordered.find(l => l.name === want) : undefined) ?? ordered[0] ?? null;
  const stop = line ? (data?.stops.find(st => st.orderId === line.orderId) ?? null) : null;
  const existing = line ? shortfallFor(sheet.shortfalls, line) : undefined;
  const [loadedSel, setLoaded] = useState<Record<string, number>>({});
  // the photo stays on the phone (proof for the loader); the flag itself carries the count and reason
  const cam = useCamera();
  const [camOpen, setCamOpen] = useState(false);
  const [photoAt, setPhotoAt] = useState<string | null>(null);
  const photo = async () => {
    if (!camOpen || !cam.granted) {
      if (!(await cam.ensure())) {
        showToast('No camera · the count and reason are enough', 'error');
        return false;
      }
      setCamOpen(true);
      return false;
    }
    const uri = await cam.capture();
    if (uri) {
      setPhotoAt(new Date().toISOString());
      setCamOpen(false);
    } else showToast('No photo taken · tap again', 'error');
    return false;
  };
  const [reasonSel, setReason] = useState<Record<string, string>>({});
  const qty = line?.qty ?? 0;
  const loaded = line ? (loadedSel[line.id] ?? existing?.qtyLoaded ?? Math.max(0, qty - 1)) : 0;
  const reason = line ? (reasonSel[line.id] ?? existing?.reason ?? REASONS[0]) : REASONS[0];
  const short = Math.max(0, qty - loaded);
  const empty = !claims ? 'Sign in to flag a line' : sheet.loading && !data ? 'Loading the load sheet…' : !data ? 'No load sheet saved yet' : 'No lines on this trip';

  const step = (d: number) => line && setLoaded(m => ({ ...m, [line.id]: Math.max(0, Math.min(qty, loaded + d)) }));
  const nextLine = () => {
    if (!line || ordered.length < 2) return;
    const i = ordered.findIndex(l => l.id === line.id);
    setPicked(ordered[(i + 1) % ordered.length]!.name);
  };

  const send = trip && line
    ? async () => {
        if (short <= 0) throw new Error('Nothing is short: loaded matches the order');
        // a flag opens the trip's load record: the trip is being loaded
        if (trip.status === 'PLANNED') await markLoading(trip.id, trip.vehicleId).catch(() => undefined);
        await recordShortfall(trip, data?.loadRecord?.id, sheet.shortfalls, { item: line.name, qtyOrdered: qty, qtyLoaded: loaded, reason, orderId: line.orderId });
        setTimeout(() => showToast(online ? 'Flag sent to dispatch, store and driver' : 'Flag saved on this phone · sends when there is signal'), 350);
      }
    : undefined;

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v61}>
        <View style={s.v6}>
          <Tap lk="C" style={s.v2} to={trip ? { to: 'ld-02-load-sheet', params: { trip: trip.id }, kind: 'back' } : undefined}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Flag a problem"}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v56}>
          <View style={s.v15}>
            <View style={s.v13}>
              <View style={s.v8}>
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={s.t7} numberOfLines={1}>{line ? tempLabel(line.tempClass) : "—"}</Text>
              </View>
              <View style={s.v9} />
              <View style={s.v11}>
                <Text style={s.t10}>{line?.orderId ?? "—"}</Text>
              </View>
              <View style={s.v9} />
              <Text style={s.t12}>{stop ? `Stop ${stop.stopSeq} ·` : "Stop —"}</Text>
              <View style={s.v11}>
                <Text style={s.t10}>{stop?.outletId ?? ""}</Text>
              </View>
            </View>
            <Tap to={null} onPress={nextLine} disabled={ordered.length < 2} testID="pick-line">
              <Text style={s.t14}>{line ? line.name : empty}</Text>
            </Tap>
          </View>
          <View style={s.v27}>
            <View style={s.v25}>
              <View style={s.v18}>
                <View>
                  <Text style={s.t12}>{"Short"}</Text>
                </View>
                <View>
                  <Text style={s.t17}>{line ? String(short) : "—"}<Text style={s.t16}>{` ${short === 1 ? "unit" : "units"}`}</Text></Text>
                </View>
              </View>
              <View style={s.v24}>
                <View>
                  <Text style={s.t12}>{"Loaded"}</Text>
                </View>
                <View style={s.v23}>
                  <Tap style={s.v20} to={null} onPress={() => step(-1)} disabled={!line || loaded <= 0} testID="qty-minus">
                    <Text style={s.t19}>{"−"}</Text>
                  </Tap>
                  <View style={s.v22}>
                    <Text style={s.t21} testID="qty-loaded">{line ? String(loaded) : "—"}</Text>
                  </View>
                  <Tap style={s.v20} to={null} onPress={() => step(1)} disabled={!line || loaded >= qty} testID="qty-plus">
                    <Text style={s.t19}>{"+"}</Text>
                  </Tap>
                </View>
              </View>
            </View>
            <View>
              <Text style={s.t26}>{line ? `Expected ${qty} · short is calculated for you` : "Short is calculated for you"}</Text>
            </View>
          </View>
          <View style={s.v36}>
            <View style={s.v30}>
              <View style={s.v11}>
                <Text style={s.t28}>{"Reason"}</Text>
              </View>
              <View style={s.v11}>
                <Text style={s.t29}>{"one tap"}</Text>
              </View>
            </View>
            <View style={s.v35}>
              {REASONS.map((r, i) => (
                <Tap key={r} style={reason === r ? s.v32 : s.v34} to={null} onPress={() => line && setReason(m => ({ ...m, [line.id]: r }))} testID={`reason-${i}`}>
                  <Icon xml={[X2, X3, X4, X5][i]!} width={20} height={20} style={s.v1} />
                  <Text style={reason === r ? s.t31 : s.t33}>{r}</Text>
                </Tap>
              ))}
            </View>
          </View>
          <View style={s.v43}>
            {camOpen && cam.granted ? <CameraBox cam={cam} style={x.cam} testID="flag-camera" /> : null}
            <Tap style={s.v42} to={null} onPress={photo} disabled={!line} testID="flag-photo">
              <View style={s.v37}>
                <Icon xml={X6} width={22} height={22} style={s.v1} />
              </View>
              <View style={s.v41}>
                <View>
                  <Text style={s.t38}>{photoAt ? `Photo ${hm(photoAt)}` : camOpen ? "Take the photo" : "Add photo"}</Text>
                </View>
                <View style={s.v40}>
                  <Text style={s.t39}>{photoAt ? "Saved on this phone" : "Optional"}</Text>
                </View>
              </View>
              <Icon xml={X7} width={18} height={18} style={s.v1} />
            </Tap>
          </View>
          <View style={s.v36}>
            <View style={s.v30}>
              <View style={s.v11}>
                <Text style={s.t28}>{"Dispatch, store and driver see this"}</Text>
              </View>
            </View>
            <View style={s.v55}>
              <View style={s.v54}>
                <View style={s.v53}>
                  <View style={s.v46}>
                    <View style={s.v44}>
                      <Icon xml={X8} width={12} height={12} style={s.v1} />
                    </View>
                    <View>
                      <Text style={s.t45} numberOfLines={1}>{"Received"}</Text>
                    </View>
                    <View>
                      <Text style={s.t12} numberOfLines={1}>{"·"}</Text>
                    </View>
                  </View>
                  <View style={s.v47} />
                  <View style={s.v46}>
                    <View style={s.v44}>
                      <Icon xml={X8} width={12} height={12} style={s.v1} />
                    </View>
                    <View>
                      <Text style={s.t45} numberOfLines={1}>{"Planned"}</Text>
                    </View>
                    <View>
                      <Text style={s.t12} numberOfLines={1}>{trip ? `v${trip.planVersion}` : "·"}</Text>
                    </View>
                  </View>
                  <View style={s.v47} />
                  <View style={s.v46}>
                    <View style={s.v48}>
                      <Icon xml={X9} width={12} height={12} style={s.v1} />
                    </View>
                    <View>
                      <Text style={s.t49} numberOfLines={1}>{line ? `Loaded −${short}` : "Loaded"}</Text>
                    </View>
                    <View>
                      <Text style={s.t12} numberOfLines={1}>{"now"}</Text>
                    </View>
                  </View>
                  <View style={s.v50} />
                  <View style={s.v46}>
                    <View style={s.v51} />
                    <View>
                      <Text style={s.t52} numberOfLines={1}>{"En route"}</Text>
                    </View>
                    <View>
                      <Text style={s.t12} numberOfLines={1}>{hm(trip?.departTime) || "·"}</Text>
                    </View>
                  </View>
                  <View style={s.v50} />
                  <View style={s.v46}>
                    <View style={s.v51} />
                    <View>
                      <Text style={s.t52} numberOfLines={1}>{"Delivered"}</Text>
                    </View>
                    <View>
                      <Text style={s.t12} numberOfLines={1}>{hm(stop?.etaModel ?? stop?.etaPlan) || "·"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v60}>
          <Tap lk="L8" style={s.v59} onPress={send} to={trip && line ? { to: 'ld-03-flag-acknowledged', params: { trip: trip.id, item: line.name } } : undefined}>
            <Grad g={G0} style={s.v57} />
            <Icon xml={X10} width={22} height={22} style={s.v1} />
            <Text style={s.t58}>{existing ? "Update flag" : "Send flag"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M18 6 6 18M6 6l12 12\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"m9 9 6 6M15 9l-6 6\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3M21 3l-7.83 7.83\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"12\" height=\"12\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"12\" height=\"12\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 8v5M12 17h.01\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m22 2-7 20-4-9-9-4Z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M22 2 11 13\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const x = StyleSheet.create({
  cam: { height: 200, backgroundColor: '#0a0f1a' },
});

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":0,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v9: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  t10: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v11: {"flexShrink":1},
  t12: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v13: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t14: {"color":"#0a0f1a","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v15: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t16: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t17: {"color":"#b42318","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v18: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexShrink":1},
  t19: {"color":"#0a0f1a","fontSize":26,"lineHeight":39,"fontFamily":"Inter_700Bold"},
  v20: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"width":52,"height":52,"backgroundColor":"#ffffff","borderRadius":14},
  t21: {"color":"#0a0f1a","fontSize":28,"lineHeight":42,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v22: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"minWidth":64},
  v23: {"flexDirection":"row","alignItems":"center","paddingTop":4,"paddingRight":4,"paddingBottom":4,"paddingLeft":4,"backgroundColor":"#e9ecf2","borderRadius":18},
  v24: {"flexDirection":"column","alignItems":"flex-end","rowGap":4,"columnGap":4,"flexShrink":1},
  v25: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  t26: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  t28: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t29: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t31: {"color":"#ffffff","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v32: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":16,"paddingLeft":16,"width":166,"height":60,"backgroundColor":"#141b4d","borderRadius":16,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 6px 16px 0px"},
  t33: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v34: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":16,"paddingLeft":16,"width":166,"height":60,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgba(0, 0, 0, 0.05) 0px 1px 2px 0px"},
  v35: {"flexDirection":"row","flexWrap":"wrap","alignItems":"stretch","rowGap":10,"columnGap":10,"marginRight":16,"marginLeft":16},
  v36: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t38: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t39: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v40: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v42: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v43: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v44: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#047857","borderWidth":2,"borderColor":"#047857","borderRadius":11,"boxShadow":"rgba(4, 120, 87, 0.25) 0px 2px 6px 0px"},
  t45: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v46: {"flexDirection":"column","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1,"width":62},
  v47: {"flexShrink":0,"marginTop":10,"marginRight":-16,"marginLeft":-16,"width":36,"height":2,"backgroundColor":"#047857"},
  v48: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#b45309","borderWidth":2,"borderColor":"#b45309","borderRadius":11},
  t49: {"color":"#b45309","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_800ExtraBold"},
  v50: {"flexShrink":0,"marginTop":10,"marginRight":-16,"marginLeft":-16,"width":36,"height":2,"backgroundColor":"#8f98aa"},
  v51: {"flexDirection":"row","justifyContent":"center","alignItems":"center","width":22,"height":22,"backgroundColor":"#ffffff","borderWidth":2,"borderColor":"#8f98aa","borderRadius":11},
  t52: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"textAlign":"center","fontFamily":"Inter_600SemiBold"},
  v53: {"flexDirection":"row","alignItems":"flex-start","flexShrink":1},
  v54: {"flexDirection":"row","justifyContent":"center","alignItems":"stretch","paddingTop":16,"paddingRight":8,"paddingBottom":14,"paddingLeft":8},
  v55: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v56: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v57: {"borderRadius":18},
  t58: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v59: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v60: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v61: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
