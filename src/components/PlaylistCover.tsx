import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTrackArtwork } from '../lib/media/artwork';
import type { Track } from '../lib/types';

/**
 * What a list looks like: one cover, or the first four in a square.
 *
 * Nothing is stored for the default. It is read off whatever the list happens
 * to hold, so it follows the list around as tracks are added and reordered —
 * a picture that goes stale is worse than no picture, and a stored one would.
 *
 * A chosen cover is a track, not an image. Every cover the app can show already
 * belongs to a track, so naming the track names the picture without inventing
 * somewhere for images to live.
 */
export function PlaylistCover({
  tracks,
  chosen,
  picture,
  size,
}: {
  /** The list, in order. Only the first four are ever looked at. */
  tracks: Track[];
  /** The track whose cover was picked, or null for the square. */
  chosen: Track | null;
  /** A picture chosen from the phone, which outranks everything else. */
  picture?: string | null;
  size: number;
}) {
  /*
    Four hooks, always, whatever the list holds. A hook cannot be called in a
    loop over a list whose length changes, so the slots are fixed and the empty
    ones are handed null — which the hook already answers with null for.
  */
  const single = picture != null || chosen != null;
  const first = useTrackArtwork(chosen ?? tracks[0] ?? null);
  const second = useTrackArtwork(single ? null : (tracks[1] ?? null));
  const third = useTrackArtwork(single ? null : (tracks[2] ?? null));
  const fourth = useTrackArtwork(single ? null : (tracks[3] ?? null));

  const radius = Math.max(6, size * 0.09);

  // One picture whenever there is only one to show — a chosen cover, or a list
  // too short to fill a square. Four tiles where one of them is blank reads as
  // a broken grid rather than as a short list.
  const corners = [first, second, third, fourth];
  if (single || corners.some((uri) => uri == null)) {
    return <Tile uri={picture ?? first} size={size} radius={radius} />;
  }

  return (
    <View style={[styles.grid, { width: size, height: size, borderRadius: radius }]}>
      {corners.map((uri, index) => (
        <Tile key={index} uri={uri} size={size / 2} radius={0} />
      ))}
    </View>
  );
}

function Tile({
  uri,
  size,
  radius,
}: {
  uri: string | null;
  size: number;
  radius: number;
}) {
  if (!uri) {
    return <View style={[styles.empty, { width: size, height: size, borderRadius: radius }]} />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  empty: { backgroundColor: '#242424' },
});
