import { scrub } from './scrub.ts';

/**
 * The last few things that went wrong, kept for a bug report.
 *
 * A report that says "downloads stopped working" is a question with no
 * answer; one that says which code each failed download came back with is
 * most of the way to a fix. Nobody remembers the code, and the screens that
 * show a failure say it in words, so the app writes each one down itself,
 * in a short list that only the report screen ever reads.
 *
 * Kept on the phone and nowhere else. Nothing reads it but the screen that
 * shows it, and that screen sends nothing: it fills in an issue that the
 * person sends, or does not, themselves. Every message is scrubbed before
 * it is written (see `scrub.ts`), so what is on the phone is already only
 * what could be shown to anybody.
 *
 * This file is the list's arithmetic, with nothing of the phone in it;
 * `errorLogStore.ts` keeps it in the settings table and is what the rest of
 * the app calls.
 */

/** How many entries are kept; the oldest goes when one more arrives. */
export const KEEP = 50;

/**
 * Where a failure was noticed. A word rather than a sentence, so that it
 * reads the same whatever language the app was speaking.
 */
export type ErrorKind = 'js' | 'render' | 'download' | 'discover' | 'search' | 'lookup' | 'playback';

const KINDS: readonly ErrorKind[] = ['js', 'render', 'download', 'discover', 'search', 'lookup', 'playback'];

export type ErrorEntry = {
  /** When, in milliseconds. */
  at: number;
  /** The app's version at the time, since a report is often about the version before. */
  version: string;
  kind: ErrorKind;
  /** Already scrubbed. */
  message: string;
};

export type ErrorLog = {
  /** Oldest first. */
  entries: ErrorEntry[];
  /**
   * The latest end of a failed download that has been written down, so that
   * the same failed job, read again each time the queue is, is written once.
   */
  downloadsTo: number;
};

export const EMPTY_LOG: ErrorLog = { entries: [], downloadsTo: 0 };

/**
 * The same failure again within this long is not written down again. A
 * screen that throws on every frame would otherwise fill the list with one
 * line fifty times over in a second, and push out everything that led to it.
 */
export const REPEAT_MS = 60_000;

function isEntry(value: unknown): value is ErrorEntry {
  const entry = value as Partial<ErrorEntry> | null;
  return (
    typeof entry === 'object' &&
    entry != null &&
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    typeof entry.version === 'string' &&
    typeof entry.message === 'string' &&
    KINDS.includes(entry.kind as ErrorKind)
  );
}

/** The log out of what was written down, where that is anything at all. */
export function readLog(text: string | null | undefined): ErrorLog {
  if (!text) return EMPTY_LOG;
  try {
    const kept = JSON.parse(text) as { entries?: unknown; downloadsTo?: unknown } | null;
    const entries = Array.isArray(kept?.entries) ? kept.entries.filter(isEntry).slice(-KEEP) : [];
    const downloadsTo = typeof kept?.downloadsTo === 'number' && Number.isFinite(kept.downloadsTo) ? kept.downloadsTo : 0;
    return { entries, downloadsTo };
  } catch {
    return EMPTY_LOG;
  }
}

/**
 * [log] with one more failure, scrubbed, and the oldest let go of past
 * {@link KEEP}. The same log back where it is the last one over again, or
 * where nothing is left of it once scrubbed.
 */
export function withEntry(
  log: ErrorLog,
  failure: { at: number; version: string | null | undefined; kind: ErrorKind; message: unknown },
  /** The names the app knows of, taken out wherever they stand: rule 0 of `scrub.ts`. */
  names: readonly string[] = []
): ErrorLog {
  const message = scrub(failure.message, names);
  if (!message) return log;
  const last = log.entries[log.entries.length - 1];
  if (last && last.kind === failure.kind && last.message === message && Math.abs(failure.at - last.at) < REPEAT_MS) return log;
  const entry: ErrorEntry = { at: failure.at, version: failure.version || '?', kind: failure.kind, message };
  // In order of when, which a download's failure, written down late, may not be.
  const entries = [...log.entries, entry].sort((a, b) => a.at - b.at).slice(-KEEP);
  return { ...log, entries };
}

/** How long ago a failed download may have ended and still be news. */
export const DOWNLOADS_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

type FailedJob = {
  status: string;
  finishedAt?: number | null;
  errorCode?: string | null;
  error?: string | null;
  automatic?: boolean;
  discoverKey?: string | null;
  hold?: boolean;
  /** What the video was called and by whom, to be taken out of its message. */
  video?: { title?: string | null; channel?: string | null; discoveryTitle?: string | null; discoveryArtist?: string | null } | null;
};

/**
 * [log] with every download that failed since the last of them written
 * down, each as its code and the extractor's last line.
 *
 * Read off the queue rather than told by it: a download fails on the phone's
 * side, often with the app behind another or closed, and the queue is what
 * still has it the next time the app looks. Discover's own are written down
 * as Discover's, and a song it was only looking for ahead is left out — that
 * finding nothing is how Discover learns a song is not on YouTube, and is
 * not a fault.
 */
export function withFailedDownloads(
  log: ErrorLog,
  jobs: readonly FailedJob[],
  version: string | null | undefined,
  now: number,
  names: readonly string[] = []
): ErrorLog {
  const fresh = jobs
    .filter(
      (job) =>
        job.status === 'failed' &&
        !job.hold &&
        typeof job.finishedAt === 'number' &&
        job.finishedAt > log.downloadsTo &&
        job.finishedAt <= now &&
        now - job.finishedAt <= DOWNLOADS_WITHIN_MS
    )
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  if (!fresh.length) return log;
  let next = log;
  for (const job of fresh) {
    const code = job.errorCode || 'ERR_UNKNOWN';
    const words = job.error ? ` — ${job.error}` : '';
    const own = [job.video?.title, job.video?.channel, job.video?.discoveryTitle, job.video?.discoveryArtist].filter(
      (name): name is string => typeof name === 'string'
    );
    next = withEntry(
      next,
      { at: job.finishedAt as number, version, kind: job.automatic || job.discoverKey ? 'discover' : 'download', message: `${code}${words}` },
      [...own, ...names]
    );
  }
  return { ...next, downloadsTo: fresh[fresh.length - 1].finishedAt as number };
}

/**
 * A thrown thing as one line: its kind of error, the native side's code for
 * it where it has one (`ERR_YOUTUBE_REFUSED`), and its message — and nothing
 * of its stack, which is the app's own file names and line numbers and would
 * be scrubbed to nothing.
 */
export function describeThrown(thrown: unknown): string {
  if (thrown instanceof Error) {
    const name = thrown.name && thrown.name !== 'Error' ? `${thrown.name} — ` : '';
    const code = (thrown as { code?: unknown }).code;
    const coded = typeof code === 'string' && code && !thrown.message.includes(code) ? `${code} — ` : '';
    return `${name}${coded}${thrown.message}`;
  }
  return typeof thrown === 'string' ? thrown : (() => {
    try {
      return JSON.stringify(thrown) ?? String(thrown);
    } catch {
      return String(thrown);
    }
  })();
}
