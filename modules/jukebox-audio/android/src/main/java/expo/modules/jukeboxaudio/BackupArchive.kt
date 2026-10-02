package expo.modules.jukeboxaudio

import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * A backup as a file: one document, and the pictures it refers to.
 *
 * A zip, because that is one thing to save and send where a folder would be
 * many, and because anybody curious can open it and read what the app has kept
 * about them. Nothing in here knows what the document says -- that is decided
 * in JavaScript, where it can be tested without a phone. This only packs and
 * unpacks.
 *
 * Unpacking is where the care goes. The file being read was chosen from
 * anywhere on the phone and may have been made by anything, so an entry is
 * taken only if it is exactly one of the two things a backup contains, written
 * only under a name with no path in it, and only up to a size no real backup
 * reaches. Everything else in the archive is passed over without a word.
 */
internal object BackupArchive {
  const val DOCUMENT = "jukebox-backup.json"
  private const val PICTURES = "artwork/"

  /** A file name and nothing else: no folder, no way up out of one. */
  private val NAME = Regex("^[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$")

  /*
    Far past anything real, and short of what would fill a phone. A history of
    a hundred thousand listens is a document of a few tens of megabytes; a
    cover is stored at twelve hundred pixels and is a few hundred kilobytes.
  */
  private const val MOST_DOCUMENT = 256L * 1024 * 1024
  private const val MOST_PICTURE = 16L * 1024 * 1024
  private const val MOST_PICTURES = 20_000

  fun safeName(name: String): Boolean = NAME.matches(name)

  /** Writes [document] and whichever of [pictures] exist to [out]. */
  fun write(out: OutputStream, document: String, pictures: List<File>) {
    ZipOutputStream(out.buffered()).use { zip ->
      zip.putNextEntry(ZipEntry(DOCUMENT))
      zip.write(document.toByteArray(Charsets.UTF_8))
      zip.closeEntry()

      val written = HashSet<String>()
      for (picture in pictures) {
        if (!safeName(picture.name) || !picture.isFile || !written.add(picture.name)) continue
        zip.putNextEntry(ZipEntry(PICTURES + picture.name))
        picture.inputStream().use { it.copyTo(zip) }
        zip.closeEntry()
      }
    }
  }

  /**
   * Reads a backup from [input], leaving its pictures in [into], and answers
   * the document.
   *
   * Throws with something a person can be shown if the file is not a backup.
   * A picture too large or too many of them is not treated as a reason to
   * refuse the rest: the picture is left out, which costs a cover, where
   * refusing the file would cost a history.
   */
  fun read(input: InputStream, into: File): String {
    var document: String? = null
    var pictures = 0
    ZipInputStream(input.buffered()).use { zip ->
      while (true) {
        val entry = zip.nextEntry ?: break
        val name = entry.name
        when {
          entry.isDirectory -> Unit
          name == DOCUMENT -> {
            val bytes = take(zip, MOST_DOCUMENT)
              ?: throw IllegalStateException("That backup is too large to read.")
            document = String(bytes, Charsets.UTF_8)
          }
          name.startsWith(PICTURES) -> {
            val plain = name.removePrefix(PICTURES)
            if (safeName(plain) && pictures < MOST_PICTURES) {
              val bytes = take(zip, MOST_PICTURE)
              if (bytes != null) {
                File(into, plain).writeBytes(bytes)
                pictures++
              }
            }
          }
        }
        zip.closeEntry()
      }
    }
    return document ?: throw IllegalStateException("That file is not a Jukebox backup.")
  }

  /**
   * The rest of the current entry, or null if it runs past [most].
   *
   * Counted as it is read rather than taken from the size the entry declares:
   * that figure is written by whoever made the archive, and an archive made to
   * cause trouble declares a small one.
   */
  private fun take(zip: ZipInputStream, most: Long): ByteArray? {
    val out = java.io.ByteArrayOutputStream()
    val chunk = ByteArray(64 * 1024)
    var total = 0L
    while (true) {
      val count = zip.read(chunk)
      if (count < 0) break
      total += count
      if (total > most) return null
      out.write(chunk, 0, count)
    }
    return out.toByteArray()
  }
}
