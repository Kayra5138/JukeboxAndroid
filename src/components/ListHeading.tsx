import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextButton } from './Button';
import { MediaHead, type HeadLink } from './MediaPage';
import { PlayIcon, QueueIcon, ShuffleIcon, TickIcon } from './Icons';

import { announce } from '../lib/ui/announce';
import { useT } from '../lib/i18n/index';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { formatDuration } from '../lib/stats/period';
import { makeStyles } from '../lib/theme/index';
import { HEAD_COVER, ICON, PAGE, SPACE } from '../lib/theme/measures';
import type { Track } from '../lib/types';

/** The cover a list is headed by, the one every page of a thing has (`HEAD_COVER`). Whoever hands one in draws it this size. */
export const LIST_COVER_SIZE = HEAD_COVER;

/** Sideways, the column the heading is drawn down: see `MediaPage`. */
export { SIDE_COLUMN } from './MediaPage';

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
  links,
  children,
}: {
  /**
   * The way back, over the head, where it stands alone -- a record over the
   * rack -- and keeps the page's margins itself. Left out on a page of its
   * own (`MediaPage`), whose bar holds the way back and whose frame the margins.
   */
  onBack?: () => void;
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
  /** What more there is to do with the whole of it, under the buttons (`MediaHead`). */
  links?: HeadLink[];
  children?: ReactNode;
}) {
  const t = useT();
  const styles = useStyles();
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

  /*
    The head every page of a thing has (`MediaHead`). Standing alone, with
    the way back over it, since there is no bar to hold one, and kept clear
    of the page's edges here, since the list it heads is drawn edge to edge.
  */
  return (
    <>
      {onBack ? (
        <View style={styles.back}>
          <TextButton label={t.library.back} size="body" accessibilityLabel={t.common.back} onPress={onBack} />
        </View>
      ) : null}
      <View style={!onBack ? styles.onPage : side ? styles.sideHeader : styles.header}>
        <MediaHead
          side={side}
          links={links}
          cover={cover}
          title={name}
          lines={[`${t.common.tracks(tracks.length)}${total > 0 ? ` · ${formatDuration(total, t)}` : ''}`, hint]}
          note={note}
          // Marks rather than words: they say it in any language, and fit down a column as well as across the page.
          actions={[
            { ...MARKED, label: t.common.play, kind: 'primary', disabled: nothing, onPress: onPlay, mark: (ink) => <PlayIcon size={ICON} color={ink} /> },
            ...(onShuffle
              ? [{ ...MARKED, label: t.common.shuffle, disabled: nothing, onPress: onShuffle, mark: (ink: string) => <ShuffleIcon size={ICON} color={ink} /> }]
              : []),
            {
              ...MARKED,
              label: t.common.addToQueue,
              disabled: nothing,
              onPress: () => void queueAll(),
              mark: (ink) => (queued ? <TickIcon size={ICON} color={ink} /> : <QueueIcon size={ICON} color={ink} />),
            },
          ]}>
          {children}
        </MediaHead>
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
  // The same three as at the head of a list (`ListHeading`).
  return (
    <View style={styles.sideActions}>
      <Button label={t.common.play} kind="primary" disabled={nothing} onPress={onPlay} mark={(ink) => <PlayIcon size={ICON} color={ink} />} />
      {onShuffle ? (
        <Button
          label={t.common.shuffle}
          kind="secondary"
          disabled={nothing}
          onPress={onShuffle}
         
          mark={(ink) => <ShuffleIcon size={ICON} color={ink} />}
        />
      ) : null}
      <Button
        label={t.common.addToQueue}
        kind="secondary"
        disabled={nothing}
        onPress={() => void queueAll()}
       
        mark={(ink) => (queued ? <TickIcon size={ICON} color={ink} /> : <QueueIcon size={ICON} color={ink} />)}
      />
    </View>
  );
}

/** The three as round marks, side by side from the start of the line rather than across all of it. */
const MARKED = { wide: false } as const;

/** How long the queue button says it has done its work. */
const QUEUED_FOR_MS = 1800;

const useStyles = makeStyles(() =>
  StyleSheet.create({
    back: { paddingHorizontal: PAGE.side, paddingTop: SPACE.s },
    header: { paddingHorizontal: PAGE.side, paddingTop: SPACE.m, paddingBottom: SPACE.l },
    sideHeader: { paddingHorizontal: PAGE.side, paddingBottom: SPACE.l },
    onPage: { paddingBottom: SPACE.l },
    sideActions: { flexDirection: 'row', gap: SPACE.s },
  })
);
