import { Link, type Href } from 'expo-router';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageScroll } from '../Page';
import { Pressable } from '../Pressable';
import { Switch } from '../Switch';
import { Text } from './Find';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlinedClip, usePressed } from '../../lib/theme/index';
import { CARD_GAP, LEADING, RADIUS, ROW, SPACE, TYPE, TOUCH } from '../../lib/theme/measures';

/**
 * What a row of Settings is made of, for the tab and for the page each of its
 * categories opens.
 *
 * They were the tab's own while every row was on the tab. The rows have since
 * gone to six pages, and a row has to be the same row on each: so they are
 * kept here once, and their measures are the app's own (`theme/measures.ts`).
 */
export const useRows = makeStyles((c) => StyleSheet.create({
  /*
    One surface per group with its rows ruled off inside it. Clipped, so the
    top and bottom rows are cut to the card's own corners and no row has to
    know whether it is at an end.
  */
  card: { backgroundColor: c.surface, borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
  row: { paddingHorizontal: ROW.horizontal, paddingVertical: ROW.vertical, gap: SPACE.xs },
  /*
    A line of its own between the rows rather than a border on them. As a
    border it had to be turned off again on whichever row came first, and a
    row given its style as a list of two lost its padding when it was also
    inside a Link — so every row here is handed exactly one style object.
  */
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: ROW.horizontal },
  /** Name on the left, whatever acts on it on the right, on one line. */
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m, minHeight: TOUCH.row },

  section: {
    color: c.textFaint,
    fontSize: TYPE.label,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: SPACE.s,
    marginLeft: SPACE.xs,
  },
  /** A heading that follows another card in the same column, and needs room above it. */
  sectionAfter: { marginTop: CARD_GAP },
  /** A line under a card that is about the whole card rather than a row of it. */
  aside: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.s, marginLeft: SPACE.xs },
  /** Where a line of how something went stands under a card (`Note`). */
  noteRoom: { marginTop: SPACE.s, marginLeft: SPACE.xs },

  /*
    Things side by side at the end of a row: what it is set to and its
    chevron. A row of alternatives, one of them the answer, is a `Segmented`.
  */
  choices: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },

  title: { color: c.text, fontSize: TYPE.body, flexShrink: 1 },
  /** What a row that opens a list is set to at the moment, beside its chevron. */
  value: { color: c.textSecondary, fontSize: TYPE.small, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small },
  // A mark drawn as a letter, at the size the letter has to be to be seen as one.
  chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22, textAlign: 'center' },

  /*
    Two groups, beside each other where there is width for it and the page is
    long enough to be worth halving. The gap does for both ways round, being
    the space between them either way.
  */
  columns: { gap: CARD_GAP },
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
  // The skeleton every page has: see `PageScroll`.
  return (
    <PageScroll veiled={veiled} sheets={sheets}>
      {children}
    </PageScroll>
  );
}

/**
 * The small capitals over the rows, or over a card: what is under them, and
 * how many. [after] where something stands above it, from which it keeps a
 * card's distance.
 */
export function SectionLabel({ children, after = true }: { children: string; after?: boolean }) {
  const t = useT();
  const rows = useRows();
  return (
    <Text accessibilityRole="header" style={[rows.section, after && rows.sectionAfter]}>
      {t.format.upper(children)}
    </Text>
  );
}

/**
 * The mark at the end of what opens more: a page, a list, what folds open
 * under it. [turned] where it folds: `down` while what is under it is shut
 * and about to open downwards, or open below it; `up` once it is open, for
 * a row that folds back up. Drawn the same everywhere, where some thirty
 * rows each drew their own.
 */
export function Chevron({ turned = null }: { turned?: 'down' | 'up' | null }) {
  const rows = useRows();
  return (
    <Text style={[rows.chevron, turned === 'down' && TURNED_DOWN, turned === 'up' && TURNED_UP]} importantForAccessibility="no">
      ›
    </Text>
  );
}

const TURNED_DOWN = { transform: [{ rotate: '90deg' }] };
const TURNED_UP = { transform: [{ rotate: '-90deg' }] };

/** The line between two rows of a card (`useRows().rule`). */
export function Rule() {
  const rows = useRows();
  return <View style={rows.rule} />;
}

/**
 * A setting that is on or off: its name and its switch on one line, and
 * [hint], what it does, under them. [beside] stands between the name and the
 * switch (arrows to move it up and down a list). Each page drew its own, the
 * same some fifty times.
 */
export function SwitchRow({
  title,
  hint,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  beside,
}: {
  title: string;
  /** What a screen reader calls the switch, where the name alone does not say what it does. */
  accessibilityLabel?: string;
  hint?: ReactNode;
  value: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  accessibilityHint?: string;
  beside?: ReactNode;
}) {
  const rows = useRows();
  const toggle = (
    <Switch accessibilityLabel={accessibilityLabel ?? title} accessibilityHint={accessibilityHint} value={value} disabled={disabled} onValueChange={onChange} />
  );
  return (
    <View style={rows.row}>
      <View style={rows.line}>
        <Text style={rows.title}>{title}</Text>
        {beside ? (
          <View style={rows.choices}>
            {beside}
            {toggle}
          </View>
        ) : (
          toggle
        )}
      </View>
      {hint ? <Text style={rows.muted}>{hint}</Text> : null}
    </View>
  );
}

/**
 * A row that opens something more: a page ([href]) or a list of choices
 * ([onPress]). Its name, what it is set to ([value]) beside the chevron that
 * says there is more, and [hint] under them.
 */
export function LinkRow({
  title,
  value,
  hint,
  href,
  onPress,
}: {
  title: string;
  value?: string | null;
  hint?: ReactNode;
  href?: Href;
  onPress?: () => void;
}) {
  const rows = useRows();
  const pressed = usePressed();
  const row = (
    <Pressable android_ripple={pressed} accessibilityRole="button" style={rows.row} onPress={href ? undefined : onPress}>
      <View style={rows.line}>
        <Text style={rows.title}>{title}</Text>
        <View style={rows.choices}>
          {value ? (
            <Text style={rows.value} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          <Chevron />
        </View>
      </View>
      {hint ? <Text style={rows.muted}>{hint}</Text> : null}
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {row}
    </Link>
  ) : (
    row
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
              <Chevron />
            </View>
          </View>
          <Text style={rows.muted}>{note}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const usePage = makeStyles(() => StyleSheet.create({
  category: { marginTop: SPACE.m },
}));
