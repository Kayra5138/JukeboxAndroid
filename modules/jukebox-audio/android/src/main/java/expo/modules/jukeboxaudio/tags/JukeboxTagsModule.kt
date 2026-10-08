package expo.modules.jukeboxaudio.tags

import android.os.Build
import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.Told
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Writing a track's details into the file itself.
 *
 * A module of its own rather than more of the audio one, which is long
 * enough, and so that a build from before this existed is simply a build
 * without it: JavaScript asks for the module by name and gets nothing.
 *
 * Two calls, and they are separate on purpose. Asking the user is one
 * question about a whole run of files, and writing is done a file at a time
 * so that whoever is waiting can be shown how far it has got and told, file
 * by file, what became of each.
 */
class JukeboxTagsModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private var asker: AppContextActivityResultLauncher<WriteRequest.Input, Boolean>? = null

  override fun definition() = ModuleDefinition {
    Name("JukeboxTags")

    /**
     * Whether files can be written to on this phone at all: Android 11 or
     * later, for the consent request, and a build with the library in it.
     * False is not an error, it is the action not being offered.
     */
    Constant("supported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Tags.ready }

    RegisterActivityContracts {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        asker = registerForActivityResult(WriteRequest())
      }
    }

    OnDestroy { asker = null }

    /**
     * Asks the user whether these tracks may be changed. Answers with what
     * they said; a refusal is an ordinary outcome and nothing is written.
     */
    AsyncFunction("requestWriteAsync") Coroutine { ids: List<String> ->
      val launcher = asker
        ?: throw Told(R.string.jukebox_tags_needs_11)
      if (ids.isEmpty()) return@Coroutine false
      // Launching raises a system dialog, which is a main-thread affair.
      withContext(Dispatchers.Main) {
        launcher.launch(WriteRequest.Input(ArrayList(ids)))
      }
    }

    /**
     * Writes one track. [details] holds any of title, artist, album, genre,
     * year, track and disc, and `cover` as the `file://` address of a picture
     * the app has saved. See [TagWriter.write] for what comes back.
     *
     * On the IO dispatcher and not Expo's queue, which is one thread shared
     * by every module: a FLAC is copied twice over in here.
     */
    AsyncFunction("writeAsync") Coroutine { id: String, details: Map<String, Any?> ->
      if (!Tags.ready) throw Told(R.string.jukebox_tags_no_build)
      withContext(Dispatchers.IO) {
        TagWriter.write(context, id, Wanted.from(details), details["cover"] as? String)
      }
    }
  }
}
