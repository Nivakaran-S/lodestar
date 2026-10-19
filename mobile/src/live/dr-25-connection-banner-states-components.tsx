// Live screen (src/live): started from the generated screen of the same key, with real data and actions in the same Frame/Tap runtime.
// DR-25 Connection banner states · phone components (P4, phone)
import { Text, View, StyleSheet } from 'react-native';
import { hm } from '@/lib/time';
import { ConnectionBanner, ConnectionPill, useConnection } from '@/lodestar/connection-banner';
import { useRun } from '@/model/hooks';
import { Frame, type ScreenNav } from '@/lodestar/runtime';
import { themed } from '@/lodestar/day-theme';

const nav: ScreenNav = {"links":{}};

const at = (v?: string | number | null) => (v === null || v === undefined || v === '' ? '—' : hm(typeof v === 'number' ? new Date(v).toISOString() : v) || '—');

export default function ScreenDr25ConnectionBannerStatesComponents() {
  const { updatedAt } = useRun();
  const c = useConnection(updatedAt);
  const offline = c.state === 'no-signal' || c.state === 'offline-waiting';
  return (
    <Frame bg="#070b16" nav={nav} style={s.v0}>
      <View style={s.v24}>
        <View style={s.v2}>
          <Text style={s.t1}>{"Connection banner"}</Text>
        </View>
        <View style={s.v6}>
          <View style={s.v4}>
            <Text style={s.t3}>{at(new Date().toISOString())}</Text>
          </View>
          <Text style={s.t5}>{"Now · this phone"}</Text>
        </View>
        <ConnectionBanner savedAt={updatedAt} testID="banner-now" />
        <View style={s.v6}>
          <View style={s.v4}>
            <Text style={s.t3}>{at(updatedAt)}</Text>
          </View>
          <Text style={s.t5}>{updatedAt ? "Online · run saved" : "Online · run not saved yet"}</Text>
        </View>
        <ConnectionBanner state="online" savedAt={updatedAt} />
        <View style={s.v6}>
          <View style={s.v4}>
            <Text style={s.t3}>{offline ? at(c.since) : '—'}</Text>
          </View>
          <Text style={s.t5}>{"Signal lost"}</Text>
        </View>
        <ConnectionBanner state="no-signal" />
        <View style={s.v6}>
          <View style={s.v4}>
            <Text style={s.t3}>{offline ? at(c.since) : '—'}</Text>
          </View>
          <Text style={s.t5}>{"Offline with records waiting"}</Text>
        </View>
        <ConnectionBanner state="offline-waiting" />
        <View style={s.v6}>
          <View style={s.v4}>
            <Text style={s.t3}>{offline ? '—' : at(c.since)}</Text>
          </View>
          <Text style={s.t5}>{"Back online"}</Text>
        </View>
        <ConnectionBanner state="sending" />
        <View style={s.v6}>
          <View style={s.v4}>
            <Text style={s.t3}>{at(c.lastSyncedAt)}</Text>
          </View>
          <Text style={s.t5}>{"Everything sent"}</Text>
        </View>
        <ConnectionBanner state="sent" />
        <View style={s.v6}>
          <Text style={s.t5}>{"Matching nav pills"}</Text>
        </View>
        <View style={s.v23}>
          <ConnectionPill state="online" />
          <ConnectionPill state="no-signal" />
          <ConnectionPill state="offline-waiting" />
          <ConnectionPill state="sending" />
          <ConnectionPill state="sent" />
        </View>
        <View style={s.v23}>
          <ConnectionPill testID="pill-now" />
        </View>
      </View>
    </Frame>
  );
}

const s = themed(StyleSheet.create({
  v0: {"flexDirection":"column","alignItems":"stretch","backgroundColor":"#070b16","flex":1},
  t1: {"color":"#f2f4fa","fontSize":22,"lineHeight":33,"letterSpacing":-0.4,"fontFamily":"PlusJakartaSans_800ExtraBold"},
  v2: {"paddingRight":20,"paddingBottom":4,"paddingLeft":20},
  t3: {"color":"#ffcb5c","fontSize":13,"lineHeight":19.5,"fontFamily":"JetBrainsMono_700Bold"},
  v4: {"flexShrink":1},
  t5: {"color":"#7f89a3","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v6: {"flexDirection":"row","alignItems":"center","rowGap":8,"columnGap":8,"paddingTop":6,"paddingRight":20,"paddingLeft":20},
  v7: {"flexShrink":0,"marginTop":1,"overflow":"hidden"},
  t8: {"color":"#5ee0a8","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v9: {"flexDirection":"column","alignItems":"stretch","rowGap":2,"columnGap":2,"flexShrink":1},
  v10: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#0d2a20","borderRadius":18},
  t11: {"color":"#d6cfc7","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  t12: {"color":"#b5bdd1","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_400Regular"},
  v13: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":18},
  t14: {"color":"#6cc4f5","fontSize":14,"lineHeight":20.3,"fontFamily":"Inter_700Bold"},
  v15: {"flexDirection":"row","alignItems":"flex-start","rowGap":12,"columnGap":12,"paddingTop":14,"paddingRight":16,"marginRight":16,"paddingBottom":14,"paddingLeft":16,"marginLeft":16,"backgroundColor":"#0b2233","borderRadius":18},
  v16: {"flexShrink":0,"overflow":"hidden"},
  t17: {"color":"#5ee0a8","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v18: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0d2a20","borderRadius":14},
  t19: {"color":"#d6cfc7","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v20: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"borderWidth":1,"borderColor":"#57534e","borderStyle":"dashed","borderRadius":14},
  t21: {"color":"#6cc4f5","fontSize":13,"lineHeight":19.5,"fontFamily":"Inter_700Bold"},
  v22: {"flexDirection":"row","alignItems":"center","rowGap":6,"columnGap":6,"flexShrink":1,"paddingRight":12,"paddingLeft":12,"height":28,"backgroundColor":"#0b2233","borderRadius":14},
  v23: {"flexDirection":"row","flexWrap":"wrap","alignItems":"stretch","rowGap":8,"columnGap":8,"paddingRight":16,"paddingLeft":16},
  v24: {"flexDirection":"column","alignItems":"stretch","rowGap":12,"columnGap":12,"paddingTop":22,"paddingBottom":24},
}));
