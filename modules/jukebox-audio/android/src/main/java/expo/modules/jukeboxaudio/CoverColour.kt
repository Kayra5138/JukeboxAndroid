package expo.modules.jukeboxaudio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import androidx.palette.graphics.Palette
import java.io.File

/**
 * The colours a cover is mostly made of, for something else to be drawn in.
 *
 * Palette does the work: it quantises a small copy of the picture and picks
 * swatches by how vivid and how populous each cluster is, which is a much
 * better answer than averaging — an average of any busy cover is the same
 * brown-grey as an average of any other.
 */
object CoverColour {
  /**
   * How wide the copy handed to Palette is.
   *
   * It only needs the colours, not the picture; a cover read at full size is
   * a megabyte of bitmap to answer a question about a dozen clusters.
   */
  private const val SAMPLE = 96

  /** Kept away from both ends: a stop at pure black or white is not a colour. */
  private const val DARKEST = 0.14f
  private const val LIGHTEST = 0.72f

  /**
   * What a cover was read as: the stops to draw in, and the colour they were
   * made from.
   *
   * The stops are never colourless, which is what a gradient wants and is not
   * the truth about a black-and-white cover: its greys are given a saturation
   * they do not have, and since a grey's hue is nought, they come out red.
   * `main` is the cover's leading colour as it was found, before any of that,
   * for a caller that would rather know a grey cover is one.
   */
  class Reading(val stops: List<String>, val main: String)

  /**
   * Three stops, dark to light, sharing the cover's hue.
   *
   * Answers null where there is no picture to read, so the caller can keep
   * whatever it would have used anyway rather than showing a grey card.
   */
  fun of(path: String): List<String>? = read(path)?.stops

  /** The same three stops, and with them the colour they were made from. */
  fun read(path: String): Reading? {
    val file = File(path.removePrefix("file://"))
    if (!file.isFile) return null

    val bitmap = sample(file) ?: return null
    val palette = runCatching { Palette.from(bitmap).maximumColorCount(24).generate() }
      .getOrNull()
    bitmap.recycle()
    if (palette == null) return null

    /*
      Two of the cover's colours, not one of them twice.

      A single hue taken from dark to light is only ever as good as that hue:
      a cover whose boldest region is a field of yellow-green comes out the
      colour of mud, however it is ramped. Covers are rarely one colour — this
      one is a pink sky over that field — so the gradient runs between the two
      that carry it, which is both prettier and a better likeness.
    */
    val swatches = palette.swatches.ifEmpty { return null }
    val busiest = swatches.maxOf { it.population }
    val worth = swatches
      .filter { it.population >= busiest * 0.04 }
      // Plentiful and colourful together, since either alone picks badly:
      // population finds the background, saturation finds a stray highlight.
      .sortedByDescending { it.population.toDouble() * (saturationOf(it.rgb) + 0.25) }

    val first = worth.firstOrNull() ?: return null
    // Far enough round the wheel to read as a second colour rather than as a
    // slightly different shade of the first.
    val second = worth.drop(1).firstOrNull { apart(hueOf(it.rgb), hueOf(first.rgb)) >= 35f }

    val hueA = hueOf(first.rgb)
    val hueB = second?.let { hueOf(it.rgb) } ?: (hueA + 22f)
    val satA = saturationOf(first.rgb).coerceIn(0.45f, 0.95f)
    val satB = (second?.let { saturationOf(it.rgb) } ?: satA).coerceIn(0.45f, 0.95f)

    return Reading(
      stops = listOf(
        shade(hueA, satA * 0.9f, DARKEST),
        shade(hueA, satA, (DARKEST + LIGHTEST) / 2f),
        shade(hueB, satB, LIGHTEST)
      ),
      main = String.format("#%06X", 0xFFFFFF and first.rgb)
    )
  }

  private fun hueOf(rgb: Int): Float = parts(rgb)[0]

  private fun saturationOf(rgb: Int): Float = parts(rgb)[1]

  private fun parts(rgb: Int): FloatArray {
    val out = FloatArray(3)
    Color.RGBToHSV(Color.red(rgb), Color.green(rgb), Color.blue(rgb), out)
    return out
  }

  /** How far apart two hues are on a wheel that joins up at three hundred and sixty. */
  private fun apart(a: Float, b: Float): Float {
    val gap = kotlin.math.abs(a - b) % 360f
    return if (gap > 180f) 360f - gap else gap
  }

  /** A hue at a given lightness, as the "#rrggbb" the drawing side wants. */
  private fun shade(hue: Float, saturation: Float, lightness: Float): String {
    val colour = Color.HSVToColor(
      floatArrayOf(((hue % 360f) + 360f) % 360f, saturation, 1f)
    )
    // HSV's value is not HSL's lightness; mixing towards black is the shorter
    // way to the same place and keeps the hue exactly.
    val mixed = Color.rgb(
      (Color.red(colour) * lightness).toInt().coerceIn(0, 255),
      (Color.green(colour) * lightness).toInt().coerceIn(0, 255),
      (Color.blue(colour) * lightness).toInt().coerceIn(0, 255)
    )
    return String.format("#%06X", 0xFFFFFF and mixed)
  }

  private fun sample(file: File): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    val widest = maxOf(bounds.outWidth, bounds.outHeight)
    if (widest <= 0) return null

    var step = 1
    while (widest / (step * 2) >= SAMPLE) step *= 2

    return runCatching {
      BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = step })
    }.getOrNull()
  }
}
