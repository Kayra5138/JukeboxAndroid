import type { ReactNode } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SettingsIcon, LibraryIcon, ListsIcon, SearchIcon } from '../../components/Icons';
import { TabArea } from '../../components/Frosted';
import { TabBar } from '../../components/TabBar';
import { BarsOver } from '../../components/UnderBars';
import { useT } from '../../lib/i18n/index';
import { useUpdateOffer } from '../../lib/support/updateStore';
import { makeStyles, scene, useColours } from '../../lib/theme/index';
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
    <Tabs
      /*
        Drawn by hand rather than configured. The side bar the navigator
        offers takes its width from its own reckoning and will not be told
        otherwise — it came out a third of a landscape screen wide, which is
        the opposite of what moving it there was for.
      */
      tabBar={(props) => <TabBar {...props} />}
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
      sceneStyle: scene(c),
      tabBarHideOnKeyboard: true,
    }}>
      <Tabs.Screen name="index" options={{
        title: t.nav.library, headerShown: false,
        tabBarIcon: ({ color }) => <LibraryIcon size={22} color={typeof color === 'string' ? color : c.text} />,
      }} />
      <Tabs.Screen name="lists" options={{
        title: t.nav.lists, headerShown: false,
        tabBarIcon: ({ color }) => <ListsIcon size={22} color={typeof color === 'string' ? color : c.text} />,
      }} />
      <Tabs.Screen name="search" options={{
        title: t.nav.search, headerShown: false,
        tabBarIcon: ({ color }) => <SearchIcon size={22} color={typeof color === 'string' ? color : c.text} />,
      }} />
      <Tabs.Screen name="stats" options={{
        title: t.nav.stats, headerShown: false,
        tabBarIcon: ({ color }) => <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 22, gap: 3 }}>{[10, 20, 15].map((height, i) => <View key={i} style={{ width: 4, height, backgroundColor: color }} />)}</View>,
      }} />
      <Tabs.Screen name="settings" options={{
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
    </BarsOver>
  );
}

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
