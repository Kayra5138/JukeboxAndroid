package expo.modules.jukeboxaudio.loudness

import androidx.media3.common.Metadata
import androidx.media3.extractor.metadata.id3.InternalFrame
import androidx.media3.extractor.metadata.id3.TextInformationFrame
import androidx.media3.extractor.metadata.vorbis.VorbisComment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class ReplayGainTagsTest {
  @Test
  fun `the four fields as a scanner writes them`() {
    val gain = ReplayGainTags.read(
      listOf(
        "REPLAYGAIN_TRACK_GAIN" to "-6.48 dB",
        "REPLAYGAIN_TRACK_PEAK" to "0.988525",
        "REPLAYGAIN_ALBUM_GAIN" to "-7.02 dB",
        "REPLAYGAIN_ALBUM_PEAK" to "1.000000"
      )
    )!!
    assertEquals(-6.48f, gain.trackDb, 0.001f)
    assertEquals(0.988525f, gain.trackPeak!!, 0.000001f)
    assertEquals(-7.02f, gain.albumDb!!, 0.001f)
    assertEquals(1f, gain.albumPeak!!, 0f)
    assertFalse(gain.measured)
  }

  @Test
  fun `however a tagger chose to spell them`() {
    // Lower case is the convention in MP4; the sign, the unit and the space
    // before it are all optional in practice; and some locales write a comma.
    assertEquals(3.2f, ReplayGainTags.read(listOf("replaygain_track_gain" to "+3.2 dB"))!!.trackDb, 0.001f)
    assertEquals(3.2f, ReplayGainTags.read(listOf("ReplayGain_Track_Gain" to "3.2dB"))!!.trackDb, 0.001f)
    assertEquals(-3.2f, ReplayGainTags.read(listOf(" REPLAYGAIN_TRACK_GAIN " to " -3,2 dB"))!!.trackDb, 0.001f)
    assertEquals(-4f, ReplayGainTags.read(listOf("REPLAYGAIN_TRACK_GAIN" to "-4"))!!.trackDb, 0f)
  }

  @Test
  fun `tags with nothing in them for us are no answer`() {
    assertNull(ReplayGainTags.read(emptyList()))
    assertNull(ReplayGainTags.read(listOf("ARTIST" to "Neu!", "REPLAYGAIN_REFERENCE_LOUDNESS" to "89.0 dB")))
    assertNull(ReplayGainTags.read(listOf("REPLAYGAIN_TRACK_GAIN" to "loud")))
    // A peak alone says how far it could be turned up and not whether to.
    assertNull(ReplayGainTags.read(listOf("REPLAYGAIN_TRACK_PEAK" to "0.9")))
  }

  @Test
  fun `a gain without a peak is a gain with no known peak`() {
    val gain = ReplayGainTags.read(listOf("REPLAYGAIN_TRACK_GAIN" to "-2.0 dB", "REPLAYGAIN_TRACK_PEAK" to "0"))!!
    assertNull(gain.trackPeak)
    assertNull(gain.albumDb)
  }

  @Test
  fun `a file tagged only for its album still has a level`() {
    val gain = ReplayGainTags.read(listOf("REPLAYGAIN_ALBUM_GAIN" to "-5.5 dB"))!!
    assertEquals(-5.5f, gain.trackDb, 0f)
    assertEquals(-5.5f, gain.albumDb!!, 0f)
  }

  @Test
  fun `an Opus gain is brought from the broadcasters' level to music's`() {
    // 256ths of a decibel against -23 LUFS: -1280 is five down to reach -23,
    // which is nothing at all to reach -18.
    val gain = ReplayGainTags.read(listOf("R128_TRACK_GAIN" to "-1280", "R128_ALBUM_GAIN" to "256"))!!
    assertEquals(0f, gain.trackDb, 0.001f)
    assertEquals(6f, gain.albumDb!!, 0.001f)
    // Opus says nothing of peaks, which downstream means: never turned up.
    assertNull(gain.trackPeak)
    assertEquals(0f, appliedDb(gain.albumDb!!, gain.albumPeak ?: gain.trackPeak), 0f)
  }

  @Test
  fun `the plain fields win where a file has both`() {
    val gain = ReplayGainTags.read(listOf("R128_TRACK_GAIN" to "0", "REPLAYGAIN_TRACK_GAIN" to "-9 dB"))!!
    assertEquals(-9f, gain.trackDb, 0f)
  }

  // ---- as Media3 hands them over ----

  @Test
  fun `an ID3 file's are user text frames`() {
    val metadata = Metadata(
      TextInformationFrame("TIT2", null, listOf("Warszawa")),
      TextInformationFrame("TXXX", "replaygain_track_gain", listOf("-6.48 dB")),
      TextInformationFrame("TXXX", "replaygain_track_peak", listOf("0.9"))
    )
    val gain = ReplayGainTags.read(ReplayGainTags.pairs(metadata))!!
    assertEquals(-6.48f, gain.trackDb, 0.001f)
    assertEquals(0.9f, gain.trackPeak!!, 0f)
  }

  @Test
  fun `a FLAC or Ogg file's are Vorbis comments`() {
    val metadata = Metadata(
      VorbisComment("TITLE", "Warszawa"),
      VorbisComment("REPLAYGAIN_TRACK_GAIN", "-6.48 dB"),
      VorbisComment("REPLAYGAIN_ALBUM_GAIN", "-7.00 dB")
    )
    val gain = ReplayGainTags.read(ReplayGainTags.pairs(metadata))!!
    assertEquals(-6.48f, gain.trackDb, 0.001f)
    assertEquals(-7f, gain.albumDb!!, 0f)
  }

  @Test
  fun `an M4A file's are freeform atoms`() {
    val metadata = Metadata(
      InternalFrame("com.apple.iTunes", "iTunSMPB", " 00000000 00000840 000001C0"),
      InternalFrame("com.apple.iTunes", "replaygain_track_gain", "-6.48 dB")
    )
    assertEquals(-6.48f, ReplayGainTags.read(ReplayGainTags.pairs(metadata))!!.trackDb, 0.001f)
  }

  @Test
  fun `a file with no tags at all`() {
    assertNull(ReplayGainTags.read(ReplayGainTags.pairs(null)))
    assertNull(ReplayGainTags.read(ReplayGainTags.pairs(Metadata(emptyList()))))
  }
}
