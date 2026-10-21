package expo.modules.jukeboxaudio.widget

/**
 * The four ways the now-playing widget can be drawn, smallest first.
 *
 * Which one is decided by height alone. Every provider asks for at least
 * 250dp of width, so a widget is never too narrow for any of them, while the
 * height is exactly what grows as it is pulled down: one row of cells, two,
 * four.
 */
enum class WidgetKind {
  /** The original row: a small cover, the words and three buttons. */
  COMPACT,

  /** The same row with a larger cover, for one row of cells on a tall grid. */
  ROW,

  /** A large cover beside the words, with shuffle and repeat added to the buttons. */
  CARD,

  /** The card's top half above the next few songs in the queue. */
  LARGE
}

/** One size a widget is shown at, and what is drawn there. */
data class WidgetShape(val widthDp: Float, val heightDp: Float, val kind: WidgetKind, val rows: Int) {
  /** Two shapes draw the same views when they differ only in how big they are. */
  fun drawsLike(other: WidgetShape): Boolean = kind == other.kind && rows == other.rows

  companion object {
    /**
     * Below this the widget is the compact row, as it always was. Kept where
     * it was before the larger layouts existed, so a widget nobody has
     * touched since is drawn exactly as it was.
     */
    const val ROW_FROM_DP = 90f

    /**
     * Two rows of cells and upwards. A launcher reports two rows at anything
     * from about 110dp to 200, depending on its grid; the card's buttons and
     * two lines of words fit in a little over a hundred.
     */
    const val CARD_FROM_DP = 120f

    /** The card's own height, then room for at least one song under it. */
    const val LARGE_FROM_DP = 240f

    /** What the large layout spends before its first row: see jukebox_widget_large.xml. */
    const val LARGE_CHROME_DP = 196f

    /** One row of the queue, tall enough to be a finger's target. */
    const val ROW_DP = 40f

    /** As many as the layout holds. A widget taller than this has room to spare. */
    const val MOST_ROWS = 6

    /**
     * The layout for a widget [heightDp] tall, when the least height it is
     * ever shown at is [leastHeightDp].
     *
     * The card and the large layout go by the height in hand. The choice
     * between the two rows goes by the least height, as it always did: a
     * launcher reports a widget one row high as taller upright than on its
     * side, and judged by the upright figure a widget placed long ago would
     * change its look from one day to the next.
     */
    fun kindFor(heightDp: Float, leastHeightDp: Float = heightDp): WidgetKind = when {
      heightDp >= LARGE_FROM_DP -> WidgetKind.LARGE
      heightDp >= CARD_FROM_DP -> WidgetKind.CARD
      minOf(heightDp, leastHeightDp) >= ROW_FROM_DP -> WidgetKind.ROW
      else -> WidgetKind.COMPACT
    }

    /**
     * How many songs of the queue fit under the large layout's controls.
     *
     * Rounded down, because a row cut in half by the bottom edge looks broken
     * where a gap at the foot does not. Never none: a widget that is large at
     * all has room for one.
     */
    fun rowsFor(kind: WidgetKind, heightDp: Float): Int =
      if (kind != WidgetKind.LARGE) 0
      else ((heightDp - LARGE_CHROME_DP) / ROW_DP).toInt().coerceIn(1, MOST_ROWS)

    fun of(widthDp: Float, heightDp: Float, leastHeightDp: Float = heightDp): WidgetShape {
      val kind = kindFor(heightDp, leastHeightDp)
      return WidgetShape(widthDp, heightDp, kind, rowsFor(kind, heightDp))
    }

    /**
     * What to draw for the sizes a launcher says the widget is shown at.
     *
     * One shape where every size draws the same views, which is nearly always:
     * a launcher reports the widget once upright and once on its side, and
     * both are a card or both are the large one. That one is drawn as a single
     * set of views and not a map of them, because only a single set can be
     * partially updated: Android merges a partial update into the top of a
     * RemoteViews and never into the sizes inside it, so a map would leave the
     * progress bar where it was drawn. The tallest size is the one kept,
     * since that is the widget upright, which is how a phone's home screen is
     * nearly always seen.
     *
     * Several shapes, one for each size, only where they really differ — a
     * widget that is two rows upright and squashed to one on its side.
     */
    fun plan(sizes: List<Pair<Float, Float>>): List<WidgetShape> {
      val known = sizes.filter { (w, h) -> w > 0f && h > 0f }
      if (known.isEmpty()) return emptyList()
      val least = known.minOf { it.second }
      val shapes = known.map { (w, h) -> of(w, h, least) }
      val first = shapes.first()
      if (shapes.all { it.drawsLike(first) }) return listOf(shapes.maxBy { it.heightDp })
      // Android refuses a map of more than sixteen, and one size twice.
      return shapes.distinctBy { it.widthDp to it.heightDp }.take(16)
    }

    /**
     * Where in the queue the next [limit] songs are, in the order they will
     * play.
     *
     * Straight on from [current], and round to the start again when the whole
     * queue repeats; never the current song, and never one twice. Repeating a
     * single song is not counted as that song coming next: what is listed is
     * what next and the end of the song lead to once repeat is off, which is
     * also how Media3 answers for its own next button.
     *
     * The player's own shuffle mode is not looked at. The app holds it off for
     * good, shuffling by rearranging the queue instead, so the order of the
     * items is the order they play in.
     */
    fun nextIndices(count: Int, current: Int, repeatAll: Boolean, limit: Int): List<Int> {
      if (count <= 0 || limit <= 0 || current !in 0 until count) return emptyList()
      val out = ArrayList<Int>(minOf(limit, count))
      var index = current
      while (out.size < limit) {
        index += 1
        if (index >= count) {
          if (!repeatAll) break
          index = 0
        }
        if (index == current) break
        out.add(index)
      }
      return out
    }

    /**
     * The repeat mode a press of the widget's repeat button moves to.
     *
     * Off, all, one and back to off: the order the player's own button goes
     * round in, so the two buttons agree about what a press does. The numbers
     * are Media3's: off 0, one 1, all 2.
     */
    fun repeatAfter(mode: Int): Int = when (mode) {
      REPEAT_OFF -> REPEAT_ALL
      REPEAT_ALL -> REPEAT_ONE
      else -> REPEAT_OFF
    }

    const val REPEAT_OFF = 0
    const val REPEAT_ONE = 1
    const val REPEAT_ALL = 2
  }
}
