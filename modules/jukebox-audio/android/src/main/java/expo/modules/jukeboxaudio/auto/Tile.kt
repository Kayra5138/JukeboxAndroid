package expo.modules.jukeboxaudio.auto

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import expo.modules.jukeboxaudio.MediaStoreLibrary
import java.io.File

/**
 * A cover for a song that has none.
 *
 * Plenty of files carry no picture, and a car draws its own broken-image mark
 * where one is missing. Two of those in a wall of records does not read as two
 * songs without artwork — it reads as a wall that is failing to load, which is
 * the worse of the two impressions by a distance.
 *
 * So one is made instead: a colour taken from the song itself and the letter it
 * begins with. Deliberately not a generic music note, which would make every
 * such song identical and the shelf harder to read than it was; the colour and
 * the letter together are enough to tell two of them apart at a glance and to
 * find the same one again tomorrow, because both are derived from the track and
 * neither changes.
 */
internal object Tile {
  /**
   * Big enough for the largest thing a car asks for.
   *
   * Head units hint at around 256 pixels and some ask for more; one size that
   * covers them is cheaper than guessing, since these are drawn once and kept.
   */
  private const val SIZE = 512

  /**
   * Colours chosen to sit apart from each other and to carry white text.
   *
   * Picked by hand rather than by spinning the hue wheel: an even spread of
   * hues at one saturation gives yellows and cyans that white letters vanish
   * into, and a wall wants to look chosen rather than generated.
   */
  private val colours = listOf(
    0xFF3F51B5.toInt(), 0xFF00695C.toInt(), 0xFF6A1B9A.toInt(), 0xFFAD1457.toInt(),
    0xFF283593.toInt(), 0xFF00838F.toInt(), 0xFF4E342E.toInt(), 0xFFC62828.toInt(),
    0xFF37474F.toInt(), 0xFF2E7D32.toInt(), 0xFF4527A0.toInt(), 0xFFEF6C00.toInt()
  )

  /** The tile for [trackId], drawn once and kept. */
  fun of(context: Context, trackId: String): File? {
    val directory = File(context.cacheDir, "cover-tiles")
    if (!directory.isDirectory && !directory.mkdirs()) return null

    val target = File(directory, "$trackId.png")
    if (target.isFile && target.length() > 0) return target

    val title = runCatching { MediaStoreLibrary.titleOf(context, trackId) }.getOrNull()
    val bitmap = draw(trackId, title)

    // Written aside and renamed, so a half-written png can never be found by
    // the next reader and trusted because it exists.
    val temporary = File.createTempFile("tile-", ".part", directory)
    return runCatching {
      temporary.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
      check(temporary.renameTo(target)) { "could not keep the tile" }
      target
    }.getOrElse {
      temporary.delete()
      null
    }.also { bitmap.recycle() }
  }

  private fun draw(trackId: String, title: String?): Bitmap {
    val bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    // Steady for a given song: the same record keeps the same tile, which is
    // what lets it be recognised at all.
    val seed = trackId.hashCode().let { if (it == Int.MIN_VALUE) 0 else Math.abs(it) }
    val colour = colours[seed % colours.size]

    // A slight fall of light across it, because a flat rectangle among
    // photographs looks like something that failed rather than something drawn.
    canvas.drawPaint(Paint().apply {
      shader = LinearGradient(
        0f, 0f, 0f, SIZE.toFloat(),
        lighten(colour, 0.18f), darken(colour, 0.12f),
        Shader.TileMode.CLAMP
      )
    })

    val letter = title?.trim()?.firstOrNull()?.uppercaseChar()?.toString()
    if (!letter.isNullOrBlank()) {
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(235, 255, 255, 255)
        textSize = SIZE * 0.46f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
      }
      // Centred on the letter's own body rather than on the font's line box,
      // which includes room for descenders this never draws and sits the
      // letter visibly high.
      val bounds = android.graphics.Rect()
      paint.getTextBounds(letter, 0, letter.length, bounds)
      canvas.drawText(letter, SIZE / 2f, SIZE / 2f + bounds.height() / 2f, paint)
    }

    return bitmap
  }

  private fun lighten(colour: Int, by: Float) = blend(colour, Color.WHITE, by)
  private fun darken(colour: Int, by: Float) = blend(colour, Color.BLACK, by)

  private fun blend(from: Int, to: Int, amount: Float): Int = Color.rgb(
    (Color.red(from) + (Color.red(to) - Color.red(from)) * amount).toInt(),
    (Color.green(from) + (Color.green(to) - Color.green(from)) * amount).toInt(),
    (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * amount).toInt()
  )
}
