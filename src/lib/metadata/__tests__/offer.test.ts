import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  answered,
  ASK_AGAIN_AFTER_DAYS,
  ASK_AGAIN_AFTER_TRACKS,
  parseOffer,
  shouldOffer,
  worthAsking,
  type OfferInput,
} from '../offer.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const fresh: OfferInput = { kept: null, now: NOW, tracks: 400, untried: 400, running: false };

test('a new install with music in it is asked', () => {
  assert.equal(shouldOffer(fresh), true);
});

test('an empty library, or one already looked up, is not', () => {
  assert.equal(shouldOffer({ ...fresh, tracks: 0, untried: 0 }), false);
  assert.equal(shouldOffer({ ...fresh, untried: 0 }), false);
  // A record added to a library looked up long ago is the Tags screen's business.
  assert.equal(shouldOffer({ ...fresh, tracks: 3000, untried: 12 }), false);
  assert.equal(worthAsking(400, 100), true);
  assert.equal(worthAsking(400, 99), false);
});

test('nothing is offered while a lookup is already running', () => {
  assert.equal(shouldOffer({ ...fresh, running: true }), false);
});

test('a yes is never followed by another question', () => {
  const kept = answered(null, true, NOW, 400);
  assert.equal(shouldOffer({ ...fresh, kept, now: NOW + 365 * DAY, tracks: 5000, untried: 5000 }), false);
});

test('a "not now" is left alone, then asked about once more after a week', () => {
  const kept = answered(null, false, NOW, 400);
  assert.equal(shouldOffer({ ...fresh, kept }), false);
  assert.equal(shouldOffer({ ...fresh, kept, now: NOW + (ASK_AGAIN_AFTER_DAYS * DAY) - 1 }), false);
  assert.equal(shouldOffer({ ...fresh, kept, now: NOW + ASK_AGAIN_AFTER_DAYS * DAY }), true);
});

test('or sooner, once the library has grown by a good many tracks', () => {
  const kept = answered(null, false, NOW, 400);
  const grown = 400 + ASK_AGAIN_AFTER_TRACKS;
  assert.equal(shouldOffer({ ...fresh, kept, now: NOW + DAY, tracks: grown - 1, untried: grown - 1 }), false);
  assert.equal(shouldOffer({ ...fresh, kept, now: NOW + DAY, tracks: grown, untried: grown }), true);
});

test('two "not now"s and it is never asked again', () => {
  const twice = answered(answered(null, false, NOW, 400), false, NOW + 8 * DAY, 400);
  assert.equal(twice.asked, 2);
  assert.equal(shouldOffer({ ...fresh, kept: twice, now: NOW + 400 * DAY, tracks: 9000, untried: 9000 }), false);
});

test('a clock put back is not a week gone by', () => {
  const kept = answered(null, false, NOW, 400);
  assert.equal(shouldOffer({ ...fresh, kept, now: NOW - 30 * DAY }), false);
});

test('what was kept is read back, and words that cannot be read are as if never asked', () => {
  const kept = answered(null, false, NOW, 400);
  assert.deepEqual(parseOffer(JSON.stringify(kept)), kept);
  assert.equal(parseOffer(null), null);
  assert.equal(parseOffer('nonsense'), null);
  assert.equal(shouldOffer({ ...fresh, kept: parseOffer('nonsense') }), true);
});
