import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  contrast,
  fromLch,
  inkOn,
  luminance,
  mix,
  parseColour,
  readableOn,
  toLch,
  withAlpha,
} from '../colour.ts';
import { THEMES } from '../registry.ts';

describe('a colour at part strength', () => {
  it('is the colour with its alpha on the end', () => {
    assert.equal(withAlpha('#7ab8ff', 0.18), '#7ab8ff2e');
    assert.equal(withAlpha('#7AB8FF', 0.36), '#7ab8ff5c');
    assert.equal(withAlpha('#000000', 0), '#00000000');
    assert.equal(withAlpha('#ffffff', 1), '#ffffffff');
  });

  it('reads the short form, and multiplies an alpha that is already there', () => {
    assert.equal(withAlpha('#fa0', 0.5), '#ffaa0080');
    assert.equal(withAlpha('#00000080', 0.5), '#00000040');
  });

  it('holds the strength between nothing and all', () => {
    assert.equal(withAlpha('#123456', 3), '#123456ff');
    assert.equal(withAlpha('#123456', -1), '#12345600');
  });

  it('hands back what it cannot read rather than making something up', () => {
    assert.equal(withAlpha('rebeccapurple', 0.5), 'rebeccapurple');
    assert.equal(withAlpha('#12345', 0.5), '#12345');
  });

  it('works on every token of every theme, whichever way the token is written', () => {
    for (const theme of THEMES) {
      for (const [token, value] of Object.entries(theme.colours)) {
        assert.match(withAlpha(value, 0.5), /^#[0-9a-f]{8}$/, `${theme.id}.${token}`);
      }
    }
  });
});

describe('measuring colours', () => {
  it('reckons contrast as WCAG does', () => {
    assert.equal(contrast('#000000', '#ffffff'), 21);
    assert.equal(contrast('#ffffff', '#000000'), 21);
    assert.equal(contrast('#777777', '#777777'), 1);
    // The grey that is famously just short of 4.5:1 on white.
    assert.ok(Math.abs(contrast('#777777', '#ffffff') - 4.48) < 0.01);
    assert.equal(luminance('#ffffff'), 1);
  });

  it('reads three, six and eight digits and nothing else', () => {
    assert.deepEqual(parseColour('#fff'), { rgb: [255, 255, 255], alpha: 1 });
    assert.deepEqual(parseColour('#102030'), { rgb: [16, 32, 48], alpha: 1 });
    assert.equal(parseColour('#10203000')?.alpha, 0);
    assert.equal(parseColour('#1020'), null);
    assert.equal(parseColour('#gggggg'), null);
  });

  it('mixes channel by channel', () => {
    assert.equal(mix('#000000', '#ffffff', 0), '#000000');
    assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
    assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  });

  it('goes to lightness, chroma and hue and comes back where it started', () => {
    for (const colour of ['#7ab8ff', '#ff8a5b', '#1c723a', '#121212', '#ffffff', '#d9749c']) {
      assert.equal(fromLch(toLch(colour)), colour);
    }
    assert.ok(Math.abs(toLch('#ffffff').l - 1) < 0.001);
    assert.ok(toLch('#808080').c < 0.001);
  });

  it('gives up strength, not hue, for a colour there is no such thing as', () => {
    const asked = { l: 0.9, c: 0.3, h: 264 };
    const got = toLch(fromLch(asked));
    assert.ok(Math.abs(got.l - asked.l) < 0.02, `lightness ${got.l}`);
    assert.ok(Math.abs(got.h - asked.h) < 3, `hue ${got.h}`);
    assert.ok(got.c < asked.c);
  });

  it('picks the ink that can be read', () => {
    assert.equal(inkOn('#ffd400', '#000000', '#ffffff'), '#000000');
    assert.equal(inkOn('#1a3a8a', '#000000', '#ffffff'), '#ffffff');
  });
});

describe('a colour made readable', () => {
  it('is left alone when it already is', () => {
    assert.equal(readableOn('#ededed', ['#121212', '#1c1c1c'], 4.5), '#ededed');
  });

  it('is made lighter on dark grounds and darker on light ones, by as little as will do', () => {
    const grounds = ['#121212', '#1c1c1c', '#242424'];
    const lifted = readableOn('#3a3a8a', grounds, 4.5);
    for (const ground of grounds) assert.ok(contrast(lifted, ground) >= 4.5);
    assert.ok(Math.min(...grounds.map((ground) => contrast(lifted, ground))) < 5);
    assert.ok(Math.abs(toLch(lifted).h - toLch('#3a3a8a').h) < 6);

    const sunk = readableOn('#d9749c', ['#ffffff', '#f6e4ec'], 4.5);
    assert.ok(contrast(sunk, '#f6e4ec') >= 4.5);
    assert.ok(contrast(sunk, '#f6e4ec') < 5);
    assert.ok(luminance(sunk) < luminance('#d9749c'));
  });

  it('ends at black or white on a ground nothing can be read on', () => {
    assert.equal(readableOn('#808080', ['#777777'], 7), '#000000');
  });
});
