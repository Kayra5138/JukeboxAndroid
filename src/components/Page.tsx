import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { useInCard } from './CardPages';
import type { Action } from './FootBar';
import { FormScroll } from './FormScroll';
import { usePageSides } from './NowPlayingBar';
import { FindIn } from './settings/Find';
import { useUnderBars } from './UnderBars';
import { makeStyles, scene } from '../lib/theme/index';
import { LEADING, PAGE, SPACE, TYPE } from '../lib/theme/measures';
import { Behind } from '../lib/theme/Veil';
import { useLandscape } from '../lib/ui/layout';

/**
 * The skeleton of every page a tab opens: how far in from each edge of the
 * glass what it scrolls begins and ends. Worked out here once; there were
 * seven ways of reckoning the foot alone, a page or two short of a bar, and
 * some sideways with the cutout's room on a side the rail already kept
 * clear of.
 *
 * - The sides: the page's margin (`PAGE.side`), and whatever is at that edge
 *   of the glass, which sideways is the rail's business on one side and the
 *   panel of what is playing's on the other (`usePageSides`). [edge] is for
 *   a list whose rows reach the edges and keep their own room inside them:
 *   only what is at the edge, then.
 * - The top: the page's margin, and the bar over it where its list runs on
 *   under that bar in a theme of glass (`useUnderBars`). [root] is for the
 *   page a tab opens on, which has no bar over it and keeps clear of the
 *   phone's own strip at the top itself upright; sideways the strip across
 *   the top of the tabs does that for it.
 * - The foot: the page's room past its last thing (`PAGE.bottom`), and the
 *   bars laid over its foot. Upright, the phone's own strip at the foot is
 *   under the tab bar, which keeps clear of it, and the page stops short of
 *   that bar; sideways there is no bar there, and the page keeps clear of
 *   the strip itself. [foot] is the height of a bar of the page's own laid
 *   over its foot above those, such as the one of what to do with what is
 *   chosen (`CardListPage`).
 *
 * Handed to what scrolls as the room inside it, never round it: room round a
 * scroller is taken off how far it scrolls, and its last row stops short of
 * its own edge.
 *
 *     <FlatList contentContainerStyle={[styles.content, usePageRoom()]} … />
 *
 * In the player's card of settings (`PageInCard`), the card's own room, and
 * nothing of the bars, which are nowhere near it.
 */
export function usePageRoom({ edge = false, foot = 0, root = false }: { edge?: boolean; foot?: number; root?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const sides = usePageSides();
  const landscape = useLandscape();
  const under = useUnderBars({ player: true });
  const inCard = useInCard();
  if (inCard) return IN_CARD;
  const margin = edge ? 0 : PAGE.side;
  const bars = under.bottom + foot + (landscape ? insets.bottom : 0);
  return {
    // Sideways the strip across the top keeps clear of the clock for every page (see the tabs' layout); the page's margin is enough under it.
    paddingTop: PAGE.top + (root ? (landscape ? 0 : insets.top) : under.top),
    paddingLeft: margin + sides.left,
    paddingRight: margin + sides.right,
    paddingBottom: PAGE.bottom + bars,
  };
}

/**
 * A page that scrolls as one thing, cards and all: the skeleton above, with
 * a scroller in it. [form] for one with boxes to type in, which keeps the
 * box being typed in above the keyboard (`FormScroll`).
 *
 * [head] is held above what scrolls rather than scrolled away with it, at
 * the page's margins: a picture to be watched while what is under it is
 * changed. What scrolls then starts under it, and keeps clear of nothing
 * else at its top.
 *
 * [veiled] is for a page that lays a sheet over itself, [sheets] the sheets:
 * see `Behind`. A line looked for from the search in Settings is scrolled to
 * and marked on any page of this (`FindIn`).
 */
export function PageScroll({
  children,
  head,
  sheets,
  veiled = false,
  form = false,
  edge = false,
}: {
  children: ReactNode;
  head?: ReactNode;
  sheets?: ReactNode;
  veiled?: boolean;
  form?: boolean;
  edge?: boolean;
}) {
  const styles = useStyles();
  const page = usePageRoom({ edge });
  const room = head == null ? page : { ...page, paddingTop: PAGE.top };
  const scroller = useRef<ScrollView>(null);
  const inCard = useInCard();
  // In the player's card, the card is the page: what scrolls, on the card's own ground.
  if (inCard) {
    return (
      <View style={styles.behind}>
        {head == null ? null : <View style={{ paddingLeft: page.paddingLeft, paddingRight: page.paddingRight }}>{head}</View>}
        {form ? (
          <FormScroll contentContainerStyle={room}>{children}</FormScroll>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={room}>
            {children}
          </ScrollView>
        )}
        {sheets}
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <Behind veiled={veiled} style={styles.behind}>
        {head == null ? null : (
          <View style={{ paddingTop: page.paddingTop, paddingLeft: page.paddingLeft, paddingRight: page.paddingRight }}>{head}</View>
        )}
        <FindIn scroller={form ? undefined : scroller}>
          {form ? (
            <FormScroll contentContainerStyle={[styles.content, room]}>{children}</FormScroll>
          ) : (
            <ScrollView
              ref={scroller}
              // A button pressed with the keyboard up, under a field on the page, works at the first touch.
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.content, room]}>
              {children}
            </ScrollView>
          )}
        </FindIn>
      </Behind>
      {sheets}
    </View>
  );
}

/**
 * The name at the top of a tab's own page, where the page scrolls (Lists,
 * Stats, Settings): one size for all of them (`TYPE.title`), with a line
 * under it, and the things to make or do there as round marks beside it
 * (`Button` [mark]), the first thing to make filled. Settled with Kayra on
 * 19 November 2026. The Library and Search have a bar of their own across
 * the top instead, and no name: the tab bar says where they are.
 */
export function TabTitle({ title, subtitle, actions = [] }: { title: string; subtitle?: ReactNode; actions?: Action[] }) {
  const styles = useStyles();
  return (
    <View style={styles.tabTitle}>
      <View style={styles.tabWords}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions.map((action) => (
        <Button key={action.label} kind={action.kind ?? 'secondary'} {...action} />
      ))}
    </View>
  );
}

/** What a page is for, said once at its top, over everything on it. */
export function PageNote({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.note}>{children}</Text>;
}

/** A page's room in the player's card: the card's own, all round. */
const IN_CARD = { paddingTop: SPACE.m, paddingLeft: SPACE.m, paddingRight: SPACE.m, paddingBottom: SPACE.m };

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, ...scene(c) },
    behind: { flex: 1 },
    // At least the page's height, so that something alone on it (`ScreenState`) can stand in the middle.
    content: { flexGrow: 1 },
    note: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small, marginBottom: SPACE.m },
    tabTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s, marginBottom: SPACE.l },
    tabWords: { flex: 1, minWidth: 0, gap: SPACE.xxs },
    title: { color: c.text, fontSize: TYPE.title, fontWeight: '700' },
    subtitle: { color: c.textMuted, fontSize: TYPE.small },
  })
);
