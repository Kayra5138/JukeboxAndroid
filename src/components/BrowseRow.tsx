import { memo } from 'react';
import { useWindowDimensions } from 'react-native';

import { useT } from '../lib/i18n/index';
import type { Mark } from '../lib/media/selection';
import { useHoldsCurrent } from '../lib/player/current';
import { ROW_COVER } from '../lib/theme/measures';
import type { Track } from '../lib/types';
import { MediaRow } from './MediaRow';
import { PlaylistCover } from './PlaylistCover';
import { trackRowHeight } from './TrackRow';
import { ArtistLinks } from './NameLinks';

/**
 * Declared rather than left to the row, so a list of these can say where every
 * one of them is without drawing it first.
 *
 * A track row's height, as the rest of the row is a track row's: going from
 * the tracks to the albums or the artists, the covers, the names and the
 * margins stay where they were and only what the rows say changes.
 */
export function browseRowHeight(fontScale: number): number {
  return trackRowHeight(fontScale);
}

/** The row's height at the size of writing the phone is set to now. */
export function useBrowseRowHeight(): number {
  return browseRowHeight(useWindowDimensions().fontScale);
}

/**
 * One album, one artist or one folder in the library: something that is opened
 * rather than played.
 *
 * All three drawn by the one row, on purpose. They are the same kind of thing
 * — some of the library under one heading — and a reader moving between the
 * views should find the name, the count and the picture where they left them.
 *
 * Told what it is with an id and answered with the same id, so the handlers a
 * list gives every row stay the same functions and a row whose own heading has
 * not changed is not drawn again because another one did. That is also why
 * what is chosen arrives as [mark], already worked out, and not as the set of
 * chosen tracks: the set is a new object on every tick, and a row handed it
 * would be drawn again for a tick three screens away.
 */
export const BrowseRow = memo(function BrowseRow({
  id,
  title,
  by,
  detail,
  tracks,
  cover,
  shared,
  mark,
  held,
  onPress,
  onLongPress,
}: {
  id: string;
  title: string;
  /** Whoever a record is by, before the rest of its line, leading to them (`NameLinks`). */
  by?: string | null;
  detail: string;
  /** What is under the heading; only ever looked at for a cover. */
  tracks: Track[];
  /**
   * The tracks one cover is found among to stand for all of them: a record's,
   * an artist's first record's, a folder's. See `useAlbumArtwork`.
   */
  cover: readonly Track[];
  /** True when the row has a neighbour beside it and must share the width. */
  shared: boolean;
  /**
   * How many of its tracks are chosen — none, all, or `'mixed'` for some — and
   * absent when nothing is being chosen, which is when the row has no box.
   */
  mark?: Mark;
  /**
   * What holding the row does, for a screen reader to call it by, where that
   * is not the choosing it is for an artist or a folder.
   */
  held?: string;
  onPress: (id: string) => void;
  onLongPress?: (id: string) => void;
}) {
  const t = useT();
  const choosing = mark !== undefined;
  // The song playing is one of its: said as a track's row says it is the one.
  const playing = useHoldsCurrent(tracks);
  return (
    <MediaRow
      lead={<PlaylistCover tracks={tracks} chosen={null} sleeve={cover} size={ROW_COVER} />}
      title={title}
      subtitle={
        <>
          {/* Not while tracks are being ticked, when a touch on the row chooses it. */}
          {by ? (
            <>
              <ArtistLinks credit={by} off={choosing} />
              {detail ? ' · ' : ''}
            </>
          ) : null}
          {detail}
        </>
      }
      playing={playing}
      check={mark}
      selected={mark === true}
      shared={shared}
      // Both lines as one sentence. Left to itself the reader says the two texts apart, and the second is only a number without the first.
      accessibilityLabel={`${title}, ${[by, detail].filter(Boolean).join(' · ')}`}
      accessibilityHint={choosing ? t.library.row.selectsTracks : t.library.row.opensTracks}
      onPress={() => onPress(id)}
      onLongPress={onLongPress && (() => onLongPress(id))}
      // A record's hold opens its menu, as a track's does; an artist's or a folder's begins choosing.
      menu={held != null}
      holdLabel={held ?? t.library.row.select}
    />
  );
});
