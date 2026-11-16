package expo.modules.jukeboxaudio.spectrum

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Outline
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.view.Choreographer
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewOutlineProvider
import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.uimanager.ReactPointerEventsView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * What moves with the music in the player, round or over what stands where
 * the cover is, laid behind it or over it as its sibling: see
 * [SpectrumAnalyzer] for where what it draws comes from.
 *
 *  - `bars`: a row of bars rising in a band of it, how loud each pitch is;
 *  - `ring`: the same as spokes standing out round the label of a record;
 *  - `ripple`: rings going out from its edge on each beat;
 *  - `swell`: it grows a little with how loud the low end is, drawing nothing;
 *  - `scope`: the line of the sound itself, across it or round the label;
 *  - `punch`: it jumps a little larger on each beat and settles back;
 *  - `spectrogram`: the spectrum as it has gone, the last few seconds of it;
 *  - `sparks`, `aurora` and `breathe`: drawn over and behind the whole
 *    player, a view of their own the size of it, about the cover given as
 *    [target]: sparks thrown off its edge on the beats, clouds of its
 *    colours, and a glow behind it as the low end swells, beside a `swell`
 *    of the cover itself. Drawn round it inside the box the cover is in, the
 *    glow was cut off by that box unless the cover was made a good deal
 *    smaller to leave it room.
 *
 * Its shape is the box it is given, the same as what stands there, cut in by
 * [insetX] and [insetY] where that is narrower (a cassette, in a square), with
 * rounded corners or round altogether. What goes out from the edge is drawn
 * past its bounds.
 *
 * Drawn a frame at a time only while it is [active] -- playing, the player in
 * sight, the decoration not held still -- and on the screen; told it is not,
 * it lets what it shows die down and then draws nothing at all, and the samples
 * are not looked at. What stands there is never drawn again for it, which as
 * a child of a view drawn at every frame its picture was, sent to the screen
 * again each time: growing is the scale of the view the two are in, which
 * React Native leaves alone, and the rest is this view's own drawing.
 */
@SuppressLint("ViewConstructor")
class SpectrumView(context: Context, appContext: AppContext) : ExpoView(context, appContext), ReactPointerEventsView {
  /*
    Never what a touch lands on. Laid over the whole player for the sparks,
    and over the cover for the rest, it took every touch there for itself --
    nothing on the player could be pressed -- since React Native asks a view of
    its own kind and no other whether it is to be passed through.
  */
  override val pointerEvents: PointerEvents = PointerEvents.NONE

  private var mode = "bars"
  private var active = false
  /** Bars and a straight line: the top and the foot of the band they are in, as shares of the height. */
  private var top = 0.6f
  private var foot = 1f
  /** Spokes and a round line: where they start and how far out they may go, as shares of half the width. */
  private var inner = 0.44f
  private var outer = 0.98f
  private var shade = false
  /** How much of the bars and the spokes is drawn: less than all over a theme of glass, which they would cover. */
  private var strength = 1f
  private var round = false
  private var cornerPx = 0f
  private var insetX = 0f
  private var insetY = 0f
  /** Sparks and clouds: where the cover is within the player's screen, which this view lies over, in points: left, top, width, height. */
  private val target = FloatArray(4)
  /** A light knock on each beat, where asked for. */
  private var feel = false
  /** How far into a jump on the beat it is: one at the beat, falling to nought. */
  private var punched = 0f
  private val waterfall by lazy { Waterfall() }
  private val sparks by lazy { Sparks(density) }
  private val aurora by lazy { Aurora() }
  private var colour = Color.WHITE

  private val heard = Heard()
  private val shown = FloatArray(SpectrumAnalyzer.BANDS)
  private val line = FloatArray(SpectrumAnalyzer.WAVE)
  private val closedLine = FloatArray(SpectrumAnalyzer.WAVE)
  private val seam = FloatArray(SEAM * 2)
  private var loud = 0f
  private var watching = false
  /*
    How much of the spectrogram is there, nought to one: brought up over a
    moment as the music starts and let go of over a moment as it stops, the
    picture held as it was meanwhile, rather than come all at once and, when
    the music stopped, wheeled on round empty until what was left of it went
    out in one step.
  */
  private var presence = 0f
  private var looping = false
  // Kept here: inside onDetachedFromWindow the view still says it is attached.
  private var attached = false
  private var lastFrameNs = 0L

  // The beats, for the rings: the low end against how it has been going, and when each ring went out.
  private var bassAverage = 0f
  private var lastBeatNs = 0L
  private val rings = LongArray(MOST_RINGS)
  private var ringCount = 0
  private var nowNs = 0L

  private val bar = Paint(Paint.ANTI_ALIAS_FLAG)
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND; style = Paint.Style.STROKE; strokeJoin = Paint.Join.ROUND }
  private val picturePaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val matrix = Matrix()

  /*
    The glow, and a ring round a shape with corners, drawn once as pictures and
    after that only laid down, fainter or larger: blurred, or stroked round
    corners that grow, at every frame, they were worked out on the processor
    and sent to the screen again each time. Made again when the shape changes.
  */
  private var glowPicture: Bitmap? = null
  private var ringPicture: Bitmap? = null
  private var picturesFor = ""
  private val dark = Paint()
  private val under = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.argb(90, 0, 0, 0); style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
  }
  private val rect = RectF()
  private val shape = RectF()
  private val path = Path()
  private val density = resources.displayMetrics.density

  init {
    setWillNotDraw(false)
    setColour("#ffffff")
  }

  private fun grows(which: String) = which == "swell" || which == "punch"

  /** The view this and what stands there are in, grown with the music. */
  private fun grow(by: Float) {
    (parent as? View)?.let {
      it.scaleX = by
      it.scaleY = by
    }
  }

  fun setMode(value: String) {
    if (grows(mode) && !grows(value)) grow(1f)
    if (value != mode && value == "spectrogram") waterfall.clear()
    mode = value
    clipped()
    invalidate()
  }

  fun setActive(on: Boolean) {
    active = on
    update()
  }

  fun setColour(value: String) {
    colour = runCatching { Color.parseColor(value) }.getOrDefault(Color.WHITE)
    bar.color = colour
    bar.alpha = (220 * strength).toInt()
    stroke.color = colour
    invalidate()
  }

  fun setRoom(from: Float, to: Float) {
    top = from
    foot = to
    invalidate()
  }

  fun setRing(from: Float, to: Float) {
    inner = from
    outer = to
    invalidate()
  }

  fun setStrength(share: Float) {
    strength = share.coerceIn(0f, 1f)
    bar.alpha = (220 * strength).toInt()
    invalidate()
  }

  fun setShade(on: Boolean) {
    shade = on
    invalidate()
  }

  fun setRound(on: Boolean) {
    round = on
    clipped()
    invalidate()
  }

  fun setCorner(points: Float) {
    cornerPx = points * density
    clipped()
    invalidate()
  }

  /*
    Bars are kept inside the cover's rounded corners by the view's outline,
    which the screen cuts to for nothing: cut to a path at every frame, the
    corners were worked out on the processor and sent to the screen again as a
    picture each time. Nothing else is cut, as rings and the glow go past it.
  */
  private fun clipped() {
    // The bars inside a cover's corners, and the spectrogram inside a cover's or a record's edge.
    val cut = (mode == "bars" && cornerPx > 0f) || (mode == "spectrogram" && cornerPx > 0f && !round)
    clipToOutline = cut
    outlineProvider = if (!cut) ViewOutlineProvider.BACKGROUND else object : ViewOutlineProvider() {
      override fun getOutline(view: View, outline: Outline) {
        if (round) outline.setOval(0, 0, view.width, view.height)
        else outline.setRoundRect(0, 0, view.width, view.height, cornerPx)
      }
    }
  }

  fun setTarget(place: List<Float>) {
    for (i in 0 until min(4, place.size)) target[i] = place[i]
    invalidate()
  }

  fun setFeel(on: Boolean) {
    feel = on
    update()
  }

  /** The cover's own colours, for the clouds. */
  fun setColours(list: List<String>) {
    aurora.colours(list.mapNotNull { runCatching { Color.parseColor(it) }.getOrNull() }.toIntArray())
    invalidate()
  }

  fun setInset(x: Float, y: Float) {
    insetX = x
    insetY = y
    invalidate()
  }

  /** Nothing cut off at its edges: the rings and the glow go past them. */
  override fun clipToPaddingBox(canvas: Canvas) = Unit

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attached = true
    update()
  }

  override fun onDetachedFromWindow() {
    attached = false
    if (grows(mode)) grow(1f)
    update()
    super.onDetachedFromWindow()
  }

  override fun onVisibilityAggregated(isVisible: Boolean) {
    super.onVisibilityAggregated(isVisible)
    update()
  }

  /** Whether the samples are to be looked at, and the frames drawn, now. */
  private fun wanted(): Boolean = active && attached && isShown

  private fun showing(): Boolean =
    loud > 0f || breath > 0f || ringCount > 0 || punched > 0f || shown.any { it > 0f } ||
      when (mode) {
        "spectrogram" -> presence > 0f && waterfall.showing()
        "sparks" -> sparks.showing()
        "aurora" -> aurora.showing()
        else -> false
      }

  private fun update() {
    val want = wanted()
    if (want != watching) {
      watching = want
      if (want) Spectrum.watch() else Spectrum.unwatch()
    }
    if ((want || showing()) && !looping && attached) {
      looping = true
      lastFrameNs = 0L
      Choreographer.getInstance().postFrameCallback(frame)
    }
  }

  private val frame: Choreographer.FrameCallback = object : Choreographer.FrameCallback {
    override fun doFrame(frameTimeNanos: Long) {
      // Sixty a second at most, on a screen that would ask for twice that: what moves looks no different.
      if (lastFrameNs != 0L && frameTimeNanos - lastFrameNs < MIN_FRAME_NS) {
        Choreographer.getInstance().postFrameCallback(this)
        return
      }
      val seconds = if (lastFrameNs == 0L) 1f / 60 else min(0.1f, (frameTimeNanos - lastFrameNs) / 1e9f)
      lastFrameNs = frameTimeNanos
      nowNs = frameTimeNanos
      val live = watching && Spectrum.heardNow(heard)
      if (!live) {
        heard.bands.fill(0f)
        heard.wave.fill(0f)
        heard.level = 0f
      }
      settle(seconds)
      val beat = if (live && (feel || mode == "ripple" || mode == "punch" || mode == "sparks")) listen(frameTimeNanos) else 0f
      if (beat > 0f && feel) performHapticFeedback(if (beat > 0.7f) HapticFeedbackConstants.KEYBOARD_TAP else HapticFeedbackConstants.CLOCK_TICK)
      when (mode) {
        "punch" -> {
          if (beat > 0f) punched = 0.5f + beat * 0.5f
          punched = if (punched < 0.01f) 0f else punched * exp(-seconds / PUNCH_FALL)
          grow(1f + PUNCH_GROW * punched)
        }
        "spectrogram" -> {
          presence =
            if (watching) min(1f, presence + seconds / PRESENCE_IN_S)
            else max(0f, presence - seconds / PRESENCE_OUT_S)
          // Held still while it goes, and begun again clean the next time.
          if (watching) waterfall.settle(shown, seconds)
          else if (presence == 0f) waterfall.clear()
        }
        "sparks" -> {
          stageShape()
          sparks.settle(seconds, beat, brightOf(shown), shape, round)
        }
        "aurora" -> aurora.settle(shown, seconds)
      }
      // Rings that have gone as far as they go.
      var kept = 0
      for (i in 0 until ringCount) if (frameTimeNanos - rings[i] < RING_NS) rings[kept++] = rings[i]
      ringCount = kept
      if (mode == "breathe" || mode == "swell") breathe(seconds)
      if (mode == "swell") grow(1f + GROW * breath)
      invalidate()
      if ((watching || showing()) && attached) {
        Choreographer.getInstance().postFrameCallback(this)
      } else {
        looping = false
      }
    }
  }

  /** What is shown, a step toward what is heard: up at once, nearly, and down slowly, as a meter's needle falls. */
  private fun settle(seconds: Float) {
    for (band in shown.indices) {
      shown[band] = toward(shown[band], heard.bands[band], seconds)
      if (shown[band] < 0.004f) shown[band] = 0f
    }
    loud = toward(loud, heard.level, seconds)
    if (loud < 0.004f) loud = 0f
    val follow = min(1f, seconds * LINE_FOLLOW)
    for (point in line.indices) line[point] += (heard.wave[point] - line[point]) * follow
    // Nothing heard, no line: left almost flat, it stayed over the cover when the music stopped.
    if (loud == 0f) line.fill(0f)
  }

  /** Slow at either end, as a fade is: smoothstep. */
  private fun eased(share: Float): Float = share * share * (3 - 2 * share)

  private fun toward(now: Float, target: Float, seconds: Float): Float =
    if (target > now) now + (target - now) * min(1f, seconds * RISE) else max(target, now - FALL * seconds)

  private fun colourOf(): Int = bar.color

  /*
    How far into a breath it is, from nought to one. Not how loud the music is,
    which in a record mixed loud stands near the top from end to end, so that
    the glow hardly moved: how far the low end has come up over how it has
    been going these last two seconds, over a glow that stays while the music
    does: in on a beat, and out again slowly, a breath and not a blink.
  */
  private var breath = 0f
  private var breathBase = 0f

  private fun breathe(seconds: Float) {
    var bass = 0f
    for (band in 0 until BASS_BANDS) bass += heard.bands[band]
    bass /= BASS_BANDS
    breathBase += (bass - breathBase) * min(1f, seconds / BREATH_BASE_S)
    val drive = if (heard.level <= 0f) 0f else ((bass - breathBase) * BREATH_GAIN + BREATH_FLOOR * bass).coerceIn(0f, 1f)
    breath =
      if (drive > breath) breath + (drive - breath) * min(1f, seconds * BREATH_RISE)
      else max(drive, breath * exp(-seconds / BREATH_FALL_S))
    if (breath < 0.004f) breath = 0f
  }

  /**
   * A beat: the low end come up well over how it has been going. A ring goes
   * out for it. How hard it was, from a little over nought to one; nought for
   * none.
   */
  private fun listen(frameTimeNanos: Long): Float {
    var bass = 0f
    for (band in 0 until BASS_BANDS) bass += heard.bands[band]
    bass /= BASS_BANDS
    val beat = bass > bassAverage + BEAT_OVER && bass > BEAT_LEAST && frameTimeNanos - lastBeatNs > BEAT_GAP_NS
    val over = bass - bassAverage
    bassAverage += (bass - bassAverage) * 0.12f
    if (!beat) return 0f
    lastBeatNs = frameTimeNanos
    if (mode == "ripple") {
      if (ringCount == MOST_RINGS) {
        System.arraycopy(rings, 1, rings, 0, MOST_RINGS - 1)
        ringCount--
      }
      rings[ringCount++] = frameTimeNanos
    }
    return (over / 0.35f).coerceIn(0.25f, 1f)
  }

  /** Where the cover is within this view, for the sparks and the clouds, which are drawn the size of the player. */
  /*
    Where the cover is within this view: it is told where the cover is within
    the player's screen, which this view lies over, corner to corner. Nothing
    of where either is in the window comes into it, which changes at every
    step of the player rising or being slid away.
  */
  private fun stageShape() {
    shape.set(target[0] * density, target[1] * density, (target[0] + target[2]) * density, (target[1] + target[3]) * density)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (width <= 0 || height <= 0) return
    // The shape of what stands there, within it; or for the sparks and the clouds, where the cover is.
    if (mode == "sparks" || mode == "aurora" || mode == "breathe") stageShape()
    else shape.set(width * insetX, height * insetY, width * (1 - insetX), height * (1 - insetY))
    when (mode) {
      "spectrogram" -> {
        if (round) {
          // Round the label of a record, time going round and the pitches outward.
          val half = min(width, height) / 2f
          waterfall.drawRound(canvas, width / 2f, height / 2f, half * inner, half * outer, strength * eased(presence))
        } else {
          rect.set(shape.left, height * top, shape.right, height * foot)
          waterfall.draw(canvas, rect, strength * eased(presence))
        }
      }
      "sparks" -> sparks.draw(canvas, colourOf())
      "aurora" -> aurora.draw(canvas, shape)
      "ripple" -> drawRings(canvas)
      "breathe" -> drawGlow(canvas)
      "bars" -> drawBars(canvas)
      "ring" -> drawSpokes(canvas)
      "scope" -> if (round) drawRoundLine(canvas) else drawLine(canvas)
    }
  }

  private fun drawBars(canvas: Canvas) {
    val from = height * top
    val to = height * foot
    val room = to - from
    if (room <= 0f || shown.all { it == 0f }) return
    val count = shown.size
    val slot = shape.width() / count
    val wide = slot * 0.62f
    if (shade) {
      // As dark under the bars as they are loud, so that they read over a light cover.
      val loudness = shown.average().toFloat()
      dark.shader = LinearGradient(0f, from, 0f, to, Color.TRANSPARENT, Color.argb((150 * min(1f, loudness * 2.2f)).toInt(), 0, 0, 0), Shader.TileMode.CLAMP)
      canvas.drawRect(shape.left, from, shape.right, to, dark)
    }
    for (band in 0 until count) {
      val tall = shown[band] * room
      if (tall < 1f) continue
      val left = shape.left + band * slot + (slot - wide) / 2
      rect.set(left, to - tall, left + wide, to)
      canvas.drawRoundRect(rect, wide / 2, wide / 2, bar)
    }
  }

  private fun drawSpokes(canvas: Canvas) {
    val half = min(width, height) / 2f
    val centreX = width / 2f
    val centreY = height / 2f
    val from = half * inner
    val reach = half * (outer - inner)
    val count = shown.size
    // The low pitches at the top, round to the high at the foot, the same down either side.
    val spokes = count * 2
    stroke.alpha = (200 * strength).toInt()
    stroke.strokeWidth = max(1.5f, (2 * PI.toFloat() * from / spokes) * 0.4f)
    for (place in 0 until spokes) {
      val band = if (place < count) place else spokes - 1 - place
      val long = shown[band] * reach
      if (long < 1f) continue
      val angle = (-PI / 2 + (place + 0.5) * 2 * PI / spokes).toFloat()
      val dx = cos(angle)
      val dy = sin(angle)
      canvas.drawLine(centreX + dx * from, centreY + dy * from, centreX + dx * (from + long), centreY + dy * (from + long), stroke)
    }
  }

  /** The pictures for the shape as it is now, made again if it has changed. */
  private fun pictures() {
    val key = "${shape.width()}:${shape.height()}:$cornerPx:$round:$colour"
    if (key == picturesFor || shape.width() <= 0f || shape.height() <= 0f) return
    picturesFor = key
    val wide = shape.width()
    val tall = shape.height()
    // The glow: the shape a little larger, blurred, as bright as it will be.
    val blur = GLOW_DP * density
    val pad = blur * 2
    glowPicture = Bitmap.createBitmap((wide + pad * 2).toInt(), (tall + pad * 2).toInt(), Bitmap.Config.ARGB_8888).also {
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colour; maskFilter = BlurMaskFilter(blur, BlurMaskFilter.Blur.NORMAL) }
      val out = blur * 0.45f
      rect.set(pad - out, pad - out, pad + wide + out, pad + tall + out)
      val drawing = Canvas(it)
      if (round) drawing.drawOval(rect, paint) else drawing.drawRoundRect(rect, cornerPx + out, cornerPx + out, paint)
    }
    // A ring at the edge, to be laid down larger as it goes out.
    val line = RING_LINE_DP * density
    ringPicture = if (round) null else Bitmap.createBitmap((wide + line * 2).toInt(), (tall + line * 2).toInt(), Bitmap.Config.ARGB_8888).also {
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colour; style = Paint.Style.STROKE; strokeWidth = line }
      rect.set(line, line, line + wide, line + tall)
      Canvas(it).drawRoundRect(rect, cornerPx, cornerPx, paint)
    }
  }

  /** Each ring going out from the edge, fainter the farther it has gone. */
  private fun drawRings(canvas: Canvas) {
    if (ringCount == 0) return
    pictures()
    val reach = RING_REACH_DP * density
    stroke.strokeWidth = RING_LINE_DP * density
    val picture = ringPicture
    for (i in 0 until ringCount) {
      val gone = ((nowNs - rings[i]).toFloat() / RING_NS).coerceIn(0f, 1f)
      // Fast off the edge and slowing, as a ripple does.
      val out = reach * (1 - (1 - gone) * (1 - gone))
      val alpha = (200 * (1 - gone)).toInt()
      if (round || picture == null) {
        // A circle the screen draws as it is, whatever its size.
        stroke.alpha = alpha
        rect.set(shape.left - out, shape.top - out, shape.right + out, shape.bottom + out)
        canvas.drawOval(rect, stroke)
        continue
      }
      // The picture of the ring, stretched to stand that far out on every side.
      val line = RING_LINE_DP * density
      matrix.setTranslate(shape.left - line, shape.top - line)
      matrix.postScale((shape.width() + out * 2) / shape.width(), (shape.height() + out * 2) / shape.height(), shape.centerX(), shape.centerY())
      picturePaint.alpha = alpha
      canvas.drawBitmap(picture, matrix, picturePaint)
    }
  }

  /** A soft light behind it, as bright as the music is loud. */
  private fun drawGlow(canvas: Canvas) {
    if (breath <= 0f) return
    pictures()
    val picture = glowPicture ?: return
    // None at all between breaths, all of it at the top of one, and larger with it.
    picturePaint.alpha = (255 * breath).toInt().coerceIn(0, 255)
    val pad = GLOW_DP * density * 2
    val larger = 1f + GLOW_GROW * breath
    matrix.setTranslate(shape.left - pad, shape.top - pad)
    matrix.postScale(larger, larger, shape.centerX(), shape.centerY())
    canvas.drawBitmap(picture, matrix, picturePaint)
  }

  /** The line of the sound across the band the bars would be in. */
  private fun drawLine(canvas: Canvas) {
    if (loud <= 0f) return
    val middle = height * (top + foot) / 2
    val swing = height * (foot - top) / 2
    val count = line.size
    path.reset()
    // Its ends, and the darker line under it, kept inside the cover's edges.
    val edge = 3f * density
    for (point in 0 until count) {
      val x = shape.left + edge + (shape.width() - edge * 2) * point / (count - 1)
      val y = middle - swung(line[point]) * swing
      if (point == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    drawTraced(canvas)
  }

  /** The line of the sound round the label of a record. */
  private fun drawRoundLine(canvas: Canvas) {
    if (loud <= 0f) return
    val half = min(width, height) / 2f
    val centreX = width / 2f
    val centreY = height / 2f
    val middle = half * (inner + outer) / 2
    val swing = half * (outer - inner) / 2
    val count = line.size
    closed(count)
    path.reset()
    for (point in 0..count) {
      val sample = closedLine[point % count]
      val r = middle + swung(sample) * swing
      val angle = (-PI / 2 + 2 * PI * point / count).toFloat()
      val x = centreX + cos(angle) * r
      val y = centreY + sin(angle) * r
      if (point == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    drawTraced(canvas)
  }

  /**
   * The line made to close on itself round the label. A piece
   * of sound does not end where it began, and the two ends met in a step:
   * the difference is taken off a little at a time all the way round, and
   * the few points either side of where they meet are smoothed. Into [closedLine].
   */
  private fun closed(count: Int) {
    val apart = line[count - 1] - line[0]
    for (point in 0 until count) closedLine[point] = line[point] - apart * point / count
    for (step in 0 until SEAM * 2) seam[step] = closedLine[(count - SEAM + step) % count]
    for (step in 0 until SEAM * 2) {
      var sum = 0f
      for (near in -2..2) sum += seam[(step + near).coerceIn(0, SEAM * 2 - 1)]
      // Fully smoothed at the seam, less so further from it.
      val weight = 1f - kotlin.math.abs(step - SEAM + 0.5f) / SEAM
      closedLine[(count - SEAM + step) % count] = seam[step] + (sum / 5 - seam[step]) * weight
    }
  }

  /**
   * How far a sample of the line swings, a share of its room either way:
   * made larger, as music is seldom near full scale, and coming up to the
   * edge of its room ever more slowly rather than stopping hard against it,
   * where a loud passage had it beating on the edges.
   */
  private fun swung(sample: Float): Float = kotlin.math.tanh(sample * SCOPE_GAIN)

  /** The line in [path], over a darker one a little wider, so that it reads over a cover as light as it is. */
  private fun drawTraced(canvas: Canvas) {
    under.strokeWidth = 4.5f * density
    canvas.drawPath(path, under)
    // Fading as the music does, down to nothing.
    val fade = min(1f, loud * 5)
    under.alpha = (90 * fade).toInt()
    stroke.alpha = (235 * fade).toInt()
    stroke.strokeWidth = 2f * density
    canvas.drawPath(path, stroke)
  }

  companion object {
    /** How long the spectrogram takes to come as the music starts, and to go as it stops. */
    private const val PRESENCE_IN_S = 0.45f
    private const val PRESENCE_OUT_S = 0.6f
    private const val RISE = 50f
    private const val FALL = 1.4f
    private const val LINE_FOLLOW = 60f
    private const val MIN_FRAME_NS = 14_000_000L
    /** How much a line of the sound is made larger: music is seldom near full scale. */
    private const val SCOPE_GAIN = 1.7f
    /** How many points either side of where a round line meets itself are smoothed. */
    private const val SEAM = 6
    /** How much it grows, as a share, with the music as loud as it gets. */
    /** How much larger it is at the top of a breath, and its glow besides. */
    private const val GROW = 0.05f
    private const val GLOW_GROW = 0.06f
    /** How long the low end is averaged over, how much a rise over it counts, how much of the low end counts anyway, and how quickly a breath goes out. */
    private const val BREATH_BASE_S = 2f
    private const val BREATH_GAIN = 3.2f
    private const val BREATH_FLOOR = 0.35f
    private const val BREATH_RISE = 14f
    private const val BREATH_FALL_S = 0.35f
    /** How much larger a jump on the beat makes it, and how quickly it settles back, in seconds. */
    private const val PUNCH_GROW = 0.06f
    private const val PUNCH_FALL = 0.12f
    private const val GLOW_DP = 11f
    private const val RING_LINE_DP = 2.5f

    private const val BASS_BANDS = 7
    private const val BEAT_OVER = 0.09f
    private const val BEAT_LEAST = 0.3f
    private const val BEAT_GAP_NS = 260_000_000L
    private const val MOST_RINGS = 6
    private const val RING_NS = 650_000_000L
    /** As far as `EDGE_ROOM` in `components/Spectrum.tsx`: the room the player leaves for them. */
    private const val RING_REACH_DP = 22f
  }
}
