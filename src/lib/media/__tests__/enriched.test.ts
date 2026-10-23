import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { artistShown, mergeMetadata, titleShown, type MetadataStore } from '../enriched.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { Tag, TagSource } from '../../db/tags.ts';
import { track } from '../../__tests__/support.ts';

function found(fields: Partial<TrackMetadata> & { trackId: string }): TrackMetadata {
  return {
    status: 'matched',
    source: 'musicbrainz',
    trackNumber: null,
    discNumber: null,
    title: null,
    artist: null,
    album: null,
    genre: null,
    year: null,
    artworkUrl: null,
    ...fields,
  };
}

function store(
  rows: TrackMetadata[],
  tags: Record<string, [string, TagSource][]> = {}
): MetadataStore {
  return {
    readAllMetadata: () => new Map(rows.map((row) => [row.trackId, row])),
    allTags: () =>
      new Map(
        Object.entries(tags).map(([trackId, list]) => [
          trackId,
          list.map(([tag, source], position): Tag => ({ tag, position, source })),
        ])
      ),
  };
}

describe('mergeMetadata', () => {
  it('leaves a track nothing has been found for exactly as the file has it', () => {
    const [merged] = mergeMetadata([track({ id: '1', title: 'Şımarık', artist: 'Tarkan' })], store([]));

    assert.equal(merged?.title, 'Şımarık');
    assert.equal(merged?.artist, 'Tarkan');
    assert.equal(merged?.genre, null);
    assert.equal(merged?.enriched, false);
    assert.deepEqual(merged?.tags, []);
  });

  it('treats a recorded miss as nothing found rather than as an answer', () => {
    const [merged] = mergeMetadata(
      [track({ id: '1', title: 'Unknown' })],
      store([found({ trackId: '1', status: 'not_found' })])
    );

    assert.equal(merged?.enriched, false);
    assert.equal(merged?.genre, null);
  });

  it('lets a lookup fill a gap but not overrule the file', () => {
    // A lookup can come back with a cover version when the original is in no
    // catalogue, so its title and artist are only worth having where the file
    // is silent.
    const [merged] = mergeMetadata(
      [track({ id: '1', title: 'Akuma no Ko', artist: 'Ai Higuchi', album: null })],
      store([
        found({
          trackId: '1',
          title: 'Akuma no Ko (Cover)',
          artist: 'Somebody Else',
          album: 'Attack on Titan',
        }),
      ])
    );

    assert.equal(merged?.title, 'Akuma no Ko');
    assert.equal(merged?.artist, 'Ai Higuchi');
    assert.equal(merged?.album, 'Attack on Titan');
    assert.equal(merged?.enriched, true);
  });

  it('always takes genre and year, which the file has no counterpart for', () => {
    const [merged] = mergeMetadata(
      [track({ id: '1', title: 'Kaikai Kitan', artist: 'Eve' })],
      store([found({ trackId: '1', genre: 'j-rock', year: 2020 })])
    );

    assert.equal(merged?.genre, 'j-rock');
    assert.equal(merged?.year, 2020);
  });

  it('lets a typed correction replace what the file says', () => {
    // The one case where the file loses: an edit exists precisely because the
    // file was wrong.
    const [merged] = mergeMetadata(
      [track({ id: '1', title: 'track03', artist: 'Unknown Artist', album: 'Unknown Album' })],
      store([
        found({
          trackId: '1',
          status: 'manual',
          title: 'Kaikai Kitan',
          artist: 'Eve',
          album: 'Smile',
        }),
      ])
    );

    assert.equal(merged?.title, 'Kaikai Kitan');
    assert.equal(merged?.artist, 'Eve');
    assert.equal(merged?.album, 'Smile');
    assert.equal(merged?.enriched, true);
  });

  it('keeps the file where a typed correction left a field blank', () => {
    const [merged] = mergeMetadata(
      [track({ id: '1', title: 'Kaikai Kitan', artist: 'Eve' })],
      store([found({ trackId: '1', status: 'manual', title: null, artist: null })])
    );

    assert.equal(merged?.title, 'Kaikai Kitan');
    assert.equal(merged?.artist, 'Eve');
  });

  it('takes a looked-up cover, since the media store never supplies one', () => {
    const [merged] = mergeMetadata(
      [track({ id: '1' })],
      store([found({ trackId: '1', artworkUrl: 'https://example.test/cover.jpg' })])
    );

    assert.equal(merged?.artworkUri, 'https://example.test/cover.jpg');
  });

  it('attaches tags in stored order, whatever the metadata row says', () => {
    // Tags and metadata are separate tables on purpose: a track can be tagged
    // by hand without ever having been looked up.
    const merged = mergeMetadata(
      [track({ id: '1' }), track({ id: '2' })],
      store([], {
        '1': [
          ['gothic', 'manual'],
          ['metal', 'musicbrainz'],
          ['japanese', 'itunes'],
        ],
      })
    );

    assert.deepEqual(merged[0]?.tags, ['gothic', 'metal', 'japanese']);
    assert.deepEqual(merged[1]?.tags, []);
    // Tags alone are not a lookup.
    assert.equal(merged[0]?.enriched, false);
  });

  it('keeps tags on a track whose lookup missed', () => {
    const [merged] = mergeMetadata(
      [track({ id: '1' })],
      store([found({ trackId: '1', status: 'not_found' })], { '1': [['shoegaze', 'manual']] })
    );

    assert.deepEqual(merged?.tags, ['shoegaze']);
  });

  it('returns one entry per track, in the order given', () => {
    const merged = mergeMetadata(
      [track({ id: 'c' }), track({ id: 'a' }), track({ id: 'b' })],
      store([found({ trackId: 'a', genre: 'pop' })])
    );

    assert.deepEqual(
      merged.map((entry) => entry.id),
      ['c', 'a', 'b']
    );
  });
});

describe('the album artist a track is shown with', () => {
  it('is the file’s, and a lookup only fills a gap', () => {
    const [own, filled] = mergeMetadata(
      [
        track({ id: '1', album: 'Ruins', albumArtist: 'Aurora' }),
        track({ id: '2', album: 'Ruins', albumArtist: null }),
      ],
      store([
        found({ trackId: '1', album: 'Ruins', albumArtist: 'Somebody Else' }),
        found({ trackId: '2', album: 'Ruins', albumArtist: 'Aurora' }),
      ])
    );
    assert.equal(own?.albumArtist, 'Aurora');
    assert.equal(filled?.albumArtist, 'Aurora');
  });

  it('is not taken from a lookup that answered with another record than the one shown', () => {
    // The file says the compilation; the catalogue sold the song on the
    // artist's own album. Taking that album's artist would split the song off
    // the compilation onto a record of one.
    const [merged] = mergeMetadata(
      [track({ id: '1', album: 'Now 50' })],
      store([found({ trackId: '1', album: 'Anti', albumArtist: 'Rihanna' })])
    );
    assert.equal(merged?.album, 'Now 50');
    assert.equal(merged?.albumArtist, null);
  });

  it('is what was typed, and nobody at all when the box was emptied', () => {
    const [typed, emptied, untouched] = mergeMetadata(
      [
        track({ id: '1', albumArtist: 'Wrong' }),
        track({ id: '2', albumArtist: 'Wrong' }),
        track({ id: '3', albumArtist: 'Right' }),
      ],
      store([
        found({ trackId: '1', status: 'manual', albumArtist: 'Fixed' }),
        found({ trackId: '2', status: 'manual', albumArtist: '' }),
        found({ trackId: '3', status: 'manual', albumArtist: null }),
      ])
    );
    assert.equal(typed?.albumArtist, 'Fixed');
    assert.equal(emptied?.albumArtist, null);
    assert.equal(untouched?.albumArtist, 'Right');
  });
});

describe('the record a corrected track is shown on', () => {
  it('is what was typed, no record at all when the box was emptied, and the file’s when nobody said', () => {
    const [typed, emptied, untouched] = mergeMetadata(
      [
        track({ id: '1', album: 'Wrong' }),
        track({ id: '2', album: 'Wrong' }),
        track({ id: '3', album: 'Right' }),
      ],
      store([
        found({ trackId: '1', status: 'manual', album: 'Fixed' }),
        found({ trackId: '2', status: 'manual', album: '' }),
        found({ trackId: '3', status: 'manual', album: null }),
      ])
    );
    assert.equal(typed?.album, 'Fixed');
    assert.equal(emptied?.album, null);
    assert.equal(untouched?.album, 'Right');
  });
});

describe('a cover a track was given by its record', () => {
  const sharing = (rows: TrackMetadata[], shared: Record<string, string>): MetadataStore => ({
    ...store(rows),
    readSharedCovers: () => new Map(Object.entries(shared)),
  });

  it('is shown on a track never looked up, and on one nobody could find', () => {
    const [never, missed] = mergeMetadata(
      [track({ id: '1' }), track({ id: '2' })],
      sharing([found({ trackId: '2', status: 'not_found' })], { '1': 'file:///a.jpg', '2': 'file:///a.jpg' })
    );
    assert.equal(never?.artworkUri, 'file:///a.jpg');
    assert.equal(never?.enriched, false);
    assert.equal(missed?.artworkUri, 'file:///a.jpg');
  });

  it('gives way to a cover the track has of its own, and outranks a mere address', () => {
    const [own, address, edited] = mergeMetadata(
      [track({ id: '1' }), track({ id: '2' }), track({ id: '3' })],
      sharing(
        [
          found({ trackId: '1', artworkUrl: 'file:///own.jpg' }),
          found({ trackId: '2', artworkUrl: 'https://is1-ssl.mzstatic.com/a.jpg' }),
          found({ trackId: '3', status: 'manual' }),
        ],
        { '1': 'file:///given.jpg', '2': 'file:///given.jpg', '3': 'file:///given.jpg' }
      )
    );
    assert.equal(own?.artworkUri, 'file:///own.jpg');
    assert.equal(address?.artworkUri, 'file:///given.jpg');
    assert.equal(edited?.artworkUri, 'file:///given.jpg');
  });
});

describe('the name a looked-up track is shown with', () => {
  const row = (title: string | null, artist: string | null = null) =>
    found({ trackId: '1', title, artist, album: null });

  it('is the lookup’s, where it is the file’s own with the artist and the upload taken off', () => {
    const file = track({ id: '1', title: 'Feint - Snake Eyes (Official Video)', artist: null, album: null });
    assert.equal(titleShown(file, row('Snake Eyes', 'Feint')), 'Snake Eyes');
    assert.equal(artistShown(file, row('Snake Eyes', 'Feint')), 'Feint');
    const tagged = track({ id: '1', title: 'AURORA - Runaway', artist: 'AURORA', album: null });
    assert.equal(titleShown(tagged, row('Runaway', 'Aurora')), 'Runaway');
    // The file's credit stands, spelt as it was.
    assert.equal(artistShown(tagged, row('Runaway', 'Aurora')), 'AURORA');
  });

  it('is the file’s where the lookup’s is another name, without the artist said twice', () => {
    const file = track({ id: '1', title: 'Feint - Snake Eyes', artist: null, album: null });
    assert.equal(titleShown(file, row('Snake Eyes (VIP)', 'Feint')), 'Snake Eyes');
    assert.equal(titleShown(file, row(null, null)), 'Feint - Snake Eyes');
  });

  it('is what was typed, and the file’s for a track nobody found', () => {
    const file = track({ id: '1', title: 'Feint - Snake Eyes', artist: null, album: null });
    assert.equal(titleShown(file, { ...row('Typed'), status: 'manual' }), 'Typed');
    assert.equal(titleShown(file, { ...row('Snake Eyes'), status: 'not_found' }), 'Feint - Snake Eyes');
    assert.equal(titleShown(file, null), 'Feint - Snake Eyes');
  });
});
