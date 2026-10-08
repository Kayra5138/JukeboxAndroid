import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EnrichedTrack } from '../enriched.ts';
import { asFolderSort, folderKey, foldersOf, nextFolderSort, sortFolders } from '../folders.ts';
import { track } from '../../__tests__/support.ts';

const file = (id: string, folder: string | null, filename: string | null = null): EnrichedTrack => ({
  ...track({ id, title: `Track ${id}`, folder, filename }),
  genre: null,
  year: null,
  discNumber: null,
  tags: [],
  enriched: false,
});

const paths = (folders: { path: string }[]) => folders.map((folder) => folder.path);
const ids = (tracks: EnrichedTrack[]) => tracks.map((entry) => entry.id);

describe('folderKey', () => {
  it('is the same place whichever end the slashes were left on', () => {
    assert.equal(folderKey('Music/Nirvana/'), 'Music/Nirvana');
    assert.equal(folderKey('/Music/Nirvana'), 'Music/Nirvana');
    assert.equal(folderKey('Music'), 'Music');
  });
});

describe('foldersOf', () => {
  it('collects the tracks that sit in the same folder', () => {
    const folders = foldersOf(
      [
        file('1', 'Music/Nirvana/Nevermind/'),
        file('2', 'Music/Nirvana/Nevermind/'),
        file('3', 'Music/Tarkan/'),
      ],
      'Music'
    );

    assert.deepEqual(paths(folders), ['Nirvana/Nevermind', 'Tarkan']);
    assert.deepEqual(folders.map((folder) => folder.tracks.length), [2, 1]);
  });

  it('counts a folder\'s own files and not those of the folders inside it', () => {
    const folders = foldersOf(
      [
        file('1', 'Music/Nirvana/'),
        file('2', 'Music/Nirvana/Nevermind/'),
        file('3', 'Music/Nirvana/Nevermind/'),
      ],
      'Music'
    );

    assert.deepEqual(paths(folders), ['Nirvana', 'Nirvana/Nevermind']);
    assert.deepEqual(ids(folders[0].tracks), ['1']);
    assert.deepEqual(ids(folders[1].tracks), ['2', '3']);
  });

  it('does not list a folder that only holds other folders', () => {
    const folders = foldersOf([file('1', 'Music/A/B/C/')], 'Music');
    assert.deepEqual(paths(folders), ['A/B/C']);
  });

  it('names a folder by its last step and keeps the whole path to open it with', () => {
    const [folder] = foldersOf([file('1', 'Music/Nirvana/Nevermind/')], 'Music');

    assert.equal(folder.name, 'Nevermind');
    assert.equal(folder.key, 'Music/Nirvana/Nevermind');
  });

  it('shows the library folder itself first, with no path of its own', () => {
    const folders = foldersOf(
      [file('1', 'Music/Albums/'), file('2', 'Music/'), file('3', 'Music/')],
      'Music'
    );

    assert.deepEqual(paths(folders), ['', 'Albums']);
    assert.equal(folders[0].name, 'Music');
    assert.equal(folders[0].tracks.length, 2);
  });

  it('reads paths from a library folder that is itself several steps down', () => {
    const folders = foldersOf(
      [file('1', 'Music/Collection/Rock/'), file('2', 'Music/Collection/')],
      '/Music/Collection/'
    );

    assert.deepEqual(paths(folders), ['', 'Rock']);
    assert.equal(folders[0].name, 'Collection');
  });

  it('does not mistake a folder that starts with the same letters for one inside', () => {
    const folders = foldersOf([file('1', 'Music Videos/Live/')], 'Music');
    assert.deepEqual(paths(folders), ['Music Videos/Live']);
  });

  it('is not put off by the case of the library folder', () => {
    const folders = foldersOf([file('1', 'music/Rock/')], 'Music');
    assert.deepEqual(paths(folders), ['Rock']);
  });

  it('keeps a folder next to what is inside it', () => {
    // Compared as whole strings, the space in `Rock Ballads` sorts ahead of
    // the slash in `Rock/Live` and comes between a folder and its own child.
    const folders = foldersOf(
      [file('1', 'Music/Rock Ballads/'), file('2', 'Music/Rock/Live/'), file('3', 'Music/Rock/')],
      'Music'
    );

    assert.deepEqual(paths(folders), ['Rock', 'Rock/Live', 'Rock Ballads']);
  });

  it('orders by name the way the library does', () => {
    const folders = foldersOf(
      [file('1', 'Music/Şarkılar/'), file('2', 'Music/sezen/'), file('3', 'Music/Tarkan/')],
      'Music'
    );

    assert.deepEqual(paths(folders), ['sezen', 'Şarkılar', 'Tarkan']);
  });

  it('lists a folder\'s tracks by filename', () => {
    const [folder] = foldersOf(
      [
        file('1', 'Music/Mix/', '03 c.mp3'),
        file('2', 'Music/Mix/', '01 a.mp3'),
        file('3', 'Music/Mix/', '02 b.mp3'),
      ],
      'Music'
    );

    assert.deepEqual(ids(folder.tracks), ['2', '3', '1']);
  });

  it('leaves out a track the media store gives no folder for', () => {
    assert.deepEqual(foldersOf([file('1', null), file('2', '')], 'Music'), []);
  });
});

describe('sortFolders', () => {
  const dated = (id: string, folder: string, addedAt: number | null): EnrichedTrack => ({
    ...file(id, folder),
    addedAt,
  });
  const folders = foldersOf(
    [
      dated('1', 'Music/Rock/', 100),
      dated('2', 'Music/Rock/', 500),
      dated('3', 'Music/Rock/Live/', 300),
      dated('4', 'Music/Arabesk/', 900),
      dated('5', 'Music/Çocuk/', null),
      dated('6', 'Music/Çocuk/', null),
      dated('7', 'Music/Çocuk/', null),
    ],
    'Music'
  );

  it('goes by path, a folder beside what is in it', () => {
    assert.deepEqual(paths(sortFolders(folders, 'name')), ['Arabesk', 'Çocuk', 'Rock', 'Rock/Live']);
  });

  it('puts the fullest first, and settles a draw by path', () => {
    assert.deepEqual(paths(sortFolders(folders, 'tracks')), ['Çocuk', 'Rock', 'Arabesk', 'Rock/Live']);
  });

  it('dates a folder by its newest file, the undated after the dated', () => {
    assert.deepEqual(paths(sortFolders(folders, 'added')), ['Arabesk', 'Rock', 'Rock/Live', 'Çocuk']);
  });

  it('hands back a copy', () => {
    const before = paths(folders);
    sortFolders(folders, 'tracks');
    assert.deepEqual(paths(folders), before);
  });

  it('reads an unknown stored order as by path, and steps round all three', () => {
    assert.equal(asFolderSort(null), 'name');
    assert.equal(asFolderSort('played'), 'name');
    assert.equal(asFolderSort('added'), 'added');
    assert.equal(nextFolderSort('name'), 'tracks');
    assert.equal(nextFolderSort('added'), 'name');
  });
});
