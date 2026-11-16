import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { createStore } from './store.ts';

/**
 * What stands where the cover is in the player: the cover, as it always was,
 * or something the cover is part of. For a song, a record with the cover for
 * its label, turning while it plays; for a tape, a cassette, its reels turning
 * and the tape wound from one to the other as the part goes on. Settings →
 * Look, one for songs and one for tapes. Held still with the rest of the
 * decoration (`motion.ts`): the record and the reels are drawn, and do not turn.
 *
 * And over whichever it is, what moves with the music: nothing, or the
 * spectrum of what is being heard (`components/Spectrum.tsx`). Held still with
 * the decoration as well.
 */
import type { CoverMotion, SongLook, TapeLook } from './coverFace.ts';

export type { CoverMotion, SongLook, TapeLook };

const SONG_LOOKS: readonly SongLook[] = ['cover', 'record'];
const TAPE_LOOKS: readonly TapeLook[] = ['cover', 'cassette'];
export const MOTIONS: readonly CoverMotion[] = [
  'none',
  'spectrum',
  'ripple',
  'breathe',
  'punch',
  'scope',
  'spectrogram',
  'sparks',
  'aurora',
];

/** One look, kept where it can be watched, and read from the database the first time it is asked for. */
function lookStore<Look extends string>(key: string, looks: readonly Look[]) {
  const store = createStore<Look>(looks[0]!);
  let read = false;
  const get = (): Look => {
    if (!read) {
      read = true;
      try {
        const saved = readSetting(key);
        const found = looks.find((look) => look === saved);
        if (found) store.set(found);
      } catch {
        // The cover.
      }
    }
    return store.get();
  };
  return {
    get,
    use: (): Look => useSyncExternalStore(store.subscribe, get),
    set: (next: Look): void => {
      read = true;
      store.set(next);
      writeSetting(key, next);
    },
  };
}

const song = lookStore(SETTINGS.songLook, SONG_LOOKS);
const tape = lookStore(SETTINGS.tapeLook, TAPE_LOOKS);
const motion = lookStore(SETTINGS.coverMotion, MOTIONS);
const beats = lookStore(SETTINGS.beatFeel, ['off', 'on'] as const);
const arm = lookStore(SETTINGS.tonearm, ['off', 'on'] as const);

export const useSongLook = song.use;
export const setSongLook = song.set;
export const useTapeLook = tape.use;
export const setTapeLook = tape.set;
export const useCoverMotion = motion.use;
export const setCoverMotion = motion.set;

/**
 * A light knock under the finger on each beat, while the player is open and
 * the music plays: Settings → Player, beside what moves with the music. Off
 * unless asked for, and as quiet as the vibration settings make it.
 */
export const useBeatFeel = (): boolean => beats.use() === 'on';
export const setBeatFeel = (on: boolean): void => beats.set(on ? 'on' : 'off');

/** The arm over a record, its needle going in from the edge as the song goes on: off unless asked for. */
export const useTonearm = (): boolean => arm.use() === 'on';
export const setTonearm = (on: boolean): void => arm.set(on ? 'on' : 'off');
