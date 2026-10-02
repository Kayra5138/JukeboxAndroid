package expo.modules.jukeboxaudio.auto

import android.content.Context
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import expo.modules.jukeboxaudio.MediaStoreLibrary

/**
 * The library as a car can see it.
 *
 * Android Auto never draws the app's own screens. It asks for a tree of
 * browsable and playable items and renders that itself, to its own rules about
 * how much a driver may be shown — which is why supporting it changes nothing
 * about the app and is entirely a matter of answering those questions well.
 *
 * The top of it is four tabs, which is all a car will show, and they are named
 * after what a driver wants rather than after how the library is filed. The
 * first is the important one: reaching for what you were playing yesterday is
 * the commonest thing anybody does in a car, and a tree of Tracks/Albums/Lists
 * cannot answer it at all — every one of those is a cabinet to be opened, and
 * the first screen plays nothing.
 */
internal object BrowseTree {
  const val ROOT = "root"
  private const val HOME = "home"
  private const val TRACKS = "tracks"
  private const val RECENT = "recent"
  private const val MOST_PLAYED = "most-played"
  private const val ADDED = "recently-added"
  private const val ALBUMS = "albums"
  private const val ARTISTS = "artists"
  private const val LISTS = "lists"

  /** Everything, in no order anybody chose. */
  private const val SHUFFLE = "shuffle"

  /**
   * How long the shelves on the first screen are.
   *
   * Short on purpose. These exist to be glanced at and reached into, and a
   * driver is held to about twenty items across a whole path while the car is
   * moving anyway.
   */
  private const val SHELF = 100

  /**
   * How many of each go on the first screen.
   *
   * Six apiece and three headings is eighteen, plus the shuffle row and the way
   * through to everything: twenty. A car holds a driver to about that many
   * across a whole path while it is moving, and what goes over is not scrolled
   * to, it is dropped.
   */
  private const val ON_HOME = 6

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

  /** The children of [parentId], or an empty list for an id with none. */
  fun children(context: Context, parentId: String): List<MediaItem> {
    val root = LibraryDatabase.libraryRoot(context)

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

    return when {
      // Four, because four is all that is shown. A fifth would not be a
      // crowded row, it would be a tab nobody can reach.
      parentId == ROOT -> listOf(
        browsable(context, HOME, "Home"),
        // Only the shelf of records is asked for as tiles: a record is known by
        // its cover, where a song is known by its name and a wall of identical
        // covers would say less than a list.
        browsable(context, ALBUMS, "Albums", grid = true),
        browsable(context, ARTISTS, "Artists", grid = true),
        browsable(context, LISTS, "Lists")
      )

      /*
        The songs themselves, under headings, rather than a row per heading.

        A car draws the children of one node as one scrolling screen and will
        put a title above any run of them that asks for the same one. That is
        the whole difference between a first screen that is a menu and a first
        screen that is content: three taps to reach something to play becomes
        one, and the space that was four words of a category name is a cover
        and a song instead.

        Held to about twenty between them because that is what a car allows a
        driver while it is moving, and going over does not scroll -- it is cut.
      */
      parentId == HOME -> buildList {
        add(shuffleEverything(context, root))

        val everything = tracks(context, root)
        val recent = inOrderOf(everything, LibraryDatabase.recentlyPlayed(context, ON_HOME))
        val most = inOrderOf(everything, LibraryDatabase.mostPlayed(context, ON_HOME))
        val added = everything
          .sortedWith(compareBy({ it.addedAt == null }, { -(it.addedAt ?: 0L) }))
          .take(ON_HOME)

        // A heading with nothing under it is worse than no heading, and a new
        // library has nothing it has played yet.
        recent.forEach { add(playable(context, it, RECENT, group = "Carry on")) }
        most.forEach { add(playable(context, it, MOST_PLAYED, group = "You play these most")) }
        added.forEach { add(playable(context, it, ADDED, group = "New here")) }

        add(browsable(context, TRACKS, "All tracks"))
      }

      parentId == ALBUMS -> albums(context, root).map { (name, entries) ->
        browsable(context, "$ALBUMS/$name", name, cover = entries.firstOrNull()?.id)
      }

      parentId == ARTISTS -> artists(context, root).map { (name, entries) ->
        browsable(
          context, "$ARTISTS/$name", name,
          subtitle = "${entries.size} tracks",
          cover = entries.firstOrNull()?.id
        )
      }

      parentId == LISTS -> LibraryDatabase.playlists(context).map {
        browsable(context, "$LISTS/${it.id}", it.name, "${it.trackCount} tracks")
      }

      else -> entriesOf(context, root, parentId)
        ?.let { songs(context, parentId, it) }
        .orEmpty()
    }
  }

  /**
   * The songs a node holds, in order, or null for a node that holds folders.
   *
   * Separated from [children] because a list may have to be handed over in
   * parts, and the parts have to be cut from the same sequence the whole was.
   */
  private fun entriesOf(context: Context, root: String, parentId: String): List<Entry>? = when {
    parentId == TRACKS -> tracks(context, root)

    // The history knows ids and when they were heard; what those ids are is
    // still the library's to say, and a track played once and deleted since
    // simply falls out of the shelf.
    parentId == RECENT -> inOrderOf(
      tracks(context, root), LibraryDatabase.recentlyPlayed(context, SHELF)
    )

    parentId == MOST_PLAYED -> inOrderOf(
      tracks(context, root), LibraryDatabase.mostPlayed(context, SHELF)
    )

    // Newest first, and anything the media store would not date goes last
    // rather than pretending to be from 1970.
    parentId == ADDED -> tracks(context, root)
      .sortedWith(compareBy({ it.addedAt == null }, { -(it.addedAt ?: 0L) }))
      .take(SHELF)

    parentId.startsWith("$ALBUMS/") ->
      albums(context, root)[parentId.removePrefix("$ALBUMS/")]

    parentId.startsWith("$ARTISTS/") ->
      artists(context, root)[parentId.removePrefix("$ARTISTS/")]

    parentId.startsWith("$LISTS/") -> {
      val id = parentId.removePrefix("$LISTS/").toLongOrNull()
      if (id == null) null else {
        val byId = tracks(context, root).associateBy { it.id }
        LibraryDatabase.playlistTrackIds(context, id).mapNotNull { byId[it] }
      }
    }

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
        subtitle = "${part.size} tracks",
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

  /**
   * The library arranged by who made it.
   *
   * Free: the artist is already on every row that has been read, so this is a
   * grouping of what is in hand rather than anything asked of the disk.
   */
  private fun artists(context: Context, root: String): Map<String, List<Entry>> =
    tracks(context, root)
      .groupBy { it.artist?.takeIf(String::isNotBlank) ?: "Unknown artist" }
      .mapValues { (_, entries) ->
        entries.sortedWith(
          compareBy({ it.album ?: "" }, { it.position == null }, { it.position ?: 0 }, { it.title })
        )
      }
      .toSortedMap(String.CASE_INSENSITIVE_ORDER)

  /** [entries] picked out and put in the order [ids] gives, skipping the gone. */
  private fun inOrderOf(entries: List<Entry>, ids: List<String>): List<Entry> {
    val byId = entries.associateBy { it.id }
    return ids.mapNotNull { byId[it] }
  }

  /**
   * One row that starts the whole library in no particular order.
   *
   * Playable, and first, because a browse screen wants something on it that
   * plays. Its own id rather than a track's: what it means is "all of them,
   * shuffled", and which track comes first is decided when it is chosen, not
   * when it is drawn.
   */
  private fun shuffleEverything(context: Context, root: String): MediaItem {
    val first = tracks(context, root).firstOrNull()
    return MediaItem.Builder()
      .setMediaId(SHUFFLE)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle("Shuffle everything")
          .setIsBrowsable(false)
          .setIsPlayable(true)
          .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
          .apply { first?.let { setArtworkUri(CoverProvider.uriFor(context, it.id)) } }
          .build()
      )
      .build()
  }

  /**
   * What to play when [mediaId] is chosen, and where in it to start.
   *
   * The whole of whatever it was found in, so that choosing the third track of
   * a record leaves the rest of the record queued behind it.
   */
  fun resolve(context: Context, mediaId: String): Pair<List<MediaItem>, Int> {
    if (mediaId == SHUFFLE) {
      // Shuffled here rather than handed over in order and shuffled by the
      // player: what was asked for was a shuffled queue, and leaving it to a
      // mode the driver cannot see would mean the row did something different
      // depending on a setting made weeks ago.
      val all = tracks(context, LibraryDatabase.libraryRoot(context)).shuffled()
      return all.map { playable(context, it, TRACKS) } to 0
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
    val albums = LibraryDatabase.albumsByTrack(context)
    val positions = LibraryDatabase.positionsByTrack(context)

    return MediaStoreLibrary.queryTracks(context, root).mapNotNull { row ->
      val id = row["id"] as? String ?: return@mapNotNull null
      val uri = row["uri"] as? String ?: return@mapNotNull null
      Entry(
        id = id,
        uri = uri,
        title = row["title"] as? String ?: "Unknown",
        artist = row["artist"] as? String,
        // What a lookup found outranks the folder name the media store reports
        // as an album, which for a folder of downloads is the folder.
        album = albums[id] ?: row["album"] as? String,
        position = positions[id],
        addedAt = row["addedAt"] as? Long,
        durationSec = (row["durationSec"] as? Number)?.toDouble() ?: -1.0
      )
    }
  }

  /**
   * Records, with their tracks in order.
   *
   * Only what a lookup named, and only what is still on the phone: the tracks
   * are taken from the media store and the names from the database, so a
   * record whose files have gone does not appear at all.
   */
  private fun albums(context: Context, root: String): Map<String, List<Entry>> {
    val named = LibraryDatabase.albumsByTrack(context)
    return tracks(context, root)
      .filter { named.containsKey(it.id) }
      .groupBy { it.album ?: "" }
      .filterKeys { it.isNotBlank() }
      .mapValues { (_, entries) ->
        // Numbered first and in order, the rest after them — the same rule the
        // app's own album screen follows.
        entries.sortedWith(
          compareBy({ it.position == null }, { it.position ?: 0 }, { it.title })
        )
      }
      .toSortedMap(String.CASE_INSENSITIVE_ORDER)
  }

  /**
   * A folder.
   *
   * [cover] is the track whose picture stands for the folder — a record's
   * first song, for a shelf of records. [grid] asks the car to lay the folder's
   * children out as tiles rather than as lines of text, which is the whole
   * difference between a list of album names and a wall of covers. It is a
   * hint: a head unit that does not do tiles ignores it and draws a list.
   */
  private fun browsable(
    context: Context,
    id: String,
    title: String,
    subtitle: String? = null,
    cover: String? = null,
    grid: Boolean = false
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
          .apply {
            cover?.let { setArtworkUri(CoverProvider.uriFor(context, it)) }
            if (grid) setExtras(grid())
          }
          .build()
      )
      .build()

  /**
   * Draw what is inside this folder as tiles.
   *
   * The keys are the old MediaBrowserCompat ones because that is what a head
   * unit still speaks; media3 passes the extras through untouched.
   */
  private fun grid() = Bundle().apply {
    putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 2)
    putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1)
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
