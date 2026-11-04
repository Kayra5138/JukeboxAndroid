package expo.modules.jukeboxaudio.auto

import expo.modules.jukeboxaudio.TapePlace
import expo.modules.jukeboxaudio.Tapes

/**
 * The Tapes folder as the car shows it: the shows followed, the books, the
 * other folders of several tapes, and the tapes on their own — the same four
 * parts the app's tapes view divides it into (`LibraryScreen`'s tape rows),
 * worked out the same way, so that a book in the app is a book in the car.
 *
 * Nothing here reads the phone. What a tape is, where it is and how far in
 * it was left are handed in, which is what lets the rules be held to in a
 * unit test.
 */
internal object TapeShelves {
  /** Which of the parts a series is: a show followed, a book of numbered parts, or another folder of several. */
  enum class Kind { SHOW, BOOK, FOLDER }

  /**
   * A folder of tapes that go together, in the order they are played: a
   * book's parts from the first, a show's episodes from the oldest. [key] is
   * its folder as the media store writes it, without the slashes and in
   * small letters, which is what the car finds it again by.
   */
  data class Series<T>(val key: String, val name: String, val kind: Kind, val tapes: List<T>)

  data class Shelves<T>(
    val shows: List<Series<T>>,
    val books: List<Series<T>>,
    val folders: List<Series<T>>,
    val loose: List<T>
  ) {
    val series: List<Series<T>> get() = shows + books + folders
  }

  /** Less than this far in, a tape has not been begun: the player keeps no place for it either. */
  private const val BEGUN_MS = 10_000L

  /** A book's part, as a playlist fetched from YouTube or a book from LibriVox names its files: `01 - Title`. */
  private val NUMBERED = Regex("^\\d{1,4} - ")

  /**
   * [tapes] divided into their parts.
   *
   * [followed] is the shows followed, by the key of the folder their
   * episodes are put in (see [followedKey]) and with the name each is shown
   * by. A folder of a show that is followed is that show, whatever its
   * files are called. Any other folder of two or more tapes is a book where
   * its files are numbered parts, and a folder of tapes otherwise — a
   * channel's videos, say. A tape alone in its folder, or put loose in the
   * Tapes folder itself, is nothing's part.
   */
  fun <T> divide(
    tapes: List<T>,
    followed: Map<String, String>,
    folderOf: (T) -> String?,
    fileOf: (T) -> String?
  ): Shelves<T> {
    val byFolder = LinkedHashMap<String, MutableList<T>>()
    for (tape in tapes) byFolder.getOrPut(folderKey(folderOf(tape) ?: "")) { ArrayList() }.add(tape)

    val shows = ArrayList<Series<T>>()
    val books = ArrayList<Series<T>>()
    val folders = ArrayList<Series<T>>()
    val loose = ArrayList<T>()
    for ((key, together) in byFolder) {
      val name = nameOf(key)
      val show = followed[key]
      if (show != null) {
        shows.add(Series(key, show, Kind.SHOW, inOrder(together, fileOf)))
        continue
      }
      if (together.size < 2 || name.isEmpty() || Tapes.isTapesFolderName(name)) {
        loose.addAll(together)
        continue
      }
      val parts = inOrder(together, fileOf)
      // The folder's own name as it is written, not as it is keyed.
      val shown = folderOf(together.first())?.trim('/')?.substringAfterLast('/')?.ifEmpty { null } ?: name
      if (parts.any { NUMBERED.containsMatchIn(fileOf(it) ?: "") }) books.add(Series(key, shown, Kind.BOOK, parts))
      else folders.add(Series(key, shown, Kind.FOLDER, parts))
    }
    return Shelves(shows, books, folders, loose)
  }

  /**
   * The tapes of a series in the order they go, by the names they were
   * filed under: for a book its parts' numbers, for a show the day each came
   * out, which is how its files' names begin — the app's `inSeriesOrder`.
   */
  fun <T> inOrder(tapes: List<T>, fileOf: (T) -> String?): List<T> =
    tapes.sortedWith(compareBy(NATURAL) { fileOf(it) ?: "" })

  /**
   * A series as it is listed in the car: the ones part way through first,
   * the one listened to last at the top, so that carrying on is the first
   * row; then the rest, a show's newest first as its own screen lists them,
   * and a book's or a folder's in their order.
   */
  fun <T> listed(series: Series<T>, places: Map<String, TapePlace>, idOf: (T) -> String): List<T> {
    val begun = series.tapes.filter { begun(places[idOf(it)]) }.sortedByDescending { places[idOf(it)]?.at ?: 0L }
    val rest = series.tapes.filter { !begun(places[idOf(it)]) }
    return begun + if (series.kind == Kind.SHOW) rest.reversed() else rest
  }

  /**
   * Loose tapes as the app's tapes view orders them (`orderTapes`): the ones
   * part way through first, the one listened to last at the top; then those
   * not begun, as they came; then those heard, the latest first.
   */
  fun <T> ordered(tapes: List<T>, places: Map<String, TapePlace>, idOf: (T) -> String): List<T> {
    val begun = ArrayList<T>()
    val fresh = ArrayList<T>()
    val heard = ArrayList<T>()
    for (tape in tapes) {
      val place = places[idOf(tape)]
      when {
        place == null || (!place.finished && place.positionMs < BEGUN_MS) -> fresh.add(tape)
        place.finished -> heard.add(tape)
        else -> begun.add(tape)
      }
    }
    val latest = compareByDescending<T> { places[idOf(it)]?.at ?: 0L }
    return begun.sortedWith(latest) + fresh + heard.sortedWith(latest)
  }

  /** When any tape of [series] was last listened to, for putting the series listened to last first. */
  fun <T> heardAt(series: Series<T>, places: Map<String, TapePlace>, idOf: (T) -> String): Long =
    series.tapes.maxOfOrNull { places[idOf(it)]?.at ?: 0L } ?: 0L

  /** Part way through, and not heard to the end. */
  fun begun(place: TapePlace?): Boolean = place != null && !place.finished && place.positionMs >= BEGUN_MS

  /**
   * How many minutes of a tape are left, rounded up so that the last few
   * seconds still say one; null where how long it is is not known.
   */
  fun minutesLeft(place: TapePlace, durationMs: Long): Int? {
    val whole = place.durationMs.takeIf { it > 0 } ?: durationMs.takeIf { it > 0 } ?: return null
    val left = (whole - place.positionMs).coerceAtLeast(0)
    return ((left + 59_999) / 60_000).toInt().coerceAtLeast(1)
  }

  /** A folder as the app keys it (`folderKey`), in small letters: without the slashes at either end. */
  fun folderKey(folder: String): String = folder.trim('/').lowercase()

  /** The last name in a folder's key. */
  private fun nameOf(key: String): String = key.substringAfterLast('/')

  /**
   * The key of the folder a followed show's episodes are put in, from the
   * name it keeps for its folder: `<library>/Tapes/<name>`, the name made
   * fit for a path as the app makes it (`tapeFolderOf`, `seriesFolderOf`).
   */
  fun followedKey(root: String, folder: String): String {
    val base = root.trim('/')
    return folderKey("${if (base.isEmpty()) "" else "$base/"}Tapes/${folderNameOf(folder)}")
  }

  /** The app's `folderNameOf`: without what a path cannot hold, not too long, and never nothing. */
  fun folderNameOf(name: String, otherwise: String = "Tape"): String {
    val plain = name
      .replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), " ")
      .replace(Regex("(?U)\\s+"), " ")
      .trim()
      .replace(Regex("^\\.+|\\.+$"), "")
      .trim()
    val points = plain.codePoints().toArray()
    val short = String(points, 0, minOf(points.size, 80)).trim()
    return short.ifEmpty { otherwise }
  }

  /**
   * Names compared as people count: `Part 2` before `Part 10`, and without
   * regard to case — what the app's `localeCompare(…, { numeric: true })`
   * does with the names of files.
   */
  val NATURAL: Comparator<String> = Comparator { a, b ->
    var i = 0
    var j = 0
    while (i < a.length && j < b.length) {
      val x = a[i]
      val y = b[j]
      if (x.isDigit() && y.isDigit()) {
        val startI = i
        val startJ = j
        while (i < a.length && a[i].isDigit()) i++
        while (j < b.length && b[j].isDigit()) j++
        val left = a.substring(startI, i).trimStart('0')
        val right = b.substring(startJ, j).trimStart('0')
        if (left.length != right.length) return@Comparator left.length - right.length
        val order = left.compareTo(right)
        if (order != 0) return@Comparator order
        continue
      }
      val order = x.lowercaseChar().compareTo(y.lowercaseChar())
      if (order != 0) return@Comparator order
      i++
      j++
    }
    (a.length - i) - (b.length - j)
  }
}
