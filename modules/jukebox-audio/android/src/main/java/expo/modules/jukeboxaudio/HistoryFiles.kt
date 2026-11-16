package expo.modules.jukeboxaudio

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.Serializable
import java.util.zip.ZipInputStream

/**
 * Choosing the files another app exported a listening history in, one or
 * several at once: Spotify's history comes as a file a year, ListenBrainz's
 * as a file a month.
 *
 * Every kind of file is offered, for the reason a backup is (see
 * [BackupOpen]): what a file is called by the time it reaches a phone says
 * little about what is in it, and whether it is a history is decided by
 * reading it.
 */
class HistoryFilesOpen : AppContextActivityResultContract<HistoryFilesOpen.Input, List<String>> {
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType("*/*")
      .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): List<String> {
    if (resultCode != Activity.RESULT_OK || intent == null) return emptyList()
    val clips = intent.clipData
    if (clips != null && clips.itemCount > 0) return (0 until clips.itemCount).mapNotNull { clips.getItemAt(it).uri?.toString() }
    return listOfNotNull(intent.data?.toString())
  }
}

/**
 * Reading those files, a part at a time.
 *
 * A part is the file itself, or, for a zip as the services hand them out,
 * one file inside it that looks like a history. Only those are ever read out
 * of a zip. Spotify's holds the account's payments, searches and addresses
 * besides what was played, and none of that is any business of this app's,
 * so it is passed over unread.
 *
 * A part at a time, so that what crosses to JavaScript at once is one year
 * of somebody's listening and not ten: each part is read, made sense of
 * there, and let go before the next is asked for. What any of it says is
 * decided there (`src/lib/history/import.ts`), where it is tested.
 */
internal object HistoryFiles {
  /**
   * The most one part may be. A year of Spotify's fullest history is around
   * a dozen megabytes, and a Last.fm export of a quarter of a million
   * scrobbles about as much; this is several times either, and little enough
   * that a film picked by mistake is turned away rather than read whole.
   */
  private const val LIMIT = 48 * 1024 * 1024

  /** The name a part of a plain file goes by: there is only the one. */
  private const val WHOLE = ""

  /** Each picked file's address and name. */
  fun describe(context: Context, addresses: List<String>): List<Map<String, Any?>> =
    addresses.map { address -> mapOf("uri" to address, "name" to (name(context, Uri.parse(address)) ?: Uri.parse(address).lastPathSegment ?: "")) }

  /**
   * The parts of the file at [address] worth reading, by name: [WHOLE] for a
   * file that is not a zip. Throws when it cannot be opened.
   */
  fun parts(context: Context, address: String): List<String> = open(context, address).use { stream ->
    if (!isZip(stream)) return listOf(WHOLE)
    val zip = ZipInputStream(stream)
    val found = mutableListOf<String>()
    while (true) {
      val entry = zip.nextEntry ?: break
      if (entry.isDirectory) continue
      if (nested(entry.name)) {
        // Read where it lies, without being unpacked anywhere; and not closed, which would close the zip around it.
        val inner = ZipInputStream(zip)
        while (true) {
          val part = inner.nextEntry ?: break
          if (!part.isDirectory && worthReading(part.name)) found += "${entry.name}$INSIDE${part.name}"
        }
      } else if (worthReading(entry.name)) found += entry.name
    }
    found
  }

  /**
   * The text of one part, or null when it is larger than [LIMIT]. Throws when
   * the file cannot be opened or the part is not in it.
   */
  fun read(context: Context, address: String, part: String): String? = open(context, address).use { stream ->
    if (part == WHOLE) return bounded(stream)
    val outer = part.substringBefore(INSIDE)
    val within = part.substringAfter(INSIDE, "")
    val zip = ZipInputStream(stream)
    while (true) {
      val entry = zip.nextEntry ?: break
      if (entry.name != outer) continue
      if (within.isEmpty()) return bounded(zip)
      val inner = ZipInputStream(zip)
      while (true) {
        val each = inner.nextEntry ?: break
        if (each.name == within) return bounded(inner)
      }
    }
    throw Told(R.string.jukebox_file_not_opened)
  }

  /** Between a zip inside the zip and a file inside that, in the name of a part. */
  private const val INSIDE = "!/"

  /**
   * Whether a zip inside the zip is looked into: Apple's copy of an account's
   * data, which may come as a zip of zips. No other.
   */
  private fun nested(path: String): Boolean =
    path.endsWith(".zip", ignoreCase = true) && Regex("(?i)apple").containsMatchIn(path)

  /**
   * Whether a file in a zip is one of the histories: Spotify's of music, in
   * either of the forms it gives; Apple Music's of each day; ListenBrainz's,
   * one file a month in a folder of listens; or a table of scrobbles, which
   * is what a Last.fm export is.
   */
  private fun worthReading(path: String): Boolean {
    val name = path.substringAfterLast('/')
    if (name.startsWith(".")) return false
    // Apple's copy of an account's data: the one table of what was played each day, and nothing else of it,
    // not the purchases, the devices or the table of every play with where the phone was.
    if (Regex("(?i)apple").containsMatchIn(path)) return Regex("(?i)Play History Daily Tracks.*\\.csv$").containsMatchIn(name)
    // Spotify's history of podcasts and videos, which are not songs: a newer export names them as it names music.
    if (Regex("(?i)^StreamingHistory_(podcast|video)").containsMatchIn(name)) return false
    if (Regex("(?i)^StreamingHistory.*\\.json$").matches(name)) return true
    if (Regex("(?i)^Streaming_History_Audio.*\\.json$").matches(name)) return true
    if (Regex("(?i)(^|/)listens/").containsMatchIn(path) && Regex("(?i)\\.jsonl?$").containsMatchIn(name)) return true
    return Regex("(?i)\\.csv$").containsMatchIn(name)
  }

  private fun open(context: Context, address: String): InputStream =
    context.contentResolver.openInputStream(Uri.parse(address))?.buffered()
      ?: throw Told(R.string.jukebox_file_not_opened)

  /** A zip begins `PK` and two bytes that say what follows; looked at without being taken off the stream. */
  private fun isZip(stream: InputStream): Boolean {
    stream.mark(4)
    val head = ByteArray(4)
    var filled = 0
    while (filled < head.size) {
      val read = stream.read(head, filled, head.size - filled)
      if (read < 0) break
      filled += read
    }
    stream.reset()
    return filled == 4 && head[0] == 'P'.code.toByte() && head[1] == 'K'.code.toByte() && head[2] == 3.toByte() && head[3] == 4.toByte()
  }

  private fun bounded(stream: InputStream): String? {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(64 * 1024)
    while (true) {
      val read = stream.read(buffer)
      if (read < 0) break
      out.write(buffer, 0, read)
      if (out.size() > LIMIT) return null
    }
    return out.toString(Charsets.UTF_8.name())
  }

  /** What the file is called, where whoever is serving it will say. */
  private fun name(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    }
  }.getOrNull()
}
