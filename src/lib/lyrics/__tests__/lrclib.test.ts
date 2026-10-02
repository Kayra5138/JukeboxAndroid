import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchLyrics } from '../lrclib.ts';
import { queryOf, stubFetch, withoutWaiting } from '../../metadata/__tests__/support.ts';

const record = (fields: Record<string, unknown>) => ({
  trackName: 'Akuma no Ko',
  artistName: 'Ai Higuchi',
  albumName: null,
  duration: 240,
  instrumental: false,
  plainLyrics: null,
  syncedLyrics: null,
  ...fields,
});

const WORDS = record({ plainLyrics: 'kimi no na wa' });

describe('fetchLyrics', () => {
  it('keeps going when the first answer is an instrumental', async () => {
    // LRCLIB holds several entries per song. An instrumental is an answer about
    // that entry, not about the track, and returning it used to throw away the
    // remaining lookups and the search behind them.
    let answered = 0;
    stubFetch(() => ({
      body: (answered += 1) === 1 ? record({ instrumental: true }) : WORDS,
    }));

    const found = await withoutWaiting(() =>
      fetchLyrics({
        title: 'Akuma no Ko',
        artist: 'Ai Higuchi',
        album: 'Chainsaw Man',
        durationSec: 240,
      })
    );

    assert.equal(found?.plain, 'kimi no na wa');
  });

  it('keeps going when the first answer has neither kind of lyric', async () => {
    let answered = 0;
    stubFetch(() => ({ body: (answered += 1) === 1 ? record({}) : WORDS }));

    const found = await withoutWaiting(() =>
      fetchLyrics({ title: 'Gurenge', artist: 'LiSA', album: 'LiSA Best Way', durationSec: 240 })
    );

    assert.equal(found?.plain, 'kimi no na wa');
  });

  it('falls through to the search when every exact lookup is useless', async () => {
    const asked = stubFetch((url) =>
      url.includes('/search') ? { body: [WORDS] } : { body: record({ instrumental: true }) }
    );

    const found = await withoutWaiting(() =>
      fetchLyrics({ title: 'Akuma no Ko', artist: 'Ai Higuchi', album: null, durationSec: 240 })
    );

    assert.ok(asked.some((url) => url.includes('/search')));
    assert.equal(found?.plain, 'kimi no na wa');
  });

  it('does not ask the same question twice', async () => {
    // `query` drops empty values, so narrowing by an album that is not there
    // builds byte-for-byte the url that was just requested.
    const asked = stubFetch(() => ({ status: 404 }));

    await withoutWaiting(() =>
      fetchLyrics({ title: 'Shinunoga E-Wa', artist: 'Fujii Kaze', album: null, durationSec: null })
    );

    const lookups = asked.filter((url) => url.includes('/get?'));
    assert.deepEqual([...new Set(lookups)].length, lookups.length, lookups.join('\n'));
  });

  it('tries the song’s own name before the one the tagger wrote', async () => {
    const asked = stubFetch(() => ({ status: 404 }));

    await withoutWaiting(() =>
      fetchLyrics({
        title: 'Ai Higuchi - Akuma no Ko',
        artist: 'Ai Higuchi',
        album: null,
        durationSec: null,
      })
    );

    const first = queryOf(asked[0]!);
    assert.ok(first.includes('track_name=Akuma no Ko'), first);
  });

  it('refuses a search result whose length disagrees', async () => {
    stubFetch((url) =>
      url.includes('/search')
        ? { body: [record({ duration: 300, plainLyrics: 'wrong song' })] }
        : { status: 404 }
    );

    const found = await withoutWaiting(() =>
      fetchLyrics({ title: 'Yakusoku', artist: 'Kalafina', album: null, durationSec: 240 })
    );

    assert.equal(found, null);
  });

  it('stops asking as soon as the caller does', async () => {
    const controller = new AbortController();
    const asked = stubFetch(() => {
      controller.abort();
      return { status: 404 };
    });

    await withoutWaiting(() =>
      fetchLyrics(
        { title: 'Hikaru Nara', artist: 'Goose house', album: null, durationSec: null },
        controller.signal
      ).catch(() => null)
    );

    assert.equal(asked.length, 1);
  });
});
