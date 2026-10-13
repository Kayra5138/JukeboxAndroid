import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, FILE_MISSING, initial, reduce, type Event, type Song, type State } from '../core.ts';
import { DEFAULT_SETTINGS } from '../policy.ts';
import { failureText, viewCache, viewOf } from '../view.ts';
import { confirmed, problemOf } from '../fault.ts';
import { abortError, httpError, networkError } from '../../metadata/http.ts';
import { migrated } from '../before.ts';
import { stringsFor } from '../../i18n/languages.ts';
import type { DownloadJob } from '../../youtube/types.ts';

const en = stringsFor('en');
const tr = stringsFor('tr');

const song = (n: number): Song => ({
  recordingMbid: `recording-${n}`, title: `Song ${n}`, artist: `Artist ${n}`, artistMbid: `artist-${n}`, release: null,
  coverUrl: `https://coverartarchive.org/release/r/${n}-250.jpg`, because: 'Seed One · Seed Two', familiar: n % 2 === 0, score: 100 - n,
  tags: ['dream pop'], durationSec: 200,
});
const job = (key: string, more: Partial<DownloadJob>): DownloadJob => ({
  id: `job-${key}`, discoverKey: key, status: 'queued', progress: 0, trackId: null, error: null, described: false, format: 'original',
  folder: 'Music', video: { id: 'video', url: '', title: '', channel: '', thumbnail: null, duration: null }, ...more,
});

let now = 1_000_000_000_000;
function listed(): State {
  const pool = Array.from({ length: 30 }, (_, n) => song(n));
  const state = initial({ ...EMPTY, pool, attemptAt: now - 86_400_000, refreshedAt: now }, { ...DEFAULT_SETTINGS, count: 6, ready: 0 });
  return reduce(state, { type: 'jobs', jobs: [], paused: false }, now).state;
}
const after = (state: State, ...events: Event[]) => events.reduce((s, event) => reduce(s, event, now).state, state);

test('a song is shown with what it is, why it is here and the one state it is in', () => {
  const state = listed();
  const view = viewOf(state, viewCache(), en);
  assert.equal(view.entries.length, 6);
  const first = view.entries[0];
  assert.equal(first.id, state.list[0].id);
  assert.equal(first.state, 'idle');
  assert.equal(first.said, en.discover.state.idle);
  assert.deepEqual(first.why.seeds, ['Seed One', 'Seed Two']);
  assert.equal(first.why.kind, state.list[0].song.familiar ? 'familiar' : 'new');
  assert.ok(first.why.text.includes('Seed One'));
  assert.equal(first.isPlaying, false);
  assert.equal(view.status.vacancies, 0);
  assert.equal(view.status.updatedAt, now);
});

test('a song nothing happened to is the same object in the next view, and so is the list when no song changed', () => {
  const cache = viewCache();
  let state = listed();
  const a = state.list[0].id;
  const before = viewOf(state, cache, en);
  state = after(state, { type: 'play', id: a }, { type: 'asked', id: a, jobId: `job-${a}` },
    { type: 'jobs', jobs: [job(a, { status: 'downloading', progress: 40 })], paused: false });
  const during = viewOf(state, cache, en);
  assert.notEqual(during.entries[0], before.entries[0]);
  for (let at = 1; at < 6; at++) assert.equal(during.entries[at], before.entries[at]);
  assert.equal(during.entries[0].state, 'fetching');
  assert.equal(during.entries[0].stage, 'downloading');
  assert.equal(during.entries[0].progress, 40);
  assert.equal(during.entries[0].willPlay, true);
  assert.ok(during.entries[0].said.includes('40'));

  // Something about the list as a whole changes, and no song does: the same array of the same songs.
  state = after(state, { type: 'buildProgress', label: 'ignored, nothing is being built' }, { type: 'network', network: { connected: true, wifi: true } });
  assert.equal(viewOf(state, cache, en).entries, during.entries);
  // Read twice with nothing changed, it is the same view.
  assert.equal(viewOf(state, cache, en), viewOf(state, cache, en));
  // And a state that changed in nothing a screen shows is the same view too: nothing is drawn again for it.
  const shown = viewOf(state, cache, en);
  const noted = after(state, { type: 'cleaned', removed: [] }, { type: 'jobs', jobs: [job(a, { status: 'downloading', progress: 40 })], paused: false });
  assert.equal(viewOf({ ...noted }, cache, en), shown);
});

test('a failure is kept as a code and said in the language the view is read in', () => {
  let state = listed();
  const a = state.list[0].id;
  state = after(state, { type: 'play', id: a }, { type: 'asked', id: a, jobId: `job-${a}` },
    { type: 'jobs', jobs: [job(a, { status: 'failed', error: 'Could not reach YouTube.', errorText: 'x', errorCode: 'ERR_YOUTUBE_NETWORK' })], paused: false });
  const cache = viewCache();
  const english = viewOf(state, cache, en).entries[0];
  const turkish = viewOf(state, cache, tr).entries[0];
  assert.equal(english.state, 'failed');
  assert.equal(english.failure?.code, 'ERR_YOUTUBE_NETWORK');
  assert.equal(english.failure?.text, en.discover.failure.retry(en.search.errors.unreachable));
  assert.equal(turkish.failure?.text, tr.discover.failure.retry(tr.search.errors.unreachable));
  assert.notEqual(english.failure?.text, turkish.failure?.text);
  assert.equal(english.said, english.failure?.text);
});

test('every failure has words, and none of them is a raw message', () => {
  assert.equal(failureText({ code: FILE_MISSING }, en), en.discover.failure.retry(en.discover.failure.fileMissing));
  assert.equal(failureText({ code: 'ERR_DOWNLOAD_WAITING_WIFI' }, en), en.discover.state.waitingWifi);
  assert.equal(failureText({ code: 'ERR_DOWNLOAD_NO_MATCH' }, tr), tr.discover.state.noMatch);
  // The extractor's own line is read for what it is about and is not shown.
  const unsorted = failureText({ code: 'ERR_DOWNLOAD_FAILED', detail: 'ERROR: [youtube] abc: HTTP Error 403: Forbidden' }, en);
  assert.equal(unsorted, en.discover.failure.retry(en.search.errors.refused));
  assert.equal(failureText({ code: 'ERR_DOWNLOAD_FAILED', detail: 'java.lang.IllegalStateException: boom' }, en),
    en.discover.failure.retry(en.discover.failure.generic));
  assert.equal(failureText({ code: 'ERR_SOMETHING_NEW' }, en), en.discover.failure.retry(en.discover.failure.generic));
});

test('what is so of the list as a whole is one thing at a time, with its words', () => {
  let state = listed();
  state = after(state, { type: 'maintain', network: { connected: false, wifi: false }, away: new Set(), hidden: new Set() },
    { type: 'refresh' });
  let view = viewOf(state, viewCache(), en);
  assert.equal(view.status.problem?.code, 'offline');
  // There is a list, and the words say it is kept. With none they could not.
  assert.equal(view.status.problem?.text, en.discover.status.offline);
  const empty = after(initial(EMPTY, DEFAULT_SETTINGS), { type: 'network', network: { connected: false, wifi: false } }, { type: 'findMore' });
  assert.equal(viewOf(empty, viewCache(), en).status.problem?.text, en.discover.status.offlineEmpty);
  assert.equal(viewOf(empty, viewCache(), en).status.vacancies, DEFAULT_SETTINGS.count);

  state = after(state, { type: 'network', network: { connected: true, wifi: true } }, { type: 'refresh' },
    { type: 'buildProgress', label: '', done: 3, total: 12 });
  view = viewOf(state, viewCache(), en);
  assert.equal(view.status.problem, null);
  assert.equal(view.status.building?.text, en.discover.status.buildingArtists(3, 12));
  assert.equal(view.status.building?.refresh, true);
});

test('a new list in the making says how far it has got', () => {
  let state = listed();
  state = after(state, { type: 'settings', value: { ...state.settings, ready: 3 } },
    { type: 'maintain', network: { connected: true, wifi: true }, away: new Set(), hidden: new Set() });
  now += 120_000;
  state = after(state, { type: 'refresh' }, { type: 'built', refresh: true, pool: state.pool });
  const view = viewOf(state, viewCache(), en);
  assert.deepEqual([view.status.preparing?.ready, view.status.preparing?.target, view.status.preparing?.count], [0, 3, 6]);
  assert.equal(view.status.preparing?.text, en.discover.status.preparing(0, 3));
  // The list on show is still the old one.
  assert.deepEqual(view.entries.map((entry) => entry.id), state.list.map((item) => item.id));
});

test('the last thing done is said, and can be undone only while it is offered', () => {
  let state = listed();
  const gone = state.list[1];
  state = after(state, { type: 'exclude', id: gone.id });
  let notice = viewOf(state, viewCache(), en).notice;
  assert.equal(notice?.kind, 'excluded');
  assert.equal(notice?.canUndo, true);
  assert.equal(notice?.text, en.discover.notice.excluded(gone.song.title));
  state = after(state, { type: 'undo' });
  notice = viewOf(state, viewCache(), tr).notice;
  assert.equal(notice?.kind, 'restored');
  assert.equal(notice?.canUndo, false);
  assert.equal(notice?.text, tr.discover.notice.restored(gone.song.title));
});

test('a paused queue is said once, when a song is waiting on it', () => {
  let state = listed();
  const a = state.list[0].id;
  assert.equal(viewOf(after(state, { type: 'jobs', jobs: [], paused: true }), viewCache(), en).status.waiting, null);
  state = after(state, { type: 'play', id: a }, { type: 'asked', id: a, jobId: `job-${a}` }, { type: 'jobs', jobs: [job(a, {})], paused: true });
  assert.equal(viewOf(state, viewCache(), en).status.waiting?.reason, 'paused');
});

test('a list written by the version before is read as it is kept now, with what its errors meant and none of their words', () => {
  const before = {
    entries: [
      { ...song(1), jobId: 'a', track: { id: 'discover:a' } },
      { ...song(2), jobId: 'b', error: 'Wi-Fi bekleniyor.', errorCode: 'ERR_DOWNLOAD_WAITING_WIFI' },
      { ...song(3), jobId: 'c', error: 'No matching studio recording was found. Another song is taking its place.' },
      { ...song(4), error: 'Bir şeyler ters gitti.' },
      { ...song(5), jobId: 'e', error: 'İndirme başarısız oldu.', errorCode: 'ERR_YOUTUBE_NETWORK' },
    ],
    pool: [song(7), { ...song(8), error: 'old' }],
    pending: [song(6)],
    pendingRejected: ['x'],
    refreshedAt: 123,
    retired: ['old-job'],
  };
  const kept = migrated(before, 999);
  assert.deepEqual(kept.list.map((item) => item.id), [1, 2, 3, 4, 5].map((n) => `recording-${n}`));
  assert.equal(kept.list[0].track?.id, 'discover:a');
  assert.deepEqual(kept.list.map((item) => item.failure?.code), [undefined, 'ERR_DOWNLOAD_WAITING_WIFI', 'ERR_DOWNLOAD_NO_MATCH', undefined, 'ERR_YOUTUBE_NETWORK']);
  assert.equal(JSON.stringify(kept).includes('bekleniyor'), false);
  assert.equal(JSON.stringify(kept).includes('ters gitti'), false);
  assert.deepEqual(kept.staged, { items: [{ id: 'recording-6', song: song(6), addedAt: 999 }], since: 999 });
  assert.deepEqual(kept.pool, [song(7), song(8)]);
  assert.equal(kept.refreshedAt, 123);
  assert.deepEqual(kept.retired, ['old-job']);
  // Nothing readable is nothing kept, and not a crash.
  assert.deepEqual(migrated(null, 1).list, []);
  assert.deepEqual(migrated({ entries: 'no' }, 1).list, []);
});

test('each way the catalogue comes back with nothing is its own problem, known by what the build said and not by its words', () => {
  const said = (discover: string) => Object.assign(new Error('Bir şeyler oldu.'), { discover });
  assert.equal(problemOf(said('taste'), false), 'noTaste');
  assert.equal(problemOf(said('nothing'), false), 'nothing');
  assert.equal(problemOf(said('throttled'), false), 'slowDown');
  assert.equal(problemOf(said('unreachable'), false), 'unreachable');
  assert.equal(problemOf(said('offline'), false), 'offline');
  assert.equal(problemOf(abortError(), false), 'timedOut');
  assert.equal(problemOf(said('nothing'), true), 'timedOut');
  // Something from underneath that got out as it was.
  assert.equal(problemOf(networkError('MusicBrainz could not be reached'), false), 'offline');
  assert.equal(problemOf(networkError('MusicBrainz did not answer in time', true), false), 'unreachable');
  assert.equal(problemOf(httpError('ListenBrainz', 400), false), 'failed');
  // A sentence that happens to be one of the app's own is not read.
  assert.equal(problemOf(new Error(en.discover.engine.needsTaste), false), 'failed');

  // Offline is the phone's to say. With a connection it has checked, what went nowhere is the services' trouble.
  assert.equal(confirmed('offline', true), 'unreachable');
  assert.equal(confirmed('offline', false), 'offline');
  assert.equal(confirmed('offline', null), 'offline');
  assert.equal(confirmed('nothing', true), 'nothing');
});

test('each of those problems has words of its own', () => {
  const texts = new Map<string, string>();
  for (const code of ['offline', 'unreachable', 'slowDown', 'nothing', 'noTaste', 'noLibrary', 'exhausted', 'timedOut', 'failed'] as const) {
    const state = after(listed(), { type: 'refresh' }, { type: 'buildFailed', code });
    const problem = viewOf(state, viewCache(), en).status.problem;
    assert.equal(problem?.code, code);
    assert.ok(problem!.text.length > 10, code);
    texts.set(code, problem!.text);
  }
  assert.equal(new Set(texts.values()).size, texts.size);
  assert.equal(texts.get('slowDown'), en.discover.gathering.throttled);
  assert.equal(texts.get('nothing'), en.discover.gathering.nothing);
});

test('a song being previewed says so on its row and as what is playing, for as long as there is sound', () => {
  let state = listed();
  const a = state.list[0];
  state = after(state, { type: 'play', id: a.id });
  const cache = viewCache();
  // Looked for, and not yet heard: nothing says "preview" of a silence.
  let view = viewOf(state, cache, en);
  assert.equal(view.preview, null);
  assert.equal(view.entries[0].previewing, false);
  state = after(state, { type: 'previewed', id: a.id, state: 'playing' });
  view = viewOf(state, cache, en);
  assert.deepEqual(view.preview, { id: a.id, title: a.song.title, artist: a.song.artist, coverUrl: a.song.coverUrl });
  assert.equal(view.entries[0].previewing, true);
  assert.equal(view.entries[0].isPlaying, false);
  assert.ok(view.entries[0].said.startsWith(en.discover.state.preview('').trim()));
  assert.ok(viewOf(state, viewCache(), tr).entries[0].said.includes('Ön dinleme'));
  // The same object while it is the same preview, whatever the download says meanwhile.
  const shown = view.preview;
  state = after(state, { type: 'asked', id: a.id, jobId: `job-${a.id}` },
    { type: 'jobs', jobs: [job(a.id, { status: 'downloading', progress: 30 })], paused: false });
  assert.equal(viewOf(state, cache, en).preview, shown);
  assert.equal(viewOf(state, cache, en).entries[0].state, 'fetching');
  state = after(state, { type: 'previewed', id: a.id, state: 'ended' });
  view = viewOf(state, cache, en);
  assert.equal(view.preview, null);
  assert.equal(view.entries[0].previewing, false);
  assert.equal(view.entries[0].willPlay, true);
});
