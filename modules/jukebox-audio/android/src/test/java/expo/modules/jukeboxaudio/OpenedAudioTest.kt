package expo.modules.jukeboxaudio

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

/*
  A file another app opens with this one: a plain path only where it is a
  file of its own outside the app's folder, a copy kept under one name for
  the same file, and only the latest few copies kept.
*/
class OpenedAudioTest {
  @Test fun aPathIsOpenedOnlyWhereItIsAFileOutsideTheApp() {
    val root = Files.createTempDirectory("opened").toFile()
    try {
      val own = File(root, "data/Kayra5138.Jukebox").apply { mkdirs() }
      val database = File(own, "databases/library.db").apply { parentFile!!.mkdirs(); writeText("sqlite") }
      val song = File(root, "Music/song.mp3").apply { parentFile!!.mkdirs(); writeText("mp3") }
      val beside = File(root, "data/Kayra5138.Jukebox2/song.mp3").apply { parentFile!!.mkdirs(); writeText("mp3") }

      assertTrue(OpenedAudio.opensAsFile(song.path, own.path))
      assertTrue(OpenedAudio.opensAsFile(beside.path, own.path))
      assertFalse(OpenedAudio.opensAsFile(database.path, own.path))
      assertFalse(OpenedAudio.opensAsFile("${root.path}/Music/../data/Kayra5138.Jukebox/databases/library.db", own.path))
      assertFalse(OpenedAudio.opensAsFile(song.parent, own.path))
      assertFalse(OpenedAudio.opensAsFile(File(root, "Music/gone.mp3").path, own.path))
      assertFalse(OpenedAudio.opensAsFile(null, own.path))
      // A device never ends, and is no file to copy.
      if (File("/dev/zero").exists()) assertFalse(OpenedAudio.opensAsFile("/dev/zero", own.path))
    } finally {
      root.deleteRecursively()
    }
  }

  @Test fun theSameFileOpenedAgainIsTheOneCopy() {
    val one = OpenedAudio.copyName("content://chat/9", 4_000, "Voice.MP3")
    assertEquals(one, OpenedAudio.copyName("content://chat/9", 4_000, "Voice.MP3"))
    assertEquals("mp3", one.second)
    assertEquals(20, one.first.length)
    assertNotEquals(one.first, OpenedAudio.copyName("content://chat/10", 4_000, "Voice.MP3").first)
    assertNotEquals(one.first, OpenedAudio.copyName("content://chat/9", 4_001, "Voice.MP3").first)
  }

  @Test fun anEndingIsKeptOnlyWhereItIsAPlainOne() {
    assertEquals("flac", OpenedAudio.copyName("x", 1, "a.flac").second)
    assertEquals("audio", OpenedAudio.copyName("x", 1, "no ending").second)
    assertEquals("audio", OpenedAudio.copyName("x", 1, null).second)
    assertEquals("audio", OpenedAudio.copyName("x", 1, "a.mp3/../../x").second)
    assertEquals("audio", OpenedAudio.copyName("x", 1, "a.toolongone").second)
    assertEquals("audio", OpenedAudio.copyName("x", 1, "a.").second)
  }

  @Test fun onlyTheLatestCopiesAreKept() {
    val root = Files.createTempDirectory("copies").toFile()
    try {
      val files = (0 until 15).map { at -> File(root, "$at.mp3").apply { writeText("$at"); setLastModified(1_000_000L + at * 1_000) } }
      val kept = files.first().apply { setLastModified(2_000_000L) }
      val gone = OpenedAudio.past(root.listFiles()!!.toList(), kept)
      // Eleven besides the one just made: twelve in all.
      assertEquals(15 - 12, gone.size)
      assertFalse(kept in gone)
      assertEquals(setOf(1, 2, 3).map { File(root, "$it.mp3") }.toSet(), gone.toSet())
    } finally {
      root.deleteRecursively()
    }
  }
}
