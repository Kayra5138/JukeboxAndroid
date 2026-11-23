import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Artwork } from '../Artwork';
import { Button } from '../Button';
import { PauseIcon, PlayIcon } from '../Icons';
import { MediaRow } from '../MediaRow';
import { Pressable } from '../Pressable';
import { Chevron } from '../settings/rows';
import { useT } from '../../lib/i18n/index';
import type { EnrichedTrack } from '../../lib/media/merge';
import { useTrackArtwork } from '../../lib/media/artwork';
import { usePlayingId } from '../../lib/player/current';
import { nextToPlay } from '../../lib/tapes/order';
import { progressOf, type TapePlace } from '../../lib/tapes/places';
import { makeStyles, useColours, usePressed } from '../../lib/theme/index';
import { ICON_SMALL, RADIUS, ROW_COVER_COMPACT, TOUCH } from '../../lib/theme/measures';
import { durationLabel } from '../../lib/youtube/types';

/**
 * A podcast that is followed, as one row of the tapes view in place of its
 * episodes, in two parts. Above, the show: its picture and name, how many of
 * its episodes are here and how many of those are not begun; pressed, it
 * opens the podcast's own screen, where its episodes are played and fetched
 * and how new ones come is set. Under it, the episode it carries on with —
 * the one part way through that was listened to last, or the newest not
 * heard — its own picture under the show's, how far in it is, and a button
 * that plays it from there without opening anything. Its arrow lays its
 * episodes out under it, one row each, and folds them away again.
 *
 * While tapes are being chosen the row is a tick box for all its episodes
 * at once: ticked when all of them are, a dash when some are. Laid out, each
 * of them can be ticked on its own as well.
 */
/** What a row is of: a followed show, or a folder of tapes (`folder:` and its path in place of a feed), which has no picture of its own. */
export type SeriesShow = { feedUrl: string; title: string; image: string | null };

export const SeriesRow = memo(function SeriesRow({
  show,
  episodes,
  places,
  onPress,
  onPlay,
  book = false,
  expanded,
  onExpand,
  selectable = false,
  selected = 'none',
  onSelect,
}: {
  show: SeriesShow;
  /** Its episodes in the library, in the order they go. */
  episodes: readonly EnrichedTrack[];
  places: ReadonlyMap<string, TapePlace>;
  onPress: (show: SeriesShow) => void;
  /** Pressed while the one it offers is playing, it pauses it; otherwise it plays it. */
  onPlay: (episode: EnrichedTrack) => void;
  /** A folder of tapes — a book's parts — rather than a followed show: taken up at its first part not heard, and said in parts. */
  book?: boolean;
  /** Whether its episodes are laid out under it. */
  expanded: boolean;
  onExpand: (show: SeriesShow) => void;
  /** Tapes are being chosen: the row ticks its episodes rather than opening. */
  selectable?: boolean;
  /** How many of its episodes are ticked. */
  selected?: 'all' | 'some' | 'none';
  onSelect?: (show: SeriesShow) => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.search.tapes.podcasts;
  const fresh = episodes.filter((episode) => {
    const place = places.get(episode.id);
    return !place || (!place.finished && place.positionSec < 10);
  }).length;
  const next = nextToPlay(episodes, places, book ? 'first' : 'newest');
  // A folder has no picture of its own: its first tape's stands for it.
  const cover = useTrackArtwork(show.image ? null : (episodes[0] ?? null));
  const picture = show.image ?? cover;
  const place = next ? (places.get(next.id) ?? null) : null;
  const progress = progressOf(place);
  // Asked by the row itself, as `TrackRow` does: its button is a pause while what it offers plays.
  const playingId = usePlayingId();
  const on = next != null && next.id === playingId;
  const verb = on ? t.common.pause : progress != null ? said.continue : said.start;
  const artwork = useTrackArtwork(next);
  const ticked = selected === 'all' ? true : selected === 'some' ? 'mixed' : false;
  // Two rows of the one kind (`MediaRow`): the show, and under it, closer set, the episode it carries on with.
  return (
    <View>
      <MediaRow
        lead={<Artwork uri={picture} />}
        title={show.title}
        subtitle={
          book
            ? t.library.tapes.bookLine(episodes.length, fresh)
            : episodes.length > 0
              ? t.library.tapes.seriesLine(episodes.length, fresh)
              : t.library.tapes.seriesNone
        }
        check={selectable ? ticked : undefined}
        selected={selectable && selected !== 'none'}
        onPress={() => (selectable ? onSelect?.(show) : onPress(show))}
        trailing={
          episodes.length > 0 ? (
            // Its episodes laid out under it, one row each, and folded away again.
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityLabel={expanded ? t.library.tapes.hideEpisodes : t.library.tapes.showEpisodes}
              accessibilityState={{ expanded }}
              style={styles.expand}
              onPress={() => onExpand(show)}>
              <Chevron turned={expanded ? 'up' : 'down'} />
            </Pressable>
          ) : null
        }
      />
      {next ? (
        <MediaRow
          size="compact"
          lead={<Artwork uri={artwork} size={ROW_COVER_COMPACT} progress={progress} />}
          title={next.title}
          meta={
            progress != null && place
              ? t.library.tapes.left(Math.max(1, Math.round((place.durationSec - place.positionSec) / 60)))
              : durationLabel(next.durationSec)
          }
          playing={on}
          onPress={() => (selectable ? onSelect?.(show) : onPlay(next))}
          trailing={
            selectable ? null : (
              <Button
                label={verb}
                kind="secondary"
                size="small"
                shape="pill"
                accessibilityLabel={`${verb}, ${next.title}`}
                icon={on ? <PauseIcon size={ICON_SMALL} color={c.text} /> : <PlayIcon size={ICON_SMALL} color={c.text} />}
                onPress={() => onPlay(next)}
              />
            )
          }
        />
      ) : null}
    </View>
  );
});

const useStyles = makeStyles(() =>
  StyleSheet.create({
    expand: { width: TOUCH.small, height: TOUCH.small, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  })
);
