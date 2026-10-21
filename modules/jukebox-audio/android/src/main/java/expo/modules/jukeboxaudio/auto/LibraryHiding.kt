package expo.modules.jukeboxaudio.auto

/**
 * What the library leaves out of its folder, for the car: folders somebody
 * has switched off on the phone, and files too short to be music.
 *
 * The same two rules as `src/lib/library/hiding.ts` on the JavaScript side,
 * which the phone's own screens go by, and kept to the letter: a track the
 * phone does not list turning up on the dashboard would be the voice note it
 * was switched off to be rid of. The settings come across in the car's copy
 * of the database; nothing here reads them, so the rules can be tested.
 *
 * Only ever not showing. The plays, tags and lists of a track left out are
 * not touched, here or anywhere.
 */
internal class LibraryHiding(root: String, leftOut: List<String>, shortestSec: Int) {
  private val shortest = shortestSec.coerceAtLeast(0)

  /*
    Only the folders strictly inside the library folder. One outside it does
    not matter while it is outside, and one the library folder is now inside
    would leave nothing, from a switch on a screen that no longer lists it.
  */
  private val folders: List<String> = run {
    val base = compared(root)
    leftOut.map(::compared).filter { folder ->
      folder.isNotEmpty() && (base.isEmpty() || (isUnder(folder, base) && folder != base))
    }
  }

  /** Whether nothing at all is left out, so the tracks can go through as they are. */
  val leavesNothing: Boolean get() = folders.isEmpty() && shortest == 0

  /** Whether a track in [folder] running [durationSec] is in the library. */
  fun shows(folder: String?, durationSec: Double): Boolean {
    if (isShort(durationSec, shortest)) return false
    if (folder == null) return true
    val path = compared(folder)
    return folders.none { isUnder(path, it) }
  }

  companion object {
    /**
     * A folder as one spelling and one case: the media store writes
     * `Music/WhatsApp/` with a trailing slash, the setting is kept without
     * one, and case is nothing the store is careful about in a path.
     */
    fun compared(path: String): String =
      path.replace('\\', '/').replace(Regex("/{2,}"), "/").trim('/').lowercase()

    /** Whether [path] is [folder] or inside it, by whole steps. Both already [compared]. */
    fun isUnder(path: String, folder: String): Boolean =
      folder.isNotEmpty() && (path == folder || path.startsWith("$folder/"))

    /**
     * Short, and known to be: a length of nought is one the media store did
     * not know, and is let in rather than taken for short.
     */
    fun isShort(durationSec: Double, shortest: Int): Boolean =
      shortest > 0 && durationSec > 0 && durationSec < shortest
  }
}
