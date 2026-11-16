import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { anySetAside, NOTHING_SET_ASIDE, setAsideIds, setAsideOf } from '../setAsideRule.ts';

const songs = [
  { id: '1', folder: 'Music/Games/Expedition 33/', tags: ['soundtrack'] },
  { id: '2', folder: 'Music/Games/Expedition 33/Disc 2/', tags: [] },
  { id: '3', folder: 'Music/Rock/', tags: ['Rock'] },
  { id: '4', folder: 'Music/Rock/', tags: [] },
  { id: '5', folder: 'Music/Records/', tags: [] },
];
const groups = {
  albums: () => [
    { key: 'expedition 33', tracks: [{ id: '1' }, { id: '2' }] },
    { key: 'rock album', tracks: [{ id: '3' }, { id: '4' }] },
  ],
  artists: () => [{ key: 'band', tracks: [{ id: '4' }, { id: '5' }] }],
};
const nothing = { albums: () => assert.fail('records asked for'), artists: () => assert.fail('artists asked for') };

describe('what is set aside', () => {
  it('is nothing, and asks nothing, where nothing is set aside', () => {
    assert.equal(anySetAside(NOTHING_SET_ASIDE), false);
    assert.deepEqual([...setAsideIds(songs, NOTHING_SET_ASIDE, nothing)], []);
  });

  it('is a song by itself, and asks for no records or artists for one', () => {
    const rules = setAsideOf([{ kind: 'track', key: '3' }]);
    assert.deepEqual([...setAsideIds(songs, rules, nothing)], ['3']);
  });

  it('is every song of a record set aside, and of an artist', () => {
    assert.deepEqual([...setAsideIds(songs, setAsideOf([{ kind: 'album', key: 'expedition 33' }]), groups)].sort(), ['1', '2']);
    assert.deepEqual([...setAsideIds(songs, setAsideOf([{ kind: 'artist', key: 'band' }]), groups)].sort(), ['4', '5']);
  });

  it('is everything under a folder, by whole steps of the path and whatever the case', () => {
    const rules = setAsideOf([{ kind: 'folder', key: 'music/games/expedition 33' }]);
    assert.deepEqual([...setAsideIds(songs, rules, groups)].sort(), ['1', '2']);
    assert.deepEqual([...setAsideIds(songs, setAsideOf([{ kind: 'folder', key: 'Music/Rec' }]), groups)], []);
  });

  it('is every song a list set aside holds', () => {
    const rules = setAsideOf([{ kind: 'list', key: '7' }]);
    const lists = { ...groups, list: (key: string) => (key === '7' ? ['3', '5'] : []) };
    assert.deepEqual([...setAsideIds(songs, rules, lists)].sort(), ['3', '5']);
  });

  it('is a song wearing a tag, whatever the case', () => {
    assert.deepEqual([...setAsideIds(songs, setAsideOf([{ kind: 'tag', key: 'rock' }]), groups)], ['3']);
  });

  it('is all of them at once, each song once', () => {
    const rules = setAsideOf([
      { kind: 'album', key: 'expedition 33' },
      { kind: 'tag', key: 'soundtrack' },
      { kind: 'track', key: '1' },
    ]);
    assert.deepEqual([...setAsideIds(songs, rules, groups)].sort(), ['1', '2']);
  });

  it('ignores a kind it does not know, as a newer version may have written', () => {
    assert.equal(anySetAside(setAsideOf([{ kind: 'playlist', key: '9' }])), false);
  });
});
