package expo.modules.jukeboxaudio

import android.content.Context
import android.os.Bundle
import androidx.media3.session.CommandButton
import androidx.media3.session.SessionCommand

/**
 * The buttons that stand in for previous and next while a tape plays: back
 * and on by the tape's jumps, in the notification, on the lock screen, in the
 * car and wherever else a media session's buttons are drawn.
 *
 * A press of previous or next on a tape was already a jump (see [Tapes.jump]),
 * but drawn as previous and next it looked like leaving the part, and nobody
 * presses a button that looks like losing their place in a book. Drawn as
 * what they do, with the seconds on them where the picture has them, they
 * are pressed. The music keeps previous and next: nothing is set for it, and
 * the session draws its own.
 */
internal object TapeButtons {
  /** The two commands, the session's own, which are answered by jumping. */
  const val BACK = "expo.modules.jukeboxaudio.TAPE_BACK"
  const val FORWARD = "expo.modules.jukeboxaudio.TAPE_FORWARD"

  // Made when first asked for, which is on a phone: a bundle is nothing to be had in a unit test.
  val back by lazy { SessionCommand(BACK, Bundle.EMPTY) }
  val forward by lazy { SessionCommand(FORWARD, Bundle.EMPTY) }

  /**
   * The picture for a jump of [seconds]: the one with that number on it
   * where Media3 has one, and the plain arrow round otherwise, rather than a
   * number that says something the button does not do.
   */
  fun backIcon(seconds: Int): Int = when (seconds) {
    5 -> CommandButton.ICON_SKIP_BACK_5
    10 -> CommandButton.ICON_SKIP_BACK_10
    15 -> CommandButton.ICON_SKIP_BACK_15
    30 -> CommandButton.ICON_SKIP_BACK_30
    else -> CommandButton.ICON_SKIP_BACK
  }

  fun forwardIcon(seconds: Int): Int = when (seconds) {
    5 -> CommandButton.ICON_SKIP_FORWARD_5
    10 -> CommandButton.ICON_SKIP_FORWARD_10
    15 -> CommandButton.ICON_SKIP_FORWARD_15
    30 -> CommandButton.ICON_SKIP_FORWARD_30
    else -> CommandButton.ICON_SKIP_FORWARD
  }

  /**
   * The buttons for what is playing: the two jumps, in the places previous
   * and next would be, for a tape; none for anything else, which leaves the
   * session's own previous and next where they are.
   */
  fun forPlaying(context: Context, tape: Boolean): List<CommandButton> {
    if (!tape) return emptyList()
    val (backMs, forwardMs) = Tapes.jumpsMs(context)
    val backSec = (backMs / 1000).toInt()
    val forwardSec = (forwardMs / 1000).toInt()
    return listOf(
      CommandButton.Builder(backIcon(backSec))
        .setSessionCommand(back)
        .setDisplayName(Localised.count(context, R.plurals.jukebox_tape_back, backSec))
        .setSlots(CommandButton.SLOT_BACK)
        .build(),
      CommandButton.Builder(forwardIcon(forwardSec))
        .setSessionCommand(forward)
        .setDisplayName(Localised.count(context, R.plurals.jukebox_tape_forward, forwardSec))
        .setSlots(CommandButton.SLOT_FORWARD)
        .build()
    )
  }

  /**
   * What the buttons are drawn from, to tell whether they have to be set
   * again: whether a tape is playing, its jumps, and the language they are
   * named in.
   */
  fun stateOf(context: Context, tape: Boolean): String =
    if (!tape) "" else "${Tapes.jumpsMs(context)}|${Localised.tag(context)}"
}
