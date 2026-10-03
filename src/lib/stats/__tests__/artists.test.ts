import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guestsNamedIn, splitCredit } from '../../metadata/credit.ts';
import { countArtists, tallyArtists, type CreditListens } from '../artists.ts';

type Listen = { artist: string; title?: string | null };
const split = (listen: Listen) => [...splitCredit(listen.artist), ...guestsNamedIn(listen.title)];
const heard = (
  artist: string,
  trackId: string,
  plays: number,
  seconds = plays * 200,
  title: string | null = null
): CreditListens => ({
  artist,
  title,
  trackId,
  plays,
  seconds,
});

describe('tallyArtists', () => {
  it('gives a listen to everybody credited on it', () => {
    const top = tallyArtists(
      [heard('Eminem', 'stan', 10), heard('Eminem, Rihanna', 'monster', 4), heard('Rihanna', 'umbrella', 1)],
      split,
      10
    );
    assert.deepEqual(
      top.map((artist) => [artist.label, artist.playCount, artist.totalSeconds]),
      [
        ['Eminem', 14, 2800],
        ['Rihanna', 5, 1000],
      ]
    );
  });

  it('has no artist called after two people', () => {
    const top = tallyArtists([heard('Eminem feat. Rihanna', 'monster', 3)], split, 10);
    assert.deepEqual(top.map((artist) => artist.label).sort(), ['Eminem', 'Rihanna']);
  });

  it('counts one artist once on a credit that repeats them', () => {
    const top = tallyArtists([heard('Taku Iwasaki, LotusJuice, Taku Iwasaki', 'x', 5)], split, 10);
    assert.deepEqual(
      top.map((artist) => [artist.label, artist.playCount]),
      [
        ['LotusJuice', 5],
        ['Taku Iwasaki', 5],
      ]
    );
  });

  it('is one artist however the name is cased or accented, under the commoner spelling', () => {
    const top = tallyArtists([heard('aurora', 'a', 1), heard('AURORA, Pomme', 'b', 6), heard('Aurora', 'c', 2)], split, 10);
    assert.deepEqual(top[0], { key: 'AURORA', label: 'AURORA', playCount: 9, totalSeconds: 1800, sample: 'b' });
  });

  it('borrows the cover of whichever of theirs was played most', () => {
    const top = tallyArtists(
      [heard('Eminem', 'stan', 2), heard('Eminem, Rihanna', 'monster', 7), heard('Eminem, Dido', 'stan', 1)],
      split,
      10
    );
    assert.equal(top.find((artist) => artist.label === 'Eminem')?.sample, 'monster');
    assert.equal(top.find((artist) => artist.label === 'Dido')?.sample, 'stan');
  });

  it('orders by listens, then by time, and keeps only as many as asked for', () => {
    const top = tallyArtists(
      [heard('A One', 'a', 3, 100), heard('B Two', 'b', 3, 900), heard('C Three', 'c', 9, 10), heard('D Four', 'd', 1)],
      split,
      3
    );
    assert.deepEqual(top.map((artist) => artist.label), ['C Three', 'B Two', 'A One']);
  });

  it('believes whoever is doing the splitting', () => {
    const whole = (listen: Listen) =>
      splitCredit(listen.artist, (name) => (name === 'Oliver & Company' ? true : undefined));
    assert.deepEqual(tallyArtists([heard('Oliver & Company', 'x', 2)], whole, 10).map((artist) => artist.label), [
      'Oliver & Company',
    ]);
  });

  it('counts a guest the title names, once', () => {
    const top = tallyArtists(
      [
        heard('Eminem', 'lie', 3, 600, 'Love the Way You Lie (feat. Rihanna)'),
        // Named in the credit and in the title: still one listen each.
        heard('Eminem, Rihanna', 'monster', 2, 400, 'The Monster ft. Rihanna'),
        heard('Eminem', 'closer', 1, 200, 'Closer (with strings)'),
      ],
      split,
      10
    );
    assert.deepEqual(
      top.map((artist) => [artist.label, artist.playCount]),
      [
        ['Eminem', 6],
        ['Rihanna', 5],
      ]
    );
  });

  it('has nothing to say about nothing', () => {
    assert.deepEqual(tallyArtists([], split, 10), []);
    assert.deepEqual(tallyArtists([heard('', 'x', 2)], split, 10), []);
  });
});

describe('countArtists', () => {
  it('counts names, not credits', () => {
    // Three credits, two people.
    const by = (...artists: string[]) => artists.map((artist) => ({ artist }));
    assert.equal(countArtists(by('Eminem', 'Eminem, Rihanna', 'RIHANNA'), split), 2);
    assert.equal(countArtists(by('Earth, Wind & Fire'), split), 1);
    assert.equal(countArtists([], split), 0);
    assert.equal(countArtists([{ artist: 'Eminem', title: 'Stan (feat. Dido)' }], split), 2);
  });
});
