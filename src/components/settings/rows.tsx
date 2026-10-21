import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '../Pressable';
import { useUnderBars } from '../UnderBars';
import { makeStyles, outlinedClip, scene, usePressed } from '../../lib/theme/index';
import { Behind } from '../../lib/theme/Veil';

/**
 * What a row of Settings is made of, for the tab and for the page each of its
 * categories opens.
 *
 * They were the tab's own while every row was on the tab. The rows have since
 * gone to six pages, and a row has to be the same row on each: so the measures
 * are kept here once, and are the ones the tab had, to the number.
 */
export const useRows = makeStyles((c) => StyleSheet.create({
  /*
    One surface per group with its rows ruled off inside it. Clipped, so the
    top and bottom rows are cut to the card's own corners and no row has to
    know whether it is at an end.
  */
  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  /*
    A line of its own between the rows rather than a border on them. As a
    border it had to be turned off again on whichever row came first, and a
    row given its style as a list of two lost its padding when it was also
    inside a Link — so every row here is handed exactly one style object.
  */
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  /** Name on the left, whatever acts on it on the right, on one line. */
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },

  section: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  /** A heading that follows another card in the same column, and needs room above it. */
  sectionAfter: { marginTop: 24 },
  /** A line under a card that is about the whole card rather than a row of it. */
  aside: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  note: { color: c.success, fontSize: 12.5, marginTop: 8, marginLeft: 4 },
  noteBad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },

  /*
    Things side by side at the end of a row: what it is set to and its
    chevron. A row of alternatives, one of them the answer, is a `Segmented`.
  */
  choices: { flexDirection: 'row', gap: 6 },

  title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
  /** What a row that opens a list is set to at the moment, beside its chevron. */
  value: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },

  /*
    Two groups, beside each other where there is width for it and the page is
    long enough to be worth halving. The gap does for both ways round, being
    the space between them either way.
  */
  columns: { gap: 26 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
}));

/**
 * The page one category of Settings opens: its cards, scrolling, clear of
 * whatever is at the edges of the glass.
 *
 * [veiled] is for a page that lays a sheet over itself — a layer and not a
 * window, which only the playback sheet is — and [sheets] is where such a
 * sheet and any other go: beside the page and not inside what goes out of
 * focus behind them.
 */
export function SettingsPage({
  veiled = false,
  sheets,
  children,
}: {
  veiled?: boolean;
  sheets?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const styles = usePage();
  // In a theme of glass the screen's bar is over the top of this, and the rows pass under it.
  const under = useUnderBars();
  return (
    <View style={styles.screen}>
      <Behind veiled={veiled} style={styles.behind}>
        <ScrollView
          // The room is in what is scrolled, never round the scroller: room given to the scroller
          // itself is taken off how far it will scroll, and the last row stops short of its own edge.
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: 12 + under.top,
              paddingLeft: 20 + insets.left,
              paddingRight: 20 + insets.right,
              paddingBottom: 32 + insets.bottom,
            },
          ]}>
          {children}
        </ScrollView>
      </Behind>
      {sheets}
    </View>
  );
}

/**
 * A row of the tab that opens a category: its name, and under it one line of
 * what is inside, or of how things stand there where that is worth more.
 *
 * Closer set than the rows it leads to. There are six of these and they are
 * the whole of the tab, which is meant to be seen at once and not scrolled;
 * at a full row's height the sixth was under the bar of what is playing.
 */
export function CategoryRow({ href, title, note, value }: { href: Href; title: string; note: string; value?: string }) {
  const rows = useRows();
  const styles = usePage();
  const pressed = usePressed();
  return (
    // A box to itself. Six of them in one card, a line between each, read as one thing with six
    // parts; apart, each is a door, which is what it is.
    <View style={[rows.card, styles.category]}>
      <Link href={href} asChild>
        <Pressable android_ripple={pressed} accessibilityRole="button" style={rows.row}>
          <View style={rows.line}>
            <Text style={rows.title}>{title}</Text>
            <View style={rows.choices}>
              {value ? (
                <Text style={rows.value} numberOfLines={1}>
                  {value}
                </Text>
              ) : null}
              <Text style={rows.chevron} importantForAccessibility="no">›</Text>
            </View>
          </View>
          <Text style={rows.muted}>{note}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const usePage = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  behind: { flex: 1 },
  content: { paddingTop: 12 },
  category: { marginTop: 12 },
}));
