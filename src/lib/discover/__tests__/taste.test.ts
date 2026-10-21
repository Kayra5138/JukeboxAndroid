import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  artistBlockKey,
  blockArtistIn,
  blockedArtistsIn,
  byArtist,
  chance,
  chooseSeeds,
  feedbackFrom,
  isEarlySkip,
  seededRandom,
  standingOf,
  standings,
  unblockArtistIn,
  type ExclusionRow,
  type ExclusionStore,
  type Feedback,
} from '../taste.ts';

const DAY = 86_400_000;
const NOW = 400 * DAY;
/** Said [daysAgo] days ago: today, unless told otherwise, and at no known time for null. */
const said = (kind: Feedback['kind'], artist: string, daysAgo: number | null = 0): Feedback => ({
  kind,
  artist,
  at: daysAgo == null ? null : NOW - daysAgo * DAY,
});
const many = (count: number, kind: Feedback['kind'], artist: string, daysAgo: number | null = 0) =>
  Array.from({ length: count }, () => said(kind, artist, daysAgo));

describe('what follows from what was done with a suggestion', () => {
  it('makes an artist count for less when a song of theirs is sent away', () => {
    const all = standings([said('excluded', 'Band')], NOW);
    assert.equal(all.get('band')!.factor, 0.6);
    assert.equal(all.get('band')!.out, false);
    assert.ok(Math.abs(standings(many(2, 'excluded', 'Band'), NOW).get('band')!.factor - 0.36) < 1e-9);
  });

  it('leaves an artist out once three of their songs have been sent away', () => {
    assert.equal(standings(many(3, 'excluded', 'Band'), NOW).get('band')!.out, true);
  });

  it('lets a keep take an exclusion back', () => {
    const all = standings([...many(3, 'excluded', 'Band'), said('kept', 'Band')], NOW);
    assert.equal(all.get('band')!.out, false);
  });

  it('lets an artist back when what was said is half a year old', () => {
    const old = standings([...many(2, 'excluded', 'Band', 200), said('excluded', 'Band', 10)], NOW).get('band')!;
    assert.equal(old.out, false);
    assert.equal(old.excluded, 1);
  });

  it('takes what was said at no known time for old: it says nothing about the artist any more', () => {
    // Every exclusion made before the table kept dates. However many, the artist is not out, and counts as before.
    assert.equal(standings(many(12, 'excluded', 'Band', null), NOW).has('band'), false);
    assert.equal(standings(many(3, 'kept', 'Band', null), NOW).has('band'), false);
    // Two old ones and one from today is one from today.
    const mixed = standings([...many(2, 'excluded', 'Band', null), said('excluded', 'Band')], NOW).get('band')!;
    assert.equal(mixed.out, false);
    assert.equal(mixed.excluded, 1);
    // Three dated ones are out, and are let back when they are half a year old.
    assert.equal(standings(many(3, 'excluded', 'Band', 10), NOW).get('band')!.out, true);
    assert.equal(standings(many(3, 'excluded', 'Band', 10), NOW + 200 * DAY).has('band'), false);
  });

  it('holds to a block whenever it was made, dated or not', () => {
    assert.equal(standings([said('blocked', 'Band', null)], NOW).get('band')!.out, true);
    assert.equal(standings([said('blocked', 'Band', 5000)], NOW).get('band')!.out, true);
  });

  it('makes an artist count for more when their songs are kept, up to a point', () => {
    assert.equal(standings([said('kept', 'Band')], NOW).get('band')!.factor, 1.3);
    const lots = standings(many(9, 'kept', 'Band'), NOW).get('band')!.factor;
    assert.ok(Math.abs(lots - 1.3 ** 3) < 1e-9);
  });

  it('counts an early skip against an artist nobody has ever played', () => {
    const all = standings(many(2, 'skipped', 'Stranger', 1), NOW);
    assert.ok(Math.abs(all.get('stranger')!.factor - 0.85 ** 2) < 1e-9);
  });

  it('sets what was heard through against what was skipped', () => {
    // Two skips and four plays to the end come out even.
    const even = standings([...many(2, 'skipped', 'Band', 1), ...many(4, 'finished', 'Band', 1)], NOW);
    assert.equal(even.get('band')!.factor, 1);
    const liked = standings(many(2, 'finished', 'Band', 1), NOW).get('band')!.factor;
    assert.ok(Math.abs(liked - 1.1) < 1e-9);
  });

  it('stops counting skips at four, and forgets them after a month', () => {
    const floor = standings(many(30, 'skipped', 'Band', 1), NOW).get('band')!.factor;
    assert.ok(Math.abs(floor - 0.85 ** 4) < 1e-9);
    assert.equal(standings(many(3, 'skipped', 'Band', 45), NOW).has('band'), false);
  });

  it('holds only the first name of a credit to it, under any spelling', () => {
    const all = standings([said('excluded', 'Sigur Rós feat. Somebody')], NOW);
    assert.ok(all.has('sigur ros'));
    assert.ok(!all.has('somebody'));
    assert.equal(standingOf(all, 'SIGUR ROS').factor, 0.6);
    assert.deepEqual(standingOf(all, 'Somebody', null), { factor: 1, out: false });
  });

  it('takes a block for a block, whatever else was said', () => {
    const all = standings([said('blocked', 'Band'), ...many(5, 'kept', 'Band')], NOW);
    assert.equal(all.get('band')!.out, true);
    assert.equal(all.get('band')!.blocked, true);
  });
});

function tableOf(rows: ExclusionRow[] = []): ExclusionStore & { rows: ExclusionRow[] } {
  const table = {
    rows,
    all: () => [...table.rows],
    put: (row: ExclusionRow) => {
      table.rows = [...table.rows.filter((kept) => kept.id !== row.id), row];
    },
    remove: (id: string) => {
      table.rows = table.rows.filter((kept) => kept.id !== id);
    },
  };
  return table;
}
const songRow = (id: string, artist: string, reason: string): ExclusionRow => ({
  id,
  song_key: `${artist.toLowerCase()}|${id}`,
  title: id,
  artist,
  reason,
  until_at: null,
});

describe('never this artist', () => {
  it('writes one row of its own kind, with no end, that a list of excluded songs does not show', () => {
    const table = tableOf([songRow('one', 'Band', 'blocked')]);
    blockArtistIn(table, 'Sigur Rós feat. Somebody', 'mbid-1');
    const row = table.rows.find((kept) => kept.reason === 'artist')!;
    assert.deepEqual(row, {
      id: 'artist:sigur ros',
      song_key: 'artist-mbid:mbid-1',
      title: '',
      artist: 'Sigur Rós',
      reason: 'artist',
      until_at: null,
    });
    assert.equal(table.rows.filter((kept) => kept.reason === 'blocked').length, 1);
  });

  it('is one row however often and however spelled', () => {
    const table = tableOf();
    blockArtistIn(table, 'Sigur Rós');
    blockArtistIn(table, 'SIGUR ROS');
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0]!.song_key, artistBlockKey('sigur ros'));
  });

  it('lists who is blocked, by name, with the id where there is one', () => {
    const table = tableOf([songRow('one', 'Band', 'blocked')]);
    blockArtistIn(table, 'Zed');
    blockArtistIn(table, 'Abel', 'mbid-a');
    assert.deepEqual(blockedArtistsIn(table), [
      { id: 'artist:abel', artist: 'Abel', mbid: 'mbid-a' },
      { id: 'artist:zed', artist: 'Zed', mbid: null },
    ]);
  });

  it('is undone by name or by the row’s id, and takes no song’s row with it', () => {
    const table = tableOf([songRow('artist:zed', 'Zed', 'blocked')]);
    blockArtistIn(table, 'Abel');
    unblockArtistIn(table, 'ABEL');
    assert.deepEqual(blockedArtistsIn(table), []);
    // A song's row that happens to have such an id is a song's row.
    unblockArtistIn(table, 'artist:zed');
    assert.equal(table.rows.length, 1);
  });

  it('ignores a name that is no name', () => {
    const table = tableOf();
    blockArtistIn(table, '   ');
    assert.equal(table.rows.length, 0);
  });
});

describe('reading the table as things that happened', () => {
  it('takes a saved song for a keep, a blocked one for an exclusion and an artist’s row for a block', () => {
    const rows = [
      songRow('a', 'Kept', 'saved'),
      songRow('b', 'Gone', 'blocked'),
      songRow('c', 'Shown', 'expired'),
      songRow('d', 'Lost', 'unmatched'),
      { ...songRow('artist:never', 'Never', 'artist'), title: '' },
    ];
    assert.deepEqual(feedbackFrom(rows), [
      { kind: 'kept', artist: 'Kept', at: null },
      { kind: 'excluded', artist: 'Gone', at: null },
      { kind: 'blocked', artist: 'Never', at: null },
    ]);
  });

  it('reads a date from the day the table has one', () => {
    assert.equal(feedbackFrom([{ ...songRow('a', 'Kept', 'saved'), created_at: 5 }])[0]!.at, 5);
  });

  it('knows an early skip by the rule the profile goes by', () => {
    assert.equal(isEarlySkip({ seconds_played: 10, duration_sec: 200 }), true);
    assert.equal(isEarlySkip({ seconds_played: 40, duration_sec: 200 }), false);
    assert.equal(isEarlySkip({ seconds_played: 20, duration_sec: 60 }), false);
  });
});

describe('chance that can be had again', () => {
  it('is the same number for the same two things and another for anything else', () => {
    assert.equal(chance(1, 'a'), chance(1, 'a'));
    assert.notEqual(chance(1, 'a'), chance(2, 'a'));
    assert.notEqual(chance(1, 'a'), chance(1, 'b'));
  });

  it('is spread evenly between nought and one', () => {
    const drawn = Array.from({ length: 4000 }, (_, index) => chance('edition', `recording-${index}`));
    assert.ok(drawn.every((value) => value >= 0 && value < 1));
    const mean = drawn.reduce((sum, value) => sum + value, 0) / drawn.length;
    assert.ok(Math.abs(mean - 0.5) < 0.03);
    assert.ok(drawn.filter((value) => value < 0.1).length > 300);
    assert.ok(drawn.filter((value) => value > 0.9).length > 300);
  });

  it('gives the same run of numbers for the same edition', () => {
    const first = seededRandom(42);
    const again = seededRandom(42);
    assert.deepEqual([first(), first(), first()], [again(), again(), again()]);
    assert.notEqual(seededRandom(42)(), seededRandom(43)());
  });
});

describe('whose neighbours to go and look at', () => {
  const none = new Map();
  const recent = Array.from({ length: 20 }, (_, index) => ({ name: `Played ${index}`, score: 1000 - index * 40 }));
  const input = { recent, kept: [], allTime: [], library: [], standings: none, limit: 6, edition: 1 };

  it('always starts from the artists played most, and draws the rest', () => {
    const names = (edition: number) => chooseSeeds({ ...input, edition }).map((seed) => seed.name);
    for (const edition of [1, 2, 3, 4]) {
      assert.equal(names(edition).length, 6);
      assert.deepEqual(names(edition).slice(0, 3), ['Played 0', 'Played 1', 'Played 2']);
    }
    assert.deepEqual(names(1), names(1));
    const drawn = new Set([1, 2, 3, 4, 5, 6].flatMap((edition) => names(edition).slice(3)));
    assert.ok(drawn.size > 3);
  });

  it('flattens the gap between a favourite and the next one', () => {
    const [top, second] = chooseSeeds({ ...input, recent: [{ name: 'A', score: 400 }, { name: 'B', score: 100 }] });
    assert.equal(top!.weight, 1);
    assert.equal(second!.weight, 0.5);
  });

  it('keeps the favourite at one and the rest at their true shares, whatever was said about all of them', () => {
    // Every one of them heard to the end, often: each counts a quarter more, and the favourite used to be cut off at one.
    const heard = standings(
      ['A', 'B', 'C'].flatMap((artist) => many(8, 'finished', artist)),
      NOW
    );
    const [top, second, third] = chooseSeeds({
      ...input,
      standings: heard,
      recent: [{ name: 'A', score: 400 }, { name: 'B', score: 100 }, { name: 'C', score: 64 }],
    });
    assert.equal(top!.weight, 1);
    assert.ok(Math.abs(second!.weight - 0.5) < 1e-9, String(second!.weight));
    assert.ok(Math.abs(third!.weight - 0.4) < 1e-9, String(third!.weight));
  });

  it('still lets what was said move one artist past another', () => {
    const [top, second] = chooseSeeds({
      ...input,
      standings: standings(many(8, 'finished', 'B'), NOW),
      recent: [{ name: 'A', score: 100 }, { name: 'B', score: 81 }],
    });
    // B's 0.9 counted a quarter more is past A's one, so B is the one and A is its share of that.
    assert.equal(top!.name, 'B');
    assert.equal(top!.weight, 1);
    assert.ok(Math.abs(second!.weight - 1 / 1.125) < 1e-9, String(second!.weight));
  });

  it('falls back on everything ever played when the month is thin', () => {
    const seeds = chooseSeeds({
      ...input,
      recent: [{ name: 'This Week', score: 50 }],
      allTime: [{ name: 'Old Favourite', seconds: 9000 }, { name: 'This Week', seconds: 100 }],
    });
    assert.deepEqual(seeds.map((seed) => [seed.name, seed.source]), [['This Week', 'recent'], ['Old Favourite', 'allTime']]);
    assert.equal(seeds[1]!.weight, 0.6);
  });

  it('falls back on the library by how many tracks of each artist it holds, never on the order it was scanned in', () => {
    const library = [{ name: 'Two Tracks', tracks: 2 }, { name: 'Forty Tracks', tracks: 40 }, { name: 'Ten Tracks', tracks: 10 }];
    const seeds = chooseSeeds({ ...input, recent: [], library });
    assert.deepEqual(seeds.map((seed) => seed.name), ['Forty Tracks', 'Ten Tracks', 'Two Tracks']);
    assert.equal(seeds[0]!.weight, 0.4);
    assert.ok(seeds.every((seed) => seed.source === 'library'));
  });

  it('does not go down the ladder while the month has enough', () => {
    const seeds = chooseSeeds({ ...input, allTime: [{ name: 'Old Favourite', seconds: 1e9 }] });
    assert.ok(!seeds.some((seed) => seed.name === 'Old Favourite'));
  });

  it('starts from an artist a song was kept from, so their neighbours come up at once', () => {
    const seeds = chooseSeeds({ ...input, recent: recent.slice(0, 2), kept: ['Found Here'] });
    const found = seeds.find((seed) => seed.name === 'Found Here')!;
    assert.equal(found.source, 'kept');
    assert.equal(found.weight, 0.7);
  });

  it('does not start from an artist who is out, and has no seeds when there is nothing to go on', () => {
    const out = standings(many(3, 'excluded', 'Played 0'), NOW);
    assert.ok(!chooseSeeds({ ...input, standings: out }).some((seed) => seed.name === 'Played 0'));
    assert.deepEqual(chooseSeeds({ ...input, recent: [] }), []);
  });
});

describe('listening by credit, as listening by artist', () => {
  it('shares a credit between the names in it and adds up the spellings', () => {
    const rows = [{ artist: 'A, B', seconds: 100 }, { artist: 'a', seconds: 50 }, { artist: null, seconds: 10 }];
    const split = (credit: string | null | undefined) => (credit ?? '').split(', ').filter(Boolean);
    assert.deepEqual(byArtist(rows, (row) => row.artist, (row) => row.seconds, split), [
      { name: 'A', amount: 100 },
      { name: 'B', amount: 50 },
    ]);
  });
});

describe('a new install, with little or nothing played', () => {
  const none = new Map();
  const library = Array.from({ length: 30 }, (_, index) => ({ name: `Shelf ${index}`, tracks: 60 - index }));
  const base = { recent: [], kept: [], allTime: [], library, standings: none, limit: 6, edition: 1 };

  it('starts from the library alone when nothing has been played', () => {
    const seeds = chooseSeeds(base);
    assert.equal(seeds.length, 6);
    assert.ok(seeds.every((seed) => seed.source === 'library'));
    // The artists with the most tracks are the anchors; the rest are drawn.
    assert.deepEqual(seeds.slice(0, 3).map((seed) => seed.name), ['Shelf 0', 'Shelf 1', 'Shelf 2']);
  });

  it('puts what little was played first, and makes up the rest from the library', () => {
    const seeds = chooseSeeds({ ...base, recent: [{ name: 'First Song', score: 30 }] });
    assert.equal(seeds[0]!.name, 'First Song');
    assert.equal(seeds[0]!.source, 'recent');
    assert.ok(seeds.slice(1).every((seed) => seed.source === 'library'));
  });

  it('leaves the library out once there is listening enough', () => {
    const recent = Array.from({ length: 12 }, (_, index) => ({ name: `Played ${index}`, score: 100 - index }));
    assert.ok(!chooseSeeds({ ...base, recent }).some((seed) => seed.source === 'library'));
  });
});
