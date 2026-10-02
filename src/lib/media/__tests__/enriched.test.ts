import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeMetadata, type MetadataStore } from '../enriched.ts';
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
