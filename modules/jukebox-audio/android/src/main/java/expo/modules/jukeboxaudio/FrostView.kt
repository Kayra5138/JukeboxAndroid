package expo.modules.jukeboxaudio

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.ceil

/**
 * What scrolls under a bar of glass, out of focus behind it: the part of the
 * list under the bar, and no more.
 *
 * `expo-blur` did this for every bar by taking the whole of the list under it,
 * as big as the screen, through the blur on every frame of a scroll, and then
 * showing the strip of it behind the bar. Two bars were the screen blurred
 * twice a frame, three with the bar of what is playing; on a phone with a
 * modest graphics chip that was most frames late. This takes only the strip,
 * a little more for the blur to reach in from round it, at an eighth of the
 * size on each side, which a blur this soft does not show; and looks the
 * same, the radius and the tint being the library's. Measured on a slow
 * phone's stand-in, an emulator with two cores and no graphics chip, a theme
 * of glass went from nine frames in ten late to about one in three.
 *
 * The list is a [FrostTargetView], which keeps a record of what it drew that
 * can be drawn again here without drawing the list again. On Android 10
 * and 11, which have no blur to draw it through, it is softened instead
 * ([Softener]), to look the same.
 */
@SuppressLint("ViewConstructor")
class FrostView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  /**
   * How much smaller the strip is blurred than it is on the screen, each way.
   * It is drawn at half its size and halved twice from there, each time the
   * average of four of the step before: drawn at an eighth in one go, the
   * covers and the writing were picked out a pixel in eight, a different one
   * as the list moved by, and what was behind the bar shimmered as it went.
   */
  private val shrink = 8f

  /** How far out of focus, in pixels on the screen: the library's radius as it worked it out. */
  private var radius = 20f

  /** Laid over the blur, as the library's tint was. */
  private var overlay = 0

  private var targetId: Int? = null
  private var target: FrostTargetView? = null
  private val node = if (Build.VERSION.SDK_INT >= 29) RenderNode("frost") else null
  /** The strip at a quarter of its size and at an eighth, halved down to from [node]: see [shrink]. */
  private val quarter = if (Build.VERSION.SDK_INT >= 31) RenderNode("frost-quarter") else null
  private val eighth = if (Build.VERSION.SDK_INT >= 31) RenderNode("frost-eighth") else null
  private val smooth = Paint(Paint.FILTER_BITMAP_FLAG)
  /** Android 10 and 11, which have nothing to blur through: see [Softener]. */
  private val softener = if (Build.VERSION.SDK_INT in 29..30) Softener("frost") else null
  /** The radius the strip's blur was made for: made again only when that changes, not with every frame. */
  private var blurred = 0f
  private val kept = Rect()
  private val here = IntArray(2)
  private val there = IntArray(2)

  /**
   * Drawn again whenever the list is about to be, or the bar has moved over
   * it, as the bar of what is playing does when it slides in: what is under
   * the bar is something else. Only then: this is asked before every drawing
   * of the window, this bar's own included, and drawing the bar again each
   * time it was asked asked for another drawing, sixty a second with nothing
   * on the screen moving.
   */
  private val redraw = ViewTreeObserver.OnPreDrawListener {
    val list = target
    if (isShown && list != null && (list.isDirty || moved(list))) invalidate()
    true
  }

  /** Where the bar was over the list when it was last drawn. */
  private var drawnAtX = 0
  private var drawnAtY = 0

  private fun moved(list: View): Boolean {
    getLocationInWindow(here)
    list.getLocationInWindow(there)
    return here[0] - there[0] != drawnAtX || here[1] - there[1] != drawnAtY
  }

  /*
    What is in it is drawn where it is, also where it reaches past its edges,
    as in any of React Native's own views. `ExpoView` is a `LinearLayout`
    underneath, which cuts what it holds off at its edges: the tabs, which
    reach below the foot of the page, were cut off there, and what was left on
    the screen under them from earlier stayed, a strip of it, or flickered.
  */
  init {
    setWillNotDraw(false)
    clipChildren = false
    clipToPadding = false
  }

  fun setTargetId(id: Int?) {
    if (id == targetId) return
    targetId = id
    attachTarget()
  }

  fun setRadius(pixels: Float) {
    radius = pixels
    invalidate()
  }

  fun setOverlay(colour: Int) {
    overlay = colour
    invalidate()
  }

  private fun attachTarget() {
    target?.viewTreeObserver?.removeOnPreDrawListener(redraw)
    target = targetId?.let { runCatching { appContext.findView<FrostTargetView>(it) }.getOrNull() }
    if (isAttachedToWindow) target?.viewTreeObserver?.addOnPreDrawListener(redraw)
    invalidate()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (target == null) attachTarget() else target?.viewTreeObserver?.addOnPreDrawListener(redraw)
  }

  override fun onDetachedFromWindow() {
    target?.viewTreeObserver?.removeOnPreDrawListener(redraw)
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val strip = node
    val list = target
    val recorded = list?.recorded
    if (strip != null && list != null && recorded != null && canvas.isHardwareAccelerated && width > 0 && height > 0) {
      getLocationInWindow(here)
      list.getLocationInWindow(there)
      drawnAtX = here[0] - there[0]
      drawnAtY = here[1] - there[1]
      // Room round the strip for the blur to draw from, as it would have had in the whole of the list.
      val reach = radius
      val full = Build.VERSION.SDK_INT < 31
      // On 10 and 11 the strip at its full size, to be softened from ([Softener]); from 12 at half, to be halved.
      val scale = if (full) 1f else 2f
      val wideAt = ceil((width + reach * 2) / scale).toInt()
      val highAt = ceil((height + reach * 2) / scale).toInt()
      strip.setPosition(0, 0, wideAt, highAt)
      val record = strip.beginRecording()
      record.scale(1 / scale, 1 / scale)
      record.translate(-(here[0] - there[0] - reach), -(here[1] - there[1] - reach))
      // What is behind the list where it is see-through, as the library put there.
      appContext.currentActivity?.window?.decorView?.background?.let { behind ->
        // The window's own, sized here for the list and given back its size after: the window
        // drew itself to the list's size otherwise, and below a list shorter than the screen drew
        // nothing, so that the glass over there was drawn over what was there before, frame on frame.
        // Its view is not told, which would draw the window again for nothing.
        val view = behind.callback
        behind.callback = null
        behind.copyBounds(kept)
        behind.setBounds(0, 0, list.width, list.height)
        behind.draw(record)
        behind.bounds = kept
        behind.callback = view
      }
      record.drawRenderNode(recorded)
      strip.endRecording()
      canvas.save()
      // Only the bar: the room round the strip is for the blur to draw from, not to be seen.
      canvas.clipRect(0, 0, width, height)
      canvas.translate(-reach, -reach)
      if (full) {
        softener!!.draw(canvas, strip, wideAt, highAt, radius, null)
      } else {
        strip.setUseCompositingLayer(true, smooth)
        val small = halve(eighth!!, halve(quarter!!, strip, wideAt, highAt), ceil(wideAt / 2f).toInt(), ceil(highAt / 2f).toInt())
        if (blurred != radius) {
          blurred = radius
          small.setRenderEffect(RenderEffect.createBlurEffect(radius / shrink, radius / shrink, Shader.TileMode.CLAMP))
        }
        canvas.scale(shrink, shrink)
        canvas.drawRenderNode(small)
      }
      canvas.restore()
    }
    if (overlay != 0) canvas.drawColor(overlay)
  }

  /** [from], [wide] by [high], drawn into [to] at half that, as a picture of its own. */
  private fun halve(to: RenderNode, from: RenderNode, wide: Int, high: Int): RenderNode {
    to.setPosition(0, 0, ceil(wide / 2f).toInt(), ceil(high / 2f).toInt())
    to.beginRecording().also {
      it.scale(0.5f, 0.5f)
      it.drawRenderNode(from)
    }
    to.endRecording()
    to.setUseCompositingLayer(true, smooth)
    return to
  }

  /*
    Where its children go is React Native's to say, as for any of its own
    views. `ExpoView` is a `LinearLayout` underneath, and left to lay out its
    children it stacked them one under another whenever it was laid out again:
    a page's bar went off the foot of the screen.
  */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  /**
   * Nothing clipped to its padding, which it has none of: `ExpoView` clips to a
   * path on every drawing otherwise, which for a view the size of the screen,
   * drawn with every frame of a scroll, was a good part of each frame.
   */
  override fun clipToPaddingBox(canvas: Canvas) = Unit

}
