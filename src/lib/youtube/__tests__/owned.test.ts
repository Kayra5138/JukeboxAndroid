import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ownedVideos } from '../owned.ts';

const track = (id: string, filename: string, title = filename.replace(/\.[^.]+$/, ''), durationSec = 200) => ({
  id,
  filename,
  title,
  durationSec,
});

test('a file named by yt-dlp is known by the id in its name', () => {
  const owned = ownedVideos(
    [{ id: 'JBGllmkquuM', title: 'Justitia (Vocaloid) ENGLISH COVER', duration: 309 }],
    [track('t1', 'Justitia (Vocaloid) 🍓 ENGLISH COVER by Lizz Robinett [JBGllmkquuM].mp3', 'x', 1)]
  );
  assert.equal(owned.get('JBGllmkquuM'), 't1');
});

test('otherwise by its title and length together', () => {
  const tracks = [
    track('a', 'AURORA - Runaway.mp3', 'Runaway', 250),
    track('b', 'Indila - Dernière Danse (Clip Officiel) (1).mp3', 'x', 214),
  ];
  const owned = ownedVideos(
    [
      { id: 'v1', title: 'AURORA - Runaway', duration: 251 },
      { id: 'v2', title: 'AURORA - Runaway', duration: 290 },
      { id: 'v3', title: 'Indila - Derniere Danse (Clip Officiel)', duration: 215 },
      { id: 'v4', title: 'Something else', duration: 200 },
      { id: 'v5', title: 'AURORA - Runaway', duration: null },
    ],
    tracks
  );
  assert.equal(owned.get('v1'), 'a');
  // A live version, three-quarters of a minute longer, is another recording.
  assert.equal(owned.has('v2'), false);
  assert.equal(owned.get('v3'), 'b');
  assert.equal(owned.has('v4'), false);
  assert.equal(owned.has('v5'), false);
});

test('where two files fit, the song is here twice already, and the first stands for it', () => {
  const owned = ownedVideos(
    [{ id: 'v', title: 'Song', duration: 200 }],
    [track('a', 'Song.mp3'), track('b', 'Song (1).mp3')]
  );
  assert.equal(owned.get('v'), 'a');
});

test('a video is owned by the song its name says, however the name is written', () => {
  const tracks = [
    { id: 'shoko', filename: 'Shoko Nakagawa - Sono Chi no Sadame.mp3', title: 'Shoko Nakagawa - Sono Chi no Sadame', durationSec: 263.1 },
    { id: 'burn', filename: 'Burn.mp3', title: 'Burn', artist: 'Ellie Goulding', durationSec: 238.2 },
  ];
  const owned = ownedVideos(
    [
      { id: 'jojoAAAAAAA', title: 'Jojo bizarre adventure - sono chi no sadame', duration: 263 },
      { id: 'burnAAAAAAA', title: 'Ellie Goulding - Burn (Official Video)', duration: 238 },
      // The same name by another singer, a few seconds off: a cover, and not owned.
      { id: 'coverAAAAAA', title: 'baquu - Sono Chi no Sadame', duration: 266 },
    ],
    tracks
  );
  assert.equal(owned.get('jojoAAAAAAA'), 'shoko');
  assert.equal(owned.get('burnAAAAAAA'), 'burn');
  assert.equal(owned.has('coverAAAAAA'), false);
});
