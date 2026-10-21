import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foundAnother, isSuspect, libraryMistakes, nameOfVideo, namesAnother, namesSong, rightKey, wrongFinds } from '../verify.ts';
import type { DownloadJob, YouTubeVideo } from '../../youtube/types.ts';

const video = (title: string, channel: string, extra: Partial<YouTubeVideo> = {}): YouTubeVideo => ({
  id: 'abcdefghijk', url: '', title, channel, thumbnail: null, duration: 200, ...extra,
});
const job = (v: YouTubeVideo, extra: Partial<DownloadJob> = {}): DownloadJob => ({
  id: 'job1', video: v, format: 'mp3', folder: 'Music', status: 'done', progress: 100, trackId: '42',
  error: null, described: true, finishedAt: 1, ...extra,
});
const place = (title: string, artist = 'Linkin Park') => ({ album: 'Meteora', title, artist, track: 3, disc: null, year: 2003, genre: null });

test('bôa\'s Twilight filed as Frozen is suspect', () => {
  const twilight = video('bôa - Twilight', 'bôa', { discoveryTitle: 'Frozen', discoveryArtist: 'bôa' });
  assert.equal(isSuspect(job(twilight)), true);
  assert.equal(namesAnother({ title: 'Frozen', artist: 'bôa' }, 'bôa - Twilight'), true);
});

test('the song with what is said about the upload, guests or a remaster note still names it', () => {
  assert.equal(namesSong('Frozen', 'bôa - Frozen (Official Audio)'), true);
  assert.equal(namesSong('Numb (feat. Jay-Z)', 'Linkin Park - Numb [Official Music Video]'), true);
  assert.equal(namesSong('Numb (Remastered 2011)', 'Numb'), true);
  assert.equal(namesSong('Señorita', 'Shawn Mendes, Camila Cabello - Senorita (Lyrics)'), true);
  assert.equal(isSuspect(job(video('bôa - Frozen (Official Audio)', 'bôa', { discoveryTitle: 'Frozen', discoveryArtist: 'bôa' }))), false);
});

test('a title in another writing says nothing, and is not doubted', () => {
  const japanese = video('ヒグチアイ / いってらっしゃい', 'Ai Higuchi - Topic', { discoveryTitle: 'Itterasshai', discoveryArtist: 'Ai Higuchi' });
  assert.equal(isSuspect(job(japanese)), false);
});

test('a track fetched to complete a record is read by its place', () => {
  const right = video('Linkin Park - Faint (Official Audio)', 'Linkin Park', { placement: place('Faint') });
  const wrong = video('Linkin Park - Numb (Official Audio)', 'Linkin Park', { placement: place('Faint') });
  assert.equal(isSuspect(job(right)), false);
  assert.equal(isSuspect(job(wrong)), true);
});

test('a download tagged with its own video\'s name, or not finished, is never doubted', () => {
  assert.equal(isSuspect(job(video('bôa - Twilight', 'bôa'))), false);
  assert.equal(isSuspect(job(video('bôa - Twilight', 'bôa', { discoveryTitle: 'Frozen' }), { status: 'failed' })), false);
});

test('Discover\'s own wrong finds: finished, held or failed, never one still to be looked for or not its own', () => {
  const twilight = video('bôa - Twilight', 'bôa', { discoveryTitle: 'Frozen', discoveryArtist: 'bôa' });
  const done = job(twilight, { id: 'd', discoverKey: 'mbid', trackId: 'discover:d' });
  const held = job(twilight, { id: 'h', discoverKey: 'mbid2', status: 'found', trackId: null });
  const looking = job({ ...twilight, id: '', title: 'Frozen', find: { query: 'bôa Frozen', artist: 'bôa', title: 'Frozen', durationSec: null } }, { id: 'l', discoverKey: 'mbid3', status: 'found' });
  const mine = job(twilight, { id: 'm' });
  const failed = job(twilight, { id: 'f', discoverKey: 'mbid4', status: 'failed', trackId: null });
  const fetching = job(twilight, { id: 'g', discoverKey: 'mbid5', status: 'downloading', trackId: null });
  assert.deepEqual(wrongFinds([done, held, looking, mine, failed, fetching]).map((entry) => entry.id), ['d', 'h', 'f']);
});

test('a file is doubted before it is kept whatever its job is doing, and only once its video is found', () => {
  const twilight = video('bôa - Twilight', 'bôa', { discoveryTitle: 'Frozen', discoveryArtist: 'bôa' });
  const frozen = video('bôa - Frozen (Official Audio)', 'bôa', { discoveryTitle: 'Frozen', discoveryArtist: 'bôa' });
  assert.equal(foundAnother(job(twilight, { status: 'downloading' })), true);
  assert.equal(foundAnother(job(twilight)), true);
  assert.equal(foundAnother(job(frozen)), false);
  // Still to be looked for: what it shows is the song's own name, which says nothing.
  const looking = { ...twilight, id: '', find: { query: 'bôa Frozen', artist: 'bôa', title: 'Frozen', durationSec: null } };
  assert.equal(foundAnother(job(looking, { status: 'queued' })), false);
});

test('the library\'s files: by the name shown now, the newest job for a file, and not once said right', () => {
  const twilight = video('bôa - Twilight', 'bôa', { discoveryTitle: 'Frozen', discoveryArtist: 'bôa' });
  const tracks = [
    { id: '42', title: 'Frozen', artist: 'bôa', durationSec: 200 },
    { id: '43', title: 'Twilight', artist: 'bôa', durationSec: 200 },
  ];
  const jobs = [
    job(twilight, { id: 'a', trackId: '42' }),
    // Renamed by hand to what it is: right now.
    job(twilight, { id: 'b', trackId: '43' }),
    // Discover's own private copy is not the library's.
    job(twilight, { id: 'c', trackId: 'discover:c', discoverKey: 'k' }),
    // A file no longer here.
    job(twilight, { id: 'd', trackId: '99' }),
  ];
  assert.deepEqual(libraryMistakes(jobs, tracks, new Set()).map((entry) => entry.track.id), ['42']);
  assert.deepEqual(libraryMistakes(jobs, tracks, new Set([rightKey('42', 'abcdefghijk')])), []);
  // Fetched again since, from a video that is its own name: the newest job is the one that made the file.
  const again = job(video('bôa - Frozen', 'bôa'), { id: 'e', trackId: '42', finishedAt: 5 });
  assert.deepEqual(libraryMistakes([...jobs, again], tracks, new Set()), []);
});

test('the name a file would have from its video', () => {
  assert.deepEqual(nameOfVideo({ title: 'bôa - Twilight (Official Audio)', channel: 'bôa' }, 'bôa'), { title: 'Twilight', artist: 'bôa' });
  assert.deepEqual(nameOfVideo({ title: 'Twilight', channel: 'bôa - Topic' }, null), { title: 'Twilight', artist: 'bôa' });
  assert.deepEqual(nameOfVideo({ title: 'Numb ft. Jay-Z [Lyrics]', channel: '' }, 'Linkin Park'), { title: 'Numb', artist: 'Linkin Park' });
});

test('a catalogue name with a note in brackets is named by a video with another note', () => {
  assert.equal(
    namesSong('The Line (from the series Arcane League of Legends)', 'Twenty One Pilots - The Line (from Arcane Season 2) [Official Music Video]'),
    true
  );
});
