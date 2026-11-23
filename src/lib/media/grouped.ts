import { creditReader } from '../db/credits';
import { albumsOf } from './albums';
import { artistsOf } from './artists';
import type { EnrichedTrack } from './enriched';
import { foldersOf } from './folders';

/**
 * The library grouped into records, artists and folders, kept for as long as
 * it is the same library: going from one record's page to the next, or back
 * to one, grouped the whole of it again every time. One of each is enough,
 * since there is one library.
 */
export const grouped = (() => {
  let albums: { of: EnrichedTrack[]; found: ReturnType<typeof albumsOf> } | null = null;
  let artists: { of: EnrichedTrack[]; t: unknown; found: ReturnType<typeof artistsOf> } | null = null;
  let folders: { of: EnrichedTrack[]; root: string; found: ReturnType<typeof foldersOf> } | null = null;
  return {
    albums(library: EnrichedTrack[]) {
      if (albums?.of !== library) albums = { of: library, found: albumsOf(library) };
      return albums.found;
    },
    // Told the language, for the one heading whose name is the app's own words.
    artists(library: EnrichedTrack[], t: Parameters<typeof artistsOf>[2]) {
      if (artists?.of !== library || artists.t !== t) artists = { of: library, t, found: artistsOf(library, creditReader(), t) };
      return artists.found;
    },
    folders(library: EnrichedTrack[], root: string) {
      if (folders?.of !== library || folders.root !== root) folders = { of: library, root, found: foldersOf(library, root) };
      return folders.found;
    },
  };
})();

