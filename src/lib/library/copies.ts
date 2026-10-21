import { foldForMatch } from '../metadata/text.ts';

/**
 * Finding the songs the library holds twice, and which copy to keep.
 *
 * Not the same question as the one `identity` asks. That one is about a file
 * that may have taken the place of another -- one gone, one new -- and is
 * settled by moving a history. This one is about two files that are both on
 * the phone at once: the same recording saved twice, by a computer with
 * yt-dlp and by the app, or by the app twice with a ` (1)` on the second. It
 * is settled by deleting one, which is why the rule here is narrow. A song
 * wrongly called a copy is a song the user is invited to delete, and a copy
 * missed is only a copy still there.
 *
 * Pure, and tested beside it. What a track has to its name -- its listens,
 * its cover -- is read by the screen and handed in.
 */

/** What the rule reads of a track. Every library track has it. */
export type CopyCandidate = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  filename: string | null;
  durationSec: number;
  size?: number | null;
};

/**
 * How far apart two lengths may be, in seconds, and still be one recording.
 *
 * Two saves of the same video differ by a frame or two of padding; a radio
 * edit, an extended mix, a live take or a cover is out by more than this
 * almost always, and is never called a copy by any of the rules below.
 */
export const LENGTH_SLACK = 2;

/** The same for two files of exactly the same size, which are a copy of each other or nothing. */
const SAME_BYTES_SLACK = 1;

/**
 * A file's name as a title: no extension, no `[id]` where yt-dlp puts the
 * video's, no ` (1)` from a second save into the same folder.
 */
export function nameOfFile(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\[[A-Za-z0-9_-]{11}\]\s*$/, '')
    .replace(/\s*\(\d{1,2}\)\s*$/, '');
}

/** A title from a tag, folded, without the video's id that a tag copied from a file name can carry. */
const titleKey = (title: string) => foldForMatch(title.replace(/\s*\[[A-Za-z0-9_-]{11}\]\s*$/, ''));

/**
 * Words that say nothing about which song a file is.
 *
 * A name made only of these and numbers -- `Track 01`, `Audio Track 3`,
 * `Kayıt 12`, `New Recording` -- is the name of a thousand files, and two of
 * them the same length is a coincidence and not a copy.
 */
const PLACEHOLDER = new Set([
  'track', 'audio', 'song', 'untitled', 'unknown', 'new', 'recording', 'record', 'voice', 'sound', 'file',
  'piste', 'pista', 'traccia', 'faixa', 'titel', 'titre', 'trek', 'трек', 'запись',
  'parca', 'sarki', 'kayit', 'ses', 'bilinmeyen', 'isimsiz', 'adsiz', 'yeni',
  'official', 'video', 'music', 'lyrics', 'hd', 'hq', 'mp3',
]);

/** Scripts that write a whole title as one word, where counting words would say nothing. */
const UNSPACED = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}\p{sc=Thai}]/u;

/**
 * Whether a folded file name says enough to tell one song from another.
 *
 * Two words of its own and eight letters between them: `eminem berzerk`
 * does, `01 intro` and `track 07` do not. A name that does not is still
 * grouped when the two files are byte for byte the same size, or when their
 * tags agree; it is only not enough by itself.
 */
export function namesASong(folded: string): boolean {
  const words = folded.split(' ').filter((word) => /\p{L}/u.test(word) && !PLACEHOLDER.has(word));
  const letters = words.join('').replace(/[^\p{L}]/gu, '').length;
  if (UNSPACED.test(folded)) return letters >= 4;
  return words.length >= 2 && letters >= 8;
}

/**
 * Whether two names for the same thing could be the same, folded and without
 * spaces: either unknown, the same, or one inside the other.
 *
 * Inside, because the app names the artist of a download after the channel
 * it came from -- `EminemMusic`, `EminemVEVO` -- where the copy from the
 * computer says `Eminem`; and an album of `Berzerk` against `Berzerk -
 * Single` is the same record. What is ruled out is two names that have
 * nothing to do with each other.
 */
function agree(one: string | null, other: string | null): boolean {
  const a = foldForMatch(one ?? '').replace(/ /g, '');
  const b = foldForMatch(other ?? '').replace(/ /g, '');
  if (!a || !b || a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.includes(short);
}

/** How a pair of tracks came to be put side by side, and so what else has to hold for them to be one. */
type Kind = 'name' | 'tags' | 'bytes';

type Seen = {
  track: CopyCandidate;
  /** The file's name as a title, folded; empty without a name. */
  stem: string;
  /** The tag's title, folded. */
  title: string;
};

/**
 * Whether two tracks put side by side by one of the keys are one recording.
 *
 *  - The same name: the name has to say enough by itself (`namesASong`), and
 *    the artists may not contradict each other. This is the case of the
 *    library that asked for this: `Eminem - Berzerk (Official) (Explicit)
 *    [ab9176Srb5Y].mp3` from the computer beside the same name without the
 *    id, saved by the app.
 *  - The same artist and title in the tags: the albums may not contradict
 *    each other, which keeps the `Intro` of one record from the `Intro` of
 *    the next when they happen to run as long.
 *  - Exactly the same size: and within a second, and with the same name or
 *    the same title, however plain. Bytes alone are not enough, as two
 *    files at a constant bitrate can come out the same size by chance.
 *
 * Every key has already held the lengths to within `LENGTH_SLACK`.
 */
function same(kind: Kind, a: Seen, b: Seen): boolean {
  switch (kind) {
    case 'name':
      return agree(a.track.artist, b.track.artist);
    case 'tags':
      return agree(a.track.album, b.track.album);
    case 'bytes':
      return (
        Math.abs(a.track.durationSec - b.track.durationSec) <= SAME_BYTES_SLACK &&
        ((a.stem !== '' && a.stem === b.stem) || (a.title !== '' && a.title === b.title))
      );
  }
}

/** A pair of tracks as one string, either way round. */
export function pairKey(one: string, other: string): string {
  return one < other ? `${one}:${other}` : `${other}:${one}`;
}

/** Each pair in a group of tracks, as `pairKey` writes it. */
export function pairsOf(ids: readonly string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) pairs.push(pairKey(ids[i]!, ids[j]!));
  }
  return pairs;
}

/** The pairs the user has said are different songs, as the setting holds them. Unreadable is none. */
export function parseApart(words: string | null): Set<string> {
  if (!words) return new Set();
  try {
    const read: unknown = JSON.parse(words);
    return new Set(Array.isArray(read) ? read.filter((pair): pair is string => typeof pair === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Joining tracks into groups, by the index of each in the list. */
function unions(size: number) {
  const parent = Array.from({ length: size }, (_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    // Every one on the way pointed straight at the root, so the next look is one step.
    let at = index;
    while (parent[at] !== root) {
      const next = parent[at]!;
      parent[at] = root;
      at = next;
    }
    return root;
  };
  const join = (one: number, other: number) => {
    const a = find(one);
    const b = find(other);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  return { find, join };
}

/**
 * The songs the library holds more than once, each as the copies of it.
 *
 * Tracks are filed by three keys -- the file's name, the artist and title in
 * its tags, its size in bytes -- and only tracks under one key, within
 * `LENGTH_SLACK` of each other, are ever compared, so ten thousand tracks
 * are a few thousand comparisons and not fifty million. A pair that passes
 * (`same`) is joined, unless the user has said the two are different songs
 * ([apart], as `pairKey` writes it).
 *
 * Joined pairs chain: a third file can join a group through either of the
 * first two. A chain is not allowed to stretch, though. Three files of 200,
 * 201.5 and 203 seconds may each be within two seconds of the next, but the
 * first and the last are not one recording, so every group is cut where its
 * lengths run further than `LENGTH_SLACK` from its shortest, and what is
 * left is joined again by the pairs that fall inside it.
 *
 * A track the media store gives no length is never a copy of anything.
 *
 * Groups come out in the order of their first track in [tracks], and each
 * group's tracks in the order they were given.
 */
export function findCopies<T extends CopyCandidate>(
  tracks: readonly T[],
  apart: ReadonlySet<string> = new Set()
): T[][] {
  const seen: Seen[] = tracks.map((track) => ({
    track,
    stem: track.filename ? foldForMatch(nameOfFile(track.filename)) : '',
    title: titleKey(track.title ?? ''),
  }));

  const filed = new Map<string, number[]>();
  const file = (key: string, index: number) => {
    const held = filed.get(key);
    if (held) held.push(index);
    else filed.set(key, [index]);
  };
  seen.forEach((one, index) => {
    if (!(one.track.durationSec > 0)) return;
    if (one.stem && namesASong(one.stem)) file(`name\u0000${one.stem}`, index);
    const artist = foldForMatch(one.track.artist ?? '');
    if (artist && one.title) file(`tags\u0000${artist}\u0000${one.title}`, index);
    const size = one.track.size;
    if (size != null && size > 0) file(`bytes\u0000${size}`, index);
  });

  /** Every pair that passed, as two indices, the lower first. */
  const links: [number, number][] = [];
  const linked = new Set<string>();
  for (const [key, members] of filed) {
    if (members.length < 2) continue;
    const kind = key.slice(0, key.indexOf('\u0000')) as Kind;
    members.sort((a, b) => tracks[a]!.durationSec - tracks[b]!.durationSec);
    for (let i = 0; i < members.length; i += 1) {
      const a = seen[members[i]!]!;
      for (let j = i + 1; j < members.length; j += 1) {
        const b = seen[members[j]!]!;
        if (b.track.durationSec - a.track.durationSec > LENGTH_SLACK) break;
        if (a.track.id === b.track.id || apart.has(pairKey(a.track.id, b.track.id))) continue;
        if (!same(kind, a, b)) continue;
        const low = Math.min(members[i]!, members[j]!);
        const high = Math.max(members[i]!, members[j]!);
        const known = `${low}:${high}`;
        if (linked.has(known)) continue;
        linked.add(known);
        links.push([low, high]);
      }
    }
  }
  if (links.length === 0) return [];

  const whole = unions(tracks.length);
  for (const [a, b] of links) whole.join(a, b);
  const linksOf = new Map<number, [number, number][]>();
  for (const link of links) {
    const root = whole.find(link[0]);
    const held = linksOf.get(root);
    if (held) held.push(link);
    else linksOf.set(root, [link]);
  }

  const groups: number[][] = [];
  for (const own of linksOf.values()) {
    const members = [...new Set(own.flat())].sort(
      (a, b) => tracks[a]!.durationSec - tracks[b]!.durationSec || a - b
    );
    // Cut where the lengths have run too far from the shortest of the stretch.
    let start = 0;
    for (let at = 1; at <= members.length; at += 1) {
      const ends =
        at === members.length ||
        tracks[members[at]!]!.durationSec - tracks[members[start]!]!.durationSec > LENGTH_SLACK;
      if (!ends) continue;
      const stretch = members.slice(start, at);
      start = at;
      if (stretch.length < 2) continue;
      const inside = new Set(stretch);
      const part = unions(tracks.length);
      for (const [a, b] of own) if (inside.has(a) && inside.has(b)) part.join(a, b);
      const parts = new Map<number, number[]>();
      for (const index of stretch) {
        const root = part.find(index);
        const held = parts.get(root);
        if (held) held.push(index);
        else parts.set(root, [index]);
      }
      for (const group of parts.values()) if (group.length > 1) groups.push(group.sort((a, b) => a - b));
    }
  }
  return groups.sort((a, b) => a[0]! - b[0]!).map((group) => group.map((index) => tracks[index]!));
}

/** What a copy has to its name, for choosing which to keep. */
export type Weighed = {
  id: string;
  /** How many times it has been listened to. */
  listens: number;
  /** Whether a lookup or the user has given it details the file does not have. */
  described: boolean;
  /** Whether the app holds a cover for it. */
  cover: boolean;
  /** Whether it sits inside the library folder rather than somewhere else. */
  inLibrary: boolean;
  durationSec: number;
  size: number | null;
  /** When the phone first saw it, in milliseconds. */
  addedAt: number | null;
};

/** Why a copy is the one suggested: the first thing it was found to have that the next best did not. */
export type KeepReason = 'listens' | 'described' | 'folder' | 'larger' | 'older' | 'alike';

/** How much more one file has to hold per second to be called the better one, as a share of the other. */
const LARGER_BY = 0.02;

const bytesPerSecond = (copy: Weighed) =>
  copy.size != null && copy.size > 0 && copy.durationSec > 0 ? copy.size / copy.durationSec : null;

/**
 * Which copy is best kept, in order: negative when [a] is.
 *
 *  - the one listened to most, whose history is the user's own;
 *  - then the one with details or a cover, so that nothing has to be looked
 *    up again (the history moves either way; this is only less to move);
 *  - then the one inside the library folder rather than outside it;
 *  - then the one with more to it per second, which at the same length is a
 *    higher bitrate -- and only by a clear margin, since a tag or a cover
 *    written into one file makes it a little larger without making it sound
 *    any better;
 *  - then the older, which was there first and is the one any list made
 *    before the second save was made with.
 */
const RULES: [KeepReason, (a: Weighed, b: Weighed) => number][] = [
  ['listens', (a, b) => b.listens - a.listens],
  ['described', (a, b) => Number(b.described) + Number(b.cover) - (Number(a.described) + Number(a.cover))],
  ['folder', (a, b) => Number(b.inLibrary) - Number(a.inLibrary)],
  [
    'larger',
    (a, b) => {
      const one = bytesPerSecond(a);
      const other = bytesPerSecond(b);
      if (one == null || other == null) return 0;
      if (Math.abs(one - other) <= Math.max(one, other) * LARGER_BY) return 0;
      return other - one;
    },
  ],
  ['older', (a, b) => (a.addedAt == null || b.addedAt == null ? 0 : a.addedAt - b.addedAt)],
];

/**
 * The copy to keep of one song, and why.
 *
 * Where nothing tells them apart the lower media store id is kept, which is
 * usually the file the phone saw first, so the suggestion is the same every
 * time the screen is opened.
 */
export function chooseKeep(copies: readonly Weighed[]): { keep: string; reason: KeepReason } {
  const order = (a: Weighed, b: Weighed) => {
    for (const [, rule] of RULES) {
      const said = rule(a, b);
      if (said !== 0) return said;
    }
    return Number(a.id) - Number(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  };
  const ranked = [...copies].sort(order);
  const best = ranked[0]!;
  const next = ranked[1];
  const reason = next ? (RULES.find(([, rule]) => rule(best, next) < 0)?.[0] ?? 'alike') : 'alike';
  return { keep: best.id, reason };
}
