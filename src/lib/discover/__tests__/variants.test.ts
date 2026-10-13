import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  anotherTake,
  doubtfulRecord,
  isNobody,
  isTalk,
  leadOfFolded,
  isSongLength,
  leadArtist,
  loosenFolded,
  looseSongKey,
  plainTitle,
  recordOfTakes,
} from '../variants.ts';

describe('telling a song from another recording of it', () => {
  it('knows a concert, a demo, a remix and an acoustic take by the note after the name', () => {
    assert.equal(anotherTake('Numb (Live in Texas)'), 'live');
    assert.equal(anotherTake('Alive - Live'), 'live');
    assert.equal(anotherTake('Creep [Demo]'), 'demo');
    assert.equal(anotherTake('Paranoid Android (acoustic)'), 'acoustic');
    assert.equal(anotherTake('Glory Box (Alex C Adventure) (Alex C remix)'), 'remix');
    assert.equal(anotherTake('Hallelujah (Leonard Cohen cover)'), 'cover');
  });

  it('knows a karaoke or instrumental track however it is written', () => {
    assert.equal(anotherTake('復讐 -Instrumental-'), 'instrumental');
    assert.equal(anotherTake('色彩 (Instrumental)'), 'instrumental');
    assert.equal(anotherTake('Xtreme Vibes off vocal'), 'off vocal');
    assert.equal(anotherTake('Tsumibito Karaoke'), 'karaoke');
    assert.ok(anotherTake('メルト (カラオケ)'));
  });

  it('knows the cut a programme opened with, and a song sped up', () => {
    assert.ok(anotherTake('Danger Danger (anime size)'));
    assert.ok(anotherTake('ヒメムラサキ (TVサイズ)'));
    assert.ok(anotherTake('Hikaru Nara - TV Size'));
    assert.ok(anotherTake('Bad Habits (Sped Up)'));
    assert.ok(anotherTake('Bad Habits - Nightcore'));
  });

  it('takes a date in a note for the night of a concert', () => {
    assert.equal(anotherTake('2+2=5 (2003‐07‐03 Belfort)'), 'live');
    assert.equal(anotherTake('1979'), null);
  });

  it('does not take a word in the song’s own name for a note about it', () => {
    assert.equal(anotherTake('Live and Let Die'), null);
    assert.equal(anotherTake('Demons'), null);
    assert.equal(anotherTake('(I Can’t Get No) Satisfaction'), null);
    assert.equal(anotherTake('ライフ'), null);
    assert.equal(anotherTake('Numb (feat. Jay-Z)'), null);
  });

  it('does not take a note about how a copy was issued for another take', () => {
    assert.equal(anotherTake('Numb (2011 Remaster)'), null);
    assert.equal(anotherTake('Q? (Music Video)'), null);
    assert.equal(anotherTake('Heroes - 2017 Remaster'), null);
  });
});

describe('a song’s name as it would be said', () => {
  it('drops the notes about the issue and keeps everything else', () => {
    assert.equal(plainTitle('Numb (2011 Remaster)', 'Linkin Park'), 'Numb');
    assert.equal(plainTitle('Q? (Music Video)', 'Reol'), 'Q?');
    assert.equal(plainTitle('Heroes - 2017 Remaster', 'David Bowie'), 'Heroes');
    assert.equal(plainTitle('Numb (feat. Jay-Z)', 'Linkin Park'), 'Numb (feat. Jay-Z)');
  });

  it('drops the artist written in front of it', () => {
    assert.equal(plainTitle('Reol - No title', 'Reol'), 'No title');
  });
});

describe('one key for every spelling of one song', () => {
  it('is the same for the song, its remaster and its guest credit', () => {
    const key = looseSongKey({ artist: 'Linkin Park', title: 'Numb' });
    assert.equal(looseSongKey({ artist: 'Linkin Park', title: 'Numb [2011 Remaster]' }), key);
    assert.equal(looseSongKey({ artist: 'Linkin Park feat. Jay-Z', title: 'Numb (feat. Jay-Z)' }), key);
    assert.equal(looseSongKey({ artist: 'LINKIN PARK', title: 'Linkin Park - Numb (Official Video)' }), key);
  });

  it('is another key for the concert, so that owning only the concert is not owning the song', () => {
    assert.notEqual(
      looseSongKey({ artist: 'Linkin Park', title: 'Numb (Live)' }),
      looseSongKey({ artist: 'Linkin Park', title: 'Numb' })
    );
  });

  it('files a credit under its first name', () => {
    assert.equal(leadArtist('supercell feat. 初音ミク'), 'supercell');
    assert.equal(leadArtist(null), '');
  });
});

describe('loosening a key that was folded already', () => {
  it('takes a guest credit and the words of an issue off the end', () => {
    assert.equal(loosenFolded('linkin park|numb 2011 remaster'), 'linkin park|numb');
    assert.equal(loosenFolded('linkin park|numb remastered 2011'), 'linkin park|numb');
    assert.equal(loosenFolded('linkin park|numb feat jay z'), 'linkin park|numb');
  });

  it('leaves alone a title that is only such a word, and anything that is not a song’s key', () => {
    assert.equal(loosenFolded('somebody|version'), 'somebody|version');
    assert.equal(loosenFolded('a-recording-id'), 'a-recording-id');
  });
});

describe('how long a song can be', () => {
  it('is not an intro and not a whole side of a record', () => {
    assert.equal(isSongLength(41), false);
    assert.equal(isSongLength(226), true);
    assert.equal(isSongLength(1300), false);
  });

  it('is given the benefit of the doubt when nobody said', () => {
    assert.equal(isSongLength(null), true);
  });
});

describe('what the record says that the title does not', () => {
  it('knows a concert album and a disc of karaoke tracks by their names', () => {
    assert.equal(recordOfTakes('Roseland NYC Live'), true);
    assert.equal(recordOfTakes('Live at Leeds'), true);
    assert.equal(recordOfTakes('MTV Unplugged in New York'), true);
    assert.equal(recordOfTakes('Today Is A Beautiful Day 〜カラオケ集〜'), true);
    assert.equal(recordOfTakes('Portishead Remixed: Dumb'), true);
  });

  it('does not take a studio album with the word in its name for one', () => {
    assert.equal(recordOfTakes('Live Through This'), false);
    assert.equal(recordOfTakes('Alive 2007 Deluxe'), false);
    assert.equal(recordOfTakes('OK Computer'), false);
    assert.equal(recordOfTakes(null), false);
  });
});

describe('a credit that is nobody', () => {
  it('is how the catalogue files what it cannot put a name to', () => {
    assert.equal(isNobody('[unknown]'), true);
    assert.equal(isNobody('<information not found>'), true);
    // A band can be called anything, and one is called this.
    assert.equal(isNobody('!!!'), false);
    assert.equal(isNobody('Mew'), false);
  });
});

describe('a version that is another take, and one that is only how the take was issued', () => {
  it('takes a named version or edition for another take', () => {
    assert.equal(anotherTake('Ribs (Let\'s Have a Sleepover version)'), 'version');
    assert.equal(anotherTake('Kiss It Better (Kaytranada edition)'), 'version');
    assert.equal(anotherTake('Running with the Wolves (WolfWalkers Version)'), 'version');
    assert.equal(anotherTake('Twenty‐Four (Tyler Joseph From Twenty One Pilots version)'), 'version');
  });

  it('lets through the album version, the single version, a remaster, and the version an artist re-recorded on purpose', () => {
    for (const title of [
      'Numb (Album Version)', 'I Want It All (Single Version)', 'Numb (2011 Remastered Version)',
      'Numb (feat. Jay-Z) (Album Version)', 'Love Story (Taylor’s Version)', 'Version of Me', 'Deluxe Edition',
      'Hunting Shadows (Assassin’s Creed)', 'Lilith (Diablo IV anthem)',
    ]) assert.equal(anotherTake(title), null, title);
  });

  it('takes an interlude for one, in a note or as the whole of a title', () => {
    assert.equal(anotherTake('The Love (interlude)'), 'interlude');
    assert.equal(anotherTake('Know the Way (outro)'), 'outro');
    assert.equal(anotherTake('Intro'), 'intro');
    assert.equal(anotherTake('Interlude'), 'interlude');
    // A song is allowed the word.
    assert.equal(anotherTake('Intro to Love'), null);
  });
});

describe('a record that gives a recording away', () => {
  it('knows a tape of a night, a session, leftovers and no record at all', () => {
    assert.equal(doubtfulRecord('2022-06-10: Primavera Sound Festival, Barcelona, Spain'), 'dated');
    assert.equal(doubtfulRecord('Across the Universe (triple j Like A Version)'), 'like a version');
    assert.equal(doubtfulRecord('Demo & Unreleased'), 'demo');
    assert.equal(doubtfulRecord('Spaced Out (Demos and Outtakes)'), 'demos');
    assert.equal(doubtfulRecord('American Idiot: The Original Broadway Cast Recording'), 'cast recording');
    assert.equal(doubtfulRecord('Happy Hippie Presents: Backyard Sessions'), 'sessions');
    assert.equal(doubtfulRecord('Roseland NYC Live'), 'takes');
    assert.equal(doubtfulRecord(null), 'no record');
    assert.equal(doubtfulRecord('  '), 'no record');
  });

  it('lets an album be called anything else', () => {
    for (const name of ['Melodrama', 'Celeste (Original Soundtrack)', 'Live Through This', 'Demon Days', 'The Gods We Can Touch', '1989', 'Session Man Blues']) {
      assert.equal(doubtfulRecord(name), name === 'Session Man Blues' ? 'session' : null, name);
    }
  });

  it('knows somebody talking by what the recording is tagged', () => {
    assert.equal(isTalk(['pop', 'Interview']), true);
    assert.equal(isTalk(['spoken word']), true);
    assert.equal(isTalk(['pop', 'art pop']), false);
    assert.equal(isTalk([]), false);
  });
});

describe('one key for a song whoever else is in the credit', () => {
  it('cuts a folded credit down to its first name, and the title to the song', () => {
    assert.equal(leadOfFolded('halsey feat suga of bts|lilith diablo iv anthem official audio'), 'halsey|lilith diablo iv anthem');
    assert.equal(leadOfFolded('halsey|lilith'), 'halsey|lilith');
    assert.equal(leadOfFolded('miley cyrus with joan jett|bad karma'), 'miley cyrus|bad karma');
    assert.equal(leadOfFolded('not a key'), 'not a key');
  });

  it('cuts a band with a joining word in its name the same way every time', () => {
    assert.equal(leadOfFolded('florence and the machine|shake it out'), leadOfFolded('florence and the machine|shake it out 2011 remaster'));
  });
});
