import { useCallback, useState } from 'react';
import { Note } from '../../../components/Note';
import { View } from 'react-native';
import { Busy } from '../../../components/Busy';
import { Text } from '../../../components/settings/Find';

import { AutoBackupSettings } from '../../../components/AutoBackupSettings';
import { BackupSheet } from '../../../components/BackupSheet';
import { HistorySheet } from '../../../components/HistorySheet';
import { ListenBrainzSettings } from '../../../components/ListenBrainzSettings';
import { Pressable } from '../../../components/Pressable';
import { SettingsPage, useRows, Chevron } from '../../../components/settings/rows';
import { UpdateCheckSetting } from '../../../components/support/UpdateRows';
import {
  applyBackup,
  BackupError,
  exportBackup,
  openBackup,
  restart,
  type Opened,
} from '../../../lib/backup/index';
import { applyHistory, HistoryError, openHistory, type ImportPlan } from '../../../lib/history/index';
import { useT } from '../../../lib/i18n/index';
import { useColours, usePressed } from '../../../lib/theme/index';
import { useAnnounce } from '../../../lib/ui/announce';
import { haptic } from '../../../lib/ui/haptics';

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
  const [busy, setBusy] = useState<'export' | 'import' | 'history' | null>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  // Said aloud when it appears: it comes up where nobody's attention is, after a press elsewhere.
  useAnnounce(note?.text);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [applying, setApplying] = useState(false);
  const [imported, setImported] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  /*
    Another app's history, read and waiting on Import or Cancel, and why the
    write failed if it did. Kept apart from the backup's, since the two
    sheets ask different things.
  */
  const [history, setHistory] = useState<ImportPlan | null>(null);
  const [historyWriting, setHistoryWriting] = useState(false);
  const [historyRefused, setHistoryRefused] = useState<string | null>(null);

  /** What went wrong, in words meant for a person where there are any. */
  const said = (trouble: unknown, otherwise: string) =>
    trouble instanceof BackupError || trouble instanceof HistoryError
      ? trouble.message
      : trouble instanceof Error && trouble.message
        ? trouble.message
        : otherwise;

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
      if (await exportBackup()) {
        haptic('results', 'confirm');
        setNote({ text: t.common.saved, bad: false });
      }
    } catch (trouble) {
      haptic('results', 'reject');
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
      haptic('results', 'reject');
      setNote({ text: said(trouble, t.common.fileUnreadable), bad: true });
    }
    setBusy(null);
  }, [t]);

  const chooseHistory = useCallback(async () => {
    setBusy('history');
    setNote(null);
    // Caught on the promise rather than in a `try`, around which the React
    // Compiler will not take the questions asked of the answer below.
    const plan = await openHistory().catch((trouble: unknown) => {
      haptic('results', 'reject');
      setNote({ text: said(trouble, t.common.fileUnreadable), bad: true });
      return null;
    });
    if (plan && plan.rows.length === 0) {
      // Nothing to ask about: everything in it is here already, or too short.
      setNote({ text: t.backup.history.nothing, bad: false });
    } else if (plan) {
      setHistoryRefused(null);
      setHistory(plan);
    }
    setBusy(null);
  }, [t]);

  const bringHistoryIn = useCallback(async () => {
    if (!history) return;
    setHistoryWriting(true);
    setHistoryRefused(null);
    try {
      const added = await applyHistory(history);
      haptic('results', 'confirm');
      setHistory(null);
      setNote({ text: t.backup.history.added(added), bad: false });
    } catch (trouble) {
      haptic('results', 'reject');
      // All in one transaction, so a failure here has changed nothing.
      setHistoryRefused(t.backup.history.failed);
      console.warn('Could not import a listening history', trouble);
    }
    setHistoryWriting(false);
  }, [history, t]);

  const bringIn = useCallback(
    async (mode: 'merge' | 'replace') => {
      if (!opened) return;
      setApplying(true);
      setRefused(null);
      try {
        await applyBackup(opened, mode);
        haptic('results', 'confirm');
        setImported(true);
      } catch (trouble) {
        haptic('results', 'reject');
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
        <>
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
          <HistorySheet
            plan={history}
            working={historyWriting}
            failure={historyRefused}
            onImport={() => void bringHistoryIn()}
            onCancel={() => setHistory(null)}
          />
        </>
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
            {busy === 'export' ? <Busy color={c.textMuted} /> : <Chevron />}
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
            {busy === 'import' ? <Busy color={c.textMuted} /> : <Chevron />}
          </View>
          <Text style={styles.muted}>{t.settings.importBackup.note}</Text>
        </Pressable>
        <View style={styles.rule} />
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          disabled={busy != null}
          style={styles.row}
          onPress={() => void chooseHistory()}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.backup.history.title}</Text>
            {busy === 'history' ? <Busy color={c.textMuted} /> : <Chevron />}
          </View>
          <Text style={styles.muted}>{t.backup.history.note}</Text>
        </Pressable>
      </View>
      {note ? (
        <Note tone={note.bad ? 'bad' : 'good'} style={styles.noteRoom}>
          {note.text}
        </Note>
      ) : null}
      {/* The same backup, made by itself into a folder chosen once: see `backup/auto.ts`. */}
      <AutoBackupSettings />
      {/*
        Whether the app may ask GitHub about a newer version of itself: what
        the app sends about itself, kept with the rest of what it sends.
      */}
      <UpdateCheckSetting />
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
