import { useEffect, useState } from 'react';

import { readLocalLyrics } from './device.ts';
import { settle } from './local.ts';
import { fetchLyrics } from './lrclib.ts';
import { isAbortError, isNetworkError } from '../metadata/http.ts';
import {
  clearLyrics,
  readLyrics,
  shouldFetch,
  writeLocalLyrics,
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
 * The words for a track: somebody's own choice, then what is on the phone,
 * then LRCLIB, asked once and kept. See `local.ts` for why in that order.
 *
 * The phone is looked at every time a track starts, because it is cheap — a
 * tag is read, a folder listed — and because it is how a `.lrc` copied in
 * yesterday, or a tag filled in by another app, comes to replace what LRCLIB
 * said last month. LRCLIB itself is not asked again for anything already
 * known: the lyrics for a song do not change, and a player that reached for
 * the network on every play would be slower and ruder for no gain.
 *
 * What is stored is shown at once while the phone is looked at, so a track
 * whose words are already known never waits on a file to show them.
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
    // Words somebody chose are the end of it: nothing on the phone or off it
    // replaces them, so there is nothing to look at.
    if (stored?.source === 'manual') {
      setState({ lyrics: stored, looking: false });
      return;
    }

    // Skipping through a queue starts a cascade per track; without the abort
    // they all keep running and only the last one is allowed to say anything.
    const controller = new AbortController();
    let cancelled = false;
    setState({ lyrics: stored, looking: stored === null });

    void (async () => {
      const found = await readLocalLyrics(track.id);
      if (cancelled) return;
      const step = settle(stored && { lyrics: stored, source: stored.source }, found);
      if (step.kind === 'write') {
        writeLocalLyrics(track.id, step.found, Date.now());
        setState({ lyrics: readLyrics(track.id), looking: false });
        return;
      }
      if (step.kind === 'keep') {
        setState({ lyrics: stored, looking: false });
        return;
      }
      // Words from a file that no longer has them go, and the track is asked
      // about as if it were new.
      if (step.kind === 'forget') clearLyrics(track.id);

      // Covers both a settled answer and a recent failure to reach the service;
      // the store knows the difference and how long each is worth trusting.
      if (!shouldFetch(track.id, Date.now())) {
        setState({ lyrics: null, looking: false });
        return;
      }
      setState({ lyrics: null, looking: true });

      try {
        const lookedUp = await fetchLyrics(
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
        writeLyrics(track.id, lookedUp, Date.now());
        if (cancelled) return;
        setState({
          // Straight from a lookup, so unshifted and not somebody's choice.
          lyrics: lookedUp
            ? { ...lookedUp, fetchedAt: Date.now(), source: 'lookup', offsetMs: 0 }
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
