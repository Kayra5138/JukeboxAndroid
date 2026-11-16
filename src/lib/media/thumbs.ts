import { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';

/**
 * Small copies of the covers, for where a cover is drawn small: see
 * `Thumbs.kt`, which makes them. A cover kept as it came is a thousand
 * pixels across and more, and is read whole whatever size it is drawn at.
 */

/** The longest side of a copy, in pixels: as `Thumbs.SIDE`. */
const SIDE = 192;

/** Where the copies are, once known, and which are made. */
let folder: string | null = null;
const made = new Set<string>();
/** Copies being made, so that two covers of one record ask once. */
const making = new Map<string, Promise<string | null>>();

/** Asked once, as the app starts: which copies are there already. */
const ready: Promise<void> = (async () => {
  try {
    const answer = await JukeboxAudio.thumbsMadeAsync?.();
    if (!answer) return;
    folder = answer.dir.endsWith('/') ? answer.dir.slice(0, -1) : answer.dir;
    for (const name of answer.names) made.add(name);
  } catch {
    // No copies, then: covers are drawn from themselves, as they were.
  }
})();

/** A name for the copy of [uri]: two hashes of it, side by side. */
export function thumbName(uri: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ uri.length;
  for (let i = 0; i < uri.length; i++) {
    const code = uri.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995) ^ (b >>> 13);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** Whether a cover drawn [size] across (in points) is drawn small enough for a copy to do. */
export function smallEnough(size: number): boolean {
  return size * PixelRatio.get() <= SIDE * 1.15;
}

/** The copy of [uri], if it is made and known to be: at once, or null. */
function thumbNow(uri: string): string | null {
  const name = thumbName(uri);
  return folder && made.has(name) ? `${folder}/${name}.jpg` : null;
}

/** The copy of [uri], made if it is not yet; null where it cannot be. */
export function thumbOf(uri: string): Promise<string | null> {
  const name = thumbName(uri);
  const already = making.get(name);
  if (already) return already;
  const asking = (async () => {
    await ready;
    if (folder && made.has(name)) return `${folder}/${name}.jpg`;
    const answer = (await JukeboxAudio.thumbAsync?.(uri, name).catch(() => null)) ?? null;
    if (answer) made.add(name);
    return answer;
  })();
  making.set(name, asking);
  void asking.finally(() => making.delete(name));
  return asking;
}

/**
 * What to draw a cover [size] across from: the small copy of [uri] where it
 * is drawn small and is one of the app's own files, and [uri] itself
 * otherwise. Null while a copy is still being made, the first time it is
 * drawn: a blank for a moment, rather than the whole picture read anyway.
 */
export function useCoverAt(uri: string | null | undefined, size: number | undefined): string | null {
  return useCover(uri, size != null && smallEnough(size));
}

/**
 * The small copy of [uri] whatever size it is drawn at, where [small] says
 * so: for a picture that is drawn small for now, as the records of the rack
 * seen from far off. [uri] itself where it is not one of the app's files.
 */
export function useThumb(uri: string | null | undefined, small: boolean): string | null {
  return useCover(uri, small);
}

function useCover(uri: string | null | undefined, small: boolean): string | null {
  const wanted = uri != null && small && uri.startsWith('file://');
  const [thumb, setThumb] = useState<{ of: string; uri: string | null } | null>(() =>
    wanted ? { of: uri, uri: thumbNow(uri) } : null
  );
  useEffect(() => {
    if (!wanted) return;
    const now = thumbNow(uri);
    if (now) {
      setThumb({ of: uri, uri: now });
      return;
    }
    let cancelled = false;
    void thumbOf(uri).then((answer) => {
      // A cover that has no copy to be had is drawn from itself.
      if (!cancelled) setThumb({ of: uri, uri: answer ?? uri });
    });
    return () => {
      cancelled = true;
    };
  }, [uri, wanted]);
  if (!wanted) return uri ?? null;
  // Another cover's copy is never shown while this one's is being found.
  return thumb?.of === uri ? thumb.uri : thumbNow(uri);
}
