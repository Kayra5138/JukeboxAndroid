import { db } from './index.ts';
import { foldForMatch } from '../metadata/text.ts';

/**
 * A photograph found for an artist, and the words that have to go with it.
 *
 * The credit is not decoration. These pictures are on Commons under licences
 * that permit reuse and require attribution, and a recap card is redistributed
 * the moment it is saved or shared — so the licence travels with the file from
 * the lookup all the way to the corner of the card, and a picture that arrives
 * without one never gets this far.
 */
export type ArtistPhoto = {
  /** Where the copy on this phone lives. */
  uri: string;
  /** The photographer, or null where Commons does not name one. */
  credit: string | null;
  licence: string;
};

type Row = {
  photo_uri: string | null;
  credit: string | null;
  licence: string | null;
};

/**
 * Keyed on the folded name, so one artist is one lookup however their name is
 * spelled — the same key the genre lookup files them under.
 */
function keyOf(name: string): string {
  return foldForMatch(name);
}

/**
 * What is known about an artist's photograph.
 *
 * Three answers, not two: a photograph, `null` for an artist who has been
 * looked up and has none, and `undefined` for one nobody has asked about. The
 * middle one is what stops a library of artists with no Commons file from
 * spending three requests each on every recap.
 */
export function readArtistPhoto(name: string): ArtistPhoto | null | undefined {
  const row = db().getFirstSync<Row>(
    'SELECT photo_uri, credit, licence FROM artist_photos WHERE artist = ?',
    keyOf(name)
  );
  if (!row) return undefined;
  if (!row.photo_uri || !row.licence) return null;
  return { uri: row.photo_uri, credit: row.credit, licence: row.licence };
}

/** Write down what the lookup found, `null` included. */
export function saveArtistPhoto(name: string, photo: ArtistPhoto | null): void {
  db().runSync(
    `INSERT INTO artist_photos (artist, name, photo_uri, credit, licence, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(artist) DO UPDATE SET
       name = excluded.name, photo_uri = excluded.photo_uri, credit = excluded.credit,
       licence = excluded.licence, fetched_at = excluded.fetched_at`,
    keyOf(name),
    name,
    photo?.uri ?? null,
    photo?.credit ?? null,
    photo?.licence ?? null,
    Date.now()
  );
}
