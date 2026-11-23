package expo.modules.jukeboxaudio

/**
 * The surfaces a media app is expected to appear in, and the only callers
 * outside this app allowed to browse the library.
 *
 * Short on purpose. A name that is not here is not refused because it is
 * suspect but because nothing else has any business reading somebody's
 * listening history, and a list of what a player might plausibly be asked by
 * is far easier to be sure of than a list of what it should fear.
 */
internal val BROWSERS = setOf(
  // The car.
  "com.google.android.projection.gearhead",
  // The watch.
  "com.google.android.wearable.app",
  "com.google.android.wearable.media.sessions",
  // The assistant, which is also what a squeezed phone or a headset button
  // reaches when it is asked to play something.
  "com.google.android.googlequicksearchbox",
  // The shade and the lock screen.
  "com.android.systemui",
  /*
    Samsung's lock screen, which is not the system's. The card that opens
    there, and the always-on display, are drawn by a package of their own,
    and it is that package that asks for a place in the track when the bar
    on the card is dragged. Play, pause and skip reached the player all the
    same, since those are sent as key presses and a key press is not asked
    whose it is; the bar alone was turned away, moved under the finger and
    went back.
  */
  "com.samsung.android.app.aodservice",
  // A head unit or a pair of headphones talking over Bluetooth.
  "com.android.bluetooth"
)

/**
 * Who may read the library from outside the app: browse it, as a car does,
 * or ask for its covers. One answer for both, so that a surface let in to
 * the one is never turned away from the other.
 */
internal object Callers {
  /**
   * Whether the caller running as [uid] and naming itself [packageName] may
   * read: this app itself, the system, and [BROWSERS]. [ownUid] and
   * [ownPackage] are this app's.
   */
  fun mayRead(uid: Int, packageName: String?, ownUid: Int, ownPackage: String): Boolean =
    uid == ownUid || uid == android.os.Process.SYSTEM_UID || (packageName != null && (packageName == ownPackage || packageName in BROWSERS))
}
