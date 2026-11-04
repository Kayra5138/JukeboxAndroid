import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio/index';

import { NumberStepper } from './NumberStepper';
import { Pressable } from './Pressable';
import { Segmented } from './Segmented';
import { useRows } from './settings/rows';
import { Switch } from './Switch';
import {
  autoBackup,
  backUpIfDue,
  backUpNow,
  setAutoBackupOn,
  setBackupEvery,
  setBackupKeep,
  watchAutoBackup,
} from '../lib/backup/auto';
import { scheduleBackups } from '../lib/backup/background';
import { KEEP_RANGE, type Every } from '../lib/backup/due';
import { useT } from '../lib/i18n/index';
import { makeStyles, switchColours, useColours, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';

/**
 * Automatic backup, on Your data under the rows that export and import by
 * hand: the switch, and with it on, the folder they go into, how often, how
 * many are kept, how the last went, and one made now.
 *
 * Turning it on asks for a folder once, with the system's own picker, and
 * makes the first backup there. The folder is asked about each time the page
 * is opened, so that one moved, deleted or no longer granted is said as such
 * at once and not only after the next backup fails.
 */
export function AutoBackupSettings() {
  const t = useT();
  const c = useColours();
  const rows = useRows();
  const pressed = usePressed();
  const layout = useStyles();
  const said = t.settings.autoBackup;
  const [settings, setSettings] = useState(autoBackup);
  // The folder's name as its app gives it: null where it cannot be reached, undefined while that is being asked.
  const [folderName, setFolderName] = useState<string | null | undefined>(undefined);
  const [working, setWorking] = useState(false);
  const [made, setMade] = useState(false);

  const lookAgain = useCallback(() => {
    const now = autoBackup();
    setSettings(now);
    if (now.folder) void nameOf(now.folder).then(setFolderName);
    else setFolderName(undefined);
  }, []);

  // Read again on coming back, and whenever a backup is made behind the page while it is open.
  useFocusEffect(useCallback(() => {
    lookAgain();
    return watchAutoBackup(lookAgain);
  }, [lookAgain]));

  const lost = settings.folder != null && folderName === null;

  /** A backup made now if one is due, the spinner turning while it is. */
  const backUp = async (whenDue: boolean) => {
    setWorking(true);
    setMade(false);
    const done = whenDue ? await backUpIfDue() : await backUpNow();
    if (done != null) haptic('results', done ? 'confirm' : 'reject');
    setMade(done === true);
    setWorking(false);
  };

  /** The system's folder picker; on a folder chosen, it is kept and backing up is on. */
  const choose = async () => {
    const picked = await pickFolder(settings.folder);
    if (!picked) return;
    setFolderName(picked.name ?? '');
    setAutoBackupOn(true, picked.uri);
    void scheduleBackups();
    lookAgain();
    void backUp(true);
  };

  const turn = (on: boolean) => {
    setMade(false);
    if (!on) {
      setAutoBackupOn(false);
      void scheduleBackups();
      lookAgain();
      return;
    }
    // A folder chosen before and still there is used again; otherwise one is asked for.
    if (!settings.folder || lost) {
      void choose();
      return;
    }
    setAutoBackupOn(true);
    void scheduleBackups();
    lookAgain();
    void backUp(true);
  };

  const status = !settings.on
    ? null
    : lost
      ? { text: said.lost, bad: true }
      : settings.trouble === 'failed'
        ? { text: said.failed, bad: true }
        : settings.last != null
          ? { text: said.last(t.format.dateTime(new Date(settings.last))), bad: false }
          : { text: said.never, bad: false };

  return (
    <View style={layout.card}>
      <View style={rows.card}>
        <View style={rows.row}>
          <View style={rows.line}>
            <Text style={rows.title}>{said.title}</Text>
            <Switch
              value={settings.on}
              accessibilityLabel={said.title}
              onValueChange={turn}
              {...switchColours(c, settings.on)}
            />
          </View>
          {status ? (
            <Text accessibilityRole={status.bad ? 'alert' : undefined} style={status.bad ? layout.bad : rows.muted}>
              {status.text}
            </Text>
          ) : (
            <Text style={rows.muted}>{said.off}</Text>
          )}
        </View>
        {settings.on ? (
          <>
            <View style={rows.rule} />
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityHint={lost ? undefined : said.chooseOther}
              style={rows.row}
              onPress={() => void choose()}>
              <View style={rows.line}>
                <Text style={rows.title}>{lost ? said.chooseAgain : said.folder}</Text>
                <View style={rows.choices}>
                  {lost ? null : folderName === undefined ? (
                    <ActivityIndicator size="small" color={c.textMuted} />
                  ) : (
                    <Text style={rows.value} numberOfLines={1}>
                      {folderName || said.folderUnnamed}
                    </Text>
                  )}
                  <Text style={rows.chevron} importantForAccessibility="no">›</Text>
                </View>
              </View>
            </Pressable>
            <View style={rows.rule} />
            <View style={rows.row}>
              <View style={rows.line}>
                <Text style={rows.title}>{said.every}</Text>
                <Segmented<Every>
                  variant="chips"
                  size="compact"
                  accessibilityLabel={said.every}
                  options={[
                    { value: 'daily', label: said.daily },
                    { value: 'weekly', label: said.weekly },
                  ]}
                  value={settings.every}
                  onChange={(every) => {
                    setBackupEvery(every);
                    lookAgain();
                  }}
                />
              </View>
            </View>
            <View style={rows.rule} />
            <View style={rows.row}>
              <View style={rows.line}>
                <Text style={rows.title}>{said.keep}</Text>
                <NumberStepper
                  name={said.keep}
                  range={KEEP_RANGE}
                  value={settings.keep}
                  onChange={(keep) => {
                    setBackupKeep(keep);
                    lookAgain();
                  }}
                />
              </View>
              <Text style={rows.muted}>{said.keepNote(settings.keep)}</Text>
            </View>
            <View style={rows.rule} />
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              disabled={working || lost}
              style={rows.row}
              onPress={() => void backUp(false)}>
              <View style={rows.line}>
                <Text style={lost ? layout.off : rows.title}>{said.now}</Text>
                {working ? <ActivityIndicator color={c.textMuted} /> : null}
              </View>
            </Pressable>
          </>
        ) : null}
      </View>
      {made ? <Text style={rows.note}>{said.made}</Text> : null}
    </View>
  );
}

/** The folder's name, or null where it can no longer be reached. Never throws. */
async function nameOf(folder: string): Promise<string | null> {
  try {
    return (await JukeboxAudio.backupFolderNameAsync?.(folder)) ?? null;
  } catch {
    return null;
  }
}

/** The folder the user chose, with the grant to it kept; null where they backed out or it failed. Never throws. */
async function pickFolder(previous: string | null): Promise<{ uri: string; name: string | null } | null> {
  try {
    return (await JukeboxAudio.pickBackupFolderAsync?.(previous)) ?? null;
  } catch (error) {
    console.warn('A folder for backups could not be chosen', error);
    return null;
  }
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Under the rows that export and import, with the room the cards on this page keep from each other.
    card: { marginTop: 16 },
    // A row that cannot be pressed for now: Back up now, with no folder to back up into.
    off: { color: c.textDisabled, fontSize: 15.5, flexShrink: 1 },
    // What went wrong, in the row it is about rather than under the card.
    bad: { color: c.danger, fontSize: 12.5, lineHeight: 18 },
  })
);
