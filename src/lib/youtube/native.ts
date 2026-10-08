import type { Track } from '../types';
import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { AudioFormat, DownloadJob, FindRequest, YouTubeResult, YouTubeVideo } from './types';

declare class DownloadsModule extends NativeModule {
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
  /** Puts a song in the queue by name. [video] is as a job's `video` is, with `find` set and no address. */
  enqueueFindAsync?(video: YouTubeVideo & { find: FindRequest }, format: AudioFormat, folder: string, discoverKey: string | null): Promise<string>;
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
  /** Starts the phone's worker where jobs are waiting with none: left from last time, or Discover's own come due. Answers whether it did. */
  wakeQueueAsync?(): Promise<boolean>;
}

// Existing development builds can still open the library before being rebuilt.
export const downloads = requireOptionalNativeModule<DownloadsModule>('JukeboxDownloads');
