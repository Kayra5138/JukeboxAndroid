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
  /**
   * The last few drawn, by what they were drawn for.
   *
   * A widget is redrawn on every pause and every change of track, and there
   * may be several on the home screen at different sizes; drawing the same
   * gradient again for each would be most of the work of an update. Four,
   * which covers a home screen with one of each kind on it.
   */
  private val drawn = object : LinkedHashMap<String, Bitmap>(8, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>?) = size > 4
  }

  /**
   * How many pixels the gradient is drawn in at most.
   *
   * It is all gradient, which survives being stretched, and it crosses to the
   * launcher by binder in the same transaction as the cover. Forty thousand is
   * the original 320 by 96 with a little to spare, and every shape is drawn
   * within it whatever its size on the screen.
   */
  private const val PIXELS = 40_000f

  /**
   * The rounding for the phones that draw it from the bitmap, in the units of
   * the widget: see jukebox_widget_radius. Twenty, as the original was.
   */
  private const val CORNER_DP = 20f

  /** The proportions the original was drawn in, for a widget whose size is not known. */
  private const val PLAIN_WIDTH_DP = 320f
  private const val PLAIN_HEIGHT_DP = 96f

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

  /**
   * The background for a widget [widthDp] by [heightDp], in the colours of
   * the cover at [path]; the plain one where that is null, which the caller
   * makes it where the cover could not be read.
   *
   * Drawn in the widget's own proportions, so that a large square widget is
   * not a long thin gradient stretched to fit and its glow is round.
   *
   * [rounded] is for Android 10 and 11 only. From 12 the layout clips itself
   * to the phone's own widget rounding (see jukebox_widget_shape.xml), at
   * the screen's resolution rather than the bitmap's, and corners drawn in
   * here as well would show as a soft second edge inside the sharp one.
   */
  @Synchronized
  fun background(path: String?, widthDp: Float, heightDp: Float, rounded: Boolean): Bitmap {
    val wide = if (widthDp > 0f) widthDp else PLAIN_WIDTH_DP
    val tall = if (heightDp > 0f) heightDp else PLAIN_HEIGHT_DP
    val scale = kotlin.math.sqrt(PIXELS / (wide * tall))
    val width = (wide * scale).toInt().coerceIn(16, 640)
    val height = (tall * scale).toInt().coerceIn(16, 640)
    val corner = if (rounded) CORNER_DP * width / wide else 0f

    val source = if (path == null) "empty" else "$path:${java.io.File(path).lastModified()}"
    val key = "$source:$width:$height:$corner"
    drawn[key]?.let { return it }

    val colours = stopsFor(source, path)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val w = width.toFloat()
    val h = height.toFloat()
    val bounds = RectF(0f, 0f, w, h)
    if (corner > 0f) canvas.clipPath(Path().apply { addRoundRect(bounds, corner, corner, Path.Direction.CW) })
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG)

    // Corner to corner, dark under the cover and the title, where the eye starts.
    paint.shader = LinearGradient(
      0f, 0f, w, h,
      colours, floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP
    )
    canvas.drawRect(bounds, paint)

    // The second colour again as a glow in the far corner, so the gradient
    // has somewhere it is going rather than only fading along a line. Sized
    // by the longer side, which in the original row was the width.
    paint.shader = RadialGradient(
      w * 0.92f, 0f, maxOf(w, h) * 0.5f,
      withAlpha(colours[2], 150), withAlpha(colours[2], 0), Shader.TileMode.CLAMP
    )
    canvas.drawRect(bounds, paint)

    // A sheen from the top and a shade at the foot, which is where the
    // progress line sits and wants something dark to be seen against.
    paint.shader = LinearGradient(
      0f, 0f, 0f, h,
      intArrayOf(0x1AFFFFFF, 0x00FFFFFF, 0x38000000), floatArrayOf(0f, 0.45f, 1f),
      Shader.TileMode.CLAMP
    )
    canvas.drawRect(bounds, paint)
    paint.shader = null

    /*
      The fine light edge the original drew here is drawn by the layout now,
      as the root's foreground (jukebox_widget_edge.xml). Drawn into a bitmap
      that is stretched four or five times over it was a blurred band rather
      than a line, and from Android 12 the clip would have cut it off at the
      corners.
    */

    drawn[key] = bitmap
    return bitmap
  }

  /** The colours of the last cover read, which every size of widget shares. */
  private var stopsSource: String? = null
  private var stops: IntArray = PLAIN

  private fun stopsFor(source: String, path: String?): IntArray {
    if (source == stopsSource) return stops
    return read(path).also {
      stopsSource = source
      stops = it
    }
  }

  private fun read(path: String?): IntArray {
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
