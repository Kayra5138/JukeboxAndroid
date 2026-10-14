import { DiscoverProvider } from '../lib/discover/DiscoverProvider';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

import { DownloadsButton } from '../components/DownloadsButton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { keepCarCopy } from '../lib/db/carCopy';
import { loadLanguage, useT } from '../lib/i18n/index';
import { loadLyricsTarget } from '../lib/lyrics/useTarget';
import { NowPlayingHost } from '../lib/player/NowPlayingSheet';
import { PlayerProvider } from '../lib/player/PlayerProvider';
import { keepScrobbling } from '../lib/scrobble/index';
import { loadTheme, makeStyles, page, useColours, useTheme } from '../lib/theme/index';
import { glassOf, glassPage, setBack, WindowBehind } from '../lib/theme/Veil';
import { ThemeSurroundings } from '../lib/theme/Surroundings';
import { DownloadsProvider } from '../lib/youtube/DownloadsProvider';

/*
  The choices everything on screen depends on, read as this file is loaded and
  so before anything is drawn. Each is a row out of the settings table, which
  opens the database a frame earlier than the app otherwise would; the price of
  not reading them here is a first frame in English and in the wrong theme,
  corrected by the second, which is a flash nobody should be shown.
*/
loadLanguage();
loadTheme();
loadLyricsTarget();

export default function RootLayout() {
  const theme = useTheme();
  const t = useT();
  const c = theme.colours;

  // What the car and the widget read is a copy, kept up to date from here.
  useEffect(() => keepCarCopy(), []);

  /*
    Whatever is waiting to go to ListenBrainz is tried now, and again each time
    the app comes back to the front. For somebody who has not connected it --
    which is nearly everybody -- this reads one setting and stops.
  */
  useEffect(() => keepScrobbling(), []);

  /*
    The window itself, behind every screen. It is what shows through for the
    moment a screen slides over another and around the keyboard as it comes
    up, and left at what it was built with it would be a dark edge on a light
    app.
  */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  /*
    The navigator has colours of its own, used wherever a screen has not said
    — the backdrop between two screens in a transition is the one that is
    seen. Built on whichever of its two stock themes is the right way up, since
    that is where its fonts come from.
  */
  const glass = glassOf(c);
  /*
    How every screen but the first is opened in a theme of glass: over the
    one below and not in place of it, with a bar that is the same wash as its
    page and has no line under it. Nothing at all in any other theme. The
    game is left out: its board is the whole screen and is nobody's glass.
  */
  const over = glass > 0 ? { ...overGlass, headerStyle: glassPage(c) } : null;
  const navigation = {
    ...(theme.base === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      primary: c.accent,
      background: c.bg,
      card: c.bg,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };

  return (
    /*
      Outside everything, the providers included, so that there is nothing a
      throw can come from that this does not catch. Trying again therefore
      starts the providers over as well, which costs nothing that matters: the
      player is asked what it is doing and the app takes its word, the same as
      after a reload.
    */
    <ErrorBoundary>
    <ThemeProvider value={navigation}>
    <PlayerProvider>
      {/*
        Under the player because it has to see what is playing, for the theme
        that takes its colour from the cover. The theme itself is read from
        outside the tree and so by this layout too, above the player, which is
        why nothing here had to change places.
      */}
      <ThemeSurroundings />
      <DownloadsProvider>
      <DiscoverProvider>
        {/*
          The now-playing screen is a layer over the navigator rather than a route
          within it, so whatever is underneath stays on screen while it is open.
        */}
        {/*
          Round everything that is drawn in this window, so that a sheet
          opened in a window of its own has all of it behind it to veil.
        */}
        <WindowBehind>
        <NowPlayingHost>
          {/* Named for the clock, not the page: light writing over a dark theme. */}
          <StatusBar style={theme.base === 'dark' ? 'light' : 'dark'} />
          <Stack
            /*
              The page every screen is drawn on, put under each of them here
              and nowhere else. A screen draws nothing behind itself; it could
              not always if it wanted to, since a page that is more than one
              colour is only drawn by a plain view and half the screens are
              lists. Under the tabs it is one page for all of them and for
              the bar they are chosen from.
            */
            screenLayout={paged}
            screenOptions={{
              headerStyle: { backgroundColor: c.bg },
              headerTintColor: c.text,
              contentStyle: { backgroundColor: c.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* The pages the Settings tab is a menu of, in its order. */}
            <Stack.Screen name="settings-look" options={{ title: t.settings.sections.look, ...over }} />
            <Stack.Screen name="settings-sound" options={{ title: t.settings.sections.sound, ...over }} />
            <Stack.Screen name="settings-player" options={{ title: t.settings.sections.player, ...over }} />
            <Stack.Screen name="settings-library" options={{ title: t.settings.sections.library, ...over }} />
            <Stack.Screen name="settings-downloads" options={{ title: t.settings.sections.downloads, ...over }} />
            <Stack.Screen name="settings-data" options={{ title: t.settings.sections.data, ...over }} />
            <Stack.Screen name="metadata" options={{ title: t.nav.tags, ...over }} />
            <Stack.Screen name="folders" options={{ title: t.nav.libraryFolder, ...over }} />
            <Stack.Screen name="samesongs" options={{ title: t.nav.sameSong, ...over }} />
            <Stack.Screen name="equalizer" options={{ title: t.nav.equalizer, ...over }} />
            <Stack.Screen name="transitions" options={{ title: t.nav.crossfade, ...over }} />
            <Stack.Screen name="effects" options={{ title: t.nav.effects, ...over }} />
            {/* The whole screen is the board. A header over it is a strip of
                the game nobody can play, and the game draws its own. */}
            <Stack.Screen name="tiles" options={{ headerShown: false }} />
            {/* Titled by the list itself, which the screen draws. */}
            <Stack.Screen name="playlist" options={{ headerShown: false, ...over }} />
            <Stack.Screen name="details" options={{ title: t.nav.details, ...over }} />
            {/* Until the screen knows the album's name and says that instead. */}
            <Stack.Screen name="album-rest" options={{ title: t.nav.albumRest, ...over }} />
            <Stack.Screen name="themes" options={{ title: t.nav.themes, ...over }} />
            <Stack.Screen name="theme" options={{ title: t.nav.customTheme, ...over }} />
            <Stack.Screen name="downloads" options={{ title: t.nav.downloads, ...over }} />
            <Stack.Screen name="discover-settings" options={{ title: t.discover.settings.title, ...over }} />
          </Stack>
          {/*
            Over the navigator, so that it stays put while one screen slides
            over another, and inside the host, whose player is drawn after
            its children: the player covers it, as does anything in a window
            of its own.
          */}
          <DownloadsButton />
        </NowPlayingHost>
        </WindowBehind>
      </DiscoverProvider>
      </DownloadsProvider>
    </PlayerProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

/**
 * Screens that are not glass in any theme: the tabs, which everything else
 * is opened over, and the game, whose board is the whole screen.
 *
 * In a theme of glass every other screen is opened as glass over the one it
 * was opened from. That one stays drawn, out of focus, and shows through a
 * wash of the page's colour. It began as a trial on one screen, to find out
 * whether a whole screen held out of focus cost too much; it did not.
 */
const NEVER_GLASS = new Set(['(tabs)', 'tiles']);

type Routes = { index: number; routes: readonly { key: string; name: string; state?: unknown }[] };

/**
 * The navigator a screen is in, out of the whole account of what is open:
 * the one whose screens include it. Looked for and not assumed to be the
 * outermost, since what the router keeps outermost is its own business.
 */
function stackOf(state: Routes | undefined, key: string): Routes | null {
  if (!state || !Array.isArray(state.routes)) return null;
  if (state.routes.some((route) => route.key === key)) return state;
  for (const route of state.routes) {
    const found = stackOf(route.state as Routes | undefined, key);
    if (found) return found;
  }
  return null;
}

/**
 * A screen, on the page of the theme in use; or in a theme of glass, as
 * whichever of four things it is just now.
 *
 * On top and glass: a wash, with the screen below showing through. On top
 * and not glass: its page, as in any theme. Directly under a glass screen:
 * what it was, out of focus. Further down than that: there, and not drawn.
 * Each sheet of glass over another is a whole screen drawn again, and three
 * deep nobody can tell what the third is showing; so only the one directly
 * below is ever seen, through the one on top.
 */
function Paged({ children, name, routeKey }: { children: ReactNode; name: string; routeKey: string }) {
  const c = useColours();
  const styles = usePage();
  // The navigator's own account of what is open, which every screen is told of when it changes: an
  // address would not do, since a screen can be opened over another of the same address.
  const stack = stackOf(useRootNavigationState() as Routes | undefined, routeKey);
  const glass = glassOf(c);
  const mine = !NEVER_GLASS.has(name);
  if (glass <= 0) return <View collapsable={false} style={styles.page}>{children}</View>;

  const { index, routes } = stack ?? { index: 0, routes: [] };
  // Not found, it is taken to be on top: drawn as itself, which is never wrong for long.
  const at = routes.findIndex((route) => route.key === routeKey);
  const under = at < 0 ? 0 : index - at;
  // Whether everything from here up to the top is glass, which is whether this can be seen through at all.
  const seenThrough = under > 0 && routes.slice(at + 1, index + 1).every((route) => !NEVER_GLASS.has(route.name));
  const ground = mine ? styles.over : styles.page;
  // Never folded away, for the reason `Behind` is not: see there.
  return (
    <View
      collapsable={false}
      style={
        under === 0
          ? ground
          : !seenThrough
            ? ground
            : under === 1
              ? [ground, setBack(c)]
              : [ground, styles.unseen]
      }>
      {children}
    </View>
  );
}

/** Made once, so that the navigator is handed the same thing each time it asks. */
const paged = ({ children, route }: { children: ReactNode; route: { key: string; name: string } }) => (
  <Paged name={route.name} routeKey={route.key}>
    {children}
  </Paged>
);

/**
 * How a screen of glass is opened: over the one below and not in place of
 * it, and in from the side as one thing. It faded up at first, and a thing
 * that fades up is not seen to arrive; what is under it is set back as it
 * comes, darker as well as out of focus, which is the rest of what makes
 * the new screen stand in front and not merely lie over.
 */
const overGlass = {
  presentation: 'transparentModal',
  animation: 'slide_from_right',
  contentStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
} as const;

const usePage = makeStyles((c) =>
  StyleSheet.create({
    page: { flex: 1, ...page(c) },
    over: { flex: 1, ...glassPage(c) },
    unseen: { opacity: 0 },
  })
);
