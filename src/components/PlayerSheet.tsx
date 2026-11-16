import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { SleepCountdown } from './SleepCountdown';
import { HeartButton } from './Heart';
import { ShuffleButton } from './Shuffle';
import { optionsFit, transportFit } from '../lib/player/optionsFit';
import { GLORY_AT, moodOf, NO_RUN, pressed as pressedAt, type Mood } from '../lib/ui/heart';
import { flyingOf, linesOf, joinFlying, wordsOf, type Flying } from '../lib/ui/playerFun';
import { CoverFace } from './CoverFace';
import { BeatFeel, roomTaken, Spectrum, SpectrumStage, type Place } from './Spectrum';
import { FlyingWords, VinylFace, WaveTitle } from './PlayerFun';
import { useSpinner } from '../lib/ui/spinner';
import { useListButtonWanted } from '../lib/ui/listButton';
import { Image } from './Picture';
import { useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Pressable } from './Pressable';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  JumpIcon,
  LyricsIcon,
  ListAddIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  SettingsIcon,
  MarkAddIcon,
  MarksIcon,
  MoonIcon,
  TranslateIcon,
} from './Icons';
import { PlayerSettings } from './PlayerSettings';
import { PlayerTip } from './welcome/PlayerTip';
import { useT } from '../lib/i18n/index';
import { useCoveredByRoute } from '../lib/player/overlayRoutes';
import { LyricsView } from './LyricsView';
import { AutoplayDivider } from './AutoplayDivider';
import { QueueList } from './QueueList';
import { barsLaidOver } from './UnderBars';
import { CoverPage } from './CoverPage';
import { glassOf, glassPage } from '../lib/theme/Veil';
import { PlayerDiscoverSide, PlayerDiscoverUndo } from './discover/PlayingActions';
import { PlayerListenSide } from './listen/PlayerListenSide';
import { isDiscoverTrack } from './discover/show';
import { useFavoritesShown } from '../lib/playlists/favorites';
import { useTrackMenu } from './useTrackMenu';
import { creditReader } from '../lib/db/credits';
import { albumKey } from '../lib/media/albums';
import { foldForMatch } from '../lib/metadata/text';
import { useLyrics } from '../lib/lyrics/useLyrics';
import { jumpTo, stepFrom } from '../lib/player/jump';
import { scrubbing } from '../lib/player/scrub';
import { LeaveFirst } from './NameLinks';
import { setOwnTapeJump, tapeJumpsFor } from '../lib/tapes/settings';
import JukeboxAudio from '../../modules/jukebox-audio/index';
import { addMark, useMarks } from '../lib/tapes/marks';
import { chapterAt, readTranscript, useChapters, useTapeVideo, useTranscript, type Chapter } from '../lib/tapes/extras';
import { asLyrics } from '../lib/tapes/transcript';
import { ChaptersSheet } from './tapes/ChaptersSheet';
import { seriesOf } from '../lib/podcasts/series';
import { MarksSheet } from './tapes/MarksSheet';
import { TextPrompt } from './TextPrompt';
import { durationLabel } from '../lib/youtube/types';
import { readSetting, SETTINGS } from '../lib/db/index';
import { useBeatFeel, useCoverMotion, useSongLook, useTapeLook } from '../lib/ui/coverLook';
import { motionReduced } from '../lib/ui/motion';
import { useBack } from '../lib/ui/back';
import { haptic } from '../lib/ui/haptics';
import { useTrackArtwork } from '../lib/media/artwork';
import {
  usePlayerActions,
  playerPositionNow,
  usePlayerPosition,
  usePlayerState,
} from '../lib/player/PlayerProvider';
import { makeStyles, outlined, outlinedClip, page, ringed, useColours, usePressed } from '../lib/theme/index';
import { Behind } from '../lib/theme/Veil';
import { isTape } from '../lib/tapes/tape';
import { nextTapeSpeed, setTapeSpeed, tapeKeyOf } from '../lib/tapes/speed';
import type { Track } from '../lib/types';

/*
  How far outside its picture a transport button can still be pressed, which
  brings the smallest of them up to 48 either way without moving anything:
  the size Android asks a thing to be touched by. Kept under half the gap
  between two of them, so no two reach for the same spot — which sideways,
  where the gap is ten, holds them to forty-six across.
*/
const CONTROL_SLOP = { top: 4, bottom: 4, left: 2, right: 2 };
const CONTROL_SLOP_WIDE = { top: 8, bottom: 8, left: 5, right: 5 };

/**
 * The buttons, in one line or split into two of as near the same length as
 * there can be; or sideways, one under another down a column of their own.
 */
function optionRows(buttons: readonly (ReactNode | null)[], rows: 1 | 2, gap: number, down = false): ReactNode {
  const shown = buttons.filter((button) => button != null);
  if (down) return <View style={[optionsDown, { gap }]}>{shown}</View>;
  const line = (part: ReactNode[], key: string) => (
    <View key={key} style={[optionsLine, { gap }]}>
      {part}
    </View>
  );
  if (rows === 1) return line(shown, 'one');
  const half = Math.ceil(shown.length / 2);
  return [line(shown.slice(0, half), 'first'), line(shown.slice(half), 'second')];
}

const optionsLine = { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } as const;
const optionsDown = { alignItems: 'center', justifyContent: 'center' } as const;

/**
 * What a press of shuffle feels like, by how far into a run it is: the
 * phone's light click at first, then its heavy one, then two and three of
 * them in time with the shaking, and at the very end a burst as the songs
 * are thrown. Felt whether or not the decoration is held still: it is the
 * hand being answered, not the eye.
 */
function feel(mood: Mood): void {
  const tick = () => haptic('fun', 'tick');
  const thump = () => haptic('fun', 'heavy');
  const beats = (count: number, every: number) => {
    thump();
    for (let at = 1; at < count; at += 1) setTimeout(thump, at * every);
  };
  if (mood === 'one' || mood === 'flurry') tick();
  else if (mood === 'storm') thump();
  else if (mood === 'frenzy') beats(2, 105);
  else beats(4, 70);
}

/**
 * The longest the record goes on after the last press of repeat. At the
 * fastest it runs down in about eight seconds, and is stopped here if it has
 * somehow not.
 */
const RECORD_LIMIT_MS = 11000;

/** How long a press of pause holds what moves with the music still before the player has said it stopped. */
const STOPPING_MS = 1500;

/** How far the repeat button turns at a press, and how much a press adds to the record's speed in turns a second, by how far into a run it is. */
const RECORD_TURNS: Record<Mood, { button: number; record: number }> = {
  one: { button: 0.5, record: 0 },
  flurry: { button: 1, record: 0.25 },
  storm: { button: 1, record: 0.35 },
  frenzy: { button: 1.5, record: 0.45 },
  glory: { button: 2, record: 0.6 },
};

/**
 * What a press of repeat feels like: the player's own switch at first, and
 * once a run is under way a ratchet, the faster the further in, and at the
 * very height of it a run of clicks all the way round the screen.
 */
function feelRepeat(mood: Mood, turningOn: boolean): void {
  if (mood === 'one') return haptic('player', turningOn ? 'toggleOn' : 'toggleOff');
  const clicks = (count: number, every: number, last: 'tick' | 'heavy' = 'tick') => {
    for (let at = 0; at < count; at += 1) setTimeout(() => haptic('fun', at === count - 1 ? last : 'tick'), at * every);
  };
  if (mood === 'flurry') clicks(2, 70);
  else if (mood === 'storm') clicks(3, 55);
  else if (mood === 'frenzy') clicks(4, 45);
  else clicks(10, 95, 'heavy');
}

/**
 * What a press of the lyrics button feels like: the player's tick at first,
 * then the keys of a typewriter, and at the very height of a run its bell.
 */
function feelLyrics(mood: Mood): void {
  if (mood === 'one') return haptic('player', 'tick');
  const keys = (count: number) => {
    for (let at = 0; at < count; at += 1) setTimeout(() => haptic('fun', 'tick'), at * 60);
  };
  if (mood === 'flurry') keys(1);
  else if (mood === 'storm') keys(2);
  else if (mood === 'frenzy') keys(3);
  else {
    keys(3);
    setTimeout(() => haptic('fun', 'double'), 200);
  }
}

/** How far the queue and the screen shake at a press of shuffle, in times a nudge, by how far into a run it is. */
const SHAKE: Record<Mood, { queue: number; screen: number }> = {
  one: { queue: 1, screen: 0 },
  flurry: { queue: 1.4, screen: 0 },
  storm: { queue: 2, screen: 0.5 },
  frenzy: { queue: 2.8, screen: 1.5 },
  glory: { queue: 3.5, screen: 2.6 },
};

/** The two points that take the round buttons under the transport from 44 to 48. */
const MODE_SLOP = 2;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** How often the time under the finger is redrawn while scrubbing. */
const LABEL_INTERVAL_MS = 100;

/*
  The bar is drawn three points thick in a strip twenty-odd tall, and that
  strip was all a finger had to land on. Reaching further above and below
  makes it a finger's height to aim at without moving anything on screen.
*/
const SCRUB_SLOP = { top: 13, bottom: 13 };

/** What a screen reader may ask of the bar: a step on and a step back. */
const ADJUST = [{ name: 'increment' }, { name: 'decrement' }];

/** A speed as the tape's button shows it: `1×`, `1.2×`, `1.75×`. */
function speedLabel(speed: number): string {
  return `${Math.round(speed * 100) / 100}×`;
}

/**
 * Under a tape's bar, for one in parts: how far into the whole of it, and
 * how long is left of it, from the parts' lengths and where this one has got.
 */
function TapeWhole({ live, parts, at }: { live: boolean; parts: readonly Track[]; at: number }) {
  const styles = useStyles();
  const t = useT();
  const { positionSec } = usePlayerPosition(live);
  const lengths = parts.map((part) => Math.max(0, part.durationSec || 0));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return null;
  const done = lengths.slice(0, at).reduce((sum, length) => sum + length, 0) + Math.min(positionSec, lengths[at] ?? 0);
  const percent = Math.min(100, Math.round((done / total) * 100));
  const minutes = Math.max(0, Math.round((total - done) / 60));
  const left = minutes >= 60
    ? `${t.common.hours(Math.floor(minutes / 60))} ${t.common.minutes(minutes % 60)}`
    : t.common.minutes(Math.max(1, minutes));
  return <Text style={styles.tapeWhole} numberOfLines={1}>{t.player.tape.book(percent, left)}</Text>;
}

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
  step,
  onSeek,
  remaining = false,
  marks,
  chapters,
  middle,
}: {
  /** Between the two times: the sleep timer counting down, where one is set. */
  middle?: ReactNode;
  positionSec: number;
  durationSec: number;
  /** Places marked in it, in seconds, shown as ticks on the bar: a tape's. */
  marks?: readonly number[];
  /** Where its chapters begin, in seconds, shown as fine breaks in the bar: a tape's. */
  chapters?: readonly number[];
  /** What is left at the right end, for a tape, rather than how long it is. */
  remaining?: boolean;
  /** How far one swipe of a screen reader moves, in seconds: the player's own jump. */
  step: number;
  onSeek: (seconds: number) => void;
}) {
  const styles = useStyles();
  const t = useT();
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
  /**
   * Where the finger last was, from the moment it came down. The gesture's
   * own `moveX` is nought until the finger moves, so a tap that never moved
   * read as a press at the very left of the screen, and sent the track back
   * to its start.
   */
  const fingerX = useRef(0);
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
      // And to what follows the time under the finger as it goes: see `scrub.ts`.
      scrubbing.set(fraction * durationRef.current);
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
      scrubbing.set(seconds);
      scrubbing.set(null);
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
        fingerX.current = event.nativeEvent.pageX;
        move(event.nativeEvent.pageX);
      },
      onPanResponderMove: (_event, gesture) => {
        fingerX.current = gesture.moveX;
        move(gesture.moveX);
      },
      onPanResponderRelease: (_event, gesture) => {
        // Felt as the finger lets go, which is when the song moves; never
        // while it is dragged, which would be a buzz the length of the bar.
        haptic('player', 'tick');
        // A tap never moved, so it ends where it began and seeks there.
        finish(clamp((fingerX.current - originX.current) / (widthRef.current || 1)));
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        setScrubbed(null);
        scrubbing.set(null);
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

  /*
    For a screen reader the bar is one control that says where the track has
    got to and moves by a step when swiped, since a finger dragging along it
    is the one thing such a reader cannot do.

    What it says is rounded down to five seconds. The position arrives four
    times a second, and a value that changed every time would be read out
    again and again for as long as the bar had the reader's attention.
  */
  const heard = scrubbed ?? Math.floor(positionSec / 5) * 5;
  const stepTo = (direction: 1 | -1) => {
    if (durationSec <= 0) return;
    const seconds = Math.min(Math.max(positionSec + direction * step, 0), durationSec);
    settling.current = { seconds, since: Date.now() };
    filled.setValue(clamp(seconds / durationSec));
    onSeek(seconds);
  };

  return (
    <View>
      <View
        style={styles.scrubHitArea}
        hitSlop={SCRUB_SLOP}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t.player.sheet.position}
        accessibilityValue={{
          min: 0,
          max: Math.max(0, Math.round(durationSec)),
          now: Math.min(Math.round(heard), Math.max(0, Math.round(durationSec))),
          text: t.player.sheet.positionValue(formatTime(heard), formatTime(durationSec)),
        }}
        accessibilityActions={ADJUST}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') stepTo(1);
          else if (event.nativeEvent.actionName === 'decrement') stepTo(-1);
        }}
        {...panResponder.panHandlers}>
        {/*
          Never what a finger lands on, so that where it lands is measured
          against the bar itself. The fill is slid along by however much has
          played, and a press caught by it was measured against wherever it
          had been slid to: early in a tape, a press near the start sent it
          near the end.
        */}
        <View style={styles.scrubTrack} pointerEvents="none">
          <Animated.View
            style={[styles.scrubFill, { width, transform: [{ translateX: slide }] }]}
          />
        </View>
        {/* Breaks in the bar where a chapter begins, finer than a mark, which is somebody's own. */}
        {chapters && chapters.length > 1 && durationSec > 0 ? (
          <View style={styles.marks} pointerEvents="none" importantForAccessibility="no-hide-descendants">
            {chapters.slice(1).map((at, index) => (
              <View key={index} style={[styles.chapterBreak, { left: `${clamp(at / durationSec) * 100}%` }]} />
            ))}
          </View>
        ) : null}
        {/* Over the bar and taller than it, so a mark shows on the part heard as well as on the part to come. */}
        {marks && marks.length > 0 && durationSec > 0 ? (
          <View style={styles.marks} pointerEvents="none" importantForAccessibility="no-hide-descendants">
            {marks.map((at, index) => (
              <View key={index} style={[styles.mark, { left: `${clamp(at / durationSec) * 100}%` }]} />
            ))}
          </View>
        ) : null}
      </View>
      {/* Said by the bar itself to a screen reader; see above. */}
      <View style={styles.times}>
        <Text style={styles.time} importantForAccessibility="no">{formatTime(scrubbed ?? positionSec)}</Text>
        {middle}
        <Text style={styles.time} importantForAccessibility="no">
          {remaining ? `−${formatTime(Math.max(0, durationSec - (scrubbed ?? positionSec)))}` : formatTime(durationSec)}
        </Text>
      </View>
    </View>
  );
}

/*
  The two things on the sheet that show where the track has got to, each
  following the position for itself.

  The sheet used to follow it and hand it down, and so was drawn again from
  the top four times a second for as long as it was open -- under a pushed
  route as well, where none of it could be seen. `live` is false there, and
  nothing is asked of the player at all.
*/
function LiveScrubber({
  live,
  fileDurationSec,
  step,
  onSeek,
  remaining,
  marks,
  chapters,
  middle,
}: {
  live: boolean;
  middle?: ReactNode;
  remaining?: boolean;
  marks?: readonly number[];
  chapters?: readonly number[];
  step: number;
  /** The file's own length, until the player reports one: it cannot before the track is prepared. */
  fileDurationSec: number;
  onSeek: (seconds: number) => void;
}) {
  const { positionSec, durationSec } = usePlayerPosition(live);
  return (
    <Scrubber
      positionSec={positionSec}
      durationSec={durationSec || fileDurationSec}
      step={step}
      onSeek={onSeek}
      remaining={remaining}
      marks={marks}
      chapters={chapters}
      middle={middle}
    />
  );
}

/**
 * The chapter a tape is in, over its bar, following the position for
 * itself as the bar does: which of how many, and what it is called. Pressed,
 * the chapters are listed.
 */
function LiveChapter({ live, chapters, onPress }: { live: boolean; chapters: readonly Chapter[]; onPress: () => void }) {
  const styles = useStyles();
  const t = useT();
  const pressed = usePressed();
  const { positionSec } = usePlayerPosition(live);
  const at = Math.max(0, chapterAt(chapters, positionSec));
  const title = chapters[at]?.title || t.player.chapters.untitled(at + 1);
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityHint={t.player.chapters.listHint}
      hitSlop={6}
      style={styles.chapter}
      onPress={onPress}>
      <Text style={styles.chapterText} numberOfLines={1}>
        {`${t.player.chapters.at(at + 1, chapters.length)} · ${title}`}
      </Text>
      <Text style={styles.chapterChevron} importantForAccessibility="no">›</Text>
    </Pressable>
  );
}

function LiveLyrics({ live, ...rest }: { live: boolean } & Omit<ComponentProps<typeof LyricsView>, 'positionSec'>) {
  const { positionSec } = usePlayerPosition(live);
  return <LyricsView {...rest} positionSec={positionSec} />;
}

/**
 * The now-playing screen, drawn over the library rather than routed to.
 *
 * Routing to it meant the library was not rendered while it was open, so
 * dragging the player down uncovered black and the list only reappeared once
 * the navigation transition had finished. As a layer above the same tree, the
 * library is genuinely behind it and shows through the moment the drag starts.
 */
/** How long what the list picker did stays said over the player's buttons. */
const ADDED_FOR_MS = 2600;

export function PlayerSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  /** One colour, lit or not: the whole of what these buttons say about state. */
  // One setting for Favorites and the heart that fills it: see `playlists/favorites.ts`.
  const heart = useFavoritesShown();
  /**
   * What the list picker did, said for a moment over the row of buttons:
   * the player has no line of its own for news, and a list gaining a song
   * otherwise happens without a word.
   */
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), ADDED_FOR_MS);
    return () => clearTimeout(timer);
  }, [added]);
  const ON = c.text;
  const OFF = c.textDisabled;
  const { current, currentIndex, queue, isPlaying, playWhenReady, repeat, speed, pitch, error, autoFrom } =
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
    removePicked,
  } = usePlayerActions();
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
  /*
    The pause button just pressed, and the player not yet heard to have
    stopped: it is asked what it is doing and then told to stop, and says it
    has a few hundredths of a second later, all of which a record went on
    turning through and then went back over. What moves with the music stops
    with the press. Forgotten once the player says it has stopped, or after a
    moment if it never does, so that nothing is left standing still while a
    song plays.
  */
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    if (!stopping) return;
    if (!isPlaying) {
      setStopping(false);
      return;
    }
    const timer = setTimeout(() => setStopping(false), STOPPING_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, stopping]);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  /** The sleep timer on its own, from a tape's button for it. */
  const [sleepOpen, setSleepOpen] = useState(false);
  // A tape's marks: the place a new one is being noted at, and whether its list is up.
  /** The place being marked, and in which tape: the one playing when Mark was pressed, should it have gone on to the next part while the note is written. */
  const [marking, setMarking] = useState<{ trackId: string; at: number } | null>(null);
  const markingAt = marking?.at ?? null;
  const [marksOpen, setMarksOpen] = useState(false);
  const markList = useMarks(current && isTape(current) ? current.id : null);
  // A tape's chapters, where it has some: see `tapes/extras.ts`.
  const chapterList = useChapters(current && isTape(current) ? current.id : null);
  const tapeVideo = useTapeVideo(current && isTape(current) ? current.id : null);
  const transcript = useTranscript(current && isTape(current) ? current.id : null);
  // What the lyrics view is handed for a tape: its captions as timed words, or none.
  const transcriptState = useMemo(() => {
    const words = transcript.lines ? asLyrics(transcript.lines) : null;
    return {
      looking: transcript.looking,
      lyrics: words ? { ...words, fetchedAt: 0, source: 'manual' as const, offsetMs: 0 } : null,
    };
  }, [transcript]);
  const chapterStarts = useMemo(() => chapterList.map((chapter) => chapter.startSec), [chapterList]);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const markTimes = useMemo(() => markList.map((mark) => mark.positionSec), [markList]);
  const [showLyrics, setShowLyrics] = useState(false);
  // A tape's captions in place of its picture, as a song's words are: see `tapes/extras.ts`.
  const [showTranscript, setShowTranscript] = useState(false);
  /** The width the row of buttons under the controls has to itself, once laid out: see `optionsFit`. */
  const [optionsWidth, setOptionsWidth] = useState(0);
  /** How the transport is drawn: full size until it is found not to fit, and then closer and smaller until it does. See `transportFit`. */
  const [squeeze, setSqueeze] = useState<{ gap: number | null; scale: number }>({ gap: null, scale: 1 });
  const transportRoom = useRef(0);
  // Off until asked for: the first translation into a language fetches a model
  // of some thirty megabytes, which is not something to spend unbidden.
  const [showTranslation, setShowTranslation] = useState(false);
  const grow = useRef(new Animated.Value(0)).current;
  /*
    Shuffle is a thing done, not a mode left on: each press deals the queue
    again. So the button does not stay lit. It lights up for a moment and
    turns as it deals, and the list shakes once as its songs change places,
    and then the button is as it was. Nought to one, once for each press.
  */
  const dealt = useRef(new Animated.Value(1)).current;
  /*
    How hard the queue shakes, and the whole screen with it, by how far into a
    run of presses this one is (see `Shuffle.tsx`): once, a nudge; kept up, the
    screen itself goes, and at the height of it goes properly.
  */
  const queueShakes = useRef(new Animated.Value(1)).current;
  const screenShakes = useRef(new Animated.Value(0)).current;
  /** At the very end of a run, the songs thrown all over and, within the second, back in their places. */
  const scatter = useRef(new Animated.Value(0)).current;
  /** The queue and the screen shaken as hard as [mood] says: shuffle's, and the repeat button's from a storm on. */
  const shakeFor = (mood: Mood) => {
    queueShakes.setValue(SHAKE[mood].queue);
    screenShakes.setValue(SHAKE[mood].screen);
    dealt.stopAnimation();
    dealt.setValue(0);
    Animated.timing(dealt, { toValue: 1, duration: mood === 'one' ? 520 : 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const deal = (mood: Mood) => {
    feel(mood);
    if (motionReduced()) return;
    shakeFor(mood);
    if (mood !== 'glory') return;
    scatter.stopAnimation();
    Animated.sequence([
      Animated.timing(scatter, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(120),
      Animated.spring(scatter, { toValue: 0, friction: 6, tension: 70, useNativeDriver: true }),
    ]).start();
    // And a click as everything is back in its place.
    setTimeout(() => haptic('fun', 'tick'), 760);
  };
  const shake = dealt.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], outputRange: [0, -14, 11, -8, 5, -2, 0] });
  const dealtShake = Animated.multiply(shake, queueShakes);
  const screenShake = Animated.multiply(shake, screenShakes);
  const screenTilt = screenShake.interpolate({ inputRange: [-50, 50], outputRange: ['-5deg', '5deg'] });

  /*
    The repeat button pressed again and again: the button turning one way
    and the other, then the cover turned into a record that spins the faster
    for every press and runs down when they stop, and at the very height of
    a run the whole screen turned round. Turning and nothing else: the shaking
    is the shuffle button's. Each press goes round the modes as it always does.
  */
  const repeatRun = useRef(NO_RUN);
  const repeatTurn = useRef(new Animated.Value(0)).current;
  const [vinyl, setVinyl] = useState(false);
  const vinylOff = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The record and, at the height of a run, the screen: each press adds to how fast they turn, and they run down by themselves.
  const { value: record, kick: kickRecord, stop: stopRecord } = useSpinner(() => {
    vinylOff.current = setTimeout(() => setVinyl(false), 400);
  });
  const { value: screenTurn, kick: kickScreen, stop: stopScreen } = useSpinner();
  /*
    However the running down goes, the record is a cover again and the screen
    upright a while after the last press: a run down that is lost on the way,
    as an animation is when the cover is taken off the screen in the middle of
    it, never says it has stopped, and the cover stayed a record.
  */
  const recordLimit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRepeat = () => {
    const next = pressedAt(repeatRun.current, Date.now());
    repeatRun.current = next;
    const mood = moodOf(next);
    feelRepeat(mood, repeat !== 'one');
    if (motionReduced()) return;
    repeatTurn.stopAnimation();
    repeatTurn.setValue(0);
    Animated.timing(repeatTurn, {
      toValue: (next.count % 2 === 0 ? -1 : 1) * RECORD_TURNS[mood].button,
      duration: 480,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    if (mood === 'one') return;
    setVinyl(true);
    if (vinylOff.current) clearTimeout(vinylOff.current);
    kickRecord(RECORD_TURNS[mood].record);
    if (mood === 'glory') kickScreen(0.35);
    if (recordLimit.current) clearTimeout(recordLimit.current);
    recordLimit.current = setTimeout(() => {
      stopRecord();
      stopScreen();
      setVinyl(false);
    }, RECORD_LIMIT_MS);
  };
  const repeatIconTurn = repeatTurn.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'], extrapolate: 'extend' });
  const recordTurn = record.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });
  const screenRound = screenTurn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });

  /*
    The lyrics button pressed again and again: the button wobbling, then
    words of the song rising off it, then the song's name waving, and at the
    very height of a run lines of the song falling over everything. Each
    press opens or closes the words as it always does.
  */
  const lyricsRun = useRef(NO_RUN);
  const lyricsWobble = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null);
  const waveOff = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waving, setWaving] = useState(false);
  const [flying, setFlying] = useState<Flying[]>([]);
  const lyricsButton = useRef<View | null>(null);
  /** Where the lyrics button is on the screen, found as it is laid out and again at each press. */
  const buttonAt = useRef({ x: 0, y: 0 });
  const measureButton = () =>
    lyricsButton.current?.measureInWindow((x, y, wide) => {
      buttonAt.current = { x: x + wide / 2 - 20, y: y - 10 };
    });
  const heardWords = useRef<{ id: string; lyrics: { plain: string | null; synced: string | null } } | null>(null);
  const pressLyrics = () => {
    const next = pressedAt(lyricsRun.current, Date.now());
    lyricsRun.current = next;
    const mood = moodOf(next);
    feelLyrics(mood);
    if (motionReduced()) return;
    lyricsWobble.stopAnimation();
    lyricsWobble.setValue(0);
    Animated.timing(lyricsWobble, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    if (mood === 'one' || !current) return;
    // From where the button was found to be beforehand: a run of presses is quicker than asking.
    const from = buttonAt.current;
    measureButton();
    // The words last read for this song: closed again by the very press that let these go, they are not read now.
    const known = heardWords.current?.id === current.id ? heardWords.current.lyrics : lyrics.lyrics;
    const words = wordsOf(known, current.title, current.artist);
    const lines = linesOf(known);
    const let_go = flyingOf(next, mood, next.count === GLORY_AT, words, lines).map((item) => ({ ...item, from }));
    setFlying((now) => joinFlying(now, let_go));
    if (mood === 'flurry') return;
    setWaving(true);
    if (!waveLoop.current) {
      wave.setValue(0);
      waveLoop.current = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true }));
      waveLoop.current.start();
    }
    if (waveOff.current) clearTimeout(waveOff.current);
    waveOff.current = setTimeout(() => {
      waveLoop.current?.stop();
      waveLoop.current = null;
      setWaving(false);
    }, 1800);
  };
  const landed = (key: string) => setFlying((now) => now.filter((item) => item.key !== key));
  const lyricsWobbleTurn = lyricsWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-14deg', '11deg', '-6deg', '0deg'] });
  useEffect(
    () => () => {
      if (vinylOff.current) clearTimeout(vinylOff.current);
      if (recordLimit.current) clearTimeout(recordLimit.current);
      if (waveOff.current) clearTimeout(waveOff.current);
      waveLoop.current?.stop();
    },
    []
  );
  const flyingLayer =
    flying.length > 0 ? <FlyingWords items={flying} origin={buttonAt.current} ink={c.text} accent={c.accent} onLanded={landed} /> : null;
  // The cover and the name thrown off with the songs, each its own way, and back.
  const artThrown = [
    { translateX: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
    { translateY: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) },
    { rotate: scatter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] }) },
    { scale: scatter.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) },
  ];
  const titleThrown = [
    { translateX: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }) },
    { translateY: scatter.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) },
    { rotate: scatter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '16deg'] }) },
  ];
  const dealtFade = dealt.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 0.45, 1] });

  // Only asked for once the panel is open. Every track change would otherwise
  // send LRCLIB a request for words nobody is going to read.
  // A tape has no words to look up, whatever was left switched on from a song.
  const wordsWanted = showLyrics && !(current && isTape(current));
  const lyrics = useLyrics(current, wordsWanted);
  // Kept for the lyrics button's run of presses, which closes them again as often as it opens them.
  useEffect(() => {
    if (current && lyrics.lyrics) heardWords.current = { id: current.id, lyrics: lyrics.lyrics };
  }, [current, lyrics.lyrics]);

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
    Neither way round is the queue's heading a bar of glass with the list
    running on under it. Upright its handle is just the grip and its words,
    with the lists above and below it and nothing passing under: a band of
    glass went with the queue into the middle of the screen when it was pulled
    up. Sideways the band stood in the top corner of the screen, a patch of
    another colour beside the player; the words now stand over the list and
    the list starts under them.
  */
  const queueOver = barsLaidOver(c);

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
      // Straight there where the decoration is to hold still: the queue opening
      // is news enough without being shown arriving.
      if (motionReduced()) {
        grow.setValue(next ? 1 : 0);
        return;
      }
      Animated.timing(grow, {
        toValue: next ? 1 : 0,
        duration: 220,
        // Height cannot be driven natively, and this runs once per gesture.
        useNativeDriver: false,
      }).start();
    },
    [grow]
  );

  // For the handle's drag, which is built once and would otherwise feel a
  // drag towards where the queue already is as if it had moved it.
  const expandedNow = useRef(expanded);
  useEffect(() => {
    expandedNow.current = expanded;
  }, [expanded]);

  const queueHandle = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_event, gesture) => {
          const wanted = gesture.dy < -30 ? true : gesture.dy > 30 ? false : null;
          if (wanted === null) return;
          if (wanted !== expandedNow.current) haptic('holds', 'tick');
          toggleQueue(wanted);
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
  // Whether the drag is far enough down to put the player away if let go,
  // felt once on the way past and again only after coming back above it.
  const pastClosing = useRef(false);
  const dismiss = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          pastClosing.current = false;
        },
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) slide.setValue(gesture.dy);
          const past = gesture.dy > 120;
          if (past !== pastClosing.current) {
            pastClosing.current = past;
            if (past) haptic('holds', 'tick');
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          // Far enough, or thrown hard enough, counts as putting it away.
          // The drag itself followed the finger, which is not decoration; what
          // happens after the finger lets go is, and holds still if asked to.
          const still = motionReduced();
          if ((gesture.dy > 120 || gesture.vy > 0.9) && still) {
            onClose();
          } else if (still) {
            slide.setValue(0);
          } else if (gesture.dy > 120 || gesture.vy > 0.9) {
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
          if (motionReduced()) slide.setValue(0);
          else Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
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
  const songLook = useSongLook();
  const tapeLook = useTapeLook();
  const coverMotion = useCoverMotion();
  const beatFeel = useBeatFeel();
  // Where what stands where the cover is is, for the sparks, the clouds and a breath's glow drawn the size of the player.
  const [stagePlace, setStagePlace] = useState<Place | null>(null);
  // The player's own screen, which the sparks and the clouds are laid over and the cover is measured in.
  const playerRoot = useRef<View>(null);
  /*
    Each of what opens inside the player is closed before the player is: the
    playback panel, the words, the queue pulled up over the cover — whichever
    was opened last first, as the back key does everywhere (`ui/back.ts`).
  */
  useBack(!covered, onClose);
  useBack(!covered && expanded, () => toggleQueue(false));
  useBack(!covered && wordsWanted, () => setShowLyrics(false));
  useBack(!covered && showTranscript && current != null && isTape(current), () => setShowTranscript(false));
  useBack(!covered && playbackOpen, () => setPlaybackOpen(false));
  useBack(!covered && sleepOpen, () => setSleepOpen(false));

  /*
    The menu of a row in the queue. Nothing to read again afterwards: the
    queue is the player's, and an erased file is taken out of it by the menu.

    Registered after the handler above, so with the list picker up it is the
    picker a back press closes and not the player under it.

    The entries that go to another screen close the player first, for the
    reason the album's name under the title does.
  */
  const menu = useTrackMenu({
    beforeLeaving: onClose,
    onAdded: (message) => {
      haptic('results', 'confirm');
      setAdded(message);
    },
  });
  /** Whether the add-to-list button is wanted: Settings → Player. */
  const listButton = useListButtonWanted();

  const onSeek = useCallback((seconds: number) => void seekTo(seconds), [seekTo]);

  /*
    A screen reader's attention is taken to the name of what is playing as the
    player opens. It is drawn over the library rather than navigated to, so
    nothing else would move it: the reader would be left on the bar it was
    opened from, which is now underneath, and the first swipe would go nowhere
    anybody could see. Asked for once the player has had time to rise.
  */
  const titleRef = useRef<Text>(null);
  useEffect(() => {
    const later = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }, 450);
    return () => clearTimeout(later);
  }, []);

  /*
    Read once, as the player opens. It is a setting rather than a state, and
    this component is built afresh every time the sheet is raised — so the only
    moment it could be stale is one in which the screen it is changed on was
    open instead of this one.
  */
  const [step] = useState(() => stepFrom(readSetting(SETTINGS.jumpSeconds)));
  /*
    A tape's own: its book's or show's, where it was given them in the sheet
    behind the gear, or else the tape settings' (`tapes/settings.ts`). Read
    again when the tape playing is of another book, and when changed here.
  */
  const stepKey = current != null && isTape(current) ? tapeKeyOf(current) : null;
  const [tapeStep, setTapeStep] = useState(() => ({ key: stepKey, ...tapeJumpsFor(stepKey) }));
  if (tapeStep.key !== stepKey) setTapeStep({ key: stepKey, ...tapeJumpsFor(stepKey) });
  const jump = useCallback(
    (by: number) => {
      // Asked for at the press, since nothing here follows the position:
      // the bar below does, and what it last read is what this starts from.
      const { positionSec, durationSec } = playerPositionNow();
      void seekTo(jumpTo(positionSec, by, durationSec || current?.durationSec || 0));
    },
    [current?.durationSec, seekTo]
  );

  const album = current?.album?.trim() || null;
  /*
    Who the credit names, one by one. Read through the same reader the Artists
    view groups by, so a name pressed here is a page that exists there. Not the
    guests a title names: this line shows what the artist tag says, and a name
    appearing in it that the tag does not hold would look like an edit.
  */
  const credit = current?.artist?.trim() || null;
  const credited = useMemo(() => {
    if (!credit) return [];
    const names = creditReader()({ artist: credit, title: null }).filter(
      (name) => foldForMatch(name).length > 0
    );
    return names.length > 0 ? names : [credit];
  }, [credit]);

  if (!current) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>{t.player.sheet.nothingPlaying}</Text>
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
    A tape is played another way: see `lib/tapes`. Its parts are the tapes of
    the queue from its folder, which is its book or its show; no shuffle,
    repeat, heart, list or lyrics, which are a song's; longer jumps, made for
    a voice; and its speed and the sleep timer to hand.
  */
  const tape = isTape(current);
  const tapeKey = tape ? tapeKeyOf(current) : null;
  // What stands where the cover is: the cover, or the record or the cassette it is the label of.
  const face = tape ? (tapeLook === 'cassette' ? 'cassette' : null) : songLook === 'record' ? 'record' : null;
  // And what moves with the music over it, while it plays and is in sight; nothing at all otherwise.
  const still = motionReduced();
  const moving = isPlaying && !stopping && !covered && !still;
  const parts = tape ? queue.filter((entry) => tapeKeyOf(entry) === tapeKey) : [];
  const partAt = parts.findIndex((entry) => entry.id === current.id);
  // An episode of a followed show is one of its episodes, not a part of a book.
  const series = tape && seriesOf(current) != null;
  const back = tape ? tapeStep.back : step;
  const forward = tape ? tapeStep.forward : step;
  // A song's words, or a tape's captions where it has a video to have them from.
  const lyricsShown = tape ? showTranscript && tapeVideo != null : showLyrics;
  const wordsShown = tape ? transcriptState : lyrics;

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
  /*
    The transport at full size where it fits, and where it does not, the gaps
    between its buttons closed first and then the whole row drawn smaller,
    rather than its two ends cut off by the screen's.
  */
  const transportGap = landscape ? 10 : 18;
  const squeezeGap = squeeze.gap ?? transportGap;
  const skipIcon = Math.round((landscape ? 20 : 24) * squeeze.scale);
  const playIcon = Math.round((landscape ? 27 : 32) * squeeze.scale);
  const modeIcon = landscape ? 18 : 21;
  /** How many buttons the row has: four always, and the two that Settings can add. */
  /*
    Not for a song of Discover's, which is not the library's until it is kept,
    and so cannot be one of its Favorites: the menu leaves it out too.
  */
  const hearted = heart && current != null && !isDiscoverTrack(current.id);
  // A tape's five, and its captions where it has a video to have them from: its speed, the sleep timer, a mark, its marks and the settings.
  const optionCount = tape ? 5 + (tapeVideo != null ? 1 : 0) : 4 + (listButton && current ? 1 : 0) + (hearted ? 1 : 0);
  /*
    Worked out on each drawing rather than kept with a hook: this is below the
    return for nothing playing, and a hook there is one more on some drawings
    than on others, which React cannot follow. It is a few sums.
  */
  // Sideways, down a column of their own, they are never short of room.
  const laid = optionsFit(landscape ? OPTIONS_ROOMY : optionsWidth, optionCount, modeIcon);
  const fit = {
    ...laid,
    button: [styles.mode, { minWidth: laid.size, minHeight: laid.size, borderRadius: laid.size / 2 }],
    slop: Math.max(MODE_SLOP, Math.round((48 - laid.size) / 2)),
  };

  /*
    Translating the words, on the words themselves: in the corner of where
    they are shown, and only while there are words to translate. In the row under the controls it
    came and went with them, and moved every button there each time.
  */
  const translateToggle = (
    <Pressable
      android_ripple={pressed}
      style={[styles.translate, showTranslation && styles.translateOn]}
      accessibilityRole="button"
      hitSlop={6}
      accessibilityLabel={t.player.sheet.translateLyrics}
      accessibilityState={{ selected: showTranslation }}
      onPress={() => {
        haptic('player', 'tick');
        setShowTranslation(!showTranslation);
      }}>
      <TranslateIcon size={18} color={showTranslation ? ON : OFF} />
    </Pressable>
  );
  const control = [
    landscape ? styles.controlWide : styles.control,
    squeeze.scale < 1 && { paddingHorizontal: Math.round((landscape ? 8 : 10) * squeeze.scale) },
  ];
  // Sideways the buttons are drawn smaller to fit; they are not any harder to
  // aim for than they were, only to see.
  const controlSlop = landscape ? CONTROL_SLOP_WIDE : CONTROL_SLOP;

  /*
    Sideways the artwork takes all the height the controls under it leave:
    the buttons that are not playing it stand down a column of their own
    beside the player (see `optionsPart`), and the room they took under the
    controls is the artwork's.
  */
  const wideArt = Math.max(0, Math.min(artBox.width, artBox.height));

  const faceSize = (landscape ? wideArt : artSize) - (still ? 0 : roomTaken(coverMotion));
  /*
    Round what stands there and over it, where a motion is wanted; as it is
    otherwise. What goes out from its edge is given room inside the box the
    artwork has, which cuts off whatever reaches past it: the artwork is that
    much smaller.
  */
  const withMotion = (held: 'cover' | 'record' | 'cassette', what: ReactNode) =>
    coverMotion === 'none' || still ? (
      what
    ) : (
      <Spectrum motion={coverMotion} face={held} size={faceSize} active={moving} accent={c.accent} onPlace={setStagePlace} placeIn={playerRoot} trackId={current.id}>
        {what}
      </Spectrum>
    );
  /*
    The clouds and a breath's glow behind the whole player and the sparks over
    it, about the cover; not while the words stand where the cover was, nor
    the glow while the queue is pulled up over it. And the knock on each beat,
    where it is asked for.
  */
  const staged =
    !still &&
    !lyricsShown &&
    (coverMotion === 'sparks' || coverMotion === 'aurora' || (coverMotion === 'breathe' && (landscape || !expanded)))
      ? coverMotion
      : null;
  const stage = (where: 'behind' | 'over') =>
    staged != null && (staged === 'sparks') === (where === 'over') ? (
      <SpectrumStage motion={staged} place={stagePlace} active={moving} accent={c.accent} trackId={current.id} />
    ) : null;
  const beats = beatFeel && !still ? <BeatFeel active={moving} /> : null;

  // The fold-away only exists in the stacked layout; beside the queue the
  // artwork has its own column and never has to give it up.
  const artHeight = landscape
    ? artSize
    : grow.interpolate({ inputRange: [0, 1], outputRange: [artSize, 0] });
  const artOpacity = landscape
    ? 1
    : grow.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0] });
  const queueHeight = grow.interpolate({ inputRange: [0, 1], outputRange: [0, queueRoom] });

  const openBox = { height: queueHeight };

  const queueListWith = (inset: number, foot = 0) => (
    <Animated.View style={[styles.dealt, { opacity: dealtFade, transform: [{ translateX: dealtShake }] }]}>
    {/* An artist's name in a row leads to them, the player put away first. */}
    <LeaveFirst value={onClose}>
    <QueueList
      inset={inset}
      foot={foot}
      queue={queue}
      scatter={scatter}
      currentIndex={currentIndex}
      onSelect={(index) => void skipToIndex(index)}
      onMove={(from, to) => void moveInQueue(from, to)}
      onRemove={(index) => void removeFromQueue(index)}
      onLongPress={(index) => {
        const track = queue[index];
        if (track) menu.open(track);
      }}
      divider={
        autoFrom >= 0 && autoFrom < queue.length
          ? {
              at: autoFrom,
              element: (
                <AutoplayDivider
                  ids={queue.slice(autoFrom).map((track) => track.id)}
                  onRemove={() => void removePicked()}
                />
              ),
            }
          : undefined
      }
    />
    </LeaveFirst>
    </Animated.View>
  );
  const queueList = queueListWith(0);

  const settings = (
    <PlayerSettings visible={playbackOpen} tape={current != null && isTape(current)} speed={speed} pitch={pitch}
      jumps={tapeKey ? tapeStep : undefined}
      onJump={(which, seconds) => {
        // Kept for the book or show, as its speed is, and handed to the player for presses from outside the app.
        if (!tapeKey) return;
        setOwnTapeJump(tapeKey, which, seconds);
        setTapeStep({ key: tapeKey, ...tapeJumpsFor(tapeKey) });
      }}
      onSpeed={(value) => {
        // A tape's speed is its own, kept for it as the speed button keeps it.
        if (tapeKey) setTapeSpeed(tapeKey, value);
        void setSpeed(value);
      }} onPitch={(value) => void setPitch(value)}
      onClose={() => setPlaybackOpen(false)} />
  );
  const markSheets = (
    <>
      <TextPrompt
        visible={markingAt != null}
        heading={markingAt != null ? t.player.marks.noteAt(durationLabel(markingAt)) : ''}
        hint={t.player.marks.noteHint}
        placeholder={t.player.marks.notePlaceholder}
        confirmLabel={t.player.marks.save}
        optional
        onSubmit={(note) => {
          if (marking) addMark(marking.trackId, marking.at, note);
          haptic('choices', 'toggleOn');
          setMarking(null);
        }}
        onClose={() => setMarking(null)}
      />
      <ChaptersSheet
        visible={chaptersOpen}
        chapters={chapterList}
        durationSec={current.durationSec}
        onSeek={(seconds) => void seekTo(seconds)}
        // The last chapter ends where the tape does, which is the player's own end of a track.
        onSleepAt={(positionSec) => void JukeboxAudio.setSleepTimerAsync?.(
          positionSec >= current.durationSec - 1 ? { kind: 'endOfTrack' } : { kind: 'endOfChapter', positionMs: Math.round(positionSec * 1000) }
        )}
        onClose={() => setChaptersOpen(false)}
      />
      <MarksSheet
        visible={marksOpen}
        trackId={tape ? current.id : null}
        onSeek={(seconds) => void seekTo(seconds)}
        onAll={() => {
          onClose();
          router.push('/marks');
        }}
        onClose={() => setMarksOpen(false)}
      />
    </>
  );

  const sleepSheet = (
    <PlayerSettings sleepOnly tape visible={sleepOpen} speed={speed} pitch={pitch}
      onSpeed={(value) => {
        // A tape's speed is its own, kept for it as the speed button keeps it.
        if (tapeKey) setTapeSpeed(tapeKey, value);
        void setSpeed(value);
      }} onPitch={(value) => void setPitch(value)}
      onClose={() => setSleepOpen(false)} />
  );

  // The sheets drawn in here and not in windows of their own: while one is
  // up, the player under it is what goes out of focus.
  const veiled = playbackOpen || sleepOpen || menu.veiled;

  const artPart = (
      <>
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
          <Animated.View
            collapsable={false}
            style={[landscape ? styles.artLayer : lyricsShown ? styles.lyricsBox : undefined, { transform: artThrown }]}>
          {lyricsShown && !landscape ? (
            <View style={styles.lyricsBox}>
              <LiveLyrics
                live={!covered}
                state={wordsShown}
                height={artSize}
                onSeek={onSeek}
                trackId={current.id}
                translated={showTranslation && !tape}
                noneText={tape ? t.player.transcript.none : undefined}
              />
              {lyrics.lyrics && !tape ? <View style={styles.translateCorner}>{translateToggle}</View> : null}
            </View>
          ) : face ? (
            // Turned the faster while the repeat button is pressed and pressed again, a record already or not.
            <Animated.View style={{ transform: [{ rotate: recordTurn }] }}>
              {withMotion(
                face,
                <CoverFace
                  look={face}
                  artwork={artwork}
                  size={faceSize}
                  turning={moving}
                  live={!covered}
                  trackId={current.id}
                  speed={speed}
                />
              )}
            </Animated.View>
          ) : artwork ? (
            // Turned as a record while the repeat button is pressed and pressed again; still, and square, otherwise.
            <Animated.View style={{ transform: [{ rotate: recordTurn }] }}>
              {withMotion(
                'cover',
                <>
              <Image
                source={{ uri: artwork }}
                // Square, and no larger than the box it was given.
                style={[
                  styles.art,
                  // An explicit square either way. Asking for `flex` and an
                  // aspect ratio together leaves the size to be resolved two
                  // ways at once, and it came out differently depending on
                  // whether the screen had been turned or opened already wide.
                  { width: faceSize, height: faceSize },
                  vinyl && { borderRadius: faceSize / 2 },
                ]}
                contentFit="cover"
              />
              {vinyl ? <VinylFace size={faceSize} hole={c.bg} /> : null}
                </>
              )}
            </Animated.View>
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
          </Animated.View>
        </Animated.View>
      </>
  );
  /*
    What was added to a list, and for ten seconds the way back from a song
    just excluded: under the row of buttons and not in it, so that nothing in
    the row moves for them, upright; sideways, where the buttons go down a
    column of their own, under the controls.
  */
  const addedPart = (
      <View style={styles.added} pointerEvents="box-none">
        <PlayerDiscoverUndo />
        {added ? (
          <Text style={styles.addedText} accessibilityLiveRegion="polite" numberOfLines={2} pointerEvents="none">
            {added}
          </Text>
        ) : null}
      </View>
  );
  /*
    The buttons that are not playing it: in one row under the controls
    upright; sideways down a column of their own beside the player, so the
    artwork has the height they took.
  */
  const optionsPart = (
      <>
        {/*
          One row, whatever the width: drawn smaller before it is ever let
          run onto a second line, and then on two of the same length, never
          one button left on its own. See `optionsFit`.
        */}
        <View
          style={styles.optionsBox}
          onLayout={(event) => {
            const measured = Math.floor(event.nativeEvent.layout.width);
            setOptionsWidth((was) => (was === measured ? was : measured));
          }}>
          {tape ? optionRows(
            [
              <Pressable
                key="speed"
                android_ripple={pressed}
                style={[fit.button, styles.tapeChip]}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.tape.speed(speedLabel(speed))}
                onPress={() => {
                  const next = nextTapeSpeed(speed);
                  haptic('choices', 'tick');
                  if (tapeKey) setTapeSpeed(tapeKey, next);
                  void setSpeed(next);
                }}>
                <Text style={styles.tapeChipLabel}>{speedLabel(speed)}</Text>
              </Pressable>,
              <Pressable
                key="sleep"
                android_ripple={pressed}
                style={fit.button}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.tape.sleep}
                accessibilityState={{ expanded: sleepOpen }}
                onPress={() => setSleepOpen(true)}>
                <MoonIcon size={fit.icon} color={OFF} />
              </Pressable>,
              <Pressable
                key="mark"
                android_ripple={pressed}
                style={fit.button}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.marks.add}
                onPress={() => {
                  // Where it is now, at the press, not where it has got to once the note is written.
                  haptic('choices', 'click');
                  setMarking({ trackId: current.id, at: playerPositionNow().positionSec });
                }}>
                <MarkAddIcon size={fit.icon} color={OFF} />
              </Pressable>,
              ...(tapeVideo != null ? [
                <Pressable
                  key="transcript"
                  android_ripple={pressed}
                  style={[fit.button, lyricsShown ? styles.modeOn : styles.modeOff]}
                  accessibilityRole="button"
                  hitSlop={fit.slop}
                  accessibilityLabel={t.player.transcript.show}
                  accessibilityState={{ selected: lyricsShown }}
                  onPress={() => {
                    haptic('player', 'tick');
                    if (!showTranscript) void readTranscript(current.id, tapeVideo);
                    setShowTranscript(!showTranscript);
                  }}>
                  <LyricsIcon size={fit.icon} color={lyricsShown ? ON : OFF} />
                </Pressable>,
              ] : []),
              <Pressable
                key="marks"
                android_ripple={pressed}
                style={fit.button}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.marks.list(markTimes.length)}
                accessibilityState={{ expanded: marksOpen }}
                onPress={() => setMarksOpen(true)}>
                <MarksIcon size={fit.icon} color={markTimes.length > 0 ? ON : OFF} />
              </Pressable>,
              <Pressable
                key="settings"
                android_ripple={pressed}
                style={fit.button}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.sheet.playbackSettings}
                accessibilityState={{ expanded: playbackOpen }}
                onPress={() => setPlaybackOpen(true)}>
                <SettingsIcon size={fit.icon} color={OFF} />
              </Pressable>,
            ],
            fit.rows,
            fit.gap
          ) : optionRows(
            [
              <ShuffleButton
                key="shuffle"
                size={fit.icon}
                on={ON}
                off={OFF}
                style={fit.button}
                hitSlop={fit.slop}
                label={t.player.sheet.shuffleQueue}
                onPress={() => void shuffleQueue()}
                onDeal={deal}
              />,
              <Pressable
                key="repeat"
                android_ripple={pressed}
                style={[fit.button, repeat !== 'off' ? styles.modeOn : styles.modeOff]}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.sheet.repeat[repeat]}
                accessibilityState={{ selected: repeat !== 'off' }}
                onPress={() => {
                  // Round from off to all to one: only from one does it come back to off.
                  void cycleRepeat();
                  pressRepeat();
                }}>
                <Animated.View style={{ transform: [{ rotate: repeatIconTurn }] }}>
                  <RepeatIcon size={fit.icon} once={repeat === 'one'} color={repeat === 'off' ? OFF : ON} />
                </Animated.View>
              </Pressable>,
              <Pressable
                key="settings"
                android_ripple={pressed}
                style={fit.button}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.sheet.playbackSettings}
                accessibilityState={{ expanded: playbackOpen }}
                onPress={() => setPlaybackOpen(true)}>
                <SettingsIcon size={fit.icon} color={OFF} />
              </Pressable>,
              <Pressable
                key="lyrics"
                android_ripple={pressed}
                style={[fit.button, lyricsShown ? styles.modeOn : styles.modeOff]}
                accessibilityRole="button"
                hitSlop={fit.slop}
                accessibilityLabel={t.player.sheet.lyrics}
                accessibilityState={{ selected: lyricsShown }}
                onPress={() => {
                  setShowLyrics(!showLyrics);
                  pressLyrics();
                }}>
                <Animated.View
                  ref={lyricsButton}
                  collapsable={false}
                  // Again a moment later: laid out while the player is still rising, it is not yet where it will be.
                  onLayout={() => {
                    measureButton();
                    setTimeout(measureButton, 700);
                  }}
                  style={{ transform: [{ rotate: lyricsWobbleTurn }] }}>
                  <LyricsIcon size={fit.icon} color={lyricsShown ? ON : OFF} />
                </Animated.View>
              </Pressable>,
              // The song playing into a list in two taps, not through its menu.
              // Neither for a tape, which is in no list and nobody's favourite.
              listButton && current && !isTape(current) ? (
                <Pressable
                  key="list"
                  android_ripple={pressed}
                  style={fit.button}
                  accessibilityRole="button"
                  hitSlop={fit.slop}
                  accessibilityLabel={t.library.menu.addToPlaylist.label}
                  onPress={() => menu.addToList([current.id])}>
                  <ListAddIcon size={fit.icon} color={OFF} />
                </Pressable>
              ) : null,
              hearted && !(current && isTape(current)) ? (
                <HeartButton key={`heart-${current?.id ?? 'none'}`} trackId={current?.id ?? null} size={fit.icon} on={ON} off={OFF} style={fit.button} hitSlop={fit.slop} />
              ) : null,
            ],
            fit.rows,
            fit.gap,
            landscape
          )}
          {landscape ? null : addedPart}
        </View>
      </>
  );
  const controlsPart = (
      <>
        {/*
          Keep and exclude either side of the name, for a song of Discover's;
          for any other track neither is drawn and the name has the row. Each
          is a part of its own that listens for that one song, so this sheet
          is not drawn again for anything Discover does.
        */}
        <Animated.View collapsable={false} style={[styles.titleRow, { transform: titleThrown }]}>
        <PlayerDiscoverSide trackId={current.id} side="keep" small={landscape} />
        <PlayerListenSide trackId={current.id} side="keep" small={landscape} />
        <View style={styles.titles}>
          {waving ? (
            <WaveTitle text={current.title} wave={wave} style={[styles.title, landscape && styles.titleWide]} />
          ) : (
            <Text ref={titleRef} style={[styles.title, landscape && styles.titleWide]} numberOfLines={1}>
              {current.title}
            </Text>
          )}
          {tape ? (
            // Whose it is and which part, and no links: a show's name is not an artist's page.
            <Text style={[styles.artist, landscape && styles.artistWide]} numberOfLines={1}>
              {[album ?? credit, parts.length > 1 && partAt >= 0 ? (series ? t.player.tape.episode : t.player.tape.part)(partAt + 1, parts.length) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : (
          <Text style={[styles.artist, landscape && styles.artistWide]} numberOfLines={1}>
            {/*
              Each name goes to its own artist, the way the album goes to the
              record. A credit of two people is two names to press rather than
              one that would have to pick between them, split the way the
              Artists view splits it, so the page reached is the one that view
              lists. Nothing marks them as links: they are the artist and the
              album, and pressing one to see more of it is what is expected.

              The player is a layer over the navigator, so it has to go before
              the page can arrive — otherwise it opens underneath and the back
              button lands on a screen nobody can see.
            */}
            {credited.length === 0
              ? t.common.unknownArtist
              : credited.map((name, place) => (
                  <Text
                    key={name}
                    accessibilityRole="link"
                    onPress={() => {
                      onClose();
                      router.push({ pathname: '/playlist', params: { artist: foldForMatch(name) } });
                    }}>
                    {place > 0 ? ', ' : ''}
                    {name}
                  </Text>
                ))}
            {album ? (
              <>
                {' · '}
                <Text
                  accessibilityRole="link"
                  onPress={() => {
                    onClose();
                    // With the track, which says which record of the name it is on.
                    router.push({
                      pathname: '/playlist',
                      params: current ? { album: albumKey(album), track: current.id } : { album: albumKey(album) },
                    });
                  }}>
                  {album}
                </Text>
              </>
            ) : null}
          </Text>
          )}
        </View>
        <PlayerDiscoverSide trackId={current.id} side="exclude" small={landscape} />
        <PlayerListenSide trackId={current.id} side="drop" small={landscape} />
        </Animated.View>

        {error ? <Text style={styles.error}>{error.message}</Text> : null}

        {tape && chapterList.length > 1 ? (
          <LiveChapter live={!covered} chapters={chapterList} onPress={() => setChaptersOpen(true)} />
        ) : null}
        <LiveScrubber
          live={!covered}
          fileDurationSec={current.durationSec}
          step={back}
          onSeek={onSeek}
          remaining={tape}
          marks={tape ? markTimes : undefined}
          chapters={tape ? chapterStarts : undefined}
          // The sleep timer counting down, between the two times; pressed, its sheet.
          middle={<SleepCountdown tape={tape} onPress={() => (tape ? setSleepOpen(true) : setPlaybackOpen(true))} />}
        />
        {tape && parts.length > 1 && partAt >= 0 ? <TapeWhole live={!covered} parts={parts} at={partAt} /> : null}

        <View
          style={styles.transportBox}
          onLayout={(event) => {
            // More room or less, it is worked out again from full size.
            const room = Math.floor(event.nativeEvent.layout.width);
            if (room === transportRoom.current) return;
            transportRoom.current = room;
            setSqueeze({ gap: null, scale: 1 });
          }}>
        <View
          style={[styles.transport, { gap: squeezeGap }]}
          onLayout={(event) => {
            const taken = Math.ceil(event.nativeEvent.layout.width);
            const next = transportFit(transportRoom.current, taken, squeezeGap, squeeze.scale);
            if (next.gap !== squeezeGap || next.scale !== squeeze.scale) setSqueeze(next);
          }}>
          <Pressable
            android_ripple={pressed}
            style={control}
            hitSlop={controlSlop}
            accessibilityRole="button"
            accessibilityLabel={tape ? t.player.tape.previousPart : t.common.previousTrack}
            onPress={() => {
              haptic('player', 'tick');
              void previous();
            }}>
            <PreviousIcon size={skipIcon} />
          </Pressable>
          {/*
            Inside the track, between the buttons that leave it. Reading
            outwards from the middle the row is: play, a step, a whole record —
            which is the order of how far each one moves.
          */}
          <Pressable
            android_ripple={pressed}
            style={control}
            hitSlop={controlSlop}
            accessibilityRole="button"
            accessibilityLabel={t.player.sheet.back(back)}
            onPress={() => {
              haptic('player', 'tick');
              jump(-back);
            }}>
            <JumpIcon size={skipIcon} seconds={back} back />
          </Pressable>
          <Pressable
            android_ripple={pressed}
            style={control}
            hitSlop={controlSlop}
            accessibilityRole="button"
            accessibilityLabel={playWhenReady ? t.common.pause : t.common.play}
            onPress={() => {
              haptic('player', 'click');
              // Stopped as the finger says so, not when the player has answered: see `stopping`.
              if (playWhenReady) setStopping(true);
              void toggle();
            }}>
            {playWhenReady ? <PauseIcon size={playIcon} /> : <PlayIcon size={playIcon} />}
          </Pressable>
          <Pressable
            android_ripple={pressed}
            style={control}
            hitSlop={controlSlop}
            accessibilityRole="button"
            accessibilityLabel={t.player.sheet.forward(forward)}
            onPress={() => {
              haptic('player', 'tick');
              jump(forward);
            }}>
            <JumpIcon size={skipIcon} seconds={forward} />
          </Pressable>
          <Pressable
            android_ripple={pressed}
            style={control}
            hitSlop={controlSlop}
            accessibilityRole="button"
            accessibilityLabel={tape ? t.player.tape.nextPart : t.common.nextTrack}
            onPress={() => {
              haptic('player', 'tick');
              void next();
            }}>
            <NextIcon size={skipIcon} />
          </Pressable>
        </View>
        </View>

        {landscape ? null : optionsPart}
        {landscape ? addedPart : null}
      </>
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
        {artPart}
        {controlsPart}
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
        ref={playerRoot}
        style={[styles.screen, { transform: [{ translateY: slide }, { translateX: screenShake }, { rotate: screenTilt }, { rotate: screenRound }] }]}>
        <CoverPage uri={artwork} />
        {stage('behind')}
        <Behind
          veiled={veiled}
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
          <View style={[styles.optionsColumn, { paddingTop: insets.top }]}>{optionsPart}</View>
          <View style={styles.queueHalf}>
            <Text
              style={[styles.queueLabel, styles.queueHeading]}>
              {t.format.upper(lyricsShown ? (tape ? t.player.transcript.heading : t.player.sheet.lyrics) : (tape ? t.player.tape.parts(queue.length) : t.player.sheet.upNext(queue.length)))}
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
              {lyricsShown ? (
                <View style={styles.lyricsBox}>
                  <LiveLyrics
                    live={!covered}
                    state={wordsShown}
                    height={sideBox}
                    onSeek={onSeek}
                    trackId={current.id}
                    translated={showTranslation && !tape}
                    noneText={tape ? t.player.transcript.none : undefined}
                  />
                  {lyrics.lyrics && !tape ? <View style={styles.translateCorner}>{translateToggle}</View> : null}
                </View>
              ) : (
                queueListWith(0)
              )}
            </View>
          </View>
        </Behind>
        {stage('over')}
        {beats}
        <PlayerTip />
        {flyingLayer}
        {settings}
        {sleepSheet}
        {markSheets}
        {menu.element}
      </Animated.View>
    );
  }

  return (
    <Animated.View key="tall" ref={playerRoot} style={[styles.screen, { transform: [{ translateY: slide }, { translateX: screenShake }, { rotate: screenTilt }, { rotate: screenRound }] }]}>
      <CoverPage uri={artwork} />
        {stage('behind')}
      <Behind veiled={veiled} style={styles.behind}>
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

      <View style={[styles.queue, queueOver && styles.queueBare, { paddingBottom: insets.bottom }]}>
        <View style={styles.queueHandle} {...queueHandle.panHandlers}>
          <Pressable
            android_ripple={pressed}
            onPress={() => toggleQueue(!expanded)}
            style={styles.queueHandleHit}
            accessibilityRole="button"
            accessibilityState={{ expanded }}>
            <View style={styles.queueGrip} />
            <Text style={styles.queueLabel}>{t.format.upper((tape ? t.player.tape.parts(queue.length) : t.player.sheet.upNext(queue.length)))}</Text>
          </Pressable>
        </View>

        <Animated.View style={openBox}>{queueListWith(0)}</Animated.View>
      </View>
      </Behind>
      {stage('over')}
      {beats}
      {/* Under the two sheets, which cover it while either is up. */}
      <PlayerTip />
      {flyingLayer}
      {settings}
      {sleepSheet}
      {markSheets}
      {menu.element}
    </Animated.View>
  );
}

/** Room enough for the buttons at their full size: sideways, down a column of their own, they are never short of it. */
const OPTIONS_ROOMY = 1000;

const useStyles = makeStyles((c) => StyleSheet.create({
  /*
    In a theme of glass on a phone that can blur, a wash with the app showing
    through it, out of focus: see `NowPlayingHost`, which is what puts it so.
    Anywhere else, the page.
  */
  screen: { flex: 1, ...(glassOf(c) > 0 ? glassPage(c) : page(c)) },
  // Upright, everything but the sheets laid over the player: the column the
  // screen itself was, one step further in.
  behind: { flex: 1, minHeight: 0 },
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
  // Beside it, the buttons that are not playing it, one under another in the middle of the height.
  optionsColumn: { justifyContent: 'center', paddingHorizontal: 4 },
  queueHalf: {
    flex: 1,
    minHeight: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.border,
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
  artEmpty: { backgroundColor: c.surfaceRaised },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titles: { flex: 1, minWidth: 0, gap: 3, alignItems: 'center' },
  titleWide: { fontSize: 16 },
  artistWide: { fontSize: 12.5 },
  title: { color: c.text, fontSize: 19, fontWeight: '600' },
  // Underlined rather than coloured: it sits inside a line of ordinary text,
  // and a blue word in the middle of the subtitle reads as an error.
  artist: { color: c.textMuted, fontSize: 14 },
  error: { color: c.danger, fontSize: 13, textAlign: 'center' },

  scrubHitArea: { paddingVertical: 10, justifyContent: 'center' },
  scrubTrack: { height: 3, borderRadius: 2, backgroundColor: c.borderStrong, overflow: 'hidden' },
  scrubFill: { height: 3, backgroundColor: c.text },
  marks: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  chapterBreak: { position: 'absolute', width: 2, height: 7, marginLeft: -1, backgroundColor: c.bg, opacity: 0.85 },
  chapter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, minHeight: 28 },
  chapterText: { flex: 1, color: c.textSecondary, fontSize: 13 },
  chapterChevron: { color: c.textMuted, fontSize: 18 },
  mark: { position: 'absolute', width: 3, height: 11, marginLeft: -1.5, borderRadius: 1.5, backgroundColor: c.accent },
  times: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  time: { color: c.textFaint, fontSize: 11, fontVariant: ['tabular-nums'] },
  // How far into the whole of a tape in parts, under its bar.
  tapeWhole: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  // The speed, as a word in a ring where the other buttons are icons.
  tapeChip: { paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.borderStrong },
  tapeChipLabel: { color: c.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },

  /*
    Five buttons, so the gaps are what gives. Three of them sat comfortably at
    thirty-six points apart and five at that spacing come to more than a narrow
    phone is wide — the row has no way to wrap and nowhere to scroll, so it
    would simply have run off both edges.
  */
  // A row, so that the transport in it is as wide as what it holds even where that is wider than the room: what is measured.
  transportBox: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center' },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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

  /** Over the row of buttons, under them, for as long as it is said. */
  added: { position: 'absolute', top: '100%', left: 0, right: 0, alignItems: 'center', marginTop: 6, gap: 6, zIndex: 2 },
  addedText: {
    color: c.text,
    fontSize: 13,
    backgroundColor: c.surfaceRaised,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: 'hidden',
    ...outlinedClip(c),
  },
  optionsBox: { gap: 6 },
  /** The words' whole width, so that the corner below is the corner of where they are shown and not of a spinner. */
  lyricsBox: { alignSelf: 'stretch' },
  /** Over the top right of the words, clear of the edge. */
  translateCorner: { position: 'absolute', top: 6, right: 6 },
  translate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    ...outlined(c),
  },
  translateOn: outlined(c, c.accent),
  /*
    Lit or not is all these say about themselves, and lit is a shade. Where a
    theme draws outlines, one that is on is ringed in the accent as well. The
    ring's room is kept round the ones that are off, in no colour, so that
    turning one on moves nothing; the picture is centred in a box that was
    already bigger than it either way.
  */
  mode: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    ...outlined(c, 'transparent'),
  },
  modeOn: ringed(c, c.accent),
  /** The same room kept while it is off, every side given: see `ringed`. */
  modeOff: ringed(c, 'transparent'),
  /** Round the queue, for the shake it gives when it is shuffled. */
  dealt: { flex: 1 },

  gap: { flex: 1, overflow: 'hidden' },
  queue: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  /** No line across, either, where the handle was a bar of glass: see `queueOver`. */
  queueBare: { borderTopWidth: 0 },
  queueHandle: { alignItems: 'center' },
  queueHandleHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    alignSelf: 'stretch',
  },
  queueGrip: { width: 36, height: 3, borderRadius: 2, backgroundColor: c.borderStrong },
  queueLabel: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
  },
  muted: { color: c.textMuted, fontSize: 15 },
}));
