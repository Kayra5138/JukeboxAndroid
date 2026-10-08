import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stringsFor } from '../../i18n/languages.ts';
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
test('an outdated extractor says to update, not to try another result', () => {
  const error = new Error('java.lang.IllegalStateException: YouTube has changed and this version of Jukebox cannot read it yet. Update Jukebox.');
  assert.match(youtubeError(error, 'Try again.'), /Update Jukebox/);
});
test('"bot" is a word, not three letters of another one', () => {
  assert.equal(youtubeError(new Error('both streams were robotically bottomed out'), 'Search failed.'), 'Search failed.');
  assert.match(youtubeError(new Error("Sign in to confirm you're not a bot"), 'Search failed.'), /could not complete/);
});
test('the same English from native is answered in Turkish when that is the language', () => {
  const tr = stringsFor('tr');
  const error = new Error("Call to function 'JukeboxDownloads.playlistAsync' has been rejected. → Caused by: java.lang.IllegalStateException: This link does not contain a playlist.");
  assert.equal(youtubeError(error, 'Yeniden dene.', tr), 'Bir YouTube oynatma listesi bağlantısı yapıştır ya da oynatma listesi adıyla ara.');
  assert.match(youtubeError(new Error('Unable to resolve host'), 'Yeniden dene.', tr), /Bağlantını kontrol/);
  assert.equal(youtubeError(new Error('java.lang.IllegalStateException: random trace'), 'Yeniden dene.', tr), 'Yeniden dene.');
});

/** An error as Expo hands over one the native side threw with a code. */
const coded = (code: string, message: string) => Object.assign(new Error(message), { code });

test('a failure is recognised by its code, whatever its words are', () => {
  const said = stringsFor('en').search.errors;
  // Words that match nothing, as they would be once said in another language.
  const by = (code: string) => youtubeError(coded(code, 'Bağlantı yok.'), 'Try again.');
  assert.equal(by('ERR_YOUTUBE_OUTDATED'), said.update);
  assert.equal(by('ERR_YOUTUBE_REFUSED'), said.refused);
  assert.equal(by('ERR_YOUTUBE_VERIFICATION'), said.refused);
  assert.equal(by('ERR_YOUTUBE_UNAVAILABLE'), said.unavailable);
  assert.equal(by('ERR_YOUTUBE_NETWORK'), said.unreachable);
  assert.equal(by('ERR_YOUTUBE_TIMED_OUT'), said.unreachable);
  assert.equal(by('ERR_YOUTUBE_PLAYLIST_LINK'), said.playlistLink);
  assert.equal(by('ERR_YOUTUBE_NO_PLAYLIST'), said.playlistLink);
  assert.equal(by('ERR_YOUTUBE_PLAYLIST_QUERY'), said.playlistLink);
  assert.equal(by('ERR_YOUTUBE_VIDEO_LINK'), said.videoLink);
  assert.equal(by('ERR_YOUTUBE_NOT_A_VIDEO'), said.videoLink);
  assert.equal(by('ERR_YOUTUBE_QUERY'), said.videoLink);
  assert.equal(by('ERR_DOWNLOAD_QUEUE_FULL'), said.queueFull);
  assert.equal(by('ERR_DOWNLOAD_BATCH'), said.queueFull);
});
test('the code is believed over words that would have said something else', () => {
  // "up to 500" used to make a search that was too long into a full queue,
  // and "update Jukebox" a refusal into an outdated build.
  const said = stringsFor('en').search.errors;
  assert.equal(
    youtubeError(coded('ERR_YOUTUBE_QUERY', 'Enter a song, artist or YouTube link (up to 500 characters).'), 'Try again.'),
    said.videoLink
  );
  assert.equal(
    youtubeError(coded('ERR_YOUTUBE_REFUSED', 'YouTube refused this download. Try again later or update Jukebox.'), 'Try again.'),
    said.refused
  );
});
test('a code with no sentence of its own is answered with the fallback, not guessed at', () => {
  assert.equal(youtubeError(coded('ERR_YOUTUBE_LIVE', 'Live streams are unavailable.'), 'Try again.'), 'Try again.');
});
test('the extractor\'s own words are still read, and so is a code from somewhere else', () => {
  const said = stringsFor('en').search.errors;
  assert.equal(youtubeError(coded('ERR_DOWNLOAD_FAILED', 'Connection reset by peer'), 'Try again.'), said.unreachable);
  assert.equal(youtubeError(coded('ERR_UNEXPECTED', 'Unable to resolve host'), 'Try again.'), said.unreachable);
});
test('a code is answered in Turkish when that is the language', () => {
  const tr = stringsFor('tr');
  assert.equal(youtubeError(coded('ERR_YOUTUBE_NETWORK', 'x'), 'Yeniden dene.', tr), tr.search.errors.unreachable);
});
