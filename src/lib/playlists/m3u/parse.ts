/**
 * Reading an M3U playlist's text into its entries.
 *
 * M3U was never written down by anybody who made it, and every player has
 * its own idea of it. What they agree on is small: one entry to a line, lines
 * starting with `#` are not entries, and `#EXTINF:` before an entry says how
 * long it is and what it is called. Everything else -- `#PLAYLIST:` for the
 * name (VLC), `#EXTART:` and `#EXTALB:` (some Android players), attributes
 * inside `#EXTINF` (IPTV lists), a mark at the front, Windows line breaks --
 * is read where it means something and passed over where it does not. Nothing
 * here refuses a file: a line that is not understood is not an entry, and a
 * file of nothing but those is a playlist with nothing in it, which the
 * import says.
 */

export type M3uEntry = {
  /** The line as written: a path, a `file://` address, a web address. */
  location: string;
  /** Which line of the file it was, from one, for whoever goes looking. */
  line: number;
  /** From `#EXTINF`, in seconds; null where it was not given or was given as unknown (`-1`). */
  durationSec: number | null;
  /** From `#EXTINF` (`artist - title`) or `#EXTART`. */
  artist: string | null;
  /** From `#EXTINF`: the title, or everything after the comma when no artist can be told from it. */
  title: string | null;
  /** Everything after the comma of `#EXTINF`, as written, for showing an entry that was not found. */
  label: string | null;
};

export type M3uDocument = {
  /** From `#PLAYLIST:`, where the file names itself. */
  name: string | null;
  entries: M3uEntry[];
};

/** Where in an `#EXTINF` line the comma that ends the length and its attributes is: the first outside quotes. */
function infoComma(rest: string): number {
  let quoted = false;
  for (let index = 0; index < rest.length; index += 1) {
    const char = rest[index];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) return index;
  }
  return -1;
}

/**
 * What an `#EXTINF` line says, or null for one that says nothing usable.
 *
 * `#EXTINF:215,Nirvana - Lithium`: the length, then after the first comma the
 * artist and title joined by a dash with a space either side, which is what
 * Winamp wrote and everyone since has copied. A line with no such dash is a
 * title alone, as some players write it. Where the title itself has a dash in
 * it the first one is taken as the join; the matcher also tries the whole
 * thing as a title, so a song called `Intro - Live` is not lost to that.
 */
function readInfo(line: string): Pick<M3uEntry, 'durationSec' | 'artist' | 'title' | 'label'> {
  const rest = line.slice('#EXTINF:'.length);
  const comma = infoComma(rest);
  const head = (comma < 0 ? rest : rest.slice(0, comma)).trim();
  const label = comma < 0 ? null : rest.slice(comma + 1).trim() || null;
  // The length is the first thing in the head; attributes may follow it.
  const seconds = Number.parseFloat(head.split(/\s+/)[0] ?? '');
  const durationSec = Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  if (!label) return { durationSec, artist: null, title: null, label: null };
  const dash = label.indexOf(' - ');
  if (dash > 0 && dash < label.length - 3) {
    return {
      durationSec,
      artist: label.slice(0, dash).trim(),
      title: label.slice(dash + 3).trim(),
      label,
    };
  }
  return { durationSec, artist: null, title: label, label };
}

export function parseM3u(text: string): M3uDocument {
  let name: string | null = null;
  const entries: M3uEntry[] = [];
  /** What the lines since the last entry said about the next one. */
  let pending: Pick<M3uEntry, 'durationSec' | 'artist' | 'title' | 'label'> | null = null;
  let pendingArtist: string | null = null;

  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    if (line.startsWith('#')) {
      const upper = line.toUpperCase();
      if (upper.startsWith('#EXTINF:')) pending = readInfo(line);
      else if (upper.startsWith('#PLAYLIST:')) name = line.slice('#PLAYLIST:'.length).trim() || name;
      else if (upper.startsWith('#EXTART:')) pendingArtist = line.slice('#EXTART:'.length).trim() || null;
      // `#EXTM3U`, `#EXTGRP`, `#EXTALB`, `#EXTIMG`, `#EXTVLCOPT` and plain
      // comments: nothing that says which file is meant.
      return;
    }
    const info: Pick<M3uEntry, 'durationSec' | 'artist' | 'title' | 'label'> =
      pending ?? { durationSec: null, artist: null, title: null, label: null };
    entries.push({
      location: line,
      line: index + 1,
      ...info,
      artist: info.artist ?? pendingArtist,
    });
    pending = null;
    pendingArtist = null;
  });

  return { name, entries };
}

/**
 * Whether what was read is a playlist at all, rather than some other text
 * file picked by mistake: one that says it is (`#EXTM3U`), or whose entries
 * look like files or addresses -- a slash in them, or an ending. A shopping
 * list read as a playlist would come in as a list of a dozen songs none of
 * which were found, which says something less true than "that is not one".
 */
export function looksLikePlaylist(text: string, document: M3uDocument): boolean {
  if (/^\uFEFF?\s*#EXTM3U/i.test(text)) return true;
  const fileLike = document.entries.filter((entry) => /[\\/]|\.[a-z0-9]{2,5}$/i.test(entry.location)).length;
  return fileLike > 0 && fileLike * 2 >= document.entries.length;
}
