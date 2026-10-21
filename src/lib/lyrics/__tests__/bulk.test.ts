import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runLyrics, type LyricsItem, type LyricsRunDeps, type StoredWords } from '../bulk.ts';
import type { LocalLyrics } from '../local.ts';
import type { Lyrics } from '../lrclib.ts';
import { networkError } from '../../metadata/http.ts';

/**
 * Lyrics for a run of chosen tracks. Nothing here touches a file, a table or
 * the network: each is a map, and LRCLIB is a function that writes down who
 * it was asked about.
 */

const words = (text: string): Lyrics => ({ plain: text, synced: null });

const item = (id: string): LyricsItem => ({
  id,
  query: { title: `Song ${id}`, artist: 'Someone', album: null, durationSec: 200 },
});

function world({
  stored = {},
  local = {},
  lrclib = () => null,
}: {
  stored?: Record<string, StoredWords>;
  local?: Record<string, LocalLyrics>;
  lrclib?: (id: string) => Lyrics | null;
}) {
  const table = new Map(Object.entries(stored));
  const asked: string[] = [];
  const unreachable: string[] = [];
  const misses: string[] = [];
  const deps: LyricsRunDeps = {
    stored: (id) => table.get(id) ?? null,
    readLocal: async (id) => local[id] ?? null,
    fetch: async (query) => {
      const id = query.title.slice('Song '.length);
      asked.push(id);
      return lrclib(id);
    },
    writeLocal: (id, found) => void table.set(id, { lyrics: found.lyrics, source: found.source }),
    writeLookup: (id, found) => {
      if (found) table.set(id, { lyrics: found, source: 'lookup' });
      else misses.push(id);
    },
    writeUnreachable: (id) => void unreachable.push(id),
    forget: (id) => void table.delete(id),
    wait: async () => {},
  };
  return { deps, table, asked, unreachable, misses };
}

const signal = () => new AbortController().signal;

describe('lyrics for a run of tracks', () => {
  it('leaves words somebody chose alone, and asks nobody about them', async () => {
    const w = world({ stored: { a: { lyrics: words('mine'), source: 'manual' } }, lrclib: () => words('theirs') });
    const result = await runLyrics([item('a')], () => {}, signal(), w.deps);
    assert.deepEqual(w.asked, []);
    assert.equal(w.table.get('a')?.lyrics.plain, 'mine');
    assert.equal(result.chosen, 1);
    assert.equal(result.wanted, 0);
  });

  it('takes the phone’s words before asking LRCLIB', async () => {
    const w = world({ local: { a: { lyrics: words('from the file'), source: 'file' } }, lrclib: () => words('x') });
    const result = await runLyrics([item('a')], () => {}, signal(), w.deps);
    assert.deepEqual(w.asked, []);
    assert.equal(w.table.get('a')?.source, 'file');
    assert.deepEqual([result.found, result.wanted], [1, 1]);
  });

  it('does not ask again about a track that already has words', async () => {
    const w = world({ stored: { a: { lyrics: words('known'), source: 'lookup' } }, lrclib: () => words('x') });
    const result = await runLyrics([item('a')], () => {}, signal(), w.deps);
    assert.deepEqual(w.asked, []);
    assert.deepEqual([result.found, result.wanted, result.had], [0, 0, 1]);
  });

  it('asks LRCLIB about the rest, one after another, and counts what it found', async () => {
    const w = world({ lrclib: (id) => (id === 'b' ? null : words(`words of ${id}`)) });
    const seen: number[] = [];
    const result = await runLyrics([item('a'), item('b'), item('c')], (p) => seen.push(p.done), signal(), w.deps);
    assert.deepEqual(w.asked, ['a', 'b', 'c']);
    assert.deepEqual(w.misses, ['b']);
    assert.deepEqual([result.found, result.wanted], [2, 3]);
    assert.deepEqual(seen, [0, 1, 2, 3]);
  });

  it('asks about words from a file the file no longer has, as if the track were new', async () => {
    const w = world({ stored: { a: { lyrics: words('old tag'), source: 'file' } }, lrclib: () => words('found') });
    const result = await runLyrics([item('a')], () => {}, signal(), w.deps);
    assert.deepEqual(w.asked, ['a']);
    assert.equal(w.table.get('a')?.source, 'lookup');
    assert.deepEqual([result.found, result.wanted, result.had], [1, 1, 0]);
  });

  it('stops after three tracks LRCLIB could not be reached about, writing no misses', async () => {
    const w = world({});
    w.deps.fetch = async (query) => {
      w.asked.push(query.title);
      throw networkError('down');
    };
    const result = await runLyrics(['a', 'b', 'c', 'd'].map(item), () => {}, signal(), w.deps);
    assert.equal(w.asked.length, 3);
    assert.deepEqual(w.unreachable, ['a', 'b', 'c']);
    assert.deepEqual(w.misses, []);
    assert.equal(result.stopped, 'offline');
  });

  it('keeps the answer it had when stopped, and asks nothing more', async () => {
    const controller = new AbortController();
    const w = world({ lrclib: () => words('x') });
    const fetch = w.deps.fetch;
    w.deps.fetch = async (query, stop) => {
      const answer = await fetch(query, stop);
      controller.abort();
      return answer;
    };
    const result = await runLyrics(['a', 'b'].map(item), () => {}, controller.signal, w.deps);
    assert.deepEqual(w.asked, ['a']);
    assert.equal(w.table.get('a')?.lyrics.plain, 'x');
    assert.equal(result.cancelled, true);
    assert.equal(result.found, 1);
  });
});
