import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import { useT } from '../lib/i18n/index';
import {
  folderRows,
  isLeftOut,
  leftOutWith,
  withLeftOut,
  type FolderRow,
} from '../lib/library/hiding';
import { libraryHidingChanged } from '../lib/library/index';
import {
  ensureAudioPermission,
  leftOutFolders,
  libraryRoot,
  listFoldersUnder,
  setLeftOutFolders,
} from '../lib/media/library';
import { makeStyles, outlined, scene, switchColours, useColours, usePressed } from '../lib/theme/index';

type Screen =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'folders'; root: string; rows: FolderRow[] }
  | { kind: 'error'; message: string };

/** How far in a folder is drawn for each step below the library folder, up to a point. */
const STEP = 14;
const DEEPEST = 4;

/**
 * The folders under the library folder, each with a switch that leaves it
 * out of the library, opened from Settings → Library.
 *
 * A page of its own rather than switches on the folder chooser. That screen
 * answers one question — which folder is the library — with a ring against
 * one row; this answers another of every row, and the two on one list would
 * be a ring and a switch on the same line meaning different things.
 *
 * What is left out is in `lib/library/hiding.ts`. Here it is only switched.
 */
export default function LeftOutScreen() {
  const t = useT();
  const c = useColours();
  const rows = useRows();
  const styles = useStyles();
  const pressed = usePressed();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [leftOut, setLeftOut] = useState(() => leftOutFolders());

  /*
    Asked for leave here too, as the folder chooser does: this screen can be
    reached by somebody who refused it, and a list that spins for ever is no
    answer to them.
  */
  const load = useCallback(async () => {
    setLeftOut(leftOutFolders());
    try {
      if (!(await ensureAudioPermission())) {
        setScreen({ kind: 'denied' });
        return;
      }
      const root = libraryRoot();
      setScreen({ kind: 'folders', root, rows: folderRows(await listFoldersUnder(root), root) });
    } catch (error) {
      setScreen({ kind: 'error', message: String(error) });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggle = (path: string, on: boolean) => {
    const next = withLeftOut(leftOutFolders(), path, !on);
    setLeftOutFolders(next);
    setLeftOut(next);
    // Told now, so the library has changed by the time anybody is back on it.
    libraryHidingChanged();
  };

  if (screen.kind === 'loading') {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (screen.kind === 'denied' || screen.kind === 'error') {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.body}>
          {screen.kind === 'denied' ? t.library.folders.needsAccess : screen.message}
        </Text>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={() => void load()}>
          <Text style={styles.buttonLabel}>{t.common.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SettingsPage>
      <Text style={styles.note}>{t.library.leftOut.note}</Text>
      {screen.rows.length === 0 ? (
        <Text style={styles.note}>{t.library.leftOut.empty(screen.root)}</Text>
      ) : (
        <View style={rows.card}>
          {screen.rows.map((folder, at) => {
            const own = !isLeftOut(leftOut, folder.path);
            const within = leftOutWith(leftOut, folder.path);
            const on = own && !within;
            return (
              <View key={folder.path}>
                {at > 0 ? <View style={rows.rule} /> : null}
                <View
                  style={[
                    rows.row,
                    { paddingLeft: 16 + STEP * (Math.min(folder.depth, DEEPEST) - 1) },
                  ]}>
                  <View style={rows.line}>
                    <Text style={[rows.title, !on && styles.off]}>{folder.name}</Text>
                    <Switch
                      accessibilityLabel={t.library.leftOut.spoken(folder.relative, folder.trackCount)}
                      accessibilityHint={within ? t.library.leftOut.within : t.library.leftOut.hint}
                      value={on}
                      // Inside a folder that is off, its own switch would do
                      // nothing anybody could see; the folder it is in is the
                      // one to switch.
                      disabled={within}
                      onValueChange={(wanted) => toggle(folder.path, wanted)}
                      {...switchColours(c, on)}
                    />
                  </View>
                  <Text style={rows.muted}>
                    {within
                      ? `${t.common.tracks(folder.trackCount)} · ${t.library.leftOut.within}`
                      : t.common.tracks(folder.trackCount)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </SettingsPage>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  body: { color: c.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...outlined(c),
  },
  buttonLabel: { color: c.text, fontSize: 15 },
  note: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14, marginHorizontal: 4 },
  off: { color: c.textMuted },
}));
