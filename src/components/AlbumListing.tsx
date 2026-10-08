import { useCallback, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Animated, BackHandler, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Sleeve } from './CoverFlow';
import { LIST_COVER_SIZE, ListHeading } from './ListHeading';
import { PlaylistCover } from './PlaylistCover';
import { QueueList } from './QueueList';
import type { Album } from '../lib/media/albums';
import { useTrackArtwork } from '../lib/media/artwork';
import type { EnrichedTrack } from '../lib/media/merge';
import { shuffled } from '../lib/media/shuffle';
import { makeStyles } from '../lib/theme/index';
import { motionReduced } from '../lib/ui/motion';

/** How long a sleeve takes to become its record, and to go back. */
const OPEN_MS = 300;

/**
 * How far through the sleeve has to be before the list is all there.
 *
 * Sooner than the sleeve arrives, so that it lands on a page rather than the
 * page turning up around it after it has stopped.
 */
const LIST_BY = 0.6;

/**
 * From here on the sleeve in flight gives way to the cover it was heading for.
 *
 * The two are not quite the same picture — the cover has rounder corners than
 * a sleeve shrunk to its size — and swapping one for the other on the last
 * frame shows as a twitch. Faded across the end of the flight, it does not.
 */
const LANDS_FROM = 0.8;

/**
 * A record taken out of the rack: the list of what is on it, over the rack.
 *
 * The sleeve that was tapped is what opens. A copy of it is drawn exactly
 * where the rack had it, and shrinks into the corner of the list's heading
 * while the list comes up behind it; putting the record back runs the same
 * thing the other way, so the sleeve is seen going back to where it came from.
 *
 * Over the rack rather than a screen of its own. A screen would arrive by the
 * navigator's own slide, from the edge, with no idea where the sleeve was —
 * and the rack underneath stays exactly as it was left for nothing, because
 * it was never taken down.
 *
 * It fills whatever it is put in and nothing more. Sideways that is the
 * library's share of the window, between the tabs and the player's panel,
 * both of which go on working beside it.
 */
export function AlbumListing({
  album,
  sleeve,
  sleeveNow,
  top,
  onPlay,
  onLongPress,
  onClosed,
}: {
  album: Album;
  /** Where the sleeve was when it was tapped, measured from this view's corner. */
  sleeve: Sleeve;
  /**
   * Where it is by the time the record goes back, or null if the rack no
   * longer has it square on — or is not there at all, the phone having been
   * turned upright since.
   */
  sleeveNow: (then: (sleeve: Sleeve | null) => void) => void;
  /** How much of the top is under the clock, for the heading to keep clear of. */
  top: number;
  onPlay: (tracks: EnrichedTrack[], index: number) => void;
  /**
   * A row held down. The menu it opens is the library's, drawn by the library
   * over this: a window of its own, so the back button closes the menu and
   * leaves the record open under it.
   */
  onLongPress?: (track: EnrichedTrack) => void;
  /** Told once it has gone, which is when it can be taken down. */
  onClosed: () => void;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const artwork = useTrackArtwork(album.tracks[0] ?? null);

  /*
    Read once, as the record opens. The switch is on a screen this one is not,
    so it cannot change while this is up.
  */
  const [still] = useState(motionReduced);

  /** Nought while it is still a sleeve in the rack, one once it is the list. */
  const progress = useRef(new Animated.Value(still ? 1 : 0)).current;

  /*
    The two ends of the flight, both measured from this view's corner.

    The far end is asked for rather than worked out: the cover sits beside a
    name that may run to three lines, and is centred against however tall that
    came out. The near end is the rack's to say, and is asked for again on the
    way back — null then means there is no sleeve to go back to, and the list
    simply fades.
  */
  const [from, setFrom] = useState<Sleeve | null>(sleeve);
  const [to, setTo] = useState<Sleeve | null>(null);

  const frame = useRef<View>(null);
  const cover = useRef<View>(null);
  const begun = useRef(false);
  const leaving = useRef(false);

  /**
   * Where the heading's cover is, from this view's corner.
   *
   * Both asked of the window and subtracted. Nothing between this view and
   * the cover is moved by a transform — which is why the list fades in and
   * does not slide: the measurement would have the slide in it or not
   * depending on when it was taken.
   */
  const landing = (then: (found: Sleeve) => void) => {
    const outer = frame.current;
    const inner = cover.current;
    if (!outer || !inner) return;
    outer.measureInWindow((left, above) => {
      inner.measureInWindow((x, y, width, height) => {
        then({ x: x - left, y: y - above, width, height });
      });
    });
  };

  const run = (toValue: number, then?: () => void) => {
    Animated.timing(progress, {
      toValue,
      duration: OPEN_MS,
      easing: Easing.bezier(0.3, 0, 0.1, 1),
      useNativeDriver: true,
    }).start(then);
  };

  /*
    Set off by the cover being laid out, since that is the first moment there
    is anywhere for the sleeve to go. Once only: the cover is laid out again
    whenever the phone is turned, and by then the record is long open.

    A frame late, because the list may still put itself somewhere on the pass
    that laid it out, and the cover has to be asked for after that. Nothing is
    seen waiting: until this runs the copy of the sleeve is standing exactly
    over the one in the rack.
  */
  const arrive = () => {
    if (begun.current || still) return;
    begun.current = true;
    requestAnimationFrame(() =>
      landing((found) => {
        setTo(found);
        // Closed before it had finished opening. It is on its way back, and
        // must not be sent out again.
        if (!leaving.current) run(1);
      })
    );
  };

  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (still) return onClosed();
    sleeveNow((found) => {
      if (!found) {
        setFrom(null);
        return run(0, onClosed);
      }
      /*
        The cover is asked for again as well. The list may have been scrolled
        since, and the sleeve should leave from where the cover is now — which
        can be off the top, and then it comes down from there.
      */
      setFrom(found);
      landing(setTo);
      run(0, onClosed);
    });
    // `run` and `landing` reach only refs, setters and the animated value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClosed, sleeveNow, still]);

  /*
    The back button puts the record back, since nothing was pushed for the
    navigator to pop: left alone it would leave the app with a record open.

    Only while the library is the screen in front. The tabs stay within reach
    beside this, and a record left open under another tab would otherwise go
    on answering presses meant for that one.
  */
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => listener.remove();
    }, [close])
  );

  /*
    Drawn at the size the sleeve was tapped at and shrunk from there, rather
    than drawn small and blown up: a picture scaled down stays sharp, and the
    moment it is largest is the moment it is being compared with the sleeve it
    is standing in for.

    The frame is moved and then scaled, so the scale is about its own middle
    and what is interpolated is where that middle is.
  */
  const flying = !still && from != null;
  const size = sleeve.width;
  const flight =
    from && to
      ? [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                from.x + (from.width - size) / 2,
                to.x + (to.width - size) / 2,
              ],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                from.y + (from.height - size) / 2,
                to.y + (to.height - size) / 2,
              ],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [from.width / size, to.width / size],
            }),
          },
        ]
      : [{ translateX: sleeve.x }, { translateY: sleeve.y }];
  const listed = progress.interpolate({
    inputRange: [0, LIST_BY],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const landed = progress.interpolate({
    inputRange: [LANDS_FROM, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const aloft = progress.interpolate({
    inputRange: [LANDS_FROM, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      ref={frame}
      // Asked where it is, so it has to be a view of its own to be found.
      collapsable={false}
      style={styles.frame}
      // Whatever is beside this is still the app; whatever is under it is not
      // there for as long as this is.
      accessibilityViewIsModal>
      {/*
        Takes every touch from the moment it is drawn, see-through or not, so
        nothing meant for the list reaches the rack while one is turning into
        the other.
      */}
      <Animated.View style={[styles.page, { opacity: listed }]}>
        <QueueList
          queue={album.tracks}
          // Nothing in a list is "the playing one"; the mark column stays empty.
          currentIndex={-1}
          // The whole record from that track, as tapping one anywhere does.
          onSelect={(index) => onPlay(album.tracks, index)}
          onLongPress={
            onLongPress &&
            ((index) => {
              const track = album.tracks[index];
              if (track) onLongPress(track);
            })
          }
          header={
            <View style={{ paddingTop: top }}>
              <ListHeading
                onBack={close}
                cover={
                  <Animated.View
                    ref={cover}
                    collapsable={false}
                    onLayout={arrive}
                    // Kept back while a sleeve is on its way to stand here,
                    // or there would be two of them.
                    style={{ opacity: flying ? landed : 1 }}>
                    <PlaylistCover
                      tracks={album.tracks}
                      chosen={album.tracks[0] ?? null}
                      size={LIST_COVER_SIZE}
                    />
                  </Animated.View>
                }
                name={album.name}
                tracks={album.tracks}
                hint={[album.artist, album.year].filter(Boolean).join(' · ') || null}
                onPlay={() => onPlay(album.tracks, 0)}
                // Shuffled here rather than by the player's shuffle, so the
                // queue itself is in the new order.
                onShuffle={() => onPlay(shuffled(album.tracks), 0)}
              />
            </View>
          }
          footer={<View style={{ paddingBottom: insets.bottom + 32 }} />}
        />
      </Animated.View>

      {flying ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sleeve,
            { width: size, height: size, opacity: aloft, transform: flight },
          ]}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // Clipped, so a sleeve leaving from a cover scrolled off the top is not
  // drawn over whatever is above the library.
  frame: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  page: { flex: 1, backgroundColor: c.bg },
  // The rack's own sleeve, to the corner and the colour behind the picture.
  sleeve: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
  },
  art: { width: '100%', height: '100%' },
}));
