package expo.modules.jukeboxaudio.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import expo.modules.jukeboxaudio.Localised
import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.auto.BrowseTree
import java.io.File

/**
 * A tile that starts the music in one press: everything shuffled, or what was
 * played lately shuffled.
 *
 * The same two the car offers on its first screen, and answered the same way:
 * the service asks [BrowseTree.resolve] for the shelf and plays what it says.
 * So the tile needs no list of its own, and works on a phone where the app has
 * not been opened since it was switched on — the library is read from the
 * app's database by the service, as the car reads it.
 *
 * Without a choice of list to start. Choosing one would mean a screen to
 * choose it on, run before the widget is placed — an activity of its own
 * that has to look like the app in the app's theme, which only JavaScript
 * knows — and a widget that goes quietly dead when that list is deleted.
 * "What I played lately" covers most of what a pinned list was for, and
 * needs nothing chosen.
 */
private const val TAG = "JukeboxShortcut"

class JukeboxShortcutWidget : AppWidgetProvider() {
  companion object {
    /** Narrower than this the tile is one cell, and has room for one half. */
    private const val TWO_HALVES_FROM_DP = 110f

    /** What the tiles were last drawn with: the cover their colours came from, and the language. */
    @Volatile private var drawnFor: String? = null

    /**
     * Redraws the tiles, where anything they show has changed.
     *
     * Called with every redraw of the player widgets, which is every pause
     * and every change of track. The tile shows neither, only the colours of
     * the cover and two names, so it is left alone until one of those moves.
     */
    fun refresh(context: Context, state: NowPlaying = NowPlaying.read(context)) {
      val key = "${state.artworkPath}|${Localised.tag(context)}"
      if (key == drawnFor) return
      drawnFor = key
      val manager = AppWidgetManager.getInstance(context) ?: return
      val ids = runCatching {
        manager.getAppWidgetIds(ComponentName(context, JukeboxShortcutWidget::class.java))
      }.getOrNull() ?: return
      for (id in ids) update(context, manager, state, id)
    }

    private fun update(context: Context, manager: AppWidgetManager, state: NowPlaying, id: Int) {
      runCatching { manager.updateAppWidget(id, render(context, manager, state, id)) }
        .onFailure { Log.w(TAG, "Could not draw shortcut $id", it) }
    }

    /**
     * One set of views, or one for each size where a launcher reports the
     * tile one cell wide one way up and two the other. Nothing on the tile is
     * ever partially updated, so a map of sizes costs it nothing.
     */
    private fun render(context: Context, manager: AppWidgetManager, state: NowPlaying, id: Int): RemoteViews {
      val sizes = sizes(context, manager, id)
      val wide = sizes.map { it.width >= TWO_HALVES_FROM_DP }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && sizes.size > 1 && wide.distinct().size > 1) {
        return RemoteViews(sizes.distinct().take(16).associateWith { draw(context, state, it) })
      }
      return draw(context, state, sizes.maxBy { it.height })
    }

    private fun sizes(context: Context, manager: AppWidgetManager, id: Int): List<SizeF> {
      val options = runCatching { manager.getAppWidgetOptions(id) }.getOrNull() ?: Bundle.EMPTY
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        @Suppress("DEPRECATION")
        val sizes = runCatching {
          options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        }.getOrNull()?.filter { it.width > 0f && it.height > 0f }
        if (!sizes.isNullOrEmpty()) return sizes
      }
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0).toFloat()
      val maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0).toFloat()
      val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0).toFloat()
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0).toFloat()
      if (minWidth <= 0f || maxHeight <= 0f) return listOf(SizeF(150f, 70f))
      val sideways = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
      return listOf(if (sideways) SizeF(maxWidth, minHeight) else SizeF(minWidth, maxHeight))
    }

    private fun draw(context: Context, state: NowPlaying, size: SizeF): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.jukebox_widget_shortcut)

      // In the app's language, for the reason the player widget's words are.
      val words = Localised.context(context)
      val all = words.getString(R.string.jukebox_auto_shuffle_all)
      val recent = words.getString(R.string.jukebox_auto_shuffle_recent)
      views.setTextViewText(R.id.jukebox_shortcut_all_label, all)
      views.setTextViewText(R.id.jukebox_shortcut_recent_label, recent)
      views.setContentDescription(R.id.jukebox_shortcut_all, all)
      views.setContentDescription(R.id.jukebox_shortcut_recent, recent)

      val two = size.width >= TWO_HALVES_FROM_DP
      views.setViewVisibility(R.id.jukebox_shortcut_recent, if (two) View.VISIBLE else View.GONE)
      views.setViewVisibility(R.id.jukebox_shortcut_divider, if (two) View.VISIBLE else View.GONE)

      // The colours of the last cover, so the tile sits beside a player widget
      // as part of it. Read from the file, not decoded: the gradient only
      // needs its colours, which are kept with the gradient.
      val cover = state.artworkPath?.takeIf { File(it).isFile }
      views.setImageViewBitmap(
        R.id.jukebox_widget_glass,
        WidgetGlass.background(cover, size.width, size.height, rounded = Build.VERSION.SDK_INT < Build.VERSION_CODES.S)
      )

      views.setOnClickPendingIntent(R.id.jukebox_shortcut_all, JukeboxWidget.shelf(context, BrowseTree.SHUFFLE))
      views.setOnClickPendingIntent(R.id.jukebox_shortcut_recent, JukeboxWidget.shelf(context, BrowseTree.SHUFFLE_RECENT))
      return views
    }
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    val state = NowPlaying.read(context)
    for (id in appWidgetIds) update(context, manager, state, id)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, NowPlaying.read(context), id)
  }
}
