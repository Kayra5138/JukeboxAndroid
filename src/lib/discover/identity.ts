import { looseTitle } from '../album/rest.ts';
import { splitCredit } from '../metadata/credit.ts';
import { escapeLucene } from '../metadata/musicbrainz.ts';
import { foldForMatch } from '../metadata/text.ts';
import type { DeezerArtist, DeezerTrack } from './deezer.ts';
import { plainTitle } from './variants.ts';

/**
 * Which artist a name in somebody's library is.
 *
 * A name is not an artist. Somebody listens to Second, a band from Turkey,
 * and MusicBrainz has seven artists called Second and Deezer three. Asked for
 * the name alone, each catalogue answered with its best known — a band from
 * Spain — and the list filled with that band's songs as "More from Second"
 * and with that band's neighbours as "Like Second": one wrong answer, and
 * every place the artist had on the list was a stranger's.
 *
 * Nothing in a catalogue's answer says which of them is meant. The only
 * evidence there is of that is on the phone: the songs somebody has under the
 * name. So a name is settled by its songs — the artist of that name who made
 * a song of that title — and where the songs settle nothing, by the name only
 * if exactly one artist has it. Two of one name and nothing to tell them
 * apart is nobody, and the artist is then left out of the build: no songs of
 * a stranger's, no neighbours of a stranger's, and the places go to the
 * artists that could be told.
 *
 * Arithmetic and reading: the questions are put by whoever calls, apart from
 * {@link identify}, which is handed the two questions it needs.
 */

/** Titles that are on a thousand records and say nothing about whose this one is. */
const ANYBODYS = new Set([
  'intro', 'outro', 'interlude', 'skit', 'prelude', 'untitled', 'track', 'bonus', 'bonus track', 'hidden track', 'live',
  'demo', 'remix', 'instrumental', 'home', 'love', 'stay', 'time', 'alone', 'hello', 'angel', 'baby', 'fire', 'rain',
]);

/**
 * A title as it is compared, or null where it is no evidence of anything.
 *
 * Compared the way the library's own tracks are matched against a record —
 * `Song (Remastered 2011)` and `Song` are one title — and counted as evidence
 * only where sharing it is unlikely to be chance: `Hey` is a song by both
 * bands called Second and by a hundred others. Four letters at the least for
 * a title in an alphabet; two characters where a character is a word.
 */
export function telling(title: string, artist: string | null = null): string | null {
  const loose = looseTitle(plainTitle(title, artist));
  if (!loose || ANYBODYS.has(loose)) return null;
  const letters = [...loose.replace(/ /g, '')];
  const spelled = letters.every((letter) => /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]/u.test(letter));
  return letters.length >= (spelled ? 4 : 2) ? loose : null;
}

/** How many of somebody's titles go into one question. Three or four settle it; more is a longer address. */
export const TITLES_ASKED = 4;

/** Somebody's titles by a name, as evidence: only the telling ones, each once, in the order given. */
export function evidence(titles: readonly string[], artist: string, most = TITLES_ASKED): { title: string; loose: string }[] {
  const seen = new Set<string>();
  const kept: { title: string; loose: string }[] = [];
  for (const title of titles) {
    const loose = telling(title, artist);
    if (!loose || seen.has(loose)) continue;
    seen.add(loose);
    kept.push({ title: plainTitle(title, artist), loose });
    if (kept.length >= most) break;
  }
  return kept;
}

/**
 * The titles somebody has under each artist's name, the most played first.
 *
 * A song the artist is first in the credit of comes before one they are a
 * guest on: a guest spot is on the other artist's record, and is the weaker
 * evidence of who the guest is. Songs kept from Discover count as well — an
 * artist somebody was started from because they kept a song has, at first,
 * that one song to be known by.
 */
export function titlesByArtist(
  tracks: readonly { id: string; title: string; artist?: string | null }[],
  played: ReadonlyMap<string, number>,
  kept: readonly { title: string; artist: string }[] = []
): Map<string, string[]> {
  type Row = { title: string; lead: boolean; amount: number; at: number };
  const rows = new Map<string, Row[]>();
  const add = (title: string, credit: string | null | undefined, amount: number, at: number) => {
    splitCredit(credit).forEach((name, index) => {
      const key = foldForMatch(name);
      if (!key || !title) return;
      const list = rows.get(key) ?? [];
      list.push({ title, lead: index === 0, amount, at });
      rows.set(key, list);
    });
  };
  tracks.forEach((track, at) => add(track.title, track.artist, played.get(track.id) ?? 0, at));
  kept.forEach((song, at) => add(song.title, song.artist, 0, tracks.length + at));

  return new Map(
    [...rows].map(([key, list]) => [
      key,
      list
        .sort((left, right) => Number(right.lead) - Number(left.lead) || right.amount - left.amount || left.at - right.at)
        .map((row) => row.title),
    ])
  );
}

/* ------------------------------------------------------------------------ */
/* MusicBrainz.                                                             */
/* ------------------------------------------------------------------------ */

/** The one question that names an artist and their songs together. Null where there is nothing to ask with. */
export function recordingsPath(name: string, proof: readonly { title: string }[]): string | null {
  const artist = escapeLucene(name);
  const titles = proof.map((entry) => escapeLucene(entry.title)).filter(Boolean);
  if (!artist || !titles.length) return null;
  const query = `recording:(${titles.map((title) => `"${title}"`).join(' OR ')}) AND artist:"${artist}"`;
  return `/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=25`;
}

/**
 * Every artist of a name, asked for by the name.
 *
 * Fifty, because the search puts longer names that contain the word above
 * some of the artists that are called exactly it: for `Second`, the seven of
 * that name stood between the third place and the twenty-third.
 */
export function namesakesPath(name: string): string | null {
  const artist = escapeLucene(name);
  return artist ? `/artist/?query=${encodeURIComponent(`artist:"${artist}"`)}&fmt=json&limit=50` : null;
}

type Credit = { name?: string; artist?: { id?: string; name?: string } };
type RecordingRow = { title?: string; 'artist-credit'?: Credit[] };

/**
 * The artist of that name who made those songs, by a recording search's answer.
 *
 * An artist counts for each of somebody's titles they are credited on, under
 * the name asked about. Whoever counts for most is the artist; and two that
 * count the same — two bands of one name with a song of one title each — is
 * no answer, and is said as none.
 */
export function artistByRecordings(body: unknown, name: string, proof: readonly { loose: string }[]): string | null {
  const wanted = foldForMatch(name);
  const titles = new Set(proof.map((entry) => entry.loose));
  const made = new Map<string, Set<string>>();
  const rows = (body as { recordings?: unknown } | null)?.recordings;
  for (const row of (Array.isArray(rows) ? rows : []) as RecordingRow[]) {
    const loose = row?.title ? looseTitle(plainTitle(row.title, name)) : '';
    if (!titles.has(loose)) continue;
    for (const credit of row['artist-credit'] ?? []) {
      const id = credit.artist?.id;
      if (!id) continue;
      if (foldForMatch(credit.name ?? '') !== wanted && foldForMatch(credit.artist?.name ?? '') !== wanted) continue;
      made.set(id, (made.get(id) ?? new Set()).add(loose));
    }
  }
  const order = [...made].sort((left, right) => right[1].size - left[1].size);
  if (!order.length || (order.length > 1 && order[0]![1].size === order[1]![1].size)) return null;
  return order[0]![0];
}

/** The one artist of exactly that name in an artist search's answer, or null where there is none or more than one. */
export function loneNamesake(body: unknown, name: string): string | null {
  const wanted = foldForMatch(name);
  const rows = (body as { artists?: unknown } | null)?.artists;
  const same = ((Array.isArray(rows) ? rows : []) as { id?: string; name?: string }[]).filter(
    (row) => !!row?.id && !!wanted && foldForMatch(row.name ?? '') === wanted
  );
  return same.length === 1 ? same[0]!.id! : null;
}

/** What was settled about a name, and by what. */
export type Identity = { id: string | null; by: 'songs' | 'name' | null };

/** Somewhere a settled name is kept. `undefined` is "never asked"; null is "asked, and nobody". */
export type IdentityStore = {
  get(how: 'songs' | 'name', name: string): string | null | undefined;
  put(how: 'songs' | 'name', name: string, id: string | null): void;
};

/**
 * What a settled name is filed under.
 *
 * Every id remembered before this was the first hit of a search for the name
 * and nothing more, and some of them are wrong. They are not deleted and not
 * read: they sit under the bare name, and nothing is filed under a bare name
 * any more. What is filed now says how it was settled — by somebody's songs,
 * or by being the only artist of the name — so that a name settled the
 * weaker way is still asked about by its songs when there are songs to ask
 * with.
 */
export function identityKey(how: 'songs' | 'name', name: string): string {
  return `\u001f2\u001f${how}\u001f${name}`;
}

/**
 * Settles a name, asking at most two things.
 *
 *  1. Settled by songs before: that, with nothing asked.
 *  2. Songs to ask with, and not asked with these songs since the app was
 *     opened: the recording search. An artist found is kept as settled by
 *     songs.
 *  3. Settled by the name alone before: that.
 *  4. Otherwise the artists of the name are asked for, and a lone one is the
 *     artist. More than one, or none, is nobody.
 *
 * "Nobody" is remembered for as long as [session] lasts — the app's run — and
 * no longer: the catalogue gains recordings and artists, and a band that was
 * not in it last month must not be shut out for good. So an artist whose
 * songs MusicBrainz does not have costs one request a run of the app, and
 * one that cannot be told from its namesakes costs two.
 */
export async function identify(
  name: string,
  titles: readonly string[],
  ask: (path: string) => Promise<unknown>,
  store: IdentityStore,
  session: Map<string, string | null>
): Promise<Identity> {
  const settled = store.get('songs', name);
  if (settled) return { id: settled, by: 'songs' };

  const proof = evidence(titles, name);
  const path = recordingsPath(name, proof);
  const asked = `songs\u001f${foldForMatch(name)}\u001f${proof.map((entry) => entry.loose).sort().join('\u001f')}`;
  if (path && !session.has(asked)) {
    const id = artistByRecordings(await ask(path), name, proof);
    session.set(asked, id);
    if (id) {
      store.put('songs', name, id);
      return { id, by: 'songs' };
    }
  }

  const named = store.get('name', name);
  if (named) return { id: named, by: 'name' };
  const bare = `name\u001f${foldForMatch(name)}`;
  if (session.has(bare)) return { id: session.get(bare)!, by: session.get(bare) ? 'name' : null };

  const namesakes = namesakesPath(name);
  const id = namesakes ? loneNamesake(await ask(namesakes), name) : null;
  session.set(bare, id);
  store.put('name', name, id);
  return { id, by: id ? 'name' : null };
}

/* ------------------------------------------------------------------------ */
/* Deezer.                                                                  */
/* ------------------------------------------------------------------------ */

/** The artists of exactly that name among a search's answer, the most followed first. */
export function namesakes(found: readonly DeezerArtist[], name: string): DeezerArtist[] {
  const wanted = foldForMatch(name);
  return found
    .filter((artist) => !!wanted && foldForMatch(artist.name) === wanted)
    .sort((left, right) => (right.fans ?? 0) - (left.fans ?? 0) || left.id - right.id);
}

/** How many artists of one name have their songs looked at. Past three, it is a word and not a name. */
export const NAMESAKES_LOOKED_AT = 3;

/**
 * Of several artists of one name, the one whose most played include
 * somebody's songs.
 *
 * Counted the same way as on MusicBrainz: a title each, the most wins, and a
 * tie is nobody. A track filed under somebody else — a guest spot — is not
 * the artist's own and is not counted.
 */
export function artistBySongs(
  candidates: readonly { artist: DeezerArtist; tracks: readonly DeezerTrack[] }[],
  proof: readonly { loose: string }[]
): DeezerArtist | null {
  const titles = new Set(proof.map((entry) => entry.loose));
  const counted = candidates
    .map(({ artist, tracks }) => ({
      artist,
      made: new Set(
        tracks
          .filter((track) => track.artistId === artist.id)
          .map((track) => looseTitle(plainTitle(track.short || track.title, artist.name)))
          .filter((loose) => titles.has(loose))
      ).size,
    }))
    .filter((entry) => entry.made > 0)
    .sort((left, right) => right.made - left.made);
  if (!counted.length || (counted.length > 1 && counted[0]!.made === counted[1]!.made)) return null;
  return counted[0]!.artist;
}
