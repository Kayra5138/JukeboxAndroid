import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  absentId,
  momentOf,
  planImport,
  readHistory,
  type ForeignListen,
  type LibrarySong,
} from '../import.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const APRIL_FIRST_1345 = Date.UTC(2023, 3, 1, 13, 45);

const song = (id: string, title: string, artist: string | null, extra: Partial<LibrarySong> = {}): LibrarySong => ({
  id,
  title,
  artist,
  album: null,
  durationSec: 240,
  filename: `${title}.mp3`,
  ...extra,
});

const listen = (title: string, artist: string | null, startedAt: number, extra: Partial<ForeignListen> = {}): ForeignListen => ({
  title,
  artist,
  album: null,
  startedAt,
  secondsPlayed: null,
  completed: true,
  source: 'lastfm',
  ...extra,
});

describe('reading a moment', () => {
  it('reads every way the services write one, as UTC', () => {
    assert.equal(momentOf('01 Apr 2023 13:45'), APRIL_FIRST_1345);
    assert.equal(momentOf('01 Apr 2023, 13:45'), APRIL_FIRST_1345);
    assert.equal(momentOf('2023-04-01 13:45'), APRIL_FIRST_1345);
    assert.equal(momentOf('2023-04-01T13:45:00Z'), APRIL_FIRST_1345);
    assert.equal(momentOf('2023-04-01T16:45:00+03:00'), APRIL_FIRST_1345);
    assert.equal(momentOf('2023-04-01T13:45:00.500Z'), APRIL_FIRST_1345 + 500);
    assert.equal(momentOf(1680356700), APRIL_FIRST_1345);
    assert.equal(momentOf('1680356700'), APRIL_FIRST_1345);
    assert.equal(momentOf(1680356700000), APRIL_FIRST_1345);
  });

  it('takes nothing it cannot read for a moment', () => {
    assert.equal(momentOf(''), null);
    assert.equal(momentOf('yesterday'), null);
    assert.equal(momentOf('01 Foo 2023 13:45'), null);
    assert.equal(momentOf(0), null);
    assert.equal(momentOf(null), null);
  });
});

describe('reading a history', () => {
  it('reads a Last.fm export with no heading, leaving out the song still playing', () => {
    const listens = readHistory(fixture('lastfm.csv'))!;
    assert.equal(listens.length, 3);
    assert.deepEqual(listens[0], {
      title: 'Paranoid Android',
      artist: 'Radiohead',
      album: 'OK Computer',
      startedAt: APRIL_FIRST_1345,
      secondsPlayed: null,
      completed: true,
      source: 'lastfm',
    });
    assert.equal(listens[1]!.artist, 'Simon & Garfunkel');
    assert.equal(listens[1]!.title, 'The Boxer, Live', 'a quoted comma is part of the cell');
    assert.equal(listens[2]!.startedAt, Date.UTC(2023, 2, 30, 22, 10));
  });

  it('reads a Last.fm export with a heading by the names of its columns', () => {
    const listens = readHistory(fixture('lastfm-headed.csv'))!;
    assert.deepEqual(
      listens.map((each) => [each.artist, each.album, each.title, each.startedAt]),
      [
        ['Radiohead', 'OK Computer', 'Paranoid Android', APRIL_FIRST_1345],
        ['Sezen Aksu', 'Gülümse', 'Hadi Bakalım', Date.UTC(2023, 2, 31, 9, 2)],
      ]
    );
  });

  it('reads Spotify’s history, beginning each listen as long before its end as it ran', () => {
    const listens = readHistory(fixture('StreamingHistory_music_0.json'))!;
    assert.equal(listens.length, 3);
    assert.deepEqual(listens[0], {
      title: 'Paranoid Android',
      artist: 'Radiohead',
      album: null,
      startedAt: Date.UTC(2023, 3, 1, 13, 52) - 383000,
      secondsPlayed: 383,
      completed: null,
      source: 'spotify',
    });
  });

  it('reads Spotify’s extended history, with what it says of skips, and without the podcasts', () => {
    const listens = readHistory(fixture('Streaming_History_Audio_2023.json'))!;
    assert.deepEqual(
      listens.map((each) => [each.title, each.album, each.completed, each.secondsPlayed]),
      [
        ['Paranoid Android', 'OK Computer', true, 383],
        ['Karma Police', 'OK Computer', false, 95],
      ]
    );
    assert.equal(listens[0]!.startedAt, Date.UTC(2023, 3, 1, 13, 52, 23) - 383000);
  });

  it('reads a ListenBrainz export, as a list and as a file of one listen a line', () => {
    const list = readHistory(fixture('listenbrainz.json'))!;
    assert.deepEqual(
      list.map((each) => [each.artist, each.title, each.startedAt, each.secondsPlayed, each.source]),
      [
        ['Radiohead', 'Paranoid Android', APRIL_FIRST_1345, 383, 'listenbrainz'],
        ['Céline Dion', 'My Heart Will Go On', Date.UTC(2023, 2, 31, 9, 2), null, 'listenbrainz'],
      ]
    );
    const lines = readHistory(fixture('listens-4.jsonl'))!;
    assert.deepEqual(lines.map((each) => each.title), ['Paranoid Android', 'Numb']);
  });

  it('reads a ListenBrainz answer with its listens inside it, and a mark at the start of the file', () => {
    const answer = JSON.stringify({
      payload: { listens: [{ listened_at: 1680356700, track_metadata: { artist_name: 'A', track_name: 'B' } }] },
    });
    assert.equal(readHistory(`﻿${answer}`)!.length, 1);
  });

  it('says a file is not a history when it is something else', () => {
    assert.equal(readHistory('{"settings": true}'), null);
    assert.equal(readHistory('[{"name": "a playlist"}]'), null);
    assert.equal(readHistory('#EXTM3U\nsong.mp3\n'), null);
    assert.equal(readHistory('name,size\nphoto.jpg,12\n'), null);
    assert.equal(readHistory('[{"broken"'), null);
  });

  it('says a history with nothing in it to bring is empty, not something else', () => {
    const podcasts = JSON.stringify([{ endTime: '2023-04-01 13:52', podcastName: 'A show', episodeName: 'One', msPlayed: 900000 }]);
    assert.deepEqual(readHistory(podcasts), []);
  });
});

describe('planning an import', () => {
  const library = [
    song('10', 'Paranoid Android', 'Radiohead', { album: 'OK Computer', durationSec: 383 }),
    song('20', 'Numb', 'Linkin Park', { durationSec: 185 }),
    song('30', 'Hadi Bakalim', 'Sezen Aksu'),
  ];

  it('puts each listen on its song in the library, by artist and title folded', () => {
    const plan = planImport(
      [
        listen('PARANOID ANDROID', 'radiohead', 1_000_000),
        listen('Hadi Bakalım', 'Sezen Aksu', 2_000_000),
        listen('Numb (2011 Remaster)', 'Linkin Park feat. Somebody', 3_000_000),
      ],
      library,
      []
    );
    assert.deepEqual(plan.rows.map((row) => row.track_id), ['10', '30', '20']);
    assert.equal(plan.matched, 3);
    assert.equal(plan.songs, 3);
    // A scrobble's length is the song's, and its file is the song's file.
    assert.equal(plan.rows[0]!.seconds_played, 383);
    assert.equal(plan.rows[0]!.filename, 'Paranoid Android.mp3');
    assert.equal(plan.rows[0]!.title, 'PARANOID ANDROID', 'the listen keeps the name it was heard under');
  });

  it('keeps a listen of a song that is not here, under an id made from its name', () => {
    const plan = planImport(
      [listen('Unknown Song', 'Nobody', 1_000_000), listen('unknown song', 'NOBODY', 5_000_000)],
      library,
      []
    );
    assert.equal(plan.rows.length, 2);
    assert.match(plan.rows[0]!.track_id, /^absent:[0-9a-f]{8}$/);
    assert.equal(plan.rows[0]!.track_id, plan.rows[1]!.track_id, 'one song, however it is written');
    assert.equal(plan.rows[0]!.track_id, absentId('Unknown Song', 'Nobody'));
    assert.equal(plan.rows[0]!.filename, null);
    assert.equal(plan.rows[0]!.seconds_played, 0, 'nothing is guessed for a song with no length');
    assert.equal(plan.matched, 0);
  });

  it('chooses between two copies of a song by the album, and then by id', () => {
    const copies = [
      song('7', 'Song', 'Band', { album: 'Best Of' }),
      song('5', 'Song', 'Band', { album: 'Debut' }),
      song('6', 'Song', 'Band', { album: 'Live' }),
    ];
    const plan = planImport(
      [listen('Song', 'Band', 1_000_000, { album: 'debut' }), listen('Song', 'Band', 2_000_000)],
      copies,
      []
    );
    assert.deepEqual(plan.rows.map((row) => row.track_id), ['5', '5']);
    assert.equal(plan.songs, 1);
  });

  it('leaves out listens shorter than half a minute', () => {
    const plan = planImport(
      [listen('Numb', 'Linkin Park', 1_000_000, { secondsPlayed: 29.9, source: 'spotify' }), listen('Numb', 'Linkin Park', 2_000_000, { secondsPlayed: 30, completed: null })],
      library,
      []
    );
    assert.equal(plan.found, 2);
    assert.equal(plan.short, 1);
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0]!.completed, 0, 'thirty seconds of a three-minute song is not heard through');
  });

  it('adds nothing the history already has, nor anything twice', () => {
    const at = APRIL_FIRST_1345;
    const listens = [listen('Numb', 'Linkin Park', at), listen('numb', 'linkin park', at + 400), listen('Numb', 'Linkin Park', at + 60_000)];
    const plan = planImport(listens, library, [{ startedAt: at + 999, title: 'Numb', artist: 'Linkin Park' }]);
    assert.equal(plan.already, 2);
    assert.deepEqual(plan.rows.map((row) => row.started_at), [at + 60_000]);

    // The same file a second time, with the first time's rows now held.
    const again = planImport(
      listens,
      library,
      [{ startedAt: at, title: 'Numb', artist: 'Linkin Park' }, ...plan.rows.map((row) => ({ startedAt: row.started_at, title: row.title, artist: row.artist }))]
    );
    assert.equal(again.rows.length, 0);
  });

  it('says what it found, oldest first', () => {
    const files = [fixture('lastfm.csv'), fixture('StreamingHistory_music_0.json')].flatMap((each) => readHistory(each)!);
    const plan = planImport(files, library, []);
    assert.equal(plan.found, 6);
    assert.equal(plan.short, 1);
    assert.equal(plan.rows.length, 5);
    assert.equal(plan.from, Date.UTC(2023, 2, 30, 22, 10));
    assert.equal(plan.until, Date.UTC(2023, 3, 2, 8, 0) - 61000);
    assert.deepEqual(
      plan.rows.map((row) => row.started_at),
      [...plan.rows.map((row) => row.started_at)].sort((a, b) => a - b)
    );
    assert.deepEqual(new Set(plan.rows.map((row) => row.source)), new Set(['lastfm', 'spotify']));
    // Paranoid Android twice, from the two services, and Numb.
    assert.equal(plan.matched, 3);
    assert.equal(plan.songs, 2);
  });
});
