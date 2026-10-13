import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { coverUrl, readDetails, readNearness, readRadio, readTagRadio } from '../listenbrainz.ts';
import { details, radio, SEED, similar, tagged } from './answers.ts';
import * as built from './built.ts';

describe('reading an artist radio answer', () => {
  it('gives one entry an artist, the artist asked about among them', () => {
    const artists = readRadio(radio);
    assert.deepEqual(artists.map((artist) => artist.name).sort(), ['Reol', 'supercell', '坂本真綾', '妖精帝國'].sort());
    assert.ok(artists.some((artist) => artist.mbid === SEED));
  });

  it('keeps how often each recording has been played, which is all it says about one', () => {
    const supercell = readRadio(radio).find((artist) => artist.name === 'supercell')!;
    assert.equal(supercell.recordings.length, 6);
    assert.deepEqual(supercell.recordings[0], { mbid: '7c6b6bbd-bb83-4826-b360-8f24b48e3d6e', listens: 1543 });
  });

  it('makes nothing of an answer that is not one', () => {
    assert.deepEqual(readRadio(null), []);
    assert.deepEqual(readRadio([]), []);
    assert.deepEqual(readRadio({ code: 400, error: 'Argument max_similar_artists must be specified.' }), []);
    assert.deepEqual(readRadio({ someone: [] }), []);
  });

  it('counts a recording once however often it is listed', () => {
    const row = { recording_mbid: 'r', similar_artist_mbid: 'a', similar_artist_name: 'A', total_listen_count: 5 };
    assert.equal(readRadio({ a: [row, row] })[0]!.recordings.length, 1);
  });
});

describe('reading a tag radio answer', () => {
  it('gives each recording and where it sits in the band', () => {
    const rows = readTagRadio(tagged);
    assert.equal(rows.length, 6);
    assert.equal(rows[0]!.mbid, 'fa11e8fa-6432-4ec5-aa43-e3323d985f12');
    assert.ok(Math.abs(rows[0]!.percent - 47.54) < 0.01);
  });

  it('makes nothing of a refusal', () => {
    assert.deepEqual(readTagRadio({ code: 400, error: 'tag must be specified' }), []);
  });
});

describe('reading what recordings are', () => {
  const found = readDetails(details);

  it('names the song, the credit as written and the record', () => {
    const song = [...found.values()].find((recording) => recording.title === '罪人')!;
    assert.equal(song.artist, 'supercell');
    assert.equal(song.release, 'My Dearest');
    assert.ok(Math.abs(song.durationSec! - 226.72) < 0.001);
  });

  it('keeps everybody in a credit, in order, with their ids', () => {
    const song = [...found.values()].find((recording) => recording.title === 'またね')!;
    assert.equal(song.artist, 'supercell feat. 初音ミク');
    assert.deepEqual(song.artists!.map((artist) => artist.name), ['supercell', '初音ミク']);
  });

  it('puts the song’s own genres before its artist’s, and leaves out tags that are not genres', () => {
    const song = [...found.values()].find((recording) => recording.title === '罪人')!;
    // Tagged j-pop and pop itself; pop rock and j-rock are only true of the artist.
    assert.deepEqual(song.tags.slice(0, 2).sort(), ['j-pop', 'pop']);
    assert.ok(song.tags.indexOf('j-rock') > 1);
    assert.ok(song.tags.length <= 5);
    assert.ok(![...found.values()].some((recording) => recording.tags.includes('vocaloid')));
  });

  it('says where the sleeve is, and null where there is none', () => {
    const song = [...found.values()].find((recording) => recording.title === '罪人')!;
    assert.match(coverUrl(song)!, /^https:\/\/coverartarchive\.org\/release\/[0-9a-f-]{36}\/\d+-250\.jpg$/);
    assert.equal(coverUrl({ ...song, caaId: null }), null);
  });

  it('leaves out a recording it was told nothing about', () => {
    assert.equal(readDetails({ gone: null, nameless: { recording: {}, artist: { name: 'A' } } }).size, 0);
  });
});

describe('reading how near artists are', () => {
  const near = readNearness(similar);

  it('says it as a share of the nearest to the same artist, so that it means the same for everybody', () => {
    // 106 sittings beside the 122 of the nearest to 妖精帝國, and 3 144 beside 7 045 for Portishead.
    assert.ok(Math.abs(near.get('9b15ff5e-5bd1-43c2-821d-e31240aad334')!.similarity - 106 / 122) < 1e-9);
    assert.ok(Math.abs(near.get('b6b2bb8d-54a9-491f-9607-7b546023b433')!.similarity - 3144 / 7045) < 1e-9);
  });

  it('gives an artist the service listed twice once', () => {
    assert.equal(near.get('a74b1b7f-71a5-4011-9441-d0b5e4122711')!.similarity, 1);
    assert.equal(near.size, 6);
  });

  it('makes nothing of a refusal', () => {
    assert.equal(readNearness('<!doctype html><title>400 Bad Request</title>').size, 0);
  });
});

describe('reading how many people play an artist', () => {
  it('gives each artist its listeners, and leaves out one that was never counted', async () => {
    const { readPopularity } = await import('../listenbrainz.ts');
    const users = readPopularity([...built.popularity, { artist_mbid: 'never', total_listen_count: null, total_user_count: null }]);
    assert.ok(users.size > 50);
    assert.ok([...users.values()].every((count) => count > 0));
    assert.equal(users.has('never'), false);
    assert.deepEqual([...readPopularity({ code: 401 })], []);
  });
});

describe('reading what else is known of an artist', () => {
  it('finds where Deezer keeps them, from MusicBrainz’s own link', async () => {
    const { readFacts } = await import('../listenbrainz.ts');
    const facts = readFacts(built.facts);
    assert.equal(facts.get(built.IDS.AURORA!)!.deezerId, 7699874);
    // Metallica has no such link, which is an answer and not a failure.
    assert.equal(facts.get(built.IDS.Metallica!)!.deezerId, null);
    assert.ok(facts.get(built.IDS.AURORA!)!.tags.length > 0 && facts.get(built.IDS.AURORA!)!.tags.length <= 5);
  });

  it('reads the link in whatever language the address is written for, and only an artist’s', async () => {
    const { readFacts } = await import('../listenbrainz.ts');
    const one = (link: string) => readFacts([{ artist_mbid: 'a', rels: { streaming: link } }]).get('a')!.deezerId;
    assert.equal(one('https://www.deezer.com/artist/652'), 652);
    assert.equal(one('https://www.deezer.com/fr/artist/652'), 652);
    assert.equal(one('https://www.deezer.com/album/652'), null);
    assert.deepEqual([...readFacts('refused')], []);
  });
});
