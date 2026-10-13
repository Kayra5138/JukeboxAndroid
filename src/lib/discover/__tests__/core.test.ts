import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_AGAIN_MS, BUILD_EVERY_MS, EMPTY, FILE_MISSING, NO_MATCH_SHOWN_MS, RETRY_AFTER_MS, STAGE_WAIT_MS, STOPPED, UNDO_MS,
  initial, itemOf, reduce, wakeAt, wanted,
  type Effect, type Event, type Item, type Song, type State,
} from '../core.ts';
import { DAY, DEFAULT_SETTINGS, songKey, type DiscoverSettings } from '../policy.ts';
import type { DownloadJob, DownloadStatus } from '../../youtube/types.ts';
import type { Track } from '../../types.ts';

/*
  The list, held to on a desk: a clock moved by hand, a queue that is whatever
  each reading says it is, and a player that is whatever it is said to be.
  Nothing is done here. What would be done is read off the effects.
*/

const song = (n: number, familiar = n % 2 === 0): Song => ({
  recordingMbid: `recording-${String(n).padStart(3, '0')}`,
  title: `Song ${n}`,
  artist: `Artist ${n}`,
  artistMbid: `artist-${n}`,
  release: null,
  coverUrl: null,
  because: 'Seed',
  familiar,
  score: 1000 - n,
});
const id = (n: number) => song(n).recordingMbid;
const track = (jobId: string): Track => ({
  id: `discover:${jobId}`, uri: `file:///discover/${jobId}.opus`, title: jobId, artist: null, album: null, artworkUri: null,
  durationSec: 200, trackNumber: null, filename: `${jobId}.opus`, folder: null,
} as Track);
const job = (key: string, status: DownloadStatus, more: Partial<DownloadJob> = {}): DownloadJob => ({
  id: `job-${key}`, discoverKey: key, status, progress: 0, trackId: null, error: null, described: false, format: 'original',
  folder: 'Music', video: { id: 'video', url: '', title: '', channel: '', thumbnail: null, duration: null },
  ...more,
});

const WIFI = { connected: true, wifi: true };
const MOBILE = { connected: true, wifi: false };
const NOBODY: ReadonlySet<string> = new Set();

/** A list being worked through: the state, the time, and everything that was to be done along the way. */
class Desk {
  state: State;
  now = 1_000_000_000_000;
  done: Effect[] = [];

  constructor(settings: Partial<DiscoverSettings> = {}, songs = 60, listed = true) {
    const pool = Array.from({ length: songs }, (_, n) => song(n));
    this.state = initial({ ...EMPTY, pool }, { ...DEFAULT_SETTINGS, count: 10, ...settings });
    if (listed) {
      this.send({ type: 'tick' });
      // Made a moment ago, so that nothing is due, and with the catalogue not asked for anything yet.
      this.state = { ...this.state, refreshedAt: this.now, attemptAt: this.now - DAY, building: null };
      this.done = [];
    }
  }

  /**
   * Whether the songs asked to be looked for ahead are left for the test to
   * answer. Most of what is held to here is not about that, and for those
   * the phone is taken to answer each such asking with "not now" at once:
   * the song is as it was, and is not asked about again that day.
   */
  ahead = false;

  send(event: Event): Effect[] {
    const out = reduce(this.state, event, this.now);
    this.state = out.state;
    this.done.push(...out.effects);
    if (!this.ahead) {
      for (const effect of out.effects) {
        if (effect.kind === 'ask' && effect.hold) this.send({ type: 'askFailed', id: effect.id, code: 'ERR_TEST', hold: true });
      }
    }
    return out.effects;
  }

  later(ms: number): Effect[] {
    this.now += ms;
    return this.send({ type: 'tick' });
  }

  /** The app has just come to the front, on this connection, with the queue read. */
  open(network = WIFI, jobs: DownloadJob[] = []): Effect[] {
    this.jobs(jobs);
    return this.send({ type: 'maintain', network, away: this.state.away, hidden: NOBODY });
  }

  jobs(jobs: DownloadJob[], paused = false): Effect[] {
    return this.send({ type: 'jobs', jobs, paused });
  }

  /** The phone answers every question it was asked, and every song asked for becomes ready. */
  ready(...ns: number[]): void {
    for (const n of ns) {
      this.send({ type: 'asked', id: id(n), jobId: `job-${id(n)}` });
      this.jobs([...this.state.jobs.filter((other) => other.discoverKey !== id(n)), job(id(n), 'done')]);
      this.send({ type: 'track', id: id(n), jobId: `job-${id(n)}`, track: track(`job-${id(n)}`) });
    }
  }

  ids(): string[] { return this.state.list.map((item) => item.id); }
  problem(): string | null { return this.state.problem?.code ?? null; }
  item(n: number): Item { return itemOf(this.state, id(n))!; }
  /** What was asked for in earnest: to be fetched. */
  asks(effects: Effect[] = this.done) {
    return effects.filter((effect): effect is Extract<Effect, { kind: 'ask' }> => effect.kind === 'ask' && !effect.hold);
  }
  /** What was asked to be looked for ahead, and held. */
  seeks(effects: Effect[] = this.done) {
    return effects.filter((effect): effect is Extract<Effect, { kind: 'ask' }> => effect.kind === 'ask' && effect.hold);
  }
  of<K extends Effect['kind']>(kind: K, effects: Effect[] = this.done) {
    return effects.filter((effect): effect is Extract<Effect, { kind: K }> => effect.kind === kind);
  }
}

/** The first [n] songs of the list, in its order, as numbers. */
function first(desk: Desk, n: number): number[] {
  return desk.state.list.slice(0, n).map((item) => Number(item.id.slice(-3)));
}

test('the list is filled from the pool to its number, and filling it again changes nothing', () => {
  const desk = new Desk();
  assert.equal(desk.state.list.length, 10);
  const list = desk.state.list;
  desk.send({ type: 'tick' });
  assert.equal(desk.state.list, list);
});

test('a tap changes the row that was tapped and no other', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const before = [...desk.state.list];
  const [a] = first(desk, 1);
  const effects = desk.send({ type: 'play', id: id(a) });
  assert.deepEqual(desk.asks(effects).map((ask) => [ask.id, ask.front]), [[id(a), true]]);
  assert.equal(desk.state.live.get(id(a))?.phase, 'waiting');
  // Every other song is the object it was, and none has moved.
  desk.state.list.forEach((item, at) => { if (at > 0) assert.equal(item, before[at]); });
  assert.deepEqual(desk.ids(), before.map((item) => item.id));
});

test('a ready song plays at once, with the ready songs after it, and nothing is asked of the phone first', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b, c, d] = first(desk, 4);
  desk.ready(a, c, d);
  desk.done = [];
  const effects = desk.send({ type: 'play', id: id(c) });
  assert.equal(effects.length, 1);
  const play = desk.of('play', effects)[0];
  // From the tapped song on in the order of the list, round to the one before it; the one that is not ready is not in it.
  assert.deepEqual(play.tracks.map((t) => t.id), [c, d, a].map((n) => `discover:job-${id(n)}`));
  assert.equal(desk.item(b).track, undefined);
});

test('tapping another song while one is on its way is asking for the other one', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b] = first(desk, 2);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'play', id: id(b) });
  assert.equal(desk.state.intent?.id, id(b));
  desk.done = [];
  // The first one goes on being fetched, and is ready when it is in. It does not start.
  desk.ready(a);
  assert.equal(desk.of('play').length, 0);
  assert.ok(desk.item(a).track);
  desk.ready(b);
  assert.deepEqual(desk.of('play')[0].tracks.map((t) => t.id), [b, a].map((n) => `discover:job-${id(n)}`));
  assert.equal(desk.state.intent, null);
});

test('a song that arrives after something else was put on does not take the player', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'player', currentId: '41', queue: ['41', '42'], playing: true });
  desk.send({ type: 'play', id: id(a) });
  // The same queue moving on to its next track is not something else.
  desk.send({ type: 'player', currentId: '42', queue: ['41', '42'], playing: true });
  assert.equal(desk.state.intent?.id, id(a));
  desk.send({ type: 'player', currentId: '7', queue: ['7', '8', '9'], playing: true });
  assert.equal(desk.state.intent, null);
  desk.done = [];
  desk.ready(a);
  assert.equal(desk.of('play').length, 0);
});

test('what the queue says of a song is read onto it, and a song it says nothing new of stays the same object', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b] = first(desk, 2);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.jobs([job(id(a), 'downloading', { progress: 10 })]);
  assert.deepEqual(desk.state.live.get(id(a)), { phase: 'fetching', stage: 'downloading', progress: 10 });
  const list = desk.state.list;
  const other = desk.item(b);
  desk.jobs([job(id(a), 'downloading', { progress: 55 })]);
  assert.equal(desk.state.live.get(id(a))?.progress, 55);
  // A percentage is not part of the list: nothing that is written down has changed.
  assert.equal(desk.state.list, list);
  assert.equal(desk.item(b), other);
  // A reading that says what the last one said changes nothing at all: the state is the object it was.
  const state = desk.state;
  desk.jobs([job(id(a), 'downloading', { progress: 55 })]);
  assert.equal(desk.state, state);
});

test('a job the queue is trying again is waiting, not failed', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.jobs([job(id(a), 'queued', { retrying: true, retryText: 'Could not reach YouTube.' })]);
  assert.deepEqual(desk.state.live.get(id(a)), { phase: 'waiting', waitingFor: 'retry' });
  assert.equal(desk.item(a).failure, undefined);
  assert.equal(desk.state.intent?.id, id(a));
});

test('a job that failed for good says which failure, as a code, and the tap that waited for it is over', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.jobs([job(id(a), 'failed', { error: 'Could not reach YouTube.', errorText: 'YouTube’a ulaşılamadı.', errorCode: 'ERR_YOUTUBE_NETWORK' })]);
  assert.equal(desk.item(a).failure?.code, 'ERR_YOUTUBE_NETWORK');
  // No sentence is kept, in any language.
  assert.equal(JSON.stringify(desk.item(a)).includes('ulaşılamadı'), false);
  assert.equal(desk.state.live.has(id(a)), false);
  assert.equal(desk.state.intent, null);
  // Tapped again, it is asked for again, at the front.
  const effects = desk.send({ type: 'play', id: id(a) });
  assert.equal(desk.asks(effects)[0].front, true);
  assert.equal(desk.item(a).failure, undefined);
});

test('a song with no recording gives its place up: the next song is at the end at once, and the row goes after a moment', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const before = desk.ids();
  const [a] = first(desk, 1);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  const effects = desk.jobs([job(id(a), 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH' })]);
  assert.deepEqual(desk.of('away', effects).map((e) => [e.song.recordingMbid, e.reason]), [[id(a), 'unmatched']]);
  // Still there, saying so, with every row where it was and one more at the end.
  assert.deepEqual(desk.ids().slice(0, 10), before);
  assert.equal(desk.ids().length, 11);
  assert.ok(desk.item(a).goneAt);
  desk.later(NO_MATCH_SHOWN_MS);
  assert.deepEqual(desk.ids(), [...before.slice(1), desk.ids()[9]]);
  assert.equal(desk.ids().length, 10);
});

test('the next few songs are asked for as Discover’s own, on Wi-Fi, and no more than that', () => {
  const desk = new Desk({ ready: 3 });
  const effects = desk.open();
  const [a, b, c, d] = first(desk, 4);
  assert.deepEqual(desk.asks(effects).map((ask) => [ask.id, ask.front, ask.wifiOnly]), [a, b, c].map((n) => [id(n), false, true]));
  // Asked once: another pass with the phone not yet answered asks for nothing.
  assert.equal(desk.asks(desk.send({ type: 'tick' })).length, 0);
  desk.done = [];
  desk.ready(a, b, c);
  // All three in, and the fourth is not fetched because of it.
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.item(d).jobId, undefined);
});

test('on mobile data they wait, and the reason is one thing said of the list and not a failure on each row', () => {
  const desk = new Desk({ ready: 3 });
  const effects = desk.open(MOBILE);
  assert.equal(desk.asks(effects).length, 0);
  assert.equal(desk.state.held, 'wifi');
  assert.ok(desk.state.list.every((item) => !item.failure));
  // The connection is looked at again while they wait, and they are asked for when it allows.
  assert.equal(desk.of('network', desk.later(30_000)).length, 1);
  assert.equal(desk.asks(desk.send({ type: 'network', network: WIFI })).length, 3);
  assert.equal(desk.state.held, null);
});

test('with Wi-Fi only switched off they are fetched on whatever there is', () => {
  const desk = new Desk({ ready: 3, wifiOnly: false });
  assert.deepEqual(desk.asks(desk.open(MOBILE)).map((ask) => ask.wifiOnly), [false, false, false]);
  const offline = new Desk({ ready: 3, wifiOnly: false });
  assert.equal(offline.asks(offline.open({ connected: false, wifi: false })).length, 0);
  assert.equal(offline.state.held, 'connection');
});

test('a song the phone would not fetch off Wi-Fi is not asked for again until there is some', () => {
  const desk = new Desk({ ready: 1 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  // Wi-Fi went since the connection was last read. The phone says so by failing the job.
  desk.jobs([job(id(a), 'failed', { errorCode: 'ERR_DOWNLOAD_WAITING_WIFI' })]);
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.state.held, 'wifi');
  desk.send({ type: 'tick' });
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.asks(desk.send({ type: 'network', network: WIFI })).length, 1);
});

test('while Discover is playing, the songs after the one that is playing are the ones kept ready', () => {
  const desk = new Desk({ ready: 2 });
  desk.open();
  const [a, b, c, d, e] = first(desk, 5);
  desk.ready(a, b);
  desk.done = [];
  // Playing the first: the second is ready, the third is wanted — from the tap, before the player has said it started.
  desk.send({ type: 'play', id: id(a) });
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(c)]);
  desk.send({ type: 'player', currentId: `discover:job-${id(a)}`, queue: [a, b].map((n) => `discover:job-${id(n)}`), playing: true });
  assert.equal(desk.asks().length, 1);
  desk.ready(c);
  // In, and so added to what is playing, after what was there.
  assert.deepEqual(desk.of('append').flatMap((effect) => effect.tracks.map((t) => t.id)), [`discover:job-${id(c)}`]);
  desk.done = [];
  desk.send({ type: 'player', currentId: `discover:job-${id(b)}`, queue: [a, b, c].map((n) => `discover:job-${id(n)}`), playing: true });
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(d)]);
  assert.equal(desk.item(e).jobId, undefined);
  // What was offered is offered once: a file taken out of the queue by hand is not put back.
  desk.done = [];
  desk.send({ type: 'player', currentId: `discover:job-${id(b)}`, queue: [a, b].map((n) => `discover:job-${id(n)}`), playing: true });
  assert.equal(desk.of('append').length, 0);
});

test('taking a song off the list stops nothing but that song', () => {
  const desk = new Desk({ ready: 2 });
  desk.open();
  const [a, b, c, d] = first(desk, 4);
  desk.ready(a, b);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'player', currentId: `discover:job-${id(a)}`, queue: [a, b].map((n) => `discover:job-${id(n)}`), playing: true });
  desk.send({ type: 'asked', id: id(c), jobId: `job-${id(c)}` });
  desk.jobs([job(id(a), 'done'), job(id(b), 'done'), job(id(c), 'downloading', { progress: 30 })]);
  desk.done = [];
  desk.send({ type: 'exclude', id: id(b) });
  // Out of the player's queue, and nothing cancelled: the song being fetched is still being fetched.
  assert.deepEqual(desk.of('dequeue')[0].trackIds, [`discover:job-${id(b)}`]);
  assert.equal(desk.of('cancel').length, 0);
  assert.equal(desk.state.live.get(id(c))?.phase, 'fetching');
  // And the songs kept ready go on: the window has moved one down the list.
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(d)]);
});

test('a song taken off leaves its place to the rows below it, the newcomer goes last, and undo puts it back', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const before = desk.ids();
  const effects = desk.send({ type: 'exclude', id: before[3] });
  assert.deepEqual(desk.of('away', effects).map((e) => e.reason), ['blocked']);
  assert.deepEqual(desk.ids().slice(0, 9), before.filter((_, at) => at !== 3));
  assert.equal(desk.ids().length, 10);
  const newcomer = desk.ids()[9];
  assert.ok(!before.includes(newcomer));
  assert.equal(desk.state.notice?.kind, 'excluded');
  const undone = desk.send({ type: 'undo' });
  assert.deepEqual(desk.of('allow', undone).map((e) => e.id), [before[3]]);
  assert.deepEqual(desk.ids(), before);
  assert.equal(desk.state.away.has(before[3]), false);
});

test('the offer to undo is taken down after ten seconds, and the exclusion stands', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const gone = desk.ids()[0];
  desk.send({ type: 'exclude', id: gone });
  assert.equal(wakeAt(desk.state, desk.now), desk.now + UNDO_MS);
  desk.later(UNDO_MS);
  assert.equal(desk.state.notice, null);
  desk.send({ type: 'undo' });
  assert.ok(!desk.ids().includes(gone));
});

test('nothing more by an artist comes off the pool once the artist is sent away', () => {
  const pool = [...Array.from({ length: 30 }, (_, n) => song(n)), { ...song(99), artistMbid: 'artist-0', score: 5000, familiar: false }];
  const desk = new Desk({ ready: 0 }, 0, false);
  desk.state = { ...desk.state, pool };
  desk.send({ type: 'tick' });
  const [a] = first(desk, 1);
  const target = desk.state.list.find((item) => item.song.artistMbid === 'artist-0')!;
  assert.ok(target, `expected an artist-0 song on the list, first is ${a}`);
  const effects = desk.send({ type: 'exclude', id: target.id, artist: true });
  assert.equal(desk.of('hideArtist', effects).length, 1);
  assert.ok(desk.state.pool.every((other) => other.artistMbid !== 'artist-0'));
  assert.equal(desk.state.notice?.kind === 'excluded' && desk.state.notice.artist, target.song.artist);
  // Taken back, the artist is allowed again with the song.
  assert.equal(desk.of('showArtist', desk.send({ type: 'undo' })).length, 1);
  assert.equal(desk.state.hidden.has('artist-0'), false);
});

test('keeping a song that is not ready fetches it first, at the front, and keeps it when it is in', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const before = desk.ids();
  const [a] = first(desk, 1);
  const effects = desk.send({ type: 'keep', id: id(a) });
  assert.equal(desk.asks(effects)[0].front, true);
  assert.equal(desk.of('keep', effects).length, 0);
  desk.done = [];
  desk.ready(a);
  // Kept, and not played: nobody asked to hear it.
  assert.deepEqual(desk.of('keep').map((e) => e.jobId), [`job-${id(a)}`]);
  assert.equal(desk.of('play').length, 0);
  // Asked once, however many readings of the queue go by before the library answers.
  desk.send({ type: 'tick' });
  assert.equal(desk.of('keep').length, 1);
  const kept = desk.send({ type: 'kept', id: id(a) });
  assert.deepEqual(desk.of('away', kept).map((e) => e.reason), ['saved']);
  assert.deepEqual(desk.ids().slice(0, 9), before.slice(1));
  assert.equal(desk.ids().length, 10);
  assert.equal(desk.state.notice?.kind, 'kept');
  // Its file is given up, to be removed when the player has no more use for it.
  assert.ok(desk.state.retired.includes(`job-${id(a)}`));
});

test('a song that could not be kept stays on the list and says so', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.ready(a);
  desk.send({ type: 'keep', id: id(a) });
  desk.send({ type: 'keepFailed', id: id(a), code: 'ERR_DOWNLOAD_NOT_HERE' });
  assert.ok(desk.item(a));
  assert.equal(desk.item(a).keep, undefined);
  assert.equal(desk.state.notice?.kind, 'keepFailed');
});

test('a failed song is tried once more by the songs kept ready, after a while, and then not again that day', () => {
  const desk = new Desk({ ready: 1 });
  desk.open();
  const [a, b] = first(desk, 2);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  desk.jobs([job(id(a), 'failed', { errorCode: 'ERR_YOUTUBE_TIMED_OUT' })]);
  // It keeps its place among the next few. The song after it is not fetched in its stead.
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.item(b).jobId, undefined);
  assert.equal(wakeAt(desk.state, desk.now), desk.now + RETRY_AFTER_MS);
  desk.later(RETRY_AFTER_MS);
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(a)]);
  // It fails again, under a new job.
  desk.send({ type: 'asked', id: id(a), jobId: 'second' });
  desk.jobs([job(id(a), 'failed', { id: 'second', errorCode: 'ERR_YOUTUBE_TIMED_OUT' })]);
  desk.done = [];
  desk.later(RETRY_AFTER_MS * 3);
  assert.equal(desk.asks().length, 0);
  desk.later(DAY);
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(a)]);
});

test('a bad quarter of an hour does not walk the songs kept ready down the whole list', () => {
  const desk = new Desk({ ready: 3 });
  desk.open();
  const [a, b, c] = first(desk, 3);
  const failing = [a, b, c].map((n) => job(id(n), 'failed', { errorCode: 'ERR_YOUTUBE_REFUSED' }));
  for (const n of [a, b, c]) desk.send({ type: 'asked', id: id(n), jobId: `job-${id(n)}` });
  desk.done = [];
  // YouTube refuses all three. The window is those three still, and nothing below them is touched.
  desk.jobs(failing);
  desk.send({ type: 'tick' });
  desk.later(60_000);
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.state.list.filter((item) => item.jobId).length, 3);
  // A failure that will never mend gives its place up, as a row with no recording does.
  desk.jobs([failing[0], failing[1], job(id(c), 'failed', { errorCode: 'ERR_YOUTUBE_UNAVAILABLE' })]);
  assert.equal(desk.asks().length, 0, 'the code is read once per job');
  const lasting = new Desk({ ready: 1 });
  lasting.open();
  const [x, y] = first(lasting, 2);
  lasting.send({ type: 'asked', id: id(x), jobId: `job-${id(x)}` });
  lasting.done = [];
  lasting.jobs([job(id(x), 'failed', { errorCode: 'ERR_YOUTUBE_UNAVAILABLE' })]);
  assert.deepEqual(lasting.asks().map((ask) => ask.id), [id(y)]);
  lasting.later(DAY * 2);
  assert.ok(!lasting.asks().some((ask) => ask.id === id(x)));
});

test('a download somebody stopped from the queue waits to be tapped, however long that is', () => {
  const desk = new Desk({ ready: 1 });
  desk.open();
  const [a, b] = first(desk, 2);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  desk.jobs([job(id(a), 'cancelled')]);
  assert.equal(desk.item(a).failure?.code, STOPPED);
  // Its place among the next few goes to the song after it: it is not coming back by itself.
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(b)]);
  desk.ready(b);
  desk.done = [];
  desk.later(RETRY_AFTER_MS * 2);
  desk.later(DAY * 3);
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.item(a).failure?.code, STOPPED);
  // Tapped, it is fetched.
  assert.deepEqual(desk.asks(desk.send({ type: 'play', id: id(a) })).map((ask) => [ask.id, ask.front]), [[id(a), true]]);
});

test('a refresh shows the new list at once where nothing is fetched ahead', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const old = desk.ids();
  const [a] = first(desk, 1);
  desk.ready(a);
  desk.send({ type: 'player', currentId: `discover:job-${id(a)}`, queue: [`discover:job-${id(a)}`], playing: true });
  assert.deepEqual(desk.of('build', desk.send({ type: 'refresh' })), [{ kind: 'build', refresh: true }]);
  assert.ok(desk.state.building);
  desk.done = [];
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  assert.equal(desk.state.staged, null);
  assert.equal(desk.ids().length, 10);
  assert.ok(desk.ids().every((other) => !old.includes(other)));
  assert.equal(desk.state.refreshedAt, desk.now);
  // A song that was heard stays away a season; one that never was, a fortnight.
  const away = new Map(desk.of('away').map((e) => [e.song.recordingMbid, e.reason]));
  assert.equal(away.get(id(a)), 'played');
  assert.equal(away.get(old[1]), 'unplayed');
  assert.equal(away.size, 10);
  // The old list's file is given up, not removed from under the player.
  assert.ok(desk.state.retired.includes(`job-${id(a)}`));
});

test('with songs fetched ahead, the new list waits behind the old until its first few are ready', () => {
  const desk = new Desk({ ready: 2 });
  desk.open();
  const old = desk.ids();
  desk.send({ type: 'refresh' });
  desk.done = [];
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  assert.deepEqual(desk.ids(), old);
  const staged = desk.state.staged!.items.map((item) => item.id);
  assert.equal(staged.length, 10);
  // The new list's first two are what is fetched now.
  assert.deepEqual(desk.asks().map((ask) => ask.id), staged.slice(0, 2));
  const numbers = staged.slice(0, 2).map((key) => Number(key.slice(-3)));
  desk.ready(numbers[0]);
  assert.deepEqual(desk.ids(), old);
  desk.ready(numbers[1]);
  // Two of ten, and that is enough.
  assert.deepEqual(desk.ids(), staged);
  assert.equal(desk.state.staged, null);
  assert.equal(desk.state.notice?.kind, 'refreshed');
});

test('a new list that is slow to get ready is shown anyway after a few minutes, or when refresh is pressed again', () => {
  const desk = new Desk({ ready: 3 });
  desk.open();
  desk.send({ type: 'refresh' });
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  const staged = desk.state.staged!.items.map((item) => item.id);
  assert.equal(wakeAt(desk.state, desk.now), desk.now + STAGE_WAIT_MS);
  desk.later(STAGE_WAIT_MS - 1);
  assert.ok(desk.state.staged);
  desk.later(1);
  assert.deepEqual(desk.ids(), staged);

  const pressed = new Desk({ ready: 3 });
  pressed.open();
  pressed.send({ type: 'refresh' });
  pressed.send({ type: 'built', refresh: true, pool: pressed.state.pool });
  const waiting = pressed.state.staged!.items.map((item) => item.id);
  pressed.send({ type: 'refresh' });
  assert.deepEqual(pressed.ids(), waiting);
});

test('a new list in the making outlives a song being taken off, a song being kept and the settings being changed', () => {
  const desk = new Desk({ ready: 2 });
  desk.open();
  desk.send({ type: 'refresh' });
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  const staged = desk.state.staged!.items.map((item) => item.id);
  desk.send({ type: 'exclude', id: desk.ids()[0] });
  assert.deepEqual(desk.state.staged?.items.map((item) => item.id), staged);
  // The song that took the place is not one the new list already has.
  assert.ok(!staged.includes(desk.ids()[9]));
  desk.send({ type: 'settings', value: { ...desk.state.settings, refreshDays: 7 } });
  assert.deepEqual(desk.state.staged?.items.map((item) => item.id), staged);
  desk.send({ type: 'settings', value: { ...desk.state.settings, count: 20 } });
  assert.deepEqual(desk.state.staged?.items.map((item) => item.id).slice(0, 10), staged);
  assert.equal(desk.state.staged?.items.length, 20);
  // Nothing is fetched ahead any more, so there is nothing to wait for.
  desk.send({ type: 'settings', value: { ...desk.state.settings, ready: 0 } });
  assert.equal(desk.state.staged, null);
  assert.deepEqual(desk.ids().slice(0, 10), staged);
});

test('a refresh that cannot make a whole new list leaves the old one and says why', () => {
  const desk = new Desk({ ready: 0 }, 14);
  desk.open();
  const old = desk.ids();
  desk.send({ type: 'refresh' });
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  assert.deepEqual(desk.ids(), old);
  assert.equal(desk.state.problem?.code, 'exhausted');
  assert.equal(desk.state.building, null);
});

test('the catalogue is asked by itself when the list is short or a refresh is due, and not more than every quarter of an hour', () => {
  const desk = new Desk({ ready: 0, refreshDays: 7 }, 6);
  assert.equal(desk.state.list.length, 6);
  // Short: asked on opening.
  assert.equal(desk.of('build', desk.open()).length, 1);
  assert.equal(desk.state.attemptAt, desk.now);
  desk.send({ type: 'buildFailed', code: 'timedOut' });
  assert.equal(desk.state.problem?.code, 'timedOut');
  desk.now += BUILD_EVERY_MS - 1;
  assert.equal(desk.of('build', desk.open()).length, 0);
  // A quarter of an hour on it is asked again — unless what it said was that there is nothing more, which will be so tomorrow too.
  const later = new Desk({ ready: 0 }, 0, false);
  later.state = { ...desk.state };
  later.now = desk.now + 1;
  assert.equal(later.of('build', later.open()).length, 1);
  later.send({ type: 'built', refresh: false, pool: [] });
  assert.equal(later.problem(), 'exhausted');
  later.done = [];
  // Dismissed or not: it is the answer that is remembered, not the notice of it.
  later.send({ type: 'dismiss', what: 'problem' });
  later.now += DAY - 1;
  assert.equal(later.of('build', later.open()).length, 0);
  later.now += 1;
  assert.equal(later.of('build', later.open()).length, 1);
  // The time of the last asking is part of what is written down, so closing the app does not earn another go.
  const reopened = new Desk({ ready: 0 }, 0, false);
  reopened.state = initial({ ...EMPTY, list: desk.state.list, attemptAt: desk.state.attemptAt }, desk.state.settings);
  reopened.now = desk.now;
  assert.equal(reopened.of('build', reopened.open()).length, 0);

  const due = new Desk({ ready: 0, refreshDays: 7 });
  due.open();
  assert.equal(due.of('build').length, 0);
  // Woken for the day it falls due, whatever else it is woken for on the way.
  const day = due.now + 7 * DAY;
  for (let wake = wakeAt(due.state, due.now); wake != null && wake < day; wake = wakeAt(due.state, due.now)) {
    due.later(wake - due.now);
    assert.equal(due.of('build').length, 0);
  }
  assert.equal(wakeAt(due.state, due.now), day);
  due.done = [];
  due.later(day - due.now);
  assert.deepEqual(due.of('build'), [{ kind: 'build', refresh: true }]);
});

test('pressing for more is answered at once, but not twice in a minute', () => {
  const desk = new Desk({ ready: 0 }, 6);
  desk.open();
  desk.send({ type: 'buildFailed', code: 'unreachable' });
  desk.done = [];
  desk.now += BUILD_AGAIN_MS - 1;
  desk.send({ type: 'findMore' });
  assert.equal(desk.of('build').length, 0);
  assert.equal(desk.state.problem?.code, 'throttled');
  // Which is so until it is not, and is then taken down by itself.
  desk.later(1);
  assert.equal(desk.state.problem, null);
  desk.send({ type: 'findMore' });
  assert.deepEqual(desk.of('build'), [{ kind: 'build', refresh: false }]);
});

test('with no connection nothing is asked of the catalogue, and that is said until there is one', () => {
  const desk = new Desk({ ready: 0 }, 6);
  assert.equal(desk.of('build', desk.open({ connected: false, wifi: false })).length, 0);
  assert.equal(desk.state.problem?.code, 'offline');
  desk.send({ type: 'tick' });
  assert.equal(desk.state.problem?.code, 'offline');
  desk.send({ type: 'network', network: WIFI });
  assert.equal(desk.state.problem, null);
});

test('a problem that was dismissed is gone, and one that is still so comes back when it is run into again', () => {
  const desk = new Desk({ ready: 0 }, 6);
  desk.open({ connected: false, wifi: false });
  assert.equal(desk.send({ type: 'dismiss', what: 'problem' }).length, 0);
  assert.equal(desk.problem(), null);
  desk.send({ type: 'findMore' });
  assert.equal(desk.problem(), 'offline');
});

test('a pool that arrives fills the empty places at the end, and a list made for the first time is dated', () => {
  const desk = new Desk({ ready: 0 }, 0, false);
  assert.equal(desk.of('build', desk.open()).length, 1);
  desk.send({ type: 'buildProgress', label: 'Listening around Artist' });
  desk.send({ type: 'buildProgress', label: 'Listening around Artist', done: 3, total: 12 });
  assert.deepEqual(desk.state.building, { refresh: false, label: 'Listening around Artist', done: 3, total: 12 });
  desk.send({ type: 'built', refresh: false, pool: Array.from({ length: 40 }, (_, n) => song(n)) });
  assert.equal(desk.state.list.length, 10);
  assert.equal(desk.state.refreshedAt, desk.now);
  assert.equal(desk.state.building, null);
  assert.equal(desk.state.problem, null);
});

test('a shorter list loses its last rows, a longer one is filled at the end, and no row changes place', () => {
  const desk = new Desk({ ready: 0, count: 20 });
  desk.open();
  const before = desk.ids();
  desk.send({ type: 'settings', value: { ...desk.state.settings, count: 10 } });
  assert.deepEqual(desk.ids(), before.slice(0, 10));
  desk.send({ type: 'settings', value: { ...desk.state.settings, count: 20 } });
  assert.deepEqual(desk.ids().slice(0, 10), before.slice(0, 10));
  assert.equal(desk.ids().length, 20);
});

test('changing what is fetched ahead stops Discover’s own waiting jobs, leaves a tapped one alone, and asks for nothing until they have stopped', () => {
  const desk = new Desk({ ready: 3, wifiOnly: false });
  desk.open(MOBILE);
  const [a, b, c] = first(desk, 3);
  for (const n of [a, b, c]) desk.send({ type: 'asked', id: id(n), jobId: `job-${id(n)}` });
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  const queue = [job(id(a), 'queued'), job(id(b), 'queued'), job(id(c), 'downloading', { progress: 5 })];
  desk.jobs(queue);
  desk.done = [];
  desk.send({ type: 'settings', value: { ...desk.state.settings, ready: 5 } });
  // The one waiting that nobody tapped. Not the tapped one, and not the one already coming down.
  assert.deepEqual(desk.of('cancel').map((e) => e.jobId), [`job-${id(b)}`]);
  assert.equal(desk.item(b).jobId, undefined);
  /*
    And nothing asked for beside the stopping: the phone answers the two in
    whichever order it gets to them, and a song asked for first is answered
    with the job that is then stopped under it.
  */
  assert.equal(desk.asks().length, 0);
  // Nor on a reading that still has the job in it, made before the stop landed.
  desk.jobs([...queue]);
  desk.send({ type: 'tick' });
  assert.ok(!desk.asks().some((ask) => ask.id === id(b)));
  assert.equal(desk.item(b).failure, undefined);
  // Read as stopped, it is asked for again, under the new rule. (The rows the wider window reaches were asked for meanwhile.)
  desk.done = [];
  desk.jobs([queue[0], job(id(b), 'cancelled'), queue[2]]);
  assert.equal(desk.item(b).failure, undefined, 'not a download somebody cancelled');
  assert.deepEqual(desk.asks().map((ask) => [ask.id, ask.front]), [[id(b), false]]);
});

test('a song tapped while its old job is being stopped is asked for when the job has stopped, at the front', () => {
  const desk = new Desk({ ready: 2 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.jobs([job(id(a), 'queued')]);
  desk.send({ type: 'settings', value: { ...desk.state.settings, wifiOnly: false } });
  desk.done = [];
  desk.send({ type: 'play', id: id(a) });
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.state.intent?.id, id(a));
  desk.jobs([]);
  assert.deepEqual(desk.asks().filter((ask) => ask.id === id(a)).map((ask) => ask.front), [true]);
});

test('taking a song off and putting it back does not ask for it while its job is still being stopped', () => {
  const desk = new Desk({ ready: 1 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  const queue = [job(id(a), 'downloading', { progress: 20 })];
  desk.jobs(queue);
  desk.done = [];
  desk.send({ type: 'exclude', id: id(a) });
  assert.deepEqual(desk.of('cancel').map((e) => e.jobId), [`job-${id(a)}`]);
  assert.equal(desk.asks().length, 0);
  desk.send({ type: 'undo' });
  desk.jobs([...queue]);
  assert.ok(!desk.asks().some((ask) => ask.id === id(a)));
  desk.jobs([job(id(a), 'cancelled')]);
  assert.deepEqual(desk.asks().filter((ask) => ask.id === id(a)).length, 1);
  assert.equal(desk.item(a).failure, undefined);
});

test('a job found in the queue for a song on the list is taken as that song’s, though it was never written down', () => {
  const desk = new Desk({ ready: 0 });
  const [a] = first(desk, 1);
  // Asked for the moment before the app was closed: the phone has the job, the list has no note of it.
  desk.open(WIFI, [job(id(a), 'done')]);
  assert.equal(desk.item(a).jobId, `job-${id(a)}`);
  assert.deepEqual(desk.of('track').map((e) => e.jobId), [`job-${id(a)}`]);
  // Not a stray to be stopped and tidied away.
  assert.equal(desk.of('cancel').length + desk.of('clean').length, 0);
});

test('jobs no song answers for are stopped and their files removed, and a file that is gone says so on its row', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.ready(a);
  const stray = '99999999-0000-0000-0000-000000000000';
  const effects = desk.open(WIFI, [job(id(a), 'done'), job(stray, 'downloading'), job('88888888-0000-0000-0000-000000000000', 'failed')]);
  assert.deepEqual(desk.of('cancel', effects).map((e) => e.jobId), [`job-${stray}`]);
  assert.deepEqual([...desk.of('clean', effects)[0].ids].sort(), [`job-88888888-0000-0000-0000-000000000000`, `job-${stray}`].sort());
  desk.send({ type: 'cleaned', removed: [`job-88888888-0000-0000-0000-000000000000`] });
  assert.deepEqual(desk.state.retired, [`job-${stray}`]);

  desk.jobs([job(id(a), 'missing')]);
  assert.equal(desk.item(a).track, undefined);
  assert.equal(desk.item(a).failure?.code, FILE_MISSING);
});

test('a file that was not where its job said is asked for once, not at every reading', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  desk.jobs([job(id(a), 'done')]);
  desk.jobs([job(id(a), 'done')]);
  assert.equal(desk.of('track').length, 1);
  desk.send({ type: 'track', id: id(a), jobId: `job-${id(a)}`, track: null });
  assert.equal(desk.item(a).failure?.code, FILE_MISSING);
  desk.jobs([job(id(a), 'done')]);
  assert.equal(desk.of('track').length, 1);
});

test('a reading of the queue that is older than the asking does not lose a song its job, or have it asked for twice', () => {
  const desk = new Desk({ ready: 3 });
  desk.open();
  const [a] = first(desk, 1);
  for (const item of desk.state.list.slice(0, 3)) desk.send({ type: 'asked', id: item.id, jobId: `job-${item.id}` });
  desk.send({ type: 'play', id: id(a) });
  // Read before the job was made, and arriving after the answer that made it.
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  desk.jobs([]);
  assert.equal(desk.item(a).jobId, `job-${id(a)}`);
  // Still waiting, to the screen — and to the songs kept ready, which do not ask for it again as one of their own.
  assert.equal(desk.state.live.get(id(a))?.phase, 'waiting');
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.state.intent?.id, id(a));
  desk.now += 60_000;
  desk.jobs([]);
  assert.equal(desk.item(a).jobId, undefined);
});

test('a song put away meanwhile, by a backup restored, leaves the list the next time it is looked over', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const before = desk.ids();
  const away = new Set([before[2], songKey(desk.state.list[4].song)]);
  desk.send({ type: 'maintain', network: WIFI, away, hidden: NOBODY });
  assert.ok(!desk.ids().includes(before[2]) && !desk.ids().includes(before[4]));
  assert.equal(desk.ids().length, 10);
});

test('paused, nothing is asked for by itself, and what is wanted is still known', () => {
  const desk = new Desk({ ready: 3 });
  desk.jobs([], true);
  const effects = desk.send({ type: 'maintain', network: WIFI, away: NOBODY, hidden: NOBODY });
  assert.equal(desk.asks(effects).length, 0);
  assert.equal(wanted(desk.state, desk.now).length, 3);
  assert.equal(desk.asks(desk.jobs([], false)).length, 3);
});

test('the song that is playing is marked as heard, once', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.ready(a);
  desk.send({ type: 'player', currentId: `discover:job-${id(a)}`, queue: [`discover:job-${id(a)}`], playing: false });
  assert.equal(desk.item(a).heardAt, undefined);
  desk.send({ type: 'player', currentId: `discover:job-${id(a)}`, queue: [`discover:job-${id(a)}`], playing: true });
  const heard = desk.item(a);
  assert.equal(heard.heardAt, desk.now);
  desk.now += 5_000;
  desk.send({ type: 'player', currentId: `discover:job-${id(a)}`, queue: [`discover:job-${id(a)}`], playing: true });
  assert.equal(desk.item(a), heard);
});

test('a refresh that falls due and cannot be made is asked for once a day, not every quarter of an hour', () => {
  const desk = new Desk({ ready: 0, refreshDays: 1 }, 14);
  desk.open();
  let builds = 0;
  // Two days with the app open, looked over every quarter of an hour.
  for (let quarter = 0; quarter < 2 * 96 + 8; quarter++) {
    desk.now += BUILD_EVERY_MS;
    desk.done = [];
    desk.open();
    desk.later(0);
    if (desk.of('build').length) {
      builds += desk.of('build').length;
      desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
      assert.equal(desk.problem(), 'exhausted');
    }
  }
  assert.equal(builds, 2);
  // Written down, so that the task with no screen, a new process each time, is held to the same.
  assert.ok(desk.state.fruitlessAt > 0);
  const again = new Desk({ ready: 0, refreshDays: 1 }, 0, false);
  again.state = initial({ ...EMPTY, list: desk.state.list, pool: desk.state.pool, refreshedAt: desk.state.refreshedAt,
    attemptAt: desk.state.attemptAt, fruitlessAt: desk.state.fruitlessAt }, desk.state.settings);
  again.now = desk.now + BUILD_EVERY_MS;
  assert.equal(again.of('build', again.open()).length, 0);
  // Pressed by hand it is asked whenever.
  assert.equal(again.of('build', again.send({ type: 'refresh' })).length, 1);
});

test('pressing refresh with no connection says so, and goes on saying so until a reading says otherwise', () => {
  const desk = new Desk({ ready: 0 });
  // Connected when the app came to the front, which is what is known.
  desk.open(WIFI);
  desk.send({ type: 'refresh' });
  desk.send({ type: 'buildFailed', code: 'offline' });
  assert.equal(desk.problem(), 'offline');
  assert.equal(desk.state.building, null);
  // It stands through whatever else happens.
  desk.send({ type: 'tick' });
  desk.jobs([]);
  assert.equal(desk.problem(), 'offline');
  // Pressed again, the answer is immediate and the same, and the connection is looked at again now.
  desk.now += BUILD_AGAIN_MS;
  const pressed = desk.send({ type: 'refresh' });
  assert.equal(desk.of('build', pressed).length, 0);
  assert.equal(desk.of('network', pressed).length, 1);
  assert.equal(desk.problem(), 'offline');
  desk.send({ type: 'network', network: { connected: false, wifi: false } });
  assert.equal(desk.problem(), 'offline');
  desk.send({ type: 'network', network: WIFI });
  assert.equal(desk.problem(), null);
});

test('the connection is looked at again at a time that is kept, however much else is going on', () => {
  const desk = new Desk({ ready: 3 });
  desk.open(MOBILE);
  assert.equal(desk.state.held, 'wifi');
  const at = desk.state.networkAt!;
  assert.equal(at, desk.now + 30_000);
  // A reading of the queue every second, as while something else downloads. The time does not move.
  for (let second = 1; second < 30; second++) {
    desk.now += 1_000;
    desk.jobs([job('77777777-0000-0000-0000-000000000000', 'downloading', { progress: second })]);
    assert.equal(desk.state.networkAt, at);
    assert.equal(wakeAt(desk.state, desk.now), at);
  }
  desk.done = [];
  desk.later(1_000);
  assert.equal(desk.of('network').length, 1);
  assert.equal(desk.state.networkAt, desk.now + 30_000);
  // With nothing waiting on the connection it is not looked at.
  desk.send({ type: 'network', network: WIFI });
  assert.equal(desk.state.networkAt, null);
});

test('a song being kept goes with the new list when the old one is replaced', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b] = first(desk, 2);
  // One still coming down with keep pressed, one whose copy into the library is under way.
  desk.send({ type: 'keep', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.ready(b);
  desk.send({ type: 'keep', id: id(b) });
  assert.ok(desk.state.keeping.has(id(b)));
  desk.jobs([job(id(a), 'downloading', { progress: 50 }), job(id(b), 'done')]);
  desk.done = [];
  desk.send({ type: 'refresh' });
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  // The new list, and the two at the end of it: not stopped, not given up, not put away as never played.
  assert.deepEqual(desk.ids().slice(10), [id(a), id(b)]);
  assert.equal(desk.of('cancel').length, 0);
  assert.ok(!desk.state.retired.includes(`job-${id(a)}`));
  assert.ok(!desk.of('away').some((e) => e.song.recordingMbid === id(a) || e.song.recordingMbid === id(b)));
  // Each leaves when it is in the library, as saved.
  assert.deepEqual(desk.of('away', desk.send({ type: 'kept', id: id(b) })).map((e) => e.reason), ['saved']);
  desk.done = [];
  desk.ready(a);
  assert.deepEqual(desk.of('keep').map((e) => e.id), [id(a)]);
  desk.send({ type: 'kept', id: id(a) });
  assert.equal(desk.ids().length, 10);
});

test('a shorter list does not drop a song that is being kept', () => {
  const desk = new Desk({ ready: 0, count: 20 });
  desk.open();
  const last = desk.state.list[19];
  desk.send({ type: 'keep', id: last.id });
  desk.done = [];
  desk.send({ type: 'settings', value: { ...desk.state.settings, count: 10 } });
  assert.equal(desk.ids().length, 11);
  assert.equal(desk.ids()[10], last.id);
  assert.equal(desk.of('cancel').length, 0);
});

test('a new list whose every song has gone is not shown as an empty list', () => {
  const desk = new Desk({ ready: 2 }, 12);
  desk.open();
  const old = desk.ids();
  desk.send({ type: 'refresh' });
  // Two songs are all the pool has beyond the list, and the list was two long when it was asked.
  desk.state = { ...desk.state, list: desk.state.list.slice(0, 2), settings: { ...desk.state.settings, count: 2 } };
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool.filter((song) => !old.slice(2).includes(song.recordingMbid)) });
  const staged = desk.state.staged!.items.map((item) => item.id);
  assert.equal(staged.length, 2);
  for (const key of staged) desk.send({ type: 'asked', id: key, jobId: `job-${key}` });
  desk.jobs(staged.map((key) => job(key, 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH' })));
  // Both rows are only there to say so, and none of nothing is not "the first few are ready".
  assert.ok(desk.state.staged);
  assert.deepEqual(desk.ids(), old.slice(0, 2));
  desk.later(NO_MATCH_SHOWN_MS);
  desk.later(STAGE_WAIT_MS);
  assert.equal(desk.state.staged, null);
  assert.deepEqual(desk.ids(), old.slice(0, 2));
  assert.equal(desk.problem(), 'exhausted');
});

test('a video that turned out not to be a song gives the place up like a song with no recording, and is never tried again', () => {
  const desk = new Desk({ ready: 1 });
  desk.open();
  const before = desk.ids();
  const [a] = first(desk, 1);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  // What the phone says of a live stream or a two-hour video. It used to say "no audio", which is tried again daily.
  desk.jobs([job(id(a), 'failed', { errorCode: 'ERR_YOUTUBE_NOT_A_SONG' })]);
  assert.deepEqual(desk.of('away').map((e) => [e.song.recordingMbid, e.reason]), [[id(a), 'unmatched']]);
  assert.ok(desk.item(a).goneAt);
  assert.equal(desk.ids().length, 11);
  desk.later(NO_MATCH_SHOWN_MS);
  assert.deepEqual(desk.ids().slice(0, 9), before.slice(1));
  desk.later(DAY * 2);
  assert.ok(!desk.asks().some((ask) => ask.id === id(a)));
});

/* Songs looked for ahead, and held. */

/** A desk on which the songs asked to be looked for ahead are the test's to answer. */
function seeking(settings: Partial<DiscoverSettings> = {}, songs = 60): Desk {
  const desk = new Desk(settings, songs);
  desk.ahead = true;
  return desk;
}
const heldJob = (key: string, status: DownloadStatus, more: Partial<DownloadJob> = {}) =>
  job(key, status, { hold: true, automatic: true, ...more });
/** The phone answers an asking-ahead with a job, which then waits to be looked for. */
function answer(desk: Desk, ...keys: string[]): void {
  for (const key of keys) desk.send({ type: 'asked', id: key, jobId: `job-${key}`, hold: true });
}

test('the songs nobody has asked for are looked for ahead, after the ones kept ready, a few at a time and in the order of the list', () => {
  const desk = seeking({ ready: 2 });
  const effects = desk.open();
  const ids = desk.ids();
  // The two kept ready are asked for in earnest; the next three are only to be looked for, on any connection.
  assert.deepEqual(desk.asks(effects).map((ask) => ask.id), ids.slice(0, 2));
  assert.deepEqual(desk.seeks(effects).map((ask) => [ask.id, ask.front, ask.wifiOnly]), ids.slice(2, 5).map((key) => [key, false, false]));
  // No more until the phone has answered, however often it is looked over.
  desk.done = [];
  desk.send({ type: 'tick' });
  desk.jobs([]);
  assert.equal(desk.seeks().length, 0);
  // Answered, they wait to be looked for, and nothing more is asked while three are under way.
  answer(desk, ...ids.slice(2, 5));
  desk.jobs(ids.slice(2, 5).map((key) => heldJob(key, 'queued')));
  assert.equal(desk.seeks().length, 0);
  // One found: the next is asked for. And so on down the list, and never past the end of it.
  desk.jobs([heldJob(ids[2], 'found'), heldJob(ids[3], 'finding'), heldJob(ids[4], 'queued')]);
  assert.deepEqual(desk.seeks().map((ask) => ask.id), [ids[5]]);
  answer(desk, ids[5]);
  desk.done = [];
  desk.jobs(ids.slice(2, 6).map((key) => heldJob(key, 'found')));
  assert.deepEqual(desk.seeks().map((ask) => ask.id), ids.slice(6, 9));
  answer(desk, ...ids.slice(6, 9));
  desk.done = [];
  desk.jobs(ids.slice(2, 9).map((key) => heldJob(key, 'found')));
  assert.deepEqual(desk.seeks().map((ask) => ask.id), [ids[9]]);
  answer(desk, ids[9]);
  desk.done = [];
  desk.jobs(ids.slice(2, 10).map((key) => heldJob(key, 'found')));
  desk.later(DAY * 3);
  // Every song found, and that is the end of it: none is looked for twice.
  assert.equal(desk.seeks().length, 0);
  assert.deepEqual(desk.state.list.slice(2).map((item) => item.ahead), Array(8).fill('found'));
});

test('a song being looked for ahead, or found and held, is a row with nothing to say', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const [a, b] = desk.ids();
  answer(desk, a, b);
  desk.jobs([heldJob(a, 'finding'), heldJob(b, 'found')]);
  assert.equal(desk.state.live.size, 0);
  assert.equal(desk.state.list[0].ahead, 'seeking');
  assert.equal(desk.state.list[1].ahead, 'found');
  assert.equal(desk.state.list[0].failure, undefined);
  // And it is not what the songs kept ready, or a tap, are waiting on.
  assert.equal(desk.state.intent, null);
});

test('a tap on a song whose video is already found asks for it at the front and goes straight to fetching', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  answer(desk, a);
  desk.jobs([heldJob(a, 'found')]);
  desk.done = [];
  desk.send({ type: 'play', id: a });
  // The same asking as any tap: the phone lets the held job go, to the front. Nothing is looked for.
  assert.deepEqual(desk.asks().map((ask) => [ask.id, ask.front, ask.hold]), [[a, true, false]]);
  assert.equal(desk.state.list[0].ahead, undefined);
  assert.equal(desk.state.live.get(a)?.phase, 'waiting');
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.jobs([job(a, 'downloading', { progress: 10 })]);
  assert.deepEqual(desk.state.live.get(a), { phase: 'fetching', stage: 'downloading', progress: 10 });
  assert.equal(desk.state.intent?.id, a);
});

test('the songs kept ready take a found song as their own when the window reaches it', () => {
  const desk = seeking({ ready: 1 });
  desk.open();
  const [a, b] = desk.ids();
  answer(desk, b);
  desk.jobs([heldJob(b, 'found')]);
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.jobs([job(a, 'done'), heldJob(b, 'found')]);
  desk.send({ type: 'track', id: a, jobId: `job-${a}`, track: track(`job-${a}`) });
  desk.done = [];
  // The first is played; the window is now the second, which is found and only has to be let go.
  desk.send({ type: 'play', id: a });
  assert.deepEqual(desk.asks().map((ask) => [ask.id, ask.front, ask.hold, ask.wifiOnly]), [[b, false, false, true]]);
});

test('a song found ahead to have no recording leaves the list at once, with nothing said, and another takes its place at the end', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const before = desk.ids();
  const [a] = before;
  answer(desk, a);
  desk.done = [];
  desk.jobs([heldJob(a, 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH' })]);
  // Gone in the same breath: nobody asked for it, and there is no moment of a row saying so.
  assert.deepEqual(desk.ids().slice(0, 9), before.slice(1));
  assert.equal(desk.ids().length, 10);
  assert.ok(!before.includes(desk.ids()[9]));
  assert.deepEqual(desk.of('away').map((e) => [e.song.recordingMbid, e.reason]), [[a, 'unmatched']]);
  assert.ok(desk.state.retired.includes(`job-${a}`));
  assert.equal(desk.state.notice, null);
});

test('a search ahead that came to nothing for a passing reason is forgotten until tomorrow, and the row is as it was', () => {
  const desk = seeking({ ready: 0 }, 10);
  desk.open();
  const ids = desk.ids();
  answer(desk, ids[0]);
  desk.done = [];
  desk.jobs([heldJob(ids[0], 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK' })]);
  const row = desk.state.list[0];
  assert.equal(row.failure, undefined);
  assert.equal(row.jobId, undefined);
  assert.equal(row.ahead, undefined);
  assert.equal(row.soughtAt, desk.now);
  // The phone could not be asked at all for another: the same.
  desk.send({ type: 'askFailed', id: ids[1], code: 'ERR_DOWNLOAD_QUEUE_FULL', hold: true });
  assert.equal(desk.state.list[1].failure, undefined);
  // (The rest are answered the same way, so that nothing is left under way to wait behind.)
  while (desk.state.seeking.size) desk.send({ type: 'askFailed', id: [...desk.state.seeking][0], code: 'ERR_TEST', hold: true });
  desk.done = [];
  desk.later(DAY - 1);
  assert.ok(!desk.seeks().some((ask) => ask.id === ids[0] || ask.id === ids[1]));
  desk.later(1);
  assert.ok(desk.seeks().some((ask) => ask.id === ids[0]));
  // Tapped meanwhile it is looked for then, as a tap always was.
  const other = seeking({ ready: 0 });
  other.open();
  const [x] = other.ids();
  answer(other, x);
  other.jobs([heldJob(x, 'cancelled')]);
  assert.equal(other.state.list[0].failure, undefined, 'not a download somebody stopped');
  assert.deepEqual(other.asks(other.send({ type: 'play', id: x })).map((ask) => ask.front), [true]);
});

test('a song that leaves the list has its held search stopped, and so has every song of a list that is replaced', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const ids = desk.ids();
  answer(desk, ...ids.slice(0, 3));
  desk.jobs([heldJob(ids[0], 'found'), heldJob(ids[1], 'queued'), heldJob(ids[2], 'finding')]);
  desk.done = [];
  desk.send({ type: 'exclude', id: ids[0] });
  assert.deepEqual(desk.of('cancel').map((e) => e.jobId), [`job-${ids[0]}`]);
  assert.ok(desk.state.retired.includes(`job-${ids[0]}`));
  desk.jobs([heldJob(ids[0], 'cancelled'), heldJob(ids[1], 'queued'), heldJob(ids[2], 'finding')]);
  desk.done = [];
  desk.send({ type: 'refresh' });
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  assert.deepEqual(desk.of('cancel').map((e) => e.jobId).sort(), [`job-${ids[1]}`, `job-${ids[2]}`].sort());
});

test('a new list in the making is looked for ahead too, after the one on show', () => {
  const desk = seeking({ ready: 1 }, 60);
  desk.open();
  const ids = desk.ids();
  // The whole of the list on show is found.
  desk.send({ type: 'asked', id: ids[0], jobId: `job-${ids[0]}` });
  answer(desk, ...ids.slice(1));
  desk.jobs([job(ids[0], 'queued'), ...ids.slice(1).map((key) => heldJob(key, 'found'))]);
  desk.send({ type: 'refresh' });
  desk.done = [];
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  const staged = desk.state.staged!.items.map((item) => item.id);
  // Its first song is wanted ready; the three after it are looked for.
  assert.deepEqual(desk.asks().map((ask) => ask.id), [staged[0]]);
  assert.deepEqual(desk.seeks().map((ask) => ask.id), staged.slice(1, 4));
});

test('on mobile data the songs kept ready wait for Wi-Fi and the looking ahead goes on; with no connection neither does', () => {
  const desk = seeking({ ready: 2, wifiOnly: true });
  const effects = desk.open(MOBILE);
  assert.equal(desk.asks(effects).length, 0);
  assert.equal(desk.state.held, 'wifi');
  // The rows the window would have taken are looked for as well: a tap on them is allowed mobile data.
  assert.deepEqual(desk.seeks(effects).map((ask) => [ask.id, ask.wifiOnly]), desk.ids().slice(0, 3).map((key) => [key, false]));
  const offline = seeking({ ready: 2 });
  assert.equal(offline.seeks(offline.open({ connected: false, wifi: false })).length, 0);
  const paused = seeking({ ready: 0 });
  paused.jobs([], true);
  assert.equal(paused.seeks(paused.send({ type: 'maintain', network: WIFI, away: NOBODY, hidden: NOBODY })).length, 0);
});

test('a song with a job of any kind is not looked for ahead: ready, being fetched, failed, or tapped', () => {
  const desk = new Desk({ ready: 0 }, 10);
  desk.open();
  const ids = desk.ids();
  desk.ready(Number(ids[0].slice(-3)));
  desk.send({ type: 'play', id: ids[1] });
  desk.send({ type: 'asked', id: ids[2], jobId: `job-${ids[2]}` });
  desk.jobs([job(ids[0], 'done'), job(ids[2], 'failed', { errorCode: 'ERR_YOUTUBE_TIMED_OUT' })]);
  desk.ahead = true;
  desk.done = [];
  desk.later(DAY * 2);
  const sought = desk.seeks().map((ask) => ask.id);
  assert.ok(sought.length > 0);
  for (const key of ids.slice(0, 3)) assert.ok(!sought.includes(key), key);
});

test('the phone saying a song is stored starts it, and the queue catching up afterwards changes nothing', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  desk.send({ type: 'play', id: a });
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.jobs([job(a, 'downloading', { progress: 90 })]);
  desk.done = [];
  // Ahead of the queue's own record of it: the last reading still says it is coming down.
  desk.send({ type: 'track', id: a, jobId: `job-${a}`, track: track(`job-${a}`) });
  assert.deepEqual(desk.of('play')[0].tracks.map((t) => t.id), [`discover:job-${a}`]);
  assert.equal(desk.state.live.has(a), false);
  // The readings that follow say "saving" and then "done". Neither puts the row back to fetching, or asks for the file again.
  desk.jobs([job(a, 'saving', { progress: 100 })]);
  assert.equal(desk.state.live.has(a), false);
  desk.jobs([job(a, 'done')]);
  assert.equal(desk.of('track').length, 0);
  assert.equal(desk.of('play').length, 1);
});

test('a sleeve that came after its song has the track read once more, and once only', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  desk.ready(Number(a.slice(-3)));
  desk.done = [];
  const sleeve = 'file:///data/album-artwork/abc.jpg';
  desk.jobs([job(a, 'done', { artworkUri: sleeve })]);
  assert.deepEqual(desk.of('track').map((e) => e.jobId), [`job-${a}`]);
  // Read, and it has it.
  desk.send({ type: 'track', id: a, jobId: `job-${a}`, track: { ...track(`job-${a}`), artworkUri: sleeve } });
  assert.equal(desk.state.list[0].track?.artworkUri, sleeve);
  desk.jobs([job(a, 'done', { artworkUri: sleeve, progress: 100 })]);
  assert.equal(desk.of('track').length, 1);
});

/* Thirty seconds of a song, while it is fetched. */

const previews = (desk: Desk, effects: Effect[] = desk.done) => desk.of('preview', effects).map((effect) => effect.id);
const stops = (desk: Desk, effects: Effect[] = desk.done) => desk.of('stopPreview', effects).length;

test('a tap on a song that is not ready asks for its preview beside the song, and the song takes over from its start when it is in', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  const tapped = desk.send({ type: 'play', id: a });
  assert.deepEqual(desk.asks(tapped).map((ask) => [ask.id, ask.front]), [[a, true]]);
  assert.deepEqual(previews(desk, tapped), [a]);
  assert.deepEqual(desk.state.preview, { id: a, phase: 'finding' });
  desk.send({ type: 'previewed', id: a, state: 'playing' });
  assert.deepEqual(desk.state.preview, { id: a, phase: 'playing' });
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.jobs([job(a, 'downloading', { progress: 40 })]);
  assert.equal(desk.state.preview?.phase, 'playing');
  desk.done = [];
  // The file is in. The preview is stopped and then the song is started, in that order, and from the song's beginning.
  desk.send({ type: 'track', id: a, jobId: `job-${a}`, track: track(`job-${a}`) });
  const kinds = desk.done.map((effect) => effect.kind).filter((kind) => kind === 'stopPreview' || kind === 'play');
  assert.deepEqual(kinds, ['stopPreview', 'play']);
  assert.equal(desk.state.preview, null);
  assert.deepEqual(desk.of('play')[0].tracks.map((t) => t.id), [`discover:job-${a}`]);
});

test('a ready song is played and never previewed, and with previews switched off nothing is', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const ids = desk.ids();
  desk.ready(Number(ids[0].slice(-3)));
  desk.done = [];
  desk.send({ type: 'play', id: ids[0] });
  assert.equal(previews(desk).length, 0);
  const off = new Desk({ ready: 0, preview: false });
  off.open();
  assert.equal(previews(off, off.send({ type: 'play', id: off.ids()[0] })).length, 0);
  assert.equal(off.state.preview, null);
  // And nothing is tried with no connection to play it from.
  const offline = new Desk({ ready: 0 });
  offline.open({ connected: false, wifi: false });
  assert.equal(previews(offline, offline.send({ type: 'play', id: offline.ids()[0] })).length, 0);
});

test('where there is no preview to be had, or it runs its length first, the tap is what it always was', () => {
  for (const state of ['none', 'ended', 'failed', 'stopped'] as const) {
    const desk = new Desk({ ready: 0 });
    desk.open();
    const [a] = desk.ids();
    desk.send({ type: 'play', id: a });
    if (state !== 'none') desk.send({ type: 'previewed', id: a, state: 'playing' });
    desk.done = [];
    desk.send({ type: 'previewed', id: a, state });
    assert.equal(desk.state.preview, null, state);
    // Nothing to stop: it is over by itself. The song is still wanted, and starts when it is in.
    assert.equal(stops(desk), 0, state);
    assert.equal(desk.state.intent?.id, a, state);
    desk.ready(Number(a.slice(-3)));
    assert.equal(desk.of('play').length, 1, state);
    assert.equal(stops(desk), 0, state);
  }
});

test('the song arriving before its preview has been found means there is no preview', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  desk.send({ type: 'play', id: a });
  desk.done = [];
  desk.ready(Number(a.slice(-3)));
  // Told to stop, which is also what keeps a looking-up still under way from starting one.
  assert.equal(stops(desk), 1);
  assert.equal(desk.state.preview, null);
  // What the phone says of it afterwards is about nothing there is.
  desk.send({ type: 'previewed', id: a, state: 'playing' });
  assert.equal(desk.state.preview, null);
});

test('a download that fails stops the preview and says so on the row', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  desk.send({ type: 'play', id: a });
  desk.send({ type: 'previewed', id: a, state: 'playing' });
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.done = [];
  desk.jobs([job(a, 'failed', { errorCode: 'ERR_YOUTUBE_UNAVAILABLE' })]);
  assert.equal(stops(desk), 1);
  assert.equal(desk.state.preview, null);
  assert.equal(desk.state.list[0].failure?.code, 'ERR_YOUTUBE_UNAVAILABLE');
  // The same for a song that turns out to have no recording.
  const other = new Desk({ ready: 0 });
  other.open();
  const [b] = other.ids();
  other.send({ type: 'play', id: b });
  other.send({ type: 'previewed', id: b, state: 'playing' });
  other.send({ type: 'asked', id: b, jobId: `job-${b}` });
  other.done = [];
  other.jobs([job(b, 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH' })]);
  assert.equal(stops(other), 1);
});

test('tapping the row that is being previewed stops the preview and leaves the song coming; tapped once more, it is previewed again', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  desk.send({ type: 'play', id: a });
  desk.send({ type: 'previewed', id: a, state: 'playing' });
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.jobs([job(a, 'downloading', { progress: 10 })]);
  desk.done = [];
  desk.send({ type: 'play', id: a });
  assert.equal(stops(desk), 1);
  assert.equal(desk.state.preview, null);
  // Nothing about the download is touched, and the song still starts when it is in.
  assert.equal(desk.asks().length + desk.of('cancel').length, 0);
  assert.equal(desk.state.intent?.id, a);
  assert.deepEqual(previews(desk, desk.send({ type: 'play', id: a })), [a]);
  desk.done = [];
  desk.send({ type: 'track', id: a, jobId: `job-${a}`, track: track(`job-${a}`) });
  assert.equal(desk.of('play').length, 1);
});

test('tapping another row moves the preview to it', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b] = desk.ids();
  desk.send({ type: 'play', id: a });
  desk.send({ type: 'previewed', id: a, state: 'playing' });
  desk.done = [];
  desk.send({ type: 'play', id: b });
  assert.equal(stops(desk), 1);
  assert.deepEqual(previews(desk), [b]);
  assert.deepEqual(desk.state.preview, { id: b, phase: 'finding' });
  // The first row's is over, and what is said of it late changes nothing.
  desk.send({ type: 'previewed', id: a, state: 'stopped' });
  assert.equal(desk.state.preview?.id, b);
  // The first song, in when it is in, does not start: the second is the one wanted.
  desk.done = [];
  desk.ready(Number(a.slice(-3)));
  assert.equal(desk.of('play').length, 0);
  assert.equal(desk.state.preview?.id, b);
});

test('a preview ends when the player is started, when the row goes, when previews are switched off and when the app is left', () => {
  const previewing = () => {
    const desk = new Desk({ ready: 0 });
    desk.open();
    const [a] = desk.ids();
    desk.send({ type: 'player', currentId: '41', queue: ['41', '42'], playing: true });
    desk.send({ type: 'play', id: a });
    desk.send({ type: 'previewed', id: a, state: 'playing' });
    // The app's player gives way to it, as the phone makes it.
    desk.send({ type: 'player', currentId: '41', queue: ['41', '42'], playing: false });
    assert.equal(desk.state.preview?.phase, 'playing');
    desk.done = [];
    return { desk, a };
  };
  let { desk, a } = previewing();
  desk.send({ type: 'player', currentId: '41', queue: ['41', '42'], playing: true });
  assert.equal(stops(desk), 1, 'the player was started again');
  // The song is still on its way, and takes the player when it is in, as a tap always meant.
  assert.equal(desk.state.intent?.id, a);

  ({ desk, a } = previewing());
  desk.send({ type: 'player', currentId: '7', queue: ['7', '8'], playing: true });
  assert.equal(stops(desk), 1, 'something else was put on');
  assert.equal(desk.state.intent, null);

  ({ desk, a } = previewing());
  desk.send({ type: 'exclude', id: a });
  assert.equal(stops(desk), 1, 'the row was taken off');

  ({ desk, a } = previewing());
  desk.send({ type: 'settings', value: { ...desk.state.settings, preview: false } });
  assert.equal(stops(desk), 1, 'previews were switched off');

  ({ desk, a } = previewing());
  desk.send({ type: 'background' });
  assert.equal(stops(desk), 1, 'the app was left');
  assert.equal(desk.state.intent?.id, a);
  assert.equal(desk.of('cancel').length, 0);
});

test('a preview is nothing that is written down', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = desk.ids();
  desk.send({ type: 'play', id: a });
  const list = desk.state.list;
  desk.send({ type: 'previewed', id: a, state: 'playing' });
  desk.send({ type: 'previewed', id: a, state: 'ended' });
  assert.equal(desk.state.list, list);
  assert.equal(desk.state.list[0].heardAt, undefined);
});
