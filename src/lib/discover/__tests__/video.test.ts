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

/* A song whose video is titled in another writing than the catalogue's, and what else the name alone turned away. */
const higuchi = { title: 'Itterasshai', artist: 'Ai Higuchi', durationSec: 235 };
test('a video as long as the recording to the second, from the artist, is the recording whatever it is called', () => {
  const theirs = video('ヒグチアイ / いってらっしゃい', 'Ai Higuchi - Topic', 236);
  assert.equal(chooseVideo(higuchi, [video('some other song', 'Somebody', 235), theirs]), theirs);
  // Not on length alone, for whoever did not say loose: the first here is somebody else's.
  assert.equal(chooseVideo(higuchi, [video('ぜんぜん別の曲', 'Somebody', 235)]), null);
  // And not a live take of it, however long it is.
  assert.equal(chooseVideo(higuchi, [video('Ai Higuchi live', 'Ai Higuchi', 235)]), null);
});
test('for a song known to exist, the likeliest video is taken where none can be shown to be it', () => {
  const loose = { ...higuchi, loose: true };
  const exact = video('ヒグチアイ / いってらっしゃい', 'ヒグチアイ', 235);
  const near = video('いってらっしゃい MV', 'ヒグチアイ', 250);
  // The one that fits to the second before one that only fits roughly, whichever came first.
  assert.equal(chooseVideo(loose, [near, exact]), exact);
  // Nothing to the second: the first that is not ruled out.
  assert.equal(chooseVideo(loose, [video('いってらっしゃい cover', 'x', 235), near]), near);
  // Ruled out is ruled out: a cover, a concert, and a video far too long or short for the song.
  assert.equal(chooseVideo(loose, [video('cover', 'x', 235), video('full concert', 'x', 3600), video('別の曲', 'x', 400)]), null);
  // With no length known, it has at least to name the artist.
  const unknown = { title: 'Itterasshai', artist: 'Ai Higuchi', loose: true };
  assert.equal(chooseVideo(unknown, [video('いってらっしゃい', 'ヒグチアイ', 235)]), null);
  const naming = video('Ai Higuchi いってらっしゃい', 'ヒグチアイ', 235);
  assert.equal(chooseVideo(unknown, [naming]), naming);
});
test('the name still comes first', () => {
  const named = video('Linkin Park - Faint (Official Audio)', 'Linkin Park', 164);
  assert.equal(chooseVideo({ ...song, durationSec: 162, loose: true }, [video('Something', 'Linkin Park', 162), named]), named);
});

test('a readable title that is another song is never taken, by length or as the likeliest', () => {
  const frozen = { title: 'Frozen', artist: 'bôa', durationSec: 228, loose: true };
  const twilight = video('bôa - Twilight (Official Audio)', 'bôa', 228);
  const duvet = video('bôa - Duvet', 'bôa - Topic', 230);
  // Same artist, the same length to the second: still another song.
  assert.equal(chooseVideo(frozen, [twilight]), null);
  assert.equal(chooseVideo({ ...frozen, loose: false }, [twilight]), null);
  // Nor the first of several by the artist that roughly fit.
  assert.equal(chooseVideo(frozen, [duvet, twilight]), null);
  // The song itself is still found by its name.
  const real = video('bôa - Frozen (Official Audio)', 'bôa', 229);
  assert.equal(chooseVideo(frozen, [twilight, real]), real);
});

test('the song is found by its own name when the catalogue adds a note in brackets', () => {
  const line = { title: 'The Line (from the series Arcane League of Legends)', artist: 'Twenty One Pilots', durationSec: 211, loose: true };
  const real = video('Twenty One Pilots - The Line (from Arcane Season 2) [Official Music Video]', 'Twenty One Pilots', 212);
  assert.equal(chooseVideo(line, [real]), real);
});
