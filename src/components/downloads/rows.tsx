import { memo } from 'react';
import { ICON, LEADING, RADIUS, SPACE, TYPE } from '../../lib/theme/measures';
import { ProgressBar } from '../ProgressBar';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { TextButton } from '../Button';
import { TickIcon, ToFrontIcon } from '../Icons';
import { MediaRow, mediaRowHeight, RowControl } from '../MediaRow';
import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import type { Strings } from '../../lib/i18n/languages';
import { laid, makeStyles, outlined, outlinedClip, useColours, usePressed } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { offerFor, type Advice } from '../../lib/youtube/extractor';
import { canCancel, canMove, canRetry, isAutomatic, namesOf, retryOf, sameJob, sourceOf } from '../../lib/youtube/queueView';
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
    // As tall as every row of three lines (`MediaRow` `tall`), which is what these are.
    row: mediaRowHeight('tall', fontScale),
    now: Math.round(36 + 92 * scale),
  };
}

/** Where a download was asked for from, in words. */
function sourceLabel(job: DownloadJob, t: Strings): string {
  const source = sourceOf(job);
  const said = t.downloads.source;
  if (source.kind === 'album') return said.album(source.name);
  if (source.kind === 'playlist') return said.playlist(source.name);
  if (source.kind === 'tape') return said.tape(source.name);
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
            <ProgressBar value={job.progress / 100} style={styles.track} />
          </View>
          {/* Too late to stop, for the moment it takes to put the file away. */}
          <TextButton
            label={stoppable ? t.common.cancel : '…'}
            accessibilityLabel={t.downloads.cancelLabel(title)}
            disabled={!stoppable}
            onPress={() => {
              haptic('choices', 'tick');
              onCancel(job.id);
            }}
          />
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
    next,
    lifted,
    onLift,
    onLetGo,
    onFront,
    onStep,
    onCancel,
  }: {
    job: DownloadJob;
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
    const said = t.downloads;
    const { title } = namesOf(job);
    const movable = canMove(job);
    const automatic = isAutomatic(job);
    const again = retryOf(job);
    // That it failed once and is to be tried again comes before whose it is:
    // it is the one thing about the row that is news.
    const state = again ? said.retrying(again.why) : automatic ? said.automatic : statusLabel(job, t);

    return (
      <MediaRow
        size="tall"
        style={lifted ? styles.rowLifted : undefined}
        lead={<Thumbnail job={job} />}
        title={title}
        subtitle={metaLine(job, t)}
        detail={state}
        menu={false}
        accessibilityLabel={[title, metaLine(job, t), state].join(', ')}
        // Dragging is not something a screen reader's user can do. The same moves are in the reader's own list of
        // actions, a place at a time.
        actions={
          movable && onStep
            ? [
                { name: 'increment', label: said.moveUp, run: () => onStep(job.id, -1) },
                { name: 'decrement', label: said.moveDown, run: () => onStep(job.id, 1) },
              ]
            : []
        }
        /*
          The copy in the hand has no buttons, and keeps the room they took:
          the words in it then stay where they were when it was picked up.
        */
        trailing={
          <>
            {movable && !next ? (
              onFront ? (
                <RowControl
                  accessibilityLabel={said.doNextLabel(title)}
                  onPress={() => {
                    haptic('choices', 'tick');
                    onFront(job.id);
                  }}>
                  <ToFrontIcon size={ICON} color={c.textMuted} />
                </RowControl>
              ) : (
                <RowControl>{null}</RowControl>
              )
            ) : null}
            {onCancel ? (
              <RowControl
                accessibilityLabel={said.cancelLabel(title)}
                disabled={!canCancel(job)}
                onPress={() => {
                  haptic('choices', 'tick');
                  onCancel(job.id);
                }}>
                <Text style={styles.cross}>×</Text>
              </RowControl>
            ) : (
              <RowControl>{null}</RowControl>
            )}
          </>
        }
        // The handle at the very edge, as the queue's is: held, it lifts the row; the row's own actions say how it is
        // moved without a finger.
        afterDots={
          movable ? (
            <RowControl
              hidden
              onLongPress={onLift ? (event: GestureResponderEvent) => onLift(job.id, event.nativeEvent.pageY) : undefined}
              onPressOut={onLetGo}
              delayLongPress={LIFT_AFTER_MS}>
              <Text style={styles.grip} importantForAccessibility="no">
                ≡
              </Text>
            </RowControl>
          ) : null
        }
      />
    );
  },
  (before, after) =>
    sameJob(before.job, after.job) &&
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
 *
 * Where it went badly in the way an old yt-dlp does, and there is a newer
 * one or nobody has looked lately, asking again would only fail again: the
 * row offers the update, or the look, in place of "Retry" (`offerFor`).
 * Once that is done, or has been tried and did not come off, it is "Retry"
 * as before.
 */
export const FinishedRow = memo(
  function FinishedRow({
    job,
    advice,
    busy,
    onRetry,
    onAdvice,
  }: {
    job: DownloadJob;
    /** What there is to say about the extractor's age, and whether something is being done about it now. */
    advice: Advice;
    busy: boolean;
    onRetry: (id: string) => void;
    onAdvice: (what: 'update' | 'check') => void;
  }) {
    const t = useT();
    const c = useColours();
    const styles = useStyles();
    const { title } = namesOf(job);
    const failed = job.status === 'failed';
    const offer = offerFor(job, advice);
    const said = t.downloads.extractor;
    // The failure in its own words, where it has any.
    const outcome = (failed ? jobError(job) : null) ?? statusLabel(job, t);
    return (
      <MediaRow
        size="tall"
        lead={<Thumbnail job={job} />}
        title={title}
        subtitle={metaLine(job, t)}
        detail={failed ? <Text style={styles.bad}>{outcome}</Text> : outcome}
        menu={false}
        trailing={
          offer ? (
            <TextButton
              label={busy ? '…' : offer === 'update' ? said.rowUpdate : said.rowCheck}
              accessibilityLabel={offer === 'update' ? said.rowUpdateLabel(title) : said.rowCheckLabel(title)}
              disabled={busy}
              onPress={() => onAdvice(offer)}
            />
          ) : canRetry(job) ? (
            <TextButton
              label={t.common.retry}
              accessibilityLabel={t.downloads.retryLabel(title)}
              onPress={() => {
                haptic('choices', 'tick');
                onRetry(job.id);
              }}
            />
          ) : job.status === 'done' ? (
            <RowControl>
              <TickIcon size={ICON} color={c.success} />
            </RowControl>
          ) : null
        }
      />
    );
  },
  (before, after) =>
    sameJob(before.job, after.job) &&
    before.advice === after.advice &&
    before.busy === after.busy &&
    before.onRetry === after.onRetry &&
    before.onAdvice === after.onAdvice
);

/** How long a hold has to last before it lifts a row: the queue's own wait. */
const LIFT_AFTER_MS = 220;

const ACTION_SLOP = { top: 8, bottom: 8, left: 12, right: 12 };

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    heading: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: SPACE.l,
      paddingBottom: SPACE.s,
    },
    headingText: { color: c.textFaint, fontSize: TYPE.label, fontWeight: '600', letterSpacing: 0.8, flexShrink: 1 },
    headingAction: { paddingHorizontal: SPACE.xs, borderRadius: RADIUS.cover },

    /*
      One flat colour, whatever the theme writes its surfaces in. The rows it
      is carried over go on sliding about underneath, and through a fill of
      glass every one of them would be read through the row in the hand.
    */
    rowLifted: { backgroundColor: laid(c.surfaceRaised, c.bg), borderRadius: RADIUS.control, ...outlined(c) },

    nowSlot: { paddingHorizontal: SPACE.l, paddingBottom: SPACE.xs },
    nowCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.m,
      paddingLeft: SPACE.m,
      paddingRight: SPACE.xs,
      backgroundColor: c.surface,
      borderRadius: RADIUS.card,
      overflow: 'hidden',
      ...outlinedClip(c),
    },

    // No colour of the theme's on the picture itself; see TrackRow's `art`.
    thumb: { width: 52, height: 38, borderRadius: RADIUS.cover },
    thumbLarge: { width: 92, height: 62, borderRadius: RADIUS.cover },
    thumbEmpty: { backgroundColor: c.surfaceRaised },

    text: { flex: 1, minWidth: 0, gap: 1 },
    nowTitle: { color: c.text, fontSize: TYPE.body, lineHeight: LEADING.body, fontWeight: '500' },
    meta: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    bad: { color: c.danger, fontSize: TYPE.hint, lineHeight: LEADING.hint },

    track: { marginTop: SPACE.xs },

    link: { color: c.text, fontSize: TYPE.small, fontWeight: '500' },
    // The queue's cross and handle, so that the two lists that are rearranged by hand are rearranged alike.
    cross: { color: c.textFaint, fontSize: 18, lineHeight: 20 },
    grip: { color: c.textDisabled, fontSize: 18 },
  })
);
