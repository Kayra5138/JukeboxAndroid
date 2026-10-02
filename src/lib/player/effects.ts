import { useCallback, useEffect, useRef, useState } from 'react';

import JukeboxAudio, { type AudioEffects } from '../../../modules/jukebox-audio';

/**
 * The effects, their ready-made combinations, and the one way of talking to the
 * player about them.
 *
 * Here rather than in the screen that used to own all of it, because there are
 * now two places to choose an effect from: the full screen, and the handful of
 * chips in the player's own settings. Two copies of this list would be two
 * lists, and the first time one gained a treatment the other did not, a player
 * would offer a voice that the screen behind it could not switch off.
 */

export const BLANK: AudioEffects = {
  preampDb: 0,
  width: 1,
  balance: 0,
  swap: false,
  crossfeed: 0,
  rotate: 0,
  rotateSeconds: 12,
  voice: 'off',
  voiceMix: 1,
};

/**
 * The treatments, in the order they are worth trying.
 *
 * `mix` is how much of each was actually heard when it was chosen, which is
 * what picking one sets. Only the robot wanted any of the record left under it.
 */
export const VOICES: { id: AudioEffects['voice']; name: string; hint: string; mix: number }[] = [
  { id: 'off', name: 'Off', hint: 'The record as it is', mix: 1 },
  { id: 'robot', name: 'Robot', hint: 'Rung against a low tone — metallic, bell-like', mix: 0.85 },
  { id: 'vintage', name: 'Vintage', hint: 'Fewer bits, a coarser clock, and the top taken off', mix: 1 },
  { id: 'swirl', name: 'Swirl', hint: 'A slow sweep, like a jet passing over', mix: 0.9 },
  { id: 'chipmunk', name: 'Chipmunk', hint: 'Up a fifth, and nothing moved in time', mix: 1 },
  { id: 'squeak', name: 'More chipmunk', hint: 'A whole octave, past being a voice', mix: 1 },
];

/**
 * Ready-made settings, because most of what people want from these is one of
 * four or five combinations and nobody wants to find them with sliders.
 */
export const PRESETS: { name: string; hint: string; of: Partial<AudioEffects> }[] = [
  { name: 'Off', hint: 'The recording as it is', of: BLANK },
  { name: 'Mono', hint: 'Both ears the same — for one earbud', of: { width: 0 } },
  { name: 'Wide', hint: 'The sides pushed out', of: { width: 1.5 } },
  {
    name: 'Headphones',
    hint: 'Takes hard-panned mixes out of your skull',
    of: { crossfeed: 0.6 },
  },
  {
    name: '8D',
    hint: 'The sound turns slowly around you',
    of: { rotate: 0.9, rotateSeconds: 12, crossfeed: 0.4 },
  },
  { name: 'Karaoke-ish', hint: 'Pushes the middle away', of: { width: 2, preampDb: -3 } },
];

/**
 * The fields a preset speaks for, which is everything except the voice.
 *
 * The two used to be chosen from separate lists and could therefore be defined
 * against the whole record: picking `Mono` meant "these settings and no
 * others", voice included. Now they sit in one row, where that would mean
 * reaching for a stereo shape silently switched the voice off -- so a preset
 * now describes only its own half, and the two halves are set independently.
 */
export const SHAPE_KEYS = [
  'preampDb',
  'width',
  'balance',
  'swap',
  'crossfeed',
  'rotate',
  'rotateSeconds',
] as const satisfies readonly (keyof AudioEffects)[];

/** Everything a preset sets, with the voice left exactly as it was found. */
export function shapeOf(of: Partial<AudioEffects>): Partial<AudioEffects> {
  const full: Partial<AudioEffects> = {};
  for (const key of SHAPE_KEYS) Object.assign(full, { [key]: of[key] ?? BLANK[key] });
  return full;
}

/** Which preset the stereo half is sitting on, ignoring the voice entirely. */
export function shapePresetFor(settings: AudioEffects | null): string | null {
  if (!settings) return null;
  const found = PRESETS.find((preset) => {
    const want = shapeOf(preset.of);
    return SHAPE_KEYS.every((key) => {
      const here = settings[key];
      const there = want[key];
      if (typeof here === 'number' && typeof there === 'number') {
        return Math.abs(here - there) < 0.001;
      }
      return here === there;
    });
  });
  return found?.name ?? null;
}

/** Nothing on at all, which is the one chip that speaks for both halves. */
export function isBlank(settings: AudioEffects | null): boolean {
  return settings != null && matches(settings, BLANK);
}

/**
 * Whether the current settings are some preset and nothing else.
 *
 * Numbers are compared with room to spare rather than exactly. These come back
 * from the player as 32-bit floats, so a nine tenths sent across returns as
 * 0.899999976 — near enough for the sound and not near enough for `===`, which
 * left every preset looking unselected the moment the screen was reopened.
 */
export function matches(settings: AudioEffects, of: Partial<AudioEffects>): boolean {
  const full = { ...BLANK, ...of };
  return (Object.keys(full) as (keyof AudioEffects)[]).every((key) => {
    const here = settings[key];
    const there = full[key];
    if (typeof here === 'number' && typeof there === 'number') {
      return Math.abs(here - there) < 0.001;
    }
    return here === there;
  });
}

/**
 * How often a drag is allowed to reach the player, in milliseconds.
 *
 * None of these rebuild anything: the processor reads the record on its next
 * buffer and carries on. The throttle is only here so a gesture is not a
 * hundred writes to a file.
 */
const SEND_EVERY_MS = 120;

/**
 * The player's effects, read once and written back as they are changed.
 *
 * [enabled] is for the sheet in the player, which is mounted long before it is
 * opened: asking the player for its effects is a call across the bridge, and
 * doing it on every player mount to fill a panel nobody has opened is work for
 * nothing.
 *
 * Read again each time it turns true rather than once, because the same
 * settings can be changed from the effects screen: a sheet that read on first
 * open and cached would show the voice that was chosen before the user went to
 * that screen and picked a different one. Skipped while a write is still
 * waiting on the throttle, or reopening quickly would read back the values the
 * player has not been told about yet and show the change undoing itself.
 */
export function useAudioEffects(enabled = true) {
  const [settings, setSettings] = useState<AudioEffects | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const sending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wanted = useRef<AudioEffects>(BLANK);
  const sentAt = useRef(0);

  useEffect(() => {
    if (!enabled || sending.current) return;

    if (!JukeboxAudio.getAudioEffectsAsync) {
      setFailure('Install the updated Android build to use effects.');
      setSettings(BLANK);
      return;
    }
    void JukeboxAudio.getAudioEffectsAsync()
      .then((current) => {
        wanted.current = current;
        setSettings(current);
      })
      .catch(() => {
        setSettings(BLANK);
        setFailure('Could not read the effects. They are off until this is retried.');
      });
  }, [enabled]);

  const push = useCallback(() => {
    sending.current = null;
    sentAt.current = Date.now();
    if (!JukeboxAudio.setAudioEffectsAsync) return;
    void JukeboxAudio.setAudioEffectsAsync(wanted.current).catch(() => {
      setFailure('That setting did not reach the player.');
    });
  }, []);

  /** Shown at once, told to the player at a rate a file can be written at. */
  const change = useCallback(
    (part: Partial<AudioEffects>) => {
      const next = { ...wanted.current, ...part };
      wanted.current = next;
      setSettings(next);
      setFailure(null);
      if (sending.current) return;
      const since = Date.now() - sentAt.current;
      if (since >= SEND_EVERY_MS) push();
      else sending.current = setTimeout(push, SEND_EVERY_MS - since);
    },
    [push]
  );

  useEffect(
    () => () => {
      if (sending.current) clearTimeout(sending.current);
    },
    []
  );

  return { settings, failure, change };
}
