import type { YouTubeVideo } from '../youtube/types.ts';

/**
 * Podcasts as the app keeps them: what a feed says, and an episode turned into
 * a download of a tape. Nothing here reads anything, so it can be tested; see
 * `store.ts` for the keeping and `refresh.ts` for the looking.
 */

/** A show, as its feed describes it. */
export type Show = {
  title: string;
  author: string | null;
  image: string | null;
  summary: string | null;
  link?: string | null;
};

/** An episode, as its feed describes it. */
export type Episode = {
  guid: string;
  title: string;
  url: string;
  publishedAt: number | null;
  durationSec: number | null;
  image: string | null;
  summary: string | null;
  /** Where its chapters are, as the feed's `podcast:chapters` has them. */
  chaptersUrl?: string | null;
  /** Where what is said in it is written out, and in what form, as the feed's `podcast:transcript` has them. */
  transcriptUrl?: string | null;
  transcriptType?: string | null;
};

/**
 * A picture's address as https: a podcast's are often still given as http,
 * which the phone does not fetch, and nearly every host gives the same over
 * https. Anything else as it is.
 */
export function securePicture(address: string | null | undefined): string | null {
  if (!address) return null;
  return address.replace(/^http:\/\//i, 'https://');
}

/** Whether [address] is YouTube's: a channel followed as a show, whose episodes are its videos. */
export function isYouTubeAddress(address: string): boolean {
  return /^https?:\/\/(www\.|m\.|music\.)?youtube\.com\//i.test(address.trim());
}

/** Whether [address] is a YouTube channel's page — its `@name`, `/channel/`, `/c/` or `/user/` — rather than a video's or a list's. */
export function isChannelAddress(address: string): boolean {
  return isYouTubeAddress(address) && /^https?:\/\/[^/]+\/(@|channel\/|c\/|user\/)/i.test(address.trim());
}

/** The video an episode of a YouTube channel is, by its id; null for an episode of a podcast. */
function videoOf(feedUrl: string, episode: { guid: string }): string | null {
  return isYouTubeAddress(feedUrl) && /^[A-Za-z0-9_-]{11}$/.test(episode.guid) ? episode.guid : null;
}

/**
 * An episode's name in the download queue, which is how whether it has been
 * fetched is known: the same for the same episode of the same feed, every
 * time, and nothing like a YouTube video's. A channel's video is known by its
 * own id, as YouTube's downloads are, so one fetched before by itself counts.
 */
export function episodeId(feedUrl: string, guid: string): string {
  const video = videoOf(feedUrl, { guid });
  if (video) return video;
  // FNV-1a, twice over, for a name that will not be shared by chance.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  const text = `${feedUrl}\n${guid}`;
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `pod-${a.toString(36)}${b.toString(36)}`;
}

/** A day as `2026-10-27`, in the phone's own time: what an episode's file is named by, ahead of its title. */
export function dayOf(ms: number): string {
  const date = new Date(ms);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/**
 * An episode as a download: a file fetched as it is, from its own address,
 * into the folder of the Tapes folder named after the show. Its file is named
 * by the day it came out, so that the show's episodes stand in the order they
 * were made and play on, one into the next, in that order.
 */
export function episodeVideo(feedUrl: string, show: Show, episode: Episode): YouTubeVideo {
  const video = videoOf(feedUrl, episode);
  return {
    id: episodeId(feedUrl, episode.guid),
    // A podcast's episode is its file, fetched as it is; a channel's, its video, fetched as YouTube's are.
    ...(video ? { url: `https://www.youtube.com/watch?v=${video}` } : { url: episode.url, direct: true }),
    title: episode.title,
    channel: show.author || show.title,
    thumbnail: episode.image || show.image,
    duration: episode.durationSec,
    // Read on the phone once the file is in; see `DownloadService`.
    ...(episode.chaptersUrl ? { chaptersUrl: episode.chaptersUrl } : {}),
    ...(episode.transcriptUrl ? { transcriptUrl: episode.transcriptUrl, transcriptType: episode.transcriptType ?? null } : {}),
    tape: {
      name: show.title,
      album: show.title,
      title: episode.title,
      ...(episode.publishedAt != null ? { date: dayOf(episode.publishedAt) } : {}),
    },
  };
}

/** Of [fresh], the episodes not among [known], newest first. */
export function newEpisodes(fresh: readonly Episode[], known: ReadonlySet<string>): Episode[] {
  return newestFirst(fresh.filter((episode) => !known.has(episode.guid)));
}

/** Newest first, those with no date last, in the order the feed gave them. */
export function newestFirst(episodes: readonly Episode[]): Episode[] {
  return [...episodes]
    .map((episode, at) => ({ episode, at }))
    .sort((x, y) => (y.episode.publishedAt ?? -Infinity) - (x.episode.publishedAt ?? -Infinity) || x.at - y.at)
    .map(({ episode }) => episode);
}

/** Whether [text] is a feed's address rather than words to search for. */
export function isFeedAddress(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/** The [count] episodes that came out next after [guid], in the order they came out; none after the newest, an undated one or one not known. */
export function episodesAfter(episodes: readonly Episode[], guid: string, count: number): Episode[] {
  const now = episodes.find((episode) => episode.guid === guid);
  if (now?.publishedAt == null) return [];
  const at = now.publishedAt;
  return episodes
    .filter((episode) => episode.publishedAt != null && episode.publishedAt > at)
    .sort((a, b) => a.publishedAt! - b.publishedAt!)
    .slice(0, Math.max(0, count));
}
