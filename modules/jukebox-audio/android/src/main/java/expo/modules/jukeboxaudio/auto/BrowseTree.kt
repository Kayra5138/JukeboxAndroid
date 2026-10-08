package expo.modules.jukeboxaudio.auto

import android.content.Context
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import expo.modules.jukeboxaudio.Localised
import expo.modules.jukeboxaudio.MediaStoreLibrary
import expo.modules.jukeboxaudio.QueueStore
import expo.modules.jukeboxaudio.R

/**
 * The library as a car can see it.
 *
 * Android Auto never draws the app's own screens. It asks for a tree of
 * browsable and playable items and renders that itself, to its own rules about
 * how much a driver may be shown — which is why supporting it changes nothing
 * about the app and is entirely a matter of answering those questions well.
 *
 * So what can be decided here is less than a screen and more than a list. Four
 * tabs, which is all a car shows. Tiles rather than lines, everywhere: a cover
 * is recognised in the time a name takes to read, and a small screen holds
 * several times as many of them. The first tab is what a driver reaches for —
 * carrying on, or something played lately — and the other three are the
 * library, each in an order that can be changed.
 *
 * What cannot be decided here is where any of it goes. The car puts the tabs
 * and its own search button where it likes, and takes no buttons from an app,
 * which is why changing the order is a tile at the head of each shelf rather
 * than a control beside the tabs.
 */
internal object BrowseTree {
  const val ROOT = "root"
  private const val HOME = "home"
  private const val TRACKS = "tracks"
  private const val ALBUMS = "albums"
  private const val LISTS = "lists"
  private const val RECENT = "recent"

  /** One record, one list, and the answer to one search: `album/Name`, `list/7`, `search/words`. */
  private const val ALBUM = "album/"
  private const val LIST = "list/"
  private const val SEARCH = "search/"

  /** Under a shelf: the choice of orders, and the shelf in one of them. */
  private const val SORT = "/sort"
  private const val BY = "/by/"

  /**
   * The three tiles at the top of the first screen.
   *
   * Their own ids rather than a track's: what each means is decided when it is
   * chosen, not when it is drawn.
   */
  const val CONTINUE = "continue"
  private const val SHUFFLE = "shuffle"
  private const val SHUFFLE_RECENT = "shuffle-recent"

  /** How far back "lately" goes, for the shelf a recent song is queued with. */
  private const val SHELF = 100

  /**
   * How many recent songs are on the first screen.
   *
   * Tiles, so a good many fit: six rows of four on a small screen. More is not
   * better. This is the screen for what was played this week, and the Tracks
   * tab sorted by recently played is one tap away for the rest.
   */
  private const val ON_HOME = 24

  /** How many answers a search gives. A driver is not going to read a hundred. */
  private const val FOUND = 50

  /**
   * A playable item carries where it was found as well as what it is.
   *
   * Tapping a track in a car should start the record or the list it sits in,
   * from that track — not that track alone. What comes back from the head unit
   * is the id and little else, so the surroundings travel inside the id rather
   * than in extras, which do not reliably survive the trip.
   */
  private const val PLAYABLE = "t|"

  /**
   * The track an id stands for, without where it was found.
   *
   * The surroundings are for the car, which hands them back when a row is
   * chosen. Nothing else has any use for them, and everything else reads an
   * item's id as the track's: the widget looking for a cover, the app working
   * out which of its rows is playing, the history. So they come off as an item
   * goes into the queue, which is the last moment they mean anything. An id
   * that never had any is given back as it was.
   */
  fun trackId(mediaId: String): String =
    if (mediaId.startsWith(PLAYABLE)) mediaId.substringAfterLast('|') else mediaId

  /** An item as the queue should hold it: see [trackId]. */
  fun queued(item: MediaItem): MediaItem {
    val plain = trackId(item.mediaId)
    return if (plain == item.mediaId) item else item.buildUpon().setMediaId(plain).build()
  }

  /**
   * How many songs may be handed over in one answer.
   *
   * A browse result crosses to the car in a single transaction, and Media3
   * silently drops whatever does not fit in 256 KB — no error, no log, the list
   * simply stops. A head unit cannot ask for the rest either: Android Auto
   * ignores the page arguments entirely, which is documented and deliberate.
   *
   * So the splitting has to happen on this side. The figure is the one the
   * field has settled on — apps that shipped without it were found breaking
   * anywhere between about three hundred and a thousand songs, varying by
   * device, because the real ceiling is a byte budget rather than a count.
   * Nothing here relies on it being exactly right: [slices] guarantees no node
   * ever holds more than this, so being wrong costs an extra tap rather than
   * a missing song.
   */
  private const val MOST_IN_ONE_NODE = 250

  /** Marks a node that is one part of a list too long to hand over at once. */
  private const val PART = "~"

  fun rootItem(context: Context): MediaItem = browsable(context, ROOT, "Jukebox")

  /**
   * The nodes whose own words are this side's, and so change with the
   * language: the tabs, and behind each shelf the tile that sorts it.
   *
   * A car keeps what it was told about a node until it is told the node has
   * changed, so these are what it has to be sent back to when the language
   * does. The root is first because the tabs' names are its children.
   */
  val SPOKEN: List<String> = listOf(ROOT, HOME, TRACKS, ALBUMS, LISTS) +
    listOf(TRACKS, ALBUMS, LISTS).map { "$it$SORT" }

  /** The children of [parentId], or an empty list for an id with none. */
  fun children(context: Context, parentId: String): List<MediaItem> {
    val root = LibraryDatabase.libraryRoot(context)
    // The app's language and not the phone's: see [Localised].
    val words = Localised.context(context)

    /*
      One part of a longer list. The parts are cut from the same list in the
      same way every time, so the part a song was found in still holds it when
      the car asks again.

      A number after the mark is what makes this a part, not the mark alone —
      a record actually called "Fire ~ Ice" would otherwise be mistaken for one
      and answer with nothing.
    */
    val part = parentId.substringAfterLast(PART, "").toIntOrNull()
    if (part != null) {
      val whole = parentId.substringBeforeLast(PART)
      val entries = entriesOf(context, root, whole)
      if (entries != null) {
        return slices(entries).getOrNull(part)
          ?.map { playable(context, it, parentId) }
          .orEmpty()
      }
    }

    for (shelf in Sort.FOR.keys) {
      if (parentId == shelf) {
        return listOf(sortTile(context, shelf)) + shelf(context, root, shelf, Sort.read(context, shelf))
      }
      if (parentId == "$shelf$SORT") {
        val now = Sort.read(context, shelf)
        return Sort.FOR.getValue(shelf).map {
          icon(
            context, "$shelf$BY${it.key}", words.getString(it.label), R.drawable.jukebox_auto_sort,
            subtitle = if (it == now) words.getString(R.string.jukebox_auto_sort_now) else null, browsable = true
          )
        }
      }
      if (parentId.startsWith("$shelf$BY")) {
        // Opening an order is choosing it: the shelf is shown that way, and
        // stays that way the next time its tab is opened.
        val sort = Sort.of(shelf, parentId.removePrefix("$shelf$BY"))
        Sort.write(context, shelf, sort)
        return shelf(context, root, shelf, sort)
      }
    }

    return when {
      // Four, because four is all that is shown. A fifth would not be a
      // crowded row, it would be a tab nobody can reach.
      parentId == ROOT -> listOf(
        icon(context, HOME, words.getString(R.string.jukebox_auto_home), R.drawable.jukebox_auto_home, browsable = true, single = false),
        icon(context, TRACKS, words.getString(R.string.jukebox_auto_tracks), R.drawable.jukebox_auto_tracks, browsable = true, single = false),
        icon(context, ALBUMS, words.getString(R.string.jukebox_auto_albums), R.drawable.jukebox_auto_albums, browsable = true, single = false),
        icon(context, LISTS, words.getString(R.string.jukebox_auto_lists), R.drawable.jukebox_auto_lists, browsable = true, single = false)
      )

      /*
        Three ways to start without choosing anything, and straight after
        them, in the same run of tiles, what was played lately.

        One run and no headings, because of what a heading costs. A car starts
        a new block of the screen for every heading and gives the heading a
        line of its own, and with the three under one and the songs under
        another, the first screen was three tiles and nothing else: everything
        worth seeing was a scroll away, which in a car is a long way. Run
        together they share rows, and a song or two is on screen from the
        start.

        The three wear covers and not symbols, each the cover of something it
        would play, so the row looks like the music and not like a toolbar.
      */
      parentId == HOME -> buildList {
        val everything = tracks(context, root)
        val recent = inOrderOf(everything, LibraryDatabase.recentlyPlayed(context, ON_HOME))

        val last = runCatching { QueueStore.load(context) }.getOrNull()
          ?.let { it.items.getOrNull(it.index) }
        val lastId = last?.mediaId?.substringAfterLast('|')?.takeIf { id -> everything.any { it.id == id } }
        add(action(
          context, CONTINUE, words.getString(R.string.jukebox_auto_continue),
          // What it would carry on with, so the tile says more than its name.
          subtitle = last?.mediaMetadata?.title?.toString(),
          cover = lastId ?: recent.firstOrNull()?.id ?: everything.firstOrNull()?.id
        ))
        if (recent.isNotEmpty()) {
          // Not the newest of them where there is another: that one is as
          // likely as not the cover the tile beside it is already wearing.
          add(action(
            context, SHUFFLE_RECENT, words.getString(R.string.jukebox_auto_shuffle_recent), songCount(context, recent.size),
            cover = (recent.firstOrNull { it.id != lastId } ?: recent.first()).id
          ))
        }
        if (everything.isNotEmpty()) {
          // A different record each day and the same one all day: something to
          // look at that is not the same sleeve for ever, without a tile that
          // changes under a finger.
          val today = (System.currentTimeMillis() / 86_400_000L).toInt()
          add(action(
            context, SHUFFLE, words.getString(R.string.jukebox_auto_shuffle_all), songCount(context, everything.size),
            cover = everything[Math.floorMod(today * 31, everything.size)].id
          ))
        }

        recent.forEach { add(playable(context, it, RECENT)) }

        // A library nothing has been played from yet still deserves a first
        // screen with something on it.
        if (recent.isEmpty()) {
          sorted(context, everything, Sort.ADDED).take(ON_HOME)
            .forEach { add(playable(context, it, "$TRACKS$BY${Sort.ADDED.key}")) }
        }
      }

      else -> entriesOf(context, root, parentId)
        ?.let { songs(context, parentId, it) }
        .orEmpty()
    }
  }

  /**
   * The tab that has to be drawn again once [parentId] has been answered.
   *
   * Choosing an order changes what the shelf's own tab holds, and a car keeps
   * what it was last told about a tab until it is told otherwise.
   */
  fun refreshes(parentId: String): String? =
    Sort.FOR.keys.firstOrNull { parentId.startsWith("$it$BY") }

  /** One of the three shelves, in [sort]. */
  private fun shelf(context: Context, root: String, shelf: String, sort: Sort): List<MediaItem> = when (shelf) {
    TRACKS -> {
      val node = "$TRACKS$BY${sort.key}"
      songs(context, node, entriesOf(context, root, node).orEmpty())
    }

    ALBUMS -> {
      val plays = if (sort == Sort.MOST) LibraryDatabase.plays(context) else emptyMap()
      val records = albums(context, root).entries.toList()
      when (sort) {
        Sort.ADDED -> records.sortedByDescending { (_, entries) -> entries.maxOf { it.addedAt ?: 0L } }
        Sort.MOST -> records.sortedByDescending { (_, entries) -> entries.sumOf { plays[it.id]?.first ?: 0 } }
        else -> records
      }.map { (name, entries) ->
        browsable(
          context, "$ALBUM$name", name,
          subtitle = entries.mapNotNull { it.artist }.distinct().singleOrNull() ?: trackCount(context, entries.size),
          cover = entries.firstOrNull()?.id
        )
      }
    }

    else -> {
      val lists = LibraryDatabase.playlists(context)
      when (sort) {
        Sort.TITLE -> lists.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.name })
        Sort.SIZE -> lists.sortedByDescending { it.trackCount }
        else -> lists
      }.map {
        browsable(
          context, "$LIST${it.id}", it.name, trackCount(context, it.trackCount),
          // A list is known by what is in it, and its first song stands for it.
          cover = LibraryDatabase.playlistTrackIds(context, it.id).firstOrNull()
        )
      }
    }
  }

  /** The tile at the head of a shelf that says what order it is in and opens the others. */
  private fun sortTile(context: Context, shelf: String): MediaItem =
    icon(
      context, "$shelf$SORT", Localised.text(context, R.string.jukebox_auto_sort), R.drawable.jukebox_auto_sort,
      subtitle = Localised.text(context, Sort.read(context, shelf).label), browsable = true
    )

  /** "12 tracks", for under a record or a list, and "12 songs" for under a tile that plays them. */
  private fun trackCount(context: Context, count: Int): String =
    Localised.count(context, R.plurals.jukebox_count_tracks, count)

  private fun songCount(context: Context, count: Int): String =
    Localised.count(context, R.plurals.jukebox_count_songs, count)

  /** [entries] in [sort]. Ties, and songs the order says nothing about, go by name. */
  private fun sorted(context: Context, entries: List<Entry>, sort: Sort): List<Entry> {
    val byName = compareBy<Entry> { folded(it.title) }
    return when (sort) {
      Sort.ARTIST -> entries.sortedWith(
        compareBy<Entry>({ it.artist.isNullOrBlank() }, { folded(it.artist ?: "") }, { folded(it.album ?: "") },
          { it.position == null }, { it.position ?: 0 }).then(byName)
      )
      // Newest first, and anything the media store would not date goes last
      // rather than pretending to be from 1970.
      Sort.ADDED -> entries.sortedWith(compareBy<Entry>({ it.addedAt == null }, { -(it.addedAt ?: 0L) }).then(byName))
      Sort.MOST, Sort.RECENT -> {
        val plays = LibraryDatabase.plays(context)
        entries.sortedWith(
          compareBy<Entry> { entry ->
            val (count, last) = plays[entry.id] ?: (0 to 0L)
            if (sort == Sort.MOST) -count.toLong() else -last
          }.then(byName)
        )
      }
      else -> entries.sortedWith(byName)
    }
  }

  /** The songs that answer [query], best first. */
  private fun found(context: Context, root: String, query: String): List<Entry> =
    tracks(context, root)
      .mapNotNull { entry -> searchRank(query, entry.title, listOf(entry.artist, entry.album))?.let { it to entry } }
      .sortedWith(compareBy({ it.first }, { folded(it.second.title) }))
      .take(FOUND)
      .map { it.second }

  /** What a search for [query] shows. */
  fun search(context: Context, query: String): List<MediaItem> {
    val root = LibraryDatabase.libraryRoot(context)
    val node = "$SEARCH${query.trim()}"
    return found(context, root, query).map { playable(context, it, node) }
  }

  /**
   * The songs a node holds, in order, or null for a node that holds folders.
   *
   * Separated from [children] because a list may have to be handed over in
   * parts, and the parts have to be cut from the same sequence the whole was.
   */
  private fun entriesOf(context: Context, root: String, parentId: String): List<Entry>? = when {
    parentId.startsWith("$TRACKS$BY") ->
      sorted(context, tracks(context, root), Sort.of(TRACKS, parentId.removePrefix("$TRACKS$BY")))

    // The history knows ids and when they were heard; what those ids are is
    // still the library's to say, and a track played once and deleted since
    // simply falls out of the shelf.
    parentId == RECENT -> inOrderOf(
      tracks(context, root), LibraryDatabase.recentlyPlayed(context, SHELF)
    )

    parentId.startsWith(ALBUM) -> albums(context, root)[parentId.removePrefix(ALBUM)]

    parentId.startsWith(LIST) -> {
      val id = parentId.removePrefix(LIST).toLongOrNull()
      if (id == null) null else {
        val byId = tracks(context, root).associateBy { it.id }
        LibraryDatabase.playlistTrackIds(context, id).mapNotNull { byId[it] }
      }
    }

    parentId.startsWith(SEARCH) -> found(context, root, parentId.removePrefix(SEARCH))

    else -> null
  }

  /** Songs as they should be offered: whole if it fits, in named parts if not. */
  private fun songs(context: Context, parentId: String, entries: List<Entry>): List<MediaItem> {
    val parts = slices(entries)
    if (parts.size <= 1) return entries.map { playable(context, it, parentId) }

    return parts.mapIndexed { index, part ->
      browsable(
        context,
        "$parentId$PART$index",
        // Named by what is in it rather than "Part 2 of 7", so that somebody
        // looking for a song knows which one to open without opening any.
        "${shorten(part.first().title)} – ${shorten(part.last().title)}",
        subtitle = trackCount(context, part.size),
        cover = part.firstOrNull()?.id
      )
    }
  }

  /**
   * The list cut into parts of at most [MOST_IN_ONE_NODE].
   *
   * Cut evenly rather than into full parts and a remainder: seven hundred songs
   * become three parts of about two hundred and thirty, not two of two hundred
   * and fifty and one of two hundred, which reads as an accident.
   */
  internal fun <T> slices(entries: List<T>): List<List<T>> {
    if (entries.size <= MOST_IN_ONE_NODE) return listOf(entries)
    val parts = (entries.size + MOST_IN_ONE_NODE - 1) / MOST_IN_ONE_NODE
    val each = (entries.size + parts - 1) / parts
    return entries.chunked(each)
  }

  /** The cap, for the test that holds [slices] to it. */
  internal const val CAP = MOST_IN_ONE_NODE

  /** Enough of a title to tell parts apart, and no more than a car may show. */
  private fun shorten(title: String): String =
    if (title.length <= 12) title else title.take(11).trimEnd() + "…"

  /** [entries] picked out and put in the order [ids] gives, skipping the gone. */
  private fun inOrderOf(entries: List<Entry>, ids: List<String>): List<Entry> {
    val byId = entries.associateBy { it.id }
    return ids.mapNotNull { byId[it] }
  }

  /**
   * What to play when [mediaId] is chosen, and where in it to start.
   *
   * The whole of whatever it was found in, so that choosing the third track of
   * a record leaves the rest of the record queued behind it.
   */
  fun resolve(context: Context, mediaId: String): Pair<List<MediaItem>, Int> {
    if (mediaId == SHUFFLE || mediaId == SHUFFLE_RECENT || mediaId == CONTINUE) {
      // Shuffled here rather than handed over in order and shuffled by the
      // player: what was asked for was a shuffled queue, and leaving it to a
      // mode the driver cannot see would mean the tile did something different
      // depending on a setting made weeks ago.
      val all = tracks(context, LibraryDatabase.libraryRoot(context))
      val recent = if (mediaId == SHUFFLE_RECENT) {
        inOrderOf(all, LibraryDatabase.recentlyPlayed(context, SHELF))
      } else emptyList()
      // Carrying on is the service's to answer, since it has the queue. It
      // only arrives here when there is none, and then anything is better
      // than a tile that does nothing.
      return recent.ifEmpty { all }.shuffled().map { playable(context, it, RECENT) } to 0
    }

    if (!mediaId.startsWith(PLAYABLE)) return emptyList<MediaItem>() to 0

    val body = mediaId.removePrefix(PLAYABLE)
    val separator = body.lastIndexOf('|')
    if (separator < 0) return emptyList<MediaItem>() to 0

    val parent = body.substring(0, separator)
    val trackId = body.substring(separator + 1)

    val siblings = children(context, parent)
    val index = siblings.indexOfFirst { it.mediaId == mediaId }
    if (index >= 0) return siblings to index

    // The list it came from has changed underneath the head unit — a track
    // removed, a folder repointed. Playing the one thing that was asked for is
    // better than playing nothing.
    val single = tracks(context, LibraryDatabase.libraryRoot(context))
      .firstOrNull { it.id == trackId }
      ?.let { playable(context, it, parent) }
    return listOfNotNull(single) to 0
  }

  private data class Entry(
    val id: String,
    val uri: String,
    val title: String,
    val artist: String?,
    val album: String?,
    val position: Int?,
    /** Milliseconds, or null for a file the media store will not date. */
    val addedAt: Long?,
    val durationSec: Double
  )

  private fun tracks(context: Context, root: String): List<Entry> {
    val kept = LibraryDatabase.kept(context)

    return MediaStoreLibrary.queryTracks(context, root).mapNotNull { row ->
      val id = row["id"] as? String ?: return@mapNotNull null
      val uri = row["uri"] as? String ?: return@mapNotNull null
      val known = kept[id]
      // Named the way the phone names it, corrections and lookups included.
      val names = named(
        row["title"] as? String ?: Localised.text(context, R.string.jukebox_unknown_title), row["artist"] as? String, row["album"] as? String, known
      )
      Entry(
        id = id,
        uri = uri,
        title = names.title,
        artist = names.artist,
        album = names.album,
        position = known?.position ?: (row["trackNumber"] as? Number)?.toInt(),
        addedAt = row["addedAt"] as? Long,
        durationSec = (row["durationSec"] as? Number)?.toDouble() ?: -1.0
      )
    }
  }

  /**
   * Records, with their tracks in order.
   *
   * Every track that names one, by the name the phone shows for it, and only
   * what is still on the phone: the tracks are the media store's, so a record
   * whose files have gone does not appear at all.
   */
  private fun albums(context: Context, root: String): Map<String, List<Entry>> =
    tracks(context, root)
      .filter { !it.album.isNullOrBlank() }
      .groupBy { it.album!!.trim() }
      .mapValues { (_, entries) ->
        // Numbered first and in order, the rest after them — the same rule the
        // app's own album screen follows.
        entries.sortedWith(
          compareBy({ it.position == null }, { it.position ?: 0 }, { it.title })
        )
      }
      .toSortedMap(String.CASE_INSENSITIVE_ORDER)

  /**
   * A folder, drawn as a tile and holding tiles.
   *
   * [cover] is the track whose picture stands for the folder — a record's
   * first song, for a shelf of records.
   */
  private fun browsable(
    context: Context,
    id: String,
    title: String,
    subtitle: String? = null,
    cover: String? = null
  ): MediaItem =
    MediaItem.Builder()
      .setMediaId(id)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          .setIsBrowsable(true)
          .setIsPlayable(false)
          .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
          .apply { cover?.let { setArtworkUri(CoverProvider.uriFor(context, it)) } }
          .setExtras(tiles())
          .build()
      )
      .build()

  /** A tile that plays something and is not a song: one of the three on the first screen. */
  private fun action(context: Context, id: String, title: String, subtitle: String?, cover: String?): MediaItem =
    MediaItem.Builder()
      .setMediaId(id)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          // A car shows the artist under a playable tile, and the subtitle
          // only under a folder.
          .setArtist(subtitle)
          .setIsBrowsable(false)
          .setIsPlayable(true)
          .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
          .apply { cover?.let { setArtworkUri(CoverProvider.uriFor(context, it)) } }
          .setExtras(tiles())
          .build()
      )
      .build()

  /**
   * A tile that is an icon and not a cover: a tab, or an order to sort by.
   *
   * [single] asks for this one tile to be drawn as an icon whatever its
   * neighbours are, which is what stops a play symbol being blown up to the
   * size of a record sleeve and cropped. A tab is not a tile and does not ask.
   *
   * The picture is addressed by its number and not its name: a release build
   * renames resources to save space, and a name that was right when this was
   * written finds nothing afterwards.
   */
  private fun icon(
    context: Context,
    id: String,
    title: String,
    drawable: Int,
    subtitle: String? = null,
    browsable: Boolean = false,
    single: Boolean = true
  ): MediaItem =
    MediaItem.Builder()
      .setMediaId(id)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          .setIsBrowsable(browsable)
          .setIsPlayable(!browsable)
          .setMediaType(if (browsable) MediaMetadata.MEDIA_TYPE_FOLDER_MIXED else MediaMetadata.MEDIA_TYPE_MUSIC)
          .setArtworkUri(Uri.parse("android.resource://${context.packageName}/$drawable"))
          .setExtras(tiles().apply { if (single) putInt(SINGLE_ITEM, ICON_TILE) })
          .build()
      )
      .build()

  /**
   * Draw what is inside this folder as tiles, folders and songs alike.
   *
   * The keys are the old MediaBrowserCompat ones because that is what a head
   * unit still speaks; media3 passes the extras through untouched. They are
   * hints: a head unit that does not do tiles ignores them and draws a list.
   */
  private const val BROWSABLE_STYLE = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT"
  private const val PLAYABLE_STYLE = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT"
  private const val SINGLE_ITEM = "android.media.browse.CONTENT_STYLE_SINGLE_ITEM_HINT"
  private const val TILE = 2
  private const val ICON_TILE = 4

  private fun tiles() = Bundle().apply {
    putInt(BROWSABLE_STYLE, TILE)
    putInt(PLAYABLE_STYLE, TILE)
  }

  private fun playable(
    context: Context,
    entry: Entry,
    parent: String,
    group: String? = null
  ): MediaItem {
    /*
      The same extras the app's own queue entries carry. A media item's local
      configuration is stripped when it crosses to a controller, so the address
      has to travel somewhere that survives — and the car is the one caller
      that always comes from the other side of that boundary.
    */
    val extras = Bundle().apply {
      putString("jukebox.uri", entry.uri)
      putDouble("jukebox.durationSec", entry.durationSec)
      putInt("jukebox.trackNumber", entry.position ?: -1)
      /*
        The heading this row sits under. A car gathers a RUN of rows asking for
        the same one and writes it above them -- so the grouping is by being
        next to each other, not by the words matching. Two separated runs of the
        same title are two headings, which is why the first screen is built in
        one pass in the order it should read.
      */
      group?.let { putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", it) }
    }

    return MediaItem.Builder()
      .setMediaId("$PLAYABLE$parent|${entry.id}")
      .setUri(Uri.parse(entry.uri))
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(entry.title)
          .setArtist(entry.artist)
          .setAlbumTitle(entry.album)
          .setIsBrowsable(false)
          .setIsPlayable(true)
          .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
          .setArtworkUri(CoverProvider.uriFor(context, entry.id))
          // A car shows how long a song is, and had been shown nothing.
          .apply {
            if (entry.durationSec > 0) setDurationMs((entry.durationSec * 1000).toLong())
          }
          .setExtras(extras)
          .build()
      )
      .build()
  }
}
