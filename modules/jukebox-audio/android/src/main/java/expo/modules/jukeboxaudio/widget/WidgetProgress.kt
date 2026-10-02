package expo.modules.jukeboxaudio.widget

object WidgetProgress {
  fun value(positionMs: Long, durationMs: Long): Int =
    if (durationMs <= 0) 0 else ((positionMs.coerceIn(0, durationMs).toDouble() / durationMs) * 1000).toInt()
}
