import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pacer } from '../http.ts';
import type { ItunesMatch } from '../itunes.ts';
import type { MusicBrainzMatch } from '../musicbrainz.ts';
import { runEnrichment, type Catalogues, type EnrichProgress, type EnrichStore } from '../pipeline.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { Track } from '../../types.ts';
import { fakeClock, track, withoutWaiting } from './support.ts';

/**
 * The run as a whole: what it asks, of whom, how often and in what order.
 *
 * Nothing here touches the network or a clock. The catalogues are stand-ins
 * that write down what they were asked, and the store is a `Map`.
 */

const row = (trackId: string, changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'matched', source: 'musicbrainz', title: null, artist: null,
  album: null, genre: 'rock', year: null, artworkUrl: null, trackNumber: null,
  discNumber: null, ...changes,
});

/** A library and its table, kept in memory, with covers fetched to made-up files. */
function memory(library: Track[], known: TrackMetadata[] = []) {
  const rows = new Map(known.map((entry) => [entry.trackId, entry]));
  const fetched: string[] = [];
  const store: EnrichStore = {
    filterUnenriched: (ids) => ids.filter((id) => !rows.has(id)),
    manualTrackIds: () =>
      new Set([...rows.values()].filter((entry) => entry.status === 'manual').map((entry) => entry.trackId)),
    saveMetadata: (entry) => void rows.set(entry.trackId, entry),
    saveLookupTags: () => {},
    covers: {
      readAllMetadata: () => new Map(rows),
      library: () => library,
      download: async (url) => {
        fetched.push(url);
        return `file:///covers/${url.slice(url.lastIndexOf('/') + 1)}`;
      },
      // The rule the real table applies: a cover is only ever put where there
      // is none of the app's own.
      fillCovers: (fills) => {
        const filled: string[] = [];
        for (const { trackIds, uri, album } of fills) {
          for (const id of trackIds) {
            const held = rows.get(id);
            if (!held || held.artworkUrl?.startsWith('file://')) continue;
            rows.set(id, {
              ...held,
              artworkUrl: uri,
              album: held.status === 'manual' ? held.album : (held.album ?? album),
            });
            filled.push(id);
          }
        }
        return filled;
      },
      markCoverSearched: (ids) => {
        for (const id of ids) {
          const held = rows.get(id);
          if (held) rows.set(id, { ...held, coverSearchedAt: 1 });
        }
      },
    },
  };
  const coverOf = (id: string) => rows.get(id)?.artworkUrl ?? null;
  return { store, rows, fetched, coverOf };
}

const found = (song: Track, changes: Partial<MusicBrainzMatch> = {}): MusicBrainzMatch => ({
  title: song.title, artist: song.artist ?? 'Someone', genres: ['rock'], year: 2001,
  oneArtist: null, release: null, ...changes,
});

const sold = (song: Track, album: string, picture: string): ItunesMatch => ({
  title: song.title, artist: song.artist ?? 'Someone', album, genre: 'Rock', year: 2001,
  artworkUrl: `https://is1-ssl.mzstatic.com/${picture}`, trackNumber: null,
  discNumber: null, score: 1, storefront: 'TR',
});

/** Catalogues that answer from the two functions given and note who was asked about. */
function asking(
  musicbrainz: (song: Track) => MusicBrainzMatch | null,
  itunes: (song: Track) => ItunesMatch | null
) {
  const asked = { musicbrainz: [] as string[], itunes: [] as string[] };
  const catalogues: Catalogues = {
    musicbrainz: async (song) => {
      asked.musicbrainz.push(song.id);
      return musicbrainz(song);
    },
    itunes: async (song) => {
      asked.itunes.push(song.id);
      return itunes(song);
    },
  };
  return { asked, catalogues };
}

const album = (name: string, count: number, from = 1): Track[] =>
  Array.from({ length: count }, (_unused, index) =>
    track({ id: `${name}-${from + index}`, title: `Song ${from + index}`, artist: 'Someone', album: name })
  );

const quietly = () => {};

describe('a run over the library', () => {
  it('searches for a record’s cover once, however many tracks it has', async () => {
    const ruins = album('Ruins', 12);
    const db = memory(ruins);
    const { asked, catalogues } = asking(found, (song) => sold(song, 'Ruins', 'ruins.jpg'));

    const result = await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.equal(asked.musicbrainz.length, 12);
    assert.equal(asked.itunes.length, 1);
    assert.deepEqual(db.fetched, ['https://is1-ssl.mzstatic.com/ruins.jpg']);
    for (const song of ruins) assert.equal(db.coverOf(song.id), 'file:///covers/ruins.jpg');
    assert.equal(result.coversSaved, 12);
    assert.equal(result.matched, 12);
  });

  it('searches once for each of two records, and keeps their covers apart', async () => {
    const tracks = [...album('Ruins', 3), ...album('Other', 3)];
    const db = memory(tracks);
    const { asked, catalogues } = asking(found, (song) =>
      sold(song, song.album!, `${song.album!.toLowerCase()}.jpg`)
    );

    await runEnrichment(tracks, quietly, undefined, db.store, catalogues);

    assert.equal(asked.itunes.length, 2);
    assert.equal(db.coverOf('Ruins-3'), 'file:///covers/ruins.jpg');
    assert.equal(db.coverOf('Other-3'), 'file:///covers/other.jpg');
  });

  it('tries another track of the record when the first is not recognised', async () => {
    // An intro, a skit, a title with a guest in it: the shop does not know the
    // track and knows the album perfectly well.
    const ruins = album('Ruins', 6);
    const db = memory(ruins);
    const { asked, catalogues } = asking(found, (song) =>
      song.id === 'Ruins-1' ? null : sold(song, 'Ruins', 'ruins.jpg')
    );

    await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.itunes, ['Ruins-1', 'Ruins-2']);
    // The one that was not recognised included.
    for (const song of ruins) assert.equal(db.coverOf(song.id), 'file:///covers/ruins.jpg');
  });

  it('gives up on a record after three tracks, and writes that down for those three only', async () => {
    const ruins = album('Ruins', 5);
    const db = memory(ruins);
    const first = asking(found, () => null);
    const seen: EnrichProgress[] = [];

    await runEnrichment(ruins, (progress) => seen.push(progress), undefined, db.store, first.catalogues);

    assert.deepEqual(first.asked.itunes, ['Ruins-1', 'Ruins-2', 'Ruins-3']);
    assert.deepEqual(
      ruins.map((song) => db.rows.get(song.id)?.coverSearchedAt ?? null),
      [1, 1, 1, null, null]
    );
    for (const song of ruins) assert.equal(db.coverOf(song.id), null);
    assert.equal(seen.at(-1)?.done, 5);

    // The two that were never asked about are the next run's to try, and
    // after them there is nobody left to ask about.
    const second = asking(found, () => null);
    await runEnrichment(ruins, quietly, undefined, db.store, second.catalogues);
    assert.deepEqual(second.asked, { musicbrainz: [], itunes: ['Ruins-4', 'Ruins-5'] });

    const third = asking(found, () => null);
    const after: EnrichProgress[] = [];
    await runEnrichment(ruins, (progress) => after.push(progress), undefined, db.store, third.catalogues);
    assert.deepEqual(third.asked, { musicbrainz: [], itunes: [] });
    assert.equal(after.at(-1)?.total, 0);
  });

  it('lets a later run find the cover through a track the first never asked about', async () => {
    const ruins = album('Ruins', 4);
    const db = memory(ruins);
    const knownOnly = (id: string) => (song: Track) => (song.id === id ? sold(song, 'Ruins', 'ruins.jpg') : null);

    await runEnrichment(ruins, quietly, undefined, db.store, asking(found, knownOnly('Ruins-4')).catalogues);
    for (const song of ruins) assert.equal(db.coverOf(song.id), null);

    await runEnrichment(ruins, quietly, undefined, db.store, asking(found, knownOnly('Ruins-4')).catalogues);
    for (const song of ruins) assert.equal(db.coverOf(song.id), 'file:///covers/ruins.jpg');
  });

  it('leaves a track alone whose file carries a picture of its own', async () => {
    // One already looked up, one not. Their record has a cover, and neither
    // takes it; nor is a cover searched for or fetched for either.
    const ruins = album('Ruins', 3);
    const lone = track({ id: 'lone', title: 'Song', artist: 'Someone' });
    const db = memory([...ruins, lone], [
      row('Ruins-1', { artworkUrl: 'file:///covers/ruins.jpg' }),
      row('Ruins-2'),
      row('lone', { artworkUrl: 'https://is1-ssl.mzstatic.com/lone.jpg' }),
    ]);
    const withPicture = new Set(['Ruins-2', 'Ruins-3', 'lone']);
    db.store.covers!.hasOwnPicture = async (id) => withPicture.has(id);
    const { asked, catalogues } = asking(found, () => assert.fail('nothing needs a cover'));

    const result = await runEnrichment([...ruins, lone], quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.itunes, []);
    assert.equal(db.coverOf('Ruins-2'), null);
    assert.equal(db.coverOf('Ruins-3'), null);
    assert.equal(db.coverOf('lone'), 'https://is1-ssl.mzstatic.com/lone.jpg');
    assert.deepEqual(db.fetched, []);
    assert.equal(result.coversSaved, 0);
    // It is still looked up for what it is.
    assert.equal(db.rows.get('Ruins-3')?.status, 'matched');
  });

  it('does not look for a picture in a file that already has a cover', async () => {
    const ruins = album('Ruins', 3);
    const db = memory(ruins, [
      row('Ruins-1', { artworkUrl: 'file:///covers/ruins.jpg' }),
      row('Ruins-2', { artworkUrl: 'file:///covers/ruins.jpg' }),
    ]);
    const opened: string[] = [];
    db.store.covers!.hasOwnPicture = async (id) => {
      opened.push(id);
      return false;
    };

    await runEnrichment(ruins, quietly, undefined, db.store, asking(found, () => null).catalogues);

    assert.deepEqual(opened, ['Ruins-3']);
  });

  it('asks nobody anything about tracks that already have everything', async () => {
    const ruins = album('Ruins', 4);
    const db = memory(ruins, ruins.map((song) => row(song.id, { artworkUrl: 'file:///covers/ruins.jpg' })));
    const { asked, catalogues } = asking(found, () => assert.fail('nothing is missing'));

    const result = await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked, { musicbrainz: [], itunes: [] });
    assert.deepEqual(result, { matched: 0, missed: 0, coversSaved: 0, cancelled: false });
  });

  it('gives a track the cover its record already has without asking', async () => {
    const ruins = album('Ruins', 3);
    const db = memory(ruins, [row('Ruins-1', { artworkUrl: 'file:///covers/ruins.jpg' }), row('Ruins-2')]);
    const { asked, catalogues } = asking(found, () => assert.fail('the record has a cover'));

    // One of the two without a cover has been looked up before; one has not.
    const result = await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.musicbrainz, ['Ruins-3']);
    assert.equal(db.coverOf('Ruins-2'), 'file:///covers/ruins.jpg');
    assert.equal(db.coverOf('Ruins-3'), 'file:///covers/ruins.jpg');
    assert.deepEqual(db.fetched, []);
    assert.equal(result.coversSaved, 2);
  });

  it('finds that cover among tracks the run was not asked about', async () => {
    const ruins = album('Ruins', 2);
    const db = memory(ruins, [row('Ruins-1', { artworkUrl: 'file:///covers/ruins.jpg' })]);
    const { asked, catalogues } = asking(found, () => assert.fail('the record has a cover'));

    await runEnrichment([ruins[1]!], quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.itunes, []);
    assert.equal(db.coverOf('Ruins-2'), 'file:///covers/ruins.jpg');
  });

  it('gives it even to a track no catalogue could identify', async () => {
    const ruins = album('Ruins', 2);
    const db = memory(ruins, [row('Ruins-1', { artworkUrl: 'file:///covers/ruins.jpg' })]);
    const { asked, catalogues } = asking(() => null, () => null);

    const result = await runEnrichment([ruins[1]!], quietly, undefined, db.store, catalogues);

    assert.equal(db.rows.get('Ruins-2')?.status, 'not_found');
    assert.equal(db.coverOf('Ruins-2'), 'file:///covers/ruins.jpg');
    // Asked about once, for what it is. Not a second time for a cover.
    assert.deepEqual(asked.itunes, ['Ruins-2']);
    assert.equal(result.missed, 1);
  });

  it('goes back with a record’s cover to a track it had already finished with', async () => {
    // The first track is one nobody knows, and is done with before the record
    // has a cover at all. The cover the second brings in is its cover too.
    const ruins = album('Ruins', 2);
    const db = memory(ruins);
    const { catalogues } = asking(
      (song) => (song.id === 'Ruins-1' ? null : found(song)),
      (song) => (song.id === 'Ruins-1' ? null : sold(song, 'Ruins', 'ruins.jpg'))
    );

    await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.equal(db.rows.get('Ruins-1')?.status, 'not_found');
    assert.equal(db.coverOf('Ruins-1'), 'file:///covers/ruins.jpg');
  });

  it('leaves a cover somebody chose exactly where it is', async () => {
    const ruins = album('Ruins', 3);
    const db = memory(ruins, [
      row('Ruins-1', { status: 'manual', artworkUrl: 'file:///covers/chosen.jpg' }),
      row('Ruins-2', { artworkUrl: 'file:///covers/ruins.jpg' }),
      row('Ruins-3', { artworkUrl: 'file:///covers/ruins.jpg' }),
    ]);
    const { catalogues } = asking(found, () => null);

    await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.equal(db.coverOf('Ruins-1'), 'file:///covers/chosen.jpg');
  });

  it('fetches the picture a track’s own answer came with instead of searching', async () => {
    const song = track({ id: 'a', title: 'Song', artist: 'Someone' });
    const db = memory([song], [row('a', { artworkUrl: 'https://is1-ssl.mzstatic.com/own.jpg' })]);
    const { asked, catalogues } = asking(found, () => assert.fail('the address is already known'));

    await runEnrichment([song], quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.itunes, []);
    assert.equal(db.coverOf('a'), 'file:///covers/own.jpg');
  });

  it('hands the rest of the record a cover that arrived with one track’s details', async () => {
    // MusicBrainz has a genre for every track but the first, so only the first
    // goes to Apple for its details, and comes back with the cover as well.
    const ruins = album('Ruins', 4);
    const db = memory(ruins);
    const { asked, catalogues } = asking(
      (song) => found(song, { genres: song.id === 'Ruins-1' ? [] : ['rock'] }),
      (song) => sold(song, 'Ruins', 'ruins.jpg')
    );

    await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.itunes, ['Ruins-1']);
    assert.equal(db.fetched.length, 1);
    for (const song of ruins) assert.equal(db.coverOf(song.id), 'file:///covers/ruins.jpg');
  });

  it('asks about the best-described track of the record', async () => {
    const ruins = [
      track({ id: 'bare', title: 'Song 1', album: 'Ruins' }),
      track({ id: 'named', title: 'Song 2', album: 'Ruins', artist: 'Someone' }),
    ];
    const db = memory(ruins, [row('bare', { status: 'manual' }), row('named')]);
    const { asked, catalogues } = asking(found, (song) => sold(song, 'Ruins', 'ruins.jpg'));

    await runEnrichment(ruins, quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.itunes, ['named']);
    assert.equal(db.coverOf('bare'), 'file:///covers/ruins.jpg');
  });

  it('takes each record’s tracks together, wherever they were in the list', async () => {
    const [a1, a2] = album('A', 2) as [Track, Track];
    const [b1, b2] = album('B', 2) as [Track, Track];
    const tracks = [a1, b1, a2, b2];
    const db = memory(tracks);
    const { asked, catalogues } = asking(found, () => null);

    await runEnrichment(tracks, quietly, undefined, db.store, catalogues);

    assert.deepEqual(asked.musicbrainz, ['A-1', 'A-2', 'B-1', 'B-2']);
  });

  it('shares one search between albumless tracks MusicBrainz put on one release', async () => {
    const tracks = [1, 2, 3].map((n) => track({ id: `t${n}`, title: `Song ${n}`, artist: 'Someone' }));
    const db = memory(tracks);
    const { asked, catalogues } = asking(
      (song) => found(song, { release: { groupId: 'rg-ruins', title: 'Ruins' } }),
      (song) => sold(song, 'Ruins (Deluxe Edition)', 'ruins.jpg')
    );

    await runEnrichment(tracks, quietly, undefined, db.store, catalogues);

    assert.equal(asked.itunes.length, 1);
    for (const song of tracks) {
      assert.equal(db.coverOf(song.id), 'file:///covers/ruins.jpg');
      assert.equal(db.rows.get(song.id)?.album, 'Ruins (Deluxe Edition)');
    }
  });

  it('keeps a single’s cover to its own song when that is what Apple answered with', async () => {
    const tracks = [1, 2].map((n) => track({ id: `t${n}`, title: `Song ${n}`, artist: 'Someone' }));
    const db = memory(tracks);
    const { asked, catalogues } = asking(
      (song) => found(song, { release: { groupId: 'rg-ruins', title: 'Ruins' } }),
      (song) => sold(song, `${song.title} - Single`, `${song.id}.jpg`)
    );

    await runEnrichment(tracks, quietly, undefined, db.store, catalogues);

    // One each, which is what they cost before anything was grouped.
    assert.deepEqual(asked.itunes, ['t1', 't2']);
    assert.equal(db.coverOf('t1'), 'file:///covers/t1.jpg');
    assert.equal(db.coverOf('t2'), 'file:///covers/t2.jpg');
  });

  it('uses the library’s cover for a record it only learns the name of from the search', async () => {
    const stranger = track({ id: 'new', title: 'Song 9', artist: 'Someone' });
    const ruins = album('Ruins', 1);
    const db = memory([stranger, ...ruins], [row('Ruins-1', { artworkUrl: 'file:///covers/ours.jpg' })]);
    const { catalogues } = asking(found, (song) => sold(song, 'Ruins', 'apples.jpg'));

    await runEnrichment([stranger], quietly, undefined, db.store, catalogues);

    assert.equal(db.coverOf('new'), 'file:///covers/ours.jpg');
    assert.deepEqual(db.fetched, []);
  });

  it('counts tracks, and counts one as done only when nothing is left to do for it', async () => {
    const ruins = album('Ruins', 3);
    const db = memory(ruins);
    const { catalogues } = asking(found, (song) => sold(song, 'Ruins', 'ruins.jpg'));
    const seen: EnrichProgress[] = [];

    await runEnrichment(ruins, (progress) => seen.push(progress), undefined, db.store, catalogues);

    assert.ok(seen.every((progress) => progress.total === 3));
    assert.ok(seen.every((progress, index) => index === 0 || progress.done >= seen[index - 1]!.done));
    assert.deepEqual(
      { done: seen.at(-1)?.done, matched: seen.at(-1)?.matched, covers: seen.at(-1)?.covers },
      { done: 3, matched: 3, covers: 3 }
    );
  });
});

describe('a run and the services’ limits', () => {
  const MUSICBRAINZ_MS = 1_400;
  const APPLE_MS = 3_500;

  /** Catalogues that take their turns from pacers on a made-up clock and note when they went. */
  function paced(clock: ReturnType<typeof fakeClock>, itunes: (song: Track) => ItunesMatch | null) {
    const turns = { musicbrainz: pacer(MUSICBRAINZ_MS, clock), itunes: pacer(APPLE_MS, clock) };
    const went = { musicbrainz: [] as number[], itunes: [] as number[] };
    const catalogues: Catalogues = {
      musicbrainz: async (song) => {
        await turns.musicbrainz();
        went.musicbrainz.push(clock.now());
        // An answer takes a while to come, as answers do.
        await clock.sleep(300);
        return found(song, { genres: [] });
      },
      itunes: async (song) => {
        await turns.itunes();
        went.itunes.push(clock.now());
        await clock.sleep(300);
        return itunes(song);
      },
    };
    return { went, catalogues };
  }

  const gaps = (times: number[]) => times.slice(1).map((time, index) => time - times[index]!);

  it('asks each service no faster than its own interval while asking both at once', async () => {
    // Every track needs both: MusicBrainz has no genre for any of them.
    const tracks = Array.from({ length: 8 }, (_unused, index) =>
      track({ id: `t${index}`, title: `Song ${index}`, artist: `Band ${index}` })
    );
    const db = memory(tracks);
    const clock = fakeClock();
    const { went, catalogues } = paced(clock, (song) => sold(song, `${song.title} - Single`, `${song.id}.jpg`));

    await clock.run(runEnrichment(tracks, quietly, undefined, db.store, catalogues));

    assert.equal(went.musicbrainz.length, 8);
    assert.equal(went.itunes.length, 8);
    assert.ok(gaps(went.musicbrainz).every((gap) => gap >= MUSICBRAINZ_MS), `MusicBrainz: ${gaps(went.musicbrainz)}`);
    assert.ok(gaps(went.itunes).every((gap) => gap >= APPLE_MS), `Apple: ${gaps(went.itunes)}`);

    // Side by side: MusicBrainz was through all eight while Apple, the slower
    // of the two, was still on its fourth. One after the other, the eighth
    // question to MusicBrainz could not have been put before Apple had
    // answered seven.
    assert.ok(went.musicbrainz.at(-1)! < went.itunes[3]!);
    // And the whole run took what the slower service needed, not the sum.
    assert.ok(clock.now() < 8 * APPLE_MS, `took ${clock.now()}`);
  });

  it('carries on with one service while the other has asked for a pause', async () => {
    const tracks = [...album('A', 1), ...album('B', 1), ...album('C', 1)];
    const db = memory(tracks);
    let refusals = 0;
    const { asked, catalogues } = asking(found, () => {
      // The first search for a cover is turned away; the ones after are not.
      if ((refusals += 1) === 1) throw Object.assign(new Error('slow down'), { status: 403, throttled: true });
      return null;
    });
    const seen: EnrichProgress[] = [];

    const result = await withoutWaiting(() =>
      runEnrichment(tracks, (progress) => seen.push(progress), undefined, db.store, catalogues)
    );

    assert.ok(seen.some((progress) => progress.throttled));
    // MusicBrainz was not held up by it, and nothing found there was lost.
    assert.equal(asked.musicbrainz.length, 3);
    assert.equal(result.matched, 3);
    // Apple was asked again after the pause, once per record still waiting.
    assert.equal(asked.itunes.length, 3);
    // The refusal was not written down as "there is no cover".
    assert.equal(db.rows.get('A-1')?.coverSearchedAt ?? null, null);
    assert.equal(db.rows.get('B-1')?.coverSearchedAt, 1);
  });
});

describe('a run and a service that cannot be reached', () => {
  const unreachable = () => {
    throw Object.assign(new Error('could not be reached'), { network: true });
  };
  const sixRecords = () => ['A', 'B', 'C', 'D', 'E', 'F'].flatMap((name) => album(name, 1));

  it('gives up on Apple alone after three tries, and finishes with MusicBrainz', async () => {
    // Counted together, every answer from MusicBrainz wiped Apple's count
    // clean and the run waited on Apple for every track there was.
    const tracks = sixRecords();
    const db = memory(tracks);
    const { asked, catalogues } = asking(found, unreachable);
    const seen: EnrichProgress[] = [];

    const result = await withoutWaiting(() =>
      runEnrichment(tracks, (progress) => seen.push(progress), undefined, db.store, catalogues)
    );

    assert.equal(asked.itunes.length, 3);
    assert.equal(asked.musicbrainz.length, 6);
    assert.equal(result.matched, 6);
    assert.equal(result.unreachable, 'apple');
    assert.equal(result.stopped, undefined);
    assert.ok(!seen.at(-1)?.offline);
    // Not being reached is not "there is no cover".
    for (const song of tracks) assert.equal(db.rows.get(song.id)?.coverSearchedAt ?? null, null);
  });

  it('gives up on MusicBrainz alone, and still finds the covers Apple can', async () => {
    const tracks = sixRecords();
    // Two were looked up before and only want a cover; four have not been.
    const db = memory(tracks, [row('A-1'), row('B-1')]);
    const { asked, catalogues } = asking(unreachable, (song) => sold(song, song.album!, `${song.id}.jpg`));

    const result = await withoutWaiting(() =>
      runEnrichment(tracks, quietly, undefined, db.store, catalogues)
    );

    assert.equal(asked.musicbrainz.length, 3);
    assert.equal(result.unreachable, 'musicbrainz');
    assert.equal(result.coversSaved, 2);
    assert.equal(db.coverOf('A-1'), 'file:///covers/A-1.jpg');
    // Nothing is written about a track that was never answered for.
    assert.equal(db.rows.has('C-1'), false);
    assert.equal(db.rows.has('F-1'), false);
  });

  it('says there is no network when neither answers', async () => {
    const tracks = sixRecords();
    const db = memory(tracks, [row('A-1')]);
    const { catalogues } = asking(unreachable, unreachable);
    const seen: EnrichProgress[] = [];

    const result = await withoutWaiting(() =>
      runEnrichment(tracks, (progress) => seen.push(progress), undefined, db.store, catalogues)
    );

    assert.equal(result.stopped, 'offline');
    assert.equal(result.unreachable, undefined);
    assert.ok(seen.at(-1)?.offline);
  });

  it('takes the rate-limit note down when the wait is over', async () => {
    const [song] = album('A', 1) as [Track];
    const db = memory([song]);
    const { catalogues } = asking(found, () => {
      throw Object.assign(new Error('slow down'), { status: 403, throttled: true });
    });
    const seen: EnrichProgress[] = [];

    await withoutWaiting(() =>
      runEnrichment([song], (progress) => seen.push(progress), undefined, db.store, catalogues)
    );

    // Said when the wait ends, and not left for whichever track happens to
    // finish next to say: after the note goes up there is one report taking
    // it down and then the last one.
    const up = seen.findLastIndex((progress) => progress.throttled);
    assert.ok(up >= 0);
    assert.deepEqual(seen.slice(up + 1).map((progress) => progress.throttled), [false, false]);
  });
});

describe('stopping a run', () => {
  it('keeps everything it had finished and asks nothing more', async () => {
    const tracks = [...album('A', 2), ...album('B', 2), ...album('C', 2)];
    const db = memory(tracks);
    const controller = new AbortController();
    const { asked, catalogues } = asking(
      (song) => {
        // Stop is pressed while the first track of the second record is out.
        if (song.id === 'B-1') controller.abort();
        return found(song);
      },
      (song) => sold(song, song.album!, `${song.album!.toLowerCase()}.jpg`)
    );

    const result = await runEnrichment(tracks, quietly, controller.signal, db.store, catalogues);

    assert.equal(result.cancelled, true);
    assert.deepEqual(asked.musicbrainz, ['A-1', 'A-2', 'B-1']);
    assert.equal(db.rows.get('A-1')?.status, 'matched');
    assert.equal(db.rows.get('A-2')?.status, 'matched');
    // The answer that arrived after the stop is not written.
    assert.equal(db.rows.has('B-1'), false);
    assert.equal(result.matched, 2);
  });

  it('does not put a cover on anything once stopped, though the picture had arrived', async () => {
    const ruins = album('Ruins', 2);
    const db = memory(ruins, ruins.map((song) => row(song.id)));
    const controller = new AbortController();
    const { catalogues } = asking(found, (song) => sold(song, 'Ruins', 'ruins.jpg'));
    const fetch = db.store.covers!.download;
    db.store.covers!.download = async (url) => {
      controller.abort();
      return fetch(url);
    };

    const result = await runEnrichment(ruins, quietly, controller.signal, db.store, catalogues);

    assert.equal(result.cancelled, true);
    assert.equal(result.coversSaved, 0);
    assert.equal(db.coverOf('Ruins-1'), null);
  });

  it('picks up where it left off the next time', async () => {
    const tracks = album('A', 3);
    const db = memory(tracks);
    const controller = new AbortController();
    const first = asking(
      (song) => {
        if (song.id === 'A-2') controller.abort();
        return found(song);
      },
      () => null
    );
    await runEnrichment(tracks, quietly, controller.signal, db.store, first.catalogues);

    const second = asking(found, (song) => sold(song, 'A', 'a.jpg'));
    await runEnrichment(tracks, quietly, undefined, db.store, second.catalogues);

    assert.deepEqual(second.asked.musicbrainz, ['A-2', 'A-3']);
    assert.equal(second.asked.itunes.length, 1);
    for (const song of tracks) assert.equal(db.coverOf(song.id), 'file:///covers/a.jpg');
  });
});
