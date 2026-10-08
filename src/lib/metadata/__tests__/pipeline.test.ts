import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runEnrichment, type EnrichProgress, type EnrichStore } from '../pipeline.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { TagSource } from '../../db/tags.ts';
import { stubFetch, track, withoutWaiting, type Answer } from './support.ts';

/** A store that keeps what was written, in place of SQLite. */
function store(): EnrichStore & {
  rows: TrackMetadata[];
  tags: Map<string, string[]>;
  /** Which catalogue each track's tags were filed under. */
  tagSources: Map<string, TagSource>;
} {
  const rows: TrackMetadata[] = [];
  const tags = new Map<string, string[]>();
  const tagSources = new Map<string, TagSource>();
  return {
    rows,
    tags,
    tagSources,
    filterUnenriched: (ids) => ids,
    manualTrackIds: () => new Set(),
    saveLookupTags: (trackId, list, source) => {
      tags.set(trackId, list);
      tagSources.set(trackId, source);
    },
    saveMetadata: (entry) => void rows.push(entry),
  };
}

/**
 * Every test names its own artist, because the client caches resolved artists
 * across lookups on purpose and one test's answer is otherwise another's.
 */
function song(artist: string, id = 'a') {
  return track({ id, artist, title: 'Akuma no Ko' });
}

/** A MusicBrainz recording found, with whatever tags the test wants on it. */
function musicbrainzRoute(tags: { name: string; count: number }[]) {
  return (url: string): Answer | null => {
    if (url.includes('/artist?')) {
      return { body: { artists: [{ id: 'artist-1', name: 'Someone', score: 100 }] } };
    }
    if (url.includes('/artist/')) return { body: { tags } };
    if (url.includes('/recording?')) {
      return {
        body: {
          recordings: [
            { id: 'rec-1', title: 'Akuma no Ko', score: 100, 'first-release-date': '2022-01-01', releases: [] },
          ],
        },
      };
    }
    if (url.includes('musicbrainz')) return { body: {} };
    return null;
  };
}

const itunesHit = (artist: string, genre = 'Hip-Hop/Rap') => ({
  results: [
    {
      trackName: 'Akuma no Ko',
      artistName: artist,
      collectionName: 'Akuma no Ko - Single',
      primaryGenreName: genre,
      releaseDate: '2030-01-01T00:00:00Z',
      artworkUrl100: 'https://example.test/100x100bb.jpg',
    },
  ],
});

describe('runEnrichment', () => {
  it('keeps looking when MusicBrainz finds the recording but names no genre', async () => {
    // The old condition accepted any hit, wrote a row with genre, album and
    // artwork all null, and `filterUnenriched` then skipped it forever.
    const musicbrainz = musicbrainzRoute([]);
    stubFetch((url) => musicbrainz(url) ?? { body: itunesHit('Ai Higuchi') });

    const db = store();
    const result = await withoutWaiting(() =>
      runEnrichment([song('Ai Higuchi')], () => {}, undefined, db)
    );

    assert.equal(result.matched, 1);
    assert.equal(db.rows[0]?.status, 'matched');
    assert.equal(db.rows[0]?.source, 'itunes');
    assert.equal(db.rows[0]?.genre, 'hip hop');
    assert.ok(db.rows[0]?.artworkUrl);
    // Apple dates the reissue it is selling; MusicBrainz dates the recording.
    assert.equal(db.rows[0]?.year, 2022);
  });

  it('stops at MusicBrainz when it does name a genre', async () => {
    const musicbrainz = musicbrainzRoute([{ name: 'j-pop', count: 3 }]);
    const asked = stubFetch((url) => musicbrainz(url) ?? { body: itunesHit('Aimer') });

    const db = store();
    await withoutWaiting(() => runEnrichment([song('Aimer')], () => {}, undefined, db));

    assert.ok(!asked.some((url) => url.includes('itunes.apple.com')));
    assert.equal(db.rows[0]?.genre, 'j-pop');
    assert.deepEqual(db.tags.get('a'), ['j-pop']);
    assert.equal(db.tagSources.get('a'), 'musicbrainz');
  });

  it('records a genre-less hit as a miss rather than freezing the row', async () => {
    // `matched` is final — nothing ever revisits it. A miss is not: it says
    // nothing useful was learned, and `clearMisses` can take it back.
    const musicbrainz = musicbrainzRoute([]);
    stubFetch((url) => musicbrainz(url) ?? { body: { results: [] } });

    const db = store();
    const result = await withoutWaiting(() =>
      runEnrichment([song('Kalafina')], () => {}, undefined, db)
    );

    assert.equal(result.matched, 0);
    assert.equal(result.missed, 1);
    assert.equal(db.rows[0]?.status, 'not_found');
  });

  it('normalises Apple’s genre into the MusicBrainz vocabulary', async () => {
    const musicbrainz = musicbrainzRoute([]);
    stubFetch((url) => musicbrainz(url) ?? { body: itunesHit('Tarkan', 'Türkçe Pop') });

    const db = store();
    await withoutWaiting(() => runEnrichment([song('Tarkan')], () => {}, undefined, db));

    assert.deepEqual(db.tags.get('a'), ['turkish pop']);
    // Filed under whoever answered, not under a default. A tag stamped
    // `musicbrainz` when Apple supplied it is a tag the next MusicBrainz pass
    // believes it wrote itself.
    assert.equal(db.tagSources.get('a'), 'itunes');
  });

  it('treats a query the service refuses as a miss and carries on', async () => {
    // A 400 from a malformed query is not a rate limit, and waiting a minute
    // for it to become one costs the pass an hour over a long library.
    stubFetch(() => ({ status: 400 }));

    const db = store();
    const seen: EnrichProgress[] = [];
    const result = await withoutWaiting(() =>
      runEnrichment([song('Sheena Ringo'), song('Utada Hikaru', 'b')], (p) => seen.push(p), undefined, db)
    );

    assert.equal(result.missed, 2);
    assert.equal(result.stopped, undefined);
    assert.ok(!seen.some((progress) => progress.throttled));
  });

  it('waits when told to slow down, and says so', async () => {
    let answered = 0;
    const musicbrainz = musicbrainzRoute([{ name: 'j-pop', count: 1 }]);
    stubFetch((url) => {
      // Throttle the first track's very first request, then behave.
      if ((answered += 1) === 1) return { status: 429 };
      return musicbrainz(url) ?? { body: { results: [] } };
    });

    const db = store();
    const seen: EnrichProgress[] = [];
    const result = await withoutWaiting(() =>
      runEnrichment([song('Susumu Hirasawa')], (progress) => seen.push(progress), undefined, db)
    );

    assert.ok(seen.some((progress) => progress.throttled));
    assert.equal(result.missed, 0);
    // Nothing was written for the throttled attempt, so the track is still
    // waiting rather than recorded as absent.
    assert.equal(db.rows.filter((row) => row.status === 'not_found').length, 0);
  });

  it('does not take Apple slowing it down for a song Apple does not have', async () => {
    // Apple's rate limit answers 403. Read as a refusal it was written down as
    // a miss, for this track and for every one after it until the limit
    // lifted, and a miss is not looked up again. MusicBrainz knows the
    // recording and no genre for it, which is what sends the question on.
    const musicbrainz = musicbrainzRoute([]);
    stubFetch((url) => {
      if (url.includes('itunes.apple.com')) return { status: 403 };
      return musicbrainz(url) ?? { body: { results: [] } };
    });

    const db = store();
    const seen: EnrichProgress[] = [];
    const result = await withoutWaiting(() =>
      runEnrichment([song('Susumu Hirasawa')], (progress) => seen.push(progress), undefined, db)
    );

    assert.ok(seen.some((progress) => progress.throttled));
    assert.equal(result.missed, 0);
    assert.equal(db.rows.length, 0, 'nothing is settled about a track that was never answered');
  });

  it('gives up rather than grinding when nothing can be reached', async () => {
    stubFetch(() => ({ fail: 'network' }));

    const db = store();
    const seen: EnrichProgress[] = [];
    const tracks = [1, 2, 3, 4, 5, 6].map((n) => song(`Band ${n}`, `t${n}`));
    const result = await withoutWaiting(() =>
      runEnrichment(tracks, (progress) => seen.push(progress), undefined, db)
    );

    assert.equal(result.stopped, 'offline');
    assert.equal(result.cancelled, false);
    assert.equal(db.rows.length, 0, 'an unreachable service is not evidence about a track');
    assert.ok(seen.at(-1)?.offline);
    assert.ok(!seen.at(-1)?.throttled);
  });

  it('resolves rather than rejecting when stopped mid-backoff', async () => {
    // The minute-long wait is exactly when Stop gets pressed, and a rejection
    // out of here would be an unhandled one: nothing awaits this but a screen.
    const controller = new AbortController();
    stubFetch(() => {
      controller.abort();
      return { status: 503 };
    });

    const db = store();
    const result = await withoutWaiting(() =>
      runEnrichment([song('Kokia')], () => {}, controller.signal, db)
    );

    assert.deepEqual(result, { matched: 0, missed: 0, coversSaved: 0, cancelled: true });
  });

  it('resolves with cancelled when stopped before it starts', async () => {
    const controller = new AbortController();
    controller.abort();
    stubFetch(() => ({ body: {} }));

    const result = await withoutWaiting(() =>
      runEnrichment([song('Yuki Kajiura')], () => {}, controller.signal, store())
    );

    assert.equal(result.cancelled, true);
  });

  it('writes down what a lookup learned about a credit', async () => {
    const credits: [string, boolean][] = [];
    const kept = { ...store(), saveCredit: (credit: string, one: boolean) => void credits.push([credit, one]) };
    stubFetch((url) => {
      if (url.includes('/artist?')) {
        // Nobody is called both names; the second of them exists.
        const known = decodeURIComponent(url).includes('"Second Credited"');
        return { body: { artists: known ? [{ id: 'artist-2nd', name: 'Second Credited', score: 100 }] : [] } };
      }
      return musicbrainzRoute([{ name: 'pop', count: 2 }])(url) ?? { body: { results: [] } };
    });

    await withoutWaiting(() =>
      runEnrichment([song('First Credited, Second Credited', 'two')], () => {}, undefined, kept)
    );

    assert.deepEqual(credits, [['First Credited, Second Credited', false]]);
    assert.equal(kept.rows[0]?.status, 'matched');
    // The credit is saved as written, not as the name it was found under.
    assert.equal(kept.rows[0]?.artist, 'First Credited, Second Credited');
    assert.ok(!('credit' in kept.rows[0]!), 'and the verdict is not written into the row');
  });
});
