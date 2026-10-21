package expo.modules.jukeboxaudio.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import android.view.KeyEvent
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import expo.modules.jukeboxaudio.Localised
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
 *
 * One widget at four sizes. It is the compact row it always was at one row of
 * cells, a card with a large cover and shuffle and repeat at two, and the card
 * over the next few songs of the queue at four; which one is drawn follows the
 * size it is given (see [WidgetShape]), so pulling a widget taller or shorter
 * changes it from one to another. It is offered in the picker three times —
 * this provider, [JukeboxCardWidget] and [JukeboxLargeWidget] — differing only
 * in the size each is first placed at, because a picker shows one size for
 * each provider and nobody would find the large one by pulling the row
 * taller. This provider is the one that was always there, under its old name
 * and starting at the old size, so a widget placed before any of this is the
 * same widget still and is drawn as it was.
 */
private const val TAG = "JukeboxWidget"

open class JukeboxWidget : AppWidgetProvider() {
  companion object {
    private const val ACTION_PREVIOUS = "expo.modules.jukeboxaudio.widget.PREVIOUS"
    private const val ACTION_TOGGLE = "expo.modules.jukeboxaudio.widget.TOGGLE"
    private const val ACTION_NEXT = "expo.modules.jukeboxaudio.widget.NEXT"
    private const val ACTION_SHUFFLE = "expo.modules.jukeboxaudio.widget.SHUFFLE"
    private const val ACTION_REPEAT = "expo.modules.jukeboxaudio.widget.REPEAT"
    private const val ACTION_JUMP = "expo.modules.jukeboxaudio.widget.JUMP"
    internal const val ACTION_SHELF = "expo.modules.jukeboxaudio.widget.SHELF"

    /**
     * Put on the intent that opens the app from the cover, asking it to open
     * the player as it comes up; the module hands it to JavaScript.
     */
    const val OPEN_PLAYER = "expo.modules.jukeboxaudio.OPEN_PLAYER"

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

    /**
     * The same for the card and the large widget, whose covers are drawn up to
     * about a hundred and fifty points across. Not more, because the gradient
     * goes in the same transaction, twice where the widget has a shape for
     * each way up; this and two of those stay near half the megabyte.
     */
    private const val LARGE_ART_PIXELS = 256

    /** The ids of the rows the large layout lists the queue in, in order. */
    private val ROWS = intArrayOf(
      R.id.jukebox_widget_row_0, R.id.jukebox_widget_row_1, R.id.jukebox_widget_row_2,
      R.id.jukebox_widget_row_3, R.id.jukebox_widget_row_4, R.id.jukebox_widget_row_5
    )
    private val ROW_TITLES = intArrayOf(
      R.id.jukebox_widget_row_0_title, R.id.jukebox_widget_row_1_title, R.id.jukebox_widget_row_2_title,
      R.id.jukebox_widget_row_3_title, R.id.jukebox_widget_row_4_title, R.id.jukebox_widget_row_5_title
    )
    private val ROW_ARTISTS = intArrayOf(
      R.id.jukebox_widget_row_0_artist, R.id.jukebox_widget_row_1_artist, R.id.jukebox_widget_row_2_artist,
      R.id.jukebox_widget_row_3_artist, R.id.jukebox_widget_row_4_artist, R.id.jukebox_widget_row_5_artist
    )

    /** The three providers of the now-playing widget, which are drawn alike. */
    private val PLAYERS = listOf(
      JukeboxWidget::class.java, JukeboxCardWidget::class.java, JukeboxLargeWidget::class.java
    )

    private fun ids(context: Context, manager: AppWidgetManager): List<Int> = PLAYERS.flatMap { provider ->
      runCatching { manager.getAppWidgetIds(ComponentName(context, provider)).toList() }.getOrDefault(emptyList())
    }

    /**
     * Redraws every placed widget. Called from the service as playback moves,
     * and from the module when the app's language changes.
     */
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val state = NowPlaying.read(context)
      for (id in ids(context, manager)) update(context, manager, state, id)
      // The shortcut tile wears the colours of the cover too, and has words.
      JukeboxShortcutWidget.refresh(context, state)
    }

    /** Guarded one by one: a widget the launcher refuses should not take the others with it. */
    private fun update(context: Context, manager: AppWidgetManager, state: NowPlaying, id: Int) {
      runCatching { manager.updateAppWidget(id, render(context, manager, state, id)) }
        .onFailure { Log.w(TAG, "Could not draw widget $id", it) }
    }

    fun hasWidgets(context: Context): Boolean = runCatching {
      ids(context, AppWidgetManager.getInstance(context)).isNotEmpty()
    }.getOrDefault(false)

    /**
     * Moves the progress bar, once a second while playing.
     *
     * A partial update where it can be, which carries no bitmaps and decodes
     * no artwork. It cannot be for a widget drawn as a map of sizes: Android
     * merges a partial update into the top of a RemoteViews and never into the
     * sizes inside it (`RemoteViews.mergeRemoteViews`), so the bar would stay
     * where it was. Those few are drawn whole instead, from the bitmaps kept
     * from the last time.
     */
    fun progress(context: Context, positionMs: Long, durationMs: Long) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      var state: NowPlaying? = null
      for (id in ids(context, manager)) {
        val shapes = shapes(context, manager, id)
        if (shapes.size > 1) {
          val known = state ?: NowPlaying.read(context).also { state = it }
          update(context, manager, known.copy(positionMs = positionMs, durationMs = durationMs), id)
          continue
        }
        val views = RemoteViews(context.packageName, layoutOf(shapes.first().kind))
        setProgress(views, positionMs, durationMs)
        runCatching { manager.partiallyUpdateAppWidget(id, views) }
      }
    }

    private fun setProgress(views: RemoteViews, positionMs: Long, durationMs: Long) {
      views.setViewVisibility(R.id.jukebox_widget_progress, if (durationMs > 0) View.VISIBLE else View.INVISIBLE)
      views.setProgressBar(R.id.jukebox_widget_progress, 1000, WidgetProgress.value(positionMs, durationMs), false)
    }

    private fun layoutOf(kind: WidgetKind): Int = when (kind) {
      WidgetKind.COMPACT -> R.layout.jukebox_widget_compact
      WidgetKind.ROW -> R.layout.jukebox_widget
      WidgetKind.CARD -> R.layout.jukebox_widget_card
      WidgetKind.LARGE -> R.layout.jukebox_widget_large
    }

    /**
     * The shapes a widget is to be drawn in, never none.
     *
     * From Android 12 a launcher says every size the widget is shown at, and
     * they are used as they are. Before that there are only the least and
     * most of each side: upright a widget is the narrowest and the tallest,
     * on its side the widest and the shortest, and the one that matches the
     * way the phone is held now is drawn, since there is no map of sizes to
     * hand both to. Before the launcher has said anything at all — the moment
     * a widget is placed — it is drawn at the size its provider starts at.
     */
    private fun shapes(context: Context, manager: AppWidgetManager, id: Int): List<WidgetShape> {
      val options = runCatching { manager.getAppWidgetOptions(id) }.getOrNull() ?: Bundle.EMPTY
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        @Suppress("DEPRECATION")
        val sizes = runCatching {
          options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        }.getOrNull()
        if (!sizes.isNullOrEmpty()) {
          val planned = WidgetShape.plan(sizes.map { it.width to it.height })
          if (planned.isNotEmpty()) return planned
        }
      }

      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0).toFloat()
      val maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0).toFloat()
      val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0).toFloat()
      val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0).toFloat()
      val planned = WidgetShape.plan(listOf(minWidth to maxHeight, maxWidth to minHeight))
      if (planned.isNotEmpty()) {
        val sideways = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        return listOf(if (sideways) planned.last() else planned.first())
      }
      return listOf(startingShape(manager, id))
    }

    private fun startingShape(manager: AppWidgetManager, id: Int): WidgetShape {
      val provider = runCatching { manager.getAppWidgetInfo(id)?.provider?.className }.getOrNull()
      return when (provider) {
        JukeboxCardWidget::class.java.name -> WidgetShape.of(320f, 170f)
        JukeboxLargeWidget::class.java.name -> WidgetShape.of(320f, 330f)
        // What the original asked for when it had nothing to go on.
        else -> WidgetShape.of(320f, 40f)
      }
    }

    private fun render(context: Context, manager: AppWidgetManager, state: NowPlaying, id: Int): RemoteViews {
      val shapes = shapes(context, manager, id)
      if (shapes.size > 1 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        return RemoteViews(shapes.associate { SizeF(it.widthDp, it.heightDp) to draw(context, state, it) })
      }
      return draw(context, state, shapes.first())
    }

    private fun draw(context: Context, state: NowPlaying, shape: WidgetShape): RemoteViews {
      val views = RemoteViews(context.packageName, layoutOf(shape.kind))
      val large = shape.kind == WidgetKind.CARD || shape.kind == WidgetKind.LARGE

      /*
        The words are put in from here, the ones a screen reader says included.

        The layout names them too, but a launcher inflates the layout in its
        own process and so in the phone's language, which is not necessarily
        the app's. What is set from this side travels as text and arrives as
        it was sent.
      */
      val words = Localised.context(context)
      views.setContentDescription(R.id.jukebox_widget_previous, words.getString(R.string.jukebox_widget_previous))
      /*
        Named for what a press will do, as its picture is, rather than "play or
        pause" whichever is true: a screen reader's user is otherwise left to
        find out by pressing whether the music is playing.
      */
      views.setContentDescription(
        R.id.jukebox_widget_toggle,
        words.getString(if (state.playing) R.string.jukebox_widget_pause else R.string.jukebox_widget_play)
      )
      views.setContentDescription(R.id.jukebox_widget_next, words.getString(R.string.jukebox_widget_next))
      views.setContentDescription(R.id.jukebox_widget_progress, words.getString(R.string.jukebox_widget_progress))

      val idle = state.title.isNullOrBlank()
      views.setTextViewText(
        R.id.jukebox_widget_title,
        if (idle) words.getString(R.string.jukebox_widget_idle) else state.title
      )
      views.setTextViewText(R.id.jukebox_widget_artist, state.artist.orEmpty())
      views.setImageViewResource(
        R.id.jukebox_widget_toggle,
        if (state.playing) R.drawable.jukebox_ic_pause else R.drawable.jukebox_ic_play
      )

      val cover = state.artworkPath?.let { decodeArtwork(it, if (large) LARGE_ART_PIXELS else ART_PIXELS, rounded = large) }
      views.setImageViewBitmap(
        R.id.jukebox_widget_glass,
        WidgetGlass.background(
          if (cover == null) null else state.artworkPath,
          shape.widthDp, shape.heightDp,
          rounded = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
        )
      )
      setProgress(views, state.positionMs, state.durationMs)
      when {
        cover != null -> views.setImageViewBitmap(R.id.jukebox_widget_art, cover)
        large -> views.setImageViewResource(R.id.jukebox_widget_art, R.drawable.jukebox_widget_cover_placeholder)
        else -> views.setImageViewResource(R.id.jukebox_widget_art, R.drawable.jukebox_widget_art_placeholder)
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

      /*
        The cover opens the player itself, over whatever screen the app was
        left on, which is what somebody reaching for the picture of a song
        wants to see. With nothing playing there is no player worth opening,
        and the cover does what the rest of the widget does.

        Set either way, because a launcher redrawing the same layout applies
        what it is sent to the views it already has, and an action that is
        not sent again is not taken back: the cover would go on opening the
        player after the music had gone.
      */
      (if (idle) launchApp(context) else openPlayer(context))
        ?.let { views.setOnClickPendingIntent(R.id.jukebox_widget_art, it) }
      if (!idle) views.setContentDescription(R.id.jukebox_widget_art, words.getString(R.string.jukebox_widget_open))

      if (large) drawModes(context, views, state, words)
      if (shape.kind == WidgetKind.LARGE) drawQueue(context, views, state, shape.rows, words)
      return views
    }

    /** Shuffle and repeat, which only the card and the large widget have room for. */
    private fun drawModes(context: Context, views: RemoteViews, state: NowPlaying, words: Context) {
      views.setContentDescription(R.id.jukebox_widget_shuffle, words.getString(R.string.jukebox_widget_shuffle))
      views.setOnClickPendingIntent(R.id.jukebox_widget_shuffle, command(context, ACTION_SHUFFLE))

      /*
        Repeat is named, drawn and ringed for the mode it is in, as the
        player's own button is: a press moves it round off, all, one. Off is
        drawn faint rather than left out, so the button is still there to find.
      */
      val mode = state.repeatMode
      views.setImageViewResource(
        R.id.jukebox_widget_repeat,
        if (mode == WidgetShape.REPEAT_ONE) R.drawable.jukebox_ic_repeat_one else R.drawable.jukebox_ic_repeat
      )
      views.setInt(R.id.jukebox_widget_repeat, "setImageAlpha", if (mode == WidgetShape.REPEAT_OFF) 115 else 255)
      views.setViewVisibility(
        R.id.jukebox_widget_repeat_ring,
        if (mode == WidgetShape.REPEAT_OFF) View.GONE else View.VISIBLE
      )
      views.setContentDescription(
        R.id.jukebox_widget_repeat,
        words.getString(
          when (mode) {
            WidgetShape.REPEAT_ALL -> R.string.jukebox_widget_repeat_all
            WidgetShape.REPEAT_ONE -> R.string.jukebox_widget_repeat_one
            else -> R.string.jukebox_widget_repeat_off
          }
        )
      )
      views.setOnClickPendingIntent(R.id.jukebox_widget_repeat, command(context, ACTION_REPEAT))
    }

    /**
     * The next few songs, as many as fit, each starting playback there.
     *
     * Written down by the service as the queue moves (see [NowPlaying.upcoming]),
     * so this is right with no service running and after a restart, as the
     * rest of the widget is.
     */
    private fun drawQueue(context: Context, views: RemoteViews, state: NowPlaying, rows: Int, words: Context) {
      views.setTextViewText(R.id.jukebox_widget_up_next, words.getString(R.string.jukebox_widget_up_next))
      views.setTextViewText(R.id.jukebox_widget_up_next_empty, words.getString(R.string.jukebox_widget_up_next_empty))
      val shown = state.upcoming.take(minOf(rows, ROWS.size))
      views.setViewVisibility(R.id.jukebox_widget_up_next_empty, if (shown.isEmpty()) View.VISIBLE else View.GONE)

      for (slot in ROWS.indices) {
        val song = shown.getOrNull(slot)
        if (song == null) {
          views.setViewVisibility(ROWS[slot], View.GONE)
          continue
        }
        views.setViewVisibility(ROWS[slot], View.VISIBLE)
        views.setTextViewText(
          ROW_TITLES[slot],
          song.title?.takeIf { it.isNotBlank() } ?: words.getString(R.string.jukebox_unknown_title)
        )
        val artist = song.artist.orEmpty()
        views.setTextViewText(ROW_ARTISTS[slot], artist)
        views.setViewVisibility(ROW_ARTISTS[slot], if (artist.isBlank()) View.GONE else View.VISIBLE)
        views.setOnClickPendingIntent(ROWS[slot], jump(context, slot, song))
      }
    }

    private val decoded = object : LinkedHashMap<String, Bitmap>(4, 0.75f, true) {
      // Two, for a row and a card on the same home screen, which want the
      // same cover at two sizes and are redrawn together.
      override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>?) = size > 2
    }

    /**
     * A cover for the widget, no wider than [pixels].
     *
     * Sampled rather than scaled first: decoding a cover at full size only to
     * shrink it allocates the large bitmap anyway, which is the part worth
     * avoiding. Then scaled the rest of the way, because sampling only halves,
     * and what it leaves can be nearly twice as wide as asked — four times
     * the bytes in a transaction that has a ceiling.
     *
     * [rounded] for the card and the large widget, where the cover is big
     * enough for its corners to show against the gradient; the row keeps the
     * square cover it always had.
     */
    @Synchronized
    private fun decodeArtwork(path: String, pixels: Int, rounded: Boolean): Bitmap? {
      val file = File(path)
      if (!file.isFile) return null
      val key = "$path:${file.lastModified()}:$pixels:$rounded"
      decoded[key]?.let { return it }

      val bitmap = runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)

        val widest = maxOf(bounds.outWidth, bounds.outHeight)
        if (widest <= 0) return null

        var sample = 1
        while (widest / (sample * 2) >= pixels) sample *= 2

        val sampled = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
          ?: return null
        val fitted = fit(sampled, pixels)
        if (rounded) round(fitted) else fitted
      }.getOrNull() ?: return null

      decoded[key] = bitmap
      return bitmap
    }

    private fun fit(bitmap: Bitmap, pixels: Int): Bitmap {
      val widest = maxOf(bitmap.width, bitmap.height)
      if (widest <= pixels) return bitmap
      val scale = pixels.toFloat() / widest
      val fitted = Bitmap.createScaledBitmap(
        bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true
      )
      if (fitted !== bitmap) bitmap.recycle()
      return fitted
    }

    /** A square crop with round corners, about as round as the cover tiles in the app. */
    private fun round(bitmap: Bitmap): Bitmap {
      val side = minOf(bitmap.width, bitmap.height)
      val out = Bitmap.createBitmap(side, side, Bitmap.Config.ARGB_8888)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
        shader = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
          setLocalMatrix(android.graphics.Matrix().apply {
            setTranslate(-(bitmap.width - side) / 2f, -(bitmap.height - side) / 2f)
          })
        }
      }
      val corner = side * 0.09f
      Canvas(out).drawRoundRect(RectF(0f, 0f, side.toFloat(), side.toFloat()), corner, corner, paint)
      bitmap.recycle()
      return out
    }

    private fun command(context: Context, action: String): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        action.hashCode(),
        Intent(context, JukeboxWidget::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )

    /**
     * A press of one of the large widget's rows.
     *
     * One intent for each row rather than one for the list, told apart by
     * their request codes; each is rewritten in place on every redraw, which
     * keeps it naming the song that row is showing now.
     */
    private fun jump(context: Context, slot: Int, song: NowPlaying.Upcoming): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        ACTION_JUMP.hashCode() + slot,
        Intent(context, JukeboxWidget::class.java).setAction(ACTION_JUMP)
          .putExtra(WidgetCommands.EXTRA_INDEX, song.index)
          .putExtra(WidgetCommands.EXTRA_ID, song.id),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )

    /** A press of one half of the shortcut tile, which plays the car's shelf [shelf]. */
    internal fun shelf(context: Context, shelf: String): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        (ACTION_SHELF + shelf).hashCode(),
        Intent(context, JukeboxWidget::class.java).setAction(ACTION_SHELF)
          .putExtra(WidgetCommands.EXTRA_SHELF, shelf),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )

    internal fun launchApp(context: Context): PendingIntent? {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return null
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    }

    /**
     * The app, asked to open its player. A request code of its own, since
     * the extra is not part of what makes two intents the same one and would
     * otherwise be written into the plain launch above.
     */
    private fun openPlayer(context: Context): PendingIntent? {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?.putExtra(OPEN_PLAYER, true)
        ?: return null
      return PendingIntent.getActivity(
        context,
        1,
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
    for (id in appWidgetIds) update(context, manager, state, id)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, NowPlaying.read(context), id)
  }

  override fun onReceive(context: Context, intent: Intent) {
    val state = NowPlaying.read(context)

    when (intent.action) {
      ACTION_SHUFFLE -> return command(context, Intent(WidgetCommands.SHUFFLE_QUEUE))
      ACTION_REPEAT -> {
        /*
          The mode the button showed it would move to, worked out here from
          what it was drawn from, for the reason the play button's key is (see
          below). Drawn at once, and set right by the service's own update.
        */
        val next = WidgetShape.repeatAfter(state.repeatMode)
        command(context, Intent(WidgetCommands.REPEAT).putExtra(WidgetCommands.EXTRA_MODE, next))
        NowPlaying.write(context, state.copy(repeatMode = next))
        refresh(context)
        return
      }
      ACTION_JUMP -> return command(
        context,
        Intent(WidgetCommands.JUMP)
          .putExtra(WidgetCommands.EXTRA_INDEX, intent.getIntExtra(WidgetCommands.EXTRA_INDEX, -1))
          .putExtra(WidgetCommands.EXTRA_ID, intent.getStringExtra(WidgetCommands.EXTRA_ID))
      )
      ACTION_SHELF -> return command(
        context,
        Intent(WidgetCommands.SHELF)
          .putExtra(WidgetCommands.EXTRA_SHELF, intent.getStringExtra(WidgetCommands.EXTRA_SHELF))
      )
    }

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
   * player — and, for a press that does not end in anything playing, by hand:
   * see `foregroundOwed` there.
   */
  private fun send(context: Context, keyCode: Int) {
    val intent = Intent(Intent.ACTION_MEDIA_BUTTON)
      .putExtra(Intent.EXTRA_KEY_EVENT, KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
    command(context, intent)
  }

  /**
   * Starts the service with [intent], in the foreground for the reason given
   * at [send]; the commands that are not keys owe the same and are paid the
   * same way (see [WidgetCommands]).
   */
  private fun command(context: Context, intent: Intent) {
    intent.setComponent(ComponentName(context, PlaybackService::class.java))
    // Still guarded — the allowance is the system's to give, and losing it
    // should not take the launcher down with it — but no longer silent.
    runCatching { ContextCompat.startForegroundService(context, intent) }
      .onFailure { Log.w(TAG, "Widget could not reach playback", it) }
  }
}

/**
 * The now-playing widget, offered in the picker at two rows of cells.
 *
 * Nothing of its own: it is [JukeboxWidget] under another entry in the picker,
 * with another starting size (res/xml/jukebox_widget_card_info.xml). Its
 * commands are the base provider's, which they are sent to by name.
 */
class JukeboxCardWidget : JukeboxWidget()

/** The now-playing widget, offered at four rows of cells with the queue; see [JukeboxCardWidget]. */
class JukeboxLargeWidget : JukeboxWidget()
