package expo.modules.jukeboxaudio.game

/**
 * The MP3 decoder that runs in this process. See `src/main/cpp/jukebox_mp3.c`.
 *
 * An object and not a class because there is one library and loading it is the
 * only state there is. Whether that worked is kept rather than thrown: a build
 * for an architecture the library was not made for has no decoder of its own,
 * and that is a slower chart, not a broken app.
 */
internal object Mp3 {
  /** Whether the library is there to be called at all. */
  val ready: Boolean = runCatching { System.loadLibrary("jukeboxmp3") }.isSuccess

  /**
   * The whole of [data] as mono samples at [rate], or null if it is not an MP3
   * this can read -- in which case nothing has been lost but the attempt, and
   * the platform's decoder is asked instead.
   */
  external fun decode(data: ByteArray, rate: Int): FloatArray?
}
