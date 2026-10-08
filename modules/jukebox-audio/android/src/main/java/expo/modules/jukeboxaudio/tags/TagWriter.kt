package expo.modules.jukeboxaudio.tags

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaScannerConnection
import android.net.Uri
import android.provider.MediaStore
import android.system.Os
import android.util.Log
import expo.modules.jukeboxaudio.Localised
import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.Told
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileDescriptor
import java.io.FileInputStream
import java.io.RandomAccessFile
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

private const val TAG = "JukeboxTags"

/** Room left over and above what the arithmetic says is needed. */
private const val MARGIN = 8L * 1024 * 1024

/**
 * The largest picture that will be put in a file. A FLAC block cannot hold
 * sixteen megabytes and TagLib drops one that will not fit without a word;
 * nothing the app stores as a cover comes anywhere near either figure.
 */
private const val LARGEST_COVER = 8 * 1024 * 1024

/**
 * Writes what the app shows for a track into the track's own file, without
 * ever leaving that file half written if it can possibly be helped.
 *
 * The file is the user's and, as likely as not, the only copy there is of it.
 * So nothing is done to it until there is something known to be good to put
 * in its place:
 *
 *  1. It is copied into the app's cache, and the copy is what TagLib is
 *     pointed at.
 *  2. The copy is read back and held to what was asked ([verify]), and the
 *     sound in it is compared byte for byte with the sound in the original
 *     ([Sound.complaint]).
 *  3. Only then is the copy laid over the original ([Sound.replace]), forced
 *     to the disc, and the original read once more against the copy.
 *
 * Anything going wrong in the first two steps leaves the original exactly as
 * it was, and that is said. The third is the only one that touches it. If
 * that one fails it is tried again from the start; if it fails twice the
 * finished copy is moved out of the cache, where the system might clear it
 * away, to somewhere it will stay and can be reached from a computer, and the
 * answer says where.
 */
internal object TagWriter {
  /**
   * One file at a time, whoever asks. The working folder is swept at the
   * start of each write and two at once would sweep each other's copies.
   */
  private val turn = Any()

  /** The media store's own descriptor, read and written at a position. */
  private class Descriptor(private val fd: FileDescriptor) : Writable {
    override val size get() = Os.fstat(fd).st_size

    override fun read(at: Long, into: ByteArray, count: Int): Int {
      var done = 0
      while (done < count) {
        val got = Os.pread(fd, into, done, count - done, at + done)
        if (got <= 0) break
        done += got
      }
      return done
    }

    override fun write(at: Long, from: ByteArray, count: Int) {
      var done = 0
      while (done < count) done += Os.pwrite(fd, from, done, count - done, at + done)
    }

    override fun truncate(size: Long) = Os.ftruncate(fd, size)
    override fun sync() = Os.fsync(fd)

    /** How many bytes the volume this file is on still has free. */
    fun room(): Long = Os.fstatvfs(fd).let { it.f_bavail * it.f_frsize }
  }

  private class Picture(val bytes: ByteArray, val mime: String, val width: Int, val height: Int)

  private fun ByteArray.startsWith(vararg bytes: Int) =
    size >= bytes.size && bytes.indices.all { this[it] == bytes[it].toByte() }

  /**
   * The app's cover for the track, as it will go into the file.
   *
   * A JPEG or a PNG goes in as it is stored, since those are the two kinds
   * every player draws. Anything else -- a lookup can save whatever the
   * catalogue served, WebP included -- is drawn once and written out as a
   * JPEG, here and only for the file: the app's own copy is not touched.
   *
   * Only ever a file of the app's own. A cover known by a web address is not
   * fetched for this, and one the file already carries is the file's.
   */
  private fun cover(context: Context, source: String?): Picture? {
    if (source == null) return null
    val file = File(Uri.parse(source).path ?: throw Refusal(R.string.jukebox_tags_cover_missing))
    val own = listOf(context.filesDir, context.cacheDir).any { file.canonicalPath.startsWith(it.canonicalPath + File.separator) }
    if (!own || !file.isFile) throw Refusal(R.string.jukebox_tags_cover_missing)
    if (file.length() > LARGEST_COVER) throw Refusal(R.string.jukebox_tags_cover_too_large)

    var bytes = file.readBytes()
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw Refusal(R.string.jukebox_tags_cover_unreadable)

    val mime = when {
      bytes.startsWith(0xFF, 0xD8, 0xFF) -> "image/jpeg"
      bytes.startsWith(0x89, 0x50, 0x4E, 0x47) -> "image/png"
      else -> {
        val drawn = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          ?: throw Refusal(R.string.jukebox_tags_cover_unreadable)
        bytes = ByteArrayOutputStream().use { out ->
          drawn.compress(Bitmap.CompressFormat.JPEG, 90, out)
          out.toByteArray()
        }
        drawn.recycle()
        "image/jpeg"
      }
    }
    return Picture(bytes, mime, bounds.outWidth, bounds.outHeight)
  }

  private class Row(val name: String, val path: String?)

  private fun row(context: Context, uri: Uri): Row? =
    context.contentResolver.query(
      uri,
      // DATA is deprecated for opening files, which this does not do with it:
      // it is the one way to tell the scanner which file to look at again.
      @Suppress("DEPRECATION")
      arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.DATA),
      null, null, null
    )?.use { cursor ->
      if (cursor.moveToFirst()) Row(cursor.getString(0) ?: "track", cursor.getString(1)) else null
    }

  /**
   * Has the media store read the file again, and waits for it.
   *
   * Closing a descriptor that was opened for writing already makes the store
   * rescan, on the versions this runs on; asking outright as well costs
   * nothing and means the wait below is for something. The store's title and
   * artist are what the rest of the phone shows for the song, and what this
   * app compares against to know a file again, so the caller should not go on
   * to read the row until it has caught up. Five seconds and no longer: a
   * scan that has not answered by then will still finish, and nothing is
   * wrong with the file in the meantime.
   */
  private fun rescan(context: Context, path: String?) {
    if (path == null) return
    val done = CountDownLatch(1)
    runCatching {
      MediaScannerConnection.scanFile(context, arrayOf(path), null) { _, _ -> done.countDown() }
      done.await(5, TimeUnit.SECONDS)
    }
  }

  private fun answer(status: String, reason: String? = null, changed: Set<String> = emptySet(), kept: String? = null) =
    mapOf("status" to status, "reason" to reason, "changed" to changed.toList(), "kept" to kept)

  /**
   * Writes [wanted], and the picture at [coverSource] if there is one, into
   * track [id].
   *
   * Never throws for anything a file can do. The answer is a status --
   * `written`, `unchanged` for a file that already said all of it,
   * `unsupported` for one that is not an MP3 or a FLAC, `failed` -- with a
   * reason fit to show, the names of what was changed, and where a finished
   * copy was kept if the last step could not be completed.
   */
  fun write(context: Context, id: String, wanted: Wanted, coverSource: String?): Map<String, Any?> = synchronized(turn) {
    val number = id.toLongOrNull() ?: return answer("failed", Localised.text(context, R.string.jukebox_tags_not_in_library))
    val uri = ContentUris.withAppendedId(AUDIO, number)
    val resolver = context.contentResolver

    val work = File(context.cacheDir, "tag-write")
    work.deleteRecursively()
    if (!work.mkdirs()) return answer("failed", Localised.text(context, R.string.jukebox_tags_cache))
    val copy = File(work, "$id.audio")
    // Which side of the one step that matters a failure fell on.
    var touched = false
    var written = false
    var changed = emptySet<String>()

    try {
      val row = row(context, uri) ?: throw Refusal(R.string.jukebox_tags_gone)
      val picture = cover(context, coverSource)
      if (wanted.empty && picture == null) return answer("unchanged")

      // ---- a copy, and everything done to the copy ----

      resolver.openFileDescriptor(uri, "r")?.use { source ->
        val size = source.statSize
        val needed = size + (picture?.bytes?.size ?: 0) + MARGIN
        if (context.cacheDir.usableSpace < needed) {
          throw Refusal(R.string.jukebox_tags_no_room_for_copy)
        }
        FileInputStream(source.fileDescriptor).use { input ->
          copy.outputStream().use { output ->
            input.copyTo(output, 256 * 1024)
            output.fd.sync()
          }
        }
        if (copy.length() != size) throw Refusal(R.string.jukebox_tags_copy_incomplete)
      } ?: throw Refusal(R.string.jukebox_tags_not_opened)

      val before = try {
        TagReport.parse(Tags.read(copy.path))
      } catch (refusal: Refusal) {
        return answer("unsupported", Localised.text(context, refusal.words))
      }
      changed = changedBy(
        Tags.write(copy.path, wanted.fields(), picture?.bytes, picture?.mime, picture?.width ?: 0, picture?.height ?: 0)
      )
      if (changed.isEmpty()) return answer("unchanged")

      val after = TagReport.parse(Tags.read(copy.path))
      verify(before, after, wanted, changed, picture?.let { pictureLine(3, it.bytes) })?.let { throw Refusal(it) }

      RandomAccessFile(copy, "r").use { finished ->
        val made = ChannelBytes(finished.channel)

        resolver.openFileDescriptor(uri, "r")?.use { source ->
          Sound.complaint(before.format, Descriptor(source.fileDescriptor), made)?.let { throw Refusal(it) }
        } ?: throw Refusal(R.string.jukebox_tags_not_opened)

        // ---- the original ----

        val target = try {
          resolver.openFileDescriptor(uri, "rw") ?: throw Refusal(R.string.jukebox_tags_not_opened_for_writing)
        } catch (denied: SecurityException) {
          throw Refusal(R.string.jukebox_tags_denied)
        }
        target.use {
          val original = Descriptor(target.fileDescriptor)
          val growth = made.size - original.size
          if (growth > 0 && original.room() < growth + MARGIN) {
            throw Refusal(R.string.jukebox_tags_no_room_for_file)
          }

          // From here on the original is being changed, and a failure is no
          // longer one that leaves it as it was.
          touched = true
          var failure: Throwable? = null
          for (attempt in 1..2) {
            // Safe to do twice: it only ever moves the original towards the copy.
            failure = runCatching {
              Sound.replace(made, original)
              if (original.size != made.size || !Sound.same(made, 0, original, 0, made.size)) {
                throw Told(R.string.jukebox_tags_not_as_written)
              }
            }.exceptionOrNull()
            if (failure == null) break
            Log.w(TAG, "Writing $id back failed (attempt $attempt)", failure)
          }

          if (failure != null) {
            val kept = rescue(context, copy, row.name)
            return answer(
              "failed",
              (failure.message ?: Localised.text(context, R.string.jukebox_tags_cut_short)).let { why ->
                if (kept != null) Localised.text(context, R.string.jukebox_tags_partly_kept, why, kept)
                else Localised.text(context, R.string.jukebox_tags_partly_lost, why)
              },
              kept = kept
            )
          }
          written = true
        }
      }

      rescan(context, row.path)
      return answer("written", changed = changed)
    } catch (refusal: Refusal) {
      // Every refusal is thrown before a byte of the original is written.
      return answer("failed", Localised.text(context, R.string.jukebox_tags_untouched, refusal.words))
    } catch (error: Exception) {
      // Written and checked, and then something minor went wrong on the way
      // out -- closing a descriptor, say. The file is right; say so.
      if (written) return answer("written", changed = changed)
      Log.w(TAG, "Writing $id failed", error)
      val what = error.message ?: error.javaClass.simpleName
      return if (touched) answer("failed", Localised.text(context, R.string.jukebox_tags_maybe_partly, what))
      else answer("failed", Localised.text(context, R.string.jukebox_tags_untouched_after, what))
    } finally {
      work.deleteRecursively()
    }
  }

  /**
   * Moves a finished copy out of the cache to where it will be kept.
   *
   * The app's folder on shared storage, which the system does not clear and
   * which shows up over USB under `Android/data`. Named after the song, so
   * that whoever goes looking can tell which it is. Null if even that cannot
   * be done, which leaves nothing to point at.
   */
  private fun rescue(context: Context, copy: File, name: String): String? = runCatching {
    val home = File(context.getExternalFilesDir(null) ?: context.filesDir, "rescued").apply { mkdirs() }
    val kept = File(home, name.replace('/', '_'))
    kept.delete()
    if (!copy.renameTo(kept)) {
      copy.copyTo(kept, overwrite = true)
    }
    kept.absolutePath
  }.onFailure { Log.w(TAG, "Could not keep the finished copy of $name", it) }.getOrNull()
}
