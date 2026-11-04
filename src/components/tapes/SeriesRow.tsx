import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PauseIcon, PlayIcon } from '../Icons';
import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import type { EnrichedTrack } from '../../lib/media/merge';
import { useTrackArtwork } from '../../lib/media/artwork';
import { usePlayingId } from '../../lib/player/current';
import { nextToPlay } from '../../lib/tapes/order';
import { progressOf, type TapePlace } from '../../lib/tapes/places';
import { makeStyles, outlinedClip, useColours, usePressed } from '../../lib/theme/index';
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
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected === 'all' ? true : selected === 'some' ? 'mixed' : false } : undefined}
      style={[styles.row, selectable && selected !== 'none' && styles.rowSelected]}
      onPress={() => (selectable ? onSelect?.(show) : onPress(show))}>
      <View style={styles.top}>
        {selectable ? (
          <View style={[styles.checkbox, selected !== 'none' && styles.checkboxOn]}>
            {selected !== 'none' ? (
              <Text style={styles.checkMark} importantForAccessibility="no">{selected === 'all' ? '✓' : '–'}</Text>
            ) : null}
          </View>
        ) : null}
        {picture ? <Image source={{ uri: picture }} style={styles.art} contentFit="cover" /> : <View style={[styles.art, styles.artEmpty]} />}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{show.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {book ? t.library.tapes.bookLine(episodes.length, fresh) : episodes.length > 0 ? t.library.tapes.seriesLine(episodes.length, fresh) : t.library.tapes.seriesNone}
          </Text>
        </View>
        {episodes.length > 0 ? (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t.library.tapes.hideEpisodes : t.library.tapes.showEpisodes}
            accessibilityState={{ expanded }}
            hitSlop={8}
            style={styles.expand}
            onPress={() => onExpand(show)}>
            <Text style={[styles.chevron, { transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }]}>›</Text>
          </Pressable>
        ) : null}
      </View>
      {next ? (
        <View style={[styles.episode, selectable && styles.episodeShifted]}>
          {/* Under the show's picture, the episode's own, smaller. */}
          <View style={styles.episodeArtBox}>
            {artwork ? (
              <Image source={{ uri: artwork }} style={styles.episodeArt} contentFit="cover" transition={120} />
            ) : (
              <View style={[styles.episodeArt, styles.artEmpty]} />
            )}
          </View>
          <View style={styles.episodeText}>
            <Text style={styles.episodeTitle} numberOfLines={1}>{next.title}</Text>
            {progress != null && place ? (
              <View style={styles.progressLine}>
                <View style={styles.track}>
                  <View style={[styles.done, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <Text style={styles.left} numberOfLines={1}>
                  {t.library.tapes.left(Math.max(1, Math.round((place.durationSec - place.positionSec) / 60)))}
                </Text>
              </View>
            ) : (
              <Text style={styles.left} numberOfLines={1}>{durationLabel(next.durationSec)}</Text>
            )}
          </View>
          {selectable ? null : (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={`${verb}, ${next.title}`}
            hitSlop={6}
            style={styles.play}
            onPress={() => onPlay(next)}>
            {on ? <PauseIcon size={14} color={c.text} /> : <PlayIcon size={14} color={c.text} />}
            <Text style={styles.playLabel}>{verb}</Text>
          </Pressable>
          )}
        </View>
      ) : null}
    </Pressable>
  );
});

const useStyles = makeStyles((c) => StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  art: { width: 46, height: 46, borderRadius: 6 },
  artEmpty: { backgroundColor: c.surface },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 15.5 },
  subtitle: { color: c.textMuted, fontSize: 12.5 },
  chevron: { color: c.textMuted, fontSize: 24, lineHeight: 26 },
  expand: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rowSelected: { backgroundColor: c.accentSoft },
  // As a track's row has it: see TrackRow.
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 13, fontWeight: '700', lineHeight: 15 },
  // Its words under the show's name, its picture under the show's.
  episode: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Past the tick box, so the pictures stay one above the other.
  episodeShifted: { marginLeft: 32 },
  episodeArtBox: { width: 46, alignItems: 'center' },
  episodeArt: { width: 36, height: 36, borderRadius: 5 },
  episodeText: { flex: 1, minWidth: 0, gap: 5 },
  episodeTitle: { color: c.textSecondary, fontSize: 13.5 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, maxWidth: 90, height: 3, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
  done: { height: 3, backgroundColor: c.accent },
  left: { color: c.textFaint, fontSize: 12 },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
    // A raised surface rather than the theme's own colour, which in a dark theme is all but white: one of these on every row was a column of glare.
    backgroundColor: c.surfaceRaised,
    ...outlinedClip(c),
  },
  playLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
}));
