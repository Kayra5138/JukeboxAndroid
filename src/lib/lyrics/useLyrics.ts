import { useEffect, useState } from 'react';

import { fetchLyrics } from './lrclib.ts';
import { isAbortError, isNetworkError } from '../metadata/http.ts';
import {
  readLyrics,
  shouldFetch,
  writeLyrics,
  writeLyricsUnreachable,
  type StoredLyrics,
} from '../db/lyrics.ts';
import type { Track } from '../types.ts';

export type LyricsState = {
  lyrics: StoredLyrics | null;
  /** True while the database is being asked; stored words appear at once. */
  looking: boolean;
};

/**
 * The words for a track, from the local store or fetched once and kept.
 *
 * Anything already known is shown immediately and never looked up again — the
 * lyrics for a song do not change, and a player that reached for the network on
 * every play would be slower and ruder for no gain.
 *
 * `enabled` is for the player: with the lyrics panel closed there is no reason
 * to ask about a track nobody is going to read the words of. It defaults to
 * asking, so a caller that does not care keeps the old behaviour.
 */
export function useLyrics(track: Track | null, enabled = true): LyricsState {
  const [state, setState] = useState<LyricsState>({ lyrics: null, looking: false });

  useEffect(() => {
    if (!track || !enabled) {
      setState({ lyrics: null, looking: false });
      return;
    }

    const stored = readLyrics(track.id);
    if (stored) {
      setState({ lyrics: stored, looking: false });
      return;
    }

    // Covers both a settled answer and a recent failure to reach the service;
    // the store knows the difference and how long each is worth trusting.
    if (!shouldFetch(track.id, Date.now())) {
      setState({ lyrics: null, looking: false });
      return;
    }

    // Skipping through a queue starts a cascade per track; without the abort
    // they all keep running and only the last one is allowed to say anything.
    const controller = new AbortController();
    let cancelled = false;
    setState({ lyrics: null, looking: true });

    void (async () => {
      try {
        const found = await fetchLyrics(
          {
            title: track.title,
            artist: track.artist,
            album: track.album,
            durationSec: track.durationSec,
          },
          controller.signal
        );
        // Recorded even when empty, so a track without lyrics is asked about
        // once rather than on every play.
        writeLyrics(track.id, found, Date.now());
        if (cancelled) return;
        setState({
          // Straight from a lookup, so unshifted and not somebody's choice.
          lyrics: found
            ? { ...found, fetchedAt: Date.now(), source: 'lookup', offsetMs: 0 }
            : null,
          looking: false,
        });
      } catch (error) {
        // No lyrics are stored for a failure, because "we could not ask" is not
        // an answer about this song — but the failure itself is, so an offline
        // device stops re-running the cascade on every play.
        if (isNetworkError(error)) {
          writeLyricsUnreachable(track.id, Date.now());
        }
        if (!cancelled && !isAbortError(error)) {
          setState({ lyrics: null, looking: false });
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [track, enabled]);

  return state;
}
