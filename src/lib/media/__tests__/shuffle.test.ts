import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { artistKey, shuffled, spreadShuffle } from '../shuffle.ts';

const by = (item: { artist: string }) => item.artist;

/** A queue of `artists.length` artists with `each` tracks apiece. */
function library(artists: string[], each: number) {
  return artists.flatMap((artist) =>
    Array.from({ length: each }, (_, i) => ({ artist, title: `${artist} ${i}` }))
  );
}

/** The longest run of one artist anywhere in the list. */
function longestRun(items: { artist: string }[]): number {
  let longest = 0;
  let run = 0;
  for (let i = 0; i < items.length; i += 1) {
    run = i > 0 && items[i]!.artist === items[i - 1]!.artist ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

describe('shuffled', () => {
  it('leaves the original list alone', () => {
    const original = [1, 2, 3, 4, 5];
    shuffled(original);
    assert.deepEqual(original, [1, 2, 3, 4, 5]);
  });

  it('keeps every item exactly once', () => {
    const original = [...Array(50).keys()];
    const result = shuffled(original);

    assert.equal(result.length, original.length);
    assert.deepEqual([...result].sort((a, b) => a - b), original);
  });

  it('copes with nothing and with one', () => {
    assert.deepEqual(shuffled([]), []);
    assert.deepEqual(shuffled(['only']), ['only']);
  });

  it('reaches every position, rather than rotating', () => {
    // Fisher-Yates done wrong still returns a permutation; what says it is
    // right is that any item can land anywhere.
    const seen = new Set<number>();
    for (let run = 0; run < 200; run += 1) {
      seen.add(shuffled([0, 1, 2, 3, 4]).indexOf(0));
    }
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
  });
});

describe('spreadShuffle', () => {
  it('keeps every item exactly once', () => {
    const items = library(['a', 'b', 'c'], 7);
    const result = spreadShuffle(items, by);

    assert.equal(result.length, items.length);
    assert.deepEqual(
      [...result].map((entry) => entry.title).sort(),
      [...items].map((entry) => entry.title).sort()
    );
  });

  it('leaves the original list alone', () => {
    const items = library(['a', 'b'], 3);
    const before = items.map((entry) => entry.title);
    spreadShuffle(items, by);
    assert.deepEqual(items.map((entry) => entry.title), before);
  });

  it('copes with nothing, with one, and with two', () => {
    assert.deepEqual(spreadShuffle([], by), []);
    assert.deepEqual(spreadShuffle([{ artist: 'a' }], by), [{ artist: 'a' }]);
    assert.equal(spreadShuffle(library(['a'], 2), by).length, 2);
  });

  /*
    The whole point, and the thing a shuffle is judged on once it is known to
    be one. Both bounds below were measured over fifty thousand runs rather
    than guessed at, and both have room to spare: three artists of ten tracks
    never ran past two, and a fair shuffle over the same queue put two together
    on a third of all adjacent pairs against this one's one-and-a-half percent.
  */
  it('never lets an artist run past a pair', () => {
    const items = library(['a', 'b', 'c'], 10);

    for (let run = 0; run < 300; run += 1) {
      assert.ok(longestRun(spreadShuffle(items, by)) <= 2);
    }
  });

  it('leaves far fewer of an artist touching than a fair shuffle does', () => {
    const items = library(['a', 'b', 'c'], 10);

    const touching = (order: (typeof items)[number][]) =>
      order.filter((entry, i) => i > 0 && order[i - 1]!.artist === entry.artist).length;

    let spread = 0;
    let fair = 0;
    for (let run = 0; run < 300; run += 1) {
      spread += touching(spreadShuffle(items, by));
      fair += touching(shuffled(items));
    }
    const pairs = 300 * (items.length - 1);

    assert.ok(spread / pairs < 0.05, `spread left ${((100 * spread) / pairs).toFixed(1)}% touching`);
    // The other half of the claim. Without it a change that made both orders
    // equally clumpy would still pass the line above.
    assert.ok(fair / pairs > 0.2, `fair shuffle left only ${((100 * fair) / pairs).toFixed(1)}%`);
  });

  it('spreads an artist who is most of the queue as evenly as there is room for', () => {
    /*
      Twenty tracks by one artist and five by another cannot avoid the first
      artist touching itself: five tracks make six gaps, so something has to
      sit four deep somewhere. It gets within two of that floor, where a fair
      shuffle over the same queue has been seen to run nineteen deep.
    */
    const items = [...library(['a'], 20), ...library(['b'], 5)];
    for (let run = 0; run < 300; run += 1) {
      assert.ok(longestRun(spreadShuffle(items, by)) <= 6);
    }
  });

  it('is a plain shuffle when everything is by one artist', () => {
    const items = library(['a'], 6);
    const seen = new Set<string>();
    for (let run = 0; run < 200; run += 1) {
      seen.add(spreadShuffle(items, by).map((entry) => entry.title).join());
    }
    // 6! is 720; 200 draws from a real shuffle will not keep landing on one.
    assert.ok(seen.size > 50, `only ${seen.size} distinct orders`);
  });

  it('does not open with the artist it is being dealt after', () => {
    const items = library(['a', 'b'], 6);
    for (let run = 0; run < 200; run += 1) {
      assert.notEqual(spreadShuffle(items, by, 'a')[0]!.artist, 'a');
    }
  });

  it('opens with what it has when that is all one artist', () => {
    const items = library(['a'], 4);
    assert.equal(spreadShuffle(items, by, 'a')[0]!.artist, 'a');
  });

  it('does not settle into one lattice', () => {
    // Evenly spaced is not the same as predictable: the same queue shuffled
    // twice should not deal the same rows.
    const items = library(['a', 'b', 'c'], 8);
    const seen = new Set<string>();
    for (let run = 0; run < 100; run += 1) {
      seen.add(spreadShuffle(items, by).map((entry) => entry.title).join());
    }
    assert.ok(seen.size > 90, `only ${seen.size} distinct orders in 100`);
  });
});

describe('artistKey', () => {
  it('reads casing and accents as the same artist', () => {
    assert.equal(artistKey({ artist: 'AURORA' }), artistKey({ artist: 'Aurora' }));
    assert.equal(artistKey({ artist: 'Sigur Rós' }), artistKey({ artist: 'Sigur Ros' }));
  });

  it('gathers everything untagged into one group', () => {
    assert.equal(artistKey({ artist: null }), artistKey({}));
  });

  it('keeps different artists apart', () => {
    assert.notEqual(artistKey({ artist: 'Feint' }), artistKey({ artist: 'Fein' }));
  });
});
