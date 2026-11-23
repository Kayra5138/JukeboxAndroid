package expo.modules.jukeboxaudio

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.text.TextPaint
import android.text.TextUtils
import java.io.File

/**
 * A cover for a record that has none: a plain paper sleeve, the kind a record
 * came home in when its own was lost, with the record showing through the
 * hole in the middle and a label of its own colour.
 *
 * A blank square among covers reads as a picture that failed to load; one
 * shared mark for all of them makes a shelf of them a row of the same thing.
 * The label tells them apart: its colour is the record's genre, the same
 * genre always the same colour, so a library's records of one kind look of a
 * family; failing a genre, it is the record's own. Seen large it carries the
 * record's name and whose it is, as a label does.
 *
 * One for each record (or each song with no record), drawn once and kept, the
 * same file for the app, the widget, the notification and the car: the app
 * works out its name by the same reckoning as [nameOf], so it knows which
 * are made before it asks.
 */
object StandIn {
  /** Big enough for the player and the largest a car asks for; anything smaller is read down from it. */
  private const val SIZE = 600

  /**
   * Where they are kept, by the drawing they were made with: a sleeve drawn
   * otherwise is drawn again rather than kept as it was.
   */
  private const val DRAWING = 3
  private fun folder(context: Context) = File(File(context.filesDir, "stand-ins"), "$DRAWING")

  /**
   * The colours a label can be: the artists' map's, so that a genre drawn in
   * one colour there is not another one here more often than it need be.
   */
  private val LABELS = intArrayOf(
    0xFFE57373.toInt(), 0xFF64B5F6.toInt(), 0xFF81C784.toInt(), 0xFFFFB74D.toInt(),
    0xFFBA68C8.toInt(), 0xFF4DD0E1.toInt(), 0xFFF06292.toInt(), 0xFFAED581.toInt(),
    0xFFFFD54F.toInt(), 0xFF7986CB.toInt(), 0xFF4DB6AC.toInt(), 0xFFFF8A65.toInt(),
  )

  /**
   * Which record a stand-in is for: its name and whose it is, or failing a
   * name the song's; and its genre, so that a genre found or written later
   * gives it a sleeve of the new colour rather than leaving the old one.
   */
  fun identityOf(album: String?, albumArtist: String?, title: String?, artist: String?, genre: String?): String {
    fun plain(text: String?) = text?.trim()?.lowercase().orEmpty()
    val record = plain(album)
    val who = if (record.isNotEmpty()) "a\u0000$record\u0000${plain(albumArtist).ifEmpty { plain(artist) }}"
    else "t\u0000${plain(title)}\u0000${plain(artist)}"
    return "$who\u0000${plain(genre)}"
  }

  /**
   * The file name for [identity]: two hashes of it side by side, worked out
   * exactly as the app's `standInName` works it out.
   */
  fun nameOf(identity: String): String {
    var a = 0x811c9dc5.toInt()
    var b = 0x01000193 xor identity.length
    for (char in identity) {
      val code = char.code
      a = (a xor code) * 0x01000193
      b = ((b xor code) * 0x5bd1e995) xor (b ushr 13)
    }
    return (a.toLong() and 0xffffffffL).toString(36) + (b.toLong() and 0xffffffffL).toString(36)
  }

  /** The names of those made already, for the app to know them without asking. */
  fun list(context: Context): Map<String, Any> {
    val directory = folder(context)
    // Those of an earlier drawing let go of.
    File(context.filesDir, "stand-ins").listFiles()?.forEach { if (it != directory) it.deleteRecursively() }
    val names = directory.list()?.filter { it.endsWith(".jpg") }?.map { it.removeSuffix(".jpg") }.orEmpty()
    return mapOf("dir" to "file://${directory.path}", "names" to names)
  }

  /**
   * The stand-in for a record, made if it is not yet: its `file://` address,
   * or null where it could not be written.
   */
  fun make(
    context: Context,
    album: String?,
    albumArtist: String?,
    title: String?,
    artist: String?,
    genre: String?,
  ): String? = file(context, album, albumArtist, title, artist, genre)?.let { "file://${it.path}" }

  /** As [make], for one of the library's songs, from what is known of it here. */
  fun forTrack(context: Context, trackId: String): File? {
    val library = expo.modules.jukeboxaudio.auto.LibraryDatabase
    // As the app has it: what a lookup or a hand corrected, over what the file says.
    val known = runCatching { library.described(context, trackId) }.getOrNull()
    val stored = runCatching { MediaStoreLibrary.queryTrack(context, trackId, library.libraryRoot(context)) }.getOrNull()
    if (known == null && stored == null) return null
    return file(
      context,
      album = known?.album ?: stored?.get("album") as? String,
      albumArtist = known?.albumArtist ?: stored?.get("albumArtist") as? String,
      title = known?.title ?: stored?.get("title") as? String,
      artist = known?.artist ?: stored?.get("artist") as? String,
      genre = known?.genre,
    )
  }

  private fun file(
    context: Context,
    album: String?,
    albumArtist: String?,
    title: String?,
    artist: String?,
    genre: String?,
  ): File? {
    val directory = folder(context)
    // Made and then looked for, as the covers' folder is (see `MediaStoreLibrary.embeddedArtwork`): sleeves are drawn several at once.
    directory.mkdirs()
    if (!directory.isDirectory) return null
    val identity = identityOf(album, albumArtist, title, artist, genre)
    val target = File(directory, "${nameOf(identity)}.jpg")
    if (target.isFile && target.length() > 0) return target

    val named = album?.trim()?.takeIf { it.isNotEmpty() } ?: title?.trim()
    val by = albumArtist?.trim()?.takeIf { it.isNotEmpty() } ?: artist?.trim()
    val bitmap = draw(labelColour(genre, identity), named, by)
    // Written aside and renamed, so that a half-written file is never found and trusted.
    val temporary = File.createTempFile("stand-in-", ".part", directory)
    return runCatching {
      temporary.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
      check(temporary.renameTo(target)) { "could not keep the stand-in" }
      target
    }.getOrElse {
      temporary.delete()
      null
    }.also { bitmap.recycle() }
  }

  /** The genre's colour, the same genre always the same; failing one, the record's own. */
  private fun labelColour(genre: String?, identity: String): Int {
    val by = genre?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: identity
    return LABELS[Math.floorMod(by.hashCode(), LABELS.size)]
  }

  private fun draw(label: Int, name: String?, by: String?): Bitmap {
    val size = SIZE.toFloat()
    val middle = size / 2f
    val bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    // The record itself, what shows through the hole: black, with its grooves catching a little light.
    val hole = size * 0.29f
    paint.shader = RadialGradient(middle, middle, hole, intArrayOf(0xFF2A2A2C.toInt(), 0xFF141415.toInt()), null, Shader.TileMode.CLAMP)
    canvas.drawCircle(middle, middle, hole, paint)
    paint.shader = null
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = size * 0.0025f
    paint.color = Color.argb(40, 255, 255, 255)
    var groove = size * 0.205f
    while (groove < hole) {
      canvas.drawCircle(middle, middle, groove, paint)
      groove += size * 0.013f
    }
    paint.style = Paint.Style.FILL

    // The label, and the hole for the spindle.
    val labelRadius = size * 0.175f
    paint.color = label
    canvas.drawCircle(middle, middle, labelRadius, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = size * 0.003f
    paint.color = Color.argb(46, 0, 0, 0)
    canvas.drawCircle(middle, middle, labelRadius * 0.84f, paint)
    paint.style = Paint.Style.FILL

    // The sleeve over it all, a hole cut in the middle: paper, a little darker towards its foot.
    val sleeve = android.graphics.Path().apply {
      fillType = android.graphics.Path.FillType.EVEN_ODD
      addRect(0f, 0f, size, size, android.graphics.Path.Direction.CW)
      addCircle(middle, middle, hole, android.graphics.Path.Direction.CW)
    }
    // Opaque, whatever the last stroke was: a shader is drawn at the paint's own alpha.
    paint.color = Color.WHITE
    paint.shader = LinearGradient(0f, 0f, 0f, size, 0xFFEDE7DA.toInt(), 0xFFDCD3C1.toInt(), Shader.TileMode.CLAMP)
    canvas.drawPath(sleeve, paint)
    paint.shader = null
    // The edge of the cut, in the paper's own shadow.
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = size * 0.006f
    paint.color = 0x33000000
    canvas.drawCircle(middle, middle, hole + size * 0.002f, paint)
    // Where the paper is folded over at the top, and a seam down one side.
    paint.strokeWidth = size * 0.004f
    paint.color = 0x14000000
    canvas.drawLine(0f, size * 0.035f, size, size * 0.035f, paint)
    canvas.drawLine(size * 0.03f, size * 0.035f, size * 0.03f, size, paint)
    paint.style = Paint.Style.FILL

    // The record's name over the spindle and whose it is under it, as small as a label's print.
    val ink = if (lightness(label) > 0.62f) 0xDD2B2420.toInt() else 0xEEFFFFFF.toInt()
    val room = labelRadius * 1.36f
    fun write(text: String?, y: Float, height: Float, bold: Boolean) {
      if (text.isNullOrBlank()) return
      val print = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ink
        textSize = height
        typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
      }
      // As small as two thirds of its size before anything is cut off.
      while (print.measureText(text) > room && print.textSize > height * 0.67f) print.textSize -= 1f
      val fitted = TextUtils.ellipsize(text, print, room, TextUtils.TruncateAt.END).toString()
      canvas.drawText(fitted, middle, y, print)
    }
    write(name, middle - labelRadius * 0.28f, size * 0.034f, bold = true)
    write(by, middle + labelRadius * 0.44f, size * 0.028f, bold = false)
    paint.color = 0xFF141415.toInt()
    canvas.drawCircle(middle, middle, size * 0.012f, paint)

    return bitmap
  }

  private fun lightness(colour: Int): Float =
    (0.299f * Color.red(colour) + 0.587f * Color.green(colour) + 0.114f * Color.blue(colour)) / 255f
}
