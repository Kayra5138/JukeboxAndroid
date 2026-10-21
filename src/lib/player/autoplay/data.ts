import { db } from '../../db/index.ts';
import { tagsFor } from '../../db/tags.ts';
import { guestsNamedIn, splitCredit } from '../../metadata/credit.ts';
import { foldForMatch } from '../../metadata/text.ts';
import type { EnrichedTrack } from '../../media/enriched.ts';
import type { Track } from '../../types.ts';
import type { Candidate, Context } from './library.ts';
import { artistNearness, listenedTogether, skipRates, type ListenRow, type WhySong } from './listening.ts';

/**
 * What the similar songs are worked out from, read from the database and the
 * library and kept.
 *
 * Everything here is library-wide and changes slowly — which tags are rare,
 * which songs are played together, which are skipped — so none of it is read
 * when a song changes. Each piece is read the first time it is wanted and kept
 * until it is either about something else (the library was read again, the
 * pool was rebuilt) or old enough that the listening since might have moved
 * it. Only "what was played in the last day" is asked afresh at each top-up,
 * and that is one look along an index.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** How long the history's verdicts are kept before they are worked out again. Half an hour of listening moves none of them much. */
export const KEPT_FOR_MS = 30 * MINUTE;
/** How far back the history is read for songs played together, and how much of it at most. */
const TOGETHER_DAYS = 365;
const TOGETHER_ROWS = 20_000;

/**
 * Names that are on a great many records and say nothing about any of them.
 * Two songs both "by" Various Artists have nothing in common but a
 * compilation's sleeve.
 */
const NOBODY = new Set(['various artists', 'various', 'va', 'unknown artist', 'unknown', '<unknown>', 'artist']);

const fold = (name: string | null | undefined): string => {
  const folded = foldForMatch(name ?? '');
  return NOBODY.has(folded) ? '' : folded;
};

/** Everybody a song credits, folded and once each: its artist's credit, the guests its title names, the record's own artist. */
function namesOf(track: { artist?: string | null; title?: string | null; albumArtist?: string | null }): string[] {
  const names = [...splitCredit(track.artist), ...guestsNamedIn(track.title), ...splitCredit(track.albumArtist)].map(fold);
  return [...new Set(names.filter(Boolean))];
}

export { fold as foldName };

/** A track as the library's scoring measures it. Tags for a file outside the library are read from the database. */
export function candidateOf(track: Track | EnrichedTrack): Candidate {
  const enriched = track as Partial<EnrichedTrack>;
  return {
    id: track.id,
    lead: fold(splitCredit(track.artist)[0]),
    names: namesOf(track),
    albumArtist: fold(track.albumArtist),
    tags: (enriched.tags ?? safely(() => tagsFor(track.id).map((tag) => tag.tag), [])).map((tag) => tag.toLowerCase()),
    genre: enriched.genre ? fold(enriched.genre) : null,
    year: enriched.year ?? null,
  };
}

function safely<T>(read: () => T, otherwise: T): T {
  try {
    return read();
  } catch (error) {
    console.warn(error);
    return otherwise;
  }
}

/** The library as candidates, and how rare each tag is in it: made once for each reading of the library. */
type LibraryIndex = { of: readonly EnrichedTrack[]; candidates: Candidate[]; byId: Map<string, Candidate>; idf: Map<string, number> };
let index: LibraryIndex | null = null;

export function libraryIndex(tracks: readonly EnrichedTrack[]): LibraryIndex {
  if (index?.of === tracks) return index;
  const candidates = tracks.map(candidateOf);
  const holding = new Map<string, number>();
  for (const candidate of candidates) for (const tag of new Set(candidate.tags)) holding.set(tag, (holding.get(tag) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [tag, count] of holding) {
    // Nought or less for a tag on nearly everything, which then says nothing rather than a little about everything alike.
    const rarity = Math.log(candidates.length / (1 + count));
    if (rarity > 0) idf.set(tag, rarity);
  }
  index = { of: tracks, candidates, byId: new Map(candidates.map((candidate) => [candidate.id, candidate])), idf };
  return index;
}

let history: { at: number; together: Map<string, Map<string, number>>; skipRate: Map<string, number> } | null = null;

/** Which songs are played together and which are walked out on, as of the last half hour. */
function historyNow(now: number): NonNullable<typeof history> {
  if (history && now - history.at < KEPT_FOR_MS && now >= history.at) return history;
  const rows = safely(
    () =>
      db().getAllSync<ListenRow>(
        `SELECT track_id, started_at, seconds_played FROM plays WHERE started_at >= ? ORDER BY started_at DESC LIMIT ?`,
        now - TOGETHER_DAYS * DAY,
        TOGETHER_ROWS
      ),
    [] as ListenRow[]
  );
  const completed = new Map(
    safely(
      () => db().getAllSync<{ track_id: string; n: number }>('SELECT track_id, COUNT(*) AS n FROM plays WHERE completed = 1 GROUP BY track_id'),
      [] as { track_id: string; n: number }[]
    ).map((row) => [row.track_id, row.n])
  );
  const skipped = new Map(
    safely(
      () => db().getAllSync<{ track_id: string; n: number }>('SELECT track_id, COUNT(*) AS n FROM skips GROUP BY track_id'),
      [] as { track_id: string; n: number }[]
    ).map((row) => [row.track_id, row.n])
  );
  history = { at: now, together: listenedTogether(rows), skipRate: skipRates(completed, skipped) };
  return history;
}

let nearness: { of: readonly WhySong[]; near: Map<string, Map<string, number>> } | null = null;

/** How near Discover found artists to be, read from its pool: kept until the pool is another. */
function nearnessOf(pool: readonly WhySong[]): Map<string, Map<string, number>> {
  if (nearness?.of === pool) return nearness.near;
  nearness = { of: pool, near: artistNearness(pool, fold) };
  return nearness.near;
}

/** Everything the library's scoring is handed besides the candidates and the seeds. */
export function contextNow(idf: ReadonlyMap<string, number>, pool: readonly WhySong[], now: number): Context {
  const { together, skipRate } = historyNow(now);
  return { idf, together: (id) => together.get(id), near: nearnessOf(pool), skipRate };
}

/** The files played in the last day, which are not offered again so soon. */
export function playedSince(since: number): Set<string> {
  return new Set(
    safely(
      () => db().getAllSync<{ track_id: string }>('SELECT DISTINCT track_id FROM plays WHERE started_at >= ?', since),
      [] as { track_id: string }[]
    ).map((row) => row.track_id)
  );
}
