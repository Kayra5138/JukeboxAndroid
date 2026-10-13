import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readTracks, type DeezerTrack } from '../deezer.ts';
import { readDetails, type Recording } from '../listenbrainz.ts';
import {
  firstSongs,
  firstStretch,
  listenedOffers,
  MEGASTAR_FANS,
  moreSongs,
  readIssued,
  recordingTake,
  isShopSong,
  shopOffers,
  shopSongId,
  shopSongs,
  shopTake,
} from '../songs.ts';
import { looseSongKey } from '../variants.ts';
import * as built from './built.ts';

const AURORA = { id: 7699874, name: 'AURORA', fans: 560226 };
const hers = readTracks(built.top['7699874']);
const track = (over: Partial<DeezerTrack>): DeezerTrack => ({
  id: 1, title: 'Song', short: 'Song', version: '', durationSec: 200, rank: 1, artistId: 1, artistName: 'Band', album: 'Record',
  cover: null, ...over,
});
const none = new Set<string>();

describe('telling a shop’s track from the song as it was made', () => {
  it('reads the shop’s own bracket', () => {
    assert.equal(shopTake(track({ title: 'Let Me Heal You (Demo)', short: 'Let Me Heal You', version: '(Demo)' })), 'demo');
    assert.equal(shopTake(track({ title: 'Laymelli (Edit)', short: 'Laymelli', version: '(Edit)' })), 'edit');
    assert.equal(shopTake(track({ title: 'Big in Japan (Ivan Spell Radio Mix)', short: 'Big in Japan', version: '(Ivan Spell Radio Mix)' })), 'mix');
    assert.equal(shopTake(track({ title: 'Strangers (Acoustic)', short: 'Strangers', version: '(Acoustic)' })), 'acoustic');
  });

  it('lets through a bracket that only says how the same take was issued', () => {
    assert.equal(shopTake(track({ title: 'Nothing Else Matters (Remastered 2021)', short: 'Nothing Else Matters', version: '(Remastered 2021)' })), null);
    assert.equal(shopTake(track({ title: 'Where Have You Been (Album Version)', short: 'Where Have You Been', version: '(Album Version)' })), null);
    assert.equal(shopTake(track({ title: 'Enemy (from the series Arcane League of Legends)', short: 'Enemy', version: '(from the series Arcane League of Legends)' })), null);
  });

  it('reads the title where the shop put the note there, the record, and the length', () => {
    assert.equal(shopTake(track({ title: 'Hide and Seek (Nightcore)' })), 'nightcore');
    assert.equal(shopTake(track({ title: 'Song', album: 'Live at Leeds' })), 'takes');
    assert.equal(shopTake(track({ title: 'Jingle', durationSec: 40 })), 'length');
  });
});

describe('an artist’s songs from a shop’s list', () => {
  it('keeps what is filed under the artist, and not a guest spot', () => {
    const songs = shopSongs(hers, AURORA, none);
    assert.ok(hers.some((entry) => entry.artistId !== AURORA.id), 'the list has guest spots to leave out');
    assert.ok(songs.every((entry) => entry.artistId === AURORA.id));
    assert.deepEqual(songs.slice(0, 3).map((entry) => entry.title), ['Runaway', 'Cure For Me', 'The Seed']);
  });

  it('leaves out what the library has, by any spelling, and gives each song once', () => {
    const owned = new Set([looseSongKey({ title: 'RUNAWAY (2016 Remaster)', artist: 'Aurora' })]);
    const songs = shopSongs([...hers, ...hers], AURORA, owned).map((entry) => entry.title);
    assert.ok(!songs.includes('Runaway'));
    assert.equal(new Set(songs).size, songs.length);
  });
});

describe('which songs a new artist is introduced by', () => {
  const ten = Array.from({ length: 12 }, (_, index) => `song ${index + 1}`);

  it('takes the first two for well-known, the first four with no preference, the fourth onward for lesser-known', () => {
    assert.deepEqual(firstSongs(ten, 'known', false).map((entry) => entry.song), ['song 1', 'song 2']);
    assert.deepEqual(firstSongs(ten, 'any', false).map((entry) => entry.song), ['song 1', 'song 2', 'song 3', 'song 4']);
    assert.deepEqual(firstSongs(ten, 'deep', false).map((entry) => entry.place), [3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('starts one down for an artist everybody has heard, unless well-known is what was asked for', () => {
    assert.deepEqual(firstStretch('any', true), [1, 5]);
    assert.deepEqual(firstSongs(ten, 'any', true).map((entry) => entry.song), ['song 2', 'song 3', 'song 4', 'song 5']);
    assert.deepEqual(firstSongs(ten, 'known', true).map((entry) => entry.song), ['song 1', 'song 2']);
    assert.deepEqual(firstStretch('deep', true), [3, 12]);
  });

  it('wants the top of the stretch most and the rest of it too', () => {
    const weights = firstSongs(ten, 'any', false).map((entry) => entry.weight);
    assert.equal(weights[0], 1);
    assert.ok(weights.every((weight, index) => index === 0 || (weight < weights[index - 1]! && weight > 0.25)));
  });

  it('uses the best an artist has when they have too few songs to reach the stretch', () => {
    assert.deepEqual(firstSongs(['a', 'b'], 'deep', false).map((entry) => entry.song), ['a', 'b']);
    assert.deepEqual(firstSongs([], 'any', false), []);
  });

  it('skips the song everybody knows for an artist with a million followers', () => {
    const tracks = Array.from({ length: 8 }, (_, index) => track({ id: index + 1, title: `Song ${index + 1}`, short: `Song ${index + 1}` }));
    const small = shopOffers(tracks, { id: 1, name: 'Band', fans: MEGASTAR_FANS - 1 }, none, false, 'any');
    const huge = shopOffers(tracks, { id: 1, name: 'Band', fans: MEGASTAR_FANS }, none, false, 'any');
    assert.deepEqual(small.map((offer) => offer.title), ['Song 1', 'Song 2', 'Song 3', 'Song 4']);
    assert.deepEqual(huge.map((offer) => offer.title), ['Song 2', 'Song 3', 'Song 4', 'Song 5']);
    // An artist whose following nobody said is not taken for a star.
    assert.equal(shopOffers(tracks, { id: 1, name: 'Band', fans: null }, none, false, 'any')[0]!.title, 'Song 1');
  });

  it('makes of each an offer under Deezer’s number for the track, with its sleeve and length', () => {
    const [first] = shopOffers(hers, AURORA, none, false, 'any');
    assert.equal(first!.id, shopSongId(hers[0]!.id));
    // The phone's queue takes a key of this shape and no other (`DownloadQueue.kt`).
    assert.match(first!.id, /^[a-fA-F0-9-]{36}$/);
    assert.equal(shopSongId(130892874), 'dee2e500-0000-4000-8000-000007cd444a');
    assert.equal(shopSongId(4293650372).length, 36);
    assert.notEqual(shopSongId(1), shopSongId(2));
    assert.equal(isShopSong(first!.id), true);
    assert.equal(isShopSong('1c4dc3c8-2a89-425b-90ab-52b6a785d503'), false);
    assert.equal(first!.title, 'Runaway');
    assert.equal(first!.credit, 'AURORA');
    assert.ok(first!.cover!.startsWith('https://cdn-images.dzcdn.net/images/cover/'));
    assert.equal(first!.durationSec, hers[0]!.durationSec);
  });
});

describe('which songs to offer of an artist already played', () => {
  it('offers everything left, the better known for more but the thirtieth still', () => {
    const more = moreSongs(Array.from({ length: 30 }, (_, index) => index), 'any');
    assert.equal(more.length, 30);
    assert.equal(more[0]!.weight, 1);
    assert.ok(more[29]!.weight > 0.2 && more[29]!.weight < more[0]!.weight);
  });

  it('counts every place the same when lesser-known was asked for, and leans hard when well-known was', () => {
    assert.ok(moreSongs([1, 2, 3], 'deep').every((entry) => entry.weight === 1));
    assert.ok(moreSongs([1, 2, 3, 4, 5, 6, 7, 8], 'known')[7]!.weight < moreSongs([1, 2, 3, 4, 5, 6, 7, 8], 'any')[7]!.weight);
  });
});

describe('what MusicBrainz says a recording was issued on', () => {
  const read = (releases: unknown[]) => readIssued({ recordings: [{ id: 'r', releases }] }).get('r')!.studio;
  const on = (status: string, primary: string, ...secondary: string[]) => ({
    status, 'release-group': { 'primary-type': primary, 'secondary-types': secondary },
  });

  it('takes one honest record for a song, whatever else it has been put on', () => {
    assert.equal(read([on('Official', 'Album')]), true);
    assert.equal(read([on('Bootleg', 'Album', 'Live'), on('Official', 'Single')]), true);
    assert.equal(read([on('Official', 'EP')]), true);
  });

  it('does not take a bootleg, a concert, a compilation, a remix record or a demo for one', () => {
    assert.equal(read([on('Bootleg', 'Album')]), false);
    assert.equal(read([on('Official', 'Album', 'Live')]), false);
    assert.equal(read([on('Official', 'Album', 'Compilation')]), false);
    assert.equal(read([on('Official', 'Album', 'Compilation', 'Remix')]), false);
    assert.equal(read([on('Withdrawn', 'Single', 'Demo'), on('Promotion', 'Single')]), false);
    assert.equal(read([on('Official', 'Other')]), false);
    assert.equal(read([]), false);
  });

  it('takes a soundtrack for a record like another', () => {
    assert.equal(read([on('Official', 'Album', 'Soundtrack')]), true);
    assert.equal(read([on('Official', 'Album', 'Soundtrack', 'Live')]), false);
  });

  it('reads the real answers', () => {
    const issued = readIssued({ recordings: built.issued });
    assert.ok(issued.size > 50);
    assert.ok([...issued.values()].some((kind) => kind.studio) && [...issued.values()].some((kind) => !kind.studio));
  });
});

describe('telling a ListenBrainz recording from the song as it was made', () => {
  const ME = 'artist-1';
  const recording = (over: Partial<Recording>): Recording => ({
    mbid: 'r', title: 'Song', artist: 'Band', release: 'Record', caaId: null, caaReleaseMbid: null, durationSec: 200, tags: [],
    artists: [{ mbid: ME, name: 'Band' }], ...over,
  });
  const take = (over: Partial<Recording>, studio?: boolean) =>
    recordingTake(recording(over), ME, studio === undefined ? undefined : { studio });

  it('lets a song through', () => {
    assert.equal(take({}), null);
    assert.equal(take({}, true), null);
    assert.equal(take({ title: 'Hunting Shadows (Assassin’s Creed)', release: 'The Gods We Can Touch' }, true), null);
  });

  it('leaves out each kind of thing that was on a list and should not have been', () => {
    // `Across the Universe`, off a radio session.
    assert.equal(take({ title: 'Across the Universe', release: 'Across the Universe (triple j Like A Version)' }), 'like a version');
    // `Cruel Summer`, played 25 times, off a tape of a festival.
    assert.equal(take({ title: 'Cruel Summer', release: '2022-06-10: Primavera Sound Festival, Barcelona, Spain' }), 'dated');
    // The Frozen dubs: the singer of each language is credited first.
    assert.equal(
      take({ title: 'Mucho más allá', artist: 'Carmen Sarahí & AURORA', release: 'Frozen II (deluxe edition)', artists: [{ mbid: 'other', name: 'Carmen Sarahí' }, { mbid: ME, name: 'AURORA' }] }),
      'guest'
    );
    assert.equal(take({ title: 'Kiss It Better (Kaytranada edition)' }), 'version');
    assert.equal(take({ title: 'Ribs (Let’s Have a Sleepover version)' }), 'version');
    // `Passionate`, off `The Profile`: somebody being interviewed.
    assert.equal(take({ title: 'Passionate', release: 'The Profile', tags: ['interview', 'pop'] }), 'talk');
    // A recording with no record at all.
    assert.equal(take({ title: 'Believer', release: null }), 'no record');
    assert.equal(take({ title: 'Oooh Baby', release: 'Demo & Unreleased' }), 'demo');
    assert.equal(take({ title: 'Damage, Inc. (1985, from James’ Riff Tapes)', release: 'Master of Puppets' }, false), 'issue');
    // A clean title on a clean-looking record that MusicBrainz knows for a bootleg.
    assert.equal(take({ title: 'Changing Skies', release: 'Mother Monster' }, false), 'issue');
    assert.equal(take({ title: 'The Love (interlude)' }), 'interlude');
    assert.equal(take({ title: 'Intro' }), 'intro');
    assert.equal(take({ durationSec: 30 }), 'length');
  });

  it('goes by the name rules alone where MusicBrainz could not be asked', () => {
    assert.equal(take({ title: 'Changing Skies', release: 'Mother Monster' }), null);
  });
});

describe('an artist’s songs from ListenBrainz', () => {
  const details = readDetails(built.details);
  const issued = readIssued({ recordings: built.issued });
  const mbid = built.IDS.AURORA!;
  const rows = (built.radio[mbid] as Record<string, { recording_mbid: string; total_listen_count: number }[]>)[mbid]!.map((row) => ({
    mbid: row.recording_mbid, listens: row.total_listen_count,
  }));
  const offers = (familiar: boolean, owned = none) =>
    listenedOffers(rows, details, issued, { mbid, name: 'AURORA' }, owned, familiar, 'any', () => 'cover');

  it('puts them in order of how much they are played and offers them under their recording ids', () => {
    const made = offers(true);
    assert.ok(made.length >= 5);
    assert.ok(made.every((offer, index) => index === 0 || offer.listens! <= made[index - 1]!.listens!));
    assert.ok(made.every((offer) => /^[0-9a-f-]{36}$/.test(offer.id) && !isShopSong(offer.id) && offer.cover === 'cover'));
    assert.deepEqual(made.map((offer) => offer.place), made.map((_, index) => index));
  });

  it('offers nothing a recording that is hardly played beside the artist’s most played, to somebody new to them', () => {
    const most = Math.max(...rows.map((row) => row.listens));
    const lint = [...rows, { mbid: rows[0]!.mbid.replace(/^.{8}/, '00000000'), listens: 21 }];
    const known = new Map(details).set(lint.at(-1)!.mbid, { ...details.get(rows[0]!.mbid)!, mbid: lint.at(-1)!.mbid, title: 'Hardly Played' });
    const made = listenedOffers(lint, known, issued, { mbid, name: 'AURORA' }, none, false, 'any', () => null);
    assert.ok(!made.some((offer) => offer.title === 'Hardly Played'));
    assert.ok(made.every((offer) => offer.listens! >= most * 0.05));
  });

  it('leaves out what the library has', () => {
    const first = offers(true)[0]!;
    const without = offers(true, new Set([looseSongKey({ title: first.title, artist: 'AURORA' })]));
    assert.ok(!without.some((offer) => offer.title === first.title));
  });
});
