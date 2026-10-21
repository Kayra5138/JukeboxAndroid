import { compareNames } from '../media/sort.ts';
import type { Track } from '../types.ts';

/**
 * What the library leaves out of what is under its folder: folders somebody
 * has switched off, and files too short to be music.
 *
 * Under `Music` there is usually more than music. Voice notes, call
 * recordings, ringtones and notification sounds are put there by other apps,
 * and choosing a narrower library folder only helps where the music happens
 * to sit in one folder of its own. So the library folder stays the wide
 * question, and these narrow it.
 *
 * Leaving out is only ever not showing. Nothing here deletes a file or a
 * row: a track left out keeps its plays, its tags and its places in lists,
 * and is back with all of them the moment it is let in again. That is why
 * this is applied where the library is read and not anywhere it is stored.
 *
 * Nothing here reads the settings or the device, so that what is left out
 * can be tested; `media/library.ts` puts the settings table behind it, and
 * the Kotlin side has its own copy of the same two rules for the car
 * (`auto/LibraryHiding.kt`).
 */

/**
 * A folder as one spelling, whatever was done to its slashes.
 *
 * The media store writes `Music/WhatsApp/` with a slash at the end and the
 * library folder is kept as `Music` without one; a path typed or carried
 * from elsewhere may have one at the front or two in the middle. None of that
 * makes it another folder.
 */
export function folderPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * The same, as it is compared. Case is not something the media store keeps
 * to in a path, and the query that reads the library is not careful about it
 * either, so `Music/Voice Notes` and `music/voice notes` are one folder here.
 */
function compared(path: string): string {
  return folderPath(path).toLowerCase();
}

/**
 * Whether [path] is [folder] or somewhere inside it.
 *
 * By whole steps of the path, so that leaving out `Music/Rec` does not take
 * `Music/Records` with it. An empty folder is no folder and holds nothing:
 * it would otherwise hold everything.
 */
export function isUnder(path: string | null | undefined, folder: string): boolean {
  const theirs = compared(folder);
  if (!theirs || path == null) return false;
  const ours = compared(path);
  return ours === theirs || ours.startsWith(`${theirs}/`);
}

/**
 * The folders left out that mean anything under [root]: those strictly
 * inside it, once each, and none inside another that is already left out.
 *
 * What is kept is every folder somebody switched off, and is kept across a
 * change of library folder. A folder outside the new one does not matter
 * while it is outside, and a folder the library folder is now *inside* must
 * not count either: the library would be empty, from a switch on a screen
 * that no longer lists it. One inside another that is left out is kept for
 * when the outer one is let back in, but there is nothing for it to add now,
 * and it is not counted as a second folder left out.
 */
export function leftOutUnder(leftOut: readonly string[], root: string): string[] {
  const base = folderPath(root);
  const inside = leftOut
    .map(folderPath)
    .filter((folder) => folder !== '' && (base === '' || (isUnder(folder, base) && compared(folder) !== compared(base))));
  const outermost: string[] = [];
  for (const folder of [...inside].sort((left, right) => left.length - right.length)) {
    if (!outermost.some((outer) => isUnder(folder, outer))) outermost.push(folder);
  }
  return outermost;
}

/** The folders left out, as the setting's words. Anything that is not a list of paths reads as none. */
export function parseLeftOut(words: string | null): string[] {
  if (!words) return [];
  try {
    const value: unknown = JSON.parse(words);
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string' && folderPath(entry) !== '');
  } catch {
    return [];
  }
}

/**
 * Whether [path] is inside a folder in [leftOut] other than itself: switched
 * off with that folder, whatever its own switch says.
 */
export function leftOutWith(leftOut: readonly string[], path: string): boolean {
  return leftOut.some((folder) => isUnder(path, folder) && compared(folder) !== compared(path));
}

/** Whether [path] itself, by any spelling, is in [leftOut]. */
export function isLeftOut(leftOut: readonly string[], path: string): boolean {
  return leftOut.some((folder) => compared(folder) === compared(path));
}

/**
 * [leftOut] with [folder] switched in or out. A copy.
 *
 * Switching in takes out only that folder, by any spelling of it; the
 * folders inside it that were switched off on their own stay off, which is
 * how they were left.
 */
export function withLeftOut(leftOut: readonly string[], folder: string, out: boolean): string[] {
  const rest = leftOut.filter((entry) => compared(entry) !== compared(folder));
  return out ? [...rest, folderPath(folder)] : rest;
}

/**
 * How short a file may be before it is left out, in seconds, and nought for
 * not at all.
 *
 *  - 10 catches the notification sounds and the beeps games leave behind,
 *    and nothing a record would call a track: the shortest interludes run to
 *    a quarter of a minute.
 *  - 30 catches most voice notes and ringtones too, at the price of the odd
 *    interlude or skit.
 *  - 60 is for a library with a great many voice notes in it, where a
 *    minute-long song is rarer than a minute-long message.
 */
export const SHORTEST_CHOICES = [0, 10, 30, 60] as const;
export type Shortest = (typeof SHORTEST_CHOICES)[number];

/** The setting's words as a choice, or null where nothing has been decided or what is kept is not one. */
export function parseShortest(words: string | null): Shortest | null {
  if (words == null || words === '') return null;
  const value = Number(words);
  return SHORTEST_CHOICES.find((choice) => choice === value) ?? null;
}

/**
 * Whether a file of [durationSec] is too short for the library.
 *
 * A length of nought or less is a length the media store did not know, which
 * it says of files it could not read to the end; those are let in rather
 * than taken for short. A file that is really empty plays as nothing either
 * way, and a song left out because its length was not known would be a song
 * that has gone for no reason anybody could see.
 */
export function isShort(durationSec: number, shortest: number): boolean {
  return shortest > 0 && durationSec > 0 && durationSec < shortest;
}

export type HidingSettings = {
  root: string;
  leftOut: readonly string[];
  shortest: number;
};

export type Hiding = {
  /** The rule in a word: the same key, the same tracks shown. */
  key: string;
  /** Whether [track] is in the library. */
  shows(track: Pick<Track, 'folder' | 'durationSec'>): boolean;
};

/**
 * The rule the settings make, or null where they leave nothing out — which
 * the library reads as "show the device's list as it is", the very list and
 * not a copy of it.
 */
export function hidingRule(settings: HidingSettings): Hiding | null {
  const folders = leftOutUnder(settings.leftOut, settings.root);
  const shortest = settings.shortest > 0 ? settings.shortest : 0;
  if (folders.length === 0 && shortest === 0) return null;
  return {
    key: JSON.stringify([shortest, folders.map(compared).sort()]),
    shows: (track) =>
      !isShort(track.durationSec, shortest) && !folders.some((folder) => isUnder(track.folder, folder)),
  };
}

/**
 * [tracks] without what [hiding] leaves out: the very list when nothing is
 * left out, so that whatever is worked out from it can tell it has not
 * changed.
 */
export function shownTracks<T extends Pick<Track, 'folder' | 'durationSec'>>(
  tracks: T[],
  hiding: Hiding | null
): T[] {
  if (!hiding) return tracks;
  const shown = tracks.filter(hiding.shows);
  return shown.length === tracks.length ? tracks : shown;
}

/** A folder under the library folder, as the screen that leaves folders out lists it. */
export type FolderRow = {
  /** The whole path, as it is kept when the folder is left out. */
  path: string;
  /** The last step of it: what the folder is called. */
  name: string;
  /** The path as seen from the library folder, which is how a screen reader says which one it is. */
  relative: string;
  /** How many steps below the library folder: one for a folder directly in it. */
  depth: number;
  /** The tracks in it and in every folder inside it. */
  trackCount: number;
};

/**
 * Every folder under [root] that holds music, at whatever depth, with the
 * folders between it and the root put in although the media store does not
 * name them, and each counted with everything beneath it.
 *
 * The media store counts the files directly in a folder, and only names a
 * folder that has some. But leaving a folder out leaves out everything inside
 * it, so the count beside its switch has to be the whole of what goes; and
 * `Music/WhatsApp`, holding nothing but the folder of voice notes inside it,
 * is exactly the folder somebody wants to switch off.
 *
 * In the order a file manager would list them, a step at a time, so that a
 * folder is followed by what is in it. The root itself is not a row: leaving
 * it out would leave nothing.
 */
export function folderRows(folders: readonly { path: string; trackCount: number }[], root: string): FolderRow[] {
  const base = folderPath(root);
  const baseSteps = base ? base.split('/').length : 0;
  /** By compared path: the spelling first seen, and the count. */
  const rows = new Map<string, FolderRow>();

  for (const folder of folders) {
    const path = folderPath(folder.path);
    if (!path || (base && !isUnder(path, base))) continue;
    const steps = path.split('/');
    // Every folder from the one directly under the root down to this one.
    for (let depth = baseSteps + 1; depth <= steps.length; depth += 1) {
      const step = steps.slice(0, depth).join('/');
      const key = step.toLowerCase();
      const row = rows.get(key);
      if (row) row.trackCount += folder.trackCount;
      else {
        rows.set(key, {
          path: step,
          name: steps[depth - 1]!,
          relative: steps.slice(baseSteps, depth).join('/'),
          depth: depth - baseSteps,
          trackCount: folder.trackCount,
        });
      }
    }
  }

  return [...rows.values()].sort((left, right) => comparePaths(left.path, right.path));
}

function comparePaths(left: string, right: string): number {
  const ours = left.split('/');
  const theirs = right.split('/');
  const shared = Math.min(ours.length, theirs.length);
  for (let at = 0; at < shared; at += 1) {
    const order = compareNames(ours[at]!, theirs[at]!);
    if (order !== 0) return order;
  }
  return ours.length - theirs.length || (left < right ? -1 : left > right ? 1 : 0);
}
