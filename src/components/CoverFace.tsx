import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image } from './Picture';
import { LinearGradient } from 'expo-linear-gradient';
import { requireNativeViewManager } from 'expo-modules-core';

import { usePlayerPosition } from '../lib/player/PlayerProvider';
import { scrubbing } from '../lib/player/scrub';
import { motionReduced } from '../lib/ui/motion';
import { useTonearm } from '../lib/ui/coverLook';
import { useColours } from '../lib/theme/index';
import { armTurn, FIRST_GROOVE, LAST_GROOVE, RECORD_TURN_MS, REEL_TURN_MS, woundTo } from '../lib/ui/coverFace';

/**
 * What stands where the cover is in the player when it is not the cover
 * alone (`ui/coverLook.ts`): a record with the cover for its label, or a
 * cassette with the cover for its label and its reels in the window.
 *
 * Drawn of plain views, so that it costs what a cover does while it stands
 * still. It turns only while [turning]: playing, the player in sight, and the
 * decoration not held still; the turning is handed over whole to the native
 * side, and nothing is drawn from here while it goes on. A cassette's reels
 * run down over a second when stopped, as a deck's do; a record is where the
 * song is (see `useSongTurn`).
 */
export function CoverFace({
  look,
  artwork,
  size,
  turning,
  live,
  trackId,
  speed,
}: {
  look: 'record' | 'cassette';
  artwork: string | null;
  /** The side of the square it is given. */
  size: number;
  turning: boolean;
  /** Whether the player is in sight, for the reels and the record to follow the position. */
  live: boolean;
  /** The song playing, and how fast: for the record, which goes round with it. */
  trackId: string;
  speed: number;
}) {
  return look === 'record' ? (
    <Record artwork={artwork} size={size} turning={turning} live={live} trackId={trackId} speed={speed} />
  ) : (
    <Cassette artwork={artwork} size={size} turning={turning} live={live} />
  );
}

/**
 * A value in turns that goes round once every [period] while [on], speeding
 * up over its first moment and running down over a second when it goes off.
 * Each turn is handed over as one animation, and begun again from nought when
 * it ends: a turn more is the same as none.
 */
function useTurning(on: boolean, period: number): Animated.Value {
  const [turn] = useState(() => new Animated.Value(0));
  const was = useRef(false);
  useEffect(() => {
    let done = false;
    let running: Animated.CompositeAnimation | null = null;
    const run = (animation: Animated.CompositeAnimation, then?: () => void) => {
      running = animation;
      animation.start(({ finished }) => {
        if (finished && !done) then?.();
      });
    };
    const round = () => {
      turn.setValue(0);
      run(Animated.timing(turn, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: true }), round);
    };
    /*
      Speeding up and running down each take [EASE_MS] and cover the turn the
      full speed would in half the time: the speed at their full end is the
      speed of turning, with no jump from one to the other.
    */
    const eased = EASE_MS / period / 2;
    const wasOn = was.current;
    was.current = on;
    if (on) {
      turn.stopAnimation((at) => {
        if (done) return;
        const from = at % 1;
        turn.setValue(from);
        if (wasOn) round();
        else
          run(
            Animated.timing(turn, { toValue: from + eased, duration: EASE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            () => {
              // On from wherever the speeding up left it, at the speed of the rest.
              const left = 1 - ((from + eased) % 1);
              turn.setValue(1 - left);
              run(Animated.timing(turn, { toValue: 1, duration: left * period, easing: Easing.linear, useNativeDriver: true }), round);
            }
          );
      });
    } else if (wasOn) {
      turn.stopAnimation((at) => {
        if (done) return;
        const from = at % 1;
        turn.setValue(from);
        run(Animated.timing(turn, { toValue: from + eased, duration: EASE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }));
      });
    }
    return () => {
      done = true;
      running?.stop();
    };
  }, [on, period, turn]);
  return turn;
}

/** How long a reel takes to come up to speed, and to run down. */
const EASE_MS = 1100;

/** Turns of a record for [seconds] of the song. */
const turnsAt = (seconds: number) => (seconds * 1000) / RECORD_TURN_MS;

/**
 * How long a record takes to go round to where a jump in the song has put
 * it: a little, and a little more for each whole turn it goes through.
 */
const SPIN_MS = 350;
const SPIN_MS_A_TURN = 120;
/** Further than this from where the record has the song, in seconds, the song has been moved, and the record is spun to it. */
const SEEK_GAP_S = 0.75;
/**
 * Further than this while playing, the record has fallen out with the song,
 * the two clocks running a hair apart, and it catches up over [CATCH_UP_MS]
 * rather than being put there; nearer, a reading's own lateness, left alone.
 */
const DRIFT_S = 0.3;
const CATCH_UP_MS = 1000;
/** How long a stopped record takes to settle on where the song stopped, when that turns out a little off where it stopped. */
const SETTLE_MS = 260;
/**
 * How much more of the song a record turns through as it stops, in seconds
 * of it, running down from the speed it was going at: about as long as the
 * player takes to stop once told to, measured on the phone at some three
 * twentieths of a second, so that it comes to rest where the song did.
 */
const COAST_S = 0.15;
/**
 * How many whole turns a record goes through to a jump of [turns]: all of
 * them up to [SPIN_ALL], so that five seconds on is once round and ten twice;
 * past that ever fewer for each further one, so that a minute on is some six
 * and three minutes some eight, and never more than [SPIN_MOST]. Further is
 * always more, so that a long way is seen to be a long way.
 */
const SPIN_ALL = 3;
const SPIN_MOST = 10;
const spunThrough = (turns: number) =>
  turns <= SPIN_ALL ? Math.floor(turns) : Math.min(SPIN_MOST, Math.floor(SPIN_ALL + 1.5 * Math.log2(turns / SPIN_ALL)));
/** How much of the song a stretch of steady turning handed to the native side covers, in seconds. */
const RUN_S = 600;

/**
 * The record's turn, in turns, as a value the native side moves: where the
 * song is, at one turn every `RECORD_TURN_MS` of it, so that a moment of the
 * song is always the same angle of the record. Faster or slower with the
 * song's [speed], and still where the song is stopped.
 *
 * Moved on, it is spun there: on through the turns between, or back through
 * them for a song moved back, coming in to the angle that place has -- five
 * seconds on is once round -- the further, the more turns and the longer,
 * a long way cut short (see `spunThrough`). Another song is turned on to,
 * never back. Coming into sight, it is put where the song has got to without
 * being spun there.
 *
 * Followed from the position the player reports four times a second, which
 * the steady turning is handed to the native side between: only a reading
 * that is not where the record has the song moves it otherwise.
 *
 * And while a finger is on the player's bar, from the time under it, which
 * the song is not moved to until the finger lets go (`player/scrub.ts`): the
 * record is turned with the finger, back and on, and is where the song is
 * going when it gets there, with nothing left to spin.
 */
function useSongTurn(trackId: string, live: boolean, turning: boolean, speed: number): Animated.Value {
  const { positionSec } = usePlayerPosition(live);
  const still = motionReduced();
  const [turn] = useState(() => new Animated.Value(turnsAt(positionSec)));
  const held = useRef({ pos: positionSec, at: 0, turn: turnsAt(positionSec), running: false, rate: speed, track: trackId, live });
  // Which handing-over is the latest, so that one overtaken does not go on.
  const latest = useRef(0);
  // Where the song and the record were when a finger took the bar, and where it has it now.
  const scrub = useRef<{ pos: number; turn: number; at: number } | null>(null);
  // Until when it is running down from a stop, not to be settled meanwhile from where it will come to rest.
  const coasting = useRef(0);
  // Where the song was let go at, until the player says it has got there: the readings until then are of before.
  const aimed = useRef<{ seconds: number; since: number } | null>(null);
  /** Turning at the song's [rate], from [from], for as long as nothing overtakes it. */
  const steady = useCallback(
    (from: number, rate: number, mine: number) => {
      const go = (start: number) => {
        const until = start + turnsAt(RUN_S * rate);
        Animated.timing(turn, { toValue: until, duration: RUN_S * 1000, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
          if (finished && latest.current === mine) go(until);
        });
      };
      go(from);
    },
    [turn]
  );
  useEffect(() => {
    if (still) return;
    return scrubbing.subscribe(() => {
      const under = scrubbing.get();
      const now = performance.now();
      if (under != null) {
        if (!scrub.current) {
          // Taken by the finger: stopped where it is, and turned from there with it.
          const was = held.current;
          const gone = was.running ? ((now - was.at) / 1000) * was.rate : 0;
          latest.current += 1;
          turn.stopAnimation();
          scrub.current = { pos: was.pos + gone, turn: was.turn + turnsAt(gone), at: was.pos + gone };
        }
        scrub.current.at = under;
        turn.setValue(scrub.current.turn + turnsAt(under - scrub.current.pos));
        return;
      }
      const let_go = scrub.current;
      if (!let_go) return;
      scrub.current = null;
      // Let go: where the song is going, and on from there if it plays.
      const was = held.current;
      const at = let_go.turn + turnsAt(let_go.at - let_go.pos);
      held.current = { ...was, pos: let_go.at, at: now, turn: at };
      aimed.current = { seconds: let_go.at, since: now };
      latest.current += 1;
      if (was.running) steady(at, was.rate, latest.current);
    });
  }, [steady, still, turn]);
  useEffect(() => {
    if (still || scrub.current) return;
    const aim = aimed.current;
    if (aim) {
      if (Math.abs(positionSec - aim.seconds) > 1.5 && performance.now() - aim.since < 1000) return;
      aimed.current = null;
    }
    const was = held.current;
    const now = performance.now();
    const gone = was.running ? ((now - was.at) / 1000) * was.rate : 0;
    // Where the record has the song, and the turn it shows for it.
    const expected = was.pos + gone;
    const shown = was.turn + turnsAt(gone);
    const run = turning && live;
    const gap = positionSec - expected;
    const another = trackId !== was.track;
    const woke = live && !was.live;
    const jumped = Math.abs(gap) > SEEK_GAP_S;
    const changed = run !== was.running || (run && Math.abs(speed - was.rate) > 0.005);
    // Stopped, it is put exactly where the song stopped, which the reading after a stop says more truly than the one before.
    const settled = !run && Math.abs(gap) > 0.01;
    const drifted = run && Math.abs(gap) > DRIFT_S;
    if (!another && !jumped && !changed && !woke && !settled && !drifted) return;
    if (!another && !jumped && !changed && !woke && now < coasting.current) return;

    let to = shown + turnsAt(gap);
    let at = positionSec;
    let spin = SPIN_MS;
    /*
      Stopped, it runs down from where it is, through about as much of the song
      as the player goes on for once told to stop. The reading in hand is from
      before the stop, up to a quarter of a second old; put where that says, it
      went back. The next reading says where the song stopped, and it settles
      there, which is then only a few degrees.
    */
    const stopping = was.running && !run;
    const coast = stopping && !another && !jumped;
    if (coast) {
      at = expected + COAST_S * was.rate;
      to = shown + turnsAt(COAST_S * was.rate);
    }
    if (another) {
      // On to the angle the new song's place has, never back.
      const ahead = (((turnsAt(positionSec) - shown) % 1) + 1) % 1;
      to = shown + ahead;
    } else if (jumped) {
      const way = turnsAt(gap);
      const whole = spunThrough(Math.abs(way));
      to = shown + Math.sign(way) * (whole + (Math.abs(way) % 1));
      spin = SPIN_MS + SPIN_MS_A_TURN * whole;
    }
    held.current = { pos: at, at: now, turn: to, running: run, rate: speed, track: trackId, live };
    latest.current += 1;
    const mine = latest.current;
    turn.stopAnimation();
    coasting.current = coast ? now + COAST_S * 2000 : 0;
    if (coast) {
      // Running down evenly from the speed it had: as long again as that would take at full speed.
      turn.setValue(shown);
      Animated.timing(turn, { toValue: to, duration: COAST_S * 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else if (settled && !stopping && !another && !jumped && !changed && !woke) {
      // A little off where the song stopped: there, gently rather than at once.
      turn.setValue(shown);
      Animated.timing(turn, { toValue: to, duration: SETTLE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    } else if (drifted && !another && !jumped && !changed && !woke) {
      // Caught up while it goes on, to be where the song is a moment from now, and on from there.
      const end = to + turnsAt((CATCH_UP_MS / 1000) * speed);
      turn.setValue(shown);
      Animated.timing(turn, { toValue: end, duration: CATCH_UP_MS, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
        if (finished && latest.current === mine) steady(end, speed, mine);
      });
    } else if ((another || jumped) && !woke) {
      // Where the song will be by the time it has been spun there, if it is playing.
      const end = to + (run ? turnsAt((spin / 1000) * speed) : 0);
      turn.setValue(shown);
      Animated.timing(turn, { toValue: end, duration: spin, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished && run && latest.current === mine) steady(end, speed, mine);
      });
    } else {
      turn.setValue(to);
      if (run) steady(to, speed, mine);
    }
  }, [live, positionSec, speed, steady, still, trackId, turn, turning]);
  useEffect(
    () => () => {
      latest.current += 1;
      turn.stopAnimation();
    },
    [turn]
  );
  return turn;
}

const degrees = (turn: Animated.Value) =>
  turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });

const round = (side: number) => ({ width: side, height: side, borderRadius: side / 2 });

/** Where the grooves are, as shares of the record across, evenly from its edge to the label. */
const GROOVES = [0.96, 0.89, 0.82, 0.75, 0.68, 0.61, 0.54];

/** The label, as a share of the record across. */
const LABEL = 0.4;

function Record({
  artwork,
  size,
  turning,
  live,
  trackId,
  speed,
}: {
  artwork: string | null;
  size: number;
  turning: boolean;
  live: boolean;
  trackId: string;
  speed: number;
}) {
  // Over it only where asked for.
  const tonearm = useTonearm();
  const c = useColours();
  const turn = useSongTurn(trackId, live, turning, speed);
  const label = size * LABEL;
  return (
    <View style={{ width: size, height: size }}>
      {/*
        Drawn once into a picture of its own that is then only turned: drawn
        afresh at each step, its rounded label was a picture sent to the
        screen again sixty times a second.
      */}
      <Animated.View renderToHardwareTextureAndroid style={[styles.disc, round(size), { transform: [{ rotate: degrees(turn) }] }]}>
        {GROOVES.map((share) => (
          <View key={share} style={[styles.groove, round(size * share)]} />
        ))}
        {/* The edge of the label, a little brighter, where the needle runs out. */}
        <View style={[styles.runOut, round(label * 1.12)]} />
        {/*
          Rounded by what holds it and not by the picture itself, which made a
          rounded copy of itself again each time it was drawn turned.
        */}
        <View style={[round(label), styles.recordLabel, !artwork && { backgroundColor: c.accent }]}>
          {artwork ? <Image source={{ uri: artwork }} style={{ width: label, height: label }} contentFit="cover" /> : null}
        </View>
        <View style={[styles.spindle, round(size * 0.035), { backgroundColor: c.bg }]} />
      </Animated.View>
      {/* The light on it, which stays where it is as the record goes round under it. */}
      <LinearGradient
        pointerEvents="none"
        colors={SHEEN}
        locations={SHEEN_AT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      {tonearm ? <Tonearm size={size} live={live} /> : null}
    </View>
  );
}

/**
 * The arm over the record, its needle in the groove: at the edge as the song
 * starts and near the label as it ends, following where it has got to. Apart
 * from the record, so that only this follows the position; drawn by the native
 * side (`spectrum/TonearmView.kt`), as a turntable's arm is made.
 */
function Tonearm({ size, live }: { size: number; live: boolean }) {
  const { positionSec, durationSec } = usePlayerPosition(live);
  const played = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  const turn = armTurn(size * (FIRST_GROOVE - (FIRST_GROOVE - LAST_GROOVE) * played), size);
  return <NativeTonearm turn={turn} style={StyleSheet.absoluteFill} />;
}

const NativeTonearm = requireNativeViewManager<{ turn: number; style?: object }>('JukeboxAudio', 'TonearmView');

const SHEEN = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.09)',
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.06)',
  'rgba(255,255,255,0)',
] as const;
const SHEEN_AT = [0.18, 0.34, 0.5, 0.66, 0.82] as const;

/** A cassette is this much as tall as it is wide. */
const CASSETTE_TALL = 0.64;

/** Its window, as a share of how tall it is. */
const WINDOW_TALL = 0.3;

function Cassette({ artwork, size, turning, live }: { artwork: string | null; size: number; turning: boolean; live: boolean }) {
  const c = useColours();
  const wide = size;
  const tall = size * CASSETTE_TALL;
  const screw = tall * 0.045;
  const labelInset = wide * 0.055;
  const labelTall = tall * 0.6;
  return (
    <View style={[styles.cassetteBox, { width: size, height: size }]}>
      <View style={[styles.body, { width: wide, height: tall, borderRadius: tall * 0.08 }]}>
        {[
          { left: tall * 0.05, top: tall * 0.05 },
          { right: tall * 0.05, top: tall * 0.05 },
          { left: tall * 0.05, bottom: tall * 0.05 },
          { right: tall * 0.05, bottom: tall * 0.05 },
        ].map((at, place) => (
          <View key={place} style={[styles.screw, round(screw), at]} />
        ))}
        <View
          style={[
            styles.label,
            { left: labelInset, right: labelInset, top: tall * 0.075, height: labelTall, borderRadius: tall * 0.05 },
            !artwork && { backgroundColor: c.accent },
          ]}>
          {artwork ? <Image source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        {/*
          Over the label and not in it: what turns inside a clipped corner had
          the label and its picture drawn again with it at every step.
        */}
        <Reels top={tall * 0.075 + (labelTall - tall * WINDOW_TALL) / 2} wide={wide * 0.6} tall={tall * WINDOW_TALL} turning={turning} live={live} />
        {/* Where the head meets the tape: the step at the foot, with its holes. */}
        <View style={[styles.head, { width: wide * 0.56, height: tall * 0.17, borderTopLeftRadius: tall * 0.05, borderTopRightRadius: tall * 0.05 }]}>
          <View style={[styles.hole, round(tall * 0.05)]} />
          <View style={[styles.slot, { width: tall * 0.05, height: tall * 0.05 }]} />
          <View style={[styles.slot, { width: tall * 0.05, height: tall * 0.05 }]} />
          <View style={[styles.hole, round(tall * 0.05)]} />
        </View>
      </View>
    </View>
  );
}

/**
 * The window in the middle of the label, and the two reels seen through it:
 * the tape wound off the one on the left onto the one on the right as the part
 * goes on, and both hubs turning while it plays. Apart from the rest, so that
 * only this follows the position.
 */
function Reels({ top, wide, tall, turning, live }: { top: number; wide: number; tall: number; turning: boolean; live: boolean }) {
  const { positionSec, durationSec } = usePlayerPosition(live);
  const turn = useTurning(turning, REEL_TURN_MS);
  const rotate = degrees(turn);
  const played = durationSec > 0 ? positionSec / durationSec : 0;
  // As much tape as a reel can hold fits the window, so that how much each has is seen.
  const most = tall * 0.46;
  const hub = most * 0.42;
  const reel = (share: number, centre: number) => {
    const pack = woundTo(share, hub / most) * most;
    return (
      <View key={centre} style={[styles.reel, { left: centre - most, top: tall / 2 - most, width: most * 2, height: most * 2 }]}>
        <View style={[styles.pack, round(pack * 2)]} />
        <Animated.View renderToHardwareTextureAndroid style={[styles.hub, round(hub * 2), { transform: [{ rotate }] }]}>
          <View style={[styles.hubHole, round(hub * 1.1)]} />
          {[0, 60, 120].map((angle) => (
            <View key={angle} style={[styles.spoke, { width: hub * 1.1, height: hub * 0.2, transform: [{ rotate: `${angle}deg` }] }]} />
          ))}
        </Animated.View>
      </View>
    );
  };
  return (
    <View style={[styles.window, { top, width: wide, height: tall, borderRadius: tall * 0.18 }]}>
      {reel(1 - played, wide * 0.22)}
      {reel(played, wide * 0.78)}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center' },
  groove: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  runOut: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  spindle: { position: 'absolute' },
  recordLabel: { overflow: 'hidden' },

  cassetteBox: { alignItems: 'center', justifyContent: 'center' },
  body: {
    backgroundColor: '#25252a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  screw: { position: 'absolute', backgroundColor: '#4a4a52' },
  label: { position: 'absolute', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2f2f35' },
  head: { backgroundColor: '#303036', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  hole: { backgroundColor: '#111113' },
  slot: { backgroundColor: '#111113', borderRadius: 1 },
  window: {
    position: 'absolute',
    backgroundColor: '#0c0c0e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  reel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pack: { position: 'absolute', backgroundColor: '#3a2a20' },
  hub: { backgroundColor: '#e8e4db', alignItems: 'center', justifyContent: 'center' },
  hubHole: { position: 'absolute', backgroundColor: '#0c0c0e' },
  spoke: { position: 'absolute', backgroundColor: '#e8e4db', borderRadius: 1 },
});
