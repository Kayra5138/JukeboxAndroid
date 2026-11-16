package expo.modules.jukeboxaudio

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File

/**
 * Small copies of the covers, for where a cover is drawn small: a row of a
 * list, a wall of covers thirteen or twenty-one to a row.
 *
 * The covers themselves are kept as they came, a thousand pixels across and
 * more, and a picture is read whole to be drawn at any size: a screen of a
 * few hundred covers the size of a fingernail was a few hundred of those,
 * which a cheap phone takes seconds over. A copy a couple of hundred pixels
 * across is read in a fraction of the time, and is made once.
 *
 * Named by the side that asks, after the address of the cover it is a copy
 * of: every cover the app keeps is under a name of its own that a new
 * picture does not take over, so a copy cannot go on showing one that has
 * been replaced.
 */
object Thumbs {
  /** The longest side of a copy, in pixels. */
  const val SIDE = 192

  private fun folder(context: Context): File = File(context.cacheDir, "thumbs").apply { mkdirs() }

  /** Where the copies are, and the names of those already made. */
  fun list(context: Context): Map<String, Any> {
    val dir = folder(context)
    val names = dir.list()?.filter { it.endsWith(".jpg") }?.map { it.removeSuffix(".jpg") } ?: emptyList()
    return mapOf("dir" to Uri.fromFile(dir).toString(), "names" to names)
  }

  /**
   * The copy of the cover at [source] (a file of the app's) under [name],
   * made now if it is not there yet; null where the cover cannot be read.
   */
  fun make(context: Context, source: String, name: String): String? {
    if (!name.matches(Regex("[0-9a-z]{1,40}"))) return null
    val target = File(folder(context), "$name.jpg")
    if (target.isFile && target.length() > 0) return Uri.fromFile(target).toString()
    val path = Uri.parse(source).takeIf { it.scheme == "file" }?.path ?: return null
    val file = File(path)
    if (!file.isFile) return null

    // Read at a fraction of its size, the largest that still leaves it at least SIDE across.
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    if (longest <= 0) return null
    var sample = 1
    while (longest / (sample * 2) >= SIDE) sample *= 2
    val read = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val scale = SIDE.toFloat() / maxOf(read.width, read.height)
    val small = if (scale < 1f) {
      Bitmap.createScaledBitmap(read, maxOf(1, (read.width * scale).toInt()), maxOf(1, (read.height * scale).toInt()), true)
    } else {
      read
    }
    // Written aside and renamed, so that one cut short is never taken for made.
    return try {
      val part = File.createTempFile("$name-", ".part", folder(context))
      part.outputStream().use { small.compress(Bitmap.CompressFormat.JPEG, 82, it) }
      if (!part.renameTo(target)) part.delete()
      if (target.isFile) Uri.fromFile(target).toString() else null
    } catch (_: Exception) {
      null
    } finally {
      if (small !== read) small.recycle()
      read.recycle()
    }
  }
}
