import { useIsFocused } from 'expo-router';
import { Children, Fragment, useState, type ReactNode } from 'react';
import { FlatList, SectionList, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from './Button';
import { Check } from './Check';
import { FootBar, useFootBar, type Action, type FootActions } from './FootBar';
import { PageNote, usePageRoom } from './Page';
import { Pressable, WholePress } from './Pressable';
import { ScreenState } from './ScreenState';
import { Chevron } from './settings/rows';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlinedClip, outlineWidth, scene, usePressed } from '../lib/theme/index';
import { CARD_GAP, LEADING, RADIUS, ROW, SPACE, TYPE } from '../lib/theme/measures';
import { useBack } from '../lib/ui/back';
import { haptic } from '../lib/ui/haptics';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

/*
  The page of cards to go through and settle, one at a time or several at
  once: copies of a song, files that may be one song, downloads that may be
  the wrong one, what could go to make room. Each of those was a page of its
  own making; they are this, and differ only in what is on their cards.

  Settled with Kayra on 19 November 2026: a box to tick at the left of a
  card; how something went said at the foot (`tell`), where it is seen
  wherever the page has been scrolled to; nothing asked before a file is
  deleted, Android asking that itself, and a small card (`ConfirmSheet`)
  before anything done to many that cannot be taken back.
*/

/** One thing to do, on a card or in the bar of what is chosen: see `Action`. */
export type CardAction = Action;

/** Which of a page's cards are ticked, by key: see `useChoosing`. */
export type Choosing = {
  count: number;
  /** Whether every card there is, is ticked. */
  every: boolean;
  has: (key: string) => boolean;
  toggle: (key: string) => void;
  /** Every card ticked, or, where every one already is, none. */
  toggleAll: () => void;
  clear: () => void;
  /** [some] ticked or unticked together: a group's box. */
  set: (some: readonly string[], on: boolean) => void;
  /** The ticked, in the order of [keys]. */
  picked: () => string[];
};

const NONE: ReadonlySet<string> = new Set();

/**
 * The cards ticked on a page, of those it has: [keys] is every card's, in
 * order. A card that has gone, answered or settled by another, is no longer
 * ticked; Back unticks them all before it leaves the page.
 */
export function useChoosing(keys: readonly string[]): Choosing {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(NONE);
  const there = new Set(keys);
  const chosen = new Set([...ticked].filter((key) => there.has(key)));
  const focused = useIsFocused();
  const clear = () => setTicked(NONE);
  useBack(chosen.size > 0 && focused, clear);
  return {
    count: chosen.size,
    every: keys.length > 0 && chosen.size === keys.length,
    has: (key) => chosen.has(key),
    toggle: (key) => {
      const next = new Set(chosen);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      haptic('choices', next.has(key) ? 'toggleOn' : 'toggleOff');
      setTicked(next);
    },
    toggleAll: () => {
      const all = keys.length > 0 && chosen.size === keys.length;
      haptic('choices', all ? 'toggleOff' : 'toggleOn');
      setTicked(all ? NONE : new Set(keys));
    },
    clear,
    set: (some, on) => {
      const next = new Set(chosen);
      for (const key of some) {
        if (on) next.add(key);
        else next.delete(key);
      }
      haptic('choices', on ? 'toggleOn' : 'toggleOff');
      setTicked(next);
    },
    picked: () => keys.filter((key) => chosen.has(key)),
  };
}

/** What can be done to everything ticked: see `CardListPage` [bar] and `FootBar`. */
export type ChosenBar = FootActions;

/**
 * The page itself: the skeleton every page has (`usePageRoom`), a note on
 * what the page is for, anything more the page has to say at the top
 * ([header]), and the cards; Select all over them where there is more than
 * one to tick. [items] is null while they are being read, and [error] what
 * went wrong reading them, with [onRetry] to read them again.
 *
 * [bar] is what can be done to everything ticked, in a bar along the foot
 * while anything is: over the foot of the list in a theme of glass, which
 * runs on under it, above the bar of what is playing.
 */
export function CardListPage<T>({
  items,
  keyOf,
  renderItem,
  note,
  header,
  empty,
  error,
  onRetry,
  choosing,
  bar,
  sheets,
}: {
  items: readonly T[] | null;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  note?: string;
  header?: ReactNode;
  empty: string;
  error?: string | null;
  onRetry?: () => void;
  choosing?: Choosing;
  bar?: ChosenBar;
  sheets?: ReactNode;
}) {
  const t = useT();
  const styles = useStyles();
  const frame = useFrame(choosing, bar);
  const list = items ?? [];
  return (
    <View style={styles.screen}>
      <FlatList
        removeClippedSubviews={CLIP_SUBVIEWS}
        data={list}
        keyExtractor={keyOf}
        contentContainerStyle={[styles.content, styles.apart, frame.room]}
        ListHeaderComponent={
          <Head
            note={note}
            header={header}
            all={
              choosing && list.length > 1 ? (
                <TextButton label={choosing.every ? t.common.clear : t.common.selectAll} strong onPress={choosing.toggleAll} />
              ) : null
            }
          />
        }
        ListEmptyComponent={<States loading={items == null} empty={empty} error={error} onRetry={onRetry} />}
        renderItem={({ item }) => <>{renderItem(item)}</>}
      />
      {frame.foot.shown && bar ? <FootBar foot={frame.foot} bar={bar} /> : null}
      {sheets}
    </View>
  );
}

/** One group of a `GroupedCardListPage`: its heading, its rows, and its own box to tick them all. */
export type CardGroup<T> = {
  key: string;
  title: string;
  subtitle?: string;
  rows: readonly T[];
  /** Ticks or unticks every row of it; mixed where only some are. */
  check?: { on: boolean; mixed: boolean; onPress: () => void; label: string };
};

/**
 * The same page, its cards groups that open to show their rows: a group is
 * a card whose heading is the top of it and whose rows, while it is open,
 * are the rest. For a page whose groups can hold hundreds of rows, which are
 * drawn as they are scrolled to and not all at once, as rows inside one
 * card would be. All shut at first, so that the foot of the page is in reach.
 */
export function GroupedCardListPage<T>({
  groups,
  keyOf,
  renderRow,
  note,
  header,
  empty,
  error,
  onRetry,
  choosing,
  bar,
  sheets,
  openHint,
}: {
  groups: readonly CardGroup<T>[] | null;
  keyOf: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  note?: string;
  header?: ReactNode;
  empty: string;
  error?: string | null;
  onRetry?: () => void;
  choosing?: Choosing;
  bar?: ChosenBar;
  sheets?: ReactNode;
  /** What opening a group does, for a screen reader. */
  openHint?: string;
}) {
  const styles = useStyles();
  const pressed = usePressed();
  const frame = useFrame(choosing, bar);
  const [open, setOpen] = useState<ReadonlySet<string>>(NONE);
  const sections = (groups ?? []).map((group) => ({ group, data: open.has(group.key) ? group.rows : [] }));
  return (
    <View style={styles.screen}>
      <SectionList
        removeClippedSubviews={CLIP_SUBVIEWS}
        sections={sections}
        keyExtractor={keyOf}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, frame.room]}
        ListHeaderComponent={
          <>
            <Head note={note} header={header} />
            <View style={styles.headEnd} />
          </>
        }
        ListEmptyComponent={<States loading={groups == null} empty={empty} error={error} onRetry={onRetry} />}
        renderSectionHeader={({ section: { group } }) => {
          const shown = open.has(group.key);
          return (
            <WholePress
              style={[styles.card, shown && styles.groupHeadOpen]}
              inside={styles.groupInside}
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityLabel={group.subtitle ? `${group.title}, ${group.subtitle}` : group.title}
              accessibilityState={{ expanded: shown }}
              accessibilityHint={openHint}
              onPress={() => {
                const next = new Set(open);
                if (next.has(group.key)) next.delete(group.key);
                else next.add(group.key);
                setOpen(next);
              }}
              controls={
                group.check ? (
                  <View style={styles.groupCheck}>
                    <Check on={group.check.on} mixed={group.check.mixed} onPress={group.check.onPress} accessibilityLabel={group.check.label} />
                  </View>
                ) : null
              }>
              <View style={styles.words}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.subtitle ? <Text style={styles.groupSubtitle}>{group.subtitle}</Text> : null}
              </View>
              {/* The same mark as a row that opens something, turned down while open. */}
              <Chevron turned={shown ? 'down' : null} />
            </WholePress>
          );
        }}
        renderItem={({ item, index, section }) => (
          <View style={[styles.piece, index === section.data.length - 1 && styles.pieceLast]}>
            <View style={styles.rule} />
            {renderRow(item)}
          </View>
        )}
        // The room every card has from the next.
        renderSectionFooter={() => <View style={styles.groupEnd} />}
      />
      {frame.foot.shown && bar ? <FootBar foot={frame.foot} bar={bar} /> : null}
      {sheets}
    </View>
  );
}

/** What both pages work out about their skeleton and the bar along their foot. */
function useFrame(choosing: Choosing | undefined, bar: ChosenBar | undefined) {
  const foot = useFootBar(bar != null && choosing != null && choosing.count > 0);
  return { foot, room: usePageRoom({ foot: foot.height }) };
}

/** The top of either page: its note, anything more it has to say, and Select all. */
function Head({ note, header, all }: { note?: string; header?: ReactNode; all?: ReactNode }) {
  const styles = useStyles();
  if (!note && !header && !all) return null;
  return (
    <View style={styles.header}>
      {note ? <PageNote>{note}</PageNote> : null}
      {header}
      {all ? <View style={styles.all}>{all}</View> : null}
    </View>
  );
}

/** Where the cards would be, while there are none: still being read, none, or none for something gone wrong. */
function States({ loading, empty, error, onRetry }: { loading: boolean; empty: string; error?: string | null; onRetry?: () => void }) {
  if (error) return <ScreenState kind="error" text={error} onRetry={onRetry} />;
  if (loading) return <ScreenState kind="loading" />;
  return <ScreenState kind="empty" text={empty} />;
}

/**
 * One card of the page: its rows (`CardRow`), ruled off from each other, and
 * under them what can be done to it alone. [check] puts a box to tick at its
 * left, beside all its rows, and [chosen] tints it while it is ticked.
 * [note] is a line under the rows, over the buttons, saying why the card is
 * as it is; [foot] is anything under the buttons: a word that acts, in its
 * own colour. [label] is what a screen reader calls the rows together, where
 * they are one choice among themselves (`CardRow` [choice]).
 */
export function ListCard({
  chosen = false,
  check,
  children,
  note,
  actions,
  foot,
  label,
}: {
  chosen?: boolean;
  check?: { on: boolean; onPress: () => void; label: string; shape?: 'box' | 'radio' };
  children: ReactNode;
  note?: string;
  actions?: CardAction[];
  foot?: ReactNode;
  label?: string;
}) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, chosen && styles.cardChosen]}>
      <View style={styles.body}>
        {check ? (
          <View style={styles.checkColumn}>
            <Check on={check.on} shape={check.shape} onPress={check.onPress} accessibilityLabel={check.label} />
          </View>
        ) : null}
        <View style={styles.rows} accessibilityRole={label ? 'radiogroup' : undefined} accessibilityLabel={label}>
          {rows.map((row, index) => (
            <Fragment key={index}>
              {index > 0 ? <View style={styles.rule} /> : null}
              {row}
            </Fragment>
          ))}
        </View>
      </View>
      {note ? (
        <>
          <View style={styles.rule} />
          <Text style={styles.cardNote}>{note}</Text>
        </>
      ) : null}
      {actions && actions.length > 0 ? (
        <View style={[styles.cardActions, note != null && styles.cardActionsAfterNote]}>
          {actions.map((action) => (
            <Button key={action.label} wide size="small" kind={action.kind ?? 'secondary'} {...action} />
          ))}
        </View>
      ) : null}
      {foot ? <View style={styles.cardFoot}>{foot}</View> : null}
    </View>
  );
}

/**
 * A row of a card: a small heading over it ([caption], "FROM", "KEEPS"),
 * what it is ([title]), and under that a line or two of less weight
 * ([subtitle], then [hint]); [extra] for anything else under them, [trailing]
 * at its right. Pressed as a whole where [onPress] is given.
 *
 * [choice] makes it one of the card's rows that are one choice among
 * themselves, chosen by pressing it: a round mark at its left, filled and
 * the row tinted, its caption in the accent, while it is the one. With
 * `shape: 'box'`, one of rows ticked together, a box at its left.
 */
export function CardRow({
  caption,
  title,
  subtitle,
  hint,
  extra,
  trailing,
  onPress,
  choice,
  accessibilityLabel,
  accessibilityHint,
}: {
  caption?: string;
  title: string;
  subtitle?: string;
  hint?: string;
  extra?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** `radio` by default; `box` for a row of several that may be ticked together. */
  choice?: { on: boolean; shape?: 'radio' | 'box' };
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const inside = (
    <>
      {choice ? (
        <View style={styles.lead}>
          <Check on={choice.on} shape={choice.shape ?? 'radio'} />
        </View>
      ) : null}
      <View style={styles.words}>
        {caption ? <Text style={[styles.caption, choice?.on && choice.shape !== 'box' && styles.captionOn]}>{t.format.upper(caption)}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {hint ? (
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
        {extra}
      </View>
      {trailing}
    </>
  );
  const row = [styles.row, choice && styles.rowChoice, choice?.on && styles.rowOn];
  if (!onPress) return <View style={row}>{inside}</View>;
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole={choice ? (choice.shape === 'box' ? 'checkbox' : 'radio') : 'button'}
      accessibilityState={choice ? { checked: choice.on } : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={row}
      onPress={onPress}>
      {inside}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, ...scene(c) },
    content: { flexGrow: 1 },
    // Between one card and the next, on the page whose cards are each one item.
    apart: { gap: CARD_GAP },
    header: { gap: SPACE.xs },
    all: { alignSelf: 'flex-end' },
    headEnd: { height: CARD_GAP },

    // A group: its heading the top of the card, and its rows, while it is open, the rest.
    groupHeadOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
    groupCheck: { paddingLeft: ROW.horizontal },
    groupInside: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: ROW.horizontal, paddingVertical: ROW.vertical },
    groupTitle: { color: c.text, fontSize: TYPE.body, fontWeight: '600' },
    groupSubtitle: { color: c.textMuted, fontSize: TYPE.hint, fontVariant: ['tabular-nums'] },
    groupEnd: { height: CARD_GAP },
    piece: {
      backgroundColor: c.surface,
      // The card's outline down either side, where the theme draws one.
      borderLeftWidth: outlineWidth(c),
      borderRightWidth: outlineWidth(c),
      borderColor: c.outline,
    },
    pieceLast: {
      borderBottomWidth: outlineWidth(c),
      borderBottomLeftRadius: RADIUS.card,
      borderBottomRightRadius: RADIUS.card,
      overflow: 'hidden',
    },

    card: { backgroundColor: c.surface, borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
    cardChosen: { backgroundColor: c.accentSoft },
    body: { flexDirection: 'row' },
    checkColumn: { paddingLeft: ROW.horizontal, paddingTop: ROW.vertical + SPACE.xs },
    rows: { flex: 1, minWidth: 0 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: ROW.horizontal },
    cardNote: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, paddingHorizontal: ROW.horizontal, paddingTop: ROW.vertical },
    cardActions: { flexDirection: 'row', gap: SPACE.s, paddingHorizontal: ROW.horizontal, paddingBottom: ROW.vertical },
    cardActionsAfterNote: { paddingTop: ROW.vertical },
    cardFoot: { alignItems: 'flex-end', paddingHorizontal: ROW.horizontal, paddingBottom: ROW.vertical },

    row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: ROW.horizontal, paddingVertical: ROW.vertical },
    // The mark at the top, beside the caption, however many lines are under it.
    rowChoice: { alignItems: 'flex-start' },
    rowOn: { backgroundColor: c.accentSoft },
    lead: { paddingTop: SPACE.xxs },
    words: { flex: 1, minWidth: 0, gap: SPACE.xxs },
    caption: { color: c.textMuted, fontSize: TYPE.label, fontWeight: '600', letterSpacing: 0.8, marginBottom: SPACE.xxs },
    captionOn: { color: c.accent },
    title: { color: c.text, fontSize: TYPE.body },
    subtitle: { color: c.textSecondary, fontSize: TYPE.small },
    hint: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },

  })
);
