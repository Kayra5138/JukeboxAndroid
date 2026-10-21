import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chooseKeep,
  findCopies,
  nameOfFile,
  namesASong,
  pairKey,
  pairsOf,
  parseApart,
  type CopyCandidate,
  type Weighed,
} from '../copies.ts';

let next = 1;
/** A track as the media store gives an untagged file: titled by its name, with no artist. */
const file = (
  filename: string,
  durationSec: number,
  extra: Partial<CopyCandidate> & { folder?: string } = {}
): CopyCandidate => ({
  id: String(next++),
  title: filename.replace(/\.[^.]+$/, ''),
  artist: null,
  album: null,
  filename,
  durationSec,
  size: null,
  ...extra,
});

const ids = (groups: CopyCandidate[][]) => groups.map((group) => group.map((track) => track.filename));

test('a file name loses its extension, the video id and the number of a second save', () => {
  assert.equal(nameOfFile('Eminem - Berzerk (Official) (Explicit) [ab9176Srb5Y].mp3'), 'Eminem - Berzerk (Official) (Explicit)');
  assert.equal(nameOfFile('Eminem - Berzerk (Official) (Explicit) (1).mp3'), 'Eminem - Berzerk (Official) (Explicit)');
  assert.equal(nameOfFile('Eminem - Berzerk (Official) (Explicit) (12).m4a'), 'Eminem - Berzerk (Official) (Explicit)');
  // A year in brackets is part of the title, and so is a bracket that is not an id.
  assert.equal(nameOfFile('Song (2011 Remaster).mp3'), 'Song (2011 Remaster)');
  assert.equal(nameOfFile('Song [Live].mp3'), 'Song [Live]');
});

test('the copy from the computer and the one the app saved are one song', () => {
  const groups = findCopies([
    file('Eminem - Berzerk (Official) (Explicit) [ab9176Srb5Y].mp3', 238.4),
    file('Some Other Song.mp3', 238),
    file('Eminem - Berzerk (Official) (Explicit).mp3', 239.1),
  ]);
  assert.deepEqual(ids(groups), [
    ['Eminem - Berzerk (Official) (Explicit) [ab9176Srb5Y].mp3', 'Eminem - Berzerk (Official) (Explicit).mp3'],
  ]);
});

test('a second save with (1) is a copy, in another folder or the same', () => {
  const groups = findCopies([
    file('Indila - Dernière Danse (Clip Officiel).mp3', 214, { folder: 'Music/Kayra/' }),
    file('Indila - Dernière Danse (Clip Officiel) (1).mp3', 214.5, { folder: 'Download/' }),
  ]);
  assert.equal(groups.length, 1);
});

test('three copies are one group', () => {
  const groups = findCopies([
    file('AURORA - Runaway [d_HlPboLRL8].mp3', 250),
    file('AURORA - Runaway.mp3', 250.8),
    file('AURORA - Runaway (1).mp3', 251.2),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.length, 3);
});

test('the same name at a different length is a different recording', () => {
  // The extended mix in one folder and the radio edit in another, both named for the song.
  const groups = findCopies([
    file('Daft Punk - One More Time.mp3', 320),
    file('Daft Punk - One More Time (1).mp3', 230),
  ]);
  assert.deepEqual(groups, []);
});

test('a remix with the same base name and another length is not a copy', () => {
  const groups = findCopies([
    file('Tarkan - Şımarık.mp3', 233),
    file('Tarkan - Şımarık [abcdefghijk].mp3', 236),
  ]);
  assert.deepEqual(groups, []);
});

test('two seconds is the most two copies may differ by', () => {
  assert.equal(findCopies([file('Daft Punk - Digital Love.mp3', 300), file('Daft Punk - Digital Love (1).mp3', 302)]).length, 1);
  assert.equal(findCopies([file('Daft Punk - Digital Love.mp3', 300), file('Daft Punk - Digital Love (1).mp3', 302.5)]).length, 0);
});

test('a chain of near lengths does not stretch into one group', () => {
  // Each within two seconds of the next, the ends four apart: only the pair that is close stays.
  const groups = findCopies([
    file('Daft Punk - Veridis Quo.mp3', 200),
    file('Daft Punk - Veridis Quo (1).mp3', 201.9),
    file('Daft Punk - Veridis Quo (2).mp3', 203.8),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.length, 2);
  for (const track of groups[0]!) assert.ok(track.durationSec <= 201.9);
});

test('Turkish letters are folded, so a name typed without them still matches', () => {
  const groups = findCopies([
    file('Sezen Aksu - Gülümse.mp3', 245),
    file('Sezen Aksu - Gulumse [xyzxyzxyzxy].mp3', 245.6),
  ]);
  assert.equal(groups.length, 1);
});

test('a name that says nothing is not enough by itself', () => {
  assert.equal(namesASong('track 01'), false);
  assert.equal(namesASong('01 intro'), false);
  assert.equal(namesASong('audio track 3'), false);
  assert.equal(namesASong('eminem berzerk'), true);
  assert.equal(namesASong('千本桜 初音ミク'), true);
  // Two albums' first tracks, untagged and the same length, are two songs.
  assert.deepEqual(findCopies([file('01 - Intro.mp3', 90, { folder: 'A/' }), file('01 - Intro.mp3', 90)]), []);
});

test('the same plain name at exactly the same size is a copy after all', () => {
  const groups = findCopies([
    file('01 - Intro.mp3', 90, { size: 2_160_417 }),
    file('01 - Intro (1).mp3', 90.2, { size: 2_160_417 }),
  ]);
  assert.equal(groups.length, 1);
});

test('the same size alone, with nothing else alike, is not', () => {
  const groups = findCopies([
    file('Track 01.mp3', 180, { size: 7_200_000 }),
    file('Track 02.mp3', 180, { size: 7_200_000 }),
  ]);
  assert.deepEqual(groups, []);
});

test('the same artist and title in the tags make a copy under another file name', () => {
  const groups = findCopies([
    file('berzerk.mp3', 238, { title: 'Berzerk', artist: 'Eminem', album: 'The Marshall Mathers LP 2' }),
    file('Eminem - Berzerk.mp3', 239, { title: 'Berzerk', artist: 'Eminem', album: null }),
  ]);
  assert.equal(groups.length, 1);
});

test('the same title by the same artist on two records is two songs', () => {
  const groups = findCopies([
    file('a.mp3', 60, { title: 'Intro', artist: 'Eminem', album: 'Recovery' }),
    file('b.mp3', 61, { title: 'Intro', artist: 'Eminem', album: 'Kamikaze' }),
  ]);
  assert.deepEqual(groups, []);
});

test('artists that have nothing to do with each other keep two files of one name apart', () => {
  const groups = findCopies([
    file('Hallelujah Acoustic Version.mp3', 240, { artist: 'Jeff Buckley' }),
    file('Hallelujah Acoustic Version (1).mp3', 240, { artist: 'Pentatonix' }),
  ]);
  assert.deepEqual(groups, []);
  // A channel's name with the artist's in it is the same artist.
  const channel = findCopies([
    file('Eminem - Berzerk (Official).mp3', 240, { artist: 'Eminem' }),
    file('Eminem - Berzerk (Official) (1).mp3', 240, { artist: 'EminemVEVO' }),
  ]);
  assert.equal(channel.length, 1);
});

test('a track with no length is never a copy', () => {
  assert.deepEqual(findCopies([file('Eminem - Berzerk.mp3', 0), file('Eminem - Berzerk (1).mp3', 0)]), []);
});

test('a pair said to be different is not grouped again, but a new third copy is', () => {
  const a = file('Eminem - Lose Yourself.mp3', 326);
  const b = file('Eminem - Lose Yourself (1).mp3', 326);
  const apart = new Set(pairsOf([a.id, b.id]));
  assert.deepEqual(findCopies([a, b], apart), []);
  const c = file('Eminem - Lose Yourself [aaaaaaaaaaa].mp3', 326.5);
  const groups = findCopies([a, b, c], apart);
  assert.equal(groups.length, 1);
  assert.ok(groups[0]!.includes(c));
});

test('the pairs said to be different survive being written down and read back', () => {
  assert.equal(pairKey('12', '7'), pairKey('7', '12'));
  assert.deepEqual([...parseApart(JSON.stringify(pairsOf(['1', '2', '3'])))].sort(), ['1:2', '1:3', '2:3']);
  assert.deepEqual([...parseApart('not json')], []);
  assert.deepEqual([...parseApart(null)], []);
});

test('ten thousand tracks are looked through quickly', () => {
  const many: CopyCandidate[] = [];
  for (let i = 0; i < 10_000; i += 1) {
    many.push(file(`Artist ${i % 900} - Song number ${i}.mp3`, 120 + (i % 240), { artist: `Artist ${i % 900}`, title: `Song number ${i}`, size: 3_000_000 + i }));
  }
  many.push(file('Artist 1 - Song number 1 (1).mp3', 121, { artist: 'Artist 1', title: 'Song number 1' }));
  const started = performance.now();
  const groups = findCopies(many);
  assert.ok(performance.now() - started < 1500);
  assert.equal(groups.length, 1);
});

const weighed = (id: string, extra: Partial<Weighed> = {}): Weighed => ({
  id,
  listens: 0,
  described: false,
  cover: false,
  inLibrary: true,
  durationSec: 200,
  size: null,
  addedAt: null,
  ...extra,
});

test('the copy listened to most is kept', () => {
  assert.deepEqual(chooseKeep([weighed('1', { listens: 2 }), weighed('2', { listens: 9, described: true })]), {
    keep: '2',
    reason: 'listens',
  });
});

test('then the one with details or a cover', () => {
  assert.deepEqual(chooseKeep([weighed('1'), weighed('2', { cover: true })]), { keep: '2', reason: 'described' });
});

test('then the one in the library folder', () => {
  assert.deepEqual(chooseKeep([weighed('1', { inLibrary: false }), weighed('2')]), { keep: '2', reason: 'folder' });
});

test('then the larger file, but only by a clear margin', () => {
  assert.deepEqual(chooseKeep([weighed('1', { size: 4_000_000 }), weighed('2', { size: 8_000_000 })]), {
    keep: '2',
    reason: 'larger',
  });
  // A few kilobytes more is a tag, not a better sound: the older wins instead.
  assert.deepEqual(
    chooseKeep([weighed('1', { size: 8_000_000, addedAt: 200 }), weighed('2', { size: 8_010_000, addedAt: 100 })]),
    { keep: '2', reason: 'older' }
  );
});

test('with nothing to tell them apart the lower id is kept, the same every time', () => {
  assert.deepEqual(chooseKeep([weighed('20'), weighed('3'), weighed('100')]), { keep: '3', reason: 'alike' });
});
