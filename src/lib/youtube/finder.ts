import { carried } from './carried.ts';
import { chooseVideo } from '../discover/video.ts';
import type { DownloadJob, YouTubeVideo } from './types.ts';

/**
 * Finding the video for a job that was asked for by name.
 *
 * Such a job waits in the phone's queue like any other, and the phone decides
 * when its turn to be looked for has come: after whatever is ahead of it,
 * never beside a download, never beside a search somebody is making by hand.
 * What the phone cannot do is choose. Which of twenty results is the same
 * recording — not the live take, not the cover, not something else of the
 * same name — is `chooseVideo`'s to say, and that lives here.
 *
 * So finding is three questions asked of the phone, one job at a time: which
 * job may be looked for now, what a search for it finds, and then telling it
 * which of those it is to fetch. Everything that has to outlast this — the
 * order, that a job is being looked for, why a search failed — the phone
 * writes down itself, which is why nothing here keeps anything and why it
 * does not matter who asks: the app while it is open, or Discover's task
 * with no screen at all.
 *
 * The first question is not answered at once. `claimFindAsync` does not come
 * back until a name's turn has come, or there is no name left to wait for,
 * or some seconds have gone by; and whoever asked it asks again. That is the
 * whole of how the finding keeps going, and it is done this way because of
 * where it has to keep going: with the app behind another, or the screen
 * locked, a timer set here does not go off, but a call that was made is
 * still answered.
 */
export type FinderNative = {
  claimFindAsync?: () => Promise<DownloadJob | null>;
  findSearchAsync?: (query: string, searchId: string) => Promise<YouTubeVideo[]>;
  resolveFindAsync?: (id: string, video: YouTubeVideo | null) => Promise<void>;
  getJobsAsync: (refreshFiles: boolean) => Promise<DownloadJob[]>;
  queueStateAsync?: () => Promise<{ paused: boolean }>;
};

export type FinderOptions = {
  /** Asked before each job is taken. One already taken is seen through. */
  stopped?: () => boolean;
  /** Told whenever a job has changed: taken, found, failed. */
  changed?: () => void;
};

/** Waiting in the queue for its video to be looked for. */
export function awaitsFinding(job: DownloadJob): boolean {
  return job.status === 'queued' && job.video.find != null;
}

/**
 * Asks once for a job to look for, and sees it through if given one.
 *
 * Nothing thrown gets out. A search that fails has already been written on
 * its job by the phone, with why; one that gave way to a search made by hand
 * has been put back in its place. Either way the thing to do is ask what is
 * next. Answers the id of the job it was given, or null for none.
 */
async function findOne(native: FinderNative, changed?: () => void): Promise<string | null> {
  const { claimFindAsync, findSearchAsync, resolveFindAsync } = native;
  if (!claimFindAsync || !findSearchAsync || !resolveFindAsync) return null;
  let job: DownloadJob | null;
  try {
    job = await claimFindAsync.call(native);
  } catch {
    return null;
  }
  const find = job?.video.find;
  if (!job || !find) return null;
  changed?.();
  try {
    // Known to the phone by the job's id, which is how cancelling the job stops it.
    const videos = await findSearchAsync.call(native, find.query, job.id);
    let video: YouTubeVideo | null = null;
    try {
      video = chooseVideo(find, videos);
    } catch {
      // Results it could not read are results with nothing in them that fits.
    }
    await resolveFindAsync.call(native, job.id, video ? carried(video) : null);
  } catch {
    // Written on the job already. See above.
  }
  changed?.();
  return job.id;
}

/** What the queue looks like to somebody deciding whether to go on asking. */
async function standing(native: FinderNative): Promise<{ jobs: DownloadJob[]; paused: boolean } | null> {
  try {
    const jobs = await native.getJobsAsync(false);
    const state = await native.queueStateAsync?.call(native);
    return { jobs, paused: state?.paused ?? false };
  } catch {
    return null;
  }
}

/**
 * How many times in a row the phone may answer "none" at once, with names
 * waiting, before this stops asking. It should never: with names waiting it
 * holds the question until one's turn comes. If it does all the same, asking
 * again and again as fast as it answers would be a loop that never rests,
 * and stopping costs only the wait until something next sets this going.
 */
const QUICK_NONES = 3;
const QUICK_MS = 500;

/**
 * Looks for the video of every job asked for by name, each in its turn, for
 * as long as any is waiting. Answers how many it took.
 *
 * It ends when no name is waiting, when the queue is paused, or when told to
 * stop — and is set going again by whoever next has reason to think there is
 * something to find. In between it needs nobody: each answer from the phone
 * is what makes the next question.
 */
export async function findWhileWaiting(
  native: FinderNative,
  options: FinderOptions = {},
  now: () => number = Date.now
): Promise<number> {
  let taken = 0;
  let quick = 0;
  for (;;) {
    if (options.stopped?.()) return taken;
    const asked = now();
    const id = await findOne(native, options.changed);
    if (id != null) {
      taken += 1;
      quick = 0;
      continue;
    }
    const queue = await standing(native);
    if (!queue || queue.paused || !queue.jobs.some(awaitsFinding)) return taken;
    quick = now() - asked < QUICK_MS ? quick + 1 : 0;
    if (quick >= QUICK_NONES) return taken;
  }
}

/**
 * Goes on asking until [id] has been looked for, or [deadline] has passed.
 *
 * For Discover's task, which runs with no screen and so with nobody to do
 * its finding for it, and has only so long. The phone hands out jobs in its
 * own order, and Discover's own come after everything else. So this gives up
 * at once where the job cannot have its turn while the task runs: the queue
 * is paused, or something somebody asked for is waiting or under way, which
 * only the app being opened will fetch. The job then waits as it is.
 *
 * The deadline is looked at between questions, and a question may take the
 * phone twenty-five seconds to answer: allow that much past it.
 */
export async function findUntil(
  native: FinderNative,
  id: string,
  deadline: number,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => number = Date.now
): Promise<void> {
  for (;;) {
    const queue = await standing(native);
    if (!queue || queue.paused) return;
    const job = queue.jobs.find((entry) => entry.id === id);
    if (!job || !awaitsFinding(job)) return;
    const ahead = queue.jobs.some(
      (entry) => entry.id !== id && !entry.automatic && !['done', 'failed', 'cancelled', 'missing'].includes(entry.status)
    );
    if (ahead || now() >= deadline) return;
    const asked = now();
    const found = await findOne(native);
    // Answered "none" at once: not a phone that holds the question. Timers
    // do go off in a task like this one, so wait a moment and not spin.
    if (found == null && now() - asked < QUICK_MS) await pause(1000);
  }
}

/*
  The one finder the app itself runs. A module's and not a component's, since
  a job is as likely to be asked for by Discover's engine as by a screen, and
  whoever asked should be able to say "the queue has changed" without knowing
  who reads it or who does the finding.
*/
let armed: { native: FinderNative; options: FinderOptions; reread: () => void } | null = null;
let running: Promise<number> | null = null;

/**
 * Says who is to do the finding while the app is open, and how the queue is
 * read again ([reread]) when somebody outside says it has changed. Answers
 * how to take that back.
 */
export function armFinder(native: FinderNative, options: FinderOptions = {}, reread: () => void = () => {}): () => void {
  const mine = { native, options, reread };
  armed = mine;
  return () => {
    if (armed === mine) armed = null;
  };
}

/**
 * There may be something to find. Starts the finder unless it is already at
 * work — there is one, however many ask — and does nothing where there is
 * nobody to do it.
 */
export function kickFinder(): void {
  const mine = armed;
  if (!mine || running) return;
  const stopped = () => armed !== mine || mine.options.stopped?.() === true;
  const run = findWhileWaiting(mine.native, { ...mine.options, stopped }).finally(() => {
    if (running === run) running = null;
  });
  running = run;
}

/** Whether the app's finder is at work now. */
export function finderRunning(): boolean {
  return running != null;
}

/**
 * The queue was changed by somebody who is not the provider: Discover's
 * engine, asking the phone for a song itself. The provider reads the jobs
 * again, which is also what sets the finder going if there is now a name to
 * find. Nothing, where there is no provider: no screen, nobody to show.
 */
export function queueChanged(): void {
  armed?.reread();
}
