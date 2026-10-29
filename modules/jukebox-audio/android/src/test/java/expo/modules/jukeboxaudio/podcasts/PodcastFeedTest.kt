package expo.modules.jukeboxaudio.podcasts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PodcastFeedTest {
  private val feed = """
    <?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
      <channel>
        <title>Some Show</title>
        <link>https://example.org</link>
        <itunes:author>A Host</itunes:author>
        <itunes:image href="https://example.org/show.jpg"/>
        <description><![CDATA[<p>About <b>things</b>.</p>]]></description>
        <image><url>https://example.org/other.jpg</url><title>Ignored</title></image>
        <item>
          <title>Episode Two</title>
          <guid isPermaLink="false">ep-2</guid>
          <pubDate>Tue, 27 Oct 2026 08:00:00 +0000</pubDate>
          <enclosure url="https://example.org/2.mp3" type="audio/mpeg" length="12345"/>
          <itunes:duration>1:02:03</itunes:duration>
          <itunes:episode>2</itunes:episode>
        </item>
        <item>
          <title>No file</title>
          <guid>ep-x</guid>
        </item>
        <item>
          <title>Episode One</title>
          <pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate>
          <enclosure url="https://example.org/1.mp3" type="audio/mpeg"/>
          <itunes:duration>1800</itunes:duration>
        </item>
      </channel>
    </rss>
  """.trimIndent()

  @Test
  fun readsTheShowAndItsEpisodesWithAFile() {
    val show = PodcastFeed.parse(feed.byteInputStream())
    assertEquals("Some Show", show.title)
    assertEquals("A Host", show.author)
    assertEquals("https://example.org/show.jpg", show.image)
    assertEquals("About things.", show.summary)
    assertEquals(2, show.episodes.size)
    val two = show.episodes[0]
    assertEquals("ep-2", two.guid)
    assertEquals("https://example.org/2.mp3", two.url)
    assertEquals(3723.0, two.durationSec!!, 0.0)
    assertEquals(2, two.episode)
    assertEquals(12345L, two.bytes)
    assertEquals(1793088000000L, two.publishedAt)
    // Known by its file where the feed says nothing of which it is.
    assertEquals("https://example.org/1.mp3", show.episodes[1].guid)
    assertEquals(1800.0, show.episodes[1].durationSec!!, 0.0)
  }

  @Test
  fun readsTheWaysFeedsWriteTimes() {
    assertEquals(90.0, PodcastFeed.durationOf("1:30")!!, 0.0)
    assertNull(PodcastFeed.durationOf("soon"))
    assertEquals(PodcastFeed.dateOf("Tue, 27 Oct 2026 08:00:00 +0000"), PodcastFeed.dateOf("2026-10-27T08:00:00Z"))
  }

  private val channel = """
    <?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
      <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv"/>
      <id>yt:channel:abcdefghijklmnopqrstuv</id>
      <title>A Channel</title>
      <author><name>A Channel</name><uri>https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv</uri></author>
      <entry>
        <id>yt:video:AAAAAAAAAAA</id>
        <yt:videoId>AAAAAAAAAAA</yt:videoId>
        <title>A Talk</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=AAAAAAAAAAA"/>
        <author><name>Somebody Else</name></author>
        <published>2026-10-20T15:00:12+00:00</published>
        <media:group>
          <media:thumbnail url="https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg" width="480" height="360"/>
          <media:description>What it is about.</media:description>
        </media:group>
      </entry>
      <entry>
        <id>yt:video:BBBBBBBBBBB</id>
        <yt:videoId>BBBBBBBBBBB</yt:videoId>
        <title>A Short</title>
        <link rel="alternate" href="https://www.youtube.com/shorts/BBBBBBBBBBB"/>
        <published>2026-10-21T15:00:12+00:00</published>
      </entry>
    </feed>
  """.trimIndent()

  @Test
  fun readsAYouTubeChannelsVideosAsItsEpisodes() {
    val show = PodcastFeed.parse(channel.byteInputStream())
    assertEquals("A Channel", show.title)
    assertEquals("A Channel", show.author)
    // The short is left out.
    assertEquals(1, show.episodes.size)
    val talk = show.episodes[0]
    assertEquals("AAAAAAAAAAA", talk.guid)
    assertEquals("https://www.youtube.com/watch?v=AAAAAAAAAAA", talk.url)
    assertEquals("A Talk", talk.title)
    assertEquals("https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg", talk.image)
    assertEquals("What it is about.", talk.summary)
    assertEquals(PodcastFeed.dateOf("2026-10-20T15:00:12Z"), talk.publishedAt)
  }

  @Test
  fun takesAChannelsAddressToTheOneByItsIdAndLeavesOtherAddressesAlone() {
    val channel = "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"
    assertEquals(channel, PodcastFeed.youtubeFeedOf(channel))
    assertEquals(channel, PodcastFeed.youtubeFeedOf("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/videos"))
    assertEquals(channel, PodcastFeed.youtubeFeedOf("https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv"))
    assertEquals("UCabcdefghijklmnopqrstuv", PodcastFeed.channelIdOf(channel))
    assertNull(PodcastFeed.youtubeFeedOf("https://example.org/feed.xml"))
    assertNull(PodcastFeed.youtubeFeedOf("https://www.youtube.com/watch?v=AAAAAAAAAAA"))
  }

  @Test
  fun readsAnEpisodesChaptersAndTheBestTranscriptToFollow() {
    val feed = """
      <rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
        <channel>
          <title>Show</title>
          <item>
            <title>One</title>
            <enclosure url="https://example.org/1.mp3" type="audio/mpeg"/>
            <podcast:chapters url="https://example.org/1.json" type="application/json+chapters"/>
            <podcast:transcript url="https://example.org/1.html" type="text/html"/>
            <podcast:transcript url="https://example.org/1.vtt" type="text/vtt"/>
            <podcast:transcript url="https://example.org/1.srt" type="application/x-subrip"/>
          </item>
        </channel>
      </rss>
    """.trimIndent()
    val episode = PodcastFeed.parse(feed.byteInputStream()).episodes.single()
    assertEquals("https://example.org/1.json", episode.chaptersUrl)
    assertEquals("https://example.org/1.srt", episode.transcriptUrl)
    assertEquals("application/x-subrip", episode.transcriptType)
  }

  @Test
  fun readsADateWhoseDayOfTheWeekIsWrongOrWhoseSecondsHaveAFraction() {
    val tuesday = PodcastFeed.dateOf("Tue, 27 Oct 2026 08:00:00 +0000")
    assertEquals(tuesday, PodcastFeed.dateOf("Mon, 27 Oct 2026 08:00:00 +0000"))
    assertEquals(tuesday, PodcastFeed.dateOf("27 Oct 2026 08:00:00 GMT"))
    assertEquals(tuesday, PodcastFeed.dateOf("2026-10-27T08:00:00.000Z"))
    assertEquals(tuesday?.plus(123), PodcastFeed.dateOf("2026-10-27T08:00:00.123456+00:00"))
  }
}
