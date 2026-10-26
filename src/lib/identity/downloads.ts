import { withoutBrackets } from '../metadata/credit.ts';
import { readings } from '../metadata/identify.ts';
import { foldForMatch, matchScore } from '../metadata/text.ts';
import type { Track } from '../types.ts';
import { describe, identical, namedAlike, type FileRow, type Scanned } from './plan.ts';

/**
 * A download's own record of the file it made, as much of it as finding the
 * file again needs. The phone keeps the download's cover — the sleeve it
 * found, or the video's picture — on this record and not on the song, under
 * the number the file had when it was saved.
 */
export type DownloadRecord = {
  id: string;
  status: string;
  trackId: string | null;
  discoverKey?: string | null;
  /** What the file was tagged as: the song's name and its artist, and the video's length. */
  video: { title?: string; artist?: string; channel?: string; duration?: number | null };
};

/** A download, and the file it made as that file is numbered now. */
export type Rejoin = { job: string; track: string };

/** How far apart two lengths may be and still be one file's: the video's, in whole seconds, and the saved file's. */
const SAME_LENGTH_SEC = 3;

/** The least a file's name has to agree with the video's to be its file, as a search result has to. */
const GOOD_ENOUGH = 0.5;

const fold = (value: string | null | undefined) => (value ?? '').normalize('NFKC').trim().toLowerCase();

/**
 * The downloads whose file is in the library under another number than the
 * one they were saved with, and which number that is.
 *
 * A file given a new number — moved, or its folder renamed — has its
 * history carried to the new one by the identity pass; its download did not
 * go with it, and with the download went its cover. So each download whose
 * number is not in the library is looked for:
 *
 *  - where its history has just been [moved], at the number it went to;
 *  - by what was written down about its file under the old number, where
 *    anything still is: the same size and length, named alike, and one file
 *    only;
 *  - and otherwise — a file moved before downloads followed, or one whose
 *    number was taken off it once it was missed — by the video it was made
 *    from: a file as long as the video, give or take a few seconds, whose
 *    name is the song the video's title names. The record keeps the
 *    video's title and channel and not what the file was tagged as, and
 *    the file's tags may have been corrected since; so the name is weighed
 *    as a search result is, and taken only where one file is plainly the
 *    best and good enough.
 *
 * Newest first, and a file is given to one download: the same video saved
 * twice is one file's, the later's. A file that already has a download is
 * nobody else's. Discover's songs, kept in the app's own folder until one is
 * kept, are only followed by the first road.
 */
export function downloadsToRejoin(
  jobs: readonly DownloadRecord[],
  scanned: readonly Scanned[],
  files: ReadonlyMap<string, FileRow>,
  moved: ReadonlyMap<string, string> = new Map()
): Rejoin[] {
  const here = new Map(scanned.map((track) => [track.id, describe(track)]));
  const finished = jobs.filter((job) => job.status === 'done' || job.status === 'missing');
  const taken = new Set(finished.flatMap((job) => (job.trackId && here.has(job.trackId) ? [job.trackId] : [])));
  const rejoins: Rejoin[] = [];

  const only = (rows: FileRow[]) => {
    const free = rows.filter((row) => !taken.has(row.id));
    return rows.length === 1 && free.length === 1 ? free[0]! : null;
  };

  for (const job of finished) {
    if (job.trackId && here.has(job.trackId)) continue;
    let found: FileRow | null = null;
    const was = job.trackId ? files.get(job.trackId) : undefined;
    const to = job.trackId ? moved.get(job.trackId) : undefined;
    if (to) {
      const row = here.get(to);
      found = row && !taken.has(row.id) ? row : null;
    } else if (was) {
      found = only([...here.values()].filter((row) => row.id !== was.id && identical(was, row) && namedAlike(was, row)));
    } else if (!job.discoverKey) {
      found = byVideo(job, [...here.values()].filter((row) => !taken.has(row.id)));
    }
    if (!found) continue;
    taken.add(found.id);
    rejoins.push({ job: job.id, track: found.id });
  }
  return rejoins;
}

/**
 * The one file, of [rows], that [job]'s video plainly made: as long as the
 * video, and named as the song in its title is, better than any other.
 */
function byVideo(job: DownloadRecord, rows: FileRow[]): FileRow | null {
  const length = job.video.duration ?? 0;
  const title = job.video.title?.trim();
  if (!title || !(length > 0)) return null;
  const channel = (job.video.artist ?? job.video.channel ?? '')
    .replace(/\s+-\s+topic$/i, '')
    .replace(/\s*(official( youtube)?( channel)?|vevo)\s*$/i, '')
    .trim();
  const ways = readings({ title, artist: null } as Track);
  const scored = rows
    .filter((row) => row.durationSec > 0 && Math.abs(row.durationSec - length) <= SAME_LENGTH_SEC)
    .map((row) => ({
      row,
      score: foldForMatch(row.title ?? '') === foldForMatch(title) ? 1 : Math.max(...ways.map((way) => nameScore(way.title, way.query, channel, row))),
    }))
    .sort((a, b) => b.score - a.score || (a.row.id < b.row.id ? -1 : 1));
  const best = scored[0];
  if (!best || best.score < GOOD_ENOUGH) return null;
  /*
    Two files as good as each other are only a guess between them, unless
    they are copies of one song — the same name and the same length — when
    either is the song the video made, and its cover is the same cover.
  */
  const rival = scored[1];
  if (rival && rival.score >= best.score && !copies(best, rival)) return null;
  return best.row;
}

/**
 * Two files that are one song twice: the same length to the second, and the
 * same name — or each named as the video's song outright, which a copy kept
 * under the video's title and one tagged by its Latin name both are.
 */
function copies(a: { row: FileRow; score: number }, b: { row: FileRow; score: number }): boolean {
  if (Math.abs(a.row.durationSec - b.row.durationSec) > 1) return false;
  return (a.score >= 1 && b.score >= 1) || foldForMatch(a.row.title ?? '') === foldForMatch(b.row.title ?? '');
}

/** How well a file's name agrees with one way of reading a video's title. */
function nameScore(title: string, query: string, channel: string, row: FileRow): number {
  const own = row.title ?? '';
  const bare = (name: string) => foldForMatch(withoutBrackets(name));
  // The song's name and nothing else, which a search could not weigh were it one word: `Rewrite`;
  // read out of the file's title as out of the video's, where the file kept the video's title as it was.
  const artist = row.artist && row.artist !== '<unknown>' ? row.artist : null;
  const theirs = [own, ...readings({ title: own, artist } as Track).map((way) => way.title)];
  if (bare(title) !== '' && theirs.some((name) => bare(name) === bare(title))) return 1;
  const candidate = { title: own, artist: row.artist };
  return Math.max(
    matchScore(query, candidate),
    channel ? matchScore(`${channel} ${title}`, candidate) : 0,
    row.filename ? matchScore(query, { title: row.filename.replace(/\.[a-z0-9]{2,4}$/i, '') }) : 0
  );
}
