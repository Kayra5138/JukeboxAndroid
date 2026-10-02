import { useEffect, useState } from 'react';

import { DEFAULT_TARGET, translateLines, type TranslationOutcome } from './translate.ts';

export type TranslationState = {
  /** One line for every line given, or null when there is nothing to show. */
  lines: string[] | null;
  working: boolean;
  /** Why there is nothing, when that is worth saying. */
  note: string | null;
};

const IDLE: TranslationState = { lines: null, working: false, note: null };

function describe(outcome: TranslationOutcome): TranslationState {
  switch (outcome.kind) {
    case 'translated':
      return { lines: outcome.lines, working: false, note: null };
    case 'same-language':
      return { lines: null, working: false, note: null };
    case 'unsupported':
      return { lines: null, working: false, note: 'No translation for this language.' };
    case 'unavailable':
      return { lines: null, working: false, note: 'Translation is not available on this device.' };
    case 'failed':
      return { lines: null, working: false, note: outcome.message };
  }
}

/**
 * The translation of a set of lyric lines, made once and kept.
 *
 * Only runs while `enabled`, because the first translation of a language
 * fetches a model of some thirty megabytes — not something to set off because a
 * track happened to start.
 */
export function useTranslation(
  trackId: string | null,
  lines: string[],
  enabled: boolean,
  target: string = DEFAULT_TARGET
): TranslationState {
  const [state, setState] = useState<TranslationState>(IDLE);

  /*
    The lines are rebuilt on every render by whoever parsed them, so the array
    itself is a new object each time and cannot be a dependency. Their content
    is what matters, and it only changes when the track or the lyrics do.
  */
  const signature = lines.length;

  useEffect(() => {
    if (!trackId || !enabled || lines.length === 0) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState({ lines: null, working: true, note: null });

    void translateLines(trackId, lines, target).then((outcome) => {
      if (!cancelled) setState(describe(outcome));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, enabled, target, signature]);

  return state;
}
