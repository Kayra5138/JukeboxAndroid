import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { MAX_BANDS, autoPreampDb, heldBand, type Band, type Preset } from '../bands.ts';
import {
  BUILT_IN,
  MAX_NAME,
  MAX_PRESETS,
  freeName,
  labelOf,
  matching,
  removed,
  renamed,
  saved,
} from '../presets.ts';
import { stringsFor } from '../../i18n/languages.ts';

const bass: Band[] = [{ type: 'lowShelf', frequencyHz: 80, gainDb: 4, q: 0.7 }];
const mine: Preset[] = [
  { name: 'Car', preampDb: null, bands: bass },
  { name: 'HD 650', preampDb: -6.2, bands: [{ type: 'peak', frequencyHz: 105, gainDb: -3.4, q: 0.7 }] },
];

describe('the starting points', () => {
  it('begin with flat, which is no bands at all', () => {
    assert.equal(BUILT_IN[0].name, 'Flat');
    assert.deepEqual(BUILT_IN[0].bands, []);
  });

  it('are each a curve the equalizer could be set to', () => {
    const names = new Set<string>();
    for (const preset of BUILT_IN) {
      assert.ok(preset.bands.length <= MAX_BANDS, preset.name);
      for (const band of preset.bands) assert.deepEqual(heldBand(band), band, preset.name);
      // Modest: nothing here asks for more than six decibels of room.
      assert.ok(autoPreampDb(preset.bands) >= -6.5, preset.name);
      assert.equal(preset.preampDb, null, preset.name);
      names.add(preset.name.toLowerCase());
    }
    assert.equal(names.size, BUILT_IN.length);
  });
});

describe('which preset a curve is', () => {
  it('is the one it matches exactly', () => {
    assert.equal(matching([], null, BUILT_IN), 'Flat');
    assert.equal(matching(bass, null, mine), 'Car');
    assert.equal(matching(mine[1].bands, -6.2, mine), 'HD 650');
  });

  it('is none once anything about it has moved', () => {
    assert.equal(matching([{ ...bass[0], gainDb: 4.5 }], null, mine), null);
    assert.equal(matching(bass, -2, mine), null);
    assert.equal(matching(mine[1].bands, null, mine), null);
    assert.equal(matching([...bass, ...bass], null, mine), null);
  });
});

describe('a name nothing else has', () => {
  it('is the one asked for when it is free', () => {
    assert.equal(freeName('  Kitchen ', ['Car']), 'Kitchen');
  });

  it('is counted up from when it is not, whatever the case', () => {
    assert.equal(freeName('car', ['Car']), 'car 2');
    assert.equal(freeName('Car', ['Car', 'car 2']), 'Car 3');
  });

  it('is never empty and never too long for a chip', () => {
    assert.equal(freeName('   ', []), 'My curve');
    assert.equal(freeName('x'.repeat(200), []).length, MAX_NAME);
    assert.ok(freeName('x'.repeat(200), ['x'.repeat(MAX_NAME)]).length <= MAX_NAME);
  });

  it('is named in Turkish when nothing was typed', () => {
    assert.equal(freeName('   ', [], stringsFor('tr')), 'Eğrim');
  });
});

describe('what a preset is called on screen', () => {
  it('is its own name in English, and for anything of the user\'s', () => {
    assert.equal(labelOf('Warm'), 'Warm');
    assert.equal(labelOf('Car', stringsFor('tr')), 'Car');
  });

  it('is translated for a built-in, which keeps the name it is stored under', () => {
    const tr = stringsFor('tr');
    assert.equal(labelOf('Warm', tr), 'Sıcak');
    for (const preset of BUILT_IN) assert.notEqual(labelOf(preset.name, tr), '');
    // Neither what a built-in is kept as nor what it is shown as can be taken.
    assert.equal(saved(mine, 'Sıcak', bass, null, tr).name, 'Sıcak 2');
    assert.equal(saved(mine, 'Warm', bass, null, tr).name, 'Warm 2');
  });
});

describe('keeping a curve', () => {
  it('adds it under its name', () => {
    const { presets, name } = saved(mine, 'Kitchen', bass, -1);
    assert.equal(name, 'Kitchen');
    assert.equal(presets.length, 3);
    assert.deepEqual(presets[2], { name: 'Kitchen', preampDb: -1, bands: bass });
    // The list handed in is not the one changed.
    assert.equal(mine.length, 2);
  });

  it('replaces one of the user\'s own with the same name, where it was', () => {
    const { presets, name } = saved(mine, 'car', [], null);
    assert.equal(name, 'Car');
    assert.equal(presets.length, 2);
    assert.deepEqual(presets[0], { name: 'Car', preampDb: null, bands: [] });
  });

  it('cannot take a built-in\'s name', () => {
    const { presets, name } = saved(mine, 'Flat', bass, null);
    assert.equal(name, 'Flat 2');
    assert.equal(presets[2].name, 'Flat 2');
  });

  it('holds what it keeps inside the limits', () => {
    const wild = [{ type: 'peak', frequencyHz: 1, gainDb: 99, q: 99 }] as Band[];
    const { presets } = saved([], 'Wild', wild, -99);
    assert.deepEqual(presets[0].bands, [{ type: 'peak', frequencyHz: 20, gainDb: 20, q: 10 }]);
    assert.equal(presets[0].preampDb, -30);
  });

  it('lets the oldest go rather than refuse a new one', () => {
    let presets: Preset[] = [];
    for (let count = 0; count < MAX_PRESETS + 3; count++) {
      presets = saved(presets, `Curve ${count}`, bass, null).presets;
    }
    assert.equal(presets.length, MAX_PRESETS);
    assert.equal(presets[0].name, 'Curve 3');
    assert.equal(presets[MAX_PRESETS - 1].name, `Curve ${MAX_PRESETS + 2}`);
  });
});

describe('renaming and removing', () => {
  it('renames in place', () => {
    const { presets, name } = renamed(mine, 'Car', 'Van');
    assert.equal(name, 'Van');
    assert.deepEqual(presets.map((preset) => preset.name), ['Van', 'HD 650']);
    assert.deepEqual(presets[0].bands, bass);
  });

  it('will not rename onto another, or onto a built-in', () => {
    assert.equal(renamed(mine, 'Car', 'hd 650').name, 'hd 650 2');
    assert.equal(renamed(mine, 'Car', 'Warm').name, 'Warm 2');
    // Its own name, in another case, is not a collision.
    assert.equal(renamed(mine, 'Car', 'CAR').name, 'CAR');
  });

  it('leaves everything alone when asked about one that is not there', () => {
    assert.deepEqual(renamed(mine, 'Boat', 'Ship'), { presets: mine, name: 'Boat' });
    assert.deepEqual(removed(mine, 'Boat'), mine);
  });

  it('removes by name', () => {
    assert.deepEqual(removed(mine, 'Car').map((preset) => preset.name), ['HD 650']);
  });
});
