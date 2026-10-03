import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookupTrack } from '../musicbrainz.ts';
import { queryOf, stubFetch, track, withoutWaiting } from './support.ts';

/** An artist search answering with one confident hit. */
const artistHit = (id: string) => ({ artists: [{ id, name: 'Someone', score: 100 }] });

describe('musicbrainz lookupTrack', () => {
  it('escapes Lucene syntax in the pinned query', async () => {
    // A raw quote closes the phrase early, MusicBrainz answers 400, and that
    // used to reach the caller looking exactly like a rate limit.
    const asked = stubFetch((url) => {
      if (url.includes('/artist?')) return { body: artistHit('artist-1') };
      if (url.includes('/artist/')) return { body: {} };
      return { body: { recordings: [] } };
    });

    await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Someone', title: 'He said "hi" \\ there' }))
    );

    const searches = asked.filter((url) => url.includes('/recording?')).map(queryOf);
    assert.ok(searches.length > 0);
    for (const search of searches) {
      // Only the two the client puts there itself.
      assert.equal((search.match(/"/g) ?? []).length <= 2, true, search);
      assert.ok(!search.includes('\\'), search);
    }
  });

  it('escapes Lucene syntax in the artist name too', async () => {
    const asked = stubFetch((url) => {
      if (url.includes('/artist?')) return { body: { artists: [] } };
      return { body: { recordings: [] } };
    });

    await withoutWaiting(() => lookupTrack(track({ artist: 'AC/DC (live)', title: 'Anything' })));

    const search = queryOf(asked.find((url) => url.includes('/artist?'))!);
    assert.equal((search.match(/"/g) ?? []).length, 2);
    assert.ok(!search.includes('/'));
    assert.ok(!search.includes('('));
  });

  it('asks about one artist once however the name is accented', async () => {
    const asked = stubFetch((url) => {
      if (url.includes('/artist?')) return { body: artistHit('artist-ito') };
      if (url.includes('/artist/')) return { body: { tags: [{ name: 'j-pop', count: 3 }] } };
      return { body: { recordings: [] } };
    });

    await withoutWaiting(async () => {
      await lookupTrack(track({ artist: 'Kanako Itō', title: 'Fatima' }));
      await lookupTrack(track({ artist: 'Kanako Ito', title: 'Hacking to the Gate' }));
    });

    assert.equal(asked.filter((url) => url.includes('/artist?')).length, 1);
  });

  it('takes genres from the album rather than a compilation it also appeared on', async () => {
    const asked = stubFetch((url) => {
      if (url.includes('/artist?')) return { body: artistHit('artist-2') };
      if (url.includes('/artist/')) return { body: {} };
      if (url.includes('/recording?')) {
        return {
          body: {
            recordings: [
              {
                id: 'rec-1',
                title: 'Filament',
                score: 100,
                'first-release-date': '2011-05-25',
                releases: [
                  { 'release-group': { id: 'rg-compilation', 'primary-type': 'Album', 'secondary-types': ['Compilation'] } },
                  { 'release-group': { id: 'rg-album', 'primary-type': 'Album' } },
                ],
              },
            ],
          },
        };
      }
      return { body: { genres: [{ name: 'gothic rock', count: 4 }] } };
    });

    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Yousei Teikoku', title: 'Filament' }))
    );

    assert.ok(asked.some((url) => url.includes('/release-group/rg-album')));
    assert.ok(!asked.some((url) => url.includes('/release-group/rg-compilation')));
    assert.deepEqual(found?.genres, ['gothic rock']);
    assert.equal(found?.year, 2011);
  });

  it('prefers the recording’s own genres to the ones it inherits', async () => {
    stubFetch((url) => {
      if (url.includes('/artist?')) return { body: artistHit('artist-3') };
      if (url.includes('/artist/')) return { body: { tags: [{ name: 'pop', count: 1 }] } };
      if (url.includes('/recording?')) {
        return {
          body: {
            recordings: [
              {
                id: 'rec-2',
                title: 'Filament',
                score: 100,
                tags: [{ name: 'symphonic metal', count: 1 }],
                releases: [],
              },
            ],
          },
        };
      }
      return { body: {} };
    });

    // A different artist from the test above, because the artist cache is
    // shared and answering twice for one name is the point of it.
    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Denkare', title: 'Filament' }))
    );

    assert.deepEqual(found?.genres, ['symphonic metal', 'pop']);
  });

  it('refuses a recording whose title does not agree, however it ranked', async () => {
    stubFetch((url) => {
      if (url.includes('/artist?')) return { body: artistHit('artist-4') };
      if (url.includes('/artist/')) return { body: {} };
      if (url.includes('/recording?')) {
        return {
          body: {
            recordings: [
              { id: 'rec-3', title: 'Something Else Entirely', score: 100, releases: [] },
            ],
          },
        };
      }
      return { body: {} };
    });

    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Yousei Teikoku', title: 'Filament' }))
    );

    assert.equal(found, null);
  });

  /** Answers as a catalogue that knows `known` artists and one song by `owner`. */
  const catalogue = (known: Record<string, string>, owner: string, song: string) => (url: string) => {
    if (url.includes('/artist?')) {
      const asked = queryOf(url);
      const name = Object.keys(known).find((each) => asked.includes(`"${each}"`));
      return { body: { artists: name ? [{ id: known[name], name, score: 100 }] : [] } };
    }
    if (url.includes('/artist/')) return { body: { tags: [{ name: 'hip hop', count: 5 }] } };
    if (url.includes('/recording?')) {
      const hit = queryOf(url).includes(`arid:${owner} `);
      return {
        body: { recordings: hit ? [{ id: 'rec-9', title: song, score: 100, releases: [] }] : [] },
      };
    }
    return { body: {} };
  };

  it('finds a song under one of two artists when no artist has both their names', async () => {
    // What used to happen: `"Rihanna, Slim Shady"` resolved to nobody and the
    // search ended there, one request short of the song.
    const asked = stubFetch(catalogue({ Rihanna: 'id-rihanna', 'Slim Shady': 'id-shady' }, 'id-shady', 'Love the Way You Lie'));

    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Rihanna, Slim Shady', title: 'Love the Way You Lie' }))
    );

    assert.equal(found?.title, 'Love the Way You Lie');
    // Saved as it was written; the catalogue is not allowed to rename it.
    assert.equal(found?.artist, 'Rihanna, Slim Shady');
    assert.equal(found?.oneArtist, false, 'found under a name out of the credit');
    assert.deepEqual(found?.genres, ['hip hop']);

    const artists = asked.filter((url) => url.includes('/artist?')).map(queryOf);
    assert.ok(artists[0]!.includes('"Rihanna, Slim Shady"'), 'the credit as written is asked first');
    assert.ok(artists.some((search) => search.includes('"Slim Shady"')));
  });

  it('finds it for a credit written with feat. and for a guest left in the title', async () => {
    stubFetch(catalogue({ 'Marshall M': 'id-marshall', Dido: 'id-dido' }, 'id-marshall', 'Stan'));
    const byCredit = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Marshall M feat. Dido', title: 'Stan' }))
    );
    assert.equal(byCredit?.title, 'Stan');

    const asked = stubFetch(catalogue({ 'Marshall B': 'id-b' }, 'id-b', 'Stan'));
    const byTitle = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Marshall B', title: 'Stan ft. Dido (Official Video)' }))
    );
    assert.equal(byTitle?.title, 'Stan');
    assert.equal(byTitle?.oneArtist, null, 'one name in the credit, so nothing to settle');
    const search = queryOf(asked.find((url) => url.includes('/recording?'))!);
    assert.ok(search.includes('recording:"Stan"'), search);
  });

  it('says a credit is one artist when the catalogue has it whole', async () => {
    stubFetch(catalogue({ 'Oliver & Friends': 'id-duo' }, 'id-duo', 'Song'));
    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Oliver & Friends', title: 'Song' }))
    );
    assert.equal(found?.oneArtist, true);
  });

  it('does not ask about every name on a long credit', async () => {
    const asked = stubFetch(() => ({ body: { artists: [], recordings: [] } }));
    await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Aa1, Bb2, Cc3, Dd4, Ee5, Ff6, Gg7', title: 'Posse Cut' }))
    );
    // The credit as written and the first three names in it.
    assert.equal(asked.filter((url) => url.includes('/artist?')).length, 4);
  });

  it('takes the earliest of several recordings with the same title', async () => {
    stubFetch((url) => {
      if (url.includes('/artist?')) return { body: artistHit('artist-dated') };
      if (url.includes('/artist/')) return { body: {} };
      if (url.includes('/recording?')) {
        return {
          body: {
            recordings: [
              { id: 'reissue', title: 'Dated Song', score: 100, 'first-release-date': '2022-03-01', releases: [] },
              { id: 'undated', title: 'Dated Song', score: 99, releases: [] },
              { id: 'album', title: 'Dated Song', score: 98, 'first-release-date': '2010-06-18', releases: [] },
              { id: 'other', title: 'Another Song Entirely', score: 97, 'first-release-date': '1999-01-01', releases: [] },
            ],
          },
        };
      }
      return { body: {} };
    });

    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Dated Artist', title: 'Dated Song' }))
    );
    assert.equal(found?.year, 2010);
  });
});
