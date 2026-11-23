import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Image } from '../Picture';
import { useTrackArtwork } from '../../lib/media/artwork';
import { useColours } from '../../lib/theme/index';
import type { EnrichedTrack } from '../../lib/media/merge';

/**
 * The ways the Tracks view can be drawn: the list, or the list with shelves
 * of covers over it (`Shelves`). Either can be pinched into a wall of covers.
 */
export const TRACK_LOOKS = ['list', 'shelves'] as const;
export type TrackLook = (typeof TRACK_LOOKS)[number];

export function asTrackLook(value: string | null): TrackLook {
  return (TRACK_LOOKS as readonly string[]).includes(value ?? '') ? (value as TrackLook) : 'list';
}

export function nextTrackLook(look: TrackLook): TrackLook {
  return TRACK_LOOKS[(TRACK_LOOKS.indexOf(look) + 1) % TRACK_LOOKS.length] ?? 'list';
}

/** How far the list is pinched out: 0 is the list, and each step after it a wall of more covers to a row. */
export const WALL_COLUMNS = [0, 3, 5, 8, 13, 21] as const;
export function asZoom(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < WALL_COLUMNS.length ? n : 0;
}

/** What every look is handed: the tracks the list would show, in its order, and what to do with them. */
export type LookProps = {
  tracks: EnrichedTrack[];
  /** How many times each has been listened to. */
  counts: ReadonlyMap<string, number>;
  /** Room to leave at the top and the foot, under the bars laid over them. */
  top: number;
  bottom: number;
  onPlay: (tracks: EnrichedTrack[], index: number) => void;
  onHold: (track: EnrichedTrack) => void;
};

/** A track's cover, square, or a plain tile where it has none. */
export function TrackCover({ track, size, style }: { track: EnrichedTrack | null; size: number; style?: ViewStyle }) {
  const uri = useTrackArtwork(track);
  // The tile in the theme's own raised colour, as an empty cover is everywhere else: a fixed grey stood out on a light page.
  const c = useColours();
  return (
    <View style={[styles.cover, { width: size, height: size, borderRadius: Math.max(3, size * 0.06), backgroundColor: c.surfaceRaised }, style]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={100} drawnAt={size} /> : null}
    </View>
  );
}

/** Between two `#rrggbb` colours, [t] of the way from the first. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden' },
});
