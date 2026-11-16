import { Stack } from 'expo-router';

import { overGlass, paged } from '../../../components/Pages';
import { useT } from '../../../lib/i18n/index';
import { useColours } from '../../../lib/theme/index';
import { glassOf } from '../../../lib/theme/Veil';

/**
 * Each tab's own stack: the page the tab opens on, and every page opened
 * from there, over it and beside or above the tab bar, which stays where it
 * is whatever is open and whichever way the phone is turned.
 *
 * The pages were the root's once, opened over the tabs and their bar: the bar
 * went whenever a page came, and a record opened upright and turned on its
 * side covered the rail the same record opened sideways from the rack did
 * not. Now there is one way a page is opened, inside the tab it was opened
 * from, as in most apps; and each tab keeps its own, to come back to.
 *
 * The same pages in every tab, by the five groups this folder is named for:
 * opened from a tab, an address finds that tab's copy (`/playlist` from the
 * Lists tab opens in the Lists tab). The game is the root's still, over
 * everything: see `app/_layout.tsx`.
 */

/** The page each tab opens on, by its group. */
const ROOTS: Record<string, string> = {
  '(library)': 'index',
  '(lists)': 'lists',
  '(search)': 'search',
  '(stats)': 'stats',
  '(settings)': 'settings',
};

/*
  That page under every other, however the app was opened: a page a link
  opened it on — a podcast's, from a notification or another app — has the
  tab's own page under it, and Back goes there rather than out of the app.
*/
export const unstable_settings = {
  '(library)': { anchor: 'index' },
  '(lists)': { anchor: 'lists' },
  '(search)': { anchor: 'search' },
  '(stats)': { anchor: 'stats' },
  '(settings)': { anchor: 'settings' },
};

export default function TabPages({ segment }: { segment: string }) {
  const t = useT();
  const c = useColours();
  /*
    How every page but the tab's own is opened in a theme of glass: over the
    one below and not in place of it, with its bar drawn in the page (see
    `Paged`). Nothing at all in any other theme.
  */
  const over = glassOf(c) > 0 ? overGlass : null;
  return (
    <Stack
      // The page every screen is drawn on: see `Paged`.
      screenLayout={paged}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.bg },
      }}>
      {/* Drawn on the page under all the tabs, which is behind it: nothing of its own behind it. */}
      <Stack.Screen name={ROOTS[segment] ?? 'index'} options={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      {/* The pages the Settings tab is a menu of, in its order. */}
      <Stack.Screen name="settings-look" options={{ title: t.settings.sections.look, ...over }} />
      <Stack.Screen name="settings-haptics" options={{ title: t.settings.haptics.title, ...over }} />
      <Stack.Screen name="settings-sound" options={{ title: t.settings.sections.sound, ...over }} />
      <Stack.Screen name="settings-player" options={{ title: t.settings.sections.player, ...over }} />
      <Stack.Screen name="settings-tapes" options={{ title: t.settings.sections.tapes, ...over }} />
      <Stack.Screen name="settings-library" options={{ title: t.settings.sections.library, ...over }} />
      <Stack.Screen name="settings-downloads" options={{ title: t.settings.sections.downloads, ...over }} />
      <Stack.Screen name="settings-data" options={{ title: t.settings.sections.data, ...over }} />
      {/* From the foot of the Settings tab, above the first start. */}
      <Stack.Screen name="report" options={{ title: t.support.report.title, ...over }} />
      <Stack.Screen name="metadata" options={{ title: t.nav.tags, ...over }} />
      <Stack.Screen name="folders" options={{ title: t.nav.libraryFolder, ...over }} />
      <Stack.Screen name="left-out" options={{ title: t.library.leftOut.title, ...over }} />
      <Stack.Screen name="set-aside" options={{ title: t.library.setAside.title, ...over }} />
      <Stack.Screen name="samesongs" options={{ title: t.nav.sameSong, ...over }} />
      <Stack.Screen name="duplicates" options={{ title: t.library.copies.title, ...over }} />
      <Stack.Screen name="wrong-downloads" options={{ title: t.library.wrong.title, ...over }} />
      <Stack.Screen name="free-space" options={{ title: t.space.title, ...over }} />
      <Stack.Screen name="equalizer" options={{ title: t.nav.equalizer, ...over }} />
      <Stack.Screen name="transitions" options={{ title: t.nav.crossfade, ...over }} />
      <Stack.Screen name="effects" options={{ title: t.nav.effects, ...over }} />
      {/* Titled by the list itself, which the screen draws. */}
      <Stack.Screen name="playlist" options={{ headerShown: false, ...over }} />
      {/* A smart list's rules; the screen says whether it is making one or changing one. */}
      <Stack.Screen name="smart-list" options={{ title: t.smart.editor.newTitle, ...over }} />
      <Stack.Screen name="details" options={{ title: t.nav.details, ...over }} />
      {/* Until the screen knows the album's name and says that instead. */}
      <Stack.Screen name="album-rest" options={{ title: t.nav.albumRest, ...over }} />
      <Stack.Screen name="themes" options={{ title: t.nav.themes, ...over }} />
      <Stack.Screen name="player-look" options={{ title: t.nav.playerLook, ...over }} />
      <Stack.Screen name="theme" options={{ title: t.nav.customTheme, ...over }} />
      <Stack.Screen name="downloads" options={{ title: t.nav.downloads, ...over }} />
      {/* Opened from the tapes view of the library, and from nowhere else. */}
      <Stack.Screen name="tapes-add" options={{ title: t.library.tapes.add, ...over }} />
      <Stack.Screen name="podcast" options={{ title: t.search.tapes.podcasts.showTitle, ...over }} />
      <Stack.Screen name="marks" options={{ title: t.player.marks.screen, ...over }} />
      <Stack.Screen name="book" options={{ title: t.search.tapes.sources.books, ...over }} />
      <Stack.Screen name="tape" options={{ title: t.library.tapes.details.title, ...over }} />
      <Stack.Screen name="discover-settings" options={{ title: t.discover.settings.title, ...over }} />
    </Stack>
  );
}
