import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { outlined, outlinedClip } from '../edges.ts';
import { backdropOf, finishOf, page } from '../effects.ts';
import { THEMES } from '../registry.ts';
import { auroraColours } from '../themes/aurora.ts';
import { auroraLightColours } from '../themes/auroraLight.ts';
import type { Palette } from '../tokens.ts';

/*
  React Native 0.86 keeps a border side a style stopped giving as "not a
  number", and a gradient behind such a view is worked out from it and refused
  by Android, which closes the app: a row of the lyrics' search results, put
  aside and used again for a card of glass, did that. Wherever a style puts a
  gradient behind a view, it gives every side's width as well (`edgesAt`).
*/

const SIDES = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const;

const palettes: { name: string; colours: Palette }[] = [
  ...THEMES.map((theme) => ({ name: theme.id, colours: theme.colours })),
  { name: 'cover glass, made', colours: auroraColours(['#2a4d8f', '#c0392b', '#f1c40f']) },
  { name: 'cover glass light, made', colours: auroraLightColours(['#2a4d8f', '#c0392b', '#f1c40f']) },
];

function sidesGiven(name: string, style: object | null) {
  if (!style || !('experimental_backgroundImage' in style)) return;
  for (const side of SIDES) assert.equal(typeof (style as Record<string, unknown>)[side], 'number', `${name}: ${side}`);
}

describe('a gradient behind a view', () => {
  it('comes with every side of its border given', () => {
    let gradients = 0;
    for (const { name, colours } of palettes) {
      for (const [what, style] of [
        ['outlined', outlined(colours)],
        ['outlinedClip', outlinedClip(colours)],
        ['page', page(colours)],
        ['backdrop', backdropOf(colours)],
        ['finish', finishOf(colours, 1)],
      ] as const) {
        if (style && 'experimental_backgroundImage' in style) gradients += 1;
        sidesGiven(`${name} ${what}`, style);
      }
    }
    // The themes of glass do draw gradients, so the test has something to look at.
    assert.ok(gradients > 0);
  });

  it('gives the sides the width of the edge itself', () => {
    for (const { name, colours } of palettes) {
      const edge = outlined(colours) as Record<string, unknown>;
      if (!('experimental_backgroundImage' in edge)) continue;
      for (const side of SIDES) assert.equal(edge[side], edge.borderWidth, `${name}: ${side}`);
    }
  });
});
