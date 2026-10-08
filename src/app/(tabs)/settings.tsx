import { DiscoverSettings } from '../../components/DiscoverSettings';
import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from '../../components/Pressable';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import JukeboxAudio from '../../../modules/jukebox-audio';
import { libraryRoot } from '../../lib/media/library';
import { LIBRARY_VIEWS, storedViews, viewsFrom, withView, type LibraryView } from '../../lib/media/views';
import { OptionSheet } from '../../components/OptionSheet';
import { PlayerSettings } from '../../components/PlayerSettings';
import { BackupSheet } from '../../components/BackupSheet';
import { DownloadsSettings } from '../../components/downloads/SettingsRows';
import { ListenBrainzSettings } from '../../components/ListenBrainzSettings';
import {
  applyBackup,
  BackupError,
  exportBackup,
  openBackup,
  restart,
  type Opened,
} from '../../lib/backup/index';
import { chooseLanguage, LANGUAGES, useLanguage, useT } from '../../lib/i18n/index';
import { sameSongs } from '../../lib/identity/index';
import { namedTargets } from '../../lib/lyrics/target';
import { chooseLyricsTarget, useLyricsTarget, useUnsupportedTargets } from '../../lib/lyrics/useTarget';
import { JUMP_STEPS, stepFrom } from '../../lib/player/jump';
import { rackWanted, useLandscape } from '../../lib/ui/layout';
import { usePlayerActions, usePlayerState } from '../../lib/player/PlayerProvider';
import {
  makeStyles,
  outlined,
  outlinedClip,
  scene,
  switchColours,
  useColours,
  usePressed,
  useThemeChoice,
} from '../../lib/theme/index';
import { themeOf } from '../../lib/theme/registry';
import { Behind } from '../../lib/theme/Veil';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  /*
    The three choices that are not read on focus like the rest, because they
    are not this screen's to keep: each is held where everything that depends
    on it is watching, and changing one here redraws the app — this screen
    with it — on the spot.
  */
  const language = useLanguage();
  const lyricsTarget = useLyricsTarget();
  const unsupportedTargets = useUnsupportedTargets();
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  /** What is chosen, to be named on the row that opens the themes. */
  const themeChoice = useThemeChoice();
  const themeNameKey = themeChoice === 'system' ? 'system' : themeOf(themeChoice).nameKey;
  /*
    Read as the screen is first drawn as well as each time it is come back
    to. Starting from placeholders and correcting them a moment later drew
    the whole screen twice on the way in.
  */
  const [folder, setFolder] = useState(() => libraryRoot());
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const { speed, pitch } = usePlayerState();
  const { setSpeed, setPitch } = usePlayerActions();
  const [rack, setRack] = useState(() => rackWanted(true));
  const [still, setStill] = useState(() => readSetting(SETTINGS.reduceMotion) === 'true');
  /** The ways of looking at the library that its switch offers. */
  const [views, setViews] = useState<LibraryView[]>(() => viewsFrom(readSetting(SETTINGS.libraryViews)));
  const [jump, setJump] = useState(() => stepFrom(readSetting(SETTINGS.jumpSeconds)));
  /**
   * Whether tracks are evened out, or null where this build cannot say.
   *
   * Kept by the player rather than with the other settings, because the
   * player has to know it with the app closed. Null until it has answered,
   * and for good on a native build from before the feature — the row is not
   * drawn then, rather than drawn as a switch that does nothing.
   */
  const [even, setEven] = useState<boolean | null>(null);
  /** How many pairs of files are waiting to be called one song or two. */
  const [pairs, setPairs] = useState(0);

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
  useFocusEffect(useCallback(() => {
    setFolder(libraryRoot());
    setStill(readSetting(SETTINGS.reduceMotion) === 'true');
    setRack(rackWanted(true));
    // The same list is a new array each time it is read, and is not news.
    const kept = viewsFrom(readSetting(SETTINGS.libraryViews));
    setViews((before) => (storedViews(before) === storedViews(kept) ? before : kept));
    setJump(stepFrom(readSetting(SETTINGS.jumpSeconds)));
    JukeboxAudio.getLoudnessAsync?.()
      .then((loudness) => setEven(loudness.enabled))
      .catch(() => setEven(null));
    // Counted here and not kept anywhere, so the row is gone the moment the
    // last pair has been answered and this screen is come back to.
    try {
      setPairs(sameSongs().length);
    } catch {
      setPairs(0);
    }
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
  const targets = namedTargets(t.languages, language);
  // The one already chosen stays in the list whatever is said of it, so that
  // the row and the tick never name something the list does not hold.
  const offered = targets.filter((target) => target.tag === lyricsTarget || !unsupportedTargets.has(target.tag));
  return <View style={styles.screen}>
    {/* The page itself, apart from the sheet of playback settings laid over it. */}
    <Behind veiled={playbackOpen} style={styles.behind}>
    <ScrollView style={{ paddingTop: insets.top }} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Jukebox</Text>
      <Text style={styles.built}>
        {date && Number.isFinite(date.getTime())
          ? t.settings.lastBuilt(t.format.dateTime(date))
          : t.settings.lastBuiltUnknown}
      </Text>
      {/*
        Two short groups, beside each other where there is width for it.

        Each is one card with its rows ruled off inside it, rather than a row
        of separate cards. Separate cards had nothing between them upright —
        the gap only existed in the sideways style — so every rounded corner
        met the next one and the group read as a mistake rather than a list.
      */}
      <View style={[styles.groups, landscape && styles.groupsWide]}>
        <View style={styles.group}>
          {/*
            First, because the language is the one setting somebody may have to
            find without being able to read the rest. Each language is written
            in itself for the same reason.
          */}
          <Text style={styles.section}>{t.format.upper(t.settings.sections.app)}</Text>
          <View style={styles.card}>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.row}
              onPress={() => setLanguagesOpen(true)}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.language.title}</Text>
                <View style={styles.choices}>
                  <Text style={styles.value} numberOfLines={1}>
                    {LANGUAGES.find((entry) => entry.id === language)?.name ?? language}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>
              <Text style={styles.muted}>{t.settings.language.note}</Text>
            </Pressable>
            <View style={styles.rule} />
            {/*
              A row that opens the themes, and no longer the themes
              themselves. There are two dozen of them, each with a picture,
              and laid out here they were most of this screen: everything
              else in Settings was found by scrolling past them.
            */}
            <Link href="/themes" asChild>
              <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.settings.theme.title}</Text>
                  <View style={styles.choices}>
                    <Text style={styles.value} numberOfLines={1}>
                      {t.themes[themeNameKey]}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </View>
                <Text style={styles.muted}>{t.settings.theme.open}</Text>
              </Pressable>
            </Link>
          </View>

          <Text style={[styles.section, styles.sectionAfter]}>{t.format.upper(t.settings.sections.library)}</Text>
          <View style={styles.card}>
            <Link href="/metadata" asChild>
              <Pressable android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.tags}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{t.settings.tags.note}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <Link href="/folders" asChild>
              <Pressable android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.libraryFolder}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{folder}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            {/*
              With the folder they are saved to. A component of its own,
              because it says how the queue stands and so is drawn again as
              often as the queue is read — which this screen should not be.
            */}
            <DownloadsSettings />
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
                <Text style={styles.title}>{t.settings.rack.title}</Text>
                <Switch
                  value={rack}
                  onValueChange={(on) => {
                    setRack(on);
                    writeSetting(SETTINGS.coverFlow, on ? 'true' : 'false');
                  }}
                  {...switchColours(c, rack)}
                />
              </View>
              <Text style={styles.muted}>{t.settings.rack.note}</Text>
            </View>
            <View style={styles.rule} />
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.still.title}</Text>
                <Switch
                  value={still}
                  onValueChange={(on) => {
                    setStill(on);
                    writeSetting(SETTINGS.reduceMotion, on ? 'true' : 'false');
                  }}
                  {...switchColours(c, still)}
                />
              </View>
              <Text style={styles.muted}>{t.settings.still.note}</Text>
            </View>
          </View>

          {/*
            Which of its four shapes the library's switch offers.

            A switch each rather than a list to pick from, because they are not
            alternatives: the question for each is whether it earns a place on
            a row that gets more crowded with every one that does.
          */}
          <Text style={[styles.section, styles.sectionAfter]}>{t.format.upper(t.settings.sections.views)}</Text>
          <View style={styles.card}>
            {LIBRARY_VIEWS.map((view, index) => {
              const on = views.includes(view);
              /*
                The last one left on cannot be turned off, and says so by not
                moving. `withView` would refuse anyway; held still here so the
                switch is not seen to flick over and back, which reads as the
                app having failed to do what it was asked.
              */
              const only = on && views.length === 1;
              return (
                <View key={view}>
                  {index > 0 ? <View style={styles.rule} /> : null}
                  <View style={styles.row}>
                    <View style={styles.line}>
                      <Text style={styles.title}>{t.library.views[view]}</Text>
                      <Switch
                        accessibilityLabel={t.library.views[view]}
                        accessibilityHint={
                          only ? t.settings.views.onlyHint : t.settings.views.toggleHint
                        }
                        value={on}
                        disabled={only}
                        onValueChange={(wanted) => {
                          const next = withView(views, view, wanted);
                          setViews(next);
                          writeSetting(SETTINGS.libraryViews, storedViews(next));
                        }}
                        {...switchColours(c, on)}
                      />
                    </View>
                    <Text style={styles.muted}>{t.settings.views.notes[view]}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.aside}>
            {views.length === 1 ? t.settings.views.asideOne : t.settings.views.asideMany}
          </Text>

          {/*
            Under the library rather than in a group of its own, so that
            sideways it sits beneath the first column instead of making a
            third. It is also where it belongs: this is the rest of what the
            app holds about the music in that folder.
          */}
          <Text style={[styles.section, styles.sectionAfter]}>{t.format.upper(t.settings.sections.data)}</Text>
          <View style={styles.card}>
            {/*
              Only there when there is something to decide. Most of the time
              there is not, and a row that opens an empty screen is a row
              somebody has to learn to ignore.
            */}
            {pairs > 0 ? (
              <>
                <Link href="/samesongs" asChild>
                  <Pressable android_ripple={pressed} style={styles.row}>
                    <View style={styles.line}>
                      <Text style={styles.title}>{t.nav.sameSong}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                    <Text style={styles.muted}>{t.settings.sameSong.note(pairs)}</Text>
                  </Pressable>
                </Link>
                <View style={styles.rule} />
              </>
            ) : null}
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
        </View>
        <View style={styles.group}>
          <DiscoverSettings />
          <Text style={[styles.section, styles.sectionAfter]}>{t.format.upper(t.settings.sections.player)}</Text>
          <View style={styles.card}>
            <Pressable android_ripple={pressed} style={styles.row} onPress={() => setPlaybackOpen(true)}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.playback.title}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.muted}>{t.settings.playback.note(String(speed))}</Text>
            </Pressable>
            <View style={styles.rule} />
            <Link href="/equalizer" asChild>
              <Pressable android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.equalizer}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{t.settings.equalizer.note}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <Link href="/effects" asChild>
              <Pressable android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.effects}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{t.settings.effects.note}</Text>
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
                <Text style={styles.title}>{t.settings.jump.title}</Text>
                <View style={styles.choices}>
                  {JUMP_STEPS.map((seconds) => (
                    <Pressable
                      android_ripple={pressed}
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
              <Text style={styles.muted}>{t.settings.jump.note}</Text>
            </View>
            <View style={styles.rule} />
            <Link href="/transitions" asChild>
              <Pressable android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.crossfade}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{t.settings.crossfade.note}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            {/*
              Too many to lay out as chips, so the row says which and opens a
              list. Named in the language the app is in, unlike the app's own
              languages above: this is a list to read, not one to be found in
              by somebody who cannot.
            */}
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.row}
              onPress={() => setTargetsOpen(true)}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.lyricsLanguage.title}</Text>
                <View style={styles.choices}>
                  <Text style={styles.value} numberOfLines={1}>
                    {targets.find((target) => target.tag === lyricsTarget)?.name ?? lyricsTarget}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>
              <Text style={styles.muted}>{t.settings.lyricsLanguage.note}</Text>
            </Pressable>
            {/*
              A switch and no more. There is a target level and a ceiling
              behind it, and neither is offered: the one is a standard and
              the other is what stops a turned-up track clipping, and a
              slider for either is a way to make this sound worse.
            */}
            {even !== null ? (
              <>
                <View style={styles.rule} />
                <View style={styles.row}>
                  <View style={styles.line}>
                    <Text style={styles.title}>{t.settings.loudness.title}</Text>
                    <Switch
                      value={even}
                      onValueChange={(on) => {
                        // Shown at once and put back if the player would not
                        // take it, so the switch never lags the finger.
                        setEven(on);
                        JukeboxAudio.setLoudnessAsync?.({ enabled: on })
                          .then((loudness) => setEven(loudness.enabled))
                          .catch((failure: unknown) => {
                            console.warn('Even loudness could not be set', failure);
                            setEven(!on);
                          });
                      }}
                      {...switchColours(c, even)}
                    />
                  </View>
                  <Text style={styles.muted}>{t.settings.loudness.note}</Text>
                </View>
              </>
            ) : null}
          </View>
          {/*
            Last, and under a heading that says what it is. It is the one thing
            here that sends anything about the user anywhere, it needs an
            account with somebody else, and it is newer than everything above
            it: at the foot of the page it is found by whoever goes looking
            and is in nobody else's way.
          */}
          <ListenBrainzSettings heading={t.settings.sections.experimental} />
        </View>
      </View>
    </ScrollView>
    </Behind>
    <PlayerSettings visible={playbackOpen} speed={speed} pitch={pitch} onSpeed={(value) => void setSpeed(value)} onPitch={(value) => void setPitch(value)} onClose={() => setPlaybackOpen(false)} />
    {/*
      Each language written in itself, as it was when they were chips: this
      is the one setting somebody may have to find without being able to
      read the rest. A list and not chips, because two fit beside the word
      Language and the third would not.
    */}
    <OptionSheet
      visible={languagesOpen}
      heading={t.settings.language.title}
      note={t.settings.language.note}
      options={LANGUAGES.map((entry) => ({ value: entry.id, label: entry.name }))}
      chosen={language}
      onChoose={chooseLanguage}
      onClose={() => setLanguagesOpen(false)}
    />
    <OptionSheet
      visible={targetsOpen}
      heading={t.settings.lyricsLanguage.title}
      note={t.settings.lyricsLanguage.note}
      options={offered.map((target) => ({ value: target.tag, label: target.name }))}
      chosen={lyricsTarget}
      onChoose={chooseLyricsTarget}
      onClose={() => setTargetsOpen(false)}
    />
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

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  behind: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  brand: { color: c.text, fontSize: 28, fontWeight: '600', letterSpacing: -0.4 },
  built: { color: c.textFaint, fontSize: 12, marginTop: 4 },

  groups: { gap: 26, marginTop: 28 },
  // Side by side only where there is width for it; the gap above does for
  // both, being the space between them either way round.
  groupsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  group: { flex: 1, minWidth: 0 },
  // A second heading inside one group needs the room above it that the gap
  // between groups gives the first.
  sectionAfter: { marginTop: 26 },
  /** A line under a card that is about the whole card rather than a row of it. */
  aside: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  note: { color: c.success, fontSize: 12.5, marginTop: 8, marginLeft: 4 },
  noteBad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  section: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  /*
    One surface per group with its rows ruled off inside it. Clipped, so the
    top and bottom rows are cut to the card's own corners and no row has to
    know whether it is at an end.
  */
  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  /*
    A line of its own between the rows rather than a border on them. As a
    border it had to be turned off again on whichever row came first, and a
    row given its style as a list of two lost its padding when it was also
    inside a Link — so every row here is handed exactly one style object.
  */
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  /** Name on the left, whatever acts on it on the right, on one line. */
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },

  /** A short row of alternatives, where one of them is already the answer. */
  choices: { flexDirection: 'row', gap: 6 },
  choice: {
    minWidth: 32,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    ...outlined(c),
  },
  choiceOn: { backgroundColor: c.primary, ...outlined(c, c.primary) },
  choiceText: { color: c.textSecondary, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  choiceTextOn: { color: c.onPrimary, fontWeight: '600' },

  title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
  /** What a row that opens a list is set to at the moment, beside its chevron. */
  value: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },
}));
