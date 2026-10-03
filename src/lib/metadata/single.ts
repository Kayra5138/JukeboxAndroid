import { fromItunesGenre } from './genres.ts';
import { isAbortError } from './http.ts';
import { lookupTrack as lookupItunes, type ItunesMatch } from './itunes.ts';
import { lookupTrack as lookupMusicBrainz, type MusicBrainzMatch } from './musicbrainz.ts';
import { canonicalLabel } from './text.ts';
import type { TagEdit, TagSource } from '../db/tags.ts';
import type { Track } from '../types.ts';

/**
 * Looking one track up because somebody asked, a part of it at a time.
 *
 * The sweep over a library (`pipeline.ts`) asks one question and writes the
 * answer down: what genre is this, and whatever else came with it. The details
 * screen asks two, separately, and writes nothing: who and what is this, and
 * what is it like. Each is shown to the person who asked, to keep or to
 * correct, so neither stops at the first catalogue that had half an answer.
 */

/** The two catalogues, passed in so the rules below can be tried without them. */
export type Catalogues = {
  musicbrainz: (track: Track, signal?: AbortSignal) => Promise<MusicBrainzMatch | null>;
  itunes: (track: Track, signal?: AbortSignal) => Promise<ItunesMatch | null>;
};

const REAL: Catalogues = { musicbrainz: lookupMusicBrainz, itunes: lookupItunes };

export type FoundGeneral = {
  /** Every catalogue that had something, in the order they were asked. */
  sources: ('musicbrainz' | 'itunes')[];
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  artworkUrl: string | null;
  /** What MusicBrainz learned about the credit, for whoever counts artists. */
  credit: { text: string; oneArtist: boolean } | null;
};

export type FoundTags = { tags: string[]; source: Exclude<TagSource, 'manual'> };

/**
 * Asks one catalogue and lets the other still be asked if it fails.
 *
 * A stop is a stop and goes straight up. Anything else is kept to one side:
 * MusicBrainz being down is no reason not to hear from Apple, and it only
 * becomes the answer when nobody had anything to say.
 */
async function asked<T>(
  ask: () => Promise<T | null>,
  failures: unknown[],
  signal?: AbortSignal
): Promise<T | null> {
  try {
    return await ask();
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) throw error;
    failures.push(error);
    return null;
  }
}

/**
 * Who and what a track is: its names, its record and its cover.
 *
 * Both catalogues, always. MusicBrainz is the better judge of who made a
 * recording and when, and knows nothing of the release it is on; Apple has the
 * album, the place on it and the cover. The sweep stops at MusicBrainz when
 * that had a genre, which is right for a sweep and would leave this screen
 * with no album and no picture for exactly the tracks it found best.
 *
 * Null when neither had anything. Throws when neither could be reached.
 */
export async function lookUpGeneral(
  track: Track,
  signal?: AbortSignal,
  catalogues: Catalogues = REAL
): Promise<FoundGeneral | null> {
  const failures: unknown[] = [];
  const musicbrainz = await asked(() => catalogues.musicbrainz(track, signal), failures, signal);
  const itunes = await asked(() => catalogues.itunes(track, signal), failures, signal);

  if (!musicbrainz && !itunes) {
    if (failures.length > 0) throw failures[0];
    return null;
  }

  const sources: FoundGeneral['sources'] = [];
  if (musicbrainz) sources.push('musicbrainz');
  if (itunes) sources.push('itunes');

  return {
    sources,
    title: musicbrainz?.title ?? itunes?.title ?? null,
    artist: musicbrainz?.artist ?? itunes?.artist ?? null,
    album: itunes?.album ?? null,
    // MusicBrainz dates the recording; Apple dates the release it is selling,
    // which for a reissue is decades late.
    year: musicbrainz?.year ?? itunes?.year ?? null,
    trackNumber: itunes?.trackNumber ?? null,
    discNumber: itunes?.discNumber ?? null,
    artworkUrl: itunes?.artworkUrl ?? null,
    credit:
      musicbrainz && musicbrainz.oneArtist != null
        ? { text: musicbrainz.artist, oneArtist: musicbrainz.oneArtist }
        : null,
  };
}

/**
 * What a track is like: its tags, best first.
 *
 * MusicBrainz first, because it ranks several where Apple names one, and Apple
 * only when MusicBrainz had none: the two do not use the same words, and both
 * together is the same genre twice under two spellings.
 */
export async function lookUpTags(
  track: Track,
  signal?: AbortSignal,
  catalogues: Catalogues = REAL
): Promise<FoundTags | null> {
  const failures: unknown[] = [];
  const musicbrainz = await asked(() => catalogues.musicbrainz(track, signal), failures, signal);
  if (musicbrainz && musicbrainz.genres.length > 0) {
    return { tags: musicbrainz.genres, source: 'musicbrainz' };
  }

  const itunes = await asked(() => catalogues.itunes(track, signal), failures, signal);
  const tags = itunes?.genre ? fromItunesGenre(itunes.genre) : [];
  if (tags.length > 0) return { tags, source: 'itunes' };

  if (!musicbrainz && !itunes && failures.length > 0) throw failures[0];
  return null;
}

/**
 * A list being edited, with what a lookup found put into it.
 *
 * The rule a sweep follows when it writes (`saveLookupTags`), applied to a list
 * nobody has saved yet: tags somebody typed stay, in the order they were left
 * in, and everything a catalogue said before is replaced by what it says now.
 */
export function withLookupTags(current: TagEdit[], found: FoundTags): TagEdit[] {
  const kept = current.filter((entry) => entry.source === 'manual');
  const taken = new Set(kept.map((entry) => entry.tag));
  const added: TagEdit[] = [];
  for (const raw of found.tags) {
    const tag = canonicalLabel(raw);
    if (!tag || taken.has(tag)) continue;
    taken.add(tag);
    added.push({ tag, source: found.source });
  }
  return [...kept, ...added];
}

/**
 * What counts as a year. The phonograph is the earliest anything could have
 * been recorded, and next year is a date releases are routinely announced for.
 */
const FIRST_YEAR = 1877;

/** The year typed into a field, or null when it is not one. */
export function typedYear(text: string, now = new Date()): number | null {
  const trimmed = text.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  const year = Number.parseInt(trimmed, 10);
  return year >= FIRST_YEAR && year <= now.getFullYear() + 1 ? year : null;
}

/** A place on a record typed into a field: a whole number from one up, or null. */
export function typedPlace(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const place = Number.parseInt(trimmed, 10);
  return place >= 1 ? place : null;
}

/** What a field that takes a number is told about what is in it, or null if it is fine. */
export function numberComplaint(text: string, kind: 'year' | 'place'): string | null {
  if (text.trim() === '') return null;
  if (kind === 'year') return typedYear(text) == null ? 'That is not a year.' : null;
  return typedPlace(text) == null ? 'A whole number, from 1 up.' : null;
}
