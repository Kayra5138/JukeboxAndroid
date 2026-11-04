package expo.modules.jukeboxaudio

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.File
import java.io.Serializable

/**
 * Asking the system for a folder the backups made by themselves go into.
 *
 * Asked once, when automatic backup is turned on. The grant is kept across
 * restarts (see [BackupFolder.keep]), so a backup made with the app closed can
 * write there without anybody being asked again: the app is given that one
 * folder and sees nothing else of the storage.
 */
class BackupFolderPick : AppContextActivityResultContract<BackupFolderPick.Input, String?> {
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
      Intent.FLAG_GRANT_READ_URI_PERMISSION or
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
        Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
    )

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null
}

/**
 * The folder automatic backups are written into: writing one there, and
 * deleting the oldest beyond the number to keep.
 *
 * A backup here is the very file "Export everything" saves ([BackupArchive]),
 * named as that one is offered, `Jukebox-backup-YYYY-MM-DD.zip`, with `-2`
 * and on for a second on the same day. Only files named so are ever deleted:
 * the folder is the user's, and whatever else they keep in it is theirs.
 */
internal object BackupFolder {
  private val NAME = Regex("^Jukebox-backup-(\\d{4})-(\\d{2})-(\\d{2})(?:-(\\d+))?\\.zip$")
  private const val FLAGS = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION

  /** Whether [name] is one of the backups' own names. */
  fun ours(name: String): Boolean = NAME.matches(name)

  /** [wanted], or with `-2`, `-3` and on before `.zip` where a file of that name is already in the folder. */
  fun freeName(wanted: String, taken: Set<String>): String {
    if (wanted !in taken) return wanted
    val stem = wanted.removeSuffix(".zip")
    var count = 2
    while ("$stem-$count.zip" in taken) count++
    return "$stem-$count.zip"
  }

  /**
   * Of [names], the backups to delete so that the newest [keep] are left,
   * oldest first. By the day in the name and then the number after it, which
   * is the order they were made in: by the letters alone, `-2.zip` would come
   * before `.zip`. Names that are not the backups' own are never among them.
   */
  fun beyond(names: Collection<String>, keep: Int): List<String> {
    val ordered = names.mapNotNull { name ->
      val found = NAME.matchEntire(name) ?: return@mapNotNull null
      val (year, month, day, count) = found.destructured
      Triple(name, "$year$month$day", count.toIntOrNull() ?: 1)
    }.sortedWith(compareBy<Triple<String, String, Int>>({ it.second }, { it.third }))
    return ordered.dropLast(keep.coerceAtLeast(1)).map { it.first }
  }

  /** Keeps the grant to [tree] across restarts, and lets go of [previous] where it was another folder. */
  fun keep(context: Context, tree: Uri, previous: Uri?) {
    context.contentResolver.takePersistableUriPermission(tree, FLAGS)
    if (previous != null && previous != tree) {
      runCatching { context.contentResolver.releasePersistableUriPermission(previous, FLAGS) }
    }
  }

  /** The folder's own name, where it can still be reached; null where it cannot. */
  fun name(context: Context, tree: Uri): String? {
    if (!permitted(context, tree)) return null
    return runCatching {
      context.contentResolver.query(root(tree), arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)
        ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) ?: "" else null }
    }.getOrNull()
  }

  /**
   * Writes a backup of [document] and [pictures] into [tree] under [wanted], or
   * the next free name after it, then deletes the oldest of the backups there
   * beyond [keep]. Answers the name it was written under.
   *
   * Throws where the folder cannot be reached or written to. A backup half
   * written is deleted rather than left looking like one. One that cannot be
   * deleted when its turn comes is left where it is: it costs room, where
   * failing the backup just made would cost the backup.
   */
  fun write(context: Context, tree: Uri, wanted: String, document: String, pictures: List<File>, keep: Int): String {
    if (!permitted(context, tree)) throw Told(R.string.jukebox_file_not_writable)
    val resolver = context.contentResolver
    val before = children(context, tree)
    val name = freeName(wanted, before.values.toSet())
    val made = DocumentsContract.createDocument(resolver, root(tree), "application/zip", name)
      ?: throw Told(R.string.jukebox_file_not_writable)
    try {
      val out = resolver.openOutputStream(made, "w") ?: throw Told(R.string.jukebox_file_not_writable)
      out.use { BackupArchive.write(it, document, pictures) }
    } catch (trouble: Exception) {
      runCatching { DocumentsContract.deleteDocument(resolver, made) }
      throw trouble
    }
    // What the folder called it, which a provider is free to make other than what was asked for.
    val written = runCatching {
      resolver.query(made, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)
        ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
    }.getOrNull() ?: name
    val madeId = DocumentsContract.getDocumentId(made)
    val all = before + (madeId to written)
    val byName = all.entries.groupBy({ it.value }, { it.key })
    for (old in beyond(all.values, keep)) {
      for (id in byName[old].orEmpty()) {
        if (id == madeId) continue
        runCatching { DocumentsContract.deleteDocument(resolver, DocumentsContract.buildDocumentUriUsingTree(tree, id)) }
      }
    }
    return written
  }

  /** Whether the grant to [tree] is still held, for reading and writing both. */
  private fun permitted(context: Context, tree: Uri): Boolean =
    context.contentResolver.persistedUriPermissions.any { it.uri == tree && it.isReadPermission && it.isWritePermission }

  /** The folder itself, as a document. */
  private fun root(tree: Uri): Uri =
    DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))

  /** What is in the folder, each by its document id and name. Throws where it cannot be listed. */
  private fun children(context: Context, tree: Uri): Map<String, String> {
    val listing = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
    val found = LinkedHashMap<String, String>()
    val cursor = context.contentResolver.query(
      listing,
      arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME),
      null,
      null,
      null
    ) ?: throw Told(R.string.jukebox_file_not_writable)
    cursor.use {
      while (it.moveToNext()) {
        val id = it.getString(0) ?: continue
        found[id] = it.getString(1) ?: continue
      }
    }
    return found
  }
}
