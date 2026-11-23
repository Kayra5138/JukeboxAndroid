import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { wholeIn, type Range } from '../ui/range.ts';
import { createStore } from '../ui/store.ts';
import { jumpsFor, ownJumpsFrom, withOwnJump, type OwnJumps } from './ownJumps.ts';

/**
 * The settings of tapes alone, apart from the music's: how far a tape's jump
 * buttons go, for all of them and for a book or show given its own, and
 * whether it goes back a little on being played again.
 */

/**
 * Counted up whenever a jump step changes, a song's or a tape's, for what
 * shows one to read it again: the bar of what is playing keeps its buttons'
 * steps and reads them afresh only then.
 */
export const jumpStepsChanged = createStore(0);

/** Said after a step is written, by here and by the music's own setting. */
export function jumpStepChanged(): void {
  jumpStepsChanged.set(jumpStepsChanged.get() + 1);
}

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
  jumpStepChanged();
}

function ownJumps(): OwnJumps {
  return ownJumpsFrom(readSetting(SETTINGS.tapeOwnJumps));
}

/**
 * The steps for the book or show under [key] (`tapeKeyOf`): those it was
 * given in the player's tape settings, or the general ones above where it
 * was given none, and which are its own.
 */
export function tapeJumpsFor(key: string | null): ReturnType<typeof jumpsFor> {
  const general = tapeJumps();
  return key ? jumpsFor(ownJumps(), key, general, TAPE_JUMP_RANGE) : { ...general, ownBack: false, ownForward: false };
}

/** The book or show under [key] given a step of its own, or back to the general one for null. */
export function setOwnTapeJump(key: string, which: 'back' | 'forward', seconds: number | null): void {
  writeSetting(SETTINGS.tapeOwnJumps, JSON.stringify(withOwnJump(ownJumps(), key, which, seconds)));
  syncTapeJumps();
  jumpStepChanged();
}

/**
 * The steps handed to the player as well, which makes a press of previous or
 * next on a tape from a headset, the notification or the car the same jump
 * as the app's buttons (`Tapes.jump`): the general ones, and those the books
 * and shows were given of their own. Asked as the app starts, and after a change.
 */
export function syncTapeJumps(): void {
  try {
    const { back, forward } = tapeJumps();
    JukeboxAudio.setTapeJumps?.(back, forward);
    JukeboxAudio.setTapeJumpsByKey?.(JSON.stringify(ownJumps()));
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

/**
 * What each is until it is set: the sound left as it is, and the interruptions
 * passed over. Skipping silence and the clearer voice are experimental (they
 * stand apart at the foot of the tape settings) and stay off until turned on.
 */
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
