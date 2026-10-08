package expo.modules.jukeboxaudio.loudness

import androidx.media3.common.Metadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.extractor.metadata.flac.VorbisComment
import androidx.media3.extractor.metadata.id3.InternalFrame
import androidx.media3.extractor.metadata.id3.TextInformationFrame

/**
 * The gain a file says it wants, where it says.
 *
 * A file that has been through a ReplayGain scanner carries the answer in its
 * tags, and that answer is better than one made here: it was measured from
 * the whole file, usually with the true peak, and for an album it was
 * measured across the album. So the tags are asked first and the phone only
 * measures what they do not cover.
 *
 * Four containers spell the same four fields four ways, and Media3 hands each
 * over as a different class:
 *
 *   - ID3v2 (MP3, and FLAC or WAV with an ID3 block): `TXXX` frames, as a
 *     [TextInformationFrame] whose description is the field's name;
 *   - Vorbis comments (FLAC, Ogg Vorbis, Opus): a [VorbisComment];
 *   - MP4 (M4A): freeform `----` atoms under `com.apple.iTunes`, which arrive
 *     as an [InternalFrame];
 *   - Opus, which has its own: `R128_TRACK_GAIN` and `R128_ALBUM_GAIN`.
 *
 * Not read, because Media3 does not parse them: APEv2 tags, which is where
 * the old `mp3gain` wrote on MP3s, and the gain field in a LAME header. A
 * file tagged only that way is measured like an untagged one, which costs a
 * few seconds once and comes to the same level.
 */
object ReplayGainTags {
  private const val TRACK_GAIN = "REPLAYGAIN_TRACK_GAIN"
  private const val TRACK_PEAK = "REPLAYGAIN_TRACK_PEAK"
  private const val ALBUM_GAIN = "REPLAYGAIN_ALBUM_GAIN"
  private const val ALBUM_PEAK = "REPLAYGAIN_ALBUM_PEAK"
  private const val R128_TRACK = "R128_TRACK_GAIN"
  private const val R128_ALBUM = "R128_ALBUM_GAIN"

  /** The number a field opens with: "-6.48 dB", "+1.2", "0,988". */
  private val NUMBER = Regex("""^\s*([+-]?\d+(?:[.,]\d+)?)""")

  /**
   * What Opus measures against, which is the broadcasters' level and not
   * music's. Its gains are brought up by the difference so that all four
   * spellings mean the same thing by the time they leave here.
   */
  private const val R128_LUFS = -23.0

  /**
   * Every tag of a track that could be one of ours, as names and values.
   *
   * Separate from reading them so that the reading can be tested on plain
   * strings, and so that this -- the only part that depends on how one
   * version of Media3 chose to represent a tag -- is a dozen lines.
   */
  @UnstableApi
  fun pairs(metadata: Metadata?): List<Pair<String, String>> {
    if (metadata == null) return emptyList()
    val found = ArrayList<Pair<String, String>>()
    for (index in 0 until metadata.length()) {
      when (val entry = metadata.get(index)) {
        is VorbisComment -> found += entry.key to entry.value
        is TextInformationFrame -> {
          val name = entry.description ?: continue
          if (entry.id == "TXXX" && entry.values.isNotEmpty()) found += name to entry.values[0]
        }
        is InternalFrame -> found += entry.description to entry.text
        else -> Unit
      }
    }
    return found
  }

  /**
   * The gains in a set of tags, or null where there are none worth having.
   *
   * Names are matched without case: the convention is capitals in Vorbis
   * comments and lower case in MP4, and taggers follow it about as well as
   * conventions are followed.
   */
  fun read(pairs: List<Pair<String, String>>): FileGain? {
    val fields = HashMap<String, String>()
    for ((name, value) in pairs) fields.putIfAbsent(name.trim().uppercase(), value)

    fun number(name: String): Float? =
      fields[name]?.let { NUMBER.find(it) }?.groupValues?.get(1)?.replace(',', '.')?.toFloatOrNull()
        ?.takeIf { it.isFinite() }

    /*
      An Opus gain is a whole number of 256ths of a decibel, and it is
      relative to the file *after* the gain in its header has been applied --
      which the decoder does before anything here sees a sample, so there is
      nothing to add for it.
    */
    fun r128(name: String): Float? =
      fields[name]?.trim()?.toIntOrNull()?.let { (it / 256.0 + (REFERENCE_LUFS - R128_LUFS)).toFloat() }

    // A peak of nought is a tagger that wrote the field without measuring.
    fun peak(name: String): Float? = number(name)?.takeIf { it > 0f }

    val track = number(TRACK_GAIN) ?: r128(R128_TRACK)
    val album = number(ALBUM_GAIN) ?: r128(R128_ALBUM)
    // A file tagged for its album and not for itself still says how loud it
    // is, near enough, and near enough beats measuring it.
    val own = track ?: album ?: return null

    return FileGain(
      trackDb = own,
      trackPeak = peak(TRACK_PEAK),
      albumDb = album,
      albumPeak = peak(ALBUM_PEAK),
      measured = false
    )
  }
}
