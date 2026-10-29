/**
 * Said whenever what is in a list changes, by whatever changed it: for what
 * shows whether one track is in a list without reading the list each time,
 * which is the heart on the player and the menu's Favorites entry.
 */
let version = 0;
const listeners = new Set<() => void>();

export const listsVersion = (): number => version;

export function subscribeLists(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listsChanged(): void {
  version += 1;
  for (const listener of [...listeners]) listener();
}
