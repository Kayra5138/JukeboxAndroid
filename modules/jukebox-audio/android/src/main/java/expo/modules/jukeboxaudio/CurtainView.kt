package expo.modules.jukeboxaudio

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import android.view.View
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * What is in it, kept standing and laid out as ever, and, drawn shut, not
 * drawn at all: the library's views not in front, and the walls of covers
 * waiting behind a list for a pinch.
 *
 * See-through (opacity nought), they were drawn all the same, with every
 * frame of a scroll of the one in front; put away by React Native's display
 * none, they were not drawn but not laid out either, and coming back each was
 * laid out whole again, a hitch at every change of view; made the phone's own
 * invisible, every picture in them was told it was out of sight, and coming
 * back each was drawn afresh, the artists' map most of a tenth of a second.
 * Shut, it is still visible as far as anything in it knows, and only leaves
 * what it holds out of its drawing: opened, what was drawn before is drawn
 * again as it was.
 *
 * Touch and the screen reader are kept from what is shut by the view round
 * it (`Curtain.tsx`), which says so to React Native.
 */
@SuppressLint("ViewConstructor")
class CurtainView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var shut = false
    private set

  init {
    // As React Native's own views: what reaches past its edges is drawn there.
    clipChildren = false
    clipToPadding = false
    setWillNotDraw(false)
  }

  /*
    Shut and about to be opened (a finger is on what opens it): drawn where
    it is, but into a record of its own that is drawn wholly see-through.
    What it holds is drawn into the phone's records again and its pictures
    taken onto the graphics processor -- the long frame that bringing a view
    back costs, some sixty milliseconds for the artists' map -- while the
    finger is still down and nothing moves, so that when it opens it is only
    shown. (Drawn far off the screen instead, as it was first, whatever was
    inside a scroller or anything else that cuts off at its edges was left
    out as out of sight, and was drawn afresh on opening all the same.)
  */
  private var warm = false
  private val warmed = if (Build.VERSION.SDK_INT >= 29) RenderNode("curtain-warm") else null

  fun setShut(value: Boolean) {
    if (shut == value) return
    shut = value
    invalidate()
  }

  fun setWarm(value: Boolean) {
    if (warm == value) return
    warm = value
    if (shut) invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    val record = warmed
    if (!shut) {
      super.dispatchDraw(canvas)
    } else if (warm && record != null && canvas.isHardwareAccelerated) {
      record.setPosition(0, 0, width, height)
      record.alpha = 0f
      val inside = record.beginRecording()
      super.dispatchDraw(inside)
      record.endRecording()
      canvas.drawRenderNode(record)
      return
    }
    // Opened or cold: the see-through record of it let go.
    record?.discardDisplayList()
  }

  /*
    Where its children go is React Native's to say. `ExpoView` is a
    `LinearLayout` underneath, which left to itself stacks them one under
    another: see `FrostTargetView`.
  */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  // Nothing clipped to its padding, which it has none of: see `FrostView`.
  override fun clipToPaddingBox(canvas: Canvas) = Unit

  companion object {
    /** Whether [view] is inside a curtain drawn shut, and so not drawn. */
    fun hides(view: View): Boolean {
      var at = view.parent
      while (at is View) {
        if (at is CurtainView && at.shut) return true
        at = at.parent
      }
      return false
    }
  }
}
