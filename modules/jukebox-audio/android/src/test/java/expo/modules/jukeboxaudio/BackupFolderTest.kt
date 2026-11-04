package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupFolderTest {
  @Test
  fun `a backup's name is taken as it is, or with the next number free`() {
    val day = "Jukebox-backup-2026-10-29.zip"
    assertEquals(day, BackupFolder.freeName(day, setOf("Jukebox-backup-2026-10-28.zip")))
    assertEquals("Jukebox-backup-2026-10-29-2.zip", BackupFolder.freeName(day, setOf(day)))
    assertEquals(
      "Jukebox-backup-2026-10-29-4.zip",
      BackupFolder.freeName(day, setOf(day, "Jukebox-backup-2026-10-29-2.zip", "Jukebox-backup-2026-10-29-3.zip"))
    )
  }

  @Test
  fun `only the backups' own names are theirs`() {
    assertTrue(BackupFolder.ours("Jukebox-backup-2026-10-29.zip"))
    assertTrue(BackupFolder.ours("Jukebox-backup-2026-10-29-12.zip"))
    assertFalse(BackupFolder.ours("Jukebox-backup-2026-10-29 (1).zip"))
    assertFalse(BackupFolder.ours("Jukebox-backup-2026-10-29.zip.txt"))
    assertFalse(BackupFolder.ours("holiday.zip"))
    assertFalse(BackupFolder.ours("jukebox-backup-2026-10-29.zip"))
  }

  @Test
  fun `the oldest beyond the number kept go, by day and then by number`() {
    val names = listOf(
      "Jukebox-backup-2026-10-29.zip",
      "Jukebox-backup-2026-10-22-2.zip",
      "notes.txt",
      "Jukebox-backup-2026-10-22.zip",
      "Jukebox-backup-2026-10-29-2.zip",
      "Jukebox-backup-2025-12-31.zip",
    )
    assertEquals(
      listOf("Jukebox-backup-2025-12-31.zip", "Jukebox-backup-2026-10-22.zip", "Jukebox-backup-2026-10-22-2.zip"),
      BackupFolder.beyond(names, 2)
    )
    assertEquals(emptyList<String>(), BackupFolder.beyond(names, 5))
  }

  @Test
  fun `at least one is always kept`() {
    val names = listOf("Jukebox-backup-2026-10-22.zip", "Jukebox-backup-2026-10-29.zip")
    assertEquals(listOf("Jukebox-backup-2026-10-22.zip"), BackupFolder.beyond(names, 0))
  }
}
