import { memo } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { ToFrontIcon } from '../Icons';
import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import type { Strings } from '../../lib/i18n/languages';
import { laid, makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import { canCancel, canMove, canRetry, isAutomatic, namesOf, sameJob, sourceOf } from '../../lib/youtube/queueView';
import { jobError, statusLabel, type DownloadJob } from '../../lib/youtube/types';

/**
 * How tall each kind of line on the downloads screen is.
 *
 * Fixed, so that the list knows where every row is without drawing it — a
 * history of hundreds is then as cheap as a history of ten — and so that a
 * finger dragging a row can be turned into a place in the queue by dividing.
 *
 * Fixed for a size of writing, though, and not once for all: the rows are
 * three lines of text, and somebody who has asked the phone for larger
 * writing would find the third cut off by a height worked out for the
 * default. Past twice the size the rows stop growing and the lines shorten
 * instead, which is what a single row can do about it.
 */
export type Sizes = { heading: number; row: number; now: number };

export function sizesFor(fontScale: number): Sizes {
  const scale = Math.min(Math.max(fontScale, 1), 2);
  return {
    heading: Math.round(22 + 22 * scale),
    row: Math.round(20 + 52 * scale),
    now: Math.round(36 + 92 * scale),
  };
}

/** Where a download was asked for from, in words. */
function sourceLabel(job: DownloadJob, t: Strings): string {
  const source = sourceOf(job);
  const said = t.downloads.source;
  if (source.kind === 'album') return said.album(source.name);
  if (source.kind === 'playlist') return said.playlist(source.name);
  return said[source.kind];
}

/** The line under a title: whose the song is, and where it was asked for from. */
function metaLine(job: DownloadJob, t: Strings): string {
  return [namesOf(job).artist, sourceLabel(job, t)].filter(Boolean).join(' · ');
}

function Thumbnail({ job, large = false }: { job: DownloadJob; large?: boolean }) {
  const styles = useStyles();
  const shape = large ? styles.thumbLarge : styles.thumb;
  // A song that is still only a name has no picture until it is found.
  return job.video.thumbnail ? (
    <Image source={{ uri: job.video.thumbnail }} style={shape} contentFit="cover" />
  ) : (
    <View style={[shape, styles.thumbEmpty]} />
  );
}

/** The small capitals over a part of the list, with whatever acts on the whole part beside them. */
export const SectionHeading = memo(function SectionHeading({
  title,
  height,
  action,
  actionLabel,
  onAction,
}: {
  title: string;
  height: number;
  action?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <View style={[styles.heading, { height }]}>
      <Text style={styles.headingText} numberOfLines={1}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? action}
          hitSlop={ACTION_SLOP}
          style={styles.headingAction}
          onPress={onAction}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

/**
 * The download that is under way, larger than the rest: it is the one thing
 * on the screen that is moving.
 */
export const NowRow = memo(
  function NowRow({
    job,
    height,
    onCancel,
  }: {
    job: DownloadJob;
    height: number;
    onCancel: (id: string) => void;
  }) {
    const t = useT();
    const styles = useStyles();
    const pressed = usePressed();
    const { title } = namesOf(job);
    const stoppable = canCancel(job);
    return (
      <View style={[styles.nowSlot, { height }]}>
        <View style={styles.nowCard}>
          <Thumbnail job={job} large />
          <View style={styles.text}>
            <Text style={styles.nowTitle} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {metaLine(job, t)}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {t.search.jobLine(statusLabel(job, t), job.format === 'mp3')}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(Math.max(job.progress, 0), 100)}%` }]} />
            </View>
          </View>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={t.downloads.cancelLabel(title)}
            disabled={!stoppable}
            style={styles.textButton}
            onPress={() => onCancel(job.id)}>
            {/* Too late to stop, for the moment it takes to put the file away. */}
            <Text style={styles.link}>{stoppable ? t.common.cancel : '…'}</Text>
          </Pressable>
        </View>
      </View>
    );
  },
  (before, after) =>
    sameJob(before.job, after.job) && before.height === after.height && before.onCancel === after.onCancel
);

/**
 * A download waiting its turn.
 *
 * Three things can be done to it and each has its own mark at the end of the
 * row, in the order they are reached for: put it at the front, cancel it,
 * and — by the handle, held and dragged, as in the queue of what is playing
 * — put it anywhere. One of Discover's own has only the cross: those go
 * last, by a rule and not by where anybody left them.
 */
export const WaitingRow = memo(
  function WaitingRow({
    job,
    height,
    next,
    lifted,
    onLift,
    onLetGo,
    onFront,
    onStep,
    onCancel,
  }: {
    job: DownloadJob;
    height: number;
    /** The one that will be fetched next, which cannot be put any further forward. */
    next: boolean;
    lifted: boolean;
    /** All of these absent on the copy of a row that is in the hand. */
    onLift?: (id: string, pageY: number) => void;
    /** The handle released, by the finger or to the drag it began. */
    onLetGo?: () => void;
    onFront?: (id: string) => void;
    onStep?: (id: string, by: number) => void;
    onCancel?: (id: string) => void;
  }) {
    const t = useT();
    const c = useColours();
    const styles = useStyles();
    const pressed = usePressed();
    const said = t.downloads;
    const { title } = namesOf(job);
    const movable = canMove(job);
    const automatic = isAutomatic(job);

    return (
      <View
        style={[styles.row, { height }, lifted && styles.rowLifted]}
        accessible
        accessibilityLabel={[title, metaLine(job, t), automatic ? said.automatic : statusLabel(job, t)].join(', ')}
        // Dragging is not something a screen reader's user can do. The same
        // moves are in the reader's own list of actions, a place at a time.
        accessibilityActions={
          movable
            ? [
                { name: 'increment', label: said.moveUp },
                { name: 'decrement', label: said.moveDown },
              ]
            : undefined
        }
        onAccessibilityAction={
          movable && onStep
            ? (event) => {
                if (event.nativeEvent.actionName === 'increment') onStep(job.id, -1);
                if (event.nativeEvent.actionName === 'decrement') onStep(job.id, 1);
              }
            : undefined
        }>
        <Thumbnail job={job} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine(job, t)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {automatic ? said.automatic : statusLabel(job, t)}
          </Text>
        </View>
        {/*
          The copy in the hand has no buttons, and keeps the room they took:
          the words in it then stay where they were when it was picked up.
        */}
        {movable && !next ? (
          onFront ? (
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityLabel={said.doNextLabel(title)}
              style={styles.iconButton}
              onPress={() => onFront(job.id)}>
              <ToFrontIcon size={18} color={c.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )
        ) : null}
        {onCancel ? (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={said.cancelLabel(title)}
            disabled={!canCancel(job)}
            style={styles.iconButton}
            onPress={() => onCancel(job.id)}>
            <Text style={styles.cross}>×</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
        {movable ? (
          <Pressable
            onLongPress={onLift ? (event: GestureResponderEvent) => onLift(job.id, event.nativeEvent.pageY) : undefined}
            onPressOut={onLetGo}
            delayLongPress={LIFT_AFTER_MS}
            hitSlop={GRIP_SLOP}
            // The row's own actions say how it is moved without a finger.
            accessible={false}
            style={styles.gripButton}>
            <Text style={styles.grip}>≡</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
  (before, after) =>
    sameJob(before.job, after.job) &&
    before.height === after.height &&
    before.next === after.next &&
    before.lifted === after.lifted &&
    before.onLift === after.onLift &&
    before.onLetGo === after.onLetGo &&
    before.onFront === after.onFront &&
    before.onStep === after.onStep &&
    before.onCancel === after.onCancel
);

/**
 * A download that has come to an end, one way or another.
 *
 * Nothing happens on a tap. The song is in the library, which is where it is
 * played from; what a row here is for is to say how it went, and to ask
 * again for one that went badly.
 */
export const FinishedRow = memo(
  function FinishedRow({
    job,
    height,
    onRetry,
  }: {
    job: DownloadJob;
    height: number;
    onRetry: (id: string) => void;
  }) {
    const t = useT();
    const styles = useStyles();
    const pressed = usePressed();
    const { title } = namesOf(job);
    const failed = job.status === 'failed';
    // The failure in its own words, where it has any.
    const outcome = (failed ? jobError(job) : null) ?? statusLabel(job, t);
    return (
      <View style={[styles.row, { height }]}>
        <Thumbnail job={job} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine(job, t)}
          </Text>
          <Text style={failed ? styles.bad : styles.meta} numberOfLines={1}>
            {outcome}
          </Text>
        </View>
        {canRetry(job) ? (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={t.downloads.retryLabel(title)}
            style={styles.textButton}
            onPress={() => onRetry(job.id)}>
            <Text style={styles.link}>{t.common.retry}</Text>
          </Pressable>
        ) : job.status === 'done' ? (
          <Text style={styles.tick} accessible={false}>
            ✓
          </Text>
        ) : null}
      </View>
    );
  },
  (before, after) =>
    sameJob(before.job, after.job) && before.height === after.height && before.onRetry === after.onRetry
);

/** How long a hold has to last before it lifts a row: the queue's own wait. */
const LIFT_AFTER_MS = 220;

/** Out to the row's own edges, and no further left than the cross beside it. */
const GRIP_SLOP = { top: 18, bottom: 18, left: 2, right: 16 };

const ACTION_SLOP = { top: 8, bottom: 8, left: 12, right: 12 };

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    heading: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    headingText: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, flexShrink: 1 },
    headingAction: { paddingHorizontal: 4, borderRadius: 8 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 20,
      paddingRight: 10,
      overflow: 'hidden',
    },
    /*
      One flat colour, whatever the theme writes its surfaces in. The rows it
      is carried over go on sliding about underneath, and through a fill of
      glass every one of them would be read through the row in the hand.
    */
    rowLifted: { backgroundColor: laid(c.surfaceRaised, c.bg), borderRadius: 10, ...outlined(c) },

    nowSlot: { paddingHorizontal: 16, paddingBottom: 6 },
    nowCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingLeft: 12,
      paddingRight: 4,
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: 'hidden',
      ...outlined(c),
    },

    // No colour of the theme's on the picture itself; see TrackRow's `art`.
    thumb: { width: 52, height: 38, borderRadius: 6 },
    thumbLarge: { width: 92, height: 62, borderRadius: 8 },
    thumbEmpty: { backgroundColor: c.surfaceRaised },

    text: { flex: 1, minWidth: 0, gap: 1 },
    title: { color: c.text, fontSize: 14.5, lineHeight: 20 },
    nowTitle: { color: c.text, fontSize: 15, lineHeight: 20, fontWeight: '500' },
    meta: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
    bad: { color: c.danger, fontSize: 12, lineHeight: 16 },

    track: { height: 3, backgroundColor: c.borderStrong, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
    fill: { height: 3, backgroundColor: c.accent },

    textButton: { paddingHorizontal: 12, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    link: { color: c.text, fontSize: 13, fontWeight: '500' },
    iconButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    cross: { color: c.textMuted, fontSize: 20, lineHeight: 22 },
    gripButton: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
    grip: { color: c.textDisabled, fontSize: 18 },
    tick: { color: c.success, fontSize: 16, fontWeight: '700', width: 44, textAlign: 'center' },
  })
);
