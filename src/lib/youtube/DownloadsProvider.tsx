import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { downloads } from './native';
import { isActive, type AudioFormat, type DownloadJob, type YouTubeVideo } from './types';
import { ensureNotificationPermission, libraryRoot } from '../media/library';
import { registerYouTubePlaylist, syncYouTubePlaylists } from '../db/youtubePlaylists';
import { describeTrack } from '../media/import';

type DownloadContext = {
  jobs: DownloadJob[];
  error: string | null;
  refresh: (checkFiles?: boolean) => Promise<void>;
  enqueue: (video: YouTubeVideo, format: AudioFormat) => Promise<void>;
  enqueueBatch: (videos: YouTubeVideo[], format: AudioFormat) => Promise<void>;
  cancel: (id: string) => Promise<void>;
};
const Context = createContext<DownloadContext | null>(null);
const Revision = createContext(0);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const receipts = useRef(new Set<string>());
  const reading = useRef<Promise<void> | null>(null);
  const latest = useRef<DownloadJob[]>([]);

  const refresh = useCallback(async (checkFiles = false) => {
    if (!downloads) return;
    while (reading.current) {
      await reading.current;
      if (!checkFiles) return;
    }
    const task = (async () => {
      try {
        const next = await downloads.getJobsAsync(checkFiles);
        let added = syncYouTubePlaylists(next);
        for (const job of next) {
          if (job.status === 'done' && !receipts.current.has(job.id)) {
            receipts.current.add(job.id);
            added = true;
          }
        }
        latest.current = next;
        setJobs(next);
        setError(null);
        if (added) setRevision((value) => value + 1);
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not read downloads.'); }
    })();
    reading.current = task;
    try { await task; } finally { if (reading.current === task) reading.current = null; }
  }, []);

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && latest.current.some(isActive)) void refresh();
    }, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(true);
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [refresh]);

  // Identification is secondary to saving the audio. It may be interrupted and
  // retried after reopening the app; it never turns a successful download red.
  const nextDescription = jobs.find((job) => job.status === 'done' && !job.described && job.trackId);
  const descriptionId = nextDescription?.id;
  const trackId = nextDescription?.trackId;
  useEffect(() => {
    if (!descriptionId || !trackId || !downloads) return;
    const controller = new AbortController();
    void (async () => {
      await describeTrack(trackId, controller.signal);
      if (controller.signal.aborted) return;
      try {
        await downloads.markDescribedAsync(descriptionId);
        setRevision((value) => value + 1);
        await refresh(true);
      } catch { /* A later refresh retries the receipt. */ }
    })();
    return () => controller.abort();
  }, [descriptionId, trackId, refresh]);

  const enqueue = useCallback(async (video: YouTubeVideo, format: AudioFormat) => {
    if (!downloads) throw new Error('Install a new Android build to enable YouTube downloads.');
    await ensureNotificationPermission();
    await downloads.enqueueAsync(video, format, libraryRoot());
    // An older in-flight read may predate the enqueue. Always read again after
    // it, otherwise an initially empty queue would never start polling.
    await refresh(true);
  }, [refresh]);

  const enqueueBatch = useCallback(async (videos: YouTubeVideo[], format: AudioFormat) => {
    if (!downloads) throw new Error('Install a new Android build to enable YouTube downloads.');
    await ensureNotificationPermission();
    registerYouTubePlaylist(videos);
    setRevision((value) => value + 1);
    await downloads.enqueueBatchAsync(videos, format, libraryRoot());
    await refresh(true);
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    await downloads?.cancelAsync(id);
    await refresh(true);
  }, [refresh]);

  return (
    <Context value={{ jobs, error, refresh, enqueue, enqueueBatch, cancel }}>
      <Revision value={revision}>{children}</Revision>
    </Context>
  );
}

export function useDownloads() {
  const value = use(Context);
  if (!value) throw new Error('Missing DownloadsProvider');
  return value;
}
export function useDownloadLibraryRevision() { return use(Revision); }
