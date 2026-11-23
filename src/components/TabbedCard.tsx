import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './Button';
import { CardPagesOf, useCardPages } from './CardPages';
import { FloatLayer, InWindow } from './Floating';
import { Frost, useFrosted } from './Frosted';
import { BackIcon, CrossIcon } from './Icons';
import { Segmented, type SegmentedOption } from './Segmented';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, page } from '../lib/theme/index';
import { ICON, RADIUS, SPACE, TYPE } from '../lib/theme/measures';

/**
 * A card holding a few things to change at once, a tab for each ([tabs], the
 * one showing [tab]): the player's settings, laid over the player itself.
 * Where it stands is [style]'s to say; the card is the same wherever it is.
 *
 * Glass in a theme of glass: what is under it ([behind]) out of focus
 * behind its words, as a bar is (`Frost`), and its own ground otherwise. The
 * tabs along its top, and beside them the mark that closes it ([onClose]),
 * since the card may leave nothing round it to touch for never mind; what a
 * tab has more of than the card's height scrolls, from its top again for
 * each tab.
 *
 * A place of its own: a page opened from it (`OnAPage`, `PageInCard`) is a
 * page in it, its name and a way back where the tabs were, and a small card
 * asked in it (`Floating`) is over it, in it, so that nothing opened from it
 * goes anywhere else.
 */
export function TabbedCard<Tab extends string>({
  tabs,
  tab,
  onTab,
  onClose,
  behind,
  style,
  children,
}: {
  tabs: readonly SegmentedOption<Tab>[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  onClose: () => void;
  behind: RefObject<View | null> | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const t = useT();
  const styles = useStyles();
  const frosted = useFrosted(behind);
  // What is opened from it opens in it (`PageInCard`): the newest shown, over the tab it was opened from.
  const { pages, open } = useCardPages();
  const top = open.at(-1) ?? null;
  return (
    /*
      A view and not a press of its own, kept from what is round it by being
      over it: a press holding the touch from where it began kept the scroller
      in it from taking a drag that began on words.
    */
    <View style={[frosted ? styles.glass : styles.card, style]}>
      {/*
        The whole of it, the outline drawn over it after: a view cuts what is
        in it to inside its own border, and a border of its own left a line
        round the glass that showed the player sharp through it.
      */}
      {frosted && behind ? <Frost target={behind} /> : null}
      <CardPagesOf value={pages}>
        {/* Its small cards in it, over what it shows, rather than windows of their own over the player (`Floating`). */}
        <InWindow value={false}>
          <FloatLayer active={false} target={behind} foot={false}>
            <View style={styles.head}>
              {top ? (
                <>
                  <Button kind="secondary" size="small" label={t.common.back} mark={(ink) => <BackIcon size={ICON} color={ink} />} onPress={top.onClose} />
                  <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
                    {top.title}
                  </Text>
                </>
              ) : (
                <Segmented role="tab" options={tabs} value={tab} onChange={onTab} style={styles.tabs} />
              )}
              <Button kind="secondary" size="small" label={t.common.close} mark={(ink) => <CrossIcon size={ICON} color={ink} />} onPress={onClose} />
            </View>
            {/* Kept, out of sight, under a page it opened: what is open in it, and what it asked the page for, is its own. */}
            <ScrollView
              key={tab}
              style={[styles.scroll, top && styles.away]}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {top == null ? null : top.bare ? (
              <View key={top.key} style={styles.scroll}>
                {top.body}
              </View>
            ) : (
              <ScrollView key={top.key} style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                {top.body}
              </ScrollView>
            )}
          </FloatLayer>
        </InWindow>
      </CardPagesOf>
      {frosted ? <View pointerEvents="none" style={styles.rim} /> : null}
    </View>
  );
}

/** An edge without what a theme of glass adds to a surface besides: its sheen and its shadow. */
function lineOf({ experimental_backgroundImage: _sheen, boxShadow: _shadow, ...line }: ReturnType<typeof outlined>) {
  return line;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Its own ground where there is no glass, a page's, so that the cards in it stand off it as on the pages they are also on.
    card: { ...page(c), borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
    // No border of its own, each side said (see `outlinedClip`): the line is the rim's, over the glass.
    glass: {
      borderRadius: RADIUS.card,
      overflow: 'hidden',
      borderWidth: 0,
      borderTopWidth: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderColor: 'transparent',
    },
    // The card's outline, over its glass: only the line, and none of the light a surface has across its top, which would be over the words.
    rim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.card, ...lineOf(outlined(c)) },
    head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s, padding: SPACE.m, paddingBottom: SPACE.s },
    tabs: { flex: 1 },
    title: { flex: 1, color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
    away: { display: 'none' },
    scroll: { flex: 1 },
    body: { padding: SPACE.m },
  })
);
