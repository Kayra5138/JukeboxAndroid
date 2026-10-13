import type { Track } from '../types';
import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { AudioFormat, DownloadJob, FindRequest, YouTubeResult, YouTubeVideo } from './types';

/** What the phone says by itself. Nothing travels with it: what changed is whatever the jobs say when read next. */
type DownloadsEvents = {
  onQueueChanged: () => void;
  /**
   * A song of Discover's is stored and can be played, sent with the song so
   * that nobody has to come and ask: the job, the recording it is of, and
   * the track it now is. Said before the queue's own record of it is written.
   */
  onDiscoverReady: (song: { id: string; key: string; track: Track }) => void;
  /**
   * What became of a preview, with the song it was of: `playing` once there
   * is sound, `ended` at its length, `failed`, or `stopped` when something
   * else took the speaker. Not said for one that was stopped by asking.
   */
  onPreview: (said: { id: string; state: 'playing' | 'ended' | 'failed' | 'stopped' }) => void;
  /**
   * How far along an update of the extractor is: `waiting` for whatever is
   * being fetched to finish, `downloading` with a percentage, `checking`
   * while the new file is run once before it is believed.
   */
  onExtractorUpdate: (said: { phase: 'waiting' | 'downloading' | 'checking'; percent: number }) => void;
};

declare class DownloadsModule extends NativeModule<DownloadsEvents> {
  discoverNetworkAsync(): Promise<{ connected: boolean; wifi: boolean }>;
  enqueueDiscoverAsync(video: YouTubeVideo & { discoveryTitle: string; discoveryArtist: string }, key: string): Promise<string>;
  prioritizeDiscoverAsync(id: string): Promise<void>;
  discoverTrackAsync(id: string): Promise<Track | null>;
  keepDiscoverAsync(id: string, folder: string): Promise<string>;
  cleanDiscoverAsync(ids: string[], protectedIds: string[]): Promise<string[]>;
  downloadDiscoverBackgroundAsync(id: string): Promise<void>;
  queueDiscoverBackgroundAsync(video: YouTubeVideo & { discoveryTitle: string; discoveryArtist: string }, key: string): Promise<string>;
  searchAsync(query: string, searchId: string): Promise<YouTubeVideo[]>;
  playlistAsync(query: string, searchId: string): Promise<YouTubeResult[]>;
  enqueueBatchAsync(videos: YouTubeVideo[], format: AudioFormat, folder: string): Promise<string[]>;
  cancelSearchAsync(searchId: string): Promise<void>;
  getJobsAsync(refreshFiles: boolean): Promise<DownloadJob[]>;
  enqueueAsync(video: YouTubeVideo, format: AudioFormat, folder: string): Promise<string>;
  cancelAsync(jobId: string): Promise<void>;
  markDescribedAsync(jobId: string): Promise<void>;

  /*
    The one queue. Everything below is missing from a build made before it,
    which is why each is asked for with a question mark.
  */
  /**
   * Puts a song in the queue by name. [video] is as a job's `video` is, with `find` set and no address.
   *
   * [front] is for a song somebody tapped in Discover and is waiting to hear:
   * it goes ahead of everything that is waiting, and is from then on a job a
   * person asked for. Said of a song that already has a job, it moves that one.
   *
   * [hold] is for a song to be looked for ahead of being wanted: found, it
   * is kept as `found` and not fetched, until it is asked for again without
   * `hold` — which lets it go, to the front if `front` says so.
   */
  enqueueFindAsync?(video: YouTubeVideo & { find: FindRequest }, format: AudioFormat, folder: string, discoverKey: string | null, front?: boolean, hold?: boolean): Promise<string>;
  /** The job whose video may be looked for now, marked as being looked for; null when it is not a search's turn. */
  claimFindAsync?(): Promise<DownloadJob | null>;
  /**
   * A search on the queue's behalf: it waits its turn behind whatever the queue is doing, and behind a search made by hand.
   * [searchId] is the id of the job it is for, and that job must be the one claimed.
   */
  findSearchAsync?(query: string, searchId: string): Promise<YouTubeVideo[]>;
  /** What the search came to: the video to fetch, in the job's own place in the queue, or null for none that fits. */
  resolveFindAsync?(id: string, video: YouTubeVideo | null): Promise<void>;
  /** Moves a waiting job to just before another, or to the end for null. */
  moveAsync?(id: string, beforeId: string | null): Promise<void>;
  /** Puts a job that failed or was cancelled back in the queue. */
  retryAsync?(id: string): Promise<void>;
  setPausedAsync?(paused: boolean): Promise<void>;
  queueStateAsync?(): Promise<{ paused: boolean }>;
  /** Clears what has finished from the list of what was fetched. Nothing on the phone is removed. */
  clearFinishedAsync?(): Promise<void>;
  /** Cancels everything that is waiting or under way. */
  cancelAllAsync?(): Promise<void>;
  /**
   * Plays thirty seconds of a Discover song from [address], apart from the
   * player and its queue: nothing of it is a listen, and nothing shows it
   * outside the app. One at a time; starting another stops the one there
   * was. Answers false for an address previews are not served from.
   */
  previewStartAsync?(id: string, address: string): Promise<boolean>;
  previewStopAsync?(): Promise<void>;
  /** Starts the phone's worker where jobs are waiting with none: left from last time, or Discover's own come due. Answers whether it did. */
  wakeQueueAsync?(): Promise<boolean>;

  /*
    The extractor's own version, and a newer one: see `extractor.ts` for
    what each of these sends, and to whom. A refusal carries one of
    `ExtractorTrouble.Kind`'s codes.
  */
  /** The yt-dlp on the phone and the one this build carries. Reads two small files and asks nobody. */
  extractorVersionsAsync?(): Promise<{ installed: string; bundled: string }>;
  /** The latest release there is, by name: one request to GitHub that brings back headers and nothing else. */
  extractorLatestAsync?(): Promise<string>;
  /** Fetches that release, checks it, tries it and puts it in place, with nothing else running. Answers with the version now installed. */
  updateExtractorAsync?(version: string): Promise<string>;
  /** Puts the build's own copy back. Answers with its version. */
  restoreExtractorAsync?(): Promise<string>;
}

// Existing development builds can still open the library before being rebuilt.
export const downloads = requireOptionalNativeModule<DownloadsModule>('JukeboxDownloads');
