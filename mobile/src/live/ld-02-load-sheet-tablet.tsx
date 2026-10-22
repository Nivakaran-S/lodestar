// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-02 Load sheet · Tablet (P3, tablet)
import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { hm, until } from '@/lib/time';
import { signOutTo, titleCase } from '@/lodestar/live';
import { useClaims, useLoadSheet } from '@/model/hooks';
import { loadGroups, ordinal, reeferOf, shortfallFor, tempLabel, useRePlanAlert, useMarkLoading, useTicks } from '@/model/dock';
import type { OrderLineItem, Trip } from '@/model/types';
import { truckSvg } from '@/lodestar/truck';
import { Frame, Grad, Icon, Scroll, Tap, openScreen, type ScreenNav, type GradSpec, type Target } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L224":{"to":"ld-22-release-checklist","kind":"go"}}};

const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });
const pct = (a: number, b?: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
const kind = (t?: Trip) => (t?.vehicle ? `${t.vehicle.tempClass === 'CHILLED' ? 'Reefer ' : ''}${t.vehicle.type === 'VAN' ? 'van' : 'truck'}` : '');
const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

export default function ScreenLd02LoadSheetTablet() {
  const claims = useClaims();
  const sheet = useLoadSheet();
  const data = sheet.data;
  const trip = data?.trip;
  const t = useTicks(sheet.tripId, sheet.data?.trip?.status);
  useMarkLoading(data?.trip, !!data?.loadRecord || sheet.shortfalls.length > 0 || Object.keys(t.map).length > 0);
  // a re-plan published while this trip is loading: what changed (LD-23)
  useRePlanAlert(trip?.depot, planId => trip && openScreen('ld-23-plan-changed', { trip: trip.id, plan: planId }));
  // the shared tablet locks after 2 min with no tick (LD-27)
  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId) return;
    const idle = setTimeout(() => openScreen('ld-27-tablet-locked', { trip: tripId }, 'nav'), 120_000);
    return () => clearTimeout(idle);
  }, [tripId, t.map]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const flagged = (l: OrderLineItem) => shortfallFor(sheet.shortfalls, l);
  const accounted = (l: OrderLineItem) => t.isTicked(l.id) || !!flagged(l);
  const groups = loadGroups(data, accounted);
  const truck = truckSvg(groups);
  const lines = groups.flatMap(g => g.lines);
  const total = lines.length;
  const done = lines.filter(accounted).length;
  const current = lines.find(l => !accounted(l)) ?? null;
  const first = groups.find(g => g.ticked < g.lines.length) ?? null;
  const temp = reeferOf(trip, data?.loadRecord);
  const kg = data ? data.stops.reduce((n, st) => n + (st.order?.kg ?? 0), 0) : 0;
  const m3 = data ? data.stops.reduce((n, st) => n + (st.order?.m3 ?? 0), 0) : 0;
  const capKg = trip?.vehicle?.capacityKg;
  const capM3 = trip?.vehicle?.capacityM3;
  const empty = !claims ? 'Sign in to see the load sheet' : sheet.loading && !data ? 'Loading the load sheet…' : sheet.error && !data ? 'No signal · load sheet not saved yet' : !data ? 'No trip to load' : total ? '' : 'No lines on this trip';
  const flagTo = (l?: OrderLineItem): Target | undefined => (trip ? { to: 'ld-03-flag-shortfall', params: l ? { trip: trip.id, item: l.name } : { trip: trip.id } } : undefined);
  const name = claims?.name ?? claims?.username;

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v92}>
        <View style={s.v22}>
          <View style={s.v6}>
            <Icon xml={X2} width={36} height={36} style={s.v3} />
          </View>
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{trip ? [trip.bay ? `Bay ${trip.bay}` : '', `Trip ${trip.tripNumber}`, titleCase(trip.brand), trip.district].filter(Boolean).join(' · ') : empty || '—'}</Text>
            </View>
            <View>
              <Text style={s.t9} numberOfLines={1}><Text style={s.t8}>{trip?.vehicleId ?? "—"}</Text>{kind(trip) ? ` · ${kind(trip)}` : ""}</Text>
            </View>
          </View>
          <View style={s.v11} />
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{trip?.departTime ? `Departs ${hm(trip.departTime)}` : "Departs —"}</Text>
            </View>
            <View>
              <Text style={s.t12} numberOfLines={1}>{until(trip?.departTime) || (sheet.released ? "released" : " ")}</Text>
            </View>
          </View>
          <View style={s.v11} />
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{"Driver"}</Text>
            </View>
            <View>
              <Text style={s.t9} numberOfLines={1}>{trip ? (trip.driver?.name ?? "Not assigned") : "—"}</Text>
            </View>
          </View>
          <View style={s.v13} />
          <View style={s.v15}>
            <Icon xml={X3} width={14} height={14} style={s.v3} />
            <Text style={s.t14} numberOfLines={1}>{trip ? `Plan v${trip.planVersion}` : "Plan —"}</Text>
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
        <Scroll style={s.v13} contentStyle={s.v79}>
          <View style={s.v52}>
            <View style={s.v34}>
              <View>
                <Text style={s.t7}>{"Load in this order: last stop goes in first"}</Text>
              </View>
              <View>
                <Text style={s.t23} testID="load-banner">{first ? `Load stop ${first.stop.stopSeq} first` : data && total ? "All lines loaded" : empty || " "}</Text>
              </View>
              <View style={s.v33}>
                {truck ? <Icon xml={truck} width={368} height={117} style={s.v24} /> : null}
                <View style={s.v31}>
                  {groups.slice(0, 2).map((g, i) => (
                    <View key={g.stop.id} style={s.v27}>
                      <View style={i === 0 ? s.v25 : s.v28} />
                      <Text style={i === 0 ? s.t26 : s.t29} numberOfLines={1}>{`Stop ${g.stop.stopSeq} · load ${ordinal(g.order)}`}</Text>
                    </View>
                  ))}
                  <View style={s.v27}>
                    <Icon xml={X5} width={14} height={14} style={s.v3} />
                    <Text style={s.t30} numberOfLines={1}>{temp !== undefined ? `Top zone ${temp} °C` : trip?.vehicle?.tempClass === "AMBIENT" ? "Ambient" : "Reefer —"}</Text>
                  </View>
                </View>
                <View style={s.v31}>
                  <Text style={s.t32}>{"Cab on the left, rear doors on the right; bottom zone ambient"}</Text>
                </View>
              </View>
            </View>
            <View style={s.v43}>
              <View style={s.v40}>
                <View>
                  <Text style={s.t7}>{capKg ? `Weight · ${pct(kg, capKg)}%` : "Weight"}</Text>
                </View>
                <View>
                  <Text style={s.t36}>{data ? n0(kg) : "—"}<Text style={s.t35}>{capKg ? ` / ${n0(capKg)} kg` : " kg"}</Text></Text>
                </View>
                <View style={s.v39}>
                  <View style={[s.v38, { width: `${pct(kg, capKg)}%` }]}>
                    <Grad g={G0} style={s.v37} />
                  </View>
                </View>
              </View>
              <View style={s.v42}>
                <View>
                  <Text style={s.t7}>{capM3 ? `Volume · ${pct(m3, capM3)}%` : "Volume"}</Text>
                </View>
                <View>
                  <Text style={s.t36}>{data ? n0(m3) : "—"}<Text style={s.t35}>{capM3 ? ` / ${n0(capM3)} m³` : " m³"}</Text></Text>
                </View>
                <View style={s.v39}>
                  <View style={[s.v41, { width: `${pct(m3, capM3)}%` }]}>
                    <Grad g={G1} style={s.v37} />
                  </View>
                </View>
              </View>
            </View>
            <View style={s.v51}>
              <View style={s.v50}>
                <Tap style={s.v45} to={flagTo() ?? null} testID="flag-issue">
                  <Icon xml={X6} width={22} height={22} style={s.v3} />
                  <Text style={s.t44}>{"Flag an issue"}</Text>
                </Tap>
                <View style={s.v47}>
                  <Text style={s.t46}>{"Goes to dispatch, store and driver in one step"}</Text>
                </View>
                <View style={s.v49}>
                  <Text style={s.t48} numberOfLines={1}>{`${sheet.shortfalls.length} open`}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={s.v78}>
            {!groups.length ? (
              <View style={s.v51}>
                <View style={s.v63}>
                  <View style={s.v59}>
                    <Text style={s.t55}>{empty || "No stops on this trip"}</Text>
                  </View>
                </View>
              </View>
            ) : null}
            {groups.map(g => {
              const outlet = g.stop.outlet?.name ?? "";
              const complete = g.lines.length > 0 && g.ticked === g.lines.length;
              const tickedLines = g.lines.filter(l => t.isTicked(l.id));
              const rest = g.lines.filter(l => !t.isTicked(l.id));
              if (complete && !open[g.stop.id]) {
                return (
                  <View key={g.stop.id} style={s.v51}>
                    <Tap style={s.v63} to={null} onPress={() => setOpen(o => ({ ...o, [g.stop.id]: true }))} testID={`group-${g.order}`}>
                      <View style={s.v53}>
                        <Icon xml={X7} width={22} height={22} style={s.v3} />
                      </View>
                      <View style={s.v59}>
                        <View>
                          <Text style={s.t55}>{`${ordinal(g.order)} · Stop ${g.stop.stopSeq} · `}<Text style={s.t54}>{g.stop.outletId}</Text>{` ${outlet}`}</Text>
                        </View>
                        <View style={s.v31}>
                          <View style={s.v2}>
                            <Text style={s.t56}>{g.stop.orderId}</Text>
                          </View>
                          <View style={s.v57} />
                          <View style={s.v27}>
                            <Icon xml={X5} width={14} height={14} style={s.v3} />
                            <Text style={s.t58} numberOfLines={1}>{tempLabel(g.stop.order?.tempClass)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.v62}>
                        <View>
                          <Text style={s.t60}>{`${g.ticked}/${g.lines.length}`}</Text>
                        </View>
                        <View>
                          <Text style={s.t61}>{"lines"}</Text>
                        </View>
                      </View>
                    </Tap>
                  </View>
                );
              }
              return (
                <View key={g.stop.id} style={s.v74}>
                  <View style={s.v67}>
                    <View style={s.v2}>
                      <Text style={s.t65}>{`${ordinal(g.order)} · Stop ${g.stop.stopSeq} · `}<Text style={s.t64}>{g.stop.outletId}</Text>{` ${outlet}${g.stop.order?.tempClass ? ` · ${tempLabel(g.stop.order.tempClass).toLowerCase()}` : ""} `}<Text style={s.t64}>{g.stop.orderId}</Text></Text>
                    </View>
                    <View style={s.v2}>
                      <Text style={s.t66}>{`${g.ticked} of ${g.lines.length}`}</Text>
                    </View>
                  </View>
                  <View style={s.v73}>
                    {tickedLines.length ? (
                      <Tap style={s.v68} to={null} onPress={() => setOpen(o => ({ ...o, [g.stop.id]: !o[g.stop.id] }))} testID={`loaded-${g.order}`}>
                        <View style={s.v53}>
                          <Icon xml={X7} width={22} height={22} style={s.v3} />
                        </View>
                        <View style={s.v59}>
                          <View>
                            <Text style={s.t55}>{`${tickedLines.length} ${tickedLines.length === 1 ? "line" : "lines"} loaded`}</Text>
                          </View>
                          <View style={s.v31}>
                            <Text style={s.t46}>{tickedLines.map(l => l.name).join(", ")}</Text>
                          </View>
                        </View>
                        <Icon xml={X8} width={18} height={18} style={s.v3} />
                      </Tap>
                    ) : null}
                    {open[g.stop.id]
                      ? tickedLines.map((l, i) => (
                          <Tap key={l.id} style={s.v72} to={null} onPress={() => t.toggle(l.id)} testID={`line-row-${g.order}-t${i}`}>
                            <View style={s.v53}>
                              <Icon xml={X7} width={22} height={22} style={s.v3} />
                            </View>
                            <View style={s.v59}>
                              <Text style={s.t55}>{l.name}</Text>
                            </View>
                            <View style={s.v62}>
                              <Text style={s.t60}>{l.qty}</Text>
                            </View>
                          </Tap>
                        ))
                      : null}
                    {rest.map((l, i) => {
                      const sf = flagged(l);
                      return (
                        <View key={l.id} style={l.id === current?.id ? s.v71 : s.v72}>
                          <Tap style={x.tapRow} to={null} onPress={() => t.toggle(l.id)} testID={`line-row-${g.order}-${i}`}>
                            <View style={s.v69} />
                            <View style={s.v59}>
                              <View>
                                <Text style={s.t55}>{l.name}</Text>
                              </View>
                              <View style={s.v31}>
                                {l.tempClass === "CHILLED" ? (
                                  <View style={s.v27}>
                                    <Icon xml={X5} width={14} height={14} style={s.v3} />
                                    <Text style={s.t58} numberOfLines={1}>{"Chilled"}</Text>
                                  </View>
                                ) : (
                                  <View style={s.v27}>
                                    <View style={s.v75} />
                                    <Text style={s.t76} numberOfLines={1}>{tempLabel(l.tempClass)}</Text>
                                  </View>
                                )}
                                <View style={s.v57} />
                                <Text style={s.t46}>{sf ? `short ${Math.max(0, sf.qtyOrdered - sf.qtyLoaded)} · ${sf.reason}` : `${n0(l.kg)} kg`}</Text>
                              </View>
                            </View>
                            <View style={s.v62}>
                              <View>
                                <Text style={s.t60}>{sf ? `${sf.qtyLoaded}/${l.qty}` : l.qty}</Text>
                              </View>
                              <View>
                                <Text style={s.t61}>{l.qty === 1 ? "unit" : "units"}</Text>
                              </View>
                            </View>
                          </Tap>
                          <Tap style={s.v70} to={flagTo(l) ?? null} testID={`flag-line-${g.order}-${i}`} label={`Flag a problem with ${l.name}`}>
                            <Icon xml={X9} width={22} height={22} style={s.v3} />
                          </Tap>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </Scroll>
        <View style={s.v91}>
          <View style={s.v86}>
            <View style={s.v82}>
              <View style={s.v2}>
                <Text style={s.t81}><Text style={s.t80}>{data ? String(done) : "—"}</Text>{` of ${total} ${total === 1 ? 'line' : 'lines'}`}</Text>
              </View>
              <View style={s.v2}>
                <Text style={s.t81}>{data ? `${total - done} to go${sheet.shortfalls.length ? ` · ${sheet.shortfalls.length} short` : ""}` : " "}</Text>
              </View>
            </View>
            <View style={s.v85}>
              <View style={[s.v84, { width: `${pct(done, total)}%` }]}>
                <Grad g={G2} style={s.v83} />
              </View>
            </View>
          </View>
          <View style={s.v13} />
          <View style={s.v88}>
            <Icon xml={X10} width={22} height={22} style={s.v3} />
            <Text style={s.t87}>{trip ? `Print v${trip.planVersion} backup` : "Print backup"}</Text>
          </View>
          <Tap lk="L224" style={s.v90} to={trip ? { to: "ld-22-release-checklist", params: { trip: trip.id } } : undefined}>
            <Icon xml={X11} width={22} height={22} style={s.v3} />
            <Text style={s.t89}>{data && total - done > 0 ? `Release · ${total - done} lines left` : "Release"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const x = StyleSheet.create({
  tapRow: { flexDirection: 'row', alignItems: 'center', columnGap: 14, flexGrow: 1, flexShrink: 1, flexBasis: '0%' },
});

const X2 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m6 9 6 6 6-6\" fill=\"none\" stroke=\"#4a5467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M12 9v4M12 17h.01\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect></svg>";
const X11 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#344054\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#ffd37a","p":0},{"c":"#f5b83d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#10b981","p":0},{"c":"#047857","p":1}]}];
const G2: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  t1: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontVariant":["tabular-nums"],"fontFamily":"JetBrainsMono_600SemiBold"},
  v2: {"flexShrink":1},
  v3: {"flexShrink":0,"overflow":"hidden"},
  v4: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1},
  v5: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":28},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t7: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t8: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t9: {"color":"#0a0f1a","fontSize":19,"lineHeight":28.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v10: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v11: {"flexShrink":0,"width":1,"height":36,"backgroundColor":"#e3e6ed"},
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
  t23: {"color":"#0a0f1a","fontSize":22,"lineHeight":26.4,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v24: {"flexShrink":1,"overflow":"hidden"},
  v25: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#047857","borderRadius":3.5},
  t26: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v27: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v28: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#b45309","borderRadius":3.5},
  t29: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t30: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v31: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  t32: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v33: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"paddingTop":6},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":20,"paddingRight":20,"paddingBottom":20,"paddingLeft":20,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  t35: {"color":"#4a5467","fontSize":15,"lineHeight":22.5},
  t36: {"color":"#0a0f1a","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v37: {"borderRadius":3},
  v38: {"flexShrink":1,"width":"95%","borderRadius":3},
  v39: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"marginTop":4,"height":6,"backgroundColor":"#e9ecf2","borderRadius":3,"overflow":"hidden"},
  v40: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16},
  v41: {"flexShrink":1,"width":"66%","borderRadius":3},
  v42: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderLeftWidth":1,"borderLeftColor":"#e3e6ed"},
  v43: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"backgroundColor":"#ffffff","borderRadius":20,"overflow":"hidden"},
  t44: {"color":"#0a0f1a","fontSize":16,"lineHeight":24,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v45: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":18,"paddingLeft":18,"height":56,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  t46: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v47: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t48: {"color":"#344054","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v49: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e9ecf2","borderRadius":14},
  v50: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":12,"paddingRight":16,"paddingBottom":12,"paddingLeft":16},
  v51: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v52: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"flexShrink":0,"width":404},
  v53: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  t54: {"letterSpacing":-0.2,"fontFamily":"JetBrainsMono_600SemiBold"},
  t55: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t56: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v57: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#4a5467","borderRadius":1.5,"opacity":0.6},
  t58: {"color":"#0e7490","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  v59: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t60: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t61: {"color":"#4a5467","fontSize":12,"lineHeight":18,"fontFamily":"Inter_600SemiBold"},
  v62: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  v63: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60,"backgroundColor":"#e3f6ec"},
  t64: {"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  t65: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t66: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v67: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":4,"paddingLeft":4},
  v68: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60},
  v69: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"borderRadius":14,"boxShadow":"rgb(143, 152, 170) 0px 0px 0px 2.5px inset"},
  v70: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":56,"height":56,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgb(216, 221, 230) 0px 0px 0px 1.5px inset"},
  v71: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60,"backgroundColor":"#e6e9f8","borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v72: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  v73: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v74: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v75: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#344054","borderRadius":3.5},
  t76: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_600SemiBold"},
  t77: {"color":"#344054","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  v78: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v79: {"flexDirection":"row","alignItems":"stretch","rowGap":18,"columnGap":18,"paddingTop":4,"paddingRight":22,"paddingBottom":12,"paddingLeft":22},
  t80: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t81: {"color":"#344054","fontSize":14,"lineHeight":21,"fontFamily":"Inter_600SemiBold"},
  v82: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline"},
  v83: {"borderRadius":4},
  v84: {"flexShrink":1,"width":"64%","borderRadius":4},
  v85: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#e9ecf2","borderRadius":4,"overflow":"hidden"},
  v86: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":1,"width":404},
  t87: {"color":"#0a0f1a","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v88: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":20,"paddingLeft":20,"height":58,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  t89: {"color":"#344054","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v90: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":24,"paddingLeft":24,"height":58,"backgroundColor":"#e9ecf2","borderRadius":18},
  v91: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":84},
  v92: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});
