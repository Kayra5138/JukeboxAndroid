import { DiscoverProvider } from '../lib/discover/DiscoverProvider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { NowPlayingHost } from '../lib/player/NowPlayingSheet';
import { PlayerProvider } from '../lib/player/PlayerProvider';
import { DownloadsProvider } from '../lib/youtube/DownloadsProvider';

export default function RootLayout() {
  return (
    <PlayerProvider>
      <DownloadsProvider>
      <DiscoverProvider>
        {/*
          The now-playing screen is a layer over the navigator rather than a route
          within it, so whatever is underneath stays on screen while it is open.
        */}
        <NowPlayingHost>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#121212' },
              headerTintColor: '#f2f2f2',
              contentStyle: { backgroundColor: '#121212' },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="metadata" options={{ title: 'Tags' }} />
            <Stack.Screen name="folders" options={{ title: 'Library folder' }} />
            <Stack.Screen name="equalizer" options={{ title: 'Equalizer' }} />
            <Stack.Screen name="transitions" options={{ title: 'Crossfade' }} />
            <Stack.Screen name="effects" options={{ title: 'Effects' }} />
            {/* The whole screen is the board. A header over it is a strip of
                the game nobody can play, and the game draws its own. */}
            <Stack.Screen name="tiles" options={{ headerShown: false }} />
            {/* Titled by the list itself, which the screen draws. */}
            <Stack.Screen name="playlist" options={{ headerShown: false }} />
            <Stack.Screen name="details" options={{ title: 'View & edit details' }} />
          </Stack>
        </NowPlayingHost>
      </DiscoverProvider>
      </DownloadsProvider>
    </PlayerProvider>
  );
}
