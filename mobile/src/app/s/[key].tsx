import { createElement, useEffect, type ComponentType, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';

import { FACES, SCREENS } from '@/screens/registry';
import { isDaylight, themedKey, useSettings } from '@/lib/settings';
import { setDayMode } from '@/lodestar/day-theme';
import { dockVariant, useWebWidth, useWideWeb } from '@/lodestar/dock-variant';
import { DockDesktopShell, ownsWideLayout } from '@/lodestar/dock-desktop-shell';
import { DRIVER_APP_START, runAvailable, screenInApp } from '@/lib/config';

// Screens are loaded once and kept, so a screen's component identity is stable across renders.
const loaded = new Map<string, ComponentType>();
function screenFor(key: string): ComponentType | undefined {
  const load = SCREENS[key];
  if (!load) return undefined;
  if (!loaded.has(key)) loaded.set(key, load());
  return loaded.get(key);
}

// A browser window at tablet/desktop width shows every phone screen the same way: a phone-sized card centred on the
// desk background. Tablet screens fill the window. The Run and Store sign-ins draw their own desk layout
// (lodestar/desk-auth.tsx). The Dock never shows a phone card there: its tablet screens and the desk sign-in (LD-06)
// fill the window, and every other Dock screen sits in the bay-tablet shell (lodestar/dock-desktop-shell.tsx).
const TABLET = new Set(FACES.filter(f => f.device === 'tablet').flatMap(f => f.screens.map(s => s.key)));
const OWN_DESK_LAYOUT = /^(?!ld-).*(sign-in|verify-code)/;
function PhoneColumn({ screen, children }: { screen: string; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const wide = useWideWeb();
  if (!wide || TABLET.has(screen) || OWN_DESK_LAYOUT.test(screen)) return <>{children}</>;
  if (screen.startsWith('ld-')) return ownsWideLayout(screen, TABLET) ? <>{children}</> : <DockDesktopShell screen={screen}>{children}</DockDesktopShell>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F4F5F9' }}>
      <View
        testID="phone-column"
        style={{
          width: 420, maxWidth: '100%', height: Math.min(880, height - 48), borderRadius: 28, overflow: 'hidden',
          backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,20,50,.04), 0 16px 48px rgba(15,20,50,.08)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// Any Lodestar screen by its key, e.g. /s/dr-02-stop-arrival (live screens read extra params, e.g. ?stop=…)
export default function ScreenRoute() {
  const { key: asked, ...params } = useLocalSearchParams<{ key: string }>();
  // Dock: the phone or the tablet variant of the screen for this width (dock-variant.ts); a resize swaps it too.
  const width = useWebWidth();
  const variant = asked && width ? dockVariant(asked, width === 'wide') : asked;
  const query = JSON.stringify(params);
  useEffect(() => {
    if (variant && variant !== asked) router.replace({ pathname: '/s/[key]', params: { ...JSON.parse(query), key: variant } });
  }, [variant, asked, query]);
  // Night or day screen (DR-24): the driver's run, route and summary have designed daylight variants.
  const { theme } = useSettings();
  const key = asked ? themedKey(asked, theme) : asked;
  const screen = key ? screenFor(key) : undefined;
  if (key?.startsWith('dr-') && !runAvailable()) return <RunIsAnAndroidApp />;
  // the driver's app has only Run's screens: anything else opens Run
  if (key && !screenInApp(key)) return <Redirect href={{ pathname: '/s/[key]', params: { key: DRIVER_APP_START } }} />;
  if (!screen) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0B1020' }}>
        <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_700Bold', fontSize: 18 }}>Screen not found</Text>
        <Link href="/" style={{ color: '#F5B83D', fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Back to Lodestar</Link>
      </View>
    );
  }
  if (variant !== asked) return <View style={{ flex: 1, backgroundColor: '#F4F5F9' }} />;
  // Day or night for every driver screen: a designed daylight variant draws itself; any other driver screen is its
  // night design in the daylight palette (lodestar/day-theme.ts). A change of mode remounts the screen.
  const day = key!.startsWith('dr-') && !key!.endsWith('-daylight') && isDaylight(theme);
  setDayMode(day);
  return <PhoneColumn key={day ? 'day' : 'night'} screen={key!}>{createElement(screen)}</PhoneColumn>;
}

// Lodestar Run on the web: drivers use the Android app (lib/config.ts, RUN_ON_WEB).
function RunIsAnAndroidApp() {
  return (
    <View testID="run-android-only" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, backgroundColor: '#0B1020' }}>
      <Text style={{ color: '#F2F4FA', fontFamily: 'Inter_800ExtraBold', fontSize: 22, textAlign: 'center' }}>Lodestar Run is an Android app</Text>
      <Text style={{ color: '#B9C0D4', fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 420 }}>
        Drivers run the day on their phone: the run stays on it with no signal, the photo and signature are taken there, and
        everything syncs when the signal is back. Open the Lodestar app on your Android phone and sign in with your phone number.
      </Text>
      {/* the website's start page, outside the field app's /field base path */}
      <Text role="link" onPress={() => window.location.assign('/')} style={{ color: '#F5B83D', fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Back to Waypoint Lodestar</Text>
    </View>
  );
}

// Static web export: pre-render every screen route.
export async function generateStaticParams(): Promise<{ key: string }[]> {
  return Object.keys(SCREENS).map(key => ({ key }));
}
