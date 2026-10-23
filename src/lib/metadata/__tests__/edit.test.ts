import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fieldsOf, fieldsSet, manualEntry, sharedEditEntry, sharedFields, sharedPlaceholder } from '../edit.ts';
import { mergeMetadata } from '../../media/enriched.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import { track } from './support.ts';

/**
 * Many tracks put right at once. What matters is what each track ends up
 * saying: what was typed, where something was, and its own word everywhere
 * else — so that fixing the artist of a hundred tracks fixes the artist and
 * nothing besides.
 */

const looked = (trackId: string, changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'matched', source: 'itunes', title: 'Looked-up title', artist: 'Looked-up artist',
  album: 'Looked-up album', genre: 'rock', year: 1999, artworkUrl: 'file:///covers/a.jpg',
  trackNumber: 4, discNumber: 2, ...changes,
});

describe('a shared edit', () => {
  it('sets what was typed and keeps what each track already showed', () => {
    const song = track({ id: 'a', title: 'File title', artist: null, album: 'File album', trackNumber: 7 });
    const entry = sharedEditEntry(song, looked('a'), { artist: '  Aimer ', album: '', year: '' }, 'j-pop');

    assert.equal(entry?.status, 'manual');
    assert.equal(entry?.source, 'manual');
    assert.equal(entry?.artist, 'Aimer');
    // Its own, as the details screen would have shown them: the file's name, which the lookup's is not a cleaner copy of.
    assert.equal(entry?.title, 'File title');
    assert.equal(entry?.album, 'Looked-up album');
    assert.equal(entry?.year, 1999);
    assert.equal(entry?.trackNumber, 4);
    assert.equal(entry?.discNumber, 2);
    // The cover goes on as it was, and the genre is the first tag.
    assert.equal(entry?.artworkUrl, 'file:///covers/a.jpg');
    assert.equal(entry?.genre, 'j-pop');
  });

  it('starts from the file for a track nobody could name or nobody looked up', () => {
    const song = track({ id: 'b', title: 'File title', artist: null, album: null, trackNumber: 3 });
    for (const kept of [null, { ...looked('b'), status: 'not_found' as const, title: null, artist: null, artworkUrl: null }]) {
      const entry = sharedEditEntry(song, kept, { artist: 'Kalafina', year: '2009' }, null);
      assert.equal(entry?.title, 'File title');
      assert.equal(entry?.artist, 'Kalafina');
      assert.equal(entry?.album, null);
      assert.equal(entry?.year, 2009);
      assert.equal(entry?.trackNumber, 3);
      assert.equal(entry?.artworkUrl, null);
    }
  });

  it('keeps a cover taken off by hand off', () => {
    const song = track({ id: 'c', title: 'T' });
    const entry = sharedEditEntry(song, looked('c', { artworkUrl: null, coverRemovedAt: 42 }), { album: 'X' }, null);
    assert.equal(entry?.coverRemovedAt, 42);
    assert.equal(entry?.artworkUrl, null);
  });

  it('keeps the genre a row had when the track has no tags', () => {
    const entry = sharedEditEntry(track({ id: 'd', title: 'T' }), looked('d'), { year: '2001' }, null);
    assert.equal(entry?.genre, 'rock');
  });

  it('sets an album artist on every track, and leaves the file’s where none is typed', () => {
    const song = { ...track({ id: 'e', title: 'T', album: 'Ruins' }), albumArtist: 'Various Artists' };
    assert.equal(sharedEditEntry(song, null, { albumArtist: 'Someone' }, null)?.albumArtist, 'Someone');
    assert.equal(sharedEditEntry(song, null, { artist: 'Someone' }, null)?.albumArtist, 'Various Artists');
  });

  it('is nothing at all when nothing was typed', () => {
    assert.equal(sharedEditEntry(track({ id: 'f', title: 'T' }), null, { artist: '  ', year: '' }, null), null);
    assert.deepEqual(fieldsSet({ year: '1990', artist: '', album: ' A ' }), ['album', 'year']);
  });
});

/** A track as the library shows it once [row] is saved over it. */
const shownWith = (song: ReturnType<typeof track>, row: TrackMetadata) =>
  mergeMetadata([song], { readAllMetadata: () => new Map([[row.trackId, row]]), allTags: () => new Map() })[0]!;

describe('a field cleared on every track', () => {
  const song = {
    ...track({ id: 'g', title: 'T', artist: 'File artist', album: 'File album' }),
    albumArtist: 'File album artist',
  };
  const wrong = looked('g', { status: 'manual', source: 'manual', artist: 'Wrong', album: 'Wrong', albumArtist: 'Wrong' });

  it('takes the album away, whatever the file says', () => {
    const entry = sharedEditEntry(song, wrong, { cleared: ['album'] }, null)!;
    assert.equal(entry.album, '');
    assert.equal(shownWith(song, entry).album, null);
    // Nothing else moves.
    assert.equal(entry.artist, 'Wrong');
    assert.equal(entry.year, 1999);
  });

  it('takes the album artist away, whatever the file says', () => {
    const entry = sharedEditEntry(song, wrong, { cleared: ['albumArtist'] }, null)!;
    assert.equal(shownWith(song, entry).albumArtist, null);
    assert.equal(shownWith(song, entry).album, 'Wrong');
  });

  it('takes the year away', () => {
    const entry = sharedEditEntry(song, wrong, { cleared: ['year'] }, null)!;
    assert.equal(entry.year, null);
    assert.equal(shownWith(song, entry).year, null);
  });

  it('gives the artist back to each file, and to nobody where the file names nobody', () => {
    const entry = sharedEditEntry(song, wrong, { cleared: ['artist'] }, null)!;
    assert.equal(entry.artist, null);
    assert.equal(shownWith(song, entry).artist, 'File artist');
    const nameless = track({ id: 'h', title: 'T', artist: null });
    const other = sharedEditEntry(nameless, { ...wrong, trackId: 'h' }, { cleared: ['artist'] }, null)!;
    assert.equal(shownWith(nameless, other).artist, null);
  });

  it('is cleared whatever was typed in its box, and counts as something to save', () => {
    const entry = sharedEditEntry(song, wrong, { album: 'Typed', cleared: ['album'] }, null)!;
    assert.equal(entry.album, '');
    assert.deepEqual(fieldsSet({ cleared: ['year'] }), ['year']);
    assert.deepEqual(fieldsSet({ year: '2001', cleared: ['artist'] }), ['artist', 'year']);
  });

  it('is no empty string where the file had nothing to take away', () => {
    const bare = track({ id: 'i', title: 'T', album: null });
    const entry = sharedEditEntry(bare, null, { cleared: ['album', 'albumArtist'] }, null)!;
    assert.equal(entry.album, null);
    assert.equal(entry.albumArtist, null);
  });

  it('stays cleared when the track is saved again from the details screen untouched', () => {
    const cleared = sharedEditEntry(song, wrong, { cleared: ['album', 'albumArtist', 'year'] }, null)!;
    const again = manualEntry(song, cleared, fieldsOf(song, cleared), null);
    const shown = shownWith(song, again);
    assert.equal(shown.album, null);
    assert.equal(shown.albumArtist, null);
    assert.equal(shown.year, null);
  });
});

describe('the details screen', () => {
  it('takes the record away when its box is emptied over a file that names one', () => {
    const song = track({ id: 'j', title: 'T', album: 'File album' });
    const entry = manualEntry(song, null, { ...fieldsOf(song, null), album: '  ' }, null);
    assert.equal(entry.album, '');
    assert.equal(shownWith(song, entry).album, null);
  });
});

describe('the boxes of a shared edit', () => {
  const words = { keepEach: 'Each keeps its own', empty: 'Empty' };
  const faint = (tracks: ReturnType<typeof track>[], rows = new Map<string, TrackMetadata>()) => {
    const shared = sharedFields(tracks, rows);
    return {
      artist: sharedPlaceholder(shared.artist, words),
      albumArtist: sharedPlaceholder(shared.albumArtist, words),
      album: sharedPlaceholder(shared.album, words),
      year: sharedPlaceholder(shared.year, words),
    };
  };

  it('say what the one track chosen has, and that it is empty where it has nothing', () => {
    const one = track({ id: 'a', title: 'T', artist: 'Aimer', album: 'Daydream', albumArtist: 'Aimer' });
    assert.deepEqual(faint([one]), { artist: 'Aimer', albumArtist: 'Aimer', album: 'Daydream', year: 'Empty' });
    const bare = track({ id: 'b', title: 'T', artist: 'Aimer', album: null });
    assert.deepEqual(faint([bare]), { artist: 'Aimer', albumArtist: 'Empty', album: 'Empty', year: 'Empty' });
  });

  it('say "each keeps its own" only where two or more tracks disagree', () => {
    const a = track({ id: 'a', title: 'A', artist: 'Aimer', album: 'Daydream' });
    const b = track({ id: 'b', title: 'B', artist: 'Aimer', album: 'Sun Dance' });
    const rows = new Map([['a', looked('a', { artist: null, album: null, year: 2016 })]]);
    const said = faint([a, b], rows);
    assert.equal(said.artist, 'Aimer');
    assert.equal(said.album, 'Each keeps its own');
    // One has a year and the other has none: they disagree.
    assert.equal(said.year, 'Each keeps its own');
  });

  it('say empty where every track has nothing, however many there are', () => {
    const a = track({ id: 'a', title: 'A', artist: 'Aimer', album: null });
    const b = track({ id: 'b', title: 'B', artist: 'Aimer', album: '  ' });
    const said = faint([a, b]);
    assert.equal(said.album, 'Empty');
    assert.equal(said.year, 'Empty');
  });
});
