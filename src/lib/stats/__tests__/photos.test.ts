import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ArtistPhoto } from '../../db/artistPhotos.ts';
import { creditLine, creditsOn, photoFor, pictureFor, type Photos } from '../photos.ts';
import type { RankedEntry, ReportCard } from '../report.ts';

const photo = (changes: Partial<ArtistPhoto> = {}): ArtistPhoto => ({
  uri: 'file:///photos/artist.jpg',
  credit: 'Jane Doe',
  licence: 'CC BY-SA 3.0',
  ...changes,
});

const entry = (changes: Partial<RankedEntry> & { key: string }): RankedEntry => ({
  label: changes.key,
  detail: null,
  plays: 12,
  seconds: 2400,
  share: 1,
  sample: 'track-1',
  ...changes,
});

const ranking = (
  of: 'tracks' | 'artists' | 'genres',
  entries: RankedEntry[]
): ReportCard => ({ kind: 'ranking', of, heading: 'Your top', lead: '', entries });

const closing = (changes: Partial<Extract<ReportCard, { kind: 'closing' }>> = {}): ReportCard => ({
  kind: 'closing',
  title: '2026',
  seconds: 9000,
  track: 'A song',
  artist: 'Şebnem Ferah',
  sample: 'track-1',
  artistSample: null,
  ...changes,
});

describe('which picture a row is drawn with', () => {
  const photos: Photos = new Map([['Şebnem Ferah', photo()]]);
  const covers = new Map([['track-1', 'file:///covers/album.jpg']]);

  it('prefers the artist over one of their records', () => {
    const row = entry({ key: 'Şebnem Ferah' });
    assert.equal(
      pictureFor(row.sample, covers, photoFor('artists', row.key, photos)),
      'file:///photos/artist.jpg'
    );
  });

  it('falls back to the cover the row borrowed before, so nothing is blank', () => {
    // Most artists in a personal library are on no encyclopaedia at all, and a
    // chart with pictures on two rows of five reads as half-loaded.
    const row = entry({ key: 'Someone Local' });
    assert.equal(
      pictureFor(row.sample, covers, photoFor('artists', row.key, photos)),
      'file:///covers/album.jpg'
    );
  });

  it('leaves a row with neither exactly as it was', () => {
    const row = entry({ key: 'Someone Local', sample: null });
    assert.equal(pictureFor(row.sample, covers, photoFor('artists', row.key, photos)), undefined);
    assert.equal(pictureFor('unknown-track', covers, undefined), undefined);
  });

  it('never looks for a photograph of a track or a genre', () => {
    // A song can share its name with a performer, and `photos` is keyed by
    // name, so asking would sooner or later put a stranger's face on a track.
    const song = entry({ key: 'Şebnem Ferah' });
    assert.equal(photoFor('tracks', song.key, photos), undefined);
    assert.equal(photoFor('genres', song.key, photos), undefined);
    assert.equal(
      pictureFor(song.sample, covers, photoFor('tracks', song.key, photos)),
      'file:///covers/album.jpg'
    );
  });
});

describe('the credit a card carries', () => {
  it('names the photographer and the licence', () => {
    assert.equal(creditLine(photo()), 'Photo: Jane Doe / CC BY-SA 3.0');
  });

  it('states the licence even where nobody is named', () => {
    assert.equal(creditLine(photo({ credit: null })), 'Photo: CC BY-SA 3.0');
  });

  it('credits every photograph the chart actually shows, once each', () => {
    const photos: Photos = new Map([
      ['One', photo({ credit: 'Jane Doe' })],
      ['Two', photo({ credit: 'Jane Doe' })],
      ['Three', photo({ credit: 'Ali Veli', licence: 'CC BY 4.0' })],
    ]);
    const card = ranking('artists', [
      entry({ key: 'One' }),
      entry({ key: 'Two' }),
      entry({ key: 'Three' }),
      entry({ key: 'Unphotographed' }),
    ]);

    assert.deepEqual(creditsOn(card, photos), [
      'Photo: Jane Doe / CC BY-SA 3.0',
      'Photo: Ali Veli / CC BY 4.0',
    ]);
  });

  it('credits the artist on the closing card', () => {
    assert.deepEqual(creditsOn(closing(), new Map([['Şebnem Ferah', photo()]])), [
      'Photo: Jane Doe / CC BY-SA 3.0',
    ]);
  });

  it('says nothing on a card showing only album covers', () => {
    // The line is owed to the photographs and to nothing else; printed over a
    // card of covers it credits somebody for a picture that is not theirs.
    const photos: Photos = new Map([['Şebnem Ferah', photo()]]);
    assert.deepEqual(creditsOn(ranking('tracks', [entry({ key: 'Şebnem Ferah' })]), photos), []);
    assert.deepEqual(creditsOn(ranking('genres', [entry({ key: 'Şebnem Ferah' })]), photos), []);
    assert.deepEqual(creditsOn(ranking('artists', [entry({ key: 'Someone Local' })]), photos), []);
    assert.deepEqual(creditsOn(closing({ artist: 'Someone Local' }), photos), []);
    assert.deepEqual(creditsOn(closing({ artist: null }), photos), []);
  });

  it('says nothing on the cards that have no artist on them', () => {
    const photos: Photos = new Map([['Şebnem Ferah', photo()]]);
    const cards: ReportCard[] = [
      { kind: 'opening', title: '2026', seconds: 90, change: null, comparison: 'last year', wall: [] },
      { kind: 'clock', heading: 'Your hours', lead: '', hours: new Array<number>(24).fill(0), peak: 9 },
      { kind: 'numbers', heading: 'By the numbers', items: [], wall: [] },
    ];
    for (const card of cards) assert.deepEqual(creditsOn(card, photos), []);
  });
});
