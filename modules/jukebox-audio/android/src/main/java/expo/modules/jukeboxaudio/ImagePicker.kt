package expo.modules.jukeboxaudio

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.File
import java.io.Serializable
import java.security.MessageDigest

/**
 * The system picker, filtered to images, for a cover chosen by hand.
 *
 * What comes back is copied rather than referred to. A picked uri carries a
 * read grant that lasts as long as the task and no longer, so a list wearing
 * one would lose its picture the next time the app was started — and the file
 * behind it belongs to the user, who is free to move or delete it. A copy in
 * the app's own storage is the only version that outlives both.
 */
class ImagePicker : AppContextActivityResultContract<ImagePicker.Input, String?> {
  /** Nothing to choose, but the contract needs something serialisable. */
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType("image/*")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null

  companion object {
    /**
     * The longest edge a stored cover is given.
     *
     * Covers are drawn at ninety-six points at the very largest, so this is
     * already generous. It matters because the alternative was a size limit,
     * and a photograph off a modern phone walks straight through any limit
     * worth setting — which is how choosing a picture came to do nothing at
     * all for some pictures and work for others.
     */
    private const val MAX_EDGE = 1_200

    /**
     * Copies [source] into the app's artwork directory and answers where it
     * landed.
     *
     * Decoded and re-encoded rather than copied byte for byte. A cover is a
     * thumbnail and the file behind it is a photograph; keeping the original
     * would store fifty megapixels to draw ninety-six points, and refusing the
     * original — which is what this used to do — fails on exactly the pictures
     * a person is most likely to pick.
     *
     * Throws with something worth reading when it cannot. Returning null for
     * both failure and a user backing out is what made this silent: the sheet
     * closed either way and nothing said which had happened.
     */
    fun adopt(context: Context, source: String): String {
      val uri = Uri.parse(source)
      val directory = File(context.filesDir, "album-artwork").apply { mkdirs() }

      // Named after the bytes that were picked, so the same picture chosen
      // twice costs one file — and so the name only exists once there is
      // something behind it.
      val digest = MessageDigest.getInstance("SHA-256")
      context.contentResolver.openInputStream(uri)?.use { input ->
        val bytes = ByteArray(64 * 1024)
        while (true) {
          val count = input.read(bytes)
          if (count < 0) break
          digest.update(bytes, 0, count)
        }
      } ?: throw Told(R.string.jukebox_picture_not_opened)

      val name = digest.digest().joinToString("") { "%02x".format(it) }
      val target = File(directory, "$name.jpg")
      if (target.isFile && target.length() > 0) return Uri.fromFile(target).toString()

      // Measured before it is decoded, so a photograph is never held in memory
      // at its full size just to be shrunk.
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      context.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, bounds)
      }
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
        throw Told(R.string.jukebox_picture_not_one)
      }

      val options = BitmapFactory.Options().apply {
        inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight)
      }
      val decoded = context.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, options)
      } ?: throw Told(R.string.jukebox_picture_not_read)

      try {
        val scaled = fit(decoded)
        try {
          val temporary = File.createTempFile("picked-", ".tmp", directory)
          try {
            temporary.outputStream().use { output ->
              if (!scaled.compress(Bitmap.CompressFormat.JPEG, 90, output)) {
                throw Told(R.string.jukebox_picture_not_saved)
              }
            }
            if (!temporary.renameTo(target)) throw Told(R.string.jukebox_picture_not_saved)
          } finally {
            temporary.delete()
          }
        } finally {
          if (scaled !== decoded) scaled.recycle()
        }
      } finally {
        decoded.recycle()
      }

      return Uri.fromFile(target).toString()
    }

    /** The power of two that gets the picture near its target in one decode. */
    private fun sampleSize(width: Int, height: Int): Int {
      var sample = 1
      while (maxOf(width, height) / (sample * 2) >= MAX_EDGE) sample *= 2
      return sample
    }

    /** The rest of the way down, since sampling only halves. */
    private fun fit(bitmap: Bitmap): Bitmap {
      val longest = maxOf(bitmap.width, bitmap.height)
      if (longest <= MAX_EDGE) return bitmap
      val scale = MAX_EDGE.toDouble() / longest
      return Bitmap.createScaledBitmap(
        bitmap,
        (bitmap.width * scale).toInt().coerceAtLeast(1),
        (bitmap.height * scale).toInt().coerceAtLeast(1),
        /* filter = */ true
      )
    }
  }
}
