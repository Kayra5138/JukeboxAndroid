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
  error: string | null;
  described: boolean;
};

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

export function statusLabel(job: DownloadJob): string {
  switch (job.status) {
    case 'queued': return 'Queued';
    case 'preparing': return 'Preparing…';
    case 'downloading': return `Downloading · ${job.progress}%`;
    case 'converting': return 'Converting audio…';
    case 'saving': return 'Adding to library…';
    case 'cancelling': return 'Cancelling…';
    case 'cancelled': return 'Cancelled';
    case 'failed': return 'Download failed';
    case 'done': return 'In library';
    case 'missing': return 'File removed';
  }
}
