import type { DownloadJob } from './types.ts';

/**
 * The extractor — yt-dlp, the program that reads YouTube's pages — and
 * whether there is a newer one than the copy on the phone.
 *
 * The app is built with one release of it. YouTube changes its pages every
 * few weeks, yt-dlp follows within days, and until now the only way for the
 * copy in the app to follow was a new build of the app: downloads began to
 * fail, said something about signatures, and went on failing. This is the
 * way round that: the app can be told there is a newer release, and can
 * fetch it when somebody says so.
 *
 * ---------------------------------------------------------------------------
 * What leaves the phone, and to whom
 * ---------------------------------------------------------------------------
 *
 * Everything here is asked of GitHub, which is Microsoft's, and of nobody
 * else. There is no account, key, cookie or token; nothing about the phone,
 * the library, what was downloaded or what failed goes with any request.
 * GitHub sees what any site sees — the address the request came from — and
 * the one line the app says of itself, which is the same line the
 * catalogues are told: `Jukebox/0.1 ( https://github.com/Kayra5138/JukeboxAndroid )`.
 * So it can tell that somebody at that address runs Jukebox and looked for a
 * newer yt-dlp, and nothing more.
 *
 * THE CHECK. One request:
 *
 *   HEAD https://github.com/yt-dlp/yt-dlp/releases/latest
 *
 * GitHub answers a browser at that address by sending it on to the newest
 * release's page, `…/releases/tag/2026.08.19`. The sending-on is not
 * followed: where it points is the answer, and it is in the headers. No
 * body travels either way. (The library's own way of asking is the API,
 * which answered the same question with 60,347 bytes of changelog on
 * 13 October 2026, and counts requests by address, sixty an hour.)
 *
 * It is made:
 *   - by itself at most once in twenty-four hours, and only at a moment the
 *     app is being used to download: the Downloads screen is opened, or
 *     something is put in the queue by hand. Never from the background
 *     task, never because the app was opened, never for Discover's own
 *     downloads. One that fails — no network — is not made again for an
 *     hour, and says nothing;
 *   - whenever "Check for update" is pressed;
 *   - not at all by itself with the switch in Settings turned off.
 *
 * What it learns is kept, with when it was learnt, so that the next day's
 * visit is the next request. Knowing of a newer release fetches nothing.
 *
 * THE UPDATE. Only for a press on "Update", two requests to the release the
 * check named, each of which GitHub sends on to
 * `release-assets.githubusercontent.com`, where the files are kept:
 *
 *   GET https://github.com/yt-dlp/yt-dlp/releases/download/<version>/SHA2-256SUMS
 *     about 1.6 kB: the SHA-256 of every file in the release.
 *   GET https://github.com/yt-dlp/yt-dlp/releases/download/<version>/yt-dlp
 *     about 3 MB: the extractor itself, the same file the build fetches.
 *
 * The second is checked against the first and then run once (`--version`)
 * before it replaces anything. How it is put in place, what that check is
 * and is not worth, and why the library's own updater is not used, are in
 * `ExtractorUpdate.kt`.
 *
 * This file is the arithmetic of all that, with nothing of the phone in it:
 * which version is newer, when a check is due, and which failed downloads
 * look like the extractor's age.
 */

/** A day: how often the check is made by itself. */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
/** How long after a check that could not be made before the next is tried. */
export const TRY_AGAIN_MS = 60 * 60 * 1000;

const VERSION = /^\d{4}\.\d{1,2}\.\d{1,2}(?:\.\d{1,8})?$/;

export function isVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION.test(value);
}

/**
 * Whether [version] is a later release than [than]. By its numbers and not
 * its letters, and false where either is not a version: nothing is offered
 * on the strength of a word that could not be read.
 */
export function isNewer(version: string | null | undefined, than: string | null | undefined): boolean {
  if (!isVersion(version) || !isVersion(than)) return false;
  const a = version.split('.').map(Number);
  const b = than.split('.').map(Number);
  for (let place = 0; place < Math.max(a.length, b.length); place += 1) {
    const difference = (a[place] ?? 0) - (b[place] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

/** What has been learnt by asking, and when. */
export type Known = {
  /** The newest release there was at the last check that was answered. */
  latest: string | null;
  /** When that check was, in milliseconds; null before the first. */
  checkedAt: number | null;
  /** When a check was last tried, answered or not. */
  triedAt: number | null;
};

export const NOTHING_KNOWN: Known = { latest: null, checkedAt: null, triedAt: null };

/** [Known] out of what was written down, where that is anything at all. */
export function readKnown(text: string | null | undefined): Known {
  if (!text) return NOTHING_KNOWN;
  try {
    const kept = JSON.parse(text) as Partial<Record<keyof Known, unknown>> | null;
    const time = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);
    return { latest: isVersion(kept?.latest) ? kept.latest : null, checkedAt: time(kept?.checkedAt), triedAt: time(kept?.triedAt) };
  } catch {
    return NOTHING_KNOWN;
  }
}

/** How long ago [then] was. A time that is still to come is a clock that was put back, and counts as long ago. */
function since(then: number | null, now: number): number {
  return then == null || then > now ? Infinity : now - then;
}

/** Whether what is known is a day old or more, or nothing: it may no longer be so. */
export function isStale(known: Known, now: number): boolean {
  return since(known.checkedAt, now) >= CHECK_EVERY_MS;
}

/**
 * Whether the check may be made by itself now. [wanted] is the switch.
 * Whether this is a moment the app is being used to download is the
 * caller's to know; this is only the clock.
 */
export function isDue(known: Known, now: number, wanted: boolean): boolean {
  return wanted && isStale(known, now) && since(known.triedAt, now) >= TRY_AGAIN_MS;
}

/** Whole days since the last check that was answered, for "checked yesterday"; null before the first. */
export function daysSince(known: Known, now: number): number | null {
  if (known.checkedAt == null) return null;
  return Math.max(0, Math.floor(since(known.checkedAt, now) / CHECK_EVERY_MS));
}

/**
 * What can be said to somebody whose download has failed: there is a newer
 * extractor to fetch, there may be and it has not been asked lately, or
 * nothing.
 */
export type Advice = 'update' | 'check' | 'none';

export function adviceOf(installed: string | null, known: Known, now: number): Advice {
  if (!installed) return 'none';
  if (isNewer(known.latest, installed)) return 'update';
  return isStale(known, now) ? 'check' : 'none';
}

/** YouTube's pages have moved on from the extractor: `Failure.OUTDATED`, which is recognised on the phone. */
const SURELY: readonly string[] = ['ERR_YOUTUBE_OUTDATED'];
/**
 * "Not now": a 403, or being asked to sign in. Most often it is YouTube
 * tired of the address, and passes. It is also the first thing an extractor
 * a few weeks behind is told.
 */
const MAYBE: readonly string[] = ['ERR_YOUTUBE_REFUSED', 'ERR_YOUTUBE_VERIFICATION'];
/**
 * In the extractor's own last line, for a failure the phone had no name
 * for. Each of these is what yt-dlp prints when it could not work out
 * YouTube's signatures and so found nothing it could fetch.
 */
const IN_ITS_WORDS =
  /Requested format is not available|Only images are available|nsig|n challenge|signature (?:extraction|solving)|Unable to extract|Failed to (?:parse|extract)|please report this issue|HTTP Error 403/i;

/**
 * How much a failed download looks like the extractor's age.
 *
 * `surely` is the phone's own verdict. `maybe` is a failure that an old
 * extractor causes and so do other things; it is acted on only where a
 * newer one is already known of, and never sends anybody looking.
 */
export function smellOf(job: Pick<DownloadJob, 'status' | 'errorCode' | 'error'>): 'surely' | 'maybe' | null {
  if (job.status !== 'failed' || !job.errorCode) return null;
  if (SURELY.includes(job.errorCode)) return 'surely';
  if (MAYBE.includes(job.errorCode)) return 'maybe';
  if (job.errorCode === 'ERR_DOWNLOAD_FAILED' && IN_ITS_WORDS.test(job.error ?? '')) return 'maybe';
  return null;
}

/**
 * What a failed download's row offers in place of "Retry": the update, a
 * look for one, or nothing — and then it is "Retry" as it was.
 */
export function offerFor(job: Pick<DownloadJob, 'status' | 'errorCode' | 'error'>, advice: Advice): 'update' | 'check' | null {
  if (advice === 'none') return null;
  const smell = smellOf(job);
  if (smell === 'surely') return advice;
  return smell === 'maybe' && advice === 'update' ? 'update' : null;
}

/** Why a check or an update did not come off, as the phone names it: `ExtractorTrouble.Kind`. */
export type Trouble = 'network' | 'answer' | 'checksum' | 'broken' | 'failed';

export function troubleOf(error: unknown): Trouble {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  switch (code) {
    case 'ERR_EXTRACTOR_NETWORK': return 'network';
    case 'ERR_EXTRACTOR_ANSWER': return 'answer';
    case 'ERR_EXTRACTOR_CHECKSUM': return 'checksum';
    case 'ERR_EXTRACTOR_BROKEN': return 'broken';
    default: return 'failed';
  }
}
