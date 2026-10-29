import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';

/**
 * How fast a tape is played: each book or show at its own speed, kept by its
 * folder, since a voice that is quick in one is slow in another; and the music
 * at its own, which a tape never changes. The changing over between the two
 * is the player's (`Tapes.applySpeed`), so that it happens with no app about.
 */

/** The speeds the tape player's button goes round, in order. */
export const TAPE_SPEEDS = [0.8, 1, 1.2, 1.5, 1.75, 2] as const;

/** The speed after [speed] on the button: the next one up, round to the slowest after the fastest. */
export function nextTapeSpeed(speed: number): number {
  const next = TAPE_SPEEDS.find((step) => step > speed + 0.001);
  return next ?? TAPE_SPEEDS[0];
}

/** What a tape's speed is kept under: its folder, which is its book or its show. */
export function tapeKeyOf(track: { folder?: string | null; id: string }): string {
  return (track.folder ?? '').replace(/\/+$/, '') || track.id;
}

function speeds(): Record<string, number> {
  try {
    const kept: unknown = JSON.parse(readSetting(SETTINGS.tapeSpeeds) ?? '{}');
    return kept && typeof kept === 'object' ? (kept as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function tapeSpeedOf(key: string): number {
  const speed = speeds()[key];
  return typeof speed === 'number' && speed >= 0.5 && speed <= 3 ? speed : 1;
}

export function setTapeSpeed(key: string, speed: number): void {
  writeSetting(SETTINGS.tapeSpeeds, JSON.stringify({ ...speeds(), [key]: speed }));
  syncTapeSpeeds();
}

/**
 * The speeds handed to the player, which changes over between a tape's and
 * the music's itself (`Tapes.applySpeed`), with no app about as well as with
 * one. Asked as the app starts and after each change. The music's speed an
 * app from before put aside here goes over with them, once.
 */
export function syncTapeSpeeds(): void {
  try {
    if (!JukeboxAudio.setTapeSpeeds) return;
    JukeboxAudio.setTapeSpeeds(JSON.stringify(speeds()), keptMusicSpeed());
    keepMusicSpeed(null);
  } catch {
    // An older player: the speeds stay the app's.
  }
}

/** The music's speed while a tape plays, or null while none does. */
export function keptMusicSpeed(): number | null {
  const kept = Number(readSetting(SETTINGS.musicSpeed));
  return Number.isFinite(kept) && kept > 0 ? kept : null;
}

export function keepMusicSpeed(speed: number | null): void {
  writeSetting(SETTINGS.musicSpeed, speed == null ? '' : String(speed));
}
