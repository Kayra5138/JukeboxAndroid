import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inRecordOrder, inSeriesOrder, nextToPlay, orderTapes, partsOf } from '../order.ts';

const place = (positionSec: number, at: number, finished = false) => ({ positionSec, durationSec: 3600, at, finished });

describe('the order of the tapes', () => {
  it('is the ones part way through, latest first, then the new ones as they came, then the heard ones', () => {
    const tapes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const places = new Map([
      ['a', place(3600, 5, true)],
      ['b', place(120, 1)],
      ['d', place(900, 3)],
      ['e', place(4, 9)],
    ]);
    assert.deepEqual(orderTapes(tapes, places).map((tape) => tape.id), ['d', 'b', 'c', 'e', 'a']);
  });
});

describe('what a tape is played with', () => {
  const part = (id: string, album: string | null, trackNumber: number | null, filename = `${id}.mp3`) => ({
    id, album, artist: 'Reader', trackNumber, filename,
  });

  it('is the rest of its record in order, from it', () => {
    const tapes = [part('3', 'Book', 3), part('1', 'Book', 1), part('x', 'Other', 1), part('2', 'Book', 2)];
    const { tracks, index } = partsOf(tapes[3]!, tapes);
    assert.deepEqual(tracks.map((tape) => tape.id), ['1', '2', '3']);
    assert.equal(index, 1);
  });

  it('goes by the file name where the parts are not numbered, and is the tape alone with no record', () => {
    const tapes = [part('b', 'Show', null, 'Episode 10.mp3'), part('a', 'Show', null, 'Episode 9.mp3')];
    assert.deepEqual(partsOf(tapes[0]!, tapes).tracks.map((tape) => tape.id), ['a', 'b']);
    assert.deepEqual(partsOf(part('z', null, null), tapes).tracks.map((tape) => tape.id), ['z']);
  });
});

describe('what a series is carried on with at one press', () => {
  const tapes = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  it('is the one part way through that was listened to last', () => {
    const places = new Map([['a', place(300, 1)], ['c', place(120, 5)], ['b', place(3600, 9, true)]]);
    assert.equal(nextToPlay(tapes, places)?.id, 'c');
  });

  it('is the newest not yet heard where none is begun, and nothing where all are heard', () => {
    assert.equal(nextToPlay(tapes, new Map([['d', place(3600, 2, true)]]))?.id, 'c');
    const heard = new Map(tapes.map((tape) => [tape.id, place(3600, 1, true)]));
    assert.equal(nextToPlay(tapes, heard), null);
  });
});

describe('tapes chosen together', () => {
  it('play each record whole and in its order, one record after another', () => {
    const part = (id: string, album: string, trackNumber: number | null, filename: string) => ({ id, album, artist: 'A', trackNumber, filename });
    const tapes = [
      part('b2', 'Show', null, '2026-10-15 - Two.m4a'),
      part('a2', 'Book', 2, '02 - Two.m4a'),
      part('b1', 'Show', null, '2026-10-02 - One.m4a'),
      part('a1', 'Book', 1, '01 - One.m4a'),
    ];
    assert.deepEqual(inRecordOrder(tapes).map((tape) => tape.id), ['a1', 'a2', 'b1', 'b2']);
  });
});

describe('a followed show’s episodes', () => {
  it('go by the day each was filed under, whatever their tags say', () => {
    const episode = (id: string, filename: string) => ({ id, filename });
    const here = [episode('c', '2026-10-15 - C.mp3'), episode('a', '2026-09-02 - A.mp3'), episode('b', '2026-10-10 - B.mp3')];
    assert.deepEqual(inSeriesOrder(here).map((one) => one.id), ['a', 'b', 'c']);
  });
});

describe('a book taken up', () => {
  it('is at its first part not heard, where none is part way through', () => {
    const tapes = ['a', 'b', 'c'].map((id) => ({ id }));
    const places = new Map([['a', place(3600, 5, true)]]);
    assert.equal(nextToPlay(tapes, places, 'first')?.id, 'b');
    assert.equal(nextToPlay(tapes, places)?.id, 'c');
  });
});
