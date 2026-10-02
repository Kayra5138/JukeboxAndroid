package expo.modules.jukeboxaudio.effects

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

private const val RATE = 48_000

/** How loud a run of samples is, which is most of what these tests ask. */
private fun level(samples: FloatArray): Float {
  var sum = 0.0
  for (value in samples) sum += value.toDouble() * value
  return Math.sqrt(sum / samples.size).toFloat()
}

/** A steady tone, long enough for a filter to have settled by the end of it. */
private fun tone(hz: Double, frames: Int = RATE / 4): FloatArray =
  FloatArray(frames) { sin(2.0 * PI * hz * it / RATE).toFloat() }

/**
 * How much of one frequency is in a run of samples.
 *
 * One bin of a discrete Fourier transform, worked out the slow way. There is no
 * FFT here and no need of one: these tests ask about two or three frequencies,
 * never about the whole spectrum.
 */
private fun energyAt(samples: FloatArray, hz: Double): Float {
  var real = 0.0
  var imaginary = 0.0
  for (index in samples.indices) {
    val angle = 2.0 * PI * hz * index / RATE
    real += samples[index] * cos(angle)
    imaginary += samples[index] * sin(angle)
  }
  return (hypot(real, imaginary) / samples.size).toFloat()
}

/**
 * A tone with noise on it, the same every time it is asked for.
 *
 * Something with content across the spectrum, because a pure sine cannot show
 * up a filter that is not there — and something repeatable, because a test that
 * fails one run in fifty is worse than no test.
 */
private fun passage(frames: Int = RATE / 4): FloatArray {
  val random = Random(20_260_930L)
  return FloatArray(frames) {
    (sin(2.0 * PI * 220.0 * it / RATE) * 0.6 + (random.nextDouble() - 0.5) * 0.4).toFloat()
  }
}

class SettingsTest {
  @Test
  fun `nothing set means nothing to do`() {
    assertTrue(Effects.Settings().idle)
  }

  @Test
  fun `any one effect is enough to stop it being idle`() {
    val on = listOf(
      Effects.Settings(width = 0f),
      Effects.Settings(balance = 0.5f),
      Effects.Settings(swap = true),
      Effects.Settings(crossfeed = 0.4f),
      Effects.Settings(rotate = 0.6f),
      Effects.Settings(preampDb = -3f),
      Effects.Settings(voice = Effects.ROBOT),
      Effects.Settings(voice = Effects.VINTAGE),
      Effects.Settings(voice = Effects.SWIRL),
      Effects.Settings(voice = Effects.CHIPMUNK)
    )
    on.forEach { assertFalse(it.toString(), it.idle) }
  }

  @Test
  fun `settings arriving from the app are held inside their limits`() {
    val wild = Effects.fromMap(
      mapOf(
        "preampDb" to 99,
        "width" to -4,
        "balance" to 12,
        "crossfeed" to 5,
        "rotate" to -1,
        "rotateSeconds" to 0.1,
        "voice" to Effects.SWIRL,
        "voiceMix" to 4
      )
    )
    assertEquals(6f, wild.preampDb, 0f)
    assertEquals(0f, wild.width, 0f)
    assertEquals(1f, wild.balance, 0f)
    assertEquals(1f, wild.crossfeed, 0f)
    assertEquals(0f, wild.rotate, 0f)
    assertEquals(2f, wild.rotateSeconds, 0f)
    assertEquals(1f, wild.voiceMix, 0f)
  }

  @Test
  fun `a voice nobody offers is no voice at all`() {
    // The name crosses from JavaScript as a bare string, so it is the one
    // field that can arrive as anything at all.
    assertEquals(Effects.OFF, Effects.fromMap(mapOf("voice" to "badger")).voice)
    assertEquals(Effects.OFF, Effects.fromMap(mapOf("voice" to 7)).voice)
    // Including the names the vocoder used, which this version does not have.
    assertEquals(Effects.OFF, Effects.fromMap(mapOf("voice" to "alien")).voice)
    assertEquals(Effects.OFF, Effects.fromMap(mapOf("voice" to "cat")).voice)
    assertEquals(Effects.SWIRL, Effects.fromMap(mapOf("voice" to Effects.SWIRL)).voice)
  }

  @Test
  fun `asking for a voice and nothing else gets the amount it was chosen at`() {
    assertEquals(0.85f, Effects.fromMap(mapOf("voice" to Effects.ROBOT)).voiceMix, 0.0001f)
    assertEquals(0.9f, Effects.fromMap(mapOf("voice" to Effects.SWIRL)).voiceMix, 0.0001f)
    assertEquals(1f, Effects.fromMap(mapOf("voice" to Effects.VINTAGE)).voiceMix, 0.0001f)
    assertEquals(1f, Effects.fromMap(mapOf("voice" to Effects.CHIPMUNK)).voiceMix, 0.0001f)
  }

  @Test
  fun `a voice survives being written down and read back`() {
    for (voice in Effects.VOICES) {
      val sent = Effects.Settings(voice = voice, voiceMix = 0.4f, crossfeed = 0.25f)
      val back = Effects.fromMap(Effects.asMap(sent))
      assertEquals(voice, back.voice)
      assertEquals(0.4f, back.voiceMix, 0.0001f)
      assertEquals(sent.crossfeed, back.crossfeed, 0.0001f)
    }
  }
}

/**
 * The four treatments, and the one thing about them that a listening test
 * cannot check: that they sound the same in a player, which hands them a
 * buffer at a time, as they did in the harness that rendered a whole passage.
 */
class VoiceChainTest {
  private val voices = listOf(
    "robot" to VoiceKind.ROBOT,
    "vintage" to VoiceKind.VINTAGE,
    "swirl" to VoiceKind.SWIRL,
    "chipmunk" to VoiceKind.CHIPMUNK
  )

  /**
   * The passage through a chain, handed to it in [chunks] pieces.
   *
   * [fresh] throws the chain away between pieces, which is the mistake this
   * whole file exists to catch, kept here so that the test for it can show it
   * really does change the answer.
   */
  private fun through(
    kind: Int,
    input: FloatArray,
    chunks: Int = 1,
    mix: Float = 1f,
    fresh: Boolean = false
  ): FloatArray {
    var chain = VoiceChain(RATE)
    val out = FloatArray(input.size)
    val size = ((input.size + chunks - 1) / chunks).coerceAtLeast(1)
    var from = 0
    while (from < input.size) {
      if (fresh) chain = VoiceChain(RATE)
      val to = minOf(from + size, input.size)
      for (index in from until to) out[index] = chain.step(kind, input[index], mix)
      from = to
    }
    return out
  }

  /**
   * What was actually listened to, computed over the whole passage at once.
   *
   * The harness in [Candidates] is the specification for these: it is what was
   * rendered, played and chosen between. Anything the player does differently
   * is a bug in the port, whatever it sounds like on its own.
   */
  private fun listened(kind: Int, input: FloatArray): FloatArray = when (kind) {
    VoiceKind.ROBOT ->
      Candidates.ringMod(input, RATE, VoiceChain.ROBOT_CARRIER_HZ, 1f)
    VoiceKind.VINTAGE -> Candidates.lowpass(
      Candidates.crush(input, RATE, VoiceChain.VINTAGE_BITS, VoiceChain.VINTAGE_HOLD_HZ, 1f),
      RATE,
      VoiceChain.VINTAGE_CUT_HZ
    )
    VoiceKind.SWIRL ->
      Candidates.comb(input, RATE, VoiceChain.SWIRL_SWEEP_HZ, VoiceChain.SWIRL_DEPTH_MS, 1f)
    else ->
      Candidates.pitchUp(input, RATE, VoiceChain.CHIPMUNK_SEMITONES, 1f)
  }

  @Test
  fun `what the player does is what was listened to`() {
    val input = passage()
    for ((name, kind) in voices) {
      assertArrayEquals(name, listened(kind, input), through(kind, input), 0f)
    }
  }

  /**
   * The test this was all written for.
   *
   * A player never hands a processor a whole song. It hands it a few tens of
   * milliseconds, then a few more, for as long as the track lasts. Everything a
   * voice remembers — a carrier's phase, a delay line, a filter's last output —
   * has to be exactly where it was left at the start of the next buffer, and
   * the only way to be sure of that is to check that cutting the passage up
   * changes nothing at all.
   */
  @Test
  fun `a buffer boundary is not heard`() {
    val input = passage()
    for ((name, kind) in voices) {
      val whole = listened(kind, input)
      for (chunks in listOf(2, 3, 17, 512)) {
        assertArrayEquals("$name in $chunks", whole, through(kind, input, chunks = chunks), 0f)
      }
    }
  }

  @Test
  fun `a chain rebuilt for each buffer is heard, which is why it is not rebuilt`() {
    // The negative of the test above: without it, the one above could be
    // passing because nothing in these voices has any memory to lose.
    val input = passage()
    for ((name, kind) in voices) {
      val whole = listened(kind, input)
      val restarted = through(kind, input, chunks = 8, fresh = true)
      var worst = 0f
      for (index in whole.indices) worst = maxOf(worst, abs(whole[index] - restarted[index]))
      assertTrue("$name forgot nothing when it was rebuilt", worst > 0.001f)
    }
  }

  @Test
  fun `silence in is silence out`() {
    val quiet = FloatArray(RATE / 2)
    for ((name, kind) in voices) {
      val out = through(kind, quiet)
      assertTrue("$name made something out of nothing", out.all { abs(it) < 1e-6f })
    }
  }

  @Test
  fun `nothing runs away`() {
    // Full scale in, for as long as a phrase, with a delay line feeding itself
    // in two of the four. If any of that builds rather than settles it is
    // heard as the sound tearing.
    val loud = FloatArray(RATE) { if ((it / 64) % 2 == 0) 1f else -1f }
    for ((name, kind) in voices) {
      val out = through(kind, loud)
      val worst = out.maxOf { abs(it) }
      assertTrue("$name ran away to $worst", worst < 4f)
      assertTrue("$name produced something that is not a number", out.all { it.isFinite() })
    }
  }

  @Test
  fun `each voice changes the sound, and none of them is another`() {
    val input = passage()
    val results = voices.map { (name, kind) -> name to through(kind, input) }
    for ((name, out) in results) {
      var apart = 0.0
      for (index in input.indices) {
        apart += (out[index] - input[index]).toDouble() * (out[index] - input[index])
      }
      assertTrue("$name left the record alone", Math.sqrt(apart / input.size) > 0.05)
    }
    for (first in results.indices) {
      for (second in first + 1 until results.size) {
        val a = results[first]
        val b = results[second]
        assertFalse("${a.first} is ${b.first}", a.second.contentEquals(b.second))
      }
    }
  }

  @Test
  fun `none of it is heard at a mix of nothing`() {
    // What the bottom of the slider has to mean, exactly rather than nearly:
    // a voice that leaked at nought would be a voice that could not be
    // turned off without leaving the screen.
    val input = passage()
    for ((name, kind) in voices) {
      assertArrayEquals(name, input, through(kind, input, mix = 0f), 0f)
    }
  }

  @Test
  fun `the robot moves every partial off its own frequency`() {
    // Ring modulation replaces a tone with a pair either side of it, so the
    // note that went in is the one frequency that should not come out.
    val out = through(VoiceKind.ROBOT, tone(1_000.0))
    val settled = out.copyOfRange(out.size / 2, out.size)
    val own = energyAt(settled, 1_000.0)
    val below = energyAt(settled, 1_000.0 - VoiceChain.ROBOT_CARRIER_HZ)
    val above = energyAt(settled, 1_000.0 + VoiceChain.ROBOT_CARRIER_HZ)
    assertTrue("the note itself survived at $own", own < 0.02f)
    assertTrue("nothing appeared below: $below", below > 0.2f)
    assertTrue("nothing appeared above: $above", above > 0.2f)
  }

  @Test
  fun `the vintage one takes the top off, which is the point of it`() {
    /*
      The crush on its own was rejected: holding a sample for several periods
      folds everything above half the hold rate back down into the band as
      frequencies that were never in the record, and it is heard as hiss on top
      of the music. The roll-off after it is what made it usable, so a version
      of this that quietly lost the roll-off would be the rejected one back
      again.
    */
    /*
      Asked of the spectrum rather than of the overall level, because the two
      are not the same thing here and reading the level answers a different
      question than it appears to. A tone above half the hold rate does not go
      quiet — it comes back somewhere else, folded down by exactly the hold
      rate. At one setting of the constants it lands on nothing and the level
      falls; at another it lands in the passband and the level does not move at
      all, while the roll-off is working perfectly. Only the energy still
      standing at the original frequency says whether the top was taken off.
    */
    val lowIn = through(VoiceKind.VINTAGE, tone(500.0))
      .let { it.copyOfRange(it.size / 2, it.size) }
    val highIn = through(VoiceKind.VINTAGE, tone(12_000.0))
      .let { it.copyOfRange(it.size / 2, it.size) }

    val low = energyAt(lowIn, 500.0)
    val high = energyAt(highIn, 12_000.0)
    assertTrue("nothing came through at 500 Hz: $low", low > 0.05f)
    assertTrue("12 kHz still stood at $high against $low at 500", high < low / 10f)
  }

  @Test
  fun `the swirl moves, or it is only a filter`() {
    // A flanger whose sweep had stopped — a phase that reset on every buffer,
    // say — would still colour the sound, and would still pass every test
    // above. What makes it a swirl is that the colour changes.
    /*
      Measured across a whole turn of the sweep, taken from the sweep's own
      rate, rather than at two moments chosen in advance. Two fixed instants
      are two points on a circle: change how fast it goes round and they can
      land on the same place, and a sweep that is working reads as one that has
      stopped.
    */
    val turn = (RATE / VoiceChain.SWIRL_SWEEP_HZ).toInt()
    val out = through(VoiceKind.SWIRL, tone(1_500.0, turn * 2))
    val window = RATE / 8

    var quietest = Float.MAX_VALUE
    var loudest = 0f
    // Over the second turn, so the delay line is full and settled.
    var at = turn
    while (at + window <= out.size) {
      val here = level(out.copyOfRange(at, at + window))
      quietest = minOf(quietest, here)
      loudest = maxOf(loudest, here)
      at += window
    }
    assertTrue("the sweep stood still between $quietest and $loudest", loudest - quietest > 0.05f)
  }

  @Test
  fun `the chipmunk puts the note up a fifth`() {
    val out = through(VoiceKind.CHIPMUNK, tone(400.0, RATE))
    val settled = out.copyOfRange(out.size / 2, out.size)
    val was = energyAt(settled, 400.0)
    val now = energyAt(settled, 400.0 * Math.pow(2.0, VoiceChain.CHIPMUNK_SEMITONES / 12.0))
    assertTrue("the note did not move: $was at 400, $now at the fifth", now > was * 2f)
  }

  @Test
  fun `a chain that has been reset is a new chain`() {
    // What the processor does when the voice is changed, so that the last
    // treatment's sound is not left in the line to play out under the new one.
    val input = passage(RATE / 8)
    for ((name, kind) in voices) {
      val chain = VoiceChain(RATE)
      for (sample in input) chain.step(kind, sample, 1f)
      chain.reset()
      val after = FloatArray(input.size) { chain.step(kind, input[it], 1f) }
      assertArrayEquals(name, listened(kind, input), after, 0f)
    }
  }

  @Test
  fun `two chains stepped together stay together, which is what keeps the image`() {
    /*
      One chain per ear. They are only ever in step because everything that
      moves in them is driven by a count of samples, so the same count gives
      the same carrier, the same sweep and the same sample clock. If that ever
      stopped being true the two ears would be treated differently and the
      stereo image would wander.
    */
    val input = passage(RATE / 8)
    for ((name, kind) in voices) {
      val leftChain = VoiceChain(RATE)
      val rightChain = VoiceChain(RATE)
      val left = FloatArray(input.size)
      val right = FloatArray(input.size)
      for (index in input.indices) {
        left[index] = leftChain.step(kind, input[index], 1f)
        // The same sound through the other chain: same in, same out.
        right[index] = rightChain.step(kind, input[index], 1f)
      }
      assertArrayEquals(name, left, right, 0f)
    }
  }
}
