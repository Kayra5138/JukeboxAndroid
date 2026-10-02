package expo.modules.jukeboxaudio

import android.app.Activity
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

/**
 * Asking the system where a backup should be saved.
 *
 * The system's own "save as" rather than a folder of the app's choosing. A
 * backup is only worth anything somewhere the app is not -- on a card, in a
 * cloud folder, on the way to another phone -- and the place it is put is the
 * user's to pick. It also needs no permission: the app is handed one file it
 * may write and never sees the rest of the storage.
 */
class BackupSave : AppContextActivityResultContract<BackupSave.Input, String?> {
  class Input(val name: String) : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_CREATE_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType("application/zip")
      .putExtra(Intent.EXTRA_TITLE, input.name)

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null
}

/**
 * And which one should be read back.
 *
 * Offered every kind of file rather than only zips. What a file manager or a
 * cloud folder calls a zip varies, and one that has travelled through a chat
 * app often arrives as nothing in particular; filtering by type would hide the
 * very file somebody came to open. Whether it is a backup is decided by
 * reading it.
 */
class BackupOpen : AppContextActivityResultContract<BackupOpen.Input, String?> {
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType("*/*")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null
}
