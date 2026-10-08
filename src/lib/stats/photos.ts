import type { ArtistPhoto } from '../db/artistPhotos.ts';
import { strings, type Strings } from '../i18n/languages.ts';
import type { ReportCard } from './report.ts';

/**
 * Which picture a card draws, and what it then owes the photographer.
 *
 * Kept out of the drawing because it is a decision rather than a layout: a row
 * about an artist would rather show the artist than one of their records, a row
 * that has no photograph must be indistinguishable from one drawn before any of
 * this existed, and a card carrying a Commons photograph has to say so while a
 * card of album covers must not. Those are three rules that can be stated and
 * checked, so they are.
 */

/** Photographs by artist name, exactly as the cards spell it. */
export type Photos = ReadonlyMap<string, ArtistPhoto>;

/** Covers by track id, which is what a row falls back to. */
export type Covers = ReadonlyMap<string, string>;

/**
 * The photograph for an artist, where there is one to use.
 *
 * Only ever consulted for rows that are about people. A track and a genre have
 * no photograph by definition, and asking for one by the row's key would find
 * whatever artist happened to share a name with a song.
 */
export function photoFor(
  of: 'tracks' | 'artists' | 'genres',
  key: string,
  photos: Photos
): ArtistPhoto | undefined {
  return of === 'artists' ? photos.get(key) : undefined;
}

/**
 * The picture a row is drawn with: the photograph, else the cover it borrowed
 * before photographs existed, else nothing.
 *
 * The fallback is the whole reason this is a function. Most artists in a
 * personal library are not on Commons, and a chart where two of five rows have
 * a picture reads as broken — so a missing photograph is not a gap but simply
 * the old behaviour, and the card cannot tell which it is drawing.
 */
export function pictureFor(
  sample: string | null,
  covers: Covers,
  photo?: ArtistPhoto
): string | undefined {
  return photo?.uri ?? (sample ? covers.get(sample) : undefined);
}

/**
 * How a photograph is credited on a card.
 *
 * Photographer and licence, because that is what the licence asks for and it is
 * short enough to sit in a corner. Where Commons names nobody the licence still
 * has to be stated, so the line keeps its shape and loses only the name.
 *
 * The name and the licence are written exactly as they came in whatever [t]
 * the line is said in: they are the photographer's, and the licence's own
 * identifier is what makes it one. Only the word in front is translated.
 */
export function creditLine(photo: ArtistPhoto, t: Strings = strings()): string {
  return photo.credit
    ? t.stats.cards.credit(photo.credit, photo.licence)
    : t.stats.cards.creditUnnamed(photo.licence);
}

/**
 * Every credit a card owes, in the order its pictures are drawn, once each.
 *
 * Driven off the card rather than off the set of photographs found, because the
 * duty follows what is actually on the picture that gets saved and shared: a
 * card of album covers owes nothing and must stay clean, and a chart showing
 * three photographs by one person says their name once.
 */
export function creditsOn(card: ReportCard, photos: Photos, t: Strings = strings()): string[] {
  const shown: ArtistPhoto[] = [];

  if (card.kind === 'ranking' && card.of === 'artists') {
    for (const entry of card.entries) {
      const photo = photos.get(entry.key);
      if (photo) shown.push(photo);
    }
  }
  if (card.kind === 'closing' && card.artist) {
    const photo = photos.get(card.artist);
    if (photo) shown.push(photo);
  }

  return [...new Set(shown.map((photo) => creditLine(photo, t)))];
}
