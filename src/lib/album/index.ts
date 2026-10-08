import { placedRow, placementOf } from './placement.ts';
import { findAlbumRest, type Get, type OwnedTrack, type RestOutcome } from './rest.ts';
import { findAlbumOnYouTube, type Look, type Stage, type YouTubeOutcome } from './youtube.ts';
import { readMetadata, saveMetadata } from '../db/metadata.ts';
import { musicBrainzGet } from '../metadata/musicbrainz.ts';
import { downloads } from '../youtube/native.ts';
import type { YouTubeResult } from '../youtube/types.ts';

/**
 * The rest of a record, with the real catalogue and the real database behind
 * it. The rules are in the files beside this one and take what they ask and
 * what they write as arguments; this is the only place those are MusicBrainz
 * and SQLite.
 */

/**
 * How many answers are kept. A record is two or three of them, so this is the
 * last few records looked at and not a copy of the catalogue.
 */
const REMEMBERED = 12;

const answers = new Map<string, unknown>();

/**
 * MusicBrainz through its one paced door, and each answer kept for a while.
 *
 * The list is worked out again every time the library changes — a download
 * landing is exactly that — and the record has not changed in between. Asking
 * again each time would be three requests, four seconds, to be told what was
 * on screen already. Only answers are kept: a failure is asked about again.
 */
const remembering: Get = async <T>(path: string, signal?: AbortSignal) => {
  if (answers.has(path)) return answers.get(path) as T;
  const answer = await musicBrainzGet<T>(path, signal);
  if (answers.size >= REMEMBERED) answers.delete(answers.keys().next().value!);
  answers.set(path, answer);
  return answer;
};

export function lookUpAlbumRest(
  album: { name: string; artist: string | null; tracks: OwnedTrack[] },
  signal?: AbortSignal
): Promise<RestOutcome> {
  return findAlbumRest(album, remembering, signal);
}

const playlists = new Map<string, YouTubeResult[]>();

/** A question YouTube is being asked now, and how many are waiting to hear. */
type Asking = { id: string; answer: Promise<YouTubeResult[]>; waiting: number };
const asking = new Map<string, Asking>();

/**
 * YouTube's playlists, by the phone: a search for them by words, or the
 * reading of one by its address — the phone tells which by what it is handed.
 * Each answer is kept for a while, as MusicBrainz's are and for the same
 * reason, only more so: reading a playlist can take the better part of a
 * minute.
 *
 * And a question already being asked is listened to, not asked again. The
 * list is worked out anew whenever the library changes, which stops the last
 * working-out; were that to stop the request as well, a download landing
 * every half minute would keep a slow playlist from ever being read. So a
 * request is only called off once nobody is waiting on it — the screen was
 * left — and a moment is given for the next asker to turn up first.
 */
const fromYouTube: Look = (query, signal) => {
  const kept = playlists.get(query);
  if (kept) return Promise.resolve(kept);
  const native = downloads!;

  let entry = asking.get(query);
  if (!entry) {
    const id = `album-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const made: Asking = {
      id,
      waiting: 0,
      answer: native.playlistAsync(query, id).then((found) => {
        if (playlists.size >= REMEMBERED) playlists.delete(playlists.keys().next().value!);
        playlists.set(query, found);
        return found;
      }),
    };
    const over = () => {
      if (asking.get(query) === made) asking.delete(query);
    };
    made.answer.then(over, over);
    asking.set(query, made);
    entry = made;
  }

  const asked = entry;
  asked.waiting += 1;
  return new Promise((resolve, reject) => {
    const leave = () => {
      asked.waiting -= 1;
      reject(signal?.reason ?? new Error('Stopped'));
      setTimeout(() => {
        if (asked.waiting > 0 || asking.get(query) !== asked) return;
        asking.delete(query);
        void native.cancelSearchAsync(asked.id).catch(() => {});
      }, 0);
    };
    if (signal?.aborted) return leave();
    signal?.addEventListener('abort', leave, { once: true });
    asked.answer.then(
      (found) => {
        signal?.removeEventListener('abort', leave);
        resolve(found);
      },
      (error: unknown) => {
        signal?.removeEventListener('abort', leave);
        reject(error);
      }
    );
  });
};

/**
 * The same record as YouTube has it. Stopping it — the screen was left —
 * stops the request the phone is making; a build with no way of asking
 * YouTube says so and is not an error.
 */
export function lookUpAlbumOnYouTube(
  album: { name: string; artist: string | null; tracks: OwnedTrack[] },
  options: { signal?: AbortSignal; onStage?: (stage: Stage) => void } = {}
): Promise<YouTubeOutcome> {
  if (!downloads) return Promise.resolve({ ok: false, why: 'unavailable' });
  return findAlbumOnYouTube(album, { search: fromYouTube, read: fromYouTube }, options);
}

/**
 * Files a track that has just come in under the record it was fetched for,
 * where its job says there is one. Answers whether anything was written.
 */
export function fileUnderAlbum(trackId: string, video: unknown): boolean {
  const place = placementOf(video);
  if (!place) return false;
  const row = placedRow(trackId, place, readMetadata(trackId));
  if (!row) return false;
  saveMetadata(row);
  return true;
}
