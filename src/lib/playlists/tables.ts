import { csvRows as rows, type NamedSong } from '../history/import.ts';
import type { ForeignList } from './spotify.ts';

/**
 * Playlists written out as a table: a song a row, the columns named in the
 * first.
 *
 *  - Apple's Music app, on a Mac or in Windows, writes a playlist out this
 *    way (File › Library › Export Playlist, as text): tabs between the
 *    columns, in UTF-16, the name, the artist, the composer and the album
 *    first among some thirty. It names its columns in the language it runs
 *    in, so a heading it is not known by here is read by where they stand,
 *    which is the same in every language and has been since iTunes.
 *  - The services that move playlists between apps -- TuneMyMusic, Soundiiz,
 *    Exportify for Spotify -- write one as a CSV, with headings in English;
 *    some put every playlist in one file, with a column saying whose row it
 *    is, and those are as many lists.
 *
 * A song is named here, as in Spotify's files, and found by its name
 * (`songFinder`). What the text says, and only that.
 */

const TITLE = ['name', 'title', 'track name', 'track', 'song', 'song name', 'track title'];
const ARTIST = ['artist', 'artist name', 'artist name(s)', 'artists', 'artist(s)', 'artist names'];
const ALBUM = ['album', 'album name', 'album title'];
const PLAYLIST = ['playlist', 'playlist name'];

/** How many columns Apple's table has at least, to be read by place: thirty or so since iTunes 12, over twenty before. */
const APPLE_COLUMNS = 20;

const text = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
};

/**
 * The playlists in a table, or null when it is not one: a list named
 * [name] for a table of one, or one for each name a playlist column gives.
 */
export function readTableLists(contents: string, name: string): ForeignList[] | null {
  const body = contents.replace(/^﻿/, '');
  const firstLine = body.slice(0, body.search(/\r?\n|$/));
  if (!firstLine.trim() || firstLine.trimStart().startsWith('#')) return null;
  const delimiter = ['\t', ',', ';'].reduce((best, each) =>
    firstLine.split(each).length > firstLine.split(best).length ? each : best
  );
  const table = rows(body, delimiter);
  if (table.length < 2) return null;

  const heading = table[0]!.map((cell) => cell.trim().toLowerCase());
  const column = (names: string[]) => names.map((each) => heading.indexOf(each)).find((at) => at >= 0) ?? -1;
  let at = { title: column(TITLE), artist: column(ARTIST), album: column(ALBUM), playlist: column(PLAYLIST) };
  if (at.title < 0 || at.artist < 0) {
    // Apple's own, in a language its headings are not known in here: by place.
    if (delimiter !== '\t' || heading.length < APPLE_COLUMNS) return null;
    at = { title: 0, artist: 1, album: 3, playlist: -1 };
  }

  const lists = new Map<string, NamedSong[]>();
  for (const row of table.slice(1)) {
    const title = text(row[at.title]);
    if (!title) continue;
    const song = { title, artist: text(row[at.artist]), album: at.album >= 0 ? text(row[at.album]) : null };
    const list = at.playlist >= 0 ? (text(row[at.playlist]) ?? name) : name;
    const songs = lists.get(list);
    if (songs) songs.push(song);
    else lists.set(list, [song]);
  }
  if (lists.size === 0) return null;
  return [...lists].map(([list, items]) => ({ name: list, items }));
}
