package expo.modules.jukeboxaudio

import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat

/**
 * The phone's own palette, the one it makes from the wallpaper, written out
 * as colours JavaScript can do arithmetic on.
 *
 * From Android 12 the system keeps five tonal ramps as colour resources and
 * re-makes them whenever the wallpaper changes. React Native can point at
 * one of them, but only as a reference that is resolved when a view is
 * drawn: such a thing cannot be given an alpha, mixed with another, or
 * measured for whether text on it can be read, and the theme made from these
 * does all three. So they are read here, once per ask, into "#rrggbb".
 *
 * Four of the five: the two neutrals that pages and text are made of and the
 * two accents nearest the wallpaper. The third accent is a hue set apart from
 * the others for contrast, and the theme has no use for it.
 */
object SystemPalette {
  /**
   * The ramps, each from white to black in the system's own order of tones:
   * 0, 10, 50, 100, 200 … 900, 1000.
   *
   * Null before Android 12, where there is nothing to read.
   */
  fun of(context: Context): Map<String, List<String>>? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    return ramps().mapValues { (_, tones) -> tones.map { hex(ContextCompat.getColor(context, it)) } }
  }

  /** A colour as "#rrggbb". Whatever alpha it carried is dropped; these have none. */
  internal fun hex(colour: Int): String = String.format("#%06x", 0xFFFFFF and colour)

  /*
    Written out in full, all fifty-two. They are thirteen consecutive numbers
    a ramp in every release so far and could be counted up from the first,
    which is a thing to find out the hard way on the release where they are
    not.
  */
  @RequiresApi(Build.VERSION_CODES.S)
  private fun ramps(): Map<String, List<Int>> = mapOf(
    "accent1" to listOf(
      android.R.color.system_accent1_0,
      android.R.color.system_accent1_10,
      android.R.color.system_accent1_50,
      android.R.color.system_accent1_100,
      android.R.color.system_accent1_200,
      android.R.color.system_accent1_300,
      android.R.color.system_accent1_400,
      android.R.color.system_accent1_500,
      android.R.color.system_accent1_600,
      android.R.color.system_accent1_700,
      android.R.color.system_accent1_800,
      android.R.color.system_accent1_900,
      android.R.color.system_accent1_1000
    ),
    "accent2" to listOf(
      android.R.color.system_accent2_0,
      android.R.color.system_accent2_10,
      android.R.color.system_accent2_50,
      android.R.color.system_accent2_100,
      android.R.color.system_accent2_200,
      android.R.color.system_accent2_300,
      android.R.color.system_accent2_400,
      android.R.color.system_accent2_500,
      android.R.color.system_accent2_600,
      android.R.color.system_accent2_700,
      android.R.color.system_accent2_800,
      android.R.color.system_accent2_900,
      android.R.color.system_accent2_1000
    ),
    "neutral1" to listOf(
      android.R.color.system_neutral1_0,
      android.R.color.system_neutral1_10,
      android.R.color.system_neutral1_50,
      android.R.color.system_neutral1_100,
      android.R.color.system_neutral1_200,
      android.R.color.system_neutral1_300,
      android.R.color.system_neutral1_400,
      android.R.color.system_neutral1_500,
      android.R.color.system_neutral1_600,
      android.R.color.system_neutral1_700,
      android.R.color.system_neutral1_800,
      android.R.color.system_neutral1_900,
      android.R.color.system_neutral1_1000
    ),
    "neutral2" to listOf(
      android.R.color.system_neutral2_0,
      android.R.color.system_neutral2_10,
      android.R.color.system_neutral2_50,
      android.R.color.system_neutral2_100,
      android.R.color.system_neutral2_200,
      android.R.color.system_neutral2_300,
      android.R.color.system_neutral2_400,
      android.R.color.system_neutral2_500,
      android.R.color.system_neutral2_600,
      android.R.color.system_neutral2_700,
      android.R.color.system_neutral2_800,
      android.R.color.system_neutral2_900,
      android.R.color.system_neutral2_1000
    )
  )
}
