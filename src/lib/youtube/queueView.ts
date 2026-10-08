import { isActive, jobError, type DownloadJob } from './types.ts';

/**
 * The queue of downloads as it is shown: what is said about the jobs the
 * phone keeps, worked out here so that the screens only draw it.
 *
 * Nothing in this file knows about React or the phone. It is handed the list
 * of jobs as the provider read it and the time, and answers the same thing
 * for the same two — which is what lets it be checked on a desk.
 *
 * Every field a newer build adds to a job is read as though it might not be
 * there, because for a while it is not: the app is built to the queue before
 * the phone's half of it is.
 */

const UNDER_WAY: ReadonlySet<string> = new Set(['finding', 'preparing', 'downloading', 'converting', 'saving', 'cancelling']);
const FINISHED: ReadonlySet<string> = new Set(['done', 'failed', 'cancelled', 'missing']);

/** Being fetched at this moment, as against waiting its turn. */
export function isUnderWay(job: DownloadJob): boolean {
  return UNDER_WAY.has(job.status);
}

export function isWaiting(job: DownloadJob): boolean {
  return job.status === 'queued';
}

export function isFinished(job: DownloadJob): boolean {
  return FINISHED.has(job.status);
}

/** One of Discover's own, that nobody asked for by hand. Nothing is, on a build that does not say. */
export function isAutomatic(job: DownloadJob): boolean {
  return job.automatic === true;
}

/**
 * The queue in the order it will be gone through: what is under way, then
 * what was asked for by hand, then what Discover asked for on its own.
 *
 * The phone's list is already in the order the waiting ones will run. The
 * automatic ones are put last here all the same, since that is the rule they
 * run by — they wait until nothing else is being fetched — and a list that
 * showed one of them between two of the user's would be showing an order
 * that is not the one that happens.
 */
export function queueOf(all: readonly DownloadJob[]): DownloadJob[] {
  const now: DownloadJob[] = [];
  const asked: DownloadJob[] = [];
  const automatic: DownloadJob[] = [];
  for (const job of all) {
    if (isUnderWay(job)) now.push(job);
    else if (isWaiting(job)) (isAutomatic(job) ? automatic : asked).push(job);
  }
  return [...now, ...asked, ...automatic];
}

/**
 * What has finished, newest first, without what has been cleared.
 *
 * A job from before the phone noted when it ended has no date to be sorted
 * by. Those keep the order the phone had them in, after the ones that do:
 * they are the older ones, whatever else is true of them.
 */
export function historyOf(all: readonly DownloadJob[]): DownloadJob[] {
  const dated: DownloadJob[] = [];
  const undated: DownloadJob[] = [];
  for (const job of all) {
    if (!isFinished(job) || job.cleared) continue;
    (job.finishedAt != null ? dated : undated).push(job);
  }
  // A sort keeps equals in the order they came, so two that ended in the same
  // millisecond stay as the phone had them.
  dated.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  return [...dated, ...undated];
}

/** Where a download was asked for from. */
export type Source =
  | { kind: 'discover' }
  | { kind: 'album'; name: string }
  | { kind: 'playlist'; name: string }
  | { kind: 'search' };

export function sourceOf(job: DownloadJob): Source {
  if (job.discoverKey != null) return { kind: 'discover' };
  // Read by hand and not through `placementOf`: only the record's name is
  // wanted, and this has been through the phone's storage and back.
  const album = (job.video.placement as { album?: unknown } | null | undefined)?.album;
  if (typeof album === 'string' && album.trim() !== '') return { kind: 'album', name: album.trim() };
  const list = job.video.sourcePlaylist?.name;
  if (typeof list === 'string' && list.trim() !== '') return { kind: 'playlist', name: list.trim() };
  return { kind: 'search' };
}

/**
 * What a job is called in the queue: the song and whose it is.
 *
 * What the file will be tagged as, where whoever asked for it said — a
 * Discover pick or a track of an album is known by its own name and not by
 * what the uploader called the video. Otherwise the video's title and
 * channel, which for a job that is still only a name to be found are the
 * song and the artist already.
 */
export function namesOf(job: DownloadJob): { title: string; artist: string } {
  const video = job.video;
  const placed = video.placement as { title?: unknown; artist?: unknown } | null | undefined;
  const said = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
  return {
    title: said(video.discoveryTitle) ?? said(placed?.title) ?? said(video.title) ?? '',
    artist: said(video.discoveryArtist) ?? said(placed?.artist) ?? said(video.channel) ?? '',
  };
}

/** Only a job still waiting can change places, and one of Discover's never does: those go last. */
export function canMove(job: DownloadJob): boolean {
  return isWaiting(job) && !isAutomatic(job);
}

/** A job that came to nothing can be asked for again. One whose file was removed afterwards did not fail. */
export function canRetry(job: DownloadJob): boolean {
  return job.status === 'failed' || job.status === 'cancelled';
}

/**
 * Anything not yet finished, short of the two moments it is too late: the
 * file is being put in the library, or the job is already being cancelled.
 */
export function canCancel(job: DownloadJob): boolean {
  return isActive(job) && job.status !== 'saving' && job.status !== 'cancelling';
}

/** How much of the queue there is, for a line that says so. */
export type Tally = { underWay: number; waiting: number; automatic: number };

export function tallyOf(all: readonly DownloadJob[]): Tally {
  let underWay = 0;
  let waiting = 0;
  let automatic = 0;
  for (const job of all) {
    if (isUnderWay(job)) underWay += 1;
    else if (isWaiting(job)) {
      waiting += 1;
      if (isAutomatic(job)) automatic += 1;
    }
  }
  return { underWay, waiting, automatic };
}

/**
 * Two jobs apart for no longer than this are one run of the queue. Long
 * enough for somebody to go back to the search and pick the next song; short
 * enough that this evening's downloads are not counted in with this
 * morning's.
 */
export const RUN_GRACE_MS = 2 * 60_000;

/** How long a run that has ended is still what "the downloads" means. */
export const RUN_LINGER_MS = 5 * 60_000;

/**
 * The furthest back one of Discover's own is taken to have been running.
 *
 * A job asked for by hand keeps the queue occupied from the moment it is
 * asked for. An automatic one does not: it may be made days before it runs,
 * waiting for Wi-Fi or for the queue to be free, and counted from when it
 * was made it would join everything fetched in those days into one run. The
 * phone does not say when a job began to be fetched, so it is taken to have
 * been at most this long before it ended.
 */
export const AUTOMATIC_REACH_MS = 10 * 60_000;

/**
 * The recent downloads: the run of the queue that is going on, or has just
 * ended.
 */
export type Batch = {
  /** The job being fetched, or null when none is: paused, waiting, or all done. */
  current: DownloadJob | null;
  underWay: number;
  waiting: number;
  done: number;
  failed: number;
  /** Every job of the run, the cancelled ones too. Nought is no run at all. */
  total: number;
  /** When the run ended, or null while it is going on and when there is none. */
  endedAt: number | null;
};

const NO_BATCH: Batch = { current: null, underWay: 0, waiting: 0, done: 0, failed: 0, total: 0, endedAt: null };

/**
 * The run of the queue the floating button speaks of: every job asked for
 * since the queue last stood empty.
 *
 * Each job occupies the queue from when it was asked for until it ended, or
 * without end while it has not. Jobs whose times overlap, or that are no
 * more than `RUN_GRACE_MS` apart, are one run. The run in question is the
 * last one: the one holding whatever is not finished, where anything is not,
 * and otherwise the one that ended last — and that one only for
 * `RUN_LINGER_MS` after it ended, after which there is no run and nothing
 * to say.
 *
 * Three kinds of job are counted differently, each because the plain rule
 * would tell a lie about it:
 *
 * - One of Discover's own occupies the queue only from `AUTOMATIC_REACH_MS`
 *   before it ended, and not at all while it waits; see that constant.
 * - A job with no times, from before the phone kept them, is part of the run
 *   if it is not finished — it is there to be seen — and of no run if it is.
 * - A job that has been cleared from the list is not counted. Clearing is
 *   how somebody says they have seen it.
 *
 * `now` matters only once nothing is left unfinished, for deciding whether
 * the last run is still recent.
 */
export function batchOf(all: readonly DownloadJob[], now: number): Batch {
  const spans: { job: DownloadJob; from: number; to: number }[] = [];
  for (const job of all) {
    if (job.cleared) continue;
    const automatic = isAutomatic(job);
    if (isActive(job)) {
      const asked = job.createdAt ?? now;
      const from = !automatic ? asked : isWaiting(job) ? now : Math.max(asked, now - AUTOMATIC_REACH_MS);
      spans.push({ job, from: Math.min(from, now), to: Infinity });
    } else if (isFinished(job) && job.finishedAt != null) {
      const to = job.finishedAt;
      const asked = Math.min(job.createdAt ?? to, to);
      spans.push({ job, from: automatic ? Math.max(asked, to - AUTOMATIC_REACH_MS) : asked, to });
    }
  }
  if (!spans.length) return NO_BATCH;

  // By when each began. Sorting does not disturb the phone's order among
  // equals, which is the order the run's jobs are then gone through in.
  spans.sort((a, b) => a.from - b.from);
  let run: DownloadJob[] = [];
  let until = -Infinity;
  for (const span of spans) {
    if (span.from > until + RUN_GRACE_MS) run = [];
    run.push(span.job);
    until = Math.max(until, span.to);
  }

  const going = until === Infinity;
  if (!going && until < now - RUN_LINGER_MS) return NO_BATCH;

  const batch: Batch = { ...NO_BATCH, total: run.length, endedAt: going ? null : until };
  // In the phone's order and not by when each was asked for, so that the one
  // named as being fetched is the one the queue's own screen puts first.
  const members = new Set(run);
  for (const job of all) {
    if (!members.has(job)) continue;
    if (isUnderWay(job)) {
      batch.underWay += 1;
      batch.current ??= job;
    } else if (isWaiting(job)) batch.waiting += 1;
    else if (job.status === 'failed') batch.failed += 1;
    // A file removed since was fetched all the same.
    else if (job.status === 'done' || job.status === 'missing') batch.done += 1;
  }
  return batch;
}

/** One line of the queue's screen. */
export type QueueItem =
  | { kind: 'heading'; key: string; section: 'now' | 'next' | 'history' }
  | { kind: 'now'; key: string; job: DownloadJob }
  /** `next` is the one that will be fetched next, which has nowhere further up to go. */
  | { kind: 'waiting'; key: string; job: DownloadJob; next: boolean }
  | { kind: 'finished'; key: string; job: DownloadJob };

/**
 * The whole screen as one list: a heading and its rows for what is being
 * fetched, for what waits and for what has finished, each left out where it
 * would be a heading over nothing.
 *
 * One list and not three, because the last of them is as long as everything
 * that has ever been downloaded and only a single list keeps to drawing the
 * rows that are on screen.
 *
 * `order` is the waiting jobs as somebody has just dragged them, shown
 * before the phone has said so; see `inOrder`. `movable` is where in the
 * list the rows that can be dragged are, which is all a drag needs to know:
 * they are always together, the ones asked for by hand, and a row is only
 * ever dropped among them.
 */
export function listOf(
  all: readonly DownloadJob[],
  order: readonly string[] | null = null
): { items: QueueItem[]; movable: { first: number; count: number } } {
  const items: QueueItem[] = [];
  const now: DownloadJob[] = [];
  let asked: DownloadJob[] = [];
  const automatic: DownloadJob[] = [];
  for (const job of all) {
    if (isUnderWay(job)) now.push(job);
    else if (isWaiting(job)) (isAutomatic(job) ? automatic : asked).push(job);
  }
  if (order) asked = inOrder(asked, order);

  if (now.length) {
    items.push({ kind: 'heading', key: 'heading:now', section: 'now' });
    for (const job of now) items.push({ kind: 'now', key: `now:${job.id}`, job });
  }
  let first = items.length;
  if (asked.length || automatic.length) {
    items.push({ kind: 'heading', key: 'heading:next', section: 'next' });
    first = items.length;
    for (const job of asked) items.push({ kind: 'waiting', key: job.id, job, next: items.length === first });
    for (const job of automatic) items.push({ kind: 'waiting', key: job.id, job, next: items.length === first });
  }
  const history = historyOf(all);
  if (history.length) {
    items.push({ kind: 'heading', key: 'heading:history', section: 'history' });
    for (const job of history) items.push({ kind: 'finished', key: job.id, job });
  }
  return { items, movable: { first, count: asked.length } };
}

/**
 * Jobs put in the order of a list of their ids.
 *
 * For showing a drag's result at once. One the list does not name — asked
 * for since — goes after the ones it does, in the order it was in, which is
 * where a new job goes anyway.
 */
export function inOrder(jobs: readonly DownloadJob[], order: readonly string[]): DownloadJob[] {
  const place = new Map<string, number>();
  order.forEach((id, index) => place.set(id, index));
  return jobs
    .map((job, index) => ({ job, at: place.get(job.id) ?? order.length + index }))
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.job);
}

/**
 * A drop, as the phone is told of it: which job, and the job it now stands
 * just before — or null for the end, where it was dropped last.
 *
 * To the end and not "before the first of Discover's own". Those are after
 * everything asked for by hand whatever is said here, and the end is a
 * thing the phone can always find. Null too where nothing moved: the row
 * was put back where it was, or the places are not ones the list has.
 */
export function dropOf(
  ids: readonly string[],
  from: number,
  to: number
): { id: string; beforeId: string | null; order: string[] } | null {
  const id = ids[from];
  if (id === undefined || to < 0 || to >= ids.length || to === from) return null;
  const order = afterMove(ids, from, to);
  return { id, beforeId: order[to + 1] ?? null, order };
}

/** A list with the entry at `from` taken out and put back at `to`. */
export function afterMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [taken] = next.splice(from, 1);
  if (taken === undefined) return next;
  next.splice(to, 0, taken);
  return next;
}

/**
 * Whether two readings of a job would be drawn the same.
 *
 * The jobs are read off the phone again every second while anything is being
 * fetched, and every reading is a list of new objects. A row compares what
 * it shows and not which object it was handed, or a history of five hundred
 * finished downloads would be drawn again each second for the sake of the
 * one that is not finished.
 */
export function sameJob(a: DownloadJob, b: DownloadJob): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.progress === b.progress &&
    a.format === b.format &&
    a.automatic === b.automatic &&
    a.discoverKey === b.discoverKey &&
    jobError(a) === jobError(b) &&
    a.video.title === b.video.title &&
    a.video.channel === b.video.channel &&
    a.video.thumbnail === b.video.thumbnail &&
    a.video.discoveryTitle === b.video.discoveryTitle &&
    a.video.discoveryArtist === b.video.discoveryArtist &&
    a.video.sourcePlaylist?.name === b.video.sourcePlaylist?.name &&
    a.video.placement?.album === b.video.placement?.album &&
    a.video.placement?.title === b.video.placement?.title
  );
}
