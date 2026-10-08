import { matchTracks, type OwnedTrack, type RestTrack } from './rest.ts';
import { sameRecordName, withoutEdition } from '../metadata/covers.ts';
import { isAbortError } from '../metadata/http.ts';
import { bareTitle, foldForMatch, withoutUploadNotes } from '../metadata/text.ts';
import { failureCode } from '../youtube/errors.ts';
import type { YouTubeResult, YouTubeVideo } from '../youtube/types.ts';

/**
 * A record as YouTube has it: the second place its track list is read from.
 *
 * MusicBrainz does not have everything. YouTube has nearly every record
 * there is as a playlist — one it made itself from what the label delivered,
 * or one somebody put together — and a playlist of a record is its track
 * list, with the videos to download already in hand.
 *
 * What it does not have is anybody saying which playlist is the record. A
 * search for an album's name answers with the album, the deluxe edition, a
 * tribute to it and forty songs somebody likes that begin with it. So the
 * choice is made by evidence and not by rank: the name, whose it is, and
 * above all whether the tracks the library already has are on it. Where
 * nothing vouches for a playlist the answer is that the record was not
 * found, which is the better mistake than nine wrong songs filed under it.
 *
 * Nothing here reaches YouTube for itself. What it asks goes through the two
 * functions it is handed, which in the app are the phone's and in a test are
 * lists of answers.
 */

/** One question to YouTube: a search for playlists by words, or the reading of one by its address. */
export type Look = (query: string, signal?: AbortSignal) => Promise<YouTubeResult[]>;

export type YouTubeTrack = RestTrack & {
  /** The video that is this track, to be downloaded as it stands. */
  video: YouTubeVideo;
};

export type YouTubeAlbum = {
  playlist: { id: string; url: string; title: string; channel: string };
  /**
   * What vouches for the playlist being the record:
   *
   *  - `tracks`: the library's own tracks are on it;
   *  - `album`: nothing but its being the one album YouTube itself lists
   *    under this name and artist — for a record the library has too little
   *    of to check against.
   */
  by: 'tracks' | 'album';
  tracks: YouTubeTrack[];
  /** How many of the library's tracks were found on it. */
  covered: number;
};

/**
 * Why there is no answer:
 *
 *  - `unnamed`: the record has no name, or nobody's name, to search with;
 *  - `notFound`: YouTube was asked and no playlist could be told to be it;
 *  - `unavailable`: this build of the app cannot ask YouTube at all;
 *  - `failed`: YouTube could not be asked, with what it said instead.
 */
export type YouTubeOutcome =
  | { ok: true; album: YouTubeAlbum }
  | { ok: false; why: 'unnamed' | 'notFound' | 'unavailable' }
  | { ok: false; why: 'failed'; error: unknown };

/** Where the looking has got to, for a screen that is being waited at. */
export type Stage = 'searching' | 'reading';

/**
 * How many playlists are read before giving up. Each is a request that the
 * phone allows two minutes for, made while somebody watches.
 */
const MOST_READ = 3;

/**
 * Past this a playlist is not a record, whatever it is called. A box of
 * every disc and every demo runs to a hundred and some; "every song by" runs
 * to five hundred.
 */
const LONGEST = 150;

/** The longest video the phone will download at all: `YouTubeEngine.fetch`. */
const LONGEST_VIDEO = 7200;

/** The playlists YouTube makes itself, one per release a label delivered. */
const isOwnAlbum = (id: string) => id.startsWith('OLAK5uy_');
/** A mix or a radio: made up for whoever is looking, and a different list each time. */
const isMix = (id: string) => id.startsWith('RD');

/** Words in a playlist's name that make it something other than the record. */
const NOT_THE_RECORD = new Set([
  'live', 'cover', 'covers', 'tribute', 'karaoke', 'instrumental', 'instrumentals',
  'remix', 'remixes', 'remixed', 'nightcore', 'sped', 'reaction',
]);

const dashed = (text: string) => text.replace(/\s+[–—]\s+/g, ' - ').trim();
/** The uploader, where YouTube made the channel up for an artist's records. */
const withoutTopic = (channel: string) => channel.replace(/\s+-\s+Topic$/i, '').trim();

/** Whether [text] has [name] in it, word for word. */
function names(text: string, name: string): boolean {
  const wanted = foldForMatch(name);
  return wanted !== '' && ` ${foldForMatch(text)} `.includes(` ${wanted} `);
}

/**
 * Who to search under. The record's artist; or, for a record whose tracks do
 * not agree on one — a guest on every other song — whoever most of them are
 * by, which is who YouTube will have it under.
 */
export function searchArtist(album: { artist: string | null; tracks: OwnedTrack[] }): string | null {
  if (album.artist?.trim()) return album.artist.trim();
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const { artist } of album.tracks) {
    const by = artist?.trim();
    if (!by) continue;
    const count = (counts.get(by) ?? 0) + 1;
    counts.set(by, count);
    // More than, so between equals the one met first stays.
    if (best == null || count > (counts.get(best) ?? 0)) best = by;
  }
  return best;
}

/**
 * A video's title as the song is called.
 *
 * An uploader's title is the song's name with things around it: whose it is
 * in front, what kind of upload it is behind, and in a playlist somebody
 * numbered, its number. YouTube's own album uploads have none of it, and
 * this leaves those as they are.
 *
 * The number is only taken for one where it is the track's place in the
 * list. `7 - Seven Years` at the seventh place is numbered; `1979` anywhere,
 * and `7 Rings` at the third, are songs.
 */
export function songTitle(
  video: { title: string; channel: string },
  artist: string | null,
  position?: number
): string {
  let title = dashed(video.title);
  const numbered = /^0*(\d{1,3})(?:\s*[.)]|\s+-)\s+(\S.*)$/.exec(title);
  if (numbered && position != null && Number(numbered[1]) === position) title = numbered[2]!;
  // `Artist - Title`, by the record's spelling of the artist or the channel's.
  for (const by of [artist, withoutTopic(video.channel)]) title = bareTitle(title, by || null);
  return withoutUploadNotes(title);
}

/**
 * The tracks of a playlist, in the order they play.
 *
 * Only what is a track. A video that was deleted or made private has
 * already been left out by the phone; one with no length is something that
 * cannot be played either. And a playlist somebody made of a record often
 * opens with the whole record as one video: far longer than anything else
 * on it, and not a track of itself.
 *
 * A track's number is its place among the ones kept. Where a video in the
 * middle of the record has been taken down, every track after it is numbered
 * one too low, and nothing here can know.
 */
export function tracksOf(videos: YouTubeResult[], artist: string | null): Omit<YouTubeTrack, 'have'>[] {
  const playable = videos.filter(
    (video): video is YouTubeVideo =>
      video.kind !== 'playlist' &&
      !!video.id &&
      video.duration != null &&
      video.duration > 0 &&
      video.duration <= LONGEST_VIDEO
  );
  const lengths = playable.map((video) => video.duration!).sort((one, other) => one - other);
  const usual = lengths[Math.floor((lengths.length - 1) / 2)] ?? 0;
  return playable
    .filter((video) => !(video.duration! >= 1200 && video.duration! >= usual * 4))
    .map((video, index) => ({
      disc: 1,
      position: index + 1,
      title: songTitle(video, artist, index + 1),
      lengthSec: Math.round(video.duration!),
      // Whose each video is, is the uploader's to say, and they say anything.
      artist: null,
      video: {
        id: video.id,
        url: video.url,
        title: video.title,
        channel: video.channel,
        thumbnail: video.thumbnail,
        duration: video.duration,
      },
    }));
}

export type Candidate = {
  id: string;
  url: string;
  title: string;
  channel: string;
  /** One of YouTube's own album playlists. */
  own: boolean;
  /** 2: named as the library names the record. 1: the same record, another edition's name. 0: the name is in it. */
  named: 0 | 1 | 2;
  /** The artist is in its name or its channel's. A search does not always say whose a playlist is. */
  credited: boolean;
};

/**
 * The playlists of a search that could be the record, the likeliest first.
 *
 * One that does not have the record's name in its own is not looked at,
 * whatever else it has. Neither is a mix, nor one that says it is the record
 * played live, covered or remixed when the library's name for it does not.
 *
 * The order is only which to read first: YouTube's own album before
 * somebody's playlist of it, a name that is the record's before a name that
 * contains it, one that says whose it is before one that does not, and
 * otherwise as the search ranked them. Being first makes none of them the
 * answer.
 */
export function candidatesOf(found: YouTubeResult[], album: string, artist: string): Candidate[] {
  const asked = new Set(foldForMatch(album).split(' '));
  const seen = new Set<string>();
  const ranked: (Candidate & { weight: number; at: number })[] = [];
  found.forEach((entry, at) => {
    if (entry.kind !== 'playlist' || !entry.id || !entry.url || isMix(entry.id) || seen.has(entry.id)) return;
    seen.add(entry.id);
    // `Album - Meteora` is how the extractor titles YouTube's own, read in full.
    const plain = withoutUploadNotes(
      bareTitle(dashed(entry.title).replace(/^album\s+-\s+/i, ''), artist)
    );
    if (foldForMatch(plain).split(' ').some((word) => NOT_THE_RECORD.has(word) && !asked.has(word))) return;
    const named =
      foldForMatch(plain) === foldForMatch(album) ? 2
      : sameRecordName(plain, album) ? 1
      : names(plain, withoutEdition(album) || album) ? 0
      : null;
    if (named == null) return;
    const own = isOwnAlbum(entry.id);
    const credited = names(entry.channel, artist) || names(entry.title, artist);
    ranked.push({
      id: entry.id,
      url: entry.url,
      title: entry.title,
      channel: entry.channel,
      own,
      named,
      credited,
      weight: (own ? 3 : 0) + named * 2 + (credited ? 1 : 0),
      at,
    });
  });
  return ranked
    .sort((one, other) => other.weight - one.weight || one.at - other.at)
    .map(({ weight: _weight, at: _at, ...candidate }) => candidate);
}

/** Whether most of a playlist's videos say they are this artist's: in the channel, or in front of the title. */
function mostlyBy(tracks: { video: YouTubeVideo }[], artist: string): boolean {
  const theirs = tracks.filter(
    ({ video }) => names(video.channel, artist) || names(video.title, artist)
  ).length;
  return theirs > 0 && theirs * 2 >= tracks.length;
}

/** Who most of the videos were uploaded by: what to call a playlist the search gave no channel for. */
function uploaderOf(tracks: { video: YouTubeVideo }[]): string {
  const counts = new Map<string, number>();
  let best = '';
  for (const { video } of tracks) {
    const by = withoutTopic(video.channel);
    if (!by) continue;
    const count = (counts.get(by) ?? 0) + 1;
    counts.set(by, count);
    if (best === '' || count > (counts.get(best) ?? 0)) best = by;
  }
  return best;
}

/**
 * Looks a record up on YouTube and says what the library is missing from it.
 *
 * One search, and then one request per playlist read: at most three, and as
 * a rule one, since reading stops at the first playlist that is believed.
 *
 * A playlist is believed when the library's tracks are on it: half of them
 * or more, and never fewer than two where the library has two. One or two
 * tracks are not much to go by — every record has an `Intro` — so for a
 * record the library has that little of, the playlist must also say whose it
 * is, or be YouTube's own.
 *
 * And where even those are not on it — the library's one track is there
 * under a title that could not be read — one playlist is still taken at its
 * word: YouTube's own album of this name by this artist, when the search
 * answered with exactly one such. That is said to the user as what it is.
 *
 * A stop while this is waiting is passed on as the rejection it arrived as;
 * everything else that goes wrong is answered and not thrown.
 */
export async function findAlbumOnYouTube(
  album: { name: string; artist: string | null; tracks: OwnedTrack[] },
  ask: { search: Look; read: Look },
  options: { signal?: AbortSignal; onStage?: (stage: Stage) => void } = {}
): Promise<YouTubeOutcome> {
  const { signal, onStage } = options;
  // A name that is all bracket is asked for as it stands.
  const name = (withoutEdition(album.name) || album.name).trim();
  const artist = searchArtist(album);
  if (!name || !artist) return { ok: false, why: 'unnamed' };

  const stopped = (error: unknown) => signal?.aborted === true || isAbortError(error);
  const owned = album.tracks.length;
  const few = owned <= 2;
  const needed = Math.max(Math.min(2, owned), Math.ceil(owned / 2));

  try {
    onStage?.('searching');
    const candidates = candidatesOf(await ask.search(`${artist} ${name}`, signal), album.name, artist);
    const albums = candidates.filter((candidate) => candidate.own && candidate.named >= 1);
    const only = albums.length === 1 ? albums[0]! : null;

    for (const candidate of candidates.slice(0, MOST_READ)) {
      onStage?.('reading');
      let videos: YouTubeResult[];
      try {
        videos = await ask.read(candidate.url, signal);
      } catch (error) {
        // Taken down or made private since the search listed it: the next one.
        if (!stopped(error) && failureCode(error) === 'ERR_YOUTUBE_UNAVAILABLE') continue;
        throw error;
      }

      const listed = tracksOf(videos, album.artist ?? artist);
      if (listed.length === 0 || listed.length > LONGEST) continue;
      const held = matchTracks(listed, album.tracks);
      const covered = held.filter(Boolean).length;
      const vouched = candidate.credited || mostlyBy(listed, artist);
      const by =
        covered >= needed && (!few || vouched || candidate.own) ? 'tracks'
        : few && candidate === only && vouched ? 'album'
        : null;
      if (!by) continue;

      return {
        ok: true,
        album: {
          playlist: {
            id: candidate.id,
            url: candidate.url,
            title: candidate.title,
            channel: candidate.channel || uploaderOf(listed),
          },
          by,
          tracks: listed.map((track, index) => ({ ...track, have: held[index] ?? null })),
          covered,
        },
      };
    }
    return { ok: false, why: 'notFound' };
  } catch (error) {
    if (stopped(error)) throw error;
    return { ok: false, why: 'failed', error };
  }
}
