import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readArtists, readTracks } from '../deezer.ts';
import * as built from './built.ts';

describe('reading Deezer’s artists', () => {
  it('gives each its number, its name and how many follow it', () => {
    const related = readArtists(built.related['7699874']);
    assert.equal(related.length, 20);
    assert.equal(related[0]!.name, 'Paris Paloma');
    assert.ok(related.every((artist) => Number.isInteger(artist.id) && artist.name && (artist.fans ?? 0) >= 0));
  });

  it('makes nothing of a refusal, which comes as an answer', () => {
    assert.deepEqual(readArtists({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }), []);
    assert.deepEqual(readArtists(null), []);
    assert.deepEqual(readArtists({ data: [{ name: 'no id' }, { id: 3 }] }), []);
  });
});

describe('reading an artist’s most played', () => {
  const tracks = readTracks(built.top['7699874']);

  it('keeps the order, the title with and without its bracket, and who the track is filed under', () => {
    assert.equal(tracks[0]!.title, 'Runaway');
    assert.equal(tracks[0]!.short, 'Runaway');
    assert.equal(tracks[0]!.version, '');
    assert.equal(tracks[0]!.artistId, 7699874);
    const demo = tracks.find((track) => track.title === 'Let Me Heal You (Demo)')!;
    assert.equal(demo.short, 'Let Me Heal You');
    assert.equal(demo.version, '(Demo)');
    assert.ok(tracks.some((track) => track.artistId !== 7699874), 'a guest spot is filed under somebody else');
  });

  it('says where the sleeve is and how long the track runs', () => {
    assert.ok(tracks.every((track) => track.cover?.startsWith('https://cdn-images.dzcdn.net/images/cover/')));
    assert.ok(tracks.every((track) => (track.durationSec ?? 0) > 0));
  });

  it('makes nothing of an answer that is not one', () => {
    assert.deepEqual(readTracks({ error: { code: 800 } }), []);
    assert.deepEqual(readTracks(undefined), []);
  });
});
