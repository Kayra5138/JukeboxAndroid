package expo.modules.jukeboxaudio.lists

import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Lists as files: M3U playlists brought in from other players and written
 * out for them.
 *
 * A module of its own, as the lyrics reader is, so that a build from before
 * it is a build without it: JavaScript asks for it by name, gets nothing, and
 * the lists tab simply does not offer to import or export.
 *
 * What the files say and which songs they mean is decided in TypeScript
 * (`src/lib/playlists/m3u/`); this only fetches and writes bytes, on the IO
 * dispatcher rather than Expo's one shared queue.
 */
class JukeboxListsModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private var opener: AppContextActivityResultLauncher<ListFilesOpen.Input, List<String>>? = null
  private var saver: AppContextActivityResultLauncher<ListFileSave.Input, String?>? = null
  private var folder: AppContextActivityResultLauncher<ListFolderPick.Input, String?>? = null

  override fun definition() = ModuleDefinition {
    Name("JukeboxLists")

    RegisterActivityContracts {
      opener = registerForActivityResult(ListFilesOpen())
      saver = registerForActivityResult(ListFileSave())
      folder = registerForActivityResult(ListFolderPick())
    }

    OnDestroy {
      opener = null
      saver = null
      folder = null
    }

    /** Lets the user pick playlists and answers each one's bytes and whereabouts; empty if they backed out. */
    AsyncFunction("pickListFilesAsync") Coroutine { ->
      val launcher = opener ?: return@Coroutine emptyList<Map<String, Any?>>()
      // Launching raises a system screen, which is a main-thread affair.
      val picked = withContext(Dispatchers.Main) { launcher.launch(ListFilesOpen.Input()) }
      withContext(Dispatchers.IO) { picked.map { ListFiles.read(context, it) } }
    }

    /** The whole path of each track under [rootFolder], by id; see [ListFiles.trackPaths]. */
    AsyncFunction("trackPathsAsync") Coroutine { rootFolder: String ->
      withContext(Dispatchers.IO) { ListFiles.trackPaths(context, rootFolder) }
    }

    /** Asks where to save one playlist and writes it there. False when the user backed out. */
    AsyncFunction("saveListFileAsync") Coroutine { name: String, text: String ->
      val launcher = saver ?: return@Coroutine false
      val target = withContext(Dispatchers.Main) { launcher.launch(ListFileSave.Input(name)) }
        ?: return@Coroutine false
      withContext(Dispatchers.IO) { ListFiles.write(context, target, text) }
      true
    }

    /**
     * Asks for a folder and writes every playlist into it; null when the user
     * backed out. See [ListFiles.writeAll] for the answer.
     */
    AsyncFunction("saveListFilesAsync") Coroutine { names: List<String>, texts: List<String> ->
      val launcher = folder ?: return@Coroutine null
      val tree = withContext(Dispatchers.Main) { launcher.launch(ListFolderPick.Input()) }
        ?: return@Coroutine null
      withContext(Dispatchers.IO) { ListFiles.writeAll(context, tree, names, texts) }
    }
  }
}
