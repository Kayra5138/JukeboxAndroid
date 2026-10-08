import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { migrate, type MigrationTarget } from '../../db/migrations.ts';
import { stringsFor } from '../../i18n/languages.ts';
import {
  artworkName,
  mergeTables,
  referencedArtwork,
  remapTables,
  summarise,
} from '../apply.ts';
import {
  BACKUP_FORMAT,
  BackupError,
  emptyTables,
  parseBackup,
  type BackupTrack,
  type Row,
  type Tables,
} from '../format.ts';
import { matchTracks, type LocalTrack } from '../match.ts';
import { holdsAnything, readSettings, readTables, restore, type BackupDb } from '../store.ts';

const HOME = 'file:///data/user/0/app/files/album-artwork/';

const local = (id: string, filename: string, extra: Partial<LocalTrack> = {}): LocalTrack => ({
  id,
  filename,
  folder: 'Music/',
  title: filename.replace(/\.mp3$/, ''),
  artist: 'Somebody',
  durationSec: 200,
  ...extra,
});
const backed = (id: string, filename: string | null, extra: Partial<BackupTrack> = {}): BackupTrack => ({
  id,
  filename,
  folder: 'Music/',
  title: filename ? filename.replace(/\.mp3$/, '') : null,
  artist: 'Somebody',
  durationSec: 200,
  ...extra,
});

const play = (track: string, at: number, extra: Row = {}): Row => ({
  track_id: track,
  title: `song ${track}`,
  artist: 'Somebody',
  filename: `${track}.mp3`,
  started_at: at,
  seconds_played: 120,
  completed: 1,
  ...extra,
});
const details = (track: string, status: string, fetched: number, extra: Row = {}): Row => ({
  track_id: track,
  status,
  source: null,
  title: `title ${status}`,
  artist: null,
  album: null,
  genre: null,
  year: null,
  artwork_url: null,
  fetched_at: fetched,
  track_number: null,
  disc_number: null,
  ...extra,
});
const tag = (track: string, name: string, position: number, source = 'lookup'): Row => ({
  track_id: track,
  tag: name,
  position,
  source,
});
const lyric = (track: string, plain: string | null, fetched: number, source: string | null = 'lookup'): Row => ({
  track_id: track,
  plain,
  synced: null,
  fetched_at: fetched,
  unreachable_at: null,
  source,
  offset_ms: 0,
});
const list = (id: number, name: string, extra: Row = {}): Row => ({
  id,
  name,
  created_at: 1,
  updated_at: 1,
  cover_track_id: null,
  cover_uri: null,
  tag: null,
  ...extra,
});
const entry = (playlist: number, track: string, position: number): Row => ({
  playlist_id: playlist,
  track_id: track,
  position,
  added_at: 5,
});
const tables = (given: Partial<Tables>): Tables => ({ ...emptyTables(), ...given });

describe('reading a backup', () => {
  const wrap = (body: object) => JSON.stringify({ format: BACKUP_FORMAT, tables: {}, ...body });

  it('refuses a file that is not one', () => {
    assert.throws(() => parseBackup('not json'), BackupError);
    assert.throws(() => parseBackup('[]'), BackupError);
    assert.throws(() => parseBackup('{"hello":1}'), BackupError);
  });

  it('refuses one from a newer version, and says to update', () => {
    assert.throws(
      () => parseBackup(JSON.stringify({ format: BACKUP_FORMAT + 1, tables: {} })),
      /newer Jukebox/
    );
  });

  it('refuses in Turkish when that is the language', () => {
    const tr = stringsFor('tr');
    assert.throws(() => parseBackup('not json', tr), /Jukebox yedeği değil/);
    assert.throws(
      () => parseBackup(JSON.stringify({ format: BACKUP_FORMAT + 1, tables: {} }), tr),
      /daha yeni bir Jukebox/
    );
  });

  it('keeps a whole row and leaves out one that cannot be made whole', () => {
    const backup = parseBackup(
      wrap({ tables: { plays: [play('1', 10), { track_id: '2', title: 'no clock on it' }, 'junk', null] } })
    );
    assert.deepEqual(backup.tables.plays, [play('1', 10)]);
  });

  it('takes only the columns it knows, each as the kind it should be', () => {
    const backup = parseBackup(
      wrap({
        tables: {
          plays: [{ ...play('1', 10.9), seconds_played: 12.5, extra: 'x', artist: 42 }],
          a_table_from_the_future: [{ anything: true }],
        },
      })
    );
    const row = backup.tables.plays[0]!;
    assert.equal('extra' in row, false);
    assert.equal(row.started_at, 10, 'a whole number column is made whole');
    assert.equal(row.seconds_played, 12.5);
    assert.equal(row.artist, '42', 'a number where text belongs is read as text');
    assert.equal('a_table_from_the_future' in backup.tables, false);
  });

  it('gives lyrics from before the timing offset an offset of nothing', () => {
    const old = { track_id: '1', plain: 'la', synced: null, fetched_at: 3 };
    assert.equal(parseBackup(wrap({ tables: { track_lyrics: [old] } })).tables.track_lyrics[0]!.offset_ms, 0);
  });

  it('leaves behind the settings that describe the phone', () => {
    const backup = parseBackup(
      wrap({
        settings: {
          'player:repeat': 'all',
          'library:root': 'Music/Mine',
          'youtube:playlist-imports:v1': '[]',
          'not:text': 5,
        },
      })
    );
    assert.deepEqual(backup.settings, { 'player:repeat': 'all' });
  });

  it('does not take a ListenBrainz token, or anything else about that connection, from a file', () => {
    const backup = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        tables: {},
        settings: {
          'listenbrainz:token': 'somebody-elses',
          'listenbrainz:user': 'somebody',
          'listenbrainz:sending': 'true',
          'listenbrainz:since': '1',
          'stats:period': 'year',
        },
      })
    );
    assert.deepEqual(backup.settings, { 'stats:period': 'year' });
  });
});

describe('finding a song again', () => {
  const library = [local('7', 'a.mp3'), local('8', 'b.mp3', { folder: 'Music/Sub/' })];

  it('is itself when the id and the file name both agree', () => {
    assert.equal(matchTracks([backed('7', 'a.mp3')], library).get('7'), '7');
  });

  it('does not trust a number that now belongs to a different file', () => {
    // Another phone's 7 is some other song. Here 7 is a.mp3, and b.mp3 is 8.
    assert.equal(matchTracks([backed('7', 'b.mp3', { folder: 'Music/Sub/' })], library).get('7'), '8');
  });

  it('finds a file that moved to another folder by its name', () => {
    assert.equal(matchTracks([backed('40', 'a.mp3', { folder: 'Elsewhere/' })], library).get('40'), '7');
  });

  it('uses the folder to choose between two files with one name', () => {
    const two = [local('1', 'intro.mp3', { folder: 'A/' }), local('2', 'intro.mp3', { folder: 'B/' })];
    assert.equal(matchTracks([backed('9', 'intro.mp3', { folder: 'B/' })], two).get('9'), '2');
    assert.equal(
      matchTracks([backed('9', 'intro.mp3', { folder: 'C/', title: null })], two).has('9'),
      false,
      'two candidates and nothing to choose by is no match'
    );
  });

  it('finds a renamed file by what it is and how long it runs', () => {
    const renamed = [local('5', 'track01.mp3', { title: 'Blue', artist: 'Joni', durationSec: 181 })];
    const wanted = backed('90', 'joni - blue.mp3', { title: ' blue ', artist: 'JONI', durationSec: 180 });
    assert.equal(matchTracks([wanted], renamed).get('90'), '5');
    assert.equal(
      matchTracks([{ ...wanted, durationSec: 240 }], renamed).has('90'),
      false,
      'the same title a minute longer is another recording'
    );
  });

  it('lets two old ids be the one song they now are', () => {
    const found = matchTracks([backed('7', 'a.mp3'), backed('300', 'a.mp3')], library);
    assert.equal(found.get('7'), '7');
    assert.equal(found.get('300'), '7');
  });

  it('leaves alone what is not here', () => {
    assert.equal(matchTracks([backed('1', 'gone.mp3', { title: 'Gone' })], library).size, 0);
  });

  // Every record has an intro, and a great many of them are file number one.
  const intro = local('5', '01 - Intro.mp3', { folder: 'Music/Kid A/', title: 'Intro', artist: 'One', durationSec: 62 });

  it('does not take two songs for one because their files share a name', () => {
    const mine = backed('20', '01 - Intro.mp3', { folder: 'Music/Kid A/', title: 'Intro', artist: 'One', durationSec: 62 });
    const other = backed('21', '01 - Intro.mp3', { folder: 'Music/Low/', title: 'Intro', artist: 'Two', durationSec: 95 });
    const found = matchTracks([mine, other], [intro]);
    assert.equal(found.get('20'), '5');
    assert.equal(found.has('21'), false, 'half a minute longer is another song, whatever it is called');
    assert.equal(matchTracks([other], [intro]).has('21'), false, 'and is no more this one for being asked alone');
  });

  it('does not believe the folder either when the length says otherwise', () => {
    // The same place and the same name: a record that was replaced by another.
    const wanted = backed('20', '01 - Intro.mp3', { folder: 'Music/Kid A/', durationSec: 140 });
    assert.equal(matchTracks([wanted], [intro]).has('20'), false);
  });

  // What a deleted song looks like in a backup: its last listen, and no more.
  const gone = (id: string, extra: Partial<BackupTrack> = {}) =>
    backed(id, '01 - Intro.mp3', { folder: null, durationSec: null, title: 'Intro', artist: 'One', ...extra });

  it('takes the title and artist for a deleted song, which has no length', () => {
    const found = matchTracks([gone('30'), gone('31', { artist: 'Two' })], [intro]);
    assert.equal(found.get('30'), '5');
    assert.equal(found.has('31'), false, 'the name fits two songs and the artist only one');
  });

  it('still joins a history that a moved file split in two', () => {
    const found = matchTracks([backed('5', '01 - Intro.mp3', { folder: 'Music/Kid A/', durationSec: 62 }), gone('30')], [intro]);
    assert.equal(found.get('5'), '5');
    assert.equal(found.get('30'), '5');
  });

  it('places one song on a name alone, and never two', () => {
    // Untagged, so the title is the file name over again and says nothing.
    const bare = local('6', 'intro.mp3', { title: 'intro', artist: null });
    const nameless = (id: string) => gone(id, { filename: 'intro.mp3', title: 'intro', artist: null });

    assert.equal(matchTracks([nameless('40')], [bare]).get('40'), '6', 'nothing against it, and nobody else asking');
    assert.equal(matchTracks([nameless('40'), nameless('41')], [bare]).size, 0, 'two cannot both be it');

    const found = matchTracks([backed('6', 'intro.mp3', { title: 'intro', artist: null }), nameless('40')], [bare]);
    assert.equal(found.get('6'), '6');
    assert.equal(found.has('40'), false, 'the track is spoken for by a song that could prove it');
  });

  it('does not let a corrected title count against a name', () => {
    const found = matchTracks([gone('30', { title: 'Intro (2009 Remaster)' })], [intro]);
    assert.equal(found.get('30'), '5');
  });

  it('reads a length of nothing as no length', () => {
    const unread = local('6', 'x.mp3', { title: 'X', durationSec: 0 });
    assert.equal(matchTracks([backed('50', 'x.mp3', { title: 'X', folder: 'Other/' })], [unread]).get('50'), '6');
  });
});

describe('re-addressing a backup', () => {
  const to = new Map([['1', '501']]);
  const tracks = [backed('1', '1.mp3'), backed('2', '2.mp3')];

  it('files everything under the id the song has here', () => {
    const { tables: out } = remapTables(
      tables({ plays: [play('1', 10)], track_tags: [tag('1', 'rock', 0)], track_lyrics: [lyric('1', 'la', 3)] }),
      to,
      tracks,
      HOME
    );
    assert.equal(out.plays[0]!.track_id, '501');
    assert.equal(out.track_tags[0]!.track_id, '501');
    assert.equal(out.track_lyrics[0]!.track_id, '501');
  });

  it('keeps a listen to a song that is not here, and never under the old number', () => {
    const { tables: out } = remapTables(tables({ plays: [play('2', 10), play('2', 20)] }), to, tracks, HOME);
    assert.equal(out.plays.length, 2);
    const id = out.plays[0]!.track_id as string;
    assert.match(id, /^absent:[0-9a-f]{8}$/);
    assert.notEqual(id, '2', "another phone's 2 is somebody else's song here");
    assert.equal(out.plays[1]!.track_id, id, 'the same missing song is one song');
  });

  it('keeps two missing songs apart when their files had one name', () => {
    const missing = [
      backed('2', '01 - Intro.mp3', { folder: null, durationSec: null, title: 'Intro', artist: 'One' }),
      backed('3', '01 - Intro.mp3', { folder: null, durationSec: null, title: 'Intro', artist: 'Two' }),
      // And a third that nothing but the backup's own number tells from the first.
      backed('4', '01 - Intro.mp3', { folder: null, durationSec: null, title: 'Intro', artist: 'One' }),
    ];
    const listens = tables({ plays: [play('2', 10), play('3', 20), play('4', 30), play('2', 40)] });
    const { tables: out } = remapTables(listens, new Map(), missing, HOME);
    const ids = out.plays.map((row) => row.track_id as string);

    for (const id of ids) assert.match(id, /^absent:[0-9a-f]{8}$/);
    assert.equal(new Set(ids).size, 3, 'three songs are three songs');
    assert.equal(ids[3], ids[0], 'and each is the same song every time');

    const again = remapTables(listens, new Map(), missing, HOME).tables.plays.map((row) => row.track_id);
    assert.deepEqual(again, ids, 'the same backup comes out the same way twice');
  });

  it('gives a missing song the id an earlier import gave it', () => {
    const alone = remapTables(tables({ plays: [play('2', 10)] }), new Map(), [backed('2', 'x.mp3')], HOME);
    const among = remapTables(
      tables({ plays: [play('2', 10), play('3', 20)] }),
      new Map(),
      [backed('2', 'x.mp3'), backed('3', 'x.mp3', { title: 'Another' })],
      HOME
    );
    assert.equal(among.tables.plays[0]!.track_id, alone.tables.plays[0]!.track_id);

    // A backup made after such an import describes the song by that id.
    const id = alone.tables.plays[0]!.track_id as string;
    const back = remapTables(tables({ plays: [play(id, 10)] }), new Map(), [backed(id, 'x.mp3')], HOME);
    assert.equal(back.tables.plays[0]!.track_id, id);
  });

  it('drops what was said about a song that is not here, and counts it', () => {
    const { tables: out, dropped } = remapTables(
      tables({
        track_tags: [tag('2', 'rock', 0)],
        track_lyrics: [lyric('2', 'la', 3)],
        playlists: [list(1, 'Mine')],
        playlist_tracks: [entry(1, '1', 0), entry(1, '2', 1), entry(99, '1', 0)],
      }),
      to,
      tracks,
      HOME
    );
    assert.equal(out.track_tags.length + out.track_lyrics.length, 0);
    assert.deepEqual(out.playlist_tracks.map((row) => row.track_id), ['501']);
    assert.equal(dropped, 4, 'a tag, a lyric, an entry for a missing song and one for a missing list');
  });

  it('points pictures at this phone and at nothing else', () => {
    const { tables: out } = remapTables(
      tables({
        track_metadata: [
          details('1', 'matched', 1, { artwork_url: 'file:///data/user/0/other/files/album-artwork/abc.jpg' }),
        ],
        playlists: [
          list(1, 'web', { cover_uri: 'https://example.test/c.jpg' }),
          list(2, 'insecure', { cover_uri: 'http://example.test/c.jpg' }),
          list(3, 'reaching', { cover_uri: 'file:///data/data/another.app/secrets.db', cover_track_id: '2' }),
        ],
      }),
      to,
      tracks,
      HOME
    );
    assert.equal(out.track_metadata[0]!.artwork_url, `${HOME}abc.jpg`);
    assert.deepEqual(
      out.playlists.map((row) => row.cover_uri),
      ['https://example.test/c.jpg', null, null]
    );
    assert.equal(out.playlists[2]!.cover_track_id, null, 'a cover taken from a song that is not here');
  });

  it('only ever takes a bare file name out of a picture reference', () => {
    assert.equal(artworkName('file:///x/album-artwork/ab12.jpg'), 'ab12.jpg');
    assert.equal(artworkName('file:///x/album-artwork/../../databases/jukebox.db'), null);
    // Not caught by refusing a leading dot: the way out is further along.
    assert.equal(artworkName('file:///x/album-artwork/covers/../../databases/jukebox.db'), null);
    // Whatever is handed in, what comes out is nothing or a name with no path
    // in it -- which is the whole of what makes it safe to append to a folder.
    for (const hostile of [
      'file:///x/album-artwork/a.jpg?x=/album-artwork/b.jpg',
      'file:///x/album-artwork/a/b.jpg',
      'file:///x/album-artwork/a%2F..%2Fb.jpg',
      'file:///x/album-artwork/a.jpg\n/etc/passwd',
      'file:///x/album-artwork/',
      'content://media/external/album-artwork/a.jpg',
    ]) {
      const name = artworkName(hostile);
      assert.ok(name === null || /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name), `${hostile} gave ${name}`);
    }
    assert.equal(artworkName('file:///x/album-artwork/.hidden'), null);
    assert.equal(artworkName('file:///x/elsewhere/ab12.jpg'), null);
    assert.deepEqual(
      referencedArtwork(tables({ playlists: [list(1, 'a', { cover_uri: `${HOME}b.jpg` })], track_metadata: [details('1', 'matched', 1, { artwork_url: `${HOME}a.jpg` })] })),
      ['a.jpg', 'b.jpg']
    );
  });

  it('makes one row of two that turn out to be the same song', () => {
    const both = new Map([['1', '501'], ['2', '501']]);
    const { tables: out } = remapTables(
      tables({
        plays: [play('1', 10), play('2', 20)],
        track_metadata: [details('1', 'matched', 5), details('2', 'manual', 1)],
        track_tags: [tag('1', 'rock', 0), tag('2', 'rock', 0), tag('2', 'live', 1)],
      }),
      both,
      tracks,
      HOME
    );
    assert.equal(out.plays.length, 2, 'both halves of the history are kept');
    assert.deepEqual(out.track_metadata.map((row) => row.status), ['manual']);
    assert.deepEqual(out.track_tags.map((row) => [row.tag, row.position]), [['rock', 0], ['live', 1]]);
  });
});

describe('merging a backup into what is here', () => {
  const full = tables({
    plays: [play('1', 10), play('2', 20)],
    skips: [{ track_id: '1', title: 's', artist: null, started_at: 15, seconds_played: 4, duration_sec: 200 }],
    track_metadata: [details('1', 'manual', 5), details('2', 'matched', 6)],
    track_tags: [tag('1', 'rock', 0), tag('1', 'live', 1)],
    track_lyrics: [lyric('1', 'la la', 7)],
    lyric_translations: [{ track_id: '1', target: 'en', source: 'tr', lines: '[]', translated_at: 8 }],
    playlists: [list(1, 'Mine'), list(2, 'rock', { tag: 'rock' })],
    playlist_tracks: [entry(1, '1', 0), entry(1, '2', 1)],
  });

  it('changes nothing when the backup is the phone it is merged into', () => {
    assert.deepEqual(mergeTables(full, full), full);
  });

  it('adds listens together and counts each once', () => {
    const merged = mergeTables(tables({ plays: [play('1', 10), play('1', 30)] }), tables({ plays: [play('1', 10), play('1', 20)] }));
    assert.deepEqual(merged.plays.map((row) => row.started_at), [10, 20, 30]);
  });

  it('does not count a listen twice because its song has gone or moved since', () => {
    // The phone as it stands: song 1 is where it was, song 2 has been deleted,
    // and song 3 was moved and is now known as 9.
    const here = tables({
      plays: [play('1', 10), play('2', 20), play('3', 30), play('9', 40, { filename: '3.mp3' })],
      skips: [{ track_id: '2', title: 's', artist: null, started_at: 25, seconds_played: 4, duration_sec: 200 }],
    });
    const described = [backed('1', '1.mp3'), backed('2', '2.mp3'), backed('3', '3.mp3'), backed('9', '3.mp3')];
    const to = matchTracks(described, [local('1', '1.mp3'), local('9', '3.mp3')]);
    const { tables: incoming } = remapTables(here, to, described, HOME);

    // Which is to say the import really does file them under other ids.
    assert.match(incoming.plays[1]!.track_id as string, /^absent:/);
    assert.equal(incoming.plays[2]!.track_id, '9');

    assert.deepEqual(mergeTables(here, incoming), here);
  });

  it('keeps two listens that are here at one moment, and takes only the extra from a backup', () => {
    const twice = tables({ plays: [play('1', 10), play('2', 10)] });
    assert.equal(mergeTables(twice, twice).plays.length, 2);
    assert.equal(mergeTables(tables({ plays: [play('1', 10)] }), twice).plays.length, 2);
    assert.equal(mergeTables(twice, tables({ plays: [play('3', 10)] })).plays.length, 2);
  });

  it('believes a hand over a catalogue, and a catalogue over nothing', () => {
    const pick = (here: Row, there: Row) =>
      mergeTables(tables({ track_metadata: [here] }), tables({ track_metadata: [there] })).track_metadata[0]!;
    assert.equal(pick(details('1', 'matched', 9), details('1', 'manual', 1)).status, 'manual');
    assert.equal(pick(details('1', 'manual', 1), details('1', 'matched', 9)).status, 'manual');
    assert.equal(pick(details('1', 'not_found', 9), details('1', 'matched', 1)).status, 'matched');
    assert.equal(pick(details('1', 'matched', 1), details('1', 'matched', 9)).fetched_at, 9, 'the newer of two equals');
    assert.equal(
      pick(details('1', 'matched', 5, { title: 'here' }), details('1', 'matched', 5, { title: 'there' })).title,
      'here',
      'and what is here on a dead heat'
    );
  });

  it('keeps corrected lyrics, then lyrics that have words, then the newer', () => {
    const pick = (here: Row, there: Row) =>
      mergeTables(tables({ track_lyrics: [here] }), tables({ track_lyrics: [there] })).track_lyrics[0]!;
    assert.equal(pick(lyric('1', 'new', 9), lyric('1', 'mine', 1, 'manual')).plain, 'mine');
    assert.equal(pick(lyric('1', null, 9), lyric('1', 'words', 1)).plain, 'words');
    assert.equal(pick(lyric('1', 'old', 1), lyric('1', 'new', 9)).plain, 'new');
  });

  it('puts new tags after the ones a song already has, without rearranging those', () => {
    const merged = mergeTables(
      tables({ track_tags: [tag('1', 'rock', 0), tag('1', 'live', 1)] }),
      tables({ track_tags: [tag('1', 'metal', 0), tag('1', 'rock', 1), tag('2', 'pop', 0)] })
    );
    const of = (id: string) => merged.track_tags.filter((row) => row.track_id === id).map((row) => [row.tag, row.position]);
    assert.deepEqual(of('1'), [['rock', 0], ['live', 1], ['metal', 2]]);
    assert.deepEqual(of('2'), [['pop', 0]]);
  });

  it('pours a list into the list of the same name and kind', () => {
    const merged = mergeTables(
      tables({ playlists: [list(4, 'Mine', { cover_uri: `${HOME}mine.jpg` })], playlist_tracks: [entry(4, '1', 0)] }),
      tables({
        playlists: [list(1, ' mine ', { cover_uri: `${HOME}theirs.jpg`, updated_at: 50 })],
        playlist_tracks: [entry(1, '2', 0), entry(1, '1', 1)],
      })
    );
    assert.equal(merged.playlists.length, 1);
    assert.equal(merged.playlists[0]!.id, 4);
    assert.equal(merged.playlists[0]!.cover_uri, `${HOME}mine.jpg`, 'the cover chosen here stays');
    assert.equal(merged.playlists[0]!.updated_at, 50);
    assert.deepEqual(merged.playlist_tracks.map((row) => [row.playlist_id, row.track_id, row.position]), [
      [4, '1', 0],
      [4, '2', 1],
    ]);
  });

  it('adds a list that has no namesake, under a number that is free', () => {
    const merged = mergeTables(
      tables({ playlists: [list(4, 'Mine')], playlist_tracks: [entry(4, '1', 0)] }),
      tables({ playlists: [list(4, 'Theirs')], playlist_tracks: [entry(4, '2', 0)] })
    );
    assert.deepEqual(merged.playlists.map((row) => [row.id, row.name]), [[4, 'Mine'], [5, 'Theirs']]);
    assert.deepEqual(merged.playlist_tracks.map((row) => [row.playlist_id, row.track_id]), [[4, '1'], [5, '2']]);
  });

  it('does not mistake a list that follows a tag for a plain one of the same name', () => {
    const merged = mergeTables(tables({ playlists: [list(1, 'rock')] }), tables({ playlists: [list(1, 'rock', { tag: 'rock' })] }));
    assert.equal(merged.playlists.length, 2);
  });

  it('gives a list here at most one list from the backup', () => {
    const merged = mergeTables(
      tables({ playlists: [list(1, 'Mix')] }),
      tables({ playlists: [list(7, 'Mix'), list(8, 'Mix')], playlist_tracks: [entry(7, '1', 0), entry(8, '2', 0)] })
    );
    assert.equal(merged.playlists.length, 2, 'two lists of one name in the backup are two lists');
    assert.deepEqual(merged.playlist_tracks.map((row) => [row.playlist_id, row.track_id]), [[1, '1'], [2, '2']]);
  });

  it('says what a backup holds and how much of it can be placed', () => {
    const summary = summarise(full, new Map([['1', '501']]));
    assert.deepEqual(summary, { songs: 2, found: 1, listens: 2, lists: 2, tagged: 1, lyrics: 1 });
  });
});

describe('the database, there and back', () => {
  function open(): { raw: DatabaseSync; database: BackupDb } {
    const raw = new DatabaseSync(':memory:');
    const target: MigrationTarget = Object.assign(raw, {
      execSync: (sql: string) => raw.exec(sql),
      getFirstSync: <T,>(sql: string) => (raw.prepare(sql).get() as T) ?? null,
    });
    migrate(target);
    const database: BackupDb = {
      // Spread, because SQLite hands rows back without a prototype and a row
      // that is equal in every column would otherwise compare as different.
      all: <T,>(sql: string, ...params: (string | number | null)[]) =>
        raw.prepare(sql).all(...params).map((row) => ({ ...row })) as T[],
      run: (sql, ...params) => {
        raw.prepare(sql).run(...params);
      },
      transaction: (work) => {
        raw.exec('BEGIN');
        try {
          work();
          raw.exec('COMMIT');
        } catch (error) {
          raw.exec('ROLLBACK');
          throw error;
        }
      },
    };
    return { raw, database };
  }

  const everything = tables({
    plays: [play('1', 10), play('2', 20, { artist: null, filename: null })],
    skips: [{ track_id: '1', title: 's', artist: null, started_at: 15, seconds_played: 4.5, duration_sec: 200 }],
    track_metadata: [details('1', 'manual', 5, { year: 1999, artwork_url: `${HOME}a.jpg`, track_number: 3 })],
    track_tags: [tag('1', 'rock', 0, 'manual'), tag('1', 'live', 1)],
    track_lyrics: [{ ...lyric('1', 'la la', 7, 'manual'), synced: '[00:01.00]la', offset_ms: -250 }],
    lyric_translations: [{ track_id: '1', target: 'en', source: 'tr', lines: '["x"]', translated_at: 8 }],
    playlists: [list(3, 'Mine', { cover_track_id: '1' }), list(9, 'rock', { tag: 'rock', cover_uri: `${HOME}c.jpg` })],
    playlist_tracks: [entry(3, '1', 0), entry(3, '2', 1)],
  });

  it('gives back exactly what was put in', () => {
    const { database } = open();
    assert.equal(holdsAnything(database), false);
    restore(database, everything, { 'player:repeat': 'all' }, 'replace');
    assert.equal(holdsAnything(database), true);
    assert.deepEqual(readTables(database), everything);
    assert.deepEqual(readSettings(database), { 'player:repeat': 'all' });
  });

  it('survives the whole trip through a file', () => {
    const { database } = open();
    restore(database, everything, { 'player:repeat': 'all' }, 'replace');
    const file = JSON.stringify({
      format: BACKUP_FORMAT,
      app: 'test',
      exportedAt: 1,
      tracks: [],
      settings: readSettings(database),
      sound: {},
      tables: readTables(database),
    });
    const back = parseBackup(file);

    const elsewhere = open().database;
    restore(elsewhere, back.tables, back.settings, 'replace');
    assert.deepEqual(readTables(elsewhere), everything);
  });

  it('replaces what was there rather than adding to it', () => {
    const { database } = open();
    restore(database, everything, {}, 'replace');
    restore(database, tables({ plays: [play('5', 99)] }), {}, 'replace');
    const now = readTables(database);
    assert.deepEqual(now.plays, [play('5', 99)]);
    assert.equal(now.playlists.length + now.track_tags.length + now.track_lyrics.length, 0);
  });

  it('takes the settings of a backup that replaces, except where the music is', () => {
    const { raw, database } = open();
    raw.exec(`INSERT INTO settings (key, value) VALUES
      ('library:root', 'Music/Here'), ('player:repeat', 'one'), ('stats:period', 'week'),
      ('youtube:playlist-imports:v1', '[{"playlistId":3}]')`);
    restore(database, emptyTables(), { 'player:repeat': 'all', 'library:root': 'Music/There' }, 'replace');
    const all = Object.fromEntries(
      database.all<{ key: string; value: string }>('SELECT key, value FROM settings').map((row) => [row.key, row.value])
    );
    assert.deepEqual(all, { 'library:root': 'Music/Here', 'player:repeat': 'all' });
  });

  it('keeps the settings of the phone when merging, and adds only what it lacked', () => {
    const { raw, database } = open();
    raw.exec(`INSERT INTO settings (key, value) VALUES ('player:repeat', 'one'), ('youtube:playlist-imports:v1', '[]')`);
    restore(database, emptyTables(), { 'player:repeat': 'all', 'stats:period': 'year' }, 'merge');
    const all = Object.fromEntries(
      database.all<{ key: string; value: string }>('SELECT key, value FROM settings').map((row) => [row.key, row.value])
    );
    assert.deepEqual(all, { 'player:repeat': 'one', 'stats:period': 'year', 'youtube:playlist-imports:v1': '[]' });
  });

  /*
    The token is a password in all but name. It must not be in the file, which
    is the kind of thing that gets sent to people; and a file must not be able
    to put one on a phone, or sign a phone out of the one it has.
  */
  const CONNECTION = `('listenbrainz:token', 'secret-token'), ('listenbrainz:user', 'kayra'),
    ('listenbrainz:sending', 'true'), ('listenbrainz:since', '1000')`;
  const connection = {
    'listenbrainz:token': 'secret-token',
    'listenbrainz:user': 'kayra',
    'listenbrainz:sending': 'true',
    'listenbrainz:since': '1000',
  };
  const hostile = {
    'listenbrainz:token': 'from-the-file',
    'listenbrainz:user': 'somebody-else',
    'listenbrainz:sending': 'false',
  };
  const settingsOf = (database: BackupDb) =>
    Object.fromEntries(
      database.all<{ key: string; value: string }>('SELECT key, value FROM settings').map((row) => [row.key, row.value])
    );

  it('writes nothing about ListenBrainz into a backup, the token least of all', () => {
    const { raw, database } = open();
    raw.exec(`INSERT INTO settings (key, value) VALUES ('player:repeat', 'one'), ${CONNECTION}`);
    const settings = readSettings(database);
    assert.deepEqual(settings, { 'player:repeat': 'one' });
    const file = JSON.stringify({ settings, tables: readTables(database) });
    assert.equal(file.includes('secret-token'), false);
    assert.equal(file.includes('listenbrainz'), false);
  });

  it('leaves the connection as it was when a backup replaces everything else', () => {
    const { raw, database } = open();
    raw.exec(`INSERT INTO settings (key, value) VALUES ('player:repeat', 'one'), ${CONNECTION}`);
    restore(database, emptyTables(), { 'player:repeat': 'all', ...hostile }, 'replace');
    assert.deepEqual(settingsOf(database), { 'player:repeat': 'all', ...connection });
  });

  it('leaves the connection as it was when merging, and makes none where there was none', () => {
    const { raw, database } = open();
    raw.exec(`INSERT INTO settings (key, value) VALUES ${CONNECTION}`);
    restore(database, emptyTables(), hostile, 'merge');
    assert.deepEqual(settingsOf(database), connection);

    for (const mode of ['merge', 'replace'] as const) {
      const fresh = open().database;
      restore(fresh, emptyTables(), hostile, mode);
      assert.deepEqual(settingsOf(fresh), {}, mode);
    }
  });

  it('forgets which listens were sent, since a restore numbers them all again', () => {
    for (const mode of ['merge', 'replace'] as const) {
      const { raw, database } = open();
      restore(database, tables({ plays: [play('1', 10), play('2', 20)] }), {}, 'replace');
      raw.exec(`INSERT INTO listenbrainz_listens (play_id, state, at) VALUES (1, 'sent', 5), (2, 'queued', 5)`);
      restore(database, tables({ plays: [play('0', 1), play('1', 10), play('2', 20)] }), {}, mode);
      assert.deepEqual(database.all('SELECT * FROM listenbrainz_listens'), [], mode);
    }
  });

  it('leaves the database as it was if any of it cannot be written', () => {
    const { database } = open();
    restore(database, everything, { 'player:repeat': 'all' }, 'replace');
    // The last table written, with a row the schema will refuse.
    const broken = tables({
      plays: [play('5', 99)],
      playlist_tracks: [{ playlist_id: 1, track_id: null, position: 0, added_at: 1 }],
    });
    assert.throws(() => restore(database, broken, { 'player:repeat': 'off' }, 'replace'));
    assert.deepEqual(readTables(database), everything);
    assert.deepEqual(readSettings(database), { 'player:repeat': 'all' });
  });

  it('merges a backup into the phone it came from without changing anything', () => {
    const { database } = open();
    restore(database, everything, {}, 'replace');
    const merged = mergeTables(readTables(database), readTables(database));
    restore(database, merged, {}, 'merge');
    assert.deepEqual(readTables(database), everything);
  });
});
