import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { abortError, httpError, networkError } from '../../metadata/http.ts';
import { foldForMatch } from '../../metadata/text.ts';
import { readArtists, readTracks, type DeezerArtist } from '../deezer.ts';
import {
  readDetails,
  readFacts,
  readPopularity,
  readRadio,
  readTagRadio,
} from '../listenbrainz.ts';
import { selectSongs } from '../policy.ts';
import {
  buildFaultOf,
  closing,
  gatherPool,
  memoryCache,
  remembering,
  sameArtist,
  type BuildReport,
  type Gathered,
  type PoolInput,
  type Sources,
  type Step,
} from '../pool.ts';
import { isShopSong, readIssued } from '../songs.ts';
import { standings, type Seed } from '../taste.ts';
import { looseSongKey } from '../variants.ts';
import * as old from './answers.ts';
import * as built from './built.ts';

type Rows = { artist_mbid: string; name: string; score: number }[];
const similarTo = (mbid: string) =>
  ((built.similar[mbid] ?? []) as Rows).map((row) => ({ mbid: row.artist_mbid, name: row.name, score: row.score }));
const users = readPopularity(built.popularity);
const facts = readFacts(built.facts);
const named = readDetails(built.details);
const issued = readIssued({ recordings: built.issued });

/** AURORA is found on Deezer through MusicBrainz's link, so no search for her was ever made. This is what one answers. */
const AURORA_FOUND = { data: [{ id: 7699874, name: 'AURORA', nb_fan: 560226 }] };

type Asked = Record<keyof Sources, number> & { tops: number[]; radios: string[] };

/** The three services, as they answered on the day, and a count of what was asked. */
function recorded(over: Partial<Sources> = {}) {
  const asked: Asked = {
    resolve: 0, similar: 0, popularity: 0, facts: 0, find: 0, related: 0, top: 0, radio: 0, details: 0, issued: 0,
    tagged: 0, tops: [], radios: [],
  };
  const real: Sources = {
    resolve: async (name) => built.IDS[name] ?? null,
    similar: async (mbid) => similarTo(mbid),
    popularity: async (mbids) => new Map(mbids.flatMap((mbid) => (users.has(mbid) ? [[mbid, users.get(mbid)!] as const] : []))),
    facts: async (mbids) => new Map(mbids.flatMap((mbid) => (facts.has(mbid) ? [[mbid, facts.get(mbid)!] as const] : []))),
    find: async (name) => readArtists(built.find[name] ?? (name === 'AURORA' ? AURORA_FOUND : null)),
    related: async (id) => readArtists(built.related[String(id)]),
    top: async (id, limit) => readTracks(built.top[String(id)]).slice(0, limit),
    radio: async (mbid) => readRadio(built.radio[mbid]),
    details: async (mbids) => new Map(mbids.flatMap((mbid) => (named.has(mbid) ? [[mbid, named.get(mbid)!] as const] : []))),
    issued: async (mbids) => new Map(mbids.flatMap((mbid) => (issued.has(mbid) ? [[mbid, issued.get(mbid)!] as const] : []))),
    tagged: async () => [],
  };
  const sources = Object.fromEntries(
    (Object.keys(real) as (keyof Sources)[]).map((name) => [
      name,
      (...args: unknown[]) => {
        asked[name]++;
        if (name === 'top') asked.tops.push(args[0] as number);
        if (name === 'radio') asked.radios.push(args[0] as string);
        return ((over[name] ?? real[name]) as (...all: unknown[]) => unknown)(...args);
      },
    ])
  ) as Sources;
  return { sources, asked, real };
}

const seed = (name: string, weight: number): Seed => ({ name, weight, source: 'recent' });
const THREE = [seed('AURORA', 1), seed('Metallica', 0.69), seed('Eminem', 0.47)];
const TWO = [seed('AURORA', 1), seed('Metallica', 0.69)];
const HAS = [
  ...['Runaway', 'Cure For Me', 'The Seed', 'Running With The Wolves'].map((title) => looseSongKey({ title, artist: 'AURORA' })),
  ...['Enter Sandman', 'Nothing Else Matters'].map((title) => looseSongKey({ title, artist: 'Metallica' })),
];

const input = (over: Partial<PoolInput> = {}): PoolInput => ({
  seeds: THREE,
  searches: [],
  weights: new Map(),
  owned: new Set(['aurora', 'metallica', 'eminem']),
  ownedSongs: new Set(HAS),
  standings: new Map(),
  popularity: 'any',
  edition: 'fixture',
  count: 10,
  ...over,
});

const gone = () => Promise.reject(networkError('no route'));
const silent = () => Promise.reject(networkError('no answer', true));
const NO_SHOP: Partial<Sources> = { find: gone, related: gone, top: gone };
const NO_LISTENS: Partial<Sources> = {
  similar: () => Promise.reject(httpError('ListenBrainz', 503)),
  popularity: () => Promise.reject(httpError('ListenBrainz', 503)),
  facts: () => Promise.reject(httpError('ListenBrainz', 503)),
  radio: () => Promise.reject(httpError('ListenBrainz', 503)),
  details: () => Promise.reject(httpError('ListenBrainz', 503)),
};
const artistsOf = (pool: Gathered[], familiar: boolean) => [...new Set(pool.filter((song) => song.familiar === familiar).map((song) => song.artist))];
const ledBy = (pool: Gathered[], name: string) =>
  [...new Set(pool.filter((song) => !song.familiar && song.because.split(' · ')[0] === name).map((song) => song.artist))];

describe('gathering the songs a list is chosen from', () => {
  it('offers songs by the artists somebody plays and by artists near them, each under an id of its own', async () => {
    const pool = await gatherPool(input(), recorded().sources);
    assert.deepEqual(artistsOf(pool, true).sort(), ['AURORA', 'Eminem', 'Metallica']);
    assert.ok(artistsOf(pool, false).length >= 8, `${artistsOf(pool, false).length} new artists`);
    // Everything Deezer named is known by Deezer's number for it, in the one shape the phone's queue will take as a key.
    assert.ok(pool.every((song) => isShopSong(song.recordingMbid) && /^[a-fA-F0-9-]{36}$/.test(song.recordingMbid)));
    assert.equal(new Set(pool.map((song) => song.recordingMbid)).size, pool.length);
    // The sleeve and the length come with the song, since the id says nothing about either.
    assert.ok(pool.every((song) => song.coverUrl?.startsWith('https://cdn-images.dzcdn.net/')));
    assert.ok(pool.every((song) => (song.durationSec ?? 0) >= 75 && (song.durationSec ?? 0) <= 600));
  });

  it('leaves out what the library has, and the takes that are not the song', async () => {
    const pool = await gatherPool(input(), recorded().sources);
    const aurora = pool.filter((song) => song.artist === 'AURORA').map((song) => song.title);
    assert.ok(aurora.length > 0);
    for (const title of ['Runaway', 'Cure For Me', 'The Seed', 'Running With The Wolves']) assert.ok(!aurora.includes(title), title);
    // Third on Deezer's list for her on the day: `Let Me Heal You (Demo)`.
    assert.ok(readTracks(built.top['7699874']).some((track) => track.title === 'Let Me Heal You (Demo)'));
    assert.ok(!pool.some((song) => /demo|live|remix|acoustic/i.test(song.title)), 'a take got through');
    // And nothing filed under somebody else: a guest spot is not how an artist is met.
    assert.ok(!pool.some((song) => song.artist === 'AURORA' && /tomora|hoyo/i.test(song.title)));
  });

  it('says a song by an artist somebody plays is theirs, whoever else that artist is near', async () => {
    // What was wrong: Adele started from and also near AURORA, and Adele's songs said "More from AURORA".
    // Florence + the Machine is near AURORA by both witnesses; here she is started from as well, and weakly.
    const florence = similarTo(built.IDS.AURORA!).find((row) => /^Florence/.test(row.name))!;
    const { sources } = recorded({
      resolve: async (name) => (name === florence.name ? florence.mbid : (built.IDS[name] ?? null)),
      find: async (name) => (name === florence.name ? [{ id: 183716, name: 'Florence + The Machine', fans: 1_700_000 }] : readArtists(built.find[name])),
    });
    const pool = await gatherPool(
      input({ seeds: [seed('AURORA', 1), seed(florence.name, 0.3)], owned: new Set(['aurora', foldForMatch(florence.name)]) }),
      sources
    );
    const hers = pool.filter((song) => /^Florence/.test(song.artist));
    assert.ok(hers.length > 0);
    for (const song of hers) {
      assert.equal(song.why.kind, 'yours');
      assert.deepEqual(song.why.seeds, [florence.name]);
      assert.equal(song.because, florence.name);
      assert.equal(song.familiar, true);
    }
    for (const song of pool.filter((entry) => entry.why.kind === 'yours')) {
      assert.equal(foldForMatch(song.why.seeds[0]!), foldForMatch(song.artist), `${song.artist} said to be ${song.why.seeds[0]}`);
    }
  });

  it('says an artist somebody has, come upon by way of another, is theirs — and keeps how it was come upon', async () => {
    const pool = await gatherPool(input({ owned: new Set(['aurora', 'metallica', 'eminem', 'hozier']) }), recorded().sources);
    const his = pool.filter((song) => song.artist === 'Hozier');
    assert.ok(his.length > 0);
    for (const song of his) {
      assert.equal(song.familiar, true);
      assert.equal(song.why.kind, 'yours');
      assert.deepEqual(song.why.seeds, ['Hozier']);
      assert.deepEqual(song.why.via, ['AURORA']);
      assert.equal(song.why.fresh, false);
    }
  });

  it('names a second artist only where it pulled at least six tenths as hard as the first', async () => {
    const both: DeezerArtist = { id: 999, name: 'Near Both', fans: 1000 };
    const over: Partial<Sources> = {
      similar: async () => [],
      related: async () => [both],
      top: async (id, limit) => (id === 999 ? readTracks(built.top['5062414']).map((track) => ({ ...track, artistId: 999 })) : readTracks(built.top[String(id)]).slice(0, limit)),
    };
    const far = await gatherPool(input({ seeds: [seed('AURORA', 1), seed('Eminem', 0.47)] }), recorded(over).sources);
    const near = await gatherPool(input({ seeds: [seed('AURORA', 1), seed('Eminem', 0.7)] }), recorded(over).sources);
    assert.deepEqual(far.find((song) => song.artist === 'Near Both')!.why.seeds, ['AURORA']);
    assert.equal(far.find((song) => song.artist === 'Near Both')!.because, 'AURORA');
    assert.deepEqual(near.find((song) => song.artist === 'Near Both')!.why.seeds, ['AURORA', 'Eminem']);
    assert.equal(near.find((song) => song.artist === 'Near Both')!.because, 'AURORA · Eminem');
  });

  it('keeps who said an artist is near, and how near to the artist it names', async () => {
    const pool = await gatherPool(input(), recorded().sources);
    const fresh = pool.filter((song) => !song.familiar);
    const said = new Set(fresh.map((song) => song.why.witness));
    assert.ok(said.has('both') && said.has('deezer'), [...said].join());
    for (const song of fresh) {
      assert.equal(song.why.kind, 'near');
      assert.ok(song.why.similarity! > 0 && song.why.similarity! <= 1);
      assert.ok(song.share! > 0 && song.share! <= 1);
      assert.equal(song.why.fresh, true);
    }
    // An artist both name is nearer than either would have said alone could make it: past eight tenths.
    const agreed = fresh.filter((song) => song.why.witness === 'both');
    assert.ok(agreed.some((song) => song.why.similarity! > 0.8));
    assert.ok(fresh.filter((song) => song.why.witness !== 'both').every((song) => song.why.similarity! <= 0.8 + 1e-9));
    // And whoever is named is somebody that was started from.
    assert.ok(fresh.every((song) => song.why.seeds.every((name) => ['AURORA', 'Metallica', 'Eminem'].includes(name))));
  });

  it('gives the place of a neighbour with no song to offer to the next of the same artist’s', async () => {
    const whole = await gatherPool(input(), recorded().sources);
    const first = ledBy(whole, 'AURORA');
    // Every one of AURORA's neighbours that had songs the first time has none now.
    const gone = readArtists(built.related['7699874']).filter((artist) => first.includes(artist.name));
    const emptied = new Set(gone.map((artist) => artist.id));
    assert.ok(emptied.size >= 2);
    let report: BuildReport | undefined;
    const { sources, asked } = recorded({
      top: async (id, limit) => (emptied.has(id) ? [] : readTracks(built.top[String(id)]).slice(0, limit)),
    });
    const pool = await gatherPool(input(), sources, { onReport: (made) => (report = made) });
    const now = ledBy(pool, 'AURORA');
    assert.ok(now.length >= 1, 'nobody took the places');
    assert.ok(now.every((name) => !gone.some((artist) => artist.name === name)), now.join());
    assert.ok(asked.top > recorded().asked.top);
    assert.ok(report!.songs!.none >= emptied.size);
    // And the list is whole all the same.
    assert.equal(selectSongs(pool, [], 10, new Set()).length, 10);
  });

  it('does not introduce an artist by their recording of a song the library has by somebody else', async () => {
    // Motörhead's most played on Deezer includes their `Enter Sandman`, and Metallica's is in the library.
    const covered = (limit: number) => [
      { ...readTracks(built.top['663'])[0]!, id: 1, title: 'Enter Sandman', short: 'Enter Sandman' },
      ...readTracks(built.top['663']).slice(0, limit - 1),
    ];
    const { sources } = recorded({ top: async (id, limit) => (id === 663 ? covered(limit) : readTracks(built.top[String(id)]).slice(0, limit)) });
    const pool = await gatherPool(input(), sources);
    assert.ok(pool.some((song) => song.artist === "Guns N' Roses"));
    assert.ok(!pool.some((song) => !song.familiar && song.title === 'Enter Sandman'));
  });

  it('counts an artist for less after a song of theirs was sent away, and not at all after three', async () => {
    const before = await gatherPool(input(), recorded().sources);
    const name = before.find((song) => !song.familiar)!.artist;
    const once = standings([{ kind: 'excluded', artist: name, at: 1 }], 2);
    const after = await gatherPool(input({ standings: once }), recorded().sources);
    const scoreOf = (pool: Gathered[]) => Math.max(0, ...pool.filter((song) => song.artist === name).map((song) => song.score));
    if (scoreOf(after) > 0) assert.ok(scoreOf(after) < scoreOf(before));
    const thrice = standings(Array.from({ length: 3 }, () => ({ kind: 'excluded' as const, artist: name, at: 1 })), 2);
    const out = await gatherPool(input({ standings: thrice }), recorded().sources);
    assert.ok(!out.some((song) => song.artist === name));
  });

  it('leaves out an artist blocked by either catalogue’s id for them', async () => {
    const pool = await gatherPool(input(), recorded().sources);
    const known = pool.find((song) => !song.familiar && !song.artistMbid.startsWith('dz:'))!;
    const only = pool.find((song) => !song.familiar && song.artistMbid.startsWith('dz:artist:'))!;
    assert.ok(known && only, 'the pool has an artist of each kind');
    const without = await gatherPool(input({ blockedIds: new Set([known.artistMbid, only.artistMbid]) }), recorded().sources);
    assert.ok(!without.some((song) => song.artist === known.artist || song.artist === only.artist));
    // Somebody took their places.
    assert.ok(artistsOf(without, false).length >= artistsOf(pool, false).length - 1);
  });

  it('gathers the same pool for the same edition, and another for another', async () => {
    const ids = async (edition: string) => (await gatherPool(input({ edition }), recorded().sources)).map((song) => song.recordingMbid);
    assert.deepEqual(await ids('one'), await ids('one'));
    assert.notDeepEqual(await ids('one'), await ids('two'));
  });

  it('believes a search by name only where the name is the same name, and one of them plainly the artist', () => {
    const found = (rows: [number, string, number][]) => rows.map(([id, name, fans]) => ({ id, name, fans }));
    assert.equal(sameArtist(found([[1, 'Florence + The Machine', 5]]), 'Florence + the Machine')?.id, 1);
    assert.equal(sameArtist(found([[1, 'Aurora Olivas', 5]]), 'AURORA'), null);
    assert.equal(sameArtist(found([[1, 'Ado', 137582], [2, 'ADO', 40]]), 'Ado')?.id, 1);
    // Two of one name and nothing to choose between them.
    assert.equal(sameArtist(found([[1, 'Nova', 900], [2, 'Nova', 700]]), 'Nova'), null);
    assert.equal(sameArtist([], 'Nobody'), null);
  });
});

describe('what a build costs', () => {
  it('is a request a seed for neighbours on each side, one for listeners, and one an artist for songs', async () => {
    let report: BuildReport | undefined;
    const { sources, asked } = recorded();
    await gatherPool(input(), sources, { onReport: (made) => (report = made) });
    assert.equal(asked.resolve, 3);
    assert.equal(asked.similar, 3);
    assert.equal(asked.related, 3);
    assert.equal(asked.popularity, 1);
    assert.equal(asked.facts, 2);
    // Metallica and Eminem have no Deezer link on MusicBrainz, and are searched for by name; nobody else needed it.
    assert.ok(asked.find >= 2 && asked.find <= 8, String(asked.find));
    // Three artists started from, eight neighbours wanted, and a few that had to be passed over.
    assert.ok(asked.top >= 11 && asked.top <= 20, String(asked.top));
    // Nothing is asked of the radio, and nothing has to be named, while Deezer answers.
    assert.equal(asked.radio + asked.details + asked.issued + asked.tagged, 0);
    assert.ok(report!.asked <= 40, String(report!.asked));
    assert.equal(new Set(asked.tops).size, asked.tops.length, 'an artist was asked about twice');
  });

  it('asks about two spellings of one artist once', async () => {
    const { sources, asked } = recorded({ resolve: async () => built.IDS.AURORA! });
    await gatherPool(input({ seeds: [seed('AURORA', 1), seed('Aurora', 0.9)] }), sources);
    assert.equal(asked.similar, 1);
    assert.equal(asked.related, 1);
  });

  it('says how far along it is: the artists started from, and then the artists whose songs are asked for', async () => {
    const steps: Step[] = [];
    let naming = 0;
    await gatherPool(input(), recorded().sources, { onStep: (step) => steps.push(step), onNaming: () => naming++ });
    const near = steps.filter((step) => step.phase === 'near');
    const songs = steps.filter((step) => step.phase === 'songs');
    assert.deepEqual(near.map((step) => step.done), [1, 2, 3]);
    assert.ok(near.every((step) => step.total === 3));
    assert.equal(naming, 1);
    assert.ok(songs.length >= 8);
    assert.deepEqual(songs.map((step) => step.done), songs.map((_, index) => index + 1));
    assert.ok(songs.every((step) => step.done <= step.total));
  });
});

describe('when one of the services is gone', () => {
  it('builds from ListenBrainz alone when Deezer cannot be reached, and checks what each recording was issued on', async () => {
    let report: BuildReport | undefined;
    const { sources, asked } = recorded(NO_SHOP);
    const pool = await gatherPool(input({ seeds: TWO }), sources, { onReport: (made) => (report = made) });
    assert.ok(pool.length >= 15, String(pool.length));
    assert.ok(pool.every((song) => /^[0-9a-f-]{36}$/.test(song.recordingMbid) && !isShopSong(song.recordingMbid)));
    assert.ok(pool.filter((song) => !song.familiar).every((song) => song.why.witness === 'listenbrainz'));
    assert.deepEqual(report!.heard, { listened: true, filed: false });
    assert.ok(asked.radio >= 6 && asked.details >= 1 && asked.issued >= 1);
    // Deezer was given up on after two of its requests running had failed.
    assert.ok(asked.find + asked.related + asked.top <= 4, `${asked.find} ${asked.related} ${asked.top}`);
    // Each of them asked about once, and with no neighbours wanted.
    assert.equal(new Set(asked.radios).size, asked.radios.length);
    // What MusicBrainz says is a bootleg or a concert is not offered, whatever its title looks like.
    for (const song of pool) assert.notEqual(issued.get(song.recordingMbid)?.studio, false, `${song.artist} – ${song.title}`);
    assert.equal(selectSongs(pool, [], 10, new Set()).length, 10);
  });

  it('builds from Deezer alone when ListenBrainz is down', async () => {
    let report: BuildReport | undefined;
    const pool = await gatherPool(input(), recorded(NO_LISTENS).sources, { onReport: (made) => (report = made) });
    assert.ok(pool.length >= 20);
    assert.ok(pool.filter((song) => !song.familiar).every((song) => song.why.witness === 'deezer'));
    assert.deepEqual(report!.heard, { listened: false, filed: true });
    assert.deepEqual(artistsOf(pool, true).sort(), ['AURORA', 'Eminem', 'Metallica']);
    assert.equal(selectSongs(pool, [], 10, new Set()).length, 10);
  });

  it('builds without MusicBrainz, from the names alone', async () => {
    const pool = await gatherPool(input(), recorded({ resolve: gone }).sources);
    assert.ok(pool.filter((song) => !song.familiar).length >= 8);
    assert.ok(pool.every((song) => song.artistMbid.startsWith('dz:artist:')));
  });

  it('goes on in the raw order when nobody can say how many people play whom', async () => {
    const pool = await gatherPool(input(), recorded({ popularity: () => Promise.reject(httpError('ListenBrainz', 500)) }).sources);
    assert.ok(pool.some((song) => song.why.witness === 'both'));
  });

  it('takes the radio wanting a login for a door that has closed, knocks once, and does not call it a failure', async () => {
    let report: BuildReport | undefined;
    const { sources, asked } = recorded({ ...NO_SHOP, radio: () => Promise.reject(httpError('ListenBrainz', 401)) });
    const failed = await gatherPool(input({ seeds: TWO }), sources, { onReport: (made) => (report = made) }).catch((error: unknown) => error);
    assert.equal(asked.radio, 1);
    // What failed was Deezer; the 401 is not among the failures.
    assert.equal(report!.failed, report!.offline);
    assert.equal(buildFaultOf(failed), 'offline');
  });

  it('does not knock again for as long as the app stays open', async () => {
    const door = { closed: false };
    const first = recorded({ radio: () => Promise.reject(httpError('ListenBrainz', 401)) });
    await closing(first.sources, door).radio('x', { begin: 0, end: 100 }, { artists: 0, recordings: 1 }).catch(() => undefined);
    assert.equal(door.closed, true);
    const second = recorded();
    const refused = await closing(second.sources, door).radio('x', { begin: 0, end: 100 }, { artists: 0, recordings: 1 }).catch((error: unknown) => error);
    assert.equal((refused as { status?: number }).status, 401);
    assert.equal(second.asked.radio, 0);
    // With Deezer answering, a closed radio costs a build nothing at all.
    const pool = await gatherPool(input(), closing(recorded().sources, door));
    assert.ok(pool.length >= 20);
  });

  it('asks ListenBrainz about the one artist Deezer has nothing for', async () => {
    // Deezer knows AURORA's neighbours and has no songs under her own id.
    const { sources, asked } = recorded({ top: async (id, limit) => (id === 7699874 ? [] : readTracks(built.top[String(id)]).slice(0, limit)) });
    const pool = await gatherPool(input(), sources);
    assert.deepEqual(asked.radios, [built.IDS.AURORA]);
    const hers = pool.filter((song) => song.artist === 'AURORA');
    assert.ok(hers.length > 0 && hers.every((song) => !isShopSong(song.recordingMbid)));
    assert.ok(hers.every((song) => song.why.kind === 'yours'));
  });
});

describe('when nothing can be gathered', () => {
  const ALL = (how: () => Promise<never>): Partial<Sources> => ({
    resolve: how, similar: how, popularity: how, facts: how, find: how, related: how, top: how, radio: how, details: how,
    issued: how, tagged: how,
  });
  const faultOf = async (over: Partial<Sources>, more: Partial<PoolInput> = {}) => {
    const { sources, asked } = recorded(over);
    const error = await gatherPool(input(more), sources).catch((caught: unknown) => caught);
    return { fault: buildFaultOf(error), asked, error };
  };

  it('says there is no network when nothing could be reached, and stops asking soon', async () => {
    const { fault, asked } = await faultOf(ALL(gone));
    assert.equal(fault, 'offline');
    const total = Object.values(asked).reduce<number>((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
    assert.ok(total <= 8, String(total));
  });

  it('tells services that did not answer from a phone that is offline', async () => {
    assert.equal((await faultOf(ALL(silent))).fault, 'unreachable');
    assert.equal((await faultOf(ALL(() => Promise.reject(httpError('X', 503))))).fault, 'unreachable');
  });

  it('says it was told to slow down when that is what it was told', async () => {
    assert.equal((await faultOf(ALL(() => Promise.reject(httpError('X', 429))))).fault, 'throttled');
  });

  it('says nothing was found when it asked, was answered, and has nothing', async () => {
    const none: Partial<Sources> = { similar: async () => [], related: async () => [], top: async () => [], radio: async () => [] };
    assert.equal((await faultOf(none)).fault, 'nothing');
  });

  it('stops when it is told to, and does not call that a failure', async () => {
    const stop = new AbortController();
    const { sources } = recorded({
      similar: async () => {
        stop.abort();
        throw abortError();
      },
    });
    const error = await gatherPool(input(), sources, { signal: stop.signal }).catch((caught: unknown) => caught);
    assert.equal((error as Error).name, 'AbortError');
    assert.equal(buildFaultOf(error), null);
  });
});

describe('finding songs by what they are tagged, when there is nobody to start from', () => {
  const tagOnly = (): Partial<Sources> => ({
    // The recordings the old answers have names for, as if a search by tags had come back with them.
    tagged: async () =>
      readTagRadio(Object.keys(old.details as object).map((mbid, index) => ({ recording_mbid: mbid, percent: 50 + index }))),
    details: async (mbids) => {
      const known = readDetails(old.details);
      return new Map(mbids.flatMap((mbid) => (known.has(mbid) ? [[mbid, known.get(mbid)!] as const] : [])));
    },
  });
  const search = { label: 'j-pop + rock', tags: ['j-pop', 'rock'], operator: 'and' as const };

  it('makes a pool from tags alone, and says so of each song', async () => {
    const { sources, asked } = recorded(tagOnly());
    const pool = await gatherPool(input({ seeds: [], searches: [search], owned: new Set() }), sources);
    assert.ok(pool.length > 0);
    assert.ok(pool.every((song) => song.why.kind === 'tags' && song.because === 'j-pop + rock' && song.share === undefined));
    assert.equal(asked.tagged, 1);
    assert.equal(asked.top + asked.similar, 0);
  });

  it('does not ask by tags while artists led somewhere', async () => {
    const { sources, asked } = recorded(tagOnly());
    await gatherPool(input({ searches: [search] }), sources);
    assert.equal(asked.tagged, 0);
  });
});

describe('keeping the services’ answers', () => {
  const kept = (over: Partial<Sources> = {}, clock = { at: 1_000 }) => {
    const made = recorded(over);
    return { ...made, clock, sources: remembering(made.sources, memoryCache(), () => clock.at) };
  };
  const DAY = 86_400_000;

  it('asks nothing the second time the same day, but the artists’ ids', async () => {
    const { sources, asked } = kept();
    const first = await gatherPool(input(), sources);
    const before = { ...asked };
    const second = await gatherPool(input(), sources);
    assert.deepEqual(second.map((song) => song.recordingMbid), first.map((song) => song.recordingMbid));
    for (const name of ['similar', 'popularity', 'facts', 'find', 'related', 'top'] as const) {
      assert.equal(asked[name], before[name], name);
    }
  });

  it('asks what an artist is most played for again the next day, and who is near whom not for a month', async () => {
    const { sources, asked, clock } = kept();
    await gatherPool(input(), sources);
    const before = { ...asked };
    clock.at += DAY + 1;
    await gatherPool(input(), sources);
    assert.ok(asked.top > before.top);
    assert.equal(asked.similar, before.similar);
    assert.equal(asked.related, before.related);
    assert.equal(asked.popularity, before.popularity);
    clock.at += 31 * DAY;
    await gatherPool(input(), sources);
    assert.ok(asked.similar > before.similar);
  });

  it('does not keep a failure', async () => {
    let fail = true;
    const { sources, asked } = kept({
      related: async (id) => {
        if (fail) throw httpError('Deezer', 500);
        return readArtists(built.related[String(id)]);
      },
    });
    await gatherPool(input(), sources).catch(() => undefined);
    const failed = asked.related;
    fail = false;
    await gatherPool(input(), sources);
    assert.ok(asked.related > failed);
  });

  it('asks only about the artists it has not been told of', async () => {
    const seen: string[][] = [];
    const cache = memoryCache();
    const sources = remembering(
      recorded({
        popularity: async (mbids) => {
          seen.push(mbids);
          return new Map(mbids.filter((mbid) => mbid !== 'nobody').map((mbid) => [mbid, 7]));
        },
      }).sources,
      cache,
      () => 1
    );
    assert.deepEqual([...(await sources.popularity(['a', 'nobody']))], [['a', 7]]);
    assert.deepEqual([...(await sources.popularity(['a', 'b', 'nobody']))], [['a', 7], ['b', 7]]);
    // Not `a`, which was answered, and not `nobody`, which was answered with nothing.
    assert.deepEqual(seen, [['a', 'nobody'], ['b']]);
  });

  it('forgets its oldest answers when it has too many', () => {
    const cache = memoryCache(2);
    cache.set('a', { at: 1, value: 1 });
    cache.set('b', { at: 1, value: 2 });
    cache.set('c', { at: 1, value: 3 });
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('c')!.value, 3);
  });
});
