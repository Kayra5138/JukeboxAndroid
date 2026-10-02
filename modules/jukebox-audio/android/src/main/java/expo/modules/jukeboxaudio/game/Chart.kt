package expo.modules.jukeboxaudio.game

/**
 * A song turned into something to play along to.
 *
 * Made once from the recording and kept, rather than worked out while the music
 * plays, for three reasons. The same song has to give the same chart every time
 * or a score means nothing. The analysis can take as long as it likes if it is
 * not competing with playback for the processor. And a chart that exists can be
 * made easier or harder without being worked out again.
 */
data class Chart(
  val version: Int,
  val durationMs: Long,
  /**
   * The spacing of the grid the notes were laid on, in milliseconds.
   *
   * The board is drawn from this: a row is one step, so a tile is exactly as
   * tall as the time between two lines and rows meet without a gap. Nought for
   * a song with no pulse to find, where the board falls back to a fixed size.
   */
  val stepMs: Int,
  val notes: List<Note>,
  /**
   * The pauses: stretches where the record has nothing in it to play along to.
   *
   * Kept beside the notes rather than worked out from the gaps between them,
   * because a gap in the notes is not the same thing as a gap in the music. A
   * held chord or a slow swell has no onsets for seconds and is still the song;
   * a silent intro has none either and is not. Only the recording can tell
   * those apart, so the recording is asked, once, while it is decoded anyway.
   */
  val quiet: List<Span> = emptyList(),
  /**
   * How loud the record is as it goes, one figure every [levelMs].
   *
   * As a percentage of the song's own usual level, so a hundred is the song
   * at its ordinary loudness whatever the mastering. The board reads this to
   * find the places where the music eases off -- not silence, which the pauses
   * above already cover, but the half-bar where the band drops back -- and
   * leaves a row empty there, so that playing a song is not one unbroken
   * column of keys from the first bar to the last.
   *
   * The curve rather than a list of dips, because what counts as a dip depends
   * on how long a row is, and that is decided by the difficulty and not by the
   * analysis.
   */
  val levelMs: Int = 0,
  val levels: List<Int> = emptyList()
) {
  /**
   * One tile: when it lands, which lane it falls in, and how long it is held.
   *
   * [holdMs] of nought is a tap. Anything longer is a note that has to be kept
   * down — what the recording is doing at that moment is not a strike but a
   * sound that carries, and a chart that turns a held chord into a single tap
   * throws away the part of the song that was easiest to feel.
   */
  data class Note(val atMs: Int, val lane: Int, val holdMs: Int = 0)

  /** A pause, from [startMs] up to but not including [endMs]. */
  data class Span(val startMs: Int, val endMs: Int) {
    operator fun contains(atMs: Int): Boolean = atMs >= startMs && atMs < endMs
  }

  companion object {
    /**
     * Bumped when the analysis changes in a way that would give a different
     * chart, so that old ones are made again rather than quietly kept.
     */
    const val VERSION = 9

    const val LANES = 4
  }
}

/**
 * How hard it is to play, which is not a property of the song.
 *
 * The chart holds everything found in the recording. What makes a game easy or
 * hard is not how much of that is shown but how much time there is to react to
 * it and how exactly a tap has to land — a beginner and an expert can play the
 * identical chart and should, because thinning it takes notes out of bars and
 * leaves something that no longer follows the music.
 *
 * [onScreenMs] is how long a tile is visible before it has to be hit, which is
 * the whole of what "speed" means here. [windowMs] is how far either side of
 * the moment still counts.
 */
data class Difficulty(
  val name: String,
  val onScreenMs: Int,
  val windowMs: Int,
  /** The share of the chart shown, for the one case thinning is kind: a first go. */
  val density: Float = 1f
) {
  companion object {
    val EASY = Difficulty("Easy", onScreenMs = 2_200, windowMs = 180, density = 0.5f)
    val NORMAL = Difficulty("Normal", onScreenMs = 1_600, windowMs = 120)
    val HARD = Difficulty("Hard", onScreenMs = 1_100, windowMs = 80)
    val EXPERT = Difficulty("Expert", onScreenMs = 800, windowMs = 55)

    val ALL = listOf(EASY, NORMAL, HARD, EXPERT)
  }
}

/**
 * Finding the hits in a recording.
 *
 * The method is the standard one: cut the sound into overlapping windows, look
 * at how much each window's spectrum has grown over the one before it, and call
 * the peaks of that growth the onsets. Growth rather than loudness, because a
 * note struck during a loud passage is a rise in the spectrum without being a
 * rise in the level — measuring loudness alone finds the chorus and not the
 * drums inside it.
 */
internal object Onsets {
  /**
   * 1024 samples at 44.1 kHz is 23 ms of sound, and a hop of a quarter of that
   * puts a reading every 6 ms. Finer than a player can hear a note as separate,
   * which is what the spacing rule below then has to thin out.
   */
  private const val WINDOW = 1024
  private const val HOP = WINDOW / 4

  /**
   * How close two tiles may fall.
   *
   * Not an aesthetic choice but a physical one: a hand cannot reliably strike
   * twice in much less than this, and a chart that asks it to is not difficult,
   * it is broken.
   */
  private const val CLOSEST_MS = 90

  /**
   * And how long a lane rests before it may be used again.
   *
   * Longer than the gap allowed between tiles anywhere, because a tile has a
   * height: two in the same lane close together are drawn overlapping, and a
   * player cannot aim at the second while the first is still covering it. It is
   * also what makes a lane mean something — four lanes taking turns reads as
   * the music moving across them, where four lanes each stuttering reads as
   * noise.
   */
  private const val LANE_REST_MS = 280

  /**
   * How far either side the loudness is compared against.
   *
   * A fixed threshold finds everything in a loud song and nothing in a quiet
   * one. Comparing each moment against its own neighbourhood makes the measure
   * of "a hit" local, which is what lets one setting work for a whole library.
   */
  private const val NEIGHBOURHOOD = 24

  /** How far above its neighbourhood a peak has to stand. */
  private const val OVER = 1.6f

  /**
   * How much of its starting energy a band keeps while a note is still held.
   *
   * Low enough that a sound may fade a good deal and still count -- nothing
   * holds perfectly steady -- and high enough that the ordinary ring of a
   * struck note runs out before it.
   */
  private const val STILL_SOUNDING = 0.55f

  /**
   * Shorter than this is a tap, however long the sound rang for.
   *
   * Every note carries a little. A chart of quarter-second holds would be a
   * chart of taps that punish letting go too early.
   */
  private const val SHORTEST_HOLD_MS = 650

  /**
   * And the longest one worth asking for.
   *
   * A key kept down for seconds is a finger taken out of the game: the other
   * three lanes go on arriving and there is one hand left to meet them. Long
   * sounds are common in music and would make most of the chart a chord held
   * with one thumb while the rest of it goes past.
   */
  private const val LONGEST_HOLD_MS = 1_200

  /**
   * How long after one hold before another may be asked for.
   *
   * Rarity is the whole of what makes them worth having. Every second note
   * being held is not a harder game, it is a different and worse one -- the
   * hand never leaves the glass and the rhythm stops being something struck.
   */
  private const val BETWEEN_HOLDS_MS = 6_000

  /**
   * Where the lanes are divided, in hertz.
   *
   * Low to high, left to right: the kick drum on the left, the cymbals on the
   * right, and the song plays across the lanes in a way that feels like the
   * music rather than like a random sequence — which is the difference between
   * a chart that is fun and one that is merely correct.
   *
   */
  private val LANE_EDGES = doubleArrayOf(0.0, 200.0, 800.0, 3_000.0, Double.MAX_VALUE)

  /**
   * The notes in [samples], which must be mono.
   *
   * [strength] thins the result: 1.0 keeps every onset found, and lower values
   * keep only the strongest, which is how one analysis serves several
   * difficulties without being run again.
   */
  class Found(
    val stepMs: Int,
    val notes: List<Chart.Note>,
    val quiet: List<Chart.Span> = emptyList(),
    val levels: List<Int> = emptyList()
  )

  fun find(samples: FloatArray, rate: Int, strength: Float = 1f): Found {
    if (samples.size < WINDOW * 2) return Found(0, emptyList())

    val window = Spectrum.hann(WINDOW)
    val bins = WINDOW / 2
    val laneOf = IntArray(bins) { laneFor(it * rate.toDouble() / WINDOW) }

    val frames = (samples.size - WINDOW) / HOP
    val flux = FloatArray(frames)
    val laneFlux = Array(frames) { FloatArray(Chart.LANES) }
    // How much each band holds, as opposed to how much it grew. Growth says
    // where a note starts; this says whether it is still sounding.
    val laneEnergy = Array(frames) { FloatArray(Chart.LANES) }
    var previous = FloatArray(bins)

    for (frame in 0 until frames) {
      val at = frame * HOP
      val piece = FloatArray(WINDOW) { samples[at + it] * window[it] }
      val now = Spectrum.magnitudes(piece)

      var total = 0f
      for (bin in 0 until bins) {
        val lane = laneOf[bin]
        laneEnergy[frame][lane] += now[bin]
        // Only growth counts. A note ending is not a note starting, and
        // counting the fall as well would put a tile at both ends of every one.
        val rise = now[bin] - previous[bin]
        if (rise > 0f) {
          total += rise
          laneFlux[frame][lane] += rise
        }
      }
      flux[frame] = total
      previous = now
    }

    /*
      Where the song stops, from the band energies already summed above, so
      finding the pauses costs one more pass over numbers that are already in
      hand. Found before the onsets rather than after, because what is heard in
      a pause -- hiss, the tail of a room, the click of a needle -- is exactly
      what a detector measuring growth against a quiet neighbourhood mistakes
      for a hit.
    */
    val loudness = FloatArray(frames) { laneEnergy[it].sum() }
    val endMs = (samples.size.toLong() * 1000 / rate).toInt()
    val quiet = Pauses.find(loudness, HOP, rate, endMs)
    val levels = Levels.of(loudness, HOP, rate)

    /*
      What each band usually does, so that a note can be put in the lane that
      stood out rather than in the lane that is loudest.

      Music keeps most of its energy low down, so the largest rise is almost
      always the bass: choosing by raw size put four notes in five in the
      left-hand lane and left the right-hand one empty — measured, not guessed.
      Judging each band against its own average is what makes a hi-hat count as
      much as a kick, and is the same move the threshold above makes in time.
    */
    val laneAverage = FloatArray(Chart.LANES)
    for (frame in 0 until frames) {
      for (lane in 0 until Chart.LANES) laneAverage[lane] += laneFlux[frame][lane]
    }
    for (lane in 0 until Chart.LANES) {
      laneAverage[lane] = (laneAverage[lane] / frames).coerceAtLeast(1e-9f)
    }

    val found = mutableListOf<Chart.Note>()
    var lastAt = -CLOSEST_MS * 2
    val busyUntil = IntArray(Chart.LANES) { -LANE_REST_MS }

    for (frame in 1 until frames - 1) {
      val here = flux[frame]
      // A peak, not a slope: the moment growth stops growing is the strike.
      if (here < flux[frame - 1] || here <= flux[frame + 1]) continue

      val from = maxOf(0, frame - NEIGHBOURHOOD)
      val to = minOf(frames, frame + NEIGHBOURHOOD)
      var around = 0f
      for (other in from until to) around += flux[other]
      around /= (to - from)
      if (here < around * OVER) continue

      val atMs = (frame.toLong() * HOP * 1000 / rate).toInt()
      // Dropped before it can count as the last hit: something found in a
      // pause must not hold back the real note that ends it.
      if (quiet.any { atMs in it }) continue
      if (atMs - lastAt < CLOSEST_MS) continue
      lastAt = atMs

      /*
        The lane that stood out, unless it has only just been used -- in which
        case the next best one that has not. A note moved to its second choice
        of lane is still on the beat, which is what a player is actually
        following; a note dropped for want of a free lane is a hole in the bar.
      */
      var lane = standsOut(laneFlux[frame], laneAverage, busyUntil, atMs)
      if (lane < 0) {
        lane = standsOut(laneFlux[frame], laneAverage, null, atMs)
        // Every lane busy at once only happens where the notes are already
        // too close to play, and the spacing rule above has thinned those.
      }
      busyUntil[lane] = atMs + LANE_REST_MS
      found += Chart.Note(atMs, lane, holdFrom(laneEnergy, frame, lane, rate))
    }

    val beat = beatMs(found)
    val step = if (beat > 0) (beat / 2).coerceAtLeast(60) else 0
    val gridded = onGrid(found, beat)

    if (strength >= 1f) return Found(step, gridded, quiet, levels)

    // Thinned by keeping the loudest, then put back in time order: dropping
    // every other note instead would take the backbeat out of a bar and leave
    // something that no longer follows the song.
    val keep = (gridded.size * strength).toInt().coerceAtLeast(1)
    return Found(step, gridded
      .sortedByDescending { flux[(it.atMs.toLong() * rate / 1000 / HOP).toInt().coerceIn(0, frames - 1)] }
      .take(keep)
      .sortedBy { it.atMs }, quiet, levels)
  }

  /**
   * The spacing of the song's beat, in milliseconds, or nought if it has none.
   *
   * Found by asking which spacing the onsets themselves most agree on: lay the
   * list of hit times against a copy of itself slid along by a candidate
   * spacing, and the one where most hits land on top of each other is the beat.
   * Nothing about musical theory is needed for that — it is the same question
   * as "what does this repeat at".
   */
  private fun beatMs(found: List<Chart.Note>): Int {
    if (found.size < 8) return 0

    // 200 to 1000 ms is 60 to 300 beats a minute, which covers everything
    // anybody dances to and most of what they do not.
    var best = 0
    var bestScore = 0.0
    var candidate = 200
    while (candidate <= 1_000) {
      var score = 0.0
      for (note in found) {
        val off = (note.atMs % candidate).toDouble() / candidate
        // How near this hit sits to a line of the grid, as a cosine so that
        // near-misses count for something and the measure stays smooth.
        score += Math.cos(2.0 * Math.PI * off)
      }
      /*
        Divided by the square root of how many lines there are, not by the
        count: without it the shortest spacing always wins, because a grid of
        more lines catches more hits by luck alone.
      */
      val fair = score / Math.sqrt(1_000.0 / candidate)
      if (fair > bestScore) {
        bestScore = fair
        best = candidate
      }
      candidate += 5
    }
    return best
  }

  /**
   * The notes moved onto the nearest line of the grid, one to a line.
   *
   * Which is what makes it a game of keys rather than a game of moments. Tiles
   * that may begin anywhere are tiles that may overlap, and a player cannot aim
   * at a key that is half behind another; laid on a grid they are rows, and
   * rows cannot collide. A hit dragged a few tens of milliseconds onto the beat
   * is also, nearly always, where a listener thought it was anyway.
   *
   * Lines with nothing near them stay empty. A grid is a place for notes to
   * land, not a metronome to be filled in.
   */
  private fun onGrid(found: List<Chart.Note>, beat: Int): List<Chart.Note> {
    if (beat <= 0) return found

    /*
      Half a beat, because eighths are where most songs put things and
      quantising to whole beats throws away every off-beat in the music.
    */
    val step = (beat / 2).coerceAtLeast(60)
    val taken = HashSet<Int>()
    val out = mutableListOf<Chart.Note>()

    /*
      Only one note may be held at a time.

      Two hands have two thumbs. A chart that asks for three keys to be kept
      down at once is not hard, it is impossible, and one that asks for two
      leaves nothing free to strike the taps in between. So a note that would
      begin while another is still being held becomes a tap -- the beat is kept,
      which is what is being followed, and only the asking-to-hold is dropped.
    */
    var heldUntil = -1
    var lastHoldAt = -BETWEEN_HOLDS_MS

    for (note in found.sortedBy { it.atMs }) {
      val line = Math.round(note.atMs.toDouble() / step).toInt()
      // Two hits rounding onto the same line are one key. The first keeps it:
      // it is the one the ear heard as the beat.
      if (!taken.add(line)) continue
      /*
        Every hit belongs to some line, since the lines are half a beat apart
        and nothing can be further than a quarter beat from one.

        This used to drop anything more than two fifths of a step away, to
        avoid inventing a rhythm. What it actually did was leave holes: a
        passage whose timing drifts a little against the grid lost note after
        note, and seconds of a song arrived with nothing to play. A hit moved
        by a fraction of a beat is still the hit that was heard; a hit removed
        is a silence that was not.
      */
      val at = line * step
      val wanted = if (at < heldUntil || at - lastHoldAt < BETWEEN_HOLDS_MS) 0 else note.holdMs
      val hold = if (wanted > 0) wanted.coerceAtMost(LONGEST_HOLD_MS) else 0
      if (hold > 0) {
        heldUntil = at + hold
        lastHoldAt = at
      }
      out += note.copy(atMs = at, holdMs = hold)
    }
    return out
  }

  private fun laneFor(hz: Double): Int {
    for (lane in 0 until Chart.LANES) {
      if (hz >= LANE_EDGES[lane] && hz < LANE_EDGES[lane + 1]) return lane
    }
    return Chart.LANES - 1
  }

  /**
   * How long the sound that just started carries on, or nought if it does not.
   *
   * A strike and a held chord look identical at the moment they begin — both
   * are a rise in the spectrum. What tells them apart is what happens next: a
   * strike decays away within a beat, and something held stays up. So the
   * band's energy is followed forward from the onset and the note lasts as long
   * as it stays above a share of what it reached.
   *
   * Short carries are ignored rather than made into very brief holds: every
   * note rings a little, and a chart of two-hundred-millisecond holds would be
   * a chart of taps that punish you for letting go.
   */
  private fun holdFrom(
    energy: Array<FloatArray>,
    from: Int,
    lane: Int,
    rate: Int
  ): Int {
    val peak = energy[from][lane]
    if (peak <= 0f) return 0

    var frame = from
    while (frame + 1 < energy.size && energy[frame + 1][lane] > peak * STILL_SOUNDING) frame++

    val heldMs = ((frame - from).toLong() * HOP * 1000 / rate).toInt()
    return if (heldMs >= SHORTEST_HOLD_MS) heldMs else 0
  }

  /**
   * The band that rose most against what that band usually does.
   *
   * [busyUntil] rules out lanes still occupied by the tile before, or is null
   * to ask without that restriction. Minus one when every lane is ruled out.
   */
  private fun standsOut(
    perLane: FloatArray,
    average: FloatArray,
    busyUntil: IntArray?,
    atMs: Int
  ): Int {
    var best = -1
    var bestRatio = Float.NEGATIVE_INFINITY
    for (lane in perLane.indices) {
      if (busyUntil != null && atMs < busyUntil[lane]) continue
      val ratio = perLane[lane] / average[lane]
      if (ratio > bestRatio) {
        bestRatio = ratio
        best = lane
      }
    }
    return best
  }
}

/**
 * Finding the pauses in a recording: the stretches with nothing to play along to.
 *
 * Kept apart from the onsets, and given numbers rather than sound, so that the
 * rule can be tested on its own -- what counts as silence is a decision, and a
 * decision is easier to check against a column of figures than against a song.
 *
 * Silence is judged against the song itself. An absolute threshold would find
 * pauses everywhere in a quiet folk recording and nowhere in a loud master
 * with hiss under its intro; asking how far below its own usual level a moment
 * sits makes the one rule fit both.
 */
internal object Pauses {
  /**
   * Which frame stands for the song's usual level: the one louder than nine in
   * ten of the others.
   *
   * Not the loudest. One chorus, one cymbal crash or one clipped peak would set
   * that, and every soft verse beside it would come out as silence. Not the
   * middle either: a record that is half silence -- a long fade, a hidden track
   * after minutes of nothing -- would put its middle frame inside the silence
   * and then find none. High in the order but short of the top is the level the
   * song is actually played at.
   */
  private const val TYPICAL = 0.9

  /**
   * How far below that level is silence, in decibels.
   *
   * Thirty is well under anything played on purpose: a soft piano intro in
   * front of a full band sits about twenty down, and is music. What sits thirty
   * down is the room, the hiss and the last of a reverb tail.
   */
  private const val BELOW_DB = 30.0

  /**
   * The level a frame has to be at or under, as a share of the usual one.
   *
   * The energies are sums of spectral magnitudes, which grow in step with the
   * amplitude of the sound rather than with its power, so decibels become a
   * ratio over twenty rather than over ten. Compared as a ratio rather than
   * taken as logarithms, which also means a frame of exact digital nought is
   * simply below everything instead of being minus infinity.
   */
  private val UNDER = Math.pow(10.0, -BELOW_DB / 20.0).toFloat()

  /**
   * And for how long, before a hush is a pause.
   *
   * A singer's breath, a stop between two chords, the beat of nothing before a
   * drop: all of those are part of the rhythm, and the board should keep going
   * through them. A second and a half is longer than any of them at any tempo
   * a song is played at, and short enough that a real gap is not missed.
   */
  private const val SHORTEST_MS = 1_500

  /**
   * The song's usual level: see [TYPICAL] for why it is that frame and not
   * the loudest or the middle one.
   */
  fun usual(loudness: FloatArray): Float {
    if (loudness.isEmpty()) return 0f
    val sorted = loudness.copyOf()
    sorted.sort()
    return sorted[((sorted.size - 1) * TYPICAL).toInt()]
  }

  /**
   * The pauses in a song, from how loud each frame of it is, in time order.
   *
   * [loudness] is one figure a frame, frames [hop] samples apart at [rate].
   * [endMs] is where the recording stops, and where a pause that runs off the
   * end is said to finish: the last frame begins a window short of the last
   * sample, and a pause that stopped there would leave a sliver at the very
   * end of the song looking like music.
   */
  fun find(loudness: FloatArray, hop: Int, rate: Int, endMs: Int): List<Chart.Span> {
    if (loudness.isEmpty() || hop <= 0 || rate <= 0) return emptyList()

    val under = usual(loudness) * UNDER

    fun msOf(frame: Int) = (frame.toLong() * hop * 1000 / rate).toInt()

    val out = mutableListOf<Chart.Span>()
    var from = -1
    // One past the end, so a pause still open when the song stops is closed
    // by the same code as any other.
    for (frame in 0..loudness.size) {
      /*
        At or under rather than strictly under, for the one song whose usual
        level is nought: a file of silence throughout is all pause, where a
        strict comparison against a threshold of nothing would find none.
      */
      if (frame < loudness.size && loudness[frame] <= under) {
        if (from < 0) from = frame
        continue
      }
      if (from < 0) continue
      val startMs = msOf(from)
      val endsMs = if (frame == loudness.size) maxOf(endMs, msOf(frame)) else msOf(frame)
      if (endsMs - startMs >= SHORTEST_MS) out += Chart.Span(startMs, endsMs)
      from = -1
    }
    return out
  }
}

/**
 * The loudness of a recording as a curve the board can read.
 *
 * The analysis works in frames a hundredth of a second apart, which is far
 * finer than anything the board decides by: a row is a tenth of a second at
 * its shortest. So the curve is thinned to one figure every [EVERY_MS], each
 * the average of the frames inside it, and written against the song's usual
 * level rather than in whatever units the spectrum came in.
 */
internal object Levels {
  /** Short enough that the quickest row still covers two of them. */
  const val EVERY_MS = 50

  /** What the usual level is written as. */
  const val USUAL = 100

  /**
   * As far above the usual level as is worth telling apart.
   *
   * The board only ever asks whether a moment is well below its neighbours, so
   * how far above them a peak reaches says nothing it uses. Capped so one
   * clipped crash cannot be a figure ten times the size of everything else.
   */
  private const val MOST = 1_000

  fun of(loudness: FloatArray, hop: Int, rate: Int): List<Int> {
    if (loudness.isEmpty() || hop <= 0 || rate <= 0) return emptyList()
    val usual = Pauses.usual(loudness)
    // A file of nothing has no usual level to be measured against, and no
    // dips either: the pauses already say all there is to say about it.
    if (usual <= 0f) return emptyList()

    fun slotOf(frame: Int) = (frame.toLong() * hop * 1000 / rate / EVERY_MS).toInt()

    val count = slotOf(loudness.size - 1) + 1
    val sums = FloatArray(count)
    val seen = IntArray(count)
    for (frame in loudness.indices) {
      val slot = slotOf(frame)
      sums[slot] += loudness[frame]
      seen[slot]++
    }
    return List(count) { slot ->
      if (seen[slot] == 0) 0
      else Math.round(sums[slot] / seen[slot] / usual * USUAL).coerceIn(0, MOST)
    }
  }
}
