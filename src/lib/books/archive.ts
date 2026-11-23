import { request } from '../metadata/http.ts';

/**
 * Books from the Internet Archive: LibriVox's recordings of books out of
 * copyright, read aloud by volunteers and kept there, and any other audio
 * the Archive holds, by its address. Asked of the Archive's own search and
 * metadata, which anybody may ask without a key. The reading here is kept
 * apart from the asking, so it can be tested.
 */

export type BookHit = { id: string; title: string; author: string | null; cover: string };

export type BookPart = {
  /** The file's name in the item, which is also how it is fetched. */
  name: string;
  title: string;
  durationSec: number | null;
  bytes: number | null;
  url: string;
};

export type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  cover: string;
  parts: BookPart[];
};

/** The picture the Archive keeps of an item. */
export const coverOf = (id: string) => `https://archive.org/services/img/${encodeURIComponent(id)}`;

/** The item an Archive address is of — `archive.org/details/<id>` or `/download/<id>/…` — or null. */
export function identifierOf(text: string): string | null {
  const found = /^https?:\/\/(?:www\.)?archive\.org\/(?:details|download)\/([A-Za-z0-9._-]+)/i.exec(text.trim());
  return found ? found[1]! : null;
}

/** `57:54`, `1:02:03`, `3474.52` or a number, as seconds. */
export function durationOf(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(':');
  if (parts.length === 0 || parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    const number = Number(part);
    if (part === '' || !Number.isFinite(number)) return null;
    seconds = seconds * 60 + number;
  }
  return seconds > 0 ? seconds : null;
}

const first = (value: unknown): string | null =>
  Array.isArray(value) ? first(value[0]) : typeof value === 'string' && value.trim() ? value.trim() : null;

/** A description's HTML as plain words. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** The hits of a search of the Archive, as it answers one. */
export function hitsOf(json: unknown): BookHit[] {
  const docs = (json as { response?: { docs?: unknown[] } })?.response?.docs ?? [];
  return docs.flatMap((doc) => {
    const item = doc as Record<string, unknown>;
    const id = first(item.identifier);
    if (!id) return [];
    return [{ id, title: first(item.title) ?? id, author: first(item.creator), cover: coverOf(id) }];
  });
}

/**
 * The formats a part may come in, in the order they are taken: the small one
 * LibriVox makes of each, which is plenty for a voice and half the size, then
 * whatever else is an MP3.
 */
const FORMATS = ['64Kbps MP3', 'VBR MP3', '128Kbps MP3', 'MP3'];

/** "01 - A Scandal in Bohemia" as "A Scandal in Bohemia": its number is its place, which the tape keeps anyway. */
function titleOf(title: string): string {
  return title.replace(/^\s*\d{1,4}\s*[-–.:)]\s*/, '').trim() || title.trim();
}

/** An item's metadata, as the Archive answers for one, read as a book: its parts in their order, each in one format. */
export function bookOf(id: string, json: unknown): Book | null {
  const answer = json as { metadata?: Record<string, unknown>; files?: Record<string, unknown>[] };
  const meta = answer?.metadata;
  if (!meta) return null;
  const files = answer.files ?? [];
  const format = FORMATS.find((wanted) => files.some((file) => file.format === wanted));
  const chosen = format ? files.filter((file) => file.format === format) : [];
  const parts = chosen
    .map((file) => {
      const name = String(file.name ?? '');
      return {
        name,
        title: titleOf(first(file.title) ?? name.replace(/\.[^.]+$/, '').replace(/_64kb$/, '').replace(/_/g, ' ')),
        durationSec: durationOf(file.length),
        bytes: Number(file.size) > 0 ? Number(file.size) : null,
        url: `https://archive.org/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`,
        order: Number(first(file.track) ?? NaN),
      };
    })
    .filter((part) => part.name)
    // By the number each is given, where they are; else by name, which numbers them too.
    .sort((a, b) =>
      Number.isFinite(a.order) && Number.isFinite(b.order) && a.order !== b.order
        ? a.order - b.order
        : a.name.localeCompare(b.name, undefined, { numeric: true })
    )
    .map(({ order: _order, ...part }) => part);
  const description = first(meta.description);
  return {
    id,
    title: first(meta.title) ?? id,
    author: first(meta.creator),
    description: description ? plain(description).slice(0, 1200) : null,
    cover: coverOf(id),
    parts,
  };
}

/**
 * The languages LibriVox's books can be searched in, each by its own name
 * and as the Archive writes it on them — mostly by its three letters, some
 * by two different three, a few by name. Only those with books enough to be
 * worth a choice: there are none in Turkish at all.
 */
export const BOOK_LANGUAGES: readonly { code: string; name: string; archive: readonly string[] }[] = [
  { code: 'en', name: 'English', archive: ['eng', 'English'] },
  { code: 'de', name: 'Deutsch', archive: ['deu', 'ger', 'German'] },
  { code: 'es', name: 'Español', archive: ['spa', 'Spanish'] },
  { code: 'fr', name: 'Français', archive: ['fre', 'fra', 'French'] },
  { code: 'it', name: 'Italiano', archive: ['ita', 'Italian'] },
  { code: 'nl', name: 'Nederlands', archive: ['nld', 'dut', 'Dutch'] },
  { code: 'pt', name: 'Português', archive: ['por', 'Portuguese'] },
  { code: 'ru', name: 'Русский', archive: ['rus', 'Russian'] },
  { code: 'pl', name: 'Polski', archive: ['pol', 'Polish'] },
  { code: 'el', name: 'Ελληνικά', archive: ['ell', 'grc', 'gre', 'Greek'] },
  { code: 'ja', name: '日本語', archive: ['jpn', 'Japanese'] },
  { code: 'zh', name: '中文', archive: ['zho', 'chi', 'Chinese'] },
  { code: 'la', name: 'Latina', archive: ['lat', 'Latin'] },
];

/** [BOOK_LANGUAGES] with the app's own [language] (`pt-BR`, `zh-Hans`…) first, where there are books in it. */
export function bookLanguagesFor(language: string): typeof BOOK_LANGUAGES {
  const own = language.split('-')[0]!.toLowerCase();
  return [...BOOK_LANGUAGES.filter((one) => one.code === own), ...BOOK_LANGUAGES.filter((one) => one.code !== own)];
}

/** The language of books to search in, as it was last chosen ([saved]); else the app's, where there are books in it; else any (null). */
export function bookLanguageOf(saved: string | null, language: string): string | null {
  if (saved === 'all') return null;
  if (saved && BOOK_LANGUAGES.some((one) => one.code === saved)) return saved;
  const own = language.split('-')[0]!.toLowerCase();
  return BOOK_LANGUAGES.some((one) => one.code === own) ? own : null;
}

/** What the Archive is asked, for books by [words] (none, for the most listened to) in [language] (null, any). */
export function bookQuery(words: string, language: string | null): string {
  const term = words.trim().replace(/[()":*?]/g, ' ').trim();
  // Nothing asked: the most listened to of all of them, for somewhere to begin.
  const base = term ? `collection:(librivoxaudio) AND (title:(${term}) OR creator:(${term}))` : 'collection:(librivoxaudio)';
  const names = BOOK_LANGUAGES.find((one) => one.code === language)?.archive;
  return names ? `${base} AND language:(${names.join(' OR ')})` : base;
}

/**
 * Books by [words], from LibriVox's recordings at the Archive, the most
 * listened to first: by title or by author, in [language] or any.
 */
export async function searchBooks(words: string, language: string | null = null): Promise<BookHit[]> {
  const query = bookQuery(words, language);
  const fields = ['identifier', 'title', 'creator'].map((field) => `fl[]=${field}`).join('&');
  // Through `request`, which gives up after a while: a bare fetch to a server that never answered left the search turning for good.
  return hitsOf(
    await request<unknown>(
      'Internet Archive',
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&${fields}&rows=30&sort[]=downloads+desc&output=json`,
      {}
    )
  );
}

/** The book that is the Archive's item [id]. Throws where it cannot be had or holds nothing to listen to. */
export async function fetchBook(id: string): Promise<Book> {
  const book = bookOf(id, await request<unknown>('Internet Archive', `https://archive.org/metadata/${encodeURIComponent(id)}`, {}));
  if (!book || book.parts.length === 0) throw new Error('nothing to listen to');
  return book;
}
