package expo.modules.jukeboxaudio.translate

import android.content.Context
import io.github.yinvoker.foxlet.Foxlet
import io.github.yinvoker.foxlet.LanguagePair
import io.github.yinvoker.foxlet.TextFormat
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Translation that runs on the phone, on free software.
 *
 * Bergamot is the engine Firefox translates pages with, and the models are
 * Mozilla's own, quantised small enough that a phone can hold one and fast
 * enough that a line costs nothing but processor time. That is the same bargain
 * ML Kit offered, which is what this replaced, minus the part where a build
 * containing it could not honestly be called free software.
 *
 * Everything here blocks. The engine is a suspending Kotlin API and the module
 * that calls it already runs on an IO queue, so bridging with [runBlocking]
 * costs a thread that was going to wait anyway and saves threading coroutines
 * through a native module interface that has no use for them.
 */
object BergamotTranslator {
  /** What lyrics are put into, and the only language every model reaches. */
  private const val PIVOT = "en"

  /**
   * Guards creation rather than use. The client is expensive to build and safe
   * to share; two screens asking for a translation at once should get the same
   * one rather than two engines with two copies of the model.
   */
  private val lock = Mutex()

  @Volatile
  private var client: Foxlet? = null

  /**
   * True when the engine can be used at all.
   *
   * The native library is built for 64-bit ARM only, so on anything else — an
   * emulator, an old phone — loading it throws and there is no translation to
   * be had from here. Answering false rather than throwing lets the caller fall
   * back instead of failing.
   */
  fun isUsable(context: Context): Boolean =
    runCatching { runBlocking { engine(context) } }.isSuccess

  /**
   * False for a language Mozilla publishes no model for.
   *
   * Answered from the catalogue built into the engine rather than from the
   * network, so it costs nothing and is right about what could be fetched even
   * when there is no connection to fetch it over.
   */
  fun isSupported(context: Context, language: String): Boolean = runBlocking {
    engine(context).models.findBundled(LanguagePair(language, PIVOT)) != null
  }

  /** True when the model for [language] is already on the device. */
  fun isModelReady(context: Context, language: String): Boolean = runBlocking {
    engine(context).models.findUsable(LanguagePair(language, PIVOT)) != null
  }

  /**
   * Translates [lines] one by one, keeping them in step with the originals.
   *
   * The engine takes a whole list and gives one back, which is what is wanted
   * here: timed lyrics are lines with a moment attached to each, and anything
   * that merged two lines or split one would leave no way to say which words
   * belong to which moment.
   *
   * Blank lines are the silences between verses, passed over rather than
   * translated so the gap survives to keep the two columns aligned.
   */
  fun translate(context: Context, lines: List<String>, source: String, target: String): List<String> {
    if (source == target) return lines

    return runBlocking {
      val foxlet = engine(context)
      // Downloads it if it is not already here. Deliberately not restricted to
      // wifi: the download only ever happens because someone asked for a
      // translation, and a condition that silently refuses to be met would look
      // exactly like the feature being broken.
      val from = foxlet.models.prepare(LanguagePair(source, PIVOT))
      val spoken = lines.filter { it.isNotBlank() }
      if (spoken.isEmpty()) return@runBlocking lines

      val said = if (target == PIVOT) {
        foxlet.translator.translate(spoken, from, TextFormat.Plain)
      } else {
        // Every model has English on one side, so anything else is two hops.
        val into = foxlet.models.prepare(LanguagePair(PIVOT, target))
        foxlet.translator.translatePivot(spoken, from, into, TextFormat.Plain)
      }

      // Put the silences back where they were.
      val spare = said.iterator()
      lines.map { line -> if (line.isBlank()) line else spare.next() }
    }
  }

  private suspend fun engine(context: Context): Foxlet =
    client ?: lock.withLock {
      client ?: Foxlet.create(context.applicationContext).also { client = it }
    }

  /** Built once; let go of when the module goes, along with its loaded model. */
  fun close() {
    val open = client ?: return
    client = null
    runBlocking { open.shutdown() }
  }
}
