package expo.modules.jukeboxaudio.tags

/**
 * TagLib, as far as this app uses it. See `src/main/cpp/tags`.
 *
 * Two calls, both on a path, and the path is always a copy in the app's own
 * cache: nothing native is ever pointed at a file of the user's. What comes
 * back is plain strings rather than objects, so that everything done with the
 * answers -- [TagReport], [verify] -- is ordinary Kotlin that a unit test can
 * run without the library, which a desktop JVM cannot load.
 *
 * An object and not a class because there is one library and loading it is
 * the only state there is. Whether that worked is kept rather than thrown: on
 * an architecture the library was not built for there is no writing to files,
 * and the rest of the app has no reason to notice.
 */
internal object Tags {
  /** Whether the library is there to be called at all. */
  val ready: Boolean = runCatching { System.loadLibrary("jukeboxtags") }.isSuccess

  /**
   * What the file at [path] says about itself, as names and values one after
   * the other; `["error", why]` for a file that is neither an MP3 nor a FLAC
   * or cannot be read as the one it claims to be.
   */
  external fun read(path: String): Array<String>?

  /**
   * Writes into the file at [path]. [fields] is title, artist, album, genre,
   * year, track and disc in that order, null where the file is to keep what
   * it has. Answers `changed:` and the names of what was altered, or `error:`
   * and why.
   */
  external fun write(
    path: String,
    fields: Array<String?>,
    picture: ByteArray?,
    mime: String?,
    width: Int,
    height: Int
  ): String?
}
