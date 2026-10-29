import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bookLanguageOf, bookLanguagesFor, bookOf, bookQuery, durationOf, hitsOf, identifierOf } from '../archive.ts';

describe('a book from the Archive', () => {
  const item = {
    metadata: { title: 'The Adventures of Sherlock Holmes', creator: 'Sir Arthur Conan Doyle', description: '<a href="x">LibriVox</a> recording of <b>it</b>.' },
    files: [
      { name: 'holmes_02_doyle.mp3', format: 'VBR MP3', title: '02 - The Red-Headed League', track: '02', length: '3600.09', size: '57604408' },
      { name: 'holmes_02_doyle_64kb.mp3', format: '64Kbps MP3', title: '02 - The Red-Headed League', length: '60:00', size: '28801220' },
      { name: 'holmes_01_doyle_64kb.mp3', format: '64Kbps MP3', title: '01 - A Scandal in Bohemia', length: '57:54', size: '27796654' },
      { name: 'holmes_01_doyle.mp3', format: 'VBR MP3', title: '01 - A Scandal in Bohemia', track: '01', length: '3474.52' },
      { name: 'cover.jpg', format: 'JPEG' },
    ],
  };

  it('is its parts in their order, each once, in the small format, named without their numbers', () => {
    const book = bookOf('holmes', item)!;
    assert.equal(book.title, 'The Adventures of Sherlock Holmes');
    assert.equal(book.author, 'Sir Arthur Conan Doyle');
    assert.equal(book.description, 'LibriVox recording of it.');
    assert.deepEqual(book.parts.map((part) => part.title), ['A Scandal in Bohemia', 'The Red-Headed League']);
    assert.equal(book.parts[0]!.url, 'https://archive.org/download/holmes/holmes_01_doyle_64kb.mp3');
    assert.equal(book.parts[0]!.durationSec, 57 * 60 + 54);
    assert.equal(book.parts[1]!.bytes, 28801220);
  });

  it('is nothing where the item has no metadata', () => {
    assert.equal(bookOf('x', {}), null);
  });

  it('is found by search, and by its address', () => {
    assert.deepEqual(hitsOf({ response: { docs: [{ identifier: 'holmes', title: 'Holmes', creator: ['Doyle', 'Reader'] }] } }), [
      { id: 'holmes', title: 'Holmes', author: 'Doyle', cover: 'https://archive.org/services/img/holmes' },
    ]);
    assert.equal(identifierOf('https://archive.org/details/adventures_holmes'), 'adventures_holmes');
    assert.equal(identifierOf('https://www.archive.org/download/adventures_holmes/x.mp3'), 'adventures_holmes');
    assert.equal(identifierOf('https://example.org/details/x'), null);
  });

  it('reads the ways the Archive writes a length', () => {
    assert.equal(durationOf('1:02:03'), 3723);
    assert.equal(durationOf('3474.52'), 3474.52);
    assert.equal(durationOf('soon'), null);
  });
});

describe('the language books are searched in', () => {
  it('is asked of the Archive as it writes it on them, or not at all for any', () => {
    assert.equal(bookQuery('', null), 'collection:(librivoxaudio)');
    assert.equal(bookQuery('', 'de'), 'collection:(librivoxaudio) AND language:(deu OR ger OR German)');
    assert.equal(
      bookQuery('dickens', 'en'),
      'collection:(librivoxaudio) AND (title:(dickens) OR creator:(dickens)) AND language:(eng OR English)'
    );
  });

  it('is the one last chosen, else the app’s own where there are books in it, else any', () => {
    assert.equal(bookLanguageOf('fr', 'en'), 'fr');
    assert.equal(bookLanguageOf('all', 'en'), null);
    assert.equal(bookLanguageOf(null, 'pt-BR'), 'pt');
    assert.equal(bookLanguageOf(null, 'tr'), null);
    assert.equal(bookLanguageOf('xx', 'zh-Hans'), 'zh');
  });

  it('puts the app’s own first among the choices', () => {
    assert.equal(bookLanguagesFor('ru')[0]!.code, 'ru');
    assert.equal(bookLanguagesFor('tr')[0]!.code, 'en');
    assert.equal(bookLanguagesFor('ru').length, bookLanguagesFor('tr').length);
  });
});
