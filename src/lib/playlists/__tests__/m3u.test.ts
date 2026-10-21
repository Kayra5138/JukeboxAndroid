import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readings } from '../m3u/decode.ts';
import { foundCount, indexLibrary, matchEntries, type ListTrack } from '../m3u/match.ts';
import { looksLikePlaylist, parseM3u } from '../m3u/parse.ts';
import { locate, placeOfAbsolute, placeOfDocument, percentDecoded, type Place } from '../m3u/paths.ts';
import {
  entryPath,
  fileNameFor,
  fileNamesFor,
  freeListName,
  listNameFor,
  onceEach,
  parsePathStyle,
  writeM3u,
} from '../m3u/write.ts';

const utf8 = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'));
const latin1 = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));

/** Text in a single-byte code page, from a table of the letters that differ from Latin-1. */
const codePage = (text: string, table: Record<string, number>) =>
  new Uint8Array([...text].map((char) => table[char] ?? char.charCodeAt(0)));
const TURKISH = { Ş: 0xde, ş: 0xfe, ı: 0xfd, İ: 0xdd, ğ: 0xf0, Ğ: 0xd0, ö: 0xf6, ü: 0xfc, Ö: 0xd6, ç: 0xe7 };
const RUSSIAN = Object.fromEntries(
  [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя'].map((char, index) => [char, 0xc0 + index])
);

const track = (id: string, folder: string, filename: string, extra: Partial<ListTrack> = {}): ListTrack => ({
  id,
  folder,
  filename,
  title: filename.replace(/^\d+ /, '').replace(/\.[^.]+$/, ''),
  artist: folder.split('/')[1] ?? null,
  durationSec: 200,
  ...extra,
});

const LIBRARY: ListTrack[] = [
  track('1', 'Music/Nirvana/Nevermind/', '05 Lithium.mp3', { title: 'Lithium', durationSec: 257 }),
  track('2', 'Music/Nirvana/Nevermind/', '01 Smells Like Teen Spirit.mp3', { title: 'Smells Like Teen Spirit', durationSec: 301 }),
  track('3', 'Music/Tarkan/Ölürüm Sana/', '05 Şımarık.mp3', { title: 'Şımarık', artist: 'Tarkan', durationSec: 236 }),
  track('4', 'Music/Beyoncé/B’Day/', 'Déjà Vu.mp3', { title: 'Déjà Vu', artist: 'Beyoncé', durationSec: 240 }),
  track('5', 'Music/Кино/Группа крови/', '01 Группа крови.mp3', { title: 'Группа крови', artist: 'Кино', durationSec: 285 }),
  // Two records that both open with a track called Intro.
  track('6', 'Music/Massive Attack/Mezzanine/', '00 Intro.mp3', { title: 'Intro', artist: 'Massive Attack', durationSec: 95 }),
  track('7', 'Music/The xx/xx/', '00 Intro.mp3', { title: 'Intro', artist: 'The xx', durationSec: 127 }),
  // On a memory card, at a path the phone's storage also has.
  track('8', 'Music/Sezen Aksu/Gülümse/', '01 Gülümse.flac', {
    title: 'Gülümse',
    artist: 'Sezen Aksu',
    durationSec: 262,
    path: '/storage/1A2B-3C4D/Music/Sezen Aksu/Gülümse/01 Gülümse.flac',
  }),
  track('9', 'Music/Sezen Aksu/Gülümse/', '01 Gülümse.flac', {
    title: 'Gülümse',
    artist: 'Sezen Aksu',
    durationSec: 262,
    path: '/storage/emulated/0/Music/Sezen Aksu/Gülümse/01 Gülümse.flac',
  }),
  // Converted on the way to the phone; the PC still has the FLAC.
  track('10', 'Music/Daft Punk/Discovery/', '01 One More Time.mp3', { title: 'One More Time', artist: 'Daft Punk', durationSec: 320 }),
  // A title the app corrected, where the file still says otherwise.
  track('11', 'Music/Misc/', 'track01.mp3', {
    title: 'Hallelujah',
    artist: 'Jeff Buckley',
    durationSec: 413,
    aliases: [{ title: 'Track 1', artist: 'Unknown' }],
  }),
];
const INDEX = indexLibrary(LIBRARY);

/** What each entry of [text] was found to be, by track id, or how it was missed. */
function matched(text: string, folder: Place | null = null): string[] {
  return matchEntries(parseM3u(text).entries, INDEX, folder).map((result) => result.trackId ?? result.how);
}

describe('readings', () => {
  it('reads UTF-8 with or without the mark, whatever the file is called', () => {
    assert.deepEqual(readings(utf8('#EXTM3U\nŞımarık.mp3')), [{ encoding: 'UTF-8', text: '#EXTM3U\nŞımarık.mp3' }]);
    assert.deepEqual(readings(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Déjà Vu.mp3')])), [
      { encoding: 'UTF-8', text: 'Déjà Vu.mp3' },
    ]);
  });

  it('reads UTF-16 from a Windows tool by its mark', () => {
    const text = '#EXTM3U\r\nКино.mp3';
    const bytes = new Uint8Array([0xff, 0xfe, ...Buffer.from(text, 'utf16le')]);
    assert.deepEqual(readings(bytes), [{ encoding: 'UTF-16', text }]);
  });

  it('offers a code-page file as Western, Turkish and Cyrillic, Western first', () => {
    const western = readings(latin1('D:\\Music\\Beyoncé\\Déjà Vu.mp3'));
    assert.deepEqual(western.map((reading) => reading.encoding), ['Windows-1252', 'Windows-1254', 'Windows-1251']);
    assert.equal(western[0]!.text, 'D:\\Music\\Beyoncé\\Déjà Vu.mp3');

    assert.equal(readings(codePage('05 Şımarık.mp3', TURKISH))[1]!.text, '05 Şımarık.mp3');
    assert.equal(readings(codePage('Группа крови.mp3', RUSSIAN))[2]!.text, 'Группа крови.mp3');
  });

  it('turns a file that is not text away', () => {
    assert.deepEqual(readings(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x01])), []);
  });
});

describe('parseM3u', () => {
  it('reads the extended form: lengths, artist and title, the name', () => {
    const document = parseM3u(
      '\uFEFF#EXTM3U\r\n#PLAYLIST:Road trip\r\n\r\n#EXTINF:257,Nirvana - Lithium\r\n/storage/emulated/0/Music/Lithium.mp3\r\n'
    );
    assert.equal(document.name, 'Road trip');
    assert.deepEqual(document.entries, [
      {
        location: '/storage/emulated/0/Music/Lithium.mp3',
        line: 5,
        durationSec: 257,
        artist: 'Nirvana',
        title: 'Lithium',
        label: 'Nirvana - Lithium',
      },
    ]);
  });

  it('reads a plain list, comments and old Mac line breaks', () => {
    const document = parseM3u('# made by hand\rone.mp3\r\r# another\rtwo.mp3');
    assert.equal(document.name, null);
    assert.deepEqual(document.entries.map((entry) => [entry.location, entry.durationSec, entry.title]), [
      ['one.mp3', null, null],
      ['two.mp3', null, null],
    ]);
  });

  it('takes an unknown length as none, a title with no dash as a title, and keeps the dash in a title', () => {
    const [unknown, bare, dashed] = parseM3u(
      '#EXTINF:-1,Lithium\na.mp3\n#EXTINF:0,Intro\nb.mp3\n#EXTINF:95,Massive Attack - Intro - Live\nc.mp3'
    ).entries;
    assert.deepEqual([unknown!.durationSec, unknown!.artist, unknown!.title], [null, null, 'Lithium']);
    assert.deepEqual([bare!.durationSec, bare!.title], [null, 'Intro']);
    assert.deepEqual([dashed!.artist, dashed!.title, dashed!.label], ['Massive Attack', 'Intro - Live', 'Massive Attack - Intro - Live']);
  });

  it('reads past attributes with commas inside quotes', () => {
    const [entry] = parseM3u('#EXTINF:-1 tvg-name="Radio, live" group-title="x",Radio One\nhttp://example.com/stream').entries;
    assert.equal(entry!.title, 'Radio One');
    assert.equal(entry!.location, 'http://example.com/stream');
  });

  it('takes an artist from #EXTART, and forgets #EXTINF once its entry has been read', () => {
    const entries = parseM3u('#EXTART:Tarkan\n#EXTINF:236,Şımarık\na.mp3\nb.mp3\n#EXTVLCOPT:network-caching=1000\nc.mp3').entries;
    assert.deepEqual(entries.map((entry) => [entry.artist, entry.title]), [
      ['Tarkan', 'Şımarık'],
      [null, null],
      [null, null],
    ]);
  });
});

describe('looksLikePlaylist', () => {
  const asked = (text: string) => looksLikePlaylist(text, parseM3u(text));

  it('takes a file that says it is one, or whose lines are files', () => {
    assert.equal(asked('\uFEFF#EXTM3U\n'), true);
    assert.equal(asked('D:\\Music\\a.mp3\r\nb.flac\r\n'), true);
    assert.equal(asked('http://radio.example/live\n'), true);
  });

  it('turns away a text that is not one', () => {
    assert.equal(asked('Milk\nEggs\nBread, the brown one\n'), false);
    assert.equal(asked(''), false);
  });
});

describe('placeOfAbsolute', () => {
  it('knows every name of the phone’s own storage', () => {
    for (const path of [
      '/storage/emulated/0/Music/a.mp3',
      '/sdcard/Music/a.mp3',
      '/mnt/sdcard/Music/a.mp3',
      '/storage/self/primary/Music/a.mp3',
      '/data/media/0/Music/a.mp3',
      '/mnt/user/0/primary/Music/a.mp3',
      '/storage/emulated/legacy/Music/a.mp3',
    ]) {
      assert.deepEqual(placeOfAbsolute(path), { volume: 'primary', path: 'Music/a.mp3' }, path);
    }
  });

  it('knows a card by its volume id, and a card it cannot name as a card', () => {
    assert.deepEqual(placeOfAbsolute('/storage/1A2B-3C4D/Music/a.mp3'), { volume: '1a2b-3c4d', path: 'Music/a.mp3' });
    assert.deepEqual(placeOfAbsolute('/mnt/media_rw/1A2B-3C4D/Music/a.mp3'), { volume: '1a2b-3c4d', path: 'Music/a.mp3' });
    assert.deepEqual(placeOfAbsolute('/storage/sdcard1/Music/a.mp3'), { volume: null, path: 'Music/a.mp3' });
    assert.deepEqual(placeOfAbsolute('/mnt/extSdCard/Music/a.mp3'), { volume: null, path: 'Music/a.mp3' });
  });

  it('says nothing of a path that is not the phone’s', () => {
    assert.equal(placeOfAbsolute('/home/kayra/Music/a.mp3'), null);
    assert.equal(placeOfAbsolute('/storage/emulatedx/a.mp3'), null);
  });
});

describe('placeOfDocument', () => {
  it('reads the phone’s own storage provider’s ids, the Downloads folder’s and Documents', () => {
    assert.deepEqual(placeOfDocument({ documentId: 'primary:Music/Playlists/Mix.m3u' }), { volume: 'primary', path: 'Music/Playlists' });
    assert.deepEqual(placeOfDocument({ documentId: '1A2B-3C4D:Mix.m3u' }), { volume: '1a2b-3c4d', path: '' });
    assert.deepEqual(placeOfDocument({ documentId: 'raw:/storage/emulated/0/Download/Mix.m3u' }), { volume: 'primary', path: 'Download' });
    assert.deepEqual(placeOfDocument({ documentId: 'home:Lists/Mix.m3u' }), { volume: 'primary', path: 'Documents/Lists' });
  });

  it('takes a path the media store gave, or one inside a file manager’s address', () => {
    assert.deepEqual(placeOfDocument({ documentId: 'msf:42', path: '/storage/emulated/0/Download/Mix.m3u8' }), { volume: 'primary', path: 'Download' });
    assert.deepEqual(
      placeOfDocument({ uri: 'content://com.mixplorer.fileprovider/root/storage%2Femulated%2F0%2FMusic%2FMix.m3u' }),
      { volume: 'primary', path: 'Music' }
    );
  });

  it('says nothing where nothing says', () => {
    assert.equal(placeOfDocument({ documentId: 'msf:42', uri: 'content://com.android.providers.downloads.documents/document/msf%3A42' }), null);
    assert.equal(placeOfDocument({}), null);
  });
});

describe('locate', () => {
  it('reads VLC’s addresses, percent-encoding and all', () => {
    assert.deepEqual(locate('file:///storage/emulated/0/Music/Nirvana/05%20Lithium.mp3', null), {
      kind: 'file',
      place: { volume: 'primary', path: 'Music/Nirvana/05 Lithium.mp3' },
      steps: ['Music', 'Nirvana', '05 Lithium.mp3'],
    });
    assert.deepEqual(locate('file:///C:/Users/Kayra/Music/D%C3%A9j%C3%A0%20Vu.mp3', null), {
      kind: 'file',
      place: null,
      steps: ['Users', 'Kayra', 'Music', 'Déjà Vu.mp3'],
    });
    assert.deepEqual(locate('file://localhost/sdcard/a.mp3', null), {
      kind: 'file',
      place: { volume: 'primary', path: 'a.mp3' },
      steps: ['a.mp3'],
    });
  });

  it('decodes an old player’s code-page bytes rather than refusing them', () => {
    assert.equal(percentDecoded('D%E9j%E0%20Vu.mp3'), 'Déjà Vu.mp3');
  });

  it('keeps only the steps of a PC’s drive or share', () => {
    assert.deepEqual(locate('D:\\Music\\Nirvana\\Lithium.mp3', null), { kind: 'file', place: null, steps: ['Music', 'Nirvana', 'Lithium.mp3'] });
    assert.deepEqual(locate('\\\\nas\\music\\Nirvana\\Lithium.mp3', null), { kind: 'file', place: null, steps: ['Nirvana', 'Lithium.mp3'] });
  });

  it('resolves a relative entry against the playlist’s folder, and keeps its steps where that is not known', () => {
    const folder: Place = { volume: 'primary', path: 'Music/Playlists' };
    assert.deepEqual(locate('..\\Nirvana\\Lithium.mp3', folder), {
      kind: 'file',
      place: { volume: 'primary', path: 'Music/Nirvana/Lithium.mp3' },
      steps: ['Music', 'Nirvana', 'Lithium.mp3'],
    });
    assert.deepEqual(locate('./Nirvana/Lithium.mp3', null), { kind: 'file', place: null, steps: ['Nirvana', 'Lithium.mp3'] });
    assert.deepEqual(locate('../../../../a.mp3', folder), { kind: 'file', place: null, steps: ['a.mp3'] });
  });

  it('tells a stream and a media store id from a file', () => {
    assert.deepEqual(locate('https://radio.example/stream.mp3', null), { kind: 'web' });
    assert.deepEqual(locate('rtsp://camera/feed', null), { kind: 'web' });
    assert.deepEqual(locate('content://media/external/audio/media/1234', null), { kind: 'media', id: '1234' });
    assert.deepEqual(locate('content://com.android.externalstorage.documents/document/primary%3AMusic%2Fa.mp3', null), {
      kind: 'file',
      place: { volume: 'primary', path: 'Music/a.mp3' },
      steps: ['Music', 'a.mp3'],
    });
  });
});

describe('matchEntries', () => {
  it('finds a Poweramp or Musicolet playlist by its whole paths', () => {
    const poweramp = [
      '#EXTM3U',
      '#EXTINF:257,Nirvana - Lithium',
      '/storage/emulated/0/Music/Nirvana/Nevermind/05 Lithium.mp3',
      '#EXTINF:236,Tarkan - Şımarık',
      '/storage/emulated/0/Music/Tarkan/Ölürüm Sana/05 Şımarık.mp3',
    ].join('\n');
    assert.deepEqual(matched(poweramp), ['1', '3']);
    // Musicolet writes the older name for the same place, and no #EXTINF.
    assert.deepEqual(matched('/sdcard/Music/Nirvana/Nevermind/05 Lithium.mp3\n'), ['1']);
  });

  it('tells the card’s copy from the phone’s by the volume', () => {
    assert.deepEqual(
      matched('/storage/1A2B-3C4D/Music/Sezen Aksu/Gülümse/01 Gülümse.flac\n/storage/emulated/0/Music/Sezen Aksu/Gülümse/01 Gülümse.flac'),
      ['8', '9']
    );
  });

  it('finds a foobar2000 or MusicBee playlist from a PC by the ends of its paths', () => {
    const foobar = '\uFEFFD:\\Müzik\\Nirvana\\Nevermind\\05 Lithium.mp3\r\nD:\\Müzik\\Tarkan\\Ölürüm Sana\\05 Şımarık.mp3\r\n';
    assert.deepEqual(matched(foobar), ['1', '3']);
    const musicbee = '#EXTM3U\r\n#EXTINF:240,Beyoncé - Déjà Vu\r\n..\\Beyoncé\\B’Day\\Déjà Vu.mp3\r\n';
    assert.deepEqual(matched(musicbee), ['4']);
  });

  it('finds a VLC playlist by its addresses', () => {
    const vlc = [
      '#EXTM3U',
      '#EXTINF:285,Группа крови',
      'file:///storage/emulated/0/Music/%D0%9A%D0%B8%D0%BD%D0%BE/%D0%93%D1%80%D1%83%D0%BF%D0%BF%D0%B0%20%D0%BA%D1%80%D0%BE%D0%B2%D0%B8/01%20%D0%93%D1%80%D1%83%D0%BF%D0%BF%D0%B0%20%D0%BA%D1%80%D0%BE%D0%B2%D0%B8.mp3',
      '#EXTVLCOPT:start-time=0',
      'file:///C:/Users/Kayra/Music/Nirvana/Nevermind/05%20Lithium.mp3',
    ].join('\n');
    assert.deepEqual(matched(vlc), ['5', '1']);
  });

  it('takes a file name alone where only one track has it, unless the length says otherwise', () => {
    assert.deepEqual(matched('Déjà Vu.mp3'), ['4']);
    assert.deepEqual(matched('#EXTINF:30,Somebody - Something\nDéjà Vu.mp3'), ['notFound']);
  });

  it('leaves out a name two tracks share, unless the folder, length or tags choose', () => {
    assert.deepEqual(matched('00 Intro.mp3'), ['ambiguous']);
    assert.deepEqual(matched('Mezzanine/00 Intro.mp3'), ['6']);
    assert.deepEqual(matched('#EXTINF:127,\n00 Intro.mp3'), ['7']);
    assert.deepEqual(matched('#EXTINF:-1,Massive Attack - Intro\n00 Intro.mp3'), ['6']);
  });

  it('finds a song by #EXTINF’s artist and title when its path is nobody’s', () => {
    assert.deepEqual(matched('#EXTINF:302,NIRVANA - Smells like teen spirit\nX:\\old\\track02.wma'), ['2']);
    // By the name the file gave it, too, where the app shows a corrected one.
    assert.deepEqual(matched('#EXTINF:413,Unknown - Track 1\nsomewhere/else.mp3'), ['11']);
    // Not when the length is wrong.
    assert.deepEqual(matched('#EXTINF:100,Nirvana - Lithium\nX:\\old\\track05.wma'), ['notFound']);
  });

  it('finds a song converted from FLAC by its name without the ending', () => {
    assert.deepEqual(matched('D:\\Music\\Daft Punk\\Discovery\\01 One More Time.flac'), ['10']);
  });

  it('finds a media store id, and counts a stream as not found', () => {
    assert.deepEqual(matched('content://media/external/audio/media/4\nhttp://radio.example/live\ncontent://media/external/audio/media/999'), [
      '4',
      'web',
      'notFound',
    ]);
  });

  it('resolves relative entries against the playlist’s folder first', () => {
    const folder: Place = { volume: 'primary', path: 'Music/Playlists' };
    assert.deepEqual(matched('../Nirvana/Nevermind/05 Lithium.mp3', folder), ['1']);
  });

  it('keeps the file’s order and its repeats', () => {
    assert.deepEqual(matched('05 Lithium.mp3\nDéjà Vu.mp3\n05 Lithium.mp3'), ['1', '4', '1']);
  });

  it('lets the reading that finds more songs win, which is how a Turkish PC’s .m3u is read', () => {
    const bytes = codePage('#EXTM3U\r\n#EXTINF:236,Tarkan - Şımarık\r\nC:\\Müzik\\Tarkan\\Ölürüm Sana\\05 Şımarık.mp3\r\n', TURKISH);
    const scored = readings(bytes).map((reading) => [
      reading.encoding,
      foundCount(matchEntries(parseM3u(reading.text).entries, INDEX, null)),
    ]);
    assert.deepEqual(scored, [
      ['Windows-1252', 0],
      ['Windows-1254', 1],
      ['Windows-1251', 0],
    ]);
  });
});

describe('writeM3u', () => {
  it('writes the extended form with lengths, names and the list’s name', () => {
    const text = writeM3u('Road\ntrip', [
      { track: LIBRARY[0]!, path: '/storage/emulated/0/Music/Nirvana/Nevermind/05 Lithium.mp3' },
      { track: { ...LIBRARY[3]!, artist: null, durationSec: 0 }, path: 'Beyoncé/B’Day/Déjà Vu.mp3' },
    ]);
    assert.equal(
      text,
      [
        '#EXTM3U',
        '#PLAYLIST:Road trip',
        '#EXTINF:257,Nirvana - Lithium',
        '/storage/emulated/0/Music/Nirvana/Nevermind/05 Lithium.mp3',
        '#EXTINF:-1,Déjà Vu',
        'Beyoncé/B’Day/Déjà Vu.mp3',
        '',
      ].join('\n')
    );
  });

  it('names each file the way each style asks', () => {
    const lithium = LIBRARY[0]!;
    assert.equal(entryPath(lithium, 'phone', 'Music'), '/storage/emulated/0/Music/Nirvana/Nevermind/05 Lithium.mp3');
    assert.equal(entryPath(LIBRARY[7]!, 'phone', 'Music'), '/storage/1A2B-3C4D/Music/Sezen Aksu/Gülümse/01 Gülümse.flac');
    assert.equal(entryPath(lithium, 'library', 'Music'), 'Nirvana/Nevermind/05 Lithium.mp3');
    assert.equal(entryPath(lithium, 'library', 'Music/Nirvana/'), 'Nevermind/05 Lithium.mp3');
    assert.equal(entryPath(lithium, 'library', 'Podcasts'), null);
    assert.equal(entryPath({ ...lithium, filename: null }, 'phone', 'Music'), null);
  });

  it('comes back as the same songs when read again, in either style', () => {
    // Paths from the library folder down cannot tell the card's copy of a
    // song from the phone's, and the playlist's own volume is taken.
    for (const style of ['phone', 'library'] as const) {
      const entries = LIBRARY.map((each) => ({ track: each, path: entryPath(each, style, 'Music')! }));
      const back = parseM3u(writeM3u('All', entries));
      assert.equal(back.name, 'All');
      const folder: Place | null = style === 'library' ? { volume: 'primary', path: 'Music' } : null;
      assert.deepEqual(
        matchEntries(back.entries, INDEX, folder).map((result) => result.trackId),
        LIBRARY.map((each) => (style === 'library' && each.id === '8' ? '9' : each.id)),
        style
      );
    }
  });

  it('reads the path setting, phone paths unless told otherwise', () => {
    assert.equal(parsePathStyle('library'), 'library');
    assert.equal(parsePathStyle(null), 'phone');
    assert.equal(parsePathStyle('nonsense'), 'phone');
  });
});

describe('names', () => {
  it('makes a list’s name a file name a card and a PC will take', () => {
    assert.equal(fileNameFor('AC/DC: Best of?', 'List'), 'AC-DC- Best of-.m3u8');
    assert.equal(fileNameFor(' ...Road trip. ', 'List'), 'Road trip.m3u8');
    assert.equal(fileNameFor('***', 'List'), '---.m3u8');
    assert.equal(fileNameFor('...', 'List'), 'List.m3u8');
  });

  it('gives lists of one name different files, by any casing', () => {
    assert.deepEqual(fileNamesFor(['Mix', 'mix', 'Mix', 'Other'], 'List'), ['Mix.m3u8', 'mix (2).m3u8', 'Mix (3).m3u8', 'Other.m3u8']);
  });

  it('finds a free name for a list beside one of the same name', () => {
    assert.equal(freeListName('Mix', ['Other']), 'Mix');
    assert.equal(freeListName('Mix', ['mix', 'Mix (2)']), 'Mix (3)');
  });

  it('names an imported list from the file, or its name, or else the fallback', () => {
    assert.equal(listNameFor('Road trip', 'whatever.m3u', 'Imported'), 'Road trip');
    assert.equal(listNameFor(null, 'Gym mix.m3u8', 'Imported'), 'Gym mix');
    assert.equal(listNameFor('  ', null, 'Imported'), 'Imported');
  });

  it('keeps each track once, at its first place', () => {
    assert.deepEqual(onceEach(['1', '4', '1', '2', '4']), { ids: ['1', '4', '2'], repeated: 2 });
  });
});
