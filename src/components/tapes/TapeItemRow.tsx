import { memo } from 'react';
import { Artwork } from '../Artwork';
import { Button } from '../Button';
import { PauseIcon, PlayIcon } from '../Icons';
import { MediaRow } from '../MediaRow';
import { useT } from '../../lib/i18n/index';
import { useTrackArtwork } from '../../lib/media/artwork';
import type { EnrichedTrack } from '../../lib/media/merge';
import { useIsCurrent, usePlayingId } from '../../lib/player/current';
import { progressOf, type TapePlace } from '../../lib/tapes/places';
import { useColours } from '../../lib/theme/index';
import { ICON_SMALL } from '../../lib/theme/measures';
import { durationLabel } from '../../lib/youtube/types';

/**
 * A tape on its own in the tapes view, as a show's or a book's row is: its
 * picture, its name and whose it is, how far into it you are and how long
 * is left, and a button that carries it on, starts it, or pauses it while it
 * plays. The row itself plays it too; held, it opens the tape's menu. While
 * tapes are being chosen the row is a tick box and the button is not there.
 */
export const TapeItemRow = memo(function TapeItemRow({
  track,
  place,
  onPress,
  onPlay,
  onLongPress,
  selectable = false,
  selected = false,
}: {
  track: EnrichedTrack;
  place: TapePlace | null;
  onPress: (track: EnrichedTrack) => void;
  /** Its button: played, played on, or paused where it is the one playing. */
  onPlay: (track: EnrichedTrack) => void;
  onLongPress: (track: EnrichedTrack) => void;
  selectable?: boolean;
  selected?: boolean;
}) {
  const t = useT();
  const c = useColours();
  const artwork = useTrackArtwork(track);
  const progress = progressOf(place);
  // Asked by the row itself, as `TrackRow` does: its button is a pause while it plays.
  const on = usePlayingId() === track.id;
  // In the player, playing or not: drawn as a track's row draws the one playing.
  const current = useIsCurrent(track.id);
  const verb = on ? t.common.pause : progress != null ? t.search.tapes.podcasts.continue : t.search.tapes.podcasts.start;
  const state = place?.finished
    ? t.library.tapes.played
    : progress != null && place
      ? t.library.tapes.left(Math.max(1, Math.round((place.durationSec - place.positionSec) / 60)))
      : durationLabel(track.durationSec);
  return (
    <MediaRow
      // How far into it, along the foot of its picture, as a tape's row in the songs has it.
      lead={<Artwork uri={artwork} progress={progress} />}
      title={track.title}
      subtitle={track.artist}
      playing={current}
      meta={state}
      metaOn={place?.finished === true}
      trailing={
        selectable ? null : (
          <Button
            label={verb}
            kind="secondary"
            size="small"
            shape="pill"
            accessibilityLabel={`${verb}, ${track.title}`}
            icon={on ? <PauseIcon size={ICON_SMALL} color={c.text} /> : <PlayIcon size={ICON_SMALL} color={c.text} />}
            onPress={() => onPlay(track)}
          />
        )
      }
      check={selectable ? selected : undefined}
      selected={selected}
      onPress={() => onPress(track)}
      onLongPress={() => onLongPress(track)}
    />
  );
});
