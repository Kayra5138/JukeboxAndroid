/**
 * Paper thrown in the air at the end of a run that reached the end.
 *
 * Worked out rather than simulated. Every scrap is a handful of numbers settled
 * once, and where it is at any moment is a formula of those and the time, so
 * nothing is stepped, nothing is remembered between frames, and a frame that
 * arrives late draws the scrap where it should be by then rather than one step
 * behind. It also means the whole thing can be tested without a screen.
 */

/** How long the whole burst lasts, first scrap leaving to last scrap gone. */
export const CONFETTI_SEC = 3.4;

/** How many colours a scrap may ask for; the screen decides what they are. */
export const CONFETTI_COLOURS = 6;

/**
 * How quickly the air takes the throw out of a scrap, per second.
 *
 * This is the whole difference between paper and a ball. A ball thrown up
 * comes down as fast as it went; paper is stopped by the air almost at once
 * and then drifts. So a scrap leaves fast, hangs, and falls slowly, which is
 * what makes it read as confetti rather than as things being dropped.
 */
const DRAG = 1.7;

/** How fast a scrap ends up falling once the air has won, in points a second. */
const DRIFT = 250;

/** How long a scrap takes to fade at the end of its life. */
const FADE_SEC = 0.7;

export type Scrap = {
  x0: number;
  y0: number;
  /** Speed it leaves at. Up is negative, as on the screen. */
  vx: number;
  vy: number;
  /** When it leaves, counted from the start of the burst. */
  delay: number;
  /** How fast it turns in its own plane, radians a second. */
  spin: number;
  /** How fast it tumbles end over end, which is seen as it thinning and widening. */
  tumble: number;
  /** How far it sways from side to side on the way down, and where in the sway it starts. */
  sway: number;
  phase: number;
  wide: number;
  tall: number;
  colour: number;
};

/** The same numbers every time for the same seed, so a burst can be tested. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A burst for a board of the given size.
 *
 * Thrown from the two bottom corners towards the middle, turn and turn about,
 * rather than dropped from the top: something rising is a thing being done,
 * and something falling from off screen is only weather. Everything is scaled
 * to the board so it fills a tablet and does not overshoot a small phone.
 */
export function confettiFor(count: number, width: number, height: number, seed = 7): Scrap[] {
  const next = random(seed);
  const between = (low: number, high: number) => low + (high - low) * next();
  const scale = height > 0 ? height / 780 : 1;
  const scraps: Scrap[] = [];
  for (let index = 0; index < count; index++) {
    const fromLeft = index % 2 === 0;
    // How far across the board it gets before the air stops it. A throw's
    // sideways reach is its speed over the drag, so the speed is that reach
    // multiplied back up.
    const reach = between(0.08, 0.92) * width;
    scraps.push({
      x0: fromLeft ? -12 : width + 12,
      y0: height * between(0.7, 0.8),
      vx: (fromLeft ? 1 : -1) * reach * DRAG,
      vy: -between(850, 1450) * scale,
      delay: between(0, 0.32),
      spin: between(-7, 7),
      tumble: between(5, 12),
      sway: between(6, 22),
      phase: between(0, Math.PI * 2),
      wide: Math.round(between(8, 14)),
      tall: Math.round(between(12, 22)),
      colour: Math.floor(next() * CONFETTI_COLOURS),
    });
  }
  return scraps;
}

/**
 * Where a scrap is, and how it is turned, [atSec] into the burst.
 *
 * Nothing before it has left and nothing once the burst is over: both are
 * answered with an opacity of nought rather than left to whatever the formula
 * happens to say there.
 */
export function scrapAt(
  scrap: Scrap,
  atSec: number
): { x: number; y: number; turn: number; flat: number; opacity: number } {
  'worklet';
  const t = atSec - scrap.delay;
  if (t <= 0 || atSec >= CONFETTI_SEC) {
    return { x: scrap.x0, y: scrap.y0, turn: 0, flat: 1, opacity: 0 };
  }
  // The share of the throw the air has taken so far, nought to one.
  const spent = (1 - Math.exp(-DRAG * t)) / DRAG;
  const x = scrap.x0 + scrap.vx * spent + scrap.sway * Math.sin(scrap.phase + t * 3.1) * Math.min(1, t);
  const y = scrap.y0 + DRIFT * t + (scrap.vy - DRIFT) * spent;
  const left = CONFETTI_SEC - atSec;
  const opacity = left >= FADE_SEC ? 1 : left / FADE_SEC;
  return {
    x,
    y,
    turn: scrap.spin * t,
    // Never quite edge on: a scrap with no thickness at all is a scrap that
    // blinks out of existence twice a turn.
    flat: 0.25 + 0.75 * Math.abs(Math.cos(scrap.phase + scrap.tumble * t)),
    opacity,
  };
}
