import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  afterMoving,
  afterRemoving,
  dividerAt,
  pendingFrom,
  placeQueued,
  queueIndex,
  queueMove,
  restoreFrom,
  shownIndex,
} from '../autoplay/section.ts';
import { readTail, restoreTail, tailOf, writeTail } from '../autoplay/tail.ts';

/*
  A queue of ten: the listener's own songs 0–5, songs picked to follow them
  6–9, the boundary at 6.
*/
describe('placeQueued', () => {
  it('puts "Add to queue" in front of the picked songs still to come', () => {
    assert.deepEqual(placeQueued(10, 6, 2, 10, true), { index: 6, autoFrom: 7 });
  });

  it('puts it in front of the next pick while a pick is playing', () => {
    assert.deepEqual(placeQueued(10, 6, 7, 10, true), { index: 8, autoFrom: 9 });
  });

  it('puts it on the end, and stops telling picks apart, once none is still to come', () => {
    assert.deepEqual(placeQueued(10, 6, 9, 10, true), { index: 10, autoFrom: -1 });
  });

  it('moves the boundary on for "Play next" ahead of it', () => {
    assert.deepEqual(placeQueued(10, 6, 2, 3, false), { index: 3, autoFrom: 7 });
    assert.deepEqual(placeQueued(10, 6, 5, 6, false), { index: 6, autoFrom: 7 });
  });

  it('keeps "Play next" out of the picks while a pick is playing', () => {
    assert.deepEqual(placeQueued(10, 6, 7, 8, false), { index: 8, autoFrom: 9 });
    // After the very last pick there are none after it.
    assert.deepEqual(placeQueued(10, 6, 9, 10, false), { index: 10, autoFrom: -1 });
  });

  it('changes nothing about a queue with no picks', () => {
    assert.deepEqual(placeQueued(10, -1, 2, 10, true), { index: 10, autoFrom: -1 });
    assert.deepEqual(placeQueued(10, -1, 2, 3, false), { index: 3, autoFrom: -1 });
  });
});

describe('afterRemoving', () => {
  it('moves the boundary up for a row above it, and not for one below', () => {
    assert.equal(afterRemoving(6, 2, 9), 5);
    assert.equal(afterRemoving(6, 7, 9), 6);
    assert.equal(afterRemoving(6, 6, 9), 6);
  });

  it('says there are none once the last pick is gone', () => {
    assert.equal(afterRemoving(9, 9, 9), -1);
    assert.equal(afterRemoving(-1, 3, 9), -1);
  });
});

describe('afterMoving', () => {
  it('leaves it where it was for moves on either side', () => {
    assert.equal(afterMoving(6, 1, 4, 10), 6);
    assert.equal(afterMoving(6, 7, 9, 10), 6);
  });

  it('makes a pick dragged above the boundary the listener’s own', () => {
    assert.equal(afterMoving(6, 8, 2, 10), 7);
  });

  it('never hands one of the listener’s songs to the picks', () => {
    // Song 2 dragged to row 8: everything down to it is theirs, so taking the picks away cannot take it.
    assert.equal(afterMoving(6, 2, 8, 10), 9);
    assert.equal(afterMoving(6, 2, 9, 10), -1);
  });

  it('keeps a row dropped right on the boundary on the side it came from', () => {
    assert.equal(afterMoving(6, 2, 5, 10), 6);
    assert.equal(afterMoving(6, 8, 6, 10), 6);
  });
});

describe('pendingFrom', () => {
  it('is the boundary, or the song after the one playing where that is later', () => {
    assert.equal(pendingFrom(6, 2, 10), 6);
    assert.equal(pendingFrom(6, 7, 10), 8);
    assert.equal(pendingFrom(6, 9, 10), -1);
    assert.equal(pendingFrom(-1, 2, 10), -1);
  });
});

describe('restoreFrom', () => {
  it('finds the picks at the end of the queue', () => {
    assert.equal(restoreFrom(['a', 'b', 'p1', 'p2'], ['p1', 'p2']), 2);
  });

  it('allows for a queue that was written before the last picks went in', () => {
    assert.equal(restoreFrom(['a', 'b', 'p1'], ['p1', 'p2', 'p3']), 2);
  });

  it('finds none in a queue that ends some other way', () => {
    assert.equal(restoreFrom(['a', 'b', 'c'], ['p1', 'p2']), -1);
    assert.equal(restoreFrom([], ['p1']), -1);
    assert.equal(restoreFrom(['a'], []), -1);
  });
});

describe('the tail note', () => {
  it('goes round through words', () => {
    const note = tailOf(['a', 'b', 'p1', 'p2'].map((id) => ({ id })), 2, false);
    assert.deepEqual(note, { ids: ['p1', 'p2'], head: 'a', dismissed: false, similar: false });
    assert.deepEqual(readTail(writeTail(note)), note);
    const similar = tailOf([{ id: 'a' }], -1, false, true);
    assert.deepEqual(readTail(writeTail(similar)), { ids: [], head: 'a', dismissed: false, similar: true });
  });

  it('reads anything unreadable as nothing', () => {
    const nothing = { ids: [], head: null, dismissed: false, similar: false };
    assert.deepEqual(readTail('not json'), nothing);
    assert.deepEqual(readTail(null), nothing);
    assert.deepEqual(readTail('{"ids":[1,"x"],"dismissed":"yes","similar":1}'), { ...nothing, ids: ['x'] });
    // A note from before there were similar queues.
    assert.deepEqual(readTail('{"ids":["p"],"head":"a","dismissed":false}'), { ids: ['p'], head: 'a', dismissed: false, similar: false });
  });

  it('is believed only of the queue it was written about', () => {
    const note = { ids: ['p1', 'p2'], head: 'a', dismissed: true, similar: true };
    assert.deepEqual(restoreTail(['a', 'b', 'p1', 'p2'], note), { autoFrom: 2, dismissed: true, similar: true });
    assert.deepEqual(restoreTail(['z', 'b', 'p1', 'p2'], note), { autoFrom: -1, dismissed: false, similar: false });
  });
});

/*
  On screen the heading is a row of its own: rows 0–5 are songs 0–5, row 6 is
  the heading, rows 7–10 are songs 6–9.
*/
describe('rows on screen', () => {
  it('puts the heading above the first pick', () => {
    assert.equal(dividerAt(6, 10), 6);
    assert.equal(dividerAt(10, 10), -1);
    assert.equal(dividerAt(-1, 10), -1);
  });

  it('turns rows into queue positions and back', () => {
    assert.equal(queueIndex(5, 6), 5);
    assert.equal(queueIndex(6, 6), -1);
    assert.equal(queueIndex(7, 6), 6);
    assert.equal(shownIndex(5, 6), 5);
    assert.equal(shownIndex(6, 6), 7);
    assert.equal(queueIndex(4, -1), 4);
  });

  it('turns a drag into the move the queue makes', () => {
    // Among the listener's own songs, and among the picks.
    assert.deepEqual(queueMove(1, 4, 6), { from: 1, to: 4 });
    assert.deepEqual(queueMove(8, 10, 6), { from: 7, to: 9 });
    // A pick dragged up past the heading.
    assert.deepEqual(queueMove(9, 2, 6), { from: 8, to: 2 });
    // A song of theirs dragged down past it.
    assert.deepEqual(queueMove(1, 9, 6), { from: 1, to: 8 });
    // Dropped on the heading's own row: from above it lands after the heading, from below before it.
    assert.deepEqual(queueMove(1, 6, 6), { from: 1, to: 5 });
    assert.deepEqual(queueMove(9, 6, 6), { from: 8, to: 6 });
    // The first pick dropped on the heading is where it was.
    assert.equal(queueMove(7, 6, 6), null);
    assert.equal(queueMove(6, 3, 6), null);
    assert.deepEqual(queueMove(2, 5, -1), { from: 2, to: 5 });
  });
});
