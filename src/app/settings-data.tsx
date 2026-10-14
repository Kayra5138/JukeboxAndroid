import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { BackupSheet } from '../components/BackupSheet';
import { ListenBrainzSettings } from '../components/ListenBrainzSettings';
import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import {
  applyBackup,
  BackupError,
  exportBackup,
  openBackup,
  restart,
  type Opened,
} from '../lib/backup/index';
import { useT } from '../lib/i18n/index';
import { useColours, usePressed } from '../lib/theme/index';

/**
 * What the app holds about the music besides the music: taking all of it out
 * in one file, bringing such a file in, and sending what is played to an
 * account somewhere else.
 *
 * The rows are the ones that were on the Settings tab, as they were.
 */
export default function DataSettingsScreen() {
  const t = useT();
  const c = useColours();
  const styles = useRows();
  const pressed = usePressed();

  /*
    The backup, which is the one thing in Settings that takes time and can
    go wrong. `busy` is which of the two rows is at work, so the other can be
    held still while it is; `note` is the last thing worth telling the user
    about either; `opened` is a backup that has been read and is waiting on
    the answer to merge or replace.
  */
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [applying, setApplying] = useState(false);
  const [imported, setImported] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  /** What went wrong, in words meant for a person where there are any. */
  const said = (trouble: unknown, otherwise: string) =>
    trouble instanceof BackupError ? trouble.message : trouble instanceof Error && trouble.message ? trouble.message : otherwise;

  /*
    None of these ends in a `finally`, though each has something to do
    whichever way it went. The React Compiler leaves alone any component with
    one in it, and this screen left alone was drawn afresh, all of it, for
    every switch thrown and every time it was come back to. Nothing in the
    handlers below is thrown onwards, so the line after says the same thing.
  */
  const saveBackup = useCallback(async () => {
    setBusy('export');
    setNote(null);
    try {
      // Nothing is said when the user backs out of choosing a place. They
      // know they did, and "cancelled" is not news.
      if (await exportBackup()) setNote({ text: t.common.saved, bad: false });
    } catch (trouble) {
      setNote({ text: said(trouble, t.settings.exportAll.failed), bad: true });
    }
    setBusy(null);
  }, [t]);

  const chooseBackup = useCallback(async () => {
    setBusy('import');
    setNote(null);
    try {
      const found = await openBackup();
      if (found) {
        setRefused(null);
        setImported(false);
        setOpened(found);
      }
    } catch (trouble) {
      setNote({ text: said(trouble, t.common.fileUnreadable), bad: true });
    }
    setBusy(null);
  }, [t]);

  const bringIn = useCallback(
    async (mode: 'merge' | 'replace') => {
      if (!opened) return;
      setApplying(true);
      setRefused(null);
      try {
        await applyBackup(opened, mode);
        setImported(true);
      } catch (trouble) {
        // The write is all or nothing, so a failure here has changed nothing.
        setRefused(t.settings.importBackup.refused(said(trouble, t.settings.importBackup.failed)));
      }
      setApplying(false);
    },
    [opened, t]
  );

  return (
    <SettingsPage
      sheets={
        <BackupSheet
          opened={opened}
          working={applying}
          finished={imported}
          failure={refused}
          onMerge={() => void bringIn('merge')}
          onReplace={() => void bringIn('replace')}
          onCancel={() => setOpened(null)}
          onRestart={() => void restart()}
        />
      }>
      <View style={styles.card}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          disabled={busy != null}
          style={styles.row}
          onPress={() => void saveBackup()}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.settings.exportAll.title}</Text>
            {busy === 'export' ? <ActivityIndicator color={c.textMuted} /> : <Text style={styles.chevron}>›</Text>}
          </View>
          <Text style={styles.muted}>{t.settings.exportAll.note}</Text>
        </Pressable>
        <View style={styles.rule} />
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          disabled={busy != null}
          style={styles.row}
          onPress={() => void chooseBackup()}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.settings.importBackup.title}</Text>
            {busy === 'import' ? <ActivityIndicator color={c.textMuted} /> : <Text style={styles.chevron}>›</Text>}
          </View>
          <Text style={styles.muted}>{t.settings.importBackup.note}</Text>
        </Pressable>
      </View>
      {note ? (
        <Text accessibilityRole={note.bad ? 'alert' : undefined} style={note.bad ? styles.noteBad : styles.note}>
          {note.text}
        </Text>
      ) : null}
      {/*
        Last, and under a heading that says what it is: its own name, with
        the word Experimental before it, now that there is no group of that
        name for it to stand in. It is the one thing here that sends anything
        about the user anywhere, it needs an account with somebody else, and
        it is newer than everything above it: at the foot of the page it is
        found by whoever goes looking and is in nobody else's way.
      */}
      <ListenBrainzSettings heading={t.settings.sections.experimental} />
    </SettingsPage>
  );
}
