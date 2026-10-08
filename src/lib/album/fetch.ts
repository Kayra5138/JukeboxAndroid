import { NO_MATCH_CODE } from '../discover/policy.ts';
import { findQuery } from '../discover/video.ts';
import { albumKey } from '../media/albums.ts';
import { jobsBySlot, placementOf, slotOf, type Placement } from './placement.ts';
import { looseTitle } from './rest.ts';
import { isActive, type DownloadJob, type FindRequest, type YouTubeVideo } from '../youtube/types.ts';

/**
 * Turning the tracks a record is missing into downloads.
 *
 * Each is asked for by name. It goes into the one queue the phone works
 * through, as a job with no video yet, and is looked for when its turn
 * comes, the way Discover's songs are and held to the same test: the title's
 * words all there, the length within a few seconds of the catalogue's, no
 * live take or cover standing in for the album cut. A track that fails it is
 * said to have no match and is not downloaded, which is the better mistake.
 *
 * Nothing is searched for from here, and nothing is kept here. The job
 * carries the place it is for, the phone keeps the job, and a row reads off
 * it how its track is getting on — waiting, being looked for, on its way, not
 * found — whether the screen was open the whole time or the app was closed
 * in the middle.
 */
export type Wanted = { place: Placement; lengthSec: number | null };

/** What the queue is asked for: the song by name, and what to do with the file once there is one. */
export function findFor({ place, lengthSec }: Wanted): YouTubeVideo & { find: FindRequest } {
  const artist = place.artist ?? '';
  return {
    id: '',
    url: '',
    // Shown in the queue until a video is found, as any job's are.
    title: place.title,
    channel: artist,
    thumbnail: null,
    duration: lengthSec,
    find: { query: findQuery(artist, place.title), artist, title: place.title, durationSec: lengthSec },
    // The file is tagged with the record's spelling of both, not the video's.
    discoveryTitle: place.title,
    ...(place.artist ? { discoveryArtist: place.artist } : {}),
    placement: place,
  };
}

/**
 * The same for a track whose video is already known, because the record was
 * read off a playlist of it: a download like any other, of that video, with
 * the place it is for.
 *
 * Made from the video's own few fields and not by adding to it. A video read
 * off a playlist says which playlist, and a download that says so is put in
 * the list the app keeps of that playlist; this one is being put on a record.
 */
export function downloadFor(video: YouTubeVideo, place: Placement): YouTubeVideo {
  return {
    id: video.id,
    url: video.url,
    title: video.title,
    channel: video.channel,
    thumbnail: video.thumbnail,
    duration: video.duration,
    // The file is tagged with the record's spelling of both, not the uploader's.
    discoveryTitle: place.title,
    ...(place.artist ? { discoveryArtist: place.artist } : {}),
    placement: place,
  };
}

/**
 * The download that was asked for each place on a record, whichever list the
 * record was being read off when it was asked.
 *
 * The two lists do not always number alike: MusicBrainz was read off the
 * album and YouTube has the deluxe edition, and the seventh track of one is
 * the eighth of the other. A job is for a song, so the one at a row's own
 * place is only that row's when it is of the same title, as the comparison
 * with the library reads titles; and a job left over is then the row's of
 * that title wherever it sits. Changing where the list is read from neither
 * loses sight of what is already on its way nor offers it again.
 *
 * A job is only ever one row's, so an intro on each disc is two rows and the
 * download of one of them is not the other's.
 */
export function jobsForPlaces(
  jobs: DownloadJob[],
  album: string,
  places: { disc: number | null; track: number; title: string }[]
): Map<string, DownloadJob> {
  const titled = (job: DownloadJob) => looseTitle(placementOf(job.video)!.title);
  const waiting = new Map(jobsBySlot(jobs, album));
  const found = new Map<string, DownloadJob>();
  for (const place of places) {
    const slot = slotOf(place);
    const job = waiting.get(slot);
    if (!job || titled(job) !== looseTitle(place.title)) continue;
    found.set(slot, job);
    waiting.delete(slot);
  }
  for (const place of places) {
    const slot = slotOf(place);
    if (found.has(slot)) continue;
    const title = looseTitle(place.title);
    for (const [at, job] of waiting) {
      if (titled(job) !== title) continue;
      found.set(slot, job);
      waiting.delete(at);
      break;
    }
  }
  return found;
}

/**
 * How a missing track is getting on, by the job that was asked for it:
 *
 *  - `waiting`: in the queue, its video not looked for yet;
 *  - `searching`: being looked for now;
 *  - `fetching`: found, and waiting to be downloaded or being downloaded;
 *  - `here`: in the library by now;
 *  - `notFound`: looked for, and nothing that fits;
 *  - `stopped`: failed some other way, cancelled, or its file since removed.
 *
 * Null where nothing has been asked.
 */
export type SlotState = 'waiting' | 'searching' | 'fetching' | 'here' | 'notFound' | 'stopped';

export function slotState(job: DownloadJob | undefined): SlotState | null {
  if (!job) return null;
  if (job.status === 'finding') return 'searching';
  if (job.status === 'queued' && job.video.find != null) return 'waiting';
  if (isActive(job)) return 'fetching';
  if (job.status === 'done') return 'here';
  return job.status === 'failed' && job.errorCode === NO_MATCH_CODE ? 'notFound' : 'stopped';
}

/**
 * The jobs of one record that have not been looked for yet: what "stop" gives
 * up on. One being looked for now is seen through, and a download is not
 * this's to stop — the queue's own screen is where that is done.
 */
export function unsought(jobs: DownloadJob[], album: string): DownloadJob[] {
  return jobs.filter((job) => {
    if (slotState(job) !== 'waiting') return false;
    const place = placementOf(job.video);
    return place != null && albumKey(place.album) === album;
  });
}
