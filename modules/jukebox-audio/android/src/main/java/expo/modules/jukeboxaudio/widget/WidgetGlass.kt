package expo.modules.jukeboxaudio.widget

import android.graphics.*

/** Cover-derived frosted glass; RemoteViews cannot blur the launcher's wallpaper. */
object WidgetGlass {
  private var cachedKey: String? = null
  private var cachedBitmap: Bitmap? = null

  @Synchronized
  fun background(cover: Bitmap?, path: String?): Bitmap {
    val key = if (cover == null) "empty" else "$path:${java.io.File(path.orEmpty()).lastModified()}"
    if (key == cachedKey) cachedBitmap?.let { return it }
    val width = 320
    val height = 96
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val bounds = RectF(0f, 0f, width.toFloat(), height.toFloat())
    val clip = Path().apply { addRoundRect(bounds, 20f, 20f, Path.Direction.CW) }
    canvas.clipPath(clip)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    // Tiny downsampling followed by bilinear upscaling removes recognisable detail.
    val tiny = cover?.let { Bitmap.createScaledBitmap(it, 6, 6, true) }
    var red = 40; var green = 45; var blue = 55
    if (tiny != null) {
      var r = 0; var g = 0; var b = 0
      for (y in 0 until 6) for (x in 0 until 6) {
        val color = tiny.getPixel(x, y)
        r += Color.red(color); g += Color.green(color); b += Color.blue(color)
      }
      red = r / 36; green = g / 36; blue = b / 36
    }
    paint.color = Color.argb(180, (red * .38f).toInt(), (green * .38f).toInt(), (blue * .38f).toInt())
    canvas.drawRect(bounds, paint)
    if (tiny != null) {
      paint.alpha = 60
      canvas.drawBitmap(tiny, null, bounds, paint)
      if (tiny !== cover) tiny.recycle()
    }
    paint.alpha = 255
    paint.shader = LinearGradient(0f, 0f, width.toFloat(), height.toFloat(),
      intArrayOf(0x24FFFFFF, 0x00FFFFFF, 0x16000000), null, Shader.TileMode.CLAMP)
    canvas.drawRect(bounds, paint)
    paint.shader = null
    // A restrained grain and a fine rim give the surface a frosted finish.
    val random = java.util.Random(7)
    repeat(900) {
      paint.color = if (random.nextBoolean()) 0x08FFFFFF else 0x08000000
      canvas.drawPoint(random.nextInt(width).toFloat(), random.nextInt(height).toFloat(), paint)
    }
    paint.color = 0x30FFFFFF
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1f
    canvas.drawRoundRect(RectF(.5f, .5f, width - .5f, height - .5f), 20f, 20f, paint)
    cachedKey = key
    cachedBitmap = bitmap
    return bitmap
  }
}
