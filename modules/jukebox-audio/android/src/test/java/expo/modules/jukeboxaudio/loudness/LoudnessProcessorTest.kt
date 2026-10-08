package expo.modules.jukeboxaudio.loudness

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

private const val RATE = 48_000

/** A stereo tone, peaking at [amplitude] of full scale. */
private fun tone(frames: Int, amplitude: Double = 0.25, from: Int = 0): ShortArray =
  ShortArray(frames * 2) {
    (amplitude * 32767 * sin(2.0 * PI * 440.0 * (from + it / 2) / RATE)).toInt().toShort()
  }

private fun bytes(samples: ShortArray): ByteBuffer =
  ByteBuffer.allocateDirect(samples.size * 2).order(ByteOrder.nativeOrder()).apply {
    asShortBuffer().put(samples)
  }

private fun shorts(buffer: ByteBuffer): ShortArray =
  ShortArray(buffer.remaining() / 2).also { buffer.order(ByteOrder.nativeOrder()).asShortBuffer().get(it) }

private fun peak(samples: ShortArray): Int = samples.maxOf { abs(it.toInt()) }

/** One player's processor, as the sink would set it up. */
private class Line(encoding: Int = C.ENCODING_PCM_16BIT, otherwise: String? = null) {
  val stream = PlayingStream(otherwise)
  val processor = LoudnessProcessor(stream).apply {
    configure(AudioProcessor.AudioFormat(RATE, 2, encoding))
    flush()
  }

  fun play(samples: ShortArray): ShortArray {
    processor.queueInput(bytes(samples))
    return shorts(processor.output)
  }
}

private fun levels(current: String?, vararg gains: Pair<String, Loudness.Applied>) =
  Loudness.publish(Loudness.Levels(current, mapOf(*gains)))

class GainRampTest {
  private fun run(ramp: GainRamp, samples: ShortArray): ShortArray {
    val out = ByteBuffer.allocate(samples.size * 2).order(ByteOrder.nativeOrder())
    ramp.apply16(bytes(samples), out, 2)
    out.flip()
    return shorts(out)
  }

  @Test
  fun `starts out doing nothing`() {
    assertTrue(GainRamp().idle)
  }

  @Test
  fun `arrives exactly, and after exactly as long as it was given`() {
    val ramp = GainRamp()
    ramp.head(0.5f, 480)
    val out = run(ramp, ShortArray(1_000 * 2) { 20_000 })

    // Never a step: from one sample to the next the level moves by a 480th
    // of the distance, which on a constant input is about twenty counts.
    for (frame in 1 until 1_000) {
      assertTrue("at $frame", abs(out[frame * 2] - out[(frame - 1) * 2]) <= 22)
    }
    assertTrue(out[0] < 20_000 && out[0] > 19_900)
    assertEquals(10_000, out[479 * 2].toInt())
    assertEquals(10_000, out[999 * 2].toInt())
  }

  @Test
  fun `being told where it is already going does not start it again`() {
    val ramp = GainRamp()
    ramp.head(0.5f, 1_000)
    run(ramp, ShortArray(600 * 2) { 20_000 })
    // Asked again every buffer, as the processor does.
    ramp.head(0.5f, 1_000)
    val out = run(ramp, ShortArray(400 * 2) { 20_000 })
    assertEquals(10_000, out.last().toInt())
  }

  @Test
  fun `both channels of a frame get the same gain`() {
    val ramp = GainRamp()
    ramp.head(0.25f, 100)
    val out = run(ramp, ShortArray(200) { 16_000 })
    for (frame in 0 until 100) assertEquals(out[frame * 2], out[frame * 2 + 1])
  }

  @Test
  fun `a sample pushed past full scale stops there instead of wrapping`() {
    val ramp = GainRamp()
    ramp.snap(2f)
    val out = run(ramp, shortArrayOf(30_000, -30_000, 100, -100))
    assertArrayEquals(shortArrayOf(32_767, -32_768, 200, -200), out)
  }

  @Test
  fun `float samples are scaled and not clipped`() {
    val ramp = GainRamp()
    ramp.snap(2f)
    val input = ByteBuffer.allocate(16).order(ByteOrder.nativeOrder())
    input.asFloatBuffer().put(floatArrayOf(0.9f, -0.9f, 0.1f, -0.1f))
    val out = ByteBuffer.allocate(16).order(ByteOrder.nativeOrder())
    ramp.applyFloat(input, out, 2)
    out.flip()
    val floats = FloatArray(4).also { out.asFloatBuffer().get(it) }
    assertArrayEquals(floatArrayOf(1.8f, -1.8f, 0.2f, -0.2f), floats, 1e-6f)
  }
}

class LoudnessProcessorTest {
  @After
  fun off() = Loudness.publish(null)

  @Test
  fun `switched off it hands the audio on untouched`() {
    val line = Line()
    line.stream.id = "a"
    val passage = tone(4_800)
    assertArrayEquals(passage, line.play(passage))
  }

  @Test
  fun `a track nothing is known about is untouched too`() {
    levels("a", "b" to Loudness.Applied(0.5f))
    val line = Line()
    line.stream.id = "a"
    val passage = tone(4_800)
    assertArrayEquals(passage, line.play(passage))
  }

  @Test
  fun `a track is at its level from its first sample`() {
    levels("a", "a" to Loudness.Applied(0.5f))
    val line = Line()
    line.stream.id = "a"
    val out = line.play(tone(4_800))
    val dry = tone(4_800)
    // No ramp at the head of a stream: there is nothing before it to click
    // against, and a fade-in would be a fade-in on every song.
    for (index in dry.indices) assertEquals(dry[index] / 2.0, out[index].toDouble(), 1.0)
  }

  @Test
  fun `two players are each at their own track's level at the same moment`() {
    // The overlap of a crossfade: the main player is on the incoming track
    // and the second one is playing out the track before it.
    levels("incoming", "incoming" to Loudness.Applied(0.5f), "outgoing" to Loudness.Applied(0.25f))
    val main = Line()
    main.stream.id = "incoming"
    val tail = Line(otherwise = "outgoing")

    val passage = tone(4_800, amplitude = 0.8)
    assertEquals(peak(passage) / 2.0, peak(main.play(passage)).toDouble(), 2.0)
    assertEquals(peak(passage) / 4.0, peak(tail.play(passage)).toDouble(), 2.0)
  }

  @Test
  fun `a stream that could not be named is taken to be what the player is on`() {
    levels("a", "a" to Loudness.Applied(0.5f))
    val line = Line()
    val passage = tone(4_800, amplitude = 0.8)
    assertEquals(peak(passage) / 2.0, peak(line.play(passage)).toDouble(), 2.0)
  }

  @Test
  fun `one track running into the next changes level on the join`() {
    levels("a", "a" to Loudness.Applied(0.5f), "b" to Loudness.Applied(0.25f))
    val line = Line()
    line.stream.id = "a"
    line.play(tone(4_800))

    // The renderer says the next buffer is the next track's; nothing is
    // flushed. The very first sample of it is already at the new level.
    line.stream.id = "b"
    val out = line.play(ShortArray(960 * 2) { 20_000 })
    assertEquals(5_000, out[0].toInt())
    assertEquals(5_000, out.last().toInt())
  }

  @Test
  fun `a change in the middle of a track is walked to, quickly`() {
    levels("a", "a" to Loudness.Applied(1f))
    val line = Line()
    line.stream.id = "a"
    line.play(ShortArray(960 * 2) { 20_000 })

    // The switch thrown, or tags read a moment after the first buffer.
    levels("a", "a" to Loudness.Applied(0.5f))
    val out = line.play(ShortArray(4_800 * 2) { 20_000 })

    for (frame in 1 until 4_800) {
      assertTrue("a step at $frame", abs(out[frame * 2] - out[(frame - 1) * 2]) <= 12)
    }
    // Twenty milliseconds is 960 frames at this rate.
    assertTrue(out[900 * 2] > 10_000)
    assertEquals(10_000, out[960 * 2].toInt())
  }

  @Test
  fun `a level that arrives late is eased in over seconds`() {
    levels("a", "a" to Loudness.Applied(1f))
    val line = Line()
    line.stream.id = "a"
    line.play(ShortArray(960 * 2) { 20_000 })

    levels("a", "a" to Loudness.Applied(0.5f, late = true))
    // In buffers, as it would arrive, a second and a half of them.
    var last = ShortArray(0)
    repeat(75) { last = line.play(ShortArray(960 * 2) { 20_000 }) }
    // Half way there after half the time.
    assertEquals(15_000.0, last.last().toDouble(), 50.0)

    repeat(75) { last = line.play(ShortArray(960 * 2) { 20_000 }) }
    assertEquals(10_000, last.last().toInt())
  }

  @Test
  fun `after a seek there is nothing to ramp from`() {
    levels("a", "a" to Loudness.Applied(1f))
    val line = Line()
    line.stream.id = "a"
    line.play(tone(960))

    levels("a", "a" to Loudness.Applied(0.5f))
    line.processor.flush()
    val out = line.play(ShortArray(960 * 2) { 20_000 })
    assertEquals(10_000, out[0].toInt())
  }

  @Test
  fun `switching it off lets go without a click`() {
    levels("a", "a" to Loudness.Applied(0.5f))
    val line = Line()
    line.stream.id = "a"
    line.play(ShortArray(960 * 2) { 20_000 })

    Loudness.publish(null)
    val out = line.play(ShortArray(1_920 * 2) { 20_000 })
    assertTrue(out[0] < 10_100)
    assertEquals(20_000, out.last().toInt())
  }

  @Test
  fun `float audio is levelled the same way`() {
    levels("a", "a" to Loudness.Applied(0.5f))
    val line = Line(encoding = C.ENCODING_PCM_FLOAT)
    line.stream.id = "a"

    val input = ByteBuffer.allocateDirect(16).order(ByteOrder.nativeOrder())
    input.asFloatBuffer().put(floatArrayOf(0.8f, -0.8f, 0.2f, -0.2f))
    line.processor.queueInput(input)
    val out = FloatArray(4).also { line.processor.output.order(ByteOrder.nativeOrder()).asFloatBuffer().get(it) }
    assertArrayEquals(floatArrayOf(0.4f, -0.4f, 0.1f, -0.1f), out, 1e-6f)
  }
}
