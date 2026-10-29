import type { Mood, Run } from './heart.ts';

/**
 * What the lyrics button lets go when it is pressed again and again: words
 * out of the song, rising from the button, and at the very height of a run
 * whole lines of it falling over the screen. Nothing here knows about a
 * screen; `PlayerFun.tsx` draws it.
 */

/** The song's own words where it has lyrics, its name and its artist's where it has not; each once, in order. */
export function wordsOf(lyrics: { plain: string | null; synced: string | null } | null, title: string, artist: string | null): string[] {
  const lines = linesOf(lyrics);
  const source = lines.length > 0 ? lines.join(' ') : `${title} ${artist ?? ''}`;
  const seen = new Set<string>();
  const words: string[] = [];
  for (const word of source.split(/\s+/)) {
    const bare = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (bare.length < 2 || seen.has(bare.toLowerCase())) continue;
    seen.add(bare.toLowerCase());
    words.push(bare);
  }
  return words.length > 0 ? words : [title];
}

/** The lines of the lyrics, without the timings a synced copy carries and without the empty ones. */
export function linesOf(lyrics: { plain: string | null; synced: string | null } | null): string[] {
  const text = lyrics?.plain ?? lyrics?.synced ?? '';
  return text
    .split('\n')
    .map((line) => line.replace(/\[[^\]]*\]/g, '').trim())
    .filter((line) => line.length > 0);
}

/** One word on its way: up from the button, or down the screen. Lengths are shares of the screen. */
export type Flying = {
  key: string;
  text: string;
  /** Rising from the button, or one of the lines falling over everything. */
  kind: 'rise' | 'fall';
  /** Where on the screen a rising word sets off from, as it was when it was let go: the middle of the button. */
  from?: { x: number; y: number };
  /** For a falling line, where across the screen, from nought to one; for a rising word, how far to one side, from -1 to 1. */
  x: number;
  size: number;
  turn: number;
  ms: number;
  wait: number;
};

const PER_PRESS: Record<Mood, number> = { one: 0, flurry: 2, storm: 3, frenzy: 4, glory: 4 };
/** Lines over the screen at the press that reaches the height of a run, and at each press after. */
const RAIN = { first: 18, after: 6 };

/** What a press of the lyrics button lets go, [run] presses into a run, out of [words] and [lines]. */
export function flyingOf(run: Run, mood: Mood, firstOfGlory: boolean, words: readonly string[], lines: readonly string[], random: () => number = Math.random): Flying[] {
  const flying: Flying[] = [];
  const pick = <T,>(from: readonly T[]) => from[Math.floor(random() * from.length)]!;
  for (let index = 0; index < PER_PRESS[mood] && words.length > 0; index += 1) {
    flying.push({
      key: `${run.at}-${run.count}-w${index}`,
      text: pick(words),
      kind: 'rise',
      x: random() * 2 - 1,
      size: mood === 'flurry' ? 14 + random() * 4 : 15 + random() * 9,
      turn: (random() * 2 - 1) * (mood === 'flurry' ? 10 : 30),
      ms: 1100 + random() * 700,
      wait: index === 0 ? 0 : random() * 150,
    });
  }
  if (mood === 'glory') {
    const from = lines.length > 0 ? lines : words;
    const count = firstOfGlory ? RAIN.first : RAIN.after;
    for (let index = 0; index < count && from.length > 0; index += 1) {
      flying.push({
        key: `${run.at}-${run.count}-r${index}`,
        text: pick(from),
        kind: 'fall',
        x: random(),
        size: 13 + random() * 13,
        turn: (random() * 2 - 1) * 8,
        ms: 1800 + random() * 1600,
        wait: random() * (firstOfGlory ? 900 : 300),
      });
    }
  }
  return flying;
}

/**
 * No more than this many words are on the screen at once. A longer run lets
 * the newest go rather than the oldest: a line half way down the screen
 * taken away for a new one at the top looked like the rain starting over at
 * every press.
 */
export const MOST_FLYING = 90;

/** [now] with as many of [more] as there is room for under [most], the ones on their way kept. */
export function joinFlying(now: readonly Flying[], more: readonly Flying[], most: number = MOST_FLYING): Flying[] {
  return [...now, ...more.slice(0, Math.max(0, most - now.length))];
}
