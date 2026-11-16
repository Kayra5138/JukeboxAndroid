import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readAppleXml, readPlist } from '../appleXml.ts';
import { readTableLists } from '../tables.ts';

/** A row of Apple's exported playlist: the four columns that matter, then the rest it writes. */
const appleRow = (name: string, artist: string, album: string) =>
  [name, artist, '', album, ...Array.from({ length: 27 }, (_, at) => (at === 7 ? '245' : ''))].join('\t');
const APPLE_HEADING =
  'Name\tArtist\tComposer\tAlbum\tGrouping\tWork\tMovement Number\tMovement Count\tMovement Name\tGenre\tSize\tTime\tDisc Number\tDisc Count\tTrack Number\tTrack Count\tYear\tDate Modified\tDate Added\tBit Rate\tSample Rate\tVolume Adjustment\tKind\tEqualiser\tComments\tPlays\tLast Played\tSkips\tLast Skipped\tMy Rating\tLocation';

describe('a playlist written as a table', () => {
  it('reads Apple’s exported playlist, named for its file', () => {
    const table = [APPLE_HEADING, appleRow('Numb', 'Linkin Park', 'Meteora'), appleRow('Creep', 'Radiohead', 'Pablo Honey')].join('\r\n');
    assert.deepEqual(readTableLists(table, 'Road'), [
      {
        name: 'Road',
        items: [
          { title: 'Numb', artist: 'Linkin Park', album: 'Meteora' },
          { title: 'Creep', artist: 'Radiohead', album: 'Pablo Honey' },
        ],
      },
    ]);
  });

  it('reads Apple’s table by where its columns stand, in a language its headings are not known in', () => {
    const heading = APPLE_HEADING.split('\t').map((_, at) => `Sütun ${at + 1}`).join('\t');
    const [list] = readTableLists([heading, appleRow('Hadi Bakalım', 'Sezen Aksu', 'Gülümse')].join('\n'), 'Yol')!;
    assert.deepEqual(list!.items, [{ title: 'Hadi Bakalım', artist: 'Sezen Aksu', album: 'Gülümse' }]);
  });

  it('makes a list of each playlist a file names, in the order they come', () => {
    const csv = [
      'Track name,Artist name,Album,Playlist name,Type,ISRC',
      'Numb,Linkin Park,Meteora,Road,Playlist,USWB10300474',
      'Lucky,Radiohead,OK Computer,Rain,Playlist,',
      '"Paranoid Android","Radiohead","OK Computer","Road",Playlist,',
    ].join('\n');
    assert.deepEqual(
      readTableLists(csv, 'file')!.map((list) => [list.name, list.items.map((song) => song.title)]),
      [
        ['Road', ['Numb', 'Paranoid Android']],
        ['Rain', ['Lucky']],
      ]
    );
  });

  it('reads Exportify’s columns', () => {
    const csv = '"Track URI","Track Name","Album Name","Artist Name(s)","Duration (ms)"\n"spotify:track:1","Numb","Meteora","Linkin Park","185000"\n';
    assert.deepEqual(readTableLists(csv, 'Mine')![0]!.items, [{ title: 'Numb', artist: 'Linkin Park', album: 'Meteora' }]);
  });

  it('says a file is not a table of songs when it is something else', () => {
    assert.equal(readTableLists('#EXTM3U\n#EXTINF:185,Linkin Park - Numb\nNumb.mp3\n', 'x'), null);
    assert.equal(readTableLists('Music/Numb.mp3\nMusic/Creep.mp3\n', 'x'), null);
    assert.equal(readTableLists('name,size\nphoto.jpg,12\n', 'x'), null);
  });
});

const LIBRARY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Major Version</key><integer>1</integer>
  <key>Tracks</key>
  <dict>
    <key>101</key>
    <dict><key>Track ID</key><integer>101</integer><key>Name</key><string>Numb</string><key>Artist</key><string>Linkin Park</string><key>Album</key><string>Meteora</string><key>Total Time</key><integer>185000</integer></dict>
    <key>102</key>
    <dict><key>Track ID</key><integer>102</integer><key>Name</key><string>Simon &amp; Garfunkel&#39;s Song</string><key>Album Artist</key><string>Simon &amp; Garfunkel</string><key>Explicit</key><true/></dict>
    <key>103</key>
    <dict><key>Track ID</key><integer>103</integer><key>Name</key><string>Episode 4</string><key>Artist</key><string>A Show</string><key>Podcast</key><true/></dict>
  </dict>
  <key>Playlists</key>
  <array>
    <dict><key>Name</key><string>Library</string><key>Master</key><true/><key>Playlist Items</key><array><dict><key>Track ID</key><integer>101</integer></dict></array></dict>
    <dict><key>Name</key><string>Music</string><key>Distinguished Kind</key><integer>4</integer><key>Playlist Items</key><array><dict><key>Track ID</key><integer>101</integer></dict></array></dict>
    <dict><key>Name</key><string>Old lists</string><key>Folder</key><true/></dict>
    <dict><key>Name</key><string>Road</string><key>Playlist Items</key><array>
      <dict><key>Track ID</key><integer>102</integer></dict>
      <dict><key>Track ID</key><integer>103</integer></dict>
      <dict><key>Track ID</key><integer>101</integer></dict>
    </array></dict>
    <dict><key>Name</key><string>Nothing yet</string><key>Playlist Items</key><array/></dict>
  </array>
</dict>
</plist>`;

describe('Apple’s XML of a library', () => {
  it('reads a property list, its entities and empty tags', () => {
    assert.deepEqual(readPlist('<plist><dict><key>a</key><string>x &amp; y</string><key>b</key><array/><key>c</key><false/></dict></plist>'), {
      a: 'x & y',
      b: [],
      c: false,
    });
  });

  it('reads the playlists made, in their order, without the library, its kinds, folders or podcasts', () => {
    assert.deepEqual(readAppleXml(LIBRARY), [
      {
        name: 'Road',
        items: [
          { title: "Simon & Garfunkel's Song", artist: 'Simon & Garfunkel', album: null },
          { title: 'Numb', artist: 'Linkin Park', album: 'Meteora' },
        ],
      },
    ]);
  });

  it('says a file is not Apple’s XML when it is something else', () => {
    assert.equal(readAppleXml('#EXTM3U\n'), null);
    assert.equal(readAppleXml('<plist><dict><key>a</key><string>b</string></dict></plist>'), null);
  });
});
