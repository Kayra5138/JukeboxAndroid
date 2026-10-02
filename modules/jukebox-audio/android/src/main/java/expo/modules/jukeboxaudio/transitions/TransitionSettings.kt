package expo.modules.jukeboxaudio.transitions

/**
 * How long each kind of transition takes, and whether it happens at all.
 *
 * Four durations rather than one, because the useful lengths are nothing alike.
 * Six seconds of overlap between two songs is a mix; six seconds between
 * pressing next and hearing the next song is a fault. The one slider every
 * streaming app offers makes those the same number, and the number that suits
 * one ruins the other.
 */
data class TransitionSettings(
  val enabled: Boolean = false,
  /*
    Only the overlap is on by default, and only just. Switching crossfade on
    should change the thing it is named after and nothing else: somebody who
    wanted their skip button to fade would have gone looking for it, and
    somebody who did not would find their buttons mysteriously slower.
  */
  /** A track ending and the next beginning. The one people mean by crossfade. */
  val autoMs: Long = 2_500,
  /** Next or previous, pressed. Off unless asked for. */
  val manualMs: Long = 0,
  /** Pause and resume. Off unless asked for. */
  val pauseMs: Long = 0,
  /** Either side of a seek. Off unless asked for. */
  val seekMs: Long = 0,
  /**
   * Whether consecutive tracks of one album are left alone.
   *
   * A live record, a concept album, anything mixed to run together: the join is
   * part of the music and fading across it is vandalism. Off by default all the
   * same — it is an exception to the thing that was just switched on, and a
   * setting that quietly stops crossfade happening is worse than one that lets
   * it happen somewhere it should not have.
   */
  val skipSameAlbum: Boolean = false,
  /** Equal power keeps the loudness steady across an overlap; linear dips. */
  val equalPower: Boolean = true
) {
  companion object {
    /*
      A ceiling apiece, because the whole point of having four of these is that
      they are unlike each other. One shared limit — which is what the streaming
      apps have, since they only offer the first of them — puts the useful part
      of the seek fade in the first tenth of its slider and leaves the rest of
      the travel setting values nobody would ever want.

      Five seconds of overlap is longer than all but the most deliberate mixes;
      Spotify and Apple stop at twelve because twelve is where a DJ-style blend
      lives, and that is not what this is for.
    */
    const val MAX_AUTO_MS = 5_000L

    /** A pressed button has to answer. Past a second or so it reads as lag. */
    const val MAX_MANUAL_MS = 2_000L

    /** Long enough to be gentle, short enough that stop still means stop. */
    const val MAX_PAUSE_MS = 2_000L

    /** Only ever there to take the edge off; a second is already generous. */
    const val MAX_SEEK_MS = 1_000L

    /**
     * A track has to have at least this much left over after the fade.
     *
     * Without it a thirty-second interlude with a six-second crossfade at each
     * end is mostly crossfade, and a jingle shorter than the fade would start
     * halfway through its own ending.
     */
    const val MIN_BODY_MS = 5_000L

    /**
     * How long before the overlap the outgoing player is made ready.
     *
     * It has to be opened, prepared and seeked before it can produce a sample,
     * and doing that at the moment of the crossfade would leave a hole exactly
     * where the crossfade was supposed to be.
     */
    const val PREPARE_MS = 1_200L
  }
}

/**
 * Whether a track should hand over to the next one, and when.
 *
 * Pure, and separate from the machinery that acts on it, because this is where
 * the judgement lives: every rule about what should not be crossfaded is a
 * condition in here, and they are worth being able to state without a player.
 *
 * Answers the position in the current track at which the overlap begins, or
 * null for a handover that should not happen.
 */
fun crossfadeStartMs(
  settings: TransitionSettings,
  durationMs: Long,
  hasNext: Boolean,
  albumOfCurrent: String?,
  albumOfNext: String?
): Long? {
  if (!settings.enabled || settings.autoMs <= 0) return null
  if (!hasNext) return null
  // A stream, or a file whose length is not known yet. There is no "near the
  // end" of something with no end.
  if (durationMs <= 0) return null

  if (settings.skipSameAlbum && sameAlbum(albumOfCurrent, albumOfNext)) return null

  val fade = settings.autoMs.coerceAtMost(TransitionSettings.MAX_AUTO_MS)
  if (durationMs < fade + TransitionSettings.MIN_BODY_MS) return null

  return durationMs - fade
}

/**
 * Two tracks belong to the same album when both say so and say the same thing.
 *
 * Compared without case or surrounding space, since the tags come from several
 * places and rarely agree on either. A missing album is not a match: two tracks
 * that both know nothing about themselves are not thereby a record.
 */
private fun sameAlbum(first: String?, second: String?): Boolean {
  val left = first?.trim().orEmpty()
  val right = second?.trim().orEmpty()
  if (left.isEmpty() || right.isEmpty()) return false
  return left.equals(right, ignoreCase = true)
}
