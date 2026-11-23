import { StyleSheet, Text, View } from 'react-native';
import { SPACE, TYPE } from '../lib/theme/measures';

import { MarkButtons } from './ListHeading';
import type { PressRingFor } from './PressMenu';
import { QueueList } from './QueueList';
import { useT } from '../lib/i18n/index';
import type { Album } from '../lib/media/albums';
import type { EnrichedTrack } from '../lib/media/merge';
import { shuffled } from '../lib/media/shuffle';
import { formatDuration } from '../lib/stats/period';
import { makeStyles } from '../lib/theme/index';
import type { Track } from '../lib/types';

/**
 * Under the rack held upright: the record that has come to rest in front --
 * how long it is, the three buttons a record's page has, and its tracks. Its
 * name is the rack's caption, under the rack as it is sideways.
 *
 * The record the rack has stopped on, not the one passing the front as it
 * goes: the rack tells the library where it came to rest, and only then is
 * this drawn again for another record. Changed at every record a flick went
 * by, the list under it would flicker through all of them, and drawing it
 * that often would have been taken from the rack's frames.
 *
 * Its tracks scroll within it, the rack staying where it is above them, and
 * end clear of whatever bars are laid over the foot ([bottom]).
 */
export function RackFront({
  album,
  bottom,
  onPlay,
  onTap,
  onLongPress,
  ring,
}: {
  album: Album | null;
  /** How much of the foot is under the bars of glass, for the last row to be scrolled clear of. */
  bottom: number;
  onPlay: (tracks: EnrichedTrack[], index: number) => void;
  /** A row tapped, where that is not simply [onPlay] from it. */
  onTap?: (tracks: EnrichedTrack[], index: number) => void;
  onLongPress?: (track: EnrichedTrack) => void;
  ring?: PressRingFor<Track>;
}) {
  const t = useT();
  const styles = useStyles();
  if (!album) return <View style={styles.front} />;
  const total = album.tracks.reduce((sum, track) => sum + (track.durationSec ?? 0), 0);
  const counted = t.common.tracks(album.tracks.length) + (total > 0 ? ` · ${formatDuration(total, t)}` : '');
  return (
    <View style={styles.front}>
      <View style={styles.heading}>
        {/* The record's name and whose it is are the rack's caption, over this; here, how much of it there is. */}
        <Text style={styles.about} numberOfLines={1}>
          {counted}
        </Text>
        <MarkButtons
          tracks={album.tracks}
          onPlay={() => onPlay(album.tracks, 0)}
          // Shuffled here rather than by the player's shuffle, so the queue itself is in the new order.
          onShuffle={() => onPlay(shuffled(album.tracks), 0)}
        />
      </View>
      <QueueList
        // A list of its own for each record, so that it starts at the top of the one come to.
        key={album.key}
        // On a plate where screens are glass, as a record's own page has them.
        plate
        queue={album.tracks}
        // No place in a record is "the one playing"; the song playing is marked where it is in it all the same.
        currentIndex={-1}
        marksPlaying
        onSelect={(index) => (onTap ?? onPlay)(album.tracks, index)}
        onLongPress={
          onLongPress &&
          ((index) => {
            const track = album.tracks[index];
            if (track) onLongPress(track);
          })
        }
        ring={ring}
        footer={<View style={{ paddingBottom: bottom + 16 }} />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  front: { flex: 1, minHeight: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: SPACE.l, paddingTop: SPACE.xs, paddingBottom: SPACE.s },
  about: { flex: 1, color: c.textMuted, fontSize: TYPE.hint },
}));
