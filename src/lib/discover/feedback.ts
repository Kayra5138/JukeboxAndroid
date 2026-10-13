import { db } from '../db/index.ts';
import {
  blockArtistIn,
  blockedArtistsIn,
  unblockArtistIn,
  type BlockedArtist,
  type ExclusionRow,
  type ExclusionStore,
} from './taste.ts';

/**
 * `discover_exclusions`, as the three things `taste.ts` does to it.
 *
 * The table already holds every song that was kept, sent away, shown and not
 * kept, or never found. An artist somebody never wants to hear of again goes
 * in the same table as a row of its own kind — reason `artist`, with no end —
 * and needs nothing new made for it: the table's `reason` is free text, the
 * backup carries every row as it is, and a row with no end is kept over any
 * other when two phones' tables are merged.
 *
 * Because the set of things to keep away from is read from every row's `id`
 * and `song_key`, an artist's row is in that set from the moment it is
 * written, and `selectSongs` reads it there.
 */
const table: ExclusionStore = {
  // Every column, so that a `created_at` is read from the day there is one.
  all: () => db().getAllSync<ExclusionRow>('SELECT * FROM discover_exclusions'),
  put: (row) => {
    db().runSync(
      `INSERT INTO discover_exclusions (id, song_key, title, artist, reason, until_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         song_key = excluded.song_key, artist = excluded.artist,
         reason = excluded.reason, until_at = excluded.until_at, created_at = excluded.created_at`,
      row.id,
      row.song_key,
      row.title,
      row.artist,
      row.reason,
      row.until_at,
      // Every row written from here is written now.
      row.created_at ?? Date.now()
    );
  },
  remove: (id) => {
    db().runSync('DELETE FROM discover_exclusions WHERE id = ?', id);
  },
};

/** Everything the table holds, for the build to read what was said out of. */
export function exclusionRows(): ExclusionRow[] {
  return table.all();
}

/**
 * Never this artist again.
 *
 * By the first name of the credit, and by the catalogue's id for them where
 * the song that prompted it had one — a name is spelled `Sigur Rós` here and
 * `Sigur Ros` there, and the id is the same artist either way.
 */
export function blockArtist(artist: string, mbid?: string | null): void {
  blockArtistIn(table, artist, mbid);
}

/** By name, or by the `id` {@link blockedArtists} gave. */
export function unblockArtist(nameOrId: string): void {
  unblockArtistIn(table, nameOrId);
}

export function blockedArtists(): BlockedArtist[] {
  return blockedArtistsIn(table);
}

/** The catalogue ids of the blocked, for whoever keeps away by id. */
export function blockedArtistIds(): Set<string> {
  return new Set(blockedArtists().flatMap((artist) => (artist.mbid ? [artist.mbid] : [])));
}
