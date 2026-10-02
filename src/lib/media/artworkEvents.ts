let revision = 0;
const listeners = new Set<() => void>();
export const artworkRevision = () => revision;
export function subscribeArtwork(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function artworkChanged() {
  revision += 1;
  for (const listener of listeners) listener();
}
