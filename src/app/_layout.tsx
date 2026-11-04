import { DiscoverProvider } from '../lib/discover/DiscoverProvider';
import { useEffect, useState, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SystemUI from 'expo-system-ui';

import { DownloadsButton } from '../components/DownloadsButton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BlurArea, GlassScene } from '../components/Frosted';
import { GlassHeader } from '../components/GlassHeader';
import { PressMenuHost } from '../components/PressMenu';
import { BarsOver } from '../components/UnderBars';
import { Setup } from '../components/welcome/Setup';
import { keepBackingUp } from '../lib/backup/auto';
import { scheduleBackups } from '../lib/backup/background';
import { keepCarCopy } from '../lib/db/carCopy';
import { keepSpreadingCovers } from '../lib/media/coverSpread';
import { loadLanguage, useT } from '../lib/i18n/index';
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
import { prepareTape } from '../lib/tapes/extras';
import { sweepMarksOnce } from '../lib/tapes/marks';
import { isTape } from '../lib/tapes/tape';
import { Autoplay } from '../lib/player/autoplay/Autoplay';
import { NowPlayingHost } from '../lib/player/NowPlayingSheet';
import { PlayerProvider, usePlayerState } from '../lib/player/PlayerProvider';
import { keepScrobbling } from '../lib/scrobble/index';
import { watchErrors } from '../lib/support/errorLogStore';
import { keepCheckingForUpdates } from '../lib/support/updateStore';
import { backdropOf, loadTheme, makeStyles, page, useColours, useTheme } from '../lib/theme/index';
import { glassOf, glassPage, setBack, Veiled, WindowBehind } from '../lib/theme/Veil';
import { ThemeSurroundings } from '../lib/theme/Surroundings';
import { useWelcomeShown } from '../lib/ui/welcomeStore';
import { HEADER_BAR } from '../lib/ui/bars';
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

/*
  The tabs under every page, however the app was opened: a page a link opened
  it on — a podcast's, from a notification or another app — has the library
  under it, and Back goes there rather than out of the app.
*/
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const theme = useTheme();
  const t = useT();
  const c = theme.colours;
  const welcome = useWelcomeShown();

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
  const glass = glassOf(c);
  /*
    How every screen but the first is opened in a theme of glass: over the
    one below and not in place of it, with its bar drawn in the page (see
    `Paged`). Nothing at all in any other theme. The game is left out: its
    board is the whole screen and is nobody's glass.
  */
  const over = glass > 0 ? overGlass : null;
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
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            <Stack.Screen name="samesongs" options={{ title: t.nav.sameSong, ...over }} />
            <Stack.Screen name="duplicates" options={{ title: t.library.copies.title, ...over }} />
            <Stack.Screen name="wrong-downloads" options={{ title: t.library.wrong.title, ...over }} />
            <Stack.Screen name="free-space" options={{ title: t.space.title, ...over }} />
            <Stack.Screen name="equalizer" options={{ title: t.nav.equalizer, ...over }} />
            <Stack.Screen name="transitions" options={{ title: t.nav.crossfade, ...over }} />
            <Stack.Screen name="effects" options={{ title: t.nav.effects, ...over }} />
            {/* The whole screen is the board. A header over it is a strip of
                the game nobody can play, and the game draws its own. */}
            <Stack.Screen name="tiles" options={{ headerShown: false }} />
            {/* Titled by the list itself, which the screen draws. */}
            <Stack.Screen name="playlist" options={{ headerShown: false, ...over }} />
            {/* A smart list's rules; the screen says whether it is making one or changing one. */}
            <Stack.Screen name="smart-list" options={{ title: t.smart.editor.newTitle, ...over }} />
            <Stack.Screen name="details" options={{ title: t.nav.details, ...over }} />
            {/* Until the screen knows the album's name and says that instead. */}
            <Stack.Screen name="album-rest" options={{ title: t.nav.albumRest, ...over }} />
            <Stack.Screen name="themes" options={{ title: t.nav.themes, ...over }} />
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
          {/*
            Over the navigator, so that it stays put while one screen slides
            over another, and inside the host, whose player is drawn after
            its children: the player covers it, as does anything in a window
            of its own.
          */}
          <DownloadsButton />
          {/* Sound files opened with the app from another, played: inside the host, whose player it opens. */}
          <OpenedAudio />
          {/* A song listened to from the Search tab, played when it is in: see `lib/listen`. */}
          <Listening />
          {/* A link that opened the app while it was awake behind the screen, taken where it says: see `lib/links`. */}
          <LateLink />
        </NowPlayingHost>
        </View>
        {/* The menu under a finger held on a row, over the bars as well: see `lib/ui/pressMenu.ts`. */}
        <PressMenuHost />
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

/** What a screen is told of the navigator it is in: enough to know where in it the screen stands, and to hear when that changes. */
type Navigator = {
  canGoBack: () => boolean;
  goBack: () => void;
  getState: () => unknown;
  addListener: (event: 'state', listener: (event: { data: { state: unknown } }) => void) => () => void;
};

/**
 * The navigator [navigation] belongs to, as it is now, kept up to date.
 *
 * Asked of the navigator and listened to, not read off the root's account as
 * the screen is drawn: a link that opens the app on a page puts the library
 * under it from the start, and the account the first drawing reads is then
 * one with no keys in it yet, and nothing draws the screen again to read the
 * finished one. The library would never know it was under the page.
 */
function useStack(navigation: Navigator): Routes | null {
  const [stack, setStack] = useState(() => routesOf(navigation.getState()));
  useEffect(() => {
    setStack(routesOf(navigation.getState()));
    return navigation.addListener('state', (event) => setStack(routesOf(event.data.state)));
  }, [navigation]);
  return stack;
}

function routesOf(state: unknown): Routes | null {
  const routes = state as Routes | undefined;
  return routes && Array.isArray(routes.routes) ? routes : null;
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
function Paged({
  children,
  name,
  routeKey,
  title,
  navigation,
}: {
  children: ReactNode;
  name: string;
  routeKey: string;
  title: string;
  navigation: Navigator;
}) {
  const c = useColours();
  const styles = usePage();
  const insets = useSafeAreaInsets();
  // The navigator's own account of what is open: an address would not do, since a screen can be opened over
  // another of the same address.
  const stack = useStack(navigation);
  const onBack = navigation.canGoBack() ? navigation.goBack : null;
  const glass = glassOf(c);
  const mine = !NEVER_GLASS.has(name);
  const backdrop = backdropOf(c);
  // The backdrop on a view of its own, kept as a picture by the graphics chip: see `backdropOf`.
  const sky = backdrop ? <View pointerEvents="none" renderToHardwareTextureAndroid style={[StyleSheet.absoluteFill, backdrop]} /> : null;
  if (glass <= 0) {
    return (
      <View collapsable={false} style={styles.page}>
        {sky}
        {children}
      </View>
    );
  }

  const { index, routes } = stack ?? { index: 0, routes: [] };
  // Not found, it is taken to be on top: drawn as itself, which is never wrong for long.
  const at = routes.findIndex((route) => route.key === routeKey);
  const under = at < 0 ? 0 : index - at;
  // Whether everything from here up to the top is glass, which is whether this can be seen through at all.
  const seenThrough = under > 0 && routes.slice(at + 1, index + 1).every((route) => !NEVER_GLASS.has(route.name));
  const ground = mine ? styles.over : styles.page;
  // Its bar drawn in the page, so that it goes back with the page: see `GlassHeader`.
  const barred = mine && !HEADERLESS.has(name);
  // And laid over the page, where the screen's list runs on under it: see `UnderBars`.
  const beneath = barred && SCROLLS_UNDER.has(name);
  // Never folded away, for the reason `Behind` is not: see there.
  return (
    <Veiled
      {...(under === 1 && seenThrough ? setBack(c) : null)}
      style={under === 0 ? ground : !seenThrough ? ground : under === 1 ? ground : [ground, styles.unseen]}>
      {/* It does not move, and drawn by the page under everything it was worked out again on every frame of a scroll. */}
      {ground === styles.page ? sky : null}
      {beneath ? (
        // The bar blurs what scrolls under it: see `Frosted`.
        <GlassScene>
          <GlassHeader title={title} onBack={onBack} over />
          <BlurArea style={styles.below}>
            <BarsOver top={HEADER_BAR + insets.top}>{children}</BarsOver>
          </BlurArea>
        </GlassScene>
      ) : barred ? (
        <>
          <GlassHeader title={title} onBack={onBack} />
          <View style={styles.below}>{children}</View>
        </>
      ) : (
        children
      )}
    </Veiled>
  );
}

/** Made once, so that the navigator is handed the same thing each time it asks. */
const paged = ({
  children,
  route,
  navigation,
  options,
}: {
  children: ReactNode;
  route: { key: string; name: string };
  navigation: Navigator;
  options: { title?: string };
}) => (
  <Paged name={route.name} routeKey={route.key} title={options.title ?? ''} navigation={navigation}>
    {children}
  </Paged>
);

/**
 * Screens of glass that have no bar at all, and draw their own heading: the
 * game, and a list, whose name is over its tracks.
 */
const HEADERLESS = new Set(['(tabs)', 'tiles', 'playlist']);

/**
 * Screens of glass whose list runs on under their bar, and is seen through
 * it: each keeps the room at the top of what it scrolls that `useUnderBars`
 * tells it to. Named here and not found out, because a screen that has not
 * been made to keep that room would begin under its own bar; any other is
 * laid out below the bar, as it always was.
 */
const SCROLLS_UNDER = new Set([
  'settings-look',
  'settings-haptics',
  'settings-sound',
  'settings-player',
  'settings-tapes',
  'settings-library',
  'settings-downloads',
  'settings-data',
  'report',
  'left-out',
  'equalizer',
  'transitions',
  'effects',
  'album-rest',
  'themes',
  'discover-settings',
  'samesongs',
  'duplicates',
  'wrong-downloads',
]);

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
  // Drawn in the page instead, by `Paged`: the navigator's bar is a layer of
  // its own, and stayed sharp over a screen that had been set back.
  headerShown: false,
} as const;

const usePage = makeStyles((c) =>
  StyleSheet.create({
    // The colour alone: the backdrop over it is a view of its own, in `Paged`.
    page: { flex: 1, backgroundColor: c.bg },
    over: { flex: 1, ...glassPage(c) },
    unseen: { opacity: 0 },
    below: { flex: 1 },
  })
);

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
