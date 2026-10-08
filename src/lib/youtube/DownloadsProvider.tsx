import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { carried, unlisted } from './carried';
import { downloads } from './native';
import { isActive, type AudioFormat, type DownloadJob, type FindRequest, type YouTubeVideo } from './types';
import { ensureNotificationPermission, libraryRoot } from '../media/library';
import { registerYouTubePlaylist, syncYouTubePlaylists } from '../db/youtubePlaylists';
import { describeTrack } from '../media/import';
import { fileUnderAlbum } from '../album/index';
import { strings } from '../i18n/index';
import { armFinder, awaitsFinding, kickFinder } from './finder';
import { arrivedSignature, filingKey, jobsSignature } from './signature';

/** Being fetched at this moment: the states a download's progress moves in. */
const FETCHING: readonly string[] = ['preparing', 'downloading', 'converting', 'saving', 'cancelling'];
/** How often the jobs are read while something is being fetched, and how many of those go by between looks at jobs that only wait. */
const WATCH_MS = 1000;
const WAITING_EVERY = 5;

type DownloadContext = {
  jobs: DownloadJob[];
  error: string | null;
  refresh: (checkFiles?: boolean) => Promise<void>;
  enqueue: (video: YouTubeVideo, format: AudioFormat) => Promise<void>;
  enqueueBatch: (videos: YouTubeVideo[], format: AudioFormat) => Promise<void>;
  /**
   * Several videos already chosen, in the order given, as downloads and
   * nothing more: the missing tracks of a record read off a playlist of it.
   * Unlike `enqueueBatch`, which is for adding a playlist, no list is made
   * of them and none is added to.
   */
  enqueueAll: (videos: YouTubeVideo[], format: AudioFormat) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  /**
   * Every job there is, Discover's among them, in the order the phone keeps
   * them: the order they will be fetched in, for the ones still waiting.
   * `jobs` is the same without Discover's, which is what the screens that
   * were here before the queue had a screen of its own all expect.
   */
  all: DownloadJob[];
  /** Whether the queue has been told to start nothing new. What is under way finishes. */
  paused: boolean;
  /** Puts a song in the queue by name, to be found and then fetched in its turn. */
  enqueueFind: (video: YouTubeVideo & { find: FindRequest }, format: AudioFormat) => Promise<void>;
  /** The same for several at once, in the order given: the missing tracks of a record. */
  enqueueFindAll: (videos: (YouTubeVideo & { find: FindRequest })[], format: AudioFormat) => Promise<void>;
  /** Puts a job that failed or was cancelled back in the queue. */
  retry: (id: string) => Promise<void>;
  /** Moves a waiting job to just before another, or to the end for null. */
  move: (id: string, beforeId: string | null) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  /** Cancels several at once: the tracks of a record not yet looked for. */
  cancelMany: (ids: string[]) => Promise<void>;
  /** Clears what has finished from the list. Nothing on the phone is removed. */
  clearHistory: () => Promise<void>;
  cancelAll: () => Promise<void>;
};
const Context = createContext<DownloadContext | null>(null);
const Revision = createContext(0);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [all, setAll] = useState<DownloadJob[]>([]);
  const [paused, setPausedState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const receipts = useRef(new Set<string>());
  const reading = useRef<Promise<void> | null>(null);
  const latest = useRef<DownloadJob[]>([]);
  /** Every job as last read, Discover's too, and whether the queue was paused: what the timer below goes by. */
  const everything = useRef<{ jobs: DownloadJob[]; paused: boolean }>({ jobs: [], paused: false });
  const woken = useRef(0);
  /** The last reading, as words: see `signature.ts`. Null is "whatever is read next is new". */
  const seen = useRef<string | null>(null);
  const arrived = useRef<string | null>(null);

  /*
    [sure] is a reading that must have begun after it was asked for: one that
    follows a change just made, which a reading already under way may have
    been too early to see. Checking the files is such a reading too.
  */
  const read = useCallback(async (checkFiles: boolean, sure: boolean) => {
    if (!downloads) return;
    while (reading.current) {
      await reading.current;
      if (!checkFiles && !sure) return;
    }
    const task = (async () => {
      try {
        const every = await downloads.getJobsAsync(checkFiles);
        const state = await downloads.queueStateAsync?.();
        const next = every.filter(job => !job.discoverKey);
        // The phone hands them over newest first, which is the order the
        // older screens list them in. It keeps them the other way round, and
        // that is the order they are fetched in.
        const kept = [...every].reverse();
        const held = state?.paused ?? false;
        everything.current = { jobs: kept, paused: held };
        attend();
        setError(null);
        // Most readings find what the last one found, and are not handed on.
        const word = jobsSignature(every, held);
        if (word === seen.current) return;
        seen.current = word;
        setAll(kept);
        setPausedState(held);
        // A playlist is brought up to date by what has arrived, and only then.
        const landed = arrivedSignature(next);
        let added = landed !== arrived.current && syncYouTubePlaylists(next);
        arrived.current = landed;
        for (const job of next) {
          if (job.status === 'done' && !receipts.current.has(job.id)) {
            receipts.current.add(job.id);
            added = true;
          }
        }
        latest.current = next;
        setJobs(next);
        if (added) setRevision((value) => value + 1);
      } catch (failure) { setError(failure instanceof Error ? failure.message : strings().search.failed.read); }
    })();
    reading.current = task;
    try { await task; } finally { if (reading.current === task) reading.current = null; }
  }, []);
  const refresh = useCallback((checkFiles = false) => read(checkFiles, false), [read]);
  /** Read after a change just made to the queue, without going through every file for it. */
  const reread = useCallback(() => read(false, true), [read]);

  /*
    What the jobs as last read ask of this side of the queue.

    A job asked for by name is found here, in JavaScript, so wherever one is
    waiting the finder is set going: once, and it then keeps itself going for
    as long as there are names, with the app in front or not (see
    `finder.ts`). And the phone's worker is not started by anything when the
    app is opened on jobs left from last time, or when Discover's own come
    due with no worker up; so where jobs are waiting and nothing is under
    way, it is asked now and then whether it would like to start.
  */
  function attend() {
    const { jobs: every, paused: held } = everything.current;
    if (held) return;
    if (every.some(awaitsFinding)) kickFinder();
    const idle = !every.some((job) => job.status === 'finding' || FETCHING.includes(job.status));
    if (idle && every.some((job) => job.status === 'queued' && !job.video.find) && Date.now() - woken.current >= 5000) {
      woken.current = Date.now();
      void downloads?.wakeQueueAsync?.().catch(() => {});
    }
  }

  useEffect(() => {
    void refresh(true);
    // The finder says when it has taken or settled a job, and anybody who
    // asked the phone for one themselves says so: either way, read again.
    const disarm = downloads ? armFinder(downloads, { changed: () => void reread() }, () => void reread()) : () => {};
    let tick = 0;
    /*
      Only while the app is in front: behind another, timers do not go off
      at all. Every second while something is being fetched, for the
      percentage on screen. Jobs that only wait — paused, Discover's own
      sitting out a quiet minute, names in line — change when something is
      done to them, and whoever does it reads again; they are looked in on
      now and then all the same, for whatever the phone did by itself.
    */
    const timer = setInterval(() => {
      tick += 1;
      if (AppState.currentState !== 'active') return;
      const every = everything.current.jobs;
      if (every.some((job) => FETCHING.includes(job.status))) void refresh();
      else if (tick % WAITING_EVERY === 0 && every.some(isActive)) void refresh();
    }, WATCH_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(true);
    });
    return () => { clearInterval(timer); subscription.remove(); disarm(); };
  }, [refresh, reread]);

  /*
    A track fetched to complete a record is filed under that record as soon as
    its file is in, before anything is looked up about it — and so before the
    effect below, which then finds an edit and leaves the names alone, and
    gives the track the cover the rest of the record has.

    Every finished download at once and not one at a time like the lookups: it
    is a row written from what the job already carries, and nine tracks of an
    album should not sit under nine other albums while the first has its
    lyrics searched for.

    The place is kept on the job by the phone, and a job stays undescribed
    until the effect below has been right through it. So the app being closed
    between the file landing and this running loses nothing: the next reading
    of the jobs finds the same job and files it then.
  */
  const filed = useRef(new Set<string>());
  useEffect(() => {
    let wrote = false;
    for (const job of jobs) {
      const key = filingKey(job);
      if (job.status !== 'done' || job.described || !job.trackId || filed.current.has(key)) continue;
      filed.current.add(key);
      try {
        wrote = fileUnderAlbum(job.trackId, job.video) || wrote;
      } catch {
        // The database would not take it. Asked again at the next reading.
        filed.current.delete(key);
      }
    }
    if (wrote) setRevision((value) => value + 1);
  }, [jobs]);

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
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    await downloads.enqueueAsync(carried(video), format, libraryRoot());
    // An older in-flight read may predate the enqueue. Always read again after
    // it, otherwise an initially empty queue would never start polling.
    await refresh(true);
  }, [refresh]);

  const enqueueBatch = useCallback(async (videos: YouTubeVideo[], format: AudioFormat) => {
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    registerYouTubePlaylist(videos);
    // A list just made may be of songs that arrived long ago, with no job
    // of them changed by its making: the next reading is to be gone through.
    seen.current = null;
    arrived.current = null;
    setRevision((value) => value + 1);
    await downloads.enqueueBatchAsync(videos.map(carried), format, libraryRoot());
    await refresh(true);
  }, [refresh]);

  const enqueueAll = useCallback(async (videos: YouTubeVideo[], format: AudioFormat) => {
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    // All of them or none, as the phone takes a batch: a queue too full for the record leaves it as it was.
    await downloads.enqueueBatchAsync(videos.map((video) => carried(unlisted(video))), format, libraryRoot());
    await refresh(true);
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    await downloads?.cancelAsync(id);
    await reread();
  }, [reread]);
  const cancelMany = useCallback(async (ids: string[]) => {
    let refused: unknown = null;
    for (const id of ids) {
      try { await downloads?.cancelAsync(id); } catch (error) { refused = error; }
    }
    // Once, for all of them.
    await reread();
    if (refused) throw refused;
  }, [reread]);

  const enqueueFind = useCallback(async (video: YouTubeVideo & { find: FindRequest }, format: AudioFormat) => {
    if (!downloads?.enqueueFindAsync) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    await downloads.enqueueFindAsync(carried(video), format, libraryRoot(), null);
    await refresh(true);
  }, [refresh]);
  const enqueueFindAll = useCallback(async (videos: (YouTubeVideo & { find: FindRequest })[], format: AudioFormat) => {
    const native = downloads;
    if (!native?.enqueueFindAsync) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    // One refused — the queue is full — and the ones before it are still in, and shown.
    let refused: unknown = null;
    for (const video of videos) {
      try { await native.enqueueFindAsync(carried(video), format, libraryRoot(), null); }
      catch (error) { refused = error; break; }
    }
    await refresh(true);
    if (refused) throw refused;
  }, [refresh]);
  const retry = useCallback(async (id: string) => { await downloads?.retryAsync?.(id); await refresh(true); }, [refresh]);
  const move = useCallback(async (id: string, beforeId: string | null) => { await downloads?.moveAsync?.(id, beforeId); await reread(); }, [reread]);
  const setPaused = useCallback(async (value: boolean) => { await downloads?.setPausedAsync?.(value); await reread(); }, [reread]);
  const clearHistory = useCallback(async () => { await downloads?.clearFinishedAsync?.(); await reread(); }, [reread]);
  const cancelAll = useCallback(async () => { await downloads?.cancelAllAsync?.(); await reread(); }, [reread]);

  return (
    <Context value={{ jobs, error, refresh, enqueue, enqueueBatch, enqueueAll, cancel, cancelMany, all, paused, enqueueFind, enqueueFindAll, retry, move, setPaused, clearHistory, cancelAll }}>
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
