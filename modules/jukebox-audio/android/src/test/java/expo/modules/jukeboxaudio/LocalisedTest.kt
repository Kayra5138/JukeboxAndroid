package expo.modules.jukeboxaudio

import androidx.media3.common.PlaybackException
import org.junit.Assert.assertEquals
import org.junit.Test

/*
  The parts of the language that need no phone. Which words a resource holds,
  and that a wrapped context answers in the app's language rather than the
  phone's, are the phone's to show and are not tested here.
*/
class LocalisedTest {
  @Test
  fun `a tag is kept as the tag it is`() {
    assertEquals("en", languageTag("en"))
    assertEquals("tr", languageTag("tr"))
    assertEquals("pt-BR", languageTag("pt-BR"))
    // As Java writes one, and with space around it.
    assertEquals("pt-BR", languageTag(" pt_BR "))
  }

  @Test
  fun `nothing, and nonsense, are the default`() {
    assertEquals(DEFAULT_LANGUAGE, languageTag(null))
    assertEquals(DEFAULT_LANGUAGE, languageTag(""))
    assertEquals(DEFAULT_LANGUAGE, languageTag("   "))
    assertEquals(DEFAULT_LANGUAGE, languageTag("not a language at all"))
  }

  @Test
  fun `a sentence with nobody to say it still says which it was`() {
    // No app here, so no words; the message must not be a crash instead.
    val told = Told(R.string.jukebox_file_not_opened)
    assertEquals(R.string.jukebox_file_not_opened, told.words.id)
    assertEquals("words ${R.string.jukebox_file_not_opened}", told.message)
  }

  @Test
  fun `a player's fault is put into the sentence for its kind`() {
    assertEquals(R.string.jukebox_playback_missing, playbackWords(PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND))
    assertEquals(R.string.jukebox_playback_denied, playbackWords(PlaybackException.ERROR_CODE_IO_NO_PERMISSION))
    assertEquals(R.string.jukebox_playback_unreadable, playbackWords(PlaybackException.ERROR_CODE_IO_UNSPECIFIED))
    assertEquals(R.string.jukebox_playback_unsupported, playbackWords(PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED))
    assertEquals(R.string.jukebox_playback_unsupported, playbackWords(PlaybackException.ERROR_CODE_DECODER_INIT_FAILED))
    assertEquals(R.string.jukebox_playback_failed, playbackWords(PlaybackException.ERROR_CODE_UNSPECIFIED))
    assertEquals(R.string.jukebox_playback_failed, playbackWords(PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED))
  }
}
