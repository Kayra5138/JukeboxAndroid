package expo.modules.jukeboxaudio

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.MediaStore
import androidx.activity.result.IntentSenderRequest
import androidx.annotation.RequiresApi
import androidx.activity.result.contract.ActivityResultContracts
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

/**
 * Asks the system to delete tracks, and the user to agree.
 *
 * An app can only delete media it created itself. Most of this library was put
 * there by something else — copied from a computer, saved by another app — and
 * for those the media store refuses and hands back a request to show instead.
 * Going through that request for everything keeps one path rather than two, and
 * a confirmation before erasing somebody's music is not friction worth saving.
 *
 * The contract takes ids rather than a prepared request because it is handed a
 * context and builds it there. A request cannot be made ahead of time and
 * carried in: it holds an [android.content.IntentSender], which is not
 * serializable, and this interface requires its input to be.
 */
@RequiresApi(Build.VERSION_CODES.R)
class DeleteRequest : AppContextActivityResultContract<DeleteRequest.Input, Boolean> {
  data class Input(val ids: ArrayList<String>) : Serializable

  override fun createIntent(context: Context, input: Input): Intent {
    val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val uris = input.ids
      .mapNotNull { it.toLongOrNull() }
      .map { ContentUris.withAppendedId(collection, it) }

    val request = MediaStore.createDeleteRequest(context.contentResolver, uris)

    /*
      The shape androidx uses to start an IntentSender through the ordinary
      activity result machinery. Expo's contract has to answer with an Intent,
      and this is the one the host activity already knows how to unwrap.
    */
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
