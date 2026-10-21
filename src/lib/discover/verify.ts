import { placementOf } from '../album/placement.ts';
import { featuredIn, withoutBrackets, withoutPackaging } from '../metadata/credit.ts';
import { identify } from '../metadata/identify.ts';
import { foldForMatch, tokens } from '../metadata/text.ts';
import type { Track } from '../types.ts';
import type { DownloadJob, YouTubeVideo } from '../youtube/types.ts';
import { inOtherWriting } from './video.ts';

/**
 * Finding the downloads that are not the song they are filed as.
 *
 * Until the chooser was made strict (see `inOtherWriting`), a video could be
 * taken for a song on its length alone, from the artist's own channel, and
 * the file was then tagged with the name the song was asked for by and not
 * the video's. That is how `bôa – Twilight` came to be in the library as
 * `Frozen`, with nothing on any screen to say so. The chooser no longer does
 * it; the files it did it to are still here, and their jobs are kept, which
 * is how they are found again: a finished job says both what the video was
 * called and what the file was tagged as.
 *
 * The test is the chooser's own first one, read the other way. There a video
 * was taken by its name when every meaningful word of the song's title was
 * among the video's words; here a file is doubted when they are not, and the
 * video's title is in the same writing as the song's, so that not finding
 * the words in it says that it is another song and not that it could not be
 * read. A file tagged with the video's own name is never doubted: it says
 * what it is, and if that is wrong it is wrong in plain sight.
 */

/** What a download was tagged as, where that was not the video's own name: a song of Discover's, or a place on a record. */
export function taggedAs(video: YouTubeVideo): { title: string; artist: string } | null {
  const place = placementOf(video);
  const title = video.discoveryTitle?.trim() || place?.title || '';
  if (!title) return null;
  return { title, artist: video.discoveryArtist?.trim() || place?.artist || '' };
}

/**
 * Whether a video's title names the song, by the rule `chooseVideo` takes a
 * video by its name with: every meaningful word of the song's title among the
 * video's. The song's title is read without its guests and without anything
 * about an upload, so that `Numb (feat. Jay-Z)` or `Numb (Remastered 2011)`
 * is named by `Linkin Park - Numb (Official Audio)`.
 */
export function namesSong(songTitle: string, videoTitle: string): boolean {
  // And without whatever else is in brackets: a catalogue's `(from the series …)` beside a video's `(from Arcane Season 2)`.
  const bare = withoutBrackets(featuredIn(withoutPackaging(songTitle)).title || songTitle);
  const wanted = tokens(bare);
  if (!wanted.length) return foldForMatch(videoTitle).includes(foldForMatch(bare));
  const have = new Set(tokens(videoTitle));
  return wanted.every((word) => have.has(word));
}

/**
 * Whether a file labelled [label] is, by its video's title, some other song.
 * See the top of this file. A label with no title says nothing, and is not
 * doubted.
 */
export function namesAnother(label: { title: string; artist: string | null }, videoTitle: string): boolean {
  if (!label.title.trim() || !videoTitle.trim()) return false;
  if (namesSong(label.title, videoTitle)) return false;
  return !inOtherWriting(label.title, videoTitle, label.artist ?? '');
}

/** Whether a finished job's file was tagged as a song its video's title says it is not. */
export function isSuspect(job: DownloadJob): boolean {
  if (job.status !== 'done') return false;
  const tagged = taggedAs(job.video);
  return tagged != null && namesAnother(tagged, job.video.title);
}

/** The states of a job of Discover's that has its video and is doing nothing with it. */
const AT_REST: ReadonlySet<string> = new Set(['done', 'found', 'failed', 'cancelled']);

/**
 * Discover's own jobs whose video is another song, and which are still
 * Discover's: finished, with the file in its private folder; found and held
 * with nothing fetched yet; or failed or stopped on the way, which a tap would
 * otherwise put back with the same video (`enqueueFind` in `DownloadQueue.kt`
 * tries a stopped job's video again rather than looking again). None is
 * anybody's file, and all are put right by being let go and looked for again
 * (see `engine.ts`). One under way is left to finish, and is found finished.
 */
export function wrongFinds(jobs: readonly DownloadJob[]): DownloadJob[] {
  return jobs.filter((job) => !!job.discoverKey && AT_REST.has(job.status) && foundAnother(job));
}

/**
 * Whether the video a job found is, by its title, some other song than the
 * one it is for, whatever the job is doing with it. What `wrongFinds` asks of
 * each job at rest, and what keeping a song asks of its file before it goes
 * into the library (see `mendBeforeKeeping` in `core.ts`). A job whose video
 * is still to be looked for says nothing yet, and is not doubted.
 */
export function foundAnother(job: DownloadJob): boolean {
  // A video still to be looked for has no title of its own yet: what it shows is the song's.
  if (job.video.find || !job.video.id) return false;
  const tagged = taggedAs(job.video);
  return tagged != null && namesAnother(tagged, job.video.title);
}

/** What "It is right" is remembered by: the file and the video, so that the same file fetched again from another video is asked about afresh. */
export function rightKey(trackId: string, videoId: string): string {
  return `${trackId}:${videoId}`;
}

/** A track of the library, as far as this needs one. */
export type LabelledTrack = { id: string; title: string; artist: string | null; durationSec: number };

/** A file in the library that may be the wrong song, with the job that fetched it. */
export type Mistake<T extends LabelledTrack = LabelledTrack> = { track: T; job: DownloadJob };

/**
 * The files in the library that may be the wrong song.
 *
 * A finished download that is a file of the library's — a song kept from
 * Discover with +, a track fetched to complete a record, one asked for by
 * name — that was tagged with a name other than its video's, and whose name
 * as the library shows it now does not name the video. As it shows it now:
 * a file put right by hand, to the video's name or to anything that names it,
 * is right, and drops out of the list by itself. [right] are the ones
 * somebody has said are right as they are, by {@link rightKey}.
 *
 * One entry for a file, by the newest job that fetched it, in the order of
 * the jobs, newest first.
 */
export function libraryMistakes<T extends LabelledTrack>(
  jobs: readonly DownloadJob[],
  tracks: readonly T[],
  right: ReadonlySet<string>
): Mistake<T>[] {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const seen = new Set<string>();
  const found: Mistake<T>[] = [];
  const newestFirst = [...jobs].sort((a, b) => (b.finishedAt ?? b.createdAt ?? 0) - (a.finishedAt ?? a.createdAt ?? 0));
  for (const job of newestFirst) {
    const trackId = job.trackId;
    if (job.discoverKey || job.status !== 'done' || !trackId || trackId.startsWith('discover:') || seen.has(trackId)) continue;
    const track = byId.get(trackId);
    if (!track) continue;
    seen.add(trackId);
    const tagged = taggedAs(job.video);
    if (!tagged || !job.video.id || right.has(rightKey(trackId, job.video.id))) continue;
    if (!namesAnother({ title: track.title, artist: track.artist ?? tagged.artist }, job.video.title)) continue;
    found.push({ track, job });
  }
  return found;
}

/**
 * The name a file would have if it were called what its video is: the
 * video's title read the way a file's is when it has no artist (see
 * `identify`), `Artist - Title` taken apart at the first dash, with what is
 * said about the upload and any guests taken off the title. Where the title
 * names nobody, the channel is the artist, without the ` - Topic` YouTube
 * puts on the channels it makes; and where there is no channel either, the
 * artist the file was tagged with.
 */
export function nameOfVideo(video: Pick<YouTubeVideo, 'title' | 'channel'>, fallbackArtist: string | null): { title: string; artist: string } {
  const read = identify({ title: video.title, artist: null } as Track);
  const channel = video.channel.replace(/\s*-\s*Topic\s*$/i, '').replace(/(?<=\S)VEVO$/, '').trim();
  return { title: read.title.trim() || video.title.trim(), artist: read.artist?.trim() || channel || fallbackArtist?.trim() || '' };
}
