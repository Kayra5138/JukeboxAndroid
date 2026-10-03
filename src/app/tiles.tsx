import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motionReduced } from '../lib/ui/motion';
import { BackIcon } from '../components/Icons';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import JukeboxAudio, { type Chart } from '../../modules/jukebox-audio';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { findTrack } from '../lib/media/library';
import {
  usePlayerActions,
  usePlayerPosition,
  usePlayerState,
} from '../lib/player/PlayerProvider';
import {
  accuracyOf,
  aliveForMs,
  ladderFrom,
  laneAt,
  LANES,
  LIVES,
  NOTHING_YET,
  holdWonAt,
  holdWorth,
  rowFor,
  pointsOf,
  runOf,
  speedById,
  SPEEDS,
  TILE_ASPECT,
  tileAt,
  toGrid,
  touching,
  type Run,
  type Score,
  type Speed,
} from '../lib/tiles/game';
import { CONFETTI_SEC, confettiFor, scrapAt, type Scrap } from '../lib/tiles/confetti';
import { keyShades, laneShades } from '../lib/tiles/shade';

/*
  The board is drawn by a fixed set of views that notes are lent as they come
  into sight and give back when they are done with. A chart of five thousand
  notes therefore costs what a chart of forty does, because the number of views
  is the number on screen rather than the number in the song.

  Ten, and the figure matters. Every view in the pool costs a style worked out
  and a property written on the other thread sixty times a second whether or
  not anything is lent to it, so the pool is a per-frame bill paid in full
  regardless of how much of it is used. A board two and a half tiles tall holds
  about four at once; this is that with room to spare, and not the two dozen it
  was when tiles were a fraction of the size.
*/
/*
  Lent per column rather than from one shared heap, which is what lets a key be
  a fixed colour. A slot that could show any column has to be told its colour
  every frame, and a colour is not a number that can be animated; a slot that
  belongs to one column knows its own and never changes it.

  Four apiece. A board under three tiles tall can show two in a column at once,
  and a struck one lingers while it falls out, so this is that with room over.
*/
const PER_LANE = 4;
const POOL = LANES * PER_LANE;
const POOL_SLOTS = Array.from({ length: POOL }, (_, index) => index);

/*
  Each tile is told eight numbers a frame, laid end to end in one array. Not
  where it is across the board -- a slot belongs to one column for the whole of
  a run, so its left edge is settled when it is built and never mentioned
  again.
*/
const FIELDS = 8;
const F_Y = 0;
const F_TAIL = 1;
const F_ON = 2;
/** 1 while a key is waiting, less once it has been struck. */
const F_LIT = 3;
/** How much of a held key has been kept down, nought to one. */
const F_FILL = 4;
/** 1 while a finger is actually on it, which is when the gauge is bright. */
const F_GLOW = 5;
/** 1 at the instant a key is struck, falling to nought as the light goes out. */
const F_FLASH = 6;
/** 1 at the instant a held key is kept to the end, falling to nought after it. */
const F_KEPT = 7;

/**
 * How long the light from a struck key lasts.
 *
 * Long enough to be seen as something happening and short enough that four in
 * a bar do not run into one another. The flash is the only part of this screen
 * that exists purely to be enjoyed; everything else on it is telling the
 * player something.
 */
const FLASH_MS = 320;

/**
 * How long a kept hold goes on glowing.
 *
 * Longer than the light off a tap, because it is the end of something that
 * took a second or more of a finger held still, and a reward the length of a
 * blink would be over before the hand had come off the glass to see it.
 */
const KEPT_MS = 520;

/**
 * How many keys in a row buy a life back.
 *
 * Far enough that it is a stretch of real playing rather than a few lucky
 * taps, and near enough to be worth reaching for once a life has gone. A life
 * is only ever given back when one is missing -- it buys nothing at full
 * strength, so there is no hoarding and the count simply starts again.
 */
const CLEAN_FOR_A_LIFE = 50;

/**
 * How bright a key is once it has been struck.
 *
 * It is not taken off the board: it goes on falling, dimmed, and leaves at the
 * bottom with everything else. Blinking out at the moment of the press reads
 * as the tile never having been there, which is indistinguishable from a tap
 * that did nothing — and taking it away also takes away the one piece of
 * evidence that the press landed.
 */
const SPENT_INK = 0.28;

/**
 * The height the tail is drawn at before it is stretched.
 *
 * Scaling a one-point bar to three hundred magnifies every rounding error in
 * its edges by the same three hundred, which is seen as the bar shimmering
 * while a key is held. A base near the size it will actually be asked for
 * keeps the factor close to one.
 */
const TAIL_BASE = 240;

/**
 * The height the whole key is drawn at before it is stretched to its length.
 *
 * Near the size of an ordinary key, so a tap is drawn at about life size and
 * even the longest hold is only stretched a few times -- a bar scaled by ten
 * magnifies every rounding error in its edges by ten with it.
 */
const BODY_BASE = 320;

/**
 * The gauge drawn along a held key, and the room left at each end of it.
 *
 * The gap is in points and the same at both ends, which is the whole reason
 * this is not drawn inside the tail. The tail is only the part of a hold above
 * the key, so a gauge living in it stopped where the key began and left the
 * key's whole height bare underneath -- far more room below than above, and
 * neither of them a margin anybody chose. Laid over the tile instead, it spans
 * the hold and the key together and can be inset equally.
 */
const GAUGE_BASE = 900;
const GAUGE_GAP = 30;

/**
 * How tall a tile's own frame is.
 *
 * Bigger than any screen on purpose. The frame hangs above the bottom with the
 * key at its foot, so a tail has somewhere to grow into without the view being
 * resized — and resizing is the one thing that would drag layout back into a
 * loop that is otherwise nothing but transforms.
 */
const BOX = 1600;

/**
 * How long a gap between frames has to be before the app is taken as having
 * been away rather than as having run a frame slowly.
 *
 * Nothing is carried across such a gap: the record played on without anybody
 * watching, and guessing over it would land the board a minute out.
 */
const AWAY_MS = 400;

/**
 * How far out the clock may be before it is set rather than caught up with.
 *
 * Under this the disagreement is ordinary and gets absorbed by running at a
 * slightly different speed; see [CATCH_MS]. Over it the record is somewhere
 * else entirely and the board goes there at once, because there is no speed
 * that would reach the right place soon enough to be worth it.
 *
 * It does NOT end the run. That it used to is the whole of why the game was
 * unplayable: the player is read four times a second and guessed at between,
 * and a guess that misses by a quarter of a second is ordinary. Treating that
 * as somebody seeking the record away ended every run on the first note.
 */
const RESYNC_MS = 400;

/**
 * How a disagreement under that is settled: by running at a slightly different
 * speed until it is gone, never by moving the board.
 *
 * It used to be moved -- a fifth of the error applied to the position, four
 * times a second. That is a jump, and at the opening of a song it is a visible
 * one in both directions: the player's reported position is erratic for a
 * second or two after a seek while the renderer starts, so the corrections
 * disagree with each other and the board was seen stepping forwards and back
 * between about the third key and the seventh.
 *
 * Changing the rate cannot do that. The board stays a continuous function of
 * time -- it only ever runs a little fast or a little slow -- and since the
 * drift is bounded well inside unity it can never run backwards at all, which
 * is the half of the fault that was most obvious.
 *
 * Five percent is far below what the eye reads as a change of speed on a
 * falling object, and settles a tenth of a second of error in two seconds.
 */
const CATCH_MS = 500;
const MAX_DRIFT = 0.05;

const BACK = '#0b0d12';
const DIM = 'rgba(255,255,255,0.08)';
const TEXT = '#f4f6fb';
const MUTED = 'rgba(244,246,251,0.55)';
const FALLBACK_KEY = '#6f7cff';

/*
  The two colours a life changes hands in, and how far they are ever allowed
  to come up.

  The first version went to full opacity in a seventieth of a second, which is
  a flashbulb rather than a warning: the whole board jumped, and the thing a
  player was actually doing -- reading keys that are still falling -- got
  harder at exactly the moment it mattered. Now it barely rises at all, and
  takes long enough getting there that the eye reads it as the board colouring
  rather than as something striking it.

  Dim enough that it has to be described as a tint. That is the point: it is
  peripheral vision's job, and peripheral vision does not need much.
*/
const HURT = '#5c1020';
const HEAL = '#0f4a37';

/** How far up the wash ever comes. Nowhere near all the way. */
const HURT_PEAK = 0.26;
const HEAL_PEAK = 0.2;

/*
  And how slowly. A rise shorter than the time it takes to notice something is
  seen as a flicker; these are long enough to be seen arriving and leaving,
  which is what makes them soft rather than merely faint.
*/
const WASH_IN_MS = 180;
const WASH_OUT_MS = 520;

/*
  How a run that has ended is left on the board.

  It used to be wiped. The moment the last life went, every key vanished and a
  page of figures was put where they had been, so the one thing a player wants
  to know just then -- what happened -- was the first thing taken away. Now the
  board stops and stays, and the page comes up over it.

  Which of the two endings it was is kept where the board can read it, because
  the board is drawn on the other thread and has to know in the same frame the
  run ends, not a render later.
*/
const END_NONE = 0;
const END_LOST = 1;
const END_WON = 2;

/**
 * How long the board takes to come back to the key that was let past.
 *
 * A key is only lost once it has left the bottom, so at the moment it is lost
 * it is the one key that cannot be seen. The board is run back by the height
 * of it and set down with the key standing at the foot of its column. Long
 * enough to be seen as the board being brought back rather than as a jump,
 * short enough to be over before the page starts to arrive.
 */
const SETTLE_MS = 520;
const SETTLE = Easing.out(Easing.cubic);

/**
 * How far behind the sweep a stopped board looks for keys to draw.
 *
 * A running board draws from the oldest key still in sight. One that has been
 * run back has keys in sight again that the sweep had already left behind, and
 * this is how many of those it is prepared to find: a board's worth of rows,
 * doubled, with the longest hold on top.
 */
const BEHIND = 24;

/** The colour the move that ended the run is shown in. */
const BLAME = '#ff3b52';

/*
  When the page at the end arrives, and how slowly.

  After a loss it waits: the board has to come back, and the key or the tap
  that did it has to be looked at, before anything is laid over the top. After
  a run that reached the end there is nothing to study, so it comes sooner.
*/
const LOST_WAIT_MS = 950;
const WON_WAIT_MS = 400;
const RISE_MS = 650;

const CONFETTI_PIECES = 72;

/**
 * How long after everything has been stopped the screen is left.
 *
 * A few frames at any refresh rate: long enough for the other thread to have
 * finished the frame it was in when it was told to stop, short enough that
 * nobody pressing Back feels a wait.
 */
const LEAVE_AFTER_MS = 80;

/*
  The veil the page at the end is read through. Dark enough for figures and no
  darker, because what is behind it is the reason it is a veil; and thinner at
  whichever end the move that ended the run is at.
*/
const VEIL = ['rgba(11,13,18,0.6)', 'rgba(11,13,18,0.6)', 'rgba(11,13,18,0.6)'] as const;
const VEIL_OFF_FOOT = ['rgba(11,13,18,0.64)', 'rgba(11,13,18,0.6)', 'rgba(11,13,18,0.22)'] as const;
const VEIL_OFF_HEAD = ['rgba(11,13,18,0.22)', 'rgba(11,13,18,0.6)', 'rgba(11,13,18,0.64)'] as const;

type Phase = 'setup' | 'starting' | 'playing' | 'paused' | 'over';
/** How a run ended: a key let past, a tap on nothing, the end of the record, or cut short. */
type End = 'lapse' | 'empty' | 'won' | 'stopped';
/** The end of the board that holds the move worth seeing. */
type Keep = 'head' | 'foot' | null;
type Loading = 'idle' | 'making' | 'ready' | 'missing';

export default function TilesScreen() {
  const insets = useSafeAreaInsets();
  const { current, isPlaying } = usePlayerState();
  const { playQueue } = usePlayerActions();
  /*
    The record is chosen on the games screen and named here, rather than being
    whatever happened to be playing. Choosing a song to play a game with is a
    different act from choosing one to listen to, and the old arrangement meant
    a game could only be reached once something was already on.
  */
  const router = useRouter();
  const route = useLocalSearchParams<{ track?: string; title?: string }>();
  const asked = route.track ?? null;
  const trackId = asked ?? current?.id ?? null;

  /*
    What the record is called, which is not a question for the player.

    It used to be read off whatever was playing, and the game is opened on a
    record of the caller's choosing: with nothing playing it said `This record`,
    and with something else playing it named that instead -- the right keys
    under the wrong title. The name belongs to the record that was asked for,
    so it comes with the request, and is looked up only if it was left out.
  */
  const [looked, setLooked] = useState<string | null>(null);
  useEffect(() => {
    if (!asked || route.title) return;
    let live = true;
    findTrack(asked)
      .then((track) => {
        if (live) setLooked(track?.title ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [asked, route.title]);
  const title = asked
    ? (route.title ?? (current?.id === asked ? current.title : looked))
    : current?.title;

  const [board, setBoard] = useState({ width: 0, height: 0 });
  const [chart, setChart] = useState<Chart | null>(null);
  const [loading, setLoading] = useState<Loading>('idle');
  const [phase, setPhase] = useState<Phase>('setup');
  const [end, setEnd] = useState<End>('stopped');
  /*
    Whether paper is in the air, kept apart from which page is showing.

    It was drawn for as long as the winning page was, and so was taken off the
    screen the moment that page went -- by Again, pressed while it was still
    falling. A view taken away in the middle of being animated is the one thing
    the animation library does not survive; see `leave` below. So a burst is
    started by a win and ended only by itself.
  */
  const [paper, setPaper] = useState(false);
  const sPaper = useSharedValue(0);
  /** How far up the page at the end has come: held here so it can be stopped from here. */
  const sShown = useSharedValue(0);
  /** Which end of the board the page at the end stays off, if either. */
  const [keep, setKeep] = useState<Keep>(null);
  const [speed, setSpeed] = useState<Speed>(() => speedById(readSetting(SETTINGS.tilesDifficulty)));
  const [offset, setOffset] = useState(() => Number(readSetting(SETTINGS.tilesOffsetMs) ?? 0));
  const [score, setScore] = useState<Score>(NOTHING_YET);
  /*
    The sleeve's own colours, not one of them.

    The reader hands back several and only the last was ever used, which made
    every key a flat block. Kept whole, they paint the key the way the record
    is painted.
  */
  const [keyStops, setKeyStops] = useState<string[]>([FALLBACK_KEY]);
  const keyColour = useMemo(() => keyShades(keyStops)[1], [keyStops]);
  /** One palette per column, settled when the record is, never per frame. */
  const columns = useMemo(
    () => POOL_SLOTS.map((slot) => laneShades(keyStops, Math.floor(slot / PER_LANE), LANES)),
    [keyStops]
  );

  /*
    Everything the board is drawn from lives in shared values, because the board
    is drawn on the other thread and nothing it needs may be a React value —
    sixty reads a second through state would re-render the screen sixty times.
  */
  const songMs = useSharedValue(0);
  const reading = useSharedValue(-1);
  const lastFrame = useSharedValue(0);
  const running = useSharedValue(0);
  const playing = useSharedValue(0);
  const rate = useSharedValue(1);

  /**
   * How fast the clock is running against the frame timer, to settle a
   * disagreement with the player without moving the board. One is exact.
   */
  const drift = useSharedValue(1);

  const run = useSharedValue<Run | null>(null);
  /*
    Where each step of the chart falls in the recording, and how long a step is
    in the chart's own time.

    The chart is written on an even grid and the band did not play evenly, so
    the board reads the player's position through these: see `toGrid`. Every
    place below that asks "where is the song now" asks it in grid time, which
    is the only time the tiles are laid out in. What stays in the song's own
    time is what is about the recording itself -- how far through it is, and
    whether it has ended.
  */
  const sLines = useSharedValue<number[]>([]);
  const sStepMs = useSharedValue(0);
  const view = useSharedValue<number[]>(new Array(POOL * FIELDS).fill(0));
  /** The two the board is drawn into alternately; see the frame callback. */
  const pair = useSharedValue<number[][]>([]);
  /** How many slots of each column are lent out this frame. Kept rather than
      made, since it is cleared and refilled sixty times a second. */
  const lent = useSharedValue<number[]>([0, 0, 0, 0]);
  /** How long a row lasts and where the record ends, for the board to read. */
  const rowSpan = useSharedValue(0);
  const endsAt = useSharedValue(0);
  /** Keys taken since the last one was let past; see [CLEAN_FOR_A_LIFE]. */
  const sClean = useSharedValue(0);
  const turn = useSharedValue(0);

  /*
    The score, counted where it happens.

    It used to be React state written from the board through `runOnJS`, which
    meant a render of this screen on every single key -- and a render in the
    middle of an animation driven from the other thread is exactly the hitch
    that was being felt a few notes into a song. Nothing on the board needs
    React to know the count; only the figures at the top do, and those are
    copied over a few times a second by the effect below.
  */
  const sHit = useSharedValue(0);
  const sBonus = useSharedValue(0);
  const sMiss = useSharedValue(0);
  const sCombo = useSharedValue(0);
  const sBest = useSharedValue(0);
  const sLives = useSharedValue(LIVES);

  /*
    How brightly the whole board is lit by the last life lost or won.

    Over the board rather than only on the dots in the corner. A life is the
    thing a run actually ends by, and the corner is the one place a player
    cannot be looking at the moment it happens -- their eyes are on the keys
    arriving. A wash of colour across everything is seen without being looked
    at, which is the whole job.

    Up fast and down slow, because the opposite reads as a fade-in rather than
    as something striking.
  */
  const sHurt = useSharedValue(0);
  const sHeal = useSharedValue(0);

  /** How many holds have a finger on them, which is whether the breath is on. */
  const sHolding = useSharedValue(0);

  /*
    The ending, as the board knows it.

    `sEnd` is whether there has been one. While there has, the board is drawn
    at `sEndNow` instead of at the clock -- a moment that is held, or for a key
    let past, eased back to where that key can be seen.

    The rest is the move that did it. Either a key (`sLostAt` and its column
    and length) or a tap on nothing (`sSlipX`, `sSlipY`), and `sBlame` is how
    brightly it is shown, which breathes so that it is found at a glance on a
    board full of other keys.
  */
  const sEnd = useSharedValue(END_NONE);
  const sEndNow = useSharedValue(0);
  const sBlame = useSharedValue(0);
  const sLostLane = useSharedValue(-1);
  const sLostAt = useSharedValue(0);
  const sLostHold = useSharedValue(0);
  const sSlipOn = useSharedValue(0);
  const sSlipX = useSharedValue(0);
  const sSlipY = useSharedValue(0);

  /*
    Whether any of that is drawn at all.

    A shared value rather than a prop, because the frame callback is a worklet
    and cannot read React state. Read once as the screen is built: the switch
    is three screens away and getting to it means leaving the run.
  */
  const [still] = useState(motionReduced);
  const sStill = useSharedValue(still ? 1 : 0);

  const spanMs = useSharedValue(SPEEDS[2]!.onScreenMs);
  const travelPx = useSharedValue(0);
  const laneWidth = useSharedValue(0);
  const boardWidth = useSharedValue(0);
  const tallPx = useSharedValue(0);
  const aliveMs = useSharedValue(0);
  const offsetMs = useSharedValue(0);

  /** Which note each pointer took, so letting go releases the right one. */
  const touchNote = useSharedValue<number[]>(new Array(16).fill(-1));

  const lanePx = useMemo(() => (board.width > 0 ? board.width / LANES : 0), [board.width]);

  /*
    One size, always: three times as tall as it is wide. Not a share of the
    board and not a length of the song, both of which it has been — a key the
    player has learned the size of is a key they can aim at without looking,
    and one that changes with the record is one they have to read first.
  */
  const tileHeight = useMemo(() => Math.round(lanePx * TILE_ASPECT), [lanePx]);

  /**
   * How long a row lasts, and how long a tile is on the board.
   *
   * These are one fact rather than two. With the height fixed, the time a tile
   * takes to travel its own height is the time between tiles — that is what
   * makes a ladder with no gaps and no overlaps, rather than an arrangement
   * that happens not to collide.
   *
   * So the speed setting is a wish rather than an instruction. It says how long
   * a key should be in sight; from that comes a row length, which is then moved
   * to the nearest length the song's own grid divides into, so the ladder lands
   * on the music without straying far from the pace that was asked for -- see
   * `rowFor`. The time on screen is worked back out from the row it ended up
   * with, and the two cannot disagree because only one of them was chosen.
   */
  const { rowMs, spanFor } = useMemo(() => {
    const rows = board.height > 0 && tileHeight > 0 ? board.height / tileHeight : 1;
    const wanted = speed.onScreenMs / rows;
    const step = chart?.stepMs ?? 0;
    const row = rowFor(wanted, step, chart?.barSteps ?? 0);
    return { rowMs: row, spanFor: row * rows };
  }, [board.height, chart?.barSteps, chart?.stepMs, speed.onScreenMs, tileHeight]);

  useEffect(() => {
    boardWidth.set(board.width);
    laneWidth.set(lanePx);
    travelPx.set(board.height);
    tallPx.set(tileHeight);
    spanMs.set(spanFor);
    rowSpan.set(rowMs);
    aliveMs.set(aliveForMs(tileHeight, board.height, spanFor));
  }, [
    aliveMs,
    board.height,
    board.width,
    boardWidth,
    laneWidth,
    lanePx,
    rowMs,
    rowSpan,
    spanFor,
    spanMs,
    tallPx,
    tileHeight,
    travelPx,
  ]);

  useEffect(() => {
    offsetMs.set(offset);
  }, [offset, offsetMs]);

  useEffect(() => {
    playing.set(isPlaying ? 1 : 0);
  }, [isPlaying, playing]);

  /*
    The record is only held back while a run is actually being played, which is
    narrower than while this screen is open. Leaving on the way out is the last
    guard rather than the only one: the setup screen, the score at the end and
    anything reached from them are all places where somebody is listening
    rather than playing, and music quietly at half there would read as a fault
    in the app.
  */
  /*
    The mixer and the system server introduced while the setup page is being
    read, rather than on the first key of the song. Both answer instantly the
    second time; it is the first that was being felt a second or two in.
  */
  useEffect(() => {
    JukeboxAudio.prepareGame?.();
  }, []);

  useEffect(
    () => () => {
      JukeboxAudio.gameAudio?.(false);
      // The run started this record; leaving takes it with us rather than
      // letting it play on through the library behind.
      void JukeboxAudio.pauseAsync().catch(() => {});
    },
    []
  );

  /* The chart, made if it has not been made before. */
  useEffect(() => {
    let alive = true;
    setChart(null);
    if (!trackId) {
      setLoading('idle');
      return;
    }
    setLoading('making');
    JukeboxAudio.chartForAsync(trackId)
      .then((made) => {
        if (!alive) return;
        if (!made || made.notes.length === 0) {
          setLoading('missing');
          return;
        }
        setChart(made);
        setLoading('ready');
      })
      .catch(() => {
        if (alive) setLoading('missing');
      });
    return () => {
      alive = false;
    };
  }, [trackId]);

  /* A colour from the record, so the keys belong to the song being played. */
  useEffect(() => {
    let alive = true;
    setKeyStops([FALLBACK_KEY]);
    if (!trackId) return;
    JukeboxAudio.getEmbeddedArtworkAsync(trackId)
      .then((path) => (path ? JukeboxAudio.coverColoursAsync?.(path) : null))
      .then((stops) => {
        if (alive && stops && stops.length > 0) setKeyStops(stops);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trackId]);

  /**
   * The figures as they stand, read off the board.
   *
   * At the end of a run rather than on the timer: the timer is up to a fifth
   * of a second behind, and the page at the end is the one place the count is
   * read at leisure and has to be right.
   */
  const tally = useCallback(() => {
    setScore((was) => ({
      hit: sHit.value,
      bonus: sBonus.value,
      missed: sMiss.value,
      combo: sCombo.value,
      best: sBest.value,
      total: was.total,
    }));
  }, [sBest, sBonus, sCombo, sHit, sMiss]);

  /** Everything a run stops doing when it ends, however it ends. */
  const wound = useCallback(
    (how: End) => {
      running.set(0);
      tally();
      setEnd(how);
      setPhase('over');
      // A finger may still be down on a hold; the breath is not left running
      // under the page.
      sHolding.set(0);
      JukeboxAudio.held?.(false);
      JukeboxAudio.gameAudio?.(false);
      void JukeboxAudio.pauseAsync().catch(() => {});
    },
    [running, sHolding, tally]
  );

  /**
   * The last life went, to a key let past or to a tap on nothing.
   *
   * Where the move is decides where the page goes. A key let past always
   * stands at the foot of the board. A tap can be anywhere, so the page takes
   * whichever half of the screen the tap is not in.
   */
  const endRun = useCallback(
    (cause: 'lapse' | 'empty') => {
      setKeep(cause === 'lapse' || sSlipY.value >= travelPx.value / 2 ? 'foot' : 'head');
      wound(cause);
    },
    [sSlipY, travelPx, wound]
  );

  /** Nothing of an ending left on the board, for a run about to begin or be left. */
  const cleared = useCallback(() => {
    sEnd.set(END_NONE);
    sBlame.set(0);
    sLostLane.set(-1);
    sSlipOn.set(0);
  }, [sBlame, sEnd, sLostLane, sSlipOn]);

  /**
   * What the glass does under a finger, hit or not: a soft knock and a buzz.
   *
   * Neither is music and neither is told whether the key landed. Three goes at
   * answering a hit with sound all failed the same way, and the last of them --
   * turning the record itself up and down -- was heard as a fault rather than
   * as a reply. So the music is left alone and the glass answers the touch,
   * which is the one thing a touch is entitled to.
   *
   * One crossing to the other thread rather than two: both of these are calls
   * out of the process, and the hop that carries them is the expensive part.
   */
  const touched = useCallback((hit: boolean) => {
    JukeboxAudio.knocked?.(hit ? 'hit' : 'empty');
    JukeboxAudio.thump?.();
  }, []);

  /**
   * A key reached the bottom without being struck.
   *
   * No buzz with it, deliberately. The phone answers fingers, and nothing
   * touched the glass here -- a thump for something the player did not do would
   * be felt as a press they did not make. The sound carries it alone.
   */
  const escaped = useCallback(() => {
    JukeboxAudio.knocked?.('lapse');
  }, []);

  /**
   * What a held key sounds like: a breath while it is down, and one of two
   * endings.
   *
   * The breath is switched rather than played, and only at the edges -- when
   * the first finger settles on a hold and when the last one leaves -- so two
   * holds at once are one sound rather than two started on top of each other.
   *
   * Kept to the end, the ending is the reward: the rising sound, and the same
   * buzz a strike gets, because it is the one moment in a hold where the phone
   * has something to say. Let go of early, it is only a finger leaving.
   */
  const holding = useCallback((on: boolean) => {
    JukeboxAudio.held?.(on);
  }, []);
  const kept = useCallback(() => {
    JukeboxAudio.knocked?.('kept');
    JukeboxAudio.thump?.();
  }, []);
  const letGo = useCallback(() => {
    JukeboxAudio.knocked?.('letgo');
  }, []);

  /*
    The figures at the top, brought over a few times a second.

    Five a second rather than once a key, because that is how often a changing
    number can be read and a run of fast keys would otherwise be a run of
    renders. The count itself is never late -- it lives on the board and is
    exact there; only the reading of it is, by at most a fifth of a second.
  */
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      setScore((was) => {
        const now = {
          hit: sHit.value,
          bonus: sBonus.value,
          missed: sMiss.value,
          combo: sCombo.value,
          best: sBest.value,
          total: was.total,
        };
        // Compared before setting, or this is a render five times a second
        // whether or not anything has happened.
        const same =
          was.hit === now.hit &&
          was.bonus === now.bonus &&
          was.missed === now.missed &&
          was.combo === now.combo &&
          was.best === now.best;
        return same ? was : now;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [phase, sBest, sBonus, sCombo, sHit, sMiss]);

  /** The song ran out of notes. */
  /** The song ran out of notes. It stops with the run, like every other end. */
  const finished = useCallback(() => {
    setKeep(null);
    setPaper(true);
    wound('won');
  }, [wound]);

  /*
    There is deliberately no sound for a tap.

    Two goes at one taught the same lesson twice. A piano chord was wrong
    because it had a key and the record had another; drums were wrong because
    they had no key but were still an extra instrument laid over a finished
    mix, which is a drummer playing along badly with a record that already has
    one.

    Guitar Hero's answer is the one that holds: the hit adds nothing at all. It
    stops something being taken away. So a tap that lands is rewarded by the
    song simply staying whole, a tap that does not costs a band of it, and the
    only thing this screen ever puts into the mix is silence it gives back.

    The finger is still answered, just not with music -- the key dims under it
    and the phone ticks. Both arrive with the touch; neither is an instrument.
  */

  /*
    The clock.

    The player is asked where it is a few times a second and the gaps are
    filled in by counting frames. A reading that disagrees is always believed —
    eased in when it is close, taken at once when it is not — and never, under
    any circumstance, ends the run. The version before this one treated a
    quarter-second disagreement as the record having been seeked away, which is
    an ordinary amount for a four-times-a-second poll to be out by, and so it
    ended every run within a second of starting it.
  */
  const frame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const at = info.timeSinceFirstFrame;
      const elapsed = lastFrame.value === 0 ? 0 : at - lastFrame.value;
      lastFrame.value = at;
      const away = elapsed > AWAY_MS;

      let ms = songMs.value;
      if (!away && playing.value === 1) ms += elapsed * rate.value * drift.value;

      const fresh = reading.value;
      if (fresh >= 0) {
        reading.value = -1;
        const off = fresh - ms;
        if (off > RESYNC_MS || off < -RESYNC_MS) {
          // Somebody moved the record. There is nothing to catch up to
          // gradually: the board belongs somewhere else entirely.
          ms = fresh;
          drift.value = 1;
        } else {
          // Anything smaller is absorbed by the clock running a shade fast or
          // slow until it is gone. Nothing jumps, and nothing goes backwards.
          const want = off / CATCH_MS;
          drift.value = 1 + (want > MAX_DRIFT ? MAX_DRIFT : want < -MAX_DRIFT ? -MAX_DRIFT : want);
        }
      }
      songMs.value = ms;

      /*
        The record is over, so the run is. Watched here rather than left to the
        last key falling off the bottom: the ladder stops a row short of the
        end on most songs, and a board with nothing left on it and no ending is
        a game that has quietly stopped rather than finished.
      */
      if (running.value === 1 && endsAt.value > 0 && ms >= endsAt.value) {
        running.value = 0;
        // Held where it is, in this frame, so whatever is still on the board
        // stays on it instead of blinking out before the page arrives.
        sEnd.value = END_WON;
        sEndNow.value = toGrid(sLines.value, sStepMs.value, ms - offsetMs.value);
        runOnJS(finished)();
      }

      const notes = run.value;
      /*
        Two arrays, used turn and turn about, rather than one made every frame.

        Reanimated notices a shared value being *set*; it does not notice the
        contents of one being altered, so handing back the identical reference
        is indistinguishable from not having set it at all. The board drew
        nothing for exactly that reason once, which is why this stopped being
        one array written over.

        But a fresh one every frame is rubbish made sixty times a second on the
        thread that must not pause. Alternating between two is both things at
        once: the reference differs from last frame's, so the change is seen,
        and nothing is allocated after the first pass. The one being written is
        never the one the styles are reading.
      */
      if (pair.value.length === 0) {
        pair.value = [
          new Array<number>(POOL * FIELDS).fill(0),
          new Array<number>(POOL * FIELDS).fill(0),
        ];
      }
      const out = pair.value[turn.value]!;
      turn.value = turn.value === 0 ? 1 : 0;
      for (let index = 0; index < out.length; index++) out[index] = 0;
      /*
        A run that has ended is still drawn, at the moment it was stopped at
        rather than at the clock. Nothing on it is judged any more: every loop
        below that decides anything is switched off by this, and only the
        drawing is left.
      */
      const ended = sEnd.value !== END_NONE;
      if (!notes || (running.value === 0 && !ended)) {
        view.value = out;
        return;
      }

      const now = ended ? sEndNow.value : toGrid(sLines.value, sStepMs.value, ms - offsetMs.value);
      const span = spanMs.value;
      const travel = travelPx.value;
      const tall = tallPx.value;
      // A board that has not been measured yet gives a tile no height and so no
      // life, which would retire every note the moment it was due. Until there
      // is a real figure a note lives as long as it is on screen.
      const alive = aliveMs.value > 0 ? aliveMs.value : span;
      const count = notes.atMs.length;

      /*
        Anything whose tile has gone past the bottom is missed. There is no
        window and no line: a note is hittable for exactly as long as it can be
        seen, and missed the moment it cannot.
      */
      /*
        At most one life a frame.

        Not a rule of the game but a bound on how wrong anything else may go.
        Every version of this screen has at some point found a way to decide
        that a hundred notes were missed at once -- a clock that jumped, a board
        with no height -- and each time the whole run ended before a single tile
        was drawn. One a frame means a fault like that costs a life and a
        moment, and shows itself, rather than ending the game instantly.
      */
      let taken = 0;
      let index = notes.cursor;
      while (!ended && index < count && notes.atMs[index]! - span <= now) {
        const state = notes.state[index]!;
        if (state === 0 && now - notes.atMs[index]! > alive) {
          if (taken > 0) break;
          taken++;
          // Three rather than two: finished with, but never struck. The two
          // are drawn the same and only one of them earns a flash.
          notes.state[index] = 3;
          notes.doneAt[index] = now;
          sMiss.value += 1;
          sCombo.value = 0;
          sClean.value = 0;
          sLives.value -= 1;
          /*
            Bounded to one a frame by the same counter that bounds the life, so
            a clock that jumped cannot fire a burst of these at once -- which
            would be both a machine-gun and the loudest thing in the room.
          */
          runOnJS(escaped)();
          // The sound still carries it. What goes is the light, which is the
          // part that costs a frame on a phone that has none to spare.
          if (sStill.value === 0) {
            sHurt.value = withSequence(
              withTiming(HURT_PEAK, { duration: WASH_IN_MS }),
              withTiming(0, { duration: WASH_OUT_MS })
            );
          }
          /*
            The last one. The run is stopped here, in the frame it happens,
            rather than when the other side gets round to it: a board that ran
            on for the few frames in between would be a board the player was
            still being judged on after losing.

            And the board is sent back to this key. It has just left the
            bottom -- that is what losing it means -- so it is the one key that
            cannot be seen, and it is the one that has to be. Run back to the
            moment it was due, it stands at the foot of its column.
          */
          if (sLives.value <= 0) {
            running.value = 0;
            sEnd.value = END_LOST;
            sLostLane.value = notes.lane[index]!;
            sLostAt.value = notes.atMs[index]!;
            sLostHold.value = notes.holdMs[index]!;
            sEndNow.value = now;
            if (sStill.value === 1) {
              sEndNow.value = notes.atMs[index]!;
              sBlame.value = 0.8;
            } else {
              sEndNow.value = withTiming(notes.atMs[index]!, { duration: SETTLE_MS, easing: SETTLE });
              sBlame.value = withSequence(
                withTiming(0.85, { duration: 220 }),
                withRepeat(withTiming(0.45, { duration: 640 }), -1, true)
              );
            }
            runOnJS(endRun)('lapse');
            break;
          }
        } else if (state === 1 && now >= holdWonAt(notes.atMs[index]!, notes.holdMs[index]!)) {
          /*
            Held long enough. The key itself was counted when it was struck, and
            this is what keeping it down was worth -- a point a row, so a key
            four rows long is worth four and not the same one a tap beside it
            earns. It was worth one however long it was, which made the longest
            thing on the board the least rewarding.
          */
          notes.state[index] = 2;
          notes.doneAt[index] = now;
          notes.fill[index] = 1;
          notes.held[notes.lane[index]!] = -1;
          sBonus.value += holdWorth(notes.holdMs[index]!, rowSpan.value) - 1;
          /*
            Said here, at the moment it is won, rather than when the finger
            comes off. The gauge has just filled and that is the instant the
            player is looking for; a reward held back until they lift would
            arrive late for anyone who lingers and never for anyone who does
            not notice they may let go.
          */
          if (sHolding.value > 0) sHolding.value -= 1;
          if (sHolding.value === 0) runOnJS(holding)(false);
          runOnJS(kept)();
        }
        index++;
      }
      /*
        The cursor follows the bottom of the board rather than the last press.
        A struck key is finished with as far as the rules go, but it is still a
        thing on screen until it has fallen off, and drawing begins wherever
        the oldest visible tile is.
      */
      while (
        !ended &&
        notes.cursor < count &&
        notes.state[notes.cursor] >= 2 &&
        now - notes.atMs[notes.cursor]! > alive + notes.holdMs[notes.cursor]!
      ) {
        notes.cursor++;
      }

      if (running.value === 1 && notes.cursor >= count) {
        running.value = 0;
        sEnd.value = END_WON;
        sEndNow.value = now;
        runOnJS(finished)();
      }

      /* What is on the board, each lent a slot of its own column. */
      const used = lent.value;
      used[0] = 0;
      used[1] = 0;
      used[2] = 0;
      used[3] = 0;
      /*
        A stopped board looks behind the sweep as well. Run back, it has keys
        in sight again that had already been finished with and passed over, the
        lost one among them.
      */
      const stopped = sEnd.value !== END_NONE;
      const lost = sEnd.value === END_LOST ? sLostAt.value : -1;
      let note = stopped ? (notes.cursor > BEHIND ? notes.cursor - BEHIND : 0) : notes.cursor;
      while (note < count) {
        const born = notes.atMs[note]! - span;
        if (born > now) break;
        /*
          A held key is as long as its tail, and it has not left the board
          until the top of that tail has. Judged by the key alone it vanished
          whole the moment its foot went past the bottom -- with most of it
          still on screen, which reads as it being snatched away rather than
          as it leaving.
        */
        const spent = notes.state[note]! >= 2;
        if (!spent || now - notes.atMs[note]! <= alive + notes.holdMs[note]!) {
          /*
            A held key falls like any other.

            It used to be pinned to the bottom while its tail was eaten away,
            which hid the one thing a player wants to see: how much of the hold
            is left. Falling, the part still above the bottom edge is exactly
            what has still to be held, and the part gone past it is what has
            been. Nothing has to be drawn for that -- it is what the board
            already does.
          */
          const lane = notes.lane[note]!;
          const taken = used[lane]!;
          if (taken >= PER_LANE) {
            note++;
            continue;
          }
          used[lane] = taken + 1;

          const held = notes.state[note] === 1;
          const holdMs = notes.holdMs[note]!;
          const place = tileAt(notes.atMs[note]!, holdMs, now, span, travel, tall);
          const foot = place.foot;
          const tail = (holdMs / span) * travel;
          const base = (lane * PER_LANE + taken) * FIELDS;
          out[base + F_Y] = foot - BOX;
          out[base + F_TAIL] = tail;
          out[base + F_ON] = 1;
          /*
            The key that ended the run is drawn whole, not dimmed with the rest
            of what is finished with. It is about to be coloured in over the
            top, and colour laid on a key at a quarter strength is colour laid
            on nothing.
          */
          const blamed =
            lost >= 0 && notes.state[note] === 3 && notes.atMs[note] === lost && lane === sLostLane.value;
          out[base + F_LIT] = blamed ? 1 : spent ? SPENT_INK : held ? 1 : 0.92;
          /*
            How far along the hold is. Live while a finger is on it, and
            whatever it reached once it is over -- which is kept rather than
            worked out from the ending, so a hold nobody touched stays at
            nothing instead of being drawn as half kept.
          */
          if (holdMs > 0) {
            let fill = notes.fill[note]!;
            if (held) {
              /*
                From the press to the moment the hold is won, which is not the
                same span for every player: pressing early leaves more of the
                key to keep down, and the gauge should cross its whole length
                over however much of it is left rather than sitting at nothing
                until the key is nominally due.
              */
              const from = notes.heldFrom[note]!;
              const span = holdWonAt(notes.atMs[note]!, holdMs) - from;
              fill = span > 0 ? (now - from) / span : 1;
              fill = fill < 0 ? 0 : fill > 1 ? 1 : fill;
            }
            out[base + F_FILL] = fill;
            /*
              A slow breath while a finger is on it, so a hold is visibly alive
              rather than a bar that happens to be growing. Taken off the song
              clock rather than a counter, so every held key anywhere on the
              board breathes together instead of each keeping its own time.
            */
            out[base + F_GLOW] = held ? 0.78 + 0.22 * Math.sin(now / 95) : 0;
          }
          /*
            The light of the strike, falling away from the moment of it. Only
            for keys that were actually struck: a note that went past unplayed
            is finished with as well, and must not be rewarded with a flash.
          */
          /*
            And only off a tap. The bloom is drawn the size of one key, which
            on a hold several keys long is a flash across a piece of it -- a
            bright patch in the middle of something, which reads as a fault
            rather than as light.
          */
          /*
            And never on a board that has stopped. The light is measured from
            the clock, and a clock that is held would hold the flash half lit
            for as long as the page is up -- or, run backwards, play it again.
          */
          if (!stopped && notes.state[note] === 2 && holdMs === 0) {
            const since = now - notes.doneAt[note]!;
            if (since >= 0 && since < FLASH_MS) out[base + F_FLASH] = 1 - since / FLASH_MS;
          }
          /*
            And the light of a hold kept to the end, which is the whole key
            rather than a patch of it.

            A full gauge is what marks it: a hold let go of early is finished
            with too, but its gauge stopped short, and it gets nothing. This is
            the thing the tap's flash could not be -- that one is the size of a
            single key, and across a hold four keys long it was a bright square
            in the middle of something. This one is drawn the length of the
            hold, so the whole of what was held lights at once.
          */
          if (
            !stopped &&
            holdMs > 0 &&
            notes.state[note] === 2 &&
            notes.fill[note]! >= 1 &&
            sStill.value === 0
          ) {
            const since = now - notes.doneAt[note]!;
            if (since >= 0 && since < KEPT_MS) out[base + F_KEPT] = 1 - since / KEPT_MS;
          }
        }
        note++;
      }
      view.value = out;
    },
    [
      aliveMs,
      finished,
      laneWidth,
      lastFrame,
      endRun,
      drift,
      endsAt,
      lent,
      offsetMs,
      pair,
      playing,
      sBonus,
      sCombo,
      sLives,
      sMiss,
      rate,
      reading,
      run,
      running,
      rowSpan,
      sBlame,
      sClean,
      sEnd,
      sEndNow,
      sLostAt,
      sLostHold,
      sLostLane,
      sLines,
      sStepMs,
      sStill,
      songMs,
      spanMs,
      tallPx,
      travelPx,
      turn,
      view,
    ]
  );
  const ticking = useFrameCallback(frame);

  /*
    Touch.

    One handler over the whole board with a lane and a note remembered per
    pointer, rather than four handlers, so two keys can be struck at once and a
    finger that slides off a held key lets go of the right one.
  */
  const lanes = useMemo(
    () =>
      Gesture.Manual()
        .onTouchesDown((event, manager) => {
          'worklet';
          for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i]!;
            const lane = laneAt(touch.x, boardWidth.value);

            /*
              The glass answers every touch, whether or not a key was there.

              A click and a knock, both of which arrive with the finger and
              neither of which is music: the click carries no pitch and the
              knock is the phone. What tells the player they were *right* is
              the record swelling a moment later, and keeping the two apart is
              deliberate -- the immediate answer is to the touch, the musical
              answer is to the playing.
            */
            /*
              A board that has stopped at the end of a run does not answer at
              all. Somebody who has just lost is usually still tapping, and
              those taps belong to the run that is over: a knock for each would
              be the stopped board rattling under the page.
            */
            if (sEnd.value !== END_NONE) continue;

            const notes = run.value;
            if (!notes || running.value === 0) {
              runOnJS(touched)(false);
              continue;
            }

            const now = toGrid(sLines.value, sStepMs.value, songMs.value - offsetMs.value);
            const span = spanMs.value;
            const travel = travelPx.value;
            const tall = tallPx.value;
            const count = notes.atMs.length;

            /*
              Whatever is under the finger. Either a key is there or the board
              is, and those are the only two outcomes — there is no window to
              be outside of and no grade to be given.
            */
            let found = -1;
            for (let index = notes.cursor; index < count; index++) {
              if (notes.atMs[index]! - span > now) break;
              if (notes.state[index] !== 0) continue;
              if (notes.lane[index] !== lane) continue;
              if (touching(touch.y, notes.atMs[index]!, notes.holdMs[index]!, now, span, travel, tall)) {
                found = index;
                break;
              }
            }

            /*
              The glass answers every touch, hit or not, and it answers once.

              A click and a knock, both of which arrive with the finger and
              neither of which is music; on a hit, the record also leans into
              the moment the key landed on. Sent in one crossing to the other
              thread, after the search rather than before it, because the
              search is a few microseconds and the crossing is not.
            */
            runOnJS(touched)(found >= 0);

            if (found < 0) {
              sMiss.value += 1;
              sCombo.value = 0;
              sClean.value = 0;
              sLives.value -= 1;
              /*
                The same light as a key let past, because it is the same loss.
                This was missing: a tap on nothing took a life and said so only
                with the dot in the corner, which is the one place a player
                with a finger on the glass is not looking.
              */
              if (sStill.value === 0) {
                sHurt.value = withSequence(
                  withTiming(HURT_PEAK, { duration: WASH_IN_MS }),
                  withTiming(0, { duration: WASH_OUT_MS })
                );
              }
              /*
                The last one, and this time the move is the tap itself. The
                board stops exactly where it is, because where it is is the
                evidence: the mark goes down under the finger, and the keys
                around it show what the finger was aiming at.
              */
              if (sLives.value <= 0) {
                running.value = 0;
                sEnd.value = END_LOST;
                sEndNow.value = now;
                sLostLane.value = -1;
                sSlipX.value = touch.x;
                sSlipY.value = touch.y;
                sSlipOn.value = 1;
                sBlame.value =
                  sStill.value === 1
                    ? 0.9
                    : withSequence(
                        withTiming(1, { duration: 160 }),
                        withRepeat(withTiming(0.62, { duration: 640 }), -1, true)
                      );
                runOnJS(endRun)('empty');
              }
              continue;
            }

            sHit.value += 1;
            sCombo.value += 1;
            if (sCombo.value > sBest.value) sBest.value = sCombo.value;
            /*
              Fifty taken without letting one past, and a life comes back.

              Counted here rather than off the combo, because a combo is also
              broken by a hold let go of early and that is not damage -- it
              costs the bonus and nothing else. What this counts is keys that
              were not lost.
            */
            sClean.value += 1;
            if (sClean.value >= CLEAN_FOR_A_LIFE) {
              sClean.value = 0;
              /*
                Only lit when one is actually given back. Fifty clean keys with
                all three lives still in hand is worth knowing about, but a
                light for a life that was not granted is a light that lies.
              */
              if (sLives.value < LIVES) {
                sLives.value += 1;
                if (sStill.value === 0) {
                  sHeal.value = withSequence(
                    withTiming(HEAL_PEAK, { duration: WASH_IN_MS }),
                    withTiming(0, { duration: WASH_OUT_MS })
                  );
                }
              }
            }

            /*
              A held key is won the moment it is struck.

              Keeping it down is worth more, and letting go early costs
              nothing: a hold that could take a life was a punishment for
              reaching for one of the other three lanes, which go on arriving
              while a thumb is pinned to the glass.
            */
            if (notes.holdMs[found]! > 0) {
              notes.state[found] = 1;
              // The gauge is measured from here rather than from when the key
              // was due, so it begins moving under the finger that began it.
              notes.heldFrom[found] = now;
              notes.held[lane] = found;
              sHolding.value += 1;
              if (sHolding.value === 1) runOnJS(holding)(true);
              if (touch.id >= 0 && touch.id < touchNote.value.length) {
                touchNote.value[touch.id] = found;
              }
            } else {
              notes.state[found] = 2;
              notes.doneAt[found] = now;
            }
          }
          manager.activate();
        })
        .onTouchesUp((event, manager) => {
          'worklet';
          const notes = run.value;
          for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i]!;
            if (touch.id < 0 || touch.id >= touchNote.value.length) continue;
            const index = touchNote.value[touch.id]!;
            touchNote.value[touch.id] = -1;
            if (!notes || index < 0) continue;
            // Let go early. The key was struck and counted when it was; all
            // that is lost is what holding it to the end would have added.
            if (notes.state[index] === 1) {
              const at = toGrid(sLines.value, sStepMs.value, songMs.value - offsetMs.value);
              notes.state[index] = 2;
              notes.doneAt[index] = at;
              const from = notes.heldFrom[index]!;
              const whole = holdWonAt(notes.atMs[index]!, notes.holdMs[index]!) - from;
              const got = whole > 0 ? (at - from) / whole : 1;
              /*
                Short of full, always. A full gauge is how the board knows a
                hold was kept, and one let go of in the last instant before it
                was won has not been -- it gets no bonus, so it must not get
                the light either.
              */
              notes.fill[index] = got < 0 ? 0 : got > 0.999 ? 0.999 : got;
              notes.held[notes.lane[index]!] = -1;
              if (sHolding.value > 0) sHolding.value -= 1;
              if (sHolding.value === 0) runOnJS(holding)(false);
              runOnJS(letGo)();
            }
          }
          if (event.numberOfTouches === 0) manager.end();
        })
        .onTouchesCancelled((_event, manager) => {
          'worklet';
          manager.end();
        }),
    [
      boardWidth,
      endRun,
      offsetMs,
      run,
      running,
      sBest,
      sBlame,
      sCombo,
      sEnd,
      sEndNow,
      sHit,
      sLives,
      sLostLane,
      sMiss,
      sSlipOn,
      sSlipX,
      sSlipY,
      sLines,
      sStepMs,
      sStill,
      songMs,
      spanMs,
      tallPx,
      touchNote,
      touched,
      travelPx,
    ]
  );

  /**
   * Where the record is, once it has stopped moving from where it was.
   *
   * Asked repeatedly rather than once: a seek is not instant and the first few
   * answers are about the position before it. Gives up after a moment and
   * answers with whatever it last heard, because a run that cannot start is
   * worse than one that starts a little out.
   */
  const settled = useCallback(async () => {
    let last = 0;
    for (let tries = 0; tries < 24; tries++) {
      const status = await JukeboxAudio.getStatusAsync().catch(() => null);
      if (status) last = Math.max(0, Math.round((status.positionSec ?? 0) * 1000));
      /*
        Two things have to be true, not one.

        Landing near the top was the first, and on its own it let a run start
        while the player was still filling itself from the beginning of the
        file. The music then stuttered a second or two in -- which is exactly
        where it was being heard -- because the decoder was still catching up
        with a seek while the board, the touches and the first keys all arrived
        at once. Waiting for the buffer as well costs a few tenths of a second
        before the first tile and buys the opening of the song.
      */
      if (status && last < 1500 && status.isBuffering !== true) return last;
      await new Promise((wake) => setTimeout(wake, 80));
    }
    return last;
  }, []);

  const begin = useCallback(async () => {
    if (!chart) return;
    setPhase('starting');

    /*
      The record goes back to the top and the run waits for it. Not waiting is
      how the board ended up seconds apart from the music, which was the
      beginning of every other fault in the old version of this screen.
    */
    // If the game was opened on a record other than the one playing, that is
    // the one it is played against.
    if (asked && current?.id !== asked) {
      const track = await findTrack(asked).catch(() => null);
      if (track) await playQueue([track], 0).catch(() => {});
    }
    await JukeboxAudio.seekToAsync(0).catch(() => {});
    await JukeboxAudio.playAsync().catch(() => {});

    /*
      And then wait until the player says it is there.

      Asking is not arriving. For a little while after a seek the player goes
      on reporting where the record used to be, and that reading is believed by
      the clock -- which puts the board wherever the record was a moment ago,
      finds every note behind it, and counts them all as missed. Three lives go
      in three frames and no tile is ever drawn. Waiting for the answer to
      agree with the question is the only way to tell the two apart.
    */
    const landed = await settled();

    /*
      A whole board's worth of lead, so the first key is watched the whole way
      down rather than appearing part way. The ladder is counted from the start
      of the record, so whatever this skips is rows, never fractions of one.
    */
    const lines = chart.lines ?? [];
    const playable = ladderFrom(
      chart,
      // The record was asked where it is; the ladder is asked where to begin,
      // and those are the same moment in two different times.
      toGrid(lines, chart.stepMs, landed),
      rowMs,
      spanFor + 250,
      LANES,
      speed.doubleEvery
    );

    /*
      Armed only now rather than when the screen appeared, and armed is all it
      is: the record plays exactly as mastered until a key lands on it. What a
      run does to the sound is add to a moment, never take one away, so there
      is nothing for the setup page or the score page to be missing.
    */
    JukeboxAudio.gameAudio?.(playable.length > 0);

    sHit.value = 0;
    sBonus.value = 0;
    sMiss.value = 0;
    sCombo.value = 0;
    sBest.value = 0;
    sLives.value = LIVES;
    sClean.value = 0;
    sHolding.value = 0;
    cleared();
    setEnd('stopped');
    endsAt.set(chart.durationMs);
    sLines.set(lines);
    sStepMs.set(chart.stepMs);
    setScore({ ...NOTHING_YET, total: playable.length });
    run.set(runOf(playable));
    songMs.set(landed);
    reading.set(-1);
    lastFrame.set(0);
    drift.set(1);
    running.set(playable.length > 0 ? 1 : 0);
    setPhase(playable.length > 0 ? 'playing' : 'over');
  }, [
    asked,
    chart,
    cleared,
    current?.id,
    lastFrame,
    playQueue,
    reading,
    rowMs,
    run,
    running,
    endsAt,
    sBest,
    sBonus,
    sClean,
    sCombo,
    sHit,
    sLines,
    sLives,
    sMiss,
    sStepMs,
    settled,
    speed.doubleEvery,
    songMs,
    spanFor,
  ]);

  /*
    Stopping stops the music too.

    The record was started by the run and belongs to it: left playing on the
    score page it is a song nobody asked for, carrying on into whatever comes
    after the game and then into the next track in the queue.
  */
  /*
    Stopping is a question, not an answer.

    The run and the record both hold where they are; nothing is scored and
    nothing is lost. Which is why the board freezes rather than carrying on
    behind the sheet: a key that went past while somebody was reading a menu
    would be a life taken by the menu.
  */
  const pause = useCallback(() => {
    running.set(0);
    setPhase('paused');
    // A breath left running under the pause sheet would be the one thing still
    // going on a board that has stopped.
    sHolding.set(0);
    JukeboxAudio.held?.(false);
    void JukeboxAudio.pauseAsync().catch(() => {});
  }, [running, sHolding]);

  const resume = useCallback(() => {
    setPhase('playing');
    /*
      The clock is told to forget the gap. Frames stopped arriving while the
      sheet was up, and the first one back would otherwise be read as the app
      having been away -- or worse, as a single frame several seconds long.
    */
    lastFrame.set(0);
    reading.set(-1);
    drift.set(1);
    running.set(1);
    void JukeboxAudio.playAsync().catch(() => {});
  }, [drift, lastFrame, reading, running]);

  const toMenu = useCallback(() => {
    running.set(0);
    cleared();
    run.set(null);
    setScore(NOTHING_YET);
    setPhase('setup');
    JukeboxAudio.gameAudio?.(false);
    void JukeboxAudio.pauseAsync().catch(() => {});
  }, [cleared, run, running]);

  /** Cut short from outside: the record under the run was changed. */
  const stop = useCallback(() => {
    setKeep(null);
    wound('stopped');
  }, [wound]);

  /*
    Leaving, which has to be done in two steps.

    Everything on this screen is moved from the other thread, and a view that
    is taken away while it is still being moved is never forgotten there: the
    animation library goes on trying to move it, fails, and tries again on
    every scroll of every list for as long as the app is open. A win left in
    its first seconds, with seventy scraps of paper in the air, left a hundred
    and seventy-five such views behind, and the library then spent a hundred
    and fifty milliseconds a frame failing to move them -- which is what a
    stuttering library screen turned out to be.

    So nothing here is allowed to be moving when the screen goes. Everything is
    stopped first, the other thread is given a few frames to finish what it had
    already begun, and only then is the screen left.
  */
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    running.set(0);
    ticking.setActive(false);
    for (const moving of [sBlame, sEndNow, sHurt, sHeal, sPaper, sShown]) cancelAnimation(moving);
    setTimeout(() => router.back(), LEAVE_AFTER_MS);
  }, [router, running, sBlame, sEndNow, sHeal, sHurt, sPaper, sShown, ticking]);

  /*
    Back belongs to the run before it belongs to the navigator.

    Leaving mid-song by catching the edge of the screen is a run thrown away by
    accident, and the gesture is easy to make by mistake on a phone held with
    one hand while the other is playing. So while a run is on, back holds it;
    from the held screen it goes to the menu; and only from the menu does it
    mean what it usually means.
  */
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'playing') {
        pause();
        return true;
      }
      if (phase === 'paused') {
        toMenu();
        return true;
      }
      // Out of the screen, but not by simply dropping it: see `leave`.
      leave();
      return true;
    });
    return () => listener.remove();
  }, [leave, pause, phase, toMenu]);

  const again = useCallback(() => {
    running.set(0);
    cleared();
    run.set(null);
    setScore(NOTHING_YET);
    setPhase('setup');
  }, [cleared, run, running]);

  /* A run belongs to the record it began on. */
  const ranOn = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'playing') ranOn.current = trackId;
  }, [phase, trackId]);
  useEffect(() => {
    if (phase === 'playing' && ranOn.current !== trackId) stop();
  }, [phase, stop, trackId]);

  const chooseSpeed = useCallback((next: Speed) => {
    setSpeed(next);
    writeSetting(SETTINGS.tilesDifficulty, next.id);
  }, []);

  const nudge = useCallback((by: number) => {
    setOffset((was) => {
      const next = Math.max(-400, Math.min(400, was + by));
      writeSetting(SETTINGS.tilesOffsetMs, String(next));
      return next;
    });
  }, []);


  return (
    <GestureHandlerRootView style={styles.screen}>
      <Pulse into={reading} />

      <GestureDetector gesture={lanes}>
        <View
          style={styles.board}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setBoard((was) =>
              was.width === width && was.height === height ? was : { width, height }
            );
          }}>
          {/*
            Something to fall through rather than nothing.

            A drawn picture rather than a drawn scene: a starfield made of
            views would be a hundred of them sitting in the tree for the whole
            of a run, each costing a little of every frame, to say something a
            single image says for free. It never moves and never changes, which
            is the point -- the eye should find it once and then stop looking
            at it.
          */}
          <Image
            source={require('../../assets/space.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            pointerEvents="none"
            cachePolicy="memory-disk"
            transition={0}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.settle]} />
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {[1, 2, 3].map((edge) => (
              <View key={edge} style={[styles.rule, { left: edge * lanePx }]} />
            ))}
            {POOL_SLOTS.map((slot) => (
              <Tile
                key={slot}
                slot={slot}
                view={view}
                lane={Math.floor(slot / PER_LANE)}
                width={lanePx}
                height={tileHeight}
                shades={columns[slot]!}
              />
            ))}
            {/*
              The move that ended the run, over the keys and under everything
              else. Two views for the whole board rather than a layer on every
              key: only one key is ever the one, and a layer on all sixteen
              would be sixteen styles worked out every frame of every run to
              show something that happens once at the end of some of them.
            */}
            <Lost
              lane={sLostLane}
              atMs={sLostAt}
              holdMs={sLostHold}
              now={sEndNow}
              lit={sBlame}
              span={spanMs}
              travel={travelPx}
              width={lanePx}
              height={tileHeight}
            />
            <Slip on={sSlipOn} x={sSlipX} y={sSlipY} lit={sBlame} size={Math.round(lanePx * 0.6)} />
          </View>
        </View>
      </GestureDetector>

      {/*
        Laid over the board rather than above it, so the game has the whole
        screen and the figures sit on top of the keys falling behind them.
        `box-none` so only the button takes a touch -- everything else here is
        something to read, and a finger landing on it is a finger aiming at a
        key that happens to be underneath.
      */}
      <Wash tint={sHurt} colour={HURT} />
      <Wash tint={sHeal} colour={HEAL} />
      {/* The dots still go out; they simply stop taking a quarter-second
          about it. */}

      {/*
        Still there once the run is over, without the button. The last dot goes
        out in it, and a count that vanished in the same instant as the life it
        was counting would be the old abrupt ending in miniature.
      */}
      {phase === 'playing' || phase === 'paused' || (phase === 'over' && end !== 'stopped') ? (
        <View pointerEvents="box-none" style={[styles.hud, { paddingTop: insets.top + 8 }]}>
          <View style={styles.tally}>
            <Text style={styles.score}>{pointsOf(score)}</Text>
            <View style={styles.lives}>
              {Array.from({ length: LIVES }, (_, slot) => (
                <Life key={slot} slot={slot} left={sLives} still={sStill} />
              ))}
            </View>
          </View>
          <Progress at={songMs} ofMs={chart?.durationMs ?? 0} />
          <Pressable
            accessibilityRole="button"
            onPress={pause}
            disabled={phase === 'over'}
            style={[styles.stop, phase === 'over' && styles.gone]}>
            <View style={styles.pauseBars}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          </Pressable>
        </View>
      ) : null}

      {phase === 'paused' ? (
        <View style={styles.pauseScreen}>
          <Text style={styles.pauseTitle}>Paused</Text>
          <Pressable accessibilityRole="button" style={styles.go} onPress={resume}>
            <Text style={styles.goLabel}>Continue</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.quiet} onPress={toMenu}>
            <Text style={styles.quietLabel}>Back to the menu</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'setup' || phase === 'starting' ? (
        <View style={[styles.sheet, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          {/*
            The way out, where every other screen keeps it.

            This screen has no header of its own, so until now the only way
            back to the library was the system gesture -- which is there, and
            which nobody should have to know about to leave a screen.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={14}
            onPress={leave}
            style={[styles.leave, { top: insets.top + 12 }]}>
            <BackIcon size={24} color={TEXT} />
          </Pressable>
          <Text style={styles.title}>Play along</Text>

          {!trackId ? (
            <Text style={styles.note}>Start a track and the keys are built from it.</Text>
          ) : loading === 'making' ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={TEXT} />
              <Text style={styles.note}>Listening to the record…</Text>
            </View>
          ) : loading === 'missing' ? (
            <Text style={styles.note}>This one cannot be read.</Text>
          ) : (
            <>
              <Text style={styles.note}>
                {title ?? 'This record'} — {chart?.notes.length ?? 0} keys
              </Text>

              <View style={styles.row}>
                {SPEEDS.map((option) => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    onPress={() => chooseSpeed(option)}
                    style={[styles.chip, option.id === speed.id && styles.chipOn]}>
                    <Text style={[styles.chipLabel, option.id === speed.id && styles.chipLabelOn]}>
                      {option.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.small}>
                Sound reaches a wireless headphone late. If the keys feel behind the music, move
                this until they agree.
              </Text>
              <View style={styles.row}>
                <Pressable style={styles.chip} onPress={() => nudge(-20)}>
                  <Text style={styles.chipLabel}>−20 ms</Text>
                </Pressable>
                <Text style={styles.offset}>{offset} ms</Text>
                <Pressable style={styles.chip} onPress={() => nudge(20)}>
                  <Text style={styles.chipLabel}>+20 ms</Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={loading !== 'ready' || phase === 'starting'}
                style={[styles.go, { backgroundColor: keyColour }, phase === 'starting' && styles.goOff]}
                onPress={() => void begin()}>
                <Text style={styles.goLabel}>
                  {phase === 'starting' ? 'Starting…' : 'Play from the top'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {phase === 'over' ? (
        <Ending
          end={end}
          score={score}
          colour={keyColour}
          still={still}
          top={insets.top}
          bottom={insets.bottom}
          keep={keep}
          shown={sShown}
          clear={
            end === 'lapse'
              ? Math.min(tileHeight, board.height * 0.38)
              : end === 'empty'
                ? board.height * 0.5
                : 0
          }
          onAgain={again}
        />
      ) : null}

      {/*
        Over the page as well as the board. Under it the paper would be dimmed
        by the same veil that dims the keys, and dimmed confetti is litter.
      */}
      {paper && !still && board.width > 0 ? (
        <Confetti
          width={board.width}
          height={board.height}
          colour={keyColour}
          clock={sPaper}
          onDone={() => setPaper(false)}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

/**
 * The page a run ends on, brought up over the board it ended on.
 *
 * A veil rather than a wall: the board is still there behind it, stopped, with
 * the move that ended the run marked on it. It comes up slowly and after a
 * moment, so there is time to see that move before anything covers it.
 *
 * The button is dead until the page has actually arrived. Somebody who has
 * just lost is usually still tapping, and a button that faded in under a
 * finger already on its way down would start the next run by accident.
 *
 * The end of the board that holds the move is kept clear, and the veil thins
 * towards it: that is where the thing worth seeing is, and the figures have
 * the rest of the screen.
 */
function Ending({
  end,
  score,
  colour,
  still,
  top,
  bottom,
  keep,
  clear,
  shown,
  onAgain,
}: {
  end: End;
  score: Score;
  colour: string;
  still: boolean;
  top: number;
  bottom: number;
  /** Which end of the board to stay off, and how much of it, in points. */
  keep: Keep;
  clear: number;
  /** How far up the page has come, nought to one. Held by the screen, which may have to stop it. */
  shown: SharedValue<number>;
  onAgain: () => void;
}) {
  const wait = still || end === 'stopped' ? 0 : end === 'won' ? WON_WAIT_MS : LOST_WAIT_MS;
  const [armed, setArmed] = useState(still);

  useEffect(() => {
    if (still) {
      shown.value = 1;
      return;
    }
    shown.value = 0;
    shown.value = withDelay(wait, withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.quad) }));
    /*
      Not until the page has finished arriving, and a moment past. Again takes
      this page off the screen, and it must not go while it is still being
      faded in: see `leave` on the screen for what a view removed in the middle
      of an animation does afterwards.
    */
    const timer = setTimeout(() => setArmed(true), wait + RISE_MS + 60);
    return () => clearTimeout(timer);
  }, [shown, still, wait]);

  const veil = useAnimatedStyle(() => ({ opacity: shown.value }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.value) * 26 }] }));

  const clean = score.total > 0 && score.hit === score.total;
  const heading = end === 'won' ? (clean ? 'Clean run' : 'You made it') : 'Run over';
  const why =
    end === 'lapse'
      ? 'A key got past you.'
      : end === 'empty'
        ? 'That tap landed on nothing.'
        : end === 'won'
          ? 'All the way to the end of the record.'
          : null;

  return (
    <Animated.View
      style={[
        styles.ending,
        {
          paddingTop: Math.max(top + 24, keep === 'head' ? clear : 0),
          paddingBottom: Math.max(bottom + 24, keep === 'foot' ? clear : 0),
        },
        veil,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={keep === 'foot' ? VEIL_OFF_FOOT : keep === 'head' ? VEIL_OFF_HEAD : VEIL}
        // A key let past fills the bottom third; a tap has a whole half to
        // itself, so the veil lets go of it sooner.
        locations={keep === 'head' ? [0.38, 0.54, 1] : end === 'empty' ? [0, 0.46, 0.62] : [0, 0.58, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.endingBody, rise]}>
        <Text style={styles.title}>{heading}</Text>
        {why ? <Text style={styles.why}>{why}</Text> : null}
        <Text style={styles.big}>{pointsOf(score)}</Text>
        <Text style={styles.note}>
          {score.hit} of {score.total} keys
          {score.bonus > 0 ? ` · ${score.bonus} held` : ''} · best run of {score.best} ·{' '}
          {Math.round(accuracyOf(score) * 100)}%
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!armed}
          style={[styles.go, { backgroundColor: colour }]}
          onPress={onAgain}>
          <Text style={styles.goLabel}>Again</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The key that was let past, coloured in where it stands.
 *
 * Built exactly the way a key is -- a frame hung above the bottom, a body
 * stretched from its foot -- and placed by the same arithmetic, so it lies on
 * the key it is marking to the pixel however long that key is. Costs nothing
 * during a run: none of what it reads changes until one ends.
 */
const Lost = memo(function Lost({
  lane,
  atMs,
  holdMs,
  now,
  lit,
  span,
  travel,
  width,
  height,
}: {
  lane: SharedValue<number>;
  atMs: SharedValue<number>;
  holdMs: SharedValue<number>;
  now: SharedValue<number>;
  lit: SharedValue<number>;
  span: SharedValue<number>;
  travel: SharedValue<number>;
  width: number;
  height: number;
}) {
  const frame = useAnimatedStyle(() => {
    if (lane.value < 0 || span.value <= 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const foot = ((now.value - (atMs.value - span.value)) / span.value) * travel.value;
    return {
      opacity: lit.value,
      transform: [{ translateX: lane.value * width }, { translateY: foot - BOX }],
    };
  });
  const body = useAnimatedStyle(() => {
    const tail = span.value > 0 ? (holdMs.value / span.value) * travel.value : 0;
    return { transform: [{ scaleY: (tail + height) / BODY_BASE }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tile, { width, left: 0 }, frame]}>
      <Animated.View style={[styles.lost, body]} />
    </Animated.View>
  );
});

/**
 * The tap that landed on nothing, marked where the finger came down.
 *
 * A ring with a cross through it, under the finger rather than in the middle
 * of the column: how near it was to a key is the whole story of a tap like
 * this, and only the exact place tells it.
 */
const Slip = memo(function Slip({
  on,
  x,
  y,
  lit,
  size,
}: {
  on: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  lit: SharedValue<number>;
  size: number;
}) {
  const place = useAnimatedStyle(() => ({
    opacity: on.value * lit.value,
    transform: [
      { translateX: x.value - size / 2 },
      { translateY: y.value - size / 2 },
      // Opens a little as it brightens, so it is seen arriving.
      { scale: 0.86 + 0.14 * lit.value },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.slip, { width: size, height: size, borderRadius: size / 2 }, place]}>
      <View style={[styles.slipBar, { width: size * 0.46, transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.slipBar, { width: size * 0.46, transform: [{ rotate: '-45deg' }] }]} />
    </Animated.View>
  );
});

/**
 * Paper in the air, for a run that reached the end of the record.
 *
 * One clock for all of it. Each scrap works out where it is from that clock and
 * its own handful of numbers, so there is one animation running rather than
 * seventy-two, and it takes itself off the screen when the clock runs out -- a
 * faded scrap is still a view with a style to work out.
 */
const CONFETTI = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f4f6fb'];

const Confetti = memo(function Confetti({
  width,
  height,
  colour,
  clock,
  onDone,
}: {
  width: number;
  height: number;
  colour: string;
  /** The burst's own clock, in seconds. Held by the screen, which may have to stop it. */
  clock: SharedValue<number>;
  /** Called once the last scrap has gone, which is when this may be taken down. */
  onDone: () => void;
}) {
  const scraps = useMemo(() => confettiFor(CONFETTI_PIECES, width, height), [height, width]);
  // The record's own colour among them, so the paper belongs to the song.
  const colours = useMemo(() => [...CONFETTI, colour], [colour]);

  useEffect(() => {
    clock.value = 0;
    clock.value = withTiming(
      CONFETTI_SEC,
      { duration: CONFETTI_SEC * 1000, easing: Easing.linear },
      (done) => {
        // Only when it ran its course. Stopped half way, it is the screen
        // that is going, and the screen takes this down with it.
        if (done) runOnJS(onDone)();
      }
    );
    // Once, when the burst begins: `onDone` is a new function on every render
    // of the screen, and starting again each time would never let it land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {scraps.map((scrap, index) => (
        <Paper key={index} scrap={scrap} clock={clock} colour={colours[scrap.colour % colours.length]!} />
      ))}
    </View>
  );
});

const Paper = memo(function Paper({
  scrap,
  clock,
  colour,
}: {
  scrap: Scrap;
  clock: SharedValue<number>;
  colour: string;
}) {
  const flying = useAnimatedStyle(() => {
    const at = scrapAt(scrap, clock.value);
    return {
      opacity: at.opacity,
      transform: [
        { translateX: at.x },
        { translateY: at.y },
        { rotate: `${at.turn}rad` },
        { scaleY: at.flat },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.paper, { width: scrap.wide, height: scrap.tall, backgroundColor: colour }, flying]}
    />
  );
});

/**
 * One life, lit or spent.
 *
 * Reads the count off the board rather than off the score above, so it goes
 * out at the moment the key is lost rather than at the next time the figures
 * are copied over. A life is the one thing worth being exact about: the
 * difference between two left and one is the difference between carrying on
 * and being careful.
 */
const Life = memo(function Life({
  slot,
  left,
  still,
}: {
  slot: number;
  left: SharedValue<number>;
  still: SharedValue<number>;
}) {
  /*
    Timed rather than switched, and on the size as well as the brightness.

    A dot that simply dims is a dot that has to be compared with its neighbours
    to be read at all. One that shrinks as it goes out, and swells as it comes
    back, says which way it moved -- and a life coming back is rare enough that
    it should be allowed to look like something.

    The spring on the way back is deliberately only on the way back: a life lost
    should not bounce.
  */
  const lit = useAnimatedStyle(() => {
    const on = slot < left.value;
    if (still.value === 1) return { opacity: on ? 1 : 0.22, transform: [{ scale: 1 }] };
    return {
      opacity: withTiming(on ? 1 : 0.22, { duration: 260 }),
      transform: [
        {
          scale: on
            ? withSequence(
                withTiming(1.45, { duration: 140 }),
                withTiming(1, { duration: 220 })
              )
            : withTiming(0.62, { duration: 260 }),
        },
      ],
    };
  });
  return <Animated.View style={[styles.life, lit]} />;
});

/**
 * The whole board lit for a moment, in one colour.
 *
 * Behind everything and deaf to touch: this is weather, not a control. Kept as
 * its own component so the board itself does not re-render to show it — the
 * tint is a shared value and never crosses to React at all.
 */
const Wash = memo(function Wash({
  tint,
  colour,
}: {
  tint: SharedValue<number>;
  colour: string;
}) {
  const lit = useAnimatedStyle(() => ({ opacity: tint.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colour }, lit]}
    />
  );
});

/**
 * How far through the record the run has got.
 *
 * Driven from the same clock the board is, on the same thread, so it moves
 * with the keys rather than in steps as a poll comes in — and costs no render
 * at all, which a bar redrawn sixty times a second through React would.
 */
const Progress = memo(function Progress({
  at,
  ofMs,
}: {
  at: SharedValue<number>;
  ofMs: number;
}) {
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: ofMs > 0 ? Math.min(1, Math.max(0, at.value / ofMs)) : 0 }],
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
});

/**
 * Where the record has got to, written somewhere the board can read it.
 *
 * A leaf that draws nothing: the position changes a few times a second and
 * every one of those would re-render the whole screen if it were read higher
 * up.
 */
function Pulse({ into }: { into: SharedValue<number> }) {
  const { positionSec } = usePlayerPosition(true);
  useEffect(() => {
    into.set(Math.max(0, Math.round(positionSec * 1000)));
  }, [into, positionSec]);
  return null;
}

/**
 * One tile out of the pool.
 *
 * Nothing here is laid out per frame: the frame gives it a place to stand and
 * how long its tail is, and both are transforms, so a frame never reaches
 * layout at all.
 */
const Tile = memo(function Tile({
  slot,
  lane,
  view,
  width,
  height,
  shades,
}: {
  slot: number;
  lane: number;
  view: SharedValue<number[]>;
  width: number;
  height: number;
  shades: readonly [string, string, string];
}) {
  const base = slot * FIELDS;
  /*
    One style for the whole frame, opacity included.

    It was two, and that is why a struck key never dimmed: both of them set
    `opacity` on the same view, so each frame they overwrote one another and
    whichever landed second won. The brightness was being worked out correctly
    the whole time and thrown away. Two animated styles may not name the same
    property, and the fix is to have one that does.

    Lent and unlent are the same multiplication: an unused slot is zeroed, so
    both halves are nought and so is the result.
  */
  /*
    Lent or not, and where. Deliberately *not* how bright.

    The dimming of a struck key used to live here, and that is why its flash
    could not be seen: the light is drawn inside this frame, so a frame at
    the spent brightness of some quarter took the flash down to a quarter with
    it -- the light was being put out by the very thing it was announcing. The
    brightness belongs to the parts that are the key, and the light is not one
    of them.
  */
  const frame = useAnimatedStyle(() => ({
    opacity: view.value[base + F_ON]!,
    transform: [{ translateY: view.value[base + F_Y]! }],
  }));
  /** What the key itself is worth looking at: full while waiting, dim once struck. */
  const ink = useAnimatedStyle(() => ({ opacity: view.value[base + F_LIT]! }));
  /*
    Stretched rather than resized.

    Height is a layout property: setting it sixty times a second on a dozen
    tiles puts layout back in the frame loop, and the board was visibly
    stepping rather than sliding because of it. A bar one point tall scaled
    from its foot costs nothing but a transform.
  */
  /*
    One surface for the whole key, hold and all.

    It used to be two: a tail stacked on top of a key, each with its own
    gradient and a bright edge drawn between them. That edge was the hairline
    of white everybody could see, and the two gradients were why the bottom of
    a held key looked like an ordinary key with something else attached above
    it. One view stretched over both is one piece of material, which is what it
    was always meant to look like.
  */
  const body = useAnimatedStyle(() => ({
    opacity: view.value[base + F_LIT]!,
    transform: [{ scaleY: (view.value[base + F_TAIL]! + height) / BODY_BASE }],
  }));
  /*
    The gauge, as long as the whole key it belongs to.

    From the top of the hold to the bottom of the key, less the same gap at
    each end. Only holds have one -- a tap has no tail, so there is nothing to
    be kept down and nothing to show.
  */
  const gauge = useAnimatedStyle(() => {
    const tall = view.value[base + F_TAIL]! + height - GAUGE_GAP * 2;
    return {
      opacity: view.value[base + F_TAIL]! > 0 ? view.value[base + F_LIT]! : 0,
      transform: [{ scaleY: tall > 0 ? tall / GAUGE_BASE : 0 }],
    };
  });
  /*
    How much of the hold has been kept, growing from the key upwards.

    Upwards from the bottom because that is the end which has already gone past
    the line: below is time served and above is time still to serve. Brighter
    while a finger is actually down, so holding reads as doing something rather
    than as waiting for something.
  */
  const fill = useAnimatedStyle(() => {
    const glow = view.value[base + F_GLOW]!;
    return {
      opacity: glow > 0 ? glow : 0.62,
      transform: [{ scaleY: view.value[base + F_FILL]! }],
    };
  });
  /*
    The light of a struck key, thrown outward and gone.

    Drawn over the key rather than inside it and allowed past the lane's own
    width, which is what makes it read as light coming off the thing rather
    than as the thing changing colour. It starts exactly the size of the key at
    the instant of the strike, so there is no moment where it is visibly a
    separate object; then it opens and fades.
  */
  const spark = useAnimatedStyle(() => {
    const flash = view.value[base + F_FLASH]!;
    return {
      opacity: flash * 0.85,
      transform: [{ scale: 1 + (1 - flash) * 0.3 }],
    };
  });

  /*
    The light of a hold kept to the end.

    The whole length of the key at once, which is what the tap's light could
    not be, opening sideways past the edges of its column as it fades. It grows
    from the same foot the key does and is stretched by the same amount, so at
    the instant it appears it is exactly the key, turned white.

    Squared on the way out, so it lingers bright for a moment and then goes
    quickly -- struck and let ring, rather than faded like a lamp on a dimmer.
  */
  const crown = useAnimatedStyle(() => {
    const kept = view.value[base + F_KEPT]!;
    return {
      opacity: kept * kept * 0.92,
      transform: [
        { scaleY: (view.value[base + F_TAIL]! + height) / BODY_BASE },
        { scaleX: 1 + (1 - kept * kept) * 0.6 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.tile, { width, left: lane * width }, frame]}>
      {/*
        One piece of material from the top of the hold to the foot of the key,
        with one gradient over the whole of it. Nothing is drawn where the two
        used to meet, because there is no longer a join there to draw.
      */}
      <Animated.View style={[styles.body, body]}>
        <LinearGradient
          colors={shades}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />
        {/*
          A band of light across the face. The whole difference between a
          coloured rectangle and something with a surface for light to fall on.
        */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
          locations={[0.14, 0.33, 0.58]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* A shadow along the foot, so one key sits on the next rather than
            dissolving into it. Inside the body, so it is the only edge there
            is and it stretches with nothing. */}
        <View style={styles.underside} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.spark, { height }, spark]} />
      {/*
        Two layers. What has to be held is the dark one; what has been held is
        the bright one drawn over it from the bottom up. So a hold let go of
        early keeps a dark top for the rest of its fall, and that darkness is
        the whole of how a player sees afterwards that they let go.
      */}
      <Animated.View style={[styles.gauge, gauge]}>
        <Animated.View style={[styles.gaugeFill, fill]} />
      </Animated.View>
      {/* Last, so it is over the gauge as well: the whole key lights, not the
          key with its gauge showing through. */}
      <Animated.View pointerEvents="none" style={[styles.crown, crown]} />
    </Animated.View>
  );
})

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACK },
  board: { flex: 1, overflow: 'hidden' },
  rule: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: DIM },
  /*
    A wash over the picture, heaviest at the bottom.

    The keys arrive at the foot of the screen and that is where they have to be
    read quickest, so that is where the background is asked to be quietest.
  */
  settle: { backgroundColor: 'rgba(8,9,14,0.55)' },

  tile: { position: 'absolute', top: 0, height: BOX },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BODY_BASE,
    overflow: 'hidden',
    transformOrigin: ['50%', '100%', 0],
  },
  /*
    The gauge, and the room around it.

    Inset as a share rather than in points, because the bar it sits in is
    stretched: a margin given in points would be multiplied by however many
    rows long the hold is, and come out ten times bigger on a long one than on
    a short one.
  */
  gauge: {
    position: 'absolute',
    left: '40%',
    width: '20%',
    bottom: GAUGE_GAP,
    height: GAUGE_BASE,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.42)',
    overflow: 'hidden',
    transformOrigin: ['50%', '100%', 0],
  },
  gaugeFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    transformOrigin: ['50%', '100%', 0],
  },
  underside: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  spark: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  /*
    Built the way the body is -- one fixed height, stretched from the foot --
    so it covers a hold of any length without layout being asked.
  */
  crown: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BODY_BASE,
    backgroundColor: 'rgba(255,255,255,0.95)',
    transformOrigin: ['50%', '100%', 0],
  },

  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tally: { alignItems: 'flex-start', gap: 6, minWidth: 64 },
  score: { color: TEXT, fontSize: 30, fontWeight: '700' },
  lives: { flexDirection: 'row', gap: 6 },
  life: { width: 11, height: 11, borderRadius: 6, backgroundColor: TEXT },

  /* Across the middle, and thin: it answers how far through, not how fast. */
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginTop: 12,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: 2,
    backgroundColor: TEXT,
    transformOrigin: ['0%', '50%', 0],
  },

  stop: { padding: 10, borderRadius: 999, backgroundColor: DIM, marginTop: 4 },
  /* Kept in the row so nothing beside it moves; only unseen. */
  gone: { opacity: 0 },
  pauseBars: { flexDirection: 'row', gap: 4 },
  pauseBar: { width: 4, height: 15, borderRadius: 1, backgroundColor: TEXT },

  pauseScreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  pauseTitle: { color: TEXT, fontSize: 26, fontWeight: '700', marginBottom: 8 },
  quiet: { paddingVertical: 12, paddingHorizontal: 20 },
  quietLabel: { color: MUTED, fontSize: 15 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,18,0.96)',
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 18,
  },
  /* The page at the end. Its darkness is the veil drawn inside it. */
  ending: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  endingBody: { gap: 18 },
  why: { color: TEXT, fontSize: 16, lineHeight: 22, marginTop: -8 },
  lost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BODY_BASE,
    backgroundColor: BLAME,
    transformOrigin: ['50%', '100%', 0],
  },
  slip: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 3,
    borderColor: BLAME,
    backgroundColor: 'rgba(255,59,82,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slipBar: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: BLAME },
  paper: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
  title: { color: TEXT, fontSize: 28, fontWeight: '700' },
  leave: { position: 'absolute', left: 20, padding: 8 },
  big: { color: TEXT, fontSize: 64, fontWeight: '800' },
  note: { color: MUTED, fontSize: 15, lineHeight: 21 },
  small: { color: MUTED, fontSize: 13, lineHeight: 18 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: DIM },
  chipOn: { backgroundColor: TEXT },
  chipLabel: { color: TEXT, fontSize: 14 },
  chipLabelOn: { color: BACK, fontWeight: '600' },
  offset: { color: TEXT, fontSize: 15, minWidth: 74, textAlign: 'center' },
  go: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  goOff: { opacity: 0.5 },
  goLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
