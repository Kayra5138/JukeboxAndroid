import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { libraryRoot } from '../media/library.ts';
import { tapeFolderOf } from '../tapes/folders.ts';
import { carried } from '../youtube/carried.ts';
import { downloads } from '../youtube/native.ts';
import { episodeId, episodeVideo, newestFirst, type Episode, type Show } from './episodes.ts';
import { cleanUpPlayed } from './cleanup.ts';
import { fetchShow } from './feed.ts';
import { noteChecked, saveEpisodes, setAutoDownload, subscribe, subscription, subscriptions, type Subscription } from './store.ts';

/**
 * Keeping up with the podcasts somebody follows: their feeds read again now
 * and then, and for each show that fetches by itself, its newest episodes
 * fetched, as many as it keeps — whether they came out before it was
 * followed or after.
 *
 * Asked the same each time, so it does what is still to do and nothing twice:
 * an episode is fetched where it has no job in the download queue at all. One
 * skipped for want of Wi‑Fi is fetched the next time there is some; one that
 * was fetched and then deleted has a job, and is not fetched again.
 */

/** How often a followed show's feed is read again, at most. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export function podcastsWifiOnly(): boolean {
  return readSetting(SETTINGS.podcastsWifiOnly) !== 'false';
}

export function setPodcastsWifiOnly(on: boolean): void {
  writeSetting(SETTINGS.podcastsWifiOnly, on ? 'true' : 'false');
  // Turned off: the episodes already waiting for Wi‑Fi, in the queue or stopped there, may go now.
  if (!on) void downloads?.requeueWaitingAsync?.(true, fetchingFolders()).catch(() => false);
}

/**
 * Episodes of [show] put in the download queue, as tapes in its folder — the
 * one it was followed under, should it have renamed itself since.
 * [automatic] waits for a quiet time, as Discover's own do; [byItself], fetched
 * without anybody asking, waits for Wi‑Fi where the podcasts are set to, in
 * the queue, however long that is and whatever the phone was on when it was put there.
 */
export async function fetchEpisodes(
  feedUrl: string,
  show: Show,
  episodes: readonly Episode[],
  how: { automatic?: boolean; byItself?: boolean } = {}
): Promise<void> {
  if (!downloads || episodes.length === 0) return;
  const name = subscription(feedUrl)?.folder ?? show.title;
  const wifiOnly = how.byItself === true && podcastsWifiOnly();
  const videos = episodes.map((episode) => {
    const video = episodeVideo(feedUrl, { ...show, title: name }, episode);
    return carried({ ...video, ...(how.automatic ? { discoverAutomatic: true } : {}), ...(wifiOnly ? { discoverWifiOnly: true } : {}) });
  });
  await downloads.enqueueBatchAsync(videos, 'original', tapeFolderOf(libraryRoot(), name));
}

/** Followed, from now: its episodes noted as there already, and the newest fetched, as many as it keeps, where it fetches by itself. */
export async function follow(feedUrl: string, show: Show & { episodes: Episode[] }, now = Date.now()): Promise<void> {
  subscribe(feedUrl, show, now);
  saveEpisodes(feedUrl, show.episodes, now);
  const followed = subscription(feedUrl);
  if (!followed?.autoDownload || !downloads) return;
  // As a show read again does: one fetched before, and deleted since, is not fetched again for being followed again.
  const asked = new Set((await downloads.getJobsAsync(false)).map((job) => job.video.id));
  const newest = newestFirst(show.episodes)
    .slice(0, followed.keep)
    .filter((episode) => !asked.has(episodeId(feedUrl, episode.guid)));
  if (newest.length > 0) await fetchEpisodes(feedUrl, show, newest, { byItself: true });
}

/** The folders of the shows that fetch by themselves, newest or next: whose episodes waiting for Wi‑Fi may go back in the queue. */
function fetchingFolders(): string[] {
  return subscriptions()
    .filter((show) => show.autoDownload || show.fetchNext)
    .map((show) => show.folder);
}

/**
 * The episodes of the show in [folder] put in the queue by themselves and not
 * begun, taken out of it: the show is no longer followed, or no longer
 * fetches by itself. One somebody asked for stays. Never throws.
 */
export async function dropWaiting(folder: string): Promise<void> {
  try {
    if (!downloads) return;
    for (const job of await downloads.getJobsAsync(false)) {
      if (job.status !== 'queued' || job.video.tape?.name !== folder || (!job.video.discoverWifiOnly && !job.automatic)) continue;
      await downloads.cancelAsync(job.id);
    }
  } catch (error) {
    console.warn('Could not take the episodes out of the queue', error);
  }
}

/**
 * Each of [feeds] followed that is not already, as a list brought from
 * another app is: read and noted, with nothing fetched by itself until it is
 * asked for on the show's own screen, since a list of twenty shows would
 * otherwise be sixty episodes fetched at once. [onEach] is told how far it has
 * got. Answers with how many were followed, were followed already, and could
 * not be read.
 */
export async function followAll(
  feeds: readonly string[],
  onEach?: (done: number, total: number) => void,
  now = Date.now()
): Promise<{ followed: number; already: number; failed: number }> {
  const known = new Set(subscriptions().map((show) => show.feedUrl));
  let followed = 0;
  let already = 0;
  let failed = 0;
  for (const [at, feed] of feeds.entries()) {
    onEach?.(at, feeds.length);
    if (known.has(feed)) {
      already += 1;
      continue;
    }
    try {
      const show = await fetchShow(feed);
      subscribe(feed, show, now);
      setAutoDownload(feed, false);
      saveEpisodes(feed, show.episodes, now);
      known.add(feed);
      followed += 1;
    } catch {
      failed += 1;
    }
  }
  onEach?.(feeds.length, feeds.length);
  return { followed, already, failed };
}

/** Whether the phone is on Wi‑Fi, by the downloads' own reading of it. */
export async function onWifi(): Promise<boolean> {
  try {
    return (await downloads?.discoverNetworkAsync())?.wifi === true;
  } catch {
    return false;
  }
}

/** The reading of each show under way, so that two asked at once do not both put the same episodes in the queue. */
const reading = new Map<string, Promise<number>>();

/** One show read again, and what it is owed fetched, after any reading of it already under way. Answers with how many episodes were put in the queue. */
export function refreshShow(followed: Subscription, now = Date.now(), wifi?: boolean): Promise<number> {
  const before = reading.get(followed.feedUrl) ?? Promise.resolve(0);
  const next = before.catch(() => 0).then(() => readShow(followed, now, wifi));
  reading.set(followed.feedUrl, next);
  void next.finally(() => {
    if (reading.get(followed.feedUrl) === next) reading.delete(followed.feedUrl);
  }).catch(() => {});
  return next;
}

async function readShow(followed: Subscription, now: number, wifi?: boolean): Promise<number> {
  const show = await fetchShow(followed.feedUrl);
  saveEpisodes(followed.feedUrl, show.episodes, now);
  noteChecked(followed.feedUrl, show, now);
  // Off Wi‑Fi where it has to wait for it, put in the queue all the same, to wait there.
  if (!followed.autoDownload || !downloads) return 0;
  // The newest, as many as it keeps; one of them deleted is not fetched again, and is not made up for with an older one.
  const owed = newestFirst(show.episodes).slice(0, followed.keep);
  if (owed.length === 0) return 0;
  const jobs = await downloads.getJobsAsync(false);
  const asked = new Set(jobs.map((job) => job.video.id));
  const wanted = owed.filter((episode) => !asked.has(episodeId(followed.feedUrl, episode.guid)));
  await fetchEpisodes(followed.feedUrl, show, wanted, { automatic: true, byItself: true });
  return wanted.length;
}

let checking: Promise<void> | null = null;

/** Every followed show not read for a while, read again, one at a time. Never throws. */
export function checkPodcasts(now = Date.now()): Promise<void> {
  if (checking) return checking;
  checking = (async () => {
    const wifi = await onWifi();
    /*
      Episodes fetched by themselves that came to their turn off Wi‑Fi were
      stopped there to wait for it, and nothing else asks for them again: put
      back now there is Wi‑Fi, or where they may use any connection.
    */
    const anyNetwork = !podcastsWifiOnly();
    if (wifi || anyNetwork) await downloads?.requeueWaitingAsync?.(anyNetwork, fetchingFolders()).catch(() => false);
    const due = subscriptions().filter((followed) => followed.checkedAt == null || now - followed.checkedAt >= CHECK_EVERY_MS);
    if (due.length === 0) return;
    for (const followed of due) {
      try {
        await refreshShow(followed, now, wifi);
      } catch (error) {
        console.warn('Could not read a podcast feed', error);
      }
    }
  })().finally(() => {
    checking = null;
  });
  return checking;
}

/**
 * Keeps the followed podcasts up to date while the app runs: a look soon after
 * it starts, and every hour after, of which only the shows not read for six
 * hours are anything to. Answers with how to stop. With the app closed, the
 * same is done now and then by `background.ts`.
 */
export function keepPodcastsChecked(): () => void {
  // And the episodes heard long enough ago deleted, for somebody who has set that: see `cleanup.ts`.
  const look = () => void checkPodcasts().then(() => cleanUpPlayed()).catch(() => {});
  const first = setTimeout(look, 20_000);
  const every = setInterval(look, 60 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
