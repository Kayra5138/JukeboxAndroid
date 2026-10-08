import { strings, type Strings } from '../i18n/languages.ts';

export type YouTubeVideo = {
  kind?: 'video';
  album?: string;
  sourcePlaylist?: { id: string; name: string };
  id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  duration: number | null;
};

export type YouTubePlaylist = Omit<YouTubeVideo, 'kind'> & { kind: 'playlist' };
export type YouTubeResult = YouTubeVideo | YouTubePlaylist;

export type AudioFormat = 'mp3' | 'original';
export type DownloadStatus = 'queued' | 'preparing' | 'downloading' | 'converting' |
  'saving' | 'cancelling' | 'cancelled' | 'failed' | 'done' | 'missing';
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
};

/** What a failed job is to be shown as saying: in the app's language where the build can say it so. */
export function jobError(job: DownloadJob): string | null {
  return job.errorText ?? job.error;
}

export function isActive(job: DownloadJob): boolean {
  return ['queued', 'preparing', 'downloading', 'converting', 'saving', 'cancelling'].includes(job.status);
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
  return job.status === 'downloading' ? said.downloading(job.progress) : said[job.status];
}
