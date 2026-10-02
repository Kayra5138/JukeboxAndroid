package expo.modules.jukeboxaudio.game

import expo.modules.jukeboxaudio.effects.Wav
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

/**
 * The chart, laid over the song it was made from, so it can be judged by ear.
 *
 * Whether an onset detector is any good is not a thing that can be read off a
 * number. A chart with the right count of notes in the wrong places scores as
 * well as a perfect one on every measure except the only one that matters,
 * which is whether tapping along to it feels like playing the song. So the
 * notes are turned back into clicks, mixed over the music, and listened to: if
 * the clicks are on the beat, the chart is right, and no amount of argument
 * establishes that as quickly as four bars of it does.
 *
 *     ./gradlew :jukebox-audio:testDebugUnitTest --tests '*ChartRender*' \
 *       -PrenderIn=/path/to/passage.wav -PrenderOut=/path/to/listen
 */
class ChartRender {
  @Test
  fun `render a chart as clicks over the song`() {
    val source = System.getProperty("jukebox.render.in").orEmpty()
    assumeTrue("no -PrenderIn given, nothing to chart", source.isNotBlank())
    val input = File(source)
    assumeTrue("${input.path} does not exist", input.isFile)

    val out = File(
      System.getProperty("jukebox.render.out").takeIf { !it.isNullOrBlank() }
        ?: "build/chart-renders"
    )

    val audio = Wav.read(input)
    val song = audio.mono()
    val rate = audio.rate
    val seconds = song.size.toDouble() / rate

    for (level in Difficulty.ALL) {
      val found = Onsets.find(song, rate, level.density)
      val notes = found.notes
      val name = level.name.lowercase()
      Wav.write(File(out, "chart-$name.wav"), Wav.Audio(rate, 1, mix(song, notes, rate)))

      val lanes = IntArray(Chart.LANES)
      notes.forEach { lanes[it.lane]++ }
      val holds = notes.count { it.holdMs > 0 }
      // Whether the notes actually landed on a grid, asked of the notes
      // themselves rather than re-derived from the audio -- a click track
      // measured back is a measurement of the click, not of the chart.
      if (notes.size > 2) {
        val gaps = notes.zipWithNext { a, b -> b.atMs - a.atMs }.filter { it > 0 }
        val step = gaps.minOrNull() ?: 0
        val offGrid = if (step > 0) notes.count { it.atMs % step != 0 } else -1
        println("    grid: step ${found.stepMs} ms, smallest gap ${step} ms, ${offGrid} off the grid")
      }
      println(
        "  ${level.name}: ${notes.size} notes (${holds} held), " +
          "${"%.1f".format(notes.size / seconds)}/s, lanes ${lanes.joinToString("/")}, " +
          "${level.onScreenMs} ms to react, ±${level.windowMs} ms to land"
      )
    }

    println("\ncharts in ${out.absolutePath}")
  }

  /**
   * The song with a click on every note.
   *
   * Pitched by lane, so that a note landing in the wrong lane is heard as well
   * as a note landing at the wrong moment — one click track answers both
   * questions where an unpitched one answers only the first.
   */
  private fun mix(song: FloatArray, notes: List<Chart.Note>, rate: Int): FloatArray {
    val out = song.copyOf()
    // Quietened, because the clicks are the thing being judged and they have to
    // sit clearly on top of it.
    for (index in out.indices) out[index] *= 0.45f

    val lanePitch = doubleArrayOf(440.0, 660.0, 880.0, 1_320.0)

    for (note in notes) {
      val at = (note.atMs.toLong() * rate / 1000).toInt()
      val hz = lanePitch[note.lane.coerceIn(0, lanePitch.size - 1)]

      // A tap is a click; a held note is the same pitch sustained for as long
      // as it is meant to be kept down, so that a hold in the wrong place is
      // heard as plainly as a tap in the wrong place.
      val tap = note.holdMs <= 0
      val length = if (tap) rate / 20 else (note.holdMs.toLong() * rate / 1000).toInt()

      for (offset in 0 until length) {
        val index = at + offset
        if (index >= out.size) break
        val through = offset.toDouble() / length
        val shape = if (tap) exp(-through * 12.0) else {
          // Edges taken off, so the start of a hold is still heard as a start
          // and its end does not click.
          val edge = (rate * 0.02).coerceAtMost(length / 3.0)
          minOf(1.0, offset / edge, (length - offset) / edge) * 0.55
        }
        val click = sin(2.0 * PI * hz * offset / rate) * shape * 0.5
        out[index] = (out[index] + click).toFloat().coerceIn(-1f, 1f)
      }
    }
    return out
  }
}
