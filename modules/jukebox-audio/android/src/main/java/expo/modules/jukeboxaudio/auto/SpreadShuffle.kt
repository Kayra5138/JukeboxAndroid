package expo.modules.jukeboxaudio.auto

import java.text.Normalizer
import kotlin.random.Random

/**
 * The app's shuffle, for the car and the widget: each artist's songs dealt
 * out evenly round the whole length, so that one artist does not come up
 * twice running, rather than a plain draw. The same as `spreadShuffle` in
 * `src/lib/media/shuffle.ts`, where why it is done this way is told at
 * length; kept the same, so that the shuffle button does the same wherever it
 * is pressed.
 */
internal object SpreadShuffle {
  /** How far a song may wander from its share of the circle, as a part of the gap between one of its artist's songs and the next. */
  private const val WANDER = 0.4

  /** Below this there is nothing to spread. */
  private const val WORTH_SPREADING = 3

  fun <T> shuffled(items: List<T>, random: Random = Random.Default, keyOf: (T) -> String): List<T> {
    if (items.size < WORTH_SPREADING) return items.shuffled(random)
    val dealt = ArrayList<Pair<Double, T>>(items.size)
    for (group in items.groupBy(keyOf).values) {
      val order = group.shuffled(random)
      val gap = 1.0 / order.size
      val start = random.nextDouble() * gap
      order.forEachIndexed { index, item ->
        val at = start + index * gap + (random.nextDouble() - 0.5) * gap * WANDER
        dealt += (((at % 1.0) + 1.0) % 1.0) to item
      }
    }
    dealt.sortBy { it.first }
    // Begun anywhere round the circle, which keeps the spacing and makes every song as likely to come first.
    val from = random.nextInt(dealt.size)
    return (dealt.subList(from, dealt.size) + dealt.subList(0, from)).map { it.second }
  }

  /**
   * One artist, whatever the case, the accents and the punctuation, as
   * `artistKey` has it: whoever the song is filed under, the first name in
   * its credit, and not the credit as written. `Sertab Erener feat. Ozan`
   * and `Sertab Erener & Demir` were artists of their own to the spread, and
   * came back to back with `Sertab Erener` nearly as often as in a plain draw.
   */
  fun artistKey(artist: String?): String =
    Normalizer.normalize(firstArtist(artist), Normalizer.Form.NFD)
      .replace(Regex("\\p{M}+"), "")
      .lowercase()
      .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
      .trim()

  /** The first name in a credit, parted where `splitCredit` in `src/lib/metadata/credit.ts` parts one. */
  internal fun firstArtist(credit: String?): String {
    var first = (credit ?: "").trim().split(FEATURING).first()
    first = first.split(HARD).first()
    // Somebody's backing band is part of their name.
    if (!AND_THE.containsMatchIn(first)) first = first.split(SOFT).first()
    return first.trim()
  }

  private val FEATURING = Regex("""\s*[(\[]?\s*\b(?:featuring|feat|ft)\b\.?\s+""", RegexOption.IGNORE_CASE)
  private val HARD = Regex("""\s*[;,]\s*|\s+/\s+""")
  private val SOFT = Regex("""\s+&\s+|\s+x\s+|\s+vs\.?\s+""")
  private val AND_THE = Regex("""\s+(?:&|and|\+)\s+the\s+""", RegexOption.IGNORE_CASE)
}
