package expo.modules.jukeboxaudio.loudness

import kotlin.math.log10
import kotlin.math.pow

/**
 * The level everything is brought to: ReplayGain 2.0's, -18 LUFS.
 *
 * Five above the -23 broadcasters use, because music is mastered hotter than
 * speech and a target that low would turn every modern record down by ten
 * decibels or more and leave a phone's volume control with nowhere to go. A
 * gain in a ReplayGain tag is already stated against this, so a tag and a
 * measurement made here mean the same thing.
 */
const val REFERENCE_LUFS = -18.0

/**
 * How far under full scale a turned-up track's loudest sample is kept.
 *
 * The peaks known here are sample peaks -- the largest number in the file --
 * and the waveform a converter draws between two samples can rise a little
 * above both of them. A decibel is the usual allowance for that, and it is
 * what stands in for measuring the true peak, which would mean oversampling
 * every song four times over to move this figure by a fraction.
 */
const val HEADROOM_DB = 1f

/**
 * The most any track is turned up, whatever its numbers say.
 *
 * A recording that is nearly silent all the way through -- a spoken interlude,
 * a field recording, the hidden track after ten minutes of nothing -- measures
 * thirty or forty under the reference, and turning it up by that much plays
 * back its noise floor. Past this it is taken to be quiet on purpose.
 */
const val MOST_BOOST_DB = 12f

/** The other way, where the only thing to guard against is a nonsense tag. */
const val MOST_CUT_DB = -24f

/**
 * What is known about one file.
 *
 * Gains are in decibels and are what it takes to bring the file to
 * [REFERENCE_LUFS]; peaks are a fraction of full scale, and null where nobody
 * said. [albumDb] is only ever from a tag: an album's gain worked out here is
 * worked out afresh from its tracks each time, see [albumGain].
 */
data class FileGain(
  val trackDb: Float,
  val trackPeak: Float? = null,
  val albumDb: Float? = null,
  val albumPeak: Float? = null,
  /** Measured on this phone rather than read from the file's own tags. */
  val measured: Boolean = false
)

/**
 * The gain actually applied, given the one that was wanted.
 *
 * This is the whole of the clipping protection, and it is a ceiling rather
 * than a limiter. Turning a track down cannot clip it, so a cut is applied as
 * it stands. Turning one up can, and the loudest sample in the file says by
 * exactly how much: the boost is held to whatever leaves that sample
 * [HEADROOM_DB] under full scale. A dense modern master that peaks at full
 * scale therefore gets no boost at all, which is right -- it has no room for
 * one, and a limiter that made room would be changing the sound of the record
 * to win an argument about its level.
 *
 * A peak nobody told us is taken to be full scale, which is the same as
 * saying: never turn up what cannot be shown to have the room. Opus files are
 * the usual case, since their tags carry a gain and no peak.
 */
fun appliedDb(wantedDb: Float, peak: Float?): Float {
  val wanted = wantedDb.coerceIn(MOST_CUT_DB, MOST_BOOST_DB)
  if (wanted <= 0f) return wanted

  val loudest = (peak ?: 1f).coerceAtLeast(1e-5f)
  val room = -HEADROOM_DB - 20f * log10(loudest)
  return wanted.coerceAtMost(room.coerceAtLeast(0f))
}

/** Decibels as the number samples are multiplied by. */
fun factor(db: Float): Float = if (db == 0f) 1f else 10.0.pow(db / 20.0).toFloat()

/**
 * A place in the queue, as much of it as deciding what belongs with what
 * needs. Made from a queue entry by the service; plain here so that the
 * judgement below can be stated, and tested, without a player.
 */
data class Queued(
  val id: String,
  val album: String?,
  val folder: String?,
  /** As the queue entry has it; nought or less where it has none. */
  val trackNumber: Int,
  val durationSec: Double
)

/**
 * Whether [second] is the next track of the record [first] is on.
 *
 * Both have to name an album, and the same one, compared without case or
 * surrounding space since tags come from several places and rarely agree on
 * either. Where both say which folder they are in, it has to be the same
 * folder: "Greatest Hits" is the name of a great many records, and the folder
 * is the nearest thing to an album artist that a queue entry carries.
 *
 * Where both are numbered, the numbers have to run on -- seven then eight, or
 * the last of one disc then the first of the next. Two tracks of one album
 * that happen to sit together in a shuffle or a playlist are not a record
 * being played, and are levelled as the two songs they are. Unnumbered tracks
 * are given the benefit of the doubt: a download has an album name and no
 * number often enough.
 */
fun follows(first: Queued, second: Queued): Boolean {
  if (first.id == second.id) return false
  val album = first.album?.trim().orEmpty()
  if (album.isEmpty() || !album.equals(second.album?.trim().orEmpty(), ignoreCase = true)) return false
  if (first.folder != null && second.folder != null && first.folder != second.folder) return false

  if (first.trackNumber <= 0 || second.trackNumber <= 0) return true
  if (second.trackNumber == first.trackNumber + 1) return true
  // The media store's way of numbering a second disc: 2001 after 1012.
  return second.trackNumber % 1000 == 1 && second.trackNumber / 1000 == first.trackNumber / 1000 + 1
}

/**
 * The stretch of [order] around [at] that is one record being played through.
 *
 * [order] is the order things will be heard in, which under shuffle is not
 * the order of the queue. A track with neither neighbour belonging to it is a
 * run of one, and that is what "not an album" looks like from here.
 */
fun albumRun(order: List<Queued>, at: Int): IntRange {
  var first = at
  while (first > 0 && follows(order[first - 1], order[first])) first--
  var last = at
  while (last < order.size - 1 && follows(order[last], order[last + 1])) last++
  return first..last
}

/**
 * One gain for a run of tracks, from what is known of each of them.
 *
 * What ReplayGain means by album gain is the loudness of the whole record
 * measured as if it were one long track. That would take every block of every
 * track, which nothing here keeps. What is kept is each track's own loudness,
 * so the record's is taken to be the mean of those as power, each weighed by
 * how long the track is. It differs from the real thing only in the gating --
 * each track's quiet passages were judged against that track rather than
 * against the record -- which comes to a few tenths of a decibel on anything
 * that is not mostly silence.
 *
 * Null until every track in [run] is known. One gain for an album is a
 * promise that its tracks keep their distances from one another, and it
 * cannot be kept on a guess about the ones not yet measured; the caller plays
 * each at its own gain in the meantime.
 *
 * The peak is the loudest of the lot, and unknown if any of them is.
 */
fun albumGain(run: List<Queued>, known: (String) -> FileGain?): FileGain? {
  if (run.size < 2) return null
  val gains = run.map { known(it.id) ?: return null }

  // A track of unknown length cannot be weighed against the others, so
  // nothing is: every one counts the same.
  val timed = run.all { it.durationSec > 0 }
  var power = 0.0
  var total = 0.0
  for (index in run.indices) {
    val weight = if (timed) run[index].durationSec else 1.0
    // A track's loudness is the reference less its gain; only the difference
    // matters, so the reference drops out of both sides.
    power += weight * 10.0.pow(-gains[index].trackDb / 10.0)
    total += weight
  }
  val albumDb = (-10.0 * log10(power / total)).toFloat()
  val peak = if (gains.any { it.trackPeak == null }) null else gains.maxOf { it.trackPeak!! }
  return FileGain(trackDb = albumDb, trackPeak = peak, measured = true)
}

/**
 * The gain for the track at [at], in decibels, limited and ready to apply.
 *
 * Nought for a track nothing is known about. That is a deliberate nothing:
 * guessing -- the average of the library, say -- would turn down a quiet
 * track that needed turning up, and be heard doing it.
 *
 * Otherwise the track's own gain, unless it is part of a record being played
 * in order, in which case the record's: from its tags if it has one, worked
 * out from its neighbours if they are all known, and its own until they are.
 */
fun decidedDb(order: List<Queued>, at: Int, known: (String) -> FileGain?): Float {
  val own = known(order[at].id) ?: return 0f

  val run = albumRun(order, at)
  if (run.first != run.last) {
    if (own.albumDb != null) return appliedDb(own.albumDb, own.albumPeak ?: own.trackPeak)
    albumGain(order.subList(run.first, run.last + 1), known)?.let {
      return appliedDb(it.trackDb, it.trackPeak)
    }
  }
  return appliedDb(own.trackDb, own.trackPeak)
}
