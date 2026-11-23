import type { ReactElement, ReactNode } from 'react';
import { ProgressBar } from './ProgressBar';
import { FlatList, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, TextButton } from './Button';
import { FootBar, useFootBar, type Action as CardAction, type FootActions } from './FootBar';
import { PauseIcon, PlayIcon } from './Icons';
import { usePageRoom } from './Page';
import { Note } from './Note';
import { Image } from './Picture';
import { About } from './About';
import { FadingScroll } from './FadingScroll';
import { Pressable } from './Pressable';
import { ScreenState } from './ScreenState';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { HEAD_COVER, ICON, LEADING, PAGE, RADIUS, ROW, SPACE, TOUCH, TYPE } from '../lib/theme/measures';
import { Behind } from '../lib/theme/Veil';
import { useLandscape } from '../lib/ui/layout';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';


// The small capitals over a group of rows: see `settings/rows`.
export { SectionLabel } from './settings/rows';
/*
  The page of one thing and what is in it: a record, a list, a show, a
  book. Its head -- the cover, the name, a line or two under it, what to do
  with all of it -- and under that the rows. Each of these was a page of its
  own making, with five cover sizes, four sizes of name, and a button of
  each shape; they are this.

  Settled with Kayra on 19 November 2026: a cover of 96 at the head and a
  name of 22 (`HEAD_COVER`, `TYPE.head`); the app's own buttons, rounded and
  not pills; the bar over the page saying what kind of page it is ("Album",
  "Podcast"), the name being written large just under it; and sideways,
  every one of them in two columns, the head down the left and the rows the
  whole height of the right.
*/

/** A link under the head: something more to do with the whole of it, in a word or two. */
export type HeadLink = {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger';
  disabled?: boolean;
  /** What a press does, for a screen reader, where the words do not say. */
  hint?: string;
};

/**
 * The cover at the head, from a picture's address, or an empty one of the
 * same size where there is none.
 */
export function HeadCover({ uri, size = HEAD_COVER }: { uri?: string | null; size?: number }) {
  const styles = useStyles();
  const shape = { width: size, height: size };
  if (!uri) return <View style={[styles.cover, styles.coverEmpty, shape]} />;
  return <Image source={{ uri }} style={[styles.cover, shape]} contentFit="cover" drawnAt={size} />;
}

/**
 * The head of the page: [cover] (drawn at `HEAD_COVER`; see `HeadCover`),
 * [title], and [lines] under it, the first of them in a stronger colour than
 * the rest; [about], what the thing says of itself, three lines of it and
 * the rest a press away; [note], something that just went wrong; then
 * [carryOn], the one thing to go on with (`ContinueCard`); [actions], the
 * app's own buttons in a row; [links] under them; and
 * [children], anything else the page has to say before its rows.
 *
 * [side] is the head down a column beside the rows, sideways: the cover over
 * the name rather than beside it.
 */
export function MediaHead({
  cover,
  title,
  lines = [],
  about,
  note,
  carryOn,
  actions,
  links,
  side = false,
  children,
}: {
  cover: ReactNode;
  /** Words, or words that lead somewhere (`AlbumLink`). */
  title: ReactNode;
  lines?: ReactNode[];
  about?: string | null;
  note?: ReactNode;
  carryOn?: ReactNode;
  actions?: CardAction[];
  links?: HeadLink[];
  side?: boolean;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const shown = lines.filter((line) => line != null && line !== '');
  return (
    <View style={styles.head}>
      <View style={side ? styles.identitySide : styles.identity}>
        {cover}
        <View style={styles.identityText}>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={side ? 2 : 3}>
            {title}
          </Text>
          {shown.map((line, at) => (
            <Text key={at} style={at === 0 ? styles.line : styles.lineQuiet} numberOfLines={2}>
              {line}
            </Text>
          ))}
          {note}
        </View>
      </View>
      {about ? <About text={about} /> : null}
      {carryOn}
      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button key={action.label} kind={action.kind ?? 'secondary'} {...action} wide={action.wide ?? true} />
          ))}
        </View>
      ) : null}
      {links && links.length > 0 ? (
        <View style={styles.links}>
          {links.map((link) => (
            <TextButton
              key={link.label}
              label={link.label}
              tone={link.tone ?? 'accent'}
              strong
              disabled={link.disabled}
              accessibilityHint={link.hint}
              onPress={link.onPress}
            />
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * A line the head says by the way, under its buttons: how big the download
 * would be, what following does. [bad] where it says something went wrong,
 * in the colour of a failure and at once to a screen reader.
 */
export function HeadNote({ children, bad = false }: { children: ReactNode; bad?: boolean }) {
  return <Note tone={bad ? 'bad' : 'muted'}>{children}</Note>;
}

/**
 * Carried on at one press: the part of a show or a book part way through, or
 * the next not heard, with how far in it is and how long is left. [label]
 * says which ("Continue", "Start"); [progress] is how far, from nought to one,
 * where it has been begun; [line] the time left or its length. [playing]
 * where it is the one playing now, which the button then pauses.
 */
export function ContinueCard({
  label,
  title,
  progress,
  line,
  playing,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  title: string;
  progress: number | null;
  line: string;
  playing: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.continue} onPress={onPress}>
      <View style={styles.continueText}>
        <Text style={styles.continueLabel}>{t.format.upper(label)}</Text>
        <Text style={styles.continueTitle} numberOfLines={2}>
          {title}
        </Text>
        {progress != null ? (
          <ProgressBar value={progress} style={styles.progress} />
        ) : null}
        <Text style={styles.lineQuiet}>{line}</Text>
      </View>
      <View style={styles.continuePlay}>
        {playing ? <PauseIcon size={ICON} color={c.onPrimary} /> : <PlayIcon size={ICON} color={c.onPrimary} />}
      </View>
    </Pressable>
  );
}



/**
 * The page: the skeleton every page has (`usePageRoom`), [head] at the top
 * and the rows under it, with [above] between the two (the label over the
 * rows, what they are filtered by). Sideways, the head is down a column of
 * its own at the left, which scrolls by itself, and the rows take the whole
 * height of the right: across the top it left the rows a line or two below
 * it. [head] is told which it is.
 *
 * [items] is null while they are being read; [error] is what went wrong
 * reading them, said where the rows would be, with [onRetry]. [footer] is
 * under the last row; [sheets] beside the page, which goes out of focus
 * behind them while [veiled]. [bar] is what can be done to what is chosen on
 * the page, along its foot while it is there (`FootBar`).
 *
 * [rows] is the page's own list, for one that does more than this one does
 * -- a list whose songs are dragged into order, pinched into a wall of
 * covers -- handed what goes over its rows and under them, each already
 * keeping the page's room, to put at its head and foot; [items] and the rest
 * of the list's own are then not asked for.
 */
export function MediaPage<T>({
  head,
  above,
  items,
  keyOf,
  renderItem,
  empty,
  error,
  onRetry,
  footer,
  sheets,
  veiled = false,
  bar,
  rows,
}: {
  head: (side: boolean) => ReactNode;
  above?: ReactNode;
  items?: readonly T[] | null;
  keyOf?: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  empty?: string;
  error?: string | null;
  onRetry?: () => void;
  footer?: ReactNode;
  sheets?: ReactNode;
  veiled?: boolean;
  bar?: FootActions | null;
  rows?: (ends: { header: ReactElement; footer: ReactElement }) => ReactNode;
}) {
  const styles = useStyles();
  const landscape = useLandscape();
  const foot = useFootBar(bar != null);
  const room = usePageRoom({ foot: foot.height });
  const states = error ? (
    <ScreenState kind="error" text={error} onRetry={onRetry} />
  ) : items == null ? (
    <ScreenState kind="loading" />
  ) : empty ? (
    <ScreenState kind="empty" text={empty} />
  ) : null;
  /*
    The rows reach the sides, as the library's do, and keep their own room
    inside them (`MediaRow`); what is over and under them keeps the page's.
  */
  const list = (sides: { paddingLeft: number; paddingRight: number }, header: ReactNode) =>
    rows ? (
      rows({
        header: (
          <View style={[sides, { paddingTop: room.paddingTop }]}>
            {header}
            {above}
          </View>
        ),
        footer: <View style={[sides, { paddingBottom: room.paddingBottom }]}>{footer}</View>,
      })
    ) : (
    <FlatList
      removeClippedSubviews={CLIP_SUBVIEWS}
      style={styles.list}
      data={items ?? []}
      keyExtractor={keyOf ?? String}
      contentContainerStyle={[styles.content, { paddingTop: room.paddingTop, paddingBottom: room.paddingBottom }]}
      ListHeaderComponent={
        <View style={sides}>
          {header}
          {above}
        </View>
      }
      ListEmptyComponent={<View style={[styles.content, sides]}>{states}</View>}
      ListFooterComponent={footer ? <View style={sides}>{footer}</View> : null}
      renderItem={({ item }) => <>{renderItem?.(item)}</>}
    />
    );
  if (!landscape) {
    return (
      <View style={styles.screen}>
        <Behind veiled={veiled} style={styles.list}>
          {list({ paddingLeft: room.paddingLeft, paddingRight: room.paddingRight }, head(false))}
          {bar ? <FootBar foot={foot} bar={bar} /> : null}
        </Behind>
        {sheets}
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <Behind veiled={veiled} style={[styles.list, styles.columns]}>
      <HeadColumn room={{ paddingTop: room.paddingTop, paddingLeft: room.paddingLeft, paddingRight: PAGE.side, paddingBottom: room.paddingBottom }}>
        {head(true)}
      </HeadColumn>
      <View style={styles.list}>
        {list({ paddingLeft: PAGE.side, paddingRight: room.paddingRight }, null)}
        {bar ? <FootBar foot={foot} bar={bar} /> : null}
      </View>
      </Behind>
      {sheets}
    </View>
  );
}

/**
 * Sideways, the head down a column of its own at the left, which scrolls by
 * itself should a long name and what is under it not fit. Its edges fade
 * where there is more of it past them: it stands still beside the rows, and
 * nothing else said that it moved at all (20 November 2026). Here and for a
 * record over the rack (`AlbumListing`).
 */
export function HeadColumn({ room, children }: { room: StyleProp<ViewStyle>; children: ReactNode }) {
  const styles = useStyles();
  return (
    <FadingScroll style={styles.side} contentContainerStyle={room}>
      {children}
    </FadingScroll>
  );
}

/**
 * Sideways, the head's column: a share of the width, within bounds. The same
 * for a record over the rack (`AlbumListing`), so the two cannot come to look
 * different.
 */
export const SIDE_COLUMN = { width: '38%', minWidth: 220, maxWidth: 290, flexGrow: 0 } as const;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, ...scene(c) },
    columns: { flexDirection: 'row' },
    side: { ...SIDE_COLUMN, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
    list: { flex: 1 },
    content: { flexGrow: 1 },

    cover: { borderRadius: RADIUS.control },
    coverEmpty: { backgroundColor: c.surfaceRaised },
    head: { gap: SPACE.l, paddingBottom: SPACE.s },
    identity: { flexDirection: 'row', alignItems: 'center', gap: SPACE.l },
    identitySide: { gap: SPACE.m },
    identityText: { flex: 1, minWidth: 0, gap: SPACE.xs },
    title: { color: c.text, fontSize: TYPE.head, fontWeight: '600' },
    line: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
    lineQuiet: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    actions: { flexDirection: 'row', gap: SPACE.s },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE.xl, rowGap: SPACE.xs },

    continue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.m,
      paddingHorizontal: ROW.horizontal,
      paddingVertical: ROW.vertical,
      borderRadius: RADIUS.card,
      overflow: 'hidden',
      backgroundColor: c.surface,
      ...outlinedClip(c),
    },
    continueText: { flex: 1, minWidth: 0, gap: SPACE.xs },
    continueLabel: { color: c.accent, fontSize: TYPE.label, fontWeight: '700', letterSpacing: 0.8 },
    continueTitle: { color: c.text, fontSize: TYPE.body, fontWeight: '600' },
    progress: { marginTop: SPACE.xs },
    continuePlay: {
      width: TOUCH.normal,
      height: TOUCH.normal,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
  })
);
