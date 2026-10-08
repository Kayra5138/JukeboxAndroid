import { albumShown } from '../media/enriched.ts';
import {
  byRecord,
  coverIndex,
  isStoredCover,
  recordKey,
  sameRecordName,
} from './covers.ts';
import { fromItunesGenre } from './genres.ts';
import { isAbortError, isNetworkError, isThrottle, pause, statusOf } from './http.ts';
import { lookupTrack as lookupItunes, type ItunesMatch } from './itunes.ts';
import { lookupTrack as lookupMusicBrainz, type MusicBrainzMatch } from './musicbrainz.ts';
import type { CoverFill, TrackMetadata } from '../db/metadata.ts';
import type { TagSource } from '../db/tags.ts';
import type { Track } from '../types.ts';

/**
 * A large library still takes a while on its first pass, because Apple allows
 * only about twenty requests a minute and MusicBrainz one a second. That is why
 * every result is written as it arrives and already-known tracks are skipped on
 * the next run. The pacing itself lives in each client, since one track can
 * cost several requests.
 *
 * What this file is for is not wasting those requests. The two services are
 * asked side by side rather than turn and turn about, so that the three and a
 * half seconds between two questions to Apple are spent asking MusicBrainz
 * about the next track; a record's cover is searched for once and not once per
 * track; and a track with nothing left to find costs nothing at all.
 */

/** Back off rather than burning through the queue writing false misses. */
const RATE_LIMIT_BACKOFF_MS = 60_000;

/** A moment between retries, so a blink of a connection is not a verdict. */
const NETWORK_RETRY_MS = 2_000;

/**
 * How many requests in a row to one service may fail to reach it before that
 * service is given up on for the run. One failure is a dropped packet; three in
 * a row is a service that is not there, and grinding through a thousand tracks
 * at a quarter of a minute each to discover that is worse than saying so.
 *
 * Counted for each service on its own. Counted together, one of them answering
 * kept wiping the other's count clean, and a run with Apple down and
 * MusicBrainz up never stopped waiting on Apple.
 */
const OFFLINE_STRIKES = 3;

/**
 * How many tracks of one record may be asked about before the record is taken
 * to have no cover.
 *
 * One was too few: the first track of a record is as often as not an intro or
 * a skit, or carries a guest in its title, and a shop that does not know that
 * one track knows the album perfectly well. Three tracks nobody has heard of
 * is a record nobody sells.
 */
const SEARCHES_PER_RECORD = 3;

export type EnrichProgress = {
  /**
   * Tracks there is nothing left to do for, out of `total`.
   *
   * A track is done when both halves of it are: what it is, and its cover. The
   * two are worked on at once, so there is no moment at which "the lookups"
   * are over and "the covers" begin, and a count of either alone would sit
   * still while the other moved.
   */
  done: number;
  total: number;
  matched: number;
  /** Covers put on tracks so far, whether found or taken from the same record. */
  covers: number;
  /**
   * Set while one of the services is being left alone for a minute because it
   * asked to be. The other is still being asked, so the count can keep moving.
   */
  throttled: boolean;
  /**
   * Set on the final update when the pass gave up because nothing could be
   * reached. It is mutually exclusive with `throttled` — one means "the service
   * asked us to wait", the other "there is no network" — and it is always the
   * last progress reported, so an interface should show it as an outcome rather
   * than as a state the run will come back from.
   */
  offline?: boolean;
};

/** The two services a run asks, each on its own side of it. */
export type Service = 'musicbrainz' | 'apple';

export type EnrichResult = {
  coversSaved: number;
  matched: number;
  missed: number;
  cancelled: boolean;
  /**
   * Set when nothing at all could be reached and the pass stopped short of
   * the end of the queue.
   */
  stopped?: 'offline';
  /**
   * Set when one of the two could not be reached and the other could. The run
   * went on without it: everything that needed only the other was done, and
   * what needed this one was left unwritten for the next run.
   */
  unreachable?: Service;
};

/**
 * Where covers are read from and put, for a run that deals in them.
 *
 * Apart from the rest of the store because a run can do without: left out,
 * tracks are looked up and no cover is searched for, fetched or shared.
 */
export type CoverStore = {
  /** Every row there is, read once when the run starts. */
  readAllMetadata: () => Map<string, TrackMetadata>;
  /**
   * The whole library, of which the run may be covering a part.
   *
   * A track's neighbours on its record are looked for here, and most of them
   * are usually not among the tracks being looked up.
   */
  library: () => Track[] | Promise<Track[]>;
  /** Fetch a picture and answer where the app's own copy of it is. */
  download: (url: string) => Promise<string>;
  /** Put covers on tracks that have none; answers the tracks that took one. */
  fillCovers: (fills: CoverFill[]) => string[];
  /** Remember that these were searched for and nothing was found. */
  markCoverSearched: (trackIds: string[]) => void;
  /**
   * Whether the file carries a picture of its own.
   *
   * Such a track is left out of everything here: it is given no cover from its
   * record and none is searched for, because a cover written to its row would
   * be shown in place of the one the file came with. Finding out means opening
   * the file, so it is asked only about tracks something would otherwise be
   * done for. Left out, no file is taken to have one.
   */
  hasOwnPicture?: (trackId: string) => Promise<boolean>;
};

/**
 * The database, as this loop uses it.
 *
 * Passed in rather than imported so the loop can be exercised without SQLite
 * behind it; `enrich.ts` wires up the real tables and is the entry point
 * everything else calls.
 */
export type EnrichStore = {
  filterUnenriched: (trackIds: string[]) => string[];
  manualTrackIds: () => Set<string>;
  saveMetadata: (entry: TrackMetadata) => void;
  saveLookupTags: (trackId: string, tags: string[], source: TagSource) => void;
  /**
   * Remember whether a credit turned out to be one artist or several.
   *
   * Optional, because it is not part of finding a track: it is something the
   * finding happens to learn, kept for whoever counts artists later.
   */
  saveCredit?: (credit: string, oneArtist: boolean) => void;
  covers?: CoverStore;
};

/** The two catalogues, passed in so the run can be tried without them. */
export type Catalogues = {
  musicbrainz: (track: Track, signal?: AbortSignal) => Promise<MusicBrainzMatch | null>;
  itunes: (track: Track, signal?: AbortSignal) => Promise<ItunesMatch | null>;
};

const REAL: Catalogues = { musicbrainz: lookupMusicBrainz, itunes: lookupItunes };

type Found = Omit<TrackMetadata, 'trackId' | 'status' | 'source'> & {
  /**
   * Narrower than the `string | null` the metadata row stores it in: a result
   * exists because one of the two catalogues answered, and saying so here is
   * what lets the tags be filed under the same source without re-deriving it.
   */
  source: 'musicbrainz' | 'itunes';
  /** Ranked, best first. The first also becomes the genre column.  */
  tags: string[];
};

/**
 * MusicBrainz first, Apple second.
 *
 * The order matters more than it looks. MusicBrainz pins the search to a
 * resolved artist id, so another performer's cover cannot come back at all —
 * and its aliases mean a band filed as 妖精帝國 is still found by searching for
 * `Yousei Teikoku`. Apple searches free text across everything, which for
 * anime and game music returns a wall of covers, remixes and instrumentals by
 * people who did not make the recording.
 *
 * Apple still earns its place second: it covers mainstream and Turkish releases
 * that MusicBrainz has no genre for, and it is the only free source that labels
 * Turkish music as such rather than flattening it to `Pop`.
 *
 * Finding the recording is not the same as finding a genre, and MusicBrainz
 * recordings carry no genre and no tags at any level far more often than not.
 * A hit like that used to end the search and be written down as a match with
 * genre, album and artwork all null — permanently, since a track with a row is
 * never looked at again. So the hit alone is not enough to stop here: Apple is
 * asked anyway, and the bare MusicBrainz record is only the answer when Apple
 * has nothing either.
 *
 * The two halves are apart because they are asked in two places: what
 * MusicBrainz said is turned into an answer as soon as it arrives, and only a
 * track it had no genre for goes on to wait its turn with Apple.
 */
function fromMusicBrainz(musicbrainz: MusicBrainzMatch): Found {
  return {
    source: 'musicbrainz',
    title: musicbrainz.title,
    artist: musicbrainz.artist,
    album: null,
    genre: musicbrainz.genres[0] ?? null,
    year: musicbrainz.year,
    artworkUrl: null,
    // MusicBrainz is asked about the recording, not about the release it
    // appears on, so it has nothing to say about where that is.
    trackNumber: null,
    discNumber: null,
    tags: musicbrainz.genres,
  };
}

function fromItunes(itunes: ItunesMatch, found: Found | null): Found {
  // Apple gives exactly one label per track, so there is no ranking to keep —
  // but it is Apple's word for the genre, and it goes into the same column
  // MusicBrainz writes to, where `hip-hop/rap` beside `hip hop` is one genre
  // counted as two.
  const tags = itunes.genre ? fromItunesGenre(itunes.genre) : [];
  return {
    source: 'itunes',
    title: itunes.title,
    artist: itunes.artist,
    album: itunes.album,
    genre: tags[0] ?? null,
    // MusicBrainz dates the recording; Apple dates the release it is selling,
    // which for a reissue is decades late. Prefer the earlier authority.
    year: found?.year ?? itunes.year,
    artworkUrl: itunes.artworkUrl,
    trackNumber: itunes.trackNumber,
    discNumber: itunes.discNumber,
    tags,
  };
}

/**
 * Whether a result says anything worth writing down.
 *
 * The pass exists to produce genre statistics, so a record naming no genre has
 * answered the question that was asked — unless it brought an album or artwork,
 * which nothing else supplies and which the library shows.
 *
 * What is left is recorded as a miss rather than as a match, and that is the
 * whole point: `filterUnenriched` skips any track that has a row at all, so a
 * `matched` row with nothing in it is final. A miss is not — `clearMisses` can
 * take it back, and the tags MusicBrainz is missing today are the sort that get
 * contributed next year.
 */
function isUseful(found: Found): boolean {
  return found.tags.length > 0 || found.album != null || found.artworkUrl != null;
}

function miss(trackId: string): TrackMetadata {
  return {
    trackId,
    status: 'not_found',
    source: null,
    title: null,
    artist: null,
    album: null,
    genre: null,
    year: null,
    artworkUrl: null,
    trackNumber: null,
    discNumber: null,
  };
}

/** A track the run has something to do for. */
type Item = {
  track: Track;
  /** The release MusicBrainz put it on, when this run asked and it said. */
  release: { groupId: string; title: string | null } | null;
  finished: boolean;
};

/**
 * Tracks waiting on a search for one cover.
 *
 * `waiting` until there is an answer; `answered` once there is, with the cover
 * or with null for "there is none", which later arrivals are told without
 * anything being asked again; `split` when the answer turned out to be about
 * one track and not the record, and each of the others has to ask for itself.
 *
 * A record is not answered null by one track going unrecognised. `asked` are
 * the tracks that were tried and missed, and while there are fewer of them
 * than `SEARCHES_PER_RECORD` the next track to turn up is tried too. `queued`
 * says a search is already on its way, so that a second is not posted beside it.
 */
type Group = {
  members: Item[];
  asked: Set<Item>;
  queued: boolean;
  state: 'waiting' | 'answered' | 'split';
  answer: { uri: string; album: string | null } | null;
};

/** Something for Apple, or for the host its pictures are served from. */
type Job =
  | { kind: 'details'; item: Item; found: Found | null }
  | { kind: 'download'; item: Item; url: string; album: string | null }
  | { kind: 'cover'; key: string };

/**
 * Look up everything not looked up before, and find the covers that are
 * missing. Safe to stop and restart: progress lives in the database, not in
 * this function, and everything finished before a stop has been written.
 *
 * Two things go on at once. One asks MusicBrainz about each track in turn. The
 * other takes whatever is for Apple: the details of a track MusicBrainz had no
 * genre for, the picture a track's own answer came with, and one search per
 * record for a cover. Each service is still asked one question at a time and
 * no faster than its client allows — the gain is only that neither sits idle
 * while the other is waiting out its interval.
 *
 * Covers, in the order they are tried, cheapest first:
 *
 *  1. the cover the rest of the record already has (see `covers.ts`);
 *  2. the address the track's own lookup came back with, which is fetched and
 *     not searched for;
 *  3. one search for the record, asked about its best-described track, whose
 *     cover goes to every track of it. Where that track is not recognised the
 *     next best is tried, up to three; only then does the record have none,
 *     and that is written down for the tracks that were asked about and for
 *     no others, so the rest can be the ones asked next time.
 *
 * A track whose file carries its own picture takes no part in any of that.
 *
 * Tracks are one record when the library shows them under one album. Tracks
 * that name no album are each on their own, with one exception: two that
 * MusicBrainz has just put on the same release share a search, provided Apple
 * answers with that release and not with a single off it.
 *
 * A service that cannot be reached three times running is left alone for the
 * rest of the run, and only that one: what needs it is passed over unwritten,
 * to be tried next time, and everything the other can do is still done. With
 * neither answering the run stops and says there is no network.
 *
 * Does not reject for anything a service does. Every way a run can end — a
 * stop, a dead network, a service refusing to talk — comes back as a resolved
 * `EnrichResult`, because the only caller is a screen with a Stop button on it.
 * What is left to reject is the store itself failing, and that is passed on
 * only once both halves have stopped, so nothing is left running behind it.
 */
export async function runEnrichment(
  tracks: Track[],
  onProgress: (progress: EnrichProgress) => void,
  signal: AbortSignal | undefined,
  store: EnrichStore,
  catalogues: Catalogues = REAL
): Promise<EnrichResult> {
  const covers = store.covers;

  // Hand-written entries are excluded even when explicitly selected: an edit is
  // an answer, not a guess waiting to be improved on.
  const edited = store.manualTrackIds();
  const pending = new Set(store.filterUnenriched(tracks.map((track) => track.id)));
  for (const id of edited) pending.delete(id);

  // Kept in step with what is written below, so that nothing has to be read
  // back in the middle of a run to know what a track has by now.
  const rows = covers ? covers.readAllMetadata() : new Map<string, TrackMetadata>();
  const index = coverIndex(covers ? await covers.library() : [], rows);
  const groups = new Map<string, Group>();
  /** Records whose first cover has been passed round the tracks of this run. */
  const reached = new Set<string>();

  let matched = 0;
  let missed = 0;
  let coversSaved = 0;
  let done = 0;
  let total = 0;
  /** Requests in a row that did not reach each service. */
  const strikes: Record<Service, number> = { musicbrainz: 0, apple: 0 };
  /** Whether each has answered anything at all in this run. */
  const answered: Record<Service, boolean> = { musicbrainz: false, apple: false };
  /** The services given up on. */
  const down = new Set<Service>();
  /** How many of the two halves are sitting out a rate limit. */
  let backingOff = 0;
  /** Tracks whose files were found to carry a picture, out of those looked into. */
  const own = new Set<string>();
  const looked = new Set<string>();

  const reachedService = (service: Service) => {
    strikes[service] = 0;
    answered[service] = true;
  };

  const askAboutPicture = async (trackId: string) => {
    if (looked.has(trackId)) return;
    looked.add(trackId);
    const has = (await covers?.hasOwnPicture?.(trackId).catch(() => false)) ?? false;
    if (has) own.add(trackId);
  };

  const emit = () =>
    onProgress({ done, total, matched, covers: coversSaved, throttled: backingOff > 0 });

  /**
   * How a run that was not stopped by hand fell short, if it did.
   *
   * No network when neither service is left, or when the one that was given
   * up on is the only one that was ever tried. One service named when the
   * other was answering all along.
   */
  const shortfall = (): Pick<EnrichResult, 'stopped' | 'unreachable'> => {
    if (down.size === 0) return {};
    const [only] = [...down];
    const other: Service = only === 'apple' ? 'musicbrainz' : 'apple';
    return down.size === 2 || !answered[other] ? { stopped: 'offline' } : { unreachable: only };
  };

  const result = (cancelled: boolean): EnrichResult =>
    cancelled
      ? { matched, missed, coversSaved, cancelled }
      : { matched, missed, coversSaved, cancelled, ...shortfall() };

  if (signal?.aborted) return result(true);

  /*
    One signal for both halves, which either of them can pull as well as the
    caller: when one finds there is no network, the other should not go on to
    find it out three more times.

    Joined by hand for the reason given in `http.ts` — the AbortController on
    Hermes has no `AbortSignal.any`.
  */
  const halt = new AbortController();
  const forward = () => halt.abort();
  signal?.addEventListener('abort', forward, { once: true });

  const finish = (item: Item) => {
    if (item.finished) return;
    item.finished = true;
    done += 1;
    emit();
  };

  // ---- Apple's queue ----

  // Two lines, and the short one first. A track's own details and its own
  // picture finish that track, which is what shows on the screen; a search for
  // a record's cover can wait behind them without anybody noticing.
  const urgent: Job[] = [];
  const searches: Job[] = [];
  let wake: (() => void) | null = null;
  let lookupsOver = false;

  const nudge = () => {
    wake?.();
    wake = null;
  };
  halt.signal.addEventListener('abort', nudge, { once: true });

  /** Leaves a job undone and unwritten, so the next run tries it again. */
  const abandon = (job: Job) => {
    if (job.kind !== 'cover') return finish(job.item);
    const group = groups.get(job.key);
    if (!group) return;
    // Kept rather than forgotten, with what it has learned: a track of the
    // record arriving later in this run asks again, and the tracks already
    // tried and missed are still not tried twice.
    group.queued = false;
    group.members.forEach(finish);
  };

  const post = (job: Job, first = false) => {
    // Nobody is there to take it.
    if (down.has('apple')) return abandon(job);
    if (job.kind === 'cover') searches.push(job);
    else if (first) urgent.unshift(job);
    else urgent.push(job);
    nudge();
  };

  const nextJob = async (): Promise<Job | null> => {
    for (;;) {
      if (halt.signal.aborted) return null;
      const job = urgent.shift() ?? searches.shift();
      if (job) return job;
      // Nothing waiting, and nothing left that could put something here.
      if (lookupsOver) return null;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  };

  // ---- covers ----

  /** Puts one cover on these tracks, and tells whoever was waiting for it. */
  const give = (to: Track[], uri: string, album: string | null) => {
    if (!covers || to.length === 0) return;
    const filled = new Set(
      covers.fillCovers([{ trackIds: to.map((track) => track.id), uri, album }])
    );
    const records = new Set<string>();
    for (const track of to) {
      const row = rows.get(track.id);
      if (!row || !filled.has(track.id)) continue;
      // The same rule the table applies: a record name somebody typed stays.
      const next = {
        ...row,
        artworkUrl: uri,
        album: row.status === 'manual' ? row.album : (row.album ?? album),
      };
      rows.set(track.id, next);
      coversSaved += 1;

      const key = recordKey(track, next);
      if (!key) continue;
      index.add(key, uri);
      records.add(key);
    }

    for (const key of records) {
      // The rest of the record may be queued for a search this has just made
      // unnecessary. They get it now rather than each finding it for itself.
      const group = groups.get(`album:${key}`);
      if (group?.state === 'waiting') {
        group.state = 'answered';
        group.answer = { uri, album: null };
        give(group.members.map((member) => member.track), uri, null);
        group.members.forEach(finish);
      }
      /*
        And the tracks of the record this run is already through with: one no
        catalogue knew, which was finished with no cover because the record had
        none yet, or one told earlier that a search had found nothing. Once per
        record, the first time it gets a cover — whatever comes to it after
        that finds the cover for itself on the way in.
      */
      if (reached.has(key)) continue;
      reached.add(key);
      give(
        tracks.filter((other) => {
          const held = rows.get(other.id);
          return (
            held != null &&
            !isStoredCover(held.artworkUrl) &&
            // Only a track whose file has been looked into, which is every
            // one that named a record when the run began or was looked up in it.
            looked.has(other.id) &&
            !own.has(other.id) &&
            recordKey(other, held) === key
          );
        }),
        uri,
        null
      );
    }
  };

  const searched = (items: Item[]) => {
    const ids = items.map((item) => item.track.id);
    covers?.markCoverSearched(ids);
    const now = Date.now();
    for (const id of ids) {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, coverSearchedAt: now });
    }
  };

  const join = (item: Item, key: string) => {
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { members: [item], asked: new Set(), queued: true, state: 'waiting', answer: null });
      post({ kind: 'cover', key });
    } else if (group.state === 'waiting') {
      group.members.push(item);
      // The tracks before this one were tried and not recognised, and nothing
      // is on its way. This one is another chance for the record.
      if (!group.queued) {
        group.queued = true;
        post({ kind: 'cover', key });
      }
    } else if (group.state === 'split') {
      join(item, `track:${item.track.id}`);
    } else {
      // Asked and answered earlier in this run. A cover is this track's too.
      // "There is none" is taken as the answer for now and not written down:
      // this track was not itself asked about, and may be next time.
      if (group.answer) give([item.track], group.answer.uri, group.answer.album);
      finish(item);
    }
  };

  /** A track whose details are settled: find it a cover, or see that it needs none. */
  const wantCover = (item: Item) => {
    const { track } = item;
    const row = rows.get(track.id);
    if (!covers || !row || isStoredCover(row.artworkUrl)) return finish(item);
    // The file has a picture of its own, and that is its cover.
    if (own.has(track.id)) return finish(item);

    const key = recordKey(track, row);
    const sibling = key ? index.pick(key) : null;
    if (sibling) {
      give([track], sibling, null);
      return finish(item);
    }

    // Nobody could say what this is, so there is nothing to search for a cover
    // with. The one above is the only kind it can have.
    if (row.status === 'not_found') return finish(item);

    // Its own lookup came with a picture. First in line, so the track that
    // was just found is also the track that is finished next.
    if (row.artworkUrl) {
      return post({ kind: 'download', item, url: row.artworkUrl, album: row.album }, true);
    }

    if (row.coverSearchedAt != null) return finish(item);

    join(
      item,
      key
        ? `album:${key}`
        : item.release
          ? `release:${item.release.groupId}`
          : `track:${track.id}`
    );
  };

  /**
   * The one of them a catalogue is likeliest to recognise.
   *
   * A search is by artist and title, and is refused outright when the artist
   * does not agree — so a track that names its artist comes before one that
   * does not, and then one a catalogue has already matched, since its names
   * are the catalogue's spelling of them. The first of equals.
   */
  const bestDescribed = (members: Item[]): Item => {
    const score = (item: Item) => {
      const row = rows.get(item.track.id);
      return (
        (item.track.artist ?? row?.artist ? 2 : 0) + (row?.status === 'matched' ? 1 : 0)
      );
    };
    return members.reduce((best, item) => (score(item) > score(best) ? item : best));
  };

  const search = async (key: string) => {
    const group = groups.get(key);
    if (!covers || group?.state !== 'waiting') return;

    const untried = () =>
      group.members.filter((member) => !member.finished && !group.asked.has(member));
    if (untried().length === 0) {
      group.queued = false;
      return;
    }

    const about = bestDescribed(untried());
    const row = rows.get(about.track.id);
    const match = await catalogues.itunes(
      {
        ...about.track,
        title: row?.title ?? about.track.title,
        artist: row?.artist ?? about.track.artist,
        album: albumShown(about.track, row),
      },
      halt.signal
    );
    reachedService('apple');
    if (halt.signal.aborted) return;

    if (!match?.artworkUrl) {
      // Written down for the track that was asked about and for no other.
      group.asked.add(about);
      group.queued = false;
      searched([about]);
      finish(about);

      if (group.asked.size >= SEARCHES_PER_RECORD) {
        group.state = 'answered';
        group.members.forEach(finish);
      } else if (untried().length > 0) {
        // At the back of the line, behind the records not yet tried once.
        group.queued = true;
        post({ kind: 'cover', key });
      }
      // Otherwise it waits as it is, for a track of the record still to come.
      return;
    }

    const named = key.startsWith('album:');
    // Only now is it known which record a track that named none is on, and
    // that record may be one the library already has a cover for.
    const found = match.album ? recordKey({ album: match.album }, null) : null;
    const uri =
      (!named && found ? index.pick(found) : null) ?? (await covers.download(match.artworkUrl));
    // Nothing is published for a run that was stopped while the picture came.
    if (halt.signal.aborted) return;

    /*
      A record the library names is one record whatever Apple calls it, and
      everything on it takes the cover. Tracks grouped only because MusicBrainz
      put them on one release are held to more: Apple has to have answered with
      that release. Where it answered with something else — the single, most
      often — the cover is the one track's, and the others ask for themselves,
      which is what they would have done before there were groups at all.
    */
    if (named || sameRecordName(match.album, about.release?.title)) {
      group.state = 'answered';
      group.answer = { uri, album: match.album };
      // Read again rather than held from above: tracks join while this waits.
      give(group.members.map((member) => member.track), uri, match.album);
      group.members.forEach(finish);
      return;
    }

    group.state = 'split';
    give([about.track], uri, match.album);
    finish(about);
    for (const other of group.members) {
      if (other !== about && !other.finished) join(other, `track:${other.track.id}`);
    }
  };

  // ---- details ----

  /** Writes down what was found for a track, or that nothing was. */
  const settle = (item: Item, match: Found | null) => {
    const trackId = item.track.id;
    if (match && isUseful(match)) {
      const { tags, ...metadata } = match;
      const entry: TrackMetadata = { trackId, status: 'matched', ...metadata };
      matched += 1;
      store.saveMetadata(entry);
      store.saveLookupTags(trackId, tags, metadata.source);
      rows.set(trackId, entry);
    } else {
      missed += 1;
      store.saveMetadata(miss(trackId));
      rows.set(trackId, miss(trackId));
    }
    wantCover(item);
  };

  /**
   * What to do about a request that failed. Answers whether that half of the
   * run is to carry on.
   *
   * `abandoned` leaves whatever was being worked on unwritten, so the next run
   * tries it again; `refused` is for a failure that is an answer.
   */
  const failed = async (
    service: Service,
    error: unknown,
    abandoned: () => void,
    refused: () => void = abandoned
  ): Promise<boolean> => {
    if (halt.signal.aborted || isAbortError(error)) return false;

    // Not reached. Nothing is written, so whenever the service is there again
    // this track is still waiting to be tried.
    if (isNetworkError(error)) {
      abandoned();
      strikes[service] += 1;
      if (strikes[service] >= OFFLINE_STRIKES) {
        down.add(service);
        return false;
      }
      await pause(NETWORK_RETRY_MS, halt.signal);
      return !halt.signal.aborted;
    }
    // It answered, if only to refuse.
    reachedService(service);

    // A refusal that is not a throttle, or an answer that would not parse:
    // the service was reached and had nothing usable to say about this track.
    // Waiting a minute changes none of that, so it counts as a miss and the
    // queue keeps moving.
    const status = statusOf(error);
    if (!isThrottle(error) && (status === null || (status >= 400 && status < 500))) {
      refused();
      return true;
    }

    // A throttle and the 5xx range mean "later". Nothing is written, so the
    // next pass retries it. Apple's throttle is a 403, which is why the service
    // says so itself rather than the status being read here. Only the half
    // that was told to wait does: the other service has not complained.
    abandoned();
    backingOff += 1;
    emit();
    await pause(RATE_LIMIT_BACKOFF_MS, halt.signal);
    backingOff -= 1;
    // Said again, or the note about waiting stays up until the next track is
    // done, which with one service down may be a long time.
    emit();
    return !halt.signal.aborted;
  };

  // ---- what there is to do ----

  /** Whether a track already looked up has anything left that could be done for it. */
  const coverless = (track: Track): TrackMetadata | null => {
    const row = rows.get(track.id);
    return covers && row && !isStoredCover(row.artworkUrl) ? row : null;
  };
  const searchable = (row: TrackMetadata) =>
    row.status !== 'not_found' && (row.artworkUrl != null || row.coverSearchedAt == null);

  // The files are looked into first, and only the ones something could be
  // done for: a track to search for, or one that names a record and so may be
  // handed that record's cover before the run is over. A track with its own
  // picture is then left out of all of it.
  await Promise.all(
    tracks.map((track) => {
      if (pending.has(track.id)) return null;
      const row = coverless(track);
      if (!row) return null;
      return recordKey(track, row) != null || searchable(row) ? askAboutPicture(track.id) : null;
    })
  );
  if (signal?.aborted) {
    signal.removeEventListener('abort', forward);
    return result(true);
  }

  const items: Item[] = [];
  /** Covers that can be had without asking anybody, one entry per cover. */
  const atOnce = new Map<string, Track[]>();
  for (const track of tracks) {
    if (pending.has(track.id)) {
      items.push({ track, release: null, finished: false });
      continue;
    }
    const row = coverless(track);
    if (!row || own.has(track.id)) continue;

    const key = recordKey(track, row);
    const sibling = key ? index.pick(key) : null;
    if (sibling) {
      const takers = atOnce.get(sibling);
      if (takers) takers.push(track);
      else atOnce.set(sibling, [track]);
      continue;
    }
    // What is left costs a request, and only a track that was identified and
    // has not been searched for already is worth one.
    if (searchable(row)) items.push({ track, release: null, finished: false });
  }
  for (const [uri, takers] of atOnce) give(takers, uri, null);

  const queue = byRecord(items, (item) => recordKey(item.track, rows.get(item.track.id)));
  total = queue.length;
  emit();

  // Tracks already looked up have only a cover left to find, and go straight
  // to Apple's side, which then has something to do from the first second.
  for (const item of queue) {
    if (!pending.has(item.track.id)) wantCover(item);
  }

  // ---- the two halves ----

  const lookups = async () => {
    for (const item of queue) {
      if (halt.signal.aborted) break;
      if (!pending.has(item.track.id)) continue;
      try {
        // While this waits its turn anyway. Known by the time a cover is
        // wanted for the track, which is the moment it matters.
        await askAboutPicture(item.track.id);
        const musicbrainz = await catalogues.musicbrainz(item.track, halt.signal);
        reachedService('musicbrainz');
        if (halt.signal.aborted) break;

        // Before deciding whether the match is worth keeping: a recording
        // with no genre still settled who its artists are.
        if (musicbrainz?.oneArtist != null) {
          store.saveCredit?.(musicbrainz.artist, musicbrainz.oneArtist);
        }
        item.release = musicbrainz?.release ?? null;

        const found = musicbrainz ? fromMusicBrainz(musicbrainz) : null;
        if (found && found.tags.length > 0) settle(item, found);
        else post({ kind: 'details', item, found });
      } catch (error) {
        const carryOn = await failed(
          'musicbrainz',
          error,
          () => finish(item),
          () => settle(item, null)
        );
        // Given up on: the tracks not yet asked about are left as they are,
        // unwritten, and Apple's side finishes what it already has.
        if (!carryOn) break;
      }
    }
    lookupsOver = true;
    nudge();
  };

  const apple = async () => {
    for (;;) {
      const job = await nextJob();
      if (!job) break;
      try {
        if (job.kind === 'details') {
          const itunes = await catalogues.itunes(job.item.track, halt.signal);
          reachedService('apple');
          if (halt.signal.aborted) break;
          settle(job.item, itunes ? fromItunes(itunes, job.found) : job.found);
        } else if (job.kind === 'download') {
          // Unless the record got its cover while this was waiting its turn.
          if (!isStoredCover(rows.get(job.item.track.id)?.artworkUrl)) {
            const uri = await covers!.download(job.url);
            if (halt.signal.aborted) break;
            give([job.item.track], uri, job.album);
          }
          finish(job.item);
        } else {
          await search(job.key);
        }
      } catch (error) {
        // A picture comes from another host than the searches do, and through
        // the phone rather than through here; its failing says nothing about
        // whether Apple can be reached, so it is never counted against Apple.
        // A cover that would not come never unsettles what was found for the
        // track, either. It is left for the next run.
        if (job.kind === 'download') {
          if (halt.signal.aborted || isAbortError(error)) break;
          abandon(job);
          continue;
        }
        const carryOn = await failed(
          'apple',
          error,
          () => abandon(job),
          job.kind === 'details' ? () => settle(job.item, null) : undefined
        );
        if (carryOn) continue;
        if (down.has('apple')) {
          // Given up on. What was waiting for it is passed over, and so is
          // anything the other half sends this way from now on (see `post`).
          for (const waiting of [...urgent.splice(0), ...searches.splice(0)]) abandon(waiting);
        }
        break;
      }
    }
  };

  // A failure of the store in one half stops the other before it is passed
  // on, so that nothing goes on asking and writing behind a run that is over.
  let fault: { error: unknown } | null = null;
  const contained = (half: Promise<void>) =>
    half.catch((error: unknown) => {
      fault ??= { error };
      halt.abort();
    });
  await Promise.all([contained(lookups()), contained(apple())]);

  signal?.removeEventListener('abort', forward);
  if (fault) throw (fault as { error: unknown }).error;

  if (signal?.aborted) return result(true);
  const ended = result(false);
  if (ended.stopped) {
    onProgress({ done, total, matched, covers: coversSaved, throttled: false, offline: true });
  } else if (ended.unreachable) {
    // Not everything was done, and the count should not say it was.
    onProgress({ done, total, matched, covers: coversSaved, throttled: false });
  } else {
    onProgress({ done: total, total, matched, covers: coversSaved, throttled: false });
  }
  return ended;
}
