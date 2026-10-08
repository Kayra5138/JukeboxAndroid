package expo.modules.jukeboxaudio.tags

import androidx.annotation.StringRes
import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.Words
import java.util.zip.CRC32

/**
 * Deciding whether a rewritten copy of somebody's song is fit to put in its
 * place.
 *
 * The copy was made by TagLib, and asking TagLib whether TagLib did it right
 * is only half a check. So there are two. This file is the first: the copy is
 * read back and has to say exactly what was asked of it, and about everything
 * that was not asked, exactly what the original said. [Sound] is the second,
 * and does not involve TagLib at all.
 *
 * Nothing in here touches a file or the native library, so all of it runs in
 * a unit test.
 */

/**
 * Why a file was not written. Shown to the user, in the app's language,
 * which is why it is [Words] and not a sentence: nothing in this file can
 * look a string up, and whoever catches it can.
 */
internal class Refusal(val words: Words) : Exception() {
  constructor(@StringRes id: Int, vararg with: Any?) : this(Words(id, *with))
}

/**
 * The native side's own reasons, by the sentence it gives them in.
 *
 * It answers in English, in a handful of fixed sentences written into the
 * C++ (jukebox_tags.cpp). They are matched here rather than replaced with
 * codes there because this is all of them and they do not vary; one that is
 * not in the list — a later addition this was not told about — is shown as
 * it came, which is English and still the reason.
 */
private val NATIVE_REASONS = mapOf(
  "It could not be read as an MP3." to R.string.jukebox_tags_not_mp3,
  "It could not be read as a FLAC." to R.string.jukebox_tags_not_flac,
  "The working copy could not be opened for writing." to R.string.jukebox_tags_copy_not_writable,
  "The new details could not be written into the working copy." to R.string.jukebox_tags_not_written,
  "It is neither an MP3 nor a FLAC." to R.string.jukebox_tags_neither
)

/** What the native side said, as words: its own sentence's, or the sentence itself. */
internal fun nativeReason(said: String): Words =
  NATIVE_REASONS[said]?.let { Words(it) } ?: Words(R.string.jukebox_as_said, said)

/** What the app shows for a track, as far as a file can hold it. Null is "leave it". */
internal data class Wanted(
  val title: String? = null,
  val artist: String? = null,
  val album: String? = null,
  val genre: String? = null,
  val year: Int? = null,
  val track: Int? = null,
  val disc: Int? = null
) {
  /** In the order the native side reads them. */
  fun fields(): Array<String?> =
    arrayOf(title, artist, album, genre, year?.toString(), track?.toString(), disc?.toString())

  val empty get() = fields().all { it == null }

  companion object {
    /**
     * From what JavaScript sent. Blank text and numbers that are not counting
     * numbers are no opinion at all rather than an instruction to blank the
     * field: nothing this app does removes a detail from a file.
     */
    fun from(map: Map<String, Any?>): Wanted {
      fun text(key: String) = (map[key] as? String)?.trim()?.takeIf { it.isNotEmpty() }
      fun number(key: String) = (map[key] as? Number)?.toInt()?.takeIf { it > 0 }
      return Wanted(
        text("title"), text("artist"), text("album"), text("genre"),
        number("year"), number("track"), number("disc")
      )
    }
  }
}

/** A picture as a report names it: what it is of, how many bytes, and their checksum. */
internal fun pictureLine(type: Int, bytes: ByteArray): String =
  "$type:${bytes.size}:${CRC32().apply { update(bytes) }.value}"

private const val FRONT_COVER = 3
private const val UNMARKED = 0

/** What a file says about itself. See jukebox_tags.cpp, which is where it is made. */
internal data class TagReport(
  val format: String,
  val title: String,
  val artist: String,
  val album: String,
  val genre: String,
  val year: Int,
  val track: Int,
  val disc: Int,
  val lengthMs: Int,
  val sampleRate: Int,
  val channels: Int,
  /** The major version of the ID3v2 tag, or nought where there is none. */
  val id3v2: Int,
  val id3v1: Boolean,
  val pictures: List<String>,
  /** Everything in the tag that is not one of the fields above, each with a checksum of what it holds. */
  val others: List<String>
) {
  companion object {
    /** Throws a [Refusal] carrying the native side's own reason when there was one. */
    fun parse(pairs: Array<String>?): TagReport {
      if (pairs == null || pairs.size % 2 != 0) throw Refusal(R.string.jukebox_tags_unreadable)
      val single = mutableMapOf<String, String>()
      val pictures = mutableListOf<String>()
      val others = mutableListOf<String>()
      for (index in pairs.indices step 2) {
        when (val name = pairs[index]) {
          "picture" -> pictures += pairs[index + 1]
          "other" -> others += pairs[index + 1]
          else -> single[name] = pairs[index + 1]
        }
      }
      single["error"]?.let { throw Refusal(nativeReason(it)) }
      fun text(name: String) = single[name] ?: throw Refusal(R.string.jukebox_tags_unreadable)
      fun number(name: String) = text(name).toIntOrNull() ?: 0
      return TagReport(
        format = text("format"),
        title = text("title"),
        artist = text("artist"),
        album = text("album"),
        genre = text("genre"),
        year = number("year"),
        track = number("track"),
        disc = number("disc"),
        lengthMs = number("lengthMs"),
        sampleRate = number("sampleRate"),
        channels = number("channels"),
        id3v2 = number("id3v2"),
        id3v1 = text("id3v1") == "1",
        pictures = pictures.sorted(),
        others = others.sorted()
      )
    }
  }
}

/**
 * What the native write answered: the names of what it altered. Empty when
 * the file already said everything asked of it, which is not a failure and
 * means the original is left exactly as it is.
 */
internal fun changedBy(answer: String?): Set<String> {
  if (answer == null) throw Refusal(R.string.jukebox_tags_not_written)
  if (answer.startsWith("error:")) throw Refusal(nativeReason(answer.removePrefix("error:")))
  if (!answer.startsWith("changed:")) throw Refusal(R.string.jukebox_tags_not_written)
  return answer.removePrefix("changed:").split(',').filter { it.isNotEmpty() }.toSet()
}

/**
 * The pictures a file should hold once [cover] has been put in.
 *
 * The same rule the native side follows, written out a second time on
 * purpose: the front covers go, or where there are none the pictures marked
 * as nothing in particular, and one front cover takes their place. Any other
 * picture -- the back, the disc, the band -- must still be there.
 */
internal fun picturesAfter(before: List<String>, cover: String): List<String> {
  fun typeOf(line: String) = line.substringBefore(':').toIntOrNull()
  val replaced = if (before.any { typeOf(it) == FRONT_COVER }) FRONT_COVER else UNMARKED
  return (before.filter { typeOf(it) != replaced } + cover).sorted()
}

/**
 * What is wrong with a rewritten copy, or null when nothing is.
 *
 * [before] is the original as read, [after] the copy as read back, [changed]
 * what the write said it altered, and [cover] the picture it was given, as a
 * report would name it.
 *
 * Every field is held to one of two things. If the write says it changed it,
 * it must now read as what was asked; if not, it must read as it did. There
 * is no third case, and in particular no "close enough": a title that came
 * back with a character different is a file that would be wrong for ever.
 */
internal fun verify(
  before: TagReport,
  after: TagReport,
  wanted: Wanted,
  changed: Set<String>,
  cover: String?
): Words? {
  if (after.format != before.format) return Words(R.string.jukebox_tags_kind_changed)
  if (after.lengthMs != before.lengthMs || after.sampleRate != before.sampleRate || after.channels != before.channels) {
    return Words(R.string.jukebox_tags_length_changed)
  }

  fun <T> held(name: String, asked: T?, was: T, now: T): Boolean =
    if (name in changed) asked != null && now == asked else now == was

  val fields = listOf(
    held("title", wanted.title, before.title, after.title) to R.string.jukebox_tags_field_title,
    held("artist", wanted.artist, before.artist, after.artist) to R.string.jukebox_tags_field_artist,
    held("album", wanted.album, before.album, after.album) to R.string.jukebox_tags_field_album,
    held("genre", wanted.genre, before.genre, after.genre) to R.string.jukebox_tags_field_genre,
    held("year", wanted.year, before.year, after.year) to R.string.jukebox_tags_field_year,
    held("track", wanted.track, before.track, after.track) to R.string.jukebox_tags_field_track,
    held("disc", wanted.disc, before.disc, after.disc) to R.string.jukebox_tags_field_disc
  )
  fields.firstOrNull { !it.first }?.let {
    return Words(R.string.jukebox_tags_field_wrong, Words(it.second))
  }

  val pictures = if ("cover" in changed) {
    if (cover == null) return Words(R.string.jukebox_tags_cover_unasked)
    picturesAfter(before.pictures, cover)
  } else {
    before.pictures
  }
  if (after.pictures != pictures) return Words(R.string.jukebox_tags_pictures_wrong)

  if (after.others != before.others) {
    // Named, because which detail it is decides whether anybody minds.
    val lost = (before.others - after.others.toSet()).map { it.substringBefore(':') }.distinct()
    return if (lost.isEmpty()) Words(R.string.jukebox_tags_details_added)
    else Words(R.string.jukebox_tags_details_lost, lost.joinToString(", "))
  }

  if (after.id3v1 != before.id3v1) return Words(R.string.jukebox_tags_old_tag_changed)
  if (before.format == "mp3") {
    // A v2.3 tag stays v2.3, for the players that read nothing newer; any
    // other file ends up with v2.4.
    val version = if (before.id3v2 == 3) 3 else 4
    if (after.id3v2 != version) return Words(R.string.jukebox_tags_version_wrong, after.id3v2, version)
  }
  return null
}
