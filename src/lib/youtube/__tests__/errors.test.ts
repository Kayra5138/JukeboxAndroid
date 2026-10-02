import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeError } from '../errors.ts';

test('native playlist validation becomes an actionable message', () => {
  const error = new Error("Call to function 'JukeboxDownloads.playlistAsync' has been rejected. → Caused by: java.lang.IllegalStateException: This link does not contain a playlist.");
  assert.equal(youtubeError(error, 'Try again.'), 'Paste a YouTube playlist link, or search by playlist name.');
});
test('unknown exceptions never leak bridge details', () => {
  assert.equal(youtubeError(new Error('java.lang.IllegalStateException: random trace'), 'Search failed. Please retry.'), 'Search failed. Please retry.');
});
test('network failures explain how to recover', () => {
  assert.match(youtubeError(new Error('Unable to resolve host'), 'Try again.'), /connection/);
});
