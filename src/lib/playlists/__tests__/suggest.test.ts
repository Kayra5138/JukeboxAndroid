import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suggestForPlaylist, type Candidate } from '../suggest.ts';

const track = (
  trackId: string,
  tags: string[],
  extra: Partial<Candidate> = {}
): Candidate => ({ trackId, tags, artist: null, plays: 0, completed: 0, ...extra });

/** A library where `rock` is everywhere and `shoegaze` is rare. */
const counts = new Map([
  ['rock', 90],
  ['metal', 40],
  ['shoegaze', 4],
  ['dream pop', 5],
  ['jazz', 20],
]);
const TOTAL = 100;

const suggest = (
  members: Candidate[],
  candidates: Candidate[],
  limit = 10
) =>
  suggestForPlaylist({
    members,
    candidates,
    libraryTagCounts: counts,
    libraryTotal: TOTAL,
    limit,
  });

describe('suggestForPlaylist', () => {
  it('has nothing to say about an empty list', () => {
    assert.deepEqual(suggest([], [track('a', ['shoegaze'])]), []);
  });

  it('puts the track sharing the rare tag above the one sharing the common tag', () => {
    const members = [track('m1', ['shoegaze', 'rock']), track('m2', ['shoegaze', 'rock'])];
    const found = suggest(members, [
      track('common', ['rock']),
      track('rare', ['shoegaze']),
    ]);

    assert.equal(found[0].trackId, 'rare');
    assert.ok(found[0].score > (found[1]?.score ?? 0));
  });

  it('lets a tag carried by most of the library count for almost nothing', () => {
    // Not zero — a match is still a match, and with nothing else to go on it
    // is the best that can be said. But `rock` is on ninety of a hundred
    // tracks and `shoegaze` on four, and the gap between them should be the
    // difference between a shrug and an identification.
    const common = suggest([track('m1', ['rock'])], [track('a', ['rock'])]);
    const rare = suggest([track('m1', ['shoegaze'])], [track('a', ['shoegaze'])]);

    assert.ok(common[0].score > 0);
    assert.ok(rare[0].score > common[0].score * 20);
  });

  it('drops a tag that every single track carries', () => {
    // At that point it describes the library and nothing else.
    const everywhere = new Map([['owned', 100]]);
    assert.deepEqual(
      suggestForPlaylist({
        members: [track('m1', ['owned'])],
        candidates: [track('a', ['owned'])],
        libraryTagCounts: everywhere,
        libraryTotal: 100,
      }),
      []
    );
  });

  it('says which tags earned the place', () => {
    const members = [track('m1', ['shoegaze', 'dream pop', 'rock'])];
    const [first] = suggest(members, [track('a', ['shoegaze', 'dream pop', 'rock'])]);

    assert.deepEqual(first.reasons, ['shoegaze', 'dream pop']);
  });

  it('leaves out what the list already holds', () => {
    const members = [track('m1', ['shoegaze'])];
    const found = suggest(members, [track('m1', ['shoegaze']), track('a', ['shoegaze'])]);

    assert.deepEqual(
      found.map((entry) => entry.trackId),
      ['a']
    );
  });

  it('leaves out a track with nothing in common', () => {
    const members = [track('m1', ['shoegaze'])];
    assert.deepEqual(suggest(members, [track('a', ['jazz'])]), []);
  });

  it('does not let a heavily tagged track win on volume alone', () => {
    const members = [track('m1', ['shoegaze'])];
    const found = suggest(members, [
      track('focused', ['shoegaze']),
      track('everything', ['shoegaze', 'rock', 'metal', 'jazz', 'dream pop', 'a', 'b', 'c']),
    ]);

    assert.equal(found[0].trackId, 'focused');
  });

  it('prefers an artist the list already has', () => {
    const members = [track('m1', ['shoegaze'], { artist: 'Slowdive' })];
    const found = suggest(members, [
      track('stranger', ['shoegaze'], { artist: 'Someone Else' }),
      track('known', ['shoegaze'], { artist: 'slowdive ' }),
    ]);

    assert.equal(found[0].trackId, 'known');
  });

  it('pushes down a track that gets skipped every time', () => {
    const members = [track('m1', ['shoegaze'])];
    const found = suggest(members, [
      track('skipped', ['shoegaze'], { plays: 10, completed: 0 }),
      track('finished', ['shoegaze'], { plays: 10, completed: 10 }),
    ]);

    assert.equal(found[0].trackId, 'finished');
    assert.ok(found[1].score < found[0].score);
  });

  it('does not call one abandoned play a habit', () => {
    const members = [track('m1', ['shoegaze'])];
    const found = suggest(members, [
      track('once', ['shoegaze'], { plays: 1, completed: 0 }),
      track('never', ['shoegaze'], { plays: 0, completed: 0 }),
    ]);

    assert.equal(found[0].score, found[1].score);
  });

  it('counts a tag once however often a track repeats it', () => {
    const doubled = suggest(
      [track('m1', ['shoegaze', 'shoegaze'])],
      [track('a', ['shoegaze'])]
    );
    const single = suggest([track('m1', ['shoegaze'])], [track('a', ['shoegaze'])]);

    assert.equal(doubled[0].score, single[0].score);
  });

  it('gives the same answer twice for the same library', () => {
    const members = [track('m1', ['shoegaze'])];
    const candidates = [
      track('b', ['shoegaze']),
      track('a', ['shoegaze']),
      track('c', ['shoegaze']),
    ];

    assert.deepEqual(
      suggest(members, candidates).map((entry) => entry.trackId),
      suggest(members, [...candidates].reverse()).map((entry) => entry.trackId)
    );
  });

  it('gives back no more than it was asked for', () => {
    const members = [track('m1', ['shoegaze'])];
    const candidates = Array.from({ length: 30 }, (_, index) =>
      track(`t${index}`, ['shoegaze'])
    );

    assert.equal(suggest(members, candidates, 5).length, 5);
  });
});
