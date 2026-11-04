import type { Range } from '../ui/range.ts';

/**
 * Which songs could go to make room on the phone, and which of the ones the
 * app downloaded itself are due to go by themselves, for somebody who has
 * asked for that.
 *
 * Pure, and tested beside it: the screen and the daily task read the library,
 * the history and the lists, and hand them in. Tapes are left out by whoever
 * calls, before anything comes here; podcasts have their own cleaning up.
 */

/** What the rules read of a track. Every library track has it. */
export type SpaceTrack = {
  id: string;
  /** In bytes, or null where the media store will not say. */
  size?: number | null;
  /** When the phone first saw it, in milliseconds. */
  addedAt: number | null;
};

/** What the history says of one track. A track never played or skipped has none at all. */
export type Listening = {
  /** Listens long enough to count. */
  plays: number;
  /** Of those, the ones heard to the end. */
  completed: number;
  /** Times next was pressed on it early on, which is what says it is not wanted: see {@link skipKind}. */
  skips: number;
  /** Times next was pressed on it once most of it had been heard, which say no such thing and are counted with the listens to the end. */
  lateSkips: number;
  /** How long it was heard before those early skips, on average, in seconds; null where there were none. */
  skippedAfter: number | null;
  /** When it was last listened to, in milliseconds; null for never. */
  lastPlayedAt: number | null;
};

/** Why a song is offered, which is also the group it is shown in. In the order the groups are shown. */
export type Reason = 'copy' | 'skipped' | 'neverPlayed' | 'forgotten' | 'large';

export const REASONS: readonly Reason[] = ['copy', 'skipped', 'neverPlayed', 'forgotten', 'large'];

/** One song offered, with what the screen says of it. */
export type Candidate = {
  id: string;
  reason: Reason;
  /** What it would free, in bytes; nought where the size is not known. */
  bytes: number;
  listening: Listening;
  addedAt: number | null;
  /** For a copy, the copy of the same song that stays. */
  keep?: string;
};

export type Group = {
  reason: Reason;
  candidates: Candidate[];
  /** What all of the group would free, in bytes. */
  bytes: number;
};

/** A song the library holds more than once: the copy to keep, and every copy, that one included. */
export type CopyGroup = { keep: string; ids: readonly string[] };

const NONE: Listening = { plays: 0, completed: 0, skips: 0, lateSkips: 0, skippedAfter: null, lastPlayedAt: null };

/** How long a song may go unheard before it is offered, in months, unless the caller says otherwise. */
export const LONG_AGO_MONTHS = 6;

/** Below this many skips, pressing next is a mood rather than an opinion. */
export const SKIPPED_AT_LEAST = 3;

/** How many times as often a song has to be skipped as heard to the end to be called skipped often. */
export const SKIPPED_TIMES_FINISHED = 3;

/** Next pressed before this many seconds is passing a song on the way to another, not hearing it and turning it down. */
export const FLICKED_UNDER_SECONDS = 5;

/** A skip is early before this share of the song has been heard... */
export const EARLY_SHARE = 1 / 3;

/** ...and in any case before this many seconds, however long the song. */
export const EARLY_UNDER_SECONDS = 90;

/** Where the length of the song is not known, a skip is early before this many seconds. */
export const EARLY_UNKNOWN_LENGTH_SECONDS = 60;

/**
 * What a skip says, by how long the song was heard before it: passed on the
 * way to another song, turned down early on, or let go once most of it had
 * been heard. [durationSec] of nought or less, or null, is a length not known.
 */
export function skipKind(secondsPlayed: number, durationSec: number | null): 'flicked' | 'early' | 'late' {
  if (secondsPlayed < FLICKED_UNDER_SECONDS) return 'flicked';
  const early = durationSec != null && durationSec > 0 ? Math.min(EARLY_UNDER_SECONDS, durationSec * EARLY_SHARE) : EARLY_UNKNOWN_LENGTH_SECONDS;
  return secondsPlayed < early ? 'early' : 'late';
}

/** One skip as the history keeps it. */
export type SkipHeard = { trackId: string; secondsPlayed: number; durationSec: number | null };

/**
 * What [skips] say of each track: its early skips with how long it was heard
 * before them, and its late ones. Skips in passing are left out, and a track
 * with nothing else is left out with them.
 */
export function tallySkips(skips: Iterable<SkipHeard>): Map<string, Pick<Listening, 'skips' | 'lateSkips' | 'skippedAfter'>> {
  const tally = new Map<string, { skips: number; lateSkips: number; seconds: number }>();
  for (const skip of skips) {
    const kind = skipKind(skip.secondsPlayed, skip.durationSec);
    if (kind === 'flicked') continue;
    const held = tally.get(skip.trackId) ?? { skips: 0, lateSkips: 0, seconds: 0 };
    if (kind === 'early') {
      held.skips += 1;
      held.seconds += skip.secondsPlayed;
    } else held.lateSkips += 1;
    tally.set(skip.trackId, held);
  }
  return new Map(
    [...tally].map(([id, held]) => [id, { skips: held.skips, lateSkips: held.lateSkips, skippedAfter: held.skips > 0 ? held.seconds / held.skips : null }])
  );
}

/** How many of the largest files are offered, of those not already offered for another reason. */
export const LARGEST_COUNT = 20;

/** Below this a file is not called large, however few files are larger: 15 MB. */
export const LARGE_BYTES = 15 * 1024 * 1024;

/**
 * [months] before [now], by the calendar rather than by arithmetic: six months
 * before the 31st of August is the end of February, not some day in March.
 */
export function monthsBefore(now: number, months: number): number {
  const date = new Date(now);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return +date;
}

/**
 * Whether a song is skipped early far more than it is heard: three early
 * skips at the least, and at least three for every time it was heard to the
 * end or skipped only once most of it had been heard.
 */
export function skippedOften(listening: Listening): boolean {
  return (
    listening.skips >= SKIPPED_AT_LEAST &&
    listening.skips >= SKIPPED_TIMES_FINISHED * (listening.completed + listening.lateSkips)
  );
}

const bytesOf = (track: SpaceTrack) => (track.size != null && track.size > 0 ? track.size : 0);

/**
 * The songs that could go, in groups, the largest files first in each.
 *
 * A song is in one group only, the first that fits of: a second copy of a
 * song kept elsewhere, skipped often, never played and on the phone more than
 * [months] months, played before but not for more than [months] months, and
 * last the largest files left over. A group with nothing in it is left out.
 */
export function freeUpCandidates(
  tracks: readonly SpaceTrack[],
  listening: ReadonlyMap<string, Listening>,
  copies: readonly CopyGroup[],
  now: number,
  months = LONG_AGO_MONTHS
): Group[] {
  const before = monthsBefore(now, months);
  const present = new Set(tracks.map((track) => track.id));
  // The copies to offer, each with the one that stays, which has to be on the phone itself.
  const copyOf = new Map<string, string>();
  for (const group of copies) {
    if (!present.has(group.keep)) continue;
    for (const id of group.ids) if (id !== group.keep && present.has(id)) copyOf.set(id, group.keep);
  }

  const groups = new Map<Reason, Candidate[]>(REASONS.map((reason) => [reason, []]));
  const rest: Candidate[] = [];
  for (const track of tracks) {
    const heard = listening.get(track.id) ?? NONE;
    const candidate: Candidate = { id: track.id, reason: 'large', bytes: bytesOf(track), listening: heard, addedAt: track.addedAt };
    const keep = copyOf.get(track.id);
    if (keep != null) candidate.reason = 'copy';
    else if (skippedOften(heard)) candidate.reason = 'skipped';
    else if (heard.plays === 0 && track.addedAt != null && track.addedAt < before) candidate.reason = 'neverPlayed';
    else if (heard.plays > 0 && heard.lastPlayedAt != null && heard.lastPlayedAt < before) candidate.reason = 'forgotten';
    else {
      if (candidate.bytes >= LARGE_BYTES) rest.push(candidate);
      continue;
    }
    if (keep != null) candidate.keep = keep;
    groups.get(candidate.reason)!.push(candidate);
  }
  groups.set('large', rest.sort(largestFirst).slice(0, LARGEST_COUNT));

  return REASONS.flatMap((reason) => {
    const candidates = groups.get(reason)!.sort(largestFirst);
    if (candidates.length === 0) return [];
    return [{ reason, candidates, bytes: candidates.reduce((sum, candidate) => sum + candidate.bytes, 0) }];
  });
}

/** Larger first; of two the same size, the one with the lower id, so the order is the same every time. */
function largestFirst(a: Candidate, b: Candidate): number {
  return b.bytes - a.bytes || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** What the songs with these ids would free between them, in bytes, each counted once. */
export function bytesFreed(groups: readonly Group[], ids: ReadonlySet<string>): number {
  const counted = new Set<string>();
  let sum = 0;
  for (const group of groups) {
    for (const candidate of group.candidates) {
      if (!ids.has(candidate.id) || counted.has(candidate.id)) continue;
      counted.add(candidate.id);
      sum += candidate.bytes;
    }
  }
  return sum;
}

/** The lists a song is in, as the automatic deleting asks: Favorites, and how many others. */
export type Membership = { favorite: boolean; lists: number };

/** How the automatic deleting is set. */
export type AutoSettings = {
  /** How many months a song has to go unheard. */
  months: number;
  /** Whether a song in Favorites may go as well. */
  favorites: boolean;
  /** Whether a song in any other list may go as well. */
  lists: boolean;
};

/** How many months a song may go unheard before it is deleted by itself: one to two years. */
export const AUTO_MONTHS_RANGE: Range = { min: 1, max: 24 };

/**
 * The songs due to be deleted by themselves.
 *
 * Only files the app downloaded itself, which are [own]; never [playing];
 * never one in Favorites or another list unless the settings say it may go
 * too. Due when its last listen, or where it was never listened to the day
 * the phone first saw it, is more than [settings.months] months before [now].
 * A song of which neither is known is never due.
 */
export function dueForDeletion<T extends SpaceTrack>(
  tracks: readonly T[],
  listening: ReadonlyMap<string, Listening>,
  own: ReadonlySet<string>,
  membership: ReadonlyMap<string, Membership>,
  settings: AutoSettings,
  playing: string | null,
  now: number
): T[] {
  const before = monthsBefore(now, settings.months);
  return tracks.filter((track) => {
    if (!own.has(track.id) || track.id === playing) return false;
    const member = membership.get(track.id);
    if (member?.favorite && !settings.favorites) return false;
    if (member && member.lists > 0 && !settings.lists) return false;
    const heard = listening.get(track.id);
    const last = heard && heard.plays > 0 ? heard.lastPlayedAt : track.addedAt;
    return last != null && last < before;
  });
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Whether the automatic deleting is due to look again, it having last looked
 * at [last]: a day after, or at once where it never has. A time ahead of
 * [now] is a clock put back, and is not waited for.
 */
export function dueToLook(last: number | null, now: number): boolean {
  return last == null || !Number.isFinite(last) || last > now || now - last >= DAY;
}
