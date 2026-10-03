package expo.modules.jukeboxaudio.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.sin

private const val RATE = 44_100

class SpectrumTest {
  @Test
  fun `a tone shows up at its own frequency and nowhere else`() {
    val size = 1024
    // Chosen to sit exactly on a bin, so there is nothing to smear and a peak
    // anywhere else is a mistake rather than a leak.
    val bin = 64
    val hz = bin.toDouble() * RATE / size
    val tone = FloatArray(size) { sin(2.0 * PI * hz * it / RATE).toFloat() }

    val magnitudes = Spectrum.magnitudes(tone)
    val loudest = magnitudes.indices.maxByOrNull { magnitudes[it] }
    assertEquals(bin, loudest)

    val peak = magnitudes[bin]
    val elsewhere = magnitudes.filterIndexed { index, _ -> index !in (bin - 1)..(bin + 1) }.max()
    assertTrue("energy leaked elsewhere: $elsewhere against $peak", elsewhere < peak / 50f)
  }

  @Test
  fun `silence has no spectrum`() {
    assertTrue(Spectrum.magnitudes(FloatArray(256)).all { it < 1e-6f })
  }

  @Test
  fun `a window that is not a power of two is refused rather than mangled`() {
    val thrown = runCatching { Spectrum.magnitudes(FloatArray(1000)) }.exceptionOrNull()
    assertTrue("expected a refusal, got $thrown", thrown is IllegalArgumentException)
  }

  @Test
  fun `the window tapers to nothing at both ends`() {
    val window = Spectrum.hann(64)
    assertTrue(window.first() < 1e-6f)
    assertTrue(window.last() < 1e-6f)
    assertTrue("the middle should be open: ${window[32]}", window[32] > 0.99f)
  }
}

class OnsetsTest {
  /** Silence with a burst every [everyMs], which is a chart with a known answer. */
  private fun beats(everyMs: Int, count: Int, hz: Double = 440.0): FloatArray {
    val out = FloatArray(RATE * (everyMs * count + 500) / 1000)
    for (beat in 0 until count) {
      val at = RATE * (250 + beat * everyMs) / 1000
      val length = RATE / 20
      for (offset in 0 until length) {
        val index = at + offset
        if (index >= out.size) break
        val fade = 1.0 - offset.toDouble() / length
        out[index] = (sin(2.0 * PI * hz * offset / RATE) * fade * fade).toFloat()
      }
    }
    return out
  }

  @Test
  fun `the hits are found where they were put`() {
    val notes = Onsets.find(beats(everyMs = 500, count = 6), RATE).notes
    assertEquals(6, notes.size)
    notes.forEachIndexed { index, note ->
      val wanted = 250 + index * 500
      // Within one window of where it was put. Closer than that is not
      // meaningful: a window is how much sound has to be looked at to see a
      // change at all.
      assertTrue("beat $index landed at ${note.atMs}, wanted $wanted", Math.abs(note.atMs - wanted) < 40)
    }
  }

  @Test
  fun `silence has nothing to play`() {
    assertTrue(Onsets.find(FloatArray(RATE * 2), RATE).notes.isEmpty())
  }

  @Test
  fun `a passage too short to look at is refused quietly`() {
    assertTrue(Onsets.find(FloatArray(64), RATE).notes.isEmpty())
  }

  @Test
  fun `two hits closer than a hand can move become one`() {
    // 30 ms apart: real in the recording, unplayable as two tiles.
    val notes = Onsets.find(beats(everyMs = 30, count = 8), RATE).notes
    notes.zipWithNext().forEach { (first, second) ->
      assertTrue("${first.atMs} and ${second.atMs} are too close", second.atMs - first.atMs >= 90)
    }
  }

  @Test
  fun `asking for fewer keeps the loudest and leaves them in order`() {
    val loud = beats(everyMs = 400, count = 10)
    val all = Onsets.find(loud, RATE).notes
    val half = Onsets.find(loud, RATE, strength = 0.5f).notes

    assertTrue("thinning kept ${half.size} of ${all.size}", half.size < all.size)
    assertEquals(half.sortedBy { it.atMs }, half)
  }

  @Test
  fun `the notes land on a grid rather than wherever they fell`() {
    /*
      A tile that may begin at any moment is a tile that may overlap the last
      one, and a player cannot aim at a key half hidden behind another. Laid on
      the song's own grid they are rows, and rows cannot collide.

      Beats put deliberately slightly off a round number -- 480 ms is 125 beats
      a minute, which no clock in this code knows in advance -- so that finding
      the grid is a real piece of work rather than a constant being read back.
    */
    val spacing = 480
    val notes = Onsets.find(beats(everyMs = spacing, count = 16), RATE).notes
    assertTrue("too few notes to say anything: ${notes.size}", notes.size >= 8)

    /*
      The grid is finer than the gaps between notes -- it is laid at half the
      beat and most of its lines stay empty, because a grid is somewhere for
      notes to land rather than a metronome to be filled in. So the thing to
      check is not that the gaps are equal but that every time shares a common
      divisor: that is what "on a grid" means, and the first version of this
      test asserted the gaps instead and failed against correct output.
    */
    fun gcd(a: Int, b: Int): Int = if (b == 0) a else gcd(b, a % b)
    val step = notes.map { it.atMs }.filter { it > 0 }.reduce(::gcd)

    assertTrue("the only grid they share is $step ms, which is no grid", step >= 100)
    assertEquals(0, notes.count { it.atMs % step != 0 })
  }

  @Test
  fun `a song with no pulse is still playable`() {
    // Hits at wildly uneven spacings have no grid to find. The notes have to
    // survive that rather than being quantised onto an imagined one or thrown
    // away for not fitting it.
    val out = FloatArray(RATE * 4)
    var at = RATE / 4
    var gap = RATE / 3
    while (at < out.size - RATE / 10) {
      for (offset in 0 until RATE / 20) {
        val fade = 1.0 - offset.toDouble() / (RATE / 20)
        out[at + offset] = (sin(2.0 * PI * 440.0 * offset / RATE) * fade * fade).toFloat()
      }
      at += gap
      gap = (gap * 1.37).toInt()
    }
    assertTrue("an uneven song lost all its notes", Onsets.find(out, RATE).notes.isNotEmpty())
  }

  @Test
  fun `a high sound and a low one do not land in the same lane`() {
    val low = Onsets.find(beats(everyMs = 500, count = 4, hz = 80.0), RATE).notes
    val high = Onsets.find(beats(everyMs = 500, count = 4, hz = 6_000.0), RATE).notes
    assertTrue("nothing found to compare", low.isNotEmpty() && high.isNotEmpty())
    assertTrue(
      "both went to lane ${low.first().lane}",
      low.first().lane != high.first().lane
    )
  }

  @Test
  fun `a pause in the song is found, and nothing heard in it is played`() {
    /*
      Four seconds of music, four of very nearly nothing, four of music again.

      The music is a held tone with strikes over it rather than strikes alone,
      because a song is never silent between its beats, and a test made of
      clicks in nothing would be a song that is nine tenths pause. The middle is
      not clean either: it has faint ticks in it, sixty decibels down, which is
      what a pause sounds like on a real record and what a detector comparing
      each moment with its own surroundings takes for a hit.
    */
    val out = FloatArray(RATE * 12)
    fun paused(index: Int) = index >= RATE * 4 && index < RATE * 8
    for (index in out.indices) {
      if (!paused(index)) out[index] = (0.2 * sin(2.0 * PI * 220.0 * index / RATE)).toFloat()
    }
    fun strike(atMs: Int, level: Double, length: Int) {
      val at = RATE * atMs / 1000
      for (offset in 0 until length) {
        val fade = 1.0 - offset.toDouble() / length
        out[at + offset] += (level * sin(2.0 * PI * 440.0 * offset / RATE) * fade * fade).toFloat()
      }
    }
    for (atMs in 250 until 12_000 step 400) if (!paused(RATE * atMs / 1000)) strike(atMs, 1.0, RATE / 20)
    for (atMs in listOf(4_300, 4_900, 5_600, 6_400, 7_100)) strike(atMs, 0.001, RATE / 200)

    val found = Onsets.find(out, RATE)
    assertEquals("pauses found: ${found.quiet}", 1, found.quiet.size)
    val pause = found.quiet.single()
    // Within a window or so of where the sound actually stops and starts. The
    // chart is written in its own time, so the question is asked of the
    // recording: where do the two ends of the pause fall in the sound?
    val startsAt = found.songMs(pause.startMs)
    val endsAt = found.songMs(pause.endMs)
    assertTrue("the pause starts at $startsAt", startsAt in 3_950..4_100)
    assertTrue("the pause ends at $endsAt", endsAt in 7_900..8_050)

    /*
      Nothing inside it. Measured a little in from each edge: putting the notes
      on the song's grid can move one by up to a quarter of a beat, and the
      first strike after a pause landing a moment early is the board's to deal
      with, not a tick that should have been thrown away.
    */
    val inside = found.notes.filter { it.atMs >= pause.startMs + 200 && it.atMs < pause.endMs - 200 }
    assertTrue("played in the pause: $inside", inside.isEmpty())
    assertTrue("the music after it was lost", found.notes.any { it.atMs >= pause.endMs })
  }

  @Test
  fun `a silent file is one pause from end to end`() {
    assertEquals(listOf(Chart.Span(0, 2_000)), Onsets.find(FloatArray(RATE * 2), RATE).quiet)
  }
}

class PausesTest {
  /*
    Ten milliseconds a frame, so a song can be written down in milliseconds and
    the answer read back in them without a conversion in between.
  */
  private val hop = 441
  private val rate = 44_100

  /** A song as passages of so many milliseconds at so loud, one figure a frame. */
  private fun song(vararg passages: Pair<Int, Float>): FloatArray {
    val out = mutableListOf<Float>()
    for ((ms, level) in passages) repeat(ms / 10) { out += level }
    return out.toFloatArray()
  }

  /** So far below a level of one, in decibels. */
  private fun down(db: Double) = Math.pow(10.0, -db / 20.0).toFloat()

  private fun pauses(loudness: FloatArray, endMs: Int = loudness.size * 10) =
    Pauses.find(loudness, hop, rate, endMs)

  @Test
  fun `a gap in the middle is found where it is`() {
    val found = pauses(song(5_000 to 1f, 3_000 to down(60.0), 5_000 to 1f))
    assertEquals(listOf(Chart.Span(5_000, 8_000)), found)
  }

  @Test
  fun `a silent intro is a pause from the very start`() {
    assertEquals(listOf(Chart.Span(0, 2_000)), pauses(song(2_000 to down(50.0), 10_000 to 1f)))
  }

  @Test
  fun `a silent ending runs to the end of the recording, not the last frame`() {
    // The last frame begins a window before the last sample. A pause that
    // stopped there would leave a sliver of song at the end looking like music.
    val found = pauses(song(10_000 to 1f, 3_000 to down(50.0)), endMs = 13_023)
    assertEquals(listOf(Chart.Span(10_000, 13_023)), found)
  }

  @Test
  fun `a breath is not a pause`() {
    // Under a second and a half, however deep: the board keeps going through it.
    val breaths = song(
      5_000 to 1f, 1_000 to 0f, 5_000 to 1f, 1_490 to 0f, 5_000 to 1f, 300 to 0f, 5_000 to 1f
    )
    assertEquals(emptyList<Chart.Span>(), pauses(breaths))
  }

  @Test
  fun `a second and a half exactly is long enough`() {
    assertEquals(
      listOf(Chart.Span(5_000, 6_500)),
      pauses(song(5_000 to 1f, 1_500 to 0f, 5_000 to 1f))
    )
  }

  @Test
  fun `a song that never stops has no pauses`() {
    // Loud and soft in turn, the soft never more than twenty-five down.
    val busy = FloatArray(6_000) { if (it % 7 < 3) 1f else down(25.0) }
    assertEquals(emptyList<Chart.Span>(), pauses(busy))
  }

  @Test
  fun `a file of silence is one pause`() {
    // Every frame nought, so the usual level is nought too, and nothing is
    // more than nothing below it -- unless nought counts as at the threshold.
    assertEquals(listOf(Chart.Span(0, 10_000)), pauses(FloatArray(1_000)))
  }

  @Test
  fun `frames of exact nought are silence, not a fault`() {
    // Digital silence, which on a logarithmic scale is minus infinity.
    val found = pauses(song(2_000 to 0f, 4_000 to 1f, 2_000 to 0f, 4_000 to 1f))
    assertEquals(listOf(Chart.Span(0, 2_000), Chart.Span(6_000, 8_000)), found)
  }

  @Test
  fun `a soft passage is still music`() {
    // Twenty decibels down is a quiet verse, not a pause.
    val soft = song(10_000 to 1f, 5_000 to down(20.0), 10_000 to 1f)
    assertEquals(emptyList<Chart.Span>(), pauses(soft))
    // Thirty-five down is not.
    val gone = song(10_000 to 1f, 5_000 to down(35.0), 10_000 to 1f)
    assertEquals(listOf(Chart.Span(10_000, 15_000)), pauses(gone))
  }

  @Test
  fun `one loud moment does not make the rest of the song silence`() {
    /*
      Two seconds forty decibels over everything else -- a crash, a clipped
      master, a chorus mixed far too hot. Measured against that, the soft
      passage would be sixty down and taken for a pause; measured against what
      the song usually does, it is twenty down and played.
    */
    val spike = song(20_000 to 1f, 2_000 to 100f, 3_000 to down(20.0), 20_000 to 1f)
    assertEquals(emptyList<Chart.Span>(), pauses(spike))
  }

  @Test
  fun `a quiet song is judged against itself`() {
    // The same song mastered forty decibels quieter has the same pauses in it.
    val loud = song(5_000 to 1f, 3_000 to down(60.0), 5_000 to 1f)
    val quiet = FloatArray(loud.size) { loud[it] * down(40.0) }
    assertEquals(pauses(loud), pauses(quiet))
    assertEquals(1, pauses(quiet).size)
  }

  @Test
  fun `a song shorter than a pause has none, and nothing has none`() {
    assertEquals(emptyList<Chart.Span>(), pauses(song(1_000 to 0f)))
    assertEquals(emptyList<Chart.Span>(), pauses(FloatArray(0)))
  }
}

class LevelsTest {
  private val hop = 256
  private val rate = 22_050

  /** [seconds] of frames at [level], as the analysis would hand them over. */
  private fun frames(seconds: Double, level: Float) =
    FloatArray((seconds * rate / hop).toInt()) { level }

  @Test
  fun `a steady song sits at its usual level throughout`() {
    val levels = Levels.of(frames(4.0, 3f), hop, rate)
    assertTrue("nothing came back", levels.isNotEmpty())
    for (level in levels) assertEquals(Levels.USUAL, level)
  }

  @Test
  fun `a passage at half the level reads as half`() {
    val song = frames(4.0, 2f) + frames(1.0, 1f) + frames(4.0, 2f)
    val levels = Levels.of(song, hop, rate)
    // The middle of the soft second, well clear of the slots that straddle
    // its edges and so hold a mixture of the two.
    val middle = levels[(4_500 / Levels.EVERY_MS)]
    assertEquals(Levels.USUAL / 2, middle)
    assertEquals(Levels.USUAL, levels[(2_000 / Levels.EVERY_MS)])
  }

  @Test
  fun `the curve is as long as the song and no longer`() {
    val levels = Levels.of(frames(10.0, 1f), hop, rate)
    val covered = levels.size * Levels.EVERY_MS
    assertTrue("covers $covered ms of a 10 s song", covered in 9_950..10_050)
  }

  @Test
  fun `it is the same curve however loud the mastering`() {
    val shape = FloatArray(800) { if (it % 100 < 20) 0.3f else 1f }
    val quiet = Levels.of(shape, hop, rate)
    val loud = Levels.of(FloatArray(shape.size) { shape[it] * 40f }, hop, rate)
    assertEquals(quiet.size, loud.size)
    // To within a point. The figures are whole percentages, and a value that
    // sits on the half is rounded one way at one gain and the other at forty
    // times it -- the arithmetic differs in its last bit, the curve does not.
    for (index in quiet.indices) {
      assertTrue(
        "slot $index: ${quiet[index]} against ${loud[index]}",
        Math.abs(quiet[index] - loud[index]) <= 1
      )
    }
  }

  @Test
  fun `one clipped moment cannot dwarf everything else`() {
    val song = frames(5.0, 1f)
    song[100] = 10_000f
    val levels = Levels.of(song, hop, rate)
    assertTrue("a spike came through as ${levels.max()}", levels.max() <= 1_000)
    // And did not drag the usual level up with it.
    assertEquals(Levels.USUAL, levels[levels.size / 2])
  }

  @Test
  fun `silence and nothing have no curve at all`() {
    assertEquals(emptyList<Int>(), Levels.of(FloatArray(500), hop, rate))
    assertEquals(emptyList<Int>(), Levels.of(FloatArray(0), hop, rate))
  }

  @Test
  fun `the analysis hands the curve on with the notes`() {
    // A tone with a soft stretch in the middle of it: quieter, but far from
    // the thirty decibels that would make it a pause.
    val rate = RATE
    val samples = FloatArray(rate * 9) { index ->
      val soft = index in rate * 4 until rate * 5
      (if (soft) 0.25f else 0.8f) * sin(2.0 * PI * 440.0 * index / rate).toFloat()
    }
    val found = Onsets.find(samples, rate)
    assertTrue("no curve", found.levels.isNotEmpty())
    assertEquals(emptyList<Chart.Span>(), found.quiet)
    val loud = found.levels[found.gridMs(2_000) / found.levelMs]
    val soft = found.levels[found.gridMs(4_500) / found.levelMs]
    assertTrue("soft $soft against loud $loud", soft < loud * 0.5 && soft > loud * 0.15)
  }
}
