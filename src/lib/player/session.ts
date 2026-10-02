import type { Track } from '../types.ts';

/**
 * Listening time, and the rule for when enough of it has passed to count.
 *
 * Kept away from both the provider and SQLite: this is the arithmetic that
 * decides what ends up in the statistics, it has no business touching a
 * database, and it is the one part of playback that can be exercised without a
 * device. `db/history.ts` writes the `Play` this produces.
 */

/** A finished listen, ready to be written down. */
export type Play = {
  track: Track;
  startedAt: number;
  secondsPlayed: number;
  completed: boolean;
};

/**
 * Time actually spent listening, accumulated from wall clock rather than the
 * player position so that pausing stops the count and seeking does not inflate
 * it.
 */
export type Session = {
  track: Track;
  startedAt: number;
  accumulatedMs: number;
  /** Set while audio is playing, null while paused. */
  resumedAt: number | null;
};

export function beginSession(track: Track, playing: boolean, now: number): Session {
  return { track, startedAt: now, accumulatedMs: 0, resumedAt: playing ? now : null };
}

/** Fold the stretch just ended into the total, or open a new one. */
export function setSessionPlaying(session: Session, playing: boolean, now: number): Session {
  if (playing) {
    return session.resumedAt == null ? { ...session, resumedAt: now } : session;
  }
  if (session.resumedAt == null) return session;
  return {
    ...session,
    accumulatedMs: session.accumulatedMs + (now - session.resumedAt),
    resumedAt: null,
  };
}

export function finishSession(session: Session, completed: boolean, now: number): Play {
  const pendingMs = session.resumedAt == null ? 0 : now - session.resumedAt;
  return {
    track: session.track,
    startedAt: session.startedAt,
    secondsPlayed: (session.accumulatedMs + pendingMs) / 1000,
    completed,
  };
}

/**
 * How much of a track has to be heard before it counts as a play. Mirrors the
 * usual streaming convention of 30 seconds, but short tracks would never reach
 * that, so they count at the halfway mark instead.
 *
 * A duration of zero is the media store saying it does not know rather than a
 * zero-length file, and halving it would make every skip past such a track a
 * play — so an unknown length falls back to the plain 30 seconds.
 */
export function minimumSecondsFor(track: Track): number {
  if (track.durationSec > 0 && track.durationSec < 60) return track.durationSec / 2;
  return 30;
}

/** Anything too short is dropped, so skipping through a list adds nothing. */
export function countsAsPlay(play: Play): boolean {
  return play.completed || play.secondsPlayed >= minimumSecondsFor(play.track);
}
