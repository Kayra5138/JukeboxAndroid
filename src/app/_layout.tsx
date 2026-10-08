import { DiscoverProvider } from '../lib/discover/DiscoverProvider';
import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { keepCarCopy } from '../lib/db/carCopy';
import { loadLanguage, useT } from '../lib/i18n/index';
import { loadLyricsTarget } from '../lib/lyrics/useTarget';
import { NowPlayingHost } from '../lib/player/NowPlayingSheet';
import { PlayerProvider } from '../lib/player/PlayerProvider';
import { keepScrobbling } from '../lib/scrobble/index';
import { loadTheme, useTheme } from '../lib/theme/index';
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
        <NowPlayingHost>
          {/* Named for the clock, not the page: light writing over a dark theme. */}
          <StatusBar style={theme.base === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: c.bg },
              headerTintColor: c.text,
              contentStyle: { backgroundColor: c.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="metadata" options={{ title: t.nav.tags }} />
            <Stack.Screen name="folders" options={{ title: t.nav.libraryFolder }} />
            <Stack.Screen name="samesongs" options={{ title: t.nav.sameSong }} />
            <Stack.Screen name="equalizer" options={{ title: t.nav.equalizer }} />
            <Stack.Screen name="transitions" options={{ title: t.nav.crossfade }} />
            <Stack.Screen name="effects" options={{ title: t.nav.effects }} />
            {/* The whole screen is the board. A header over it is a strip of
                the game nobody can play, and the game draws its own. */}
            <Stack.Screen name="tiles" options={{ headerShown: false }} />
            {/* Titled by the list itself, which the screen draws. */}
            <Stack.Screen name="playlist" options={{ headerShown: false }} />
            <Stack.Screen name="details" options={{ title: t.nav.details }} />
          </Stack>
        </NowPlayingHost>
      </DiscoverProvider>
      </DownloadsProvider>
    </PlayerProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
