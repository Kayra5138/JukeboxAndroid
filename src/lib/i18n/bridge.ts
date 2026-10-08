import JukeboxAudio from '../../../modules/jukebox-audio';

/**
 * Tells the native side which language the app is in.
 *
 * The notification, the widget and the car are drawn in Kotlin and never see
 * these tables, so they have to be told: the BCP-47 tag, once as the app
 * starts and again whenever the choice changes.
 *
 * The function is optional on the module: a build made before the native
 * half existed does not have it, and there the call does nothing and the
 * notification stays in English.
 */
export function tellNativeLanguage(tag: string): void {
  try {
    JukeboxAudio.setAppLanguage?.(tag);
  } catch {
    // What is drawn in JavaScript is already right; the rest stays as it was.
  }
}
