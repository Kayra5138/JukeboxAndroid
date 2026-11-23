import { request } from '../metadata/http.ts';
import { downloads } from '../youtube/native.ts';
import { securePicture, type Episode, type Show } from './episodes.ts';

/**
 * Reading a podcast's feed, and finding one. The feed is read on the phone
 * (`PodcastFeed.kt`); finding is Apple's podcast directory, which anybody may
 * ask without a key, and which answers with each show's feed.
 */

export type FoundShow = { feedUrl: string; title: string; author: string | null; image: string | null };

export async function fetchShow(feedUrl: string): Promise<Show & { episodes: Episode[] }> {
  if (!downloads?.podcastFeedAsync) throw new Error('unavailable');
  const read = await downloads.podcastFeedAsync(feedUrl.trim());
  return {
    title: read.title || feedUrl,
    author: read.author ?? null,
    image: securePicture(read.image),
    summary: read.summary ?? null,
    link: read.link ?? null,
    // One episode to a guid, the first the feed gives: a feed that names one twice, an episode put out again, would
    // otherwise have two rows that are one download.
    episodes: (read.episodes ?? []).filter((episode, at, all) => all.findIndex((other) => other.guid === episode.guid) === at).map((episode) => ({
      guid: episode.guid,
      title: episode.title,
      url: episode.url,
      publishedAt: episode.publishedAt ?? null,
      durationSec: episode.durationSec ?? null,
      image: securePicture(episode.image),
      summary: episode.summary ?? null,
      chaptersUrl: episode.chaptersUrl ?? null,
      transcriptUrl: episode.transcriptUrl ?? null,
      transcriptType: episode.transcriptType ?? null,
    })),
  };
}

/** The feed of the YouTube channel at [address], its page or its feed; null where it is not a channel's. */
export async function channelFeedOf(address: string): Promise<string | null> {
  if (!downloads?.youtubeFeedAsync) throw new Error('unavailable');
  return downloads.youtubeFeedAsync(address.trim());
}

/** YouTube channels by [words], as YouTube's search finds them, each as a show to follow by its channel's page; none where it cannot ask. */
export async function searchChannels(words: string): Promise<(FoundShow & { followers: number | null })[]> {
  if (!downloads?.searchChannelsAsync) return [];
  const channels = await downloads.searchChannelsAsync(words.trim());
  return channels.map((channel) => ({
    feedUrl: `https://www.youtube.com/channel/${channel.id}`,
    title: channel.title,
    author: channel.handle ?? null,
    image: channel.image ?? null,
    followers: channel.followers ?? null,
  }));
}

/** The country of the phone's language, for the directory's own store of shows: Turkish shows are in Turkey's. */
function country(): string {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : 'US';
  } catch {
    return 'US';
  }
}

/** Shows by [words], from Apple's directory: the twenty-five it thinks nearest. */
export async function searchShows(words: string): Promise<FoundShow[]> {
  const term = encodeURIComponent(words.trim());
  // Through `request`, which gives up after a while, as a bare fetch never did.
  const body = await request<{ results?: { feedUrl?: string; collectionName?: string; artistName?: string; artworkUrl600?: string; artworkUrl100?: string }[] }>(
    'Apple Podcasts',
    `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&country=${country()}&term=${term}`,
    {}
  );
  return (body.results ?? [])
    .filter((result) => typeof result.feedUrl === 'string' && result.feedUrl.startsWith('http'))
    .map((result) => ({
      feedUrl: result.feedUrl!,
      title: result.collectionName ?? result.feedUrl!,
      author: result.artistName ?? null,
      image: result.artworkUrl600 ?? result.artworkUrl100 ?? null,
    }));
}
