import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';

import { fromOutside, pageOfLink } from './late.ts';

/**
 * A link that opened the app while the app was already running behind the
 * screen — woken for its podcasts, a backup, a download — taken where it
 * says, rather than to the library.
 *
 * The router asks for the link it was opened with the moment it is drawn.
 * From cold that is long after the window is there, the script taking its
 * time to load. Woken behind the screen first, the script is loaded already,
 * the router is drawn as the window is made, and the window is not yet the
 * one the link can be read from: the answer is that there is none. So where
 * it was none while the app was behind, it is asked once more as the app
 * first comes to the front, and the page it names opened then, over the
 * library. Where it was answered the first
 * time the router has it; nothing here does anything. Draws nothing.
 */
export function LateLink() {
  const router = useRouter();

  useEffect(() => {
    if (AppState.currentState === 'active') return;
    const first = Linking.getInitialURL().catch(() => null);
    const watch = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      watch.remove();
      void first.then(async (was) => {
        if (was != null) return;
        const page = pageOfLink(await Linking.getInitialURL().catch(() => null));
        if (page) router.push(fromOutside(page) as never);
      });
    });
    return () => watch.remove();
  }, [router]);

  return null;
}
