package expo.modules.jukeboxaudio.equalizer

/**
 * The app's own equalizer: what a band is, and what is set right now.
 *
 * The phone has an equalizer of its own, and for a long time that was the one
 * this app drove. What it offers is up to the phone -- five bands on most,
 * at frequencies nobody chose, with no say over how wide any of them is --
 * and a correction made for a pair of headphones cannot be entered into it
 * at all. This one is the same on every phone: each band is a filter with a
 * kind, a frequency, a gain and a width, and the arithmetic is done here, in
 * the player's own audio chain (see [EqualizerProcessor]).
 *
 * What is in force is held here rather than handed to each player, for the
 * reason the other effects are: the crossfade opens a second player for the
 * outgoing track, and a tone applied to one and not the other would be heard
 * changing across the join. Both read the same record, swapped whole behind
 * a volatile reference, so the audio thread takes no lock and never sees
 * half of a change.
 */
object Parametric {
  /**
   * As many bands as anybody has a use for. A headphone correction from
   * AutoEQ is ten; two more leaves room to add a taste of one's own on top.
   */
  const val MAX_BANDS = 12

  /** The range of hearing, near enough, and of every published correction. */
  const val MIN_HZ = 20.0
  const val MAX_HZ = 20_000.0

  /**
   * Twenty decibels either way, which is what AutoEQ allows its own filters.
   * Most of its corrections stay inside ten, but the ones that do not are
   * for the headphones that need correcting most, and a file that could only
   * be imported with its largest band cut short would be the wrong curve.
   */
  const val MAX_GAIN_DB = 20.0

  /** From three octaves wide to a notch a semitone across. */
  const val MIN_Q = 0.1
  const val MAX_Q = 10.0

  /** Wide enough for the preamp any curve inside the limits above asks for. */
  const val MIN_PREAMP_DB = -30.0
  const val MAX_PREAMP_DB = 12.0

  /**
   * The three shapes a correction is made of.
   *
   * A peak lifts or cuts around one frequency. A shelf lifts or cuts
   * everything below its frequency, or everything above. Low- and high-pass
   * filters are left out: nothing AutoEQ writes uses them, and a control
   * whose only setting is "less bass than none" is a way to lose the music.
   */
  enum class Type(val key: String) {
    PEAK("peak"),
    LOW_SHELF("lowShelf"),
    HIGH_SHELF("highShelf");

    companion object {
      fun of(key: Any?): Type = entries.firstOrNull { it.key == key } ?: PEAK
    }
  }

  data class Band(
    val type: Type = Type.PEAK,
    val frequencyHz: Double = 1_000.0,
    val gainDb: Double = 0.0,
    val q: Double = 1.0
  ) {
    /** The same band, with every number somewhere a filter can be made from it. */
    fun held(): Band = Band(
      type = type,
      frequencyHz = frequencyHz.finiteOr(1_000.0).coerceIn(MIN_HZ, MAX_HZ),
      gainDb = gainDb.finiteOr(0.0).coerceIn(-MAX_GAIN_DB, MAX_GAIN_DB),
      q = q.finiteOr(1.0).coerceIn(MIN_Q, MAX_Q)
    )
  }

  /**
   * What the audio thread is shown.
   *
   * [preampDb] is the level trim that goes with the bands, or null for the
   * one worked out from them: see [Response.autoPreampDb].
   */
  data class Curve(
    val enabled: Boolean = false,
    val bands: List<Band> = emptyList(),
    val preampDb: Double? = null
  ) {
    /**
     * Whether there is nothing to do, so the samples can be handed on as
     * they came.
     *
     * A band at nought decibels is no filter at all, whatever its frequency
     * says, and an automatic preamp over a curve that boosts nothing is
     * nought as well. A preamp somebody set is a gain even with every band
     * flat, and is honoured.
     */
    val idle: Boolean
      get() = !enabled || (bands.all { it.gainDb == 0.0 } && (preampDb ?: 0.0) == 0.0)
  }

  @Volatile
  private var current = Curve()

  fun curve(): Curve = current

  /** Puts [curve] in force for every player, from their next buffer on. */
  fun publish(curve: Curve) {
    current = curve
  }

  private fun Double.finiteOr(fallback: Double): Double = if (isFinite()) this else fallback
}
