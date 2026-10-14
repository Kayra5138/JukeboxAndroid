import { strings, type Strings } from '../i18n/languages.ts';
import type { Placement } from '../album/placement.ts';

export type YouTubeVideo = {
  kind?: 'video';
  album?: string;
  sourcePlaylist?: { id: string; name: string };
  /**
   * What the file is to be tagged as, where whoever asked for it knows better
   * than the video does. The phone reads these off any job's video, not only
   * one of Discover's.
   */
  discoveryTitle?: string;
  discoveryArtist?: string;
  /** The record a Discover song is on, as the catalogue names it; null where it named none. */
  discoveryAlbum?: string | null;
  /** The sleeve a Discover song is shown with. The phone keeps a copy as the file's picture and looks nothing up. */
  discoverCover?: string | null;
  /** Nobody tapped it: Discover asked, to have it ready. Such a job waits for a time when nothing else is being fetched. */
  discoverAutomatic?: boolean;
  /** One of Discover's own that is not to use mobile data. */
  discoverWifiOnly?: boolean;
  /** The record it was fetched to complete, kept with the job until the file is in. */
  placement?: Placement;
  /**
   * For a job that was asked for by name and has no video yet: what to look
   * for. Until the queue has found one the job's `id` and `url` are empty and
   * its `title` and `channel` are the song's and the artist's, so that it can
   * be shown in the queue like any other. Gone once it is found.
   */
  find?: FindRequest;
  id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  duration: number | null;
};

/** A song to be found on YouTube and downloaded, by whoever knows its name and not its address. */
export type FindRequest = {
  /** What is typed into the search, as Discover words it. */
  query: string;
  artist: string;
  title: string;
  /** How long the recording is, where that is known: the surest check that a video is the same one. */
  durationSec: number | null;
  /**
   * For a song known to exist: take the likeliest video where none can be shown to be it.
   * See `chooseVideo`. Left out, a video has to be shown to be the song.
   */
  loose?: boolean;
};

export type YouTubePlaylist = Omit<YouTubeVideo, 'kind'> & { kind: 'playlist' };
export type YouTubeResult = YouTubeVideo | YouTubePlaylist;

export type AudioFormat = 'mp3' | 'original';
export type DownloadStatus = 'queued' | 'finding' | 'preparing' | 'downloading' | 'converting' |
  'saving' | 'cancelling' | 'cancelled' | 'failed' | 'done' | 'missing' |
  /** Looked for ahead and held: its video is known and nothing is being done about it. Only ever a job of Discover's. */
  'found';
export type DownloadJob = {
  discoverKey?: string | null;
  id: string;
  video: YouTubeVideo;
  format: AudioFormat;
  folder: string;
  status: DownloadStatus;
  progress: number;
  trackId: string | null;
  /** What went wrong, in the native side's English whatever the app is speaking. Not for showing. */
  error: string | null;
  /** Which failure it was, by `Failure.kt`'s name for it. Missing from an older build, and null for the extractor's own words. */
  errorCode?: string | null;
  /** `error` in the app's language as it was when the jobs were read. Missing from an older build. */
  errorText?: string | null;
  described: boolean;
  /** When it was asked for and when it came to an end, in milliseconds. Missing from a job made by an older build. */
  createdAt?: number;
  finishedAt?: number | null;
  /** When work on it first began: being looked for, or being fetched. Null while it has only waited. */
  startedAt?: number | null;
  /**
   * On its second try. A job that fails in a way trying again might cure is
   * put back in the queue once by the phone itself, and says so for as long
   * as that try lasts: while it waits for it, and while it is made. One that
   * fails again is `failed` like any other.
   */
  retrying?: boolean;
  /** Why the first try failed, in the app's language. Kept on the job afterwards, whichever way the second went. */
  retryText?: string | null;
  /** Not before when the second try is made, in milliseconds. */
  retryAt?: number | null;
  /** Nobody asked for this one by hand: Discover did. It waits for a time when nothing else is being fetched. */
  automatic?: boolean;
  /**
   * Looked for ahead of being wanted, to be held when found and not fetched:
   * rule 10 of WHO GOES FIRST in `DownloadQueue.kt`. Such a job is no
   * download and is shown on no screen of downloads. Gone from the job once
   * it is asked for in earnest.
   */
  hold?: boolean;
  /** The picture kept for what was fetched, as a file. For one of Discover's it may arrive after the song. */
  artworkUri?: string | null;
  /** Finished and since cleared from the list of what was fetched. Kept, because a finished job is also how a video is known to be here already. */
  cleared?: boolean;
};

/** What a failed job is to be shown as saying: in the app's language where the build can say it so. */
export function jobError(job: DownloadJob): string | null {
  return job.errorText ?? job.error;
}

export function isActive(job: DownloadJob): boolean {
  return ['queued', 'finding', 'preparing', 'downloading', 'converting', 'saving', 'cancelling'].includes(job.status);
}

/** A completed/active receipt takes precedence over an older failed attempt. */
export function jobForVideo(jobs: DownloadJob[], videoId: string): DownloadJob | undefined {
  const matching = jobs.filter((job) => job.video.id === videoId);
  return matching.find((job) => job.status === 'done' || isActive(job)) ?? matching[0];
}

export function durationLabel(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`;
}

export function statusLabel(job: DownloadJob, t: Strings = strings()): string {
  const said = t.search.status;
  // A held job is on no screen that says this; were it ever, waiting is the nearest true thing to say of it.
  if (job.status === 'found') return said.queued;
  return job.status === 'downloading' ? said.downloading(job.progress) : said[job.status];
}
