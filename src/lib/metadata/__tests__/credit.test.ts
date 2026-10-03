import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { featuredIn, guestsNamedIn, splitCredit, withoutPackaging } from '../credit.ts';

describe('splitCredit', () => {
  it('leaves one artist alone', () => {
    assert.deepEqual(splitCredit('Eminem'), ['Eminem']);
    assert.deepEqual(splitCredit('  The Cranberries '), ['The Cranberries']);
    assert.deepEqual(splitCredit(''), []);
    assert.deepEqual(splitCredit(null), []);
  });

  it('parts artists at a comma, a semicolon and a spaced slash', () => {
    assert.deepEqual(splitCredit('Eminem, Rihanna'), ['Eminem', 'Rihanna']);
    assert.deepEqual(splitCredit('Rihanna; Eminem'), ['Rihanna', 'Eminem']);
    assert.deepEqual(splitCredit('SEGA / Mariko Nanba'), ['SEGA', 'Mariko Nanba']);
  });

  it('parts them at every way of writing featuring', () => {
    for (const credit of [
      'Eminem feat. Rihanna',
      'Eminem ft. Rihanna',
      'Eminem ft Rihanna',
      'Eminem Feat Rihanna',
      'Eminem featuring Rihanna',
      'Eminem (feat. Rihanna)',
      'Eminem [ft. Rihanna]',
    ]) {
      assert.deepEqual(splitCredit(credit), ['Eminem', 'Rihanna'], credit);
    }
  });

  it('does not find featuring inside a word', () => {
    assert.deepEqual(splitCredit('Daft Punk'), ['Daft Punk']);
    assert.deepEqual(splitCredit('Defeater'), ['Defeater']);
    assert.deepEqual(splitCredit('Lift'), ['Lift']);
  });

  it('counts an artist once however often a tagger repeated it', () => {
    // What is really in files a downloader wrote.
    assert.deepEqual(splitCredit('Taku Iwasaki, LotusJuice, Taku Iwasaki, Taku Iwasaki'), [
      'Taku Iwasaki',
      'LotusJuice',
    ]);
    assert.deepEqual(splitCredit('SEGA / Mariko Nanba, Mariko Nanba, Mariko Nanba'), [
      'SEGA',
      'Mariko Nanba',
    ]);
    assert.deepEqual(splitCredit('Fumie Kumatani, Fumie Kumatani, FUMIE KUMATANI'), ['Fumie Kumatani']);
  });

  it('parts a tight slash only between two whole names', () => {
    assert.deepEqual(
      splitCredit('Tyson Yen, Logan Mader/Jamie Christopherson, Logan Mader/Jamie Christopherson'),
      ['Tyson Yen', 'Logan Mader', 'Jamie Christopherson']
    );
    assert.deepEqual(splitCredit('AC/DC'), ['AC/DC']);
    assert.deepEqual(splitCredit('Au/Ra'), ['Au/Ra']);
    assert.deepEqual(splitCredit('AC/DC, Eminem'), ['AC/DC', 'Eminem']);
  });

  it('parts an ampersand between two artists', () => {
    assert.deepEqual(splitCredit('Lena Raine & Minecraft'), ['Lena Raine', 'Minecraft']);
    assert.deepEqual(splitCredit('Calvin Harris, Dua Lipa & Young Thug'), [
      'Calvin Harris',
      'Dua Lipa',
      'Young Thug',
    ]);
    assert.deepEqual(splitCredit('Marshmello x Bastille'), ['Marshmello', 'Bastille']);
  });

  it('keeps a band and the band behind it together', () => {
    assert.deepEqual(splitCredit('Florence + the Machine'), ['Florence + the Machine']);
    assert.deepEqual(splitCredit('Bob Marley & The Wailers'), ['Bob Marley & The Wailers']);
    assert.deepEqual(splitCredit('Lindsey Stirling feat. Royal & the Serpent'), [
      'Lindsey Stirling',
      'Royal & the Serpent',
    ]);
  });

  it('does not part on and, or on a capital X', () => {
    assert.deepEqual(splitCredit('Mumford and Sons'), ['Mumford and Sons']);
    assert.deepEqual(splitCredit('Lil Nas X'), ['Lil Nas X']);
    assert.deepEqual(splitCredit('Lil Nas X & Jack Harlow'), ['Lil Nas X', 'Jack Harlow']);
  });

  it('knows the famous names that only look like several', () => {
    assert.deepEqual(splitCredit('Earth, Wind & Fire'), ['Earth, Wind & Fire']);
    assert.deepEqual(splitCredit('Simon & Garfunkel'), ['Simon & Garfunkel']);
    assert.deepEqual(splitCredit('Tyler, The Creator'), ['Tyler, The Creator']);
    assert.deepEqual(splitCredit('TYLER, THE CREATOR feat. Kali Uchis'), ['TYLER, THE CREATOR', 'Kali Uchis']);
    assert.deepEqual(splitCredit('Eminem feat. Simon & Garfunkel'), ['Eminem', 'Simon & Garfunkel']);
  });

  it('believes what it is told over what it would have guessed', () => {
    const says = (answers: Record<string, boolean>) => (credit: string) => answers[credit];
    // A duo nobody listed, found whole in a catalogue.
    assert.deepEqual(splitCredit('Oliver & Company'), ['Oliver', 'Company']);
    assert.deepEqual(splitCredit('Oliver & Company', says({ 'Oliver & Company': true })), [
      'Oliver & Company',
    ]);
    assert.deepEqual(splitCredit('Rihanna, Oliver & Company', says({ 'Oliver & Company': true })), [
      'Rihanna',
      'Oliver & Company',
    ]);
    // And a credit that reads like a band and its backing and is two acts.
    assert.deepEqual(splitCredit('Eminem & The Roots'), ['Eminem & The Roots']);
    assert.deepEqual(splitCredit('Eminem & The Roots', says({ 'Eminem & The Roots': false })), [
      'Eminem',
      'The Roots',
    ]);
  });

  it('keeps brackets that are a pair', () => {
    assert.deepEqual(
      splitCredit('Castlevania Sound Team, Konami Digital Entertainment(Michiru Yamane)'),
      ['Castlevania Sound Team', 'Konami Digital Entertainment(Michiru Yamane)']
    );
  });
});

describe('featuredIn', () => {
  it('takes a guest out of the title', () => {
    assert.deepEqual(featuredIn('Love The Way You Lie ft. Rihanna'), {
      title: 'Love The Way You Lie',
      featured: ['Rihanna'],
    });
    assert.deepEqual(featuredIn('Love the Way You Lie (feat. Rihanna)'), {
      title: 'Love the Way You Lie',
      featured: ['Rihanna'],
    });
    assert.deepEqual(featuredIn('Dursun Zaman ft. Göksel'), { title: 'Dursun Zaman', featured: ['Göksel'] });
    assert.deepEqual(featuredIn('Closer (with Halsey)'), { title: 'Closer', featured: ['Halsey'] });
  });

  it('keeps what else the title says', () => {
    assert.deepEqual(featuredIn('Stan (Long Version) ft. Dido'), {
      title: 'Stan (Long Version)',
      featured: ['Dido'],
    });
    assert.deepEqual(featuredIn('Kingslayer (Lyric Video) ft. BABYMETAL'), {
      title: 'Kingslayer (Lyric Video)',
      featured: ['BABYMETAL'],
    });
    assert.deepEqual(featuredIn('Inner Gold (feat. Royal & the Serpent) [Official Music Video]'), {
      title: 'Inner Gold [Official Music Video]',
      featured: ['Royal & the Serpent'],
    });
  });

  it('finds several guests', () => {
    assert.deepEqual(featuredIn('Forever (feat. Kanye West, Lil Wayne & Eminem)'), {
      title: 'Forever',
      featured: ['Kanye West', 'Lil Wayne', 'Eminem'],
    });
  });

  it('leaves a title with no guest alone', () => {
    assert.deepEqual(featuredIn('Back In Black'), { title: 'Back In Black', featured: [] });
    assert.deepEqual(featuredIn('Left Behind'), { title: 'Left Behind', featured: [] });
    assert.deepEqual(featuredIn('Come With Me'), { title: 'Come With Me', featured: [] });
    assert.deepEqual(featuredIn('(feat. Somebody)'), { title: '(feat. Somebody)', featured: [] });
  });
});

describe('guestsNamedIn', () => {
  it('reads the guests and nothing else', () => {
    assert.deepEqual(guestsNamedIn('Love the Way You Lie (feat. Rihanna)'), ['Rihanna']);
    assert.deepEqual(guestsNamedIn('Stan (Long Version) ft. Dido'), ['Dido']);
    assert.deepEqual(guestsNamedIn('Forever [feat. Kanye West, Lil Wayne & Eminem]'), [
      'Kanye West',
      'Lil Wayne',
      'Eminem',
    ]);
    assert.deepEqual(guestsNamedIn('Back In Black'), []);
    assert.deepEqual(guestsNamedIn(null), []);
  });

  it('does not take an accompaniment for an artist', () => {
    assert.deepEqual(guestsNamedIn('Closer (with strings)'), []);
    assert.deepEqual(guestsNamedIn('Hurt (with Orchestra)'), []);
  });
});

describe('withoutPackaging', () => {
  it('drops what is about the upload', () => {
    assert.equal(withoutPackaging('The Monster (Explicit) [Official Video]'), 'The Monster');
    assert.equal(withoutPackaging('Yetmez (Official Video)'), 'Yetmez');
    assert.equal(withoutPackaging('Shatter Me (Official Music Video)'), 'Shatter Me');
    assert.equal(withoutPackaging('Snake Eyes [Monstercat Release]'), 'Snake Eyes');
    assert.equal(withoutPackaging('Kingslayer (Lyric Video)'), 'Kingslayer');
  });

  it('keeps what is about the recording', () => {
    assert.equal(withoutPackaging('Stan (Long Version)'), 'Stan (Long Version)');
    assert.equal(withoutPackaging('Hikaru Nara (TV Size)'), 'Hikaru Nara (TV Size)');
    assert.equal(withoutPackaging('Zombie (Acoustic)'), 'Zombie (Acoustic)');
    assert.equal(withoutPackaging('Numb (Live)'), 'Numb (Live)');
  });

  it('never leaves nothing', () => {
    assert.equal(withoutPackaging('(Official Video)'), '(Official Video)');
  });
});
