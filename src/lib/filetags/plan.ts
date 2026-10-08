import { strings, type Strings } from '../i18n/languages.ts';
import type { EnrichedTrack } from '../media/enriched.ts';
import type { FileDetails, NativeWrite } from './native.ts';

/**
 * Deciding what goes into a file, which files can take it, and how to say
 * what happened.
 *
 * The writing itself is native and careful and slow. Everything about it that
 * can be decided without touching a file is decided here, where it can be
 * tested: nothing in this file knows about the native module or the database.
 */

const WRITABLE = /\.(mp3|flac)$/i;

/**
 * Whether a track is in a format this writes.
 *
 * By its name, which is all that is known without opening it. The native side
 * looks at the bytes before it does anything and is the one that decides; this
 * is for not offering what would only be refused, and for saying beforehand
 * how many files a run will change.
 */
export function writable(track: { filename: string | null }): boolean {
  return track.filename != null && WRITABLE.test(track.filename);
}

/**
 * What to write for a track: what the app shows for it.
 *
 * [shown] is the merged view, the file's own tags with lookups and the user's
 * corrections laid over them, so whatever is on screen is what goes in. The
 * genre is the first tag, which is the most descriptive one and already what
 * the statistics count a track under.
 *
 * A field the app has nothing for is left out, and left out means untouched:
 * nothing here ever blanks what a file says. Lyrics are not written.
 *
 * [cover] is the app's own cover for the track as the database has it. Only a
 * picture already saved on the phone is written. One known by a web address
 * has not been fetched, and fetching it is not this action's business; and
 * where there is none, the picture the file already carries is the file's and
 * stays.
 */
export function detailsFor(shown: EnrichedTrack, cover: string | null): FileDetails {
  const details: FileDetails = {};
  const text = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };
  const count = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

  const fields = {
    title: text(shown.title),
    artist: text(shown.artist),
    album: text(shown.album),
    genre: text(shown.tags[0]),
    year: count(shown.year),
    track: count(shown.trackNumber),
    disc: count(shown.discNumber),
    cover: cover?.startsWith('file://') ? cover : undefined,
  };
  // Absent rather than undefined: the bridge carries an undefined across as a
  // null, and a key that is not there cannot be misread on the other side.
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) Object.assign(details, { [key]: value });
  }
  return details;
}

/** What became of one file. */
export type FileWrite =
  | { status: 'written'; changed: string[] }
  /** The file already said everything the app shows. */
  | { status: 'unchanged' }
  | { status: 'skipped'; why: 'format' | 'playing' }
  | { status: 'failed'; reason: string; kept: string | null };

export type Outcome = { id: string; title: string; result: FileWrite };

/** The native answer, in this file's terms. */
export function fromNative(answer: NativeWrite, t: Strings = strings()): FileWrite {
  if (answer.status === 'written') return { status: 'written', changed: answer.changed ?? [] };
  if (answer.status === 'unchanged') return { status: 'unchanged' };
  if (answer.status === 'unsupported') return { status: 'skipped', why: 'format' };
  return {
    status: 'failed',
    reason: answer.reason ?? t.details.write.noReason,
    kept: answer.kept ?? null,
  };
}

/**
 * What is known about a track before anything is asked of the phone: null
 * when it can be attempted, and otherwise why it will not be.
 *
 * The track that is playing is left out. The player is reading that file as
 * it goes, and a file whose sound has just moved along by the size of a cover
 * gives it a mouthful of something else.
 */
export function decline(
  track: { id: string; filename: string | null },
  playingId: string | null
): FileWrite | null {
  if (!writable(track)) return { status: 'skipped', why: 'format' };
  if (track.id === playingId) return { status: 'skipped', why: 'playing' };
  return null;
}

/** One file's result, as a line to show against it. */
export function lineFor(result: FileWrite, t: Strings = strings()): string {
  const said = t.details.write;
  switch (result.status) {
    case 'written':
      return said.written(result.changed);
    case 'unchanged':
      return said.unchanged;
    case 'skipped':
      return result.why === 'playing' ? said.skippedPlaying : said.skippedFormat;
    case 'failed':
      return said.failed(result.reason);
  }
}

export type Tally = { written: number; unchanged: number; skipped: number; failed: number };

export function tally(outcomes: Outcome[]): Tally {
  const counts: Tally = { written: 0, unchanged: 0, skipped: 0, failed: 0 };
  for (const outcome of outcomes) counts[outcome.result.status]++;
  return counts;
}

/**
 * A run of files, in a sentence or two. Only what happened is mentioned: a run
 * with no failures does not say that none failed.
 */
export function summarise(outcomes: Outcome[], t: Strings = strings()): string {
  return t.details.write.summary(tally(outcomes));
}

/**
 * What a run is about to do, for the question asked before it: how many files
 * will be changed, and how many of those chosen cannot be.
 */
export function forecast(
  tracks: { id: string; filename: string | null }[],
  playingId: string | null
): { willWrite: number; wrongFormat: number; playing: number } {
  let wrongFormat = 0;
  let playing = 0;
  for (const track of tracks) {
    const declined = decline(track, playingId);
    if (declined?.status === 'skipped') {
      if (declined.why === 'format') wrongFormat++;
      else playing++;
    }
  }
  return { willWrite: tracks.length - wrongFormat - playing, wrongFormat, playing };
}
