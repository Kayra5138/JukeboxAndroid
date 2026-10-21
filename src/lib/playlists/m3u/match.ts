import { foldForMatch } from '../../metadata/text.ts';
import type { M3uEntry } from './parse.ts';
import { locate, placeOfAbsolute, type Place } from './paths.ts';

/**
 * Finding the library's track for each entry of a playlist.
 *
 * A playlist names files, and the files it names are hardly ever where it
 * says: it was written on a PC with the music on drive D, or on the last
 * phone with the music on a card, or by a player that wrote paths relative to
 * a folder nobody remembers. So the path is evidence, not an address, and
 * each entry is tried against the library from the surest evidence to the
 * weakest, stopping at the first that points at exactly one track:
 *
 *  1. The media store id, for an entry written as one.
 *  2. The same path on the phone: the volume and the path from its top, as
 *     the entry gives them or as they come out of the playlist's own folder
 *     for a relative entry. Nothing moved.
 *  3. The longest shared end: the file name and as many folders above it as
 *     agree, without regard to case. `D:\Music\Nirvana\Nevermind\Lithium.mp3`
 *     and `Music/Nirvana/Nevermind/Lithium.mp3` share four steps, and that is
 *     the song, whatever is above them on either side. At least one folder
 *     has to agree as well as the name, and only one track may have the
 *     longest such end.
 *  4. The file name alone, where only one track in the library has it --
 *     and where the length `#EXTINF` gives does not say otherwise.
 *  5. The artist and title `#EXTINF` gives, against the library's tags, with
 *     the lengths within a few seconds where both are known; one track only.
 *     Where an earlier step found several tracks and could not choose, those
 *     are asked first.
 *  6. The same name with another ending, for a library that was converted
 *     from FLAC to MP3 on the way to the phone; one track only, and not
 *     against the length.
 *
 * Anything that comes to two or more tracks at every step is left out and
 * said to be, rather than guessed at. A playlist with a wrong song in it is
 * worse than one with a gap: the gap is listed, and the wrong song looks
 * right until it plays.
 */

/** As much of a library track as is needed to recognise one. */
export type ListTrack = {
  id: string;
  filename: string | null;
  /** The media store's relative path: `Music/Nirvana/Nevermind/`. */
  folder: string | null;
  title: string | null;
  artist: string | null;
  durationSec: number;
  /** The whole path on the phone, where the native side could say it; it is what tells two volumes apart. */
  path?: string | null;
  /**
   * Other names the same track goes by: the file's own tags, where the app
   * shows a corrected title. The player that wrote the playlist read the
   * file, not this app's corrections.
   */
  aliases?: readonly { title: string | null; artist: string | null }[];
};

export type Found = 'id' | 'path' | 'tail' | 'name' | 'tags' | 'format';
export type Missed = 'web' | 'notFound' | 'ambiguous';

export type EntryResult = {
  entry: M3uEntry;
  trackId: string | null;
  /** How it was found, or why it was not. */
  how: Found | Missed;
};

/** How far apart two lengths may be and still be one recording, in seconds. `#EXTINF` is often a whole number rounded either way. */
const SAME_LENGTH_SEC = 3;

type Held = {
  track: ListTrack;
  /** Lower-cased steps of the whole path from the top of the volume. */
  steps: string[];
  volume: string | null;
};

export type LibraryIndex = {
  byId: Map<string, Held>;
  byPath: Map<string, Held[]>;
  byName: Map<string, Held[]>;
  byStem: Map<string, Held[]>;
  bySong: Map<string, Held[]>;
  byTitle: Map<string, Held[]>;
};

const lower = (value: string) => value.normalize('NFC').toLowerCase();
const stem = (name: string) => name.replace(/\.[^.]+$/, '');

function add(index: Map<string, Held[]>, key: string, held: Held): void {
  const list = index.get(key);
  if (list) list.push(held);
  else index.set(key, [held]);
}

/** The library, indexed once for however many playlists and readings of them are matched against it. */
export function indexLibrary(library: readonly ListTrack[]): LibraryIndex {
  const index: LibraryIndex = {
    byId: new Map(),
    byPath: new Map(),
    byName: new Map(),
    byStem: new Map(),
    bySong: new Map(),
    byTitle: new Map(),
  };
  for (const track of library) {
    const place = track.path ? placeOfAbsolute(track.path) : null;
    const relative = [track.folder ?? '', track.filename ?? '']
      .join('/')
      .split('/')
      .filter((step) => step !== '');
    const steps = (place && place.path ? place.path.split('/') : relative).map(lower);
    const held: Held = { track, steps, volume: place?.volume ?? null };
    index.byId.set(track.id, held);
    const name = steps[steps.length - 1];
    if (name) {
      add(index.byPath, steps.join('/'), held);
      add(index.byName, name, held);
      add(index.byStem, stem(name), held);
    }
    // Each name once per track, so a track known by the same name both ways
    // is one candidate and not two that cannot be chosen between.
    const songs = new Set<string>();
    const titles = new Set<string>();
    for (const name of [{ title: track.title, artist: track.artist }, ...(track.aliases ?? [])]) {
      const title = foldForMatch(name.title ?? '');
      if (!title) continue;
      songs.add(`${title}\u0000${foldForMatch(name.artist ?? '')}`);
      titles.add(title);
    }
    for (const song of songs) add(index.bySong, song, held);
    for (const title of titles) add(index.byTitle, title, held);
  }
  return index;
}

/** How many steps two paths share at their ends. */
function sharedEnd(ours: readonly string[], theirs: readonly string[]): number {
  let shared = 0;
  while (
    shared < ours.length &&
    shared < theirs.length &&
    ours[ours.length - 1 - shared] === theirs[theirs.length - 1 - shared]
  ) {
    shared += 1;
  }
  return shared;
}

/** Whether a track's length is not against the entry's. Unknown on either side is not against it. */
function lengthAgrees(entry: M3uEntry, held: Held): boolean {
  if (entry.durationSec == null || !(held.track.durationSec > 0)) return true;
  return Math.abs(entry.durationSec - held.track.durationSec) <= SAME_LENGTH_SEC;
}

/** The ones among [candidates] with the longest shared end, and how long it is. */
function longestEnds(candidates: readonly Held[], steps: readonly string[]): { best: number; top: Held[] } {
  let best = 0;
  let top: Held[] = [];
  for (const held of candidates) {
    const shared = sharedEnd(held.steps, steps);
    if (shared > best) {
      best = shared;
      top = [held];
    } else if (shared === best) top.push(held);
  }
  return { best, top };
}

/** What `#EXTINF` says, as the ways it can be looked up by tags. */
function byTags(entry: M3uEntry, index: LibraryIndex): Held[][] {
  const asked: Held[][] = [];
  const title = foldForMatch(entry.title ?? '');
  if (title && entry.artist) {
    asked.push(index.bySong.get(`${title}\u0000${foldForMatch(entry.artist)}`) ?? []);
  }
  // The whole label as a title, for one that had no artist in it, or a dash
  // in the title that was taken for the join.
  const whole = foldForMatch(entry.label ?? '');
  if (whole) asked.push(index.byTitle.get(whole) ?? []);
  if (title && !entry.artist) asked.push(index.byTitle.get(title) ?? []);
  return asked.map((list) => list.filter((held) => lengthAgrees(entry, held)));
}

function matchOne(entry: M3uEntry, index: LibraryIndex, folder: Place | null): Omit<EntryResult, 'entry'> {
  const location = locate(entry.location, folder);
  if (location.kind === 'web') return { trackId: null, how: 'web' };
  if (location.kind === 'media') {
    const held = index.byId.get(location.id);
    return held ? { trackId: held.track.id, how: 'id' } : { trackId: null, how: 'notFound' };
  }

  const steps = location.steps.map(lower);
  const name = steps[steps.length - 1];
  if (!name) return { trackId: null, how: 'notFound' };
  /** Tracks an earlier step could not choose between. */
  let undecided: Held[] = [];

  if (location.place) {
    const key = location.place.path.split('/').map(lower).join('/');
    let same = index.byPath.get(key) ?? [];
    const volume = location.place.volume;
    if (same.length > 1 && volume) same = same.filter((held) => held.volume == null || held.volume === volume);
    if (same.length === 1) return { trackId: same[0]!.track.id, how: 'path' };
    if (same.length > 1) undecided = same;
  }

  const named = index.byName.get(name) ?? [];
  const { best, top } = longestEnds(named, steps);
  if (best >= 2 && top.length === 1) return { trackId: top[0]!.track.id, how: 'tail' };
  if (named.length === 1 && lengthAgrees(entry, named[0]!)) return { trackId: named[0]!.track.id, how: 'name' };
  if (undecided.length === 0 && top.length > 1) undecided = top;

  // Several files fit the path equally well; the length may tell them apart.
  if (undecided.length > 1 && entry.durationSec != null) {
    const timed = undecided.filter((held) => held.track.durationSec > 0 && lengthAgrees(entry, held));
    if (timed.length === 1) return { trackId: timed[0]!.track.id, how: 'tail' };
  }

  for (const list of byTags(entry, index)) {
    if (undecided.length > 0) {
      const among = list.filter((held) => undecided.includes(held));
      if (among.length === 1) return { trackId: among[0]!.track.id, how: 'tags' };
    }
    if (list.length === 1) return { trackId: list[0]!.track.id, how: 'tags' };
  }

  const converted = (index.byStem.get(stem(name)) ?? []).filter((held) => held.steps[held.steps.length - 1] !== name);
  if (converted.length > 0) {
    const ends = longestEnds(
      converted.map((held) => ({ ...held, steps: [...held.steps.slice(0, -1), stem(name)] })),
      [...steps.slice(0, -1), stem(name)]
    );
    if (ends.top.length === 1) return { trackId: ends.top[0]!.track.id, how: 'format' };
  }

  return { trackId: null, how: named.length > 1 || undecided.length > 1 ? 'ambiguous' : 'notFound' };
}

/** Each entry with the track it was found to be, in the playlist's order. */
export function matchEntries(entries: readonly M3uEntry[], index: LibraryIndex, folder: Place | null): EntryResult[] {
  return entries.map((entry) => ({ entry, ...matchOne(entry, index, folder) }));
}

/** How many of [results] were found, for choosing between readings of one file. */
export function foundCount(results: readonly EntryResult[]): number {
  return results.filter((result) => result.trackId != null).length;
}
