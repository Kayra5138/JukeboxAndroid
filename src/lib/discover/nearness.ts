import type { DeezerArtist } from './deezer.ts';
import type { Popularity } from './policy.ts';
import type { Candidate } from './rank.ts';

/**
 * How near one artist is to another, from two witnesses that do not know of
 * each other.
 *
 * The first is ListenBrainz: how often two artists turned up in one sitting.
 * It is what people did, and it has a fault that was the whole of what was
 * wrong with Discover's lists. Everybody shares sittings with the artists
 * everybody plays, so the raw count puts Coldplay beside anything. Divided by
 * how many people play the neighbour at all, it is how much likelier somebody
 * is to play the neighbour for playing this artist — which is what "similar"
 * was meant to mean.
 *
 * The second is Deezer's own list of related artists: a shop's opinion, in
 * order. It knows small and recent artists ListenBrainz has too few listens
 * for, and it knows nothing at all about some artists ListenBrainz covers
 * well. Either is believed alone; both together are believed more.
 *
 * Arithmetic only. Nothing here asks anybody anything.
 */

/**
 * How hard being well known is counted against a neighbour.
 *
 * The exponent on the neighbour's listeners. At nought it is the raw count
 * and the megastars; at one it is pure lift and the nearest are artists a few
 * hundred people play. The setting somebody chose for songs is taken to mean
 * the same of artists: `known` leans to names they will have heard of, `deep`
 * away from them.
 */
export const ALPHA: Record<Popularity, number> = { known: 0.35, any: 0.6, deep: 0.85 };

/** A neighbour that shared less than this share of the nearest's sittings is a coincidence. */
export const SCORE_FLOOR = 0.12;
/** Fewer listeners than this and the division is noise: three people with one odd habit. */
export const USERS_FLOOR = 300;
/** How many of an artist's neighbours are kept from each witness. */
export const NEIGHBOURS_KEPT = 30;
/** How far one witness alone is believed, out of one. */
export const WITNESS = 0.8;

export type ListenedNear = { mbid: string; name: string; near: number };

/**
 * ListenBrainz's neighbours of one artist, nearest first, each from nought to
 * one: one is the nearest of all once fame has been taken out.
 *
 * With no listener counts at all — that request failed — the raw score is
 * what there is, and is used; a worse order is better than none. With counts
 * for some, a neighbour without one is left out: it is either too little
 * played to say anything about or not a performer at all (the index holds
 * songwriters and producers too, and they have no listeners of their own).
 */
export function listenedNear(rows: Candidate[], users: Map<string, number>, popularity: Popularity): ListenedNear[] {
  const strongest = Math.max(0, ...rows.map((row) => row.score));
  if (strongest <= 0) return [];
  const blind = users.size === 0;

  const lifted = rows
    .filter((row) => row.score >= SCORE_FLOOR * strongest)
    .map((row) => ({ row, heard: users.get(row.mbid) ?? 0 }))
    .filter(({ heard }) => blind || heard >= USERS_FLOOR)
    .map(({ row, heard }) => ({
      mbid: row.mbid,
      name: row.name,
      lift: blind ? row.score : row.score / Math.pow(heard, ALPHA[popularity]),
    }))
    .sort((left, right) => right.lift - left.lift || (left.mbid < right.mbid ? -1 : 1))
    .slice(0, NEIGHBOURS_KEPT);

  const top = lifted[0]?.lift ?? 0;
  return top > 0 ? lifted.map(({ mbid, name, lift }) => ({ mbid, name, near: lift / top })) : [];
}

export type FiledNear = { artist: DeezerArtist; near: number };

/** Deezer's related artists as nearness: one for the first, falling by a twentieth a place. */
export function filedNear(rows: DeezerArtist[]): FiledNear[] {
  return rows.slice(0, 20).map((artist, index) => ({ artist, near: 1 - index / 20 }));
}

/**
 * What the two say together.
 *
 * Each is a chance of being right, worth eight tenths at its surest, and the
 * two are taken as independent: an artist only one of them names can reach
 * 0.8, one both name first reaches 0.96, and a weak mention by the second
 * still lifts a strong one by the first.
 */
export function together(listened: number, filed: number): number {
  return 1 - (1 - WITNESS * listened) * (1 - WITNESS * filed);
}

/**
 * [places] shared out by weight, in whole places, by largest remainder.
 *
 * Each weight's exact share is rounded down and the places left over go to
 * whoever lost most by the rounding — ties to the earlier, which is the
 * heavier, since the weights arrive heaviest first. Somebody with no weight
 * gets nothing.
 */
export function sharePlaces(weights: readonly number[], places: number): number[] {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!(total > 0) || places <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (places * Math.max(0, weight)) / total);
  const given = exact.map(Math.floor);
  let left = places - given.reduce((sum, count) => sum + count, 0);
  const order = exact
    .map((share, index) => ({ index, lost: share - given[index]! }))
    .sort((a, b) => b.lost - a.lost || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    if (exact[index]! <= 0) continue;
    given[index]! += 1;
    left--;
  }
  return given;
}
