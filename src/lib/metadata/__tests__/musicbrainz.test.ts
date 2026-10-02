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
});
