package expo.modules.jukeboxaudio.widget

import android.graphics.*
import expo.modules.jukeboxaudio.CoverColour

/**
 * The widget's background: a gradient in the colours of the cover.
 *
 * It used to be the cover itself, shrunk to nothing and stretched back out.
 * That is one colour by the time it is blurred enough not to be a picture, and
 * a muddy one: the average of a busy cover is the same brown-grey as the
 * average of any other. The colours are picked now rather than averaged, the
 * same way the tiles pick theirs, and laid out as a gradient.
 */
object WidgetGlass {
  private var cachedKey: String? = null
  private var cachedBitmap: Bitmap? = null

  /** Drawn small: it is all gradient, and it crosses to the launcher by binder. */
  private const val WIDTH = 320
  private const val HEIGHT = 96
  private const val CORNER = 20f

  /** What is drawn where there is no cover to take colours from. */
  private val PLAIN = intArrayOf(0xFF1B1F27.toInt(), 0xFF2A303B.toInt(), 0xFF3A4352.toInt())

  /**
   * How much of each stop's brightness is kept, dark end to light end.
   *
   * The stops come made for tiles, where the light one is meant to be bright.
   * Here the title is written over them in near-white, so the light end is
   * brought down until that still reads, and the dark end is left alone.
   */
  private val KEPT = floatArrayOf(1f, 0.72f, 0.56f)

  @Synchronized
  fun background(cover: Bitmap?, path: String?): Bitmap {
    val key = if (cover == null) "empty" else "$path:${java.io.File(path.orEmpty()).lastModified()}"
    if (key == cachedKey) cachedBitmap?.let { return it }

    val stops = stopsFor(if (cover == null) null else path)
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val bounds = RectF(0f, 0f, WIDTH.toFloat(), HEIGHT.toFloat())
    canvas.clipPath(Path().apply { addRoundRect(bounds, CORNER, CORNER, Path.Direction.CW) })
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG)

    // Corner to corner, dark under the cover and the title, where the eye starts.
    paint.shader = LinearGradient(
      0f, 0f, WIDTH.toFloat(), HEIGHT.toFloat(),
      stops, floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP
    )
    canvas.drawRect(bounds, paint)

    // The second colour again as a glow in the far corner, so the gradient
    // has somewhere it is going rather than only fading along a line.
    paint.shader = RadialGradient(
      WIDTH * 0.92f, 0f, WIDTH * 0.5f,
      withAlpha(stops[2], 150), withAlpha(stops[2], 0), Shader.TileMode.CLAMP
    )
    canvas.drawRect(bounds, paint)

    // A sheen from the top and a shade at the foot, which is where the
    // progress line sits and wants something dark to be seen against.
    paint.shader = LinearGradient(
      0f, 0f, 0f, HEIGHT.toFloat(),
      intArrayOf(0x1AFFFFFF, 0x00FFFFFF, 0x38000000), floatArrayOf(0f, 0.45f, 1f),
      Shader.TileMode.CLAMP
    )
    canvas.drawRect(bounds, paint)
    paint.shader = null

    paint.color = 0x2EFFFFFF
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1f
    canvas.drawRoundRect(RectF(.5f, .5f, WIDTH - .5f, HEIGHT - .5f), CORNER, CORNER, paint)

    cachedKey = key
    cachedBitmap = bitmap
    return bitmap
  }

  private fun stopsFor(path: String?): IntArray {
    val found = path?.let { runCatching { CoverColour.of(it) }.getOrNull() }
    if (found == null || found.size < 3) return PLAIN
    return IntArray(3) { dimmed(Color.parseColor(found[it]), KEPT[it]) }
  }

  private fun dimmed(colour: Int, kept: Float): Int = Color.rgb(
    (Color.red(colour) * kept).toInt(),
    (Color.green(colour) * kept).toInt(),
    (Color.blue(colour) * kept).toInt()
  )

  private fun withAlpha(colour: Int, alpha: Int): Int =
    Color.argb(alpha, Color.red(colour), Color.green(colour), Color.blue(colour))
}
