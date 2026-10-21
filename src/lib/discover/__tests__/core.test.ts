import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_AGAIN_MS, BUILD_EVERY_MS, CALLED_ROOM, EMPTY, FILE_MISSING, GRACE_MS, NO_MATCH_SHOWN_MS, RETRY_AFTER_MS, STAGE_WAIT_MS, STOPPED, UNDO_MS,
  confirmable, initial, itemOf, playable, reduce, seenOf, stagedProgress, wakeAt, wanted,
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
      this.confirm();
    }
    return out.effects;
  }

  /**
   * Takes every song there is as confirmed, where it stands: for what is
   * held to here that is not about songs coming to be seen, the phone is
   * taken to have found each one the moment it was chosen.
   */
  confirm(): void {
    const all = (items: readonly Item[]) => (items.some((item) => !item.seen) ? items.map((item) => (item.seen ? item : { ...item, seen: true as const })) : items);
    const list = all(this.state.list);
    const staged = this.state.staged && { ...this.state.staged, items: all(this.state.staged.items) };
    if (list !== this.state.list || staged?.items !== this.state.staged?.items) this.state = { ...this.state, list, staged };
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

test('a song on the screen that turns out to have no recording stays, as a row that failed, and is not taken from under the tap', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const before = desk.ids();
  const [a] = first(desk, 1);
  desk.send({ type: 'play', id: id(a) });
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  const effects = desk.jobs([job(id(a), 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH', video: { id: '', url: '', title: '', channel: '', thumbnail: null, duration: null, find: { query: 'q', artist: 'a', title: 't', durationSec: null } } })]);
  // Somebody tapped it. It says it could not be fetched; it is not put away, and no other song slips into its place.
  assert.equal(desk.of('away', effects).length, 0);
  assert.equal(NO_MATCH_SHOWN_MS, 0);
  assert.deepEqual(desk.ids(), before);
  assert.equal(desk.item(a).failure?.code, 'ERR_DOWNLOAD_NO_MATCH');
  assert.equal(desk.item(a).goneAt, undefined);
  assert.equal(desk.state.intent, null);
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

/*
  Keeping a song whose file is another song: `bôa – Twilight` fetched as
  `Frozen`, before the mending when the app comes to the front got to it.
*/

/** A finished job for song [n] whose video, by its title, is another song. */
const wrongJob = (n: number, jobId = `job-${id(n)}`) => job(id(n), 'done', {
  id: jobId, trackId: `discover:${jobId}`,
  video: {
    id: `video-${jobId}`, url: '', title: `Artist ${n} - Twilight`, channel: `Artist ${n}`, thumbnail: null, duration: 200,
    discoveryTitle: `Song ${n}`, discoveryArtist: `Artist ${n}`,
  },
});

/** Song [n] ready, from [found]: the phone answering, the queue read, the file handed over. */
function readyWith(desk: Desk, n: number, found: DownloadJob): void {
  desk.send({ type: 'asked', id: id(n), jobId: found.id });
  desk.jobs([...desk.state.jobs.filter((other) => other.discoverKey !== id(n)), found]);
  desk.send({ type: 'track', id: id(n), jobId: found.id, track: track(found.id) });
}

test('a song whose file is another song is not kept: the file is let go, the song fetched again and kept then', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  readyWith(desk, a, wrongJob(a));
  desk.done = [];
  desk.send({ type: 'keep', id: id(a) });
  assert.equal(desk.of('keep').length, 0);
  assert.deepEqual(desk.of('mend').map((e) => [e.id, e.jobId]), [[id(a), `job-${id(a)}`]]);
  assert.equal(desk.state.notice?.kind, 'wrongFile');
  assert.equal(desk.state.notice?.id, id(a));
  assert.equal(desk.item(a).keep, true);
  // Asked to be let go once, however many readings of the queue go by before the phone answers.
  desk.send({ type: 'tick' });
  desk.jobs([...desk.state.jobs]);
  assert.equal(desk.of('mend').length, 1);
  assert.equal(desk.of('keep').length, 0);

  // Gone: the song is asked for again at once, at the front, still to be kept.
  desk.done = [];
  desk.send({ type: 'mended', id: id(a), jobId: `job-${id(a)}`, removed: true });
  assert.equal(desk.item(a).track, undefined);
  assert.deepEqual(desk.asks().map((e) => [e.id, e.front]), [[id(a), true]]);
  assert.equal(desk.item(a).keep, true);

  // The right file this time, and it is kept.
  desk.done = [];
  readyWith(desk, a, job(id(a), 'done', { id: 'job-again' }));
  assert.deepEqual(desk.of('keep').map((e) => e.jobId), ['job-again']);
  assert.equal(desk.of('mend').length, 0);
});

test('every way of keeping goes through the same check: a keep pressed while the file was still coming is not kept either', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.send({ type: 'keep', id: id(a) });
  desk.done = [];
  readyWith(desk, a, wrongJob(a));
  assert.equal(desk.of('keep').length, 0);
  assert.equal(desk.of('mend').length, 1);
});

test('the wrong file that is playing is let go when the player has moved on, and the song is asked for when its job is gone', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  readyWith(desk, a, wrongJob(a));
  const playing = `discover:job-${id(a)}`;
  desk.send({ type: 'player', currentId: playing, queue: [playing, '7'], playing: true });
  desk.done = [];
  desk.send({ type: 'keep', id: id(a) });
  // Said at once, and nothing cut off: the file is not let go while it is heard.
  assert.equal(desk.state.notice?.kind, 'wrongFile');
  assert.equal(desk.of('mend').length, 0);
  assert.equal(desk.of('keep').length, 0);
  desk.send({ type: 'player', currentId: '7', queue: [playing, '7'], playing: true });
  assert.equal(desk.of('mend').length, 1);

  // The phone would not let it go after all. Nothing is asked of it again, here or at every reading.
  desk.send({ type: 'mended', id: id(a), jobId: `job-${id(a)}`, removed: false });
  desk.send({ type: 'tick' });
  assert.equal(desk.of('mend').length, 1);
  assert.equal(desk.item(a).jobId, `job-${id(a)}`);

  // The mending when the app comes to the front took it: read as gone, the song is asked for again.
  desk.done = [];
  desk.now += GRACE_MS + 1;
  desk.jobs(desk.state.jobs.filter((other) => other.discoverKey !== id(a)));
  assert.deepEqual(desk.asks().map((e) => [e.id, e.front]), [[id(a), true]]);
  assert.equal(desk.item(a).keep, true);
});

test('a song whose second file is another song as well is not looked for a third time, and is not kept', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  readyWith(desk, a, wrongJob(a));
  desk.send({ type: 'keep', id: id(a) });
  desk.send({ type: 'mended', id: id(a), jobId: `job-${id(a)}`, removed: true });
  desk.done = [];
  readyWith(desk, a, wrongJob(a, 'job-again'));
  assert.equal(desk.of('keep').length, 0);
  assert.equal(desk.of('mend').length, 0);
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


test('a song on the screen whose video turns out not to be a song stays as a failed row, and is never fetched again behind anybody’s back', () => {
  const desk = new Desk({ ready: 1 });
  desk.open();
  const before = desk.ids();
  const [a, b] = first(desk, 2);
  desk.send({ type: 'asked', id: id(a), jobId: `job-${id(a)}` });
  desk.done = [];
  // What the phone says of a live stream or a two-hour video, found out only when it came to be fetched.
  desk.jobs([job(id(a), 'failed', { errorCode: 'ERR_YOUTUBE_NOT_A_SONG' })]);
  assert.equal(desk.of('away').length, 0);
  assert.deepEqual(desk.ids(), before);
  assert.equal(desk.item(a).failure?.code, 'ERR_YOUTUBE_NOT_A_SONG');
  // Its place among the songs kept ready goes to the next, and it waits to be tapped or taken off.
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(b)]);
  desk.later(DAY * 2);
  assert.ok(!desk.asks().some((ask) => ask.id === id(a)));
});

/* Songs looked for ahead, and held — and shown only once they are found. */

/**
 * A desk on which nothing is taken as confirmed: the list is chosen and
 * nobody can see any of it, and the songs asked to be looked for are the
 * test's to answer.
 */
function seeking(settings: Partial<DiscoverSettings> = {}, songs = 60): Desk {
  const desk = new Desk(settings, songs, false);
  desk.ahead = true;
  desk.send({ type: 'tick' });
  desk.state = { ...desk.state, refreshedAt: desk.now, attemptAt: desk.now - DAY, building: null };
  desk.done = [];
  return desk;
}
const heldJob = (key: string, status: DownloadStatus, more: Partial<DownloadJob> = {}) =>
  job(key, status, { hold: true, automatic: true, ...more });
const TO_FIND = { id: '', url: '', title: '', channel: '', thumbnail: null, duration: null, find: { query: 'q', artist: 'a', title: 't', durationSec: null } };
/** The phone answers an asking-ahead with a job, which then waits to be looked for. */
function answer(desk: Desk, ...keys: string[]): void {
  for (const key of keys) desk.send({ type: 'asked', id: key, jobId: `job-${key}`, hold: true });
}
/** What is on the screen: the confirmed songs, in their order. */
const seen = (desk: Desk) => seenOf(desk.state.list).map((item) => item.id);
/** The phone finds every song it has been asked to look for, until there is nothing more to ask. Answers the jobs as it leaves them. */
function findAll(desk: Desk, jobs: DownloadJob[] = []): DownloadJob[] {
  for (let round = 0; round < 50 && desk.state.seeking.size; round++) {
    const keys = [...desk.state.seeking];
    answer(desk, ...keys);
    jobs = [...jobs.filter((other) => !keys.includes(other.discoverKey!)), ...keys.map((key) => heldJob(key, 'found'))];
    desk.jobs(jobs);
  }
  return jobs;
}

test('a new list shows nothing until a song is found, and then the songs one by one, in the order of the list', () => {
  const desk = seeking({ ready: 0 });
  const effects = desk.open();
  const ids = desk.ids();
  assert.equal(ids.length, 10);
  // Chosen, and nobody can see any of it. The first three are being looked for.
  assert.deepEqual(seen(desk), []);
  assert.deepEqual(desk.seeks(effects).map((ask) => [ask.id, ask.front, ask.wifiOnly]), ids.slice(0, 3).map((key) => [key, false, false]));
  assert.equal(desk.asks().length, 0);
  answer(desk, ...ids.slice(0, 3));
  desk.jobs(ids.slice(0, 3).map((key) => heldJob(key, 'queued', { video: TO_FIND })));
  assert.deepEqual(seen(desk), []);
  // Waiting and being looked for are nothing to see either, and nothing is said of them.
  desk.jobs([heldJob(ids[0], 'finding', { video: TO_FIND }), ...ids.slice(1, 3).map((key) => heldJob(key, 'queued', { video: TO_FIND }))]);
  assert.deepEqual(seen(desk), []);
  assert.equal(desk.state.live.size, 0);
  // Found: the first row. And the fourth song is asked for, so that three are always under way.
  desk.done = [];
  desk.jobs([heldJob(ids[0], 'found'), ...ids.slice(1, 3).map((key) => heldJob(key, 'queued', { video: TO_FIND }))]);
  assert.deepEqual(seen(desk), [ids[0]]);
  assert.deepEqual(desk.seeks().map((ask) => ask.id), [ids[3]]);
  desk.jobs([heldJob(ids[0], 'found'), heldJob(ids[1], 'found'), heldJob(ids[2], 'queued', { video: TO_FIND })]);
  assert.deepEqual(seen(desk), ids.slice(0, 2));
  // To the end of the list, and no further: every song found is every song shown, in the order it was chosen in.
  findAll(desk, ids.slice(0, 3).map((key) => heldJob(key, 'found')));
  assert.deepEqual(seen(desk), ids);
  assert.deepEqual(desk.ids(), ids);
  desk.done = [];
  desk.later(DAY * 3);
  assert.equal(desk.seeks().length, 0);
});

test('a song with no recording is never seen: it gives its place up unseen, and the next candidate is looked for the same way', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const before = desk.ids();
  answer(desk, ...before.slice(0, 3));
  desk.done = [];
  desk.jobs([heldJob(before[0], 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH', video: TO_FIND }),
    heldJob(before[1], 'found'), heldJob(before[2], 'queued', { video: TO_FIND })]);
  // Gone in the same breath, with nothing said, and never on the screen. Another is chosen in its stead, at the end, unseen.
  assert.deepEqual(desk.of('away').map((e) => [e.song.recordingMbid, e.reason]), [[before[0], 'unmatched']]);
  assert.ok(!desk.ids().includes(before[0]));
  assert.equal(desk.ids().length, 10);
  const newcomer = desk.ids().find((key) => !before.includes(key))!;
  assert.deepEqual(seen(desk), [before[1]]);
  assert.equal(desk.state.notice, null);
  // And it is looked for in its turn, after the songs that were chosen before it.
  findAll(desk, [heldJob(before[1], 'found'), heldJob(before[2], 'found')]);
  assert.deepEqual(seen(desk), [...before.slice(1), newcomer]);
  assert.ok(desk.seeks().some((ask) => ask.id === newcomer));
});

test('a row never appears above rows already on the screen: a song confirmed late joins at the end', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const ids = desk.ids();
  answer(desk, ...ids.slice(0, 3));
  // The first could not be looked for just now; the second and third are found.
  desk.jobs([heldJob(ids[0], 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK', video: TO_FIND }), heldJob(ids[1], 'found'), heldJob(ids[2], 'found')]);
  assert.deepEqual(seen(desk), [ids[1], ids[2]]);
  const shownBefore = seen(desk);
  let jobs = findAll(desk, [heldJob(ids[1], 'found'), heldJob(ids[2], 'found')]);
  assert.deepEqual(seen(desk), ids.slice(1));
  // A day on it is looked for again and found. Everything that was on the screen is where it was; it is the last row.
  desk.later(DAY);
  jobs = findAll(desk, jobs);
  assert.deepEqual(seen(desk), [...ids.slice(1), ids[0]]);
  assert.deepEqual(seen(desk).slice(0, 2), shownBefore);
});

test('a search that came to nothing for a passing reason leaves the song unseen until tomorrow, or until more are asked for', () => {
  const desk = seeking({ ready: 0 }, 10);
  desk.open();
  const ids = desk.ids();
  answer(desk, ids[0]);
  desk.jobs([heldJob(ids[0], 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK', video: TO_FIND })]);
  const row = desk.state.list.find((item) => item.id === ids[0])!;
  assert.equal(row.failure, undefined);
  assert.equal(row.jobId, undefined);
  assert.equal(row.seen, undefined);
  assert.equal(row.soughtAt, desk.now);
  // The phone could not be asked at all for another: the same. And so for the rest, so that nothing is left under way.
  while (desk.state.seeking.size) desk.send({ type: 'askFailed', id: [...desk.state.seeking][0], code: 'ERR_TEST', hold: true });
  assert.deepEqual(seen(desk), []);
  assert.ok(desk.state.list.every((item) => !confirmable(desk.state, item, desk.now)));
  desk.done = [];
  desk.later(DAY - 1);
  assert.equal(desk.seeks().length, 0);
  // Asked for by hand, they are looked for again now, and the catalogue is not troubled for songs it has already given.
  const pressed = desk.send({ type: 'findMore' });
  assert.deepEqual(desk.seeks(pressed).map((ask) => ask.id), ids.slice(0, 3));
  assert.equal(desk.of('build', pressed).length, 0);
  // Left alone they would have been looked for again when the day was up.
  const left = seeking({ ready: 0 }, 10);
  left.open();
  while (left.state.seeking.size) left.send({ type: 'askFailed', id: [...left.state.seeking][0], code: 'ERR_TEST', hold: true });
  left.done = [];
  left.later(DAY);
  assert.equal(left.seeks().length, 3);
});

test('a job left by an older version that fails while still being looked for is forgotten the same way, and is no red row', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const ids = desk.ids();
  while (desk.state.seeking.size) desk.send({ type: 'askFailed', id: [...desk.state.seeking][0], code: 'ERR_TEST', hold: true });
  // One of Discover's own from before songs were held: looked for and fetched in one job.
  desk.jobs([job(ids[0], 'queued', { automatic: true, video: TO_FIND })]);
  assert.deepEqual(seen(desk), []);
  assert.equal(desk.state.live.size, 0);
  desk.jobs([job(ids[0], 'failed', { errorCode: 'ERR_YOUTUBE_TIMED_OUT', video: TO_FIND })]);
  const row = desk.state.list.find((item) => item.id === ids[0])!;
  assert.equal(row.failure, undefined);
  assert.equal(row.seen, undefined);
  // And one that got as far as having a video is a song that can be shown, whatever became of the fetching.
  desk.jobs([job(ids[1], 'queued', { automatic: true })]);
  assert.deepEqual(seen(desk), [ids[1]]);
  desk.jobs([job(ids[1], 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK' })]);
  assert.deepEqual(seen(desk), [ids[1]]);
  assert.equal(desk.state.list[0].failure?.code, 'ERR_YOUTUBE_NETWORK');
});

test('a tap on a song goes straight to fetching: its video was found before it was ever shown', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const jobs = findAll(desk);
  const [a] = seen(desk);
  desk.done = [];
  desk.send({ type: 'play', id: a });
  // The same asking as any tap: the phone lets the held job go, to the front. Nothing is looked for.
  assert.deepEqual(desk.asks().map((ask) => [ask.id, ask.front, ask.hold]), [[a, true, false]]);
  assert.equal(desk.state.list[0].ahead, undefined);
  assert.equal(desk.state.live.get(a)?.phase, 'waiting');
  desk.send({ type: 'asked', id: a, jobId: `job-${a}` });
  desk.jobs([job(a, 'downloading', { progress: 10 }), ...jobs.filter((other) => other.discoverKey !== a)]);
  assert.deepEqual(desk.state.live.get(a), { phase: 'fetching', stage: 'downloading', progress: 10 });
  assert.equal(desk.state.intent?.id, a);
});

test('nothing reaches a song that is not on the screen: not a tap, a keep, a taking-off, the songs kept ready or the song after the one playing', () => {
  const desk = seeking({ ready: 2 });
  desk.open();
  const ids = desk.ids();
  // With songs to keep ready and none confirmed, nothing is fetched: there is nothing shown to fetch.
  assert.equal(desk.asks().length, 0);
  assert.equal(wanted(desk.state, desk.now).length, 0);
  for (const type of ['play', 'keep', 'exclude'] as const) {
    const state = desk.state;
    assert.equal(desk.send({ type, id: ids[5] }).length, 0, type);
    assert.equal(desk.state, state, type);
  }
  // The first and third are found; the second could not be looked for today.
  answer(desk, ...ids.slice(0, 3));
  desk.done = [];
  desk.jobs([heldJob(ids[0], 'found'), heldJob(ids[1], 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK', video: TO_FIND }), heldJob(ids[2], 'found')]);
  assert.deepEqual(seen(desk), [ids[0], ids[2]]);
  // The songs kept ready are the first two on the screen, and they only have to be let go: found already.
  assert.deepEqual(desk.asks().map((ask) => [ask.id, ask.front, ask.hold]), [[ids[0], false, false], [ids[2], false, false]]);
  for (const key of [ids[0], ids[2]]) {
    desk.send({ type: 'asked', id: key, jobId: `job-${key}` });
    desk.send({ type: 'track', id: key, jobId: `job-${key}`, track: track(`job-${key}`) });
  }
  desk.done = [];
  // Played through, it goes from the first to the third. The second is not there to go to.
  desk.send({ type: 'play', id: ids[0] });
  assert.deepEqual(desk.of('play')[0].tracks.map((t) => t.id), [`discover:job-${ids[0]}`, `discover:job-${ids[2]}`]);
  assert.ok(!desk.asks().some((ask) => ask.id === ids[1]));
});

test('a song that leaves the list has its held search stopped, and so has every song of a list that is replaced', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const ids = desk.ids();
  answer(desk, ...ids.slice(0, 3));
  const queue = [heldJob(ids[0], 'found'), heldJob(ids[1], 'queued', { video: TO_FIND }), heldJob(ids[2], 'finding', { video: TO_FIND })];
  desk.jobs(queue);
  desk.done = [];
  desk.send({ type: 'exclude', id: ids[0] });
  assert.deepEqual(desk.of('cancel').map((e) => e.jobId), [`job-${ids[0]}`]);
  assert.ok(desk.state.retired.includes(`job-${ids[0]}`));
});

test('on mobile data the songs kept ready wait for Wi-Fi and the looking goes on; with no connection, or the queue paused, it does not', () => {
  const desk = seeking({ ready: 2, wifiOnly: true });
  const effects = desk.open(MOBILE);
  assert.deepEqual(desk.seeks(effects).map((ask) => [ask.id, ask.wifiOnly]), desk.ids().slice(0, 3).map((key) => [key, false]));
  findAll(desk);
  // Every song is on the screen; the two that would be kept ready are held for Wi-Fi, and a tap fetches on what there is.
  assert.equal(seen(desk).length, 10);
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.state.held, 'wifi');
  const offline = seeking({ ready: 2 });
  assert.equal(offline.seeks(offline.open({ connected: false, wifi: false })).length, 0);
  const paused = seeking({ ready: 0 });
  paused.jobs([], true);
  assert.equal(paused.seeks(paused.send({ type: 'maintain', network: WIFI, away: NOBODY, hidden: NOBODY })).length, 0);
});

test('with no connection the songs already on the screen stay, and the rest wait unseen to be looked for when it is back', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const ids = desk.ids();
  answer(desk, ...ids.slice(0, 3));
  const jobs = ids.slice(0, 3).map((key) => heldJob(key, 'found'));
  desk.jobs(jobs);
  assert.deepEqual(seen(desk), ids.slice(0, 3));
  // Three more were asked for as those came in. The connection goes before they are looked for.
  const pending = [...desk.state.seeking];
  answer(desk, ...pending);
  desk.send({ type: 'network', network: { connected: false, wifi: false } });
  desk.jobs([...jobs, ...pending.map((key) => heldJob(key, 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK', video: TO_FIND }))]);
  desk.done = [];
  desk.later(60_000);
  assert.deepEqual(seen(desk), ids.slice(0, 3));
  assert.equal(desk.seeks().length, 0);
  assert.equal(desk.ids().length, 10);
  // Back: the songs that had not been looked for yet are, at once. The ones that failed for want of it wait for tomorrow —
  const back = desk.send({ type: 'network', network: WIFI });
  assert.equal(desk.seeks(back).length, 3);
  assert.ok(desk.seeks(back).every((ask) => !pending.includes(ask.id)));
  // — or for somebody to ask, which forgets that they failed.
  desk.send({ type: 'findMore' });
  assert.ok(desk.state.list.every((item) => item.soughtAt == null));
});

test('a list kept by a version from before songs were confirmed: what is ready or found stays, and the rest become unseen and are confirmed in order', () => {
  const desk = new Desk({ ready: 0 }, 0, false);
  desk.ahead = true;
  const songs = Array.from({ length: 6 }, (_, n) => song(n));
  const stored: Item[] = songs.map((one) => ({ id: one.recordingMbid, song: one, addedAt: 1 }));
  stored[1] = { ...stored[1], jobId: `job-${stored[1].id}`, track: track(`job-${stored[1].id}`) };
  stored[3] = { ...stored[3], jobId: `job-${stored[3].id}`, ahead: 'found' };
  stored[4] = { ...stored[4], jobId: `job-${stored[4].id}`, failure: { code: 'ERR_YOUTUBE_NETWORK', at: 1, job: `job-${stored[4].id}` } };
  desk.state = initial({ ...EMPTY, list: stored, pool: songs, refreshedAt: desk.now, attemptAt: desk.now },
    { ...DEFAULT_SETTINGS, count: 6, ready: 0 });
  const effects = desk.open(WIFI, [job(stored[1].id, 'done'), heldJob(stored[3].id, 'found'), job(stored[4].id, 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK' })]);
  // The three the phone can vouch for are on the screen, in the order they were in. Nothing has been taken off the list.
  assert.deepEqual(seen(desk), [stored[1].id, stored[3].id, stored[4].id]);
  assert.equal(desk.ids().length, 6);
  assert.equal(desk.of('away').length, 0);
  // The other three are looked for, in their order, and join below as each is found.
  assert.deepEqual(desk.seeks(effects).map((ask) => ask.id), [stored[0].id, stored[2].id, stored[5].id]);
  findAll(desk, [job(stored[1].id, 'done'), heldJob(stored[3].id, 'found'), job(stored[4].id, 'failed', { errorCode: 'ERR_YOUTUBE_NETWORK' })]);
  assert.deepEqual(seen(desk), [stored[1].id, stored[3].id, stored[4].id, stored[0].id, stored[2].id, stored[5].id]);
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
  assert.equal(desk.seeks().length, 0);
});

/* A new list, and when it is worth showing. */

test('a refresh keeps the old list up until the new one has songs that are confirmed, and never swaps it for an empty screen', () => {
  const desk = seeking({ ready: 0 });
  desk.open();
  const jobs = findAll(desk);
  const old = seen(desk);
  assert.equal(old.length, 10);
  desk.send({ type: 'refresh' });
  desk.done = [];
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  const staged = () => desk.state.staged!.items.map((item) => item.id);
  const chosen = staged();
  // Chosen is not confirmed. Nothing is fetched ahead, and still the old list stays: there is nothing to show in its place.
  assert.deepEqual(seen(desk), old);
  assert.deepEqual(stagedProgress(desk.state), { ready: 0, target: 5 });
  assert.deepEqual(desk.seeks().map((ask) => ask.id), chosen.slice(0, 3));
  // Pressed again with nothing confirmed, it is not shown either; nor when the wait is up.
  desk.send({ type: 'refresh' });
  desk.later(STAGE_WAIT_MS + 1);
  assert.deepEqual(seen(desk), old);
  assert.ok(desk.state.staged);
  // Four confirmed is not five.
  answer(desk, ...chosen.slice(0, 3));
  let queue = [...jobs, ...chosen.slice(0, 3).map((key) => heldJob(key, 'found'))];
  desk.state = { ...desk.state, staged: { ...desk.state.staged!, since: desk.now } };
  desk.jobs(queue);
  answer(desk, chosen[3]);
  queue = [...queue, heldJob(chosen[3], 'found')];
  desk.jobs(queue);
  assert.deepEqual(stagedProgress(desk.state), { ready: 4, target: 5 });
  assert.deepEqual(seen(desk), old);
  // The fifth: the new list, as far as it is confirmed, and the rest of it filling in below.
  answer(desk, chosen[4]);
  desk.done = [];
  desk.jobs([...queue, heldJob(chosen[4], 'found')]);
  assert.equal(desk.state.staged, null);
  assert.deepEqual(seen(desk), chosen.slice(0, 5));
  assert.equal(desk.ids().length, 10);
  // The old songs are put away as never played; the old list's held jobs are stopped.
  assert.equal(desk.of('away').filter((e) => e.reason === 'unplayed').length, 10);
  assert.equal(desk.of('cancel').length, 10);
});

test('a new list that is slow to confirm is shown after the wait with what it has, and one pressed for again is shown at once', () => {
  const waited = seeking({ ready: 0 });
  waited.open();
  findAll(waited);
  waited.send({ type: 'refresh' });
  waited.send({ type: 'built', refresh: true, pool: waited.state.pool });
  const chosen = waited.state.staged!.items.map((item) => item.id);
  answer(waited, chosen[0]);
  waited.jobs([...waited.state.jobs, heldJob(chosen[0], 'found')]);
  assert.ok(waited.state.staged);
  waited.later(STAGE_WAIT_MS);
  assert.equal(waited.state.staged, null);
  assert.deepEqual(seen(waited), [chosen[0]]);

  const pressed = seeking({ ready: 0 });
  pressed.open();
  findAll(pressed);
  pressed.send({ type: 'refresh' });
  pressed.send({ type: 'built', refresh: true, pool: pressed.state.pool });
  const other = pressed.state.staged!.items.map((item) => item.id);
  answer(pressed, other[0]);
  pressed.jobs([...pressed.state.jobs, heldJob(other[0], 'found')]);
  pressed.send({ type: 'refresh' });
  assert.deepEqual(seen(pressed), [other[0]]);
});

test('with songs kept ready, the new list is worth showing when the first of its confirmed songs have their files', () => {
  const desk = seeking({ ready: 2 });
  desk.open();
  let jobs = findAll(desk);
  const old = seen(desk);
  desk.send({ type: 'refresh' });
  desk.done = [];
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool });
  const chosen = desk.state.staged!.items.map((item) => item.id);
  assert.deepEqual(stagedProgress(desk.state), { ready: 0, target: 2 });
  // Looked for first. Found, the first two are what is kept ready, and are fetched.
  answer(desk, ...chosen.slice(0, 3));
  jobs = [...jobs, ...chosen.slice(0, 3).map((key) => heldJob(key, 'found'))];
  desk.done = [];
  desk.jobs(jobs);
  assert.deepEqual(desk.asks().map((ask) => ask.id), chosen.slice(0, 2));
  assert.deepEqual(seen(desk), old);
  for (const key of chosen.slice(0, 2)) {
    desk.send({ type: 'asked', id: key, jobId: `job-${key}` });
    desk.send({ type: 'track', id: key, jobId: `job-${key}`, track: track(`job-${key}`) });
  }
  assert.equal(desk.state.staged, null);
  assert.deepEqual(seen(desk).slice(0, 3), chosen.slice(0, 3));
});

test('a new list of which nothing can be confirmed is given up, the old one stays, and why is said', () => {
  const desk = seeking({ ready: 0 }, 12);
  desk.open();
  findAll(desk);
  const old = seen(desk);
  desk.send({ type: 'refresh' });
  // Two songs are all the pool has beyond the list, and the list was two long when it was asked.
  desk.state = { ...desk.state, list: desk.state.list.slice(0, 2), settings: { ...desk.state.settings, count: 2 } };
  desk.send({ type: 'built', refresh: true, pool: desk.state.pool.filter((one) => !old.slice(2).includes(one.recordingMbid)) });
  const chosen = desk.state.staged!.items.map((item) => item.id);
  assert.equal(chosen.length, 2);
  answer(desk, ...chosen);
  desk.jobs([...desk.state.jobs, ...chosen.map((key) => heldJob(key, 'failed', { errorCode: 'ERR_DOWNLOAD_NO_MATCH', video: TO_FIND }))]);
  // Neither has a recording. There is no new list, and the old one is what is on the screen.
  assert.equal(desk.state.staged, null);
  assert.deepEqual(seen(desk), old.slice(0, 2));
  assert.equal(desk.problem(), 'exhausted');
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

test('finding no music holds nothing up, and the next look asks again at once', () => {
  // A new install: the first look is made as the app opens, before it may read the music, and finds none.
  const desk = new Desk({ ready: 0 }, 0, false);
  assert.equal(desk.of('build', desk.open()).length, 1);
  desk.send({ type: 'buildFailed', code: 'noLibrary' });
  assert.equal(desk.problem(), 'noLibrary');
  assert.equal(desk.state.fruitlessAt, 0);
  // A minute later the library has been read, and looking over the list is a new asking.
  desk.now += 60_000;
  assert.equal(desk.of('build', desk.open()).length, 1);

  // Whereas a library with nothing in it to go on is the same answer all day.
  desk.send({ type: 'buildFailed', code: 'noTaste' });
  desk.now += 60_000;
  assert.equal(desk.of('build', desk.open()).length, 0);
});

/* ------------------------------------------------------------------------ */
/* The player's similar songs.                                              */
/* ------------------------------------------------------------------------ */

/** A song of the pool that is not on the list, as a number. */
function unlisted(desk: Desk, skip = 0): number {
  const listed = new Set(desk.ids());
  return Array.from({ length: 60 }, (_, n) => n).filter((n) => !listed.has(id(n)))[skip]!;
}

test('a song the player asks for is fetched as Discover\'s own, though no songs are kept ready', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a] = first(desk, 1);
  desk.done = [];
  desk.send({ type: 'call', songs: [song(a)] });
  assert.deepEqual(desk.asks().map((ask) => [ask.id, ask.front, ask.wifiOnly]), [[id(a), false, true]]);
  assert.ok(desk.state.called.has(id(a)));
  assert.ok(wanted(desk.state, desk.now).length === 0, 'asked for, and so no longer waiting to be');
});

test('a song still in the pool is brought onto the end of the list for the player, and fetched', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const n = unlisted(desk);
  const before = desk.ids();
  desk.done = [];
  desk.send({ type: 'call', songs: [song(n)] });
  assert.deepEqual(desk.ids(), [...before, id(n)]);
  assert.equal(desk.item(n).called, true);
  assert.deepEqual(desk.asks().map((ask) => ask.id), [id(n)]);
});

test('the songs the player asks for wait for Wi-Fi where Discover\'s songs do', () => {
  const desk = new Desk({ ready: 0 });
  desk.open(MOBILE);
  desk.done = [];
  desk.send({ type: 'call', songs: [song(first(desk, 1)[0]!)] });
  assert.equal(desk.asks().length, 0);
  assert.equal(desk.state.held, 'wifi');
  assert.equal(desk.asks(desk.send({ type: 'network', network: WIFI })).length, 1);
});

test('songs put away, or by an artist nobody wants, are never brought on', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const n = unlisted(desk);
  const m = unlisted(desk, 1);
  desk.state = { ...desk.state, away: new Set([id(n)]), hidden: new Set([song(m).artistMbid]) };
  desk.send({ type: 'call', songs: [song(n), song(m)] });
  assert.ok(!desk.ids().includes(id(n)) && !desk.ids().includes(id(m)));
  assert.equal(desk.state.called.size, 0);
});

test('Discover does not go on with its list from a file the player put on', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b] = first(desk, 2);
  desk.ready(a, b);
  const fileA = `discover:job-${id(a)}`;
  desk.send({ type: 'lend', trackIds: [fileA] });
  desk.done = [];
  desk.send({ type: 'player', currentId: fileA, queue: ['7', fileA], playing: true });
  assert.equal(desk.of('append').length, 0);
  // Heard all the same, as any song of the list is.
  assert.ok(desk.item(a).heardAt);

  // Played from the list, the same file is Discover's own again, and the list goes on from it.
  desk.send({ type: 'play', id: id(a) });
  assert.ok(!desk.state.lent.has(fileA));
});

test('the songs brought on for the player give their places up once heard, when the list has run its room', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const extra = Array.from({ length: CALLED_ROOM }, (_, k) => unlisted(desk, k));
  desk.send({ type: 'call', songs: extra.map((n) => song(n)) });
  assert.equal(desk.state.list.length, desk.state.settings.count + CALLED_ROOM);
  // The first of them is fetched and heard, and the player moves on past it.
  const [heard] = extra;
  desk.ready(heard!);
  const file = `discover:job-${id(heard!)}`;
  desk.send({ type: 'player', currentId: file, queue: [file], playing: true });
  desk.send({ type: 'player', currentId: '9', queue: ['9'], playing: true });
  desk.done = [];
  const next = unlisted(desk, 0);
  desk.send({ type: 'call', songs: [song(next)] });
  assert.ok(!desk.ids().includes(id(heard!)));
  assert.ok(desk.ids().includes(id(next)));
  assert.deepEqual(desk.of('away').map((effect) => [effect.song.recordingMbid, effect.reason]), [[id(heard!), 'played']]);
});

test('a song still in the queue keeps its place however full the list is', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const extra = Array.from({ length: CALLED_ROOM }, (_, k) => unlisted(desk, k));
  desk.send({ type: 'call', songs: extra.map((n) => song(n)) });
  const [heard] = extra;
  desk.ready(heard!);
  const file = `discover:job-${id(heard!)}`;
  desk.send({ type: 'player', currentId: file, queue: [file, '9'], playing: true });
  desk.send({ type: 'call', songs: [song(unlisted(desk, 0))] });
  assert.ok(desk.ids().includes(id(heard!)));
  assert.equal(desk.state.list.length, desk.state.settings.count + CALLED_ROOM);
});

test('songs gathered for the player join the pool, without what is there or put away', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const had = desk.state.pool.length;
  const fresh = { ...song(100), recordingMbid: 'recording-new' };
  // The same song by another recording's id is the same song.
  const again = { ...song(1), recordingMbid: 'recording-other-take' };
  const away = { ...song(101), recordingMbid: 'recording-away' };
  desk.state = { ...desk.state, away: new Set([...desk.state.away, 'recording-away']) };
  desk.send({ type: 'grown', pool: [fresh, again, away] });
  assert.deepEqual(desk.state.pool.slice(had).map((one) => one.recordingMbid), ['recording-new']);
  // Not into a pool that is being made again: that one will be the whole of it.
  desk.state = { ...desk.state, building: { refresh: true, done: 0, total: null, label: '' } };
  const pool = desk.state.pool;
  desk.send({ type: 'grown', pool: [{ ...song(102), recordingMbid: 'recording-later' }] });
  assert.equal(desk.state.pool, pool);
});

test('a song that can no longer be had is not playable; one with its file always is', () => {
  const desk = new Desk({ ready: 0 });
  desk.open();
  const [a, b, c] = first(desk, 3);
  desk.ready(a);
  assert.ok(playable(desk.item(a)));
  // A failure that may pass leaves it playable; one that will not, not.
  for (const [n, code, can] of [[b, 'ERR_DOWNLOAD_FAILED', true], [c, 'ERR_YOUTUBE_UNAVAILABLE', false]] as const) {
    desk.send({ type: 'play', id: id(n) });
    desk.send({ type: 'asked', id: id(n), jobId: `job-${id(n)}` });
    desk.jobs([...desk.state.jobs.filter((other) => other.discoverKey !== id(n)), job(id(n), 'failed', { errorCode: code })]);
    assert.equal(desk.item(n).failure?.code, code);
    assert.equal(playable(desk.item(n)), can);
  }
});

test('a song brought on for the player that nobody saw and nothing was started for makes way first', () => {
  const desk = new Desk({ ready: 0 });
  desk.open(MOBILE);
  // Held for Wi-Fi, so nothing is fetched; and nothing is found ahead, so nothing is seen.
  desk.ahead = true;
  const extra = Array.from({ length: CALLED_ROOM }, (_, k) => unlisted(desk, k));
  desk.send({ type: 'call', songs: extra.map((n) => song(n)) });
  for (const effect of desk.seeks()) desk.send({ type: 'askFailed', id: effect.id, code: 'ERR_TEST', hold: true });
  assert.equal(desk.state.list.length, desk.state.settings.count + CALLED_ROOM);
  const next = unlisted(desk, 0);
  desk.done = [];
  desk.send({ type: 'call', songs: [song(next)] });
  assert.ok(desk.ids().includes(id(next)));
  assert.ok(!desk.ids().includes(id(extra[0]!)));
  // Never seen, so never offered: nothing is put away for it.
  assert.equal(desk.of('away').length, 0);
});
