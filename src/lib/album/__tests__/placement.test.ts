import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { track } from '../../__tests__/support.ts';
import { albumsOf } from '../../media/albums.ts';
import { mergeMetadata } from '../../media/enriched.ts';
import { siblingCover } from '../../metadata/covers.ts';
import { jobsBySlot, placedRow, placementOf, sharedGenre, slotOf, type Placement } from '../placement.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { DownloadJob, DownloadStatus } from '../../youtube/types.ts';

const PLACE: Placement = {
  album: 'Ghost Stories',
  title: 'Midnight',
  artist: 'Coldplay',
  track: 5,
  disc: null,
  year: 2014,
  genre: 'alternative rock',
};

const row = (trackId: string, fields: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId,
  status: 'matched',
  source: 'musicbrainz',
  title: null,
  artist: null,
  album: null,
  genre: null,
  year: null,
  artworkUrl: null,
  trackNumber: null,
  discNumber: null,
  ...fields,
});

const job = (id: string, status: DownloadStatus, placement?: unknown): DownloadJob => ({
  id,
  video: { id: `video-${id}`, url: '', title: id, channel: '', thumbnail: null, duration: 200, placement } as DownloadJob['video'],
  format: 'mp3',
  folder: 'Music',
  status,
  progress: 0,
  trackId: null,
  error: null,
  described: false,
});

describe('the place a download carries', () => {
  it('comes back off a job as it went on', () => {
    // Through the phone and back: a whole number arrives as a number still.
    const kept = JSON.parse(JSON.stringify({ id: 'v', placement: PLACE }));
    assert.deepEqual(placementOf(kept), PLACE);
  });

  it('is nothing on a download that was never for a record', () => {
    assert.equal(placementOf({ id: 'v', title: 'Some video' }), null);
    assert.equal(placementOf(null), null);
    assert.equal(placementOf({ placement: 'Ghost Stories' }), null);
  });

  it('is not believed without a record, a title and a place on it', () => {
    assert.equal(placementOf({ placement: { ...PLACE, album: '  ' } }), null);
    assert.equal(placementOf({ placement: { ...PLACE, title: 7 } }), null);
    assert.equal(placementOf({ placement: { ...PLACE, track: 0 } }), null);
    assert.equal(placementOf({ placement: { ...PLACE, track: 2.5 } }), null);
    assert.equal(placementOf({ placement: { ...PLACE, track: '5' } }), null);
  });

  it('drops what it cannot read of the rest and keeps the place', () => {
    assert.deepEqual(
      placementOf({ placement: { ...PLACE, artist: '', disc: 'two', year: -1, genre: 12 } }),
      { ...PLACE, artist: null, disc: null, year: null, genre: null }
    );
  });

  it('is on disc one where no disc is said', () => {
    assert.equal(slotOf(PLACE), '1:5');
    assert.equal(slotOf({ ...PLACE, disc: 2 }), '2:5');
  });
});

describe('the downloads asked for to complete a record', () => {
  it('are found by the record and the place, whatever case the name is in', () => {
    const jobs = [
      job('a', 'queued', PLACE),
      job('b', 'done', { ...PLACE, track: 6, title: "Another's Arms" }),
      job('other', 'done', { ...PLACE, album: 'Parachutes' }),
      job('plain', 'done'),
    ];
    const found = jobsBySlot(jobs, 'ghost stories');
    assert.deepEqual([...found].map(([slot, held]) => [slot, held.id]), [['1:5', 'a'], ['1:6', 'b']]);
  });

  it('a try that finished or is under way comes before one that failed', () => {
    assert.equal(jobsBySlot([job('failed', 'failed', PLACE), job('again', 'downloading', PLACE)], 'ghost stories').get('1:5')?.id, 'again');
    assert.equal(jobsBySlot([job('done', 'done', PLACE), job('failed', 'failed', PLACE)], 'ghost stories').get('1:5')?.id, 'done');
    // Nothing better than a failure: the newest, which the phone lists first.
    assert.equal(jobsBySlot([job('newer', 'failed', PLACE), job('older', 'cancelled', PLACE)], 'ghost stories').get('1:5')?.id, 'newer');
  });
});

describe('filing a downloaded track under its record', () => {
  it('writes the place as an edit', () => {
    assert.deepEqual(placedRow('new', PLACE, null), {
      trackId: 'new',
      status: 'manual',
      source: 'manual',
      title: 'Midnight',
      artist: 'Coldplay',
      album: 'Ghost Stories',
      genre: 'alternative rock',
      year: 2014,
      artworkUrl: null,
      trackNumber: 5,
      discNumber: null,
    });
  });

  it('keeps a cover the app holds and what a lookup knew that the place does not say', () => {
    const looked = row('new', {
      album: 'Midnight - Single',
      genre: 'ambient',
      year: 2013,
      artworkUrl: 'file:///covers/single.jpg',
      trackNumber: 1,
    });
    const filed = placedRow('new', { ...PLACE, genre: null, year: null }, looked)!;
    assert.equal(filed.album, 'Ghost Stories');
    assert.equal(filed.trackNumber, 5);
    assert.equal(filed.genre, 'ambient');
    assert.equal(filed.year, 2013);
    assert.equal(filed.artworkUrl, 'file:///covers/single.jpg');
  });

  it('does not keep the address of a cover that was a lookup’s guess at another release', () => {
    const looked = row('new', { artworkUrl: 'https://example.com/single.jpg' });
    assert.equal(placedRow('new', PLACE, looked)!.artworkUrl, null);
  });

  it('writes over a miss, and never over an edit', () => {
    assert.equal(placedRow('new', PLACE, row('new', { status: 'not_found' }))!.status, 'manual');
    assert.equal(placedRow('new', PLACE, row('new', { status: 'manual', album: 'Typed by hand' })), null);
    // Its own row, asked for again after the app was closed: nothing to do.
    assert.equal(placedRow('new', PLACE, placedRow('new', PLACE, null)), null);
  });

  it('puts the track in the album the library shows, in its place, with the album’s cover', () => {
    const COVER = 'file:///covers/ghost-stories.jpg';
    const library = [
      track({ id: 'magic', title: 'Magic', artist: 'Coldplay', album: 'Ghost Stories', trackNumber: 2 }),
      track({ id: 'o', title: 'O', artist: 'Coldplay', album: null }),
      // As it lands: the video's title, and the album its uploader typed.
      track({ id: 'new', title: 'Coldplay - Midnight (Official Video)', artist: 'Coldplay', album: 'Midnight - Single', trackNumber: 1 }),
    ];
    const rows = new Map([
      ['magic', row('magic', { artworkUrl: COVER, trackNumber: 2, year: 2014 })],
      ['o', row('o', { album: 'Ghost Stories', artworkUrl: COVER, trackNumber: 9 })],
    ]);
    const store = { readAllMetadata: () => rows, allTags: () => new Map() };

    // Before it is filed it is an album of its own, which is the whole problem.
    assert.equal(albumsOf(mergeMetadata(library, store)).length, 2);

    rows.set('new', placedRow('new', PLACE, null)!);
    const albums = albumsOf(mergeMetadata(library, store));
    assert.equal(albums.length, 1);
    assert.equal(albums[0]!.name, 'Ghost Stories');
    assert.deepEqual(albums[0]!.tracks.map((entry) => [entry.id, entry.title, entry.trackNumber]), [
      ['magic', 'Magic', 2],
      ['new', 'Midnight', 5],
      ['o', 'O', 9],
    ]);
    // And the cover its neighbours have is the one it is offered.
    assert.equal(siblingCover(library[2]!, library, rows), COVER);
  });
});

describe('the genre a record is counted under', () => {
  it('is the one most of its tracks have, the first met between equals', () => {
    const genres = (...said: (string | null)[]) => sharedGenre(said.map((genre) => ({ genre })));
    assert.equal(genres('rock', 'pop', null, 'pop'), 'pop');
    assert.equal(genres('rock', 'pop'), 'rock');
    assert.equal(genres(null, null), null);
    assert.equal(genres(), null);
  });
});
