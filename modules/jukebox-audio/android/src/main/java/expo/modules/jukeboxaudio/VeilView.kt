package expo.modules.jukeboxaudio

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.ceil
import kotlin.math.max

/**
 * What is under a sheet or a screen of glass, out of focus and, where asked,
 * set back: a little darker as well.
 *
 * It was React Native's own `filter`, which Android draws from version 12,
 * and on 10 and 11 not at all: there what was under a screen of glass showed
 * through it as sharp as itself, and the two read as one. So it is drawn here.
 * From 12 what it draws is put through the blur as `filter` did. On 10 and 11,
 * which have no blur to put it through, it is softened instead ([Softener]),
 * which comes to much the same; it does not move while it is covered, so that
 * is done again only when it changes.
 */
@SuppressLint("ViewConstructor")
class VeilView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  /** How far out of focus, in points; nought for not at all. */
  private var blur = 0f

  /** How much of its light it keeps: one for all of it. */
  private var dim = 1f

  /** What it holds, drawn where it is also past its edges: see `init`. */
  private val whole = if (Build.VERSION.SDK_INT >= 29) RenderNode("veil-whole").apply { clipToBounds = false } else null
  /** On 10 and 11, what goes out of focus without a blur: see [Softener]. */
  private val softener = if (Build.VERSION.SDK_INT in 29..30) Softener("veil") else null
  private val smooth = Paint(Paint.FILTER_BITMAP_FLAG)
  private val dimmed = Paint(Paint.FILTER_BITMAP_FLAG)

  /*
    What is in it is drawn where it is, also where it reaches past its edges,
    as in any of React Native's own views. `ExpoView` is a `LinearLayout`
    underneath, which cuts what it holds off at its edges: the tabs, which
    reach below the foot of the page, were cut off there, and what was left on
    the screen under them from earlier stayed, a strip of it, or flickered.
  */
  init {
    clipChildren = false
    clipToPadding = false
  }

  fun setBlur(points: Float) {
    if (points == blur) return
    blur = points
    apply()
  }

  fun setDim(light: Float) {
    if (light == dim) return
    dim = light
    apply()
  }

  private fun dimming(): ColorMatrixColorFilter? =
    if (dim >= 1f) null else ColorMatrixColorFilter(ColorMatrix().apply { setScale(dim, dim, dim, 1f) })

  /*
    From Android 12, put on the record of what it draws rather than on the view
    itself: a view's own effect is React Native's, which puts its `filter` there
    with every change of style, nothing among them, and took this one off.
  */
  private var effect: RenderEffect? = null

  private fun apply() {
    if (Build.VERSION.SDK_INT >= 31) {
      val pixels = blur * resources.displayMetrics.density
      val out = if (pixels > 0f) RenderEffect.createBlurEffect(pixels, pixels, Shader.TileMode.CLAMP) else null
      val light = dimming()?.let { RenderEffect.createColorFilterEffect(it) }
      effect = when {
        out != null && light != null -> RenderEffect.createChainEffect(light, out)
        else -> out ?: light
      }
    } else {
      dimmed.colorFilter = dimming()
    }
    invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    if (Build.VERSION.SDK_INT >= 31) {
      val put = effect
      val record = whole
      if (put == null || record == null || !canvas.isHardwareAccelerated || width <= 0 || height <= 0) {
        super.dispatchDraw(canvas)
        return
      }
      record.setPosition(0, 0, width, height)
      super.dispatchDraw(record.beginRecording())
      record.endRecording()
      record.setRenderEffect(put)
      canvas.drawRenderNode(record)
      return
    }
    val all = whole
    if (Build.VERSION.SDK_INT >= 31 || all == null || softener == null || !canvas.isHardwareAccelerated ||
      blur <= 0f || width <= 0 || height <= 0
    ) {
      if (Build.VERSION.SDK_INT < 31 && dim < 1f && canvas.isHardwareAccelerated && all != null) {
        // Set back without going out of focus: the drawing, darker.
        all.setPosition(0, 0, width, height)
        super.dispatchDraw(all.beginRecording())
        all.endRecording()
        all.setUseCompositingLayer(true, dimmed)
        canvas.drawRenderNode(all)
        return
      }
      super.dispatchDraw(canvas)
      return
    }
    all.setPosition(0, 0, width, height)
    super.dispatchDraw(all.beginRecording())
    all.endRecording()
    softener!!.draw(canvas, all, width, height, blur * resources.displayMetrics.density, dimmed)
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
