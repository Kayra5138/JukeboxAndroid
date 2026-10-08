import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { storedViews, viewShown, viewsFrom, withView } from '../views.ts';

describe('viewsFrom', () => {
  it('offers everything but folders before anybody has chosen', () => {
    assert.deepEqual(viewsFrom(null), ['tracks', 'albums', 'artists']);
  });

  it('reads back what was written, in the order the switch shows them', () => {
    assert.deepEqual(viewsFrom('folders,tracks'), ['tracks', 'folders']);
    assert.deepEqual(viewsFrom(storedViews(['artists', 'albums'])), ['albums', 'artists']);
  });

  it('passes over what it does not recognise', () => {
    assert.deepEqual(viewsFrom('genres,albums'), ['albums']);
  });

  it('treats a setting that names nothing usable as one never made', () => {
    assert.deepEqual(viewsFrom(''), ['tracks', 'albums', 'artists']);
    assert.deepEqual(viewsFrom('genres'), ['tracks', 'albums', 'artists']);
  });
});

describe('withView', () => {
  it('turns one on without disturbing the rest', () => {
    assert.deepEqual(withView(['tracks', 'albums'], 'folders', true), [
      'tracks',
      'albums',
      'folders',
    ]);
  });

  it('turns one off', () => {
    assert.deepEqual(withView(['tracks', 'albums', 'artists'], 'albums', false), [
      'tracks',
      'artists',
    ]);
  });

  it('refuses to turn off the last one', () => {
    assert.deepEqual(withView(['folders'], 'folders', false), ['folders']);
  });

  it('is unmoved by being told what is already so', () => {
    assert.deepEqual(withView(['tracks'], 'tracks', true), ['tracks']);
    assert.deepEqual(withView(['tracks'], 'albums', false), ['tracks']);
  });
});

describe('viewShown', () => {
  it('is the one last chosen while that is still on offer', () => {
    assert.equal(viewShown('artists', ['tracks', 'artists']), 'artists');
  });

  it('falls back to the first on offer when the chosen one was turned off', () => {
    assert.equal(viewShown('albums', ['artists', 'folders']), 'artists');
  });

  it('falls back the same way for a choice never made, or never a view', () => {
    assert.equal(viewShown(null, ['albums', 'artists']), 'albums');
    assert.equal(viewShown('genres', ['tracks', 'albums']), 'tracks');
  });
});
