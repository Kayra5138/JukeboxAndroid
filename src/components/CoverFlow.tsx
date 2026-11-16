import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Image } from './Picture';
import { PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useT } from '../lib/i18n/index';
import { albumArtworkFor, useAlbumArtwork, warmAlbumArtwork } from '../lib/media/artwork';
import { thumbOf, useThumb } from '../lib/media/thumbs';
import type { Album } from '../lib/media/albums';
import { laid, makeStyles } from '../lib/theme/index';
import { withAlpha } from '../lib/theme/colour';
import { haptic } from '../lib/ui/haptics';
import { motionReduced } from '../lib/ui/motion';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AlbumBy, AlbumLink } from './NameLinks';

/**
 * A rack of records you flick through, with the one in front turned to face
 * you and the rest fanned away behind it.
 *
 * Sideways only. The shape is records turned about a vertical axis and seen
 * from the side, which needs width; held upright the rack had to stack them
 * instead, and a pile of slabs seen from above is neither a shelf nor a
 * quicker way to find anything than the list already there. The screen that
 * draws this is the one that decides, and it only draws it in landscape.
 *
 * Where the rack is, in records, is one number, moved by a finger and by the
 * glide that follows it on the thread that draws, and every card is placed
 * from it there, in the same frame. It was a scroll view underneath once, its
 * offset carrying the cards and the fan worked out from what it said of that
 * offset: the two were heard at different moments, and the cards were thrown
 * off the frame for a frame, or shook, whenever they disagreed. A scroll view
 * has its own throw, too, which ran on under a glide of this rack's own.
 *
 * Only the cards near the front are mounted at all — the ones that show and a
 * few past them either side, see {@link AHEAD}; the rest would be a hundred
 * animated views to draw nine.
 *
 * Which cards those are is the one thing JavaScript does decide, a detent at a
 * time, and it hears where the rack is a little after the rack is there. So
 * everything a detent costs here is kept small: a flick that outruns it shows
 * as sleeves turning up late, which is the fault this file has had most often.
 */

/**
 * How many cards either side of the front one are worth drawing.
 *
 * As many as the tables below place. The sleeve in front is sized against the
 * frame's shorter way round — its height — so there is width going spare
 * either side of it, and a rack that stops halfway across looks like a rack
 * that ran out of records.
 */
const NEIGHBOURS = 9;
/**
 * How far either side the fan goes, for the rack seen from further off
 * (pinched: see `far`): the records past [NEIGHBOURS] stand ever closer on
 * their edges, the rack going away from the one in front, and are mounted
 * only while the rack is seen from far enough to see them.
 */
const FAR_NEIGHBOURS = 18;
/** How far off the rack can be seen from, as the share of its size it is then drawn at. */
const FAR_MOST = 0.42;
/** Seen from further than this, the records past [NEIGHBOURS] are put up. */
const FAR_WIDE = 0.85;

/**
 * How many more are kept mounted past the last one that shows, either side.
 *
 * A sleeve is mounted from here, where a detent is heard about a frame or
 * more after it happened, and its picture is read off the disk only once it
 * is. Mounted exactly where it starts to show, it had no time for either: one
 * detent of lag and it faded in late, and its picture later still. These are
 * the head start — drawn at no opacity, so they cost the compositor nothing,
 * but there, with their pictures in hand, by the time the rack reaches them.
 *
 * Not more, because each is a picture held in memory and a handful of
 * transforms worked out every frame the rack moves.
 */
const AHEAD = 6;
/**
 * The same, for the rack seen from far off, the way it is going: a drag or a
 * throw there goes some ten times as many records, and its sleeves, drawn
 * from their small copies, cost a fraction of what they cost near.
 */
const FAR_AHEAD = 20;
/** And on the side it is going away from, where only what is still in sight is wanted. */
const FAR_BEHIND = 2;
/**
 * Seen from far off, how many records either side of the one in front are
 * drawn from their pictures as they are, once the rack is still; the rest are drawn from the small
 * copies of them (`lib/media/thumbs`), which is all the size they are drawn
 * at needs. Read whole, as they were, the covers of a rack thrown from that
 * far turned up well after the sleeves did.
 */
const SHARP = 1;

/**
 * Turn on to have the rack say how it kept up, each time it comes to rest.
 *
 * Off, and nothing below is reached: no listener is given to the pictures and
 * nothing is counted. On, it writes one line to the log per flick — see
 * {@link tally} for what the numbers are. Not for leaving on.
 */
const MEASURE = false;

/**
 * What {@link MEASURE} counts between one rest and the next.
 *
 * `gap` is the longest JavaScript went without hearing of the scroll, which
 * should be a frame or two; `jump` the most sleeves that went by between two
 * hearings. `decoded` are the pictures that had to be read off the disk rather
 * than found in memory, and `late` the ones that arrived on a sleeve already
 * showing — which is the thing that is seen — with `nearest` how close to the
 * front the worst of them was; a sleeve going from its small copy to its
 * picture or back, as the rack stops and sets off, is one of them as well.
 * `mounted` are the sleeves put up, `bare` those that had no cover to show
 * yet and `unmade` no small copy of it, `renders` how often any sleeve was
 * drawn again, and `waited` the longest from a sleeve being put up to a
 * picture arriving on it.
 */
const AT_REST = {
  last: 0,
  gap: 0,
  passed: 0,
  jump: 0,
  pictures: 0,
  decoded: 0,
  late: 0,
  nearest: FAR_NEIGHBOURS,
  waited: 0,
  mounted: 0,
  bare: 0,
  unmade: 0,
  renders: 0,
};
const tally = { ...AT_REST, front: 0 };

/**
 * What a sleeve tapped or held is to do, as the rack last said, kept apart
 * from React under a token of the rack's own. The sleeves are handed one
 * function each that asks here, the same for as long as the rack stands:
 * handed the rack's own, made again at every detent, every sleeve in it was
 * drawn again at every detent, which thrown from far off was more than the
 * phone could do before the rack had gone past and left them blank.
 */
/**
 * Which record each of a rack's sleeves is standing for, by the order they
 * were put up, under the rack's token as above: kept from one detent to the
 * next, so that a sleeve once put up is given to another record rather than
 * taken down. See `sleeves` in the rack.
 */
const poolOf = new WeakMap<object, number[]>();
/** A place in the pool whose sleeve has been taken down. */
const VACANT = -1;

const handsOf = new WeakMap<
  object,
  {
    reach: (index: number) => void;
    hold?: (album: Album, touched: boolean) => void;
    pictured?: (album: Album, from: string, waited: number) => void;
  }
>();

function countScroll(index: number) {
  const now = performance.now();
  if (tally.last > 0) tally.gap = Math.max(tally.gap, now - tally.last);
  tally.last = now;
  const moved = Math.abs(index - tally.front);
  tally.front = index;
  tally.passed += moved;
  tally.jump = Math.max(tally.jump, moved);
}

function countPicture(away: number, from: string, sight: number, waited: number) {
  tally.pictures += 1;
  if (from !== 'memory') tally.decoded += 1;
  tally.waited = Math.max(tally.waited, waited);
  if (away >= sight) return;
  tally.late += 1;
  tally.nearest = Math.min(tally.nearest, away);
}

function reportFlick() {
  if (tally.passed > 0 || tally.pictures > 0) {
    console.log(
      `[rack] passed ${tally.passed} sleeves, at most ${tally.jump} between two scroll events, ` +
        `${Math.round(tally.gap)} ms the longest wait for one; ${tally.pictures} pictures, ` +
        `${tally.decoded} off the disk, ${tally.late} onto a sleeve already showing` +
        (tally.late > 0 ? ` (nearest ${tally.nearest.toFixed(1)} from the front)` : '') +
        `; ${tally.mounted} mounted, ${tally.bare} with no cover yet, ${tally.unmade} with no small copy yet, ${tally.renders} sleeve renders, ` +
        `${Math.round(tally.waited)} ms the longest from mount to picture`
    );
  }
  Object.assign(tally, AT_REST);
}

/**
 * Where each record sits, as a share of a sleeve's width from the middle, and
 * how much of its size it has left by the time it gets there. One entry per
 * step back through the rack.
 *
 * The first step is the big one — far enough for a sleeve to stand nearly
 * clear of the one in front, as the records either side of the one being
 * looked at do on the shelf this is drawn after. After that they close up,
 * 0.15 down to 0.05, every one of them less than what a sleeve turned that
 * far still covers (`turnOf`: some 0.35 of its width two steps out, 0.22 at
 * the last).
 * So they overlap, and each shows a slice of itself past the one in front of
 * it. That overlap is the rack. Space them by more than they cover and the
 * shelf comes apart into separate slabs with the background showing between
 * them, which is what happened when these once ran out to 1.20 while every
 * neighbour stood fully on edge.
 *
 * As wide as a phone held sideways has room for: the sleeve in front is sized
 * by the height, and there is width to spare either side of it.
 *
 * They also shrink, which has to be said explicitly: turning a card about one
 * axis leaves every card the same distance from the eye, so perspective alone
 * makes nothing recede.
 *
 * Before either, these stopped at the second neighbour and clamped — so
 * everything past it was drawn at the same place, at the same size, as the
 * second. Five records and a pile behind each end, which is what read as a
 * carousel rather than a rack.
 *
 * The last stands exactly behind the one before it, as large and as turned,
 * so that it is not seen: there it comes into being and goes, out of sight,
 * and a record joining the end of the rack comes out from behind the last.
 * Faded in where it would be seen, at the end of the rack, it blinked there
 * at every record the rack moved.
 */
const SPREAD = [0, 0.6, 0.75, 0.88, 0.99, 1.08, 1.16, 1.23, 1.29, 1.35, 1.41, 1.47, 1.53, 1.59, 1.65, 1.71, 1.77, 1.82, 1.82];

/**
 * On its way between the front and the first step, how far out a sleeve is,
 * at a quarter, a half and three quarters of the way: out quickly, so that
 * the one leaving the front and the one coming to it are apart as they pass
 * and never drawn one over the other. Drawn over each other there, the one to
 * be in front came over the other all at once as it got there.
 */
const LEAVING = [
  [0.25, 0.28],
  [0.5, 0.45],
  [0.75, 0.55],
] as const;
const SCALE = [1, 0.9, 0.86, 0.83, 0.8, 0.78, 0.76, 0.74, 0.72, 0.7, 0.68, 0.66, 0.64, 0.62, 0.6, 0.58, 0.56, 0.54, 0.54];

/**
 * How far a record is turned once it is off the front.
 *
 * Steep, because a rack is records filed on their edges with one pulled half
 * out to be looked at. Shallower reads as a row of sleeves leaning over.
 */
const ANGLE = 72;

/**
 * How far a sleeve is turned, in degrees, [away] steps from the front.
 *
 * One curve across the whole rack rather than a turn made within the first
 * step: off the front it turns as the square of how far it has come, slowly at
 * first, a record being looked at; then ever more slowly toward [ANGLE], so
 * that the neighbours are still turning as the rack moves -- the first
 * standing at some fifty degrees, the next at some sixty-five -- and no
 * sleeve snaps from facing to on edge.
 */
function turnOf(away: number): number {
  const square = away * away;
  return ANGLE * (square / (square + TURN_SOFT));
}

/** How soon the curve above leaves its square for the slow approach: smaller is sooner. */
const TURN_SOFT = 0.35;

/** How far out a sleeve is [away] from the front, at a step or on the way off the front: see {@link LEAVING}. */
function spreadAt(away: number): number {
  return LEAVING.find(([at]) => at === away)?.[1] ?? SPREAD[away]!;
}

/** Where the fan is given, as the animation runs straight between: every step, and the way off the front. */
const FAN_AT = (() => {
  const out = [...SPREAD.map((_, at) => at), ...LEAVING.map(([at]) => at)].sort((a, b) => a - b);
  return [...out.slice(1).reverse().map((at) => -at), ...out];
})();

/** The curve, as the animation is given it: this many points a step, which it runs straight between. */
const TURN_POINTS = 4;
const LEAN_AT = Array.from({ length: FAR_NEIGHBOURS * TURN_POINTS * 2 + 1 }, (_, at) => at / TURN_POINTS - FAR_NEIGHBOURS);

/*
  The tables the cards are placed from, as the thread that draws is handed
  them: how far out, as a share of a sleeve, and how far turned, in degrees,
  along the stops above; and at each step, how large. The last of them clamps.
*/
const FAN = FAN_AT.map((at) => Math.sign(at) * spreadAt(Math.abs(at)));
const LEAN = LEAN_AT.map((at) => -Math.sign(at) * turnOf(Math.min(Math.abs(at), FAR_NEIGHBOURS - 1)));
const STEPS = Array.from({ length: FAR_NEIGHBOURS * 2 + 1 }, (_, at) => at - FAR_NEIGHBOURS);
const SHRINK = STEPS.map((at) => SCALE[Math.abs(at)]!);
/** Seen all the way out but for the last, which comes and goes behind the one before it. */
const FADE_AT = [-FAR_NEIGHBOURS, -FAR_NEIGHBOURS + 1, 0, FAR_NEIGHBOURS - 1, FAR_NEIGHBOURS];
const FADE = [0, 1, 1, 1, 0];

/**
 * How far a finger goes for one record, as a share of a sleeve's width.
 * Where the sleeves are drawn does not hang on it -- the fan puts them -- only
 * how far a finger goes, or a throw carries, for each. It was 0.52, and the
 * rack ran under the finger.
 */
const RAIL_STEP = 0.9;

/**
 * How long a glide to rest takes at the most, in milliseconds; and from
 * standing, how long it takes for its length: a few milliseconds a point past
 * the least.
 */
const GLIDE_LONGEST = 1400;
/** Back to the start: from how many records off it slides the rest of the way, and in how long. */
const BACK_FROM = 8;
const BACK_MS = 380;
const GLIDE_LEAST = 220;
const GLIDE_PER_POINT = 1.3;

/**
 * How a glide slows: by the same share of its speed in every moment, as
 * anything sliding to rest does, so that it comes in ever more gently. This
 * is how many times over that share is taken away across the glide; at the
 * end a hundredth or so of the speed is left, too little to be seen to stop.
 */
const SLOWING = 4.5;

/** How far past either end the rack goes for a finger, as a share of how far the finger goes. */
const PAST_END = 0.35;

/** Slower than this when let go of, in points a millisecond, the finger had stopped: the nearest record, either way. */
const STILL_SPEED = 0.15;

/**
 * How far a throw carries, in milliseconds of the speed it was let go at:
 * slowing as above, it goes this many times its speed before it stops, and
 * comes to rest on the record nearest there, past the one it was on.
 */
const THROW_REACH = 160;

/** How much of its size a record passing the front keeps at its fastest, and how fast that is, in points a millisecond. */
const RECEDED = 0.86;
const RECEDE_SPEED = 3;

/** Depth of the perspective. Smaller is a wider lens and a harsher fan. */
const PERSPECTIVE = 900;

/**
 * Room the name of what is in front takes, and how far it sits off the floor.
 *
 * The room grows with the size of writing the phone is set to: at 52 whatever
 * the setting, the two lines of the caption were cut from about one and a
 * half times the ordinary size. Some thirty-three points of it are the lines.
 */
const captionHeight = (fontScale: number) => Math.round(19 + 33 * Math.min(Math.max(fontScale, 1), 2));
const CAPTION_LIFT = 18;

/** The margin the rack keeps from the edges of whatever it is given. */
const EDGE = 10;

/** How far off a record the rack can be and still be square on it, in records. */
const SQUARE_ENOUGH = 0.01;

/**
 * Which sleeve the rack is sized to hold, counting out from the front.
 *
 * Not the outermost. The last one runs off the edge of the frame and is meant
 * to — that is where the rack stops looking like it ends, and it is what the
 * thing this is drawn after does too. Sizing for every one of them would take
 * it off the sleeve in front, which is the one anybody is actually looking at.
 */
const FITS_TO = 3;

/**
 * How far that sleeve reaches from the middle, in sleeves.
 *
 * Its centre is [SPREAD] out, and from there it reaches half its own width —
 * but that width is not a sleeve's. It is turned nearly on edge and shrunk,
 * and what it covers is what is left after both: the cosine of the angle it is
 * turned through, times how much of its size it kept.
 *
 * Counting it as half a full sleeve is what left the rack small inside a frame
 * it was supposedly measured against.
 */
const HALF_SPAN =
  SPREAD[FITS_TO]! + 0.5 * SCALE[FITS_TO]! * Math.cos((turnOf(FITS_TO) * Math.PI) / 180);

/** How much of a sleeve its reflection takes up on the shelf below it. */
const MIRROR = 0.38;

/** Where a sleeve is on the glass, measured from the window's top left. */
export type Sleeve = { x: number; y: number; width: number; height: number };

/** What the screen holding the rack can ask of it. */
export type Rack = {
  /**
   * Where a record's sleeve is now, or null if it is not the one square on.
   *
   * Asked when a record that was opened is being put back, which can be long
   * after it was taken out: the phone may have been turned since, or the
   * player's panel may have arrived and taken a share of the width. Where the
   * sleeve was when it was tapped is not where it has to be returned to.
   */
  sleeveOf: (key: string, then: (sleeve: Sleeve | null) => void) => void;
  /** Back to the first record, as the tab pressed again asks; false when it is there already. */
  toStart: () => boolean;
  /** Seen from further off: brought back near, answering true; false where it already was. */
  nearer: () => boolean;
};

export function CoverFlow({
  albums,
  onOpen,
  onHold,
  caption = true,
  initial = 0,
  onSettle,
  ref,
}: {
  albums: Album[];
  /**
   * Open the record in front, given where its sleeve is so that whatever
   * opens can start out as that sleeve.
   */
  onOpen: (album: Album, sleeve: Sleeve) => void;
  /** The record in front, held down: the same menu a held row of the list opens. */
  onHold?: (album: Album) => void;
  /** The name of the record in front, under it. Left off where whatever holds the rack says it itself. */
  caption?: boolean;
  /** Which record it starts on: where it last was, for a rack made again, the phone having been turned. */
  initial?: number;
  /** Told which record it has come to rest on, each time it does: not as it passes them. */
  onSettle?: (index: number) => void;
  ref?: Ref<Rack>;
}) {
  const t = useT();
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  /*
    Its own size, not the window's. The rack sits under a header and over a tab
    bar, and centring on the window put the front record low enough to sit on
    top of the caption — which is what the whole layout is measured from.
  */
  const [{ width, height }, setBox] = useState({ width: 0, height: 0 });

  /*
    As large as the frame allows.

    Two things bound it. Across the rack, the fan — whose outermost sleeve is
    turned almost on edge and so takes far less room than a sleeve's width.
    Through it, the reflection below: a sleeve big enough to push its own
    reflection out of the frame has taken the room from the thing that made it
    look like a rack.

    The caption is drawn over the reflection rather than given a row of its
    own, so it costs nothing here.
  */
  const along = Math.max(0, width - EDGE * 2);
  const across = Math.max(0, height - EDGE * 2);
  /*
    In whole pixels, and floored so that rounding never takes it past the
    room it has: the picture and its reflection are then the same number of
    pixels each way wherever they stand, and are one picture read once. A
    pixel apart, they were two, each kept on the graphics side, and some
    sixty sleeves of two such pictures were more than it keeps: every one of
    them was sent over again in every frame.
  */
  const card =
    Math.floor(Math.min(along / (HALF_SPAN * 2), across / (1 + MIRROR)) * PixelRatio.get()) / PixelRatio.get();
  const mirror = card * MIRROR;
  // How far a finger goes for a record: a little over half a sleeve, which is what keeps the rack from running away under it.
  const step = card * RAIL_STEP;

  /** Where the rack is, in records: a whole number is a record square on. Moved only on the thread that draws. */
  const startAt = Math.min(Math.max(initial, 0), Math.max(albums.length - 1, 0));
  const position = useSharedValue(startAt);
  /*
    How fast the rack is going, nought to one: the records passing through the
    front are drawn back by it, so that they slide by behind and the one coming
    to rest comes forward as the rack slows.
  */
  const lift = useSharedValue(0);
  /*
    How near the rack is seen from, as the share of its size it is drawn at:
    one, as it stands; pinched, as little as {@link FAR_MOST}, the rack the
    same rack seen from across the room, more of it either side of the one
    in front. Left where the fingers leave it.
  */
  const distance = useSharedValue(1);
  const [wide, setWide] = useState(false);
  const pinchedFrom = useSharedValue(1);
  /*
    How far a finger goes for a record as the rack is drawn now, nearer or
    further. After [distance], not beside [step]: the thread that draws takes
    a copy of what a worklet reaches for as the worklet is made, and made
    before [distance] it took nothing, and the first drag from far off threw.
  */
  const span = () => {
    'worklet';
    /*
      Much faster than the sleeves shrink: seen from further off they stand
      closer as well, and from there the rack is for going a long way, so a
      drag or a throw goes some ten times as many records at the furthest;
      near, as it always was.
    */
    return step * Math.pow(distance.get(), 2.6);
  };
  // Where the rack was when the finger took it, less how far the finger had gone by then.
  const grabbed = useSharedValue(0);
  const stage = useRef<View>(null);
  const [front, setFront] = useState(startAt);
  /*
    Where a glide is going, once it is known: the records about there are
    mounted then, as it sets out, so that their pictures are in hand by the
    time it comes to rest among them. Mounted only as the rack came near, after
    a long throw they arrived on sleeves already in sight.
  */
  const [landing, setLanding] = useState<number | null>(null);
  /*
    Which way the rack is going, toward the later records or the earlier, as
    the last detent said; nought while it is still. Seen from far off, it is
    mounted further ahead that way, and only so far as is in sight the other.
  */
  const [heading, setHeading] = useState(0);
  /*
    Whether the rack is still: from far off, only then are the records about
    the front drawn from their pictures as they are (see {@link SHARP}). Read
    whole at every detent of a throw, three at a time, they held up the small
    copies of every sleeve behind them, and those came seconds late.
  */
  const [resting, setResting] = useState(true);
  const last = Math.max(albums.length - 1, 0);
  const reduced = motionReduced();

  /** True when a record is square on, near enough to be worth opening. */
  const squared = () => {
    const at = position.get();
    return Math.abs(at - Math.round(at)) < SQUARE_ENOUGH;
  };

  /*
    Which record is in front, told here as the rack comes to it: what is
    mounted, the caption, and a click, the way a detent does.
  */
  const detent = useCallback((index: number, before: number) => {
    if (MEASURE) countScroll(index);
    setFront(index);
    setHeading(Math.sign(index - before));
    haptic('notches', 'tick');
  }, []);
  useAnimatedReaction(
    () => Math.min(Math.max(Math.round(position.get()), 0), last),
    (now, before) => {
      if (before !== null && now !== before) runOnJS(detent)(now, before);
    },
    [last]
  );

  // Where it came to rest, said to whatever asked.
  const settled = useCallback(
    (index: number) => {
      setResting(true);
      // Still, it is as likely to go either way next: as far ahead both ways.
      setHeading(0);
      // Where it was going is where it is: nothing more is kept up for it.
      setLanding(null);
      onSettle?.(index);
    },
    [onSettle]
  );

  /*
    To rest on [target], setting out at [speed], in records a millisecond its
    way: at the speed it was let go at, so that letting go is not felt, and
    slowing as anything sliding to rest does, by the same share of its speed
    in every moment, coming in ever more gently -- never past it and never
    back. Set out slower than that would take it there in time, it gathers
    speed first and then slows, by a cubic; from standing, so too.
  */
  const glide = (target: number, speed: number) => {
    'worklet';
    const from = position.get();
    const way = Math.abs(target - from);
    if (way < 0.001 || reduced) {
      position.set(target);
      lift.set(withTiming(0, { duration: 160 }));
      runOnJS(settled)(target);
      return;
    }
    const toward = Math.max(0, Math.sign(target - from) * speed);
    // How steep the glide sets out, as a share of the way over the time it takes.
    const sliding = SLOWING / (1 - Math.exp(-SLOWING));
    let duration = toward > 0 ? (sliding * way) / toward : Infinity;
    let rate = SLOWING;
    if (duration > GLIDE_LONGEST || toward === 0) {
      duration = Math.min(GLIDE_LONGEST, GLIDE_LEAST + way * span() * GLIDE_PER_POINT);
      // As steep as the speed it set out at asks, over that time: the rate that gives it, found a step at a time.
      const steep = (toward * duration) / way;
      rate = steep > 1.02 ? steep : 0;
      for (let round = 0; round < 12 && rate > 0; round += 1) {
        const left = Math.exp(-rate);
        const off = rate / (1 - left) - steep;
        const slope = (1 - left - rate * left) / ((1 - left) * (1 - left));
        rate = Math.max(0.05, rate - off / slope);
      }
      if (rate === 0) {
        const cubic = steep;
        position.set(
          withTiming(target, {
            duration,
            easing: (x: number) => {
              'worklet';
              return cubic * (x * x * x - 2 * x * x + x) + (3 * x * x - 2 * x * x * x);
            },
          }, (finished) => {
            'worklet';
            if (!finished) return;
            if (MEASURE) runOnJS(reportFlick)();
            runOnJS(settled)(target);
          })
        );
        lift.set(withTiming(0, { duration, easing: Easing.out(Easing.quad) }));
        return;
      }
    }
    const k = rate;
    const slide = (x: number) => {
      'worklet';
      return (1 - Math.exp(-k * x)) / (1 - Math.exp(-k));
    };
    position.set(
      withTiming(target, { duration, easing: slide }, (finished) => {
        'worklet';
        if (!finished) return;
        if (MEASURE) runOnJS(reportFlick)();
        runOnJS(settled)(target);
      })
    );
    // As fast as the rack is going, which falls the same way.
    lift.set(withTiming(0, { duration, easing: slide }));
  };

  /** On to [index] from wherever the rack is, from standing. */
  const glideTo = (index: number) => {
    const target = Math.min(Math.max(index, 0), last);
    setLanding(target);
    setResting(false);
    runOnUI(() => {
      'worklet';
      cancelAnimation(position);
      glide(target, 0);
    })();
  };

  /*
    Back to the first record, for the tab pressed again: at once, as a list
    is scrolled to its top. From further off than a few records, the rack is
    put a few records from the start, the way there being nothing anybody
    wants to watch go by, and slides the rest; setting out at its fastest and
    slowing onto the first. A glide from rest, as `glideTo` makes, took its
    time getting going and up to a second and a half on the way; pressed again
    while it went, it began again from rest, and went slower still.
  */
  const backToStart = () => {
    setLanding(0);
    setResting(false);
    runOnUI(() => {
      'worklet';
      cancelAnimation(position);
      if (position.get() > BACK_FROM) position.set(BACK_FROM);
      lift.set(Math.max(lift.get(), 0.6));
      lift.set(withTiming(0, { duration: BACK_MS, easing: Easing.out(Easing.quad) }));
      position.set(
        withTiming(0, { duration: BACK_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          'worklet';
          if (finished) runOnJS(settled)(0);
        })
      );
    })();
  };

  /*
    The finger. It takes the rack from wherever it is, stopping a glide when
    it lands; carries it a record for every [step] it goes, and past either
    end only a little and against it; and lets it go on the way it was going
    -- to the next record for a slow release, further for a throw, as far as
    its speed would carry it slowing as a throw does. A touch that never moves
    leaves the rack on the nearest record, for a tap on a record that is
    not square to have stopped it there.
  */
  const pan = Gesture.Pan()
    // One finger: two are a pinch, which draws the rack further off or nearer (`pinch`).
    .maxPointers(1)
    .activeOffsetX([-8, 8])
    .failOffsetY([-24, 24])
    .onBegin(() => {
      cancelAnimation(position);
      cancelAnimation(lift);
    })
    .onStart((event) => {
      grabbed.set(position.get() + event.translationX / span());
      runOnJS(setResting)(false);
    })
    .onUpdate((event) => {
      const at = grabbed.get() - event.translationX / span();
      position.set(at < 0 ? at * PAST_END : at > last ? last + (at - last) * PAST_END : at);
      lift.set(Math.min(1, Math.abs(event.velocityX) / 1000 / RECEDE_SPEED));
    })
    .onEnd((event) => {
      // Points a millisecond, toward the later records.
      const velocity = -event.velocityX / 1000;
      const here = position.get();
      const speed = Math.abs(velocity);
      let target = Math.round(here);
      if (speed >= STILL_SPEED) {
        // The record nearest where the throw would carry it, but at least the next one its way.
        const reaches = Math.round(here + (velocity * THROW_REACH) / span());
        target = velocity > 0 ? Math.max(reaches, Math.ceil(here - SQUARE_ENOUGH)) : Math.min(reaches, Math.floor(here + SQUARE_ENOUGH));
      }
      const resting = Math.min(Math.max(target, 0), last);
      runOnJS(setLanding)(resting);
      glide(resting, velocity / span());
    })
    .onFinalize((_event, success) => {
      if (!success) glide(Math.min(Math.max(Math.round(position.get()), 0), last), 0);
    });

  /*
    Two fingers: the rack seen from further off, or nearer again, as the
    fingers go, and left there. Still the rack, flicked and turned as ever,
    only smaller and more of it either side.
  */
  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchedFrom.set(distance.get());
    })
    .onUpdate((event) => {
      const next = Math.min(1, Math.max(FAR_MOST, pinchedFrom.get() * event.scale));
      distance.set(next);
      if (next < FAR_WIDE && !wide) runOnJS(setWide)(true);
    })
    .onEnd(() => {
      // Nearly as it stands: as it stands.
      if (distance.get() > 0.94) distance.set(withTiming(1, { duration: 160 }));
    });
  const seen = useAnimatedStyle(() => ({ transform: [{ scale: distance.value }] }));
  // Back near once and for all, the further records let go of.
  useAnimatedReaction(
    () => distance.value >= 0.999,
    (near, was) => {
      if (near && was === false) runOnJS(setWide)(false);
    }
  );

  /**
   * Where the sleeve in front is on the glass.
   *
   * Only the frame is measured, and the sleeve is placed inside it by the same
   * arithmetic that draws it. Square on, its transforms come to nothing, so
   * what is left is the middle of the frame across and the middle of what the
   * reflection leaves through.
   */
  const sleeve = (then: (found: Sleeve | null) => void) => {
    const frame = stage.current;
    if (!frame) return then(null);
    frame.measureInWindow((x, y) =>
      then({
        x: x + (width - card) / 2,
        y: y + (height - mirror - card) / 2,
        width: card,
        height: card,
      })
    );
  };

  /**
   * Opens the record in front, or brings it round first.
   *
   * Tapped mid-flick it is square to nothing, and whatever it opens into would
   * set out from a sleeve that is not where it was said to be. So it is settled
   * and opening waits for the next tap.
   */
  const open = () => {
    const at = position.get();
    const album = albums[Math.round(at)];
    if (!album) return;
    if (!squared()) return glideTo(Math.round(at));
    sleeve((found) => {
      if (found) onOpen(album, found);
    });
  };

  /**
   * A record tapped. The one in front opens; any other comes to the front,
   * which is what reaching past it into the rack would do.
   */
  const reach = (index: number) => {
    if (index === Math.round(position.get())) open();
    else glideTo(index);
  };

  /**
   * The record in front held down. Only where it stands square: mid-flick the
   * one under the finger is not yet the one the caption names.
   */
  const hold = onHold
    ? (album: Album, touched: boolean) => {
        if (!squared()) return;
        // Felt under a finger only; a screen reader asking for the menu by name is holding nothing.
        if (touched) haptic('holds', 'hold');
        onHold(album);
      }
    : undefined;
  /** Where a picture arrived, for {@link MEASURE}. */
  const pictured = (album: Album, from: string, waited: number) =>
    countPicture(Math.abs(albums.indexOf(album) - position.get()), from, wide ? FAR_NEIGHBOURS : NEIGHBOURS, waited);

  const [hands] = useState(() => ({}));
  useEffect(() => {
    handsOf.set(hands, { reach, hold, pictured });
  });
  const pictureAny = useCallback(
    (album: Album, from: string, waited: number) => handsOf.get(hands)?.pictured?.(album, from, waited),
    [hands]
  );
  const reachAny = useCallback((index: number) => handsOf.get(hands)?.reach(index), [hands]);
  const holdAny = useCallback(
    (album: Album, touched: boolean) => handsOf.get(hands)?.hold?.(album, touched),
    [hands]
  );

  /*
    The covers, found before the rack is thrown across them, nearest first.

    A sleeve otherwise asks for its own as it is mounted, which is the wrong
    moment twice over: it is drawn empty and then again with its picture, and
    after a hard flick its question is behind those of every sleeve the flick
    passed on the way there.
  */
  useEffect(() => {
    const from = Math.round(position.get()) || 0;
    const covers = [albums[from]?.tracks];
    for (let out = 1; out < albums.length; out += 1) {
      covers.push(albums[from + out]?.tracks, albums[from - out]?.tracks);
    }
    return warmAlbumArtwork(covers);
  }, [albums, position]);

  /*
    Seen from far off, the small copies of the covers made ahead of the rack,
    nearest first: one not made yet is read whole to be made, as the sleeve
    that wants it goes by. Made once, and kept.
  */
  useEffect(() => {
    if (!wide) return;
    let stopped = false;
    const from = Math.round(position.get()) || 0;
    const run = async () => {
      for (let out = 0; out < albums.length; out += 1) {
        for (const at of out === 0 ? [from] : [from + out, from - out]) {
          if (stopped) return;
          const tracks = albums[at]?.tracks;
          if (!tracks) continue;
          const uri = await albumArtworkFor(tracks);
          if (uri?.startsWith('file://')) await thumbOf(uri);
        }
      }
    };
    run().catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [albums, position, wide]);

  useImperativeHandle(ref, () => ({
    sleeveOf: (key, then) => {
      if (albums[front]?.key !== key || !squared()) return then(null);
      sleeve(then);
    },
    nearer: () => {
      if (distance.get() >= 0.999) return false;
      distance.set(withTiming(1, { duration: 220 }));
      return true;
    },
    toStart: () => {
      if (position.get() < 0.5) return false;
      backToStart();
      return true;
    },
  }));

  /*
    The records wanted standing: those in sight and, further out than the fan
    reaches, by {@link AHEAD}, those about to be, put up and not yet seen; and,
    near, the same about where a throw will come to rest.

    Each is given a sleeve of those already standing (see {@link poolOf}),
    in preference to a new one. Through a flick from far off a sleeve was put
    up for every record coming into sight and one taken down for every record
    going out of it, a few every frame; the phone fell behind, and then put
    up some dozens at once, none of them with its picture yet, and for a
    moment there was no rack at all. Given to another record, a sleeve shows
    the picture it had until the new one has been read.

    The sleeves stay in the order they were first put up, and are painted
    front over back by `zIndex`, which goes with the front record as it
    changes. Put in order back to front instead, they moved among each other
    at every detent, and a sleeve moved was seen for a frame where it had been.
  */
  const sleeves = useMemo(() => {
    const ahead = wide ? FAR_NEIGHBOURS + FAR_AHEAD : NEIGHBOURS + AHEAD;
    const behind = wide && heading !== 0 ? FAR_NEIGHBOURS + FAR_BEHIND : ahead;
    const before = heading < 0 ? ahead : behind;
    const after = heading > 0 ? ahead : behind;
    const wanted = new Set<number>();
    /*
      Not about where a throw will land when seen from far off: a throw from
      there goes some dozens of records, and putting them all up as it set
      out kept the pictures of those in sight waiting behind theirs. The
      sleeves standing are handed on to them as the rack gets there.
    */
    for (const about of landing === null || wide ? [front] : [front, landing]) {
      for (let index = Math.max(0, about - before); index <= Math.min(albums.length - 1, about + after); index += 1) {
        wanted.add(index);
      }
    }
    // Each sleeve's record: its own as long as it is still wanted, and otherwise the one it last had, out of sight.
    const held = poolOf.get(hands) ?? [];
    const placed = new Set<number>();
    const free: number[] = [];
    held.forEach((index, sleeve) => {
      if (wanted.has(index) && !placed.has(index)) placed.add(index);
      else free.push(sleeve);
    });
    // Empty places filled first, then the ones furthest from the front: the last to be wanted back.
    const away = (sleeve: number) => (held[sleeve]! < 0 ? Infinity : Math.abs(held[sleeve]! - front));
    free.sort((a, b) => away(b) - away(a));
    const next = held.slice();
    let given = 0;
    for (const index of wanted) {
      if (placed.has(index)) continue;
      if (given < free.length) next[free[given++]!] = index;
      else next.push(index);
    }
    /*
      Close up and still, the sleeves no longer wanted are taken down, each
      leaving its place empty (VACANT) for the next to be put up, so that
      every other keeps its own record and its picture. Left standing, the
      dozens put up to be seen from far off were each drawn from its picture
      in full and put in its place every frame, and the rack went slowly from
      then on; moved up into fewer places, every record in sight changed
      sleeve, and read its picture again, each time the rack came to rest.
    */
    if (!wide && landing === null) {
      for (let sleeve = given; sleeve < free.length; sleeve += 1) next[free[sleeve]!] = VACANT;
      while (next.length > 0 && next[next.length - 1] === VACANT) next.pop();
    }
    poolOf.set(hands, next);
    return next;
  }, [albums.length, front, hands, heading, landing, wide]);

  /*
    Painted front over back: the one in front over everything, and either
    side of it each over the ones beyond. Numbered so that only the record
    coming to the front and the one leaving it change at a detent, the rest
    keeping theirs; numbered by how far from the front each was, every sleeve
    in the rack was told again at every detent, which thrown from far off was
    more than a phone could tell them before the rack had gone past.
  */
  const top = albums.length * 2 + 2;
  const zOf = (index: number) => (index === front ? top + 1 : index < front ? index : top - index);

  if (albums.length === 0 || width === 0) {
    return (
      <View
        style={[styles.stage, styles.empty]}
        onLayout={(event) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setBox((held) => (held.width === w && held.height === h ? held : { width: w, height: h }));
        }}>
        {albums.length === 0 ? (
          <Text style={styles.emptyText}>{t.library.noAlbums}</Text>
        ) : null}
      </View>
    );
  }

  const current = albums[Math.min(Math.max(front, 0), albums.length - 1)];

  return (
    <View
      ref={stage}
      style={styles.stage}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setBox((held) => (held.width === w && held.height === h ? held : { width: w, height: h }));
      }}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <Animated.View style={[StyleSheet.absoluteFill, seen]}>
          {sleeves.map((index, sleeve) =>
            index === VACANT || index >= albums.length ? null : (
              <Card
                key={sleeve}
                album={albums[index]}
                index={index}
                position={position}
                lift={lift}
                size={card}
                left={(width - card) / 2}
                bottom={mirror}
                z={zOf(index)}
                inFront={index === front}
                sharp={!wide || (resting && Math.abs(index - front) <= SHARP)}
                onReach={reachAny}
                onHold={onHold ? holdAny : undefined}
                onPicture={MEASURE ? pictureAny : undefined}
              />
            )
          )}
        </Animated.View>
      </GestureDetector>

      {caption ? (
        <View style={[styles.caption, { height: captionHeight(fontScale) }]} pointerEvents="box-none">
          {/* Its name leads to the record's page and whoever it is by to theirs; the rest of the caption lets a finger through to the rack. */}
          <Text style={styles.name} numberOfLines={1}>
            <AlbumLink name={current.name} albumKey={current.key} />
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            <AlbumBy artist={current.artist} year={current.year} />
          </Text>
        </View>
      ) : null}

    </View>
  );
}

/**
 * One record of the rack.
 *
 * Remembered, and handed nothing that changes as the rack moves except whether
 * it is the one in front. So a detent draws two of these again — the one that
 * was in front and the one that now is — and mounts one, rather than drawing
 * all of them; where each one is has never been JavaScript's to say.
 */
const Card = memo(function Card({
  album,
  index,
  position,
  lift,
  size,
  left,
  bottom,
  z,
  inFront,
  sharp,
  onReach,
  onHold,
  onPicture,
}: {
  album: Album;
  /** Which record this is, counting from the first. */
  index: number;
  /** Where the rack is, in records. */
  position: SharedValue<number>;
  /** How fast the rack is going, nought to one: the faster, the further back a record passing the front is drawn. */
  lift: SharedValue<number>;
  size: number;
  /** The one square on, the only one held down for its menu. */
  inFront: boolean;
  /** Drawn from its picture as it is; otherwise from the small copy of it, as the rack seen from far off. */
  sharp: boolean;
  /** Where its berth is in the frame: see below. */
  left: number;
  bottom: number;
  /** Over which of the others it is painted. */
  z: number;
  /** Brings this record to the front, or opens it there. The same function for every card. */
  onReach: (index: number) => void;
  /** The same again for a record held down; only the one in front offers it. */
  onHold?: (album: Album, touched: boolean) => void;
  /** Told when the picture is there and where it came from. Only while measuring. */
  onPicture?: (album: Album, from: string, waited: number) => void;
}) {
  const t = useT();
  const styles = useStyles();
  const cover = useAlbumArtwork(album.tracks);
  /*
    The copy until the picture itself is there, and the other way round: a
    picture whose address changes is shown until the new one has been read,
    so a sleeve coming to the front or going from it is never seen empty.
  */
  const small = useThumb(cover, !sharp);
  const artwork = sharp ? cover : (small ?? cover);
  const press = () => onReach(index);
  const [mountedAt] = useState(() => performance.now());
  useEffect(() => {
    if (!MEASURE) return;
    tally.renders += 1;
  });
  const [bareAtMount] = useState(() => cover == null);
  const [unmadeAtMount] = useState(() => !sharp && cover != null && small == null);
  useEffect(() => {
    if (!MEASURE) return;
    tally.mounted += 1;
    if (bareAtMount) tally.bare += 1;
    if (unmadeAtMount) tally.unmade += 1;
  }, [bareAtMount, unmadeAtMount]);
  const held = inFront && onHold ? (touched: boolean) => onHold(album, touched) : undefined;

  /*
    Out along the fan from the middle of the frame, by how far it is from
    where the rack is, worked out on the thread that draws in the frame the
    rack moved in.

    Perspective has to be the first entry, and the lean has to come after the
    slide: rotating first would turn the axis the card then moves along, and
    the fan would bend towards the viewer instead of away.
  */
  const placed = useAnimatedStyle(() => {
    const away = index - position.value;
    const passing = interpolate(away, [-1, 0, 1], [0, 1, 0], Extrapolation.CLAMP);
    const back = 1 - lift.value * (1 - RECEDED) * passing;
    return {
      opacity: interpolate(away, FADE_AT, FADE, Extrapolation.CLAMP),
      transform: [
        { perspective: PERSPECTIVE },
        { translateX: size * interpolate(away, FAN_AT, FAN, Extrapolation.CLAMP) },
        { rotateY: `${interpolate(away, LEAN_AT, LEAN, Extrapolation.CLAMP)}deg` },
        { scale: interpolate(away, STEPS, SHRINK, Extrapolation.CLAMP) * back },
      ],
    };
  });

  return (
    <View
      collapsable={false}
      style={[
        styles.berth,
        /*
          Every one in the middle of the frame, where the one in front
          stands, and put out along the fan by its transforms; through the
          rack the whole frame less the reflection's share, so what ends up
          centred is the record and its reflection together.
        */
        { left, width: size, top: 0, bottom, zIndex: z },
      ]}
      pointerEvents="box-none">
      <Animated.View style={[styles.card, { width: size, height: size }, placed]}>
        <View style={[styles.face, { width: size, height: size }]}>
          <Pressable
            style={styles.art}
            accessibilityRole="button"
            // Only the one in front says so, because only it does: a neighbour
            // is brought forward by the slot it stands in, not opened.
            accessibilityLabel={inFront ? t.library.rack.open(album.name) : album.name}
            accessibilityHint={inFront ? t.library.rack.openHint : t.library.rack.bringForward}
            // Named, as a row's is: nobody finds a held sleeve by trying.
            accessibilityActions={
              held ? [{ name: 'longpress', label: t.library.albumMenu }] : undefined
            }
            onAccessibilityAction={
              held &&
              ((event) => {
                if (event.nativeEvent.actionName === 'longpress') held(false);
              })
            }
            onPress={press}
            onLongPress={held && (() => held(true))}>
            {artwork ? (
              <Image
                source={{ uri: artwork }}
                style={styles.art}
                contentFit="cover"
                cachePolicy={KEPT}
                onLoad={onPicture && ((event) => onPicture(album, event.cacheType, performance.now() - mountedAt))}
              />
            ) : (
              <View style={[styles.art, styles.artEmpty]} />
            )}
          </Pressable>
        </View>

        {/* The shelf the records are standing on. */}
        <Mirror uri={artwork} size={size} />
      </Animated.View>
    </View>
  );
});

/**
 * Where a sleeve's picture is kept once it has been read: in memory as well as
 * on the disk.
 *
 * Left to itself the image view keeps nothing in memory, so a sleeve was read
 * off the disk and decoded each time it was mounted — passed a second ago or
 * not — and its reflection, which is the same picture at the same size, was a
 * second reading of its own. In memory the two are one picture, and a sleeve
 * the rack comes back to has it on the frame it is mounted.
 */
const KEPT = 'memory-disk';

/**
 * A sleeve reflected off whatever it is standing on.
 *
 * The fade is one gradient into the colour it stands on, drawn by React
 * Native itself. It was six bands of that colour, each fainter than the one
 * below it: six views a record, some four hundred in a rack seen from far off,
 * and six of the many things the phone drew at every frame of a flick for
 * each record in sight.
 */
function Mirror({ uri, size }: { uri: string | null; size: number }) {
  const styles = useStyles();
  const depth = size * MIRROR;
  /* Pinned by the edge it reflects off, which is the sleeve's bottom. */
  const frame = { width: size, height: depth, top: '100%' as const };

  return (
    <View style={[styles.mirror, frame]} pointerEvents="none">
      {/*
        Faint by a view of React Native's own around the picture rather than by
        the picture's: one of its own is drawn faint as it is drawn, where the
        picture's view is drawn whole aside and then faded, which for every
        sleeve in the rack at every frame was most of what the rack cost.
      */}
      {uri ? (
        <View style={{ width: size, height: size, opacity: 0.28 }}>
          <Image
            source={{ uri }}
            style={[{ width: size, height: size }, { transform: [{ scaleY: -1 }] }]}
            contentFit="cover"
            cachePolicy={KEPT}
          />
        </View>
      ) : null}
      <View style={styles.fade} />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  stage: { flex: 1, backgroundColor: c.bg },
  // One record's place, in the middle of the frame: the fan puts it out from there.
  berth: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 36 },
  emptyText: { color: c.textFaint, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  card: { position: 'absolute', alignItems: 'center' },
  // Flat, as the stage is: the sleeves stand in front of one another, and
  // one of glass would show the next through it until its picture came.
  face: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: laid(c.surface, c.bg),
  },
  art: { width: '100%', height: '100%' },
  artEmpty: { backgroundColor: c.surfaceRaised },

  // Sits against the sleeve, in the card's own transformed space, so it leans
  // and recedes with it.
  mirror: { position: 'absolute', overflow: 'hidden' },
  // The stage's own colour, since what a reflection fades into is whatever
  // it is standing on.
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // As faint at the top as the first of the bands it was, and as strong at the foot as the last.
    experimental_backgroundImage: `linear-gradient(180deg, ${withAlpha(c.bg, 0.1)} 8%, ${withAlpha(c.bg, 0.95)} 92%)`,
  },

  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: CAPTION_LIFT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 20,
  },
  /*
    A shadow under the writing, because it is not written on a background.

    The caption is drawn over the rack rather than below it — that is what lets
    the sleeves have the whole frame — so what is behind any given letter is
    whatever sleeve happens to be there. Upright that is a run of artwork right
    under the words. The shadow is what keeps them legible against a bright
    one without having to put a bar behind them and take the height back.

    In the stage's colour rather than in black: the words are the theme's, so
    what sets them off from a sleeve has to be the shade they were chosen to be
    read on, which is black only in a dark theme.
  */
  name: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: c.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  detail: {
    color: c.textSecondary,
    fontSize: 12.5,
    textShadowColor: c.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
}));
