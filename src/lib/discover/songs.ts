import { foldForMatch } from '../metadata/text.ts';
import type { DeezerTrack } from './deezer.ts';
import type { Recording } from './listenbrainz.ts';
import type { Popularity } from './policy.ts';
import {
  anotherTake,
  doubtfulRecord,
  isSongLength,
  isTalk,
  looseSongKey,
  plainTitle,
  recordOfTakes,
} from './variants.ts';

/**
 * Which of an artist's songs to offer.
 *
 * Two different questions, and they were being answered as one. Somebody who
 * has never heard an artist should meet them by a song people know them for:
 * it is the best case the artist can make. Somebody who already plays an
 * artist has those songs, and wants the next ones down. Both used to get the
 * same even draw from the upper half of everything ever played under the
 * artist's name, which is how a new artist came to be introduced by a concert
 * bootleg.
 *
 * So an artist's songs are first put in order of how much they are played and
 * cleared of everything that is not the song as it was made, and then a
 * stretch of that order is taken: the top of it for a new artist, further
 * down for one already played.
 *
 * Arithmetic only: the lists are handed in.
 */

/** One song that could be offered, and how much it is wanted beside the artist's others. */
export type Offer = {
  /** What it is known by from here on: see {@link shopSongId} for one from Deezer, a recording id from ListenBrainz. */
  id: string;
  title: string;
  /** The credit as written. */
  credit: string;
  release: string | null;
  cover: string | null;
  durationSec: number | null;
  tags: string[];
  /** Where it stands among the artist's usable songs, the most played being nought. */
  place: number;
  /** From nought to one: one for the song this stretch wants most. */
  weight: number;
  listens: number | null;
};

/**
 * The stretch of an artist's order a new artist is introduced from, by what
 * somebody chose: the first two, the first four, or the fourth to the twelfth.
 */
export const FIRST_SONGS: Record<Popularity, readonly [from: number, to: number]> = {
  known: [0, 2],
  any: [0, 4],
  deep: [3, 12],
};

/**
 * As many followers on Deezer as make an artist's best-known song one
 * everybody has heard already.
 *
 * `Take Me to Church` is no discovery. For an artist this size the stretch
 * starts one down — the second to the fifth — unless well-known songs are
 * what was asked for.
 */
export const MEGASTAR_FANS = 1_000_000;

/** How many of a new artist's songs go into the pool: the list takes one, the rest are there for the next list. */
export const FIRST_KEPT = 3;
/** How many of a played artist's. */
export const MORE_KEPT = 8;

/** Brackets a shop puts on a track that make it another take, beyond what a title says of itself. */
const SHOP_TAKE =
  /\b(live|demo|remix|remixed|acoustic|instrumental|edit|session|sessions|karaoke|cover|mix|a cappella|acapella|sped up|slowed|reprise|interlude|intro|outro|commentary|rehearsal|stripped|piano|orchestral|unplugged)\b/i;

/**
 * Why a track of a shop's list is not the song as it was made, or null.
 *
 * The shop's own bracket is read first, since it is the one place the shop
 * says what the track is; then the title, by the app's own rules; then the
 * record it is on and how long it is.
 */
export function shopTake(track: DeezerTrack): string | null {
  const said = SHOP_TAKE.exec(track.version);
  if (said) return said[1]!.toLowerCase();
  const take = anotherTake(track.title) ?? anotherTake(`${track.short} ${track.version}`.trim());
  if (take) return take;
  if (recordOfTakes(track.album)) return 'takes';
  if (!isSongLength(track.durationSec)) return 'length';
  return null;
}

/**
 * A shop's list for one artist, as songs: theirs, the song itself, not owned,
 * each once, in the order they are played.
 *
 * `theirs` is the track being filed under the artist. A guest spot is filed
 * under whoever's song it is, and is no way to meet the guest.
 */
export function shopSongs(
  tracks: DeezerTrack[],
  artist: { id: number; name: string },
  owned: ReadonlySet<string>
): DeezerTrack[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (track.artistId !== artist.id) return false;
    if (shopTake(track)) return false;
    const key = looseSongKey({ title: plainTitle(track.short, artist.name), artist: artist.name });
    if (owned.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * What a song from Deezer is known by.
 *
 * Everything downstream keys a song on one string: the list's rows, what was
 * turned away, and the download queue on the phone — and the queue will only
 * take a key shaped like a MusicBrainz id, thirty-six characters of hex and
 * dashes (`DownloadQueue.kt`, `checked`). So Deezer's number for the track is
 * written in that shape, under a first group no real id will ever have:
 * `dee2e500-0000-4000-8000-` and the number in hex. The same track is the
 * same key on every build. It names the song and nothing more: nothing may
 * look it up on MusicBrainz or the Cover Art Archive, which is why the sleeve
 * and the length travel with the song in fields of their own.
 */
export const SHOP_ID = 'dee2e500-0000-4000-8000-';

export function shopSongId(track: number): string {
  return `${SHOP_ID}${Math.max(0, Math.trunc(track)).toString(16).padStart(12, '0')}`;
}

/** Whether a song's id is one of those, and so not a recording MusicBrainz knows. */
export function isShopSong(id: string): boolean {
  return id.startsWith(SHOP_ID);
}

function offered(track: DeezerTrack, artist: { name: string }, place: number, weight: number): Offer {
  return {
    id: shopSongId(track.id),
    title: plainTitle(track.short, artist.name),
    credit: artist.name,
    release: track.album,
    cover: track.cover,
    durationSec: track.durationSec,
    tags: [],
    place,
    weight,
    listens: null,
  };
}

/** The stretch for a new artist, as places in the order: `[from, to)`. */
export function firstStretch(popularity: Popularity, megastar: boolean): [number, number] {
  const [from, to] = FIRST_SONGS[popularity];
  return megastar && popularity === 'any' ? [from + 1, to + 1] : [from, to];
}

/**
 * How much each place of a stretch is wanted: the first in full, then
 * two thirds, then less. Weighted to the top and not only the top.
 */
const downTheStretch = (index: number) => 1.5 / (index + 1.5);

/**
 * The songs a new artist is introduced by.
 *
 * Where the artist has too few songs to reach the stretch — three songs, and
 * the fourth to the twelfth asked for — the best they have is used instead:
 * a short catalogue is no reason to leave somebody out.
 */
export function firstSongs<T>(songs: T[], popularity: Popularity, megastar: boolean): { song: T; place: number; weight: number }[] {
  const [from, to] = firstStretch(popularity, megastar);
  const stretch = songs.slice(from, to).map((song, index) => ({ song, place: from + index }));
  const chosen = stretch.length ? stretch : songs.slice(0, FIRST_KEPT).map((song, index) => ({ song, place: index }));
  return chosen.slice(0, Math.max(FIRST_KEPT, to - from)).map((entry, index) => ({ ...entry, weight: downTheStretch(index) }));
}

/**
 * The songs to offer of an artist already played: what the library has is
 * gone already, and of the rest the better known count for more — gently, by
 * the root of the place, so that the thirtieth is still a third as likely as
 * the first. With lesser-known songs asked for, every place counts the same.
 */
export function moreSongs<T>(songs: T[], popularity: Popularity): { song: T; place: number; weight: number }[] {
  return songs.map((song, place) => ({
    song,
    place,
    weight: popularity === 'deep' ? 1 : popularity === 'known' ? 2 / (place + 2) : Math.SQRT2 / Math.sqrt(place + 2),
  }));
}

export function shopOffers(
  tracks: DeezerTrack[],
  artist: { id: number; name: string; fans: number | null },
  owned: ReadonlySet<string>,
  familiar: boolean,
  popularity: Popularity
): Offer[] {
  const songs = shopSongs(tracks, artist, owned);
  const megastar = (artist.fans ?? 0) >= MEGASTAR_FANS;
  const chosen = familiar ? moreSongs(songs, popularity) : firstSongs(songs, popularity, megastar);
  return chosen.map(({ song, place, weight }) => offered(song, artist, place, weight));
}

/* ------------------------------------------------------------------------ */
/* The same from ListenBrainz, for an artist the shop has nothing for.      */
/* ------------------------------------------------------------------------ */

/** What MusicBrainz says a recording was issued as. */
export type Issued = {
  /** On a record that was officially released as an album, a single or an EP and is nothing else besides. */
  studio: boolean;
};

type Release = { status?: string; 'release-group'?: { 'primary-type'?: string | null; 'secondary-types'?: string[] } };

const ISSUED_AS = new Set(['Album', 'Single', 'EP']);
/** A soundtrack is a record like another: for somebody who writes for games it is every record they have. */
const HARMLESS = new Set(['Soundtrack']);

/**
 * A MusicBrainz search for recordings by id, read for what each was issued on.
 *
 * `Bootleg`, `Promotion` and `Pseudo-Release` are the fan compilations and the
 * concert tapes; `Live`, `Compilation`, `Remix`, `Demo`, `DJ-mix`, `Interview`
 * and the rest are what they say. A recording that is on one honest record is
 * a song, whatever else it has also been put on.
 */
export function readIssued(body: unknown): Map<string, Issued> {
  const issued = new Map<string, Issued>();
  const rows = (body as { recordings?: unknown } | null)?.recordings;
  for (const row of (Array.isArray(rows) ? rows : []) as { id?: string; releases?: Release[] }[]) {
    if (!row?.id) continue;
    const studio = (row.releases ?? []).some((release) => {
      const group = release['release-group'];
      return (
        release.status === 'Official' &&
        ISSUED_AS.has(group?.['primary-type'] ?? '') &&
        (group?.['secondary-types'] ?? []).every((type) => HARMLESS.has(type))
      );
    });
    issued.set(row.id, { studio });
  }
  return issued;
}

/** A recording played less than this share of the artist's most played is not offered to somebody new to them. */
export const NEW_LISTEN_SHARE = 0.05;
/** The same for an artist already played, where further down is the point. */
export const OWN_LISTEN_SHARE = 0.01;
/** And never fewer than this, whoever the artist. */
export const FEWEST_LISTENS = 20;

/**
 * Why a ListenBrainz recording is not the song as it was made, or null.
 *
 * Everything the shop's list did not need: whether it is the artist's own
 * (the Frozen dubs are credited to the singer of each language first), what
 * its record is called, whether it is somebody talking, and what MusicBrainz
 * says it was issued on, where that could be asked.
 */
export function recordingTake(
  recording: Recording,
  artistMbid: string,
  issued: Issued | undefined
): string | null {
  const lead = recording.artists?.[0]?.mbid;
  if (lead && lead !== artistMbid) return 'guest';
  const take = anotherTake(recording.title);
  if (take) return take;
  const record = doubtfulRecord(recording.release);
  if (record) return record;
  if (isTalk(recording.tags)) return 'talk';
  if (!isSongLength(recording.durationSec)) return 'length';
  if (issued && !issued.studio) return 'issue';
  return null;
}

export function listenedOffers(
  rows: { mbid: string; listens: number }[],
  details: Map<string, Recording>,
  issued: Map<string, Issued>,
  artist: { mbid: string; name: string },
  owned: ReadonlySet<string>,
  familiar: boolean,
  popularity: Popularity,
  cover: (recording: Recording) => string | null
): Offer[] {
  const most = Math.max(0, ...rows.map((row) => row.listens));
  const floor = Math.max(FEWEST_LISTENS, most * (familiar ? OWN_LISTEN_SHARE : NEW_LISTEN_SHARE));
  const seen = new Set<string>();
  const songs = [...rows]
    .sort((left, right) => right.listens - left.listens || (left.mbid < right.mbid ? -1 : 1))
    .flatMap((row) => {
      const recording = details.get(row.mbid);
      if (!recording || row.listens < floor) return [];
      if (recordingTake(recording, artist.mbid, issued.get(row.mbid))) return [];
      const title = plainTitle(recording.title, recording.artist);
      const key = looseSongKey({ title, artist: artist.name });
      if (owned.has(key) || owned.has(looseSongKey({ title, artist: recording.artist })) || seen.has(key)) return [];
      seen.add(key);
      return [{ row, recording, title }];
    });
  const chosen = familiar ? moreSongs(songs, popularity) : firstSongs(songs, popularity, false);
  return chosen.map(({ song, place, weight }) => ({
    id: song.recording.mbid,
    title: song.title,
    credit: song.recording.artist || artist.name,
    release: song.recording.release,
    cover: cover(song.recording),
    durationSec: song.recording.durationSec,
    tags: song.recording.tags,
    place,
    weight,
    listens: song.row.listens,
  }));
}

/** One name for an artist however two catalogues write it: `Florence + the Machine`, `blink‐182`. */
export function artistName(name: string): string {
  return foldForMatch(name);
}
