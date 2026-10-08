package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The one part of reading the phone's palette that is not the phone's: how a
 * colour is written down. JavaScript refuses anything that is not seven
 * characters, so a colour written short would cost the whole theme.
 */
class SystemPaletteTest {
  @Test
  fun `a colour is written as six digits, small letters, and no alpha`() {
    assertEquals("#ffffff", SystemPalette.hex(0xFFFFFFFF.toInt()))
    assertEquals("#000000", SystemPalette.hex(0xFF000000.toInt()))
    assertEquals("#00a1ff", SystemPalette.hex(0xFF00A1FF.toInt()))
    assertEquals("#0a0b0c", SystemPalette.hex(0x800A0B0C.toInt()))
  }
}
