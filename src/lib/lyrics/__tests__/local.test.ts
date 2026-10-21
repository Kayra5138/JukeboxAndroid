import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asLyrics,
  cleanText,
  embeddedLyrics,
  fromSylt,
  isTimedText,
  lrcOffsetMs,
  readFolders,
  settle,
  siblingFor,
  writeFolders,
  type LocalLyrics,
} from '../local.ts';

describe('cleanText', () => {
  it('makes every kind of line break one, and drops the mark at the front', () => {
    assert.equal(cleanText('﻿a\r\nb\rc\nd'), 'a\nb\nc\nd');
  });

  it('trims the ends of lines and of the whole, but keeps the gaps between verses', () => {
    assert.equal(cleanText('\n\nfirst  \n\nsecond\t\n\n'), 'first\n\nsecond');
  });
});

describe('isTimedText', () => {
  it('takes LRC with its headers as timed', () => {
    assert.equal(isTimedText('[ar:LiSA]\n[ti:Gurenge]\n[00:01.00]One\n[00:05.00]Two'), true);
  });

  it('takes the blank timed lines between verses as timed', () => {
    assert.equal(isTimedText('[00:01.00]One\n[00:04.00]\n[00:05.00]Two'), true);
  });

  it('does not take a verse with a note to the singer for a timed song', () => {
    assert.equal(isTimedText('[0:30] slowly\nThe first line\nThe second line\nThe third'), false);
  });

  it('does not take plain words, or headers alone, for timed', () => {
    assert.equal(isTimedText('Just words\nand more'), false);
    assert.equal(isTimedText('[ar:Somebody]\n[ti:Something]'), false);
  });
});

describe('lrcOffsetMs', () => {
  it('turns LRC’s offset round, since a positive one there means sooner', () => {
    assert.equal(lrcOffsetMs('[offset:+500]\n[00:01.00]a'), -500);
    assert.equal(lrcOffsetMs('[offset: -250]\n[00:01.00]a'), 250);
  });

  it('is nothing where there is no offset', () => {
    assert.equal(lrcOffsetMs('[00:01.00]a'), 0);
    assert.equal(lrcOffsetMs('[offset:0]'), 0);
  });
});

describe('asLyrics', () => {
  it('reads timed text as timed, cleaned', () => {
    assert.deepEqual(asLyrics('[00:01.00]One\r\n[00:02.00]Two\r\n'), {
      synced: '[00:01.00]One\n[00:02.00]Two',
      plain: null,
    });
  });

  it('drops the word-by-word timings the player does not follow', () => {
    assert.deepEqual(asLyrics('[00:01.00]<00:01.00>One <00:01.50>two'), {
      synced: '[00:01.00]One two',
      plain: null,
    });
  });

  it('reads anything else as plain, and nothing but space as nothing', () => {
    assert.deepEqual(asLyrics('Words\r\nMore words'), { synced: null, plain: 'Words\nMore words' });
    assert.equal(asLyrics(' \r\n\t'), null);
  });
});

describe('fromSylt', () => {
  it('writes a line to an entry as LRC, in time order', () => {
    assert.equal(
      fromSylt([
        { ms: 4250, text: 'Second' },
        { ms: 1500, text: 'First' },
        { ms: 61_005, text: 'After a minute' },
      ]),
      '[00:01.50]First\n[00:04.25]Second\n[01:01.01]After a minute'
    );
  });

  it('joins a karaoke tagger’s syllables back into lines', () => {
    assert.equal(
      fromSylt([
        { ms: 1000, text: 'Hel' },
        { ms: 1200, text: 'lo ' },
        { ms: 1500, text: 'there' },
        { ms: 3000, text: '\nSe' },
        { ms: 3300, text: 'cond' },
      ]),
      '[00:01.00]Hello there\n[00:03.00]Second'
    );
  });

  it('is nothing for a frame with no words', () => {
    assert.equal(fromSylt([{ ms: 0, text: '' }]), null);
    assert.equal(fromSylt([]), null);
  });
});

describe('embeddedLyrics', () => {
  it('prefers the timed frame, and keeps plain words beside it', () => {
    assert.deepEqual(
      embeddedLyrics(['sylt', '1500\tFirst', 'sylt', '4250\tSecond', 'text', 'First\nSecond']),
      { synced: '[00:01.50]First\n[00:04.25]Second', plain: 'First\nSecond' }
    );
  });

  it('takes a field of LRC as timed, whichever field it was in', () => {
    assert.deepEqual(embeddedLyrics(['text', 'Plain verse', 'text', '[00:01.00]Timed verse']), {
      synced: '[00:01.00]Timed verse',
      plain: 'Plain verse',
    });
  });

  it('takes the first of each kind', () => {
    assert.deepEqual(embeddedLyrics(['text', 'English words', 'text', 'Erste Zeile']), {
      synced: null,
      plain: 'English words',
    });
  });

  it('is nothing for a file with no words, or one that could not be read', () => {
    assert.equal(embeddedLyrics([]), null);
    assert.equal(embeddedLyrics(['text', '   ']), null);
    assert.equal(embeddedLyrics(null), null);
  });
});

describe('siblingFor', () => {
  const file = (name: string) => ({ name, uri: `content://${name}` });

  it('finds the .lrc with the song’s name', () => {
    assert.equal(siblingFor('Gurenge.mp3', [file('Other.lrc'), file('Gurenge.lrc')])?.name, 'Gurenge.lrc');
  });

  it('forgives case, but prefers an exact match', () => {
    assert.equal(siblingFor('Gurenge.flac', [file('GURENGE.LRC')])?.name, 'GURENGE.LRC');
    assert.equal(siblingFor('Gurenge.flac', [file('gurenge.lrc'), file('Gurenge.LRC')])?.name, 'Gurenge.LRC');
  });

  it('takes the name with the extension kept, after the usual one', () => {
    assert.equal(siblingFor('Song.mp3', [file('Song.mp3.lrc')])?.name, 'Song.mp3.lrc');
    assert.equal(siblingFor('Song.mp3', [file('Song.mp3.lrc'), file('Song.lrc')])?.name, 'Song.lrc');
  });

  it('takes a .txt of the same name only where there is no .lrc', () => {
    assert.equal(siblingFor('Song.mp3', [file('Song.txt')])?.name, 'Song.txt');
    assert.equal(siblingFor('Song.mp3', [file('Song.txt'), file('song.lrc')])?.name, 'song.lrc');
  });

  it('matches names however their accents were composed', () => {
    const decomposed = 'Café.lrc';
    assert.equal(siblingFor('Café.mp3', [file(decomposed)])?.name, decomposed);
  });

  it('finds nothing in a folder of other songs’ words', () => {
    assert.equal(siblingFor('Song.mp3', [file('Song 2.lrc'), file('notes.txt'), file('Song.jpg')]), null);
    assert.equal(siblingFor('Song.mp3', []), null);
  });
});

describe('settle', () => {
  const timed = { synced: '[00:01.00]a', plain: null };
  const other = { synced: '[00:01.00]b', plain: null };
  const inFile: LocalLyrics = { lyrics: timed, source: 'file' };

  it('never touches words somebody chose', () => {
    assert.deepEqual(settle({ lyrics: other, source: 'manual' }, inFile), { kind: 'keep' });
  });

  it('puts words found on the phone in place of a lookup’s', () => {
    assert.deepEqual(settle({ lyrics: other, source: 'lookup' }, inFile), { kind: 'write', found: inFile });
    assert.deepEqual(settle(null, inFile), { kind: 'write', found: inFile });
  });

  it('leaves the same words from the same place as they are', () => {
    assert.deepEqual(settle({ lyrics: timed, source: 'file' }, inFile), { kind: 'keep' });
  });

  it('writes the same words again when they are now found somewhere else', () => {
    const beside: LocalLyrics = { lyrics: timed, source: 'lrc' };
    assert.deepEqual(settle({ lyrics: timed, source: 'file' }, beside), { kind: 'write', found: beside });
  });

  it('forgets words from the phone that the phone no longer has', () => {
    assert.deepEqual(settle({ lyrics: timed, source: 'lrc' }, null), { kind: 'forget' });
    assert.deepEqual(settle({ lyrics: timed, source: 'file' }, null), { kind: 'forget' });
  });

  it('keeps a lookup, and asks only when nothing is known at all', () => {
    assert.deepEqual(settle({ lyrics: timed, source: 'lookup' }, null), { kind: 'keep' });
    assert.deepEqual(settle(null, null), { kind: 'ask' });
  });
});

describe('readFolders', () => {
  it('reads back what was written', () => {
    const folders = [{ uri: 'content://tree/primary%3AMusic', label: 'Music' }];
    assert.deepEqual(readFolders(writeFolders(folders)), folders);
  });

  it('takes anything else as no folders, and drops repeats and broken entries', () => {
    assert.deepEqual(readFolders(null), []);
    assert.deepEqual(readFolders('not json'), []);
    assert.deepEqual(readFolders('{"uri":"x"}'), []);
    assert.deepEqual(readFolders('[{"uri":"a","label":"A"},{"uri":"a","label":"B"},{"label":"C"},7,{"uri":"b"}]'), [
      { uri: 'a', label: 'A' },
      { uri: 'b', label: 'b' },
    ]);
  });
});
