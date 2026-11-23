import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { carried, unlisted } from './carried';
import { extractorWanted } from './extractorState';
import { downloads } from './native';
import { isActive, isListenJob, type AudioFormat, type DownloadJob, type FindRequest, type YouTubeVideo } from './types';
import { ensureNotificationPermission, libraryRoot } from '../media/library';
import { registerYouTubePlaylist, syncYouTubePlaylists } from '../db/youtubePlaylists';
import { describeTrack } from '../media/import';
import { fileUnderAlbum } from '../album/index';
import { strings } from '../i18n/index';
import { armFinder, awaitsFinding, kickFinder } from './finder';
import { arrivedSignature, filingKey, jobsSignature } from './signature';
import { publishJobs, readOnChange, standAsReader } from './watch';
import { noteFailedDownloads } from '../support/errorLogStore';
import { partTitleOf, tapeFolderOf } from '../tapes/folders';

/** Being fetched at this moment: the states a download's progress moves in. */
const FETCHING: readonly string[] = ['preparing', 'downloading', 'converting', 'saving', 'cancelling'];
/** How often the jobs are read while something is being fetched, and how many of those go by between looks at jobs that only wait. */
const WATCH_MS = 1000;
const WAITING_EVERY = 5;
/** No videos already here, for a batch that says none. */
const NONE_OWNED: ReadonlyMap<string, string> = new Map();

type DownloadContext = {
  jobs: DownloadJob[];
  error: string | null;
  refresh: (checkFiles?: boolean) => Promise<void>;
  enqueue: (video: YouTubeVideo, format: AudioFormat) => Promise<void>;
  /**
   * [owned] are the videos the library has already, by track: put in the
   * list and not fetched again (`owned.ts`).
   */
  enqueueBatch: (videos: YouTubeVideo[], format: AudioFormat, owned?: ReadonlyMap<string, string>) => Promise<void>;
  /**
   * Several videos already chosen, in the order given, as downloads and
   * nothing more: the missing tracks of a record read off a playlist of it.
   * Unlike `enqueueBatch`, which is for adding a playlist, no list is made
   * of them and none is added to.
   */
  enqueueAll: (videos: YouTubeVideo[], format: AudioFormat) => Promise<void>;
  /**
   * Videos fetched as tapes, into a folder of the Tapes folder named [name]:
   * the show or the book. [firstPart] numbers them from there in the order
   * given, as the parts of one book are; null leaves them unnumbered, as the
   * episodes of a show. Kept as they came, never as mp3, and in no list.
   */
  enqueueTapes: (videos: YouTubeVideo[], name: string, firstPart: number | null) => Promise<void>;
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
/** What [work] failed with, or null: a `catch` out here, where the compiler need not take one. */
async function settle(work: Promise<unknown> | undefined): Promise<unknown> {
  try {
    await work;
    return null;
  } catch (failure) {
    return failure ?? new Error('failed');
  }
}

/** How many times a receipt the phone would not take is tried again, and how long apart. */
const DESCRIBE_TRIES = 5;
const DESCRIBE_AGAIN_MS = 30_000;

/** {@link fileUnderAlbum}, with null for a database that would not take it. Out here, where the compiler need not take a `try`. */
function fileQuietly(trackId: string, video: YouTubeVideo): boolean | null {
  try {
    return fileUnderAlbum(trackId, video);
  } catch {
    return null;
  }
}

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
  /** The whole list as last read, and the count of changes it was read at: what a glance is laid over. */
  const whole = useRef<{ revision: number; every: DownloadJob[] } | null>(null);
  const latest = useRef<DownloadJob[]>([]);
  /** Every job as last read, Discover's too, and whether the queue was paused: what the timer below goes by. */
  const everything = useRef<{ jobs: DownloadJob[]; paused: boolean }>({ jobs: [], paused: false });
  const woken = useRef(0);
  /** The last reading, as words: see `signature.ts`. Null is "whatever is read next is new". */
  const seen = useRef<string | null>(null);
  const arrived = useRef<string | null>(null);

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
  const attend = () => {
    const { jobs: every, paused: held } = everything.current;
    if (held) return;
    if (every.some(awaitsFinding)) kickFinder();
    const idle = !every.some((job) => job.status === 'finding' || FETCHING.includes(job.status));
    if (idle && every.some((job) => job.status === 'queued' && !job.video.find) && Date.now() - woken.current >= 5000) {
      woken.current = Date.now();
      void downloads?.wakeQueueAsync?.().catch(() => {});
    }
  };

  /*
    [sure] is a reading that must have begun after it was asked for: one that
    follows a change just made, which a reading already under way may have
    been too early to see. Checking the files is such a reading too.
  */
  const read = useCallback(async (checkFiles: boolean, sure: boolean, glance = false) => {
    if (!downloads) return;
    while (reading.current) {
      await reading.current;
      if (!checkFiles && !sure) return;
    }
    const queue = downloads;
    /*
      A glance, every second while something is fetched: only the jobs under
      way or waiting, laid over the whole list last read, so long as nothing
      worth reading the whole of it for has happened since and they are the
      same jobs. Anything else, and the whole of it is read.
    */
    const glanced = async (): Promise<DownloadJob[] | null> => {
      const last = whole.current;
      if (!glance || !last || !queue.getActiveJobsAsync) return null;
      const { revision, jobs: active } = await queue.getActiveJobsAsync();
      if (revision !== last.revision) return null;
      const now = new Map(active.map((job) => [job.id, job]));
      const was = last.every.filter(isActive);
      if (was.length !== active.length || was.some((job) => !now.has(job.id))) return null;
      return last.every.map((job) => now.get(job.id) ?? job);
    };
    const wholly = async (): Promise<DownloadJob[]> => {
      // Asked first: a change made between the two is then read again at the next glance, and not missed.
      const revision = await queue.getJobsRevisionAsync?.();
      const every = await queue.getJobsAsync(checkFiles);
      whole.current = revision == null ? null : { revision, every };
      return every;
    };
    const once = async () => {
      const every = (await glanced()) ?? (await wholly());
      const state = await queue.queueStateAsync?.();
      // Discover's own are Discover's; a song listened to from the Search tab has a key too, and is the screens'.
      const next = every.filter(job => !job.discoverKey || job.video.listen === true);
      // Whatever has failed since last time, for the report screen; Discover's own included.
      noteFailedDownloads(every);
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
      // And whoever is not a screen: Discover's engine goes by the same reading.
      publishJobs({ jobs: kept, paused: held });
      // Not the songs Discover is only looking for ahead: those are not downloads, and no screen of downloads shows them.
      setAll(kept.some((job) => job.hold) ? kept.filter((job) => !job.hold) : kept);
      setPausedState(held);
      // A playlist is brought up to date by what has arrived, and only then.
      // Not by the songs listened to: one of a list's videos listened to was put in the list beside the one it already had.
      const ownJobs = next.filter((job) => !job.discoverKey);
      const landed = arrivedSignature(ownJobs);
      let added = landed !== arrived.current && syncYouTubePlaylists(ownJobs);
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
    };
    // Caught here rather than inside, where the compiler cannot take what the reading is written with.
    const task = once().catch((failure: unknown) => {
      setError(failure instanceof Error ? failure.message : strings().search.failed.read);
    });
    reading.current = task;
    // It catches whatever it meets, so it always comes back: no `finally`, which the compiler cannot take.
    await task;
    if (reading.current === task) reading.current = null;
  }, []);
  const refresh = useCallback((checkFiles = false) => read(checkFiles, false), [read]);
  /** For the percentages, every second: see `glance` above. */
  const glance = useCallback(() => read(false, false, true), [read]);
  /** Read after a change just made to the queue, without going through every file for it. */
  const reread = useCallback(() => read(false, true), [read]);

  useEffect(() => {
    void refresh(true);
    // The finder says when it has taken or settled a job, and anybody who
    // asked the phone for one themselves says so: either way, read again.
    const disarm = downloads ? armFinder(downloads, { changed: () => void reread() }, () => void reread()) : () => {};
    /*
      The phone says when a job has changed state, and the jobs are read
      again for it. That is what tells of a download that finished by itself
      — nobody did anything to it, so nobody else reads — and it is the only
      thing that does with the screen locked, where the timer below is not
      running. A build from before the phone said so says nothing, and the
      timer is then all there is, as it was.
    */
    const heard = downloads?.addListener?.('onQueueChanged', readOnChange(reread));
    const standing = standAsReader();
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
      if (every.some((job) => FETCHING.includes(job.status))) void glance();
      else if (tick % WAITING_EVERY === 0 && every.some(isActive)) void refresh();
    }, WATCH_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(true);
    });
    return () => { clearInterval(timer); subscription.remove(); disarm(); heard?.remove(); standing(); };
  }, [glance, refresh, reread]);

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
      const filedNow = fileQuietly(job.trackId, job.video);
      // The database would not take it. Asked again at the next reading.
      if (filedNow === null) filed.current.delete(key);
      else if (filedNow) wrote = true;
    }
    if (wrote) setRevision((value) => value + 1);
  }, [jobs]);

  // Identification is secondary to saving the audio. It may be interrupted and
  // retried after reopening the app; it never turns a successful download red.
  const nextDescription = jobs.find((job) => job.status === 'done' && !job.described && job.trackId);
  const descriptionId = nextDescription?.id;
  const trackId = nextDescription?.trackId;
  // A tape is not a song, and is not looked up as one: its names are the video's and its list's. See `lib/tapes`.
  // Nor is a song listened to and not kept, whose file is not the library's: it is looked up once kept, as any song is.
  const describeIt = nextDescription != null && nextDescription.video.tape == null && !isListenJob(nextDescription);
  // A receipt the phone would not take, tried again a while later: left, the same job would be next for good and nothing after it described.
  const [describeTries, setDescribeTries] = useState(0);
  useEffect(() => {
    if (!descriptionId || !trackId || !downloads) return;
    const queue = downloads;
    const controller = new AbortController();
    let again: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      if (describeIt) await describeTrack(trackId, controller.signal);
      if (controller.signal.aborted) return;
      const failure = await settle(queue.markDescribedAsync(descriptionId));
      if (controller.signal.aborted) return;
      if (failure) {
        if (describeTries < DESCRIBE_TRIES) again = setTimeout(() => setDescribeTries((tries) => tries + 1), DESCRIBE_AGAIN_MS);
        return;
      }
      setRevision((value) => value + 1);
      await refresh(true);
    })();
    return () => {
      controller.abort();
      if (again) clearTimeout(again);
    };
  }, [descriptionId, describeIt, describeTries, trackId, refresh]);

  /*
    Each of the five below that put something in the queue is somebody doing
    so by hand, which is one of the two moments the app may look for a newer
    yt-dlp by itself, where a look is due: `extractorWanted`, and see
    `extractor.ts`. Discover's own are asked of the phone elsewhere and do
    not come through here.
  */
  const enqueue = useCallback(async (video: YouTubeVideo, format: AudioFormat) => {
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    extractorWanted();
    await downloads.enqueueAsync(carried(video), format, libraryRoot());
    // An older in-flight read may predate the enqueue. Always read again after
    // it, otherwise an initially empty queue would never start polling.
    await refresh(true);
  }, [refresh]);

  const enqueueBatch = useCallback(async (videos: YouTubeVideo[], format: AudioFormat, given?: ReadonlyMap<string, string>) => {
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    const owned = given ?? NONE_OWNED;
    const wanted = videos.filter((video) => !owned.has(video.id));
    if (wanted.length > 0) {
      await ensureNotificationPermission();
      extractorWanted();
    }
    registerYouTubePlaylist(videos, owned);
    // A list just made may be of songs that arrived long ago, with no job
    // of them changed by its making: the next reading is to be gone through.
    seen.current = null;
    arrived.current = null;
    setRevision((value) => value + 1);
    if (wanted.length > 0) await downloads.enqueueBatchAsync(wanted.map(carried), format, libraryRoot());
    await refresh(true);
  }, [refresh]);

  const enqueueAll = useCallback(async (videos: YouTubeVideo[], format: AudioFormat) => {
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    extractorWanted();
    // All of them or none, as the phone takes a batch: a queue too full for the record leaves it as it was.
    await downloads.enqueueBatchAsync(videos.map((video) => carried(unlisted(video))), format, libraryRoot());
    await refresh(true);
  }, [refresh]);

  const enqueueTapes = useCallback(async (videos: YouTubeVideo[], name: string, firstPart: number | null) => {
    if (!downloads) throw new Error(strings().search.unavailable.downloads);
    if (videos.length === 0) return;
    await ensureNotificationPermission();
    extractorWanted();
    const sent = videos.map((video, at) =>
      // Parts are one record, the list's; a video on its own is a record of its own, in its show's folder.
      carried({
        ...unlisted(video),
        // The list the parts came from kept with each, for the tape's details to say where it came from.
        tape: firstPart != null
          ? { name, part: firstPart + at, title: partTitleOf(video.title, name), list: video.sourcePlaylist ?? { id: '', name } }
          : { name, album: video.title },
      })
    );
    await downloads.enqueueBatchAsync(sent, 'original', tapeFolderOf(libraryRoot(), name));
    await refresh(true);
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    await downloads?.cancelAsync(id);
    await reread();
  }, [reread]);
  const cancelMany = useCallback(async (ids: string[]) => {
    let refused: unknown = null;
    for (const id of ids) {
      const failure = await settle(downloads?.cancelAsync(id));
      if (failure) refused = failure;
    }
    // Once, for all of them.
    await reread();
    if (refused) throw refused;
  }, [reread]);

  const enqueueFind = useCallback(async (video: YouTubeVideo & { find: FindRequest }, format: AudioFormat) => {
    if (!downloads?.enqueueFindAsync) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    extractorWanted();
    await downloads.enqueueFindAsync(carried(video), format, libraryRoot(), null);
    await refresh(true);
  }, [refresh]);
  const enqueueFindAll = useCallback(async (videos: (YouTubeVideo & { find: FindRequest })[], format: AudioFormat) => {
    const native = downloads;
    if (!native?.enqueueFindAsync) throw new Error(strings().search.unavailable.downloads);
    await ensureNotificationPermission();
    extractorWanted();
    // One refused — the queue is full — and the ones before it are still in, and shown.
    let refused: unknown = null;
    for (const video of videos) {
      const failure = await settle(native.enqueueFindAsync(carried(video), format, libraryRoot(), null));
      if (failure) {
        refused = failure;
        break;
      }
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
    <Context value={{ jobs, error, refresh, enqueue, enqueueBatch, enqueueAll, enqueueTapes, cancel, cancelMany, all, paused, enqueueFind, enqueueFindAll, retry, move, setPaused, clearHistory, cancelAll }}>
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
