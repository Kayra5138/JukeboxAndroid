import { useEffect, useSyncExternalStore } from 'react';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import type { Album } from './albums.ts';
import { albumArtworkFor } from './artwork.ts';
import { standInFor } from './standIns.ts';

/**
 * The colour of each record's cover, for the rack's order by colour
 * (`colourOrder.ts`): the colour the cover is mostly made of, as the phone
 * reads it for the theme that takes its colour from what is playing.
 *
 * Read once for each record and kept, by the record's key, in a setting, so
 * that only a record new to the library is read again; an empty string for
 * one that could not be read, and a sleeve's colour for one with no cover,
 * each looked at again once in a run of the app. Reading a cover
 * opens it, so the ones not known are read a few at a time behind the
 * screen, and the colours are handed out together when they have all been
 * read: handed out one by one, the rack would reorder itself under the
 * finger as each came in.
 */
let known: Map<string, string> | null = null;
let shown: ReadonlyMap<string, string> = new Map();
let reading = false;
/*
  The records last asked about, and whether they were asked about again while
  a reading was under way: what is new to the library by then is read after
  it, rather than left until the records next change.
*/
let asked: readonly Album[] = [];
let again = false;
const watchers = new Set<() => void>();

function colours(): Map<string, string> {
  if (known) return known;
  known = new Map();
  try {
    const stored = JSON.parse(readSetting(SETTINGS.albumColours) ?? '{}') as Record<string, unknown>;
    for (const [key, hex] of Object.entries(stored)) if (typeof hex === 'string') known.set(key, hex);
  } catch {
    // Read again from the covers, then.
  }
  shown = plain(known);
  return known;
}

/*
  A colour taken from a record's paper sleeve, having no cover, is kept with
  a mark, so that the record is looked at again once in each run of the app:
  given a cover since, by a lookup or in its files, it took the sleeve's
  colour for good. Without the mark for what is handed out.
*/
const SLEEVE = '~';
const plain = (all: ReadonlyMap<string, string>) =>
  new Map([...all].map(([key, hex]) => [key, hex.startsWith(SLEEVE) ? hex.slice(SLEEVE.length) : hex] as const));
/** The records looked at again this run, a sleeve's colour or none found: not again until the next. */
const lookedAgain = new Set<string>();

function handOut(): void {
  const all = colours();
  shown = plain(all);
  writeSetting(SETTINGS.albumColours, JSON.stringify(Object.fromEntries(all)));
  for (const watcher of watchers) watcher();
}

async function colourOf(album: Album): Promise<string> {
  try {
    const cover = await albumArtworkFor(album.tracks);
    // A record with no cover is the colour of its paper sleeve's label: its genre's.
    const path = cover ?? (album.tracks[0] ? await standInFor(album.tracks[0]) : null);
    if (!path) return '';
    let hex = '';
    if (JukeboxAudio.coverReadingAsync) {
      const read = await JukeboxAudio.coverReadingAsync(path);
      hex = read?.main ?? read?.stops[1] ?? '';
    } else {
      const stops = await JukeboxAudio.coverColoursAsync?.(path);
      hex = stops?.[1] ?? '';
    }
    return hex && !cover ? `${SLEEVE}${hex}` : hex;
  } catch {
    return '';
  }
}

async function readAll(albums: readonly Album[]): Promise<void> {
  asked = albums;
  if (reading) {
    again = true;
    return;
  }
  const all = colours();
  // Those found without a colour, or with only their sleeve's, asked again once a run: a cover may have come since.
  const wanted = albums.filter((album) => {
    const hex = all.get(album.key);
    if (hex && !hex.startsWith(SLEEVE)) return false;
    if (hex === undefined) return true;
    return !lookedAgain.has(album.key);
  });
  if (wanted.length === 0) return;
  reading = true;
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const album = wanted[next];
      next += 1;
      if (album) {
        lookedAgain.add(album.key);
        all.set(album.key, await colourOf(album));
      }
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()]);
  } finally {
    reading = false;
    handOut();
    if (again) {
      again = false;
      void readAll(asked);
    }
  }
}

/**
 * A record's cover was changed: its colour is read again, at once if the
 * records have been asked about, and is taken out of what is handed out until
 * then, so that the count of colours known drops and comes back. The rack is
 * made again by that count, at the record it was on; the order changed with
 * the count the same, it would stay where it was by number, in front of some
 * other record.
 */
export function forgetAlbumColour(key: string): void {
  colours().delete(key);
  lookedAgain.delete(key);
  if (shown.has(key)) {
    const left = new Map(shown);
    left.delete(key);
    shown = left;
    for (const watcher of watchers) watcher();
  }
  void readAll(asked);
}

function subscribe(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}
function snapshot(): ReadonlyMap<string, string> {
  colours();
  return shown;
}

/**
 * The colours of the covers of [albums] as far as they are known, by key,
 * the rest read while [wanted]; answered again once they have been.
 */
export function useAlbumColours(albums: readonly Album[], wanted: boolean): ReadonlyMap<string, string> {
  const map = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    if (wanted) void readAll(albums);
  }, [albums, wanted]);
  return map;
}
