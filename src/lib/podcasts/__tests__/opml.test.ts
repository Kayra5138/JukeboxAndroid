import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { feedForOthers, feedsInOpml, toOpml } from '../opml.ts';

describe('an OPML list of podcasts', () => {
  it('is written with each show followed, and read back the same', () => {
    const shows = [
      { feedUrl: 'https://example.org/feed?a=1&b=2', title: 'Tom & Jerry "Live"' },
      { feedUrl: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', title: 'A Channel' },
    ];
    const written = toOpml(shows, new Date(Date.UTC(2026, 9, 29)));
    assert.match(written, /xmlUrl="https:\/\/example\.org\/feed\?a=1&amp;b=2"/);
    assert.match(written, /text="Tom &amp; Jerry &quot;Live&quot;"/);
    assert.deepEqual(feedsInOpml(written), shows.map((show) => show.feedUrl));
  });

  it('is read from another app’s, in folders, in any case, each feed once and nothing that is not a feed', () => {
    const theirs = `<?xml version="1.0"?>
      <opml version="1.0"><body>
        <outline text="News">
          <outline type="rss" text="One" XMLURL='https://one.example/rss' />
          <outline type="rss" text="Two" xmlUrl="https://two.example/rss"/>
        </outline>
        <outline type="rss" text="One again" xmlUrl="https://one.example/rss" />
        <outline type="link" text="Not a feed" url="https://example.org" />
        <outline type="rss" text="Odd" xmlUrl="javascript:alert(1)" />
      </body></opml>`;
    assert.deepEqual(feedsInOpml(theirs), ['https://one.example/rss', 'https://two.example/rss']);
  });
});

describe('a YouTube channel in an OPML file', () => {
  const page = 'https://www.youtube.com/channel/UCVBX2n_5egE9XuJL8NUS0Xg';
  const feed = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVBX2n_5egE9XuJL8NUS0Xg';

  it('is written as the feed YouTube gives of it, which other apps read, and read back as the channel', () => {
    assert.equal(feedForOthers(page), feed);
    assert.equal(feedForOthers('https://example.org/rss'), 'https://example.org/rss');
    const written = toOpml([{ feedUrl: page, title: 'A channel' }]);
    assert.match(written, /xmlUrl="https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UCVBX2n_5egE9XuJL8NUS0Xg"/);
    assert.deepEqual(feedsInOpml(written), [page]);
  });
});
