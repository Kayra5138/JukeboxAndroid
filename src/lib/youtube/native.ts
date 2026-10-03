import type { Track } from '../types';
import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { AudioFormat, DownloadJob, YouTubeResult, YouTubeVideo } from './types';

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
}

// Existing development builds can still open the library before being rebuilt.
export const downloads = requireOptionalNativeModule<DownloadsModule>('JukeboxDownloads');
