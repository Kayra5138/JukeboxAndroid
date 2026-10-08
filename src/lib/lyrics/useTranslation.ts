import { useEffect, useMemo, useState } from 'react';

import { ROMAJI } from './segments.ts';
import { translateLines, type TranslationOutcome } from './translate.ts';
import { useLyricsTarget } from './useTarget.ts';
import { useT, type Strings } from '../i18n/index.ts';

export type TranslationState = {
  /** One line for every line given, or null when there is nothing to show. */
  lines: string[] | null;
  working: boolean;
  /** Why there is nothing, when that is worth saying. */
  note: string | null;
};

const IDLE: TranslationState = { lines: null, working: false, note: null };
const WORKING: TranslationState = { lines: null, working: true, note: null };

/** [t] is the language the note is written in. */
function describe(outcome: TranslationOutcome, t: Strings): TranslationState {
  const say = t.lyrics.translation;
  switch (outcome.kind) {
    case 'translated':
      return { lines: outcome.lines, working: false, note: null };
    case 'same-language':
      return { lines: null, working: false, note: null };
    case 'unsupported':
      return {
        lines: null,
        working: false,
        note:
          // Worth telling apart: this one has an answer, which is the same
          // song's words in the writing they were written in.
          outcome.language === ROMAJI ? say.romaji : say.unsupported,
      };
    case 'unavailable':
      return { lines: null, working: false, note: say.unavailable };
    case 'failed':
      return {
        lines: null,
        working: false,
        note: outcome.misaligned ? say.misaligned : (outcome.message ?? say.failed),
      };
  }
}

/**
 * The translation of a set of lyric lines, made once and kept.
 *
 * Only runs while `enabled`, because the first translation of a language
 * fetches a model of some thirty megabytes — not something to set off because a
 * track happened to start.
 *
 * Into the language chosen in Settings unless [target] names another. Each
 * target's translation is stored apart, so changing the choice and changing it
 * back costs nothing the second time.
 */
export function useTranslation(
  trackId: string | null,
  lines: string[],
  enabled: boolean,
  target?: string,
  /** When each line is sung, for timed lyrics; see `translateLines`. */
  times: number[] | null = null
): TranslationState {
  /*
    What happened rather than the words for it: the note is written when it is
    read, so it is in the language the app is in then and not the one it was in
    when the translation came back.
  */
  const [state, setState] = useState<TranslationOutcome | 'working' | null>(null);
  const t = useT();
  const chosen = useLyricsTarget();
  const into = target ?? chosen;

  /*
    The lines are rebuilt on every render by whoever parsed them, so the array
    itself is a new object each time and cannot be a dependency. Their content
    is what matters, and it only changes when the track or the lyrics do.
  */
  const signature = lines.length;

  useEffect(() => {
    if (!trackId || !enabled || lines.length === 0) {
      setState(null);
      return;
    }

    let cancelled = false;
    setState('working');

    void translateLines(trackId, lines, into, times).then((outcome) => {
      if (!cancelled) setState(outcome);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, enabled, into, signature]);

  /*
    Made once for each outcome and language, so that whoever is handed it sees
    the same object until one of those changes; the lines inside are the
    outcome's own either way.
  */
  return useMemo(
    () => (state === null ? IDLE : state === 'working' ? WORKING : describe(state, t)),
    [state, t]
  );
}
