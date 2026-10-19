// The receiver's signature (DR-03 / DR-20 pad, DR-22 record): strokes drawn with a finger (or mouse on the web) into an
// SVG of path data only. The box: 200 high (room to sign with a finger), a baseline, "Signed h:mm · saved on phone" under
// it, Clear top right.
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';

/** The signature's drawing space: 280 wide, and as high as the pad's shape needs (84 when unknown); points are scaled into it. */
export const SIGN_W = 280;
export const SIGN_H = 84;
/** Ink below this length (viewBox units) is a tap or a smudge, not a signature. */
export const MIN_SIGNATURE_LENGTH = 40;

export type Stroke = [number, number][];

/** The total length of the strokes (viewBox units). */
export function inkLength(strokes: Stroke[]): number {
  let n = 0;
  for (const s of strokes) for (let i = 1; i < s.length; i++) n += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  return n;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const pathOf = (s: Stroke) => s.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ');

/** The strokes as a standalone SVG (only <path d="M… L…">: what the server keeps after sanitising), or null if unsigned. */
export function signatureSvg(strokes: Stroke[], height: number = SIGN_H): string | null {
  if (inkLength(strokes) < MIN_SIGNATURE_LENGTH) return null;
  const paths = strokes.filter(s => s.length > 1).map(s => `<path d="${pathOf(s)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIGN_W} ${height}"><g fill="none" stroke="#111522" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

/** A stored signature recoloured for a dark card (the server draws it in ink for the desk's light pages). */
export const onDark = (svg: string) => svg.replace(/stroke="#[0-9a-fA-F]{3,6}"/g, 'stroke="#f2f4fa"');

type PadProps = {
  /** The SVG once there is enough ink, null after Clear (or while too short). */
  onChange: (svg: string | null) => void;
  /** Caption under the line ("Signed 6:58 · saved on phone"); a prompt while unsigned. */
  caption: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SignaturePad({ onChange, caption, style, testID = 'signature-pad' }: PadProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const box = useRef({ w: 1, h: 1 });
  // the drawing space has the pad's own shape (280 wide), so the ink lands exactly under the finger
  const [viewH, setViewH] = useState(SIGN_H);
  const viewHRef = useRef(SIGN_H);
  const live = useRef<Stroke[]>([]);
  const at = (e: GestureResponderEvent): [number, number] => {
    const { locationX, locationY } = e.nativeEvent;
    const h = viewHRef.current;
    return [Math.max(0, Math.min(SIGN_W, (locationX / box.current.w) * SIGN_W)), Math.max(0, Math.min(h, (locationY / box.current.h) * h))];
  };
  const measure = (w: number, h: number) => {
    box.current = { w: w || 1, h: h || 1 };
    const vh = Math.max(1, Math.round((SIGN_W * (h || 1)) / (w || 1)));
    if (vh !== viewHRef.current && !live.current.length) {
      viewHRef.current = vh;
      setViewH(vh);
    }
  };
  const commit = (next: Stroke[]) => {
    live.current = next;
    setStrokes(next);
  };
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);
  // one responder for the pad's life: it reads the latest strokes and onChange through refs
  // the handlers run on touches, never during render (the rule cannot tell)
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => commit([...live.current, [at(e)]]),
        onPanResponderMove: e => {
          const all = live.current.slice();
          all[all.length - 1] = [...(all[all.length - 1] ?? []), at(e)];
          commit(all);
        },
        onPanResponderRelease: () => changed.current(signatureSvg(live.current, viewHRef.current)),
        onPanResponderTerminate: () => changed.current(signatureSvg(live.current, viewHRef.current)),
      }),
  );
  const clear = () => {
    commit([]);
    onChange(null);
  };
  return (
    <View style={[x.box, style]} testID={testID}>
      <View style={x.ink} onLayout={e => measure(e.nativeEvent.layout.width, e.nativeEvent.layout.height)} {...pan.panHandlers} testID={`${testID}-surface`}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIGN_W} ${viewH}`} pointerEvents="none">
          {strokes.map((s, i) => (s.length > 1 ? <Path key={i} d={pathOf(s)} fill="none" stroke="#f2f4fa" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null))}
        </Svg>
      </View>
      <View style={x.line} pointerEvents="none" />
      <View style={x.caption} pointerEvents="none">
        <Text style={x.t9}>{caption}</Text>
      </View>
      {strokes.length ? (
        <Pressable style={x.clear} onPress={clear} accessibilityRole="button" testID={`${testID}-clear`}>
          <Text style={x.t55}>{'Clear'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A stored signature, read-only (DR-22). */
export function SignatureView({ svg, caption, testID = 'signature-view' }: { svg: string | null; caption: string; testID?: string }) {
  return (
    <View style={x.box} testID={testID}>
      {svg ? (
        <View style={x.ink} pointerEvents="none">
          <SvgXml xml={onDark(svg)} width="100%" height="100%" />
        </View>
      ) : null}
      <View style={x.line} />
      <View style={x.caption}>
        <Text style={x.t9}>{caption}</Text>
      </View>
    </View>
  );
}

const x = StyleSheet.create({
  box: { flexShrink: 1, height: 200, backgroundColor: '#0a0f1e', borderRadius: 16, overflow: 'hidden' },
  ink: { position: 'absolute', top: 8, left: 16, right: 16, height: 146 },
  line: { position: 'absolute', top: 154, right: 16, left: 16, height: 1, backgroundColor: '#3b4666' },
  caption: { position: 'absolute', top: 166, right: 16, left: 16 },
  clear: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, position: 'absolute', top: 10, right: 10, height: 32, backgroundColor: '#1a2340', borderRadius: 10 },
  t9: { color: '#7f89a3', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  t55: { color: '#b5bdd1', fontSize: 13, lineHeight: 19.5, fontFamily: 'Inter_700Bold' },
});
