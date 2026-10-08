import { heldBand, heldPreamp, sameBands, type Band, type Preset } from './bands.ts';
import { strings, type Strings } from '../i18n/languages.ts';

/**
 * Somewhere to start from.
 *
 * Few on purpose. The phone's own equalizer came with a dozen names --
 * "Rock", "Jazz", "Classical" -- that are a claim about a kind of music, and
 * no curve is right for a kind of music. These say what they do to the sound
 * instead, each is two bands at most, and any of them is a starting point to
 * be pulled about rather than an answer.
 *
 * None carries a preamp: each gets the automatic one, which is exactly the
 * room its own boost needs.
 *
 * The name here is what a curve is known by wherever it is compared or
 * stored, and stays English. What is drawn on its chip is `labelOf`.
 */
export const BUILT_IN: Preset[] = [
  // No bands at all rather than a row of them at nought: flat is the absence
  // of an equalizer, and the way back from anything.
  { name: 'Flat', preampDb: null, bands: [] },
  {
    name: 'More bass',
    preampDb: null,
    bands: [{ type: 'lowShelf', frequencyHz: 100, gainDb: 5, q: 0.7 }],
  },
  {
    name: 'Less boom',
    preampDb: null,
    bands: [{ type: 'peak', frequencyHz: 160, gainDb: -4, q: 1 }],
  },
  {
    name: 'Warm',
    preampDb: null,
    bands: [
      { type: 'lowShelf', frequencyHz: 180, gainDb: 3, q: 0.7 },
      { type: 'highShelf', frequencyHz: 6_000, gainDb: -3, q: 0.7 },
    ],
  },
  {
    name: 'Voices forward',
    preampDb: null,
    bands: [
      { type: 'lowShelf', frequencyHz: 120, gainDb: -2, q: 0.7 },
      { type: 'peak', frequencyHz: 2_500, gainDb: 3, q: 1 },
    ],
  },
  {
    name: 'More air',
    preampDb: null,
    bands: [{ type: 'highShelf', frequencyHz: 8_000, gainDb: 4, q: 0.7 }],
  },
  {
    // What the ear loses first when the volume comes down: both ends.
    name: 'Quiet listening',
    preampDb: null,
    bands: [
      { type: 'lowShelf', frequencyHz: 90, gainDb: 6, q: 0.7 },
      { type: 'highShelf', frequencyHz: 9_000, gainDb: 3, q: 0.7 },
    ],
  },
];

/** The longest a name may be, which is about what fits on a chip. */
export const MAX_NAME = 40;

/** How many curves of one's own are kept. */
export const MAX_PRESETS = 40;

const key = (name: string) => name.trim().toLowerCase();

/**
 * What a preset is called on screen.
 *
 * One of the user's own is called what they called it. A built-in is called
 * its name in the language in use, which is looked up by the English one.
 */
export function labelOf(name: string, t: Strings = strings()): string {
  const builtIn: Record<string, string> = t.sound.presets.builtIn;
  return BUILT_IN.some((preset) => preset.name === name) ? (builtIn[name] ?? name) : name;
}

/**
 * Every name a built-in answers to: the one it is kept under, and the one it
 * is shown as. Both are taken, since a chip of the user's own reading the same
 * as the built-in's beside it is two curves under one name to anybody looking.
 */
function builtInNames(t: Strings): string[] {
  return BUILT_IN.flatMap((preset) => [preset.name, labelOf(preset.name, t)]);
}

/**
 * The name of the preset the bands and preamp are exactly, or null.
 *
 * Worked out rather than remembered. A stored "this is Warm" would go on
 * saying so after a band had moved, and would have to be cleared in every
 * place a band can move from; asking whether the curve still is that preset
 * cannot be wrong.
 */
export function matching(bands: Band[], preampDb: number | null, presets: Preset[]): string | null {
  for (const preset of presets) {
    if (preset.preampDb === preampDb && sameBands(preset.bands, bands)) return preset.name;
  }
  return null;
}

/**
 * A name nothing else in `taken` has, made from `wanted` by counting.
 *
 * Names are compared without regard to case or the spaces round them: two
 * chips reading "Car" and "car" are one name to anybody looking at them.
 */
export function freeName(wanted: string, taken: string[], t: Strings = strings()): string {
  const base = wanted.trim().slice(0, MAX_NAME) || t.sound.presets.myCurve;
  const used = new Set(taken.map(key));
  if (!used.has(key(base))) return base;
  for (let count = 2; ; count++) {
    const next = `${base.slice(0, MAX_NAME - 3)} ${count}`;
    if (!used.has(key(next))) return next;
  }
}

/**
 * The user's presets with this curve kept under `name`.
 *
 * Saving under a name already used for one of the user's own replaces it,
 * which is what saving over something means. A built-in's name cannot be
 * taken: the curve is kept under the next free one instead, and the name it
 * ended up with comes back so the screen can say so.
 */
export function saved(
  presets: Preset[],
  name: string,
  bands: Band[],
  preampDb: number | null,
  t: Strings = strings()
): { presets: Preset[]; name: string } {
  const builtIn = builtInNames(t);
  const wanted = name.trim().slice(0, MAX_NAME);
  const existing = presets.findIndex((preset) => key(preset.name) === key(wanted));
  const entry = (as: string): Preset => ({
    name: as,
    preampDb: heldPreamp(preampDb),
    bands: bands.map(heldBand),
  });

  if (wanted && existing >= 0) {
    const next = presets.slice();
    next[existing] = entry(presets[existing].name);
    return { presets: next, name: presets[existing].name };
  }
  const free = freeName(wanted, [...builtIn, ...presets.map((preset) => preset.name)], t);
  // The oldest go to make room, rather than the new one being refused.
  return { presets: [...presets, entry(free)].slice(-MAX_PRESETS), name: free };
}

/** The user's presets with one renamed; the name it actually got comes back too. */
export function renamed(
  presets: Preset[],
  from: string,
  to: string,
  t: Strings = strings()
): { presets: Preset[]; name: string } {
  const index = presets.findIndex((preset) => preset.name === from);
  if (index < 0) return { presets, name: from };
  const others = [
    ...builtInNames(t),
    ...presets.filter((_, at) => at !== index).map((preset) => preset.name),
  ];
  const name = freeName(to, others, t);
  const next = presets.slice();
  next[index] = { ...presets[index], name };
  return { presets: next, name };
}

export function removed(presets: Preset[], name: string): Preset[] {
  return presets.filter((preset) => preset.name !== name);
}
