// Runtime for the generated Lodestar screens (src/screens). Each screen is laid out natively from the
// design; this file makes it behave: taps navigate exactly like the Figma prototype, back arrows go back,
// some screens advance by themselves, and "Read aloud" speaks on the device (no network needed).
// Live screens (src/live/<key>.tsx) use the same pieces with real data: a Tap may run an action before
// it navigates (`onPress`; return false to stay), go to a computed target (`to`, with route params),
// and `showToast()` shows a short message.
import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSettings } from '@/lib/settings';
import { dockVariant, isWideWeb } from './dock-variant';
import { dayBg, daySvg, dayStop, inDayMode } from './day-theme';
import { useStore } from '@/lib/store';
import { DRIVER_APP } from '@/lib/config';
import { network } from '@/offline/network';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';

export type Target = { to?: string; kind?: 'go' | 'nav' | 'back'; app?: string; screen?: string; params?: Record<string, string> };
type Toast = Target & { text?: string; tone?: 'info' | 'error' };
export type ScreenNav = { links: Record<string, Target>; auto?: Target; whole?: Target; parent?: string };

// Dock on the web at 768px and up (dock-desktop-shell.tsx): the screen sits in the desktop shell, so its Frame drops
// the phone chrome (safe areas, status bar) and phone-only parts (the bottom tab bar) are hidden.
export const DockShellContext = createContext(false);

/** True when the screen is drawn inside the Dock desktop shell. */
export function useInDockShell(): boolean {
  return useContext(DockShellContext);
}

/** Phone chrome (e.g. a screen's bottom tab bar): hidden inside the Dock desktop shell, which has its own navigation. */
export function PhoneOnly({ children }: { children: ReactNode }) {
  return useInDockShell() ? null : <>{children}</>;
}

const NavContext = createContext<{ nav: ScreenNav; notify: (t: Toast) => void }>({ nav: { links: {} }, notify: () => {} });

// Messages from anywhere (live screens' actions): the mounted Frame shows the latest one.
const toastSinks: ((t: Toast) => void)[] = [];

/** Show a short message on the current screen ("Saved on this phone", errors). */
export function showToast(text: string, tone: 'info' | 'error' = 'info') {
  toastSinks.at(-1)?.({ text, tone });
}

/** Open a screen by key, like a prototype link (for live screens). */
export function openScreen(to: string, params?: Record<string, string>, kind: Target['kind'] = 'go') {
  go({ to, params, kind }, () => {});
}

function go(t: Target | undefined, notify: (t: Toast) => void) {
  if (!t) return;
  // the design's walkthrough hint ("continues in <another app>"); a driver's phone has no other app to point to
  if (t.app) { if (!DRIVER_APP) notify(t); return; }
  if (!t.to) return;
  // Dock links open the tablet variant of a screen in a wide web window (dock-variant.ts); the screen route sends a
  // tablet screen back to its phone variant on a narrow one.
  const href = { pathname: '/s/[key]' as const, params: { ...t.params, key: isWideWeb() ? dockVariant(t.to, true) : t.to } };
  if (t.kind === 'back') { if (router.canGoBack()) router.back(); else router.replace(href); }
  else if (t.kind === 'nav') router.replace(href);
  else router.push(href);
}

// Sinhala and Tamil text is spoken with the matching on-device voice.
export function speak(text: string) {
  const language = /[඀-෿]/.test(text) ? 'si-LK' : /[஀-௿]/.test(text) ? 'ta-IN' : 'en-GB';
  Speech.stop();
  Speech.speak(text, { language, rate: 0.95 });
}

const isLight = (c: string) => {
  const m = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return true;
  const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

export function Frame({ bg, nav, children, style }: { bg: string; nav: ScreenNav; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const inShell = useInDockShell();
  const ctx = useMemo(() => ({ nav, notify: setToast }), [nav]);
  useEffect(() => {
    if (!nav.auto) return;
    const t = setTimeout(() => go(nav.auto, setToast), 1500);
    return () => clearTimeout(t);
  }, [nav.auto]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => () => { Speech.stop(); }, []);
  useEffect(() => {
    toastSinks.push(setToast);
    return () => { const i = toastSinks.lastIndexOf(setToast); if (i >= 0) toastSinks.splice(i, 1); };
  }, []);

  const body = <View style={style}>{children}</View>;
  const Outer = inShell ? View : PhoneSafeArea;
  return (
    <NavContext.Provider value={ctx}>
      <Outer style={{ flex: 1, backgroundColor: inDayMode() ? dayBg(bg) : bg }}>
        {inShell ? null : <StatusBar style={isLight(inDayMode() ? dayBg(bg) : bg) ? 'dark' : 'light'} />}
        {nav.whole ? (
          <Pressable style={{ flex: 1 }} onPress={() => go(nav.whole, setToast)}>{body}</Pressable>
        ) : body}
        {toast && (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 32, alignItems: 'center', pointerEvents: 'box-none' }}>
            <Pressable accessibilityRole="alert" testID="toast" onPress={() => setToast(null)} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: toast.tone === 'error' ? '#7A271A' : '#141B4D', boxShadow: '0 12px 32px rgba(10,15,40,0.28)' }}>
              {toast.text ? (
                <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }}>{toast.text}</Text>
              ) : (
                <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }}>
                  Continues in <Text style={{ color: '#F5B83D', fontFamily: 'Inter_700Bold' }}>{toast.app}</Text>: {toast.screen}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </Outer>
    </NavContext.Provider>
  );
}

function PhoneSafeArea({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  return <SafeAreaView edges={['top', 'bottom']} style={style}>{children}</SafeAreaView>;
}

export type TapAction = () => unknown;

// Runs a live screen's action; navigation follows unless it returns (or resolves to) false or throws.
async function runAction(onPress: TapAction | undefined, notify: (t: Toast) => void): Promise<boolean> {
  if (!onPress) return true;
  try {
    const r = await onPress();
    return r !== false;
  } catch (e) {
    notify({ text: (e as Error)?.message || 'Something went wrong', tone: 'error' });
    return false;
  }
}

// A tappable box. `lk` is the link code the generator put on it; `say` is text to read aloud.
// `group` marks a tappable card that holds other buttons (on the web a button can't contain a button).
// Live screens: `onPress` runs first, `to` overrides the prototype target, `disabled` blocks the tap.
// `label` names the button for screen readers when its content doesn't (an icon-only button, a row that flags).
export function Tap({ lk, say, group, style, children, onPress, to, disabled, testID, label }: {
  lk?: string; say?: string; group?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode;
  onPress?: TapAction; to?: Target | string | null; disabled?: boolean; testID?: string; label?: string;
}) {
  const { nav, notify } = useContext(NavContext);
  // gloves mode (LD-07): a wider touch area around every button
  const gloves = useSettings().glovesMode;
  const target = to === null ? undefined : to !== undefined ? (typeof to === 'string' ? { to, kind: 'go' as const } : to) : lk ? nav.links[lk] : undefined;
  return (
    <Pressable
      accessibilityRole={group ? undefined : 'button'}
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      testID={testID ?? (lk ? 'lk-' + lk : say ? 'say' : undefined)}
      hitSlop={gloves ? 12 : undefined}
      onPress={async () => {
        if (disabled) return;
        if (say) speak(say);
        if (await runAction(onPress, notify)) go(target, notify);
      }}
      style={({ pressed }) => [style as ViewStyle, pressed && !disabled && { opacity: 0.72 }, disabled && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  );
}

// A tappable run of text inside a paragraph.
export function TapText({ lk, style, children, onPress }: { lk: string; style?: StyleProp<TextStyle>; children?: ReactNode; onPress?: TapAction }) {
  const { nav, notify } = useContext(NavContext);
  return <Text style={style} testID={'lk-' + lk} onPress={async () => { if (await runAction(onPress, notify)) go(nav.links[lk], notify); }} suppressHighlighting>{children}</Text>;
}

// The screen's scrolling body: top bar, action bar and tab bar stay fixed around it.
export function Scroll({ style, contentStyle, children }: { style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <ScrollView style={style} contentContainerStyle={[{ flexGrow: 1 }, contentStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

// The design draws a crossed-out signal icon on many status chips ("On the way", "Online", "0 waiting"). It means
// "no signal" only when there is none: online, the same chip shows the plain signal icon, in the same colour.
const NO_SIGNAL = 'M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20';
const SIGNAL = 'M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0';

/** The icon's markup for the current connection: a no-signal icon becomes the signal icon while online. */
export function signalAware(xml: string, online: boolean): string {
  return online && xml.includes(NO_SIGNAL) ? xml.split(NO_SIGNAL).join(SIGNAL) : xml;
}

export function Icon({ xml, width, height, style }: { xml: string; width: number; height: number; style?: StyleProp<ViewStyle> }) {
  const online = useStore(network).online;
  const shown = signalAware(xml, online);
  return (
    <View style={[style, { pointerEvents: 'none' }]}>
      <SvgXml xml={inDayMode() ? daySvg(shown) : shown} width={width} height={height} />
    </View>
  );
}

// CSS gradients, drawn with SVG so they look the same on iOS, Android and the web preview.
// Layers are listed top-first, like CSS background-image.
export type GradStop = { c: string; p: number | null; px?: number };
export type GradSpec = { type: 'linear' | 'radial'; angle: number; at: [number, number] | null; repeat?: boolean; stops: GradStop[] };

export function Grad({ g, style }: { g: GradSpec[]; style?: StyleProp<ViewStyle> }) {
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const stops = (x: GradSpec) => x.stops.map((st, i) => (
    <Stop key={i} offset={String(st.p ?? (x.stops.length === 1 ? 0 : i / (x.stops.length - 1)))} stopColor={inDayMode() ? dayStop(st.c) : st.c} />
  ));
  return (
    <View style={[StyleSheet.absoluteFill, style, { overflow: 'hidden', pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          {g.map((x, i) => {
            if (x.type === 'radial') {
              const [cx, cy] = x.at ?? [0.5, 0.5];
              return <RadialGradient key={i} id={id + i} cx={cx} cy={cy} r={0.71} fx={cx} fy={cy}>{stops(x)}</RadialGradient>;
            }
            const a = (x.angle * Math.PI) / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
            return <LinearGradient key={i} id={id + i} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>{stops(x)}</LinearGradient>;
          })}
        </Defs>
        {g.map((_, i) => g.length - 1 - i).map(i => <Rect key={i} x={0} y={0} width="100%" height="100%" fill={`url(#${id + i})`} />)}
      </Svg>
    </View>
  );
}
