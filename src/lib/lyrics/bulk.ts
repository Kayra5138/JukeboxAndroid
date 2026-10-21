import { isAbortError, isNetworkError, isThrottle, pause } from '../metadata/http.ts';
import { settle, type Kept, type LocalLyrics } from './local.ts';
import type { Lyrics, LyricsQuery } from './lrclib.ts';

/**
 * Words for a run of tracks somebody chose, one after another.
 *
 * Each track is settled the way playing it settles it (`useLyrics.ts`), with
 * one difference that is the reason for asking: LRCLIB is asked again about
 * a track it had no words for last time, without waiting out the month a
 * miss is otherwise trusted for. Somebody asking for lyrics for these tracks
 * is asking for exactly that.
 *
 *  - Words somebody chose are left as they are, and the track is not looked
 *    at at all.
 *  - The phone comes first — the song's own file, a `.lrc` beside it — and
 *    what it has replaces whatever LRCLIB said, as on a play.
 *  - A track that already has words and has nothing new on the phone keeps
 *    them. LRCLIB is not asked to say again what it has said.
 *  - Everything else is asked of LRCLIB, one track at a time. The client
 *    keeps its own second between requests, which is the pacing; one track
 *    can still cost several of them, and they are not hurried.
 *
 * A track LRCLIB could not be reached about is written down as that and not
 * as a miss, as a play does; three in a row and the run stops and says there
 * is no network, rather than finding it out once per track. A service asking
 * to be left alone is left alone for a minute.
 */

/** What is stored for a track, as far as this run has to know. */
export type StoredWords = { lyrics: Lyrics; source: 'lookup' | 'manual' | 'file' | 'lrc' } | null;

/** One track to find words for: its id, and the names it is shown with. */
export type LyricsItem = { id: string; query: LyricsQuery };

/** The tables and the services, passed in so the run can be tried without either. */
export type LyricsRunDeps = {
  stored: (trackId: string) => StoredWords;
  readLocal: (trackId: string) => Promise<LocalLyrics | null>;
  fetch: (query: LyricsQuery, signal: AbortSignal) => Promise<Lyrics | null>;
  /** Words found on the phone, in place of whatever was stored. */
  writeLocal: (trackId: string, found: LocalLyrics) => void;
  /** LRCLIB's answer, words or a miss, in place of whatever was stored. */
  writeLookup: (trackId: string, lyrics: Lyrics | null) => void;
  /** LRCLIB could not be reached about this one. Not an answer. */
  writeUnreachable: (trackId: string) => void;
  /** Stored words from the phone that the phone no longer has. */
  forget: (trackId: string) => void;
  /** Told after each write, for a list that would show it. */
  onSaved?: (trackId: string) => void;
  /** For the tests, which do not wait out a minute. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export type LyricsProgress = { done: number; total: number; found: number; offline?: boolean };

export type LyricsResult = {
  /** Tracks that had no words when the run began and have some now. */
  found: number;
  /** Tracks that had no words when the run began, which is what was looked for. */
  wanted: number;
  /** Tracks that already had words, of LRCLIB's or the phone's. */
  had: number;
  /** Tracks whose words somebody chose, left alone. */
  chosen: number;
  cancelled: boolean;
  /** Set when LRCLIB could not be reached and the run stopped short. */
  stopped?: 'offline';
};

/** Requests in a row that may fail to reach LRCLIB before the run gives up on it. */
export const OFFLINE_STRIKES = 3;

/** How long to leave LRCLIB alone when it asks to be. */
export const THROTTLE_PAUSE_MS = 60_000;

/** Never rejects for anything LRCLIB does; a stop is a resolved result. */
export async function runLyrics(
  items: readonly LyricsItem[],
  onProgress: (progress: LyricsProgress) => void,
  signal: AbortSignal,
  deps: LyricsRunDeps
): Promise<LyricsResult> {
  const wait = deps.wait ?? pause;
  const result: LyricsResult = { found: 0, wanted: 0, had: 0, chosen: 0, cancelled: false };
  let done = 0;
  let strikes = 0;
  const total = items.length;
  const emit = (offline?: boolean) =>
    onProgress(offline ? { done, total, found: result.found, offline } : { done, total, found: result.found });
  emit();

  for (const item of items) {
    if (signal.aborted) break;
    const stored = deps.stored(item.id);
    if (stored?.source === 'manual') {
      result.chosen += 1;
      done += 1;
      emit();
      continue;
    }
    const hadWords = stored != null;
    if (hadWords) result.had += 1;
    else result.wanted += 1;

    const local = await deps.readLocal(item.id).catch(() => null);
    if (signal.aborted) break;
    const step = settle(stored as Kept, local);
    if (step.kind === 'write') {
      deps.writeLocal(item.id, step.found);
      deps.onSaved?.(item.id);
      if (!hadWords) result.found += 1;
      done += 1;
      emit();
      continue;
    }
    if (step.kind === 'keep') {
      done += 1;
      emit();
      continue;
    }
    if (step.kind === 'forget') {
      // The phone's words went from the phone, and the track is asked about
      // as if it were new: one that had words, and now is looking for some.
      deps.forget(item.id);
      deps.onSaved?.(item.id);
      result.had -= 1;
      result.wanted += 1;
    }

    let answer: { lyrics: Lyrics | null } | null = null;
    for (let tries = 0; answer == null && !signal.aborted; tries += 1) {
      try {
        answer = { lyrics: await deps.fetch(item.query, signal) };
        strikes = 0;
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break;
        if (isNetworkError(error)) {
          deps.writeUnreachable(item.id);
          strikes += 1;
          break;
        }
        // Asked to slow down: once, after a minute. A second refusal is left
        // for another day rather than held against the rest of the run.
        if (isThrottle(error) && tries === 0) {
          await wait(THROTTLE_PAUSE_MS, signal);
          continue;
        }
        // Answered, with something that is not an answer about this song.
        // Nothing is written, so that nothing stops the next try.
        strikes = 0;
        break;
      }
    }
    // An answer that arrived as the run was stopped is still an answer.
    if (answer) {
      deps.writeLookup(item.id, answer.lyrics);
      deps.onSaved?.(item.id);
      if (answer.lyrics) result.found += 1;
    }
    if (signal.aborted) break;
    done += 1;
    if (strikes >= OFFLINE_STRIKES) {
      emit(true);
      return { ...result, stopped: 'offline' };
    }
    emit();
  }

  if (signal.aborted) return { ...result, cancelled: true };
  return result;
}
