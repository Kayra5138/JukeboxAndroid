package expo.modules.jukeboxaudio.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.sin

private const val RATE = 44_100

/** A short burst of noise at [atMs], which is what a drum is to an onset detector. */
private fun strike(out: FloatArray, atMs: Double, level: Float = 0.8f, seed: Int = 1) {
  val at = (atMs * RATE / 1000).toInt()
  val length = RATE / 25
  var state = seed * 7919 + at
  for (offset in 0 until length) {
    if (at + offset >= out.size) return
    state = state * 1103515245 + 12345
    val noise = ((state ushr 16) and 0x7fff) / 16384f - 1f
    out[at + offset] += level * noise * exp(-offset / (RATE * 0.012)).toFloat()
  }
}

/** A note of [hz] from [fromMs] for [forMs], with a few harmonics so it sounds like an instrument. */
private fun note(out: FloatArray, fromMs: Double, forMs: Double, hz: Double, level: Float = 0.25f) {
  val from = (fromMs * RATE / 1000).toInt()
  val length = (forMs * RATE / 1000).toInt()
  for (offset in 0 until length) {
    if (from + offset >= out.size) return
    val t = offset.toDouble() / RATE
    val edge = minOf(1.0, offset / 300.0, (length - offset) / 300.0)
    val sound = sin(2 * PI * hz * t) + 0.5 * sin(2 * PI * 2 * hz * t) + 0.25 * sin(2 * PI * 3 * hz * t)
    out[from + offset] += (level * edge * sound).toFloat()
  }
}

private fun flux(samples: FloatArray): FloatArray {
  val window = Spectrum.hann(1024)
  val frames = (samples.size - 1024) / 256
  var previous = FloatArray(512)
  return FloatArray(frames) { frame ->
    val now = Spectrum.magnitudes(FloatArray(1024) { samples[frame * 256 + it] * window[it] })
    var total = 0f
    for (bin in 0 until 512) if (now[bin] > previous[bin]) total += now[bin] - previous[bin]
    previous = now
    total
  }
}

private const val FRAME_MS = 256 * 1000.0 / RATE

class PulseTest {
  @Test
  fun `the step is found whatever moment the beat starts at`() {
    // A beat of 461.5 ms is 130 to the minute: not a multiple of anything
    // convenient, and here it does not begin with the file either.
    for (startsAt in listOf(0.0, 137.0, 300.0)) {
      val out = FloatArray(RATE * 40)
      var at = startsAt
      var count = 0
      while (at < 39_500) {
        strike(out, at, seed = count)
        // An off-beat now and then, the way a real rhythm has them.
        if (count % 3 == 1) strike(out, at + 461.5 / 2, 0.5f, seed = count)
        at += 461.5
        count++
      }
      val step = Pulse.step(Pulse.envelope(flux(out), FRAME_MS), FRAME_MS)
      assertTrue("a beat starting at $startsAt gave a step of $step", abs(step - 461.5 / 2) < 1.5)
    }
  }

  @Test
  fun `a step that nothing happens on is not taken for the step`() {
    // Long, short, short: hits at 0, 3 and 6 of every eight steps of 200 ms.
    // The pattern repeats every 600 ms twice and then breaks, which makes one
    // and a half steps look like a pulse to anything that only counts echoes.
    val out = FloatArray(RATE * 40)
    var bar = 0.0
    while (bar < 39_000) {
      for (step in listOf(0, 3, 6)) strike(out, bar + step * 200.0, seed = step)
      strike(out, bar + 4 * 200.0, 0.4f)
      bar += 1_600.0
    }
    val step = Pulse.step(Pulse.envelope(flux(out), FRAME_MS), FRAME_MS)
    assertTrue("the step came out as $step", abs(step - 200.0) < 1.5 || abs(step - 400.0) < 3.0)
  }

  @Test
  fun `the lines stay with a band that speeds up and slows down`() {
    // A drummer who drifts three parts in a hundred either way over a minute:
    // by the end a fixed grid would be most of a beat out.
    val out = FloatArray(RATE * 60)
    val hits = ArrayList<Double>()
    var at = 220.0
    var count = 0
    while (at < 59_000) {
      hits.add(at)
      strike(out, at, seed = count)
      at += 250.0 * (1.0 + 0.03 * sin(count / 25.0))
      count++
    }
    val envelope = Pulse.envelope(flux(out), FRAME_MS)
    val step = Pulse.step(envelope, FRAME_MS)
    val lines = Pulse.follow(envelope, FRAME_MS, step)

    // Measured from where its window starts, a hit reads half a window early.
    val early = 1024 * 500.0 / RATE
    var close = 0
    for (hit in hits) if (lines.any { abs(it + early - hit) <= 12.0 }) close++
    assertTrue("only $close of ${hits.size} hits have a line on them", close >= hits.size * 0.95)

    // And one line to a hit, not a line on everything: the count agrees.
    assertTrue("${lines.size} lines for ${hits.size} hits", abs(lines.size - hits.size) <= hits.size / 20)

    // Where a fixed grid would be by the end of it.
    val drift = abs((hits.last() - hits.first()) - 250.0 * (hits.size - 1))
    assertTrue("the test is not testing drift: $drift ms", drift > 100.0)
  }

  @Test
  fun `the lines are carried on to cover the whole recording`() {
    val lines = Pulse.covering(doubleArrayOf(730.0, 980.0, 1_235.0), 250.0, 2_000.0)
    assertTrue("starts at ${lines.first()}", lines.first() <= 0.0 && lines.first() > -250.0)
    assertTrue("ends at ${lines.last()}", lines.last() >= 2_000.0 && lines.last() < 2_250.0)
    // What was followed is kept exactly as it was.
    assertTrue(lines.toList().containsAll(listOf(730.0, 980.0, 1_235.0)))
    for (index in 1 until lines.size) assertTrue(lines[index] > lines[index - 1])
  }

  @Test
  fun `song time and grid time agree at every line and between them`() {
    val lines = doubleArrayOf(-100.0, 150.0, 420.0, 660.0, 930.0)
    val map = TimeMap(lines, 240)
    assertEquals(4, map.steps)
    for (index in lines.indices) assertEquals(index * 240.0, map.toGrid(lines[index]), 1e-9)
    // Half way between two lines is half a step, however far apart they are.
    assertEquals(1.5 * 240, map.toGrid((150.0 + 420.0) / 2), 1e-9)
    assertEquals(285.0, map.toSong(1, 0.5), 1e-9)
    assertEquals(2, map.nearestLine(430.0))
    assertEquals(1, map.nearestLine(280.0))
    // Grid time never runs backwards.
    var before = Double.NEGATIVE_INFINITY
    var at = -300.0
    while (at < 1_200.0) {
      val now = map.toGrid(at)
      assertTrue(now > before)
      before = now
      at += 13.0
    }
  }
}

class TuneTest {
  @Test
  fun `the tune is heard at the pitch it is played at`() {
    // Three notes, a second each, over a bass that is louder than any of them.
    val out = FloatArray(RATE * 3)
    note(out, 0.0, 3_000.0, 82.4, 0.5f)
    note(out, 0.0, 1_000.0, 329.63)
    note(out, 1_000.0, 1_000.0, 440.0)
    note(out, 2_000.0, 1_000.0, 261.63)

    val heard = Tune.hear(out, RATE)
    fun at(ms: Int) = heard.pitch[(ms / heard.frameMs).toInt()]
    assertEquals(64f, at(450), 0.6f)
    assertEquals(69f, at(1_450), 0.6f)
    assertEquals(60f, at(2_450), 0.6f)
  }

  @Test
  fun `it does not jump an octave for one loud frame`() {
    val out = FloatArray(RATE * 2)
    note(out, 0.0, 2_000.0, 392.0)
    // A crash across the whole spectrum half way through.
    strike(out, 1_000.0, 1.0f)
    val heard = Tune.hear(out, RATE)
    for (frame in 2 until heard.frames - 2) assertEquals("frame $frame", 67f, heard.pitch[frame], 0.6f)
  }

  @Test
  fun `the same chord is the same harmony whatever the octave`() {
    val low = FloatArray(RATE)
    val high = FloatArray(RATE)
    val other = FloatArray(RATE)
    for (hz in listOf(261.63, 329.63, 392.0)) {
      note(low, 0.0, 1_000.0, hz)
      note(high, 0.0, 1_000.0, hz * 2)
    }
    for (hz in listOf(293.66, 369.99, 440.0)) note(other, 0.0, 1_000.0, hz)

    fun harmony(samples: FloatArray): FloatArray {
      val heard = Tune.hear(samples, RATE)
      val row = heard.chroma[heard.frames / 2]
      val mean = row.average().toFloat()
      var length = 0f
      for (value in row) length += (value - mean) * (value - mean)
      return FloatArray(12) { (row[it] - mean) / kotlin.math.sqrt(length) }
    }
    fun alike(a: FloatArray, b: FloatArray): Float {
      var sum = 0f
      for (i in 0 until 12) sum += a[i] * b[i]
      return sum
    }
    val c = harmony(low)
    assertTrue("an octave up is ${alike(c, harmony(high))} alike", alike(c, harmony(high)) > 0.8f)
    assertTrue("another chord is ${alike(c, harmony(other))} alike", alike(c, harmony(other)) < 0.3f)
  }

  @Test
  fun `nothing is heard in a recording too short to listen to`() {
    assertEquals(0, Tune.hear(FloatArray(1_000), RATE).frames)
  }
}

class OnPulseTest {
  private val stepMs = 250.0

  /*
    A song of bars: eight steps each, a hit on every step, and a tune over
    them. `A` climbs, `B` falls and is another chord with another rhythm. The
    whole thing starts a little way into the file, as songs do.
  */
  private val climbing = doubleArrayOf(261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25)
  private val falling = doubleArrayOf(554.37, 466.16, 415.3, 369.99, 311.13, 277.18, 233.08, 207.65)

  private fun song(bars: String, startsAt: Double = 180.0): FloatArray {
    val out = FloatArray(((startsAt + bars.length * 8 * stepMs) * RATE / 1000).toInt() + RATE)
    for ((index, kind) in bars.withIndex()) {
      val from = startsAt + index * 8 * stepMs
      for (step in 0 until 8) {
        val at = from + step * stepMs
        if (kind == 'A') {
          strike(out, at, if (step % 4 == 0) 0.9f else 0.5f, seed = step)
          note(out, at, stepMs, climbing[step])
        } else {
          if (step % 2 == 0) strike(out, at, 0.9f, seed = step + 20)
          note(out, at, stepMs, falling[step])
        }
      }
    }
    return out
  }

  private fun barsOf(found: Onsets.Found): List<String> {
    val per = found.barSteps * Chart.SLOTS
    val from = found.barAt * Chart.SLOTS
    return (0 until (found.lanes.length - from) / per).map { found.lanes.substring(from + it * per, from + (it + 1) * per) }
  }

  @Test
  fun `the chart is laid on the song's own steps`() {
    val found = Onsets.find(song("AAAAAAAA"), RATE)
    assertTrue("a step of ${found.stepMs}", abs(found.stepMs - 250) <= 4)
    assertEquals("a slot is a whole number of milliseconds", 0, found.stepMs % Chart.SLOTS)
    assertEquals(found.stepMs / Chart.SLOTS, found.levelMs)

    val steps = found.lines.size - 1
    assertEquals(steps * Chart.SLOTS, found.lanes.length)
    assertEquals(steps * Chart.SLOTS, found.accents.length)
    assertEquals(steps * Chart.SLOTS, found.levels.size)
    for (index in 1 until found.lines.size) assertTrue(found.lines[index] > found.lines[index - 1])
    assertTrue(found.lines.first() <= 0)
    assertTrue(found.lines.last() >= 180 + 8 * 8 * 250)

    // Every hit that was played has a line on it, to within a hundredth of a second.
    for (hit in 0 until 64) {
      val at = 180 + hit * 250
      assertTrue("no line near the hit at $at", found.lines.any { abs(it - at) <= 10 })
    }
    for (note in found.notes) assertEquals(0, note.atMs % found.stepMs)
  }

  @Test
  fun `a tune that climbs is played from left to right`() {
    val found = Onsets.find(song("AAAAAAAA"), RATE)
    // A bar from the middle of the song, one lane for each of its steps.
    val bar = barsOf(found)[3]
    val steps = (0 until 8).map { bar[it * Chart.SLOTS + 1] - '0' }
    // The bar may be cut anywhere in the climb, so it is turned back to where
    // the climb begins: after the biggest fall.
    val turn = (1 until 8).maxByOrNull { steps[it - 1] - steps[it] } ?: 0
    val climb = steps.drop(turn) + steps.take(turn)
    for (index in 1 until 8) assertTrue("the lanes go $climb", climb[index] >= climb[index - 1])
    assertEquals("the lanes go $climb", 0, climb.first())
    assertEquals("the lanes go $climb", Chart.LANES - 1, climb.last())
  }

  @Test
  fun `bars that are the same music are the same keys, and other bars are not`() {
    val found = Onsets.find(song("AABAABAABAAB"), RATE)
    assertEquals(8, found.barSteps)
    val bars = barsOf(found)
    // Whole bars away from the two ends, where the cut may fall across the
    // silence before the song or after it.
    val kinds = (1 until bars.size - 1).groupBy { bars[it] }
    assertTrue("there are ${kinds.size} different bars: ${bars.joinToString(" ")}", kinds.size in 2..4)
    // The same bar comes back every three.
    for (index in 1 until bars.size - 4) assertEquals("bar $index", bars[index], bars[index + 3])
    assertTrue(bars[2] != bars[3] || bars[3] != bars[4])
  }

  @Test
  fun `the hardest hits are marked as the hardest`() {
    val found = Onsets.find(song("AAAAAAAA"), RATE)
    val digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    val strong = ArrayList<Int>()
    val weak = ArrayList<Int>()
    for (hit in 0 until 64) {
      val grid = found.gridMs(180 + hit * 250)
      val slot = Math.round(grid.toDouble() / found.levelMs).toInt().coerceIn(0, found.accents.length - 1)
      (if (hit % 4 == 0) strong else weak).add(digits.indexOf(found.accents[slot]))
    }
    assertTrue("strong ${strong.average()} against weak ${weak.average()}", strong.average() > weak.average() + 3)
  }

  @Test
  fun `a bar where the band drops back is marked as easing, each time it comes`() {
    // Every fourth bar is played at a fifth of the level: the band dropping
    // back at the end of a phrase.
    val out = song("AAAAAAAAAAAAAAAA")
    for (bar in listOf(3, 7, 11, 15)) {
      val from = ((180.0 + bar * 8 * stepMs) * RATE / 1000).toInt()
      val to = ((180.0 + (bar + 1) * 8 * stepMs) * RATE / 1000).toInt()
      for (index in from until to) out[index] *= 0.2f
    }
    val found = Onsets.find(out, RATE)
    val digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    // The level of a whole bar: one slot of it is a hit or the gap after one,
    // and neither says how loud the bar is.
    fun levelOf(bar: Int): Double {
      val from = found.gridMs(180 + bar * 2000 + 100) / found.levelMs
      val to = found.gridMs(180 + bar * 2000 + 1900) / found.levelMs
      return (from until to).map { digits.indexOf(found.ease[it.coerceIn(0, found.ease.length - 1)]) }.average()
    }
    // Twenty is the level of the surroundings; a fifth of that is four.
    for (bar in listOf(3, 7, 11)) {
      assertTrue("the soft bar $bar reads ${levelOf(bar)}", levelOf(bar) <= 8.0)
      assertTrue("the bar before it reads ${levelOf(bar - 1)}", levelOf(bar - 1) in 15.0..27.0)
    }
    assertEquals(found.lanes.length, found.ease.length)
  }

  @Test
  fun `a song with too little in it is handed back as it was heard`() {
    val out = FloatArray(RATE * 4)
    for (hit in 0 until 5) strike(out, 300.0 + hit * 700.0)
    val found = Onsets.find(out, RATE)
    assertEquals(0, found.stepMs)
    assertTrue(found.lines.isEmpty())
    assertEquals("", found.lanes)
    assertEquals(5, found.notes.size)
    assertEquals(1_234, found.songMs(1_234))
    assertEquals(1_234, found.gridMs(1_234))
  }
}
