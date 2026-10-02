import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import JukeboxAudio from '../../../modules/jukebox-audio';
import { libraryRoot } from '../../lib/media/library';
import { PlayerSettings } from '../../components/PlayerSettings';
import { BackupSheet } from '../../components/BackupSheet';
import {
  applyBackup,
  BackupError,
  exportBackup,
  openBackup,
  restart,
  type Opened,
} from '../../lib/backup/index';
import { formatDateTime } from '../../lib/format/date';
import { DEFAULT_JUMP, JUMP_STEPS, stepFrom } from '../../lib/player/jump';
import { rackWanted, useLandscape } from '../../lib/ui/layout';
import { usePlayerActions, usePlayerState } from '../../lib/player/PlayerProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const [folder, setFolder] = useState('Music');
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const { speed, pitch } = usePlayerState();
  const { setSpeed, setPitch } = usePlayerActions();
  const [rack, setRack] = useState(true);
  const [still, setStill] = useState(false);
  const [jump, setJump] = useState(DEFAULT_JUMP);

  /*
    The backup, which is the one thing on this screen that takes time and can
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

  const saveBackup = useCallback(async () => {
    setBusy('export');
    setNote(null);
    try {
      // Nothing is said when the user backs out of choosing a place. They
      // know they did, and "cancelled" is not news.
      if (await exportBackup()) setNote({ text: 'Saved.', bad: false });
    } catch (trouble) {
      setNote({ text: said(trouble, 'The backup could not be saved.'), bad: true });
    } finally {
      setBusy(null);
    }
  }, []);

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
      setNote({ text: said(trouble, 'That file could not be read.'), bad: true });
    } finally {
      setBusy(null);
    }
  }, []);

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
        setRefused(`${said(trouble, 'The import failed.')} Nothing on this phone was changed.`);
      } finally {
        setApplying(false);
      }
    },
    [opened]
  );
  useFocusEffect(useCallback(() => {
    setFolder(libraryRoot());
    setStill(readSetting(SETTINGS.reduceMotion) === 'true');
    setRack(rackWanted(true));
    setJump(stepFrom(readSetting(SETTINGS.jumpSeconds)));
  }, []));
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!playbackOpen) return false;
      setPlaybackOpen(false);
      return true;
    });
    return () => listener.remove();
  }, [playbackOpen]));
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
  const built = JukeboxAudio.buildTimestamp;
  const date = built ? new Date(built) : null;
  return <View style={styles.screen}>
    <ScrollView style={{ paddingTop: insets.top }} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Jukebox</Text>
      <Text style={styles.built}>Last built: {date && Number.isFinite(date.getTime()) ? formatDateTime(date) : 'Available after installing the new APK'}</Text>
      {/*
        Two short groups, beside each other where there is width for it.

        Each is one card with its rows ruled off inside it, rather than a row
        of separate cards. Separate cards had nothing between them upright —
        the gap only existed in the sideways style — so every rounded corner
        met the next one and the group read as a mistake rather than a list.
      */}
      <View style={[styles.groups, landscape && styles.groupsWide]}>
        <View style={styles.group}>
          <Text style={styles.section}>Library</Text>
          <View style={styles.card}>
            <Link href="/metadata" asChild>
              <Pressable style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>Tags</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>Track information and album covers</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <Link href="/folders" asChild>
              <Pressable style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>Library folder</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{folder}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            {/*
              Sideways only, which is why it says so. The rack is records turned
              about a vertical axis and seen from the side; a tall frame has to
              stack that shape instead, and a pile of slabs is neither a shelf
              nor a faster way to find anything — so upright there is a list and
              nothing to choose.
            */}
            <View style={styles.row}>
              {/*
                The switch sits against the name, not against the whole entry.
                Centred on the pair it drifted down the middle of a paragraph
                three lines deep and looked unattached to anything.
              */}
              <View style={styles.line}>
                <Text style={styles.title}>Albums as a rack</Text>
                <Switch
                  value={rack}
                  onValueChange={(on) => {
                    setRack(on);
                    writeSetting(SETTINGS.coverFlow, on ? 'true' : 'false');
                  }}
                  trackColor={{ false: '#2a2a2a', true: '#2f4a63' }}
                  thumbColor={rack ? '#7ab8ff' : '#6a6a6a'}
                />
              </View>
              <Text style={styles.muted}>
                Holding the phone sideways, flick through sleeves instead of
                reading a list. Tap the one in front to open it.
              </Text>
            </View>
            <View style={styles.rule} />
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>Hold the decoration still</Text>
                <Switch
                  value={still}
                  onValueChange={(on) => {
                    setStill(on);
                    writeSetting(SETTINGS.reduceMotion, on ? 'true' : 'false');
                  }}
                  trackColor={{ false: '#2a2a2a', true: '#2f4a63' }}
                  thumbColor={still ? '#7ab8ff' : '#6a6a6a'}
                />
              </View>
              <Text style={styles.muted}>
                For a phone that drops frames. The player appears instead of
                rising, and the game stops lighting up around a life won or
                lost. The keys themselves still fall — that is the game, not
                decoration.
              </Text>
            </View>
          </View>

          {/*
            Under the library rather than in a group of its own, so that
            sideways it sits beneath the first column instead of making a
            third. It is also where it belongs: this is the rest of what the
            app holds about the music in that folder.
          */}
          <Text style={[styles.section, styles.sectionAfter]}>Your data</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              disabled={busy != null}
              style={styles.row}
              onPress={() => void saveBackup()}>
              <View style={styles.line}>
                <Text style={styles.title}>Export everything</Text>
                {busy === 'export' ? <ActivityIndicator color="#7a7a7a" /> : <Text style={styles.chevron}>›</Text>}
              </View>
              <Text style={styles.muted}>
                Your listening history, lists, tags, lyrics and settings, in one file you choose a
                place for. Not the music itself.
              </Text>
            </Pressable>
            <View style={styles.rule} />
            <Pressable
              accessibilityRole="button"
              disabled={busy != null}
              style={styles.row}
              onPress={() => void chooseBackup()}>
              <View style={styles.line}>
                <Text style={styles.title}>Import</Text>
                {busy === 'import' ? <ActivityIndicator color="#7a7a7a" /> : <Text style={styles.chevron}>›</Text>}
              </View>
              <Text style={styles.muted}>
                Bring a backup in. You are shown what is in it and asked before anything changes.
              </Text>
            </Pressable>
          </View>
          {note ? (
            <Text accessibilityRole={note.bad ? 'alert' : undefined} style={note.bad ? styles.noteBad : styles.note}>
              {note.text}
            </Text>
          ) : null}
        </View>
        <View style={styles.group}>
          <Text style={styles.section}>Player</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => setPlaybackOpen(true)}>
              <View style={styles.line}>
                <Text style={styles.title}>Playback</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.muted}>Speed and pitch · {speed}×</Text>
            </Pressable>
            <View style={styles.rule} />
            <Link href="/equalizer" asChild>
              <Pressable style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>Equalizer</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>Bands, bass, surround and loudness</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <Link href="/effects" asChild>
              <Pressable style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>Effects</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>Width, crossfeed, rotation and level</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            {/*
              Offered as the steps themselves rather than as a field to type a
              number into. There are only a few that anybody wants, the one in
              use has to be readable at a glance because it is also what is
              drawn on the buttons, and a keyboard over a settings list to
              change a 10 to a 15 is more ceremony than the choice deserves.
            */}
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>Jump by</Text>
                <View style={styles.choices}>
                  {JUMP_STEPS.map((seconds) => (
                    <Pressable
                      key={seconds}
                      accessibilityRole="button"
                      accessibilityState={{ selected: seconds === jump }}
                      style={[styles.choice, seconds === jump && styles.choiceOn]}
                      onPress={() => {
                        setJump(seconds);
                        writeSetting(SETTINGS.jumpSeconds, String(seconds));
                      }}>
                      <Text style={[styles.choiceText, seconds === jump && styles.choiceTextOn]}>
                        {seconds}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Text style={styles.muted}>
                How far the two buttons either side of play move through a
                track, in seconds.
              </Text>
            </View>
            <View style={styles.rule} />
            <Link href="/transitions" asChild>
              <Pressable style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>Crossfade</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>How one track gives way to the next</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScrollView>
    <PlayerSettings visible={playbackOpen} speed={speed} pitch={pitch} onSpeed={(value) => void setSpeed(value)} onPitch={(value) => void setPitch(value)} onClose={() => setPlaybackOpen(false)} />
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
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  content: { padding: 20, paddingBottom: 32 },
  brand: { color: '#ededed', fontSize: 28, fontWeight: '600', letterSpacing: -0.4 },
  built: { color: '#6a6a6a', fontSize: 12, marginTop: 4 },

  groups: { gap: 26, marginTop: 28 },
  // Side by side only where there is width for it; the gap above does for
  // both, being the space between them either way round.
  groupsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  group: { flex: 1, minWidth: 0 },
  // A second heading inside one group needs the room above it that the gap
  // between groups gives the first.
  sectionAfter: { marginTop: 26 },
  note: { color: '#8fbf8f', fontSize: 12.5, marginTop: 8, marginLeft: 4 },
  noteBad: { color: '#ff8a8a', fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  section: {
    color: '#6a6a6a',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  /*
    One surface per group with its rows ruled off inside it. Clipped, so the
    top and bottom rows are cut to the card's own corners and no row has to
    know whether it is at an end.
  */
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  /*
    A line of its own between the rows rather than a border on them. As a
    border it had to be turned off again on whichever row came first, and a
    row given its style as a list of two lost its padding when it was also
    inside a Link — so every row here is handed exactly one style object.
  */
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#2a2a2a', marginLeft: 16 },
  /** Name on the left, whatever acts on it on the right, on one line. */
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },

  /** A short row of alternatives, where one of them is already the answer. */
  choices: { flexDirection: 'row', gap: 6 },
  choice: {
    minWidth: 32,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#262626',
    alignItems: 'center',
  },
  choiceOn: { backgroundColor: '#ededed' },
  choiceText: { color: '#a8a8a8', fontSize: 13.5, fontVariant: ['tabular-nums'] },
  choiceTextOn: { color: '#121212', fontWeight: '600' },

  title: { color: '#ededed', fontSize: 15.5, flexShrink: 1 },
  muted: { color: '#7a7a7a', fontSize: 12.5, lineHeight: 18 },
  chevron: { color: '#5a5a5a', fontSize: 20, lineHeight: 22 },
});
