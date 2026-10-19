// Lodestar Run in daylight, for every driver screen. Three screens have a designed daylight variant (DR-01, DR-15,
// DR-28, lib/settings.ts DAYLIGHT_VARIANTS); every other driver screen is drawn from its night design with the same
// palette those variants use (night colour → day colour, per kind: text, background, border, icon, gradient).
// The screen route turns day mode on for the screen it renders (setDayMode) and remounts it when the mode changes;
// a screen's style sheet answers in day colours through themed(), and Frame, Icon and Grad map their colours here.
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

type Palette = Record<string, string>;

// From the designed daylight variants (dr-01, dr-15, dr-28), then the design system's light tokens for colours only
// the other screens use (sky blue → en route, teal → chilled, red → exception, amber → deferred).
const TEXT: Palette = {
  '#f2f4fa': '#0a0f1a', '#b5bdd1': '#344054', '#7f89a3': '#4a5467', '#5ee0a8': '#047857', '#67e3f9': '#0e7490',
  '#a9b4ff': '#3b4cca', '#d6cfc7': '#57534e', '#f5b83d': '#141b4d', '#ff8a7a': '#b42318', '#ffc266': '#b45309',
  '#111522': '#ffffff', '#1a1300': '#ffffff', '#ffcb5c': '#b45309', '#6cc4f5': '#0369a1', '#b9c0e6': '#344054',
  '#c9cfe8': '#344054', '#7f89b8': '#4a5467',
};
const BG: Palette = {
  '#070b16': '#f2f4f8', '#0a0f1e': '#ffffff', '#0b1122': '#ffffff', '#121a2e': '#ffffff', '#1a2340': '#e9ecf2',
  '#161d3d': '#e6e9f8', '#0d2a20': '#e3f6ec', '#2e2208': '#fff1d6', '#3b4666': '#8f98aa', '#5ee0a8': '#047857',
  '#7f89a3': '#4a5467', '#b5bdd1': '#344054', '#f5b83d': '#141b4d', '#ffcb5c': '#141b4d', '#6cc4f5': '#0369a1',
  '#082b33': '#e3f8fc', '#0b2233': '#e6f4fc', '#321210': '#fef0ee', '#2c3760': '#e9ecf2',
};
const BORDER: Palette = { '#1b2338': '#e3e6ed', '#57534e': '#a8a29e', '#6cc4f5': '#0369a1', '#ffcb5c': '#b45309' };
const SVG: Palette = {
  '#111522': '#ffffff', '#5ee0a8': '#047857', '#67e3f9': '#0e7490', '#7f89a3': '#4a5467', '#b5bdd1': '#344054',
  '#d6cfc7': '#57534e', '#f2f4fa': '#0a0f1a', '#f5b83d': '#141b4d', '#ffc266': '#b45309', '#ffcb5c': '#b45309',
  '#6cc4f5': '#0369a1', '#07140f': '#ffffff',
};
// the amber bars and buttons become the navy of the designed daylight screens
const GRAD: Palette = { '#ffd37a': '#243080', '#f5b83d': '#1a2463', '#eda422': '#141b4d' };

let day = false;

/** Set by the screen route for the screen it is about to render. */
export function setDayMode(on: boolean): void {
  day = on;
}

/** True while a driver screen is drawn in daylight from its night design. */
export function inDayMode(): boolean {
  return day;
}

const swap = (p: Palette, c: unknown) => (typeof c === 'string' ? p[c.toLowerCase()] ?? c : c);

/** A night style in day colours. */
function dayStyle<S extends ViewStyle | TextStyle>(style: S): S {
  const out: Record<string, unknown> = { ...style };
  for (const [k, v] of Object.entries(style)) {
    if (k === 'color') out[k] = swap(TEXT, v);
    else if (k === 'backgroundColor') out[k] = swap(BG, v);
    else if (/^border\w*Color$/.test(k)) out[k] = swap(BORDER, v);
  }
  return out as S;
}

// Android crops a glyph at its text view's edges: with display type set tight (line height at or below about 1.2x the
// size, e.g. the 76 px ETA at 0.9x) the descender of "y" or the top of "4" is cut off. Give the glyphs room with
// padding, and take the same space back with a negative margin, so nothing in the layout moves.
const GLYPH_ROOM = 1.3;
function withGlyphRoom<S extends TextStyle>(style: S): S {
  const size = style.fontSize;
  const line = style.lineHeight;
  if (Platform.OS !== 'android' || !size || !line || size < 20 || line >= size * GLYPH_ROOM) return style;
  const pad = Math.ceil((size * GLYPH_ROOM - line) / 2);
  const n = (v: unknown) => (typeof v === 'number' ? v : 0);
  return {
    ...style,
    paddingTop: n(style.paddingTop) + pad,
    paddingBottom: n(style.paddingBottom) + pad,
    marginTop: n(style.marginTop) - pad,
    marginBottom: n(style.marginBottom) - pad,
  };
}

/**
 * A screen's style sheet (wrap the StyleSheet.create result): in day colours while day mode is on, and with room for
 * tightly set display type on Android.
 */
export function themed<T extends Record<string, ViewStyle | TextStyle>>(sheet: T): T {
  const cache = { night: new Map<string, unknown>(), day: new Map<string, unknown>() };
  return new Proxy(sheet, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      if (typeof key !== 'string' || !v || typeof v !== 'object') return v;
      const c = day ? cache.day : cache.night;
      if (!c.has(key)) {
        const roomy = withGlyphRoom(v as TextStyle);
        c.set(key, day ? dayStyle(roomy) : roomy);
      }
      return c.get(key);
    },
  });
}

/** An icon's SVG markup in day colours (fill and stroke). */
export function daySvg(xml: string): string {
  return xml.replace(/(fill|stroke)="(#[0-9a-fA-F]{6})"/g, (m, attr: string, c: string) => `${attr}="${swap(SVG, c)}"`);
}

/** A screen or panel background in day colours. */
export function dayBg(c: string): string {
  return swap(BG, c) as string;
}

/** A gradient stop colour in day colours. */
export function dayStop(c: string): string {
  return swap(GRAD, c) as string;
}
