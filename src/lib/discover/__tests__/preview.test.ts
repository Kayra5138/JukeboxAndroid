import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTracks, type DeezerTrack } from '../deezer.ts';
import { isPreviewAddress, pickPreview, previewQuery, shopTrackOf } from '../preview.ts';
import { shopSongId } from '../songs.ts';

const PREVIEW = 'https://cdnt-preview.dzcdn.net/api/1/1/6/a/2/0/6a2c0a56.mp3?hdnea=exp=1~hmac=2';
const track = (over: Partial<DeezerTrack> = {}): DeezerTrack => ({
  id: 3135556, title: 'Harder, Better, Faster, Stronger', short: 'Harder, Better, Faster, Stronger', version: '',
  durationSec: 226, rank: 1, artistId: 27, artistName: 'Daft Punk', album: 'Discovery', cover: null, preview: PREVIEW, ...over,
});
const song = { artist: 'Daft Punk', title: 'Harder, Better, Faster, Stronger', durationSec: 224 };

test('a song that came from Deezer is known there by the number in its id, and no other song is', () => {
  assert.equal(shopTrackOf(shopSongId(3135556)), 3135556);
  assert.equal(shopTrackOf(shopSongId(1)), 1);
  assert.equal(shopTrackOf('0f8fad5b-d9cb-469f-a165-70867728950e'), null);
  assert.equal(shopTrackOf('dee2e500-0000-4000-8000-00000000zzzz'), null);
  assert.equal(shopTrackOf('dee2e500-0000-4000-8000-000000000000'), null);
});

test('the preview that is taken is the same song: the title, the artist and the length', () => {
  assert.equal(pickPreview(song, [track()])?.id, 3135556);
  // The first that fits, in the order given, past the ones that do not.
  const medley = track({ id: 2, title: 'Around the World / Harder, Better, Faster, Stronger', short: 'Around the World / Harder, Better, Faster, Stronger', durationSec: 342 });
  const edit = track({ id: 3, title: 'Harder, Better, Faster, Stronger (Alive Radio Edit 2007)', version: '(Alive Radio Edit 2007)', durationSec: 204 });
  assert.equal(pickPreview(song, [medley, edit, track()])?.id, 3135556);
  // Another take of it, of another length, is not it; nor is somebody else's song of the same name.
  assert.equal(pickPreview(song, [medley, edit]), null);
  assert.equal(pickPreview(song, [track({ artistName: 'Pomplamoose' })]), null);
  assert.equal(pickPreview(song, [track({ durationSec: 231 })]), null);
  // One with nothing to hear is passed over.
  assert.equal(pickPreview(song, [track({ preview: null })]), null);
  assert.equal(pickPreview(song, []), null);
});

test('spelling, and a guest in the credit, do not stand in the way', () => {
  assert.equal(pickPreview({ artist: 'Sigur Rós', title: 'Hoppípolla', durationSec: 268 },
    [track({ title: 'Hoppipolla', short: 'Hoppipolla', artistName: 'Sigur Ros', durationSec: 270 })])?.id, 3135556);
  assert.equal(pickPreview({ artist: 'AURORA feat. Somebody', title: 'Runaway', durationSec: 249 },
    [track({ title: 'Runaway', short: 'Runaway', artistName: 'AURORA', durationSec: 249 })])?.id, 3135556);
  // The bracket Deezer keeps apart is the same recording when the length says so.
  assert.equal(pickPreview({ artist: 'Daft Punk', title: 'One More Time', durationSec: 320 },
    [track({ title: 'One More Time (Remastered)', short: 'One More Time', version: '(Remastered)', durationSec: 321 })])?.id, 3135556);
});

test('with no length to go by, a version of the song is not taken on trust', () => {
  const unknown = { artist: 'Daft Punk', title: 'One More Time', durationSec: null };
  assert.equal(pickPreview(unknown, [track({ title: 'One More Time (Live)', short: 'One More Time', version: '(Live)' })]), null);
  assert.equal(pickPreview(unknown, [track({ title: 'One More Time', short: 'One More Time' })])?.id, 3135556);
});

test('what is asked of the search is the first name of the credit and the title', () => {
  assert.equal(previewQuery({ artist: 'AURORA feat. Somebody', title: '  Runaway ' }), 'AURORA Runaway');
});

test('only an address previews are served from is one', () => {
  assert.ok(isPreviewAddress(PREVIEW));
  assert.ok(isPreviewAddress('https://cdns-preview-d.dzcdn.net/stream/c-deda-10.mp3'));
  for (const address of [null, '', 'http://cdnt-preview.dzcdn.net/a.mp3', 'https://cdn-images.dzcdn.net/a.jpg',
    'https://cdnt-preview.dzcdn.net.example.com/a.mp3', 'https://example.com/?https://cdnt-preview.dzcdn.net/a.mp3',
    'file:///data/a.mp3']) assert.equal(isPreviewAddress(address), false, String(address));
});

test('a track is read with its preview, and one that has none says so', () => {
  const rows = readTracks({ data: [
    { id: 1, title: 'A', duration: 200, artist: { id: 2, name: 'B' }, preview: PREVIEW },
    { id: 3, title: 'C', artist: { name: 'D' }, preview: '' },
    { id: 5, title: 'E' },
  ] });
  assert.deepEqual(rows.map((row) => row.preview), [PREVIEW, null, null]);
});
