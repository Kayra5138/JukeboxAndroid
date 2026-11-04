import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';

/**
 * Whether a shake of the phone in a sleep timer's last three minutes adds
 * ten more. Kept by the player, which listens for the shake itself with the
 * screen off and the app gone (`ShakeToExtend.kt`); on unless turned off.
 */
export function shakeToExtend(): boolean {
  try {
    return JukeboxAudio.getShakeToExtend?.() ?? true;
  } catch {
    return true;
  }
}

/** Whether the player can listen for a shake at all: a build from before it cannot. */
export function shakeSupported(): boolean {
  return typeof JukeboxAudio.setShakeToExtend === 'function';
}

export function setShakeToExtend(on: boolean): void {
  try {
    JukeboxAudio.setShakeToExtend?.(on);
  } catch {
    // An older player: there is no shake to turn.
  }
}
