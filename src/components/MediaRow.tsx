import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Check } from './Check';
import { MoreButton } from './MoreButton';
import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { makeStyles, usePressed } from '../lib/theme/index';
import { DISABLED, PAGE, RADIUS, SPACE, TOUCH, TYPE } from '../lib/theme/measures';
import { haptic } from '../lib/ui/haptics';

/*
  A row of a list of things to play: a song, an album, a tape, an episode.
  The one the app has; there were some twenty, with seven sizes of cover,
  five sizes of name and four ways of saying which one is playing.

  Settled with Kayra on 19 November 2026: two sizes, `normal` everywhere and
  `compact` where many are to be seen at once (the queue, a picker), which is
  shorter and has a smaller cover and the same writing; the one
  playing in the accent and heavier; and the three dots of its menu on every
  row that has one (`MoreButton`, which Settings → Look can take away).
*/

/** How far in from the side of the list a row's contents start: the page's own margin. */
export const ROW_SIDE = PAGE.side;

/**
 * How tall a row is, at the phone's size of writing: 68 at the ordinary size
 * for a `normal` row and 56 for a `compact` one, and taller as the writing is
 * turned up. One figure for every row of a size rather than each measuring
 * itself, so that a list can lay itself out, and a drag find the slot under
 * the finger, by arithmetic. The two lines take some thirty points of it,
 * which grow with the writing, and the rest stays; held to twice the size,
 * which is as large as Android's setting goes.
 */
export function mediaRowHeight(size: RowSize, fontScale: number): number {
  const scale = Math.min(Math.max(fontScale, 1), 2);
  if (size === 'tall') return Math.round(28 + 52 * scale);
  return size === 'normal' ? Math.round(35 + 33 * scale) : Math.round(25 + 31 * scale);
}

/** The heights a row comes in: two lines, two close-set, or three (`detail`): a download and how it stands, a song's tags. */
export type RowSize = 'normal' | 'compact' | 'tall';

/** That height at the size of writing the phone is set to now. */
export function useMediaRowHeight(size: RowSize = 'normal'): number {
  return mediaRowHeight(size, useWindowDimensions().fontScale);
}

/**
 * A mark pressed at the end of a row: a cross, a handle, a plus. In a box
 * as wide as every other one there, so that the marks stand evenly apart
 * whatever each is; the rest of a finger is given round it. Without
 * [onPress] it is only drawn there (a handle that is the row's to lift).
 */
export function RowControl({
  children,
  onPress,
  onLongPress,
  delayLongPress,
  onPressOut,
  disabled,
  accessibilityLabel,
  hidden = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  delayLongPress?: number;
  /** The finger lifted, whatever it did: a handle let go of (`downloads`). */
  onPressOut?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Left out of what a screen reader goes through, where the row offers the same as an action of its own. */
  hidden?: boolean;
}) {
  const styles = useStyles();
  const pressed = usePressed();
  if (!onPress && !onLongPress) return <View style={styles.control}>{children}</View>;
  return (
    <Pressable
      android_ripple={{ ...pressed, borderless: true, radius: TOUCH.row / 2 }}
      style={styles.control}
      hitSlop={CONTROL_SLOP}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessible={!hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : undefined}>
      {children}
    </Pressable>
  );
}

/** What a mark's box is given above and below to be a finger's height. */
const CONTROL_SLOP = { top: (TOUCH.normal - TOUCH.small) / 2, bottom: (TOUCH.normal - TOUCH.small) / 2 };

/** Something a screen reader can do to a row that a finger does by a hold or a pull. */
export type RowAction = { name: string; label: string; run: () => void };

/**
 * One row. What it is about is the caller's: a song's row resolves its cover
 * and its place in a tape and hands them in, and is the one that is memoised
 * (`TrackRow`).
 *
 * - [lead]: what is at its start, a cover (`Artwork`) or a number.
 * - [title] and [subtitle], a line each; [playing] draws the title in the
 *   accent and heavier, the colour not being shown to everybody.
 * - [meta] at its end, small: a length, how far into a tape; [metaUnder]
 *   a second line of it; [metaOn] in the accent.
 * - [trailing]: anything to press at its end, before the dots.
 * - [check]: the row is being chosen, with a box at its start, and is a tick
 *   box to a screen reader; `'mixed'` where it stands for several, some
 *   chosen. [selected] tints it.
 * - [onLongPress]: what a hold does: its menu, opened by the dots as well,
 *   unless [menu] says a hold does something else (begins choosing), in
 *   which case there are no dots; [holdLabel] names it to a screen reader.
 * - [shared]: one of several across, sharing the width.
 * - [share]: how much of the most it is, from nought to one, drawn as a bar
 *   behind the row: a chart-topper among the others (the stats).
 */
export function MediaRow({
  size = 'normal',
  lead,
  title,
  titleMark,
  subtitle,
  detail,
  playing = false,
  dim = false,
  meta,
  metaUnder,
  metaOn = false,
  trailing,
  afterDots,
  check,
  choosing: choosingNow,
  selected = false,
  shared = false,
  share,
  off = false,
  style: extra,
  holdAfter,
  onPress,
  onLongPress,
  menu = true,
  holdLabel,
  actions = [],
  accessibilityLabel,
  accessibilityHint,
}: {
  size?: RowSize;
  lead?: ReactNode;
  title: string;
  /** A small sign before the name, of what kind of thing it is: a list read from a tag, a smart list. */
  titleMark?: ReactNode;
  subtitle?: ReactNode;
  /** A third line, under the second, for a row drawn `tall`: how a download stands, what a song's tags were matched to. */
  detail?: ReactNode;
  playing?: boolean;
  /** Fainter: one already there, as a song already in the list being added to. */
  dim?: boolean;
  meta?: string | null;
  metaUnder?: string | null;
  metaOn?: boolean;
  trailing?: ReactNode;
  /** What is pressed at its end after the dots: a handle that is always at the very edge, and what goes with it. */
  afterDots?: ReactNode;
  check?: boolean | 'mixed';
  /**
   * Whether the list is being chosen from, where its boxes are drawn whether
   * it is or not, ready to be dragged down (`useDragSelect`): a tap then
   * opens the row and a hold ticks it until something is ticked.
   */
  choosing?: boolean;
  selected?: boolean;
  shared?: boolean;
  share?: number;
  /** On its way out of the list: faint, and not pressed. */
  off?: boolean;
  /** How a row looks in a state of the list's own: one lifted to be moved. */
  style?: StyleProp<ViewStyle>;
  /** How long a hold lasts before it is one, where that is not the menu's wait: a row lifted to be moved. */
  holdAfter?: number;
  /** Left out for a row that is only read, with something to press at its end (`trailing`): an episode not fetched yet. */
  onPress?: () => void;
  /** Handed the touch, for a hold that lifts the row from where the finger is. */
  onLongPress?: (event?: GestureResponderEvent) => void;
  menu?: boolean;
  holdLabel?: string;
  actions?: RowAction[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const height = useMediaRowHeight(size);
  // A box drawn wherever there is a [check]; the row one being chosen, to a screen reader and to a hold, unless [choosing] says otherwise.
  const boxed = check !== undefined;
  const choosing = choosingNow ?? boxed;
  const hold = onLongPress
    ? (event: GestureResponderEvent) => {
        if (menu) haptic('holds', 'hold');
        onLongPress(event);
      }
    : undefined;
  /*
    A hold and a pull aside are not things a screen reader's user can be
    expected to find by trying; named, they are in the reader's own list of
    actions. Not the menu while choosing: a hold then ticks the row, which a
    tap already does, and "options" would be a lie.
  */
  const named = off ? [] : [...(onLongPress && (menu || holdLabel != null) && !choosing ? [{ name: 'longpress', label: holdLabel ?? t.library.trackMenu, run: () => onLongPress() }] : []), ...actions];
  const dots = onLongPress != null && menu && !choosing && !off;
  const style = [styles.row, { height }, shared && styles.shared, selected && styles.selected, off && styles.off, extra];
  const inside = (
    <>
      {/* Behind the words rather than beside them, so a long name has the whole width and the share is read under it. */}
      {share != null ? <View pointerEvents="none" style={[styles.share, { width: `${Math.max(2, share * 100)}%` }]} /> : null}
      {boxed ? <Check on={check === true} mixed={check === 'mixed'} /> : null}
      {lead}
      <View style={styles.words}>
        {titleMark ? (
          <View style={styles.titleLine}>
            {titleMark}
            <Text style={[styles.title, styles.titleShrink, dim && styles.dim, playing && styles.playing]} numberOfLines={1}>
              {title}
            </Text>
          </View>
        ) : (
          <Text style={[styles.title, dim && styles.dim, playing && styles.playing]} numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {/*
        A box round the length only where there is a second line under it:
        a list of thousands of rows draws every view of each, and twice as
        many at once sideways, in two columns.
      */}
      {meta && metaUnder ? (
        <View style={styles.meta}>
          <Text style={[styles.metaText, metaOn && styles.metaOn]}>{meta}</Text>
          <Text style={styles.metaText}>{metaUnder}</Text>
        </View>
      ) : meta ? (
        <Text style={[styles.metaText, metaOn && styles.metaOn]}>{meta}</Text>
      ) : null}
      {/*
        What is pressed at its end, and the dots, close together: a group of
        their own, apart from the words by the row's room and not from each
        other, so that the title keeps what it can of the width. The dots
        alone, as on most rows, need no group round them.
      */}
      {trailing || afterDots ? (
        <View style={styles.end}>
          {trailing}
          {dots ? <MoreButton onPress={() => onLongPress?.()} /> : null}
          {afterDots}
        </View>
      ) : dots ? (
        // The menu a hold opens, for whoever has not found the hold; not while rows are being ticked.
        <MoreButton onPress={() => onLongPress?.()} />
      ) : null}
    </>
  );
  if (!onPress && !onLongPress) {
    return (
      // Not one stop for a screen reader: what is at its end is to be reached on its own.
      <View style={style}>
        {inside}
      </View>
    );
  }
  return (
    <Pressable
      android_ripple={pressed}
      style={style}
      disabled={off}
      onPress={onPress}
      onLongPress={hold}
      delayLongPress={holdAfter}
      // A tick box while rows are being chosen; otherwise a button, which says whether it is the one playing.
      accessibilityRole={choosing ? 'checkbox' : 'button'}
      accessibilityState={choosing ? { checked: check === 'mixed' ? 'mixed' : check } : { selected: playing, disabled: off }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={named.map(({ name, label }) => ({ name, label }))}
      onAccessibilityAction={(event: AccessibilityActionEvent) => named.find((one) => one.name === event.nativeEvent.actionName)?.run()}>
      {inside}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: ROW_SIDE },
    shared: { flex: 1, minWidth: 0 },
    share: { position: 'absolute', left: 0, top: SPACE.xxs, bottom: SPACE.xxs, backgroundColor: c.accentSoft, borderRadius: RADIUS.control },
    selected: { backgroundColor: c.accentSoft },
    off: { opacity: DISABLED },
    words: { flex: 1, minWidth: 0, gap: SPACE.xxs },
    title: { color: c.text, fontSize: TYPE.body },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
    titleShrink: { flexShrink: 1 },
    // Heavier as well as coloured: not everybody is shown a colour.
    playing: { color: c.accent, fontWeight: '600' },
    dim: { color: c.textMuted },
    subtitle: { color: c.textMuted, fontSize: TYPE.hint },
    meta: { alignItems: 'flex-end', gap: SPACE.xxs },
    // The marks at its end each in a box of the same width, side by side, so that they stand evenly apart in every row.
    end: { flexDirection: 'row', alignItems: 'center' },
    control: { width: TOUCH.row, height: TOUCH.small, alignItems: 'center', justifyContent: 'center' },
    metaText: { color: c.textMuted, fontSize: TYPE.hint, fontVariant: ['tabular-nums'] },
    metaOn: { color: c.accent },
  })
);
