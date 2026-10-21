import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { planSpread, runSpread, type SpreadDeps } from '../spread.ts';
import type { CoverFill } from '../../db/metadata.ts';
import type { EnrichedTrack } from '../../media/enriched.ts';
import { track } from '../../__tests__/support.ts';

const song = (id: string, fields: Partial<EnrichedTrack> = {}): EnrichedTrack => ({
  ...track({ id, title: `Song ${id}` }),
  genre: null,
  year: null,
  discNumber: null,
  tags: [],
  enriched: false,
  ...fields,
});

const COVER = 'file:///covers/ruins.jpg';
const OTHER = 'file:///covers/other.jpg';
const NONE = new Set<string>();

/** A phone whose files carry pictures as [pictures] says, unknown until opened where [closed] says. */
function phone(pictures: Record<string, boolean>, closed: string[] = []) {
  const fills: CoverFill[] = [];
  const opened: string[][] = [];
  const kept: string[] = [];
  const deps: SpreadDeps = {
    pictures: async (ids, open) => {
      if (open) opened.push(ids);
      return new Map(ids.map((id) => [id, !open && closed.includes(id) ? null : (pictures[id] ?? false)]));
    },
    keepPicture: async (id) => {
      kept.push(id);
      return `file:///covers/kept-${id}.jpg`;
    },
    fill: (given) => {
      fills.push(...given);
      return given.flatMap((fill) => fill.trackIds);
    },
  };
  return { deps, fills, opened, kept };
}

describe('which records have a cover to give', () => {
  it('is those with a covered track and a bare one, and nothing else', () => {
    const plans = planSpread(
      [
        song('1', { album: 'Ruins', artist: 'A', artworkUri: COVER }),
        song('2', { album: 'Ruins', artist: 'A' }),
        song('3', { album: 'Whole', artist: 'B', artworkUri: COVER }),
        song('4', { album: 'Whole', artist: 'B', artworkUri: COVER }),
        song('5', { album: 'Bare', artist: 'C' }),
        song('6', { album: 'Bare', artist: 'C' }),
      ],
      { removed: NONE }
    );
    assert.deepEqual(plans.map((plan) => [plan.album.name, plan.cover, plan.wanting.map((t) => t.id)]), [
      ['Ruins', COVER, ['2']],
    ]);
  });

  it('gives the cover most of the record wears, and the first met between equals', () => {
    const [plan] = planSpread(
      [
        song('1', { album: 'Ruins', trackNumber: 1, artworkUri: OTHER }),
        song('2', { album: 'Ruins', trackNumber: 2, artworkUri: COVER }),
        song('3', { album: 'Ruins', trackNumber: 3, artworkUri: COVER }),
        song('4', { album: 'Ruins', trackNumber: 4 }),
      ],
      { removed: NONE }
    );
    assert.equal(plan?.cover, COVER);
  });

  it('leaves out a track somebody took the cover off, and one by another artist on a record known by name', () => {
    const [plan] = planSpread(
      [
        song('1', { album: 'Greatest Hits', artist: 'Queen', artworkUri: COVER }),
        song('2', { album: 'Greatest Hits', artist: 'Queen' }),
        song('3', { album: 'Greatest Hits', artist: 'Queen' }),
        song('4', { album: 'Greatest Hits', artist: 'Queen & Guest' }),
        song('5', { album: 'Greatest Hits', artist: 'ABBA' }),
      ],
      { removed: new Set(['3']) }
    );
    assert.deepEqual(plan?.wanting.map((t) => t.id), ['2', '4']);
  });

  it('gives a compilation’s cover to every artist on it, and a record’s to every guest when its album artist is known', () => {
    const plans = planSpread(
      [
        song('1', { album: 'Now', artist: 'One', artworkUri: COVER }),
        song('2', { album: 'Now', artist: 'Two' }),
        song('3', { album: 'Now', artist: 'Three' }),
        song('4', { album: 'Ruins', artist: 'Aurora', albumArtist: 'Aurora', artworkUri: OTHER }),
        song('5', { album: 'Ruins', artist: 'Somebody', albumArtist: 'Aurora' }),
      ],
      { removed: NONE }
    );
    assert.deepEqual(plans.map((plan) => plan.wanting.map((t) => t.id)), [['2', '3'], ['5']]);
  });

  it('keeps to the records something happened to, when asked to', () => {
    const plans = planSpread(
      [
        song('1', { album: 'A', artworkUri: COVER }),
        song('2', { album: 'A' }),
        song('3', { album: 'B', artworkUri: COVER }),
        song('4', { album: 'B' }),
      ],
      { removed: NONE, only: new Set(['4']) }
    );
    assert.deepEqual(plans.map((plan) => plan.album.name), ['B']);
  });

  it('plans a record with no cover of the app’s own only when its files may be asked about', () => {
    const tracks = [song('1', { album: 'Bare' }), song('2', { album: 'Bare' })];
    assert.equal(planSpread(tracks, { removed: NONE }).length, 0);
    assert.equal(planSpread(tracks, { removed: NONE, embedded: true }).length, 1);
  });
});

describe('giving the cover', () => {
  it('goes only to the tracks whose files carry no picture', async () => {
    const plans = planSpread(
      [
        song('1', { album: 'Ruins', artworkUri: COVER }),
        song('2', { album: 'Ruins' }),
        song('3', { album: 'Ruins' }),
      ],
      { removed: NONE }
    );
    const { deps, fills } = phone({ '3': true });
    assert.deepEqual(await runSpread(plans, deps), ['2']);
    assert.deepEqual(fills, [{ trackIds: ['2'], uri: COVER, album: null }]);
  });

  it('opens only the files nobody has looked into, and only those of tracks that could take a cover', async () => {
    const plans = planSpread(
      [
        song('1', { album: 'Ruins', artworkUri: COVER }),
        song('2', { album: 'Ruins' }),
        song('3', { album: 'Ruins' }),
      ],
      { removed: NONE }
    );
    const { deps, opened } = phone({}, ['3']);
    assert.deepEqual(await runSpread(plans, deps), ['2', '3']);
    assert.deepEqual(opened, [['3']]);
  });

  it('keeps the first picture in a record’s files and gives it to the tracks with none', async () => {
    const plans = planSpread(
      [
        song('1', { album: 'Bare', trackNumber: 1 }),
        song('2', { album: 'Bare', trackNumber: 2 }),
        song('3', { album: 'Bare', trackNumber: 3 }),
      ],
      { removed: NONE, embedded: true }
    );
    const { deps, fills, kept } = phone({ '2': true, '3': true });
    assert.deepEqual(await runSpread(plans, deps), ['1']);
    assert.deepEqual(kept, ['2']);
    assert.deepEqual(fills, [{ trackIds: ['1'], uri: 'file:///covers/kept-2.jpg', album: null }]);
  });

  it('does nothing more once whoever asked has gone', async () => {
    const plans = planSpread(
      [song('1', { album: 'Ruins', artworkUri: COVER }), song('2', { album: 'Ruins' })],
      { removed: NONE }
    );
    const { deps, fills } = phone({}, ['2']);
    assert.deepEqual(await runSpread(plans, { ...deps, stopped: () => true }), []);
    assert.deepEqual(fills, []);
  });
});
