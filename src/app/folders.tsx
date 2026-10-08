import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../lib/i18n/index';
import {
  DEFAULT_ROOT,
  ensureAudioPermission,
  libraryRoot,
  listFolders,
  setLibraryRoot,
  type LibraryFolder,
} from '../lib/media/library';
import { makeStyles, outlined, scene, useColours, usePressed } from '../lib/theme/index';

type Screen =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'folders'; folders: LibraryFolder[] }
  | { kind: 'error'; message: string };

export default function FoldersScreen() {
  const router = useRouter();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
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
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (screen.kind === 'denied' || screen.kind === 'error') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.body}>
          {screen.kind === 'denied'
            ? t.library.folders.needsAccess
            : screen.message}
        </Text>
        <Pressable android_ripple={pressed} style={styles.button} onPress={() => void load()}>
          <Text style={styles.buttonLabel}>{t.common.tryAgain}</Text>
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
      <Text style={styles.note}>{t.library.folders.note}</Text>
      <FlatList
        data={options}
        keyExtractor={(folder) => folder.path}
        renderItem={({ item }) => {
          const selected = item.path === current;
          return (
            <Pressable android_ripple={pressed} style={styles.row} onPress={() => choose(item.path)}>
              <Text style={styles.radio}>{selected ? '●' : '○'}</Text>
              <Text style={[styles.path, selected && styles.pathOn]} numberOfLines={1}>
                {item.path === DEFAULT_ROOT ? t.library.folders.everything(item.path) : item.path}
              </Text>
              <Text style={styles.count}>{t.format.number(item.trackCount)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  body: { color: c.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...outlined(c),
  },
  buttonLabel: { color: c.text, fontSize: 15 },
  note: { color: c.textSecondary, fontSize: 13, lineHeight: 19, padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  radio: { color: c.accent, fontSize: 16, width: 16 },
  path: { color: c.textSecondary, fontSize: 15, flex: 1 },
  pathOn: { color: c.text },
  count: { color: c.textFaint, fontSize: 13, fontVariant: ['tabular-nums'] },
}));
