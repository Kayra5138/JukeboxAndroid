package expo.modules.jukeboxaudio

/**
 * A few numbers that stand for the whole library, so that "has anything
 * changed?" can be asked without reading it.
 *
 * The scan hands every row to JavaScript, and it is the handing over that
 * costs: a dozen fields for each of thousands of files, made into objects on
 * the thread that draws. Nearly every time the library is looked at again it
 * is as it was, and all of that is spent learning so. This is made from the
 * same rows and crosses over as one short string; while two of them agree the
 * scan between them need not be made.
 *
 * Each file is boiled down to one number and the numbers are added up, so the
 * order the store hands the rows back in -- which it promises nothing about
 * when it is not asked to sort, and sorting is most of what the scan costs
 * it -- does not come into it. Two sums kept two ways, and the count, so that
 * one file going and another arriving cannot cancel out by accident.
 *
 * Nothing here knows the media store, which is what lets it be tested.
 */
class LibraryStamp(private val seed: String = "") {
  private var count = 0
  private var sum = 0L
  private var folded = 0L

  /**
   * One file. [generation] is the store's own count of changes to the row
   * where it keeps one, and nought where it does not; [modified] is the
   * file's own date, which is all an older phone has to go by.
   */
  fun add(id: Long, size: Long, modified: Long, generation: Long, name: String?, folder: String?) {
    var row = id
    row = row * 31 + size
    row = row * 31 + modified
    row = row * 31 + generation
    row = row * 31 + (name?.hashCode() ?: 0)
    row = row * 31 + (folder?.hashCode() ?: 0)
    val mixed = scramble(row)
    count += 1
    sum += mixed
    folded = folded xor scramble(mixed + 0x632BE59BD9B4E019L)
  }

  /** Spreads a number over all its bits, so that near rows do not make near sums. */
  private fun scramble(value: Long): Long {
    var z = value + -0x61c8864680b583ebL
    z = (z xor (z ushr 30)) * -0x40a7b892e31b1a47L
    z = (z xor (z ushr 27)) * -0x6b2fb644ecceee15L
    return z xor (z ushr 31)
  }

  override fun toString(): String =
    "$count.${java.lang.Long.toHexString(sum)}.${java.lang.Long.toHexString(folded)}.${Integer.toHexString(seed.hashCode())}"
}
