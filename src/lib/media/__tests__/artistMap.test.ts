import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { insideRing, layoutArtistMap, linksOf, mostNamed, nodesInside, pinOf, radiusFor, type ArtistMapLayout, type MapInput } from '../artistMap.ts';

function artist(key: string, trackIds: string[], genre: string | null = null): MapInput {
  return { key, name: key, trackIds, genre };
}

describe('artist map', () => {
  it('joins two artists for each song they share', () => {
    const links = linksOf([artist('a', ['1', '2', '3']), artist('b', ['2', '3']), artist('c', ['4'])]);
    assert.deepEqual(links, [{ a: 0, b: 1, weight: 2 }]);
  });

  it('files an artist under the genre most of their songs name', () => {
    assert.equal(mostNamed(['Rock', 'pop', 'rock', null]), 'rock');
    assert.equal(mostNamed([null, '  ']), null);
  });

  it('draws an artist with more songs bigger', () => {
    assert.ok(radiusFor(20) > radiusFor(2));
    assert.ok(radiusFor(1) > 0);
  });

  it('lays everybody out without one on top of another, the same way every time', () => {
    const artists: MapInput[] = [];
    for (let i = 0; i < 80; i++) {
      const genre = ['rock', 'pop', 'jazz', null][i % 4] ?? null;
      artists.push(artist(`a${i}`, Array.from({ length: 1 + (i % 9) }, (_, n) => `${i}-${n}`), genre));
    }
    artists[1]!.trackIds = [...artists[1]!.trackIds, '0-0'];
    const first = layoutArtistMap(artists);
    const again = layoutArtistMap(artists);
    assert.deepEqual(first.nodes, again.nodes);
    let worst = 0;
    for (let i = 0; i < first.nodes.length; i++) {
      for (let j = i + 1; j < first.nodes.length; j++) {
        const a = first.nodes[i]!;
        const b = first.nodes[j]!;
        worst = Math.max(worst, a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    assert.ok(worst < 4, `circles overlap by ${worst}`);
    for (const node of first.nodes) {
      assert.ok(node.x - node.r >= 0 && node.y - node.r >= 0);
      assert.ok(node.x + node.r <= first.width && node.y + node.r <= first.height);
    }
    assert.deepEqual(first.genres.map((genre) => genre.name).sort(), ['jazz', 'pop', 'rock']);
  });

  it('finds who a ring drawn round some of the map has inside it, by their middles', () => {
    // A square, and a hook shape with a bay in it.
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    assert.equal(insideRing(square, 5, 5), true);
    assert.equal(insideRing(square, 15, 5), false);
    const hook = [0, 0, 10, 0, 10, 10, 6, 10, 6, 4, 4, 4, 4, 10, 0, 10];
    assert.equal(insideRing(hook, 2, 8), true);
    assert.equal(insideRing(hook, 5, 8), false, 'the bay is outside');
    assert.equal(insideRing([0, 0, 10, 10], 5, 5), false, 'two points are no ring');
    assert.deepEqual(nodesInside([{ x: 5, y: 5 }, { x: 20, y: 5 }, { x: 9, y: 1 }], square), [0, 2]);
  });

  /** A library of a few dozen artists in three genres, some of them sharing songs. */
  function library(extra: MapInput[] = []): MapInput[] {
    const out: MapInput[] = [];
    const genres = ['rock', 'pop', 'jazz'];
    for (let i = 0; i < 36; i++) {
      const songs = Array.from({ length: 1 + (i % 7) }, (_, at) => `s${i}-${at}`);
      if (i % 5 === 0 && i > 0) songs.push(`s${i - 1}-0`);
      out.push(artist(`a${i}`, songs, genres[i % 3]!));
    }
    return [...out, ...extra];
  }
  /** Where [key] is on [layout], against where it is on [before], once the two are put in the same place. */
  function moved(layout: ArtistMapLayout, before: ArtistMapLayout, key: string): number {
    const now = layout.nodes.find((node) => node.key === key)!;
    const was = before.nodes.find((node) => node.key === key)!;
    return Math.hypot(now.x - layout.offset!.x - was.x, now.y - layout.offset!.y - was.y);
  }

  it('laid out again from before, leaves everybody about where they were, and finds the newcomer a place', () => {
    const first = layoutArtistMap(library());
    const again = layoutArtistMap(library([artist('new', ['n1', 'n2', 'n3'], 'pop')]), { previous: first });
    const shifts = first.nodes.map((node) => moved(again, first, node.key)).sort((a, b) => a - b);
    // Most hardly move; the newcomer's neighbours give a little room.
    assert.ok(shifts[Math.floor(shifts.length / 2)]! < 2, `the middle one moved ${shifts[Math.floor(shifts.length / 2)]}`);
    const newcomer = again.nodes.find((node) => node.key === 'new')!;
    for (const node of again.nodes) {
      if (node === newcomer) continue;
      assert.ok(Math.hypot(node.x - newcomer.x, node.y - newcomer.y) > node.r + newcomer.r - 4, 'the newcomer is on top of somebody');
    }
  });

  it('keeps somebody put by hand where they were put, from the middle of their genre, and the rest out of their way', () => {
    const first = layoutArtistMap(library());
    const target = first.nodes.find((node) => node.key === 'a7')!;
    const pin = pinOf(first, { genre: target.genre, x: target.x + 300, y: target.y - 120 })!;
    const again = layoutArtistMap(library(), { previous: first, pins: { a7: pin } });
    const held = again.nodes.find((node) => node.key === 'a7')!;
    const disc = again.discs!.find((one) => one.name === pin.genre)!;
    assert.ok(Math.abs(held.x - (disc.x + pin.dx)) < 0.01 && Math.abs(held.y - (disc.y + pin.dy)) < 0.01);
    // And laid out from nothing, still beside their genre where they were put.
    const anew = layoutArtistMap(library(), { pins: { a7: pin } });
    const there = anew.nodes.find((node) => node.key === 'a7')!;
    const home = anew.discs!.find((one) => one.name === pin.genre)!;
    assert.ok(Math.abs(there.x - (home.x + pin.dx)) < 0.01 && Math.abs(there.y - (home.y + pin.dy)) < 0.01);
    for (const node of anew.nodes) {
      if (node === there) continue;
      assert.ok(Math.hypot(node.x - there.x, node.y - there.y) > node.r + there.r - 4, `${node.key} is on top of the one held`);
    }
  });

  it('draws nothing for nobody', () => {
    assert.deepEqual(layoutArtistMap([]), { nodes: [], links: [], genres: [], discs: [], width: 0, height: 0, offset: { x: 0, y: 0 } });
  });
});
