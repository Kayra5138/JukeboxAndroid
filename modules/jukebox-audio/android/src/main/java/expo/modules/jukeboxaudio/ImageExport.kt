package expo.modules.jukeboxaudio

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.io.File

/**
 * Puts a picture the app has drawn where the rest of the phone can see it.
 *
 * Both of these take a file the app has already written somewhere private and
 * hand it to the system — the gallery in one case, whatever the reader picks in
 * the other. Neither asks for a permission: from Android 10 a MediaStore entry
 * an app inserts itself belongs to that app and needs none, and the share is a
 * content URI handed over for the length of one intent.
 */
object ImageExport {
  private const val ALBUM = "Jukebox"

  /**
   * Copies the file into the gallery under the app's own album.
   *
   * Written through MediaStore rather than into the pictures directory by
   * path: a file dropped there is not in the gallery until something scans for
   * it, which on a modern Android may be never.
   */
  fun save(context: Context, source: File): Uri {
    if (!source.isFile || source.length() == 0L) throw Told(R.string.jukebox_picture_none)

    val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    } else {
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    }

    val details = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, name())
      put(MediaStore.Images.Media.MIME_TYPE, "image/png")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        put(MediaStore.Images.Media.RELATIVE_PATH, "${android.os.Environment.DIRECTORY_PICTURES}/$ALBUM")
        // Hidden from the gallery until the bytes are all there, so a reader
        // scrolling past cannot catch it half written.
        put(MediaStore.Images.Media.IS_PENDING, 1)
      }
    }

    val resolver = context.contentResolver
    val target = resolver.insert(collection, details) ?: throw Told(R.string.jukebox_picture_gallery)

    runCatching {
      resolver.openOutputStream(target).use { out ->
        val gallery = out ?: throw Told(R.string.jukebox_picture_gallery)
        source.inputStream().use { it.copyTo(gallery) }
      }
    }.onFailure {
      // A half-written entry is worse than none: it shows in the gallery as a
      // broken thumbnail that nothing will ever finish.
      resolver.delete(target, null, null)
      throw it
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      resolver.update(target, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
    }
    return target
  }

  /**
   * Hands the picture to the system's share sheet.
   *
   * Shared from a MediaStore entry rather than from the app's own file, which
   * would need a provider of our own to be readable by anything else. Saving
   * first is not a side effect worth hiding: a picture shared to a chat and
   * nowhere else is one the reader cannot find again.
   */
  fun share(context: Context, source: File) {
    val picture = save(context, source)
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = "image/png"
      putExtra(Intent.EXTRA_STREAM, picture)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(intent, null).apply {
      // Started from outside an activity, so it needs its own task.
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(chooser)
  }

  /**
   * A name that sorts by when it was made and cannot collide.
   *
   * MediaStore will happily take two files of the same name and quietly make
   * the second one "jukebox (1)", which is not what anybody wants to find.
   */
  private fun name(): String {
    val stamp = java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.US)
      .format(java.util.Date())
    return "jukebox-$stamp.png"
  }
}
