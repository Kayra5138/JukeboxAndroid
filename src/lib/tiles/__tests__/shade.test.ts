import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { keyShades, laneShades, lift } from '../shade.ts';

const rgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

describe('moving a colour towards white or black', () => {
  it('keeps the hue rather than shifting it', () => {
    /*
      The reason this mixes with white instead of multiplying. A saturated red
      scaled up is the same red with its other channels still at nothing --
      which is not a highlight, it is the same colour claiming to be brighter.
      Mixing raises every channel, so the result is recognisably the lighter
      version of what went in.
    */
    const [r, g, b] = rgb(lift('#cc2200', 0.4));
    assert.ok(g! > 0 && b! > 0, 'the other channels have to come up too');
    assert.ok(r! > 0xcc, 'and the strong one still rises');
  });

  it('goes the other way for a shadow', () => {
    const [r] = rgb(lift('#cc2200', -0.4));
    assert.ok(r! < 0xcc);
  });

  it('cannot leave the range however far it is pushed', () => {
    for (const v of rgb(lift('#ffffff', 0.9))) assert.ok(v! <= 255);
    for (const v of rgb(lift('#000000', -0.9))) assert.ok(v! >= 0);
  });

  it('hands back anything it cannot read, rather than a colour nobody asked for', () => {
    assert.equal(lift('not a colour', 0.5), 'not a colour');
  });
});

describe('the three a key is painted with', () => {
  it('runs light to dark, whatever the sleeve gave', () => {
    for (const stops of [['#3366cc'], ['#3366cc', '#aa2244'], [], ['#abc']]) {
      const [light, middle, dark] = keyShades(stops);
      const sum = (c: string) => rgb(c).reduce((a, b) => a + b!, 0);
      assert.ok(sum(light) > sum(middle), `light over middle for ${stops}`);
      assert.ok(sum(middle) > sum(dark), `middle over dark for ${stops}`);
    }
  });

  it('derives both ends from the face rather than from the sleeve', () => {
    /*
      This encoded the opposite once, and the opposite was wrong. Painting a key
      from one of the record's colours to another sounds better and cannot be
      ordered: a dark navy over a warm orange is a key lit from below. Only the
      face is the record's; the light and the shadow are made from it.
    */
    assert.deepEqual(keyShades(['#1133aa', '#cc8822']), keyShades(['#cc8822']));
  });

  it('never answers with something that cannot be painted', () => {
    for (const c of keyShades(['nonsense', ''])) {
      assert.match(c, /^#[0-9a-f]{6}$/);
    }
  });
});

describe('one palette per column', () => {
  const sum = (c: string) => rgb(c).reduce((a, b) => a + b!, 0);

  it('tells the four columns apart from a sleeve that gave one colour', () => {
    const faces = [0, 1, 2, 3].map((lane) => laneShades(['#3366cc'], lane, 4)[1]);
    assert.equal(new Set(faces).size, 4, 'four columns, four colours');
  });

  it('runs dark on the left to light on the right', () => {
    // The way round a listener already expects: the low band is not a bright
    // thing. Low lanes are the left of the board.
    const faces = [0, 1, 2, 3].map((lane) => laneShades(['#3366cc'], lane, 4)[1]);
    for (let lane = 1; lane < 4; lane++) {
      assert.ok(sum(faces[lane]!) > sum(faces[lane - 1]!), `lane ${lane} lighter than ${lane - 1}`);
    }
  });

  it('still runs light to dark down each key', () => {
    for (const stops of [['#3366cc'], ['#112233', '#cc8844', '#22aa66', '#ddddee']]) {
      for (let lane = 0; lane < 4; lane++) {
        const [light, middle, dark] = laneShades(stops, lane, 4);
        assert.ok(sum(light) > sum(middle), `lane ${lane} of ${stops.length}`);
        assert.ok(sum(middle) > sum(dark), `lane ${lane} of ${stops.length}`);
      }
    }
  });

  it('never answers with something that cannot be painted', () => {
    for (let lane = 0; lane < 4; lane++) {
      for (const c of laneShades([], lane, 4)) assert.match(c, /^#[0-9a-f]{6}$/);
    }
  });
});
