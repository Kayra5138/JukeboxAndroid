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
  val levels: List<Int> = emptyList(),
  /**
   * Where each step of the grid falls in the recording, in milliseconds.
   *
   * Everything else here -- the notes, the pauses, the curve -- is written in
   * grid time, where step number `i` is at exactly `i * stepMs`. The band does
   * not play that evenly, so this is the way back: line `i` is the moment of
   * the recording that step `i` begins at. The board reads the player's
   * position through it and so lands its rows on the beat the whole way
   * through, instead of on a ruler laid beside the song.
   *
   * Empty for a song with no pulse, where grid time is simply the song's.
   */
  val lines: List<Int> = emptyList(),
  /** How many steps make a bar, and which step the first one starts on. Nought for no pulse. */
  val barSteps: Int = 0,
  val barAt: Int = 0,
  /**
   * The lane the song suggests for every quarter of a step, one digit each.
   *
   * From the tune where there is one -- low notes to the left, high to the
   * right, by where each sits among the notes around it -- and from the band
   * that stood out where there is not. The same for every bar that is the same
   * music, which is the point: a chorus is played the way it was learned.
   */
  val lanes: String = "",
  /**
   * How hard the music hits at every quarter of a step, one character each,
   * `0` the softest to `z` the hardest. The board puts its two-finger keys on
   * the moments that hit hardest, rather than on every so-many-th row.
   */
  val accents: String = "",
  /**
   * How loud each quarter of a step is against the passage it is in, one
   * character each: `k` is the level of its surroundings, `0` is nothing.
   *
   * The same question the curve above answers, already asked. The board used
   * to work a dip out for itself from the rows around each row, which gave a
   * chorus different rests on each return because the bars either side of it
   * were different. Asked here, once, and made the same for every bar of a
   * kind, a rest is part of the passage and comes back with it.
   */
  val ease: String = ""
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
    const val VERSION = 11

    const val LANES = 4

    /** How many parts of a step the lanes and the curve are written at. */
    const val SLOTS = 4
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
   * How many samples a window is, for a recording at [rate].
   *
   * Twenty-three milliseconds of sound whatever the rate, and a reading every
   * quarter of that: finer than a player can hear a note as separate, which is
   * what the spacing rule below then has to thin out. Counted in samples it
   * would be a different length on every file, and the app listens at half the
   * rate a song is usually recorded at -- where a window of the same count is
   * twice as long, and everything timed by it half as exact.
   */
  private fun windowFor(rate: Int): Int = if (rate < 32_000) 512 else 1024

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
    val levels: List<Int> = emptyList(),
    val levelMs: Int = Levels.EVERY_MS,
    val lines: List<Int> = emptyList(),
    val barSteps: Int = 0,
    val barAt: Int = 0,
    val lanes: String = "",
    val accents: String = "",
    val ease: String = ""
  ) {
    private val map: TimeMap? =
      if (lines.size > 1 && stepMs > 0) TimeMap(DoubleArray(lines.size) { lines[it].toDouble() }, stepMs)
      else null

    /** Where in the recording a moment of the chart is. The same moment, for a song with no pulse. */
    fun songMs(gridMs: Int): Int {
      val between = map ?: return gridMs
      val position = gridMs.toDouble() / stepMs
      val line = position.toInt().coerceIn(0, lines.size - 2)
      return Math.round(between.toSong(line, position - line)).toInt()
    }

    /** And where in the chart a moment of the recording is. */
    fun gridMs(songMs: Int): Int = map?.let { Math.round(it.toGrid(songMs.toDouble())).toInt() } ?: songMs
  }

  fun find(samples: FloatArray, rate: Int, strength: Float = 1f): Found {
    val size = windowFor(rate)
    val hop = size / 4
    if (samples.size < size * 2) return Found(0, emptyList())

    val window = Spectrum.hann(size)
    val bins = size / 2
    val laneOf = IntArray(bins) { laneFor(it * rate.toDouble() / size) }

    val frames = (samples.size - size) / hop
    val flux = FloatArray(frames)
    val laneFlux = Array(frames) { FloatArray(Chart.LANES) }
    // How much each band holds, as opposed to how much it grew. Growth says
    // where a note starts; this says whether it is still sounding.
    val laneEnergy = Array(frames) { FloatArray(Chart.LANES) }
    var previous = FloatArray(bins)

    for (frame in 0 until frames) {
      val at = frame * hop
      val piece = FloatArray(size) { samples[at + it] * window[it] }
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
    val quiet = Pauses.find(loudness, hop, rate, endMs)
    val levels = Levels.of(loudness, hop, rate)

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

      val atMs = (frame.toLong() * hop * 1000 / rate).toInt()
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
      found += Chart.Note(atMs, lane, holdFrom(laneEnergy, frame, lane, rate, hop))
    }

    /*
      A song with too little in it to find a pulse from is handed back as it
      was heard: the notes where they fell, in the song's own time. The board
      has a fixed row for that, and nothing below has anything to go on.
    */
    val laid = if (found.size >= FEWEST_FOR_A_PULSE) {
      onPulse(samples, rate, flux, laneFlux, laneAverage, loudness, found, quiet, endMs)
    } else {
      null
    }
    val whole = laid ?: Found(0, found, quiet, levels)
    if (strength >= 1f) return whole

    // Thinned by keeping the loudest, then put back in time order: dropping
    // every other note instead would take the backbeat out of a bar and leave
    // something that no longer follows the song.
    fun fluxAt(note: Chart.Note): Float =
      flux[(whole.songMs(note.atMs).toLong() * rate / 1000 / hop).toInt().coerceIn(0, frames - 1)]
    val keep = (whole.notes.size * strength).toInt().coerceAtLeast(1)
    val thinned = whole.notes.sortedByDescending { fluxAt(it) }.take(keep).sortedBy { it.atMs }
    return Found(
      whole.stepMs, thinned, whole.quiet, whole.levels, whole.levelMs,
      whole.lines, whole.barSteps, whole.barAt, whole.lanes, whole.accents, whole.ease
    )
  }

  /** Fewer onsets than this and there is nothing to find a pulse in. */
  private const val FEWEST_FOR_A_PULSE = 8

  /** A slot counts as having a tune in it if it is stronger than this share of them. */
  private const val TUNELESS = 0.30

  /** How far either side a slot's loudness is compared with, and what its usual level is written as. */
  private const val EASE_AROUND_MS = 4_000
  private const val EASE_USUAL = 20

  /** How many steps either side a pitch is ranked among, to decide its lane. */
  private const val AROUND_STEPS = 32

  /**
   * The chart laid on the song's own pulse.
   *
   * Everything the short window measured is gathered up here onto a grid that
   * follows the beat, and joined by what the long window heard: the tune, to
   * say which lane, and the harmony and sound, to say which bars are the same.
   * Null when no pulse could be followed, and the caller falls back.
   */
  private fun onPulse(
    samples: FloatArray,
    rate: Int,
    flux: FloatArray,
    laneFlux: Array<FloatArray>,
    laneAverage: FloatArray,
    loudness: FloatArray,
    found: List<Chart.Note>,
    quiet: List<Chart.Span>,
    endMs: Int
  ): Found? {
    val hop = windowFor(rate) / 4
    val frameMs = hop * 1000.0 / rate
    val envelope = Pulse.envelope(flux, frameMs)
    val pulse = Pulse.step(envelope, frameMs)
    if (pulse <= 0.0) return null
    val tracked = Pulse.follow(envelope, frameMs, pulse)
    if (tracked.size < FEWEST_FOR_A_PULSE) return null

    val lines = Pulse.covering(tracked, pulse, endMs.toDouble())
    val slotsPer = Chart.SLOTS
    // A whole number of slots, so a slot is a whole number of milliseconds.
    // Grid time is the board's own, so the step may be any length it likes;
    // only the lines say how long a step really lasts.
    val stepMs = (Math.round(pulse / slotsPer).toInt() * slotsPer).coerceAtLeast(slotsPer * 20)
    val slotMs = stepMs / slotsPer
    val map = TimeMap(lines, stepMs)
    val steps = map.steps
    val slots = steps * slotsPer
    val frames = flux.size

    fun shortFrame(songMs: Double) = Math.round(songMs / frameMs).toInt().coerceIn(0, frames - 1)
    fun slotStart(slot: Int): Double =
      if (slot >= slots) lines[steps] else map.toSong(slot / slotsPer, (slot % slotsPer).toDouble() / slotsPer)

    // ---- what each step sounds like, for telling the bars apart
    val onset = FloatArray(steps)
    val low = FloatArray(steps)
    for (step in 0 until steps) {
      val centre = shortFrame(lines[step])
      for (k in -2..2) {
        val frame = (centre + k).coerceIn(0, frames - 1)
        onset[step] = maxOf(onset[step], envelope[frame])
        low[step] = maxOf(low[step], laneFlux[frame][0])
      }
    }

    val heard = Tune.hear(samples, rate)
    if (heard.frames == 0) return null
    fun longFrame(songMs: Double) = Math.round(songMs / heard.frameMs).toInt().coerceIn(0, heard.frames - 1)

    val harmony = Array(steps) { FloatArray(12) }
    val sound = Array(steps) { FloatArray(Tune.BANDS) }
    for (step in 0 until steps) {
      val from = longFrame(lines[step])
      val to = maxOf(from + 1, longFrame(lines[step + 1])).coerceAtMost(heard.frames)
      for (frame in from until to) {
        for (k in 0 until 12) harmony[step][k] += heard.chroma[frame][k]
        for (k in 0 until Tune.BANDS) sound[step][k] += heard.timbre[frame][k]
      }
      val count = (to - from).coerceAtLeast(1)
      for (k in 0 until 12) harmony[step][k] /= count
      for (k in 0 until Tune.BANDS) sound[step][k] /= count
    }

    val features = Bars.steps(harmony, sound, onset)
    val bar = Bars.length(features)
    val barAt = Bars.start(low, bar)
    val kind = Bars.kinds(features, bar, barAt)
    val families = Bars.families(kind)

    // ---- what each slot holds: the tune, the band that stood out, how hard it hit, how loud it was
    val pitch = FloatArray(slots)
    val strong = FloatArray(slots)
    val band = IntArray(slots)
    val accent = FloatArray(slots)
    val level = FloatArray(slots)
    val usual = Pauses.usual(loudness)
    val perLane = FloatArray(Chart.LANES)
    for (slot in 0 until slots) {
      val startsAt = slotStart(slot)
      val endsAt = slotStart(slot + 1)

      val from = longFrame(startsAt)
      val to = maxOf(from + 1, longFrame(endsAt)).coerceAtMost(heard.frames)
      val pitches = FloatArray(to - from) { heard.pitch[from + it] }
      pitches.sort()
      // The middle one, so a single frame that jumped an octave is outvoted.
      pitch[slot] = if (pitches.size % 2 == 1) pitches[pitches.size / 2]
      else (pitches[pitches.size / 2 - 1] + pitches[pitches.size / 2]) / 2
      var sum = 0f
      for (frame in from until to) sum += heard.strength[frame]
      strong[slot] = sum / (to - from)

      val first = shortFrame(startsAt)
      val last = maxOf(first + 1, shortFrame(endsAt)).coerceAtMost(frames)
      java.util.Arrays.fill(perLane, 0f)
      var loud = 0f
      for (frame in first until last) {
        for (lane in 0 until Chart.LANES) perLane[lane] += laneFlux[frame][lane]
        loud += loudness[frame]
      }
      band[slot] = standsOut(perLane, laneAverage, null, 0).coerceAtLeast(0)
      level[slot] = if (usual > 0f) loud / (last - first) / usual * Levels.USUAL else 0f
      for (k in -2..2) accent[slot] = maxOf(accent[slot], envelope[(first + k).coerceIn(0, frames - 1)])
    }

    /*
      The lane of a slot with a tune in it is where its pitch ranks among the
      pitches around it. Ranked, not placed between their extremes: a tune that
      lives on three notes then still uses the whole board, where measured
      against its highest and lowest it would sit in one column and visit the
      others twice a song.
    */
    val threshold = strong.sortedArray()[((slots - 1) * TUNELESS).toInt().coerceAtLeast(0)]
    val tuneful = BooleanArray(slots) { strong[it] > threshold }
    val note = IntArray(slots) { Math.round(pitch[it]) }
    val reach = AROUND_STEPS * slotsPer
    val lane = IntArray(slots)
    for (slot in 0 until slots) {
      if (!tuneful[slot]) {
        lane[slot] = band[slot]
        continue
      }
      var below = 0
      var same = 0
      var count = 0
      for (other in maxOf(0, slot - reach)..minOf(slots - 1, slot + reach)) {
        if (!tuneful[other]) continue
        count++
        if (note[other] < note[slot]) below++ else if (note[other] == note[slot]) same++
      }
      lane[slot] = ((below + same / 2.0) / count * Chart.LANES).toInt().coerceIn(0, Chart.LANES - 1)
    }

    /*
      How loud each slot is against the slots around it: the middle value of
      four seconds either side, so one crash nearby does not make every
      ordinary slot beside it look like a dip.
    */
    val around = (EASE_AROUND_MS / slotMs).coerceAtLeast(2)
    val eased = FloatArray(slots)
    for (slot in 0 until slots) {
      val from = maxOf(0, slot - around)
      val to = minOf(slots - 1, slot + around)
      val near = FloatArray(to - from + 1) { level[from + it] }
      near.sort()
      val middle = near[near.size / 2]
      eased[slot] = if (middle > 0f) level[slot] / middle else 1f
    }

    // ---- the onsets, each on the line nearest it and one to a line
    val struck = BooleanArray(steps)
    val hold = IntArray(steps)
    for (hit in found) {
      val step = map.nearestLine(hit.atMs.toDouble())
      if (step >= steps || struck[step]) continue
      struck[step] = true
      hold[step] = hit.holdMs
    }

    /*
      One answer for every bar of a kind.

      Each of them was heard separately and each came out a little different;
      what they have in common is taken as what the passage is. The lane of a
      slot is the one most of its bars chose. A key is there if at least half
      of them had one, and held for as long as the middle one was. How hard a
      moment hits and how loud it is are their averages. After this a bar of a
      kind is the same bar wherever in the song it comes.
    */
    val barSlots = bar * slotsPer
    for (family in families) {
      val votes = IntArray(Chart.LANES)
      for (position in 0 until barSlots) {
        java.util.Arrays.fill(votes, 0)
        var hits = 0f
        var loud = 0f
        var soft = 0f
        for (member in family) {
          val slot = (barAt + member * bar) * slotsPer + position
          votes[lane[slot]]++
          hits += accent[slot]
          loud += level[slot]
          soft += eased[slot]
        }
        var agreed = 0
        for (candidate in 1 until Chart.LANES) if (votes[candidate] > votes[agreed]) agreed = candidate
        for (member in family) {
          val slot = (barAt + member * bar) * slotsPer + position
          lane[slot] = agreed
          accent[slot] = hits / family.size
          level[slot] = loud / family.size
          eased[slot] = soft / family.size
        }
      }
      for (position in 0 until bar) {
        val held = ArrayList<Int>()
        for (member in family) {
          val step = barAt + member * bar + position
          if (struck[step]) held.add(hold[step])
        }
        val there = held.size * 2 >= family.size
        held.sort()
        /*
          Held in all of them or in none.

          A hold may not follow another too soon, and decided bar by bar that
          rule keeps the first of a run of the same bar and turns the next two
          into taps -- the one place a chorus would still differ from itself,
          and by the most visible thing on the board. So it is decided for the
          kind: if its bars come round sooner than holds are allowed to, none
          of them is held.
        */
        var soonest = Int.MAX_VALUE
        for (index in 1 until family.size) {
          soonest = minOf(soonest, (family[index] - family[index - 1]) * bar * stepMs)
        }
        val agreed = when {
          held.isEmpty() || soonest < BETWEEN_HOLDS_MS -> 0
          else -> held[held.size / 2]
        }
        for (member in family) {
          val step = barAt + member * bar + position
          struck[step] = there
          hold[step] = if (there) agreed else 0
        }
      }
    }

    /*
      Only one note may be held at a time, and not often.

      Two hands have two thumbs. A chart that asks for three keys to be kept
      down at once is not hard, it is impossible, and one that asks for two
      leaves nothing free to strike the taps in between. So a note that would
      begin while another is still being held becomes a tap -- the beat is kept,
      which is what is being followed, and only the asking-to-hold is dropped.
    */
    val notes = ArrayList<Chart.Note>()
    var heldUntil = -1
    var lastHoldAt = -BETWEEN_HOLDS_MS
    for (step in 0 until steps) {
      if (!struck[step]) continue
      val at = step * stepMs
      val wanted = if (at < heldUntil || at - lastHoldAt < BETWEEN_HOLDS_MS) 0 else hold[step]
      val kept = if (wanted > 0) wanted.coerceAtMost(LONGEST_HOLD_MS) else 0
      if (kept > 0) {
        heldUntil = at + kept
        lastHoldAt = at
      }
      notes += Chart.Note(at, lane[step * slotsPer], kept)
    }

    // How hard each slot hits, as where it ranks in the song: thirty-six levels.
    val order = (0 until slots).sortedBy { accent[it] }
    val rank = IntArray(slots)
    for ((position, slot) in order.withIndex()) rank[slot] = position
    val digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    val accents = StringBuilder(slots)
    val lanes = StringBuilder(slots)
    val ease = StringBuilder(slots)
    for (slot in 0 until slots) {
      ease.append(digits[Math.round(eased[slot] * EASE_USUAL).coerceIn(0, digits.length - 1)])
      // Ranked by value, so two slots that were stamped the same say the same.
      var position = rank[slot]
      while (position > 0 && accent[order[position - 1]] == accent[slot]) position--
      accents.append(digits[(position.toLong() * digits.length / slots).toInt().coerceIn(0, digits.length - 1)])
      lanes.append(('0' + lane[slot]))
    }

    return Found(
      stepMs = stepMs,
      notes = notes,
      quiet = quiet.map {
        Chart.Span(
          Math.round(map.toGrid(it.startMs.toDouble())).toInt(),
          Math.round(map.toGrid(it.endMs.toDouble())).toInt()
        )
      },
      levels = List(slots) { Math.round(level[it]).coerceIn(0, 1_000) },
      levelMs = slotMs,
      /*
        Half a window later than they were measured. A frame is timed from
        where its window starts, and a hit is only seen once it is well inside
        the window: on struck sounds of known position the measure comes out
        twelve milliseconds early, which is half of the window. Everything
        above agrees with itself in the frames' own time, so the correction is
        made once, here, on the way out.
      */
      lines = List(lines.size) { Math.round(lines[it] + windowFor(rate) * 500.0 / rate).toInt() },
      barSteps = bar,
      barAt = barAt,
      lanes = lanes.toString(),
      accents = accents.toString(),
      ease = ease.toString()
    )
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
    rate: Int,
    hop: Int
  ): Int {
    val peak = energy[from][lane]
    if (peak <= 0f) return 0

    var frame = from
    while (frame + 1 < energy.size && energy[frame + 1][lane] > peak * STILL_SOUNDING) frame++

    val heldMs = ((frame - from).toLong() * hop * 1000 / rate).toInt()
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
