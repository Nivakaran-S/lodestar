// A screen with a fixed action footer (DR-03 "Complete stop"): the scrolling body gets bottom padding as tall as the
// footer, plus the on-screen keyboard while it is open, so the last fields (the receiver's name, the signature pad)
// can always be scrolled clear of the footer and the keyboard on a tall phone (e.g. 1080 × 2400, edge to edge).
import { useEffect, useState } from 'react';
import { Keyboard, type LayoutChangeEvent } from 'react-native';

export function useFooterInset(min = 0) {
  const [footer, setFooter] = useState(0);
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboard(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const onFooterLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setFooter(prev => (prev === h ? prev : h));
  };
  return { paddingBottom: Math.max(min, footer) + keyboard, onFooterLayout };
}
