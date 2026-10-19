// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-13 Saving run for offline · phone (P4, phone)
// Saves today's run into the phone's cache, the same entries the run screens read with no signal: the run with its
// stops and outlets, every order's lines (the POD count), and dispatch notices. When all are saved it marks the run
// saved on this phone and moves on to DR-14 (the design's automatic step). The network name and the known
// signal-loss place are not in the data: left out.
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { dayLabel, hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import * as api from '@/model/api';
import { shapeRun, today, useClaims, useOnline, useParam } from '@/model/hooks';
import { prefetch } from '@/model/query';
import { setRunMark } from '@/model/run';
import { Frame, Grad, Icon, Scroll, Tap, openScreen, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{"L45":{"to":"dr-34-voice-pack-downloading","kind":"go"}}};

type Part = { label: string; sub: string; done: boolean };
type Saved = { orders: number; lines: number; stops: number; bytes: number; loadedAt?: string | null; tripId?: string };

const size = (v: unknown) => JSON.stringify(v ?? null).length;
const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function ScreenDr13SavingRunForOffline() {
  const claims = useClaims();
  const online = useOnline();
  const param = useParam('trip');
  const day = today();
  const [steps, setSteps] = useState({ route: false, orders: false, lines: 0, linesOf: 0, notes: false });
  const [saved, setSaved] = useState<Saved>({ orders: 0, lines: 0, stops: 0, bytes: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!claims || !online) return;
    let live = true;
    (async () => {
      setFailed(false);
      const run = await prefetch(`run.${day}`, c => api.driverRun(c, day));
      if (!live) return;
      if (!run) { setFailed(true); return; }
      const view = shapeRun(run, []);
      const trip = run.trips.find(t => t.id === param) ?? view?.trip ?? null;
      const stops = trip ? run.stops.filter(st => st.tripId === trip.id) : [];
      const orderIds = [...new Set(stops.map(st => st.orderId))];
      let bytes = size(run);
      setSaved({ orders: orderIds.length, lines: 0, stops: new Set(stops.map(st => st.stopSeq)).size, bytes, loadedAt: trip?.loadRecord?.releasedAt ?? trip?.departTime, tripId: trip?.id });
      setSteps(st => ({ ...st, route: true, orders: true, linesOf: orderIds.length }));
      let lines = 0;
      for (const id of orderIds) {
        const ls = await prefetch(`lines.${id}`, c => api.orderLines(c, [id]));
        if (!live) return;
        if (!ls) { setFailed(true); return; }
        lines += ls.length;
        bytes += size(ls);
        setSaved(sv => ({ ...sv, lines, bytes }));
        setSteps(st => ({ ...st, lines: st.lines + 1 }));
      }
      const notes = await prefetch('notifications', c => api.notifications(c));
      if (!live) return;
      bytes += size(notes);
      setSaved(sv => ({ ...sv, bytes }));
      setSteps(st => ({ ...st, notes: true }));
      if (trip) await setRunMark('saved', trip.id);
      if (live) openScreen('dr-14-run-ready-available-offline', trip ? { trip: trip.id } : undefined, 'nav');
    })().catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [claims, online, day, param]);

  const total = 3 + Math.max(1, steps.linesOf);
  const done = (steps.route ? 1 : 0) + (steps.orders ? 1 : 0) + steps.lines + (steps.notes ? 1 : 0);
  const pct = Math.min(100, Math.round((done / total) * 100));
  const parts: Part[] = [
    { label: saved.stops ? `Route and ${plural(saved.stops, 'stop')}` : 'Route and stops', sub: steps.route ? 'saved' : 'waiting', done: steps.route },
    { label: plural(saved.orders, 'order'), sub: saved.loadedAt ? `as loaded ${hm(saved.loadedAt)}` : steps.orders ? 'saved' : 'waiting', done: steps.orders },
    { label: plural(saved.lines, 'line'), sub: "for counting at the door", done: steps.linesOf > 0 && steps.lines === steps.linesOf },
    { label: "Store notes and photos", sub: steps.notes ? kb(saved.bytes) : 'waiting', done: steps.notes },
  ];
  const status = !claims ? 'Sign in to save your run' : !online ? 'No signal · connect to save the run' : failed ? "Couldn't save everything · retrying with signal" : pct >= 100 ? 'Saved' : `${done} of ${total} saved`;
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v38}>
        <View style={s.v6}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v4}>
            <Text style={s.t3}>{dayLabel(day)}</Text>
          </View>
          <View style={s.v5} />
        </View>
        <Scroll style={s.v4} contentStyle={s.v33}>
          <Tap lk="L45" style={s.v18}>
            <View>
              <Text style={s.t7}>{"Saving your run to this phone"}</Text>
            </View>
            <View style={s.v13}>
              <View style={s.v10}>
                <Text style={s.t9} testID="save-pct">{String(pct)}<Text style={s.t8}>{"%"}</Text></Text>
              </View>
              <View style={s.v12}>
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={s.t11} numberOfLines={1}>{online ? 'Online' : 'No signal'}</Text>
              </View>
            </View>
            <View style={s.v16}>
              <View style={[s.v15, { width: `${pct}%` }]}>
                <Grad g={G0} style={s.v14} />
              </View>
            </View>
            <View>
              <Text style={s.t17} testID="save-status">{status}</Text>
            </View>
          </Tap>
          <View style={s.v28}>
            {parts.map((p, i) => (
              <View key={i} style={i === 0 ? s.v25 : s.v26}>
                <View style={s.v19}>
                  <Icon xml={[X2, X4, X5, X6][i]} width={19} height={19} style={s.v1} />
                </View>
                <View style={s.v23}>
                  <View>
                    <Text style={s.t20}>{p.label}</Text>
                  </View>
                  <View style={s.v22}>
                    <Text style={s.t21}>{p.sub}</Text>
                  </View>
                </View>
                <View style={p.done ? s.v24 : s.v27}>
                  <Icon xml={p.done ? X3 : X7} width={20} height={20} style={s.v1} />
                </View>
              </View>
            ))}
          </View>
        </Scroll>
        <View style={s.v37}>
          <View style={s.v36}>
            <Grad g={G1} style={s.v34} />
            <Text style={s.t35}>{"Saving, one moment"}</Text>
          </View>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#0369a1\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"m3 11 19-9-9 19-2-8-8-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 3-6 3v15l6-3 6 3 6-3V3l-6 3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M9 3v15M15 6v15\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#5ee0a8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"19\" height=\"19\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"12\" cy=\"13\" r=\"3\" fill=\"none\" stroke=\"#b5bdd1\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 12a9 9 0 1 1-3-6.7L21 8\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M21 3v5h-5\" fill=\"none\" stroke=\"#6cc4f5\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":0.6},{"c":"#eda422","p":1}]}];

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#0a0f1e","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#f2f4fa","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v4: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v5: {"flexShrink":1,"width":40},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t7: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t8: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t9: {"color":"#f2f4fa","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexShrink":1},
  t11: {"color":"#6cc4f5","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v12: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0b2233","borderRadius":14},
  v13: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v14: {"borderRadius":4},
  v15: {"flexShrink":1,"width":"82%","borderRadius":4},
  v16: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#1a2340","borderRadius":4,"overflow":"hidden"},
  t17: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v18: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":24},
  v19: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":38,"height":38,"backgroundColor":"#1a2340","borderRadius":12},
  t20: {"color":"#f2f4fa","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t21: {"color":"#b5bdd1","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v22: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v23: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v24: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#0d2a20","borderRadius":18},
  v25: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56},
  v26: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#1b2338"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":36,"height":36,"backgroundColor":"#0b2233","borderRadius":18},
  v28: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#121a2e","borderRadius":20,"overflow":"hidden"},
  v29: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t30: {"color":"#d6cfc7","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v31: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v32: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":20,"columnGap":20,"paddingTop":4,"paddingBottom":16},
  v34: {"borderRadius":18},
  t35: {"color":"#111522","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v36: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(245, 184, 61, 0.22) 0px 8px 24px 0px","opacity":0.45},
  v37: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#070b16"},
  v38: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#070b16"},
}));
