import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  byRecord,
  coverIndex,
  isEmbeddedPicture,
  recordKey,
  sameRecordName,
  siblingCover,
} from '../covers.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import { track } from './support.ts';

const row = (trackId: string, changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'matched', source: 'musicbrainz', title: null, artist: null,
  album: null, genre: 'rock', year: null, artworkUrl: null, trackNumber: null,
  discNumber: null, ...changes,
});

const rowsOf = (...rows: TrackMetadata[]) => new Map(rows.map((entry) => [entry.trackId, entry]));

const RUINS = 'file:///covers/ruins.jpg';
const OTHER = 'file:///covers/other.jpg';

describe('the cover a track takes from its record', () => {
  it('is the one another track of the same album already has', () => {
    const wanting = track({ id: '1', title: 'A', album: 'Ruins' });
    const library = [wanting, track({ id: '2', title: 'B', album: 'Ruins' })];

    assert.equal(siblingCover(wanting, library, rowsOf(row('1'), row('2', { artworkUrl: RUINS }))), RUINS);
  });

  it('takes two spellings of an album for one record, as the album list does', () => {
    const wanting = track({ id: '1', title: 'A', album: ' ruins' });
    const library = [wanting, track({ id: '2', title: 'B', album: 'Ruins ' })];

    assert.equal(siblingCover(wanting, library, rowsOf(row('2', { artworkUrl: RUINS }))), RUINS);
  });

  it('goes by the album the library shows, whether the file or a lookup named it', () => {
    // Neither file says anything. One row was looked up, the other typed.
    const wanting = track({ id: '1', title: 'A' });
    const library = [wanting, track({ id: '2', title: 'B', album: 'What the file says' })];
    const rows = rowsOf(
      row('1', { album: 'Ruins' }),
      row('2', { status: 'manual', album: 'Ruins', artworkUrl: RUINS })
    );

    assert.equal(siblingCover(wanting, library, rows), RUINS);
  });

  it('gives a track that names no album no neighbours at all', () => {
    const wanting = track({ id: '1', title: 'A' });
    const library = [wanting, track({ id: '2', title: 'B' }), track({ id: '3', title: 'C', album: '  ' })];
    const rows = rowsOf(row('2', { artworkUrl: RUINS }), row('3', { artworkUrl: RUINS }));

    assert.equal(recordKey(wanting, undefined), null);
    assert.equal(siblingCover(wanting, library, rows), null);
  });

  it('shares a compilation’s cover across its different artists', () => {
    const wanting = track({ id: '1', title: 'A', album: 'Now 12', artist: 'Someone' });
    const library = [wanting, track({ id: '2', title: 'B', album: 'Now 12', artist: 'Somebody else' })];

    assert.equal(siblingCover(wanting, library, rowsOf(row('2', { artworkUrl: RUINS }))), RUINS);
  });

  it('prefers the cover most of the record has when they disagree', () => {
    const wanting = track({ id: '1', title: 'A', album: 'Ruins' });
    const library = [
      wanting,
      track({ id: '2', title: 'B', album: 'Ruins' }),
      track({ id: '3', title: 'C', album: 'Ruins' }),
      track({ id: '4', title: 'D', album: 'Ruins' }),
    ];
    const rows = rowsOf(
      row('2', { artworkUrl: OTHER }),
      row('3', { artworkUrl: RUINS }),
      row('4', { artworkUrl: RUINS })
    );

    assert.equal(siblingCover(wanting, library, rows), RUINS);
  });

  it('takes the first it saw when two covers are level', () => {
    const wanting = track({ id: '1', title: 'A', album: 'Ruins' });
    const library = [
      wanting,
      track({ id: '2', title: 'B', album: 'Ruins' }),
      track({ id: '3', title: 'C', album: 'Ruins' }),
    ];
    const rows = rowsOf(row('2', { artworkUrl: OTHER }), row('3', { artworkUrl: RUINS }));

    assert.equal(siblingCover(wanting, library, rows), OTHER);
  });

  it('never offers one to a track that has a cover of its own', () => {
    const chosen = track({ id: '1', title: 'A', album: 'Ruins' });
    const library = [chosen, track({ id: '2', title: 'B', album: 'Ruins' })];
    const rows = rowsOf(
      row('1', { status: 'manual', artworkUrl: OTHER }),
      row('2', { artworkUrl: RUINS })
    );

    assert.equal(siblingCover(chosen, library, rows), null);
  });

  it('does not count an address nobody has fetched yet as a cover', () => {
    const wanting = track({ id: '1', title: 'A', album: 'Ruins' });
    const library = [wanting, track({ id: '2', title: 'B', album: 'Ruins' })];
    const rows = rowsOf(row('2', { artworkUrl: 'https://is1-ssl.mzstatic.com/ruins.jpg' }));

    assert.equal(siblingCover(wanting, library, rows), null);
  });

  it('counts a cover somebody chose by hand like any other', () => {
    const wanting = track({ id: '1', title: 'A', album: 'Ruins' });
    const library = [wanting, track({ id: '2', title: 'B', album: 'Ruins' })];

    assert.equal(
      siblingCover(wanting, library, rowsOf(row('2', { status: 'manual', artworkUrl: RUINS }))),
      RUINS
    );
  });

  it('learns of a cover found since it was built', () => {
    const index = coverIndex();
    assert.equal(index.pick('ruins'), null);
    index.add('ruins', RUINS);
    assert.equal(index.pick('ruins'), RUINS);
  });
});

describe('the order a run takes its tracks in', () => {
  const named = (id: string, album: string | null) => ({ id, album });
  const order = (items: { id: string; album: string | null }[]) =>
    byRecord(items, (item) => item.album).map((item) => item.id).join(' ');

  it('brings a record’s tracks together where the first of them stood', () => {
    assert.equal(
      order([named('a1', 'A'), named('b1', 'B'), named('a2', 'A'), named('c1', 'C'), named('b2', 'B')]),
      'a1 a2 b1 b2 c1'
    );
  });

  it('leaves tracks that name no record where they were', () => {
    assert.equal(
      order([named('x', null), named('a1', 'A'), named('y', null), named('a2', 'A')]),
      'x a1 a2 y'
    );
  });

  it('keeps the order within a record', () => {
    assert.equal(order([named('a3', 'A'), named('a1', 'A'), named('a2', 'A')]), 'a3 a1 a2');
  });
});

describe('whether two catalogues mean the same record', () => {
  it('says so through case, accents and what a shop adds to a name', () => {
    assert.ok(sameRecordName('Ruins', 'ruins'));
    assert.ok(sameRecordName('Şımarık', 'Simarik'));
    assert.ok(sameRecordName('Ruins (Deluxe Edition)', 'Ruins'));
    assert.ok(sameRecordName('Ruins - EP', 'Ruins'));
  });

  it('does not take a song’s single for the album it is on', () => {
    assert.ok(!sameRecordName('Akuma no Ko - Single', 'Ruins'));
  });

  it('says nothing is the same as a record nobody named', () => {
    assert.ok(!sameRecordName(null, 'Ruins'));
    assert.ok(!sameRecordName('', ''));
    assert.ok(!sameRecordName('(Deluxe)', '(Live)'));
  });
});

describe('whether a track’s own picture came out of its file', () => {
  it('says so for the copy the phone makes of a picture inside the file', () => {
    assert.ok(isEmbeddedPicture('file:///data/user/0/app/cache/artwork/4411-1718000000.jpg'));
  });

  it('does not for a download’s thumbnail, a saved cover, or nothing', () => {
    assert.ok(!isEmbeddedPicture('file:///data/user/0/app/files/downloads/abc/thumbnail.jpg'));
    assert.ok(!isEmbeddedPicture('file:///data/user/0/app/files/album-artwork/abc.jpg'));
    assert.ok(!isEmbeddedPicture(null));
  });
});
