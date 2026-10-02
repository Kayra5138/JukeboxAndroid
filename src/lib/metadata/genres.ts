import { MUSICBRAINZ_GENRES } from './data/genre-vocabulary.ts';
// The same form tags are stored in, so a genre and a tag are comparable — they
// end up in the same column, and did not always agree on how to spell a case.
import { canonicalLabel as canonical } from './text.ts';

export type WeightedGenre = { name: string; count: number };

/** Both sides go through `canonical`, or the comparison is not one. */
const VOCABULARY = new Set(MUSICBRAINZ_GENRES.map(canonical));

/**
 * Whether a label is a genre rather than a description of one.
 *
 * MusicBrainz `tags` are free text, so alongside `dark wave` they carry
 * `female vocals`, `japanese`, `seen live` and worse. Checking against the
 * controlled vocabulary is what makes tags usable at all — and tags matter,
 * because they are populated far more often than the curated `genres` field.
 */
export function isGenre(label: string): boolean {
  return VOCABULARY.has(canonical(label));
}

/**
 * Apple's genre names, said the way MusicBrainz says them.
 *
 * Both vocabularies end up in the same tag column, and the counts that column
 * feeds group on the exact string — so Apple's `Hip-Hop/Rap` filed next to
 * MusicBrainz's `hip hop` is one genre split into two, silently halving both.
 * Only the labels Apple actually uses are listed; the rest either already agree
 * with the vocabulary or are dropped by the caller.
 *
 * Some of Apple's labels have no counterpart at all — `Anime` and `Soundtrack`
 * describe where music was used rather than what it is, and MusicBrainz has no
 * genre for either. Inventing one would put a word in the statistics that no
 * other source can ever agree with, so they are dropped.
 */
const ITUNES_ALIASES: Record<string, string[]> = {
  'hip-hop/rap': ['hip hop'],
  'hip-hop': ['hip hop'],
  rap: ['hip hop'],
  'r&b/soul': ['r&b', 'soul'],
  'rhythm and blues': ['r&b'],
  // Apple's `Alternative` is the rock genre; its other alternatives are spelled
  // out (`Alternative Rap`, `Alternative Folk`).
  alternative: ['alternative rock'],
  'singer/songwriter': ['singer-songwriter'],
  'christian & gospel': ['gospel'],
  'new age': ['new age'],
  holiday: ['christmas music'],
  electronica: ['electronic'],
  'türkçe pop': ['turkish pop'],
  'türk halk müziği': ['turkish folk'],
  'halk müziği': ['turkish folk'],
  'türk sanat müziği': ['turkish classical'],
  'sanat müziği': ['turkish classical'],
  özgün: ['özgün müzik'],
  darkwave: ['dark wave'],
};

/**
 * The vocabulary genres an Apple label stands for, which is often none.
 *
 * The whole label is looked up before it is taken apart, because splitting
 * first would turn `Singer/Songwriter` into two words that are not genres and
 * `Hip-Hop/Rap` into one genre counted twice.
 */
export function fromItunesGenre(label: string): string[] {
  const whole = canonical(label);
  const direct = ITUNES_ALIASES[whole] ?? (VOCABULARY.has(whole) ? [whole] : null);
  if (direct) return direct;

  const parts = whole
    .split('/')
    .flatMap((part) => ITUNES_ALIASES[part.trim()] ?? [part.trim()])
    .filter((part) => VOCABULARY.has(part));
  return [...new Set(parts)];
}

/**
 * Every genre worth keeping, best first.
 *
 * A track is rarely one thing — the same song is gothic, metal and darkwave —
 * so the whole ranked list is kept rather than only the winner. Sources are
 * merged, since the same label often appears at both artist and release level
 * and the votes should add up rather than compete.
 */
export function rankGenres(...sources: (WeightedGenre[] | undefined)[]): string[] {
  const weights = new Map<string, number>();

  sources.forEach((candidates, sourceIndex) => {
    for (const entry of candidates ?? []) {
      if (!isGenre(entry.name)) continue;
      const name = canonical(entry.name);
      // Earlier sources are more specific to the recording, so their votes
      // count for more than the artist-wide ones that follow.
      const weight = (entry.count || 1) * (sources.length - sourceIndex);
      weights.set(name, (weights.get(name) ?? 0) + weight);
    }
  });

  return [...weights.entries()]
    .sort(([aName, aWeight], [bName, bWeight]) => bWeight - aWeight || bName.length - aName.length)
    .map(([name]) => name);
}
