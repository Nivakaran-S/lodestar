// Lodestar Dock on the web at 768px and up: every Dock screen without a tablet design (P3) sits in the bay-tablet
// shell of LD-21 / LD-02 tablet: the same header bar (Dock mark, depot · day, screen title, Bays / Flags / Shift
// navigation, user chip) over a wide content pane. No phone status bar (clock, wifi, battery): the browser and the
// tablet's own OS show those. The screen's Frame drops its phone chrome inside (DockShellContext),
// and its bottom tab bar is hidden (PhoneOnly): the header carries that navigation.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { FACES } from '@/screens/registry';
import { dayLabel } from '@/lib/time';
import { signOutTo } from '@/lodestar/live';
import { DockShellContext, Icon, Tap, openScreen } from '@/lodestar/runtime';
import { useClaims } from '@/model/hooks';
import { useDepots } from '@/model/depots';
import { s as bay, X2 } from '@/live/ld-21-bay-overview';

const NAMES = new Map(FACES.filter(f => f.app === 'dock').flatMap(f => f.screens.map(e => [e.key, e.name.replace(/^LD-\w+\s+/, '').replace(/ tab$/, '')] as const)));

const TABS = [
  { label: 'Bays', to: 'ld-21-bay-overview', keys: ['ld-01-dock-queue', 'ld-21-bay-overview', 'ld-19-empty-queue'] },
  { label: 'Flags', to: 'ld-13-flags-tab', keys: ['ld-13-flags-tab'] },
  { label: 'Shift', to: 'ld-16-shift-summary', keys: ['ld-16-shift-summary'] },
];

const initials = (name?: string) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');

/** The Dock screens that keep their own wide layout: the tablet screens and the desk sign-in (LD-06). */
export function ownsWideLayout(key: string, tablet: Set<string>): boolean {
  return tablet.has(key) || key === 'ld-06-sign-in';
}

export function DockDesktopShell({ screen, children }: { screen: string; children: ReactNode }) {
  const claims = useClaims();
  const { name: depotName } = useDepots();
  const depot = claims?.depots[0];
  const name = claims?.name ?? claims?.username;
  const today = new Date().toISOString();
  // a tablet held upright (768 px): tighter tabs and the avatar alone, so the bar fits without scrolling sideways
  const compact = useWindowDimensions().width < 960;
  return (
    <View style={[bay.v0, { backgroundColor: '#f2f4f8' }]} testID="dock-desktop-shell">
      <View style={[bay.v22, s.head]}>
        <View style={bay.v6}>
          <Icon xml={X2} width={36} height={36} style={bay.v3} />
        </View>
        <View style={[bay.v9, s.title]}>
          <Text style={bay.t7} numberOfLines={1}>{[depot ? depotName(depot) : 'Lodestar Dock', dayLabel(today)].filter(Boolean).join(' · ')}</Text>
          <Text style={bay.t8} numberOfLines={1}>{NAMES.get(screen) ?? 'Dock'}</Text>
        </View>
        <View style={bay.v10} />
        <View style={s.tabs}>
          {TABS.map(t => {
            const on = t.keys.includes(screen);
            return (
              <Tap key={t.to} style={[s.tab, compact && s.tabCompact, on && s.tabOn]} to={null} onPress={() => openScreen(t.to, undefined, 'nav')} testID={`dock-nav-${t.label.toLowerCase()}`}>
                <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
              </Tap>
            );
          })}
        </View>
        <View style={bay.v13} />
        {claims ? (
          <Tap style={[bay.v21, compact && s.chipCompact]} to={null} onPress={() => signOutTo('ld-20-shared-sign-in')} testID="switch-user">
            <View style={bay.v17}>
              <Text style={bay.t16}>{initials(name) || '—'}</Text>
            </View>
            {compact ? null : (
              <View style={bay.v20}>
                <Text style={bay.t18} numberOfLines={1}>{name ?? '—'}</Text>
                <Text style={bay.t19} numberOfLines={1}>{'Switch user'}</Text>
              </View>
            )}
          </Tap>
        ) : null}
      </View>
      <View style={s.body}>
        <View style={s.pane} testID="dock-desktop-pane">
          <DockShellContext.Provider value={true}>{children}</DockShellContext.Provider>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { borderBottomWidth: 1, borderBottomColor: '#e3e6ed', backgroundColor: '#f2f4f8' },
  title: { minWidth: 120, flexShrink: 1 },
  tabCompact: { minWidth: 0, paddingHorizontal: 12 },
  chipCompact: { paddingRight: 4 },
  tabs: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: '#e3e6ed' },
  tab: { minWidth: 88, height: 40, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#ffffff', boxShadow: 'rgba(0, 0, 0, 0.06) 0px 1px 2px 0px' },
  tabText: { color: '#4a5467', fontSize: 15, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  tabTextOn: { color: '#0a0f1a' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18 },
  pane: {
    flex: 1, width: '100%', maxWidth: 1080, borderRadius: 20, overflow: 'hidden', backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e3e6ed', boxShadow: '0 1px 2px rgba(15,20,50,.04), 0 8px 24px rgba(15,20,50,.05)',
  },
});
