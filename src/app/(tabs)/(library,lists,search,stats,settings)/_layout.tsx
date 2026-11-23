import { Stack } from 'expo-router';

import { IN_PLACE, inPlaceGlass, overGlass, paged } from '../../../components/Pages';
import { useT } from '../../../lib/i18n/index';
import { useColours } from '../../../lib/theme/index';
import { glassOf } from '../../../lib/theme/Veil';
import { useMotionReduced } from '../../../lib/ui/motion';

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

const STILL_IN_PLACE = { ...inPlaceGlass, animation: 'none' } as const;

export default function TabPages({ segment }: { segment: string }) {
  const t = useT();
  const c = useColours();
  /*
    How every page but the tab's own is opened in a theme of glass: over the
    one below and not in place of it, with its bar drawn in the page (see
    `Paged`). Nothing at all in any other theme.
  */
  const glass = glassOf(c) > 0;
  /*
    Held still, no page comes in from the side, and in glass every page is
    opened in place of the one below as Settings' are: see `Paged`.
  */
  const still = useMotionReduced();
  const over = glass ? (still ? STILL_IN_PLACE : overGlass) : null;
  // Those Settings opens, opened in place of the page below instead: see `IN_PLACE`.
  const placed = glass ? (still ? STILL_IN_PLACE : inPlaceGlass) : null;
  return (
    <Stack
      // The page every screen is drawn on: see `Paged`.
      screenLayout={paged}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.bg },
        animation: still ? 'none' : 'default',
      }}>
      {/* Drawn on the page under all the tabs, which is behind it: nothing of its own behind it. */}
      <Stack.Screen name={ROOTS[segment] ?? 'index'} options={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      {/* The pages the Settings tab is a menu of, in its order. */}
      <Stack.Screen name="settings-look" options={{ title: t.settings.sections.look, ...placed }} />
      <Stack.Screen name="settings-haptics" options={{ title: t.settings.haptics.title, ...placed }} />
      <Stack.Screen name="settings-sound" options={{ title: t.settings.sections.sound, ...placed }} />
      {/* Speed, pitch and the sleep timer: the player's sheet of them, as a page (`playback`). */}
      <Stack.Screen name="playback" options={{ title: t.settings.playback.title, ...placed }} />
      <Stack.Screen name="settings-player" options={{ title: t.settings.sections.player, ...placed }} />
      <Stack.Screen name="settings-miniplayer" options={{ title: t.settings.sections.miniPlayer, ...placed }} />
      <Stack.Screen name="settings-tapes" options={{ title: t.settings.sections.tapes, ...placed }} />
      <Stack.Screen name="settings-library" options={{ title: t.settings.sections.library, ...placed }} />
      <Stack.Screen name="settings-downloads" options={{ title: t.settings.sections.downloads, ...placed }} />
      <Stack.Screen name="settings-data" options={{ title: t.settings.sections.data, ...placed }} />
      {/* From the foot of the Settings tab, above the first start. */}
      <Stack.Screen name="report" options={{ title: t.support.report.title, ...placed }} />
      <Stack.Screen name="metadata" options={{ title: t.nav.tags, ...placed }} />
      <Stack.Screen name="folders" options={{ title: t.nav.libraryFolder, ...placed }} />
      <Stack.Screen name="left-out" options={{ title: t.library.leftOut.title, ...placed }} />
      <Stack.Screen name="set-aside" options={{ title: t.library.setAside.title, ...placed }} />
      <Stack.Screen name="samesongs" options={{ title: t.nav.sameSong, ...placed }} />
      <Stack.Screen name="duplicates" options={{ title: t.library.copies.title, ...placed }} />
      <Stack.Screen name="wrong-downloads" options={{ title: t.library.wrong.title, ...placed }} />
      <Stack.Screen name="free-space" options={{ title: t.space.title, ...placed }} />
      <Stack.Screen name="equalizer" options={{ title: t.nav.equalizer, ...placed }} />
      <Stack.Screen name="transitions" options={{ title: t.nav.crossfade, ...placed }} />
      <Stack.Screen name="effects" options={{ title: t.nav.effects, ...placed }} />
      {/* Until the screen knows what kind of list it is (a record, an artist's, a folder) and says that instead. */}
      <Stack.Screen name="playlist" options={{ title: t.nav.list, ...over }} />
      {/* A smart list's rules; the screen says whether it is making one or changing one. */}
      <Stack.Screen name="smart-list" options={{ title: t.smart.editor.newTitle, ...placed }} />
      <Stack.Screen name="details" options={{ title: t.nav.details, ...placed }} />
      {/* Until the screen knows the album's name and says that instead. */}
      <Stack.Screen name="album-rest" options={{ title: t.nav.albumRest, ...over }} />
      <Stack.Screen name="themes" options={{ title: t.nav.themes, ...placed }} />
      <Stack.Screen name="player-look" options={{ title: t.nav.playerLook, ...placed }} />
      <Stack.Screen name="theme" options={{ title: t.nav.customTheme, ...placed }} />
      <Stack.Screen name="downloads" options={{ title: t.nav.downloads, ...over }} />
      {/* Opened from the tapes view of the library, and from nowhere else. */}
      <Stack.Screen name="tapes-add" options={{ title: t.library.tapes.add, ...placed }} />
      <Stack.Screen name="podcast" options={{ title: t.search.tapes.podcasts.showTitle, ...over }} />
      <Stack.Screen name="marks" options={{ title: t.player.marks.screen, ...over }} />
      <Stack.Screen name="book" options={{ title: t.search.tapes.sources.books, ...over }} />
      <Stack.Screen name="tape" options={{ title: t.library.tapes.details.title, ...over }} />
      <Stack.Screen name="discover-settings" options={{ title: t.discover.settings.title, ...placed }} />
      {/* What would have been a sheet over a page of Settings: titled by what it is, which the page says (`OnAPage`). */}
      <Stack.Screen name="shown" options={{ title: '', ...placed }} />
    </Stack>
  );
}
