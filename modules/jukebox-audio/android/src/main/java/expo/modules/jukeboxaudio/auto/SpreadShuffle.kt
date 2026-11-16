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

  /** One artist, whatever the case, the accents and the punctuation, as `artistKey` has it. */
  fun artistKey(artist: String?): String =
    Normalizer.normalize(artist ?: "", Normalizer.Form.NFD)
      .replace(Regex("\\p{M}+"), "")
      .lowercase()
      .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
      .trim()
}
