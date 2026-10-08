import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { downloadFor, findFor, jobsForPlaces, slotState, unsought } from '../fetch.ts';
import { jobsBySlot, placementOf, type Placement } from '../placement.ts';
import { chooseVideo } from '../../discover/video.ts';
import { albumKey } from '../../media/albums.ts';
import type { DownloadJob, DownloadStatus, YouTubeVideo } from '../../youtube/types.ts';

const place = (track: number, title: string, album = 'Meteora'): Placement => ({
  album,
  title,
  artist: 'Linkin Park',
  track,
  disc: null,
  year: 2003,
  genre: null,
});

let made = 0;
const job = (video: YouTubeVideo, status: DownloadStatus, more: Partial<DownloadJob> = {}): DownloadJob => ({
  id: `job-${(made += 1)}`,
  video,
  format: 'mp3',
  folder: 'Music',
  status,
  progress: 0,
  trackId: null,
  error: null,
  described: false,
  ...more,
});

/** As the phone leaves a job once its video has been found. */
const found = (video: YouTubeVideo): YouTubeVideo => {
  const { find: _find, ...rest } = video;
  return { ...rest, id: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk' };
};

describe('asking the queue for the tracks a record is missing', () => {
  it('asks by name, as Discover words it, with the place the file is for', () => {
    const asked = findFor({ place: place(7, 'Faint'), lengthSec: 162 });

    assert.deepEqual(asked.find, {
      query: 'Linkin Park Faint official audio',
      artist: 'Linkin Park',
      title: 'Faint',
      durationSec: 162,
    });
    // No video yet, and shown in the queue by the song's own name meanwhile.
    assert.equal(asked.id, '');
    assert.equal(asked.url, '');
    assert.equal(asked.title, 'Faint');
    assert.equal(asked.channel, 'Linkin Park');
    // What the file is tagged as, and where it is filed once it is in.
    assert.equal(asked.discoveryTitle, 'Faint');
    assert.equal(asked.discoveryArtist, 'Linkin Park');
    assert.deepEqual(placementOf(asked), place(7, 'Faint'));
  });

  it('leaves out an artist the record does not name', () => {
    const asked = findFor({ place: { ...place(1, 'Foreword'), artist: null }, lengthSec: null });
    assert.equal(asked.find.query, 'Foreword official audio');
    assert.equal(asked.find.durationSec, null);
    assert.equal('discoveryArtist' in asked, false);
  });

  it('is what the finder holds a video to: the album cut and not the concert', () => {
    const { find } = findFor({ place: place(7, 'Faint'), lengthSec: 162 });
    const video = (title: string, duration: number): YouTubeVideo => ({
      id: title, url: '', title, channel: 'Linkin Park', duration, thumbnail: null,
    });
    const studio = video('Linkin Park - Faint (Official Audio)', 162);
    assert.equal(chooseVideo(find, [video('Linkin Park - Faint (Live in Texas)', 170), studio]), studio);
    assert.equal(chooseVideo(find, [video('Linkin Park - Faint', 330)]), null);
  });
});

describe('how a missing track is getting on, read off its job', () => {
  const asked = findFor({ place: place(7, 'Faint'), lengthSec: 162 });

  it('says each stage of being found and fetched', () => {
    assert.equal(slotState(undefined), null);
    assert.equal(slotState(job(asked, 'queued')), 'waiting');
    assert.equal(slotState(job(asked, 'finding')), 'searching');
    assert.equal(slotState(job(found(asked), 'queued')), 'fetching');
    assert.equal(slotState(job(found(asked), 'downloading', { progress: 40 })), 'fetching');
    assert.equal(slotState(job(found(asked), 'done', { trackId: '9' })), 'here');
  });

  it('tells nothing that fits from every other way of stopping', () => {
    assert.equal(slotState(job(asked, 'failed', { error: 'x', errorCode: 'ERR_DOWNLOAD_NO_MATCH' })), 'notFound');
    assert.equal(slotState(job(asked, 'failed', { error: 'x', errorCode: 'ERR_YOUTUBE_NETWORK' })), 'stopped');
    assert.equal(slotState(job(asked, 'cancelled')), 'stopped');
    assert.equal(slotState(job(found(asked), 'missing')), 'stopped');
  });

  it('finds the job by the place it carries, before a video has been found for it', () => {
    const waiting = job(asked, 'queued');
    const other = job(findFor({ place: place(7, 'Faint', 'Live in Texas'), lengthSec: 170 }), 'queued');
    const bySlot = jobsBySlot([other, waiting], albumKey('Meteora'));
    assert.equal(bySlot.get('1:7'), waiting);
    assert.equal(bySlot.size, 1);
  });

  it('a new try at a place comes before the one that found nothing', () => {
    const before = job(asked, 'failed', { error: 'x', errorCode: 'ERR_DOWNLOAD_NO_MATCH' });
    const again = job(asked, 'queued');
    assert.equal(jobsBySlot([before, again], albumKey('Meteora')).get('1:7'), again);
    assert.equal(jobsBySlot([again, before], albumKey('Meteora')).get('1:7'), again);
  });
});

describe('stopping', () => {
  it('gives up on the ones not looked for yet, of this record, and only those', () => {
    const waiting = job(findFor({ place: place(1, 'Foreword'), lengthSec: 13 }), 'queued');
    const looking = job(findFor({ place: place(2, 'Dont Stay'), lengthSec: 188 }), 'finding');
    const fetching = job(found(findFor({ place: place(3, 'Somewhere I Belong'), lengthSec: 214 })), 'queued');
    const elsewhere = job(findFor({ place: place(1, 'Elsewhere', 'Another'), lengthSec: 100 }), 'queued');
    const typed: DownloadJob = job({ id: 'abcdefghijk', url: '', title: 'x', channel: '', thumbnail: null, duration: 1 }, 'queued');

    assert.deepEqual(unsought([waiting, looking, fetching, elsewhere, typed], albumKey('Meteora')), [waiting]);
  });
});

describe('the downloads of a record, whichever list it is being read off', () => {
  const key = albumKey('Meteora');
  const known: YouTubeVideo = { id: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'Faint', channel: 'Linkin Park', thumbnail: null, duration: 162 };

  it('a video already known waits to be downloaded and is never looked for', () => {
    const waiting = job(downloadFor(known, place(7, 'Faint')), 'queued');
    assert.equal(slotState(waiting), 'fetching');
    assert.deepEqual(unsought([waiting], key), []);
  });

  it('gives a row the job at its place when it is for the same song', () => {
    const faint = job(findFor({ place: place(7, 'Faint'), lengthSec: 162 }), 'queued');
    const found = jobsForPlaces([faint], key, [{ disc: null, track: 7, title: 'Faint (2011 Remaster)' }, { disc: null, track: 8, title: 'Figure.09' }]);
    assert.equal(found.get('1:7'), faint);
    assert.equal(found.size, 1);
  });

  it('follows a song to the place the other list has it at, and leaves that place\'s own row alone', () => {
    // Asked for off the album; now read off the deluxe edition, one track on.
    const faint = job(findFor({ place: place(7, 'Faint'), lengthSec: 162 }), 'finding');
    const found = jobsForPlaces([faint], key, [{ disc: null, track: 7, title: 'Easier to Run' }, { disc: null, track: 8, title: 'Faint' }]);
    assert.equal(found.get('1:8'), faint);
    assert.equal(found.has('1:7'), false);
  });

  it('is one row\'s only: an intro on each disc is two tracks', () => {
    const first = job(downloadFor(known, { ...place(1, 'Intro'), disc: 1 }), 'queued');
    const rows = [{ disc: 1, track: 1, title: 'Intro' }, { disc: 2, track: 1, title: 'Intro' }];
    const found = jobsForPlaces([first], key, rows);
    assert.equal(found.get('1:1'), first);
    assert.equal(found.has('2:1'), false);
  });
});
