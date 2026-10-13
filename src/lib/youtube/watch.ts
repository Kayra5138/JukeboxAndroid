import type { DownloadJob } from './types.ts';

/**
 * The jobs as last read off the phone, for anybody who is not a screen.
 *
 * The queue is read in one place while the app is open: the provider reads
 * it, when something is done to it, when the phone says a job has changed,
 * and every second while a download is under way. Screens get that reading
 * through React. Discover's engine is not a component, and used to read the
 * same jobs for itself on a timer of its own, once a second, beside the
 * provider doing the same. Now whoever reads says so here, and whoever else
 * wants to know is told.
 *
 * Nothing in this file knows about React or the phone, so the engine built
 * on it can be checked on a desk.
 */
export type QueueReading = {
  /** Every job, Discover's among them, in the order the phone keeps them. */
  jobs: readonly DownloadJob[];
  paused: boolean;
};

type Watcher = (reading: QueueReading) => void;

const watchers = new Set<Watcher>();
let latest: QueueReading | null = null;
let readers = 0;

/** Told by whoever has just read the jobs. A reading that found nothing new need not be published. */
export function publishJobs(reading: QueueReading): void {
  latest = reading;
  for (const told of [...watchers]) told(reading);
}

/** Tells [watcher] of every reading from now on. Answers with the way to stop. */
export function watchJobs(watcher: Watcher): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

/** The last reading there was, or null where the jobs have not been read since the app started. */
export function jobsNow(): QueueReading | null {
  return latest;
}

/**
 * Says that the jobs are being read by somebody for as long as this stands:
 * the provider, while it is mounted. Answers with the way to take it back.
 *
 * Discover's task runs with no screen and so with no provider, and has to
 * read the jobs itself there. This is how it knows which of the two it is in.
 */
export function standAsReader(): () => void {
  readers += 1;
  let stood = true;
  return () => {
    if (stood) readers -= 1;
    stood = false;
  };
}

export function readerPresent(): boolean {
  return readers > 0;
}

/**
 * Reads again each time the phone says a job has changed, and never twice at
 * once.
 *
 * The phone says so for every change of state, and several come together: a
 * search ends, its job becomes a download, the download is taken. Each is
 * answered by reading every job, so they are folded: while one reading is
 * under way a second is only noted, and made once when the first is back —
 * which is after the change that asked for it, whichever that was.
 */
export function readOnChange(read: () => Promise<unknown>): () => void {
  let reading = false;
  let again = false;
  return () => {
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    const once = (): Promise<void> =>
      read().then(
        () => undefined,
        () => undefined
      ).then(() => {
        if (!again) {
          reading = false;
          return;
        }
        again = false;
        return once();
      });
    void once();
  };
}
