import { memo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import type { Mark } from '../lib/media/selection';
import { makeStyles, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';
import type { Track } from '../lib/types';
import { MoreButton } from './MoreButton';
import { PlaylistCover } from './PlaylistCover';
import { trackRowHeight } from './TrackRow';
import { ArtistLinks } from './NameLinks';

/** A track row's cover, in size. */
const COVER = 46;

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
  const styles = useStyles();
  const pressed = usePressed();
  const height = useBrowseRowHeight();
  const choosing = mark !== undefined;
  return (
    <Pressable
      android_ripple={pressed}
      // The whole row is the tick box while tracks are being chosen, not the
      // square inside it: the square is not separately pressable, and a reader
      // sent to find a box within a button would not get there.
      accessibilityRole={choosing ? 'checkbox' : 'button'}
      accessibilityState={choosing ? { checked: mark } : undefined}
      // Both lines as one sentence. Left to itself the reader says the two
      // texts apart, and the second is only a number without the first.
      accessibilityLabel={`${title}, ${[by, detail].filter(Boolean).join(' · ')}`}
      accessibilityHint={choosing ? t.library.row.selectsTracks : t.library.row.opensTracks}
      // Named for the reason a track's long press is: nobody using a screen
      // reader finds a held row by trying. Left out once choosing has begun,
      // when holding does nothing a tap does not.
      accessibilityActions={
        onLongPress && !choosing
          ? [{ name: 'longpress', label: held ?? t.library.row.select }]
          : undefined
      }
      onAccessibilityAction={
        onLongPress &&
        ((event) => {
          if (event.nativeEvent.actionName === 'longpress') onLongPress(id);
        })
      }
      style={[
        styles.row,
        { height },
        shared && styles.shared,
        mark === true && styles.chosen,
      ]}
      onPress={() => onPress(id)}
      onLongPress={
        onLongPress &&
        (() => {
          haptic('holds', 'hold');
          onLongPress(id);
        })
      }>
      {choosing ? (
        // The track rows' box, with a third thing to say that theirs never
        // has: some. Outlined in the accent and barred rather than filled, so
        // it reads as begun and cannot be taken for either of the other two.
        <View
          style={[styles.checkbox, mark === true && styles.checkboxOn, mark === 'mixed' && styles.checkboxSome]}>
          {mark === true ? <Text style={styles.checkMark} importantForAccessibility="no">✓</Text> : null}
          {mark === 'mixed' ? <View style={styles.bar} /> : null}
        </View>
      ) : null}
      <PlaylistCover tracks={tracks} chosen={null} sleeve={cover} size={COVER} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {/* Not while tracks are being ticked, when a touch on the row chooses it. */}
          {by ? (
            <>
              <ArtistLinks credit={by} off={choosing} />
              {detail ? ' · ' : ''}
            </>
          ) : null}
          {detail}
        </Text>
      </View>
      {/* A record's menu, as a track's: only where a hold opens one, and not while tracks are being ticked. */}
      {onLongPress && held && !choosing ? <MoreButton onPress={() => onLongPress(id)} /> : null}
    </Pressable>
  );
});

const useStyles = makeStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // As `TrackRow` lays its row out.
    gap: 12,
    paddingHorizontal: 16,
  },
  shared: { flex: 1, minWidth: 0 },
  chosen: { backgroundColor: c.accentSoft },
  // As `TrackRow` draws it.
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
  checkboxSome: { borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 13, fontWeight: '700', lineHeight: 15 },
  bar: { width: 10, height: 2, borderRadius: 1, backgroundColor: c.accent },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 15.5 },
  detail: { color: c.textMuted, fontSize: 12.5 },
}));
