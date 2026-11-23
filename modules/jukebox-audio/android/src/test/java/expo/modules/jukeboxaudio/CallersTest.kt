package expo.modules.jukeboxaudio

import org.junit.Assert.*
import org.junit.Test

/*
  Who may read the library from outside: the app, the system, and the few
  surfaces a player is shown on; every other app is told no, whatever it
  calls itself short of one of those names.
*/
class CallersTest {
  private val ownUid = 10_234
  private val own = "Kayra5138.Jukebox"

  @Test fun theAppItselfAndTheSystemMayRead() {
    assertTrue(Callers.mayRead(ownUid, null, ownUid, own))
    assertTrue(Callers.mayRead(android.os.Process.SYSTEM_UID, null, ownUid, own))
    assertTrue(Callers.mayRead(10_999, own, ownUid, own))
  }

  @Test fun theCarTheWatchAndTheLockScreenMayRead() {
    for (name in listOf("com.google.android.projection.gearhead", "com.google.android.wearable.app", "com.android.systemui", "com.samsung.android.app.aodservice", "com.android.bluetooth")) {
      assertTrue(name, Callers.mayRead(10_500, name, ownUid, own))
    }
  }

  @Test fun anyOtherAppIsToldNo() {
    for (name in listOf("com.example.reader", "com.google.android.projection", "com.android.systemui.evil", "", null)) {
      assertFalse(name.toString(), Callers.mayRead(10_500, name, ownUid, own))
    }
  }
}
