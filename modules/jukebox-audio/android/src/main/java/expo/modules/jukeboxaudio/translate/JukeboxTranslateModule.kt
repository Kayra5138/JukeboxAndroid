package expo.modules.jukeboxaudio.translate

import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * On-device translation, for putting lyrics into a language the listener reads.
 *
 * Every call blocks on a task, so all of it runs on an IO queue rather than the
 * thread JavaScript is waiting on.
 *
 * Bergamot does this, and nothing else does. It is Mozilla's engine and
 * Mozilla's models, free software like the rest of the app — which ML Kit, the
 * proprietary thing that used to sit behind here as a fallback, was not.
 *
 * The engine is built for 64-bit ARM and no other architecture, so on anything
 * else there is no translation to be had and [bergamot] is false for the life
 * of the process. Every language then answers unsupported, which the screen
 * shows as lyrics with nothing under them — the translate button is still
 * there and still turns on, it simply has nothing to reveal. That is worth
 * knowing about rather than worth hiding: the alternative was keeping a
 * proprietary engine in the build for the sake of architectures that are
 * emulators and phones from a decade ago.
 */
private const val TAG = "JukeboxTranslate"

class JukeboxTranslateModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val io = CoroutineScope(Dispatchers.IO + SupervisorJob())

  /**
   * Asked once and remembered, because finding out costs building the engine
   * and the answer cannot change while the app is running.
   */
  private val bergamot by lazy {
    BergamotTranslator.isUsable(context).also { Log.i(TAG, "Bergamot usable: $it") }
  }

  override fun definition() = ModuleDefinition {
    Name("JukeboxTranslate")
    OnDestroy {
      BergamotTranslator.close()
      io.cancel()
    }

    AsyncFunction("isSupportedAsync") { language: String ->
      bergamot && BergamotTranslator.isSupported(context, language)
    }.runOnQueue(io)

    AsyncFunction("isModelReadyAsync") { language: String ->
      bergamot && BergamotTranslator.isModelReady(context, language)
    }.runOnQueue(io)

    /*
      The three below ask about both ends. The two above only ever asked
      whether a language could be read, with English taken as where it was
      going, which was the whole question while English was the only place
      lyrics went. They are kept as they were for callers that still mean that.
    */
    AsyncFunction("isTargetSupportedAsync") { target: String ->
      bergamot && BergamotTranslator.isTargetSupported(context, target)
    }.runOnQueue(io)

    AsyncFunction("isPairSupportedAsync") { source: String, target: String ->
      bergamot && BergamotTranslator.isPairSupported(context, source, target)
    }.runOnQueue(io)

    AsyncFunction("isPairReadyAsync") { source: String, target: String ->
      bergamot && BergamotTranslator.isPairReady(context, source, target)
    }.runOnQueue(io)

    AsyncFunction("translateLinesAsync") { lines: List<String>, source: String, target: String ->
      // Logged because a failure here is otherwise invisible: the screen simply
      // shows no translation, which is also what an unsupported language looks
      // like, and the two want different answers from whoever is debugging it.
      BergamotTranslator.translate(context, lines, source, target).also {
        Log.i(TAG, "Translated ${lines.size} lines from $source to $target")
      }
    }.runOnQueue(io)
  }
}
