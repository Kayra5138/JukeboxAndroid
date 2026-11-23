import { memo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Artwork } from './Artwork';
import { MediaRow, mediaRowHeight } from './MediaRow';

import { useIsCurrent } from '../lib/player/current';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import type { EnrichedTrack } from '../lib/media/merge';
import { progressOf, useTapePlace } from '../lib/tapes/places';
import { isTape } from '../lib/tapes/tape';
import { ArtistLinks } from './NameLinks';

/** How tall a row is: a `normal` `MediaRow`'s height, which the library's lists lay themselves out by. */
export function trackRowHeight(fontScale: number): number {
  return mediaRowHeight('normal', fontScale);
}

/** The row's height at the size of writing the phone is set to now. */
export function useTrackRowHeight(): number {
  return trackRowHeight(useWindowDimensions().fontScale);
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  // An hour or more, as a tape or a long mix can be, as hours: 2:37:15 rather than 157:15.
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/**
 * Memoised because each row resolves its own cover, which means a native call
 * and a file read the first time. Re-rendering the list on every keystroke of a
 * search would otherwise repeat that work for rows that have not changed.
 *
 * The handlers are handed the track back rather than closing over it, so every
 * row can be given the same two functions. Closures built per row inside
 * `renderItem` are new objects on each pass and fail the shallow compare, which
 * left this memo costing a comparison and saving nothing.
 */
export const TrackRow = memo(function TrackRow({
  track,
  playing: told,
  onPress,
  onLongPress,
  onPlayNext,
  onAddToQueue,
  selectable = false,
  selected = false,
  shared = false,
}: {
  track: EnrichedTrack;
  /** Whether it is the track in the player; left out, the row asks the player itself (`useIsCurrent`). */
  playing?: boolean;
  onPress: (track: EnrichedTrack) => void;
  onLongPress?: (track: EnrichedTrack) => void;
  /**
   * What a pull to either side does, where the row has one; offered to a
   * screen reader as actions of the row's own, since it cannot pull.
   */
  onPlayNext?: (track: EnrichedTrack) => void;
  onAddToQueue?: (track: EnrichedTrack) => void;
  /** Shows a checkbox; the row is being chosen rather than played. */
  selectable?: boolean;
  selected?: boolean;
  /** True when the row is one of several across, and must share the width. */
  shared?: boolean;
}) {
  const current = useIsCurrent(track.id);
  const playing = told ?? current;
  const artwork = useTrackArtwork(track);
  const t = useT();
  // Who it is by, and its first two tags.
  const tagged = track.tags.slice(0, 2).join(' · ');
  // A tape says how far in it is, under its cover, and how long is left, where a song says how long it is.
  const place = useTapePlace(track.id);
  const tape = place != null && isTape(track) ? place : null;
  const progress = progressOf(tape);
  const begun = progress != null && tape != null;
  const length = tape?.finished
    ? t.library.tapes.played
    : begun
      ? t.library.tapes.heard(Math.floor(tape.positionSec / 60), Math.max(1, Math.round(tape.durationSec / 60)))
      : formatDuration(track.durationSec);
  // And under it, for one part way through, how long is left of it.
  const left = begun ? t.library.tapes.left(Math.max(1, Math.round((tape.durationSec - tape.positionSec) / 60))) : null;

  return (
    <MediaRow
      lead={<Artwork uri={artwork} progress={progress} />}
      title={track.title}
      subtitle={
        <>
          {/* Words only: a touch on a song's row is for the song, and a name that led elsewhere took it there by mistake. */}
          <ArtistLinks credit={track.artist} off />
          {tagged ? ` · ${tagged}` : ''}
        </>
      }
      playing={playing}
      meta={length}
      metaUnder={left}
      metaOn={tape?.finished === true}
      check={selectable ? selected : undefined}
      selected={selected}
      shared={shared}
      onPress={() => onPress(track)}
      onLongPress={onLongPress && (() => onLongPress(track))}
      // What a pull to either side does, offered to a screen reader as actions of the row's own, since it cannot pull.
      actions={[
        ...(onPlayNext ? [{ name: 'playNext', label: t.library.screen.swipePlayNext, run: () => onPlayNext(track) }] : []),
        ...(onAddToQueue ? [{ name: 'addToQueue', label: t.common.addToQueue, run: () => onAddToQueue(track) }] : []),
      ]}
    />
  );
});
