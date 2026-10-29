import { libraryRoot } from '../media/library.ts';
import { tapeFolderOf } from '../tapes/folders.ts';
import { carried } from '../youtube/carried.ts';
import { downloads } from '../youtube/native.ts';
import type { YouTubeVideo } from '../youtube/types.ts';
import type { Book, BookPart } from './archive.ts';

/**
 * A book's parts put in the download queue as tapes: each a file fetched as
 * it is, into a folder of the Tapes folder named after the book, numbered in
 * the book's order so that one runs on into the next.
 */

/**
 * A part's name in the download queue, which is how whether it has been
 * fetched is known: the same for the same file of the same item every time.
 */
export function bookPartId(book: Pick<Book, 'id'>, part: Pick<BookPart, 'name'>): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const text = `${book.id}\n${part.name}`;
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `book-${a.toString(36)}${b.toString(36)}`;
}

/** [part] of [book] as a download of a tape: its number is its place in the whole book, whichever of them are fetched. */
export function bookPartVideo(book: Book, part: BookPart): YouTubeVideo {
  const place = book.parts.findIndex((one) => one.name === part.name) + 1;
  return {
    id: bookPartId(book, part),
    url: part.url,
    direct: true,
    title: part.title,
    channel: book.author ?? book.title,
    thumbnail: book.cover,
    duration: part.durationSec,
    tape: { name: book.title, part: Math.max(1, place), album: book.title, title: part.title },
  };
}

export async function fetchBookParts(book: Book, parts: readonly BookPart[]): Promise<void> {
  if (!downloads || parts.length === 0) return;
  const videos = parts.map((part) => carried(bookPartVideo(book, part)));
  await downloads.enqueueBatchAsync(videos, 'original', tapeFolderOf(libraryRoot(), book.title));
}
