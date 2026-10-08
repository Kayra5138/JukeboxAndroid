import { samePalette, systemPaletteFrom } from './material.ts';
import { themeSurroundings } from './registry.ts';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';

/**
 * Asks the phone for its palette and keeps the answer where the themes read
 * it.
 *
 * Asked without waiting, which the native side allows because the answer is
 * a few dozen colours it already has in memory: that is what lets it be read
 * before the first frame, so an app set to the wallpaper's colours opens in
 * them rather than opening in the default and changing its mind.
 *
 * Asked again whenever the app comes back to the front, since the wallpaper
 * is changed somewhere else and nothing says so. The same answer as last
 * time is not written down again — everything on screen is listening, and
 * there is no reason to redraw it for news that is not news.
 *
 * Any failure is no palette: the theme that wants one is then not offered,
 * which is the truth about a phone that could not say.
 */
export function readSystemPalette(): void {
  let found = null;
  try {
    found = systemPaletteFrom(JukeboxAudio.systemPalette?.() ?? null);
  } catch {
    // A build from before the function existed, or a phone that refused.
  }
  const held = themeSurroundings.get();
  if (!samePalette(held.system, found)) themeSurroundings.set({ ...held, system: found });
}
