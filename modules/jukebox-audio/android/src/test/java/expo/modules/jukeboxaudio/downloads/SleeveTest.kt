package expo.modules.jukeboxaudio.downloads

import org.junit.Assert.*
import org.junit.Test
import java.net.URL

/* The walk from the address a song carries to the picture, as the archives really answer it. */
class SleeveTest {
  private val carried = URL("https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15ffdd/829521842-250.jpg")

  @Test fun theArchivesOwnRedirectsAreFollowed() {
    assertEquals(carried, Sleeve.hop(carried))
    // What coverartarchive.org answered when it was asked, on the day this was written.
    val second = Sleeve.next(carried,
      "https://archive.org/download/mbid-76df3287-6cda-33eb-8e9a-044b5e15ffdd/mbid-76df3287-6cda-33eb-8e9a-044b5e15ffdd-829521842_thumb250.jpg")
    assertEquals("archive.org", second?.host)
    val third = Sleeve.next(second!!, "https://ia800100.us.archive.org/3/items/mbid-76df3287/cover_thumb250.jpg")
    assertEquals("ia800100.us.archive.org", third?.host)
    // A redirect that gives only a path stays where it is.
    assertEquals("https://archive.org/elsewhere.jpg", Sleeve.next(second, "/elsewhere.jpg").toString())
  }

  @Test fun aHopInTheClearIsMadeOverHttpsAndNotTurnedAway() {
    val hop = Sleeve.next(carried, "http://ia600200.us.archive.org/12/items/mbid-x/cover_thumb250.jpg?cnt=0")
    assertEquals("https://ia600200.us.archive.org/12/items/mbid-x/cover_thumb250.jpg?cnt=0", hop.toString())
    assertEquals("https://archive.org/download/x.jpg", Sleeve.hop(URL("http://archive.org:80/download/x.jpg")).toString())
  }

  @Test fun aPictureOfDeezersIsFetchedWhereItIs() {
    val cover = URL("https://cdn-images.dzcdn.net/images/cover/2e018122cb56986277102d2041a592c8/250x250-000000-80-0-0.jpg")
    assertEquals(cover, Sleeve.hop(cover))
    assertNotNull(Sleeve.hop(URL("https://e-cdns-images.dzcdn.net/images/cover/x/250x250-000000-80-0-0.jpg")))
    assertNull(Sleeve.hop(URL("https://dzcdn.net/cover.jpg")))
    assertNull(Sleeve.hop(URL("https://cdn-images.dzcdn.net.example.com/cover.jpg")))
  }

  @Test fun anywhereElseIsRefused() {
    assertNull(Sleeve.next(carried, "https://example.com/cover.jpg"))
    assertNull(Sleeve.next(carried, "https://archive.org.example.com/cover.jpg"))
    assertNull(Sleeve.next(carried, "https://notarchive.org/cover.jpg"))
    assertNull(Sleeve.next(carried, "ftp://archive.org/cover.jpg"))
    assertNull(Sleeve.next(carried, "https://somebody:secret@archive.org/cover.jpg"))
    assertNull(Sleeve.next(carried, "https://archive.org:8443/cover.jpg"))
    assertNull(Sleeve.next(carried, "http://archive.org:8080/cover.jpg"))
    assertNull(Sleeve.next(carried, null))
    assertNull(Sleeve.next(carried, " "))
    assertNull(Sleeve.hop(URL("https://i.ytimg.com/vi/abc/hqdefault.jpg")))
  }
}
