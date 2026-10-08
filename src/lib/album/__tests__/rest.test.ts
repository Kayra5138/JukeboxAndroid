import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { abortError, httpError, networkError } from '../../metadata/http.ts';
import { musicBrainzGet } from '../../metadata/musicbrainz.ts';
import { chooseRelease, findAlbumRest, type Get, type OwnedTrack, type Release } from '../rest.ts';

/*
  A record as MusicBrainz lists it, and a library holding some of it. Nothing
  here reaches the network: what is asked goes to a list of answers, and the
  list of what was asked is half of what these tests are about.
*/

const STANDARD = ['Always in My Head', 'Magic', 'Ink', 'True Love', 'Midnight', "Another's Arms", 'Oceans', 'A Sky Full of Stars', 'O'];
const BONUS = ['All Your Friends', 'Ghost Story', 'O (Reprise)'];

function release(
  id: string,
  titles: string[] | string[][],
  fields: Partial<Release> & { formats?: string[]; by?: string[] } = {}
): Release {
  const discs = (Array.isArray(titles[0]) ? titles : [titles]) as string[][];
  const { formats, by, ...rest } = fields;
  return {
    id,
    title: 'Ghost Stories',
    status: 'Official',
    date: '2014-05-16',
    'artist-credit': [{ name: 'Coldplay', joinphrase: '' }],
    media: discs.map((disc, index) => ({
      position: index + 1,
      format: formats?.[index] ?? 'CD',
      tracks: disc.map((title, at) => ({
        position: at + 1,
        title,
        length: 200_000 + at * 1_000,
        'artist-credit': [{ name: by?.[at] ?? 'Coldplay', joinphrase: '' }],
      })),
    })),
    ...rest,
  };
}

let nextId = 0;
function owned(title: string, fields: Partial<OwnedTrack> = {}): OwnedTrack {
  return { id: `t${(nextId += 1)}`, title, artist: 'Coldplay', trackNumber: null, ...fields };
}

/** Answers from `route`, and remembers the paths it was asked for, unescaped. */
function catalogue(route: (path: string) => unknown) {
  const asked: string[] = [];
  let inFlight = 0;
  let most = 0;
  const get: Get = async <T>(path: string) => {
    asked.push(decodeURIComponent(path));
    most = Math.max(most, (inFlight += 1));
    // A turn of the loop, so that two asked together would be seen together.
    await new Promise((resolve) => setImmediate(resolve));
    inFlight -= 1;
    const answer = route(decodeURIComponent(path));
    if (answer instanceof Error) throw answer;
    return answer as T;
  };
  return { get, asked, atOnce: () => most };
}

const groups = (...found: { id: string; title?: string; kind?: string }[]) => ({
  'release-groups': found.map(({ id, title, kind }) => ({
    id,
    title: title ?? 'Ghost Stories',
    'primary-type': kind ?? 'Album',
  })),
});

const album = (tracks: OwnedTrack[], fields: { name?: string; artist?: string | null } = {}) => ({
  name: 'Ghost Stories',
  artist: 'Coldplay' as string | null,
  ...fields,
  tracks,
});

describe('which pressing a record is read off', () => {
  it('takes the album over the deluxe box when both have everything the library does', () => {
    const library = [owned('Magic'), owned('Midnight'), owned('O')];
    const chosen = chooseRelease(
      [release('deluxe', [...STANDARD, ...BONUS]), release('standard', STANDARD)],
      library
    );
    assert.equal(chosen?.release.id, 'standard');
    assert.equal(chosen?.covered, 3);
    assert.equal(chosen?.held.filter((id) => id == null).length, 6);
  });

  it('takes the box when a track the library has is only on the box', () => {
    const library = [owned('Magic'), owned('Ghost Story')];
    const chosen = chooseRelease(
      [release('standard', STANDARD), release('deluxe', [...STANDARD, ...BONUS])],
      library
    );
    assert.equal(chosen?.release.id, 'deluxe');
    assert.equal(chosen?.covered, 2);
  });

  it('takes an official pressing before a shorter bootleg that covers as much', () => {
    const library = [owned('Magic')];
    const chosen = chooseRelease(
      [
        release('bootleg', STANDARD.slice(0, 5), { status: 'Bootleg', date: '2013' }),
        release('promo', STANDARD.slice(0, 4), { status: 'Promotion' }),
        release('official', STANDARD),
      ],
      library
    );
    assert.equal(chosen?.release.id, 'official');
  });

  it('but a bootleg that has more of the library on it is the one the tracks came off', () => {
    const library = [owned('Magic'), owned('Rarity')];
    const chosen = chooseRelease(
      [release('official', STANDARD), release('bootleg', [...STANDARD, 'Rarity'], { status: 'Bootleg' })],
      library
    );
    assert.equal(chosen?.release.id, 'bootleg');
  });

  it('takes the earliest of the ones that are otherwise as good, and then the first listed', () => {
    const library = [owned('Magic')];
    const releases = [
      release('undated', STANDARD, { date: undefined }),
      release('reissue', STANDARD, { date: '2020-01-01' }),
      release('first', STANDARD, { date: '2014' }),
      release('same-day', STANDARD, { date: '2014' }),
    ];
    assert.equal(chooseRelease(releases, library)?.release.id, 'first');
  });

  it('does not count a DVD of videos as part of the album', () => {
    const boxed = release('box', [STANDARD, ['Magic (video)', 'Midnight (video)']], {
      formats: ['CD', 'DVD-Video'],
    });
    const chosen = chooseRelease([boxed], [owned('Magic')]);
    assert.equal(chosen?.listing.length, STANDARD.length);
  });

  it('has nothing to choose among pressings that list no tracks', () => {
    assert.equal(chooseRelease([{ id: 'bare', media: [] }, { id: 'barer' }], [owned('Magic')]), null);
  });
});

describe('which tracks of it the library has', () => {
  const have = (titles: string[], library: OwnedTrack[]) => {
    const chosen = chooseRelease([release('r', titles)], library)!;
    return chosen.held;
  };

  it('reads past case, accents, punctuation and Turkish letters', () => {
    const library = [owned('ŞIMARIK'), owned('another’s arms'), owned('Cafe del Mar')];
    const held = have(['Şımarık', "Another's Arms", 'Café del Mar', 'Oceans'], library);
    assert.deepEqual(held, [library[0]!.id, library[1]!.id, library[2]!.id, null]);
  });

  it('takes a title with its guest or its remaster named for the plain one, either way round', () => {
    const library = [owned('Numb (feat. Jay-Z)'), owned('Faint'), owned('Crawling ft. Somebody')];
    const held = have(['Numb', 'Faint [2011 Remaster]', 'Crawling', 'Runaway'], library);
    assert.deepEqual(held, [library[0]!.id, library[1]!.id, library[2]!.id, null]);
  });

  it('does not take the live take on the bonus disc for the album cut', () => {
    const library = [owned('Magic')];
    assert.deepEqual(have(['Magic', 'Magic (Live)'], library), [library[0]!.id, null]);
    const live = [owned('Magic (Live at the Royal Albert Hall)')];
    assert.deepEqual(have(['Magic', 'Magic (Live)'], live), [null, null]);
  });

  it('prefers the title as written when the library has both spellings', () => {
    const library = [owned('Numb (feat. Jay-Z)'), owned('Numb')];
    const held = have(['Numb', 'Numb (feat. Jay-Z)'], library);
    assert.deepEqual(held, [library[1]!.id, library[0]!.id]);
  });

  it('drops the artist a file put in front of its title', () => {
    const library = [owned('Coldplay - Magic')];
    assert.deepEqual(have(['Magic'], library), [library[0]!.id]);
  });

  it('gives one library track to one place only', () => {
    const library = [owned('Intro')];
    assert.deepEqual(have(['Intro', 'Song', 'Intro'], library), [library[0]!.id, null, null]);
  });

  it('tells two tracks of one title apart by where the library says its copy sits', () => {
    const second = owned('Intro', { trackNumber: 1, discNumber: 2 });
    const chosen = chooseRelease([release('r', [['Intro', 'One'], ['Intro', 'Two']])], [second])!;
    assert.deepEqual(chosen.held, [null, null, second.id, null]);

    // With both here, each goes to its own, whichever order they were read in.
    const first = owned('Intro', { trackNumber: 1, discNumber: 1 });
    const both = chooseRelease([release('r', [['Intro', 'One'], ['Intro', 'Two']])], [second, first])!;
    assert.deepEqual(both.held, [first.id, null, second.id, null]);
  });
});

describe('looking a record up', () => {
  it('asks twice: for the record under its artist, then for every pressing of it', async () => {
    const library = [owned('Magic'), owned('Midnight')];
    const { get, asked, atOnce } = catalogue((path) =>
      path.startsWith('/release-group?')
        ? groups({ id: 'rg-1' })
        : { releases: [release('deluxe', [...STANDARD, ...BONUS]), release('standard', STANDARD)] }
    );

    const outcome = await findAlbumRest(album(library), get);

    assert.equal(asked.length, 2);
    assert.match(asked[0]!, /^\/release-group\?query=releasegroup:"Ghost Stories" AND artist:"Coldplay"&fmt=json/);
    assert.match(asked[1]!, /^\/release\?release-group=rg-1&inc=recordings\+media\+artist-credits&fmt=json/);
    assert.equal(atOnce(), 1);

    assert.ok(outcome.ok);
    const { rest } = outcome;
    assert.equal(rest.groupId, 'rg-1');
    assert.deepEqual(rest.release, { id: 'standard', title: 'Ghost Stories', artist: 'Coldplay', year: 2014 });
    assert.equal(rest.discs, 1);
    assert.equal(rest.covered, 2);
    assert.equal(rest.rivals, 0);
    assert.deepEqual(
      rest.tracks.map((track) => [track.position, track.title, track.have]),
      STANDARD.map((title, index) => [
        index + 1,
        title,
        title === 'Magic' ? library[0]!.id : title === 'Midnight' ? library[1]!.id : null,
      ])
    );
    assert.equal(rest.tracks[1]!.lengthSec, 201);
    assert.equal(rest.tracks[1]!.disc, 1);
  });

  it('names a track’s artist only where it is not the record’s', async () => {
    const { get } = catalogue((path) =>
      path.startsWith('/release-group?')
        ? groups({ id: 'rg-1' })
        : { releases: [release('r', ['Magic', 'Guest'], { by: ['Coldplay', 'Coldplay & Rihanna'] })] }
    );
    const outcome = await findAlbumRest(album([owned('Magic')]), get);
    assert.ok(outcome.ok);
    assert.deepEqual(outcome.rest.tracks.map((track) => track.artist), [null, 'Coldplay & Rihanna']);
  });

  it('asks for the record without the edition a shop added to its name', async () => {
    const { get, asked } = catalogue((path) =>
      path.startsWith('/release-group?') ? groups({ id: 'rg-1' }) : { releases: [release('r', STANDARD)] }
    );
    const outcome = await findAlbumRest(
      album([owned('Magic')], { name: 'Ghost Stories (Deluxe Edition)', artist: 'AC/DC "live"' }),
      get
    );
    assert.ok(outcome.ok);
    // And nothing of Lucene's own syntax left in what was typed.
    assert.match(asked[0]!, /query=releasegroup:"Ghost Stories" AND artist:"AC DC  live"&/);
  });

  it('does not ask at all about a record with no name or no one artist', async () => {
    const { get, asked } = catalogue(() => groups({ id: 'rg-1' }));
    assert.deepEqual(await findAlbumRest(album([owned('Magic')], { artist: null }), get), { ok: false, why: 'unnamed' });
    assert.deepEqual(await findAlbumRest(album([owned('Magic')], { name: '  ' }), get), { ok: false, why: 'unnamed' });
    assert.deepEqual(await findAlbumRest(album([owned('Magic')], { artist: '!!' }), get), { ok: false, why: 'unnamed' });
    assert.equal(asked.length, 0);
  });

  it('says so when the catalogue has no such record, having asked by name as well', async () => {
    const { get, asked } = catalogue(() => groups());
    assert.deepEqual(await findAlbumRest(album([owned('Magic')]), get), { ok: false, why: 'notFound' });
    assert.equal(asked.length, 2);
    assert.match(asked[1]!, /query=releasegroup:"Ghost Stories"&/);
  });

  it('does not believe a hit whose name is only close', async () => {
    const { get, asked } = catalogue(() => groups({ id: 'live', title: 'Ghost Stories Live 2014' }));
    assert.deepEqual(await findAlbumRest(album([owned('Magic')]), get), { ok: false, why: 'notFound' });
    // Nothing was browsed for a record that is not this one.
    assert.ok(asked.every((path) => path.startsWith('/release-group?')));
  });

  it('believes a record found by name alone only when the library’s tracks are on it', async () => {
    const route = (path: string) => {
      if (path.includes('AND artist:')) return groups();
      if (path.startsWith('/release-group?')) return groups({ id: 'rg-kanji' });
      return { releases: [release('r', STANDARD)] };
    };
    const library = [owned('Magic', { artist: 'Yousei Teikoku' }), owned('Ink', { artist: 'Yousei Teikoku' })];

    const found = await findAlbumRest(album(library, { artist: 'Yousei Teikoku' }), catalogue(route).get);
    assert.ok(found.ok);
    assert.equal(found.rest.covered, 2);

    const strangers = [owned('Something Else'), owned('Magic')];
    assert.deepEqual(
      await findAlbumRest(album(strangers, { artist: 'Yousei Teikoku' }), catalogue(route).get),
      { ok: false, why: 'notFound' }
    );
  });

  it('answers with nothing covered, and says so, when the artist vouches but no track does', async () => {
    const { get } = catalogue((path) =>
      path.startsWith('/release-group?') ? groups({ id: 'rg-1' }) : { releases: [release('r', STANDARD)] }
    );
    const outcome = await findAlbumRest(album([owned('Unrecognisable')]), get);
    assert.ok(outcome.ok);
    assert.equal(outcome.rest.covered, 0);
  });

  it('among records of one name takes the one the library’s tracks are on, and says there were others', async () => {
    const { get, asked } = catalogue((path) => {
      if (path.startsWith('/release-group?')) return groups({ id: 'remixes' }, { id: 'album' }, { id: 'never' });
      if (path.includes('release-group=remixes')) return { releases: [release('x', ['Magic (Remix)', 'Ink (Remix)'])] };
      if (path.includes('release-group=album')) return { releases: [release('a', STANDARD)] };
      throw new Error('asked about a record after one had everything');
    });
    const outcome = await findAlbumRest(album([owned('Magic'), owned('Ink')]), get);
    assert.ok(outcome.ok);
    assert.equal(outcome.rest.groupId, 'album');
    assert.equal(outcome.rest.rivals, 2);
    assert.equal(asked.length, 3);
  });

  it('looks at the kind of record the name says it is first', async () => {
    const { get, asked } = catalogue((path) => {
      if (path.startsWith('/release-group?')) {
        return groups({ id: 'the-album', title: 'Magic' }, { id: 'the-single', title: 'Magic', kind: 'Single' });
      }
      return path.includes('the-single')
        ? { releases: [release('s', ['Magic'])] }
        : { releases: [release('a', ['Magic', ...STANDARD])] };
    });
    const outcome = await findAlbumRest(album([owned('Magic')], { name: 'Magic - Single' }), get);
    assert.ok(outcome.ok);
    assert.equal(outcome.rest.groupId, 'the-single');
    assert.equal(outcome.rest.tracks.length, 1);
    assert.equal(asked.length, 2);
  });

  it('never asks more than five times, however many records share the name', async () => {
    const { get, asked, atOnce } = catalogue((path) => {
      if (path.includes('AND artist:')) return groups();
      if (path.startsWith('/release-group?')) {
        return groups(...Array.from({ length: 5 }, (_, index) => ({ id: `rg-${index}` })));
      }
      return { releases: [release('r', ['Nothing the library has', 'Magic'])] };
    });
    await findAlbumRest(album([owned('Magic'), owned('Ink'), owned('O')]), get);
    assert.equal(asked.length, 5);
    assert.equal(atOnce(), 1);
  });

  it('tells no connection, being told to slow down and any other refusal apart', async () => {
    const failing = (error: Error) => findAlbumRest(album([owned('Magic')]), catalogue(() => error).get);
    assert.deepEqual(await failing(networkError('MusicBrainz could not be reached')), { ok: false, why: 'offline' });
    assert.deepEqual(await failing(httpError('MusicBrainz', 503)), { ok: false, why: 'throttled' });
    assert.deepEqual(await failing(httpError('MusicBrainz', 429)), { ok: false, why: 'throttled' });
    assert.deepEqual(await failing(httpError('MusicBrainz', 500)), { ok: false, why: 'failed' });
  });

  it('a failure half way is a failure, not a record with nothing on it', async () => {
    const { get } = catalogue((path) =>
      path.startsWith('/release-group?') ? groups({ id: 'rg-1' }) : networkError('gone')
    );
    assert.deepEqual(await findAlbumRest(album([owned('Magic')]), get), { ok: false, why: 'offline' });
  });

  it('passes a stop on as a stop', async () => {
    const { get } = catalogue(() => abortError());
    await assert.rejects(findAlbumRest(album([owned('Magic')]), get), { name: 'AbortError' });
  });
});

describe('through the real client', () => {
  it('every request waits its turn at MusicBrainz', async () => {
    const real = { setTimeout: globalThis.setTimeout, now: Date.now, fetch: globalThis.fetch };
    let now = real.now();
    const went: number[] = [];
    // The clock jumps instead of waiting, as it does for the other clients'
    // pacing: a timer fires at once and moves the time on by what it was for.
    Date.now = () => now;
    globalThis.setTimeout = ((handler: () => void, ms = 0) => {
      const due = now + ms;
      return real.setTimeout(() => {
        now = Math.max(now, due);
        handler();
      }, 0);
    }) as typeof setTimeout;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      went.push(now);
      const url = decodeURIComponent(String(input));
      const body = url.includes('AND artist:')
        ? groups()
        : url.includes('/release-group?')
          ? groups({ id: 'one' }, { id: 'two' })
          : { releases: [release('r', ['Elsewhere', 'Magic'])] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    let outcome;
    try {
      outcome = await findAlbumRest(album([owned('Magic'), owned('Ink')]), musicBrainzGet);
    } finally {
      Date.now = real.now;
      globalThis.setTimeout = real.setTimeout;
      globalThis.fetch = real.fetch;
    }

    assert.equal(went.length, 4);
    for (let index = 1; index < went.length; index += 1) {
      assert.ok(went[index]! - went[index - 1]! >= 1_400, `request ${index} went ${went[index]! - went[index - 1]!}ms after the one before`);
    }
    // One of the library's two tracks on a record nobody vouched for: not believed.
    assert.deepEqual(outcome, { ok: false, why: 'notFound' });
  });
});
