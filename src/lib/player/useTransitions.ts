import { useCallback, useEffect, useRef, useState } from 'react';

import JukeboxAudio, { type TransitionSettings, type Transitions } from '../../../modules/jukebox-audio';
import type { Strings } from '../i18n/index';

/**
 * A change the player would not take, said in the log.
 *
 * Without this a refusal leaves the screen exactly as it was and says
 * nothing, which is how the equalizer came to look like a switch that was
 * stuck for as long as it did.
 */
const refused = (failure: unknown) => console.warn('The crossfade could not be set', failure);

/**
 * How one track gives way to the next, as the player has it, and the ways to
 * change it: read once as this is first drawn. For the page Crossfade, and
 * for its switch and overlap beside the player. [push] reaches the player
 * and nothing else, for a drag; [commit] takes its answer as the new truth.
 */
export function useTransitions() {
  const [state, setState] = useState<Transitions | null>(null);
  const [missing, setMissing] = useState(false);

  /*
    The settings as they stand, read by the drag handlers. A slider sends the
    whole document on every step of a drag, and building it from the render's
    props would send the other three durations as they were when the drag
    began.
  */
  const live = useRef<TransitionSettings | null>(null);

  const remember = useCallback((next: Transitions) => {
    const {
      maxAutoMs: _auto,
      maxManualMs: _manual,
      maxPauseMs: _pause,
      maxSeekMs: _seek,
      defaults: _defaults,
      ...settings
    } = next;
    live.current = settings;
    setState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      // Optional on the module type because an older APK will not have it.
      if (!JukeboxAudio.getTransitionsAsync) {
        setMissing(true);
        return;
      }
      remember(await JukeboxAudio.getTransitionsAsync());
    })();
  }, [remember]);

  /** Reaches the player and nothing else — for use during a drag. */
  const push = useCallback((changes: Partial<TransitionSettings>) => {
    const current = live.current;
    if (!current || !JukeboxAudio.setTransitionsAsync) return;
    const next = { ...current, ...changes };
    live.current = next;
    void JukeboxAudio.setTransitionsAsync(next).catch(refused);
  }, []);

  /** The same, and then takes the answer as the new truth. */
  const commit = useCallback(
    async (changes: Partial<TransitionSettings>) => {
      const current = live.current;
      if (!current || !JukeboxAudio.setTransitionsAsync) return;
      const next = { ...current, ...changes };
      live.current = next;
      try {
        remember(await JukeboxAudio.setTransitionsAsync(next));
      } catch (failure) {
        refused(failure);
      }
    },
    [remember]
  );

  return { state, missing, push, commit };
}

/**
 * Snapped, by an amount that suits the range.
 *
 * A tenth of a second across five seconds is fifty positions, which is about
 * as fine as a finger can place anyway. The same tenth across the one-second
 * seek slider would leave it ten positions wide, so the short ones step by
 * fifty milliseconds instead.
 */
export function roundTransition(milliseconds: number, ceiling: number): number {
  const step = ceiling <= 2_000 ? 50 : 100;
  return Math.round(milliseconds / step) * step;
}

/** A duration as it is written beside its slider: `Off` for none. */
export function transitionSeconds(milliseconds: number, t: Strings): string {
  if (milliseconds < 50) return t.common.off;
  const value = milliseconds / 1000;
  return t.sound.transitions.seconds(
    value % 1 === 0 ? String(value) : t.format.decimal(value, 2).replace(/0$/, '')
  );
}
