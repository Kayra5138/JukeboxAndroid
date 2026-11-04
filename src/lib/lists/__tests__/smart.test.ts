import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DAY_MS,
  emptyRules,
  newRule,
  readSmartRules,
  ruleProblem,
  smartListIds,
  smartListMatches,
  withField,
  writeSmartRules,
  type SmartRule,
  type SmartRules,
  type SmartStats,
  type SmartTrack,
} from '../smart.ts';

const NOW = Date.UTC(2026, 9, 29, 12);

const song = (id: string, extra: Partial<SmartTrack> = {}): SmartTrack => ({
  id,
  title: `Song ${id}`,
  artist: null,
  album: null,
  albumArtist: null,
  genre: null,
  year: null,
  tags: [],
  addedAt: null,
  durationSec: 200,
  ...extra,
});

const LIBRARY: SmartTrack[] = [
  song('1', { title: 'Alpha', artist: 'Barış Manço', album: 'Sözüm Meclisten Dışarı', genre: 'Anadolu Rock', year: 1981, tags: ['anadolu rock', 'turkish'], addedAt: NOW - 2 * DAY_MS, durationSec: 250 }),
  song('2', { title: 'bravo', artist: 'Cem Karaca', albumArtist: 'Various Artists', year: 1975, tags: ['anadolu rock'], addedAt: NOW - 40 * DAY_MS, durationSec: 420 }),
  song('3', { title: 'Charlie', artist: 'Nirvana', album: 'Nevermind', genre: 'Grunge', year: 1991, tags: ['grunge'], addedAt: NOW - 400 * DAY_MS, durationSec: 150 }),
  song('4', { title: 'Delta', artist: 'Nirvana feat. Someone', year: 1993, durationSec: 0 }),
];

const STATS: SmartStats = {
  plays: new Map([['1', 12], ['2', 3], ['3', 7]]),
  lastPlayed: new Map([['1', NOW - DAY_MS], ['2', NOW - 100 * DAY_MS], ['3', NOW - 10 * DAY_MS]]),
  skips: new Map([['3', 4], ['2', 1]]),
};

const rule = (field: SmartRule['field'], op: SmartRule['op'], value: number | string = 0, to?: number): SmartRule =>
  typeof value === 'string'
    ? { field, op, text: value, value: 0, to: 0 }
    : { field, op, text: '', value, to: to ?? value };

const ids = (rules: SmartRule[], extra: Partial<SmartRules> = {}) =>
  smartListIds(LIBRARY, { ...emptyRules(), rules, ...extra }, STATS, NOW);

describe('smart list rules', () => {
  it('lets every song in when there is no rule, in title order', () => {
    assert.deepEqual(ids([]), ['1', '2', '3', '4']);
  });

  it('asks a tag without minding its case', () => {
    assert.deepEqual(ids([rule('tag', 'is', 'Anadolu Rock')]), ['1', '2']);
    assert.deepEqual(ids([rule('tag', 'isNot', 'anadolu rock')]), ['3', '4']);
  });

  it('matches names without minding case, accents or a Turkish i', () => {
    assert.deepEqual(ids([rule('artist', 'is', 'baris manco')]), ['1']);
    assert.deepEqual(ids([rule('artist', 'is', 'Nirvana')]), ['3']);
    assert.deepEqual(ids([rule('artist', 'contains', 'nirvana')]), ['3', '4']);
    assert.deepEqual(ids([rule('artist', 'notContains', 'nirvana')]), ['1', '2']);
    assert.deepEqual(ids([rule('album', 'contains', 'MECLİS')]), ['1']);
  });

  it('counts a song that names nobody as not being anybody', () => {
    assert.deepEqual(ids([rule('genre', 'isNot', 'grunge')]), ['1', '2', '4']);
    assert.deepEqual(ids([rule('albumArtist', 'is', 'various artists')]), ['2']);
    assert.deepEqual(ids([rule('albumArtist', 'notContains', 'various')]), ['1', '3', '4']);
  });

  it('asks a year before, after and between, leaving out a song with none', () => {
    assert.deepEqual(ids([rule('year', 'less', 1980)]), ['2']);
    assert.deepEqual(ids([rule('year', 'more', 1990)]), ['3', '4']);
    assert.deepEqual(ids([rule('year', 'between', 1981, 1991)]), ['1', '3']);
    const undated = smartListIds([song('9')], { ...emptyRules(), rules: [rule('year', 'less', 3000)] }, STATS, NOW);
    assert.deepEqual(undated, []);
  });

  it('asks when a song was added, leaving out one the phone will not date', () => {
    assert.deepEqual(ids([rule('added', 'within', 30)]), ['1']);
    assert.deepEqual(ids([rule('added', 'before', 30)]), ['2', '3']);
  });

  it('counts plays and skips, a song never played being played nought times', () => {
    assert.deepEqual(ids([rule('plays', 'more', 5)]), ['1', '3']);
    assert.deepEqual(ids([rule('plays', 'less', 5)]), ['2', '4']);
    assert.deepEqual(ids([rule('skips', 'more', 1)]), ['3']);
    assert.deepEqual(ids([rule('plays', 'between', 3, 7)]), ['2', '3']);
  });

  it('asks when a song was last played, and whether it ever was', () => {
    assert.deepEqual(ids([rule('lastPlayed', 'within', 7)]), ['1']);
    assert.deepEqual(ids([rule('lastPlayed', 'before', 30)]), ['2'], 'a song never played is not one played long ago');
    assert.deepEqual(ids([rule('lastPlayed', 'never', 0)]), ['4']);
  });

  it('measures length in minutes, leaving out a song whose length is not known', () => {
    assert.deepEqual(ids([rule('length', 'more', 5)]), ['2']);
    assert.deepEqual(ids([rule('length', 'less', 3)]), ['3']);
    assert.deepEqual(ids([rule('length', 'between', 3, 4)]), ['1'], 'four minutes ten is between three and four');
  });

  it('wants every rule met, or any one of them', () => {
    const rules = [rule('tag', 'is', 'anadolu rock'), rule('plays', 'more', 5)];
    assert.deepEqual(ids(rules), ['1']);
    assert.deepEqual(ids(rules, { match: 'any' }), ['1', '2', '3']);
  });

  it('passes over a rule that cannot be asked yet', () => {
    assert.deepEqual(ids([rule('artist', 'is', '  '), rule('plays', 'more', 5)]), ['1', '3']);
    assert.deepEqual(ids([rule('year', 'between', 1990, 1980)]), ['1', '2', '3', '4']);
  });

  it('puts the songs in the order asked for, and keeps as many as the limit says', () => {
    assert.deepEqual(ids([], { order: 'mostPlayed' }), ['1', '3', '2', '4']);
    assert.deepEqual(ids([], { order: 'leastPlayed' }), ['4', '2', '3', '1']);
    assert.deepEqual(ids([], { order: 'newest' }), ['1', '2', '3', '4'], 'an undated song last');
    assert.deepEqual(ids([], { order: 'oldest' }), ['3', '2', '1', '4'], 'an undated song last');
    assert.deepEqual(ids([], { order: 'mostPlayed', limit: 2 }), ['1', '3']);
  });

  it('shuffles with the coin it is given, and limits after shuffling', () => {
    const rules: SmartRules = { ...emptyRules(), order: 'random', limit: 3 };
    const first = smartListIds(LIBRARY, rules, STATS, NOW, () => 0);
    assert.equal(first.length, 3);
    assert.deepEqual(first, smartListIds(LIBRARY, rules, STATS, NOW, () => 0));
    assert.deepEqual([...smartListIds(LIBRARY, { ...rules, limit: null }, STATS, NOW, () => 0.5)].sort(), ['1', '2', '3', '4']);
  });

  it('counts the matches before any limit', () => {
    assert.equal(smartListMatches(LIBRARY, { ...emptyRules(), limit: 1, rules: [rule('plays', 'more', 0)] }, STATS, NOW), 3);
  });
});

describe('checking a rule', () => {
  it('says what is wrong with one', () => {
    assert.equal(ruleProblem(rule('artist', 'is', '')), 'text');
    assert.equal(ruleProblem(rule('artist', 'is', '!!')), 'text', 'punctuation alone is no name');
    assert.equal(ruleProblem(rule('artist', 'more', 'x')), 'op');
    assert.equal(ruleProblem(rule('year', 'between', 2000, 1990)), 'range');
    assert.equal(ruleProblem(rule('year', 'more', 12)), 'value');
    assert.equal(ruleProblem(rule('plays', 'less', 0)), 'value');
    assert.equal(ruleProblem(rule('added', 'within', 1.5)), 'value');
    assert.equal(ruleProblem(rule('lastPlayed', 'never', NaN)), null);
    assert.equal(ruleProblem(rule('plays', 'more', 0)), null);
  });

  it('keeps what was typed when a rule is turned to another field', () => {
    const typed = { ...newRule('artist'), op: 'contains' as const, text: 'Nirvana' };
    const genre = withField(typed, 'genre');
    assert.equal(genre.op, 'contains');
    assert.equal(genre.text, 'Nirvana');
    const tag = withField(typed, 'tag');
    assert.equal(tag.op, 'is', 'a tag cannot be contained');
    const year = withField({ ...newRule('plays'), value: 5 }, 'year');
    assert.equal(year.value, 2000, 'five is no year');
    assert.equal(withField(newRule('year'), 'lastPlayed').op, 'within');
  });
});

describe('keeping the rules', () => {
  it('reads back what it wrote', () => {
    const rules: SmartRules = {
      match: 'any',
      rules: [rule('tag', 'is', ' rock '), rule('year', 'between', 1990, 1999), rule('lastPlayed', 'never', 30)],
      limit: 50,
      order: 'random',
    };
    const back = readSmartRules(writeSmartRules(rules));
    assert.equal(back.match, 'any');
    assert.equal(back.limit, 50);
    assert.equal(back.order, 'random');
    assert.deepEqual(back.rules.map((entry) => [entry.field, entry.op, entry.text, entry.value, entry.to]), [
      ['tag', 'is', 'rock', 0, 0],
      ['year', 'between', '', 1990, 1999],
      ['lastPlayed', 'never', '', 30, 30],
    ]);
  });

  it('takes what it can of rules it cannot wholly read', () => {
    assert.deepEqual(readSmartRules(null), emptyRules());
    assert.deepEqual(readSmartRules('not json'), emptyRules());
    assert.deepEqual(readSmartRules('[1, 2]').rules, []);
    const read = readSmartRules(
      JSON.stringify({
        match: 'sometimes',
        limit: -4,
        order: 'loudest',
        rules: [
          { field: 'mood', op: 'is', text: 'happy' },
          { field: 'plays', op: 'more' },
          { field: 'genre', op: 'is', text: 'jazz' },
          null,
        ],
      })
    );
    assert.equal(read.match, 'all');
    assert.equal(read.limit, null);
    assert.equal(read.order, 'title');
    assert.deepEqual(read.rules.map((entry) => [entry.field, entry.text]), [['genre', 'jazz']]);
  });
});
