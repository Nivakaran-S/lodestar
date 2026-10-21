// The field sign-ins (DR-06/07, SM-05/06 and their "can't sign in" screens) in a desktop or tablet browser.
// (On wide web windows every field sign-in, the Dock's included, uses this desk layout, as the Plan sign-in DSP-06.)
// Phones keep the designed screen; on the web at 768px and up the screen takes the desk sign-in layout of
// DSP-06 (P2, frontend/live/dsp-06-sign-in.tsx): a brand panel on the left (from 1024px) and the sign-in card
// centred on the page, in the field app's own brand colour and mark. Sign-in screens pass their card content as
// `desk`; the help screens without one show their phone body inside the card.
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { Frame, Grad, Tap, useInDockShell, type GradSpec, type ScreenNav, type TapAction } from './runtime';

export type DeskApp = 'dock' | 'run' | 'store';

const BRANDS: Record<DeskApp, { name: string; color: string; mark: string[]; tag: [string, string]; sub: string }> = {
  dock: {
    name: 'Lodestar Dock',
    color: '#6D28D9',
    mark: ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5M12 22V12'],
    tag: ['Every pallet,', 'on the right truck.'],
    sub: 'Load each truck against the approved plan, check every pallet and seal, and hand the run to the driver on time.',
  },
  run: {
    name: 'Lodestar Run',
    color: '#0369A1',
    mark: ['m3 11 19-9-9 19-2-8-8-2z'],
    tag: ['Every stop,', 'one thread.'],
    sub: 'Your run, your stops and proof of delivery in one place, with the depot a tap away even on a weak signal.',
  },
  store: {
    name: 'Lodestar Store',
    color: '#047857',
    mark: ['M3 9l1.5-5h15L21 9', 'M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z', 'M5 13v8h14v-8M10 21v-5h4v5'],
    tag: ['Every delivery,', 'checked in.'],
    sub: "See what's coming, receive it against the order, and flag anything short or damaged before the driver leaves.",
  },
};

const C = { bg: '#F4F5F9', text: '#0F1422', text2: '#4A5467', text3: '#636C80', line: '#D3D8E3', brand: '#3B4CCA', tint: '#EEF0FF', hair: '#ECEEF3', star: '#FFCB5C' };
const BTN: GradSpec[] = [{ type: 'linear', angle: 135, at: null, stops: [{ c: '#4F5FE0', p: 0 }, { c: '#3B4CCA', p: 0.55 }, { c: '#2F3CB0', p: 1 }] }];
const PANEL: GradSpec[] = [{ type: 'linear', angle: 160, at: null, stops: [{ c: '#1E2766', p: 0 }, { c: '#141B4D', p: 0.55 }, { c: '#0A0F2E', p: 1 }] }];

const noSubscribe = () => () => {};

/**
 * True in a desktop or tablet browser (web, 768px and wider): the screen shows its desk layout. False on the first
 * pass: the web build is pre-rendered without a window, so the width is read once mounted (no hydration mismatch).
 */
export function useDeskAuth(): boolean {
  const { width } = useWindowDimensions();
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  return Platform.OS === 'web' && mounted && width >= 768;
}

/** A stroked 24px icon (lucide paths), as the desk inputs and buttons draw them. */
export function DeskIcon({ d, size = 18, color = C.text3 }: { d: string[]; size?: number; color?: string }) {
  return (
    <View style={{ flexShrink: 0, pointerEvents: 'none' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {d.map((p, i) => <Path key={i} d={p} />)}
      </Svg>
    </View>
  );
}

export const ICONS = {
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'],
  key: ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'],
  arrow: ['M5 12h14', 'M12 5l7 7-7 7'],
  back: ['M19 12H5', 'M12 19l-7-7 7-7'],
};

function Mark({ app, size = 36 }: { app: DeskApp; size?: number }) {
  const b = BRANDS[app];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={8} fill={b.color} />
      <G transform="translate(7.36 7.36) scale(0.72)" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {b.mark.map((p, i) => <Path key={i} d={p} />)}
      </G>
    </Svg>
  );
}

function Art({ color, width }: { color: string; width: number }) {
  return (
    <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' }}>
      <Svg width={width} height={(width * 270) / 508} viewBox="0 0 508 270">
        <Circle cx={404} cy={66} r={58} fill="#F5B83D" opacity={0.1} />
        <Circle cx={404} cy={66} r={34} fill="#F5B83D" opacity={0.14} />
        <Path d="M404 30 L411.5 58.5 L440 66 L411.5 73.5 L404 102 L396.5 73.5 L368 66 L396.5 58.5 Z" fill="#F5B83D" />
        <Circle cx={404} cy={66} r={4} fill="#141B4D" />
        <Path d="M0 214 C 70 150 130 170 190 132 C 250 94 318 150 372 122 C 424 96 468 112 508 96 L508 270 L0 270 Z" fill={color} opacity={0.3} />
        <Path d="M0 244 C 90 200 168 222 250 188 C 330 156 412 204 508 172 L508 270 L0 270 Z" fill={color} opacity={0.55} />
        <Path d="M36 236 C 110 222 150 196 196 186 S 292 160 336 150 S 420 126 466 120" stroke="#F5B83D" strokeWidth={3} fill="none" strokeDasharray="1 10" strokeLinecap="round" />
        <Circle cx={36} cy={236} r={9} fill="#FFFFFF" />
        <Circle cx={36} cy={236} r={4} fill="#141B4D" />
        <Circle cx={196} cy={186} r={7} fill="#FFCB5C" />
        <Circle cx={336} cy={150} r={7} fill="#FFCB5C" />
        <Circle cx={466} cy={120} r={10} fill="#F5B83D" stroke="#FFFFFF" strokeWidth={3} />
      </Svg>
    </View>
  );
}

/**
 * The screen's Frame. At desk widths: the DSP-06 layout with `desk` as the card's content (or, without it, the
 * phone body inside the card); otherwise the designed phone screen, unchanged.
 */
export function DeskFrame({ app, bg, nav, style, desk, children }: {
  app: DeskApp; bg: string; nav: ScreenNav; style?: object; desk?: ReactNode; children: ReactNode;
}) {
  const wide = useDeskAuth();
  const { width, height } = useWindowDimensions();
  const inShell = useInDockShell();
  if (!wide || (inShell && !desk)) return <Frame bg={bg} nav={nav} style={style}>{children}</Frame>;
  const b = BRANDS[app];
  const brandW = width >= 1024 ? Math.min(620, width - 520) : 0;
  const padX = brandW >= 560 ? 56 : 40;
  return (
    <Frame bg={C.bg} nav={nav} style={s.page}>
      {brandW ? (
        <View style={[s.brand, { width: brandW, paddingHorizontal: padX }]} testID="desk-brand">
          <Grad g={PANEL} />
          <View style={s.logo}>
            <Mark app={app} />
            <Text style={s.logoText}>{b.name}</Text>
          </View>
          <View style={{ height: 18 }} />
          <Text style={s.tag}>{b.tag[0]}{'\n'}<Text style={{ color: C.star }}>{b.tag[1]}</Text></Text>
          <Text style={s.sub}>{b.sub}</Text>
          {height >= 760 ? <Art color={b.color} width={brandW - 2 * padX} /> : null}
          <View style={s.foot}>
            <DeskIcon d={ICONS.lock} size={15} color="#8E97C4" />
            <Text style={s.footText}>{'Waypoint Group staff only'}</Text>
          </View>
        </View>
      ) : null}
      <ScrollView style={s.main} contentContainerStyle={s.mainIn}>
        {desk ? (
          <View style={s.card} testID="desk-card">
            {brandW ? null : (
              <View style={s.logo}>
                <Mark app={app} size={32} />
                <Text style={[s.logoText, { color: C.text, fontSize: 18 }]}>{b.name}</Text>
              </View>
            )}
            {desk}
          </View>
        ) : (
          <View style={[s.card, s.phoneCard, { height: Math.min(820, height - 64), backgroundColor: bg }]} testID="desk-card">
            <View style={[style, { flex: 1 }]}>{children}</View>
          </View>
        )}
      </ScrollView>
    </Frame>
  );
}

/** Eyebrow, title and the line under it (`d-eyebrow`, `dx-h1xl`, `dx-t14`). */
export function DeskHead({ app, title, sub, error, note }: { app: DeskApp; title: string; sub?: ReactNode; error?: string | null; note?: string | null }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.eyebrow}>{`Waypoint Group · ${BRANDS[app].name}`}</Text>
      <Text style={s.h1}>{title}</Text>
      {error || note ? (
        <Text style={[s.t14, { color: error ? '#B42318' : C.text2 }]} testID="sign-in-note">{error ?? note}</Text>
      ) : sub ? <Text style={s.t14}>{sub}</Text> : null}
    </View>
  );
}

/** A labelled input (`dx-field`, `dx-input`, the focus ring while typing); `right` sits after the label. */
export function DeskField({ label, icon, prefix, right, ...input }: TextInputProps & {
  label: string; icon: string[]; prefix?: string; right?: ReactNode;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {right}
      </View>
      <View style={[s.input, focus ? s.inputFocus : null]}>
        <DeskIcon d={icon} />
        {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
        <TextInput
          {...input}
          onFocus={e => { setFocus(true); input.onFocus?.(e); }}
          onBlur={e => { setFocus(false); input.onBlur?.(e); }}
          style={[s.inputText, { outlineStyle: 'none' } as object]}
          placeholderTextColor="#98A2B3"
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

/** The primary (`dx-bigbtn`) or secondary (`dx-bigbtn--sec`) button; `lk` keeps the screen's link and testID. */
export function DeskButton({ lk, label, onPress, disabled, secondary, icon = ICONS.arrow, testID }: {
  lk?: string; label: string; onPress?: TapAction; disabled?: boolean; secondary?: boolean; icon?: string[] | null; testID?: string;
}) {
  return (
    <Tap lk={lk} style={[s.btn, secondary ? s.btnSec : s.btnPri]} onPress={onPress} disabled={disabled} testID={testID}>
      {secondary ? null : <Grad g={BTN} style={{ borderRadius: 16 }} />}
      {secondary && icon ? <DeskIcon d={icon} size={20} color={C.text} /> : null}
      <Text style={[s.btnText, secondary ? { color: C.text, fontFamily: 'Inter_700Bold' } : null]}>{label}</Text>
      {!secondary && icon ? <DeskIcon d={icon} size={20} color="#FFFFFF" /> : null}
    </Tap>
  );
}

/** The small print at the foot of the card (`dx-t13`). */
export function DeskSmall({ children, testID }: { children: ReactNode; testID?: string }) {
  return <Text style={s.t13} testID={testID}>{children}</Text>;
}

/** A text link (brand colour) for "Not you?", "Can't sign in?" and the like. */
export function DeskLink({ lk, label, onPress, to, testID }: { lk?: string; label: string; onPress?: TapAction; to?: null; testID?: string }) {
  return (
    <Tap lk={lk} onPress={onPress} to={to} testID={testID}>
      <Text style={s.link}>{label}</Text>
    </Tap>
  );
}

/** A tinted box on the card: what is kept, what waits, a deadline (`dx-inset`). `right` is a short status. */
export function DeskInset({ title, right, tone = 'plain', children, testID }: {
  title: string; right?: string; tone?: 'plain' | 'ok' | 'warn'; children?: ReactNode; testID?: string;
}) {
  const bg = tone === 'ok' ? '#ECFDF3' : tone === 'warn' ? '#FFF7E6' : C.bg;
  const fg = tone === 'ok' ? '#047857' : tone === 'warn' ? '#B45309' : C.text3;
  return (
    <View style={[s.inset, { backgroundColor: bg }]} testID={testID}>
      <View style={s.insetHead}>
        <Text style={s.insetT}>{title}</Text>
        {right ? <Text style={[s.insetR, { color: fg }]}>{right}</Text> : null}
      </View>
      {children ? <Text style={s.t14}>{children}</Text> : null}
    </View>
  );
}

/** "or" between the main action and the other ways in (`dx-or`). */
export function DeskOr() {
  return (
    <View style={s.or}>
      <View style={s.orLine} />
      <Text style={s.orText}>{'or'}</Text>
      <View style={s.orLine} />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  brand: { flexShrink: 0, flexDirection: 'column', gap: 22, paddingVertical: 48, overflow: 'hidden' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20 },
  tag: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 38, lineHeight: 42.5, letterSpacing: -1.14 },
  sub: { color: '#B9C0E6', fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24.8 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 'auto' },
  footText: { color: '#8E97C4', fontFamily: 'Inter_400Regular', fontSize: 13 },
  main: { flex: 1, minWidth: 0 },
  mainIn: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: {
    width: 460, maxWidth: '100%', gap: 22, paddingTop: 40, paddingHorizontal: 40, paddingBottom: 34, borderRadius: 28, backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 2px rgba(15,20,50,.04), 0 16px 48px rgba(15,20,50,.08)',
  },
  phoneCard: { padding: 0, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0, gap: 0, overflow: 'hidden' },
  eyebrow: { color: C.text3, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  h1: { color: C.text, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 34, lineHeight: 37.4, letterSpacing: -1.02 },
  t14: { color: C.text2, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  t13: { color: C.text3, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18.85 },
  inset: { gap: 4, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14 },
  insetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  insetT: { color: C.text, fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 21, flexShrink: 1 },
  insetR: { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { color: C.text2, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${C.line}`, overflow: 'hidden' },
  inputFocus: { boxShadow: `inset 0 0 0 2px ${C.brand}, 0 0 0 4px ${C.tint}` },
  prefix: { color: C.text2, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  inputText: { flex: 1, minWidth: 0, height: 46, padding: 0, margin: 0, borderWidth: 0, color: C.text, fontFamily: 'Inter_500Medium', fontSize: 15 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16 },
  btnPri: { boxShadow: '0 8px 20px rgba(59,76,202,.28)' },
  btnSec: { backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${C.line}` },
  btnText: { color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold', fontSize: 16 },
  link: { color: C.brand, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: C.hair },
  orText: { color: C.text3, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
