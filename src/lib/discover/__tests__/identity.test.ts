import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readArtists, readTracks, type DeezerArtist } from '../deezer.ts';
import {
  artistByRecordings,
  artistBySongs,
  evidence,
  identify,
  identityKey,
  loneNamesake,
  namesakes,
  namesakesPath,
  recordingsPath,
  telling,
  titlesByArtist,
  type IdentityStore,
} from '../identity.ts';
import { selectSongs } from '../policy.ts';
import { buildFaultOf, gatherPool, type BuildReport, type PoolInput, type Sources } from '../pool.ts';
import { readFacts, readPopularity } from '../listenbrainz.ts';
import type { Seed } from '../taste.ts';
import * as built from './built.ts';
import * as named from './named.ts';

/** Songs the Turkish band has, as somebody's files might be titled; the first three are on Deezer's list for them. */
const TURKISH_SONGS = ['Kin Tutar', 'Kül Olana Kadar (Remastered 2011)', 'Second - Aklımda Bi Kördüğüm (Official Video)'];
const SPANISH_SONGS = ['Rincón Exquisito', 'Nivel Inexperto', 'Más Suerte'];

/** A table of names and ids, as the phone keeps one. */
function table(rows: Record<string, string | null> = {}) {
  const kept = new Map(Object.entries(rows));
  const store: IdentityStore = {
    get: (how, name) => kept.get(identityKey(how, name)),
    put: (how, name, id) => void kept.set(identityKey(how, name), id),
  };
  return { kept, store };
}

/** MusicBrainz as it answered about Second, and a count of what was asked. */
function musicBrainz(recordings: unknown = named.noRecordings, artists: unknown = named.artists) {
  const asked: string[] = [];
  const ask = async (path: string) => {
    asked.push(decodeURIComponent(path));
    return path.startsWith('/recording/') ? recordings : artists;
  };
  return { ask, asked };
}

/** What MusicBrainz would answer if it had the Turkish band's recordings: its own shape, made by hand, since it has none. */
const TURKISH_RECORDINGS = {
  recordings: [
    { id: 'r1', score: 100, title: 'Kin Tutar', 'artist-credit': [{ name: 'Second', artist: { id: named.TURKISH, name: 'Second', disambiguation: 'Turkish pop-punk band' } }] },
    { id: 'r2', score: 90, title: 'Kül Olana Kadar', 'artist-credit': [{ name: 'Second', artist: { id: named.TURKISH, name: 'Second' } }] },
  ],
};

describe('which titles are evidence of whose a song is', () => {
  it('reads a title the way the library’s tracks are matched: the note about the upload is not the title', () => {
    assert.equal(telling('Kül Olana Kadar (Remastered 2011)'), telling('Kül Olana Kadar'));
    assert.equal(telling('Second - Kin Tutar (Official Video)', 'Second'), telling('Kin Tutar'));
    assert.equal(telling('Numb (feat. Jay-Z)'), telling('Numb'));
    // A concert is still a song of theirs.
    assert.ok(telling('Kin Tutar (Live)'));
  });

  it('makes nothing of a title anybody might have', () => {
    for (const title of ['Hey', 'Intro', 'Outro', 'Interlude', 'Untitled', 'Home', 'Love', 'X', '2502'.slice(0, 3), '']) {
      assert.equal(telling(title), null, title);
    }
    assert.ok(telling('2502'));
    assert.ok(telling('Hey Ya'));
  });

  it('takes two characters for enough where a character is a word', () => {
    assert.ok(telling('残響'));
    assert.equal(telling('夜'), null);
  });

  it('keeps the telling ones, each once, most played first, and only so many', () => {
    const kept = evidence(['Hey', 'Kin Tutar', 'Kin Tutar (Remastered)', 'Intro', 'A Song', 'B Song', 'C Song', 'D Song'], 'Second');
    assert.deepEqual(kept.map((entry) => entry.title), ['Kin Tutar', 'A Song', 'B Song', 'C Song']);
    assert.deepEqual(evidence(['Hey', 'Intro'], 'Second'), []);
  });
});

describe('what somebody has under each name', () => {
  const library = [
    { id: 'a', title: 'Seldom Played', artist: 'Second' },
    { id: 'b', title: 'Most Played', artist: 'Second' },
    { id: 'c', title: 'A Guest Spot', artist: 'Somebody feat. Second' },
    { id: 'd', title: 'Runaway', artist: 'AURORA' },
  ];

  it('puts the most played first, their own songs before a guest spot, and a kept song last', () => {
    const titles = titlesByArtist(library, new Map([['b', 900], ['a', 10], ['c', 5000]]), [{ title: 'Kept From Discover', artist: 'Second' }]);
    assert.deepEqual(titles.get('second'), ['Most Played', 'Seldom Played', 'Kept From Discover', 'A Guest Spot']);
    assert.deepEqual(titles.get('aurora'), ['Runaway']);
    assert.deepEqual(titles.get('somebody'), ['A Guest Spot']);
  });

  it('knows an artist only a kept song is by', () => {
    assert.deepEqual(titlesByArtist([], new Map(), [{ title: 'Volver', artist: 'Shinova' }]).get('shinova'), ['Volver']);
  });
});

describe('telling artists of one name apart on MusicBrainz', () => {
  it('asks for the artist and the songs together, in one question', () => {
    const path = decodeURIComponent(recordingsPath('Second', evidence(SPANISH_SONGS, 'Second'))!);
    assert.equal(path, '/recording/?query=recording:("Rincón Exquisito" OR "Nivel Inexperto" OR "Más Suerte") AND artist:"Second"&fmt=json&limit=25');
    assert.equal(recordingsPath('Second', []), null);
    // What would break the question is taken out of it.
    assert.ok(!decodeURIComponent(recordingsPath('AC/DC', [{ title: 'T.N.T. (Live) "x"' }])!).includes('/DC'));
    assert.ok(decodeURIComponent(namesakesPath('Second')!).includes('artist:"Second"&fmt=json&limit=50'));
  });

  it('takes the artist of that name who is credited on somebody’s songs', () => {
    assert.equal(artistByRecordings(named.recordings, 'Second', evidence(SPANISH_SONGS, 'Second')), named.SPANISH);
    // The same answer is no evidence for somebody whose songs are not in it.
    assert.equal(artistByRecordings(named.recordings, 'Second', evidence(TURKISH_SONGS, 'Second')), null);
    assert.equal(artistByRecordings(named.noRecordings, 'Second', evidence(TURKISH_SONGS, 'Second')), null);
    assert.equal(artistByRecordings(TURKISH_RECORDINGS, 'Second', evidence(TURKISH_SONGS, 'Second')), named.TURKISH);
  });

  it('does not take an artist of another name, whatever the song is called', () => {
    const other = { recordings: [{ title: 'Kin Tutar', 'artist-credit': [{ name: 'Second Sun', artist: { id: 'x', name: 'Second Sun' } }] }] };
    assert.equal(artistByRecordings(other, 'Second', evidence(TURKISH_SONGS, 'Second')), null);
  });

  it('goes by who has most of the songs, and makes nothing of a tie', () => {
    const credit = (id: string) => [{ name: 'Second', artist: { id, name: 'Second' } }];
    const both = {
      recordings: [
        { title: 'Kin Tutar', 'artist-credit': credit('one') },
        { title: 'Kül Olana Kadar', 'artist-credit': credit('one') },
        { title: 'Kin Tutar', 'artist-credit': credit('two') },
      ],
    };
    assert.equal(artistByRecordings(both, 'Second', evidence(TURKISH_SONGS, 'Second')), 'one');
    assert.equal(artistByRecordings({ recordings: both.recordings.slice(1) }, 'Second', evidence(TURKISH_SONGS, 'Second')), null);
  });

  it('believes a name alone only where one artist has it', () => {
    // Seven artists are called Second.
    assert.equal(loneNamesake(named.artists, 'Second'), null);
    assert.equal(loneNamesake(named.loneArtists, 'Agnes Obel'), 'e3c4c4af-f83b-4168-84cb-898009dd0447');
    assert.equal(loneNamesake(named.loneArtists, 'agnes obel'), 'e3c4c4af-f83b-4168-84cb-898009dd0447');
    assert.equal(loneNamesake(named.artists, 'Nobody Of This Name'), null);
    assert.equal(loneNamesake(null, 'Second'), null);
  });
});

describe('settling a name', () => {
  it('settles it by somebody’s songs, in one request, and keeps that', async () => {
    const { store, kept } = table();
    const { ask, asked } = musicBrainz(named.recordings);
    const session = new Map<string, string | null>();
    assert.deepEqual(await identify('Second', SPANISH_SONGS, ask, store, session), { id: named.SPANISH, by: 'songs' });
    assert.equal(asked.length, 1);
    assert.equal(kept.get(identityKey('songs', 'Second')), named.SPANISH);
    // Asked again — in this run of the app or the next — it asks nobody.
    assert.deepEqual(await identify('Second', [], ask, store, new Map()), { id: named.SPANISH, by: 'songs' });
    assert.equal(asked.length, 1);
  });

  it('is nobody where the songs are not in the catalogue and several artists have the name: two requests, and no guess', async () => {
    const { store } = table();
    const { ask, asked } = musicBrainz();
    const session = new Map<string, string | null>();
    assert.deepEqual(await identify('Second', TURKISH_SONGS, ask, store, session), { id: null, by: null });
    assert.equal(asked.length, 2);
    assert.ok(asked[0]!.startsWith('/recording/') && asked[1]!.startsWith('/artist/'));
    // Not asked again while the app stays open.
    assert.deepEqual(await identify('Second', TURKISH_SONGS, ask, store, session), { id: null, by: null });
    assert.equal(asked.length, 2);
    // Asked again the next time it is opened: the catalogue may have gained the band by then.
    await identify('Second', TURKISH_SONGS, ask, store, new Map());
    assert.equal(asked.length, 4);
  });

  it('settles it by the songs when the catalogue has them', async () => {
    const { ask } = musicBrainz(TURKISH_RECORDINGS);
    assert.deepEqual(await identify('Second', TURKISH_SONGS, ask, table().store, new Map()), { id: named.TURKISH, by: 'songs' });
  });

  it('falls back on a name only one artist has', async () => {
    const { store } = table();
    const { ask, asked } = musicBrainz({ recordings: [] }, named.loneArtists);
    const found = await identify('Agnes Obel', ['A Song Not In The Catalogue'], ask, store, new Map());
    assert.deepEqual(found, { id: 'e3c4c4af-f83b-4168-84cb-898009dd0447', by: 'name' });
    assert.equal(asked.length, 2);
    // With no titles at all there is one question, and it is the second.
    const bare = musicBrainz(undefined, named.loneArtists);
    await identify('Agnes Obel', [], bare.ask, table().store, new Map());
    assert.deepEqual(bare.asked.map((path) => path.split('?')[0]), ['/artist/']);
  });

  it('is not fooled by a title anybody might have', async () => {
    // The Spanish band is in the answer and `Hey` is asked about: it is not evidence, and is not even sent.
    const { ask, asked } = musicBrainz(named.recordings);
    assert.deepEqual(await identify('Second', ['Hey', 'Intro'], ask, table().store, new Map()), { id: null, by: null });
    assert.deepEqual(asked.map((path) => path.split('?')[0]), ['/artist/']);
  });

  it('does not read what was remembered before names were settled by songs, and asks once more', async () => {
    // What the phone holds from before: the bare name, and the Spanish band's id against it.
    const { store, kept } = table({ Second: named.SPANISH });
    const { ask, asked } = musicBrainz();
    const session = new Map<string, string | null>();
    assert.deepEqual(await identify('Second', TURKISH_SONGS, ask, store, session), { id: null, by: null });
    assert.equal(asked.length, 2);
    // The old row is left as it was, and is nobody's answer any more.
    assert.equal(kept.get('Second'), named.SPANISH);
    assert.notEqual(identityKey('songs', 'Second'), 'Second');
    assert.notEqual(identityKey('name', 'Second'), identityKey('songs', 'Second'));
  });

  it('asks by the songs again when somebody has other songs, and when a name was only ever settled by being alone', async () => {
    const { store } = table();
    const { ask, asked } = musicBrainz({ recordings: [] }, named.loneArtists);
    const session = new Map<string, string | null>();
    await identify('Agnes Obel', ['First Song'], ask, store, session);
    assert.equal(asked.length, 2);
    // The same songs: the name's answer stands, and nothing is asked.
    assert.equal((await identify('Agnes Obel', ['First Song'], ask, store, session)).by, 'name');
    assert.equal(asked.length, 2);
    // Another song: the songs are asked about, and the name is not asked about twice.
    await identify('Agnes Obel', ['First Song', 'Second Song'], ask, store, session);
    assert.equal(asked.length, 3);
    assert.ok(asked[2]!.startsWith('/recording/'));
  });
});

describe('telling artists of one name apart on Deezer', () => {
  const found = readArtists(named.find);
  const looked = (ids: number[]) =>
    ids.map((id) => ({ artist: found.find((artist) => artist.id === id)!, tracks: readTracks(named.top[String(id)]) }));

  it('finds the artists of exactly the name, and not the ones whose names contain it', () => {
    assert.deepEqual(namesakes(found, 'Second').map((artist) => artist.id), [named.SPANISH_SHOP, named.TURKISH_SHOP]);
    assert.deepEqual(namesakes(found, 'second sun').map((artist) => artist.name), ['Second Sun']);
    assert.deepEqual(namesakes(found, 'Nobody'), []);
  });

  it('takes the one whose most played include somebody’s songs, however few follow them', () => {
    const both = looked([named.SPANISH_SHOP, named.TURKISH_SHOP]);
    assert.equal(artistBySongs(both, evidence(TURKISH_SONGS, 'Second'))!.id, named.TURKISH_SHOP);
    assert.equal(artistBySongs(both, evidence(SPANISH_SONGS, 'Second'))!.id, named.SPANISH_SHOP);
  });

  it('takes neither where neither has them, or where each has one', () => {
    const both = looked([named.SPANISH_SHOP, named.TURKISH_SHOP]);
    assert.equal(artistBySongs(both, evidence(['A Song Neither Has'], 'Second')), null);
    assert.equal(artistBySongs(both, evidence(['Kin Tutar', 'Nivel Inexperto'], 'Second')), null);
    assert.equal(artistBySongs(both, []), null);
  });
});

/* ------------------------------------------------------------------------ */
/* The whole of it: a build for somebody who listens to the Turkish band.   */
/* ------------------------------------------------------------------------ */

const facts = readFacts(built.facts);
const users = readPopularity(built.popularity);
type Rows = { artist_mbid: string; name: string; score: number }[];

/** Ten songs for an artist the answers have no list for, so that a neighbour can be seen to have been asked about. */
const invented = (artist: DeezerArtist) =>
  Array.from({ length: 10 }, (_, index) => ({
    id: artist.id * 100 + index, title: `${artist.name} song ${index + 1}`, short: `${artist.name} song ${index + 1}`, version: '',
    durationSec: 200, rank: 1000 - index, artistId: artist.id, artistName: artist.name, album: 'A Record', cover: null,
  }));

function services(recordings: unknown = named.noRecordings) {
  const mb = musicBrainz(recordings);
  const { store } = table();
  const session = new Map<string, string | null>();
  const asked = { related: [] as number[], top: [] as number[], similar: [] as string[], find: 0, radio: 0, tagged: 0 };
  const everyone = [...readArtists(named.related[String(named.SPANISH_SHOP)]), ...readArtists(named.related[String(named.TURKISH_SHOP)])];
  const sources: Sources = {
    resolve: async (name, titles) =>
      name === 'Second' ? (await identify(name, titles, mb.ask, store, session)).id : (built.IDS[name] ?? null),
    similar: async (mbid) => {
      asked.similar.push(mbid);
      return ((built.similar[mbid] ?? []) as Rows).map((row) => ({ mbid: row.artist_mbid, name: row.name, score: row.score }));
    },
    popularity: async (mbids) => new Map(mbids.flatMap((mbid) => (users.has(mbid) ? [[mbid, users.get(mbid)!] as const] : []))),
    facts: async (mbids) => new Map(mbids.flatMap((mbid) => (facts.has(mbid) ? [[mbid, facts.get(mbid)!] as const] : []))),
    find: async (name) => {
      asked.find++;
      return name === 'Second' ? readArtists(named.find) : readArtists(built.find[name]);
    },
    related: async (id) => {
      asked.related.push(id);
      return readArtists(named.related[String(id)] ?? built.related[String(id)]);
    },
    top: async (id, limit) => {
      asked.top.push(id);
      const real = readTracks(named.top[String(id)] ?? built.top[String(id)]);
      const neighbour = everyone.find((artist) => artist.id === id);
      return (real.length ? real : neighbour ? invented(neighbour) : []).slice(0, limit);
    },
    radio: async () => {
      asked.radio++;
      return [];
    },
    details: async () => new Map(),
    issued: async () => new Map(),
    tagged: async () => {
      asked.tagged++;
      return [];
    },
  };
  return { sources, asked, mb };
}

const seed = (name: string, weight: number, titles?: string[]): Seed => ({ name, weight, source: 'recent', titles });
const build = (seeds: Seed[], over: Partial<PoolInput> = {}): PoolInput => ({
  seeds,
  searches: [],
  weights: new Map(),
  owned: new Set(['second', 'aurora']),
  ownedSongs: new Set(),
  standings: new Map(),
  popularity: 'any',
  edition: 'second',
  count: 10,
  ...over,
});
const turkish = new Set(readTracks(named.top[String(named.TURKISH_SHOP)]).map((track) => track.short));
const spanish = new Set(readTracks(named.top[String(named.SPANISH_SHOP)]).map((track) => track.short));
const SPANISH_NEIGHBOURS = readArtists(named.related[String(named.SPANISH_SHOP)]).map((artist) => artist.name);
const TURKISH_NEIGHBOURS = readArtists(named.related[String(named.TURKISH_SHOP)]).map((artist) => artist.name);

describe('a build for somebody who listens to a band that shares its name', () => {
  it('offers the band’s own songs and its own neighbours, where their songs say which band it is', async () => {
    let report: BuildReport | undefined;
    const { sources, asked, mb } = services();
    const pool = await gatherPool(build([seed('Second', 1, TURKISH_SONGS)]), sources, { onReport: (made) => (report = made) });

    const more = pool.filter((song) => song.artist === 'Second');
    assert.ok(more.length >= 5);
    for (const song of more) {
      assert.ok(turkish.has(song.title) && !spanish.has(song.title), song.title);
      assert.equal(song.why.kind, 'yours');
    }
    const near = [...new Set(pool.filter((song) => !song.familiar).map((song) => song.artist))];
    assert.ok(near.length >= 3);
    assert.ok(near.every((name) => TURKISH_NEIGHBOURS.includes(name)), near.join());
    assert.ok(!pool.some((song) => SPANISH_NEIGHBOURS.includes(song.artist)));
    // The Spanish band's songs were looked at, to tell the two apart, and nothing else of theirs was asked for.
    assert.deepEqual(asked.related, [named.TURKISH_SHOP]);
    assert.deepEqual(asked.similar, []);
    assert.deepEqual(report!.unresolved, []);
    // What it cost to tell them apart: two questions of MusicBrainz, one search and the two bands' songs on Deezer.
    assert.equal(mb.asked.length, 2);
    assert.equal(asked.find, 1);
    assert.equal(asked.top.filter((id) => id === named.SPANISH_SHOP).length, 1);
  });

  it('offers nothing of either band’s where nothing says which is meant, and does not go looking by tags', async () => {
    for (const titles of [undefined, [], ['Hey', 'Intro'], ['A Song Neither Has']]) {
      let report: BuildReport | undefined;
      const { sources, asked } = services();
      const failed = await gatherPool(build([seed('Second', 1, titles)], { searches: [] }), sources, {
        onReport: (made) => (report = made),
      }).catch((error: unknown) => error);
      assert.equal(buildFaultOf(failed), 'nothing', `${String(titles)}: ${Array.isArray(failed) ? (failed as { artist: string; title: string; because: string }[]).slice(0, 4).map((song) => `${song.artist} – ${song.title} (${song.because})`).join('; ') : String(failed)}`);
      assert.deepEqual(report!.unresolved, ['Second']);
      assert.deepEqual(asked.related, []);
      assert.equal(asked.radio + asked.tagged, 0);
      // The two bands' songs are only ever asked for to compare them with somebody's, and not kept.
      assert.ok(asked.top.length <= 2);
    }
  });

  it('gives an untold artist’s places to the artists that could be told', async () => {
    let report: BuildReport | undefined;
    const { sources, asked } = services();
    const pool = await gatherPool(build([seed('Second', 1), seed('AURORA', 0.8, ['Runaway'])]), sources, {
      onReport: (made) => (report = made),
    });
    assert.deepEqual(report!.unresolved, ['Second']);
    const strangers = pool.filter((song) => song.artist === 'Second' || song.because.includes('Second'));
    assert.deepEqual(strangers.map((song) => `${song.artist} – ${song.title} (${song.because})`), []);
    assert.ok(!pool.some((song) => [...SPANISH_NEIGHBOURS, ...TURKISH_NEIGHBOURS].includes(song.artist)));
    assert.ok(!asked.related.includes(named.SPANISH_SHOP) && !asked.related.includes(named.TURKISH_SHOP));
    const list = selectSongs(pool, [], 10, new Set());
    assert.equal(list.length, 10);
    assert.ok(list.every((song) => song.because.split(' · ')[0] === 'AURORA'));
  });

  it('settles the same name the other way for somebody who has the other band’s songs', async () => {
    const { sources, asked, mb } = services(named.recordings);
    const pool = await gatherPool(build([seed('Second', 1, SPANISH_SONGS)]), sources);
    // MusicBrainz knew them by their songs, in one request; it has no Deezer link for them, so Deezer was told apart the same way.
    assert.equal(mb.asked.length, 1);
    assert.deepEqual(asked.similar, [named.SPANISH]);
    assert.deepEqual(asked.related, [named.SPANISH_SHOP]);
    assert.ok(pool.filter((song) => song.artist === 'Second').every((song) => spanish.has(song.title)));
    assert.ok(!pool.some((song) => TURKISH_NEIGHBOURS.includes(song.artist)));
  });

  it('uses MusicBrainz’s id for the band when it has their songs, and still tells Deezer’s two apart by them', async () => {
    const { sources, asked } = services(TURKISH_RECORDINGS);
    const pool = await gatherPool(build([seed('Second', 1, TURKISH_SONGS)]), sources);
    assert.deepEqual(asked.similar, [named.TURKISH]);
    assert.deepEqual(asked.related, [named.TURKISH_SHOP]);
    assert.ok(pool.filter((song) => song.artist === 'Second').every((song) => turkish.has(song.title)));
    assert.ok(pool.every((song) => song.artist !== 'Second' || song.artistMbid === named.TURKISH));
  });
});
