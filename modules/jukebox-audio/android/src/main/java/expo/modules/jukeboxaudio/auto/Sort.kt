package expo.modules.jukeboxaudio.auto

import android.content.Context
import androidx.annotation.StringRes
import expo.modules.jukeboxaudio.R

/**
 * The order a shelf is shown in, in the car.
 *
 * A car draws what it is given in the order it is given, and has no control
 * of its own for changing that: no menu, no button an app may add beside the
 * tabs. So the order is something this side keeps, and the way to change it
 * is a tile at the head of the shelf that opens onto the choices.
 *
 * Kept apart from the phone's own sorting, and on purpose. What somebody wants
 * first on a dashboard, glanced at, is not what they want in a list they are
 * sitting down to read.
 *
 * Each is known by its key, which is what is written down, and named by a
 * string resource, because the name is in whatever language the app is in.
 */
internal enum class Sort(val key: String, @StringRes val label: Int) {
  TITLE("title", R.string.jukebox_auto_sort_name),
  ARTIST("artist", R.string.jukebox_auto_sort_artist),
  ADDED("added", R.string.jukebox_auto_sort_added),
  MOST("most", R.string.jukebox_auto_sort_most),
  RECENT("recent", R.string.jukebox_auto_sort_recent),
  CHANGED("changed", R.string.jukebox_auto_sort_changed),
  SIZE("size", R.string.jukebox_auto_sort_size);

  companion object {
    /** What each shelf can be put in order by, the first being how it starts out. */
    val FOR: Map<String, List<Sort>> = mapOf(
      "tracks" to listOf(TITLE, ARTIST, ADDED, MOST, RECENT),
      "albums" to listOf(TITLE, ADDED, MOST),
      "lists" to listOf(CHANGED, TITLE, SIZE)
    )

    /**
     * The order [shelf] is in, given what was last [saved] for it.
     *
     * Anything a shelf cannot be sorted by is the same as nothing: a choice
     * written by a build that offered more must not leave a shelf in an order
     * this one cannot produce.
     */
    fun of(shelf: String, saved: String?): Sort {
      val offered = FOR[shelf].orEmpty()
      return offered.firstOrNull { it.key == saved } ?: offered.firstOrNull() ?: TITLE
    }

    private const val PREFERENCES = "jukebox_auto"

    fun read(context: Context, shelf: String): Sort =
      of(shelf, context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString("sort:$shelf", null))

    fun write(context: Context, shelf: String, sort: Sort) {
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        .edit().putString("sort:$shelf", sort.key).apply()
    }
  }
}

/**
 * Words as they are compared in a search: no case, no accents, no dotless i.
 *
 * A driver says or pecks out a few letters, and `sarki` has to find `Şarkı`.
 */
internal fun folded(text: String): String =
  java.text.Normalizer.normalize(text.replace('ı', 'i').replace('İ', 'i'), java.text.Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "")
    .lowercase(java.util.Locale.ROOT)
    .trim()

/**
 * How well [fields] answer [query], or null where they do not.
 *
 * Every word asked for has to be somewhere in them. Lower is better: a name
 * that starts with what was typed comes before one that merely contains it,
 * and the name comes before the artist or the record.
 */
internal fun searchRank(query: String, title: String, others: List<String?>): Int? {
  val words = folded(query).split(Regex("\\s+")).filter { it.isNotEmpty() }
  if (words.isEmpty()) return null
  val name = folded(title)
  val rest = others.filterNotNull().joinToString(" ") { folded(it) }
  if (!words.all { name.contains(it) || rest.contains(it) }) return null
  val whole = words.joinToString(" ")
  return when {
    name.startsWith(whole) -> 0
    name.contains(whole) -> 1
    words.all { name.contains(it) } -> 2
    else -> 3
  }
}

/** What the app keeps about a track: what a lookup found, or what somebody typed. */
internal data class Kept(
  /** Typed by hand, and so trusted over the file. */
  val manual: Boolean,
  val title: String?,
  val artist: String?,
  val album: String?,
  val position: Int?
)

internal data class Named(val title: String, val artist: String?, val album: String?)

/**
 * What a track is called, from its file and from what the app [kept] for it.
 *
 * The rule the phone's own screens follow, said again here because the car is
 * answered by the service and the service cannot ask them. It had been using
 * the file alone, so a song whose names were put right on the phone went on
 * wearing its file name on the dashboard.
 *
 * A correction typed by hand replaces what the file says, since it exists
 * because the file was wrong. A lookup only fills gaps: it can come back with
 * another recording of the same song, so its title is never taken and its
 * artist and album only where the file has none.
 */
internal fun named(title: String, artist: String?, album: String?, kept: Kept?): Named {
  fun String?.said() = this?.takeIf { it.isNotBlank() }
  return when {
    kept == null -> Named(title, artist.said(), album.said())
    kept.manual -> Named(kept.title.said() ?: title, kept.artist.said() ?: artist.said(), kept.album.said() ?: album.said())
    else -> Named(title, artist.said() ?: kept.artist.said(), album.said() ?: kept.album.said())
  }
}
