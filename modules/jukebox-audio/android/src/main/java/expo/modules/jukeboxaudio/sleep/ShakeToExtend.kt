package expo.modules.jukeboxaudio.sleep

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Listens for a shake of the phone in the last minutes of a sleep timer, and
 * says it was felt with a short buzz.
 *
 * In the service, beside the timer, for the timer's own reason: it is for
 * somebody with the screen off and the app long gone. The accelerometer is
 * listened to only while [start]ed — the few minutes the timer asks for —
 * and let go the moment it is not wanted, since a sensor read many times a
 * second all night would cost more battery than the music.
 *
 * With the screen off the readings still come: the music playing keeps the
 * processor awake, and a foreground service is not one of the idle apps
 * Android stops sensors for. Paused, the timer stops listening anyway.
 */
class ShakeToExtend(private val context: Context, private val onShake: () -> Unit) : SensorEventListener {
  private val sensors = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  private val handler = Handler(Looper.getMainLooper())
  private val detector = ShakeDetector()
  private var listening = false

  /** Listens, if it was not already and the phone has an accelerometer. */
  fun start() {
    if (listening) return
    val sensor = sensors?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
    detector.reset()
    // Readings delivered on the main thread, which is the timer's and the player's.
    listening = sensors.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME, handler)
  }

  fun stop() {
    if (!listening) return
    listening = false
    sensors?.unregisterListener(this)
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (!listening || event.values.size < 3) return
    if (detector.reading(event.timestamp / 1_000_000L, event.values[0], event.values[1], event.values[2])) onShake()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  /** A short buzz, so that somebody who shook the phone in the dark knows it was heard. */
  fun buzz() {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
    if (vibrator?.hasVibrator() != true) return
    runCatching { vibrator.vibrate(VibrationEffect.createOneShot(BUZZ_MS, VibrationEffect.DEFAULT_AMPLITUDE)) }
  }

  companion object {
    private const val BUZZ_MS = 80L
    private const val FILE = "jukebox.sleep"
    private const val ON = "shakeToExtend"

    /** Whether a shake adds time: on unless turned off in the sleep timer's sheet. */
    fun enabled(context: Context): Boolean =
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(ON, true)

    fun setEnabled(context: Context, on: Boolean) {
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(ON, on).apply()
    }
  }
}
