package expo.modules.jukeboxaudio.auto

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import expo.modules.jukeboxaudio.MediaStoreLibrary
import expo.modules.jukeboxaudio.downloads.DownloadStore
import java.io.File

/**
 * Covers, for the one caller that lives in another process.
 *
 * Everywhere else in the app a cover is a plain path under `filesDir` or
 * `cacheDir`, which is fine while the reader is this app: the widget and the
 * player open those files directly. A car does not. Android Auto runs as
 * another user id and cannot open a private file however correct the path in
 * the metadata is, so a browse list handed a `file://` cover draws a blank
 * square — which is exactly what the car was doing.
 *
 * So the same pictures are offered again through the one channel that does
 * cross: a read-only provider, addressed by track rather than by path.
 *
 * Addressed by track for two reasons. A caller can ask for nothing but a track
 * that exists — there is no path to walk out of, so no traversal to defend
 * against. And nothing has to be found in advance: building a list of a
 * thousand songs costs nothing extra, because a cover is only looked for when
 * the car actually draws one, on the binder thread it asked from rather than
 * on the thread answering the browse.
 */
class CoverProvider : ContentProvider() {
  override fun onCreate(): Boolean = true

  override fun getType(uri: Uri): String = "image/jpeg"

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
    // Read-only in the strict sense: not "writes are ignored" but "a writer is
    // told no", so nothing can quietly believe it has saved a cover here.
    if (mode != "r") throw java.io.FileNotFoundException("Covers are read-only.")
    val file = resolve(uri) ?: throw java.io.FileNotFoundException("No cover for $uri")
    return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
  }

  /**
   * Image loaders ask what a file is called and how big it is before opening
   * it, and a provider that answers nothing is treated as having no file.
   */
  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?
  ): Cursor? {
    val file = resolve(uri) ?: return null
    val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
    return MatrixCursor(columns).apply {
      addRow(columns.map {
        when (it) {
          OpenableColumns.DISPLAY_NAME -> file.name
          OpenableColumns.SIZE -> file.length()
          else -> null
        }
      }.toTypedArray())
    }
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri? =
    throw UnsupportedOperationException("Covers are read-only.")

  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int =
    throw UnsupportedOperationException("Covers are read-only.")

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int =
    throw UnsupportedOperationException("Covers are read-only.")

  /**
   * The cover for a track, in the order the rest of the app prefers them.
   *
   * The picture inside the file first, because that is the one every other
   * screen shows, and a car disagreeing with the phone about what a record
   * looks like would be worse than no picture at all.
   */
  private fun resolve(uri: Uri): File? {
    val context = context ?: return null
    val segments = uri.pathSegments
    if (segments.size != 2 || segments[0] != TRACK) return null
    val trackId = segments[1].takeIf { it.toLongOrNull() != null } ?: return null

    val found = runCatching { MediaStoreLibrary.embeddedArtwork(context, trackId) }.getOrNull()
      ?: runCatching { DownloadStore.artwork(context, trackId) }.getOrNull()

    val file = found?.let { runCatching { File(java.net.URI(it)) }.getOrNull() }
    if (file != null && file.isFile) return file

    // Nothing to show is not the same as nothing to draw. Refusing here leaves
    // the car to fall back on its own broken-image mark, and a shelf of records
    // with two of those in it reads as a fault rather than as a gap.
    return runCatching { Tile.of(context, trackId) }.getOrNull()
  }

  companion object {
    private const val TRACK = "track"

    private fun authority(context: Context) = "${context.packageName}.covers"

    /** Where a car should look for [trackId]'s cover. */
    fun uriFor(context: Context, trackId: String): Uri =
      Uri.Builder()
        .scheme("content")
        .authority(authority(context))
        .appendPath(TRACK)
        .appendPath(trackId)
        .build()
  }
}
