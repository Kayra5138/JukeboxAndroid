import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MESSAGE_LIMIT, scrub } from '../scrub.ts';

test('addresses of every kind are taken out', () => {
  assert.equal(
    scrub('MusicBrainz responded 503 for https://musicbrainz.org/ws/2/recording?query=artist%3ABj%C3%B6rk'),
    'MusicBrainz responded 503 for <url>'
  );
  assert.equal(scrub('Could not open content://media/external/audio/media/1234'), 'Could not open <url>');
  assert.equal(scrub('see www.example.com/page for more'), 'see <url> for more');
});

test('e-mail addresses are taken out', () => {
  assert.equal(scrub('Sent by someone.else@example.co.uk today'), 'Sent by <email> today');
});

test('anything in quotation marks is taken out, and an apostrophe is not a quotation mark', () => {
  assert.equal(scrub('No match for "Never Gonna Give You Up"'), 'No match for <…>');
  assert.equal(scrub('No match for “Bohemian Rhapsody” by Queen'), 'No match for <…> by Queen');
  assert.equal(scrub("Can't find 'Heroes' anywhere"), "Can't find <…> anywhere");
  assert.equal(scrub('Ничего не найдено «Кино»'), 'Ничего не найдено <…>');
  assert.equal(scrub('見つかりません「夜に駆ける」'), '見つかりません<…>');
  assert.equal(scrub("undefined is not a function (evaluating 'track.title.trim')"), 'undefined is not a function (evaluating <…>)');
});

test('file paths are taken out, and HTTP/1.1 is not a path', () => {
  assert.equal(scrub('FileNotFound /storage/emulated/0/Music/Artist/Song.mp3 (No such file)'), 'FileNotFound <path> (No such file)');
  assert.equal(scrub('cannot read C:\\Users\\me\\song.flac'), 'cannot read <path>');
  assert.equal(scrub('protocol HTTP/1.1 refused'), 'protocol HTTP/1.1 refused');
});

test('ids and tokens are taken out, and error codes are kept', () => {
  assert.equal(scrub('video dQw4w9WgXcQ is unavailable'), 'video <id> is unavailable');
  assert.equal(scrub('token 0123456789abcdef0123456789abcdef refused'), 'token <id> refused');
  assert.equal(scrub('job download-1712345678-abc failed'), 'job <id> failed');
  assert.equal(scrub('video aBcDeFgHiJk is unavailable'), 'video <id> is unavailable');
  assert.equal(scrub('video Ab-cdefghij is unavailable'), 'video <id> is unavailable');
  assert.equal(scrub('MusicBrainz and toQueueItem are words'), 'MusicBrainz and toQueueItem are words');
  assert.equal(scrub('ERR_YOUTUBE_REFUSED'), 'ERR_YOUTUBE_REFUSED');
  assert.equal(scrub('ERROR_CODE_IO_FILE_NOT_FOUND after 3 tries'), 'ERROR_CODE_IO_FILE_NOT_FOUND after 3 tries');
});

test('what follows a colon goes, unless it is codes and numbers', () => {
  assert.equal(scrub('Unable to extract: Some Artist - Some Song'), 'Unable to extract: <…>');
  assert.equal(scrub('ERROR: [youtube] Video unavailable'), 'ERROR: <…>');
  assert.equal(scrub('ERR_DOWNLOAD_FAILED: ERR_YOUTUBE_NETWORK'), 'ERR_DOWNLOAD_FAILED: ERR_YOUTUBE_NETWORK');
  assert.equal(scrub('status: 503'), 'status: 503');
  assert.equal(scrub('Lookup failed: HTTP 429'), 'Lookup failed: HTTP 429');
  assert.equal(scrub('エラー：曲名'), 'エラー： <…>');
  // A colon with no space after it is a time or a line number, not a title.
  assert.equal(scrub('at 12:30 the bundle threw'), 'at 12:30 the bundle threw');
});

test('everything together, as the extractor says it', () => {
  assert.equal(
    scrub('ERROR: [youtube] dQw4w9WgXcQ: Requested format is not available. Use --list-formats'),
    'ERROR: <…>'
  );
  assert.equal(
    scrub('Source error — FileNotFoundException: /storage/emulated/0/Music/Song.mp3: open failed: ENOENT'),
    'Source error — FileNotFoundException: <…>'
  );
});

test('spaces are evened out and the message is cut short', () => {
  assert.equal(scrub('  two\n\nlines\t here  '), 'two lines here');
  const long = scrub('word '.repeat(100));
  assert.equal(long.length, MESSAGE_LIMIT);
  assert.ok(long.endsWith('…'));
});

test('what is not a string is made one, and nothing is nothing', () => {
  assert.equal(scrub(undefined), '');
  assert.equal(scrub(null), '');
  assert.equal(scrub(404), '404');
});

test('a name the app knows of goes wherever it stands, set off or not, in any case', () => {
  const names = ['Some Artist', 'Some Song', 'Up'];
  assert.equal(scrub('Some Artist - Some Song is unavailable', names), '<…> - <…> is unavailable');
  assert.equal(scrub('could not open SOME SONG today', names), 'could not open <…> today');
  // Too short to look for: two letters are in every sentence.
  assert.equal(scrub('Up next failed', names), 'Up next failed');
  // The longer of two names that overlap goes as a whole.
  assert.equal(scrub('Lost in Song Lost in', ['Song', 'Lost in Song']), '<…> Lost in');
  assert.equal(scrub('nothing named here', names), 'nothing named here');
});

test('a message cut short is never cut through an emoji', () => {
  const cut = scrub(`x${'😀'.repeat(MESSAGE_LIMIT)}`);
  assert.doesNotThrow(() => encodeURIComponent(cut));
  assert.ok(cut.endsWith('😀…'));
});
