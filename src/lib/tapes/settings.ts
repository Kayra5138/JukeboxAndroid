import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { wholeIn, type Range } from '../ui/range.ts';

/**
 * The settings of tapes alone, apart from the music's: how far a tape's jump
 * buttons go, and whether it goes back a little on being played again.
 */

/** How far a tape's jump buttons may go, in seconds: up to two minutes, for a talk that wanders. */
export const TAPE_JUMP_RANGE: Range = { min: 1, max: 120 };

/** Made for a voice, where the music's are made for a song: back far enough to hear a sentence again, on past an aside. */
export const DEFAULT_TAPE_BACK = 15;
export const DEFAULT_TAPE_FORWARD = 30;

/** The steps a tape's buttons go, back and forward, falling back to fifteen and thirty for anything not chosen. */
export function tapeJumps(): { back: number; forward: number } {
  return {
    back: wholeIn(readSetting(SETTINGS.tapeBack), TAPE_JUMP_RANGE) ?? DEFAULT_TAPE_BACK,
    forward: wholeIn(readSetting(SETTINGS.tapeForward), TAPE_JUMP_RANGE) ?? DEFAULT_TAPE_FORWARD,
  };
}

export function setTapeJump(which: 'back' | 'forward', seconds: number): void {
  writeSetting(which === 'back' ? SETTINGS.tapeBack : SETTINGS.tapeForward, String(seconds));
  syncTapeJumps();
}

/**
 * The steps handed to the player as well, which makes a press of previous or
 * next on a tape from a headset, the notification or the car the same jump
 * as the app's buttons (`Tapes.jump`). Asked as the app starts, and after a change.
 */
export function syncTapeJumps(): void {
  try {
    const { back, forward } = tapeJumps();
    JukeboxAudio.setTapeJumps?.(back, forward);
  } catch {
    // An older player: its presses do as they always did.
  }
}

/**
 * Whether a tape played again after a while starts a little before where it
 * was left. Kept by the player itself, which does the going back, so that it
 * holds from the car and a headset as well; on unless turned off.
 */
export function smartRewind(): boolean {
  try {
    return JukeboxAudio.getTapeSmartRewind();
  } catch {
    return true;
  }
}

/**
 * A tape's ways of being heard, kept by the player, which applies them as a
 * tape comes on and never to the music: silences passed over, a clearer
 * voice, and the parts of a video SponsorBlock marked passed over.
 */
export type TapeFlag = 'skipSilence' | 'voiceClarity' | 'skipSponsors';

/** What each is until it is set: the sound left as it is, and the interruptions passed over. */
const FLAG_DEFAULTS: Record<TapeFlag, boolean> = { skipSilence: false, voiceClarity: false, skipSponsors: true };

export function tapeFlag(name: TapeFlag): boolean {
  try {
    return JukeboxAudio.getTapeFlag?.(name, FLAG_DEFAULTS[name]) ?? FLAG_DEFAULTS[name];
  } catch {
    return FLAG_DEFAULTS[name];
  }
}

export function setTapeFlag(name: TapeFlag, on: boolean): void {
  JukeboxAudio.setTapeFlag?.(name, on);
}

export function setSmartRewind(on: boolean): void {
  JukeboxAudio.setTapeSmartRewind(on);
}
