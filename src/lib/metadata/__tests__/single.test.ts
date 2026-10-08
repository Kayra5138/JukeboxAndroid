import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  lookUpGeneral,
  lookUpTags,
  numberComplaint,
  typedPlace,
  typedYear,
  withLookupTags,
  type Catalogues,
} from '../single.ts';
import { stringsFor } from '../../i18n/languages.ts';
import { abortError, networkError } from '../http.ts';
import type { ItunesMatch } from '../itunes.ts';
import type { MusicBrainzMatch } from '../musicbrainz.ts';
import { track } from './support.ts';

const song = track({ title: 'Love the Way You Lie', artist: 'Eminem, Rihanna' });

function recording(fields: Partial<MusicBrainzMatch> = {}): MusicBrainzMatch {
  return {
    title: 'Love the Way You Lie',
    artist: 'Eminem feat. Rihanna',
    genres: ['hip hop', 'pop rap'],
    year: 2010,
    oneArtist: false,
    ...fields,
  } as MusicBrainzMatch;
}

function listing(fields: Partial<ItunesMatch> = {}): ItunesMatch {
  return {
    title: 'Love the Way You Lie (feat. Rihanna)',
    artist: 'Eminem',
    album: 'Recovery',
    genre: 'Hip-Hop/Rap',
    year: 2012,
    artworkUrl: 'https://example.test/cover.jpg',
    trackNumber: 15,
    discNumber: 1,
    score: 1,
    storefront: 'US',
    ...fields,
  } as ItunesMatch;
}

function catalogues(
  musicbrainz: MusicBrainzMatch | null | Error,
  itunes: ItunesMatch | null | Error
): Catalogues & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    musicbrainz: async () => {
      asked.push('musicbrainz');
      if (musicbrainz instanceof Error) throw musicbrainz;
      return musicbrainz;
    },
    itunes: async () => {
      asked.push('itunes');
      if (itunes instanceof Error) throw itunes;
      return itunes;
    },
  };
}

describe('looking up who a track is', () => {
  it('asks both and takes from each what it knows best', async () => {
    const both = catalogues(recording(), listing());
    const found = await lookUpGeneral(song, undefined, both);

    assert.deepEqual(both.asked, ['musicbrainz', 'itunes']);
    assert.deepEqual(found, {
      sources: ['musicbrainz', 'itunes'],
      title: 'Love the Way You Lie',
      artist: 'Eminem feat. Rihanna',
      album: 'Recovery',
      // The recording's year, not the reissue's.
      year: 2010,
      trackNumber: 15,
      discNumber: 1,
      artworkUrl: 'https://example.test/cover.jpg',
      credit: { text: 'Eminem feat. Rihanna', oneArtist: false },
    });
  });

  it('is content with one of them', async () => {
    const onlyApple = await lookUpGeneral(song, undefined, catalogues(null, listing()));
    assert.equal(onlyApple?.artist, 'Eminem');
    assert.equal(onlyApple?.year, 2012);
    assert.deepEqual(onlyApple?.sources, ['itunes']);
    assert.equal(onlyApple?.credit, null);

    const onlyMusicBrainz = await lookUpGeneral(song, undefined, catalogues(recording(), null));
    assert.equal(onlyMusicBrainz?.album, null);
    assert.equal(onlyMusicBrainz?.artworkUrl, null);
    assert.deepEqual(onlyMusicBrainz?.sources, ['musicbrainz']);
  });

  it('leaves a credit nobody settled unsaid', async () => {
    const found = await lookUpGeneral(song, undefined, catalogues(recording({ oneArtist: null }), null));
    assert.equal(found?.credit, null);
  });

  it('says nothing was found when nothing was', async () => {
    assert.equal(await lookUpGeneral(song, undefined, catalogues(null, null)), null);
  });

  it('still hears from one when the other cannot be reached', async () => {
    const found = await lookUpGeneral(song, undefined, catalogues(networkError('down'), listing()));
    assert.equal(found?.album, 'Recovery');
  });

  it('fails when neither could be reached, and when one could not and the other had nothing', async () => {
    await assert.rejects(lookUpGeneral(song, undefined, catalogues(networkError('a'), networkError('b'))));
    await assert.rejects(lookUpGeneral(song, undefined, catalogues(networkError('a'), null)));
  });

  it('stops at once when told to', async () => {
    const stopped = catalogues(abortError(), listing());
    await assert.rejects(lookUpGeneral(song, undefined, stopped));
    assert.deepEqual(stopped.asked, ['musicbrainz']);
  });
});

describe('looking up what a track is like', () => {
  it('takes the ranked tags and does not trouble the second catalogue', async () => {
    const both = catalogues(recording(), listing());
    assert.deepEqual(await lookUpTags(song, undefined, both), {
      tags: ['hip hop', 'pop rap'],
      source: 'musicbrainz',
    });
    assert.deepEqual(both.asked, ['musicbrainz']);
  });

  it('falls back to the one label Apple gives', async () => {
    const found = await lookUpTags(song, undefined, catalogues(recording({ genres: [] }), listing()));
    assert.equal(found?.source, 'itunes');
    assert.ok(found && found.tags.length > 0);
  });

  it('is null when there are no tags to be had', async () => {
    assert.equal(
      await lookUpTags(song, undefined, catalogues(recording({ genres: [] }), listing({ genre: null }))),
      null
    );
    assert.equal(await lookUpTags(song, undefined, catalogues(null, null)), null);
  });

  it('fails only when nobody answered at all', async () => {
    await assert.rejects(lookUpTags(song, undefined, catalogues(networkError('a'), networkError('b'))));
    // A recording with no genre is an answer, so Apple being down is not a failure.
    assert.equal(
      await lookUpTags(song, undefined, catalogues(recording({ genres: [] }), networkError('b'))),
      null
    );
  });
});

describe('putting found tags into a list being edited', () => {
  it('keeps what was typed, in its order, and replaces what a catalogue said before', () => {
    const merged = withLookupTags(
      [
        { tag: 'old one', source: 'itunes' },
        { tag: 'mine', source: 'manual' },
        { tag: 'older', source: 'musicbrainz' },
        { tag: 'also mine', source: 'manual' },
      ],
      { tags: ['Hip Hop', 'pop rap'], source: 'musicbrainz' }
    );
    assert.deepEqual(merged, [
      { tag: 'mine', source: 'manual' },
      { tag: 'also mine', source: 'manual' },
      { tag: 'hip hop', source: 'musicbrainz' },
      { tag: 'pop rap', source: 'musicbrainz' },
    ]);
  });

  it('does not add a tag twice, whatever its case, nor a blank one', () => {
    const merged = withLookupTags([{ tag: 'rock', source: 'manual' }], {
      tags: ['Rock', ' ', 'ROCK', 'İndie', 'indie'],
      source: 'itunes',
    });
    assert.deepEqual(merged, [
      { tag: 'rock', source: 'manual' },
      { tag: 'indie', source: 'itunes' },
    ]);
  });
});

describe('numbers typed into a field', () => {
  const now = new Date(2026, 9, 3);

  it('knows a year from a number', () => {
    assert.equal(typedYear('1994', now), 1994);
    assert.equal(typedYear(' 2027 ', now), 2027);
    assert.equal(typedYear('2028', now), null);
    assert.equal(typedYear('1876', now), null);
    assert.equal(typedYear('94', now), null);
    assert.equal(typedYear('19x4', now), null);
    assert.equal(typedYear('', now), null);
  });

  it('knows a place on a record', () => {
    assert.equal(typedPlace('7'), 7);
    assert.equal(typedPlace('012'), 12);
    assert.equal(typedPlace('0'), null);
    assert.equal(typedPlace('-1'), null);
    assert.equal(typedPlace('1.5'), null);
    assert.equal(typedPlace(''), null);
  });

  it('complains about what is wrong and not about what is empty', () => {
    assert.equal(numberComplaint('', 'year'), null);
    assert.equal(numberComplaint('  ', 'place'), null);
    assert.equal(numberComplaint('1994', 'year'), null);
    assert.ok(numberComplaint('abcd', 'year'));
    assert.ok(numberComplaint('0', 'place'));
  });

  it('complains in Turkish when that is the language', () => {
    const tr = stringsFor('tr');
    assert.equal(numberComplaint('abcd', 'year', tr), 'Bu bir yıl değil.');
    assert.equal(numberComplaint('0', 'place', tr), '1 ya da daha büyük bir tam sayı gir.');
    assert.equal(numberComplaint('1994', 'year', tr), null);
  });
});
