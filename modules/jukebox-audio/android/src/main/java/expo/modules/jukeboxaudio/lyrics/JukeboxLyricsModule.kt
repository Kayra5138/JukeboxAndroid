package expo.modules.jukeboxaudio.lyrics

import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Lyrics from the phone rather than from the network: the words a song's file
 * carries, and a `.lrc` file kept beside it.
 *
 * A module of its own, as the tag writer is, so that a build from before it
 * is a build without it: JavaScript asks for it by name, gets nothing, and
 * goes to LRCLIB as it always did.
 *
 * Everything that touches a file runs on the IO dispatcher rather than Expo's
 * queue, which is one thread shared by every module, and this is asked each
 * time a song starts.
 */
class JukeboxLyricsModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private var picker: AppContextActivityResultLauncher<FolderPick.Input, String?>? = null

  override fun definition() = ModuleDefinition {
    Name("JukeboxLyrics")

    RegisterActivityContracts {
      picker = registerForActivityResult(FolderPick())
    }

    OnDestroy { picker = null }

    /** The words in track [id]'s own file, as names and values; see [LyricsInFile]. */
    AsyncFunction("readEmbeddedAsync") Coroutine { id: String ->
      withContext(Dispatchers.IO) { LyricsInFile.read(context, id) }
    }

    /**
     * Asks for a folder with the system's picker and keeps the grant. Null when
     * the user backed out; otherwise see [LyricsFolders.adopt].
     */
    AsyncFunction("pickFolderAsync") Coroutine { ->
      val launcher = picker ?: return@Coroutine null
      // Launching raises a system screen, which is a main-thread affair.
      val picked = withContext(Dispatchers.Main) { launcher.launch(FolderPick.Input()) }
        ?: return@Coroutine null
      withContext(Dispatchers.IO) { LyricsFolders.adopt(context, picked) }
    }

    AsyncFunction("grantedFoldersAsync") Coroutine { folders: List<String> ->
      withContext(Dispatchers.IO) { LyricsFolders.granted(context, folders) }
    }

    AsyncFunction("releaseFolderAsync") Coroutine { folder: String ->
      withContext(Dispatchers.IO) { LyricsFolders.release(context, folder) }
    }

    AsyncFunction("siblingsAsync") Coroutine { id: String, folders: List<String> ->
      withContext(Dispatchers.IO) { LyricsFolders.siblings(context, id, folders) }
    }

    AsyncFunction("readDocumentAsync") Coroutine { document: String ->
      withContext(Dispatchers.IO) { LyricsFolders.read(context, document) }
    }
  }
}
