package expo.modules.jukeboxaudio.widget

/**
 * What the widgets ask of the playback service beyond the keys of a headset.
 *
 * Play, pause and skipping go to the service as media button presses, which
 * Media3 already knows how to take (see `JukeboxWidget.send`). Shuffling the
 * queue, changing the repeat mode, jumping to a song further down and starting
 * a shuffle of the library have no key, so they are sent as intents of the
 * service's own, by the same road and for the same reason: a broadcast
 * receiver has no time to bind a controller and wait for it.
 */
object WidgetCommands {
  /** Shuffles the queue as the player's own button does, keeping the song that is playing. */
  const val SHUFFLE_QUEUE = "expo.modules.jukeboxaudio.widget.command.SHUFFLE_QUEUE"

  /** Sets the repeat mode to [EXTRA_MODE]: the mode the button showed it would move to. */
  const val REPEAT = "expo.modules.jukeboxaudio.widget.command.REPEAT"

  /** Plays the song at [EXTRA_INDEX], if it is still the one called [EXTRA_ID]. */
  const val JUMP = "expo.modules.jukeboxaudio.widget.command.JUMP"

  /** Replaces the queue with what the car's shelf [EXTRA_SHELF] would play, and plays it. */
  const val SHELF = "expo.modules.jukeboxaudio.widget.command.SHELF"

  const val EXTRA_MODE = "mode"
  const val EXTRA_INDEX = "index"
  const val EXTRA_ID = "id"
  const val EXTRA_SHELF = "shelf"

  val ALL = setOf(SHUFFLE_QUEUE, REPEAT, JUMP, SHELF)
}
