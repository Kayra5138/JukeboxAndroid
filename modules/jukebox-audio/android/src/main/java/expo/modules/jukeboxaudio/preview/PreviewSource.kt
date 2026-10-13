package expo.modules.jukeboxaudio.preview

import java.net.URL

/**
 * Where a preview of a song may be played from, and nowhere else.
 *
 * A preview is thirty seconds of a song as Deezer serves it to anybody: its
 * catalogue hands out an address for each track, signed and good for a short
 * while, on a host of its own that serves nothing but these. The address
 * comes to the phone from JavaScript, which had it from the network, so it
 * is held to here before anything is asked of it: `https`, no port, no name
 * and password, and one of the hosts previews are really served from —
 * `cdnt-preview.dzcdn.net` on the day this was written (asked by hand, 13
 * October 2026: a plain 200, `audio/mpeg`, 480 kB, no redirect), and its
 * older spellings `cdns-preview-0.dzcdn.net` … `cdns-preview-f.dzcdn.net`,
 * which the catalogue still names for some tracks.
 *
 * Nothing else under `dzcdn.net` — the covers are there too, on another
 * host, and are no business of a player — and nothing that only looks like
 * it. The player follows no redirect at all (see [PreviewDataSource]), so a
 * hop to anywhere else is a preview that does not play.
 */
object PreviewSource {
  private val host = Regex("cdn[a-z]?-preview(-[0-9a-f]{1,2})?\\.dzcdn\\.net")

  /** [address] as it may be asked, or null where it may not be. */
  fun checked(address: String?): URL? {
    if (address.isNullOrBlank() || address.length > 2000) return null
    val url = runCatching { URL(address.trim()) }.getOrNull() ?: return null
    if (url.protocol.lowercase() != "https" || url.userInfo != null) return null
    if (url.port != -1 && url.port != 443) return null
    return if (host.matches(url.host.lowercase())) url else null
  }
}
