import { Image } from './Picture';
import { RADIUS, SPACE, TYPE } from '../lib/theme/measures';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDiscoverPreview } from './discover/hooks';
import { PlayingKeep } from './discover/PlayingActions';
import { PreviewBar } from './discover/PreviewBar';
import { HeartButton } from './Heart';
import { JumpIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, RepeatIcon, ShuffleIcon } from './Icons';
import { TrackStrip } from './TrackStrip';
import { useT } from '../lib/i18n/index';
import JukeboxAudio from '../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS } from '../lib/db/index';
import { artworkFor, useTrackArtwork } from '../lib/media/artwork';
import { jumpTo, stepFrom } from '../lib/player/jump';
import { useFavoritesShown } from '../lib/playlists/favorites';
import { jumpStepsChanged, tapeJumpsFor } from '../lib/tapes/settings';
import { tapeKeyOf } from '../lib/tapes/speed';
import { withAlpha } from '../lib/theme/colour';
import { coverColour } from '../lib/theme/coverAccent';
import {
  miniCover,
  miniFloating,
  miniHold,
  miniLeftHanded,
  miniLine,
  miniProgress,
  miniSwipe,
  miniTint,
  useMiniButtons,
  FLOATING_MARGIN,
  type MiniButton,
  type MiniCover,
  type MiniLine,
} from '../lib/ui/miniPlayer';
import { useMotionReduced } from '../lib/ui/motion';
import { RECORD_TURN_MS } from '../lib/ui/coverFace';
import { useTrackMenu } from './useTrackMenu';
import { useHasCurrent, useSpeed } from '../lib/player/current';
import { useOpenPlayer, useOpenPlayerWith, usePlayerUp } from '../lib/player/NowPlayingSheet';
import { playerPositionNow, usePlayerActions, usePlayerPosition, usePlayerState, type PlayerState } from '../lib/player/PlayerProvider';
import { isTape } from '../lib/tapes/tape';
import { makeStyles, outlineWidth, useColours, usePressed } from '../lib/theme/index';
import { underGlass, Veiled } from '../lib/theme/Veil';
import type { Track } from '../lib/types';
import { haptic } from '../lib/ui/haptics';
import { useLandscape } from '../lib/ui/layout';
import { BlurArea, Frost, GlassScene, useFrosted, useSceneTarget } from './Frosted';
import { barGlass, FootDock } from './UnderBars';
import { ArtistLinks } from './NameLinks';

/**
 * One track's cover, looked up per card so the neighbours arrive with theirs:
 * in the shape the bar is set to (`ui/miniPlayer.ts`), and, a record, turning
 * while the song it is the label of plays.
 */
function Cover({ track, column, shape, turning }: { track: Track; column: boolean; shape: MiniCover; turning: boolean }) {
  const artwork = useTrackArtwork(track);
  const styles = useStyles();
  const round = shape !== 'square';
  const size = [column ? styles.artWide : styles.art, round && styles.round];
  const picture = artwork ? <Image source={{ uri: artwork }} style={size} contentFit="cover" /> : <View style={[size, styles.artEmpty]} />;
  if (shape !== 'record') return picture;
  return (
    <Turning on={turning} style={column ? styles.recordWide : styles.record}>
      {picture}
      {/* The hole in the middle, as a record has. */}
      <View style={styles.hole} />
    </Turning>
  );
}

/**
 * Whether the bar is to be seen: under the open player it is not, and what
 * moves on it — the record, the time, the line along it — stands still.
 * There is one bar, in the tab bar, for every tab; whichever is open, it is
 * in sight.
 */
function useInSight(): boolean {
  return !usePlayerUp();
}

/**
 * Round and round while [on], at the angle the song has it: one turn every
 * `RECORD_TURN_MS` of the song, as the player's own record turns, so that
 * it is at the same angle on every tab's bar and in the player, and comes
 * back to it after anything. Set going from where the song is, and set again
 * only when the song is found somewhere the turning did not take it: a seek,
 * a new song, the tab opened again after a while behind another.
 */
function Turning({ on, style, children }: { on: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const still = useMotionReduced();
  const open = useInSight();
  const speed = useSpeed();
  const live = on && !still && open;
  const { positionSec } = usePlayerPosition(live);
  const [turn] = useState(() => new Animated.Value(turnsAt(playerPositionNow().positionSec)));
  // Where the song was when it was last set going, and when, for whether it is still where the turning has it.
  const setOff = useRef<{ seconds: number; at: number; speed: number } | null>(null);
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!live) {
      loop.current?.stop();
      loop.current = null;
      setOff.current = null;
      turn.setValue(turnsAt(positionSec));
      return;
    }
    const now = performance.now();
    const was = setOff.current;
    if (was && was.speed === speed) {
      const expected = was.seconds + ((now - was.at) / 1000) * speed;
      // In step: left turning as it is, rather than set going again at every reading.
      if (Math.abs(expected - positionSec) < IN_STEP_S) return;
    }
    setOff.current = { seconds: positionSec, at: now, speed };
    loop.current?.stop();
    const from = turnsAt(positionSec);
    turn.setValue(from);
    // Once round and back to the same angle, over and over: a turn of the song is a turn of the record.
    const going = Animated.loop(
      Animated.timing(turn, { toValue: from + 1, duration: RECORD_TURN_MS / speed, easing: Easing.linear, useNativeDriver: true })
    );
    loop.current = going;
    going.start();
  }, [live, positionSec, speed, turn]);

  useEffect(
    () => () => {
      loop.current?.stop();
    },
    []
  );

  const [rotate] = useState(() =>
    Animated.modulo(turn, 1).interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  );
  return <Animated.View style={[style, { transform: [{ rotate }] }]}>{children}</Animated.View>;
}

/** How far the song may be from where the turning has it before the record is set again, in seconds of it. */
const IN_STEP_S = 0.75;

/** The record's turns at [seconds] into the song, as the player's own record has them (`CoverFace`). */
const turnsAt = (seconds: number) => (seconds * 1000) / RECORD_TURN_MS;


/**
 * A screen of a tab, filling it. The bar of what is playing was drawn here,
 * at its foot or down its side; it is drawn beside each tab's stack of pages
 * now, so that a page coming in from the side leaves it where it is (see the
 * tabs' layout), and this is only the room the screen fills.
 */
export function WithNowPlaying({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[around.page, style]}>{children}</View>;
}

/**
 * What a tab's page keeps clear of at its two sides.
 *
 * Upright, whatever the phone says is there. Sideways the page does not reach
 * the edges of the glass: the rail of tabs is at one and keeps clear of what
 * is at it, and the panel of what is playing, when there is one, does the
 * same at the other. A page that asked again had a second inset's worth of
 * nothing on one side only, and sat off-centre in the room it was given. So
 * sideways there is nothing on the left, and on the right only when no panel
 * stands between the page and the edge.
 */
export function usePageSides(): { left: number; right: number } {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const playing = useHasCurrent();
  const previewing = useDiscoverPreview() != null;
  if (!landscape) return { left: insets.left, right: insets.right };
  return { left: 0, right: playing || previewing ? 0 : insets.right };
}

const around = StyleSheet.create({
  page: { flex: 1, minWidth: 0, minHeight: 0 },
  // The whole height beside the stack: the view round it is laid out down the page, as tall as the stack.
  column: { flexGrow: 1 },
});

/**
 * Just enough to see what is playing and get to the full player. Shuffle,
 * repeat, the scrubber and the speed controls live there, where there is room
 * for them.
 *
 * Belongs at the foot of any screen you can start music from. Starting a track
 * and being left looking at the list you started it from reads as the tap
 * having gone nowhere — the bar appearing is what says otherwise, and it is
 * also the way back to the player without going through the library.
 *
 * Nothing at all when nothing is playing, so it costs no room until it earns
 * some.
 */
export function NowPlayingBar({
  column = false,
  veiled = false,
  docked = true,
}: {
  column?: boolean;
  veiled?: boolean;
  /** Along the foot, laid over the screen by itself in a theme of glass (`FootDock`); not, where what it is in is (the tab bar). */
  docked?: boolean;
}) {
  /*
    Along the bottom in a theme of glass it is laid over the screen, on the
    tab bar, so that the list runs on under it; see `UnderBars`. Down the
    side it is a panel beside the list, as in every theme.

    [veiled] while a sheet the page laid over itself is up: out of focus and
    out of reach with the page, as it was when it was in the page.
  */
  const c = useColours();
  const bar = (
    <Veiled
      blur={veiled ? underGlass(c) : 0}
      style={column ? around.column : null}
      pointerEvents={veiled ? 'none' : 'auto'}
      importantForAccessibility={veiled ? 'no-hide-descendants' : 'auto'}>
      <PlayingBar column={column} />
    </Veiled>
  );
  return column || !docked ? bar : <FootDock>{bar}</FootDock>;
}

/**
 * How long is left of the tape playing, after its name on the bar: a book is
 * carried on with a stretch at a time, and how much of this stretch remains
 * is what is wanted of it at a glance. Its own part, so that the second it
 * counts in redraws these few letters and not the bar.
 */
function TapeLeft() {
  const t = useT();
  // Asked of the player only while the bar is in sight, and not four times a second under the open player.
  const { positionSec, durationSec } = usePlayerPosition(useInSight());
  if (!durationSec) return null;
  const minutes = Math.max(1, Math.round((durationSec - positionSec) / 60));
  return <Text>{` · ${t.library.tapes.left(minutes)}`}</Text>;
}

function PlayingBar({ column }: { column: boolean }) {
  const { current, currentIndex, queue, repeat, isPlaying, shuffled } = usePlayerState();
  /*
    Under the open player, drawn as it was when the player opened, and
    brought up to date as it closes: every play, pause and change of song
    made in the player would otherwise draw a bar nobody can see.
  */
  const open = useInSight();
  const [kept, setKept] = useState({ current, currentIndex, queue, repeat, isPlaying, shuffled });
  if (
    open &&
    (kept.current !== current ||
      kept.currentIndex !== currentIndex ||
      kept.queue !== queue ||
      kept.repeat !== repeat ||
      kept.isPlaying !== isPlaying ||
      kept.shuffled !== shuffled)
  ) {
    setKept({ current, currentIndex, queue, repeat, isPlaying, shuffled });
  }
  const shown = open ? { current, currentIndex, queue, repeat, isPlaying, shuffled } : kept;
  return <PlayingBarDrawn column={column} {...shown} />;
}

const PlayingBarDrawn = memo(function PlayingBarDrawn({
  column,
  current,
  currentIndex,
  queue,
  repeat,
  isPlaying,
  shuffled,
}: { column: boolean } & Pick<PlayerState, 'current' | 'currentIndex' | 'queue' | 'repeat' | 'isPlaying' | 'shuffled'>) {
  const currentId = current?.id ?? null;
  const { toggle, next, previous, skipToIndex, seekTo, shuffleQueue, cycleRepeat } = usePlayerActions();
  const openPlayer = useOpenPlayer();
  const openPlayerWith = useOpenPlayerWith();
  const preview = useDiscoverPreview();
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // What scrolls under it, out of focus behind it, along the foot in a theme of glass: see `Frosted`.
  const target = useSceneTarget();
  const frosted = useFrosted(column ? null : target);
  // As Settings → Mini player has it: see `ui/miniPlayer.ts`.
  const progress = miniProgress.useChoice();
  const buttons = useMiniButtons();
  const line = miniLine.useChoice();
  const swipes = miniSwipe.useOn();
  const hold = miniHold.useChoice();
  const shape = miniCover.useChoice();
  const floating = miniFloating.useOn();
  const tinted = miniTint.useOn();
  const leftHanded = miniLeftHanded.useOn();
  const hearts = useFavoritesShown();
  const tint = useCoverTint(tinted ? currentId : null);
  // The track menu, put up only where holding the bar is to open it.
  const [menu, setMenu] = useState<{ open: (track: Track) => void } | null>(null);

  /*
    By position rather than through the transport, which does not mean the same
    thing. `previous` restarts the track once it is a few seconds in, which is
    right for a button pressed twice to go back two, and wrong for a strip that
    has just been dragged until the previous track's cover is filling the frame.
  */
  const go = useCallback((to: number) => void skipToIndex(to), [skipToIndex]);
  // Read for the song as it comes on, and again only when a step is changed in Settings or the player.
  const stepsChanged = useSyncExternalStore(jumpStepsChanged.subscribe, jumpStepsChanged.get);
  const steps = useMemo(() => (current ? jumpsFor(current, stepsChanged) : null), [current, stepsChanged]);

  const held =
    hold === 'menu'
      ? (track: Track) => menu?.open(track)
      : hold === 'queue' || hold === 'lyrics'
        ? () => openPlayerWith(hold)
        : undefined;

  /*
    The card is the button, rather than the whole bar being one with the card
    inside it. Which way round these nest decides whether the gesture works at
    all: a Pressable takes the responder the moment it is touched, and a strip
    underneath one never gets asked whether the finger is going sideways. The
    same arrangement as a row in the library — press on the inside, drag on the
    outside — and for the same reason.
  */
  const card = useCallback(
    (track: Track) => {
      const playing = track.id === currentId;
      return (
        <Pressable
          style={column ? styles.columnCard : styles.card}
          accessibilityRole="button"
          accessibilityHint={t.player.bar.opensPlayer}
          onPress={openPlayer}
          onLongPress={held ? () => held(track) : undefined}>
          <Cover track={track} column={column} shape={shape} turning={playing && isPlaying} />
          <View style={column ? styles.columnText : styles.text}>
            <Text style={styles.title} numberOfLines={column ? 2 : 1}>
              {track.title}
            </Text>
            <Text style={styles.artist} numberOfLines={column ? 2 : 1}>
              <SecondLine track={track} line={line} playing={playing} upNext={playing ? (queue[currentIndex + 1] ?? null) : null} />
            </Text>
          </View>
        </Pressable>
      );
    },
    [column, currentId, currentIndex, held, isPlaying, line, openPlayer, queue, shape, styles, t]
  );

  /*
    A preview of a Discover song is being heard. It is not in the player, and
    what the player has is whatever was paused for it: named here, that would
    be the wrong song under the right sound. So for as long as it lasts this
    is the preview's bar, on every screen this one is on.
  */
  if (preview) return <PreviewBar preview={preview} column={column} width={NOW_PLAYING_WIDTH} />;

  if (!current) return null;

  const slop = column ? SLOP_COLUMN : SLOP;
  const tape = isTape(current);
  const off = c.textDisabled;

  /*
    Down the side, four go in the panel's one row only drawn closer together:
    in two rows of two they looked like two bars of buttons, and three and one
    left over like a mistake. The room each takes a touch in stays as it was.
  */
  const tight = column && buttons.length > 3;
  const control = (button: MiniButton) => {
    switch (button) {
      case 'previous':
        return (
          <Pressable
            key={button}
            android_ripple={pressed}
            style={tight ? styles.controlTight : styles.control}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={tape ? t.player.tape.previousPart : t.common.previousTrack}
            onPress={() => {
              haptic('player', 'tick');
              void previous();
            }}>
            <PreviousIcon size={16} />
          </Pressable>
        );
      case 'playPause':
        // Named for what a press will do, as the picture is.
        return (
          <Pressable
            key={button}
            android_ripple={pressed}
            style={tight ? styles.controlTight : styles.control}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t.common.pause : t.common.play}
            onPress={() => {
              haptic('player', 'click');
              void toggle();
            }}>
            {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </Pressable>
        );
      case 'next':
        return (
          <Pressable
            key={button}
            android_ripple={pressed}
            style={tight ? styles.controlTight : styles.control}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={tape ? t.player.tape.nextPart : t.common.nextTrack}
            onPress={() => {
              haptic('player', 'tick');
              void next();
            }}>
            <NextIcon size={16} />
          </Pressable>
        );
      case 'back':
      case 'forward': {
        // As far as the player's own jump buttons go: a tape's own, or the setting's (`player/jump.ts`).
        if (!steps) return null;
        const by = button === 'back' ? -steps.back : steps.forward;
        return (
          <Pressable
            key={button}
            android_ripple={pressed}
            style={tight ? styles.controlTight : styles.control}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={button === 'back' ? t.player.sheet.back(steps.back) : t.player.sheet.forward(steps.forward)}
            onPress={() => {
              haptic('player', 'tick');
              const { positionSec, durationSec } = playerPositionNow();
              void seekTo(jumpTo(positionSec, by, durationSec || current.durationSec || 0));
            }}>
            <JumpIcon size={18} seconds={Math.abs(by)} back={button === 'back'} />
          </Pressable>
        );
      }
      case 'heart':
        // Only while there are favorites to fill: see `playlists/favorites.ts`.
        return hearts ? (
          <HeartButton key={button} trackId={current.id} size={18} on={c.accent} off={c.text} style={tight ? styles.controlTight : styles.control} hitSlop={8} />
        ) : null;
      case 'shuffle':
        return (
          <Pressable
            key={button}
            android_ripple={pressed}
            style={tight ? styles.controlTight : styles.control}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={t.player.sheet.shuffleQueue}
            accessibilityState={{ selected: shuffled }}
            onPress={() => {
              haptic('player', 'tick');
              void shuffleQueue();
            }}>
            <ShuffleIcon size={17} color={shuffled ? c.text : off} />
          </Pressable>
        );
      case 'repeat':
        return (
          <Pressable
            key={button}
            android_ripple={pressed}
            style={tight ? styles.controlTight : styles.control}
            hitSlop={slop}
            accessibilityRole="button"
            accessibilityLabel={t.player.sheet.repeat[repeat]}
            onPress={() => {
              haptic('player', 'tick');
              void cycleRepeat();
            }}>
            <RepeatIcon size={17} once={repeat === 'one'} color={repeat === 'off' ? off : c.text} />
          </Pressable>
        );
    }
  };

  /*
    On its side it is a panel down the right instead of a bar along the
    bottom, for the same reason the tabs move to the left: height is what a
    landscape screen is short of, and neither of them needs it.

    The same parts either way, only stacked — the cover, what is playing, and
    the controls. Sideways there is room to let the title wrap, which
    upright there is not.
  */
  return (
    <View
      style={[
        column ? styles.column : styles.bar,
        !column && leftHanded && styles.leftHanded,
        floating && (column ? styles.floatingColumn : styles.floating),
        frosted && styles.clear,
        /*
          Down the side it runs the whole height of the window, clock included,
          and what is in it sits in the middle of that — not stacked under the
          status bar, which left it clinging to the top of a tall empty column.
          The insets are still kept as padding so nothing can end up beneath
          the clock or in a cutout on a long queue.
        */
        column && {
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 14,
          paddingRight: SPACE.m + insets.right,
        },
      ]}>
      {frosted && target ? <Frost target={target} edge={floating ? undefined : 'top'} /> : null}
      {/*
        Down the side, its edge against the pages starts under the clock's
        strip: over them the strip runs on into the panel with no line
        between, one frame round the pages with the rail (see the tabs'
        layout).
      */}
      {column && !floating ? <View pointerEvents="none" style={[styles.columnEdge, { top: insets.top }]} /> : null}
      {/* The cover's colour washed over the bar, under all that is on it. */}
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      {progress === 'fill' ? <Progress kind="fill" /> : null}
      {/*
        Underneath everything, so the whole bar opens the player and not only
        the card. The gesture needs the strip not to be inside a Pressable, and
        this way it is not — it is next to one, and anywhere the strip does not
        cover falls through to here.
      */}
      {/* Not offered to a screen reader, which would find a button the size of
          the bar with nothing to say for itself. The card says it, and does
          the same thing. */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={openPlayer} />
      {/*
        The controls are deliberately left out of the strip. They are the one
        thing here somebody might be aiming for, and a play button that slides
        out from under the thumb mid-press is worse than no gesture at all.
      */}
      <TrackStrip
        queue={queue}
        at={currentIndex}
        wraps={repeat === 'all'}
        renderTrack={card}
        onGo={go}
        swipes={swipes}
        style={column ? undefined : styles.strip}
      />
      <View style={column ? styles.columnControls : [styles.inline, leftHanded && styles.leftHanded]}>
        {/*
          Keep, for a song of Discover's: nothing for any other track. Along
          the bottom it is the first of the controls; down the side the
          controls fill their row, and it has the line under them.
        */}
        {column ? null : <PlayingKeep trackId={current.id} style={styles.control} hitSlop={slop} />}
        {buttons.map(control)}
      </View>
      {column ? <PlayingKeep trackId={current.id} style={styles.columnKeep} hitSlop={slop} /> : null}
      {progress === 'line' ? <Progress kind="line" /> : null}
      {hold === 'menu' ? <HoldMenu onReady={setMenu} /> : null}
    </View>
  );
});

/** How far a jump button goes either way for [track]: a tape's own steps, or the player's (`player/jump.ts`). */
function jumpsFor(track: Track, _changed?: number): { back: number; forward: number } {
  if (isTape(track)) {
    const own = tapeJumpsFor(tapeKeyOf(track));
    return { back: own.back, forward: own.forward };
  }
  const step = stepFrom(readSetting(SETTINGS.jumpSeconds));
  return { back: step, forward: step };
}

/**
 * The line under the name, as the bar is set to say it. What depends on the
 * song playing -- how long is left, what comes next -- is said of that one
 * only; the cards either side of it, pulled into sight, say who.
 */
function SecondLine({ track, line, playing, upNext }: { track: Track; line: MiniLine; playing: boolean; upNext: Track | null }) {
  const t = useT();
  const said = t.player.bar;
  // Words only: the card is for opening the player, all of it; the player's own names lead on.
  const who = <ArtistLinks credit={track.artist} off />;
  if (line === 'album') return <>{track.album || who}</>;
  if (line === 'both') {
    return track.album ? (
      <>
        {who}
        {` · ${track.album}`}
      </>
    ) : (
      who
    );
  }
  if (line === 'left' && playing) return <TimeLeft />;
  if (line === 'next' && playing) return <>{upNext ? said.upNext(upNext.title) : said.lastInQueue}</>;
  return (
    <>
      {who}
      {playing && isTape(track) ? <TapeLeft /> : null}
    </>
  );
}

/** How long is left of the song playing, counting down: its own part, so that its second redraws these few letters and not the bar. */
function TimeLeft() {
  const t = useT();
  const { positionSec, durationSec } = usePlayerPosition(useInSight());
  if (!durationSec) return null;
  return <>{t.player.bar.timeLeft(formatClock(Math.max(0, durationSec - positionSec)))}</>;
}

/**
 * How far into the song it is: a line along the bar's edge, or the bar filling
 * behind what is on it. Its own part, for the same reason.
 */
function Progress({ kind }: { kind: 'line' | 'fill' }) {
  const styles = useStyles();
  const { positionSec, durationSec } = usePlayerPosition(useInSight());
  const share = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  return (
    <View pointerEvents="none" style={kind === 'line' ? styles.progressTrack : StyleSheet.absoluteFill}>
      <View style={[kind === 'line' ? styles.progressLine : styles.progressFill, { width: `${share * 100}%` }]} />
    </View>
  );
}

/** The menu a held row of the library opens, put up for the bar where holding it is to open it. */
function HoldMenu({ onReady }: { onReady: (menu: { open: (track: Track) => void } | null) => void }) {
  const menu = useTrackMenu();
  const open = menu.open;
  useEffect(() => {
    onReady({ open });
    return () => onReady(null);
  }, [onReady, open]);
  return menu.element;
}

/**
 * The cover's colour, worked out from the picture of [trackId] as the theme
 * that takes its colours from the cover works it out, thinned for washing the
 * bar with; nothing where it is not wanted ([trackId] null) or the cover has none.
 */
function useCoverTint(trackId: string | null): string | null {
  const [tint, setTint] = useState<{ id: string | null; colour: string | null }>({ id: null, colour: null });
  useEffect(() => {
    if (!trackId) return;
    let alive = true;
    artworkFor(trackId)
      .then((path) => (path ? JukeboxAudio.coverColoursAsync?.(path) : null))
      .then((stops) => {
        if (!alive) return;
        const colour = coverColour(stops ?? null);
        setTint({ id: trackId, colour: colour ? withAlpha(colour, TINT_STRENGTH) : null });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [trackId]);
  // The last one's until this one's is known, so the bar does not go plain between two songs.
  return trackId ? tint.colour : null;
}

/** How much of the cover's colour is in the wash over the bar. */
const TINT_STRENGTH = 0.28;

/** Minutes and seconds, as the player's own clock says them. */
function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/*
  The controls are drawn about 32 across, which is a small thing to hit with a
  thumb while walking. They are left looking as they do and made easier to
  touch: this much further out on each side still counts as the button. Less
  sideways than up and down, because sideways is where the next button is —
  and less again down the side of the screen, where the three share a narrower
  row. Up and down they reach the 48 Android asks for; sideways they stop at
  half the gap to the next button, which is as far as they can go without two
  of them answering the same touch.
*/
const SLOP = { top: 8, bottom: 8, left: 5, right: 5 };
const SLOP_COLUMN = { top: 8, bottom: 8, left: 2, right: 2 };

/** How wide the panel is when it runs down the side. */
export const NOW_PLAYING_WIDTH = 132;

/** Worked out with the rest of what the bars cover; see there. */
export { nowPlayingHeight } from '../lib/ui/bars';

const useStyles = makeStyles((c) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    // As the tab bar's: a hairline, or an outline's width where the bar is the
    // colour of the page under it.
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
    backgroundColor: c.surface,
    // In a theme of glass, the wash every bar with a list under it has.
    ...barGlass(c),
    paddingHorizontal: SPACE.m,
    paddingVertical: SPACE.s,
  },
  /** Its fill left to `Frost`, which draws it over the blur. */
  clear: { backgroundColor: 'transparent' },
  column: {
    /*
      Centred down its own length, and as long as the panel's room, which is
      the whole height beside the stack (`NowPlayingBar` holds it in a view of
      its own, laid out down the page): grown sideways, as it was once as a
      child of a row, the panel ate half the screen.
    */
    flexGrow: 1,
    justifyContent: 'center',
    width: NOW_PLAYING_WIDTH,
    // The frame's colour, as the rail's and the strip's across the top are: sideways the three are one frame round the pages.
    backgroundColor: c.bar,
    paddingHorizontal: SPACE.m,
    paddingTop: SPACE.m,
    gap: SPACE.s,
  },
  columnEdge: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    backgroundColor: c.border,
  },
  /** Along the bottom the strip takes whatever the controls leave. */
  strip: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  columnCard: { gap: SPACE.s },
  columnText: { gap: SPACE.xxs },
  // Wrapped onto a second line where four are more than the panel's width takes.
  columnControls: { flexDirection: 'row', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  art: { width: 40, height: 40, borderRadius: RADIUS.cover },
  round: { borderRadius: RADIUS.pill },
  // The record's own box, turned about its middle, the picture filling it and a hole in the middle of that.
  record: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  recordWide: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  hole: { position: 'absolute', width: 7, height: 7, borderRadius: RADIUS.check, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border },
  // For a left thumb: the controls first and the song after them.
  leftHanded: { flexDirection: 'row-reverse' },
  // Clear of the edges and rounded, a card standing over the foot rather than a strip across it.
  floating: {
    marginHorizontal: FLOATING_MARGIN,
    marginBottom: FLOATING_MARGIN,
    borderRadius: RADIUS.card,
    borderWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderColor: c.border,
    overflow: 'hidden',
  },
  floatingColumn: {
    margin: FLOATING_MARGIN,
    borderRadius: RADIUS.card,
    borderWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderColor: c.border,
    overflow: 'hidden',
  },
  // How far into the song: along the foot of the bar, or behind all of it.
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
  progressLine: { height: 2, backgroundColor: c.accent },
  progressFill: { height: '100%', backgroundColor: withAlpha(c.accent, 0.16) },
  artWide: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.cover },
  artEmpty: { backgroundColor: c.surfaceRaised },
  text: { flex: 1, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.body },
  artist: { color: c.textMuted, fontSize: TYPE.hint },
  control: {
    paddingHorizontal: SPACE.s,
    paddingVertical: SPACE.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Four across the side panel's row: as much of the panel's width as each can have.
  // Four in the panel's one row, each as wide as a quarter of it, and not as wide as its icon: a finger's room, near enough.
  controlTight: {
    flex: 1,
    paddingHorizontal: SPACE.xxs,
    paddingVertical: SPACE.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnKeep: { alignSelf: 'center', paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, alignItems: 'center', justifyContent: 'center' },
}));
