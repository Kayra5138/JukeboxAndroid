import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { stringsFor } from '../../i18n/languages.ts';
import { explain, explainEntry, nearnessWord, type Why } from '../why.ts';

const en = stringsFor('en');
const tr = stringsFor('tr');
const why = (over: Partial<Why>): Why => ({
  kind: 'near',
  seeds: ['Slowdive'],
  searched: [],
  tags: ['dream pop', 'shoegaze'],
  similarity: 0.7,
  fresh: true,
  ...over,
});

describe('saying why a song is on the list', () => {
  it('names the two artists that agree on it', () => {
    assert.equal(explain(why({ seeds: ['Slowdive', 'Ride', 'Lush'] }), en), 'Because you play Slowdive and Ride');
  });

  it('names the one artist it is like, and what it is', () => {
    assert.equal(explain(why({}), en), 'Like Slowdive · dream pop');
    assert.equal(explain(why({ tags: [] }), en), 'Like Slowdive');
  });

  it('says a song is more from an artist somebody plays', () => {
    assert.equal(explain(why({ kind: 'yours', fresh: false }), en), 'More from Slowdive · dream pop');
  });

  it('says a song by an artist somebody has is theirs, however it was come upon', () => {
    // Pomme is in the library, was not started from, and is near AURORA: what there is to say is that she is theirs.
    const line = explain(why({ kind: 'yours', seeds: ['Pomme'], via: ['AURORA'], fresh: false, tags: [], witness: 'both' }), en);
    assert.equal(line, 'More from Pomme');
  });

  it('says the same whoever it was that said the artist is near', () => {
    const lines = (['listenbrainz', 'deezer', 'both', undefined] as const).map((witness) => explain(why({ witness }), en));
    assert.equal(new Set(lines).size, 1);
    assert.equal(lines[0], 'Like Slowdive · dream pop');
  });

  it('says a song was found by the tags that were asked about', () => {
    const tagged = why({ kind: 'tags', seeds: [], searched: ['dream pop', 'shoegaze'] });
    assert.equal(explain(tagged, en), 'From the dream pop + shoegaze you play');
    assert.equal(explain(why({ kind: 'tags', seeds: [], tags: [] }), en), 'Picked for you');
  });

  it('says it in Turkish when that is the language', () => {
    assert.equal(explain(why({ seeds: ['Slowdive', 'Ride'] }), tr), 'Slowdive ve Ride dinlediğin için');
    assert.equal(explain(why({}), tr), 'Slowdive gibi · dream pop');
  });

  it('says a song kept before any of this the way it always was', () => {
    assert.equal(explainEntry({ because: 'Slowdive', familiar: false }, en), en.discover.panel.fresh('Slowdive'));
    assert.equal(explainEntry({ because: 'Slowdive', familiar: false, why: why({}) }, en), 'Like Slowdive · dream pop');
  });

  it('puts nearness in a word', () => {
    assert.equal(nearnessWord(0.9, en), 'Very close to what you play');
    assert.equal(nearnessWord(0.1, en), 'A step further out');
    assert.equal(nearnessWord(null, en), null);
  });
});
