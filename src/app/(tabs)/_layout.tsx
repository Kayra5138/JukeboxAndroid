import type { ComponentProps, ReactNode } from 'react';
import { Tabs } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { InnerScreen, ScreenContext } from 'react-native-screens';
import { SettingsIcon, LibraryIcon, ListsIcon, SearchIcon } from '../../components/Icons';
import { TabArea } from '../../components/Frosted';
import { TabBar } from '../../components/TabBar';
import { BarsOver } from '../../components/UnderBars';
import { useT } from '../../lib/i18n/index';
import { useUpdateOffer } from '../../lib/support/updateStore';
import { makeStyles, useColours } from '../../lib/theme/index';
import { useLandscape } from '../../lib/ui/layout';

export default function MainTabs() {
  const landscape = useLandscape();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  /*
    A newer Jukebox is out: a dot on the Settings tab, where the row that
    says so is, and the tab's name read out with the news. Nothing louder —
    no badge with a number, nothing that moves.
  */
  const update = useUpdateOffer() != null;

  return (
    /*
      The tab bar is along the foot of every tab, and in a theme of glass laid
      over it: each tab's list keeps clear of it by what `useUnderBars` says.
    */
    <BarsOver tabs>
    <ScreenContext value={KeptScreen as unknown as typeof InnerScreen}>
    <Tabs
      /*
        Drawn by hand rather than configured. The side bar the navigator
        offers takes its width from its own reckoning and will not be told
        otherwise — it came out a third of a landscape screen wide, which is
        the opposite of what moving it there was for.
      */
      tabBar={(props) => <TabBar {...props} />}
      // Back goes to the tab that was in front before, as it goes back everywhere else, and not always to the library.
      backBehavior="history"
      /*
        Every tab kept on the screen once opened, those not open left out of
        the drawing rather than off it: see `TabArea`.
      */
      detachInactiveScreens={false}
      // Each tab an area the bar can blur, in a theme of glass: see `Frosted`.
      screenLayout={tabArea}
      screenOptions={{
      /*
        Still told which side it is on, even though it is drawn here: that is
        what makes the navigator lay the scene out beside the bar rather than
        above it, and reserve the right edge for it.
      */
      tabBarPosition: landscape ? 'left' : 'bottom',
      headerStyle: { backgroundColor: c.bg },
      headerTintColor: c.text,
      /*
        Nothing under each tab's screen: the tabs stand one over another, and
        the page of one not open, painted out here, covered the open one. The
        page is painted inside, where a tab not open is not drawn (`TabArea`).
      */
      sceneStyle: CLEAR,
      tabBarHideOnKeyboard: true,
    }}>
      <Tabs.Screen name="(library)" options={{
        title: t.nav.library, headerShown: false,
        tabBarIcon: ({ color }) => <LibraryIcon size={22} color={typeof color === 'string' ? color : c.text} />,
      }} />
      <Tabs.Screen name="(lists)" options={{
        title: t.nav.lists, headerShown: false,
        tabBarIcon: ({ color }) => <ListsIcon size={22} color={typeof color === 'string' ? color : c.text} />,
      }} />
      <Tabs.Screen name="(search)" options={{
        title: t.nav.search, headerShown: false,
        tabBarIcon: ({ color }) => <SearchIcon size={22} color={typeof color === 'string' ? color : c.text} />,
      }} />
      <Tabs.Screen name="(stats)" options={{
        title: t.nav.stats, headerShown: false,
        tabBarIcon: ({ color }) => <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 22, gap: 3 }}>{[10, 20, 15].map((height, i) => <View key={i} style={{ width: 4, height, backgroundColor: color }} />)}</View>,
      }} />
      <Tabs.Screen name="(settings)" options={{
        title: t.nav.settings, headerShown: false,
        tabBarAccessibilityLabel: update ? t.support.update.tab(t.nav.settings) : undefined,
        tabBarIcon: ({ focused }) => (
          <View>
            <SettingsIcon size={22} color={focused ? c.text : c.textMuted} />
            {update ? <View style={styles.dot} /> : null}
          </View>
        ),
      }} />
    </Tabs>
    </ScreenContext>
    </BarsOver>
  );
}

/**
 * The screen each tab is drawn in, kept as it is whether its tab is open or
 * not: which is open is `TabArea`'s to show, by drawing the others not at
 * all. Told not to take a tab not open off the screen, the navigator's own
 * hides it with display none instead, which takes it out of the layout as
 * well: opened again, every row in it was laid out and measured afresh and
 * every picture in it read again for its new size.
 *
 * Only for the tabs, which are told not to (`detachInactiveScreens`); the
 * pages opened inside each tab, in screens of their own, are as they were.
 */
function KeptScreen(props: ComponentProps<typeof InnerScreen>) {
  if (props.enabled !== false) return <InnerScreen {...props} />;
  const {
    enabled: _enabled,
    active,
    activityState,
    freezeOnBlur: _freezeOnBlur,
    shouldFreeze: _shouldFreeze,
    onComponentRef: _onComponentRef,
    ...view
  } = props as ComponentProps<typeof InnerScreen> & { shouldFreeze?: boolean; onComponentRef?: unknown };
  const { style, ...rest } = view as ComponentProps<typeof Animated.View>;
  /*
    Nor brought to the front by being drawn over the rest, as the navigator
    has the tab opened (`zIndex`): a view's order among its brothers changed
    is a view taken out of the window and put back, everything inside it
    with it -- the whole of the library, at every change of tab, and every
    cover in it read again.
  */
  /*
    And, not open, nothing in it a finger can land on: the tabs are one over
    another, and every touch landed on the screen of the last of them,
    Settings, whichever was open.
  */
  const open = (activityState ?? active) !== 0;
  /*
    Kept a view of its own whatever it is told: one that could be folded into
    the view round it when open, and not when shut, would be taken out of the
    window and put back at every change of tab, as above.
  */
  return <Animated.View {...rest} collapsable={false} pointerEvents={open ? 'auto' : 'none'} style={[style, ONE_LEVEL]} />;
}

const ONE_LEVEL = { zIndex: 0 };
const CLEAR = { backgroundColor: 'transparent' };

/** Made once, so that the navigator is handed the same thing each time it asks. */
const tabArea = ({ children, route }: { children: ReactNode; route: { key: string } }) => (
  <TabArea routeKey={route.key}>{children}</TabArea>
);

const useStyles = makeStyles((c) => StyleSheet.create({
  // On the icon's top corner, ringed in the bar's colour so that it reads apart from the gear under it.
  dot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: c.accent,
    borderWidth: 1.5,
    borderColor: c.bar,
  },
}));
