import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_ROOT,
  ensureAudioPermission,
  libraryRoot,
  listFolders,
  setLibraryRoot,
  type LibraryFolder,
} from '../lib/media/library';

type Screen =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'folders'; folders: LibraryFolder[] }
  | { kind: 'error'; message: string };

export default function FoldersScreen() {
  const router = useRouter();
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [current, setCurrent] = useState(libraryRoot);

  /*
    The permission is asked for here too, not only on the library screen. This
    one is linked from the empty library, which is exactly where somebody whose
    permission was refused ends up — and reaching a folder list that spins for
    ever was the worst possible answer to that.
  */
  const load = useCallback(async () => {
    setScreen({ kind: 'loading' });
    setCurrent(libraryRoot());
    try {
      if (!(await ensureAudioPermission())) {
        setScreen({ kind: 'denied' });
        return;
      }
      setScreen({ kind: 'folders', folders: await listFolders() });
    } catch (error) {
      setScreen({ kind: 'error', message: String(error) });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const choose = useCallback(
    (path: string) => {
      setLibraryRoot(path);
      router.back();
    },
    [router]
  );

  if (screen.kind === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#f2f2f2" />
      </View>
    );
  }

  if (screen.kind === 'denied' || screen.kind === 'error') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.body}>
          {screen.kind === 'denied'
            ? 'Jukebox needs access to the audio on this device before it can list any folders.'
            : screen.message}
        </Text>
        <Pressable style={styles.button} onPress={() => void load()}>
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const folders = screen.folders;
  const total = folders.reduce((sum, folder) => sum + folder.trackCount, 0);
  // Everything under Music, as the way back from a narrower choice.
  const options: LibraryFolder[] = [{ path: DEFAULT_ROOT, trackCount: total }, ...folders];

  return (
    <View style={[styles.screen, sides]}>
      <Text style={styles.note}>
        Jukebox plays everything below the folder you pick, including subfolders.
        Choosing a subfolder is the way to leave ringtones and game audio out.
      </Text>
      <FlatList
        data={options}
        keyExtractor={(folder) => folder.path}
        renderItem={({ item }) => {
          const selected = item.path === current;
          return (
            <Pressable style={styles.row} onPress={() => choose(item.path)}>
              <Text style={styles.radio}>{selected ? '●' : '○'}</Text>
              <Text style={[styles.path, selected && styles.pathOn]} numberOfLines={1}>
                {item.path}
                {item.path === DEFAULT_ROOT ? '  (everything)' : ''}
              </Text>
              <Text style={styles.count}>{item.trackCount}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  body: { color: '#f2f2f2', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonLabel: { color: '#f2f2f2', fontSize: 15 },
  note: { color: '#9a9a9a', fontSize: 13, lineHeight: 19, padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e1e1e',
  },
  radio: { color: '#7ab8ff', fontSize: 16, width: 16 },
  path: { color: '#c8c8c8', fontSize: 15, flex: 1 },
  pathOn: { color: '#f2f2f2' },
  count: { color: '#6a6a6a', fontSize: 13, fontVariant: ['tabular-nums'] },
});
