/**
 * The id of the track the player has, for code outside React that has to
 * leave it alone: writing into files, which must not touch a file being
 * read. Set by the player as its track changes; null with nothing loaded.
 */
let current: string | null = null;

export function currentTrackId(): string | null {
  return current;
}

export function setCurrentTrackId(id: string | null): void {
  current = id;
}
