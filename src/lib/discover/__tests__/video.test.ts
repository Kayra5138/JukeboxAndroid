import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseVideo } from '../video.ts';
import type { YouTubeVideo } from '../../youtube/types.ts';
const song = { title: 'Faint', artist: 'Linkin Park' };
const video = (title: string, channel = 'Linkin Park', duration = 162): YouTubeVideo => ({ id: 'abcdefghijk', url: '', title, channel, duration, thumbnail: null });
test('accepts matching official studio audio', () => {
  const good = video('Linkin Park - Faint (Official Audio)');
  assert.equal(chooseVideo(song,[video('Linkin Park - Numb'),good]),good);
});
test('rejects a different song, live takes and unrelated recordings', () => {
  assert.equal(chooseVideo(song,[video('Faint live'),video('Linkin Park Numb'),video('Faint', 'Someone Else')]),null);
});
test('rejects covers, reaction videos, full concerts and playlists', () => {
  assert.equal(chooseVideo(song,[video('Linkin Park Faint cover'),video('Linkin Park Faint reaction'),video('Linkin Park Faint', 'Linkin Park',3600)]),null);
});
test('rejects a similarly titled audio file whose duration is wrong', () => {
  assert.equal(chooseVideo({ ...song, durationSec: 162 },[video('Linkin Park Faint','Linkin Park',300)]),null);
});
