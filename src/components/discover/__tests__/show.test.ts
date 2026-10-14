import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NEEDS_BUILD } from '../../../lib/discover/core.ts';
import type { DiscoverEntryView, DiscoverStatus } from '../../../lib/discover/view.ts';
import { stringsFor } from '../../../lib/i18n/languages.ts';
import {
  durationLabel, emptyShows, isDiscoverTrack, listFoot, NOT_FOR_DISCOVER, noticeAbout, problemAction, rowLabel,
  rowShows, statusLine, watchRow, whyLines, type RowWatch,
} from '../show.ts';

const en = stringsFor('en');
const tr = stringsFor('tr');
const said = en.discover.row;

const song = (more: Partial<DiscoverEntryView> = {}): DiscoverEntryView => ({
  previewing: false,
  id: 'recording-1',
  title: 'Alison',
  artist: 'Slowdive',
  coverUrl: 'https://coverartarchive.org/release/r/1-250.jpg',
  durationSec: 232,
  why: { kind: 'new', seeds: ['Ride'], tags: ['shoegaze'], text: 'Like Ride · shoegaze' },
  state: 'idle',
  said: en.discover.state.idle,
  isPlaying: false,
  willPlay: false,
  keeping: false,
  canPlay: true,
  ...more,
});

const status = (more: Partial<DiscoverStatus> = {}): DiscoverStatus => ({
  building: null, preparing: null, problem: null, filling: null, waiting: null, updatedAt: 1, count: 20, vacancies: 0,
  // Every song that is chosen is on the screen, unless a test says otherwise.
  shown: 20 - (more.vacancies ?? 0), unconfirmed: 0, ...more,
});

test('a song that is only there to be tapped says whose it is and why, and how long', () => {
  const shows = rowShows(song(), en);
  assert.equal(shows.line, 'Slowdive · Like Ride · shoegaze');
  assert.equal(shows.tone, 'plain');
  assert.equal(shows.mark, 'none');
  assert.equal(shows.caption, '3:52');
  assert.equal(shows.chosen, false);
  assert.equal(shows.gone, false);
});

test('a length nobody knows is not written as nought', () => {
  assert.equal(durationLabel(null), '');
  assert.equal(durationLabel(0), '');
  assert.equal(durationLabel(59.6), '1:00');
  assert.equal(rowShows(song({ durationSec: null }), en).caption, '');
});

test('each state has its mark, and the reason stays while a mark can say it', () => {
  const marks = {
    waiting: rowShows(song({ state: 'waiting', waitingFor: 'download' }), en),
    finding: rowShows(song({ state: 'finding' }), en),
    preparing: rowShows(song({ state: 'fetching', stage: 'preparing' }), en),
    downloading: rowShows(song({ state: 'fetching', stage: 'downloading', progress: 41.6 }), en),
    saving: rowShows(song({ state: 'fetching', stage: 'saving' }), en),
    ready: rowShows(song({ state: 'ready', trackId: 'discover:job' }), en),
    playing: rowShows(song({ state: 'ready', trackId: 'discover:job', isPlaying: true }), en),
  };
  assert.equal(marks.waiting.mark, 'queued');
  assert.equal(marks.finding.mark, 'working');
  assert.equal(marks.preparing.mark, 'working');
  assert.equal(marks.downloading.mark, 'progress');
  assert.equal(marks.downloading.progress, 42);
  assert.equal(marks.downloading.caption, '42%');
  assert.equal(marks.saving.mark, 'working');
  assert.equal(marks.saving.caption, '3:52');
  assert.equal(marks.ready.mark, 'ready');
  assert.equal(marks.playing.mark, 'playing');
  for (const shows of Object.values(marks)) {
    assert.equal(shows.line, 'Slowdive · Like Ride · shoegaze');
    assert.equal(shows.tone, 'plain');
  }
});

test('a percentage out of range is brought into it', () => {
  assert.equal(rowShows(song({ state: 'fetching', stage: 'downloading', progress: 140 }), en).progress, 100);
  assert.equal(rowShows(song({ state: 'fetching', stage: 'downloading' }), en).progress, 0);
});

test('the song that was tapped is the one that will start, and says so in place of the reason', () => {
  const shows = rowShows(song({ state: 'fetching', stage: 'downloading', progress: 10, willPlay: true }), en);
  assert.equal(shows.chosen, true);
  assert.equal(shows.line, `Slowdive · ${said.willPlay}`);
  assert.equal(shows.tone, 'accent');
  // Once it is in, it is playing or about to be, and the mark says that.
  assert.equal(rowShows(song({ state: 'ready', willPlay: true }), en).chosen, false);
});

test('a keep that is under way is said, before and after the file is in', () => {
  const coming = rowShows(song({ state: 'fetching', stage: 'downloading', keeping: true, willPlay: true }), en);
  assert.equal(coming.keeping, true);
  assert.equal(coming.line, `Slowdive · ${said.willKeep}`);
  const saving = rowShows(song({ state: 'ready', keeping: true }), en);
  assert.equal(saving.line, `Slowdive · ${said.keeping}`);
  assert.equal(saving.tone, 'accent');
});

test('what went wrong takes the place of the reason, shortly, and is never written over', () => {
  const failed = rowShows(
    song({ state: 'failed', failure: { code: 'ERR_DOWNLOAD_FAILED', text: 'This download could not finish. Tap to retry.' }, keeping: true }),
    en
  );
  assert.equal(failed.mark, 'alert');
  assert.equal(failed.tone, 'danger');
  assert.equal(failed.line, said.failed);

  const build = rowShows(song({ state: 'failed', failure: { code: NEEDS_BUILD, text: en.discover.failure.needsBuild } }), en);
  assert.equal(build.line, said.needsBuild);

  const wifi = rowShows(song({ state: 'waitingWifi', failure: { code: 'ERR_DOWNLOAD_WAITING_WIFI', text: en.discover.state.waitingWifi } }), en);
  assert.equal(wifi.mark, 'queued');
  assert.equal(wifi.tone, 'muted');
  assert.equal(wifi.line, said.waitingWifi);

  // A row whose song turned out not to be fetchable after all is a failed row like any other, and stays to be tapped.
  const none = rowShows(song({ state: 'failed', failure: { code: 'ERR_DOWNLOAD_NO_MATCH', text: en.discover.failure.noRecording } }), en);
  assert.equal(none.mark, 'alert');
  assert.equal(none.gone, false);
  assert.equal(none.line, said.failed);
});

test('a row is said in the language it is read in', () => {
  assert.equal(rowShows(song({ state: 'failed', failure: { code: 'x', text: '' } }), tr).line, tr.discover.row.failed);
  assert.equal(rowShows(song({ state: 'fetching', stage: 'downloading', progress: 7 }), tr).caption, '%7');
});

test('a screen reader hears the song, the artist, the reason and the state as one label', () => {
  assert.equal(rowLabel(song(), en), 'Alison. Slowdive. Like Ride · shoegaze. Tap to download and play');
  const failure = { code: 'ERR_DOWNLOAD_FAILED', text: 'This download could not finish. Tap to retry.' };
  assert.equal(
    rowLabel(song({ state: 'failed', failure, said: failure.text }), en),
    'Alison. Slowdive. Like Ride · shoegaze. This download could not finish. Tap to retry'
  );
});

test('the label of a song being fetched does not change with each percent', () => {
  const at = (progress: number) =>
    rowLabel(song({ state: 'fetching', stage: 'downloading', progress, willPlay: true, said: en.discover.state.downloading(progress) }), en);
  assert.equal(at(10), at(60));
  assert.match(at(10), /Being downloaded\. Plays when ready$/);
});

test('only how a tap came out is said aloud', () => {
  const step = (before: RowWatch | null, entry: DiscoverEntryView) => watchRow(before, entry, en);
  // Fetched by itself, with nobody waiting: nothing.
  let seen = step(null, song({ state: 'fetching', stage: 'downloading', progress: 5 }));
  seen = step(seen.watch, song({ state: 'ready' }));
  assert.equal(seen.say, null);

  // Tapped: not a word while it comes, then that it is on.
  seen = step(null, song({ state: 'waiting', willPlay: true }));
  assert.equal(seen.say, null);
  seen = step(seen.watch, song({ state: 'fetching', stage: 'downloading', progress: 50, willPlay: true }));
  assert.equal(seen.say, null);
  // The song stops saying it was tapped a moment before the player has it.
  seen = step(seen.watch, song({ state: 'ready' }));
  assert.equal(seen.say, null);
  seen = step(seen.watch, song({ state: 'ready', isPlaying: true }));
  assert.equal(seen.say, said.nowPlaying('Alison'));
  // And once.
  seen = step(seen.watch, song({ state: 'ready', isPlaying: true }));
  assert.equal(seen.say, null);
});

test('a tap that failed is said with why, and one given up for another song is not said at all', () => {
  const failure = { code: 'ERR_DOWNLOAD_FAILED', text: 'This download could not finish. Tap to retry.' };
  let seen = watchRow(null, song({ state: 'fetching', stage: 'preparing', willPlay: true }), en);
  seen = watchRow(seen.watch, song({ state: 'failed', failure }), en);
  assert.equal(seen.say, `Alison. ${failure.text}`);
  assert.equal(seen.watch.tapped, false);

  seen = watchRow(null, song({ state: 'fetching', stage: 'preparing', willPlay: true }), en);
  // Another song was tapped: this one goes on being fetched and is nobody's.
  seen = watchRow(seen.watch, song({ state: 'fetching', stage: 'downloading', progress: 30 }), en);
  assert.equal(seen.watch.tapped, false);
  seen = watchRow(seen.watch, song({ state: 'ready' }), en);
  seen = watchRow(seen.watch, song({ state: 'ready', isPlaying: true }), en);
  assert.equal(seen.say, null);
});

test('the sheet says why at length, and no more than is known', () => {
  assert.deepEqual(whyLines(song({ why: { kind: 'new', seeds: [], text: 'Picked for you' } }), en), ['Picked for you']);
  const lines = whyLines(
    song({
      why: {
        kind: 'new', seeds: ['Ride', 'Lush', 'Pale Saints'], tags: ['shoegaze', 'dream pop'], text: 'Because you play Ride and Lush',
        detail: { kind: 'near', seeds: ['Ride', 'Lush', 'Pale Saints'], searched: [], tags: ['shoegaze', 'dream pop'], similarity: 0.7, fresh: true },
      },
    }),
    en
  );
  assert.deepEqual(lines, [
    'Because you play Ride and Lush',
    en.discover.menu.seeds('Ride, Lush, Pale Saints'),
    en.discover.why.veryNear,
    en.discover.menu.tags('shoegaze, dream pop'),
    en.discover.menu.freshArtist,
  ]);
});

test('the line over the list says one thing: what is wrong, then what is being done, then what is waited for', () => {
  const building = { refresh: false, done: 3, total: 12, label: '', text: 'Looking' };
  const preparing = { ready: 2, target: 5, count: 20, since: 0, text: 'On its way' };
  const waiting = { reason: 'wifi' as const, text: 'Wi-Fi' };
  const problem = { code: 'offline' as const, text: 'No connection' };

  assert.deepEqual(statusLine(status()), { kind: 'none' });
  assert.deepEqual(statusLine(status({ waiting })), { kind: 'waiting', text: 'Wi-Fi' });
  assert.deepEqual(statusLine(status({ waiting, preparing })), { kind: 'preparing', text: 'On its way', fraction: 0.4 });
  assert.deepEqual(statusLine(status({ waiting, preparing, building })), { kind: 'building', text: 'Looking', fraction: 0.25 });
  assert.equal(statusLine(status({ waiting, preparing, building, problem })).kind, 'problem');
  // How many artists there are is not known at first, and a bar is not drawn of a guess.
  assert.equal((statusLine(status({ building: { ...building, total: null } })) as { fraction: unknown }).fraction, null);
});

test('with no list the problem is said where the list would be, and not twice', () => {
  const problem = { code: 'offline' as const, text: 'No connection' };
  const none = status({ problem, vacancies: 20 });
  assert.deepEqual(statusLine(none), { kind: 'none' });
  assert.deepEqual(emptyShows(none), { kind: 'problem', text: 'No connection', action: 'refresh' });
});

test('a problem offers the way out of it, and none where pressing would be told the same', () => {
  const of = (code: string, vacancies: number) => {
    const problem = { code, text: '' } as NonNullable<DiscoverStatus['problem']>;
    return problemAction(problem, status({ problem, vacancies }));
  };
  assert.equal(of('offline', 20), 'refresh');
  assert.equal(of('unreachable', 6), 'findMore');
  assert.equal(of('timedOut', 0), 'refresh');
  for (const code of ['noLibrary', 'noTaste', 'exhausted', 'throttled']) assert.equal(of(code, 20), null);
});

test('where the list would be: rows to come while it is made, and otherwise how to come by one', () => {
  const building = { refresh: false, done: 0, total: null, label: '', text: 'Looking' };
  assert.deepEqual(emptyShows(status({ building, vacancies: 20 })), { kind: 'skeleton' });
  assert.deepEqual(emptyShows(status({ vacancies: 20 })), { kind: 'none' });
  const problem = { code: 'noTaste' as const, text: en.discover.status.noTaste };
  assert.deepEqual(emptyShows(status({ problem, vacancies: 20 })), { kind: 'problem', text: problem.text, action: null });
});

test('a short list has one line under it, and a whole one nothing', () => {
  const building = { refresh: false, done: 0, total: null, label: '', text: 'Looking' };
  assert.equal(listFoot(status(), 20), 'none');
  assert.equal(listFoot(status({ vacancies: 4 }), 16), 'findMore');
  assert.equal(listFoot(status({ vacancies: 4, building }), 16), 'finding');
  // An empty list says all of this where the list would be.
  assert.equal(listFoot(status({ vacancies: 20, building }), 0), 'none');
});

test('a track of Discover\'s is known by its id, and is offered nothing that goes by the library', () => {
  assert.equal(isDiscoverTrack('discover:job-1'), true);
  assert.equal(isDiscoverTrack('1234'), false);
  assert.equal(isDiscoverTrack(null), false);
  assert.deepEqual([...NOT_FOR_DISCOVER].sort(), ['addToPlaylist', 'album', 'delete', 'details', 'tiles']);
});

test('a notice is about the playing song only when it names it', () => {
  const notice = { kind: 'kept' as const, text: 'Saved', id: 'recording-1', canUndo: false, until: 0 };
  assert.equal(noticeAbout(notice, 'recording-1'), notice);
  assert.equal(noticeAbout(notice, 'recording-2'), null);
  assert.equal(noticeAbout({ ...notice, id: undefined }, 'recording-1'), null);
  assert.equal(noticeAbout(null, 'recording-1'), null);
});

test('a row whose preview is being heard says so in place of everything else, and keeps the mark of its download', () => {
  const row = rowShows(song({ state: 'fetching', stage: 'downloading', progress: 42, willPlay: true, previewing: true }), en);
  assert.equal(row.preview, true);
  assert.equal(row.line, said.preview);
  assert.equal(row.tone, 'accent');
  assert.equal(row.mark, 'progress');
  assert.equal(row.progress, 42);
  assert.ok(rowLabel(song({ state: 'fetching', willPlay: true, previewing: true }), tr).includes(tr.discover.row.preview));
  // A keep that was pressed is still what the row says: it is the answer to something asked.
  assert.notEqual(rowShows(song({ state: 'fetching', willPlay: true, previewing: true, keeping: true }), en).line, said.preview);
});

test('a list that is filling in says so on the line a build has, and where the list would be it is rows to come', () => {
  const filling = { known: 7, total: 20, text: en.discover.status.filling(7, 20) };
  assert.deepEqual(statusLine(status({ filling, shown: 7, unconfirmed: 13 })), { kind: 'building', text: 'Finding songs · 7 of 20', fraction: 0.35 });
  assert.equal(tr.discover.status.filling(7, 20), 'Şarkılar bulunuyor · 7/20');
  // None confirmed yet, straight after a build: not "there is no list", and not a problem, whatever else is so.
  const none = status({ filling: { known: 0, total: 20, text: '' }, shown: 0, unconfirmed: 20 });
  assert.deepEqual(emptyShows(none), { kind: 'skeleton' });
  assert.deepEqual(emptyShows({ ...none, problem: { code: 'exhausted', text: 'x' } }), { kind: 'skeleton' });
  // What is being done comes after what is wrong, as ever, once there are rows for it to stand over.
  assert.equal(statusLine(status({ filling, shown: 7, unconfirmed: 13, problem: { code: 'offline', text: 'x' } })).kind, 'problem');
  // A list short of songs to look for says more are coming while they are, under the rows.
  assert.equal(listFoot(status({ vacancies: 4, filling, shown: 7, unconfirmed: 9 }), 7), 'finding');
});

test('songs that are chosen and cannot be confirmed now say why where the list would be, and offer a press only where one helps', () => {
  const waits = (reason: 'connection' | 'paused' | 'later', text: string) =>
    emptyShows(status({ shown: 0, unconfirmed: 20, waiting: { reason, text } }));
  assert.deepEqual(waits('connection', 'offline'), { kind: 'problem', text: 'offline', action: null });
  assert.deepEqual(waits('paused', 'paused'), { kind: 'problem', text: 'paused', action: null });
  assert.deepEqual(waits('later', 'later'), { kind: 'problem', text: 'later', action: 'findMore' });
  // With rows on the screen the same reason is the line over them.
  assert.deepEqual(statusLine(status({ shown: 5, unconfirmed: 15, waiting: { reason: 'connection', text: 'offline' } })), { kind: 'waiting', text: 'offline' });
});
