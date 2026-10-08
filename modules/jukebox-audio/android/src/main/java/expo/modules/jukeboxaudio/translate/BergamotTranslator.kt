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
  /** The language every model has on one side, and so the way from any language to any other. */
  private const val PIVOT = "en"

  /**
   * The models it takes to get from [source] to [target], in order.
   *
   * None for a language into itself, one where either end is English, two
   * otherwise. English lyrics read in Turkish are the case that matters:
   * that is one model, English to Turkish, and asking for an "English to
   * English" one first — which is what treating every translation as two
   * hops comes to — is asking for a model nobody publishes.
   */
  internal fun hops(source: String, target: String): List<Pair<String, String>> = when {
    source == target -> emptyList()
    source == PIVOT -> listOf(PIVOT to target)
    target == PIVOT -> listOf(source to PIVOT)
    else -> listOf(source to PIVOT, PIVOT to target)
  }

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
   * False for a language lyrics cannot be put into.
   *
   * The other half of [isSupported], which only ever asked about reading a
   * language and took English as where it was going. English itself needs no
   * model and is always true.
   */
  fun isTargetSupported(context: Context, target: String): Boolean =
    target == PIVOT || isPairSupported(context, PIVOT, target)

  /** True when every model between [source] and [target] is one Mozilla publishes. */
  fun isPairSupported(context: Context, source: String, target: String): Boolean = runBlocking {
    val models = engine(context).models
    hops(source, target).all { (from, into) -> models.findBundled(LanguagePair(from, into)) != null }
  }

  /** True when every model between [source] and [target] is already on the device. */
  fun isPairReady(context: Context, source: String, target: String): Boolean = runBlocking {
    val models = engine(context).models
    hops(source, target).all { (from, into) -> models.findUsable(LanguagePair(from, into)) != null }
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
      val spoken = lines.filter { it.isNotBlank() }
      if (spoken.isEmpty()) return@runBlocking lines

      // Downloads each if it is not already here. Deliberately not restricted
      // to wifi: the download only ever happens because someone asked for a
      // translation, and a condition that silently refuses to be met would look
      // exactly like the feature being broken.
      val models = hops(source, target).map { (from, into) -> foxlet.models.prepare(LanguagePair(from, into)) }

      val said = if (models.size == 1) {
        foxlet.translator.translate(spoken, models[0], TextFormat.Plain)
      } else {
        // Every model has English on one side, so anything else is two hops.
        foxlet.translator.translatePivot(spoken, models[0], models[1], TextFormat.Plain)
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
