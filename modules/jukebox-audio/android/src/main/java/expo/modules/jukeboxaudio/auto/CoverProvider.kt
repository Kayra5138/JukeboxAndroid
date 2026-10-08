package expo.modules.jukeboxaudio.auto

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import expo.modules.jukeboxaudio.AlbumArtwork
import expo.modules.jukeboxaudio.Localised
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
  /**
   * A provider is made before anything else in a process, the application
   * included, which makes this the one place that is certain to have run by
   * the time any sentence is wanted: see [Localised.hold].
   */
  override fun onCreate(): Boolean {
    context?.let(Localised::hold)
    return true
  }

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
   * The one the app keeps for it first: what a lookup found, or what somebody
   * chose from their gallery. That is the one every other screen shows, and it
   * is most of them, since a file that arrived without a picture inside it has
   * no other. Then the picture inside the file.
   *
   * Then a cover the app knows only by its web address. The phone shows those
   * straight from the web, and the car had nothing for them at all: it drew a
   * made-up tile for a song the phone had a cover for. So it is fetched here,
   * once, into the same folder the app's own fetching uses, and is a file from
   * then on. Last, whatever a download came with.
   */
  private fun resolve(uri: Uri): File? {
    val context = context ?: return null
    val segments = uri.pathSegments
    if (segments.size != 2 || segments[0] != TRACK) return null
    val trackId = segments[1].takeIf { it.toLongOrNull() != null } ?: return null

    val kept = runCatching { LibraryDatabase.cover(context, trackId) }.getOrNull()
    if (kept != null && kept.startsWith("file://")) own(context, kept)?.let { return it }

    runCatching { MediaStoreLibrary.embeddedArtwork(context, trackId) }.getOrNull()
      ?.let { runCatching { File(java.net.URI(it)) }.getOrNull() }
      ?.takeIf { it.isFile }
      ?.let { return it }

    if (kept != null && kept.startsWith("https://")) fetched(context, kept)?.let { return it }

    val file = runCatching { DownloadStore.artwork(context, trackId) }.getOrNull()
      ?.let { runCatching { File(java.net.URI(it)) }.getOrNull() }
    if (file != null && file.isFile) return file

    // Nothing to show is not the same as nothing to draw. Refusing here leaves
    // the car to fall back on its own broken-image mark, and a shelf of records
    // with two of those in it reads as a fault rather than as a gap.
    return runCatching { Tile.of(context, trackId) }.getOrNull()
  }

  /**
   * A `file://` address as a file, if it is one of the app's own.
   *
   * The address comes out of a database, and this provider is open to other
   * apps. Only a picture inside the app's own folder is ever handed over.
   */
  private fun own(context: Context, address: String): File? =
    runCatching { File(java.net.URI(address)) }.getOrNull()
      ?.takeIf { it.isFile && it.canonicalPath.startsWith(context.filesDir.canonicalPath + File.separator) }

  /**
   * A cover at a web address, fetched and kept.
   *
   * The fetching is the app's own, which only goes to the catalogues it
   * already trusts and refuses anything else. A car asks from a thread of its
   * own, so waiting on the network holds up nothing but that one picture.
   * What could not be fetched is not asked for again for a while: a car in a
   * tunnel draws the same screen many times, and each asking would wait out
   * the same dead connection.
   */
  private fun fetched(context: Context, address: String): File? {
    val now = android.os.SystemClock.elapsedRealtime()
    synchronized(failed) {
      val at = failed[address]
      if (at != null && now - at < RETRY_AFTER_MS) return null
    }
    val file = runCatching { AlbumArtwork.download(context, address) }.getOrNull()?.let { own(context, it) }
    synchronized(failed) { if (file == null) failed[address] = now else failed.remove(address) }
    return file
  }

  companion object {
    private const val RETRY_AFTER_MS = 10 * 60_000L
    private val failed = HashMap<String, Long>()

    private const val TRACK = "track"

    private fun authority(context: Context) = "${context.packageName}.covers"

    /** Where a car should look for [trackId]'s cover. */
    fun uriFor(context: Context, trackId: String): Uri =
      Uri.Builder()
        .scheme("content")
        .authority(authority(context))
        .appendPath(TRACK)
        .appendPath(trackId)
        // A car remembers a picture by its address. The tiles it was shown
        // while this skipped the app's own covers are filed under the old
        // one, and it would go on showing them; a new address asks again.
        .appendQueryParameter("v", "3")
        .build()
  }
}
