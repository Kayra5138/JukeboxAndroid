import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { CardListPage, CardRow, ListCard } from '../../../components/CardList';

import { useT } from '../../../lib/i18n/index';
import { libraryFilesChanged } from '../../../lib/library/index';
import {
  DEFAULT_ROOT,
  JUKEBOX_ROOT,
  ensureAudioPermission,
  libraryRoot,
  listFolders,
  setLibraryRoot,
  type LibraryFolder,
} from '../../../lib/media/library';
import { makeStyles } from '../../../lib/theme/index';
import { TYPE } from '../../../lib/theme/measures';

type Screen =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'folders'; folders: LibraryFolder[] }
  | { kind: 'error'; message: string };

export default function FoldersScreen() {
  const router = useRouter();
  const t = useT();
  const styles = useStyles();
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
      // Begun here and not left for the library screen to ask on the way
      // back, so the other folder is being read while this one slides away.
      libraryFilesChanged();
      router.back();
    },
    [router]
  );

  const folders = screen.kind === 'folders' ? screen.folders : [];
  const total = folders.reduce((sum, folder) => sum + folder.trackCount, 0);
  // Everything under Music, as the way back from a narrower choice.
  const options: LibraryFolder[] = [{ path: DEFAULT_ROOT, trackCount: total }, ...folders];
  // Jukebox's own folder, empty or not yet made: where its downloads go, and so always on offer.
  const own = JUKEBOX_ROOT.toLowerCase();
  if (!folders.some((folder) => folder.path.toLowerCase() === own)) {
    options.splice(1, 0, {
      path: JUKEBOX_ROOT,
      trackCount: folders.reduce((sum, folder) => (folder.path.toLowerCase().startsWith(`${own}/`) ? sum + folder.trackCount : sum), 0),
    });
  }

  return (
    <CardListPage
      // The folders are one choice, in one card.
      items={screen.kind === 'folders' ? [options] : screen.kind === 'loading' ? null : []}
      keyOf={() => 'folders'}
      note={t.library.folders.note}
      empty=""
      error={screen.kind === 'denied' ? t.library.folders.needsAccess : screen.kind === 'error' ? screen.message : null}
      onRetry={() => void load()}
      renderItem={(choices) => (
        <ListCard>
          {choices.map((folder) => (
            <CardRow
              key={folder.path}
              choice={{ on: folder.path === current }}
              title={folder.path === DEFAULT_ROOT ? t.library.folders.everything(folder.path) : folder.path}
              trailing={<Text style={styles.count}>{t.format.number(folder.trackCount)}</Text>}
              onPress={() => choose(folder.path)}
            />
          ))}
        </ListCard>
      )}
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    count: { color: c.textMuted, fontSize: TYPE.small, fontVariant: ['tabular-nums'] },
  })
);
