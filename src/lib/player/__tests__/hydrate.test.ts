import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hydrationFrom, readPlayerState, sameMoment, toggleCommand } from '../hydrate.ts';
import type { PlayerStatus, QueueEntry } from '../../../../modules/jukebox-audio/index.ts';

function entry(id: string, fields: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id,
    uri: `content://media/external/audio/media/${id}`,
    title: `Track ${id}`,
    artist: null,
    album: null,
    artworkUri: null,
    durationSec: 200,
    trackNumber: null,
    filename: null,
    folder: null,
    ...fields,
  };
}

function status(fields: Partial<PlayerStatus> = {}): PlayerStatus {
  return {
    connected: true,
    isPlaying: true,
    trackId: '1',
    index: 0,
    positionSec: 12,
    durationSec: 200,
    shuffle: false,
    repeat: 'off',
    speed: 1,
    pitch: 1,
    ...fields,
  };
}

describe('hydrationFrom', () => {
  it('has nothing to restore before the session connects', () => {
    // The queue reads back empty until then, which is indistinguishable from a
    // cold start — so believing it would clear a player that is still going.
    assert.equal(hydrationFrom({ connected: false }, []), null);
  });

  it('has nothing to restore on an ordinary cold start', () => {
    assert.equal(hydrationFrom(status({ trackId: null, index: -1 }), []), null);
  });

  it('brings back the queue the service kept playing', () => {
    const restored = hydrationFrom(status({ index: 1, trackId: '2' }), [
      entry('1'),
      entry('2'),
      entry('3'),
    ]);

    assert.equal(restored?.queue.length, 3);
    assert.equal(restored?.currentIndex, 1);
    assert.equal(restored?.current?.id, '2');
    assert.equal(restored?.isPlaying, true);
  });

  it('takes speed, pitch, shuffle and repeat from the player', () => {
    // Whatever the app last wrote down describes a different playback than the
    // one still audible; the player is the one that knows.
    const restored = hydrationFrom(
      status({ shuffle: true, repeat: 'all', speed: 1.25, pitch: 0.9 }),
      [entry('1')]
    );

    assert.equal(restored?.shuffle, true);
    assert.equal(restored?.repeat, 'all');
    assert.equal(restored?.speed, 1.25);
    assert.equal(restored?.pitch, 0.9);
  });

  it('trusts the index over the id, so a track queued twice resolves', () => {
    const restored = hydrationFrom(status({ index: 2, trackId: '1' }), [
      entry('1'),
      entry('2'),
      entry('1'),
    ]);

    assert.equal(restored?.currentIndex, 2);
  });

  it('falls back to the id when the index says nothing', () => {
    const restored = hydrationFrom(status({ index: -1, trackId: '3' }), [
      entry('1'),
      entry('2'),
      entry('3'),
    ]);

    assert.equal(restored?.currentIndex, 2);
    assert.equal(restored?.current?.id, '3');
  });

  it('keeps the queue when it cannot work out which entry is playing', () => {
    // Losing the queue over an unresolvable index is the very failure this
    // exists to prevent.
    const restored = hydrationFrom(status({ index: 9, trackId: 'gone' }), [entry('1'), entry('2')]);

    assert.equal(restored?.queue.length, 2);
    assert.equal(restored?.currentIndex, -1);
    assert.equal(restored?.current, null);
  });

  it('carries the fields the player was handed back into whole tracks', () => {
    const restored = hydrationFrom(status(), [
      entry('1', {
        title: 'Kaikai Kitan',
        artist: 'Eve',
        album: 'Smile',
        durationSec: 231,
        trackNumber: 4,
        filename: 'kaikai.mp3',
        folder: 'Music/Eve/',
      }),
    ]);

    assert.deepEqual(restored?.current, {
      id: '1',
      uri: 'content://media/external/audio/media/1',
      title: 'Kaikai Kitan',
      artist: 'Eve',
      album: 'Smile',
      artworkUri: null,
      durationSec: 231,
      trackNumber: 4,
      filename: 'kaikai.mp3',
      folder: 'Music/Eve/',
      // The player was never told when the file arrived — nothing about playing
      // it depends on that — so a queue recovered from it cannot say either.
      addedAt: null,
    });
  });

  it('keeps the positions aligned when an entry came back incomplete', () => {
    const restored = hydrationFrom(status({ index: 1 }), [
      entry('1', { uri: null, durationSec: null }),
      entry('2'),
    ]);

    assert.equal(restored?.queue.length, 2);
    assert.equal(restored?.queue[0]?.durationSec, 0);
    assert.equal(restored?.current?.id, '2');
  });

  it('assumes nothing is playing when the player did not say', () => {
    const restored = hydrationFrom({ connected: true }, [entry('1')]);

    assert.equal(restored?.isPlaying, false);
    assert.equal(restored?.speed, 1);
    assert.equal(restored?.repeat, 'off');
  });
});

describe('sameMoment', () => {
  it('accepts two readings taken while nothing moved', () => {
    assert.equal(sameMoment(status({ index: 2 }), status({ index: 2 })), true);
  });

  it('rejects a pair the player advanced between', () => {
    assert.equal(
      sameMoment(status({ index: 0, trackId: '1' }), status({ index: 1, trackId: '2' })),
      false
    );
  });

  it('rejects a pair the session was lost between', () => {
    assert.equal(sameMoment(status(), { connected: false }), false);
  });

  it('reads a missing index and track the same as none', () => {
    assert.equal(sameMoment({ connected: true }, status({ index: -1, trackId: null })), true);
  });
});

/**
 * A player that answers from a script. The last status stands in for every
 * further read, so a test only has to write out the readings that differ.
 */
function reader(statuses: PlayerStatus[], entries: QueueEntry[] = []) {
  let statusCalls = 0;
  let queueCalls = 0;
  return {
    get statusCalls() {
      return statusCalls;
    },
    get queueCalls() {
      return queueCalls;
    },
    status: async () => statuses[Math.min(statusCalls++, statuses.length - 1)]!,
    queue: async () => {
      queueCalls += 1;
      return entries;
    },
  };
}

/** Time that only moves when something waits for it, so nothing has to. */
function clock() {
  let at = 0;
  return { now: () => at, sleep: async (ms: number) => void (at += ms) };
}

const polling = () => ({
  timeoutMs: 60_000,
  pollMs: (waited: number) => (waited < 5_000 ? 200 : 2_000),
  snapshotAttempts: 3,
  ...clock(),
});

describe('readPlayerState', () => {
  it('reports silence, not an empty player, when the session never answers', async () => {
    // The difference is the whole point: concluding "empty" here threw away the
    // app's record of a queue the foreground service was still playing, and
    // wrote the stored shuffle and repeat over the modes it was playing under.
    const player = reader([{ connected: false }]);

    assert.deepEqual(await readPlayerState(player, polling()), { seen: false });
    assert.equal(player.queueCalls, 0);
  });

  it('reports an empty player as an empty player', async () => {
    const player = reader([status({ trackId: null, index: -1 })], []);

    assert.deepEqual(await readPlayerState(player, polling()), { seen: true, state: null });
  });

  it('keeps asking well past the point a connection stops looking likely', async () => {
    // Answering at 5.2 seconds used to be met with an app that had already
    // given up and decided the player was empty.
    const late: PlayerStatus[] = [
      ...Array.from({ length: 30 }, () => ({ connected: false })),
      status({ index: 1, trackId: '2' }),
    ];
    const player = reader(late, [entry('1'), entry('2')]);

    const reading = await readPlayerState(player, polling());

    assert.equal(reading.seen, true);
    assert.equal(reading.seen && reading.state?.current?.id, '2');
  });

  it('gives up once the answer has stopped mattering', async () => {
    const player = reader([{ connected: false }]);

    const reading = await readPlayerState(player, {
      ...polling(),
      abandoned: () => player.statusCalls >= 3,
    });

    assert.deepEqual(reading, { seen: false });
    assert.equal(player.statusCalls, 3);
  });

  it('pairs the queue with the reading taken after it', async () => {
    // The status and the queue are separate hops onto the main thread, and a
    // service that advanced between them left the index describing one track
    // and the app naming — and billing the listening to — another.
    const player = reader(
      [
        status({ index: 0, trackId: '1' }),
        status({ index: 1, trackId: '2' }),
        status({ index: 1, trackId: '2' }),
      ],
      [entry('1'), entry('2')]
    );

    const reading = await readPlayerState(player, polling());

    assert.equal(reading.seen && reading.state?.currentIndex, 1);
    assert.equal(reading.seen && reading.state?.current?.id, '2');
  });

  it('settles for the closest pair rather than chasing a player that keeps moving', async () => {
    const player = reader(
      [0, 1, 2, 3, 4, 5].map((index) => status({ index, trackId: String(index + 1) })),
      [entry('1'), entry('2'), entry('3'), entry('4'), entry('5'), entry('6')]
    );

    const reading = await readPlayerState(player, polling());

    assert.equal(player.queueCalls, 3);
    // The last reading taken, which is at least the freshest one on offer.
    assert.equal(reading.seen && reading.state?.currentIndex, 3);
  });

  it('reports silence when the session is lost mid-read', async () => {
    const player = reader([status(), { connected: false }], [entry('1')]);

    assert.deepEqual(await readPlayerState(player, polling()), { seen: false });
  });
});

describe('toggleCommand', () => {
  it('pauses what is playing and plays what is not', () => {
    assert.equal(toggleCommand(status({ isPlaying: true })), 'pause');
    assert.equal(toggleCommand(status({ isPlaying: false })), 'play');
  });

  it('plays when the player has not answered yet', () => {
    // Reading this off the app's own copy is what sent the wrong command after
    // audio focus was lost, or after the notification's button was pressed.
    assert.equal(toggleCommand({ connected: false }), 'play');
  });
});
