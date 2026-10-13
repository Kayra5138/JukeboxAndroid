package expo.modules.jukeboxaudio.preview

import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection

/**
 * Reads a preview off the network for the player, from the hosts
 * [PreviewSource] allows and from no other.
 *
 * The player's own way of reading an address follows wherever the address
 * sends it, any number of times, to any host, and offers no say in it. For
 * the library's files that does not arise. For an address that came from the
 * network it is the whole question, so this reads it instead: one request,
 * to a host that was checked, and an answer that is the file or is a
 * failure. A redirect is a failure. Deezer does not answer a preview with
 * one, and if it ever does the cost is a preview that does not play — the
 * song is on its way regardless.
 */
@OptIn(UnstableApi::class)
class PreviewDataSource : BaseDataSource(true) {
  class Factory : DataSource.Factory {
    override fun createDataSource(): DataSource = PreviewDataSource()
  }

  private var connection: HttpURLConnection? = null
  private var input: InputStream? = null
  private var uri: Uri? = null
  private var left = C.LENGTH_UNSET.toLong()
  private var opened = false

  override fun open(dataSpec: DataSpec): Long {
    val url = PreviewSource.checked(dataSpec.uri.toString()) ?: throw IOException("Not an address a preview is played from")
    uri = dataSpec.uri
    transferInitializing(dataSpec)
    val asked = (url.openConnection() as HttpURLConnection).apply {
      connectTimeout = 8_000
      readTimeout = 8_000
      instanceFollowRedirects = false
      // Asked for from part way in when the player seeks, which for thirty seconds of sound it hardly does.
      if (dataSpec.position > 0 || dataSpec.length != C.LENGTH_UNSET.toLong()) {
        val end = if (dataSpec.length != C.LENGTH_UNSET.toLong()) (dataSpec.position + dataSpec.length - 1).toString() else ""
        setRequestProperty("Range", "bytes=${dataSpec.position}-$end")
      }
    }
    connection = asked
    val status = asked.responseCode
    if (status != 200 && status != 206) {
      close()
      throw IOException("A preview was answered with $status")
    }
    val stream = asked.inputStream
    input = stream
    // Answered whole when a part was asked for: what comes before the part is read past.
    var skipped = 0L
    if (status == 200 && dataSpec.position > 0) {
      while (skipped < dataSpec.position) {
        val more = stream.skip(dataSpec.position - skipped)
        if (more <= 0) break
        skipped += more
      }
    }
    val whole = asked.contentLengthLong
    left = when {
      dataSpec.length != C.LENGTH_UNSET.toLong() -> dataSpec.length
      whole >= 0 -> (whole - skipped).coerceAtLeast(0)
      else -> C.LENGTH_UNSET.toLong()
    }
    opened = true
    transferStarted(dataSpec)
    return left
  }

  override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
    if (length == 0) return 0
    if (left == 0L) return C.RESULT_END_OF_INPUT
    val stream = input ?: return C.RESULT_END_OF_INPUT
    val want = if (left > 0) minOf(length.toLong(), left).toInt() else length
    val count = stream.read(buffer, offset, want)
    if (count < 0) return C.RESULT_END_OF_INPUT
    if (left > 0) left -= count
    bytesTransferred(count)
    return count
  }

  override fun getUri(): Uri? = uri

  override fun close() {
    runCatching { input?.close() }
    input = null
    runCatching { connection?.disconnect() }
    connection = null
    if (opened) {
      opened = false
      transferEnded()
    }
  }
}
