import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromItunesGenre, isGenre, rankGenres } from '../genres.ts';

describe('isGenre', () => {
  it('recognises a genre however it is spelled', () => {
    assert.ok(isGenre('dark wave'));
    assert.ok(isGenre('  Dark Wave  '));
  });

  it('recognises a Turkish genre written in capitals', () => {
    // `İ`.toLowerCase() is `i` followed by a combining dot above, which is in
    // no vocabulary — and the vocabulary really does list Turkish genres.
    assert.ok(isGenre('ÖZGÜN MÜZİK'));
    assert.ok(isGenre('Zeybek'));
    assert.ok(isGenre('ARABESK'));
  });

  it('recognises a decomposed spelling', () => {
    assert.ok(isGenre('özgün müzik'.normalize('NFD')));
    assert.ok(isGenre('ÖZGÜN MÜZİK'.normalize('NFD')));
  });

  it('rejects a tag that describes a genre rather than naming one', () => {
    assert.ok(!isGenre('seen live'));
    assert.ok(!isGenre('female vocals'));
    assert.ok(!isGenre('japanese'));
  });
});

describe('fromItunesGenre', () => {
  it('says Apple labels the way MusicBrainz says them', () => {
    // Both end up in the same column, and the counts group on the exact
    // string — `hip-hop/rap` beside `hip hop` is one genre halved.
    assert.deepEqual(fromItunesGenre('Hip-Hop/Rap'), ['hip hop']);
    assert.deepEqual(fromItunesGenre('Alternative'), ['alternative rock']);
    assert.deepEqual(fromItunesGenre('Singer/Songwriter'), ['singer-songwriter']);
  });

  it('splits a label that names two genres', () => {
    assert.deepEqual(fromItunesGenre('R&B/Soul'), ['r&b', 'soul']);
  });

  it('handles the Turkish labels no other source produces', () => {
    assert.deepEqual(fromItunesGenre('Türkçe Pop'), ['turkish pop']);
    assert.deepEqual(fromItunesGenre('TÜRKÇE POP'), ['turkish pop']);
    assert.deepEqual(fromItunesGenre('Arabesk'), ['arabesk']);
  });

  it('passes a label the vocabulary already agrees with straight through', () => {
    assert.deepEqual(fromItunesGenre('J-Pop'), ['j-pop']);
    assert.deepEqual(fromItunesGenre('Electronic'), ['electronic']);
  });

  it('drops what MusicBrainz has no word for', () => {
    // These say where music was used, not what it is, and inventing a genre
    // for them would put a word in the statistics nothing else can agree with.
    assert.deepEqual(fromItunesGenre('Anime'), []);
    assert.deepEqual(fromItunesGenre('Soundtrack'), []);
  });
});

describe('rankGenres', () => {
  it('weighs an earlier source more heavily than a later one', () => {
    assert.deepEqual(
      rankGenres([{ name: 'dark wave', count: 1 }], [{ name: 'electronic', count: 1 }]),
      ['dark wave', 'electronic']
    );
  });

  it('adds up the same label appearing in two sources', () => {
    assert.deepEqual(
      rankGenres(
        [{ name: 'gothic rock', count: 1 }, { name: 'pop', count: 2 }],
        [{ name: 'gothic rock', count: 5 }]
      ),
      ['gothic rock', 'pop']
    );
  });

  it('drops labels the vocabulary does not know', () => {
    assert.deepEqual(
      rankGenres([{ name: 'seen live', count: 99 }, { name: 'gothic rock', count: 1 }]),
      ['gothic rock']
    );
  });

  it('returns one canonical spelling whatever case it was given', () => {
    assert.deepEqual(
      rankGenres([{ name: 'Dark Wave', count: 1 }, { name: 'dark wave', count: 1 }]),
      ['dark wave']
    );
  });
});
