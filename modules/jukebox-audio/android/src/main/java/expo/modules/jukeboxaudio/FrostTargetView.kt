package expo.modules.jukeboxaudio

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * What scrolls under the bars of glass: drawn as it always is, and kept as a
 * record of the drawing as well, which each bar's [FrostView] draws the strip
 * of it behind the bar from without drawing the list a second time.
 *
 * Kept from Android 10, which is as far back as the app goes and the first to
 * let an app draw a record again.
 */
@SuppressLint("ViewConstructor")
class FrostTargetView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  /** What was drawn last, or null where it is not kept. */
  val recorded: RenderNode? = if (Build.VERSION.SDK_INT >= 29) RenderNode("frost-target") else null

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

  override fun dispatchDraw(canvas: Canvas) {
    val node = recorded
    if (node == null || !canvas.isHardwareAccelerated) {
      super.dispatchDraw(canvas)
      return
    }
    node.setPosition(0, 0, width, height)
    node.clipToBounds = false
    val record = node.beginRecording()
    super.dispatchDraw(record)
    node.endRecording()
    canvas.drawRenderNode(node)
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
