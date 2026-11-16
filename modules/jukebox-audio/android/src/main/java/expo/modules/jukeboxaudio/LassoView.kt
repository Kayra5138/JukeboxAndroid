package expo.modules.jukeboxaudio

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.view.MotionEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * A ring drawn round some of the artists' map with a finger, the line
 * following it as it goes and closed when it is lifted; then told to the map
 * as the points it went through, in points on the screen, which the map
 * turns into the artists inside it.
 *
 * Drawn here and not by the map's own views: a line put together from views,
 * a frame behind the finger at every step, was not a line that follows a
 * finger. The ring stays where it was drawn until another is begun or the
 * map asks for it to go ([setClear]).
 */
@SuppressLint("ViewConstructor")
class LassoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onLasso by EventDispatcher()

  private val density = resources.displayMetrics.density
  private val path = Path()
  /** The points gone through, in points (not pixels), x then y. */
  private val points = ArrayList<Float>()
  private var closed = false

  private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2.5f * density
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

  /** The last time the map asked for the ring to go: a new value, and it goes. */
  private var clearedAt = 0

  init {
    setWillNotDraw(false)
    setColour("#ffffff")
  }

  fun setColour(colour: String) {
    val parsed = runCatching { Color.parseColor(colour) }.getOrDefault(Color.WHITE)
    line.color = parsed
    fill.color = (parsed and 0x00ffffff) or (0x2e shl 24)
    invalidate()
  }

  fun setClear(at: Int) {
    if (at == clearedAt) return
    clearedAt = at
    path.reset()
    points.clear()
    closed = false
    invalidate()
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        // Nothing round it is to take this touch for a drag of its own.
        parent?.requestDisallowInterceptTouchEvent(true)
        path.reset()
        points.clear()
        closed = false
        path.moveTo(event.x, event.y)
        add(event.x, event.y)
        invalidate()
      }
      MotionEvent.ACTION_MOVE -> {
        for (at in 0 until event.historySize) {
          path.lineTo(event.getHistoricalX(at), event.getHistoricalY(at))
          add(event.getHistoricalX(at), event.getHistoricalY(at))
        }
        path.lineTo(event.x, event.y)
        add(event.x, event.y)
        invalidate()
      }
      MotionEvent.ACTION_UP -> {
        path.lineTo(event.x, event.y)
        add(event.x, event.y)
        path.close()
        closed = true
        invalidate()
        onLasso(mapOf("points" to points.toList()))
      }
      MotionEvent.ACTION_CANCEL -> {
        path.reset()
        points.clear()
        closed = false
        invalidate()
      }
    }
    return true
  }

  private fun add(x: Float, y: Float) {
    points.add(x / density)
    points.add(y / density)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (points.isEmpty()) return
    if (closed) canvas.drawPath(path, fill)
    canvas.drawPath(path, line)
  }

  /*
    Laid out by React Native, as every view of the app's own is: `ExpoView`
    is a `LinearLayout` underneath. See `FrostTargetView`.
  */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  override fun clipToPaddingBox(canvas: Canvas) = Unit
}
