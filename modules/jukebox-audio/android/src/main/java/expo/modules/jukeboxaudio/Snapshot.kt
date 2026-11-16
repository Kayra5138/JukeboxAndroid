package expo.modules.jukeboxaudio

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume

/**
 * A picture of part of the screen as it is now, written to a file for an
 * image to show: for a screen to stand still as a picture of itself while a
 * page of glass is over it. The page draws what is behind it through its
 * frost at every frame it moves, and behind it a picture is one thing to
 * draw where the screen it was taken of was a few hundred.
 *
 * Taken from what the window last put on the screen, so it is exactly what
 * was seen, whatever it was drawn with. The place is in points, as React
 * Native measures in the window. Null where it could not be taken: before
 * Android 8, or with no window to take it from.
 */
object Snapshot {
  private const val PREFIX = "snapshot-"

  suspend fun take(context: Context, activity: Activity?, x: Double, y: Double, width: Double, height: Double): String? {
    if (Build.VERSION.SDK_INT < 26 || activity == null) return null
    val density = context.resources.displayMetrics.density
    val rect = Rect((x * density).toInt(), (y * density).toInt(), ((x + width) * density).toInt(), ((y + height) * density).toInt())
    if (rect.width() <= 0 || rect.height() <= 0) return null
    val bitmap = Bitmap.createBitmap(rect.width(), rect.height(), Bitmap.Config.ARGB_8888)
    val copied = suspendCancellableCoroutine { going ->
      try {
        PixelCopy.request(activity.window, rect, bitmap, { result -> going.resume(result == PixelCopy.SUCCESS) }, Handler(Looper.getMainLooper()))
      } catch (_: IllegalArgumentException) {
        going.resume(false)
      }
    }
    if (!copied) {
      bitmap.recycle()
      return null
    }
    return withContext(Dispatchers.IO) {
      val folder = context.cacheDir
      // The last one taken goes: only one is ever shown, and a new name keeps an image from showing the old.
      folder.listFiles { file -> file.name.startsWith(PREFIX) }?.forEach { it.delete() }
      val file = File(folder, "$PREFIX${System.currentTimeMillis()}.jpg")
      file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 88, it) }
      bitmap.recycle()
      "file://${file.absolutePath}"
    }
  }
}
