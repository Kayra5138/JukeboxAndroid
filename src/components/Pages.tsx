import { createContext, Fragment, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from './ErrorBoundary';
import { BlurArea, GlassScene } from './Frosted';
import { GlassHeader } from './GlassHeader';
import { BarsOver, useTabBarRoom } from './UnderBars';
import { HEADER_BAR } from '../lib/ui/bars';
import { backdropOf, makeStyles, useColours } from '../lib/theme/index';
import { glassOf, glassPage, setBack, Veiled } from '../lib/theme/Veil';
import { useMotionReduced } from '../lib/ui/motion';

/*
  How every page is drawn, in whichever stack it is in: the root one, which
  holds the tabs and the game, and each tab's own, which holds the page the
  tab opens on and every page opened from there (see `app/_layout.tsx` and
  `app/(tabs)/(library,lists,search,stats,settings)/_layout.tsx`).
*/

/**
 * The page each tab opens on, by the name it has in its tab's stack: drawn on
 * the page under the tabs rather than on one of its own, and never glass.
 */
const TAB_ROOTS = new Set(['index', 'lists', 'search', 'stats', 'settings']);

/**
 * Screens that are not glass in any theme: the tabs and the page each opens
 * on, which everything else is opened over, and the game, whose board is the
 * whole screen.
 *
 * In a theme of glass every other screen is opened as glass over the one it
 * was opened from. That one stays drawn, out of focus, and shows through a
 * wash of the page's colour. It began as a trial on one screen, to find out
 * whether a whole screen held out of focus cost too much; it did not.
 */
const NEVER_GLASS = new Set(['(tabs)', 'tiles', ...TAB_ROOTS]);

/**
 * The pages Settings opens, and those they open in turn: opened in place of
 * the page below in a theme of glass as in any other, and not over it.
 *
 * Over it, each was a sheet of glass with the page below drawn again under
 * it, out of focus, at every frame, a menu of a page looking like something
 * that had popped up over the last one; and with nothing of what was playing
 * on it, the bar at the foot of Settings under it out of reach. In place of
 * it, the page below is not drawn at all once the new one is in, the new one
 * has the whole of the screen and the sky of its own, and the bar of what is
 * playing is at its foot as it is at the foot of Settings.
 *
 * So too a page that is writing to be read and filled in (a song's details,
 * its tags, a smart list's rules, adding a tape): over the page below, a dark
 * cover of the library showed through behind its small grey lines and made
 * them tiring to read. A page to look through (an album, a list, a tape)
 * stays glass over the one it came from.
 */
export const IN_PLACE = new Set([
  'settings-look',
  'settings-haptics',
  'settings-sound',
  'settings-player',
  'settings-miniplayer',
  'settings-tapes',
  'settings-library',
  'settings-downloads',
  'settings-data',
  'report',
  'folders',
  'left-out',
  'set-aside',
  'samesongs',
  'duplicates',
  'wrong-downloads',
  'free-space',
  'equalizer',
  'transitions',
  'effects',
  'themes',
  'player-look',
  'theme',
  'discover-settings',
  'shown',
  'playback',
  // Pages of writing to be read and filled in, wherever they are opened from.
  'details',
  'metadata',
  'smart-list',
  'tapes-add',
]);

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
  /*
    A page opened inside a tab, with the bar beside or under it: kept clear of
    the bar where that is laid over it, glass along the foot, and telling what
    is inside that there is no bar along its foot to keep clear of, since it
    stops short of it. Not the page a tab opens on, which keeps clear of the
    bar itself, nor the tabs or the game.
  */
  const inTab = !NEVER_GLASS.has(name);
  const tabBar = useTabBarRoom();
  const clear = inTab && tabBar > 0 ? { paddingBottom: tabBar } : null;
  // The navigator's own account of what is open: an address would not do, since a screen can be opened over
  // another of the same address.
  const stack = useStack(navigation);
  const still = useMotionReduced();
  const onBack = navigation.canGoBack() ? navigation.goBack : null;
  const glass = glassOf(c);
  const mine = !NEVER_GLASS.has(name);
  const backdrop = backdropOf(c);
  // The backdrop on a view of its own, kept as a picture by the graphics chip: see `backdropOf`.
  const sky = backdrop ? <View pointerEvents="none" renderToHardwareTextureAndroid style={[StyleSheet.absoluteFill, backdrop]} /> : null;

  const { index, routes } = stack ?? { index: 0, routes: [] };
  // Not found, it is taken to be on top: drawn as itself, which is never wrong for long.
  const at = routes.findIndex((route) => route.key === routeKey);
  const under = at < 0 ? 0 : index - at;
  // Whether everything from here up to the top is glass, which is whether this can be seen through at all.
  // A page opened in place of this one is not seen through: see `IN_PLACE`.
  // Nor is anything while the decoration is held still, when every page is opened in place (`inPlaceGlass`):
  // the one below drawn again under each frame of this one, out of focus, is the dearest thing glass does.
  const seenThrough =
    !still &&
    under > 0 &&
    routes.slice(at + 1, index + 1).every((route) => !NEVER_GLASS.has(route.name) && !IN_PLACE.has(route.name));
  // A page opened in place of the one below: the sky of its own and the bar of what is playing at its foot.
  const placed = IN_PLACE.has(name);
  /*
    The page under all the tabs: nothing of its own, the window under it
    being the page's colour already (see the root layout) and every tab's
    screen painting its own, and in glass the backdrop over it, which hides
    it. Painted as well, it was the whole screen painted once more than it
    had to be at every frame, and twice in glass, under the backdrop.
  */
  const tabsPage = name === '(tabs)';
  const ground = mine ? styles.over : TAB_ROOTS.has(name) || tabsPage ? styles.below : styles.page;
  // Its bar drawn in the page, so that it goes back with the page: see `GlassHeader`.
  const barred = glass > 0 && mine && !HEADERLESS.has(name);
  // And laid over the page, where the screen's list runs on under it: see `UnderBars`.
  const beneath = barred && SCROLLS_UNDER.has(name);
  /*
    How it is drawn, glass or not: the page a tab opens on on the page under
    all the tabs, which is drawn once; any other on its own page; and in
    glass, as whichever of the four things above it is just now.
  */
  const plain = TAB_ROOTS.has(name) || tabsPage ? styles.below : [styles.page, clear];
  const seen = glass <= 0 ? plain : [under === 0 ? ground : !seenThrough ? ground : under === 1 ? ground : [ground, styles.unseen], clear];
  const showSky = glass <= 0 ? !TAB_ROOTS.has(name) : ground === styles.page || tabsPage || placed || (still && mine);
  /*
    The same views round the screen in every theme, only told differently:
    a theme of glass and one without each had their own, and going from one
    to the other put the screen into others, which is a screen made anew --
    the tabs among them, which came back on the first of them, the library,
    whatever tab the theme had been chosen from.
  */
  // Never folded away, for the reason `Behind` is not: see there.
  return (
    <Veiled {...(glass > 0 && under === 1 && seenThrough ? setBack(c) : null)} style={seen}>
      {/* It does not move, and drawn by the page under everything it was worked out again on every frame of a scroll. */}
      {showSky ? sky : null}
      <BarsOver tabs={inTab ? false : undefined}>
        {/* Where the bar blurs what scrolls under it: see `Frosted`. */}
        <GlassScene>
          {barred ? <GlassHeader title={title} onBack={onBack} over={beneath} /> : null}
          <BlurArea style={styles.below}>
            <BarsOver top={beneath ? HEADER_BAR + insets.top : undefined}>
              {/*
                What is on the page made afresh going between glass and a
                theme without it, as it always was, and not the navigator
                round it: a screen
                left standing from one theme to the next was drawn with
                parts of itself missing, a card with nothing in it, where
                the way it is drawn changes; and the tabs made afresh were
                the tabs back on the library. Not the tabs, which are a
                navigator and not a page.
              */}
              <Fragment key={name === '(tabs)' ? undefined : glass > 0 ? 'glass' : 'flat'}>
                <Covered value={under > 0}>{children}</Covered>
              </Fragment>
            </BarsOver>
          </BlurArea>
        </GlassScene>
      </BarsOver>
    </Veiled>
  );
}

/**
 * Whether a page is open over this one, in the tab it is in: for what is
 * worth letting go of while it cannot be seen for a page drawn over it (the
 * artists' map). Not whether its tab is open, which a tab not open is kept
 * standing for and only not drawn (`TabArea`): going to another tab and back
 * is no reason to let go of anything, and asked about the tab as well, as
 * `useIsFocused` is, everything that did was put up again at every return.
 */
export const Covered = createContext(false);

/** Made once, so that the navigator is handed the same thing each time it asks. */
export const paged = ({
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
    {/*
      Each page catches its own fall, so that one which cannot be drawn is
      the only thing lost: the tabs and the bar beside it stay, and the rest
      of the app can still be gone to -- Settings, and its report, among it.
      The one round everything (`app/_layout.tsx`) is for what is outside
      any page.
    */}
    <ErrorBoundary>{children}</ErrorBoundary>
  </Paged>
);

/**
 * Screens of glass that have no bar at all, and draw their own heading: the
 * game, and a list, whose name is over its tracks.
 */
const HEADERLESS = new Set(['(tabs)', 'tiles', ...TAB_ROOTS]);

/**
 * Screens of glass whose list runs on under their bar, and is seen through
 * it: each keeps the room at the top of what it scrolls that `useUnderBars`
 * tells it to. Named here and not found out, because a screen that has not
 * been made to keep that room would begin under its own bar; any other is
 * laid out below the bar, as it always was.
 */
const SCROLLS_UNDER = new Set([
  'shown',
  'playback',
  'settings-look',
  'settings-haptics',
  'settings-sound',
  'settings-player',
  'settings-miniplayer',
  'settings-tapes',
  'settings-library',
  'settings-downloads',
  'settings-data',
  'report',
  'left-out',
  'set-aside',
  'equalizer',
  'transitions',
  'effects',
  'album-rest',
  'themes',
  'player-look',
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
/**
 * How a page of [IN_PLACE] is opened in a theme of glass: in from the side
 * as any other, in place of the one below rather than over it, its bar
 * drawn in the page as the others' are (`Paged`).
 */
export const inPlaceGlass = {
  animation: 'slide_from_right',
  contentStyle: { backgroundColor: 'transparent' },
  headerShown: false,
} as const;

export const overGlass = {
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
