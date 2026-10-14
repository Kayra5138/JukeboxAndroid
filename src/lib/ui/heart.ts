/**
 * A heart on the player, and what a run of presses on it comes to.
 *
 * The heart keeps nothing. Pressing it sends a heart up the screen, and
 * pressing it again and again sends more of them, and stranger ones; that is
 * all it is for. What is here is the part that can be reasoned about without
 * a screen: how presses close together add up, and what each press lets go.
 */

/** Presses no further apart than this are one run. */
export const RUN_GAP_MS = 650;

/** How a run is going: more is let go at each, and from `storm` on it shows. */
export type Mood = 'one' | 'flurry' | 'storm' | 'frenzy' | 'glory';

/** How many presses into a run each mood begins. */
const FLURRY_AT = 4;
const STORM_AT = 9;
const FRENZY_AT = 16;
/** Some seconds of it without a pause: nobody gets here by accident. */
export const GLORY_AT = 30;

export type Run = { count: number; at: number };

export const NO_RUN: Run = { count: 0, at: 0 };

/** The run after a press at [now]: one longer, or begun again where the last press was too long ago. */
export function pressed(run: Run, now: number): Run {
  return { count: now - run.at <= RUN_GAP_MS ? run.count + 1 : 1, at: now };
}

export function moodOf(run: Run): Mood {
  if (run.count >= GLORY_AT) return 'glory';
  if (run.count >= FRENZY_AT) return 'frenzy';
  if (run.count >= STORM_AT) return 'storm';
  if (run.count >= FLURRY_AT) return 'flurry';
  return 'one';
}

/** One heart on its way up. Every length is a share of how far the tallest may rise. */
export type Flight = {
  key: string;
  /** How far to one side it ends up, from -1 to 1. */
  drift: number;
  /** How far it rises, from nought to one. */
  rise: number;
  /** Its size, in times the button's own heart. */
  size: number;
  /** Degrees it has turned by the top. */
  turn: number;
  ms: number;
  /** Milliseconds it waits before setting off, so that several let go at once do not go as one. */
  wait: number;
  /** Which of the mood's colours it wears. */
  shade: number;
  /** One that swells where it stands and does not rise: the heart of a frenzy. */
  swell?: boolean;
  /** The mood it was let go in, which is what it wears however the run goes on. */
  mood: Mood;
  /**
   * For one that does not come from the button at all: where on the screen
   * it appears, each from nought to one. It glitters there and drifts up a
   * little, and `rise` and `drift` are not read.
   */
  at?: { x: number; y: number };
  /** A glint and not a heart. */
  spark?: boolean;
};

const PER_PRESS: Record<Mood, number> = { one: 1, flurry: 3, storm: 6, frenzy: 9, glory: 7 };

/** What the whole screen is given at each press of a run at its very height, and at the press that reaches it. */
const GLITTER = { hearts: 7, sparks: 6, atFirst: 34 };

/**
 * What a press lets go.
 *
 * One heart, straight up, for a press by itself. A run fans them out, then
 * makes them many, bigger and turning, and at its height adds one that
 * swells over the whole button at every fourth press. Kept up for some
 * seconds it stops being about the button: hearts and glints come out all
 * over the screen, a great many at the press that gets there and more at
 * every press after. [random] is where the
 * variety comes from, handed in so that a test can know what it will be.
 */
export function flightsOf(run: Run, random: () => number = Math.random): Flight[] {
  const mood = moodOf(run);
  const wild = mood === 'storm' || mood === 'frenzy' || mood === 'glory';
  const flights: Flight[] = [];
  for (let index = 0; index < PER_PRESS[mood]; index += 1) {
    const spread = mood === 'one' ? 0.18 : mood === 'flurry' ? 0.55 : 1;
    flights.push({
      key: `${run.at}-${run.count}-${index}`,
      drift: (random() * 2 - 1) * spread,
      rise: mood === 'one' ? 0.55 + random() * 0.15 : 0.5 + random() * 0.5,
      size: wild ? 0.8 + random() * 1.3 : 0.9 + random() * 0.4,
      turn: wild ? (random() * 2 - 1) * 70 : (random() * 2 - 1) * 18,
      ms: 900 + random() * (wild ? 900 : 400),
      wait: index === 0 ? 0 : random() * 160,
      shade: Math.floor(random() * 1000),
      mood,
    });
  }
  if ((mood === 'frenzy' || mood === 'glory') && run.count % 4 === 0) {
    flights.push({ key: `${run.at}-${run.count}-swell`, drift: 0, rise: 0.35, size: 4.5, turn: 0, ms: 700, wait: 0, shade: 0, swell: true, mood });
  }
  if (mood === 'glory') {
    const first = run.count === GLORY_AT;
    const hearts = GLITTER.hearts + (first ? GLITTER.atFirst : 0);
    const sparks = GLITTER.sparks + (first ? GLITTER.atFirst / 2 : 0);
    for (let index = 0; index < hearts + sparks; index += 1) {
      const spark = index >= hearts;
      flights.push({
        key: `${run.at}-${run.count}-${spark ? 'spark' : 'glitter'}-${index}`,
        drift: 0,
        rise: 0,
        size: spark ? 0.5 + random() * 0.9 : 0.9 + random() * 2.2,
        turn: (random() * 2 - 1) * 35,
        ms: spark ? 700 + random() * 900 : 1500 + random() * 1500,
        // Not all at once: the screen fills over most of a second, which is what makes it a shower.
        wait: random() * (first ? 900 : 350),
        shade: Math.floor(random() * 1000),
        mood,
        at: { x: random(), y: random() },
        spark,
      });
    }
  }
  return flights;
}

/** No more than this many are in the air; a longer run lets the oldest go. */
export const MOST_AT_ONCE = 160;
