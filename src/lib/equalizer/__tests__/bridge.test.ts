import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { forBridge } from '../bridge.ts';

describe('forBridge', () => {
  it('leaves out a preamp that is left to the app, at every depth', () => {
    // What the screen holds for a fresh install: the preamp worked out by the
    // app, here and on a curve that was kept. Each null used to sink the call.
    const settings = {
      enabled: true,
      bass: 0,
      parametric: {
        bands: [{ type: 'peak', frequencyHz: 1000, gainDb: 3, q: 1 }],
        preampDb: null,
        presets: [
          { name: 'Mine', preampDb: null, bands: [] },
          { name: 'Theirs', preampDb: -4.5, bands: [] },
        ],
      },
    };

    assert.deepEqual(forBridge(settings), {
      enabled: true,
      bass: 0,
      parametric: {
        bands: [{ type: 'peak', frequencyHz: 1000, gainDb: 3, q: 1 }],
        presets: [
          { name: 'Mine', bands: [] },
          { name: 'Theirs', preampDb: -4.5, bands: [] },
        ],
      },
    });
  });

  it('leaves out what is undefined as well', () => {
    assert.deepEqual(forBridge({ enabled: false, preset: undefined, bands: undefined }), {
      enabled: false,
    });
  });

  it('keeps what is false, nought or empty', () => {
    // Nothing is not the same as no: a switch that is off and a gain of
    // nought are answers, and have to arrive.
    const settings = { enabled: false, loudness: 0, name: '', bands: [] };
    assert.deepEqual(forBridge(settings), settings);
  });

  it('does not change what it was given', () => {
    const settings = { parametric: { preampDb: null } };
    forBridge(settings);
    assert.deepEqual(settings, { parametric: { preampDb: null } });
  });
});
