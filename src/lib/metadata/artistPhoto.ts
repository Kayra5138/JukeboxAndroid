import { request, USER_AGENT } from './http.ts';
import { MIN_ARTIST_SCORE, musicBrainzGet } from './musicbrainz.ts';

/**
 * A picture of the person, which no music catalogue will give you.
 *
 * Covers are everywhere and photographs are not: the stores licence their
 * artist portraits and say so, so the only ones that can be put on a card
 * somebody then posts are the ones already published for reuse. MusicBrainz is
 * the way in — it does not host pictures, but it records which Wikimedia
 * Commons file is the artist's, and Commons carries the licence and the
 * photographer's name alongside the file. That pairing is the reason this
 * source was chosen over the easier ones: the chain ends with everything
 * needed to credit the photograph, and a photograph that cannot be credited is
 * one this app is not allowed to share.
 *
 * Three requests, each of which can end the chain quietly. Nothing found is an
 * ordinary answer — most artists in a personal library have no Commons file at
 * all — and the caller is expected to fall back to the album cover rather than
 * treat it as a failure.
 */

/**
 * How wide a copy to ask Commons for.
 *
 * The originals are photographs at full camera resolution, tens of megabytes of
 * them, for a picture drawn at a hundred points across. Commons renders a thumb
 * at whatever width is asked for, and 640 is enough for the poster-sized copy
 * the recap writes out at three times the card's width.
 */
const THUMBNAIL_WIDTH = 640;

/** The file page a MusicBrainz `image` relation points at. */
const COMMONS_FILE = /^https?:\/\/commons\.wikimedia\.org\/wiki\/File:([^?#]+)/;

/** What the chain produces: somewhere to fetch the picture, and its terms. */
export type ArtistPhotoSource = {
  /** A rendered copy, not the original. */
  url: string;
  /** Who took it, as Commons records them; null when the file does not say. */
  credit: string | null;
  /** The short name of the licence, e.g. `CC BY-SA 4.0`. */
  licence: string;
};

type ArtistSearch = { artists?: { id: string; name: string; score: number }[] };
type ArtistRelations = { relations?: { type?: string; url?: { resource?: string } }[] };
type ImageInfo = {
  thumburl?: string;
  url?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
};
type CommonsAnswer = { query?: { pages?: Record<string, { imageinfo?: ImageInfo[] } | undefined> } };

/**
 * The artist the search is confident about, if it is confident about one.
 *
 * The same bar the genre lookup uses, and for the same reason — see
 * {@link MIN_ARTIST_SCORE}. Only the first result is asked for: this is a
 * question about a name the user's own files carry, so the answer is either the
 * top hit or nobody.
 */
export function confidentArtistId(search: ArtistSearch): string | null {
  const best = search.artists?.[0];
  return best && best.score >= MIN_ARTIST_SCORE ? best.id : null;
}

/**
 * The Commons file an artist's relations name, as a bare file name.
 *
 * Only `commons.wikimedia.org` file pages are read. An `image` relation is
 * free-form enough to point at a band's own website or at a Wikipedia article,
 * and neither of those comes with a licence anybody can rely on — so anything
 * that is not a Commons file is treated as no picture rather than followed.
 */
export function commonsFileOf(artist: ArtistRelations): string | null {
  for (const relation of artist.relations ?? []) {
    if (relation.type !== 'image') continue;
    const found = COMMONS_FILE.exec(relation.url?.resource ?? '');
    // Underscores and per-cent escapes are how the name travels in a url; the
    // API wants the title as it is written on the page.
    if (found?.[1]) return decodeURIComponent(found[1]).replace(/_/g, ' ');
  }
  return null;
}

/**
 * Where to ask Commons about one file, thumbnail and licence in one answer.
 *
 * Spelled out rather than handed to `URLSearchParams`, which on Hermes is a
 * cut-down polyfill that writes spaces as `+` — right for a submitted form and
 * wrong for the rest of the app, which escapes its queries the same way
 * everywhere and has no reason to depend on which of the two a wiki accepts.
 */
export function commonsQuery(file: string): string {
  const parameters: Record<string, string> = {
    action: 'query',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(THUMBNAIL_WIDTH),
    format: 'json',
  };
  const query = Object.entries(parameters)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `https://commons.wikimedia.org/w/api.php?${query}`;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/**
 * The plain words out of a scrap of HTML.
 *
 * Commons stores the photographer as markup, because on the file page it is a
 * link to their user page and frequently a nest of templates around it. Drawn
 * as it arrives, a credit reads `<a href="/wiki/User:Someone" title="...">`,
 * which is worse than no credit at all — so the tags come out, the handful of
 * entities that survive them are decoded, and what is left is a name.
 */
export function stripMarkup(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-fA-F]+|\w+);/g, (whole, name: string) => {
      if (name.startsWith('#')) {
        const code = Number(name.startsWith('#x') ? `0x${name.slice(2)}` : name.slice(1));
        return Number.isInteger(code) && code > 0 ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The picture and its terms, out of what Commons answered.
 *
 * A file with no stated licence is refused outright, even though it has a
 * perfectly good thumbnail. Everything here is going onto a card that gets
 * saved to the gallery and posted, and a picture whose terms are unknown cannot
 * honestly be published with them — an unnamed photographer can at least be
 * credited to the licence, a missing licence cannot be guessed at.
 */
export function photoFrom(answer: CommonsAnswer): ArtistPhotoSource | null {
  // The pages are keyed by page id, and `-1` is how a missing file is reported,
  // so they are read as a bag rather than looked up by name.
  const pages = Object.values(answer.query?.pages ?? {});
  const info = pages.map((page) => page?.imageinfo?.[0]).find((first) => first != null);

  const url = info?.thumburl ?? info?.url;
  const licence = stripMarkup(info?.extmetadata?.LicenseShortName?.value ?? '');
  if (!url || !licence) return null;

  const credit = stripMarkup(info?.extmetadata?.Artist?.value ?? '');
  return { url, credit: credit || null, licence };
}

/**
 * A photograph of `name`, or nothing.
 *
 * The search is a plain query and deliberately not the fielded `artist:` form.
 * Lucene splits the field's value on whitespace, so `artist:Şebnem Ferah` asks
 * for artists called `Şebnem` and finds none, and the diacritics make the
 * one-word remainder miss as well — the same name unfielded scores 100.
 *
 * Throws what the request layer throws. A caller has to be able to tell "there
 * is no picture" from "nobody answered", because the first is worth writing
 * down for good and the second is worth trying again this evening.
 */
export async function lookupArtistPhoto(
  name: string,
  signal?: AbortSignal
): Promise<ArtistPhotoSource | null> {
  const wanted = name.trim();
  if (!wanted) return null;

  const search = await musicBrainzGet<ArtistSearch>(
    `/artist/?query=${encodeURIComponent(wanted)}&fmt=json&limit=1`,
    signal
  );
  const id = confidentArtistId(search);
  if (!id) return null;

  const artist = await musicBrainzGet<ArtistRelations>(`/artist/${id}?inc=url-rels&fmt=json`, signal);
  const file = commonsFileOf(artist);
  if (!file) return null;

  const answer = await request<CommonsAnswer>(
    'Wikimedia Commons',
    commonsQuery(file),
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
    signal
  );
  return photoFrom(answer);
}
