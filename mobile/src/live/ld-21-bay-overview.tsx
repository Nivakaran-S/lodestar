// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-21 Bay overview · tablet (P3, tablet)
// Today's trips of the depot by bay (bay queue): vehicle, departure, lines checked on this tablet of the trip's
// lines, flags (load-record shortfalls and unsent ones) and status. Tapping a bay opens its load sheet.
import { useState } from 'react';
import { Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { tempClassIcon } from '@/lodestar/vehicle-icon';
import { dayLabel, hm, until } from '@/lib/time';
import { plural, signOutTo, titleCase } from '@/lodestar/live';
import { isReleased, onTime, useRePlanAlert, useTickCounts, useTripLineCounts } from '@/model/dock';
import { effectiveShortfalls, useBayQueue, useClaims, useOutbox } from '@/model/hooks';
import type { Shortfall, Trip } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L222":{"to":"ld-02-load-sheet-tablet","kind":"go"},"L223":{"to":"ld-13-flags-tab","kind":"go"}}};

const kind = (t: Trip) => (t.vehicle ? `${t.vehicle.tempClass === 'CHILLED' ? 'Reefer' : 'Dry'} ${t.vehicle.type === 'VAN' ? 'van' : 'truck'}` : '');
const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');
const shortBy = (sf: Shortfall) => Math.max(0, sf.qtyOrdered - sf.qtyLoaded);

export default function ScreenLd21BayOverview() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const { data, loading, error } = useBayQueue();
  const { items } = useOutbox();
  const trips = [...(data?.trips ?? [])].sort((a, b) => (a.bay ?? '~').localeCompare(b.bay ?? '~') || (a.departTime ?? '').localeCompare(b.departTime ?? ''));
  const ids = trips.map(t => t.id);
  const totals = useTripLineCounts(ids).data;
  const ticked = useTickCounts(ids);
  const [picked, setPicked] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const roomy = useWindowDimensions().width >= 1024;
  const active = trips.filter(t => !isReleased(t, items));
  const next = [...active].sort((a, b) => (a.departTime ?? '~').localeCompare(b.departTime ?? '~'))[0] ?? null;
  const selected = trips.find(t => t.id === picked) ?? next ?? trips[0] ?? null;
  const flagsOf = (t: Trip) => effectiveShortfalls(t.id, t.loadRecord?.shortfalls ?? [], items);
  const flags = trips.flatMap(t => flagsOf(t).map(sf => ({ t, sf })));
  const late = (t: Trip) => (isReleased(t, items) ? onTime(t) === false : !!t.departTime && Date.parse(t.departTime) < now);
  const onTimeCount = trips.filter(t => !late(t)).length;
  const depot = data?.depot ?? claims?.depots[0];
  useRePlanAlert(depot);
  const name = claims?.name ?? claims?.username;
  const empty = !claims ? 'Sign in to see the bays' : loading && !data ? 'Loading the bays…' : error && !data ? 'No signal · bays not saved yet' : trips.length ? '' : 'No trips at the bays today';
  const sheetOf = (t: Trip | null): Target | undefined => (t ? { to: 'ld-02-load-sheet-tablet', params: { trip: t.id } } : undefined);

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v81}>
        <View style={s.v22}>
          <View style={s.v6}>
            <Icon xml={X2} width={36} height={36} style={s.v3} />
          </View>
          <View style={s.v9}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{[depot ? `${depotName(depot)}` : '', data ? dayLabel(data.date) : '', data && !data.isToday ? 'last run day' : ''].filter(Boolean).join(' · ') || '—'}</Text>
            </View>
            <View>
              <Text style={s.t8} numberOfLines={1}>{"Bay overview"}</Text>
            </View>
          </View>
          <View style={s.v10} />
          <View style={s.v9}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{"Next out"}</Text>
            </View>
            <View>
              <Text style={s.t12} numberOfLines={1}><Text style={s.t11}>{next?.vehicleId ?? "—"}</Text>{next?.departTime ? ` · ${until(next.departTime) || hm(next.departTime)}` : ""}</Text>
            </View>
          </View>
          <View style={s.v13} />
          <View style={s.v15}>
            <Icon xml={X3} width={18} height={18} style={s.v3} />
            <Text style={s.t14} numberOfLines={1}>{trips[0] ? `Plan v${trips[0].planVersion}` : "Plan —"}</Text>
          </View>
          <Tap style={s.v21} to={null} onPress={() => signOutTo('ld-20-shared-sign-in')} testID="switch-user">
            <View style={s.v17}>
              <Text style={s.t16}>{initials(name) || "—"}</Text>
            </View>
            <View style={s.v20}>
              <View>
                <Text style={s.t18} numberOfLines={1}>{name ?? "Not signed in"}</Text>
              </View>
              <View>
                <Text style={s.t19} numberOfLines={1}>{"Switch user"}</Text>
              </View>
            </View>
          </Tap>
        </View>
        <Scroll style={s.v13} contentStyle={s.v73}>
          <View style={s.v33}>
            <Grad g={G0} style={s.v23} />
            <View style={s.v27}>
              <View>
                <Text style={s.t24}>{depot ? `${depotName(depot)} right now` : "Right now"}</Text>
              </View>
              <View>
                <Text style={s.t26} testID="on-time">{trips.length ? String(onTimeCount) : "—"}<Text style={s.t25}>{trips.length ? ` of ${plural(trips.length, 'trip')} on time` : ` ${empty}`}</Text></Text>
              </View>
            </View>
            <View style={s.v32}>
              <View style={s.v30}>
                <View style={s.v28} />
                <Text style={s.t29} numberOfLines={1}>{flags.length ? `${plural(flags.length, 'flag')} waiting` : "No flags"}</Text>
              </View>
              <View>
                <Text style={s.t31}>{flags[0] ? `${flags[0].t.bay ?? flags[0].t.vehicleId} · ${flags[0].sf.item} short ${shortBy(flags[0].sf)}${flags[0].sf.at ? `, sent ${hm(flags[0].sf.at)}` : ""}` : " "}</Text>
              </View>
            </View>
          </View>
          <View style={[s.v72, x.wrap]}>
            {trips.map(t => {
              const mine = selected?.id === t.id;
              const total = totals?.[t.id];
              const sfs = flagsOf(t);
              const done = Math.min(total ?? 0, (ticked[t.id] ?? 0) + sfs.length);
              const p = total ? Math.round((done / total) * 100) : 0;
              const released = isReleased(t, items);
              const ready = !released && !!total && done >= total;
              const chilled = t.vehicle?.tempClass === 'CHILLED';
              return (
                <Tap key={t.id} style={[mine ? s.v65 : s.v57, x.card]} onPress={() => setPicked(t.id)} to={sheetOf(t)} testID={`bay-${t.id}`}>
                  <View style={s.v39}>
                    <View style={mine ? s.v59 : s.v35}>
                      <Text style={mine ? s.t58 : s.t34}>{t.bay ?? "—"}</Text>
                    </View>
                    <View style={s.v38}>
                      <View>
                        <Text style={s.t37}><Text style={s.t36}>{t.vehicleId}</Text></Text>
                      </View>
                      <View>
                        <Text style={s.t7} numberOfLines={1}>{`${titleCase(t.brand)} · ${t.district}`}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.v42}>
                    <View style={s.v41}>
                      {t.vehicle ? <Icon xml={tempClassIcon(t.vehicle.tempClass).xml} width={14} height={14} style={s.v3} /> : null}
                      <Text style={chilled ? s.t40 : s.t67} numberOfLines={1}>{kind(t) || "—"}</Text>
                    </View>
                  </View>
                  <View style={s.v45}>
                    <View>
                      <Text style={s.t43}>{hm(t.departTime) || "—"}</Text>
                    </View>
                    <View>
                      <Text style={s.t44}>{released ? "released" : until(t.departTime) ? `departs ${until(t.departTime)}` : t.departTime ? "departs · overdue" : "departs —"}</Text>
                    </View>
                  </View>
                  <View style={s.v50}>
                    <View style={s.v48}>
                      <View style={[p >= 100 ? s.v47 : s.v60, { width: `${p}%` }]}>
                        <Grad g={p >= 100 ? G1 : G2} style={s.v46} />
                      </View>
                    </View>
                    <View>
                      <Text style={s.t44}><Text style={s.t49}>{total === undefined ? "—" : `${p}%`}</Text>{total === undefined ? "" : ` · ${done} of ${plural(total, 'line')}`}</Text>
                    </View>
                  </View>
                  <View style={s.v52}>
                    <View style={s.v41}>
                      {sfs.length ? <Icon xml={X6} width={17} height={17} style={s.v3} /> : <Icon xml={X5} width={17} height={17} style={s.v3} />}
                      <Text style={sfs.length ? s.t61 : s.t51} numberOfLines={1}>{sfs.length ? plural(sfs.length, 'flag') : "No flags"}</Text>
                    </View>
                  </View>
                  <View style={s.v53} />
                  {ready ? (
                    <View style={s.v56}>
                      <View style={s.v54} />
                      <Text style={s.t55} numberOfLines={1}>{"Ready to release"}</Text>
                    </View>
                  ) : t.status === 'LOADING' && !released ? (
                    <View style={s.v64}>
                      <View style={s.v62} />
                      <Text style={s.t63} numberOfLines={1}>{"Loading"}</Text>
                    </View>
                  ) : (
                    <View style={s.v71}>
                      <View style={s.v69} />
                      <Text style={s.t70} numberOfLines={1}>{released ? "Released" : t.status === 'PLANNED' ? "Planned" : titleCase(t.status)}</Text>
                    </View>
                  )}
                </Tap>
              );
            })}
          </View>
        </Scroll>
        <View style={s.v80}>
          {/* the hint gives way first: below 1024 px (a tablet held upright) it is dropped so both buttons stay on one line */}
          {roomy ? (
            <View style={s.v74}>
              <Icon xml={X8} width={18} height={18} style={s.v3} />
              <Text style={s.t44} numberOfLines={2}>{"Tap any bay to open its load sheet. The next bay out is outlined."}</Text>
            </View>
          ) : null}
          <View style={s.v13} />
          <Tap lk="L223" style={[s.v76, x.btn]}>
            <Icon xml={X9} width={22} height={22} style={s.v3} />
            <Text style={s.t75} numberOfLines={1}>{flags.length ? `Flags · ${flags.length} waiting` : "Flags"}</Text>
          </Tap>
          <Tap lk="L222" style={[s.v79, x.btn]} to={sheetOf(selected)}>
            <Grad g={G3} style={s.v77} />
            <Icon xml={X10} width={22} height={22} style={s.v3} />
            <Text style={s.t78} numberOfLines={1}>{selected ? `Open Bay ${selected.bay ?? selected.vehicleId}` : "Open bay"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

export const X2 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"17\" height=\"17\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"17\" height=\"17\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><path d=\"M12 16v-4M12 8h.01\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#1e2766","p":0},{"c":"#141b4d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#10b981","p":0},{"c":"#047857","p":1}]}];
const G2: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];
const G3: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

export const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  t1: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontVariant":["tabular-nums"],"fontFamily":"JetBrainsMono_600SemiBold"},
  v2: {"flexShrink":1},
  v3: {"flexShrink":0,"overflow":"hidden"},
  v4: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1},
  v5: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":28},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t7: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t8: {"color":"#0a0f1a","fontSize":19,"lineHeight":28.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v9: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v10: {"flexShrink":0,"width":1,"height":36,"backgroundColor":"#e3e6ed"},
  t11: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t12: {"color":"#3b4cca","fontSize":19,"lineHeight":28.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v13: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t14: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  t16: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_800ExtraBold"},
  v17: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":34,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  t18: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_700Bold"},
  t19: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_600SemiBold"},
  v20: {"flexDirection":"column","alignItems":"stretch","flexShrink":1},
  v21: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":12,"paddingLeft":5,"height":44,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":18,"columnGap":18,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":72},
  v23: {"borderRadius":24},
  t24: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t25: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t26: {"color":"#ffffff","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v28: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#b42318","borderRadius":3.5},
  t29: {"color":"#b42318","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v30: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#fde8e5","borderRadius":14},
  t31: {"color":"#b9c0e6","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v32: {"flexDirection":"column","alignItems":"flex-end","rowGap":8,"columnGap":8,"flexShrink":1},
  v33: {"flexDirection":"row","alignItems":"center","rowGap":24,"columnGap":24,"paddingTop":18,"paddingRight":24,"paddingBottom":18,"paddingLeft":24,"borderRadius":24,"boxShadow":"rgba(20, 27, 77, 0.28) 0px 12px 32px 0px"},
  t34: {"color":"#3b4cca","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v35: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t36: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t37: {"color":"#0a0f1a","fontSize":17,"lineHeight":25.5,"fontFamily":"Inter_700Bold"},
  v38: {"flexDirection":"column","alignItems":"stretch","rowGap":1,"columnGap":1,"flexShrink":1},
  v39: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12},
  t40: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v41: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v42: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"minHeight":20},
  t43: {"color":"#0a0f1a","fontSize":54,"lineHeight":56.7,"letterSpacing":-1.6,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t44: {"color":"#344054","fontSize":14,"lineHeight":21,"fontFamily":"Inter_600SemiBold"},
  v45: {"flexDirection":"column","alignItems":"stretch"},
  v46: {"borderRadius":6},
  v47: {"flexShrink":1,"width":"100%","borderRadius":6},
  v48: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":12,"backgroundColor":"#e9ecf2","borderRadius":6,"overflow":"hidden"},
  t49: {"color":"#0a0f1a","fontFamily":"Inter_800ExtraBold"},
  v50: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8},
  t51: {"color":"#047857","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_600SemiBold"},
  v52: {"flexDirection":"row","alignItems":"center","paddingRight":12,"paddingLeft":12,"minHeight":48,"backgroundColor":"#f4f6fa","borderRadius":12},
  v53: {"flexGrow":1,"flexBasis":"0%"},
  v54: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#047857","borderRadius":3.5},
  t55: {"color":"#047857","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v56: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"alignSelf":"flex-start","paddingRight":14,"paddingLeft":14,"height":34,"backgroundColor":"#e3f6ec","borderRadius":17},
  v57: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":18,"paddingRight":18,"paddingBottom":18,"paddingLeft":18,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.05) 0px 4px 14px 0px"},
  t58: {"color":"#ffcb5c","fontSize":15,"lineHeight":22.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v59: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#141b4d","borderRadius":14},
  v60: {"flexShrink":1,"width":"77%","borderRadius":6},
  t61: {"color":"#b42318","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_600SemiBold"},
  v62: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#3b4cca","borderRadius":3.5},
  t63: {"color":"#3b4cca","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v64: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"alignSelf":"flex-start","paddingRight":14,"paddingLeft":14,"height":34,"backgroundColor":"#e6e9f8","borderRadius":17},
  v65: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":18,"paddingRight":18,"paddingBottom":18,"paddingLeft":18,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgb(20, 27, 77) 0px 0px 0px 3px inset, rgba(20, 27, 77, 0.14) 0px 8px 20px 0px"},
  v66: {"flexShrink":1,"width":"68%","borderRadius":6},
  t67: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v68: {"flexShrink":1,"width":"13%","borderRadius":6},
  v69: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#344054","borderRadius":3.5},
  t70: {"color":"#344054","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v71: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"alignSelf":"flex-start","paddingRight":14,"paddingLeft":14,"height":34,"backgroundColor":"#e9ecf2","borderRadius":17},
  v72: {"flexDirection":"row","alignItems":"stretch","rowGap":14,"columnGap":14,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v73: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingRight":22,"paddingBottom":12,"paddingLeft":22},
  v74: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":1},
  t75: {"color":"#0a0f1a","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v76: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":20,"paddingLeft":20,"height":58,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  v77: {"borderRadius":18},
  t78: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v79: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":24,"paddingLeft":24,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v80: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":84},
  v81: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});

const x = StyleSheet.create({
  wrap: { flexWrap: 'wrap' },
  card: { minWidth: 220 },
  btn: { flexShrink: 0 },
});
