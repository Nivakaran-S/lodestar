// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-18 Problem detail · damaged goods · phone (P4, phone)
// The driver picks the damaged line (tap the item to cycle the order's lines), counts the units and may take a
// photo (kept on the phone; only "a photo was taken" travels). Saving queues a PROBLEM report to dispatch and goes
// back to the count (DR-03) with the damage in the route params (stop, damaged, item, note) for the POD exceptions.
import { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { CameraBox, useCamera } from '@/lodestar/camera';
import { reportToDispatch, stopContext } from '@/model/field-reports';
import { useOnline, useStop } from '@/model/hooks';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';
import { DRIVER_APP } from '@/lib/config';

const nav: ScreenNav = {"links":{"L255":{"to":"dr-03-proof-of-delivery","kind":"go"},"B":{"to":"dr-17-report-a-problem","kind":"back"}}};

export default function ScreenDr18ProblemDetailDamagedGoods() {
  const { stop, lines, trip } = useStop();
  const online = useOnline();
  const cam = useCamera();
  const order = stop?.order;
  const chilled = order?.tempClass === 'CHILLED';
  const [pick, setPick] = useState(0);
  const [units, setUnits] = useState(1);
  const [note, setNote] = useState('');
  const [photoAt, setPhotoAt] = useState<string | null>(null);
  const line = lines.length ? lines[pick % lines.length] : null;
  const sent = line?.qty ?? order?.units ?? 0;
  const count = Math.min(units, Math.max(sent, 1));
  const item = line?.name ?? (order ? `order ${order.id}` : '');
  const summary = item ? `${count} × ${item} damaged` : `${count} damaged`;
  const step = (d: number) => {
    setUnits(Math.max(1, Math.min(Math.max(sent, 1), count + d)));
    return false;
  };
  const photo = async () => {
    if (!cam.granted) {
      if (!(await cam.ensure())) showToast('No camera · the count is enough', 'error');
      return false;
    }
    const uri = await cam.capture();
    if (uri) setPhotoAt(new Date().toISOString());
    else showToast('No photo taken · the count is enough', 'error');
    return false;
  };
  const description = note.trim() || summary;
  const target: Target | undefined = stop ? { to: 'dr-03-proof-of-delivery', params: { stop: stop.id, damaged: String(count), ...(line ? { item: line.name } : {}), note: description } } : undefined;

  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v46}>
        <View style={s.v7}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v4}>
            <Text style={s.t3}>{"Damaged goods"}</Text>
          </View>
          {!online ? (
            <View style={s.v6}>
              <Icon xml={X1} width={14} height={14} style={s.v1} />
              <Text style={s.t5} numberOfLines={1}>{"Offline"}</Text>
            </View>
          ) : null}
        </View>
        <Scroll style={s.v4} contentStyle={s.v41}>
          <View style={s.v16}>
            <View style={s.v11}>
              <Text style={s.t8}>{stop ? `Stop ${stop.stopSeq} · ${chilled ? "chilled" : "dry"}` : "Stop —"}</Text>
              <View style={s.v10}>
                <Text style={s.t9}>{order?.id ?? "—"}</Text>
              </View>
            </View>
            <View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={summary}
                placeholderTextColor="#b5bdd1"
                multiline
                style={[s.t12, x.input]}
                testID="damage-note"
              />
            </View>
            <View style={s.v15}>
              <Icon xml={X2} width={14} height={14} style={s.v1} />
              <Text style={s.t13} numberOfLines={1}>{photoAt ? "Photo on the phone · count is yours to" : "Type what happened · count is yours to"}</Text>
              <View style={s.v10}>
                <Text style={s.t14} numberOfLines={1}>{"confirm"}</Text>
              </View>
            </View>
          </View>
          <View style={s.v32}>
            <View style={s.v26}>
              <Tap style={s.v20} onPress={() => {
                  if (lines.length > 1) setPick(p => p + 1);
                  return false;
                }} to={null} testID="damage-item">
                <View>
                  <Text style={s.t17}>{line?.name ?? (order ? `Order ${order.id}` : "—")}</Text>
                </View>
                <View style={s.v19}>
                  <Text style={s.t18}>{`${sent} sent · damaged${lines.length > 1 ? " · tap for another line" : ""}`}</Text>
                </View>
              </Tap>
              <View style={s.v25}>
                <Tap style={s.v22} onPress={() => step(-1)} to={null} testID="damage-minus">
                  <Text style={s.t21}>{"−"}</Text>
                </Tap>
                <View style={s.v24}>
                  <Text style={s.t23} testID="damage-units">{String(count)}</Text>
                </View>
                <Tap style={s.v22} onPress={() => step(1)} to={null} testID="damage-plus">
                  <Text style={s.t21}>{"+"}</Text>
                </Tap>
              </View>
            </View>
            <View style={s.v31}>
              <CameraBox cam={cam} style={s.v28}>
                {!cam.granted ? <Icon xml={X3} width={84} height={84} style={s.v27} /> : null}
              </CameraBox>
              <View style={s.v20}>
                <View>
                  <Text style={s.t17}>{photoAt ? `Photo ${hm(photoAt)}` : "No photo yet"}</Text>
                </View>
                <View style={s.v19}>
                  <Text style={s.t18}>{photoAt ? "Saved on the phone" : "Optional · stays on the phone"}</Text>
                </View>
              </View>
              <Tap style={s.v30} onPress={photo} to={null} testID="damage-photo">
                <Icon xml={X4} width={20} height={20} style={s.v1} />
                <Text style={s.t29}>{"Add"}</Text>
              </Tap>
            </View>
          </View>
          <View style={s.v40}>
            <View style={s.v34}>
              <View style={s.v10}>
                <Text style={s.t33}>{"Who's told"}</Text>
              </View>
            </View>
            <View style={s.v39}>
              <View style={s.v26}>
                <View style={s.v35}>
                  <Icon xml={X5} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v20}>
                  <View>
                    <Text style={s.t17}>{"Store, on the delivery"}</Text>
                  </View>
                  <View style={s.v19}>
                    <Text style={s.t18}>{`${stop?.outlet?.name ?? "The store"} sees it before signing`}</Text>
                  </View>
                </View>
                <View style={s.v37}>
                  <Icon xml={X6} width={14} height={14} style={s.v1} />
                  <Text style={s.t36} numberOfLines={1}>{"Now"}</Text>
                </View>
              </View>
              <View style={s.v31}>
                <View style={s.v38}>
                  <Icon xml={X7} width={22} height={22} style={s.v1} />
                </View>
                <View style={s.v20}>
                  <View>
                    <Text style={s.t17}>{"Dispatch"}</Text>
                  </View>
                  <View style={s.v19}>
                    <Text style={s.t18}>{online ? "Sent as soon as you save" : "Sent first when signal returns"}</Text>
                  </View>
                </View>
                <View style={s.v6}>
                  <Text style={s.t5} numberOfLines={1}>{online ? "On save" : "Queued"}</Text>
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v45}>
          <Tap
            lk="L255"
            style={s.v44}
            to={target}
            onPress={async () => {
              if (!stop) return !DRIVER_APP; // nothing loaded: the driver's app stays put; a design preview follows the prototype
              await reportToDispatch(
                stop.tripId,
                { report: 'PROBLEM', problem: 'DAMAGED_GOODS', stopId: stop.id, orderId: stop.orderId, units: count, ...(line ? { item: line.name } : {}), note: description, photo: !!photoAt },
                stop.id,
                stopContext(stop, trip?.vehicleId),
              );
              showToast(online ? 'Sent to dispatch' : 'Saved · sends when signal returns');
              return true;
            }}
          >
            <Grad g={G0} style={s.v42} />
            <Icon xml={X8} width={22} height={22} style={s.v1} />
            <Text style={s.t43}>{"Save and back to count"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  input: { padding: 0, margin: 0 },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#f2f4fa\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M19 3v4M17 5h4\" fill=\"none\" stroke=\"#a9b4ff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg width=\"84\" height=\"84\" viewBox=\"0 0 52 52\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"52\" height=\"52\" fill=\"#3a2f2a\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><rect x=\"6\" y=\"16\" width=\"40\" height=\"26\" rx=\"3\" fill=\"#c9b99a\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><rect x=\"9\" y=\"19\" width=\"16\" height=\"10\" rx=\"2\" fill=\"#e8c9a8\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><rect x=\"27\" y=\"19\" width=\"16\" height=\"10\" rx=\"2\" fill=\"#e8c9a8\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><rect x=\"9\" y=\"30\" width=\"16\" height=\"10\" rx=\"2\" fill=\"#e8c9a8\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M28 30 L44 42 M30 40 L42 30\" stroke=\"#8a2a20\" stroke-width=\"2.5\" fill=\"#000000\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" fill=\"none\" stroke=\"#d6cfc7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#111522\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#1a2340","borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t5: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t9: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v10: {"flexShrink":1},
  v11: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t12: {"color":"#f2f4fa","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t13: {"color":"#a9b4ff","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_600SemiBold"},
  t14: {"color":"#a9b4ff","fontSize":13,"lineHeight":17.6,"fontFamily":"Inter_800ExtraBold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5},
  v16: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t17: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t18: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v19: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v20: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t21: {"color":"#f2f4fa","fontSize":26,"lineHeight":39,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"width":52,"height":52,"backgroundColor":"#0a0f1e","borderRadius":14},
  t23: {"color":"#f2f4fa","fontSize":28,"lineHeight":42,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"minWidth":48},
  v25: {"flexDirection":"row","alignItems":"center","flexShrink":1,"paddingTop":4,"paddingRight":4,"paddingBottom":4,"paddingLeft":4,"backgroundColor":"#1a2340","borderRadius":18},
  v26: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64},
  v27: {"overflow":"hidden"},
  v28: {"flexShrink":0,"width":84,"height":84,"borderRadius":16,"boxShadow":"rgb(255, 138, 122) 0px 0px 0px 2px","overflow":"hidden"},
  t29: {"color":"#b5bdd1","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":2,"columnGap":2,"flexShrink":0,"width":56,"height":56,"borderWidth":1,"borderColor":"#3b4666","borderStyle":"dashed","borderRadius":14},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16,"minHeight":64,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v32: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  t33: {"color":"#f2f4fa","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v34: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v35: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#0d2a20","borderRadius":14},
  t36: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v37: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v38: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  v39: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":10,"paddingBottom":16},
  v42: {"borderRadius":18},
  t43: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v44: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px"},
  v45: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v46: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
