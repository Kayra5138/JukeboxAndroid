import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { SettingsIcon, LibraryIcon, ListsIcon, SearchIcon } from '../../components/Icons';
import { TabBar } from '../../components/TabBar';
import { useLandscape } from '../../lib/ui/layout';

export default function MainTabs() {
  const landscape = useLandscape();

  return (
    <Tabs
      /*
        Drawn by hand rather than configured. The side bar the navigator
        offers takes its width from its own reckoning and will not be told
        otherwise — it came out a third of a landscape screen wide, which is
        the opposite of what moving it there was for.
      */
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
      /*
        Still told which side it is on, even though it is drawn here: that is
        what makes the navigator lay the scene out beside the bar rather than
        above it, and reserve the right edge for it.
      */
      tabBarPosition: landscape ? 'left' : 'bottom',
      headerStyle: { backgroundColor: '#121212' },
      headerTintColor: '#f2f2f2',
      sceneStyle: { backgroundColor: '#121212' },
      tabBarHideOnKeyboard: true,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Library', headerShown: false,
        tabBarIcon: ({ color }) => <LibraryIcon size={22} color={typeof color === 'string' ? color : '#f2f2f2'} />,
      }} />
      <Tabs.Screen name="lists" options={{
        title: 'Lists', headerShown: false,
        tabBarIcon: ({ color }) => <ListsIcon size={22} color={typeof color === 'string' ? color : '#f2f2f2'} />,
      }} />
      <Tabs.Screen name="search" options={{
        title: 'Search', headerShown: false,
        tabBarIcon: ({ color }) => <SearchIcon size={22} color={typeof color === 'string' ? color : '#f2f2f2'} />,
      }} />
      <Tabs.Screen name="stats" options={{
        title: 'Stats', headerShown: false,
        tabBarIcon: ({ color }) => <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 22, gap: 3 }}>{[10, 20, 15].map((height, i) => <View key={i} style={{ width: 4, height, backgroundColor: color }} />)}</View>,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Settings', headerShown: false,
        tabBarIcon: ({ focused }) => <SettingsIcon size={22} color={focused ? '#f2f2f2' : '#777'} />,
      }} />
    </Tabs>
  );
}
