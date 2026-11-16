package expo.modules.jukeboxaudio.spectrum

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.uimanager.ReactPointerEventsView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

/**
 * The arm of a turntable over the record in the player, drawn as one is
 * made: a round plinth with its bearing, a counterweight behind it, a thin
 * tube, and at the end the headshell turned in toward the middle with the
 * cartridge under it and a lift to the side. Near black, with an edge of
 * light along it, so that it is seen over the black of the record.
 *
 * Laid over the record's square and drawn again only when it is turned, which
 * is when the song has gone on far enough to move the needle: [turn], in
 * degrees from hanging straight down, the needle at the end of it where
 * `armTurn` in `ui/coverFace.ts` puts it. Touches go through it.
 */
@SuppressLint("ViewConstructor")
class TonearmView(context: Context, appContext: AppContext) : ExpoView(context, appContext), ReactPointerEventsView {
  override val pointerEvents: PointerEvents = PointerEvents.NONE

  private var turn = 0f
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  private val rim = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = RIM }
  private val box = RectF()

  init {
    setWillNotDraw(false)
  }

  fun setTurn(degrees: Float) {
    if (degrees == turn) return
    turn = degrees
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val size = min(width, height).toFloat()
    if (size <= 0f) return
    val pivotX = size * PIVOT_X
    val pivotY = size * PIVOT_Y
    val angle = Math.toRadians(turn.toDouble()).toFloat()
    // Along the arm, from the pivot toward the needle, and across it.
    val alongX = -sin(angle)
    val alongY = cos(angle)
    rim.strokeWidth = size * 0.004f

    val reach = size * ARM
    val shell = size * 0.12f
    val tipX = pivotX + alongX * reach
    val tipY = pivotY + alongY * reach
    // Where the headshell meets the tube: back from the needle along the shell, which is turned in.
    val shellAngle = Math.toRadians((turn + OFFSET).toDouble()).toFloat()
    val jointX = tipX + sin(shellAngle) * shell * 0.9f
    val jointY = tipY - cos(shellAngle) * shell * 0.9f
    // The tube, straight from the pivot to there, and the counterweight behind the pivot on its line.
    val tubeTurn = Math.toDegrees(atan2(-(jointX - pivotX).toDouble(), (jointY - pivotY).toDouble())).toFloat()
    val tubeLong = hypot(jointX - pivotX, jointY - pivotY)
    canvas.save()
    canvas.translate(pivotX, pivotY)
    canvas.rotate(tubeTurn)
    tube(canvas, -size * 0.2f, -size * 0.045f, size * 0.075f, size * 0.004f)
    tube(canvas, 0f, tubeLong + size * 0.01f, size * 0.02f, size * 0.01f)
    canvas.restore()

    // The headshell, turned in from the tube, its far end on the groove.
    canvas.save()
    canvas.translate(tipX, tipY)
    canvas.rotate(turn + OFFSET)
    // The lift, out to the side for a finger.
    box.set(-size * 0.055f, -shell * 0.62f, size * 0.004f, -shell * 0.55f)
    fill.shader = null
    fill.color = BODY
    canvas.drawRoundRect(box, size * 0.004f, size * 0.004f, fill)
    canvas.drawRoundRect(box, size * 0.004f, size * 0.004f, rim)
    // The shell.
    box.set(-size * 0.028f, -shell, size * 0.028f, 0f)
    fill.shader = LinearGradient(box.left, 0f, box.right, 0f, intArrayOf(BODY, SHINE, BODY), floatArrayOf(0f, 0.45f, 1f), Shader.TileMode.CLAMP)
    canvas.drawRoundRect(box, size * 0.008f, size * 0.008f, fill)
    canvas.drawRoundRect(box, size * 0.008f, size * 0.008f, rim)
    // The cartridge under it, at the needle's end.
    box.set(-size * 0.02f, -shell * 0.5f, size * 0.02f, size * 0.004f)
    fill.shader = null
    fill.color = CARTRIDGE
    canvas.drawRoundRect(box, size * 0.004f, size * 0.004f, fill)
    canvas.drawRoundRect(box, size * 0.004f, size * 0.004f, rim)
    canvas.restore()

    // The plinth and its bearing, over the end of the tube.
    val plinth = size * 0.075f
    fill.shader = RadialGradient(pivotX - plinth * 0.3f, pivotY - plinth * 0.3f, plinth * 1.3f, SHINE, BODY, Shader.TileMode.CLAMP)
    canvas.drawCircle(pivotX, pivotY, plinth, fill)
    canvas.drawCircle(pivotX, pivotY, plinth, rim)
    fill.shader = null
    fill.color = CARTRIDGE
    canvas.drawCircle(pivotX, pivotY, plinth * 0.45f, fill)
    canvas.drawCircle(pivotX, pivotY, plinth * 0.45f, rim)
  }

  /**
   * A length of round tube along the arm, from [from] to [to] along it, [wide]
   * across, with rounded ends of [round]: lit down its middle, as a tube is.
   */
  private fun tube(canvas: Canvas, from: Float, to: Float, wide: Float, round: Float) {
    box.set(-wide / 2, from, wide / 2, to)
    fill.shader = LinearGradient(-wide / 2, 0f, wide / 2, 0f, intArrayOf(BODY, SHINE, BODY), floatArrayOf(0f, 0.4f, 1f), Shader.TileMode.CLAMP)
    canvas.drawRoundRect(box, round, round, fill)
    canvas.drawRoundRect(box, round, round, rim)
  }

  private companion object {
    // As `PIVOT_X`, `PIVOT_Y` and `ARM` in `ui/coverFace.ts`.
    const val PIVOT_X = 0.9f
    const val PIVOT_Y = 0.08f
    const val ARM = 0.66f
    /** How far the headshell is turned in from the tube, in degrees, as on a real arm. */
    const val OFFSET = 22f

    val BODY = Color.rgb(28, 28, 32)
    val SHINE = Color.rgb(78, 78, 86)
    val CARTRIDGE = Color.rgb(18, 18, 20)
    val RIM = Color.argb(150, 120, 120, 130)
  }
}
