import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { PlayIcon, QueueIcon, ShuffleIcon, TickIcon } from './Icons';

import { announce } from '../lib/ui/announce';
import { useT } from '../lib/i18n/index';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { formatDuration } from '../lib/stats/period';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import type { Track } from '../lib/types';

/** The cover a list is headed by. Whoever hands one in draws it this size. */
export const LIST_COVER_SIZE = 96;

/**
 * Sideways, the column the heading is drawn down: a share of the width
 * within bounds, beside the tracks. The same for a record over the rack and
 * for a list's own page, so the two cannot come to look different.
 */
export const SIDE_COLUMN = { width: '38%', minWidth: 220, maxWidth: 290, flexGrow: 0 } as const;

/**
 * How large the cover down that column is: what the height leaves after the
 * way back, the name and the buttons, which is some room under it for a name
 * of two lines; never smaller than the cover across the top, and no larger
 * than the column is wide.
 */
export function sideCoverSize(tall: number, top: number, bottom: number): number {
  return Math.round(Math.min(SIDE_COVER_MOST, Math.max(LIST_COVER_SIZE, tall - top - bottom - SIDE_ROOM)));
}
const SIDE_ROOM = 205;
const SIDE_COVER_MOST = 180;

/**
 * What a list of tracks is headed by: the way back, its cover and name, how
 * much is in it, and the three things to do with all of it: play it, play it
 * shuffled, or put it at the end of the queue.
 *
 * Its own component because a record is opened in two places — on the screen
 * every list opens on, and over the rack a sleeve was tapped in — and the
 * second is meant to be the first, not something like it. Whatever a screen
 * has besides goes in as children and is drawn under the buttons.
 *
 * It keeps nothing clear of the clock. Where it is drawn decides whether that
 * is needed, so the padding is whoever draws it's to give.
 *
 * Sideways, a record over the rack or the list of albums is drawn as two
 * columns, this down the left and the tracks the whole height of the right:
 * across the top it left the tracks a row or two below it. Down a column it
 * is [side]: the cover over the name rather than beside it, and the three
 * buttons on one line, each by its mark, which fit however long the words
 * are in any language.
 */
export function ListHeading({
  onBack,
  cover,
  name,
  tracks,
  hint,
  note,
  onPlay,
  onShuffle,
  side = false,
  children,
}: {
  onBack: () => void;
  /** Handed in whole, because only some lists let theirs be pressed. */
  cover: ReactNode;
  name: string;
  /** Counted and timed here; nothing else about them is looked at. */
  tracks: Track[];
  /** A line of words under the count, some of which may lead somewhere: a record's artist (`NameLinks`). */
  hint: ReactNode;
  /** Something that just went wrong, said under the hint. */
  note?: ReactNode;
  onPlay: () => void;
  /** Left out for a list that is not shuffled: a folder of tapes, played in its order. */
  onShuffle?: () => void;
  /** Down a column beside the tracks, rather than across the top of them. */
  side?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const styles = useStyles();
  const c = useColours();
  const pressed = usePressed();
  const { addToQueue } = usePlayerActions();
  /** Just put at the end of the queue: the button says so for a moment. */
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    if (!queued) return;
    const timer = setTimeout(() => setQueued(false), QUEUED_FOR_MS);
    return () => clearTimeout(timer);
  }, [queued]);
  /** In order, one after another, so that the queue gains them as the list has them. */
  const queueAll = async () => {
    for (const track of tracks) await addToQueue(track);
    setQueued(true);
    announce(t.library.screen.queuedAll(tracks.length));
  };
  const total = tracks.reduce((sum, track) => sum + (track.durationSec ?? 0), 0);
  const nothing = tracks.length === 0;

  if (side) {
    return (
      <>
        <Pressable
          android_ripple={pressed}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          onPress={onBack}>
          <Text style={styles.backLabel}>{t.library.back}</Text>
        </Pressable>

        <View style={styles.sideHeader}>
          {cover}
          <Text accessibilityRole="header" style={styles.sideName} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.sideLines}>
            <Text style={styles.detail} numberOfLines={1}>
              {t.common.tracks(tracks.length)}
              {total > 0 ? ` · ${formatDuration(total, t)}` : ''}
            </Text>
            {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
            {note}
          </View>

          <MarkButtons tracks={tracks} onPlay={onPlay} onShuffle={onShuffle} />

          {children}
        </View>
      </>
    );
  }

  return (
    <>
      <Pressable
        android_ripple={pressed}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t.common.back}
        onPress={onBack}>
        <Text style={styles.backLabel}>{t.library.back}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.identity}>
          {cover}
          <View style={styles.identityText}>
            <Text accessibilityRole="header" style={styles.name} numberOfLines={3}>
              {name}
            </Text>
            <Text style={styles.detail}>
              {t.common.tracks(tracks.length)}
              {total > 0 ? ` · ${formatDuration(total, t)}` : ''}
            </Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            {note}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            android_ripple={pressed}
            style={[styles.action, nothing && styles.actionOff]}
            disabled={nothing}
            onPress={onPlay}>
            <Text style={styles.actionLabel}>{t.common.play}</Text>
          </Pressable>
          {onShuffle ? (
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              style={[styles.secondary, nothing && styles.actionOff]}
              disabled={nothing}
              onPress={onShuffle}>
              <Text style={styles.secondaryLabel}>{t.common.shuffle}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.addToQueue}
            android_ripple={pressed}
            style={[styles.secondary, nothing && styles.actionOff]}
            disabled={nothing}
            onPress={() => void queueAll()}>
            <Text style={styles.secondaryLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {queued ? '✓' : t.library.screen.swipeQueue}
            </Text>
          </Pressable>
        </View>

        {children}
      </View>
    </>
  );
}

/**
 * The three things to do with all of [tracks] as marks in a row, each a
 * finger square: play, shuffle and put at the end of the queue. Down the
 * column of a list's page held sideways, and under the rack held upright.
 */
export function MarkButtons({
  tracks,
  onPlay,
  onShuffle,
}: {
  tracks: Track[];
  onPlay: () => void;
  onShuffle?: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const c = useColours();
  const pressed = usePressed();
  const { addToQueue } = usePlayerActions();
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    if (!queued) return;
    const timer = setTimeout(() => setQueued(false), QUEUED_FOR_MS);
    return () => clearTimeout(timer);
  }, [queued]);
  const queueAll = async () => {
    for (const track of tracks) await addToQueue(track);
    setQueued(true);
    announce(t.library.screen.queuedAll(tracks.length));
  };
  const nothing = tracks.length === 0;
  return (
    <View style={styles.sideActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.play}
        android_ripple={pressed}
        style={[styles.secondary, styles.mark, nothing && styles.actionOff]}
        disabled={nothing}
        onPress={onPlay}>
        <PlayIcon size={20} color={c.text} />
      </Pressable>
      {onShuffle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.common.shuffle}
          android_ripple={pressed}
          style={[styles.secondary, styles.mark, nothing && styles.actionOff]}
          disabled={nothing}
          onPress={onShuffle}>
          <ShuffleIcon size={20} color={c.text} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.addToQueue}
        android_ripple={pressed}
        style={[styles.secondary, styles.mark, nothing && styles.actionOff]}
        disabled={nothing}
        onPress={() => void queueAll()}>
        {queued ? <TickIcon size={20} color={c.text} /> : <QueueIcon size={20} color={c.text} />}
      </Pressable>
    </View>
  );
}

/** How long the queue button says it has done its work. */
const QUEUED_FOR_MS = 1800;

const useStyles = makeStyles((c) => StyleSheet.create({
  back: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  backLabel: { color: c.accent, fontSize: 16 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, gap: 5 },
  identity: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  identityText: { flex: 1, minWidth: 0, gap: 5 },
  name: { color: c.text, fontSize: 22, fontWeight: '600' },
  detail: { color: c.textMuted, fontSize: 13 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 16 },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: 11,
    paddingVertical: 12,
    ...outlined(c, c.primary),
  },
  actionLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  secondaryLabel: { color: c.text, fontSize: 15 },
  actionOff: { opacity: 0.35 },

  sideHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18, gap: 10 },
  sideName: { color: c.text, fontSize: 19, fontWeight: '600' },
  sideLines: { gap: 2, marginTop: -6 },
  sideActions: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  // A finger's width, square, for a mark rather than a word.
  mark: { flex: 0, width: 46, justifyContent: 'center' },
}));
