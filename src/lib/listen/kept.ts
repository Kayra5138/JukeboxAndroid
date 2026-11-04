import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';

/**
 * The songs listened to that were kept, each by the song of the library it
 * became. A song kept while it plays goes on playing from its own copy
 * under its old name, and the queue keeps that name after the app starts
 * again; whatever is asked of it meanwhile — whether it is a favorite, to
 * be a favorite no longer — is asked of the song it is now. Kept in a
 * setting, the latest few, since nothing else knows the one from the other.
 */

const MOST = 50;

function read(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(readSetting(SETTINGS.listenKept) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** [trackId] as the song of the library it became, where it is a song listened to and kept; as it is otherwise. */
export function keptAs(trackId: string): string {
  return trackId.startsWith('listen:') ? (read()[trackId] ?? trackId) : trackId;
}

/** [listened] noted as kept as [kept]. */
export function noteKept(listened: string, kept: string): void {
  const all = read();
  delete all[listened];
  all[listened] = kept;
  const entries = Object.entries(all);
  writeSetting(SETTINGS.listenKept, JSON.stringify(Object.fromEntries(entries.slice(-MOST))));
}
