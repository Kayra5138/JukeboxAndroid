package expo.modules.jukeboxaudio.transitions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Forty-four thousand and one hundred of them a second, as usual. */
private const val RATE = 44_100

class FadeGainProviderTest {
  private val fader = FadeGainProvider()

  private fun gainAt(samplePosition: Long): Float =
    fader.getGainFactorAtSamplePosition(samplePosition, RATE)

  private fun samples(milliseconds: Long): Long = milliseconds * RATE / 1000

  @Test
  fun `leaves the audio alone with nothing asked of it`() {
    assertEquals(1f, gainAt(0), 0f)
    assertEquals(1f, gainAt(samples(60_000)), 0f)
  }

  @Test
  fun `counts a fade from wherever it is asked for`() {
    val armedAt = samples(150_000)
    fader.fadeIn(2_000, equalPower = true)

    assertEquals(0f, gainAt(armedAt), 0.001f)
    assertTrue(gainAt(armedAt + samples(1_000)) > 0.5f)
    assertEquals(1f, gainAt(armedAt + samples(2_000)), 0.001f)
    assertEquals(1f, gainAt(armedAt + samples(90_000)), 0f)
  }

  @Test
  fun `keeps playing when the sink rebases the stream position`() {
    /*
      Changing the speed or the pitch reconfigures the processing chain, and
      the sink flushes that chain with a stream position of zero — so the
      positions handed to a fader armed part-way through a track suddenly fall
      to the start. Anchored where it was, the fade would be asked for its gain
      at a position minutes before its own origin, and answer silence for the
      rest of the track. The fade restarts from the new origin instead.
    */
    fader.fadeIn(2_000, equalPower = true)
    gainAt(samples(150_000))

    assertEquals(0f, gainAt(0), 0.001f)
    assertEquals(1f, gainAt(samples(2_000)), 0.001f)
    assertEquals(1f, gainAt(samples(30_000)), 0f)
  }

  @Test
  fun `does not hand a rebased stream full volume mid fade-out`() {
    // The same fall, the other way up: an outgoing track that jumped back to
    // full would be heard over the one replacing it.
    fader.fadeOut(2_000, equalPower = true)
    gainAt(samples(150_000))

    assertEquals(1f, gainAt(0), 0.001f)
    assertTrue(gainAt(samples(1_000)) < 0.8f)
    assertEquals(0f, gainAt(samples(2_000)), 0.001f)
  }

  @Test
  fun `opens a fade-out at full volume rather than a silent sample`() {
    // The duration has to round up to a sample to divide by, but a lead-in of
    // none must not: that would clip the head off every plain fade-out.
    fader.fadeOut(2_000, equalPower = true)
    assertEquals(1f, gainAt(0), 0.001f)
  }

  @Test
  fun `ramps in over a lead-in when one is asked for`() {
    fader.fadeOut(2_000, equalPower = true, leadInMs = 20)
    assertEquals(0f, gainAt(0), 0.001f)
    assertTrue(gainAt(samples(10)) > 0.5f)
    assertEquals(1f, gainAt(samples(20)), 0.001f)
  }

  @Test
  fun `a fade asked for later replaces the one running`() {
    fader.fadeOut(2_000, equalPower = true)
    gainAt(0)
    assertTrue(gainAt(samples(1_000)) < 0.8f)

    fader.fadeIn(2_000, equalPower = true)
    assertEquals(0f, gainAt(samples(1_000)), 0.001f)
    assertEquals(1f, gainAt(samples(3_000)), 0.001f)
  }

  @Test
  fun `clearing restores full volume from silence`() {
    fader.fadeOut(1_000, equalPower = true)
    gainAt(0)
    assertEquals(0f, gainAt(samples(5_000)), 0.001f)

    fader.clear()
    assertEquals(1f, gainAt(samples(5_000)), 0f)
  }

  @Test
  fun `never reports an idle stretch that would stall the processor`() {
    /*
      GainProcessor copies whatever stretch this names and then asks again,
      looping until the buffer is drained. A stretch ending where it began
      would copy nothing and ask forever, and the end of the source would drop
      the processor from the chain for good, taking every later fade with it.
    */
    for (position in listOf(0L, samples(1_000), samples(600_000))) {
      assertTrue(fader.isUnityUntil(position, RATE) > position)
    }

    fader.fadeIn(2_000, equalPower = true)
    for (position in listOf(0L, samples(1_000), samples(600_000))) {
      assertTrue(fader.isUnityUntil(position, RATE) > position)
    }
  }

  @Test
  fun `stops asking per frame once a fade-in has run its course`() {
    /*
      Nothing clears a plan when it finishes, so a track that faded in keeps an
      IN plan to the end. A frame at a time there is a call per frame on the
      audio thread for the rest of the track, which is what gives way when
      something costly — a speed or a pitch change — joins the chain.
    */
    fader.fadeIn(2_000, equalPower = true)
    gainAt(0)

    val duringFade = samples(1_000)
    assertEquals(duringFade + 1, fader.isUnityUntil(duringFade, RATE))

    val afterFade = samples(120_000)
    assertTrue(fader.isUnityUntil(afterFade, RATE) > afterFade + RATE / 100)
  }
}
