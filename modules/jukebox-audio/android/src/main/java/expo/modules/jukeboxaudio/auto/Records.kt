package expo.modules.jukeboxaudio.auto

import java.util.Locale

/**
 * Which tracks are one record, for the car.
 *
 * The rule the phone's album list follows (`src/lib/media/albums.ts`), said
 * again here because the car is answered by the service, which cannot ask
 * the phone. Said more briefly, too: the phone takes credits apart with a
 * longer list of names that only look like several artists and with what
 * lookups have learned about each credit, and this has neither. Where the two
 * part company it is over a record somebody tagged unusually, and the car
 * shows it a little differently from the phone; nothing is lost either way.
 *
 * In short, a record is the tracks sharing an album name, told apart by their
 * album artist where they name more than one:
 *
 *  1. Tracks naming no album artist, or all naming the same one, are one record.
 *  2. "Various Artists" is a compilation, a record of its name alone.
 *  3. Album artists that are each only the artist of their own tracks, sharing
 *     a folder, on records of a song or two apiece or of three or more, are
 *     one record that somebody's tagger filled in track by track.
 *  4. Otherwise each album artist is a record. A track naming none joins the
 *     record of its own first artist, its whole credit, or the only record of
 *     any other artist it names; failing those, the only record with tracks in
 *     its folder; failing that, a record of the name alone.
 *
 * The first artist and not the whole of a credit is what an album artist is
 * keyed by, so a guest on one song does not take it off its record.
 */
internal object Records {
  /** Between a record's name and its artist in a key, as on the phone. */
  const val BETWEEN = '\u001f'

  /** What one track says about the record it is on. */
  data class Said(val album: String?, val albumArtist: String?, val artist: String?, val folder: String?)

  /** One record: its key, the name it is shown under, and its album artist where it has one. */
  data class Record<T>(val key: String, val name: String, val albumArtist: String?, val tracks: List<T>)

  private val FEATURING = Regex("\\s*[(\\[]?\\s*\\b(?:featuring|feat|ft)\\b\\.?\\s+", RegexOption.IGNORE_CASE)
  private val HARD = Regex("\\s*[;,]\\s*|\\s+/\\s+")
  private val SOFT = Regex("\\s+&\\s+|\\s+x\\s+|\\s+vs\\.?\\s+")

  /** Names that look like several artists and are one; the commonest of the phone's list. */
  private val ONE_ARTIST = listOf(
    "Earth, Wind & Fire", "Simon & Garfunkel", "Tyler, The Creator", "Hall & Oates",
    "Crosby, Stills & Nash", "Crosby, Stills, Nash & Young", "Emerson, Lake & Palmer",
    "Peter, Paul and Mary", "Above & Beyond", "Chase & Status", "Mumford & Sons",
    "Belle & Sebastian", "Iron & Wine", "Years & Years", "Angus & Julia Stone", "AC/DC",
  ).map(::fold).toSet()

  /** What a record's tracks say when it is by many people, folded. */
  private val MANY_ARTISTS = listOf(
    "Various Artists", "Various Artist", "Various", "VA", "V.A.", "V/A", "Varios Artistas",
    "Artistas Varios", "Vários Artistas", "Verschiedene Interpreten", "Verschiedene Künstler",
    "Artistes Divers", "Artistes Variés", "Artisti Vari", "Artisti Diversi", "Çeşitli Sanatçılar",
    "Karışık", "Различные исполнители", "Разные исполнители", "Сборник",
    "ヴァリアス・アーティスト", "オムニバス", "群星", "多位艺术家", "Compilation",
  ).map(::fold).toSet()

  /** Folded for telling names apart: no case, no accents, no dotless i, nothing but letters and digits. */
  internal fun fold(text: String): String =
    folded(text).replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()

  internal fun isCompilation(credit: String?): Boolean =
    credit != null && fold(credit).let { it.isNotEmpty() && it in MANY_ARTISTS }

  /** The first artist of a credit, folded: what records are told apart by. */
  internal fun artistKey(credit: String?): String {
    val whole = credit?.trim().orEmpty()
    if (whole.isEmpty()) return ""
    if (fold(whole) in ONE_ARTIST) return fold(whole)
    val billed = whole.split(FEATURING).first().trim()
    if (fold(billed) in ONE_ARTIST) return fold(billed)
    val first = billed.split(HARD).first().trim()
    return fold(if (fold(first) in ONE_ARTIST) first else first.split(SOFT).first())
  }

  /** Every artist a credit names, folded, the first first. */
  private fun artistsIn(credit: String?): List<String> {
    val whole = credit?.trim().orEmpty()
    if (whole.isEmpty()) return emptyList()
    if (fold(whole) in ONE_ARTIST) return listOf(fold(whole))
    return whole.split(FEATURING).flatMap { side ->
      side.split(HARD).flatMap { piece -> if (fold(piece) in ONE_ARTIST) listOf(piece) else piece.split(SOFT) }
    }.map(::fold).filter { it.isNotEmpty() }.distinct()
  }

  /** A record's key: its name, and its album artist's key where it has one. */
  internal fun key(name: String, by: String?): String {
    val record = name.trim().lowercase(Locale.ROOT)
    return if (by.isNullOrEmpty()) record else "$record$BETWEEN$by"
  }

  /** The name part of a key, which is the whole of a key without an artist. */
  internal fun nameOf(key: String): String = key.substringBefore(BETWEEN)

  /** [tracks] gathered into records, in the order each record's first track came. */
  fun <T> group(tracks: List<T>, said: (T) -> Said): List<Record<T>> {
    val byName = LinkedHashMap<String, MutableList<T>>()
    for (track in tracks) {
      val name = said(track).album?.trim().orEmpty()
      if (name.isEmpty()) continue
      byName.getOrPut(key(name, null)) { mutableListOf() }.add(track)
    }
    return byName.flatMap { (nameKey, members) -> recordsIn(nameKey, members, said) }
  }

  private fun <T> recordsIn(nameKey: String, members: List<T>, said: (T) -> Said): List<Record<T>> {
    val named = LinkedHashMap<String, MutableList<T>>()
    val loose = mutableListOf<T>()
    val rest = mutableListOf<T>()
    for (track in members) {
      val albumArtist = said(track).albumArtist?.trim().orEmpty()
      when {
        albumArtist.isEmpty() -> loose.add(track)
        isCompilation(albumArtist) -> rest.add(track)
        else -> {
          val by = artistKey(albumArtist)
          if (by.isEmpty()) loose.add(track) else named.getOrPut(by) { mutableListOf() }.add(track)
        }
      }
    }

    if (named.isEmpty() || (named.size >= 2 && taggedTrackByTrack(named, said))) {
      return listOf(record(nameKey, null, members, said))
    }

    val folders = named.mapValues { (_, held) -> held.mapNotNull { said(it).folder }.toSet() }
    for (track in loose) {
      val home = homeOf(said(track), named.keys, folders)
      if (home != null) named.getValue(home).add(track) else rest.add(track)
    }
    return named.map { (by, held) -> record(nameKey, by, held, said) } +
      if (rest.isEmpty()) emptyList() else listOf(record(nameKey, null, rest, said))
  }

  private fun <T> taggedTrackByTrack(named: Map<String, List<T>>, said: (T) -> Said): Boolean {
    if (named.any { (by, held) -> held.any { artistKey(said(it).artist) != by } }) return false
    if (named.size < 3 && named.values.any { it.size > 2 }) return false
    val seen = mutableMapOf<String, String>()
    for ((by, held) in named) {
      for (track in held) {
        val folder = said(track).folder ?: continue
        val other = seen[folder]
        if (other != null && other != by) return true
        seen[folder] = by
      }
    }
    return false
  }

  private fun homeOf(track: Said, records: Set<String>, folders: Map<String, Set<String>>): String? {
    val credited = artistsIn(track.artist)
    credited.firstOrNull()?.let { if (it in records) return it }
    fold(track.artist.orEmpty()).let { if (it.isNotEmpty() && it in records) return it }
    credited.drop(1).filter { it in records }.distinct().singleOrNull()?.let { return it }
    val folder = track.folder ?: return null
    return folders.filter { (_, held) -> folder in held }.keys.singleOrNull()
  }

  private fun <T> record(nameKey: String, by: String?, tracks: List<T>, said: (T) -> Said): Record<T> {
    // The spelling most of them give, the first met between equals.
    val albumArtist = tracks.mapNotNull { track ->
      said(track).albumArtist?.trim()?.takeIf {
        it.isNotEmpty() && if (by != null) artistKey(it) == by else isCompilation(it)
      }
    }.groupingBy { it }.eachCount().maxByOrNull { it.value }?.key
    return Record(
      key = key(nameKey, by),
      name = said(tracks.first()).album?.trim().orEmpty(),
      albumArtist = albumArtist,
      tracks = tracks
    )
  }
}
