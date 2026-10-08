import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { stringsFor } from '../../i18n/languages.ts';
import type { EnrichedTrack } from '../../media/enriched.ts';
import { track } from '../../__tests__/support.ts';
import {
  decline,
  detailsFor,
  forecast,
  fromNative,
  lineFor,
  summarise,
  tally,
  writable,
  type FileWrite,
  type Outcome,
} from '../plan.ts';

function shown(fields: Partial<EnrichedTrack> & { id: string }): EnrichedTrack {
  return {
    ...track(fields),
    genre: null,
    year: null,
    discNumber: null,
    tags: [],
    enriched: false,
    ...fields,
  };
}

const outcome = (id: string, result: FileWrite): Outcome => ({ id, title: `Song ${id}`, result });

describe('which files can be written to', () => {
  it('is MP3 and FLAC, whatever the case of the name', () => {
    assert.equal(writable({ filename: 'a.mp3' }), true);
    assert.equal(writable({ filename: 'B.FLAC' }), true);
    assert.equal(writable({ filename: 'live.at.the.mp3.hall.Mp3' }), true);
  });

  it('is nothing else, and nothing without a name', () => {
    for (const filename of ['a.m4a', 'a.ogg', 'a.opus', 'a.wav', 'a.mp3.part', 'mp3', null]) {
      assert.equal(writable({ filename }), false, String(filename));
    }
  });
});

describe('what is written for a track', () => {
  it('is what the app shows, with the first tag as the genre', () => {
    const details = detailsFor(
      shown({
        id: '1',
        title: 'Right Title',
        artist: 'Somebody',
        album: 'A Record',
        year: 1999,
        trackNumber: 4,
        discNumber: 2,
        genre: 'Rock',
        tags: ['shoegaze', 'dream pop'],
      }),
      'file:///data/user/0/app/files/album-artwork/abc.jpg'
    );
    assert.deepEqual(details, {
      title: 'Right Title',
      artist: 'Somebody',
      album: 'A Record',
      genre: 'shoegaze',
      year: 1999,
      track: 4,
      disc: 2,
      cover: 'file:///data/user/0/app/files/album-artwork/abc.jpg',
    });
  });

  it('leaves out every field the app has nothing for, rather than blanking it', () => {
    const details = detailsFor(shown({ id: '1', title: 'Only A Title' }), null);
    assert.deepEqual(details, { title: 'Only A Title' });
    assert.deepEqual(Object.keys(details), ['title']);
  });

  it('does not take the catalogue genre for a track with no tags', () => {
    assert.equal(detailsFor(shown({ id: '1', genre: 'Rock', tags: [] }), null).genre, undefined);
  });

  it('writes no cover that is only a web address, and none where there is none', () => {
    const song = shown({ id: '1' });
    assert.equal(detailsFor(song, 'https://example.org/cover.jpg').cover, undefined);
    assert.equal(detailsFor(song, null).cover, undefined);
  });

  it('treats blank text and numbers that count nothing as no value', () => {
    const details = detailsFor(
      shown({ id: '1', title: '  Spaced  ', artist: '   ', album: '', year: 0, trackNumber: -1, tags: ['  '] }),
      null
    );
    assert.deepEqual(details, { title: 'Spaced' });
  });
});

describe('what is known before asking', () => {
  it('declines a format it cannot write and the track that is playing', () => {
    assert.deepEqual(decline({ id: '1', filename: 'a.m4a' }, null), { status: 'skipped', why: 'format' });
    assert.deepEqual(decline({ id: '1', filename: 'a.mp3' }, '1'), { status: 'skipped', why: 'playing' });
    assert.equal(decline({ id: '1', filename: 'a.mp3' }, '2'), null);
  });

  it('counts how many files a run will change', () => {
    const chosen = [
      { id: '1', filename: 'a.mp3' },
      { id: '2', filename: 'b.flac' },
      { id: '3', filename: 'c.m4a' },
      { id: '4', filename: 'd.mp3' },
    ];
    assert.deepEqual(forecast(chosen, '4'), { willWrite: 2, wrongFormat: 1, playing: 1 });
    assert.deepEqual(forecast([], null), { willWrite: 0, wrongFormat: 0, playing: 0 });
  });
});

describe('what the phone answered', () => {
  it('is carried over status by status', () => {
    assert.deepEqual(
      fromNative({ status: 'written', reason: null, changed: ['title', 'cover'], kept: null }),
      { status: 'written', changed: ['title', 'cover'] }
    );
    assert.deepEqual(fromNative({ status: 'unchanged', reason: null, changed: [], kept: null }), {
      status: 'unchanged',
    });
    assert.deepEqual(
      fromNative({ status: 'unsupported', reason: 'It is neither an MP3 nor a FLAC.', changed: [], kept: null }),
      { status: 'skipped', why: 'format' }
    );
  });

  it('keeps the reason for a failure and where a copy was kept', () => {
    assert.deepEqual(
      fromNative({ status: 'failed', reason: 'No room. The file has not been touched.', changed: [], kept: '/sdcard/x.mp3' }),
      { status: 'failed', reason: 'No room. The file has not been touched.', kept: '/sdcard/x.mp3' }
    );
    const silent = fromNative({ status: 'failed', reason: null, changed: [], kept: null });
    assert.equal(silent.status, 'failed');
    assert.match(silent.status === 'failed' ? silent.reason : '', /not been touched/);
  });
});

describe('saying what happened', () => {
  it('names what was written into one file', () => {
    assert.equal(lineFor({ status: 'written', changed: ['title'] }), 'Written: title.');
    assert.equal(
      lineFor({ status: 'written', changed: ['title', 'track', 'cover'] }),
      'Written: title, track number and cover.'
    );
    assert.equal(lineFor({ status: 'written', changed: [] }), 'Written.');
  });

  it('says why a file was left alone', () => {
    assert.match(lineFor({ status: 'unchanged' }), /Already says/);
    assert.match(lineFor({ status: 'skipped', why: 'format' }), /only MP3 and FLAC/);
    assert.match(lineFor({ status: 'skipped', why: 'playing' }), /playing/);
    assert.equal(lineFor({ status: 'failed', reason: 'No room.', kept: null }), 'Failed: No room.');
  });

  it('sums up a run, mentioning only what happened', () => {
    const run = [
      outcome('1', { status: 'written', changed: ['title'] }),
      outcome('2', { status: 'written', changed: ['cover'] }),
      outcome('3', { status: 'unchanged' }),
      outcome('4', { status: 'skipped', why: 'format' }),
      outcome('5', { status: 'failed', reason: 'No room.', kept: null }),
    ];
    assert.deepEqual(tally(run), { written: 2, unchanged: 1, skipped: 1, failed: 1 });
    assert.equal(summarise(run), 'Wrote 2 files. 1 file already matched. Skipped 1 file. 1 file failed.');
    assert.equal(summarise(run.slice(0, 1)), 'Wrote 1 file.');
    assert.equal(summarise([]), 'Nothing to write.');
  });

  it('says all of it in Turkish when that is the language', () => {
    const tr = stringsFor('tr');
    assert.equal(
      lineFor({ status: 'written', changed: ['title', 'track', 'cover'] }, tr),
      'Yazıldı: başlık, parça numarası ve kapak.'
    );
    assert.equal(lineFor({ status: 'failed', reason: 'No room.', kept: null }, tr), 'Başarısız: No room.');
    const run = [
      outcome('1', { status: 'written', changed: ['title'] }),
      outcome('2', { status: 'written', changed: ['cover'] }),
      outcome('3', { status: 'unchanged' }),
      outcome('4', { status: 'skipped', why: 'format' }),
      outcome('5', { status: 'failed', reason: 'No room.', kept: null }),
    ];
    assert.equal(summarise(run, tr), '2 dosya yazıldı. 1 dosya zaten aynıydı. 1 dosya atlandı. 1 dosya yazılamadı.');
    assert.equal(summarise([], tr), 'Yazılacak bir şey yok.');
  });
});
