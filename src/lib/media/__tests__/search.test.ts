import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { search } from '../search.ts';
import type { EnrichedTrack } from '../enriched.ts';
import { track } from '../../__tests__/support.ts';

function song(
  id: string,
  fields: Partial<EnrichedTrack> & { title: string }
): EnrichedTrack {
  return {
    ...track({ id, title: fields.title }),
    genre: null,
    year: null,
    discNumber: null,
    tags: [],
    enriched: false,
    ...fields,
  };
}

const library: EnrichedTrack[] = [
  song('1', { title: 'Şımarık', artist: 'Tarkan', tags: ['turkish pop', 'pop'] }),
  song('2', { title: 'Kaikai Kitan', artist: 'Eve', album: 'Smile', tags: ['j-rock', 'rock'] }),
  song('3', { title: 'Filth in the Beauty', artist: 'the GazettE', tags: ['post-rock'] }),
  song('4', { title: 'Weightless', artist: 'Marconi Union', tags: [] }),
];

describe('search', () => {
  it('hands back everything when nothing has been typed', () => {
    assert.deepEqual(search(library, '').tracks, library);
    assert.deepEqual(search(library, '   ').matchedTags, []);
  });

  it('matches a title through the accents the keyboard did not produce', () => {
    const { tracks } = search(library, 'simarik');
    assert.deepEqual(
      tracks.map((entry) => entry.id),
      ['1']
    );
  });

  it('matches artists and albums as well as titles', () => {
    assert.deepEqual(
      search(library, 'marconi').tracks.map((entry) => entry.id),
      ['4']
    );
    assert.deepEqual(
      search(library, 'smile').tracks.map((entry) => entry.id),
      ['2']
    );
  });

  it('ignores case the Turkish way round', () => {
    // Folding with Turkish casing rules turns INDIE into ındıe and matches
    // nothing, which is why the folding is deliberately ASCII.
    assert.equal(search(library, 'KAIKAI').tracks.length, 1);
    assert.equal(search(library, 'ŞIMARIK').tracks.length, 1);
  });

  it('finds tracks by tag and names the tags it matched', () => {
    const { tracks, matchedTags } = search(library, 'rock');

    assert.deepEqual(
      tracks.map((entry) => entry.id),
      ['2', '3']
    );
    // An exact name first: asking for "rock" means rock before post-rock.
    assert.deepEqual(matchedTags, ['rock', 'j-rock', 'post-rock']);
  });

  it('offers no tags when the query only matched words in a title', () => {
    assert.deepEqual(search(library, 'weightless').matchedTags, []);
  });

  it('returns nothing rather than everything for a query that matches nothing', () => {
    const { tracks, matchedTags } = search(library, 'zzzz');
    assert.deepEqual(tracks, []);
    assert.deepEqual(matchedTags, []);
  });

  it('does not count the same tag twice across tracks', () => {
    assert.deepEqual(search(library, 'pop').matchedTags, ['pop', 'turkish pop']);
  });
});
