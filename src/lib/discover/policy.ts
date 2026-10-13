import { foldForMatch } from '../metadata/text.ts';
import { splitCredit } from '../metadata/credit.ts';
import { artistBlockId, artistBlockKey, chance } from './taste.ts';
import { sharePlaces } from './nearness.ts';
import { leadArtist, leadOfFolded, loosenFolded } from './variants.ts';

export const DAY = 86_400_000;
/**
 * What somebody has chosen about Discover.
 *
 * `ready` is how many of the next songs are kept fetched ahead of being
 * asked for: none, or a few. It took the place of a switch that was all or
 * nothing — every song on the list downloaded, or none until tapped — and a
 * list of twenty is half an hour of downloading that a tap then waited
 * behind. `wifiOnly` is about those songs and no others: one somebody taps
 * is fetched over whatever connection there is.
 *
 * Other parts of Discover keep choices of their own in the same place, so a
 * field this does not know is carried through as it was found.
 */
export type DiscoverSettings = {
  count: number;
  refreshDays: number;
  ready: number;
  wifiOnly: boolean;
  /** Which end of an artist's range to lean toward; absent is no preference. See {@link popularityOf}. */
  popularity?: Popularity;
  /**
   * Whether a tapped song that is not ready is heard at once as a
   * thirty-second preview while it is fetched. Absent is yes: see
   * {@link previewsOn}.
   */
  preview?: boolean;
};

/** Previews are played unless somebody has said not to. */
export function previewsOn(settings: { preview?: unknown }): boolean {
  return settings.preview !== false;
}
export const READY_CHOICES: readonly number[] = [0, 3, 5, 10];
/**
 * How Discover starts out: the list is refreshed when somebody presses
 * refresh, and the next three songs are kept ready while there is Wi-Fi.
 *
 * Three is what makes a tap play at once without the phone fetching a list
 * nobody may listen to: about ten megabytes, on a connection that is not
 * paid for by the megabyte.
 */
export const DEFAULT_SETTINGS: DiscoverSettings = { count: 20, refreshDays: 0, ready: 3, wifiOnly: true };
/**
 * Settings as they were stored, made safe to go by.
 *
 * What was stored before `ready` existed says `autoDownload` instead. On, it
 * meant the whole list was fetched ahead, and the nearest thing there now is
 * to that is the most that can be chosen: ten. Somebody who asked for
 * everything is not quietly given three. Off was also what a fresh install
 * said, so it cannot be told apart from never having chosen, and is read as
 * the default.
 */
export function settingsFrom(value: unknown): DiscoverSettings {
  const stored = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const { autoDownload, preview, ...others } = stored;
  const v = stored as Partial<DiscoverSettings>;
  return {
    ...others,
    // Kept only where it says something: anything but a plain no is the default, which is yes.
    ...(preview === false ? { preview: false } : {}),
    count: [10, 20, 30, 40].includes(v.count!) ? v.count! : DEFAULT_SETTINGS.count,
    refreshDays: [0, 1, 3, 7, 14, 30].includes(v.refreshDays!) ? v.refreshDays! : DEFAULT_SETTINGS.refreshDays,
    ready: READY_CHOICES.includes(v.ready!) ? v.ready! : autoDownload === true ? 10 : DEFAULT_SETTINGS.ready,
    wifiOnly: typeof v.wifiOnly === 'boolean' ? v.wifiOnly : DEFAULT_SETTINGS.wifiOnly,
  };
}
export function songKey(song: { title: string; artist?: string | null }): string {
  return `${foldForMatch(song.artist ?? '')}|${foldForMatch(song.title)}`;
}
/**
 * What somebody listens to, as tags: which ones, how much each, and which go together.
 *
 * The pairs are the point. `rock` on its own is half the catalogue and says
 * nothing about anybody; `rock` together with `j-pop`, because that is what
 * the songs actually played are tagged, is a taste. So a pair is counted when
 * both tags are on the same song, and searching for the two at once finds
 * artists who are both rather than the most famous name under either.
 *
 * Each item is a song's tags, best first, and how much it was listened to.
 * Only its first four count: past that a tag describes the song less than it
 * describes whoever tagged it.
 */
export type TagMix = { tags: string[]; weights: Map<string, number>; pairs: [string, string][] };

export function tagMix(items: Iterable<[tags: string[], gain: number]>): TagMix {
  const single = new Map<string, number>();
  const together = new Map<string, number>();

  for (const [all, gain] of items) {
    if (!(gain > 0)) continue;
    const tags = [...new Set(all)].slice(0, 4);
    tags.forEach((tag, index) => {
      single.set(tag, (single.get(tag) ?? 0) + gain);
      for (const other of tags.slice(index + 1)) {
        const key = [tag, other].sort().join('\n');
        together.set(key, (together.get(key) ?? 0) + gain);
      }
    });
  }

  // By weight, and by the tag's own spelling where two weigh the same, so
  // that the same listening always gives the same mix.
  const byWeight = (left: [string, number], right: [string, number]) =>
    right[1] - left[1] || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  const ordered = [...single].sort(byWeight);
  const top = ordered[0]?.[1] ?? 1;

  return {
    tags: ordered.slice(0, 4).map(([tag]) => tag),
    // As a share of the most listened-to tag, so one means "as much as anything".
    weights: new Map(ordered.map(([tag, weight]) => [tag, weight / top])),
    pairs: [...together]
      .sort(byWeight)
      .slice(0, 3)
      .map(([key]) => key.split('\n') as [string, string]),
  };
}

/**
 * How well a song's tags sit in that mix, from nought to three.
 *
 * Every tag listened to counts for its share, so a song tagged with three
 * things played a little outranks one tagged with a single favourite. Capped,
 * or a song somebody tagged with everything would win every time.
 */
export function tagFit(tags: string[], weights: Map<string, number>): number {
  let fit = 0;
  for (const tag of new Set(tags)) fit += weights.get(tag) ?? 0;
  return Math.min(3, fit);
}

/**
 * Which end of an artist's range Discover leans toward.
 *
 * `any` is the default and means what it says: a list drawn from the single
 * and from track nine alike. It used not to be a choice at all — a song's
 * score was its artist's divided by how far down the artist's most-played
 * list it stood, so every list was the hits. `known` asks for that on
 * purpose, and `deep` for the opposite.
 */
export type Popularity = 'known' | 'any' | 'deep';
export const POPULARITY_CHOICES: readonly Popularity[] = ['known', 'any', 'deep'];
export const DEFAULT_POPULARITY: Popularity = 'any';

/**
 * The choice as it was stored, whatever was stored.
 *
 * Read off the settings and not made part of what `settingsFrom` insists on,
 * so that settings saved before the choice existed are complete as they are
 * and anything unreadable in its place is simply no preference.
 */
export function popularityOf(settings: unknown): Popularity {
  const stored = (settings as { popularity?: unknown } | null | undefined)?.popularity;
  return POPULARITY_CHOICES.includes(stored as Popularity) ? (stored as Popularity) : DEFAULT_POPULARITY;
}

export type Listen = {
  track_id: string;
  artist: string | null;
  started_at: number;
  seconds_played: number;
  completed: number;
};
export type Skip = {
  artist: string | null;
  started_at: number;
  seconds_played: number;
  duration_sec: number | null;
};

/**
 * What somebody has been listening to this last month: which artists, how
 * much each, and the tags of it.
 *
 * A play counts for the seconds of it, up to ten minutes — one sitting capped
 * so that a song left looping overnight cannot be the whole profile — and for
 * a quarter more if it was heard to the end. It counts for half as much every
 * fortnight it recedes, so the month is weighted toward this week. A credit
 * of several names shares the play between them.
 *
 * A skip in the first seconds takes a minute and a half back off an artist.
 * It can only take from what is there: an artist with no plays has no score
 * to lose, and what is made of skipping somebody new is `taste.ts`'s to say.
 */
export function tasteProfile(plays: Listen[], skips: Skip[], tags: Map<string, string[]>, now: number) {
  const artists = new Map<string, { name: string; score: number }>();
  const tagged: [string[], number][] = [];
  const recent = (at: number) => at >= now - 30 * DAY && at <= now;
  const decay = (at: number) => Math.pow(0.5, (now - at) / (14 * DAY));

  for (const play of plays) {
    if (!recent(play.started_at)) continue;
    const gain =
      Math.min(600, Math.max(0, play.seconds_played)) * decay(play.started_at) * (play.completed ? 1.25 : 1);
    const names = splitCredit(play.artist);
    for (const name of names) {
      const key = foldForMatch(name);
      const before = artists.get(key);
      artists.set(key, { name: before?.name ?? name, score: (before?.score ?? 0) + gain / names.length });
    }
    tagged.push([tags.get(play.track_id) ?? [], gain]);
  }

  for (const skip of skips) {
    if (!recent(skip.started_at)) continue;
    if (skip.seconds_played >= Math.min(30, (skip.duration_sec || 120) * 0.25)) continue;
    for (const name of splitCredit(skip.artist)) {
      const before = artists.get(foldForMatch(name));
      if (before) before.score = Math.max(0, before.score - 90 * decay(skip.started_at));
    }
  }

  return {
    artists: [...artists.values()].filter((artist) => artist.score > 0).sort((left, right) => right.score - left.score),
    ...tagMix(tagged),
  };
}

/**
 * What a song with no recording to be found used to be told, and kept.
 *
 * Nothing is told a sentence now: such a song is known by the queue's code
 * for it, and the words are made when they are read. These two wordings are
 * here for the lists written before that, whose songs carry one or the other
 * as their only mark and are still to be read: see `before.ts`.
 */
export const NO_MATCH = 'No matching studio recording was found. Another song is taking its place.';
const NO_MATCH_BEFORE = 'A matching studio recording could not be found.';
/** `Failure.kt`'s name for the same thing, which is how the queue says a job came to it. */
export const NO_MATCH_CODE = 'ERR_DOWNLOAD_NO_MATCH';
export function isNoMatch(error: string | undefined | null): boolean {
  return !!error && (error === NO_MATCH || error.startsWith(NO_MATCH_BEFORE));
}

/**
 * A download that stopped only because it may not use mobile data.
 *
 * Unlike every other failure this one is not the song's fault and is not a
 * reason to give its place away: it is tried again when there is Wi-Fi. It is
 * known by its code. The words are only read for an entry stored before the
 * code was kept with it, or made by a build that sends none — and they are
 * English there, since such a build says nothing in any other language.
 */
export const WAITING_WIFI = 'ERR_DOWNLOAD_WAITING_WIFI';
export function isWaitingWifi(entry: { error?: string | null; errorCode?: string | null }): boolean {
  if (!entry.error) return false;
  return entry.errorCode ? entry.errorCode === WAITING_WIFI : entry.error.includes('Waiting for Wi-Fi');
}

export type RankedSong = {
  recordingMbid: string;
  title: string;
  artist: string;
  artistMbid: string;
  familiar: boolean;
  score: number;
  /** The seeds that led to it, the strongest first, joined by ` · `. Read for spreading the list across them. */
  because?: string;
  /** The build it came from; see {@link Selection.edition}. */
  edition?: string | number;
  /**
   * How hard the artist it is on the list for — the first of `because` —
   * pulls, from nought to one. Where the pool's songs carry it, the places
   * are shared out between those artists by it; see {@link selectSongs}.
   */
  share?: number;
};

export type Selection = {
  /**
   * What this list's chance is drawn from.
   *
   * The same edition over the same pool chooses the same songs, however often
   * it is asked; another edition chooses others. Left out, it is the edition
   * the pool's own songs carry — the time the pool was gathered — and for a
   * pool that carries none there is no chance at all and the best score wins,
   * as it always did.
   */
  edition?: string | number;
};

/**
 * How far chance can move a song: its score counts for between six tenths and
 * fourteen tenths of itself. Enough that two songs within a third of one
 * another change places from one list to the next, and not so much that the
 * weakest thing in the pool can come out above the strongest.
 */
const LEAST_LUCK = 0.6;
const LUCK_RANGE = 0.8;

/**
 * Which songs make up a list of [count], given the ones already on it.
 *
 * [retained] are kept, in full and first. The places left are filled from
 * [pool], and nothing in [excluded] is chosen: a recording by its id, a song
 * by its `artist|title`, the same song under a looser reading of its title
 * (see `loosenFolded`), and anything by an artist whose block is in the set.
 *
 * The order songs are tried in is their score moved by this edition's chance.
 * A strict order had two faults. The list was the same list until something
 * was taken off it, and since everything shown is then kept away for months,
 * each refresh was by construction the next-best songs and never as good as
 * the one before. With chance, a refresh draws again from the whole of what
 * is good enough.
 *
 * Half are meant to be by artists somebody already plays and half by artists
 * new to them. That is filled first, as it was. What has changed is what
 * happens when one half runs short: the places used to be left empty, and a
 * list of twenty showed twelve. They are now given to the other half, because
 * the split is something to aim at and a short list is nothing anybody wants.
 *
 * Where the pool carries how hard each of somebody's artists pulls (`share`),
 * the places of each half are shared out between those artists by it before
 * anything else is done: the artist played most leads to most.
 *
 * And three things keep a list from being one thing over and over, each
 * given up only when the places cannot otherwise be filled:
 *
 *  - no more than two songs by one artist (one, on a list of ten);
 *  - no more than a quarter of the list from the neighbours of any one of
 *    somebody's artists, so that the artist played most does not turn the
 *    whole of the new half into its own neighbourhood;
 *  - one place for one song, whichever recording of it and however spelled.
 *
 * The order of what is returned is the old one, the two halves taken in
 * turn. Where on the screen a song goes is not decided here.
 */
export function selectSongs<T extends RankedSong>(
  pool: T[],
  retained: T[],
  count: number,
  excluded: Set<string>,
  options: Selection = {}
): T[] {
  const edition = options.edition ?? pool.find((song) => song.edition != null)?.edition;
  const perArtist = count <= 10 ? 1 : 2;
  const perSeed = Math.max(2, Math.ceil(count / 4));

  // The same song by a looser reading of its title, and by the first name of its credit: another
  // catalogue's spelling of a song that was turned away is the song that was turned away.
  const looselyExcluded = new Set<string>();
  for (const key of excluded) {
    if (!key.includes('|')) continue;
    looselyExcluded.add(loosenFolded(key));
    looselyExcluded.add(leadOfFolded(key));
  }

  /**
   * A song by the first name of its credit, read from the credit as written:
   * `Halsey & SUGA` folds to `halsey suga`, and only here, before the fold,
   * can the two be told apart.
   */
  const byLead = (song: T) => loosenFolded(songKey({ title: song.title, artist: leadArtist(song.artist) }));
  const picked = retained.slice(0, count);
  const ids = new Set<string>();
  const keys = new Set<string>();
  const artists = new Map<string, number>();
  const seeds = new Map<string, number>();
  const seedOf = (song: T) => foldForMatch((song.because ?? '').split(' · ')[0] ?? '');
  const take = (song: T) => {
    ids.add(song.recordingMbid);
    keys.add(songKey(song));
    keys.add(loosenFolded(songKey(song)));
    keys.add(leadOfFolded(songKey(song)));
    keys.add(byLead(song));
    artists.set(song.artistMbid, (artists.get(song.artistMbid) ?? 0) + 1);
    // Counted for the new artists only: an artist's own songs are already
    // held to two, and counting them here would leave no room for the
    // neighbours they are the reason for.
    const seed = song.familiar ? '' : seedOf(song);
    if (seed) seeds.set(seed, (seeds.get(seed) ?? 0) + 1);
  };
  picked.forEach(take);

  const candidates = pool
    .filter((song) => {
      const key = songKey(song);
      return !(
        excluded.has(song.recordingMbid) ||
        excluded.has(key) ||
        looselyExcluded.has(loosenFolded(key)) ||
        looselyExcluded.has(leadOfFolded(key)) ||
        looselyExcluded.has(byLead(song)) ||
        excluded.has(artistBlockId(song.artistMbid)) ||
        excluded.has(artistBlockKey(song.artist))
      );
    })
    .map((song) => ({
      song,
      draw:
        edition == null
          ? song.score
          : song.score * (LEAST_LUCK + LUCK_RANGE * chance(edition, song.recordingMbid)),
    }))
    .sort(
      (left, right) =>
        right.draw - left.draw || (left.song.recordingMbid < right.song.recordingMbid ? -1 : 1)
    )
    .map((entry) => entry.song);

  const fill = (half: boolean | null, room: () => number, artistCap: number, seedCap: number) => {
    for (const song of candidates) {
      if (room() <= 0) return;
      if (half !== null && song.familiar !== half) continue;
      if (ids.has(song.recordingMbid)) continue;
      const key = songKey(song);
      if (keys.has(key) || keys.has(loosenFolded(key)) || keys.has(leadOfFolded(key)) || keys.has(byLead(song))) continue;
      if ((artists.get(song.artistMbid) ?? 0) >= artistCap) continue;
      const seed = song.familiar ? '' : seedOf(song);
      if (seed && (seeds.get(seed) ?? 0) >= seedCap) continue;
      picked.push(song);
      take(song);
    }
  };

  const left = () => count - picked.length;
  const halves = [true, false].map((half) => {
    const quota = half ? Math.floor(count / 2) : Math.ceil(count / 2);
    // Its own share, and never more than the list has places left: the other half may have been given some of them.
    return { half, room: () => Math.min(left(), quota - picked.filter((song) => song.familiar === half).length) };
  });
  /*
    Where the pool says how hard each of somebody's artists pulls, the places
    of each half are first shared out between those artists by it — largest
    remainder, so they are whole places and add up — and each fills its own
    from its own songs, in this edition's order. That is what makes the artist
    played most lead to most of the list, where it used only to be stopped
    from leading to more than a quarter of it.

    A new artist is given one song here: one song is how somebody is met. An
    artist already played is given two, and the one played most of all three.
    Whatever this leaves empty — an artist with fewer songs than places — is
    filled below the way it always was.
  */
  if (candidates.some((song) => song.share != null)) {
    for (const { half, room } of halves) {
      const pulls = new Map<string, number>();
      for (const song of [...picked, ...candidates]) {
        if (song.familiar !== half || song.share == null) continue;
        const owner = seedOf(song);
        if (owner) pulls.set(owner, Math.max(pulls.get(owner) ?? 0, song.share));
      }
      const order = [...pulls].sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1));
      const quota = half ? Math.floor(count / 2) : Math.ceil(count / 2);
      const shares = sharePlaces(order.map(([, pull]) => pull), quota);
      const owed = new Map(
        order.map(([owner], index) => [
          owner,
          shares[index]! - picked.filter((song) => song.familiar === half && seedOf(song) === owner).length,
        ])
      );
      const favourite = order[0]?.[0];
      for (const song of candidates) {
        if (room() <= 0) break;
        if (song.familiar !== half || song.share == null || ids.has(song.recordingMbid)) continue;
        const owner = seedOf(song);
        if ((owed.get(owner) ?? 0) <= 0) continue;
        const key = songKey(song);
        if (keys.has(key) || keys.has(loosenFolded(key)) || keys.has(leadOfFolded(key)) || keys.has(byLead(song))) continue;
        const most = !half ? 1 : owner === favourite && foldForMatch(song.artist) === owner ? perArtist + 1 : perArtist;
        if ((artists.get(song.artistMbid) ?? 0) >= most) continue;
        picked.push(song);
        take(song);
        owed.set(owner, owed.get(owner)! - 1);
      }
    }
  }
  for (const { half, room } of halves) {
    fill(half, room, perArtist, perSeed);
    fill(half, room, perArtist, count);
  }
  // Whatever one half could not fill is the other's, with the same manners.
  fill(null, left, perArtist, perSeed);
  fill(null, left, perArtist, count);
  /*
    Only now, with nothing left that keeps to it, is the limit on songs by
    one artist given up. It used to be given up inside each half, before the
    other half had been asked: a half short of artists filled itself with a
    third and a fourth song by the ones it had, while the other half still
    held artists that had not been heard from at all.
  */
  for (const { half, room } of halves) fill(half, room, count, count);
  fill(null, left, count, count);

  const familiar = picked.filter((song) => song.familiar);
  const novel = picked.filter((song) => !song.familiar);
  return Array.from({ length: Math.max(familiar.length, novel.length) }, (_, index) => [
    familiar[index],
    novel[index],
  ])
    .flat()
    .filter((song): song is T => !!song);
}
