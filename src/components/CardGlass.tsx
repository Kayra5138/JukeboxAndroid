import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useCardTarget } from './Floating';
import { Frost, useFrosted } from './Frosted';
import { Pressable } from './Pressable';

/**
 * The back of a card floating over a tab's pages, in a theme of glass: what
 * is under the card, and only that, out of focus, so that its words are read
 * over a blur rather than over the page. The rest of the page is only dimmed.
 * The first thing in the card, filling it; the card's own fill is left off
 * where [useCardFrosted] says so.
 */
export function CardGlass() {
  const target = useCardTarget();
  const frosted = useFrosted(target);
  return frosted && target ? <Frost target={target} /> : null;
}

/** Whether a card is drawn on glass, its own fill to be left off for [CardGlass]. */
export function useCardFrosted(): boolean {
  return useFrosted(useCardTarget());
}

/**
 * A card floating over a page (`Floating`): [style] as it is drawn, its fill
 * left off for the glass where there is glass, and touches on it kept from
 * the scrim round it.
 */
export function FloatingCard({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const glass = useCardFrosted();
  return (
    <Pressable style={[style, glass && CLEAR]} onPress={swallow} accessible={false}>
      <CardGlass />
      {children}
    </Pressable>
  );
}

const swallow = () => {};
/** The card's own fill left to the glass, which draws what is under it, blurred, and its own wash over that. */
const CLEAR: ViewStyle = { backgroundColor: 'transparent', overflow: 'hidden' };
