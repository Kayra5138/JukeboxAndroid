import { downloads } from '../youtube/native.ts';
import { episodeId, episodesAfter } from './episodes.ts';
import { fetchEpisodes } from './refresh.ts';
import { savedEpisodes, subscriptions } from './store.ts';

/**
 * The episodes after the one being listened to, as many as the show is set
 * to, fetched for a followed show that is set to fetch them: somebody
 * working through it from its older episodes finds the next ones ready as
 * each ends, as the newest are for somebody who keeps up. Asked as each tape begins; it fetches nothing twice, as an
 * episode with a job in the download queue — fetched, deleted or under
 * way — is left as it is.
 */

/** The track [trackId] begun: if it is an episode of a show that fetches the next, the next fetched. Never throws. */
export async function fetchNextAfter(trackId: string): Promise<void> {
  try {
    if (!downloads) return;
    const shows = subscriptions().filter((show) => show.fetchNext);
    if (shows.length === 0) return;
    const jobs = await downloads.getJobsAsync(false);
    const playing = jobs.find((job) => job.trackId === trackId);
    if (!playing) return;
    for (const show of shows) {
      const episodes = savedEpisodes(show.feedUrl);
      const now = episodes.find((episode) => episodeId(show.feedUrl, episode.guid) === playing.video.id);
      if (!now) continue;
      const asked = new Set(jobs.map((job) => job.video.id));
      const wanted = episodesAfter(episodes, now.guid, show.nextCount).filter((episode) => !asked.has(episodeId(show.feedUrl, episode.guid)));
      if (wanted.length === 0) return;
      await fetchEpisodes(show.feedUrl, show, wanted, { byItself: true });
      return;
    }
  } catch (error) {
    console.warn('Could not fetch the next episode', error);
  }
}
