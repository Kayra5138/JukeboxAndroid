import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canonicalLabel, foldForMatch, matchScore, tokens, withoutUploadNotes } from '../text.ts';

/** Mirrors MIN_SCORE in itunes.ts. */
const MIN_SCORE = 0.5;

const matches = (query: string, candidate: Parameters<typeof matchScore>[1]) =>
  matchScore(query, candidate) >= MIN_SCORE;

describe('foldForMatch', () => {
  it('folds Turkish letters that NFD leaves alone', () => {
    assert.equal(foldForMatch('Şımarık'), 'simarik');
    assert.equal(foldForMatch('Güneş'), 'gunes');
  });

  it('folds with ASCII rules, not Turkish ones', () => {
    // toLocaleLowerCase('tr-TR') would turn this into "ındıe" and match nothing.
    assert.equal(foldForMatch('INDIE'), 'indie');
    assert.equal(foldForMatch('IDM'), 'idm');
  });
});

describe('tokens', () => {
  it('drops words that do not identify a recording', () => {
    assert.deepEqual(tokens('Sonic theme'), ['sonic']);
    assert.deepEqual(tokens('Doppio (Official Video)'), ['doppio']);
  });
});

describe('matchScore', () => {
  it('accepts a result that covers most of the query', () => {
    assert.ok(matches('Minecraft - C418 Aria Math', { title: 'Aria Math', artist: 'C418' }));
  });

  it('matches across Turkish spelling differences', () => {
    assert.ok(matches('Tarkan Simarik', { title: 'Şımarık', artist: 'Tarkan' }));
  });

  it('refuses single-word queries even on an exact title', () => {
    // The catalogue really does contain a dance track called "Shakra", so an
    // exact title is not evidence that it is the same recording.
    assert.ok(!matches('Shakra song', { title: 'Shakra', artist: 'Relanium & Deen West' }));
    assert.ok(!matches('Sonic theme', { title: 'Sonic Theme', artist: 'Club Bumpers' }));
  });

  it('rejects an unrelated result', () => {
    assert.ok(!matches('Kim Possible theme', { title: 'Call Me, Beep Me!', artist: 'Christina Milian' }));
  });

  it('accepts a cover when the original is not in the catalogue', () => {
    // Apple has no Yousei Teikoku, but their songs exist as covers, and a cover
    // carries the same genre and year.
    assert.ok(
      matches('Yousei Teikoku - Kuusou Mesorogiwi', {
        title: 'Kuusou Mesorogiwi (From "Mirai Nikki")',
        artist: 'Raon & PelleK',
      })
    );
  });

  it('rejects a result whose title is mostly words we never asked for', () => {
    assert.ok(
      !matches('Yousei Teikoku - Filament', {
        title: 'Filament of Something Else Entirely Long',
        artist: 'Nobody',
      })
    );
  });

  it('rejects an instrumental when the query does not ask for one', () => {
    assert.ok(
      !matches('Yousei Teikoku - Filament', { title: 'filament (instrumental)', artist: '妖精帝國' })
    );
    // ...but accepts it when that is what the file is.
    assert.ok(
      matches('Yousei Teikoku - Filament instrumental', {
        title: 'filament (instrumental)',
        artist: '妖精帝國',
      })
    );
  });

  it('rejects a remix when the query does not ask for one', () => {
    // A remix is a new recording carrying the year it was made, so accepting
    // one files a 1997 song under whenever the club edit came out.
    assert.ok(!matches('Tarkan Simarik', { title: 'Şımarık (Club Remix)', artist: 'Tarkan' }));
    assert.ok(!matches('LiSA Gurenge', { title: 'Gurenge (Extended Mix)', artist: 'LiSA' }));
    // ...but accepts it when that is what the file is.
    assert.ok(
      matches('Tarkan Simarik Club Remix', { title: 'Şımarık (Club Remix)', artist: 'Tarkan' })
    );
  });

  it('rejects a title that only repeats a word from the artist name', () => {
    // Both agreeing words come from the artist; the title shares nothing with
    // `Filament` and is not evidence that this is the song.
    assert.ok(!matches('Yousei Teikoku Filament', { title: 'Teikoku', artist: 'Yousei Teikoku' }));
    // A song named after the band it is by still gets through.
    assert.ok(matches('Iron Maiden - Iron Maiden', { title: 'Iron Maiden', artist: 'Iron Maiden' }));
  });

  it('matches a title written without spaces between the words', () => {
    // 妖精帝國 is one token however many words it is, and the two-word rule
    // refused every such title outright.
    assert.ok(matches('妖精帝國', { title: '妖精帝國', artist: '妖精帝國' }));
    assert.ok(matches('残酷な天使のテーゼ', { title: '残酷な天使のテーゼ', artist: '高橋洋子' }));
    assert.equal(matchScore('妖精帝國', { title: '君の名は', artist: 'RADWIMPS' }), 0);
  });

  it('still refuses a single Latin word', () => {
    assert.equal(matchScore('Shakra', { title: 'Shakra', artist: 'Relanium & Deen West' }), 0);
  });

  it('keeps letters from other scripts', () => {
    // Stripping non-ASCII would reduce this to `kyuusei` and match anything.
    assert.ok(foldForMatch('Kyuusei Άργυρόϛ').includes('αργυρο'));
  });

  it('rejects a match resting only on short words', () => {
    assert.equal(matchScore('Go On', { title: 'Go On Up', artist: 'Someone' }), 0);
  });
});

describe('canonicalLabel', () => {
  it('reads a tag the same however the shift key was used', () => {
    for (const typed of ['Rock', 'ROCK', 'rock', '  RoCk  ']) {
      assert.equal(canonicalLabel(typed), 'rock');
    }
  });

  it('keeps the accents, which are not case', () => {
    // The whole reason this is not `foldForMatch`: folded to `ozgun muzik`
    // it is a tag nobody typed and no vocabulary lists.
    assert.equal(canonicalLabel('ÖZGÜN MÜZİK'), 'özgün müzik');
    assert.equal(canonicalLabel('Şarkı'), 'şarkı');
    assert.equal(canonicalLabel('Sigur Rós'), 'sigur rós');
  });

  it('lower-cases the Turkish dotted capital to a plain i', () => {
    // `İ`.toLowerCase() is `i` followed by a combining dot above, which
    // matches nothing at all — including the same word typed in lower case.
    assert.equal(canonicalLabel('İNDİE'), 'indie');
    assert.equal(canonicalLabel('İndie'), canonicalLabel('indie'));
  });

  it('reads the same word composed and decomposed as one', () => {
    assert.equal(canonicalLabel('o\u0308zgu\u0308n'), canonicalLabel('özgün'));
  });

  it('gives nothing back for nothing', () => {
    assert.equal(canonicalLabel('   '), '');
  });
});

describe('withoutUploadNotes', () => {
  it('drops what says what kind of upload it is', () => {
    assert.equal(withoutUploadNotes('Numb (Official Audio)'), 'Numb');
    assert.equal(withoutUploadNotes('Numb [Official Video] (HD)'), 'Numb');
    assert.equal(withoutUploadNotes('Numb (Remastered 2011)'), 'Numb');
    assert.equal(withoutUploadNotes('Numb - 2011 Remaster'), 'Numb');
    assert.equal(withoutUploadNotes('Numb (Lyrics) | Official Audio'), 'Numb');
  });

  it('keeps everything else, a bare year and the title that is nothing but a note among it', () => {
    assert.equal(withoutUploadNotes('Numb (Live)'), 'Numb (Live)');
    assert.equal(withoutUploadNotes('Numb (Live Video)'), 'Numb (Live Video)');
    assert.equal(withoutUploadNotes('Numb (feat. Jay-Z)'), 'Numb (feat. Jay-Z)');
    assert.equal(withoutUploadNotes('Song (1999)'), 'Song (1999)');
    assert.equal(withoutUploadNotes('Hikaru Nara - TV Size'), 'Hikaru Nara - TV Size');
    assert.equal(withoutUploadNotes('Official Audio'), 'Official Audio');
    assert.equal(withoutUploadNotes('[HD]'), '[HD]');
  });
});
