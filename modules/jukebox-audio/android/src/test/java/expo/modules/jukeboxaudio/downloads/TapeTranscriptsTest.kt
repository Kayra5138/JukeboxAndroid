package expo.modules.jukeboxaudio.downloads

import org.junit.Assert.assertEquals
import org.junit.Test

class TapeTranscriptsTest {
  @Test
  fun readsSubRipLinesWithTheirTimesAndWithoutMarkup() {
    val srt = """
      1
      00:00:01,500 --> 00:00:04,000
      Hello <i>there</i>,
      and welcome.

      2
      01:02:03,250 --> 01:02:05,000
      Much later.
    """.trimIndent()
    assertEquals(
      listOf(1_500L to "Hello there, and welcome.", 3_723_250L to "Much later."),
      TapeTranscripts.timedLines(srt, "application/x-subrip")
    )
  }

  @Test
  fun readsWebVttLinesAndLeavesOutTheHeader() {
    val vtt = """
      WEBVTT

      00:01.000 --> 00:02.000
      <v Host>First line

      00:03.000 --> 00:04.000 align:start
      Second line
    """.trimIndent()
    assertEquals(listOf(1_000L to "First line", 3_000L to "Second line"), TapeTranscripts.timedLines(vtt, "text/vtt"))
  }

  @Test
  fun runsAWordAtATimeTogetherIntoLinesBySpeakerAndSentence() {
    val json = """
      {"segments":[
        {"speaker":"Kevin","startTime":0.08,"body":"Jordan,"},{"speaker":"Kevin","startTime":0.32,"body":" "},
        {"speaker":"Kevin","startTime":0.48,"body":"I"},{"speaker":"Kevin","startTime":0.56,"body":" "},
        {"speaker":"Kevin","startTime":0.56,"body":"think"},{"speaker":"Kevin","startTime":0.72,"body":" "},
        {"speaker":"Kevin","startTime":0.72,"body":"you"},{"speaker":"Kevin","startTime":0.88,"body":" "},
        {"speaker":"Kevin","startTime":0.88,"body":"should"},{"speaker":"Kevin","startTime":1.04,"body":" "},
        {"speaker":"Kevin","startTime":1.04,"body":"open"},{"speaker":"Kevin","startTime":1.2,"body":" "},
        {"speaker":"Kevin","startTime":1.36,"body":"this."},{"speaker":"Kevin","startTime":1.5,"body":" "},
        {"speaker":"Jordan","startTime":4.56,"body":"Why?"}
      ]}
    """.trimIndent()
    assertEquals(
      listOf(80L to "Jordan, I think you should open this.", 4_560L to "Why?"),
      TapeTranscripts.timedLines(json, "application/json")
    )
  }

  @Test
  fun keepsASentenceToASegmentAsItIs() {
    val json = """{"segments":[{"startTime":1,"body":"A whole sentence here, said at once."},{"startTime":3,"body":"And another one after it."}]}"""
    assertEquals(
      listOf(1_000L to "A whole sentence here, said at once.", 3_000L to "And another one after it."),
      TapeTranscripts.timedLines(json, "application/json")
    )
  }
}
