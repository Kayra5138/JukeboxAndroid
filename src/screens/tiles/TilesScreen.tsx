import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type FrameInfo,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motionReduced } from '../../lib/ui/motion';
import { BackIcon } from '../../components/Icons';

import { Image } from 'expo-image';

import JukeboxAudio, { type Chart } from '../../../modules/jukebox-audio';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import { findTrack } from '../../lib/media/library';
import { usePlayerActions, usePlayerState } from '../../lib/player/PlayerProvider';
import {
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
} from '../../lib/tiles/game';
import { keyShades, laneShades } from '../../lib/tiles/shade';

import {
  AWAY_MS,
  BEHIND,
  BOX,
  CATCH_MS,
  CLEAN_FOR_A_LIFE,
  END_LOST,
  END_NONE,
  END_WON,
  F_FILL,
  F_FLASH,
  F_GLOW,
  F_KEPT,
  F_LIT,
  F_ON,
  F_TAIL,
  F_Y,
  FALLBACK_KEY,
  FIELDS,
  FLASH_MS,
  HEAL,
  HEAL_PEAK,
  HURT,
  HURT_PEAK,
  KEPT_MS,
  LEAVE_AFTER_MS,
  MAX_DRIFT,
  PER_LANE,
  POOL,
  POOL_SLOTS,
  RESYNC_MS,
  SETTLE,
  SETTLE_MS,
  SPENT_INK,
  TEXT,
  WASH_IN_MS,
  WASH_OUT_MS,
  type End,
  type Keep,
  type Loading,
  type Phase,
} from './constants';
import { Confetti } from './Confetti';
import { Ending } from './Ending';
import { Life } from './Life';
import { Lost } from './Lost';
import { Progress } from './Progress';
import { Pulse } from './Pulse';
import { Slip } from './Slip';
import { styles } from './styles';
import { Tile } from './Tile';
import { Wash } from './Wash';
import { speedName, Words } from './Words';

export default function TilesScreen() {
  const insets = useSafeAreaInsets();
  const { current, isPlaying } = usePlayerState();
  const { lend, giveBack } = usePlayerActions();
  /* Reached from the way out, which is set up once and must not be set up again. */
  const handBack = useRef(giveBack);
  useEffect(() => {
    handBack.current = giveBack;
  }, [giveBack]);
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
      // And the player goes back as it was found: the listener's speed and
      // pitch, and the queue a different record was put in place of.
      void handBack.current().catch(() => {});
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
    // the one it is played against. Borrowed either way, so the record runs as
    // mastered under the board and none of this is taken for listening.
    const track =
      asked && current?.id !== asked ? await findTrack(asked).catch(() => null) : current;
    if (track) await lend(track).catch(() => {});
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
    current,
    lastFrame,
    lend,
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
            source={require('../../../assets/space.png')}
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
          <Words>{(t) => <Text style={styles.pauseTitle}>{t.tiles.pause.title}</Text>}</Words>
          <Pressable accessibilityRole="button" style={styles.go} onPress={resume}>
            <Words>{(t) => <Text style={styles.goLabel}>{t.tiles.pause.resume}</Text>}</Words>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.quiet} onPress={toMenu}>
            <Words>{(t) => <Text style={styles.quietLabel}>{t.tiles.pause.toMenu}</Text>}</Words>
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
          <Words>
            {(t) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.common.back}
                hitSlop={14}
                onPress={leave}
                style={[styles.leave, { top: insets.top + 12 }]}>
                <BackIcon size={24} color={TEXT} />
              </Pressable>
            )}
          </Words>
          <Words>{(t) => <Text style={styles.title}>{t.tiles.setup.title}</Text>}</Words>

          {!trackId ? (
            <Words>{(t) => <Text style={styles.note}>{t.tiles.setup.noTrack}</Text>}</Words>
          ) : loading === 'making' ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={TEXT} />
              <Words>{(t) => <Text style={styles.note}>{t.tiles.setup.making}</Text>}</Words>
            </View>
          ) : loading === 'missing' ? (
            <Words>{(t) => <Text style={styles.note}>{t.tiles.setup.missing}</Text>}</Words>
          ) : (
            <>
              <Words>
                {(t) => (
                  <Text style={styles.note}>
                    {t.tiles.setup.record(title ?? null, chart?.notes.length ?? 0)}
                  </Text>
                )}
              </Words>

              <View style={styles.row}>
                {SPEEDS.map((option) => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    onPress={() => chooseSpeed(option)}
                    style={[styles.chip, option.id === speed.id && styles.chipOn]}>
                    <Words>
                      {(t) => (
                        <Text style={[styles.chipLabel, option.id === speed.id && styles.chipLabelOn]}>
                          {speedName(option, t)}
                        </Text>
                      )}
                    </Words>
                  </Pressable>
                ))}
              </View>

              <Words>{(t) => <Text style={styles.small}>{t.tiles.setup.latency}</Text>}</Words>
              <View style={styles.row}>
                <Pressable style={styles.chip} onPress={() => nudge(-20)}>
                  <Words>{(t) => <Text style={styles.chipLabel}>{t.tiles.setup.earlier}</Text>}</Words>
                </Pressable>
                <Words>{(t) => <Text style={styles.offset}>{t.tiles.setup.offset(offset)}</Text>}</Words>
                <Pressable style={styles.chip} onPress={() => nudge(20)}>
                  <Words>{(t) => <Text style={styles.chipLabel}>{t.tiles.setup.later}</Text>}</Words>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={loading !== 'ready' || phase === 'starting'}
                style={[styles.go, { backgroundColor: keyColour }, phase === 'starting' && styles.goOff]}
                onPress={() => void begin()}>
                <Words>
                  {(t) => (
                    <Text style={styles.goLabel}>
                      {phase === 'starting' ? t.tiles.setup.starting : t.tiles.setup.start}
                    </Text>
                  )}
                </Words>
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
