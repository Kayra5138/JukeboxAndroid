package expo.modules.jukeboxaudio.spectrum

import android.os.SystemClock
import androidx.media3.common.C
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * How loud the music is at each pitch, for the player to draw as it is heard.
 *
 * Fed by the audio renderer ([expo.modules.jukeboxaudio.loudness.NamingAudioRenderer])
 * with what the decoder hands it, each piece with the time it is to be heard
 * at, and told by the same renderer where playback has got to: so what is drawn
 * is what is coming out of the speaker now, however far ahead the decoding is,
 * however long the way out to the speaker or the headphones is, and at whatever
 * speed. No recording permission is asked for, as Android's own Visualizer
 * would: nothing is listened to but our own samples.
 *
 * Nothing is done unless something is watching ([Spectrum.watch]): with the
 * player closed, the screen off or nothing playing, the samples are not even
 * looked at.
 */
class SpectrumAnalyzer {
  private val lock = Any()

  // The decoder's output, as the renderer last said it was.
  private var rate = 44100
  private var channels = 2
  private var encoding = C.ENCODING_PCM_16BIT

  // The last [SIZE] samples, folded to one channel, as a ring, and how many have come in since the last look.
  private val ring = FloatArray(SIZE)
  private var at = 0
  private var sinceLook = 0
  private var filled = 0
  private var lastFed = C.TIME_UNSET

  private val real = FloatArray(SIZE)
  private val imaginary = FloatArray(SIZE)
  private val bands = FloatArray(BANDS)

  // What was found, a frame for each look, by the time it is heard at; [count] of them, the newest at [newest].
  private val times = LongArray(KEPT)
  private val frames = Array(KEPT) { FloatArray(BANDS) }
  private val waves = Array(KEPT) { FloatArray(WAVE) }
  private val levels = FloatArray(KEPT)
  private val wave = FloatArray(WAVE)

  private var newest = -1
  private var count = 0

  // Where playback was when the renderer last said, and when that was.
  @Volatile private var positionUs = C.TIME_UNSET
  @Volatile private var saidAtUs = 0L
  @Volatile private var speed = 1f
  @Volatile private var started = false

  fun format(sampleRate: Int, channelCount: Int, pcmEncoding: Int) {
    synchronized(lock) {
      rate = max(1, sampleRate)
      channels = max(1, channelCount)
      encoding = pcmEncoding
    }
  }

  /** What is to be heard from [presentationUs] on, as the decoder gave it: read and left where it was. */
  fun feed(buffer: ByteBuffer, presentationUs: Long) {
    if (!Spectrum.watched() || presentationUs == lastFed) return
    lastFed = presentationUs
    val bytesPerSample = when (encoding) {
      C.ENCODING_PCM_16BIT -> 2
      C.ENCODING_PCM_FLOAT, C.ENCODING_PCM_32BIT -> 4
      C.ENCODING_PCM_24BIT -> 3
      C.ENCODING_PCM_8BIT -> 1
      else -> return
    }
    val data = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
    val frameBytes = bytesPerSample * channels
    /*
      As many looks a second whatever the file's rate: [HOP] is in samples,
      and counted as such a file at 96 or 192 kHz was looked at two or four
      times as often as one at 44.1, for nothing anybody could see.
    */
    val hop = max(HOP, (HOP.toLong() * rate / BASE_RATE).toInt())
    val frameCount = (data.limit() - data.position()) / frameBytes
    var place = data.position()
    for (frame in 0 until frameCount) {
      var sum = 0f
      for (channel in 0 until channels) {
        sum += sampleAt(data, place, bytesPerSample)
        place += bytesPerSample
      }
      ring[at] = sum / channels
      at = (at + 1) and RING
      if (filled < SIZE) filled++
      sinceLook++
      if (sinceLook >= hop && filled == SIZE) {
        sinceLook = 0
        // Heard at the middle of what was looked at.
        val heardUs = presentationUs + ((frame + 1 - SIZE / 2) * 1_000_000L) / rate
        look(heardUs)
      }
    }
  }

  private fun sampleAt(data: ByteBuffer, place: Int, bytes: Int): Float = when (bytes) {
    2 -> data.getShort(place) / 32768f
    1 -> ((data.get(place).toInt() and 0xff) - 128) / 128f
    3 -> {
      val low = data.get(place).toInt() and 0xff
      val middle = data.get(place + 1).toInt() and 0xff
      val high = data.get(place + 2).toInt()
      ((high shl 16) or (middle shl 8) or low) / 8388608f
    }
    else -> if (encoding == C.ENCODING_PCM_FLOAT) data.getFloat(place) else data.getInt(place) / 2147483648f
  }

  private fun look(heardUs: Long) {
    val level = shapeOf(wave)
    for (i in 0 until SIZE) {
      real[i] = ring[(at + i) and RING] * WINDOW[i]
      imaginary[i] = 0f
    }
    fft(real, imaginary)
    bandsOf(real, imaginary, rate, bands)
    synchronized(lock) {
      newest = (newest + 1) % KEPT
      times[newest] = heardUs
      bands.copyInto(frames[newest])
      wave.copyInto(waves[newest])
      levels[newest] = level
      count = min(KEPT, count + 1)
    }
  }

  /**
   * The middle of what is being looked at, into [into], as a line to draw:
   * from where it goes up through nought, so that one look's line lies where
   * the last one's did and a steady note stands still. And how loud it is,
   * nought for quieter than music gets and one for as loud.
   */
  private fun shapeOf(into: FloatArray): Float {
    val middle = SIZE / 2
    var from = middle - WAVE_SPAN
    for (i in middle - WAVE_SPAN until middle - 1) {
      if (ring[(at + i) and RING] <= 0f && ring[(at + i + 1) and RING] > 0f) {
        from = i + 1
        break
      }
    }
    for (point in 0 until WAVE) into[point] = ring[(at + from + point * WAVE_STEP) and RING]
    var power = 0.0
    for (i in middle - LEVEL_SPAN / 2 until middle + LEVEL_SPAN / 2) {
      val sample = ring[(at + i) and RING]
      power += sample * sample
    }
    val decibels = 10 * log10(max(power / LEVEL_SPAN, 1e-12))
    return ((decibels.toFloat() - QUIET_DB) / (LOUD_DB - QUIET_DB)).coerceIn(0f, 1f)
  }

  /** Where playback is, from the renderer, as it works it out for the player. */
  fun clock(position: Long, playing: Boolean, playbackSpeed: Float) {
    positionUs = position
    saidAtUs = SystemClock.elapsedRealtimeNanos() / 1000
    started = playing
    speed = playbackSpeed
  }

  fun playing(on: Boolean) {
    started = on
  }

  /** Forgotten, as after a seek: what was found is no longer what will be heard. */
  fun reset() {
    synchronized(lock) {
      count = 0
      newest = -1
      filled = 0
      sinceLook = 0
      at = 0
    }
    lastFed = C.TIME_UNSET
  }

  /**
   * What is being heard now into [out], largest of each band and of the
   * loudness with what is there already, and the line of it where there is
   * none yet; false when nothing is known for now, playing or not.
   */
  fun heardNow(out: Heard): Boolean {
    val position = positionUs
    if (!started || position == C.TIME_UNSET) return false
    /*
      On from where the renderer last said, at the speed it plays: it says a
      hundred times a second. And on again by as long as a frame drawn now
      takes to reach the screen, so that what is seen is what is heard when
      it is seen, not when it was drawn.
    */
    val nowUs = SystemClock.elapsedRealtimeNanos() / 1000
    val heardUs = position + ((min(nowUs - saidAtUs, MOST_AHEAD_US) + TO_SCREEN_US) * speed).toLong()
    synchronized(lock) {
      if (count == 0) return false
      // The newest look heard by then, and the one after it, if there is one yet.
      var place = newest
      var later = -1
      for (step in 0 until count) {
        if (times[place] <= heardUs) {
          if (heardUs - times[place] > STALE_US) return false
          // Between the two, as far as the time is between them.
          val share = if (later < 0) 0f else ((heardUs - times[place]).toFloat() / (times[later] - times[place])).coerceIn(0f, 1f)
          val next = if (later < 0) place else later
          val frame = frames[place]
          val then = frames[next]
          for (band in 0 until BANDS) out.bands[band] = max(out.bands[band], frame[band] + (then[band] - frame[band]) * share)
          val level = levels[place] + (levels[next] - levels[place]) * share
          val nearest = if (share < 0.5f) place else next
          if (level >= out.level) waves[nearest].copyInto(out.wave)
          out.level = max(out.level, level)
          return true
        }
        later = place
        place = (place - 1 + KEPT) % KEPT
      }
    }
    return false
  }

  companion object {
    /** How many samples are looked at at a time: about a twentieth of a second. */
    const val SIZE = 2048
    /** A place in the ring brought round within it, as `% SIZE` would but with no division: [SIZE] is a power of two, as [fft] needs. */
    private const val RING = SIZE - 1
    /** How many come in between looks: about eighty-six looks a second, more than are drawn, at [BASE_RATE]; as many more as a file's rate is higher. */
    const val HOP = 512
    private const val BASE_RATE = 44100
    /** How many pitches are drawn. */
    const val BANDS = 40
    /** How many points the line of the sound is drawn through, and how many samples apart: some nine thousandths of a second of it. */
    const val WAVE = 128
    private const val WAVE_STEP = 3
    /** How far before the middle a rise through nought is looked for, to start the line at. */
    private const val WAVE_SPAN = 256
    /** How many samples about the middle the loudness of the sound as a whole is taken over. */
    private const val LEVEL_SPAN = 1024
    /** How loud is nothing, and how loud is all, of the sound as a whole. */
    private const val QUIET_DB = -42f
    private const val LOUD_DB = -8f
    /** How many looks are kept: some four and a half seconds, more than is ever decoded ahead. */
    private const val KEPT = 384
    /** How far past what the renderer last said the clock is carried on. */
    private const val MOST_AHEAD_US = 200_000L
    /** How long a frame drawn takes to be on the screen: to the next one or two refreshes of it, at sixty a second. */
    private const val TO_SCREEN_US = 40_000L
    /** A look older than this is not what is being heard: nothing is, for now. */
    private const val STALE_US = 150_000L

    /** The lowest and highest pitches drawn, and how quiet is nothing. */
    private const val LOWEST_HZ = 40.0
    private const val HIGHEST_HZ = 16_000.0
    private const val FLOOR_DB = -56f
    private const val RANGE_DB = 54f
    /** How much each octave up is lifted, in decibels. */
    private const val LIFT_DB = 1.5f

    private val WINDOW = FloatArray(SIZE) { (0.5 - 0.5 * cos(2 * PI * it / (SIZE - 1))).toFloat() }
    private val COS = FloatArray(SIZE / 2) { cos(-2 * PI * it / SIZE).toFloat() }
    private val SIN = FloatArray(SIZE / 2) { sin(-2 * PI * it / SIZE).toFloat() }
    private val REVERSED = IntArray(SIZE).also { table ->
      val bits = Integer.numberOfTrailingZeros(SIZE)
      for (i in 0 until SIZE) table[i] = Integer.reverse(i) ushr (32 - bits)
    }

    /** The edges of the bands, as a share of the way up the pitches: evenly by octave. */
    private val EDGES = DoubleArray(BANDS + 1) { LOWEST_HZ * (HIGHEST_HZ / LOWEST_HZ).pow(it.toDouble() / BANDS) }

    /** In place, [SIZE] long: the frequencies of what was there. */
    fun fft(real: FloatArray, imaginary: FloatArray) {
      for (i in 0 until SIZE) {
        val j = REVERSED[i]
        if (j > i) {
          val r = real[i]; real[i] = real[j]; real[j] = r
          val m = imaginary[i]; imaginary[i] = imaginary[j]; imaginary[j] = m
        }
      }
      var length = 2
      while (length <= SIZE) {
        val half = length / 2
        val step = SIZE / length
        var start = 0
        while (start < SIZE) {
          for (k in 0 until half) {
            val c = COS[k * step]
            val s = SIN[k * step]
            val a = start + k
            val b = a + half
            val tr = real[b] * c - imaginary[b] * s
            val ti = real[b] * s + imaginary[b] * c
            real[b] = real[a] - tr
            imaginary[b] = imaginary[a] - ti
            real[a] += tr
            imaginary[a] += ti
          }
          start += length
        }
        length *= 2
      }
    }

    /**
     * Each band's loudness, nought for silence and one for as loud as music
     * gets, from the frequencies [fft] found in samples at [rate]. The loudest
     * frequency in a band is its loudness; the higher bands, where music has
     * less in it, are lifted a little, so that cymbals show as well as drums.
     */
    fun bandsOf(real: FloatArray, imaginary: FloatArray, rate: Int, out: FloatArray) {
      val binHz = rate.toDouble() / SIZE
      // A full sine through the window comes out a quarter of the size across.
      val full = SIZE / 4f
      for (band in 0 until BANDS) {
        val from = max(1, (EDGES[band] / binHz).toInt())
        val to = max(from, min(SIZE / 2 - 1, (EDGES[band + 1] / binHz).toInt()))
        var loudest = 0f
        for (bin in from..to) {
          val power = real[bin] * real[bin] + imaginary[bin] * imaginary[bin]
          if (power > loudest) loudest = power
        }
        val decibels = 10f * log10(max(loudest, 1e-12f) / (full * full))
        // A decibel and a half an octave up, from the bottom.
        val lift = LIFT_DB * (band.toFloat() / BANDS) * log2(HIGHEST_HZ / LOWEST_HZ).toFloat()
        out[band] = ((decibels + lift - FLOOR_DB) / RANGE_DB).coerceIn(0f, 1f)
      }
    }

    private fun log2(x: Double) = kotlin.math.ln(x) / kotlin.math.ln(2.0)
  }
}

/**
 * The analyzers of every player there is -- two in a crossfade -- and whether
 * anything is drawing them. What is drawn is the louder of them in each band.
 */
object Spectrum {
  private val watchers = AtomicInteger(0)
  private val analyzers = CopyOnWriteArrayList<SpectrumAnalyzer>()

  fun watched(): Boolean = watchers.get() > 0

  fun watch() {
    watchers.incrementAndGet()
  }

  fun unwatch() {
    watchers.updateAndGet { max(0, it - 1) }
  }

  fun add(analyzer: SpectrumAnalyzer) {
    analyzers.addIfAbsent(analyzer)
  }

  fun remove(analyzer: SpectrumAnalyzer) {
    analyzers.remove(analyzer)
  }

  /** What is being heard now, into [out]; false when nothing is. */
  fun heardNow(out: Heard): Boolean {
    out.bands.fill(0f)
    out.wave.fill(0f)
    out.level = 0f
    var any = false
    for (analyzer in analyzers) if (analyzer.heardNow(out)) any = true
    return any
  }
}

/** What is heard at a moment: how loud at each pitch, the line of the sound, and how loud as a whole. */
class Heard {
  val bands = FloatArray(SpectrumAnalyzer.BANDS)
  val wave = FloatArray(SpectrumAnalyzer.WAVE)
  var level = 0f
}
