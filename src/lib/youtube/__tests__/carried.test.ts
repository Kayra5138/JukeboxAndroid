import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { carried, unlisted } from '../carried.ts';

describe('a video on its way to the phone', () => {
  it('keeps its own nulls, which have always crossed, and loses the ones inside what it holds', () => {
    const video = {
      id: '',
      thumbnail: null,
      duration: null,
      find: { query: 'a b official audio', artist: 'a', title: 'b', durationSec: null },
      placement: { album: 'c', title: 'b', artist: null, track: 3, disc: null, year: 2024, genre: null },
      sourcePlaylist: { id: 'p', name: 'q' },
    };
    assert.deepEqual(carried(video), {
      id: '',
      thumbnail: null,
      duration: null,
      find: { query: 'a b official audio', artist: 'a', title: 'b' },
      placement: { album: 'c', title: 'b', track: 3, year: 2024 },
      sourcePlaylist: { id: 'p', name: 'q' },
    });
  });

  it('leaves a video with nothing in it to lose as it was, and the one handed in untouched', () => {
    const video = { id: 'x', title: 't', thumbnail: null, find: { durationSec: null } };
    assert.deepEqual(carried({ id: 'x', title: 't', thumbnail: null }), { id: 'x', title: 't', thumbnail: null });
    carried(video);
    assert.deepEqual(video.find, { durationSec: null });
  });
});

describe('a video that is not being added to a list', () => {
  it('no longer says which playlist it was read off, and is otherwise as it was', () => {
    const video = { id: 'x', title: 't', thumbnail: null, sourcePlaylist: { id: 'p', name: 'q' } };
    assert.deepEqual(unlisted(video), { id: 'x', title: 't', thumbnail: null });
    assert.deepEqual(video.sourcePlaylist, { id: 'p', name: 'q' });
  });
});
