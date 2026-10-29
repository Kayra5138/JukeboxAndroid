import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { episodeId, episodeVideo, isChannelAddress, isFeedAddress, newEpisodes, type Episode } from '../episodes.ts';

const episode = (guid: string, publishedAt: number | null): Episode => ({
  guid, title: `Episode ${guid}`, url: `https://example.org/${guid}.mp3`, publishedAt, durationSec: 1800, image: null, summary: null,
});

describe('podcast episodes', () => {
  it('are known in the queue by a name of their own, the same each time', () => {
    const one = episodeId('https://feed', 'a');
    assert.equal(one, episodeId('https://feed', 'a'));
    assert.notEqual(one, episodeId('https://feed', 'b'));
    assert.notEqual(one, episodeId('https://other', 'a'));
    assert.match(one, /^pod-[0-9a-z]+$/);
  });

  it('are fetched as tapes into the show’s folder, named by the day they came out', () => {
    const show = { title: 'Some Show', author: 'A Host', image: 'https://example.org/show.jpg', summary: null };
    const video = episodeVideo('https://feed', show, episode('a', new Date(2026, 9, 27, 9).getTime()));
    assert.equal(video.direct, true);
    assert.equal(video.url, 'https://example.org/a.mp3');
    assert.equal(video.channel, 'A Host');
    assert.equal(video.thumbnail, 'https://example.org/show.jpg');
    assert.deepEqual(video.tape, { name: 'Some Show', album: 'Some Show', title: 'Episode a', date: '2026-10-27' });
  });

  it('carry where their chapters and transcript are, to be fetched with them, and nothing where the feed gave none', () => {
    const show = { title: 'Some Show', author: null, image: null, summary: null };
    const video = episodeVideo('https://feed', show, {
      ...episode('a', null),
      chaptersUrl: 'https://example.org/a.json',
      transcriptUrl: 'https://example.org/a.srt',
      transcriptType: 'application/x-subrip',
    });
    assert.equal(video.chaptersUrl, 'https://example.org/a.json');
    assert.equal(video.transcriptUrl, 'https://example.org/a.srt');
    assert.equal(video.transcriptType, 'application/x-subrip');
    const plain = episodeVideo('https://feed', show, episode('b', null));
    assert.equal('chaptersUrl' in plain, false);
    assert.equal('transcriptUrl' in plain, false);
  });

  it('of a YouTube channel are its videos, known and fetched by their own ids', () => {
    const feed = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv';
    const show = { title: 'A Channel', author: 'A Channel', image: null, summary: null };
    assert.equal(episodeId(feed, 'AAAAAAAAAAA'), 'AAAAAAAAAAA');
    const video = episodeVideo(feed, show, { ...episode('AAAAAAAAAAA', null), url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' });
    assert.equal(video.id, 'AAAAAAAAAAA');
    assert.equal(video.direct, undefined);
    assert.equal(video.url, 'https://www.youtube.com/watch?v=AAAAAAAAAAA');
    // A podcast's guid that happens to look like a video's is still a podcast's.
    assert.match(episodeId('https://feed', 'AAAAAAAAAAA'), /^pod-/);
  });

  it('tell a channel’s page from a video’s', () => {
    assert.equal(isChannelAddress('https://www.youtube.com/@yusufipk'), true);
    assert.equal(isChannelAddress('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'), true);
    assert.equal(isChannelAddress('https://www.youtube.com/watch?v=AAAAAAAAAAA'), false);
    assert.equal(isChannelAddress('https://www.youtube.com/playlist?list=PL1'), false);
    assert.equal(isChannelAddress('https://example.org/@someone'), false);
  });

  it('that are new are the ones not seen before, newest first', () => {
    const fresh = [episode('old', 1), episode('newer', 3), episode('new', 2), episode('undated', null)];
    assert.deepEqual(newEpisodes(fresh, new Set(['old'])).map((one) => one.guid), ['newer', 'new', 'undated']);
  });

  it('come from a feed’s address, or a search for words', () => {
    assert.equal(isFeedAddress('https://example.org/feed.xml'), true);
    assert.equal(isFeedAddress('history podcast'), false);
  });
});
