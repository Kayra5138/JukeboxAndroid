package expo.modules.jukeboxaudio

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RenderNode
import android.os.Build
import androidx.annotation.RequiresApi
import kotlin.math.ceil
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Out of focus without a blur to put it through, for Android 10 and 11.
 *
 * Halved and halved again, each time as a picture of that size, so that every
 * step is the average of four of the step before; and then doubled back up the
 * same way, each a picture smoothed as it grows. Drawn small in one go, a
 * line of writing came out as specks, the drawing being made at the small size
 * rather than the picture of it shrunk. All of it on the graphics chip.
 */
@RequiresApi(Build.VERSION_CODES.Q)
internal class Softener(private val name: String) {
  private val nodes = ArrayList<RenderNode>()
  private val smooth = Paint(Paint.FILTER_BITMAP_FLAG)

  private fun node(index: Int): RenderNode {
    while (nodes.size <= index) nodes.add(RenderNode("$name-${nodes.size}"))
    return nodes[index]
  }

  /**
   * Draws [source], [wide] by [high] as drawn, about [pixels] out of focus on
   * [canvas] at its own size; the last picture with [last], for one set back.
   */
  fun draw(canvas: Canvas, source: RenderNode, wide: Int, high: Int, pixels: Float, last: Paint?) {
    // A picture of its own, at its full size, to be halved from.
    source.setUseCompositingLayer(true, smooth)
    // A blur of a given radius looks most like twice that, halved down to.
    val halvings = max(1, (ln(max(2f, pixels * 2f)) / ln(2f)).roundToInt())
    var from = source
    var fromWide = wide.toFloat()
    var fromHigh = high.toFloat()
    var used = 0
    repeat(halvings) {
      val toWide = max(1f, ceil(fromWide / 2f))
      val toHigh = max(1f, ceil(fromHigh / 2f))
      from = step(used++, from, fromWide, fromHigh, toWide, toHigh, smooth)
      fromWide = toWide
      fromHigh = toHigh
    }
    // Back up to half its size; drawing that doubled is the last step.
    repeat(halvings - 1) { index ->
      val toWide = min(wide.toFloat(), fromWide * 2f)
      val toHigh = min(high.toFloat(), fromHigh * 2f)
      from = step(used++, from, fromWide, fromHigh, toWide, toHigh, if (index == halvings - 2) last ?: smooth else smooth)
      fromWide = toWide
      fromHigh = toHigh
    }
    if (halvings == 1 && last != null) from.setUseCompositingLayer(true, last)
    canvas.save()
    canvas.scale(wide / fromWide, high / fromHigh)
    canvas.drawRenderNode(from)
    canvas.restore()
  }

  private fun step(index: Int, from: RenderNode, fromWide: Float, fromHigh: Float, toWide: Float, toHigh: Float, paint: Paint): RenderNode {
    val to = node(index)
    to.setPosition(0, 0, toWide.toInt(), toHigh.toInt())
    to.setUseCompositingLayer(true, paint)
    to.beginRecording().also {
      it.scale(toWide / fromWide, toHigh / fromHigh)
      it.drawRenderNode(from)
    }
    to.endRecording()
    return to
  }
}
