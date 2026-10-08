import { useEffect, useState, useSyncExternalStore } from 'react';

import { currentTarget, TARGETS, targetFrom } from './target.ts';
import { translator } from './translateNative';
import { readSetting, SETTINGS, writeSetting } from '../db/index';

/** Reads the stored choice. Called once as the app starts, with the language and the theme. */
export function loadLyricsTarget(): void {
  try {
    currentTarget.set(targetFrom(readSetting(SETTINGS.lyricsTarget)));
  } catch {
    // English, which is what it was before there was a choice.
  }
}

export function chooseLyricsTarget(tag: string): void {
  const target = targetFrom(tag);
  currentTarget.set(target);
  writeSetting(SETTINGS.lyricsTarget, target);
}

/**
 * The language lyrics are translated into, watched: lyrics that are on screen
 * when it changes are translated again, into the new one.
 */
export function useLyricsTarget(): string {
  return useSyncExternalStore(currentTarget.subscribe, currentTarget.get);
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The targets this build says lyrics cannot be put into, for the picker to
 * leave out.
 *
 * `TARGETS` is every language there is a model for reading, and a language
 * can be read without there being a model that writes it. Only the native
 * side knows which, so it is asked, once, for each. Empty until it has
 * answered, and for good on a build that cannot be asked: offering a language
 * that then turns out not to work is what happened before there was a
 * question to put, and is better than offering none.
 */
export function useUnsupportedTargets(): ReadonlySet<string> {
  const [unsupported, setUnsupported] = useState(NONE);
  useEffect(() => {
    const native = translator;
    if (!native?.isTargetSupportedAsync) return;
    let live = true;
    void Promise.all(
      TARGETS.map(async (tag) => {
        try {
          return (await native.isTargetSupportedAsync?.(tag)) === false ? tag : null;
        } catch {
          return null;
        }
      })
    ).then((answers) => {
      const refused = answers.filter((tag): tag is string => tag !== null);
      if (live && refused.length > 0) setUnsupported(new Set(refused));
    });
    return () => {
      live = false;
    };
  }, []);
  return unsupported;
}
