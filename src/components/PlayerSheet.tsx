import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Animated,
  BackHandler,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  JumpIcon,
  LyricsIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  ShuffleIcon,
  SettingsIcon,
  TranslateIcon,
} from './Icons';
import { PlayerSettings } from './PlayerSettings';
import { useCoveredByRoute } from '../lib/player/overlayRoutes';
import { LyricsView } from './LyricsView';
import { QueueList } from './QueueList';
import { albumKey } from '../lib/media/albums';
import { useLyrics } from '../lib/lyrics/useLyrics';
import { jumpTo, stepFrom } from '../lib/player/jump';
import { readSetting, SETTINGS } from '../lib/db/index';
import { useTrackArtwork } from '../lib/media/artwork';
import {
  usePlayerActions,
  usePlayerPosition,
  usePlayerState,
} from '../lib/player/PlayerProvider';

const REPEAT_LABEL = { off: 'Repeat', all: 'Repeat all', one: 'Repeat one' } as const;

/** One colour, lit or not: the whole of what these buttons say about state. */
const ON = '#f2f2f2';
const OFF = '#5a5a5a';

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** How often the time under the finger is redrawn while scrubbing. */
const LABEL_INTERVAL_MS = 100;

/**
 * The progress bar, and the way to move through a track.
 *
 * Follows the same rule as Media3's own PlayerControlView: while the finger is
 * down only the display moves, and the song is moved once, when it lifts.
 * Seeking as the finger travels sounds like the track stopping and starting,
 * because that is what it is — every seek is a jump to another part of the
 * file and a buffer refilled from nothing.
 *
 * The bar is driven by an animated value rather than by state. State meant a
 * React render per touch event, sixty a second, each re-measuring a percentage
 * width; an animated value is written to the view without a render at all.
 */
function Scrubber({
  positionSec,
  durationSec,
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(0);
  /** The time under the finger, or null when nobody is scrubbing. */
  const [scrubbed, setScrubbed] = useState<number | null>(null);

  const widthRef = useRef(0);
  const durationRef = useRef(0);
  widthRef.current = width;
  durationRef.current = durationSec;

  /** 0 to 1, the share of the track behind the playhead. */
  const filled = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);
  /** Where the bar starts in window coordinates, fixed for the whole gesture. */
  const originX = useRef(0);
  const lastLabel = useRef(0);
  /** Where the last seek was aimed, until the player reports having got there. */
  const settling = useRef<{ seconds: number; since: number } | null>(null);

  /*
    While a finger is down it owns the bar, and for a moment after it lifts it
    still does. The position is polled, so the first reading after a seek is
    the one taken before it — accepting that would drop the bar back to where
    the track used to be and jump it forward again a moment later.

    Given up on after a second, since a seek that never arrives must not leave
    the bar frozen for the rest of the song.
  */
  useEffect(() => {
    if (dragging.current) return;

    const target = settling.current;
    if (target) {
      const arrived = Math.abs(positionSec - target.seconds) < 1.5;
      if (!arrived && Date.now() - target.since < 1000) return;
      settling.current = null;
    }

    filled.setValue(durationSec > 0 ? clamp(positionSec / durationSec) : 0);
  }, [filled, positionSec, durationSec]);

  const panResponder = useMemo(() => {
    const move = (pageX: number) => {
      const fraction = clamp((pageX - originX.current) / (widthRef.current || 1));
      // Straight to the view: the bar keeps up with the finger because nothing
      // between them has to re-render.
      filled.setValue(fraction);

      /*
        The reading below the bar is the one thing here that needs a render, so
        it gets a slower clock than the bar does. At a hundred milliseconds it
        is still quicker than the eye reads a changing number, and it is ten
        renders a second instead of sixty.
      */
      const now = Date.now();
      if (now - lastLabel.current >= LABEL_INTERVAL_MS) {
        lastLabel.current = now;
        setScrubbed(fraction * durationRef.current);
      }
      return fraction;
    };

    const finish = (fraction: number) => {
      dragging.current = false;
      setScrubbed(null);
      const seconds = fraction * durationRef.current;
      settling.current = { seconds, since: Date.now() };
      onSeek(seconds);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      /*
        A drag that began on the bar belongs to the bar. Without this the
        player's own drag-to-dismiss asks for the gesture as soon as the finger
        strays upwards or downwards, and the default answer is to hand it over —
        so scrubbing started sliding the screen instead.
      */
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event) => {
        dragging.current = true;
        /*
          Taken once, and only here. `locationX` is measured against whichever
          view the touch is over, so recomputing it as the finger travels means
          that the moment it leaves the bar the origin belongs to some other
          view and the position jumps.
        */
        originX.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
        lastLabel.current = 0;
        move(event.nativeEvent.pageX);
      },
      onPanResponderMove: (_event, gesture) => {
        move(gesture.moveX);
      },
      onPanResponderRelease: (_event, gesture) => {
        // A tap never moved, so it ends where it began and seeks there.
        finish(clamp((gesture.moveX - originX.current) / (widthRef.current || 1)));
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        setScrubbed(null);
      },
    });
  }, [filled, onSeek]);

  /*
    Slid rather than resized. A width cannot change without laying the view out
    again, and layout is the part that was too slow; a translation is a
    transform, which costs nothing to move.
  */
  const slide = filled.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, 0],
  });

  return (
    <View>
      <View
        style={styles.scrubHitArea}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}>
        <View style={styles.scrubTrack}>
          <Animated.View
            style={[styles.scrubFill, { width, transform: [{ translateX: slide }] }]}
          />
        </View>
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(scrubbed ?? positionSec)}</Text>
        <Text style={styles.time}>{formatTime(durationSec)}</Text>
      </View>
    </View>
  );
}

/**
 * The now-playing screen, drawn over the library rather than routed to.
 *
 * Routing to it meant the library was not rendered while it was open, so
 * dragging the player down uncovered black and the list only reappeared once
 * the navigation transition had finished. As a layer above the same tree, the
 * library is genuinely behind it and shows through the moment the drag starts.
 */
export function PlayerSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { current, currentIndex, queue, isPlaying, playWhenReady, shuffled, repeat, speed, pitch, error } =
    usePlayerState();
  const {
    toggle,
    next,
    previous,
    seekTo,
    skipToIndex,
    shuffleQueue,
    cycleRepeat,
    setSpeed,
    setPitch,
    moveInQueue,
    removeFromQueue,
  } = usePlayerActions();
  const { positionSec, durationSec } = usePlayerPosition();
  const artwork = useTrackArtwork(current);
  const { width, height } = useWindowDimensions();
  /*
    Landscape is a different screen, not a squeezed version of this one. Stacked
    vertically there is room for the artwork or the queue but not both, and the
    two halves sit side by side instead — which is also the shape that reads at
    a glance from a car dashboard.
  */
  const landscape = width > height;
  const insets = useSafeAreaInsets();

  /**
   * Pulling the queue upwards trades the artwork for more of the list. It is
   * two states rather than a free-form height: anything in between is a size
   * nobody chose, and the artwork either has room to be worth showing or does
   * not.
   */
  const [expanded, setExpanded] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  // Off until asked for: the first translation into a language fetches a model
  // of some thirty megabytes, which is not something to spend unbidden.
  const [showTranslation, setShowTranslation] = useState(false);
  const grow = useRef(new Animated.Value(0)).current;

  // Only asked for once the panel is open. Every track change would otherwise
  // send LRCLIB a request for words nobody is going to read.
  const lyrics = useLyrics(current, showLyrics);

  /*
    How tall the queue grows to. Measured from the space left below the player
    while collapsed, plus the artwork that folds away as it opens.

    Accepted only when the window itself has changed size, never in between:
    the layouts that arrive as the queue opens and closes are stages of the
    animation, and measuring one of those would size the queue from the
    transition rather than from the room available.
  */
  const [queueRoom, setQueueRoom] = useState(0);
  const measuredFor = useRef(0);
  /**
   * The box the artwork was actually given, measured rather than worked out.
   *
   * Both sides of it: the cover is square, so it is bounded by whichever of the
   * two is smaller — the height on a short screen, the column width on a wide
   * one.
   */
  const [artBox, setArtBox] = useState({ width: 0, height: 0 });

  /** How tall the second column came out, for the words to scroll within. */
  const [sideBox, setSideBox] = useState(0);

  /*
    Forgotten the moment the screen turns. What was measured describes the
    layout it was measured in, and carrying it across is how the artwork came
    out at its upright size on a screen half as tall.
  */
  useEffect(() => {
    setArtBox({ width: 0, height: 0 });
  }, [landscape]);

  const toggleQueue = useCallback(
    (next: boolean) => {
      setExpanded(next);
      Animated.timing(grow, {
        toValue: next ? 1 : 0,
        duration: 220,
        // Height cannot be driven natively, and this runs once per gesture.
        useNativeDriver: false,
      }).start();
    },
    [grow]
  );

  const queueHandle = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < -30) toggleQueue(true);
          else if (gesture.dy > 30) toggleQueue(false);
        },
      }),
    [toggleQueue]
  );

  /**
   * Drag the player down to put it away.
   *
   * The player sits *outside* the queue list rather than being its header, and
   * that is what makes this work at all. On Android a list scrolls natively, so
   * once it takes a vertical drag no JavaScript responder can have it back —
   * not even one capturing from an ancestor, which is why the earlier attempts
   * only ever fired over the progress bar. Keeping the two apart means the drag
   * never has to be won from the list in the first place.
   */
  const slide = useRef(new Animated.Value(0)).current;
  const dismiss = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) slide.setValue(gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          // Far enough, or thrown hard enough, counts as putting it away.
          if (gesture.dy > 120 || gesture.vy > 0.9) {
            Animated.timing(slide, {
              toValue: height,
              duration: 180,
              useNativeDriver: true,
            }).start(onClose);
          } else {
            Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
      }),
    [height, onClose, slide]
  );

  /*
    The player is a layer over the navigator rather than a screen in it, so the
    back button knows nothing about it and would pop whatever is underneath —
    leaving the player covering a screen nobody asked for. Registered here
    rather than around the host, because this component exists exactly as long
    as the player is open.

    Except while something is open on top of it. This handler answers every
    press, and the player goes on existing behind the equalizer and the rest —
    so leaving it registered meant a back press from one of those screens was
    eaten here, silently closing a panel nobody could see, and the screen the
    player was supposedly letting the user return to never moved.
  */
  const covered = useCoveredByRoute();
  useEffect(() => {
    if (covered) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playbackOpen) setPlaybackOpen(false);
      else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [covered, onClose, playbackOpen]);

  const onSeek = useCallback((seconds: number) => void seekTo(seconds), [seekTo]);

  /*
    Read once, as the player opens. It is a setting rather than a state, and
    this component is built afresh every time the sheet is raised — so the only
    moment it could be stale is one in which the screen it is changed on was
    open instead of this one.
  */
  const [step] = useState(() => stepFrom(readSetting(SETTINGS.jumpSeconds)));
  const jump = useCallback(
    (by: number) => {
      void seekTo(jumpTo(positionSec, by, durationSec || current?.durationSec || 0));
    },
    [current?.durationSec, durationSec, positionSec, seekTo]
  );

  const album = current?.album?.trim() || null;

  if (!current) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>Nothing playing.</Text>
      </View>
    );
  }

  /*
    Upright only. The artwork folds away as the queue is pulled over it, and an
    animation between two heights needs both of them as numbers — which is why
    this one figure is still worked out rather than left to the layout.

    It is safe here because nothing below it is fixed: the queue is measured,
    and it is the queue that gives way. Sideways there is no fold and nothing
    to measure against, so the artwork simply takes what is left instead.
  */
  const artSize = Math.min(height * 0.3, 320);

  /*
    The largest square the measured box will hold — and never more than a share
    of the screen, whatever the measurement says.

    The cap is the belt to the measurement's braces. A measurement is a fact
    about a layout that has already happened, so the first render after the
    screen turns is drawn from the last one taken upright: a box some three
    hundred points tall, on a screen with half that to spare. Clearing it on the
    turn is the first guard and this is the second, because a figure that cannot
    exceed the room available cannot push anything off the bottom even for the
    frame before it is corrected.
  */
  /*
    Sideways every control is drawn about a sixth smaller. The column is half as
    wide and less than half as tall as the screen it had upright, and the space
    the buttons give up is the space the artwork and the words get.
  */
  const skipIcon = landscape ? 20 : 24;
  const playIcon = landscape ? 27 : 32;
  const modeIcon = landscape ? 18 : 21;
  const control = landscape ? styles.controlWide : styles.control;

  const wideArt = Math.max(
    0,
    Math.min(artBox.width, artBox.height, height * 0.5, width * 0.32)
  );

  // The fold-away only exists in the stacked layout; beside the queue the
  // artwork has its own column and never has to give it up.
  const artHeight = landscape
    ? artSize
    : grow.interpolate({ inputRange: [0, 1], outputRange: [artSize, 0] });
  const artOpacity = landscape
    ? 1
    : grow.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0] });
  const queueHeight = grow.interpolate({ inputRange: [0, 1], outputRange: [0, queueRoom] });

  const queueList = (
    <QueueList
      queue={queue}
      currentIndex={currentIndex}
      onSelect={(index) => void skipToIndex(index)}
      onMove={(from, to) => void moveInQueue(from, to)}
      onRemove={(index) => void removeFromQueue(index)}
    />
  );

  const settings = (
    <PlayerSettings visible={playbackOpen} speed={speed} pitch={pitch}
      onSpeed={(value) => void setSpeed(value)} onPitch={(value) => void setPitch(value)}
      onClose={() => setPlaybackOpen(false)} />
  );

  const playerColumn = (
      <View
        style={[
          styles.player,
          landscape && styles.playerWide,
          /*
            Sideways the column is given the height outright rather than
            inheriting it. Every container between here and the root claims
            `flex: 1`, and on the phone not one of them shrank when the screen
            turned — the root read 384 and this column 549, measured before the
            resize and never measured again. A number taken from the window is
            correct on the render that follows the turn, with no second layout
            pass to wait for.
          */
          landscape && { height: height - insets.bottom },
          { paddingTop: insets.top + (landscape ? 10 : 24) },
        ]}
        {...dismiss.panHandlers}>
        {/*
          Sideways this takes whatever height the controls below it have not
          claimed, down to nothing, instead of a share of the window. A figure
          worked out from the window has to assume how tall everything else
          will be, and when the assumption is wrong — a shorter screen, a
          dashboard rather than a phone — the difference goes off the bottom.
          Letting the layout decide cannot overflow, because the artwork is
          what gives way.
        */}
        <Animated.View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setArtBox((box) =>
              box.width === width && box.height === height ? box : { width, height }
            );
          }}
          style={[
            styles.artWrapper,
            landscape ? styles.artWrapperWide : { height: artHeight },
            { opacity: artOpacity },
          ]}>
          {/*
            Sideways the contents are lifted out of the flow entirely.

            Everything before this tried to work out a size the artwork could
            safely be, and each attempt was a guess about a layout that had not
            happened yet. A child positioned absolutely has no say in how tall
            its parent is and none in where its siblings sit, so whatever size
            it ends up at — right, stale, or absurd — the controls below cannot
            be pushed anywhere. The box stays the height the column gave it and
            the artwork is drawn inside it, clipped if it has to be.
          */}
          <View style={landscape ? styles.artLayer : undefined}>
          {showLyrics && !landscape ? (
            <LyricsView
              state={lyrics}
              positionSec={positionSec}
              height={artSize}
              onSeek={onSeek}
              trackId={current.id}
              translated={showTranslation}
            />
          ) : artwork ? (
            <Image
              source={{ uri: artwork }}
              // Square, and no larger than the box it was given.
              style={[
                styles.art,
                // An explicit square either way. Asking for `flex` and an
                // aspect ratio together leaves the size to be resolved two
                // ways at once, and it came out differently depending on
                // whether the screen had been turned or opened already wide.
                landscape
                  ? { width: wideArt, height: wideArt }
                  : { width: artSize, height: artSize },
              ]}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.art,
                styles.artEmpty,
                landscape
                  ? { width: wideArt, height: wideArt }
                  : { width: artSize, height: artSize },
              ]}
            />
          )}
          </View>
        </Animated.View>

        <View style={styles.titles}>
          <Text style={[styles.title, landscape && styles.titleWide]} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={[styles.artist, landscape && styles.artistWide]} numberOfLines={1}>
            {current.artist ?? 'Unknown artist'}
            {album ? (
              <>
                {' · '}
                {/*
                  The player is a layer over the navigator, so it has to go
                  before the record can arrive — otherwise the album opens
                  underneath it and the back button lands on a screen nobody
                  can see.
                */}
                <Text
                  style={styles.albumLink}
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/playlist', params: { album: albumKey(album) } });
                  }}>
                  {album}
                </Text>
              </>
            ) : null}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error.message}</Text> : null}

        <Scrubber
          positionSec={positionSec}
          // The file's own length until the player reports one of its own,
          // which it cannot do before the track is prepared.
          durationSec={durationSec || current.durationSec}
          onSeek={onSeek}
        />

        <View style={[styles.transport, landscape && styles.transportWide]}>
          <Pressable style={control} onPress={() => void previous()}>
            <PreviousIcon size={skipIcon} />
          </Pressable>
          {/*
            Inside the track, between the buttons that leave it. Reading
            outwards from the middle the row is: play, a step, a whole record —
            which is the order of how far each one moves.
          */}
          <Pressable
            style={control}
            accessibilityRole="button"
            accessibilityLabel={`Back ${step} seconds`}
            onPress={() => jump(-step)}>
            <JumpIcon size={skipIcon} seconds={step} back />
          </Pressable>
          <Pressable style={control} onPress={() => void toggle()}>
            {playWhenReady ? <PauseIcon size={playIcon} /> : <PlayIcon size={playIcon} />}
          </Pressable>
          <Pressable
            style={control}
            accessibilityRole="button"
            accessibilityLabel={`Forward ${step} seconds`}
            onPress={() => jump(step)}>
            <JumpIcon size={skipIcon} seconds={step} />
          </Pressable>
          <Pressable style={control} onPress={() => void next()}>
            <NextIcon size={skipIcon} />
          </Pressable>
        </View>

        <View style={styles.options}>
          <Pressable
            style={styles.mode}
            accessibilityRole="button"
            accessibilityLabel="Shuffle the queue"
            accessibilityState={{ selected: shuffled }}
            onPress={() => void shuffleQueue()}>
            <ShuffleIcon size={modeIcon} color={shuffled ? ON : OFF} />
          </Pressable>
          <Pressable
            style={styles.mode}
            accessibilityRole="button"
            accessibilityLabel={REPEAT_LABEL[repeat]}
            onPress={() => void cycleRepeat()}>
            <RepeatIcon
              size={modeIcon}
              once={repeat === 'one'}
              color={repeat === 'off' ? OFF : ON}
            />
          </Pressable>
          <Pressable
            style={styles.mode}
            accessibilityRole="button"
            accessibilityLabel="Playback settings"
            accessibilityState={{ expanded: playbackOpen }}
            onPress={() => setPlaybackOpen(true)}>
            <SettingsIcon size={modeIcon} color={OFF} />
          </Pressable>
          <Pressable
            style={styles.mode}
            accessibilityRole="button"
            accessibilityLabel="Lyrics"
            accessibilityState={{ selected: showLyrics }}
            onPress={() => setShowLyrics(!showLyrics)}>
            <LyricsIcon size={modeIcon} color={showLyrics ? ON : OFF} />
          </Pressable>
          {/* Only offered where it would do something. */}
          {showLyrics ? (
            <Pressable
              style={styles.mode}
              accessibilityRole="button"
              accessibilityLabel="Translate the lyrics"
              accessibilityState={{ selected: showTranslation }}
              onPress={() => setShowTranslation(!showTranslation)}>
              <TranslateIcon size={modeIcon} color={showTranslation ? ON : OFF} />
            </Pressable>
          ) : null}
        </View>
      </View>
  );

  if (landscape) {
    return (
      <Animated.View
        /*
          Keyed on the orientation so turning the screen builds a new tree
          rather than re-dressing the old one.

          The two layouts are different shapes made of the same kinds of view,
          so React updates them in place — and the views brought their old
          measurements with them. Measured on the phone: the container's first
          reported height sideways was 564.27, which is exactly what the upright
          column had been. No amount of telling it a new height helped, because
          nothing asked it to measure again. A key makes the old views go.
        */
        key="wide"
        style={[styles.screen, { transform: [{ translateY: slide }] }]}>
        <View
          style={[
            styles.columns,
            /*
              Pinned to the window rather than left to flex.

              Measured on the phone during a turn: the root came out 384 tall
              and this, its only child, 564 — laid out before the root resized
              and never laid out again, so `flex: 1` had nothing true to shrink
              against and the controls hung off the bottom. A height taken from
              the window is a number that changes when the window does, which
              makes the render that follows correct by construction instead of
              by a second layout pass that may not come.
            */
            { height },
            // Sideways the cutout is beside the screen rather than above it.
            { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom },
          ]}>
          <View
            style={styles.playerHalf}>{playerColumn}</View>
          <View style={styles.queueHalf}>
            <Text style={[styles.queueLabel, styles.queueHeading]}>
              {showLyrics ? 'Lyrics' : `Up next · ${queue.length}`}
            </Text>
            {/*
              The words take the second column rather than the artwork's place.
              Upright there is only one column and they have to trade, but here
              the cover can stay where it is and the reading gets the taller
              half of the screen — which is the half that suits it.

              Never pulled open or shut: the handle exists to trade the artwork
              for the list, and sideways they each have a column already.
            */}
            <View
              style={styles.queueFill}
              onLayout={(event) => {
                const measured = event.nativeEvent.layout.height;
                setSideBox((box) => (box === measured ? box : measured));
              }}>
              {showLyrics ? (
                <LyricsView
                  state={lyrics}
                  positionSec={positionSec}
                  height={sideBox}
                  onSeek={onSeek}
                  trackId={current.id}
                  translated={showTranslation}
                />
              ) : (
                queueList
              )}
            </View>
          </View>
        </View>
        {settings}
      </Animated.View>
    );
  }

  return (
    <Animated.View key="tall" style={[styles.screen, { transform: [{ translateY: slide }] }]}>
      {playerColumn}

      {/* Holds the queue at the bottom of the screen until it is pulled up. */}
      <View
        style={styles.gap}
        onLayout={(event) => {
          if (measuredFor.current === height) return;
          measuredFor.current = height;
          const gap = event.nativeEvent.layout.height;
          // What is left over plus what the queue is currently allowed: while
          // collapsed that is the artwork, and while open it is the queue's own
          // height, which the rotation has just made wrong.
          setQueueRoom((room) => gap + (expanded ? room : artSize));
        }}>
        {/*
          The same list as when it is open, only with less room. It was a
          separate, simpler component before — no covers, no scrolling, no
          dragging, and polling the player twice a second to stay current. One
          list in two sizes cannot drift from itself.
        */}
        {!expanded && <View style={StyleSheet.absoluteFill}>{queueList}</View>}
      </View>

      <View style={[styles.queue, { paddingBottom: insets.bottom }]}>
        <View style={styles.queueHandle} {...queueHandle.panHandlers}>
          <Pressable onPress={() => toggleQueue(!expanded)} style={styles.queueHandleHit}>
            <View style={styles.queueGrip} />
            <Text style={styles.queueLabel}>Up next · {queue.length}</Text>
          </Pressable>
        </View>

        <Animated.View style={{ height: queueHeight }}>{queueList}</Animated.View>
      </View>
      {settings}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  centered: { alignItems: 'center', justifyContent: 'center' },

  player: { paddingHorizontal: 20, paddingBottom: 12, gap: 16 },
  /*
    `minHeight: 0` on every one of these, not just the innermost.

    `flex: 1` lets a box shrink, but a flex item's implicit minimum is the size
    of its content, so a column of controls taller than the screen simply
    refuses to be squeezed and hangs off the bottom — which is what it did.
    Measured on the phone: the root came out 384 tall and the half inside it
    549. The minimum has to be lifted at every step between the screen and the
    artwork, because one link left at `auto` holds the whole chain open.
  */
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  playerHalf: { flex: 1, minHeight: 0, overflow: 'hidden' },
  queueHalf: {
    flex: 1,
    minHeight: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#242424',
  },
  queueHeading: { paddingTop: 14, paddingBottom: 6, textAlign: 'center' },
  queueFill: { flex: 1 },
  artWrapper: { alignItems: 'center', overflow: 'hidden' },
  // flexShrink alone is not enough: a child will not shrink below its content
  // unless its minimum is taken away as well.
  artWrapperWide: { flex: 1, minHeight: 0, alignSelf: 'stretch' },
  artLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Belt, braces, and a third: even given an impossible size the artwork stops
  // at the edge of the box holding it, so it can never push the controls down.
  art: { borderRadius: 12, maxWidth: '100%', maxHeight: '100%' },
  // Tighter than upright, where the gaps are the difference between fitting
  // and not on a short screen.
  playerWide: { flex: 1, minHeight: 0, gap: 8, paddingBottom: 18 },
  artEmpty: { backgroundColor: '#1c1c1c' },
  titles: { gap: 3, alignItems: 'center' },
  titleWide: { fontSize: 16 },
  artistWide: { fontSize: 12.5 },
  title: { color: '#ededed', fontSize: 19, fontWeight: '600' },
  // Underlined rather than coloured: it sits inside a line of ordinary text,
  // and a blue word in the middle of the subtitle reads as an error.
  albumLink: { textDecorationLine: 'underline' },
  artist: { color: '#7a7a7a', fontSize: 14 },
  error: { color: '#e08585', fontSize: 13, textAlign: 'center' },

  scrubHitArea: { paddingVertical: 10, justifyContent: 'center' },
  scrubTrack: { height: 3, borderRadius: 2, backgroundColor: '#2f2f2f', overflow: 'hidden' },
  scrubFill: { height: 3, backgroundColor: '#ededed' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#5f5f5f', fontSize: 11, fontVariant: ['tabular-nums'] },

  /*
    Five buttons, so the gaps are what gives. Three of them sat comfortably at
    thirty-six points apart and five at that spacing come to more than a narrow
    phone is wide — the row has no way to wrap and nowhere to scroll, so it
    would simply have run off both edges.
  */
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  transportWide: { gap: 10 },
  controlWide: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  control: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mode: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  gap: { flex: 1, overflow: 'hidden' },
  queue: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#242424' },
  queueHandle: { alignItems: 'center' },
  queueHandleHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    alignSelf: 'stretch',
  },
  queueGrip: { width: 36, height: 3, borderRadius: 2, backgroundColor: '#3a3a3a' },
  queueLabel: {
    color: '#5f5f5f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  muted: { color: '#7a7a7a', fontSize: 15 },
});
