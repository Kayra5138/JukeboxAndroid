import type { Track } from '../types.ts';

/**
 * The library as it was last read off the device, written down so that the
 * next start of the app has something to show before it has asked.
 *
 * Only what the media store said, and none of what the app has learned about
 * the tracks since: that is in the database already, is read from there every
 * time, and a second copy of it here would be one that could disagree.
 *
 * Bumped whenever the shape below changes, or a track gains a field. What was
 * written under another number is not converted. It is a copy of something the
 * device will say again within the second, so it is dropped and made afresh.
 */
export const CACHE_VERSION = 1;

/**
 * The fields of a track, in the order they are written.
 *
 * A row is written as a bare list of its values and the names are said once,
 * here: ten thousand tracks each spelling out `durationSec` is most of a file
 * that has to be read and taken apart before the first frame.
 */
const FIELDS = [
  'id',
  'uri',
  'title',
  'artist',
  'album',
  'artworkUri',
  'durationSec',
  'trackNumber',
  'filename',
  'folder',
  'addedAt',
  'size',
] as const satisfies readonly (keyof Track)[];

type Kept = { v: number; root: string; fields: readonly string[]; rows: unknown[][] };

const text = (value: unknown): value is string => typeof value === 'string';
const textOrNone = (value: unknown): value is string | null => value === null || text(value);
const numberOrNone = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

/** What each field has to be for a row to be believed. */
const CHECKS: Record<(typeof FIELDS)[number], (value: unknown) => boolean> = {
  id: (value) => text(value) && value !== '',
  uri: text,
  title: text,
  artist: textOrNone,
  album: textOrNone,
  artworkUri: textOrNone,
  durationSec: (value) => typeof value === 'number' && Number.isFinite(value),
  trackNumber: numberOrNone,
  filename: textOrNone,
  folder: textOrNone,
  addedAt: numberOrNone,
  size: numberOrNone,
};

/** The library under [root], as words to be kept. */
export function encodeLibrary(root: string, tracks: readonly Track[]): string {
  const kept: Kept = {
    v: CACHE_VERSION,
    root,
    fields: FIELDS,
    // An absent field is written as nothing, which is what it is read back as:
    // JSON has no way of saying "not there" inside a list.
    rows: tracks.map((track) => FIELDS.map((field) => track[field] ?? null)),
  };
  return JSON.stringify(kept);
}

/**
 * The tracks written down for [root], or null where there is nothing to trust.
 *
 * Null for words that are not what {@link encodeLibrary} writes: cut short,
 * written by another version, naming other fields. Null for a library read
 * from another folder, which is a true account of the wrong thing. And null if
 * any one row is not a track, rather than the rest of them: whatever spoiled
 * one may have spoiled the others less visibly, and the whole of it is about
 * to be read again from the device anyway.
 *
 * Never throws. Whoever calls is on the way to drawing the first screen.
 */
export function decodeLibrary(words: string | null | undefined, root: string): Track[] | null {
  if (!words) return null;
  try {
    const kept = JSON.parse(words) as Partial<Kept> | null;
    if (!kept || typeof kept !== 'object') return null;
    if (kept.v !== CACHE_VERSION || kept.root !== root) return null;
    if (!Array.isArray(kept.fields) || !Array.isArray(kept.rows)) return null;
    if (kept.fields.length !== FIELDS.length) return null;
    if (FIELDS.some((field, at) => kept.fields?.[at] !== field)) return null;

    const tracks: Track[] = [];
    const seen = new Set<string>();
    for (const row of kept.rows) {
      if (!Array.isArray(row) || row.length !== FIELDS.length) return null;
      const track: Record<string, unknown> = {};
      for (let at = 0; at < FIELDS.length; at += 1) {
        const field = FIELDS[at];
        if (!CHECKS[field](row[at])) return null;
        track[field] = row[at];
      }
      const id = track.id as string;
      if (seen.has(id)) return null;
      seen.add(id);
      tracks.push(track as Track);
    }
    return tracks;
  } catch {
    return null;
  }
}
