package expo.modules.jukeboxaudio

/**
 * A title the media store spoiled, put right from the file's own name.
 *
 * Android's scanner hands back a title in which every emoji has become a
 * run of question marks: `Justitia (Vocaloid) ???? ENGLISH COVER` for a file
 * named `Justitia (Vocaloid) 🍓 ENGLISH COVER … .mp3`. The file's name was
 * never spoiled, so the emoji are taken from it, in order, one for each run.
 *
 * Only where the two are plainly the same words: with the runs taken out of
 * the title and the emoji out of the name, their letters and digits must be
 * the same. A title that only happens to hold question marks ("Who??") is
 * left as it is, since a name of other words says nothing about it.
 */
object MangledTitle {
  private val RUN = Regex("\\?{2,}")
  /**
   * Runs long enough to be emoji the store could not read, one after another,
   * with the spaces around them; see `repairTag`.
   */
  private val SPOILED = Regex("\\s*\\?{3,}(?:\\s*\\?{3,})*\\s*")
  private val VIDEO_ID = Regex("\\s*\\[[A-Za-z0-9_-]{11}]\\s*$")

  fun repair(title: String?, fileName: String?): String? {
    if (title == null || fileName == null || !RUN.containsMatchIn(title)) return title
    val base = fileName.substringBeforeLast('.').replace(VIDEO_ID, "")
    val clusters = emojiIn(base)
    if (clusters.isEmpty()) return title
    if (letters(RUN.replace(title, "")) != letters(withoutEmoji(base))) return title
    val runs = RUN.findAll(title).count()
    if (runs != clusters.size) return base.trim()
    var next = 0
    return RUN.replace(title) { clusters[next++] }
  }

  /**
   * An artist, album or album artist the store spoiled the same way, put right
   * from the file's name where that can be done safely and stripped of its
   * runs where it cannot.
   *
   * The name holds such a tag far less often than the title, and only ever as
   * a part of it — `🎵Artist - Title` — so the title's test, that the two are
   * the same words, cannot be asked. Asked instead is whether the tag lies in
   * the name: its letters and digits, with each run standing for one emoji,
   * must be found among the name's, in a row, with an emoji exactly where each
   * run is. Only where that is found, and every place it is found agrees on
   * the emoji, are they put in. A run that lines up with an emoji at the very
   * spot it stood in the tag is hard to come by for any other reason.
   *
   * Otherwise the runs are taken out, with the spaces they leave: a tag that
   * says `Artist` is wrong by one emoji, while one that says `???? Artist` is
   * plainly broken on every screen. Only runs of three or more go. The store
   * leaves one mark for every byte of what it could not read, and no emoji is
   * fewer than three of those, while two marks are ordinary punctuation in a
   * name like `Why??`, which nothing here can tell from a spoiled one.
   *
   * Null where nothing is left once the runs are gone: a tag that was nothing
   * but an emoji says nothing anybody can read now.
   */
  fun repairTag(value: String?, fileName: String?): String? {
    if (value == null || !RUN.containsMatchIn(value)) return value
    paired(value, fileName)?.let { return it }
    if (!SPOILED.containsMatchIn(value)) return value
    // The spaces either side were one gap with the emoji in it, and stay one;
    // an emoji between two words with no space either side leaves none.
    return SPOILED.replace(value) { gap -> if (gap.value.any { it.isWhitespace() }) " " else "" }
      .trim()
      .ifEmpty { null }
  }

  /**
   * One letter or digit of a name, in small letters, or one emoji in it.
   * In a tag, an emoji is a run of marks, and stands for whichever emoji
   * the name has in its place.
   */
  private data class Mark(val text: String, val emoji: Boolean)

  /** [value] with its runs filled in from [fileName]'s emoji, or null where they cannot be. */
  private fun paired(value: String, fileName: String?): String? {
    if (fileName == null) return null
    val base = fileName.substringBeforeLast('.').replace(VIDEO_ID, "")
    val name = marksOf(base)
    val tag = marksOfTag(value)
    // A tag of nothing but runs would be found beside any emoji at all.
    if (tag.none { !it.emoji } || tag.size > name.size) return null
    val answers = mutableSetOf<List<String>>()
    for (start in 0..name.size - tag.size) {
      val emoji = mutableListOf<String>()
      val fits = tag.indices.all { at ->
        val want = tag[at]
        val have = name[start + at]
        when {
          want.emoji && have.emoji -> { emoji += have.text; true }
          !want.emoji && !have.emoji -> want.text == have.text
          else -> false
        }
      }
      if (fits) answers += emoji
    }
    val only = answers.singleOrNull() ?: return null
    var next = 0
    return RUN.replace(value) { only[next++] }
  }

  /** [text]'s letters, digits and emoji, in order; everything else between them is passed over. */
  private fun marksOf(text: String): List<Mark> {
    val marks = mutableListOf<Mark>()
    val cluster = StringBuilder()
    var at = 0
    while (at < text.length) {
      val point = text.codePointAt(at)
      if (emojiPart(point)) cluster.appendCodePoint(point)
      else {
        if (cluster.isNotEmpty()) {
          marks += Mark(cluster.toString(), emoji = true)
          cluster.clear()
        }
        if (Character.isLetterOrDigit(point)) marks += Mark(String(Character.toChars(point)).lowercase(), emoji = false)
      }
      at += Character.charCount(point)
    }
    if (cluster.isNotEmpty()) marks += Mark(cluster.toString(), emoji = true)
    return marks
  }

  /** The same of a tag, with each run of marks as one emoji. */
  private fun marksOfTag(value: String): List<Mark> {
    val marks = mutableListOf<Mark>()
    var from = 0
    for (run in RUN.findAll(value)) {
      marks += marksOf(value.substring(from, run.range.first))
      marks += Mark(run.value, emoji = true)
      from = run.range.last + 1
    }
    marks += marksOf(value.substring(from))
    return marks
  }

  /** Whether a code point belongs to an emoji: outside the basic plane, or one of the marks that join them. */
  private fun emojiPart(codePoint: Int): Boolean =
    codePoint > 0xFFFF || codePoint == 0x200D || codePoint == 0xFE0F || codePoint == 0x20E3

  /** The emoji in [text], each run of them together as one, as the store makes one run of marks of it. */
  private fun emojiIn(text: String): List<String> {
    val found = mutableListOf<String>()
    val current = StringBuilder()
    var at = 0
    while (at < text.length) {
      val point = text.codePointAt(at)
      if (emojiPart(point)) current.appendCodePoint(point)
      else if (current.isNotEmpty()) {
        found += current.toString()
        current.clear()
      }
      at += Character.charCount(point)
    }
    if (current.isNotEmpty()) found += current.toString()
    return found
  }

  private fun withoutEmoji(text: String): String {
    val out = StringBuilder()
    var at = 0
    while (at < text.length) {
      val point = text.codePointAt(at)
      if (!emojiPart(point)) out.appendCodePoint(point)
      at += Character.charCount(point)
    }
    return out.toString()
  }

  /** Letters and digits alone, in small letters: what two spellings of one title share. */
  private fun letters(text: String): String = text.filter { it.isLetterOrDigit() }.lowercase()
}
