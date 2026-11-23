import { DiscoverProvider } from '../lib/discover/DiscoverProvider';
import { actionTime, watchActionTime } from '../lib/ui/actionTime';
import { lengthenTimesWith } from '../lib/discover/core';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import * as SystemUI from 'expo-system-ui';

import { DownloadsButton } from '../components/DownloadsButton';
import { UndoNotice } from '../components/UndoNotice';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { paged } from '../components/Pages';
import { PressListHost } from '../components/PressList';
import { PressMenuHost } from '../components/PressMenu';
import { Setup } from '../components/welcome/Setup';
import { keepBackingUp } from '../lib/backup/auto';
import { scheduleBackups } from '../lib/backup/background';
import { keepCarCopy } from '../lib/db/carCopy';
import { keepSpreadingCovers } from '../lib/media/coverSpread';
import { loadLanguage } from '../lib/i18n/index';
import { loadLyricsTarget } from '../lib/lyrics/useTarget';
import { keepLookupsGoing } from '../lib/metadata/background';
import { keepPodcastsChecked } from '../lib/podcasts/refresh';
import { schedulePodcasts } from '../lib/podcasts/background';
import { keepSpaceFreed } from '../lib/space/auto';
import { syncTapeJumps } from '../lib/tapes/settings';
import { syncTapeSpeeds } from '../lib/tapes/speed';
import { fetchNextAfter } from '../lib/podcasts/next';
import { LateLink } from '../lib/links/LateLink';
import { Listening } from '../lib/listen/Listening';
import { OpenedAudio } from '../lib/player/OpenedAudio';
import { KeepWhereWeAre } from '../components/NameLinks';
import { prepareTape } from '../lib/tapes/extras';
import { sweepMarksOnce } from '../lib/tapes/marks';
import { isTape } from '../lib/tapes/tape';
import { Autoplay } from '../lib/player/autoplay/Autoplay';
import { NowPlayingHost } from '../lib/player/NowPlayingSheet';
import { PlayerProvider, usePlayerState } from '../lib/player/PlayerProvider';
import { keepScrobbling } from '../lib/scrobble/index';
import { watchErrors } from '../lib/support/errorLogStore';
import { keepCheckingForUpdates } from '../lib/support/updateStore';
import { loadTheme, useTheme } from '../lib/theme/index';
import { WindowBehind } from '../lib/theme/Veil';
import { ThemeSurroundings } from '../lib/theme/Surroundings';
import { useWelcomeShown } from '../lib/ui/welcomeStore';
import { useMotionReduced } from '../lib/ui/motion';
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
/*
  Before anything can go wrong, every error nobody caught is written down for
  the report screen (see `support/errorLog.ts`), and then goes wherever it
  went before.
*/
watchErrors();

// And what goes away by itself, a song offered back or a notice, given as long as Android was asked to give it.
watchActionTime();
lengthenTimesWith(actionTime);

/*
  The tabs under every page, however the app was opened: a page a link opened
  it on — a podcast's, from a notification or another app — has the library
  under it, and Back goes there rather than out of the app.
*/
export const unstable_settings = { anchor: '(tabs)' };

const CLEAR_PAGE = { backgroundColor: 'transparent' };

export default function RootLayout() {
  const theme = useTheme();
  const c = theme.colours;
  const welcome = useWelcomeShown();
  /** Holding the decoration still: no page slides in, and nothing Reanimated moves goes anywhere but to its end. */
  const still = useMotionReduced();

  // What the car and the widget read is a copy, kept up to date from here.
  useEffect(() => keepCarCopy(), []);

  /*
    Whatever is waiting to go to ListenBrainz is tried now, and again each time
    the app comes back to the front. For somebody who has not connected it --
    which is nearly everybody -- this reads one setting and stops.
  */
  useEffect(() => keepScrobbling(), []);

  /*
    Whether there is a newer Jukebox, asked of GitHub at most once a day as
    the app comes to the front, and not at all with the switch off: see
    `support/update.ts`. What it finds is shown on Settings and nowhere else.
  */
  useEffect(() => keepCheckingForUpdates(), []);

  /*
    A record's cover handed to the tracks of it that have none, whenever the
    library changes: see `media/coverSpread.ts`. Nothing is asked of the
    library for it; it waits for the library to be read by the screens.
  */
  useEffect(() => keepSpreadingCovers(), []);

  /*
    A lookup of details, covers or lyrics carried on behind the screen, with a
    notification while it is: see `metadata/background.ts`.
  */
  useEffect(() => keepLookupsGoing(), []);

  // The podcasts somebody follows, read again now and then, and their new episodes fetched: see `podcasts/refresh.ts`.
  useEffect(() => keepPodcastsChecked(), []);
  /*
    Songs the app downloaded itself and nobody has listened to for months,
    deleted once a day, for somebody who has turned that on: see `space/auto.ts`.
  */
  useEffect(() => keepSpaceFreed(), []);
  // And with the app closed: see `podcasts/background.ts`.
  /*
    A backup into the folder chosen for them, when one is due, a little after
    the app opens and as it comes back to the front: see `backup/auto.ts`.
    With automatic backup off, which is where it starts, this reads a setting.
  */
  useEffect(() => keepBackingUp(), []);
  useEffect(() => {
    void schedulePodcasts();
    // And with the app closed: see `backup/background.ts`.
    void scheduleBackups();
    // The tape's jumps, for presses from outside the app: see `tapes/settings.ts`.
    syncTapeJumps();
    syncTapeSpeeds();
    // Marks left behind by tapes deleted before they went with them, once.
    void sweepMarksOnce();
  }, []);

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
    // Round everything, so that a row anywhere can be held for its ring: see `PressMenu.tsx`.
    <GestureHandlerRootView style={rootStyles.app}>
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
      {/*
        Every timing, spring, decay and repeat of Reanimated's, across the
        app, taken to its end at once while the decoration is held still; the
        phone's own setting otherwise, as Reanimated would anyway. What runs
        frame by frame of its own (the game's keys) is not one of those.
      */}
      <ReducedMotionConfig mode={still ? ReduceMotion.Always : ReduceMotion.System} />
      <DownloadsProvider>
      <DiscoverProvider>
        {/*
          Under both the player and Discover, which it takes songs from when
          the queue is about to run out. Draws nothing.
        */}
        <Autoplay />
        {/* The episode after the one begun, for a show set to fetch it: see `podcasts/next.ts`. Draws nothing. */}
        <NextEpisodes />
        {/*
          The now-playing screen is a layer over the navigator rather than a route
          within it, so whatever is underneath stays on screen while it is open.
        */}
        {/*
          Round everything that is drawn in this window, so that a sheet
          opened in a window of its own has all of it behind it to veil.
        */}
        <WindowBehind>
        {/* Out of a screen reader's reach while the first start's setup is over it. */}
        {/*
          Never folded into its parent: a view whose only difference from
          nothing is what a screen reader may see is folded away when that
          says nothing, and made again when it does, and doing either to the
          view everything is in, between frames, is how the drawing of the
          app and what it was asked to draw came apart (see `TrackStrip`).
        */}
        <View collapsable={false} style={rootStyles.app} importantForAccessibility={welcome ? 'no-hide-descendants' : 'auto'}>
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
              animation: still ? 'none' : 'default',
            }}>
            {/* Nothing under the tabs of its own: the window is the page's colour, and each tab paints its own (see `Paged`). */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: CLEAR_PAGE }} />
            {/*
              The whole screen is the board. A header over it is a strip of
              the game nobody can play, and the game draws its own; and the tab
              bar beside it would be a strip of something else. Every other
              page is opened inside the tab it was opened from, with the bar
              beside it: see `(tabs)/(library,lists,search,stats,settings)/_layout.tsx`.
            */}
            <Stack.Screen name="tiles" options={{ headerShown: false }} />
          </Stack>
          {/*
            Over the navigator, so that it stays put while one screen slides
            over another, and inside the host, whose player is drawn after
            its children: the player covers it, as does anything in a window
            of its own.
          */}
          <DownloadsButton />
          {/* A song taken out, offered back for a moment, in the same place for the same reason: see `lib/ui/undo.ts`. */}
          <UndoNotice />
          {/* Sound files opened with the app from another, played: inside the host, whose player it opens. */}
          <OpenedAudio />
          {/* Where the app is, for a name pressed to ask: see `NameLinks`. */}
          <KeepWhereWeAre />
          {/* A song listened to from the Search tab, played when it is in: see `lib/listen`. */}
          <Listening />
          {/* A link that opened the app while it was awake behind the screen, taken where it says: see `lib/links`. */}
          <LateLink />
        </NowPlayingHost>
        </View>
        {/* The menu under a finger held on a row, over the bars as well: see `lib/ui/pressMenu.ts`. */}
        <PressMenuHost />
        <PressListHost />
        {/*
          Over everything, the player included, and not a route: it has to be
          in front of whatever the app was showing when Settings asked for it,
          and to leave that where it was once it is put away.
        */}
        {welcome ? <Setup /> : null}
        </WindowBehind>
      </DiscoverProvider>
      </DownloadsProvider>
    </PlayerProvider>
    </ThemeProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({ app: { flex: 1 } });

/** Each tape as it begins handed to `fetchNextAfter`, which fetches the next episodes of a show that asks for it, and made ready (`prepareTape`). */
function NextEpisodes() {
  const { current } = usePlayerState();
  const id = current && isTape(current) ? current.id : null;
  const uri = id ? (current?.uri ?? null) : null;
  useEffect(() => {
    if (!id) return;
    void fetchNextAfter(id);
    // Its chapters, and the parts of a video to pass over: see `tapes/extras.ts`.
    void prepareTape(id, uri);
  }, [id, uri]);
  return null;
}
