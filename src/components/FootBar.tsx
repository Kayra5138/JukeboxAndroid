import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, type ButtonKind } from './Button';
import { usePageSides } from './NowPlayingBar';
import { footGlass, useLaidOver, useUnderBars } from './UnderBars';
import { makeStyles } from '../lib/theme/index';
import { LEADING, PAGE, SPACE, TYPE } from '../lib/theme/measures';
import { useLandscape } from '../lib/ui/layout';
import { Note } from './Note';

/** One thing to do: on a card, at the head of a page, or in the bar along its foot. */
export type Action = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** A mark in place of the word, which is then for a screen reader: see `Button`. */
  mark?: (color: string) => ReactNode;
  shape?: 'rounded' | 'pill';
  /** Whether it shares the width of the row with the others; on by default. */
  wide?: boolean;
};

/**
 * What the bar along a page's foot says, if anything, and what can be done
 * from it; [note], what is wrong with doing it, under what it says, as a
 * failure is said (`Note`).
 */
export type FootActions = { text?: string; note?: string | null; actions: Action[] };

/**
 * Where a page's bar along its foot is, while [shown]: measured, so that what
 * the page scrolls keeps clear of it (`usePageRoom` [foot]), which is how tall
 * it is in a theme of glass, where it is laid over the foot of the list, and
 * nought in any other, where it takes its own room under it.
 */
export function useFootBar(shown: boolean) {
  const laid = useLaidOver();
  const under = useUnderBars({ player: true });
  const sides = usePageSides();
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  return { shown, laid, height: shown ? laid.height : 0, under, sides, insets, landscape };
}

/**
 * The bar along the foot of a page of what can be done to what is chosen on
 * it: the downloads ticked on a record, the cards ticked on a page to tidy.
 * Over the foot of the list in a theme of glass, which runs on under it,
 * above the bar of what is playing; under the list in any other.
 */
export function FootBar({ foot, bar }: { foot: ReturnType<typeof useFootBar>; bar: FootActions }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.bar,
        {
          paddingLeft: PAGE.side + foot.sides.left,
          paddingRight: PAGE.side + foot.sides.right,
          paddingBottom: SPACE.m + (foot.landscape ? foot.insets.bottom : 0),
        },
        foot.laid.laid && [styles.barOver, { bottom: foot.under.bottom }],
      ]}
      onLayout={foot.laid.onLayout}>
      {bar.text ? (
        <Text style={styles.text} accessibilityLiveRegion="polite">
          {bar.text}
        </Text>
      ) : null}
      {bar.note ? <Note tone="bad">{bar.note}</Note> : null}
      <View style={styles.actions}>
        {bar.actions.map((action) => (
          <Button key={action.label} kind={action.kind ?? 'secondary'} {...action} wide={action.wide ?? true} />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    bar: { gap: SPACE.s, paddingTop: SPACE.m, backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    // Over the foot of the list in a theme of glass, which runs on under it, and over the bar of what is playing.
    barOver: footGlass(c),
    text: { color: c.text, fontSize: TYPE.small, lineHeight: LEADING.small },
    actions: { flexDirection: 'row', gap: SPACE.s },
  })
);
