package expo.modules.jukeboxaudio.tags

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.RequiresApi
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

/** Every volume, as the library reads it: a song on a card is still a song. */
internal val AUDIO: Uri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)

/**
 * Asks the system to let these tracks be changed, and the user to agree.
 *
 * The same arrangement deleting has, see [expo.modules.jukeboxaudio.DeleteRequest],
 * and for the same reason: most of a library was put on the phone by
 * something else, and an app may only alter media it made itself. The app
 * holds no permission to write to storage and this does not give it one. What
 * the user grants is these files, this once; it lapses by itself, and the
 * next time anything is to be written they are asked again.
 *
 * Android 11 and later. Android 10 has no such request -- there the system
 * has to be provoked into offering one, a file at a time, by attempting the
 * write and catching the refusal -- and rather than carry a second road that
 * nothing here can be tested on, writing to files is simply not offered
 * there.
 */
@RequiresApi(Build.VERSION_CODES.R)
class WriteRequest : AppContextActivityResultContract<WriteRequest.Input, Boolean> {
  data class Input(val ids: ArrayList<String>) : Serializable

  override fun createIntent(context: Context, input: Input): Intent {
    val uris = input.ids
      .mapNotNull { it.toLongOrNull() }
      .map { ContentUris.withAppendedId(AUDIO, it) }

    val request = MediaStore.createWriteRequest(context.contentResolver, uris)

    // The shape androidx uses to start an IntentSender through the ordinary
    // activity result machinery, as the delete request does.
    return Intent(ActivityResultContracts.StartIntentSenderForResult.ACTION_INTENT_SENDER_REQUEST)
      .putExtra(
        ActivityResultContracts.StartIntentSenderForResult.EXTRA_INTENT_SENDER_REQUEST,
        IntentSenderRequest.Builder(request.intentSender).build()
      )
  }

  /** False when the user said no, which is an answer rather than a failure. */
  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): Boolean =
    resultCode == Activity.RESULT_OK
}
