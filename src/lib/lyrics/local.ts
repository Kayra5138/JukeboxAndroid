import { parseLrc } from './lrc.ts';
import type { Lyrics } from './lrclib.ts';

/**
 * Lyrics from the phone itself: the words a song's file carries, and a `.lrc`
 * kept beside it. Everything here is deciding, with nothing read or written;
 * `device.ts` does the reading and `useLyrics.ts` puts the two together.
 *
 * The order a track's words are taken in, first that answers:
 *
 *   1. words somebody chose or typed in the app, which nothing replaces;
 *   2. words in the file itself;
 *   3. a `.lrc` file beside it;
 *   4. LRCLIB.
 *
 * The file before the `.lrc` because the file is the one thing certain to be
 * about this recording — it is this recording — where a file beside it only
 * shares a name. Both before LRCLIB because they are what somebody put there
 * on purpose, and because asking a server about a song whose words are
 * already on the phone is asking for nothing.
 */

/** Where words on the phone came from. */
export type LocalSource = 'file' | 'lrc';

export type LocalLyrics = { lyrics: Lyrics; source: LocalSource };

/** Each line on a line of its own, and the line breaks of every system made one. */
export function cleanText(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^\n+/, '')
    .trimEnd();
}

/** `[ar:Somebody]`, `[offset:+250]`, `[#comment]`: about the file, not the song. */
const HEADER = /^\[[A-Za-z#][^\]]*\]$/;

/** A run of timestamps at the start of a line, which is what makes it a timed line. */
const STAMPED = /^(\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\])+/;

/**
 * Word-by-word timings inside a line, `<00:12.34>`, as the extended LRC some
 * karaoke tools write has them. The player follows lines, not words, and
 * would otherwise show them as part of the words.
 */
const WORD_STAMP = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;

/**
 * Whether a file's words are timed LRC rather than a plain text that
 * happens to have a bracket in it.
 *
 * Stricter than the paste box, which takes one timestamp as enough because
 * somebody pasting knows what they pasted. A file is anybody's: a verse that
 * opens with "[0:30]" as a note to the singer is not a timed song. So at least
 * half the lines with words in them have to start with a time, the headers
 * that only describe the file not counting either way.
 */
export function isTimedText(text: string): boolean {
  if (parseLrc(text).length === 0) return false;
  let timed = 0;
  let other = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length === 0 || HEADER.test(line)) continue;
    if (STAMPED.test(line)) timed++;
    else other++;
  }
  return timed > 0 && timed >= other;
}

/**
 * How far an LRC file asks for its timings to be moved, in the app's terms:
 * milliseconds, positive meaning later.
 *
 * LRC's `[offset:]` counts the other way — a positive offset makes the words
 * come sooner — which is the whole of why this exists.
 */
export function lrcOffsetMs(text: string): number {
  const match = /^\[offset:\s*([+-]?\d+)\s*\]$/im.exec(text);
  if (!match) return 0;
  const shift = -Number(match[1]);
  return Number.isFinite(shift) && shift !== 0 ? shift : 0;
}

/** Lyrics from one text, timed or plain as the text itself says. Null for nothing but space. */
export function asLyrics(raw: string): Lyrics | null {
  const text = cleanText(raw);
  if (text.length === 0) return null;
  if (isTimedText(text)) return { synced: text.replace(WORD_STAMP, ''), plain: null };
  return { synced: null, plain: text };
}

function stamp(ms: number): string {
  const centis = Math.round(ms / 10);
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  const fraction = centis % 100;
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}]`;
}

/**
 * An ID3 SYLT frame as LRC, which is what the player follows.
 *
 * Two ways of filling one are common. Most taggers write a line to an entry.
 * Karaoke taggers write a syllable to an entry and start each line with a
 * newline at the front of its first syllable; those are joined back into
 * lines here, each timed by where it starts.
 */
export function fromSylt(entries: readonly { ms: number; text: string }[]): string | null {
  const lines: { ms: number; text: string }[] = [];
  const syllables = entries.some((entry) => /^[\r\n]/.test(entry.text));
  for (const entry of entries) {
    if (!Number.isFinite(entry.ms) || entry.ms < 0) continue;
    if (!syllables) {
      lines.push({ ms: entry.ms, text: entry.text.replace(/[\r\n]+/g, ' ').trim() });
    } else if (/^[\r\n]/.test(entry.text) || lines.length === 0) {
      lines.push({ ms: entry.ms, text: entry.text.replace(/^[\r\n]+/, '') });
    } else {
      lines[lines.length - 1]!.text += entry.text;
    }
  }
  if (!lines.some((line) => line.text.trim().length > 0)) return null;
  return lines
    .sort((a, b) => a.ms - b.ms)
    .map((line) => `${stamp(line.ms)}${line.text.replace(/[\r\n]+/g, ' ').trim()}`)
    .join('\n');
}

/**
 * The words in a file, from what the native side found in it: names and
 * values one after the other, `text` for a field of words and `sylt` for each
 * entry of a timed ID3 frame as milliseconds, a tab and the text.
 *
 * Timed words win over plain ones wherever they are, and the SYLT frame over
 * a field of LRC, since the frame is the format's own way of timing words.
 * Plain words are kept beside timed ones when the file has both, the way
 * LRCLIB answers.
 */
export function embeddedLyrics(said: readonly string[] | null | undefined): Lyrics | null {
  if (!said) return null;
  const entries: { ms: number; text: string }[] = [];
  let synced: string | null = null;
  let plain: string | null = null;
  for (let index = 0; index + 1 < said.length; index += 2) {
    const name = said[index];
    const value = said[index + 1]!;
    if (name === 'sylt') {
      const tab = value.indexOf('\t');
      if (tab > 0) entries.push({ ms: Number(value.slice(0, tab)), text: value.slice(tab + 1) });
    } else if (name === 'text') {
      const found = asLyrics(value);
      if (found?.synced && synced === null) synced = found.synced;
      if (found?.plain && plain === null) plain = found.plain;
    }
  }
  synced = (entries.length > 0 ? fromSylt(entries) : null) ?? synced;
  if (synced === null && plain === null) return null;
  return { synced, plain };
}

export type FolderFile = { name: string; uri: string; size?: number | null };

/**
 * Which file beside a song holds its words, or null when none does.
 *
 * A `.lrc` with the song's name and the extension changed is the convention
 * every player and tagger follows: `Song.mp3` and `Song.lrc`. Some tools add
 * the extension instead, `Song.mp3.lrc`, and that is taken too. Case is
 * forgiven, since a file copied from Windows is as likely to be `Song.LRC` or
 * `song.lrc`, but an exact match is preferred where there are both.
 *
 * A `.txt` of the same name is taken only when there is no `.lrc`. A text file
 * beside a song is less certain to be its words than one in the format made
 * for them, but a text file that went to the trouble of being named exactly
 * like the song is hard to read as anything else.
 */
export function siblingFor(song: string, files: readonly FolderFile[]): FolderFile | null {
  const dot = song.lastIndexOf('.');
  const stem = dot > 0 ? song.slice(0, dot) : song;
  const fold = (text: string) => text.normalize('NFC').toLowerCase();
  const stems = [stem, song].map((name) => name.normalize('NFC'));

  let best: { file: FolderFile; rank: number } | null = null;
  for (const file of files) {
    const at = file.name.lastIndexOf('.');
    if (at <= 0) continue;
    const extension = file.name.slice(at + 1).toLowerCase();
    if (extension !== 'lrc' && extension !== 'txt') continue;
    const base = file.name.slice(0, at).normalize('NFC');

    let rank = -1;
    stems.forEach((wanted, which) => {
      if (rank >= 0) return;
      if (base === wanted) rank = which * 2;
      else if (fold(base) === fold(wanted)) rank = which * 2 + 1;
    });
    if (rank < 0) continue;
    // Every .lrc ranks ahead of every .txt.
    if (extension === 'txt') rank += 10;
    if (!best || rank < best.rank) best = { file, rank };
  }
  return best?.file ?? null;
}

/** Whether two sets of words are the same words. */
export function sameWords(a: Lyrics, b: Lyrics): boolean {
  return (a.synced ?? null) === (b.synced ?? null) && (a.plain ?? null) === (b.plain ?? null);
}

/** What is stored for a track, as far as choosing between sources needs to know. */
export type Kept = { lyrics: Lyrics; source: 'lookup' | 'manual' | LocalSource } | null;

/**
 * What to do with what is stored for a track, now that the phone has been
 * looked at for its words.
 *
 *  - `keep`: what is stored stands, and nothing needs asking.
 *  - `write`: words were found on the phone and are not what is stored; they
 *    take its place.
 *  - `forget`: what is stored came from the phone and the phone no longer
 *    says it — the `.lrc` was deleted, the tag cleared. It goes, and LRCLIB
 *    may be asked as if the track were new.
 *  - `ask`: nothing stored and nothing on the phone; over to LRCLIB.
 *
 * Words somebody chose are never replaced. They are kept without looking, and
 * are here only so that this answers for every case.
 */
export type Settled =
  | { kind: 'keep' }
  | { kind: 'write'; found: LocalLyrics }
  | { kind: 'forget' }
  | { kind: 'ask' };

export function settle(kept: Kept, found: LocalLyrics | null): Settled {
  if (kept?.source === 'manual') return { kind: 'keep' };
  if (found) {
    if (kept && kept.source === found.source && sameWords(kept.lyrics, found.lyrics)) return { kind: 'keep' };
    return { kind: 'write', found };
  }
  if (!kept) return { kind: 'ask' };
  return kept.source === 'file' || kept.source === 'lrc' ? { kind: 'forget' } : { kind: 'keep' };
}

/** A folder granted for reading `.lrc` files: the system's address for it, and a name to show. */
export type LyricsFolder = { uri: string; label: string };

/**
 * The folders as the setting keeps them, a JSON list. Anything that is not
 * one — an older value, a hand-edited backup — is no folders rather than an
 * error, and the setting is simply offered again.
 */
export function readFolders(raw: string | null): LyricsFolder[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((entry): LyricsFolder[] => {
      if (!entry || typeof entry !== 'object') return [];
      const { uri, label } = entry as Record<string, unknown>;
      if (typeof uri !== 'string' || uri.length === 0 || seen.has(uri)) return [];
      seen.add(uri);
      return [{ uri, label: typeof label === 'string' && label.length > 0 ? label : uri }];
    });
  } catch {
    return [];
  }
}

export function writeFolders(folders: readonly LyricsFolder[]): string {
  return JSON.stringify(folders.map(({ uri, label }) => ({ uri, label })));
}
