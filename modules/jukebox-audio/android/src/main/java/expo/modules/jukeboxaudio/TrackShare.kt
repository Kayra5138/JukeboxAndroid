package expo.modules.jukeboxaudio

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Handing songs to another app: a chat, a mail, a file manager, a phone
 * nearby.
 *
 * The files go as the media store's own addresses, with leave to read them
 * passed on to whatever app is chosen and to nothing else. Nothing is copied
 * and no provider of the app's own is needed: the media store already serves
 * these files to anybody this app vouches for. An address of any other kind
 * -- a file of the app's own, a sound file another app lent it once -- is not
 * this app's to lend, and is left out.
 */
internal object TrackShare {
  /**
   * Offers [addresses] to the app the user picks, under the system's chooser
   * headed [title]. False when none of them could be offered.
   *
   * [asFile] says they are files of no particular kind rather than sounds,
   * which is all a chat goes by: a sound it sends as one to be played where
   * it is, anything else as a document, the file itself, kept as it came.
   */
  fun share(context: Context, addresses: List<String>, title: String, asFile: Boolean = false): Boolean {
    val uris = addresses.map(Uri::parse).filter { it.scheme == "content" }.distinct()
    if (uris.isEmpty()) return false

    val send = if (uris.size == 1) {
      Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
    } else {
      Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
    }
    send.type = if (asFile) "application/octet-stream" else typeOf(context, uris)
    // The grant travels with the clip, which is what the chooser passes on
    // to the app chosen; the extra alone is not read for it everywhere.
    val clip = ClipData.newRawUri(null, uris[0])
    for (uri in uris.drop(1)) clip.addItem(ClipData.Item(uri))
    send.clipData = clip
    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

    val chooser = Intent.createChooser(send, title).apply {
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      // Started from outside an activity, so it needs its own task.
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(chooser)
    return true
  }

  /**
   * The one type all the files are, where they agree; any sound at all
   * where they are sounds of different kinds, which is what an app that
   * takes sound files says it takes; and anything whatever where even that
   * is not so.
   */
  private fun typeOf(context: Context, uris: List<Uri>): String {
    val types = uris.map { runCatching { context.contentResolver.getType(it) }.getOrNull() ?: "audio/*" }.distinct()
    types.singleOrNull()?.let { return it }
    return if (types.all { it.startsWith("audio/") }) "audio/*" else "*/*"
  }
}
