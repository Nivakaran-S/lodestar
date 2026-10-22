// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-02 Load sheet · Phone (P3, phone)
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { LANGUAGE_NAMES, useSettings } from '@/lib/settings';
import { speakIn } from '@/lodestar/voice';
import { useClaims, useLoadSheet } from '@/model/hooks';
import { loadGroups, ordinal, reeferOf, shortfallFor, tempLabel, useOpenRePlan, useRePlanAlert, useMarkLoading, useTicks, type LoadGroup } from '@/model/dock';
import type { OrderLineItem } from '@/model/types';
import { truckSvg } from '@/lodestar/truck';
import { TruckDiagram } from '@/lodestar/truck-view';
import { Frame, Grad, Icon, Scroll, Tap, openScreen, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L7":{"to":"ld-03-flag-shortfall","kind":"go"},"L64":{"to":"ld-03-flag-shortfall","kind":"go"},"L195":{"to":"ld-30-load-sheet-speaking","kind":"go"},"L196":{"to":"ld-28-voice-and-language","kind":"go"},"B":{"to":"ld-01-dock-queue","kind":"back"}}};

const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

export default function ScreenLd02LoadSheet() {
  const claims = useClaims();
  const sheet = useLoadSheet();
  const data = sheet.data;
  const trip = data?.trip;
  const t = useTicks(sheet.tripId, sheet.data?.trip?.status);
  useMarkLoading(data?.trip, !!data?.loadRecord || sheet.shortfalls.length > 0 || Object.keys(t.map).length > 0);
  // dispatch re-plans while this trip is loading: locked while the draft is open (LD-18), then what changed (LD-12)
  useRePlanAlert(trip?.depot, planId => trip && openScreen('ld-12-plan-changed', { trip: trip.id, plan: planId }));
  const lockedBy = useOpenRePlan(trip).data?.id;
  const tripId = trip?.id;
  useEffect(() => {
    if (lockedBy && tripId) openScreen('ld-18-plan-locked', { trip: tripId }, 'nav');
  }, [lockedBy, tripId]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const flagged = (l: OrderLineItem) => shortfallFor(sheet.shortfalls, l);
  const accounted = (l: OrderLineItem) => t.isTicked(l.id) || !!flagged(l);
  const groups = loadGroups(data, accounted);
  const truck = truckSvg(groups);
  const lines = groups.flatMap(g => g.lines);
  const total = lines.length;
  const done = lines.filter(accounted).length;
  const current = lines.find(l => !accounted(l)) ?? null;
  const { language, readAloud } = useSettings();
  const currentGroup = groups.find(g => g.ticked < g.lines.length) ?? null;
  const temp = reeferOf(trip, data?.loadRecord);
  const kg = data ? data.stops.reduce((n, st) => n + (st.order?.kg ?? 0), 0) : 0;
  const m3 = data ? data.stops.reduce((n, st) => n + (st.order?.m3 ?? 0), 0) : 0;
  const capKg = trip?.vehicle?.capacityKg;
  const capM3 = trip?.vehicle?.capacityM3;
  const empty = !claims ? 'Sign in to see the load sheet' : sheet.loading && !data ? 'Loading the load sheet…' : sheet.error && !data ? 'No signal · load sheet not saved yet' : !data ? 'No trip to load' : total ? '' : 'No lines on this trip';
  const flagTo = (l: OrderLineItem) => (trip ? { to: 'ld-03-flag-shortfall', params: { trip: trip.id, item: l.name } } : undefined);
  const banner = !data
    ? empty
    : sheet.released
      ? `Released · ${sheet.released.status === 'synced' ? 'sent' : 'saved on this phone'}`
      : [trip?.bay ? `Bay ${trip.bay}` : '', trip?.district, currentGroup ? `load stop ${currentGroup.stop.stopSeq} first` : total ? 'all lines loaded' : ''].filter(Boolean).join(' · ');
  // the current line is always in an open group, so it carries L7; otherwise a fallback row does
  const l7Used = !!current;

  const lineRow = (g: LoadGroup, l: OrderLineItem, i: number) => {
    const sf = flagged(l);
    const ticked = t.isTicked(l.id);
    const isCurrent = current?.id === l.id;
    const info = (
      <>
        {ticked ? (
          <View style={s.v30}>
            <Icon xml={X3} width={22} height={22} style={s.v1} />
          </View>
        ) : (
          <View style={s.v45} />
        )}
        <View style={s.v34}>
          <View>
            <Text style={s.t31}>{l.name}</Text>
          </View>
          <View style={s.v25}>
            <View style={s.v24}>
              <Icon xml={X2} width={14} height={14} style={s.v1} />
              <Text style={s.t43} numberOfLines={1}>{tempLabel(l.tempClass)}</Text>
            </View>
            <View style={s.v22} />
            <Text style={s.t33}>{sf ? `short ${Math.max(0, sf.qtyOrdered - sf.qtyLoaded)} · ${sf.reason}` : `${n0(l.kg)} kg`}</Text>
          </View>
        </View>
        <View style={s.v37}>
          <View>
            <Text style={s.t35}>{sf ? `${sf.qtyLoaded}/${l.qty}` : l.qty}</Text>
          </View>
          <View>
            <Text style={s.t36}>{l.qty === 1 ? "unit" : "units"}</Text>
          </View>
        </View>
      </>
    );
    if (isCurrent) {
      return (
        <Tap key={l.id} lk="L7" style={s.v47} to={flagTo(l)} label={`Flag a problem with ${l.name}`}>
          {info}
          <View style={s.v46}>
            <Icon xml={X4} width={22} height={22} style={s.v1} />
          </View>
        </Tap>
      );
    }
    return (
      <Tap key={l.id} style={[s.v44, i > 0 && x.border]} to={sf ? flagTo(l) : null} onPress={sf ? undefined : () => t.toggle(l.id)} testID={`line-row-${g.order}-${i}`} label={sf ? `Flag a problem with ${l.name}` : `${ticked ? 'Untick' : 'Tick'} ${l.name}`}>
        {info}
        {sf ? (
          <View style={s.v46}>
            <Icon xml={X4} width={22} height={22} style={s.v1} />
          </View>
        ) : null}
      </Tap>
    );
  };

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v62}>
        <View style={s.v8}>
          <Tap lk="B" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <Text style={s.t4}><Text style={s.t3}>{trip?.vehicleId ?? "—"}</Text>{trip?.departTime ? ` · departs ${hm(trip.departTime)}` : ""}</Text>
          </View>
          <View style={s.v7}>
            <Text style={s.t6} numberOfLines={1}>{trip ? `Plan v${trip.planVersion}` : "Plan —"}</Text>
          </View>
        </View>
        <Scroll style={s.v5} contentStyle={s.v50}>
          <View style={s.v10}>
            <View>
              <Text style={s.t9} testID="load-banner">{banner || " "}</Text>
            </View>
          </View>
          <View style={s.v29}>
            <View style={s.v16}>
              <View style={s.v13}>
                <Text style={s.t12}>{data ? String(done) : "—"}<Text style={s.t11}>{` of ${total} ${total === 1 ? 'line' : 'lines'}`}</Text></Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t14} numberOfLines={1}>{data ? `${total - done} to go${sheet.shortfalls.length ? ` · ${sheet.shortfalls.length} short` : ""}` : "—"}</Text>
              </View>
            </View>
            <View style={s.v19}>
              <View style={[s.v18, { width: `${total ? Math.round((done / total) * 100) : 0}%` }]}>
                <Grad g={G0} style={s.v17} />
              </View>
            </View>
            <View style={s.v26}>
              {truck ? <TruckDiagram xml={truck} style={s.v20} /> : null}
              <View style={s.v25}>
                <Text style={s.t21}>{"Cab left, rear doors right"}</Text>
                <View style={s.v22} />
                <View style={s.v24}>
                  <Icon xml={X2} width={14} height={14} style={s.v1} />
                  <Text style={s.t23} numberOfLines={1}>{temp !== undefined ? `top zone ${temp} °C` : trip?.vehicle?.tempClass === "AMBIENT" ? "ambient" : "reefer —"}</Text>
                </View>
              </View>
            </View>
            <View>
              <Text style={s.t28}>{"Weight "}<Text style={s.t27}>{capKg ? `${n0(kg)} / ${n0(capKg)} kg` : "—"}</Text>{capKg ? ` (${Math.round((kg / capKg) * 100)}%)` : ""}{" · Volume "}<Text style={s.t27}>{capM3 ? `${n0(m3)} / ${n0(capM3)} m³` : "—"}</Text></Text>
            </View>
          </View>
          {groups.map(g => {
            const title = `${ordinal(g.order)} · Stop ${g.stop.stopSeq} · ${g.stop.outlet?.name ?? g.stop.outletId}`;
            const complete = g.lines.length > 0 && g.ticked === g.lines.length;
            if (complete && !open[g.stop.id]) {
              return (
                <View key={g.stop.id} style={s.v39}>
                  <Tap style={s.v38} to={null} onPress={() => setOpen(o => ({ ...o, [g.stop.id]: true }))} testID={`group-${g.order}`}>
                    <View style={s.v30}>
                      <Icon xml={X3} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v34}>
                      <View>
                        <Text style={s.t31}>{title}</Text>
                      </View>
                      <View style={s.v25}>
                        <View style={s.v13}>
                          <Text style={s.t32}>{g.stop.orderId}</Text>
                        </View>
                        <View style={s.v22} />
                        <Text style={s.t33}>{tempLabel(g.stop.order?.tempClass) || "all loaded"}</Text>
                      </View>
                    </View>
                    <View style={s.v37}>
                      <View>
                        <Text style={s.t35}>{`${g.ticked}/${g.lines.length}`}</Text>
                      </View>
                      <View>
                        <Text style={s.t36}>{"lines"}</Text>
                      </View>
                    </View>
                  </Tap>
                </View>
              );
            }
            return (
              <View key={g.stop.id} style={s.v49}>
                <View style={s.v42}>
                  <View style={s.v13}>
                    <Text style={s.t40}>{title}</Text>
                  </View>
                  <View style={s.v13}>
                    <Text style={s.t41}>{`${g.ticked} of ${g.lines.length}`}</Text>
                  </View>
                </View>
                <View style={s.v48}>
                  {g.lines.length ? g.lines.map((l, i) => lineRow(g, l, i)) : (
                    <View style={s.v44}>
                      <View style={s.v34}>
                        <Text style={s.t33}>{"No lines on this order"}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          {!l7Used ? (
            <View style={s.v48}>
              <Tap lk="L7" style={s.v47} to={trip ? { to: "ld-03-flag-shortfall", params: { trip: trip.id } } : undefined} label="Flag a problem with this load">
                <View style={s.v45} />
                <View style={s.v34}>
                  <View>
                    <Text style={s.t31}>{data ? "Flag a problem with this load" : empty}</Text>
                  </View>
                </View>
                <View style={s.v46}>
                  <Icon xml={X4} width={22} height={22} style={s.v1} />
                </View>
              </Tap>
            </View>
          ) : null}
        </Scroll>
        <View style={s.v61}>
          <View style={s.v57}>
            <Tap
              lk="L195"
              style={s.v52}
              to={trip ? { to: 'ld-30-load-sheet-speaking', params: { trip: trip.id } } : undefined}
              // LD-30 reads the line by itself when read aloud is on; with it off, this tap still says the next line once
              onPress={() => {
                if (!readAloud && current) speakIn(`${current.name}. ${current.qty}`, language);
              }}
            >
              <Icon xml={X5} width={22} height={22} style={s.v1} />
              <Text style={s.t51} numberOfLines={1}>{"Read next line"}</Text>
            </Tap>
            <View style={s.v56}>
              <View>
                <Text style={s.t54}>{readAloud ? "Read aloud · " : "Voice off · "}<Text><Text style={s.t53}>{LANGUAGE_NAMES[language]}</Text></Text></Text>
              </View>
              <Tap lk="L196" to={trip ? { to: 'ld-28-voice-and-language', params: { trip: trip.id } } : undefined}>
                <Text style={s.t55}>{"Voice on this phone, works offline"}</Text>
              </Tap>
            </View>
          </View>
          <Tap
            lk="L64"
            style={s.v60}
            onPress={current ? () => t.tick(current.id) : undefined}
            to={current ? null : trip ? { to: "ld-04-release-vehicle", params: { trip: trip.id } } : undefined}
          >
            <Grad g={G1} style={s.v58} />
            <Icon xml={X6} width={22} height={22} style={s.v1} />
            <Text style={s.t59} numberOfLines={1}>{current ? `Tick ${current.name}` : trip ? "Release vehicle" : "Tick line"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  border: { borderTopWidth: 1, borderTopColor: '#e3e6ed' },
});

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 12H5M12 19l-7-7 7-7\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11 5 6 9H2v6h4l5 4V5Z\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14\" fill=\"none\" stroke=\"#141b4d\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t4: {"color":"#0a0f1a","fontSize":15,"lineHeight":22.5,"textAlign":"center","fontFamily":"Inter_700Bold"},
  v5: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t6: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  v8: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t9: {"color":"#0a0f1a","fontSize":30,"lineHeight":33.6,"letterSpacing":-0.7,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t11: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t12: {"color":"#0a0f1a","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v13: {"flexShrink":1},
  t14: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e6e9f8","borderRadius":14},
  v16: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-end","rowGap":12,"columnGap":12},
  v17: {"borderRadius":4},
  v18: {"flexShrink":1,"width":"64%","borderRadius":4},
  v19: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#e9ecf2","borderRadius":4,"overflow":"hidden"},
  v20: {"flexShrink":1,"overflow":"hidden"},
  t21: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v22: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  t23: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v24: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v25: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v26: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"paddingTop":2},
  t27: {"fontFamily":"Inter_700Bold"},
  t28: {"color":"#344054","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v29: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingTop":12,"paddingRight":20,"marginRight":16,"paddingBottom":12,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  v30: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  t31: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t32: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t33: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t35: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t36: {"color":"#4a5467","fontSize":12,"lineHeight":18,"fontFamily":"Inter_600SemiBold"},
  v37: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v38: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e3f6ec"},
  v39: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  t40: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t41: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v42: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t43: {"color":"#0e7490","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v44: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":64},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderRadius":14,"boxShadow":"rgb(143, 152, 170) 0px 0px 0px 2.5px inset"},
  v46: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":56,"height":56,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgb(216, 221, 230) 0px 0px 0px 1.5px inset"},
  v47: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":64,"backgroundColor":"#e6e9f8","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v48: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v49: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"paddingTop":4,"paddingBottom":8},
  t51: {"color":"#141b4d","fontSize":16,"lineHeight":24,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v52: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":22,"paddingLeft":18,"height":56,"backgroundColor":"#ffffff","borderRadius":28,"boxShadow":"rgb(20, 27, 77) 0px 0px 0px 2px inset"},
  t53: {"fontFamily":"NotoSansTamil_700Bold"},
  t54: {"color":"#344054","fontSize":13,"lineHeight":16.9,"fontFamily":"NotoSansTamil_700Bold"},
  t55: {"color":"#4a5467","fontSize":13,"lineHeight":16.9,"fontFamily":"Inter_600SemiBold"},
  v56: {"flexDirection":"column","alignItems":"stretch","rowGap":1,"columnGap":1,"flexShrink":1},
  v57: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12},
  v58: {"borderRadius":18},
  t59: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v60: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v61: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingTop":8,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f2f4f8"},
  v62: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
