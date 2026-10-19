// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// SM-18 Report issue · phone (P1, phone)
// The store reports what is wrong with one order while counting it (opened from SM-03 with ?order=<id>).
// "Save issue" keeps it on the phone; SM-03 then counts those units as credited and sends the issue as the
// receipt note of Orders('…')/Lodestar.ConfirmReceipt (a short count also gets a credit note and a POD exception).
import { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { plural } from '@/lodestar/live';
import * as api from '@/model/api';
import { useClaims, useOrder } from '@/model/hooks';
import { useQuery } from '@/model/query';
import { ISSUE_LABEL, receiptIssues, saveIssue, type IssueKind } from '@/model/store-face';
import { Frame, Grad, Icon, Scroll, Tap, type ScreenNav, type GradSpec } from '@/lodestar/runtime';
import { useDepots } from '@/model/depots';

const nav: ScreenNav = {"links":{"L95":{"to":"sm-03-confirm-receipt-count","kind":"go"},"C":{"to":"sm-03-confirm-receipt-count","kind":"back"}}};

const KINDS: { kind: IssueKind; icon: string }[] = [
  { kind: 'SHORT', icon: 'X2' },
  { kind: 'DAMAGED', icon: 'X3' },
  { kind: 'TEMPERATURE', icon: 'X4' },
  { kind: 'WRONG_ITEM', icon: 'X5' },
];

export default function ScreenSm18ReportIssue() {
  const { name: depotName } = useDepots();
  const claims = useClaims();
  const q = useOrder();
  const order = q.data ?? q.day.data?.orders.find(o => o.id === q.id) ?? null;
  const depot = order?.outlet?.depot ?? q.day.data?.outlet?.depot;
  const hub = depot ? depotName(depot) : '';
  const lines = useQuery(order ? `lines.${order.id}` : null, c => api.orderLines(c, order ? [order.id] : []), { persist: true });
  const saved = order ? receiptIssues.get()[order.id] : undefined;
  const [kind, setKind] = useState<IssueKind>(saved?.kind ?? 'DAMAGED');
  const [units, setUnits] = useState(saved?.units ?? 1);
  const [note, setNote] = useState(saved?.note ?? '');
  const max = order?.units ?? 1;
  const bump = (d: number) => setUnits(n => Math.max(1, Math.min(max, n + d)));
  const line = lines.data?.[0];
  const more = (lines.data?.length ?? 0) - 1;

  const save = () => {
    if (!claims || !order) return true; // design preview: follow the prototype
    saveIssue({ orderId: order.id, kind, units, note });
    return true;
  };

  return (
    <Frame bg="#f4f5f9" nav={nav} style={s.v0}>
      <View style={s.v48}>
        <View style={s.v7}>
          <Tap lk="C" style={s.v2}>
            <Icon xml={X0} width={20} height={20} style={s.v1} />
          </Tap>
          <View style={s.v5}>
            <View>
              <Text style={s.t3}>{"Report an issue"}</Text>
            </View>
            <View>
              <Text style={s.t4} numberOfLines={1}>{order ? `${order.id} · ${order.tempClass === 'CHILLED' ? 'chilled' : 'dry'}` : !claims ? 'Sign in to report an issue' : q.loading ? 'Loading…' : 'No delivery yet'}</Text>
            </View>
          </View>
          <View style={s.v6} />
        </View>
        <Scroll style={s.v42} contentStyle={s.v43}>
          <View style={s.v13}>
            <View style={s.v10}>
              <View style={s.v9}>
                <Icon xml={X1} width={14} height={14} style={s.v1} />
                <Text style={s.t8} numberOfLines={1}>{line ? (more > 0 ? `${line.name} +${more} more` : line.name) : order ? plural(order.units, 'unit') : '—'}</Text>
              </View>
            </View>
            <View>
              <Text style={s.t11} testID="issue-summary">{`${plural(units, 'unit')} ${ISSUE_LABEL[kind].toLowerCase()}`}</Text>
            </View>
            <View>
              <Text style={s.t12}>{order ? `${plural(order.units, 'unit')} ordered${order.tripStop?.arrivalActual ? ` · arrived ${hm(order.tripStop.arrivalActual)}` : ''}` : ''}</Text>
            </View>
          </View>
          <View style={s.v22}>
            <View style={s.v17}>
              <View style={s.v15}>
                <Text style={s.t14}>{"What's wrong?"}</Text>
              </View>
              <View style={s.v15}>
                <Text style={s.t16}>{"pick one"}</Text>
              </View>
            </View>
            <View style={s.v21}>
              {KINDS.map(k => {
                const on = k.kind === kind;
                const xml = ICONS[k.icon].replace(/#636c80|#ffffff/g, on ? '#ffffff' : '#636c80');
                return (
                  <Tap key={k.kind} style={on ? s.v20 : s.v18} to={null} onPress={() => setKind(k.kind)} testID={`issue-${k.kind.toLowerCase()}`}>
                    <Icon xml={xml} width={20} height={20} style={s.v1} />
                    <Text style={on ? s.t19 : s.t3}>{ISSUE_LABEL[k.kind]}</Text>
                  </Tap>
                );
              })}
            </View>
          </View>
          <View style={s.v31}>
            <View style={s.v25}>
              <View>
                <Text style={s.t23}>{"Units affected"}</Text>
              </View>
              <View>
                <Text style={s.t24}>{"credited on confirm"}</Text>
              </View>
            </View>
            <View style={s.v30}>
              <Tap style={s.v27} to={null} onPress={() => bump(-1)} testID="issue-minus">
                <Text style={s.t26}>{"−"}</Text>
              </Tap>
              <View style={s.v29}>
                <Text style={s.t28} testID="issue-units">{String(units)}</Text>
              </View>
              <Tap style={s.v27} to={null} onPress={() => bump(1)} testID="issue-plus">
                <Text style={s.t26}>{"+"}</Text>
              </Tap>
            </View>
          </View>
          <View style={s.v41}>
            <TextInput
              style={[s.t39, s.input]}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
              placeholder="What happened? e.g. tray torn, leaking at one corner"
              placeholderTextColor="#98A1B3"
              accessibilityLabel={hub ? `Note for ${hub}` : 'Note for the depot'}
              testID="issue-note"
            />
            <View>
              <Text style={s.t40}>{`Note for ${hub || 'the depot'} · optional`}</Text>
            </View>
          </View>
        </Scroll>
        <View style={s.v47}>
          <Tap lk="L95" style={s.v46} onPress={save} to={order ? { to: 'sm-03-confirm-receipt-count', params: { order: order.id } } : undefined}>
            <Grad g={G1} style={s.v44} />
            <Text style={s.t45}>{"Save issue"}</Text>
          </Tap>
        </View>
      </View>
    </Frame>
  );
}

const X0 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M18 6 6 18M6 6l12 12\" fill=\"none\" stroke=\"#101828\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X1 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"14\" height=\"14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X2 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5 12h14\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X3 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 4h16v6l-3 2 3 2v6H4v-6l3-2-3-2z\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X4 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const X5 = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\" width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.17-2.83L3 3M21 3l-7.83 7.83\" fill=\"none\" stroke=\"#636c80\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill-opacity=\"1\" stroke-opacity=\"1\" fill-rule=\"nonzero\"></path></svg>";
const ICONS: Record<string, string> = { X2, X3, X4, X5 };
const G1: GradSpec[] = [{"type":"linear","angle":135,"at":null,"repeat":false,"stops":[{"c":"#4f5fe0","p":0},{"c":"#3b4cca","p":0.55},{"c":"#2f3cb0","p":1}]}];

const s = StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#ffffff","flex":1},
  v1: {"flexShrink":0,"overflow":"hidden"},
  v2: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":0,"width":40,"height":40,"backgroundColor":"#ffffff","borderRadius":20,"boxShadow":"rgba(0, 0, 0, 0.06) 0px 1px 2px 0px"},
  t3: {"color":"#101828","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  t4: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v5: {"flexDirection":"column","alignItems":"center","flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v6: {"flexShrink":0,"width":40},
  v7: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":0,"paddingRight":16,"paddingLeft":16,"height":52},
  t8: {"color":"#0e7490","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_600SemiBold"},
  v9: {"flexDirection":"row","alignItems":"center","rowGap":5,"columnGap":5,"flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8},
  t11: {"color":"#101828","fontSize":26,"lineHeight":31.2,"letterSpacing":-0.5,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  t12: {"color":"#475467","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingRight":20,"paddingLeft":20},
  t14: {"color":"#101828","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v15: {"flexShrink":1},
  t16: {"color":"#636c80","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v17: {"flexDirection":"row","justifyContent":"space-between","alignItems":"baseline","paddingRight":20,"paddingLeft":20},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":16,"paddingLeft":16,"width":166,"height":60,"backgroundColor":"#ffffff","borderRadius":16,"boxShadow":"rgba(0, 0, 0, 0.05) 0px 1px 2px 0px"},
  t19: {"color":"#ffffff","fontSize":15,"lineHeight":22.5,"fontFamily":"Inter_700Bold"},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":10,"columnGap":10,"flexShrink":1,"paddingRight":16,"paddingLeft":16,"width":166,"height":60,"backgroundColor":"#b42318","borderRadius":16,"boxShadow":"rgba(180, 35, 24, 0.22) 0px 6px 16px 0px"},
  v21: {"flexDirection":"row","flexWrap":"wrap","alignItems":"stretch","rowGap":10,"columnGap":10,"marginRight":16,"marginLeft":16},
  v22: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0},
  t23: {"color":"#101828","fontSize":16,"lineHeight":24,"fontFamily":"Inter_700Bold"},
  t24: {"color":"#475467","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_400Regular"},
  v25: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  t26: {"color":"#101828","fontSize":22,"lineHeight":33,"fontFamily":"Inter_700Bold"},
  v27: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"width":44,"height":44,"backgroundColor":"#ffffff","borderRadius":14},
  t28: {"color":"#101828","fontSize":24,"lineHeight":36,"fontVariant":["tabular-nums"],"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v29: {"flexDirection":"row","justifyContent":"center","alignItems":"center","flexShrink":1,"minWidth":52},
  v30: {"flexDirection":"row","alignItems":"center","flexShrink":1,"paddingTop":4,"paddingRight":4,"paddingBottom":4,"paddingLeft":4,"backgroundColor":"#eff1f7","borderRadius":18},
  v31: {"flexDirection":"row","alignItems":"center","rowGap":12,"columnGap":12,"flexShrink":0,"paddingTop":12,"paddingRight":12,"marginRight":16,"paddingBottom":12,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#ffffff","borderRadius":20},
  v32: {"borderRadius":16},
  t33: {"color":"#ffffff","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v34: {"alignSelf":"flex-start","paddingTop":2,"paddingRight":7,"paddingBottom":2,"paddingLeft":7,"backgroundColor":"rgba(15, 20, 34, 0.72)","borderRadius":11.8},
  v35: {"flexDirection":"column","justifyContent":"flex-end","alignItems":"stretch","flexShrink":0,"paddingTop":8,"paddingRight":8,"paddingBottom":8,"paddingLeft":8,"width":104,"height":104,"borderRadius":16,"overflow":"hidden"},
  t36: {"color":"#3b4cca","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v37: {"flexDirection":"column","justifyContent":"center","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":0,"width":104,"height":104,"borderWidth":1,"borderColor":"#d3d8e3","borderStyle":"dashed","borderRadius":16},
  v38: {"flexDirection":"row","alignItems":"stretch","rowGap":10,"columnGap":10,"marginRight":16,"marginLeft":16},
  t39: {"color":"#101828","fontSize":15,"lineHeight":21.8,"fontFamily":"Inter_400Regular"},
  t40: {"color":"#636c80","fontSize":13,"lineHeight":18.9,"fontFamily":"Inter_400Regular"},
  v41: {"flexDirection":"column","alignItems":"stretch","rowGap":6,"columnGap":6,"flexShrink":0,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"minHeight":84,"backgroundColor":"#ffffff","borderRadius":18,"boxShadow":"rgb(232, 235, 242) 0px 0px 0px 1px inset"},
  v42: {"flexGrow":1,"flexShrink":1,"flexBasis":"0%"},
  v43: {"flexDirection":"column","alignItems":"stretch","rowGap":14,"columnGap":14,"paddingTop":4,"paddingBottom":16},
  v44: {"borderRadius":18},
  t45: {"color":"#ffffff","fontSize":17,"lineHeight":25.5,"letterSpacing":-0.2,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v46: {"flexDirection":"row","justifyContent":"center","alignItems":"center","rowGap":10,"columnGap":10,"height":58,"borderRadius":18,"boxShadow":"rgba(59, 76, 202, 0.28) 0px 8px 20px 0px"},
  v47: {"flexDirection":"column","alignItems":"stretch","rowGap":8,"columnGap":8,"flexShrink":0,"paddingTop":12,"paddingRight":16,"paddingBottom":6,"paddingLeft":16,"backgroundColor":"#f4f5f9"},
  input: {"paddingTop":0,"paddingRight":0,"paddingBottom":0,"paddingLeft":0,"minHeight":44,"textAlignVertical":"top"},
  v48: {"flexDirection":"column","alignItems":"stretch","flexGrow":1,"flexShrink":1,"flexBasis":"0%","backgroundColor":"#f4f5f9"},
});
