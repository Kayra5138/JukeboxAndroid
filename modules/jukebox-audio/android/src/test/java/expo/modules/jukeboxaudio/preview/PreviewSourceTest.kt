package expo.modules.jukeboxaudio.preview

import org.junit.Assert.*
import org.junit.Test

/* Which addresses a preview may be played from, held to on a desk. */
class PreviewSourceTest {
  @Test fun theAddressesDeezerHandsOutAreAllowed() {
    // As the catalogue answered when it was asked, signature and all.
    val live = "https://cdnt-preview.dzcdn.net/api/1/1/6/a/2/0/6a2c0a5670afe821e08fc5154909534a.mp3" +
      "?hdnea=exp=1791879692~acl=/api/1/1/6/a/2/0/6a2c0a5670afe821e08fc5154909534a.mp3*~data=user_id=0,application_id=42~hmac=92433d48"
    assertEquals("cdnt-preview.dzcdn.net", PreviewSource.checked(live)?.host)
    assertNotNull(PreviewSource.checked("https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-10.mp3"))
    assertNotNull(PreviewSource.checked("https://cdn-preview-0.dzcdn.net/stream/x.mp3"))
    assertNotNull(PreviewSource.checked("  https://CDNT-PREVIEW.dzcdn.net/a.mp3 "))
  }

  @Test fun anythingElseIsRefused() {
    for (address in listOf(
      null, "", "not an address",
      "http://cdnt-preview.dzcdn.net/a.mp3",
      "https://cdnt-preview.dzcdn.net:8443/a.mp3",
      "https://somebody:secret@cdnt-preview.dzcdn.net/a.mp3",
      // The covers' host, and hosts that only look the part.
      "https://cdn-images.dzcdn.net/images/cover/x.jpg",
      "https://cdnt-preview.dzcdn.net.example.com/a.mp3",
      "https://example.com/cdnt-preview.dzcdn.net/a.mp3",
      "https://evil-cdnt-preview.dzcdn.net/a.mp3",
      "https://cdnt-preview-anything-at-all.dzcdn.net/a.mp3",
      "https://api.deezer.com/track/3135556",
      "file:///data/data/app/secret",
      "content://media/external/audio/media/1",
      "https://cdnt-preview.dzcdn.net/" + "a".repeat(2100),
    )) assertNull(address, PreviewSource.checked(address))
  }
}
