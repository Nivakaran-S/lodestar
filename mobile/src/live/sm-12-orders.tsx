// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// SM-12 Orders · phone (P1, phone)
import { Text, View, StyleSheet } from 'react-native';
import { cutoffFor, groupByDay, orderCredit, podFor, useNow } from '@/model/store-face';
import { dayLabel, hm } from '@/lib/time';
import { plural, titleCase } from '@/lodestar/live';
import { today, useClaims, usePods, useStoreDay } from '@/model/hooks';
import type { Order } from '@/model/types';
import { Frame, Icon, Scroll, Tap, type ScreenNav } from '@/lodestar/runtime';

const nav: ScreenNav = {"links":{"L87":{"to":"sm-15-order-detail","kind":"go"},"L88":{"to":"sm-13-new-order","kind":"go"},"N0":{"to":"sm-11-today-order-day","kind":"nav"},"N2":{"to":"sm-19-receipts-and-credit-notes","kind":"nav"},"N3":{"to":"sm-21-messages","kind":"nav"}}};

const unitsOf = (orders: Order[], cls: Order['tempClass']) => orders.filter(o => o.tempClass === cls).reduce((n, o) => n + o.units, 0);
const PROBLEM: Order['status'][] = ['EXCEPTION', 'DEFERRED', 'CANCELLED'];

export default function ScreenSm12Orders() {
  const claims = useClaims();
  const day = useStoreDay();
  const pods = usePods();
  const outlet = day.data?.outlet;
  const groups = groupByDay(day.data?.orders ?? []);
  const t = today();
  const now = useNow();
  const upcoming = groups.filter(g => g.date >= t).reverse();
  const past = groups.filter(g => g.date < t);
  const empty = !claims ? 'Sign in to see your orders' : day.loading && !day.data ? 'Loading…' : day.error && !day.data ? 'No signal · nothing saved yet' : '';
  return (
    <Frame bg="#f4f5f9" nav={nav} style={s.v0}>
      <View style={s.v44}>
        <View style={s.v7}>
          <View style={s.v2}>
            <Icon xml={X0} width={36} height={36} style={s.v1} />
          </View>
          <View style={s.v5}>
            <View>
              <Text style={s.t3}>{"Orders"}</Text>
            </View>
            <View>
              <Text style={s.t4} numberOfLines={1}>{outlet ? `${outlet.name} · ${outlet.id}` : (claims?.outletId ?? '—')}</Text>
            </View>
          </View>
          <Tap lk="L88" style={s.v6}>
            <Icon xml={X1} width={20} height={20} style={s.v1} />
          </Tap>
        </View>
        <Scroll style={s.v24} contentStyle={s.v41}>
          <View style={s.v28}>
            <View style={s.v11}>
              <View style={s.v9}>
                <Text style={s.t8}>{"Upcoming"}</Text>
              </View>
              <View style={s.v9}>
                <Text style={s.t10}>{plural(upcoming.length, 'delivery', 'deliveries')}</Text>
              </View>
            </View>
            {upcoming.length ? upcoming.map((g, i) => {
              const units = g.orders.reduce((n, o) => n + o.units, 0);
              const first = g.orders[0];
              const st = first.tripStop;
              const cut = cutoffFor(g.date);
              const editable = now < cut && first.status === 'RECEIVED';
              const dry = unitsOf(g.orders, 'AMBIENT');
              const chilled = unitsOf(g.orders, 'CHILLED');
              return (
                <View key={g.date} style={s.v27}>
                  <Tap lk={i === 0 ? 'L87' : undefined} testID={i === 0 ? undefined : `upcoming-${i}`} style={s.v18} to={{ to: 'sm-15-order-detail', params: { order: first.id } }}>
                    <View style={s.v14}>
                      <View>
                        <Text style={s.t4}>{`${i === 0 ? 'Next delivery' : 'Delivery'} · ${dayLabel(g.date)}`}</Text>
                      </View>
                      <View>
                        <Text style={s.t13}>{String(units)}<Text style={s.t12}>{units === 1 ? " unit" : " units"}</Text></Text>
                      </View>
                    </View>
                    <View style={s.v17}>
                      <View style={s.v15} />
                      <Text style={s.t16} numberOfLines={1}>{titleCase(first.status)}</Text>
                    </View>
                  </Tap>
                  <View>
                    <Text style={s.t19}>{[plural(g.orders.length, 'order'), st?.etaModelBandEarly && st.etaModelBandLate ? `arrival window ${hm(st.etaModelBandEarly)}–${hm(st.etaModelBandLate)}` : st?.etaModel ? `ETA ~${hm(st.etaModel)}` : outlet ? `delivery window ${outlet.windowOpen}–${outlet.windowClose}` : '', editable ? `editable until 4:00 PM ${dayLabel(new Date(cut).toISOString())}` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <View style={s.v26}>
                    {dry ? (
                      <View style={s.v22}>
                        <View style={s.v20} />
                        <Text style={s.t21} numberOfLines={1}>{`Dry ${dry}`}</Text>
                      </View>
                    ) : null}
                    {chilled ? (
                      <View style={s.v22}>
                        <Icon xml={X2} width={14} height={14} style={s.v1} />
                        <Text style={s.t23} numberOfLines={1}>{`Chilled ${chilled}`}</Text>
                      </View>
                    ) : null}
                    <View style={s.v24} />
                    <Tap style={s.v22} testID={`upcoming-status-${i}`} to={{ to: 'sm-02-order-status-and-eta', params: { order: first.id } }}>
                      <View style={s.v9}>
                        <Text style={s.t25}>{"Open"}</Text>
                      </View>
                      <Icon xml={X3} width={18} height={18} style={s.v1} />
                    </Tap>
                  </View>
                </View>
              );
            }) : (
              <View style={s.v27}>
                <Tap lk="L87" style={s.v18}>
                  <View style={s.v14}>
                    <View>
                      <Text style={s.t4}>{empty || 'No delivery booked yet'}</Text>
                    </View>
                  </View>
                </Tap>
              </View>
            )}
          </View>
          <View style={s.v28}>
            <View style={s.v11}>
              <View style={s.v9}>
                <Text style={s.t8}>{"Past"}</Text>
              </View>
              <View style={s.v9}>
                <Text style={s.t10}>{past.length ? `last ${plural(past.length, 'delivery', 'deliveries')}` : ''}</Text>
              </View>
            </View>
            <View style={s.v40}>
              {past.length ? past.map((g, i) => {
                const units = g.orders.reduce((n, o) => n + o.units, 0);
                const credited = g.orders.reduce((n, o) => n + orderCredit(o, podFor(pods.data, o.id)).units, 0);
                const problem = credited > 0 || g.orders.some(o => PROBLEM.includes(o.status));
                const classes = new Set(g.orders.map(o => o.tempClass));
                const bad = g.orders.find(o => PROBLEM.includes(o.status));
                return (
                  <Tap key={g.date} style={i === 0 ? s.v36 : s.v39} testID={`order-row-${i}`} to={{ to: 'sm-15-order-detail', params: { order: g.orders[0].id } }}>
                    <View style={problem ? s.v37 : s.v29}>
                      <Icon xml={problem ? X6 : X4} width={22} height={22} style={s.v1} />
                    </View>
                    <View style={s.v34}>
                      <View>
                        <Text style={s.t30}>{dayLabel(g.date)}</Text>
                      </View>
                      <View style={s.v33}>
                        <Text style={s.t31}>{g.orders.length > 1 ? plural(g.orders.length, 'order') : classes.has('CHILLED') ? 'Chilled only' : 'Dry only'}</Text>
                        <View style={s.v32} />
                        <Text style={s.t31}>{plural(units, 'unit')}</Text>
                      </View>
                    </View>
                    <View style={s.v22}>
                      <Text style={problem ? s.t38 : s.t35} numberOfLines={1}>{credited ? `${credited} credited` : bad ? titleCase(bad.status) : titleCase(g.orders[0].status)}</Text>
                    </View>
                    <Icon xml={X5} width={18} height={18} style={s.v1} />
                  </Tap>
                );
              }) : (
                <View style={s.v36}>
                  <View style={s.v34}>
                    <Text style={s.t31}>{empty || 'No past orders yet'}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Scroll>
        <View style={s.v43}>
          <Tap lk="N0" style={s.v42}>
            <Icon xml={X7} width={22} height={22} style={s.v1} />
            <Text style={s.t4}>{"Today"}</Text>
          </Tap>
          <View style={s.v42}>
            <Icon xml={X8} width={22} height={22} style={s.v1} />
            <Text style={s.t16}>{"Orders"}</Text>
          </View>
          <Tap lk="N2" style={s.v42}>
            <Icon xml={X9} width={22} height={22} style={s.v1} />
            <Text style={s.t4}>{"Receipts"}</Text>
          </Tap>
          <Tap lk="N3" style={s.v42}>
            <Icon xml={X10} width={22} height={22} style={s.v1} />
            <Text style={s.t4}>{"Messages"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 32 32\" width=\"36\" height=\"36\" fill=\"#000000\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"32\" height=\"32\" rx=\"8\" fill=\"#047857\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></rect><g transform=\"translate(7.36 7.36) scale(0.72)\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></g></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 5v14M5 12h14\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#047857\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m9 18 6-6-6-6\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X6 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M14 2v6h6M8 13h8M8 17h5\" fill=\"none\" stroke=\"#b45309\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X7 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 9l1.5-5h15L21 9\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M5 13v8h14v-8M10 21v-5h4v5\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X8 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path><path d=\"M3.3 7 12 12l8.7-5M12 22V12\" fill=\"none\" stroke=\"#3b4cca\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X9 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6 9 17l-5-5\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X10 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"22\" height=\"22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"borderRadius":20},
  t3: {"color":"#101828","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  t4: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v5: {"flexDirection":"column","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#101828","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v9: {"flexShrink":1},
  t10: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v11: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  t12: {"fontSize":20,"lineHeight":20,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_700Bold"},
  t13: {"color":"#101828","fontSize":44,"lineHeight":44,"letterSpacing":-1.3,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v14: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":1},
  v15: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#3b4cca","borderRadius":3.5},
  t16: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#eef0ff","borderRadius":14},
  v18: {"flexDirection":"row","justifyContent":"space-between","alignItems":"flex-start","rowGap":12,"columnGap":12},
  t19: {"color":"#475467","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v20: {"flexShrink":1,"width":7,"height":7,"backgroundColor":"#475467","borderRadius":3.5},
  t21: {"color":"#475467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  t23: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v24: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t25: {"color":"#3b4cca","fontSize":14,"lineHeight":21,"fontFamily":"Inter_700Bold"},
  v26: {"flexDirection":"row","alignItems":"center","rowGap":16,"columnGap":16},
  v27: {"flexDirection":"column","alignItems":"stretch","rowGap":12,"columnGap":12,"paddingTop":20,"paddingRight":20,"marginRight":16,"paddingBottom":20,"paddingLeft":20,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":24,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px, rgba(15, 20, 50, 0.06) 0px 8px 24px 0px"},
  v28: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#e8f8f0","borderRadius":14},
  t30: {"color":"#101828","fontSize":16,"lineHeight":20.8,"fontFamily":"Inter_700Bold"},
  t31: {"color":"#475467","fontSize":13,"lineHeight":18.2,"fontFamily":"Inter_500Medium"},
  v32: {"flexShrink":1,"width":3,"height":3,"backgroundColor":"#636c80","borderRadius":1.5,"opacity":0.6},
  v33: {"flexDirection":"row","flexWrap":"wrap","alignItems":"center","rowGap":6,"columnGap":6},
  v34: {"flexDirection":"column","alignItems":"stretch","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t35: {"color":"#047857","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v36: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":56},
  v37: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":44,"height":44,"backgroundColor":"#fff4e0","borderRadius":14},
  t38: {"color":"#b45309","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v39: {"flexDirection":"row","alignItems":"center","rowGap":14,"columnGap":14,"paddingTop":10,"paddingRight":16,"paddingBottom":10,"paddingLeft":16,"minHeight":56,"borderTopWidth":1,"borderTopColor":"#eceef3"},
  v40: {"flexDirection":"column","alignItems":"stretch","flexShrink":1,"marginRight":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(15, 20, 50, 0.04) 0px 1px 2px 0px","overflow":"hidden"},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":16,"columnGap":16,"paddingTop":4,"paddingBottom":16},
  v42: {"flexDirection":"column","alignItems":"center","rowGap":3,"columnGap":3,"flexGrow":1,"flexShrink":1,"flexBasis":"0%","paddingTop":4,"paddingBottom":4},
  v43: {"flexDirection":"row","alignItems":"stretch","flexShrink":0,"paddingTop":6,"backgroundColor":"#ffffff","borderTopWidth":1,"borderTopColor":"#eceef3"},
  v44: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f4f5f9"},
});
