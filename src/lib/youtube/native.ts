import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { AudioFormat, DownloadJob, YouTubeResult, YouTubeVideo } from './types';

declare class DownloadsModule extends NativeModule {
  searchAsync(query: string, searchId: string): Promise<YouTubeVideo[]>;
  playlistAsync(query: string, searchId: string): Promise<YouTubeResult[]>;
  enqueueBatchAsync(videos: YouTubeVideo[], format: AudioFormat, folder: string): Promise<string[]>;
  cancelSearchAsync(searchId: string): Promise<void>;
  getJobsAsync(refreshFiles: boolean): Promise<DownloadJob[]>;
  enqueueAsync(video: YouTubeVideo, format: AudioFormat, folder: string): Promise<string>;
  cancelAsync(jobId: string): Promise<void>;
  markDescribedAsync(jobId: string): Promise<void>;
}

// Existing development builds can still open the library before being rebuilt.
export const downloads = requireOptionalNativeModule<DownloadsModule>('JukeboxDownloads');
