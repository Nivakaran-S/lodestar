// The load-sheet truck diagram (truck.ts) drawn at the width of its card: phone-sized on a phone (302 px), wider on a
// large phone or a small tablet window, never wider than `max`. Keeps the drawing's 302 × 96 proportions.
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './runtime';

const W = 302;
const H = 96;

export function TruckDiagram({ xml, style, max = 560 }: { xml: string; style?: StyleProp<ViewStyle>; max?: number }) {
  const [width, setWidth] = useState(W);
  const w = Math.max(160, Math.min(max, width));
  return (
    <View
      style={{ alignSelf: 'stretch' }}
      testID="truck-diagram"
      onLayout={e => {
        const next = Math.round(e.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
    >
      <Icon xml={xml} width={w} height={Math.round((w * H) / W)} style={style} />
    </View>
  );
}
