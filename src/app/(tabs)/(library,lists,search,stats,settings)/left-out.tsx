import { useCallback, useState } from 'react';
import { SPACE } from '../../../lib/theme/measures';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PageNote } from '../../../components/Page';
import { ScreenState } from '../../../components/ScreenState';
import { Switch } from '../../../components/Switch';

import { SettingsPage, useRows } from '../../../components/settings/rows';
import { useT } from '../../../lib/i18n/index';
import {
  folderRows,
  isLeftOut,
  leftOutWith,
  withLeftOut,
  type FolderRow,
} from '../../../lib/library/hiding';
import { libraryHidingChanged } from '../../../lib/library/index';
import {
  ensureAudioPermission,
  leftOutFolders,
  libraryRoot,
  listFoldersUnder,
  setLeftOutFolders,
} from '../../../lib/media/library';
import { makeStyles } from '../../../lib/theme/index';

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
  const rows = useRows();
  const styles = useStyles();
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

  if (screen.kind !== 'folders') {
    return (
      <SettingsPage>
        {screen.kind === 'loading' ? (
          <ScreenState kind="loading" />
        ) : (
          <ScreenState
            kind="error"
            text={screen.kind === 'denied' ? t.library.folders.needsAccess : screen.message}
            onRetry={() => void load()}
          />
        )}
      </SettingsPage>
    );
  }

  return (
    <SettingsPage>
      <PageNote>{t.library.leftOut.note}</PageNote>
      {screen.rows.length === 0 ? (
        <ScreenState kind="empty" text={t.library.leftOut.empty(screen.root)} />
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
                    { paddingLeft: SPACE.l + STEP * (Math.min(folder.depth, DEEPEST) - 1) },
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
  off: { color: c.textMuted },
}));
