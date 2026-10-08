import type { SleepTimer } from '../../../modules/jukebox-audio/index.ts';
import { strings, type Strings } from '../i18n/languages.ts';

/**
 * The parts of the sleep timer that are arithmetic and wording.
 *
 * The timer itself is not here, or anywhere in JavaScript. It is kept by the
 * playback service, because it has to go off with the app swiped away and the
 * screen dark, and what comes back from there is a moment it ends at. Turning
 * that into a line to read, and a typed number into a duration to ask for, is
 * what is left for this side -- and what happens when the time is up is
 * decided where it happens, in `SleepPlan.kt`, and is checked there.
 *
 * Nothing here reads a clock or the database: the time is handed in and the
 * stored setting arrives as the string it was stored as, which is what lets
 * all of it be checked without a phone. The wording is handed in the same way,
 * as the table of the language to say it in.
 */

/** The durations offered, in minutes. */
export const SLEEP_PRESETS = [15, 30, 45, 60, 90] as const;

/** What the box for a typed duration starts with before anything was chosen. */
export const DEFAULT_SLEEP_MINUTES = 30;

/**
 * The longest a typed duration may be: twelve hours.
 *
 * Longer than any night, so nothing wanted is refused, and short enough that
 * a `3000` meant as `30` is caught rather than quietly kept.
 */
export const MAX_SLEEP_MINUTES = 720;

/**
 * How long the music takes to go quiet. The service's figure, repeated only so
 * the line on screen can say that it has begun.
 */
export const SLEEP_FADE_MS = 30_000;

/** No timer, for before the service has been asked and for a module without one. */
export const SLEEP_OFF: SleepTimer = {
  kind: 'off',
  endsAt: null,
  finishTrack: false,
  fade: false,
  finishing: false,
};

export function isPreset(minutes: number): boolean {
  return (SLEEP_PRESETS as readonly number[]).includes(minutes);
}

/**
 * The minutes a typed line means, or null if it does not mean any.
 *
 * Whole minutes, written in digits, from one to twelve hours. Nothing is
 * rounded or held to the nearest limit: a number that had to be corrected was
 * probably not the number meant, and a timer set to something other than what
 * was typed is worse than being asked again.
 */
export function minutesFrom(typed: string): number | null {
  const cleaned = typed.trim();
  if (!/^\d{1,4}$/.test(cleaned)) return null;
  const minutes = Number(cleaned);
  return minutes >= 1 && minutes <= MAX_SLEEP_MINUTES ? minutes : null;
}

/** What is remembered between one night and the next. */
export type SleepPreferences = {
  /** The duration last chosen, preset or typed. */
  minutes: number;
  /** Whether a duration waits for the track to end. */
  finishTrack: boolean;
};

/**
 * The preferences a stored setting means.
 *
 * One setting for the pair, since they are only ever read together. Anything
 * that cannot be read is the defaults, a field at a time, so a figure that is
 * no longer allowed does not take the switch down with it.
 */
export function preferencesFrom(saved: string | null): SleepPreferences {
  let stored: unknown = null;
  try {
    stored = JSON.parse(saved ?? 'null');
  } catch {
    stored = null;
  }
  const fields = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const minutes = typeof fields.minutes === 'number' ? minutesFrom(String(fields.minutes)) : null;
  return {
    minutes: minutes ?? DEFAULT_SLEEP_MINUTES,
    finishTrack: fields.finishTrack === true,
  };
}

export function preferencesToSetting(preferences: SleepPreferences): string {
  return JSON.stringify({ minutes: preferences.minutes, finishTrack: preferences.finishTrack });
}

/**
 * How long a duration has left at [now], or null where there is no counting:
 * no timer, the end of a track, a duration already waiting for one.
 *
 * Never negative. A timer a moment past its end is one whose news has not
 * arrived yet, and it is shown as nothing left rather than as less than that.
 */
export function remainingMs(timer: SleepTimer, now: number): number | null {
  if (timer.kind !== 'duration' || timer.endsAt === null) return null;
  return Math.max(0, timer.endsAt - now);
}

/**
 * A time left, as `12:34` or `1:02:03`.
 *
 * Rounded up to the second, the way a countdown is read: it says `0:01` for
 * the whole of the last second and `0:00` only when there is none.
 */
export function formatRemaining(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/**
 * The one line that says what the timer is doing, or null with none set.
 *
 * [t] is the language to say it in. A screen passes the table it was given by
 * `useT()`, so that the line is made again when the language changes; left
 * out, it is whatever the app is speaking at the moment of asking, which is
 * right for anything that is not a screen and is English in a test.
 */
export function describeTimer(
  timer: SleepTimer,
  now: number,
  t: Strings = strings()
): string | null {
  if (timer.kind === 'off') return null;
  const left = remainingMs(timer, now);
  if (left === null) return t.player.sleep.endOfTrack;
  if (timer.finishTrack) return t.player.sleep.thenToTheEnd(formatRemaining(left));
  if (timer.fade && left <= SLEEP_FADE_MS) return t.player.sleep.fadingOut(formatRemaining(left));
  return t.player.sleep.pausesIn(formatRemaining(left));
}
