package expo.modules.jukeboxaudio.effects

import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Renders a passage through the voices, so they can be judged by ear.
 *
 * Not a test — nothing here asserts anything — but it lives with the tests
 * because that is the only place in this module where the pure DSP classes run
 * on a plain JVM, in a second, without a device.
 *
 * Every number in [Vocoder.Tuning] is a matter of taste, and taste cannot be
 * reasoned about: it has to be heard, next to the alternative, on real music.
 * Until this existed the only way to hear a change was to build the app,
 * install it over a wireless link and play something — minutes per variant,
 * which is why none of these numbers had ever actually been chosen.
 *
 * Skipped unless given something to render:
 *
 *     ./gradlew :jukebox-audio:testDebugUnitTest --tests '*VoiceRender*' \
 *       -PrenderIn=/path/to/passage.wav
 *
 * Make the passage with ffmpeg, which is the one dependency here:
 *
 *     ffmpeg -i song.mp3 -ss 30 -t 12 -ac 1 -ar 48000 -c:a pcm_s16le passage.wav
 *
 * Pick a passage with singing in it. A vocoder has nothing to say about an
 * instrumental break, and judging one on a drum fill is judging the wrong
 * thing.
 */
class VoiceRender {
  @Test
  fun `render the voices for listening`() {
    val source = System.getProperty("jukebox.render.in").orEmpty()
    assumeTrue("no -PrenderIn given, nothing to render", source.isNotBlank())

    val input = File(source)
    assumeTrue("${input.path} does not exist", input.isFile)

    val out = File(
      System.getProperty("jukebox.render.out").takeIf { !it.isNullOrBlank() }
        ?: "build/voice-renders"
    )
    val audio = Wav.read(input)
    val dry = audio.mono()
    val rate = audio.rate

    println("read ${input.name}: ${audio.frames} frames, $rate Hz, ${audio.channels} ch")
    Wav.write(File(out, "00-dry.wav"), Wav.Audio(rate, 1, dry))

    /*
      Every one of these is levelled to the same peak before it is written.
      Loudness is the strongest thing an ear judges on, and without this the
      quiet candidates lose to the loud ones before their character is heard —
      which is exactly what happened to the first batch.
    */
    for ((name, make) in candidates(rate)) {
      val wet = Candidates.normalise(make(dry))
      Wav.write(File(out, "$name.wav"), Wav.Audio(rate, 1, wet))
      println("  wrote $name.wav")
    }

    println("\nrenders in ${out.absolutePath}")
  }

  /**
   * The techniques worth choosing between, one file each.
   *
   * Ordered so that neighbours differ in one thing. The vocoder is kept at the
   * end at a mix where the record is still audible underneath it, which is the
   * only way it was ever going to be usable: at nine parts in ten there is
   * nothing of the song left to recognise.
   */
  private fun candidates(rate: Int): List<Pair<String, (FloatArray) -> FloatArray>> = listOf(
    // The crushed one was wanted for its character and rejected for its hiss.
    // The hiss is what the sample-and-hold folds down from above; taking the
    // top off afterwards leaves the character behind. Three amounts of it.
    "01-vintage-soft" to { it: FloatArray ->
      Candidates.lowpass(Candidates.crush(it, rate, 7, 16_000, 1f), rate, 5_500.0)
    },
    "02-vintage-medium" to { it: FloatArray ->
      Candidates.lowpass(Candidates.crush(it, rate, 6, 12_000, 1f), rate, 4_000.0)
    },
    "03-vintage-strong" to { it: FloatArray ->
      Candidates.lowpass(Candidates.crush(it, rate, 5, 9_000, 1f), rate, 3_000.0)
    },

    // The one that seemed to turn. A flanger, and how fast it turns is the
    // whole of its character, so: slow, medium and deep.
    "04-swirl-slow" to { it: FloatArray -> Candidates.comb(it, rate, 0.12, 6.0, 0.9f) },
    "05-swirl-medium" to { it: FloatArray -> Candidates.comb(it, rate, 0.35, 6.0, 0.9f) },
    "06-swirl-deep" to { it: FloatArray -> Candidates.comb(it, rate, 0.2, 12.0, 1f) },

    // Kept as they were, to judge the new ones against.
    "07-robot-ring-50" to { it: FloatArray -> Candidates.ringMod(it, rate, 50.0, 0.85f) },
    "08-robot-crushed-ring" to { it: FloatArray ->
      Candidates.ringMod(Candidates.crush(it, rate, 5, 11_000, 0.7f), rate, 60.0, 0.5f)
    },
    "09-chipmunk-7" to { it: FloatArray -> Candidates.pitchUp(it, rate, 7.0, 1f) },
    "10-chipmunk-12" to { it: FloatArray -> Candidates.pitchUp(it, rate, 12.0, 1f) }
  )
}
