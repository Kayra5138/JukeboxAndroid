package expo.modules.jukeboxaudio.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import expo.modules.jukeboxaudio.PlaybackService
import expo.modules.jukeboxaudio.R
import java.io.File

/**
 * The now-playing widget: the notification's controls, on the home screen.
 *
 * Commands reach playback as media button intents aimed at the session service,
 * which is the same road the notification and a headset button take. Binding a
 * controller from here instead would mean standing up a connection inside a
 * broadcast receiver, which has seconds to live and no good place to wait.
 */
private const val TAG = "JukeboxWidget"

class JukeboxWidget : AppWidgetProvider() {
  companion object {
    private const val ACTION_PREVIOUS = "expo.modules.jukeboxaudio.widget.PREVIOUS"
    private const val ACTION_TOGGLE = "expo.modules.jukeboxaudio.widget.TOGGLE"
    private const val ACTION_NEXT = "expo.modules.jukeboxaudio.widget.NEXT"

    /**
     * Widest a cover is decoded to before it crosses to the launcher.
     *
     * A RemoteViews and everything in it travels in a single binder
     * transaction, and the buffer for one is about a megabyte for the whole
     * process. A full-size cover is several times that on its own and takes the
     * update down with it, so the bitmap is sampled to roughly what the widget
     * can actually show.
     */
    private const val ART_PIXELS = 192

    /** Redraws every placed widget. Called from the service as playback moves. */
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val provider = ComponentName(context.packageName, JukeboxWidget::class.java.name)
      val ids = runCatching { manager.getAppWidgetIds(provider) }.getOrNull() ?: return
      if (ids.isEmpty()) return

      val state = NowPlaying.read(context)
      for (id in ids) manager.updateAppWidget(id, render(context, state, id))
    }

    fun hasWidgets(context: Context): Boolean = runCatching {
      AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, JukeboxWidget::class.java)).isNotEmpty()
    }.getOrDefault(false)

    /** Partial updates carry no bitmaps and never decode artwork on a progress tick. */
    fun progress(context: Context, positionMs: Long, durationMs: Long) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, JukeboxWidget::class.java))
      if (ids.isEmpty()) return
      for (id in ids) {
        val views = RemoteViews(context.packageName, layout(context, id))
        setProgress(views, positionMs, durationMs)
        manager.partiallyUpdateAppWidget(id, views)
      }
    }

    private fun setProgress(views: RemoteViews, positionMs: Long, durationMs: Long) {
      views.setViewVisibility(R.id.jukebox_widget_progress, if (durationMs > 0) View.VISIBLE else View.INVISIBLE)
      views.setProgressBar(R.id.jukebox_widget_progress, 1000, WidgetProgress.value(positionMs, durationMs), false)
    }

    private fun layout(context: Context, id: Int): Int {
      val height = AppWidgetManager.getInstance(context).getAppWidgetOptions(id)
        .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
      return if (height < 90) R.layout.jukebox_widget_compact else R.layout.jukebox_widget
    }

    private fun render(context: Context, state: NowPlaying, id: Int): RemoteViews {
      val views = RemoteViews(context.packageName, layout(context, id))

      val idle = state.title.isNullOrBlank()
      views.setTextViewText(
        R.id.jukebox_widget_title,
        if (idle) context.getString(R.string.jukebox_widget_idle) else state.title
      )
      views.setTextViewText(R.id.jukebox_widget_artist, state.artist.orEmpty())
      views.setImageViewResource(
        R.id.jukebox_widget_toggle,
        if (state.playing) R.drawable.jukebox_ic_pause else R.drawable.jukebox_ic_play
      )

      val cover = state.artworkPath?.let { decodeArtwork(it) }
      views.setImageViewBitmap(R.id.jukebox_widget_glass, WidgetGlass.background(cover, state.artworkPath))
      setProgress(views, state.positionMs, state.durationMs)
      if (cover != null) {
        views.setImageViewBitmap(R.id.jukebox_widget_art, cover)
      } else {
        views.setImageViewResource(
          R.id.jukebox_widget_art,
          R.drawable.jukebox_widget_art_placeholder
        )
      }

      /*
        Always the real commands, whether anything is running or not.

        They used to fall back to opening the app whenever no service was alive,
        on the grounds that a command with nobody to hear it does nothing. That
        was true, and it made the widget useless in exactly the case it exists
        for — the app closed, the phone locked. The service now restores the
        saved queue when a media button reaches it cold, so there is something
        to hear them.
      */
      views.setOnClickPendingIntent(
        R.id.jukebox_widget_previous,
        command(context, ACTION_PREVIOUS)
      )
      views.setOnClickPendingIntent(R.id.jukebox_widget_toggle, command(context, ACTION_TOGGLE))
      views.setOnClickPendingIntent(R.id.jukebox_widget_next, command(context, ACTION_NEXT))

      views.setOnClickPendingIntent(R.id.jukebox_widget_root, launchApp(context))
      return views
    }

    /**
     * Sampled rather than scaled: decoding a cover at full size only to shrink
     * it allocates the large bitmap anyway, which is the part worth avoiding.
     */
    private fun decodeArtwork(path: String): Bitmap? {
      val file = File(path)
      if (!file.isFile) return null

      return runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)

        val widest = maxOf(bounds.outWidth, bounds.outHeight)
        if (widest <= 0) return null

        var sample = 1
        while (widest / (sample * 2) >= ART_PIXELS) sample *= 2

        BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
      }.getOrNull()
    }

    private fun command(context: Context, action: String): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        action.hashCode(),
        Intent(context, JukeboxWidget::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )

    private fun launchApp(context: Context): PendingIntent? {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return null
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    }
  }

  override fun onUpdate(
    context: Context,
    manager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    val state = NowPlaying.read(context)
    for (id in appWidgetIds) manager.updateAppWidget(id, render(context, state, id))
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    manager.updateAppWidget(id, render(context, NowPlaying.read(context), id))
  }

  override fun onReceive(context: Context, intent: Intent) {
    val state = NowPlaying.read(context)

    /*
      Play and pause rather than the one key that means both.

      A toggle asks the player what it is doing, and after the app has been
      closed the player is a fresh one that is doing nothing — so the answer
      to `play/pause` depends on a state the widget cannot see. The icon is
      drawn from what was last written down, so the key is taken from the same
      place: the button does what it looks like it will do.
    */
    val key = when (intent.action) {
      ACTION_PREVIOUS -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
      ACTION_TOGGLE ->
        if (state.playing) KeyEvent.KEYCODE_MEDIA_PAUSE else KeyEvent.KEYCODE_MEDIA_PLAY
      ACTION_NEXT -> KeyEvent.KEYCODE_MEDIA_NEXT
      else -> return super.onReceive(context, intent)
    }

    send(context, key)

    /*
      The service will not have moved yet. Flipping it here keeps the button
      honest under the finger; the service's own update follows and confirms
      or corrects it.
    */
    if (intent.action == ACTION_TOGGLE) {
      NowPlaying.write(context, state.copy(playing = !state.playing))
      refresh(context)
    }
  }

  /**
   * Hands the key to playback, starting the service if it is not running.
   *
   * As a foreground start, which is the whole of what was wrong with this.
   * `startService` from a receiver is a background start, and Android has
   * refused those since Oreo — it wrote `Background start not allowed: ...
   * startFg?=false` to the log and dropped the intent, and the `runCatching`
   * meant to keep a failure from taking the launcher down swallowed that
   * without a word. So the widget drew the last track, took the press, and
   * did nothing, which is exactly what it was reported as doing.
   *
   * A foreground start carries an obligation: the service has a few seconds to
   * post its notification or the system kills it. `PlaybackService` discharges
   * it by playing — see the queue it puts back when a key arrives at an empty
   * player.
   */
  private fun send(context: Context, keyCode: Int) {
    val intent = Intent(Intent.ACTION_MEDIA_BUTTON)
      .setComponent(ComponentName(context, PlaybackService::class.java))
      .putExtra(Intent.EXTRA_KEY_EVENT, KeyEvent(KeyEvent.ACTION_DOWN, keyCode))

    // Still guarded — the allowance is the system's to give, and losing it
    // should not take the launcher down with it — but no longer silent.
    runCatching { ContextCompat.startForegroundService(context, intent) }
      .onFailure { Log.w(TAG, "Widget could not reach playback", it) }
  }
}
