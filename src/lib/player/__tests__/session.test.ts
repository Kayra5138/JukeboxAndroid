import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  beginSession,
  countsAsPlay,
  finishSession,
  minimumSecondsFor,
  setSessionPlaying,
} from '../session.ts';
import { track } from '../../__tests__/support.ts';

const song = track({ id: '1', title: 'Akuma no Ko', durationSec: 240 });

describe('minimumSecondsFor', () => {
  it('asks for the usual thirty seconds of an ordinary track', () => {
    assert.equal(minimumSecondsFor(track({ id: '1', durationSec: 240 })), 30);
    assert.equal(minimumSecondsFor(track({ id: '1', durationSec: 60 })), 30);
  });

  it('asks for half of anything too short to reach thirty', () => {
    assert.equal(minimumSecondsFor(track({ id: '1', durationSec: 40 })), 20);
    assert.equal(minimumSecondsFor(track({ id: '1', durationSec: 59 })), 29.5);
  });

  it('falls back to thirty seconds when the length is not known', () => {
    // The media store returns 0 for a duration it has no value for, and halving
    // that would make skipping past such a track count as having played it.
    assert.equal(minimumSecondsFor(track({ id: '1', durationSec: 0 })), 30);
  });
});

describe('countsAsPlay', () => {
  it('counts a track heard to the end however short it was', () => {
    assert.equal(
      countsAsPlay({ track: song, startedAt: 0, secondsPlayed: 2, completed: true }),
      true
    );
  });

  it('drops a skip', () => {
    assert.equal(
      countsAsPlay({ track: song, startedAt: 0, secondsPlayed: 4, completed: false }),
      false
    );
  });

  it('counts a listen that reached the threshold exactly', () => {
    assert.equal(
      countsAsPlay({ track: song, startedAt: 0, secondsPlayed: 30, completed: false }),
      true
    );
  });

  it('counts half of a short track', () => {
    const short = track({ id: '2', durationSec: 40 });
    assert.equal(
      countsAsPlay({ track: short, startedAt: 0, secondsPlayed: 20, completed: false }),
      true
    );
    assert.equal(
      countsAsPlay({ track: short, startedAt: 0, secondsPlayed: 19, completed: false }),
      false
    );
  });
});

describe('a listening session', () => {
  it('counts from the moment it starts playing', () => {
    const session = beginSession(song, true, 1_000);
    const play = finishSession(session, true, 41_000);

    assert.equal(play.secondsPlayed, 40);
    assert.equal(play.startedAt, 1_000);
    assert.equal(play.completed, true);
    assert.equal(play.track, song);
  });

  it('counts nothing while it has never been played', () => {
    const session = beginSession(song, false, 1_000);
    assert.equal(finishSession(session, false, 99_000).secondsPlayed, 0);
  });

  it('bills nothing to a track that was only queued', () => {
    // "Add to queue" from an empty queue hands the player a queue without
    // starting it, and the player announces that as a track change. Opening the
    // session as though it were playing charged the track for every minute the
    // app was left open afterwards, and ten of them read as a finished listen.
    const queued = finishSession(beginSession(song, false, 0), false, 600_000);
    assert.equal(queued.secondsPlayed, 0);
    assert.equal(countsAsPlay(queued), false);

    const played = finishSession(beginSession(song, true, 0), false, 600_000);
    assert.equal(played.secondsPlayed, 600);
    assert.equal(countsAsPlay(played), true);
  });

  it('counts a listen from the moment playback actually starts', () => {
    // Which is how the queued track above is still counted properly once the
    // user does press play: the session is opened idle and the player's own
    // report of playing is what starts the clock.
    let session = beginSession(song, false, 0);
    session = setSessionPlaying(session, true, 600_000);

    assert.equal(finishSession(session, false, 640_000).secondsPlayed, 40);
  });

  it('stops counting while paused and starts again on resume', () => {
    let session = beginSession(song, true, 0);
    session = setSessionPlaying(session, false, 10_000);
    session = setSessionPlaying(session, true, 70_000);

    assert.equal(finishSession(session, false, 75_000).secondsPlayed, 15);
  });

  it('is unmoved by the same state being reported twice', () => {
    // The player re-announces its state on things like an audio focus change,
    // and folding the same stretch in twice would double-count it.
    let session = beginSession(song, true, 0);
    session = setSessionPlaying(session, true, 5_000);
    session = setSessionPlaying(session, false, 10_000);
    session = setSessionPlaying(session, false, 30_000);

    assert.equal(finishSession(session, false, 60_000).secondsPlayed, 10);
  });

  it('does not count a seek as time listened', () => {
    // The count comes from the wall clock rather than the playback position,
    // so dragging the scrubber cannot inflate it.
    const session = beginSession(song, true, 0);
    assert.equal(finishSession(session, false, 12_000).secondsPlayed, 12);
  });

  it('leaves the session it was given untouched', () => {
    const session = beginSession(song, true, 0);
    setSessionPlaying(session, false, 5_000);

    assert.equal(session.resumedAt, 0);
    assert.equal(session.accumulatedMs, 0);
  });
});
