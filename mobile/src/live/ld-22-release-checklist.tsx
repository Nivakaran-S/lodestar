// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// LD-22 Release checklist · tablet (P3, tablet)
// The selected trip's release checks: lines checked or flagged short (the per-trip ticks on this device), stop
// order, the pre-cool reading confirmed on LD-09, the seal number typed here and the driver. Release queues
// RELEASE with the seal and the reefer reading, then back to the bay overview.
import { useEffect, useState } from 'react';
import { Platform, Share, Text, TextInput, View, StyleSheet } from 'react-native';
import { hm, until } from '@/lib/time';
import { signOutTo, titleCase } from '@/lodestar/live';
import { releaseVehicle } from '@/model/actions';
import { ackFor, loadGroups, reeferOf, shortfallFor } from '@/model/dock';
import { precoolReading } from '@/model/field-reports';
import { useClaims, useLoadSheet, useNotifications, useOnline } from '@/model/hooks';
import { useLineChecks } from '@/model/line-checks';
import type { OrderLineItem, Trip } from '@/model/types';
import { Frame, Grad, Icon, Scroll, Tap, showToast, type ScreenNav, type GradSpec } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L225":{"to":"ld-21-bay-overview","kind":"go"}}};

const MAX_CHILLED_C = 4;
const kind = (t?: Trip) => (t?.vehicle ? `${t.vehicle.tempClass === 'CHILLED' ? 'Reefer ' : ''}${t.vehicle.type === 'VAN' ? 'van' : 'truck'}` : '');
const initials = (name?: string | null) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

export default function ScreenLd22ReleaseChecklist() {
  const claims = useClaims();
  const online = useOnline();
  const sheet = useLoadSheet();
  const notes = useNotifications();
  const data = sheet.data;
  const trip = data?.trip;
  const lr = data?.loadRecord;
  const checks = useLineChecks(sheet.tripId, sheet.data?.trip?.status);
  const [precool, setPrecool] = useState<number | null>(null);
  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId) return;
    let live = true;
    void precoolReading(tripId).then(v => live && setPrecool(v));
    return () => {
      live = false;
    };
  }, [tripId]);
  const [sealSel, setSeal] = useState<string | null>(null);
  const seal = sealSel ?? lr?.sealNumber ?? trip?.sealNumber ?? '';
  const temp = precool ?? reeferOf(trip, lr);
  const chilled = trip?.vehicle?.tempClass === 'CHILLED';
  const flagged = (l: OrderLineItem) => shortfallFor(sheet.shortfalls, l);
  const groups = loadGroups(data, l => checks.isChecked(l.id) || !!flagged(l));
  const lines = groups.flatMap(g => g.lines);
  const total = lines.length;
  const short = lines.filter(l => !!flagged(l)).length;
  const loaded = lines.filter(l => checks.isChecked(l.id) && !flagged(l)).length;
  const accounted = loaded + short;
  const acks = sheet.shortfalls.map(sf => (trip ? ackFor(notes.data, trip.id, sf.item) : undefined)).filter(Boolean);
  const lastAck = acks.map(a => a!.sentAt).sort((a, b) => a.localeCompare(b)).at(-1);
  const driver = trip?.driver?.name ?? null;
  const ok = {
    lines: !!data && total > 0 && accounted === total,
    order: !!data && total > 0 && accounted === total,
    reefer: !!data && (!chilled || (temp !== undefined && temp <= MAX_CHILLED_C)),
    seal: !!seal.trim(),
    driver: !!driver,
  };
  const passed = Object.values(ok).filter(Boolean).length;
  const checkCount = Object.keys(ok).length;
  const firstStop = groups.at(-1)?.stop;
  const lastStop = groups[0]?.stop;
  const shortText = sheet.shortfalls.map(sf => `${sf.item} short ${Math.max(0, sf.qtyOrdered - sf.qtyLoaded)}`).join(', ');
  const empty = !claims ? 'Sign in to release a vehicle' : sheet.loading && !data ? 'Loading…' : !data ? 'No trip selected' : '';
  const status = sheet.released ? 'Release saved' : !data ? '—' : ok.lines ? 'Loaded' : 'Loading';
  const name = claims?.name ?? claims?.username;
  const departIn = until(trip?.departTime);

  const release = async () => {
    if (!trip) throw new Error(empty || 'No trip selected');
    if (sheet.released) return true;
    if (!seal.trim()) throw new Error('Enter the seal number first');
    if (chilled && temp === undefined) throw new Error('Confirm the reefer reading first (pre-cool check)');
    if (chilled && temp !== undefined && temp > MAX_CHILLED_C) throw new Error(`Reefer reads ${temp} °C · above ${MAX_CHILLED_C} °C, it can't depart`);
    await releaseVehicle(trip, seal.trim(), temp);
    setTimeout(() => showToast(online ? `${trip.vehicleId} released · sending` : 'Release saved on this tablet · sends when there is signal'), 350);
    return true;
  };

  // the driver's copy of the load: the browser's print on the web, the share sheet (print, message) on a tablet
  const printCopy = async () => {
    if (!trip || !data) throw new Error(empty || 'No trip selected');
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return false;
    }
    const stops = [...groups].reverse().map(g => `Stop ${g.stop.stopSeq} · ${g.stop.outlet?.name ?? g.stop.outletId}: ${g.lines.map(l => `${l.name} ×${l.qty}`).join(', ')}`);
    const message = [
      `${trip.vehicleId} · Trip ${trip.tripNumber}${trip.bay ? ` · Bay ${trip.bay}` : ''}${trip.departTime ? ` · departs ${hm(trip.departTime)}` : ''}`,
      driver ? `Driver: ${driver}` : '',
      seal.trim() ? `Seal: ${seal.trim()}` : '',
      temp !== undefined ? `Reefer: ${temp} °C` : '',
      shortText ? `Short: ${shortText}` : '',
      ...stops,
    ].filter(Boolean).join('\n');
    await Share.share({ title: `Driver copy · ${trip.vehicleId}`, message });
    return false;
  };

  return (
    <Frame bg="#f2f4f8" nav={nav} style={s.v0}>
      <View style={s.v77}>
        <View style={s.v23}>
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
              <Text style={s.t12} numberOfLines={1}>{departIn || (sheet.released ? "released" : " ")}</Text>
            </View>
          </View>
          <View style={s.v11} />
          <View style={s.v10}>
            <View>
              <Text style={s.t7} numberOfLines={1}>{"Driver"}</Text>
            </View>
            <View>
              <Text style={s.t9} numberOfLines={1}>{trip ? (driver ?? "Not assigned") : "—"}</Text>
            </View>
          </View>
          <View style={s.v13} />
          <View style={s.v16}>
            <View style={s.v14} />
            <Text style={s.t15} numberOfLines={1}>{status}</Text>
          </View>
          <Tap style={s.v22} to={null} onPress={() => signOutTo('ld-20-shared-sign-in')} testID="switch-user">
            <View style={s.v18}>
              <Text style={s.t17}>{initials(name) || "—"}</Text>
            </View>
            <View style={s.v21}>
              <View>
                <Text style={s.t19} numberOfLines={1}>{name ?? "Not signed in"}</Text>
              </View>
              <View>
                <Text style={s.t20} numberOfLines={1}>{"Switch user"}</Text>
              </View>
            </View>
          </Tap>
        </View>
        <Scroll style={s.v13} contentStyle={s.v63}>
          <View style={s.v48}>
            <View style={s.v32}>
              <Grad g={G0} style={s.v24} />
              <View>
                <Text style={s.t25}>{departIn ? `Release check · departs ${departIn}` : "Release check"}</Text>
              </View>
              <View style={s.v30}>
                <View style={s.v2}>
                  <Text style={s.t27}>{data ? String(passed) : "—"}<Text style={s.t26}>{` of ${checkCount} checks`}</Text></Text>
                </View>
                <View style={s.v29}>
                  <Icon xml={X3} width={18} height={18} style={s.v3} />
                  <Text style={s.t28} numberOfLines={1}>{!data ? "—" : passed === checkCount ? "Ready to release" : `${checkCount - passed} to check`}</Text>
                </View>
              </View>
              <View>
                <Text style={s.t31}>{`Run, dock notice and seal number go to ${driver ? `${driver.split(" ")[0]}'s` : "the driver's"} phone the moment you release.`}</Text>
              </View>
            </View>
            <View style={s.v38}>
              <View style={s.v34}>
                <View>
                  <Text style={s.t7}>{chilled ? `Reefer · needs ≤ ${MAX_CHILLED_C} °C` : "Reefer"}</Text>
                </View>
                <View>
                  <Text style={s.t33} testID="reefer-temp">{temp !== undefined ? `${temp} °C` : chilled ? "—" : "Ambient"}</Text>
                </View>
                <View>
                  <Text style={s.t7}>{precool !== null ? "pre-cool check on this tablet" : temp !== undefined ? "from the load record" : "not read yet"}</Text>
                </View>
              </View>
              <View style={s.v37}>
                <View>
                  <Text style={s.t7}>{"Lines accounted"}</Text>
                </View>
                <View>
                  <Text style={s.t36}>{data ? String(accounted) : "—"}<Text style={s.t35}>{data ? ` / ${total}` : ""}</Text></Text>
                </View>
                <View>
                  <Text style={s.t7}>{data ? `${loaded} loaded · ${short} short` : "—"}</Text>
                </View>
              </View>
            </View>
            <View style={s.v47}>
              <View style={s.v46}>
                <View style={s.v39}>
                  <Icon xml={X4} width={22} height={22} style={s.v3} />
                </View>
                <View style={s.v43}>
                  <View>
                    <Text style={s.t40}>{"Seal number"}</Text>
                  </View>
                  <View style={s.v42}>
                    <Text style={s.t41}>{"Goes on the driver's run"}</Text>
                  </View>
                </View>
                <View style={s.v45}>
                  <Icon xml={X5} width={13} height={13} style={s.v3} />
                  <TextInput
                    value={seal}
                    onChangeText={setSeal}
                    placeholder="Seal number"
                    placeholderTextColor="#8f98aa"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!sheet.released}
                    style={[s.t44, x.input]}
                    testID="seal-number"
                  />
                </View>
              </View>
            </View>
          </View>
          <View style={s.v62}>
            <View style={s.v61}>
              <View style={s.v51}>
                <View style={s.v2}>
                  <Text style={s.t49}>{"Release checklist"}</Text>
                </View>
                <View style={s.v2}>
                  <Text style={s.t50}>{!data ? "" : passed === checkCount ? "all passed" : `${passed} of ${checkCount} passed`}</Text>
                </View>
              </View>
              <View style={s.v60}>
                <View style={s.v53}>
                  <View style={s.v52}>
                    {ok.lines ? <Icon xml={X6} width={22} height={22} style={s.v3} /> : null}
                  </View>
                  <View style={s.v43}>
                    <View>
                      <Text style={s.t40}>{!data ? "Lines accounted" : ok.lines ? `All ${total} lines accounted` : `${accounted} of ${total} lines accounted`}</Text>
                    </View>
                    <View style={s.v42}>
                      <Text style={s.t41}>{data ? `${loaded} loaded${shortText ? ` · ${shortText}${lastAck ? `, ack'd ${hm(lastAck)}` : ", waiting for dispatch"}` : ""}` : "—"}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.v55}>
                  <View style={s.v52}>
                    {ok.order ? <Icon xml={X6} width={22} height={22} style={s.v3} /> : null}
                  </View>
                  <View style={s.v43}>
                    <View>
                      <Text style={s.t40}>{"Loaded in stop order"}</Text>
                    </View>
                    {lastStop && firstStop ? (
                      <View style={s.v42}>
                        <Text style={s.t41}>{`Stop ${lastStop.stopSeq}`}</Text>
                        <View style={s.v2}>
                          <Text style={s.t54}>{lastStop.outletId}</Text>
                        </View>
                        <Text style={s.t41}>{lastStop.id === firstStop.id ? "only" : `at the front · Stop ${firstStop.stopSeq}`}</Text>
                        {lastStop.id === firstStop.id ? null : (
                          <View style={s.v2}>
                            <Text style={s.t54}>{firstStop.outletId}</Text>
                          </View>
                        )}
                        {lastStop.id === firstStop.id ? null : <Text style={s.t41}>{"by the doors"}</Text>}
                      </View>
                    ) : (
                      <View style={s.v42}>
                        <Text style={s.t41}>{"—"}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={s.v55}>
                  <View style={s.v52}>
                    {ok.reefer ? <Icon xml={X6} width={22} height={22} style={s.v3} /> : null}
                  </View>
                  <View style={s.v43}>
                    <View>
                      <Text style={s.t40}>{"Reefer checked"}</Text>
                    </View>
                    <View style={s.v42}>
                      <Text style={s.t41}>{chilled ? `Needs ≤ ${MAX_CHILLED_C} °C${precool !== null ? " · pre-cool check" : ""}` : "Ambient load"}</Text>
                    </View>
                  </View>
                  <View style={s.v57}>
                    <View>
                      <Text style={s.t56}>{temp !== undefined ? `${temp} °C` : "—"}</Text>
                    </View>
                    <View>
                      <Text style={s.t7}>{!chilled ? "n/a" : temp === undefined ? "not read" : ok.reefer ? "passes" : "too warm"}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.v55}>
                  <View style={s.v52}>
                    {ok.seal ? <Icon xml={X6} width={22} height={22} style={s.v3} /> : null}
                  </View>
                  <View style={s.v43}>
                    <View>
                      <Text style={s.t40}>{"Doors sealed"}</Text>
                    </View>
                    <View style={s.v42}>
                      <Text style={s.t41}>{"Seal"}</Text>
                      <View style={s.v2}>
                        <Text style={s.t54}>{seal.trim() || "—"}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={s.v55}>
                  <View style={s.v52}>
                    {ok.driver ? <Icon xml={X6} width={22} height={22} style={s.v3} /> : null}
                  </View>
                  <View style={s.v43}>
                    <View>
                      <Text style={s.t40}>{"Driver at the bay"}</Text>
                    </View>
                    <View style={s.v42}>
                      <Text style={s.t41}>{driver ?? "No driver on this trip"}</Text>
                    </View>
                  </View>
                  <View style={s.v59}>
                    <Text style={s.t58}>{initials(driver) || "—"}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Scroll>
        <View style={s.v76}>
          <View style={s.v70}>
            <View style={s.v66}>
              <View style={s.v2}>
                <Text style={s.t65}><Text style={s.t64}>{data ? String(accounted) : "—"}</Text>{data ? ` of ${total} lines accounted` : ""}</Text>
              </View>
              <View style={s.v2}>
                <Text style={s.t65}>{short ? `${short} short${lastAck ? ", ack'd" : ", waiting"}` : ""}</Text>
              </View>
            </View>
            <View style={s.v69}>
              <View style={[s.v68, { width: `${total ? Math.round((accounted / total) * 100) : 0}%` }]}>
                <Grad g={G1} style={s.v67} />
              </View>
            </View>
          </View>
          <View style={s.v13} />
          <Tap style={s.v72} to={null} onPress={printCopy} disabled={!trip} testID="print-copy">
            <Icon xml={X7} width={22} height={22} style={s.v3} />
            <Text style={s.t71}>{"Print driver copy"}</Text>
          </Tap>
          <Tap lk="L225" style={s.v75} onPress={release} disabled={!trip || (!seal.trim() && !sheet.released)}>
            <Grad g={G2} style={s.v73} />
            <Icon xml={X8} width={22} height={22} style={s.v3} />
            <Text style={s.t74}>{sheet.released ? "Released" : `Release ${trip?.vehicleId ?? ""}${driver ? ` to ${driver.split(" ")[0]}` : ""}`.trim()}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X2 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#6d28d9\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"13\" height=\"13\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" fill=\"none\" stroke=\"#0a0f1a\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M15 18H9\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><circle cx=\"17\" cy=\"18\" r=\"2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle><circle cx=\"7\" cy=\"18\" r=\"2\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></circle></svg>";
const G0: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#1e2766","p":0},{"c":"#141b4d","p":1}]}];
const G1: GradSpec[] = [{"type":"linear","angle":90,"at":null,"repeat":false,"stops":[{"c":"#10b981","p":0},{"c":"#047857","p":1}]}];
const G2: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#243080","p":0},{"c":"#141b4d","p":1}]}];

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
  v14: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#3b4cca","borderRadius":3.5},
  t15: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v16: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e6e9f8","borderRadius":14},
  t17: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_800ExtraBold"},
  v18: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":34,"height":34,"backgroundColor":"#141b4d","borderRadius":17},
  t19: {"color":"#0a0f1a","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_700Bold"},
  t20: {"color":"#4a5467","fontSize":13,"lineHeight":15.6,"fontFamily":"Inter_600SemiBold"},
  v21: {"flexDirection":"column","alignItems":"stretch","flexShrink":1},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"flexShrink":0,"paddingRight":12,"paddingLeft":5,"height":44,"backgroundColor":"#ffffff","borderRadius":22,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v23: {"flexDirection":"row","alignItems":"center","rowGap":18,"columnGap":18,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":72},
  v24: {"borderRadius":24},
  t25: {"color":"#b9c0e6","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  t26: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t27: {"color":"#ffffff","fontSize":48,"lineHeight":48,"letterSpacing":-1.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t28: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v29: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#e3f6ec","borderRadius":14},
  v30: {"flexDirection":"row","justifyContent":"space-between","alignItems":"center","rowGap":12,"columnGap":12},
  t31: {"color":"#b9c0e6","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v32: {"flexDirection":"column","alignItems":"stretch","rowGap":10,"columnGap":10,"flexShrink":0,"paddingTop":20,"paddingRight":20,"paddingBottom":20,"paddingLeft":20,"borderRadius":24,"boxShadow":"rgba(20, 27, 77, 0.28) 0px 12px 32px 0px"},
  t33: {"color":"#0e7490","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16},
  t35: {"color":"#4a5467","fontSize":15,"lineHeight":22.5},
  t36: {"color":"#0a0f1a","fontSize":24,"lineHeight":36,"letterSpacing":-0.5,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v37: {"flexDirection":"column","alignItems":"stretch","rowGap":4,"columnGap":4,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":14,"paddingRight":16,"paddingBottom":14,"paddingLeft":16,"borderLeftWidth":1,"borderLeftColor":"#e3e6ed"},
  v38: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"backgroundColor":"#ffffff","borderRadius":20,"overflow":"hidden"},
  v39: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e6e9f8","borderRadius":14},
  t40: {"color":"#0a0f1a","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t41: {"color":"#344054","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v42: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t44: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"JetBrainsMono_700Bold"},
  v45: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":9,"paddingLeft":9,"height":26,"backgroundColor":"#e9ecf2","borderRadius":8},
  v46: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":60},
  v47: {"flexDirection":"column","alignItems":"stretch","flexShrink":0,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v48: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"flexShrink":0,"width":404},
  t49: {"color":"#0a0f1a","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  t50: {"color":"#4a5467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v51: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":4,"paddingLeft":4},
  v52: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e3f6ec","borderRadius":14},
  v53: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":80},
  t54: {"color":"#344054","fontSize":13,"lineHeight":18.2,"letterSpacing":-0.1,"fontFamily":"JetBrainsMono_600SemiBold"},
  v55: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":8,"paddingRight":16,"paddingBottom":8,"paddingLeft":16,"minHeight":80,"borderTopWidth":1,"borderTopColor":"#e3e6ed"},
  t56: {"color":"#0e7490","fontSize":20,"lineHeight":30,"letterSpacing":-0.4,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v57: {"flexDirection":"column","alignItems":"flex-end","rowGap":2,"columnGap":2,"flexShrink":0},
  t58: {"color":"#1a1300","fontSize":14,"lineHeight":21,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v59: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#f5b83d","borderRadius":14},
  v60: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v61: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v62: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v63: {"flexDirection":"row","alignItems":"stretch","rowGap":18,"columnGap":18,"paddingTop":4,"paddingRight":22,"paddingBottom":12,"paddingLeft":22},
  t64: {"color":"#0a0f1a","fontSize":20,"lineHeight":30,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t65: {"color":"#344054","fontSize":14,"lineHeight":21,"fontFamily":"Inter_600SemiBold"},
  v66: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline"},
  v67: {"borderRadius":4},
  v68: {"flexShrink":1,"width":"100%","borderRadius":4},
  v69: {"flexDirection":"row","alignItems":"stretch","flexShrink":1,"height":8,"backgroundColor":"#e9ecf2","borderRadius":4,"overflow":"hidden"},
  v70: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":1,"width":404},
  t71: {"color":"#0a0f1a","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v72: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":20,"paddingLeft":20,"height":58,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgba(0, 0, 0, 0.08) 0px 1px 2px 0px"},
  v73: {"borderRadius":18},
  t74: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v75: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":24,"paddingLeft":24,"height":58,"borderRadius":18,"boxShadow":"rgba(20, 27, 77, 0.25) 0px 8px 20px 0px"},
  v76: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"flexShrink":0,"paddingRight":22,"paddingLeft":22,"height":84},
  v77: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f2f4f8"},
});

const x = StyleSheet.create({
  input: { minWidth: 120, padding: 0, margin: 0 },
});
