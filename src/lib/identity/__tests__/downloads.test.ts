import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { downloadsToRejoin, type DownloadRecord } from '../downloads.ts';
import { describe as describeFile, type Scanned } from '../plan.ts';

const file = (id: string, filename: string, title: string, artist: string, durationSec = 200, size = 4_000_000): Scanned => ({
  id,
  filename,
  folder: 'Music/Jukebox/',
  title,
  artist,
  durationSec,
  size,
});

const job = (id: string, trackId: string | null, title: string, artist: string, extra: Partial<DownloadRecord> = {}): DownloadRecord => ({
  id,
  status: trackId ? 'done' : 'missing',
  trackId,
  video: { title, artist, duration: 200 },
  ...extra,
});

describe('downloads taken along to their files’ new numbers', () => {
  it('follows a history that has just moved', () => {
    const now = [file('20', 'Uso.mp3', 'Uso', 'SID')];
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'Uso', 'SID')], now, new Map(), new Map([['7', '20']])), [{ job: 'a', track: '20' }]);
  });

  it('finds a file by what was written down about it, to the byte', () => {
    const old = describeFile({ ...file('7', 'Uso.mp3', 'Uso', 'SID'), folder: 'Music/Kayra/' });
    const now = [file('20', 'Uso.mp3', 'Uso', 'SID'), file('21', 'Rain.mp3', 'Rain', 'SID')];
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'x', 'y')], now, new Map([['7', old]])), [{ job: 'a', track: '20' }]);
  });

  it('finds a file moved before downloads followed by what it was tagged as, where only one answers', () => {
    const now = [file('20', 'SID - Uso.mp3', 'Uso', 'SID'), file('21', 'Uso (live).mp3', 'Uso', 'SID', 260)];
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'Uso', 'SID'), job('b', null, 'uso', 'sid')], now, new Map()), [{ job: 'a', track: '20' }]);
  });

  it('leaves alone a download whose file is here, and gives nobody a file that has one', () => {
    const now = [file('20', 'Uso.mp3', 'Uso', 'SID')];
    assert.deepEqual(downloadsToRejoin([job('a', '20', 'Uso', 'SID'), job('b', '7', 'Uso', 'SID')], now, new Map()), []);
  });

  it('takes either of two copies of one song, the older', () => {
    const twice = [file('21', 'b.mp3', 'Uso', 'SID'), file('20', 'a.mp3', 'Uso', 'SID')];
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'Uso', 'SID')], twice, new Map()), [{ job: 'a', track: '20' }]);
  });

  it('reads a Japanese video title the way the file’s is read', () => {
    const now = [file('20', 'x.mp3', 'YOASOBI「勇者」 Official Music Video', '<unknown>', 204)];
    const asked = job('a', null, 'YOASOBI「勇者」 Official Music Video／TVアニメ『葬送のフリーレン』オープニングテーマ', 'YOASOBI', { video: { title: 'YOASOBI「勇者」 Official Music Video／TVアニメ『葬送のフリーレン』オープニングテーマ', channel: 'Ayase / YOASOBI', duration: 204 } });
    assert.deepEqual(downloadsToRejoin([asked], now, new Map()), [{ job: 'a', track: '20' }]);
  });

  it('guesses at nothing: two files as good and not copies, a Discover song, or a download that did not finish', () => {
    const two = [file('20', 'a.mp3', 'Uso', 'SID', 199), file('21', 'b.mp3', 'Uso', 'SID', 201)];
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'Uso', 'SID')], two, new Map()), []);
    const once = [file('20', 'a.mp3', 'Uso', 'SID')];
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'Uso', 'SID', { discoverKey: 'mbid' })], once, new Map()), []);
    assert.deepEqual(downloadsToRejoin([job('a', '7', 'Uso', 'SID', { status: 'failed' })], once, new Map()), []);
  });
});
