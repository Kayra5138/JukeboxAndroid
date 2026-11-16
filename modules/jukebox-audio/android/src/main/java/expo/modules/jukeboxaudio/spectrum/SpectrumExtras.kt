package expo.modules.jukeboxaudio.spectrum

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tanh
import kotlin.random.Random

/*
  What [SpectrumView] draws besides its bars, spokes, rings, glow and line:
  each kept apart here with what it remembers from one frame to the next, told
  what is heard at each frame and asked to draw itself in the shape it is given.
  None of them makes anything at a frame that a frame before could have made:
  paints, paths and pictures are kept, so that drawing sixty times a second
  costs drawing and nothing more.
*/

/**
 * The spectrum as it has gone, the newest at the right and the oldest
 * leaving at the left, low pitches at the foot: a picture a column at a time,
 * of which the newest column alone is written at each step and the rest laid
 * down again where they were.
 */
class Waterfall {
  private val picture = Bitmap.createBitmap(COLUMNS, SpectrumAnalyzer.BANDS, Bitmap.Config.ARGB_8888)
  private val column = IntArray(SpectrumAnalyzer.BANDS)
  private var next = 0
  private var stepped = 0f
  private var lit = false
  // Not smoothed when laid down large: each step and each pitch a block of its own, which reads, where smoothed it was a smear.
  private val paint = Paint()
  private val needle = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    strokeCap = Paint.Cap.ROUND
  }
  private val from = Rect()
  private val to = RectF()

  fun showing(): Boolean = lit

  /** A column for what is heard now, once enough time has passed for one. */
  fun settle(bands: FloatArray, seconds: Float) {
    stepped += seconds
    if (stepped < STEP_SECONDS) return
    stepped = 0f
    var any = false
    for (band in 0 until SpectrumAnalyzer.BANDS) {
      val value = bands[band]
      if (value > 0.02f) any = true
      // Nothing for quiet, then up through the heat of the scale below, white for the loudest.
      column[SpectrumAnalyzer.BANDS - 1 - band] = heatOf(value)
    }
    picture.setPixels(column, 0, 1, next, 0, 1, SpectrumAnalyzer.BANDS)
    next = (next + 1) % COLUMNS
    // Shown while anything is left of what was heard.
    if (any) lit = true else if (next == 0) lit = false
  }

  fun clear() {
    picture.eraseColor(Color.TRANSPARENT)
    lit = false
  }

  /*
    Laid round a ring by a mesh over the picture in the order it was heard in,
    oldest first: the picture itself is a ring of columns written at [next],
    and a mesh across the place where the newest meets the oldest would be
    stretched the whole way round.
  */
  private val ordered = Bitmap.createBitmap(COLUMNS, SpectrumAnalyzer.BANDS, Bitmap.Config.ARGB_8888)
  private val row = IntArray(COLUMNS * SpectrumAnalyzer.BANDS)
  private val turned = IntArray(COLUMNS)
  private val mesh = FloatArray((COLUMNS + 1) * (RINGS + 1) * 2)
  private var orderedAt = -1
  private var meshFor = ""

  /**
   * Round ([centreX], [centreY]) between [inner] and [outer]: the newest at
   * the top, the older going round clockwise from it, the low pitches inside.
   */
  fun drawRound(canvas: Canvas, centreX: Float, centreY: Float, inner: Float, outer: Float, strength: Float) {
    if (!lit || outer <= inner) return
    if (orderedAt != next) {
      orderedAt = next
      picture.getPixels(row, 0, COLUMNS, 0, 0, COLUMNS, SpectrumAnalyzer.BANDS)
      /*
        Turned so that the oldest column comes first: from [next] to the end,
        then the start up to it. And each the fainter the older it is, as the
        trace on a radar's screen fades behind the sweep: the newest is
        written bright at the needle, the rest fade going round, and the
        oldest, come round to meet the needle from the other side, is all
        but gone. Where the ring closes on itself is the needle, writing.
        By age alone, never by what is heard now, so nothing there flickers.
      */
      for (band in 0 until SpectrumAnalyzer.BANDS) {
        val start = band * COLUMNS
        for (column in 0 until COLUMNS) {
          val pixel = row[start + (next + column) % COLUMNS]
          val kept = (Color.alpha(pixel) * AGE_FADE[column]).toInt()
          turned[column] = (kept shl 24) or (pixel and 0x00FFFFFF)
        }
        turned.copyInto(row, start)
      }
      ordered.setPixels(row, 0, COLUMNS, 0, 0, COLUMNS, SpectrumAnalyzer.BANDS)
    }
    val key = "$centreX:$centreY:$inner:$outer"
    if (key != meshFor) {
      meshFor = key
      var at = 0
      for (ring in 0..RINGS) {
        // The picture's top row is the highest pitch: outermost.
        val radius = outer - (outer - inner) * ring / RINGS
        for (column in 0..COLUMNS) {
          // The newest, at the right of the picture, at the top; the oldest just past it, going round.
          val angle = (-Math.PI / 2 + 2 * Math.PI * (column - COLUMNS) / COLUMNS).toFloat()
          mesh[at++] = centreX + cos(angle) * radius
          mesh[at++] = centreY + sin(angle) * radius
        }
      }
    }
    paint.alpha = (255 * strength).toInt()
    canvas.drawBitmapMesh(ordered, COLUMNS, RINGS, mesh, 0, null, 0, paint)
    // The needle: a fine line across the ring at the top, where what is heard is written.
    needle.strokeWidth = max(1.5f, (outer - inner) * 0.03f)
    needle.alpha = (200 * strength).toInt()
    canvas.drawLine(centreX, centreY - inner, centreX, centreY - outer, needle)
  }

  /**
   * A colour for how loud a pitch is, as spectrograms are drawn: from
   * nothing through deep violet, red and amber to white, so that loud and
   * quiet read apart over any cover, whatever its colours or the theme's.
   */
  private fun heatOf(value: Float): Int {
    val v = value.coerceIn(0f, 1f)
    val alpha = (255 * min(1f, v * 1.8f)).toInt()
    val at = v * (HEAT.size - 1)
    val low = at.toInt().coerceAtMost(HEAT.size - 2)
    val share = at - low
    val a = HEAT[low]
    val b = HEAT[low + 1]
    fun mix(of: (Int) -> Int) = (of(a) + (of(b) - of(a)) * share).toInt()
    return Color.argb(alpha, mix(Color::red), mix(Color::green), mix(Color::blue))
  }

  /** Over [room], fainter by [strength]: the older part from [next] on, then the newer up to it. */
  fun draw(canvas: Canvas, room: RectF, strength: Float) {
    if (!lit || room.width() <= 0f) return
    paint.alpha = (255 * strength).toInt()
    val older = COLUMNS - next
    val share = room.width() / COLUMNS
    from.set(next, 0, COLUMNS, SpectrumAnalyzer.BANDS)
    to.set(room.left, room.top, room.left + older * share, room.bottom)
    canvas.drawBitmap(picture, from, to, paint)
    if (next > 0) {
      from.set(0, 0, next, SpectrumAnalyzer.BANDS)
      to.set(room.left + older * share, room.top, room.right, room.bottom)
      canvas.drawBitmap(picture, from, to, paint)
    }
  }

  private companion object {
    /** How many steps are kept, and how long each is: some three seconds across. */
    const val COLUMNS = 96
    /** How much of each column shows, oldest first: from a trace of it to the whole, faster toward the end. */
    val AGE_FADE = FloatArray(COLUMNS) { column ->
      val young = column.toFloat() / (COLUMNS - 1)
      0.12f + 0.88f * young * sqrt(young)
    }
    /** How many rings the mesh round a record is cut into, out from the label. */
    const val RINGS = 4
    const val STEP_SECONDS = 1f / 32
    /** The scale of heat, quiet to loud. */
    val HEAT = intArrayOf(
      Color.rgb(40, 10, 90),
      Color.rgb(120, 28, 150),
      Color.rgb(220, 60, 80),
      Color.rgb(250, 160, 40),
      Color.rgb(255, 235, 150),
      Color.rgb(255, 255, 255)
    )
  }
}

/**
 * Sparks thrown off the edge of a shape on each beat, more for a harder one,
 * drifting out and fading; a few at a time besides while the top of the sound
 * is bright.
 */
class Sparks(private val density: Float) {
  private val x = FloatArray(MOST)
  private val y = FloatArray(MOST)
  private val dx = FloatArray(MOST)
  private val dy = FloatArray(MOST)
  private val life = FloatArray(MOST)
  private val lived = FloatArray(MOST)
  private val size = FloatArray(MOST)
  private var count = 0
  private var owed = 0f
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val random = Random(7)

  fun showing(): Boolean = count > 0

  /** On, the sparks a step further; [beat] how hard a beat came now, nought for none; [bright] how much is at the top. */
  fun settle(seconds: Float, beat: Float, bright: Float, shape: RectF, round: Boolean) {
    var kept = 0
    for (i in 0 until count) {
      lived[i] += seconds
      if (lived[i] >= life[i]) continue
      // Slowing as they go.
      val drag = exp(-seconds * 1.4f)
      dx[i] *= drag
      dy[i] *= drag
      x[i] += dx[i] * seconds
      y[i] += dy[i] * seconds
      if (kept != i) {
        x[kept] = x[i]; y[kept] = y[i]; dx[kept] = dx[i]; dy[kept] = dy[i]
        life[kept] = life[i]; lived[kept] = lived[i]; size[kept] = size[i]
      }
      kept++
    }
    count = kept
    if (shape.width() <= 0f) return
    var thrown = (beat * 40).toInt()
    owed += bright * bright * seconds * 45
    while (owed >= 1f) {
      thrown++
      owed -= 1f
    }
    repeat(thrown) { throwOne(shape, round, beat > 0f) }
  }

  private fun throwOne(shape: RectF, round: Boolean, hard: Boolean) {
    if (count == MOST) return
    val i = count++
    val angle = random.nextFloat() * 2 * PI.toFloat()
    val outX: Float
    val outY: Float
    if (round) {
      outX = cos(angle)
      outY = sin(angle)
      x[i] = shape.centerX() + outX * shape.width() / 2
      y[i] = shape.centerY() + outY * shape.height() / 2
    } else {
      // A point on the edge of the rectangle, leaving straight out of the side it is on.
      val along = random.nextFloat() * 2 * (shape.width() + shape.height())
      when {
        along < shape.width() -> { x[i] = shape.left + along; y[i] = shape.top; outX = 0f; outY = -1f }
        along < shape.width() + shape.height() -> { x[i] = shape.right; y[i] = shape.top + along - shape.width(); outX = 1f; outY = 0f }
        along < shape.width() * 2 + shape.height() -> { x[i] = shape.right - (along - shape.width() - shape.height()); y[i] = shape.bottom; outX = 0f; outY = 1f }
        else -> { x[i] = shape.left; y[i] = shape.bottom - (along - shape.width() * 2 - shape.height()); outX = -1f; outY = 0f }
      }
    }
    val speed = (if (hard) 90f + random.nextFloat() * 160f else 30f + random.nextFloat() * 50f) * density
    val spread = (random.nextFloat() - 0.5f) * 0.9f
    dx[i] = (outX - outY * spread) * speed
    dy[i] = (outY + outX * spread) * speed
    life[i] = 0.7f + random.nextFloat() * 0.8f
    lived[i] = 0f
    size[i] = (2f + random.nextFloat() * 2.5f) * density
  }

  fun draw(canvas: Canvas, colour: Int) {
    paint.color = colour
    for (i in 0 until count) {
      val left = 1f - lived[i] / life[i]
      paint.alpha = (255 * left * left).toInt()
      canvas.drawCircle(x[i], y[i], size[i] * (0.5f + left * 0.5f), paint)
    }
  }

  private companion object {
    const val MOST = 220
  }
}

/**
 * Clouds of the cover's own colours behind everything, each swelling and
 * brightening with a part of the sound -- the low end, the middle, the top --
 * and drifting slowly about the cover.
 */
class Aurora {
  private val paints = Array(CLOUDS) { Paint(Paint.ANTI_ALIAS_FLAG) }
  private val shaders = arrayOfNulls<RadialGradient>(CLOUDS)
  private val matrix = Matrix()
  private val energy = FloatArray(CLOUDS)
  private var colours = IntArray(0)
  private var clock = 0f

  fun showing(): Boolean = energy.any { it > 0f }

  fun colours(list: IntArray) {
    if (list.contentEquals(colours)) return
    colours = list
    for (cloud in 0 until CLOUDS) {
      val colour = if (list.isEmpty()) Color.WHITE else list[cloud % list.size]
      // A unit cloud, laid down at its size by its matrix at each frame: made once for a colour.
      shaders[cloud] = RadialGradient(0f, 0f, 1f, intArrayOf(colour, Color.argb(0, Color.red(colour), Color.green(colour), Color.blue(colour))), null, Shader.TileMode.CLAMP)
      paints[cloud].shader = shaders[cloud]
    }
  }

  fun settle(bands: FloatArray, seconds: Float) {
    clock += seconds
    val each = bands.size / CLOUDS
    for (cloud in 0 until CLOUDS) {
      var sum = 0f
      for (band in cloud * each until (cloud + 1) * each) sum += bands[band]
      val target = sum / each
      val now = energy[cloud]
      energy[cloud] = if (target > now) now + (target - now) * min(1f, seconds * 10f) else max(target, now - seconds * 0.6f)
      if (energy[cloud] < 0.004f) energy[cloud] = 0f
    }
  }

  /** About [shape]. */
  fun draw(canvas: Canvas, shape: RectF) {
    if (shaders[0] == null) return
    val base = max(shape.width(), shape.height())
    for (cloud in 0 until CLOUDS) {
      val e = energy[cloud]
      if (e <= 0f) continue
      // Each about its own place round the cover, wandering slowly.
      val turn = clock * (0.11f + cloud * 0.037f) + cloud * 1.7f
      val cx = shape.centerX() + cos(turn) * base * (0.35f + 0.12f * cloud)
      val cy = shape.centerY() + sin(turn * 1.3f) * base * (0.3f + 0.1f * cloud)
      val radius = base * (0.65f + 0.5f * e) * (1f + 0.1f * cloud)
      matrix.setScale(radius, radius)
      matrix.postTranslate(cx, cy)
      shaders[cloud]!!.setLocalMatrix(matrix)
      paints[cloud].alpha = (235 * min(1f, e * 1.5f)).toInt()
      canvas.drawCircle(cx, cy, radius, paints[cloud])
    }
  }

  private companion object {
    const val CLOUDS = 4
  }
}

/** The tops of the sound, against the rest: how much of [bands] is in their upper third. */
fun brightOf(bands: FloatArray): Float {
  var top = 0f
  val from = bands.size * 2 / 3
  for (band in from until bands.size) top += bands[band]
  return sqrt(top / (bands.size - from))
}
