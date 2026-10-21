package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Test

class MangledTitleTest {
  @Test fun `an emoji the store spoiled comes back from the file name`() {
    assertEquals(
      "\"Justitia\" (Vocaloid) 🍓 ENGLISH COVER by Lizz Robinett",
      MangledTitle.repair(
        "\"Justitia\" (Vocaloid) ???? ENGLISH COVER by Lizz Robinett",
        "Justitia (Vocaloid) 🍓 ENGLISH COVER by Lizz Robinett [JBGllmkquuM].mp3"
      )
    )
  }

  @Test fun `each run takes its own emoji, in order`() {
    assertEquals(
      "🎵OVERWATCH: No Mercy - The Living Tombstone 🎵",
      MangledTitle.repair(
        "????OVERWATCH: No Mercy - The Living Tombstone ????",
        "🎵OVERWATCH No Mercy - The Living Tombstone 🎵 [S9uTScSgzrM].mp3"
      )
    )
  }

  @Test fun `where the runs and the emoji do not pair up, the file name stands`() {
    assertEquals(
      "Song 🎵🎶 again",
      MangledTitle.repair("Song ???? again ????", "Song 🎵🎶 again.mp3")
    )
  }

  @Test fun `a title of other words, or with no runs, is left as it is`() {
    assertEquals("Who?? Me", MangledTitle.repair("Who?? Me", "Something else 🎵.mp3"))
    assertEquals("Plain", MangledTitle.repair("Plain", "Plain 🎵.mp3"))
    assertEquals("Odd ????", MangledTitle.repair("Odd ????", "Odd.mp3"))
    assertEquals(null, MangledTitle.repair(null, "x.mp3"))
  }

  @Test fun `an artist's emoji comes back from the part of the file name it stands in`() {
    assertEquals("🎵Artist", MangledTitle.repairTag("????Artist", "🎵Artist - Title.mp3"))
    assertEquals(
      "The Living Tombstone 🎶",
      MangledTitle.repairTag("The Living Tombstone ????", "🎵No Mercy - The Living Tombstone 🎶 [S9uTScSgzrM].mp3")
    )
    // Two runs, two emoji, in order; the name's punctuation and spacing do not matter.
    assertEquals("🌸 Sakura-chan 💫", MangledTitle.repairTag("???? Sakura-chan ????", "Song - 🌸Sakura chan💫.mp3"))
  }

  @Test fun `an album and an album artist are mended the same way`() {
    assertEquals("Summer 🍉 Hits", MangledTitle.repairTag("Summer ???? Hits", "Summer 🍉 Hits - 01 Song.flac"))
  }

  @Test fun `a tag the name does not hold loses its runs and the spaces they leave`() {
    assertEquals("Artist", MangledTitle.repairTag("???? Artist", "Title.mp3"))
    assertEquals("Artist", MangledTitle.repairTag("Artist ????", "Someone else 🎵.mp3"))
    assertEquals("Big Band", MangledTitle.repairTag("Big ???? ???? Band", "x.mp3"))
    assertEquals("LoveSong", MangledTitle.repairTag("Love????Song", null))
  }

  @Test fun `a tag whose emoji could be either of two is not guessed at`() {
    // "A" stands beside both, so neither is put in.
    assertEquals("A", MangledTitle.repairTag("????A", "🎵A - 🎶A.mp3"))
    // Both places agree, so the one emoji is safe.
    assertEquals("🎵A", MangledTitle.repairTag("????A", "🎵A - 🎵A.mp3"))
  }

  @Test fun `a run where the name has letters is no emoji`() {
    assertEquals("Artist", MangledTitle.repairTag("Artist ????", "Artist Name 🎵.mp3"))
  }

  @Test fun `a tag of nothing but an emoji is nothing at all`() {
    assertEquals(null, MangledTitle.repairTag("????", "🎵 Song.mp3"))
  }

  @Test fun `a tag with no run, or only two marks, is left as it is`() {
    assertEquals("Plain", MangledTitle.repairTag("Plain", "Plain 🎵.mp3"))
    assertEquals("Why??", MangledTitle.repairTag("Why??", "Song.mp3"))
    assertEquals("Why?? Not", MangledTitle.repairTag("Why?? Not", "Song.mp3"))
    assertEquals("Odd  spacing ?", MangledTitle.repairTag("Odd  spacing ?", "x.mp3"))
    assertEquals(null, MangledTitle.repairTag(null, "x.mp3"))
  }
}
