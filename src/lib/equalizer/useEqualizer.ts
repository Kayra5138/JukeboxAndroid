import { useCallback, useEffect, useRef, useState } from 'react';

import JukeboxAudio, {
  type EqualizerSettings,
  type EqualizerState,
  type ParametricEqualizer,
} from '../../../modules/jukebox-audio';
import { forBridge } from './bridge';

/** A change the player would not take, said in the log; see `settle`. */
const refused = (failure: unknown) => console.warn('The equalizer could not be set', failure);

/** The part of the equalizer's settings that is the curve and the curves kept. */
type Shape = Omit<ParametricEqualizer, 'notice'>;

/**
 * A step of a drag sent to the player, in force and not stored: the finger
 * let go of, what it was let go at is stored ([settle]). Stored, as an older
 * build can only do.
 */
function preview(next: EqualizerSettings): Promise<unknown> {
  const sent = forBridge(next);
  return (JukeboxAudio.previewEqualizerAsync ? JukeboxAudio.previewEqualizerAsync(sent) : JukeboxAudio.setEqualizerAsync!(sent)).catch(refused);
}

/**
 * The equalizer as the player has it, and the ways to change it: read once
 * as this is first drawn, and kept as the player answers each change. For
 * the page Equalizer, and for its few quick choices beside the player.
 *
 * [push] reaches the player and nothing else, for a drag; [commit] takes
 * its answer as the new truth; [shape] changes the curve or the curves
 * kept, drawn at once, and stored when [done].
 */
export function useEqualizer() {
  const [state, setState] = useState<EqualizerState | null>(null);
  const [missing, setMissing] = useState(false);

  /*
    The settings as they stand, read by the drag handlers.
    A slider sends the whole document on every step of a drag, and building it
    from the render's props would send the values as they were when the drag
    began — so the band being moved would be right and the ones beside it
    would snap back to wherever they were a moment ago.
  */
  const live = useRef<EqualizerSettings | null>(null);

  const remember = useCallback((next: EqualizerState) => {
    live.current = settingsOf(next);
    setState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      // Optional on the module type because an older APK will not have it. The
      // screen has to say so rather than crash on a phone mid-update.
      if (!JukeboxAudio.getEqualizerAsync) {
        setMissing(true);
        return;
      }
      remember(await JukeboxAudio.getEqualizerAsync());
    })();
  }, [remember]);

  /**
   * Sends what `live` now holds and takes the answer as the new truth —
   * unless something else has been changed while the answer was on its way,
   * in which case the answer is about a moment that has passed and the one
   * that follows it will say better.
   */
  const settle = useCallback(async () => {
    const sent = live.current;
    if (!sent || !JukeboxAudio.setEqualizerAsync) return;
    try {
      const answer = await JukeboxAudio.setEqualizerAsync(forBridge(sent));
      if (live.current === sent) remember(answer);
    } catch (failure) {
      // Said in the log at least: a refusal here used to leave the screen
      // exactly as it was, which looks like a switch that is stuck.
      refused(failure);
    }
  }, [remember]);

  /** Sends to the player and nothing else — for the tone sliders during a drag. */
  const push = useCallback((changes: Partial<EqualizerSettings>) => {
    const current = live.current;
    if (!current || !JukeboxAudio.setEqualizerAsync) return;
    const next = { ...current, ...changes };
    live.current = next;
    void preview(next);
  }, []);

  /** The same, and then takes the answer as the new truth. */
  const commit = useCallback(
    async (changes: Partial<EqualizerSettings>) => {
      const current = live.current;
      if (!current) return;
      live.current = { ...current, ...changes };
      await settle();
    },
    [settle]
  );

  /**
   * Changes the curve, or the curves kept.
   *
   * Unlike the tone sliders, this is drawn at once and on every step of a
   * drag, not only when the finger lifts: the curve at the top of the screen
   * is the point of it, and a curve that stood still until the slider was
   * let go would be a picture of the last setting. The cost is a render per
   * step, which the slider already holds to twenty-five a second — the same
   * throttle that keeps a drag from flooding the player.
   */
  const shape = useCallback(
    (changes: Partial<Shape>, done: boolean) => {
      const current = live.current;
      if (!current?.parametric || !JukeboxAudio.setEqualizerAsync) return;
      const parametric = { ...current.parametric, ...changes };
      const next = { ...current, parametric };
      live.current = next;
      setState((before) =>
        before?.parametric ? { ...before, parametric: { ...before.parametric, ...changes } } : before
      );
      if (done) void settle();
      else void preview(next);
    },
    [settle]
  );

  return { state, setState, missing, live, push, commit, shape };
}

function settingsOf(state: EqualizerState): EqualizerSettings {
  const settings: EqualizerSettings = {
    enabled: state.enabled,
    bass: state.bass,
    virtualizer: state.virtualizer,
    loudness: state.loudness,
  };
  // Without the note about the old equalizer, which is the player's to keep or
  // drop and not a setting.
  if (state.parametric) {
    settings.parametric = {
      bands: state.parametric.bands,
      preampDb: state.parametric.preampDb,
      presets: state.parametric.presets,
    };
  }
  // Handed back as they came, and only if they came; see `EqualizerState`.
  if (state.preset !== undefined) settings.preset = state.preset;
  if (state.bands !== undefined) settings.bands = state.bands;
  return settings;
}
