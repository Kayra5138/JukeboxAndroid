import { usePageSides, WithNowPlaying } from '../../components/NowPlayingBar';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../../components/Pressable';
import JukeboxAudio from '../../../modules/jukebox-audio';
import { OptionSheet } from '../../components/OptionSheet';
import { DownloadsCategory } from '../../components/downloads/SettingsRows';
import { CategoryRow, useRows } from '../../components/settings/rows';
import { chooseLanguage, LANGUAGES, useLanguage, useT } from '../../lib/i18n/index';
import { sameSongs } from '../../lib/identity/index';
import { useLandscape } from '../../lib/ui/layout';
import { makeStyles, scene, usePressed, useThemeChoice } from '../../lib/theme/index';
import { themeOf } from '../../lib/theme/registry';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Settings, as a menu of what there is to set.
 *
 * It was every setting on one page, and the longest screen in the app: what
 * was wanted was found by scrolling past everything that was not. Now the
 * tab is six categories, in the order they are gone to, and each opens a
 * page of its own holding the rows that were here. Two things are still set
 * on the tab itself: the language, first, and one switch, last.
 */
export default function SettingsScreen() {
  const t = useT();
  const styles = useStyles();
  const rows = useRows();
  const pressed = usePressed();
  /*
    Not read on focus, because they are not this screen's to keep: each is
    held where everything that depends on it is watching, and changing one
    redraws the app — this screen with it — on the spot.
  */
  const language = useLanguage();
  const [languagesOpen, setLanguagesOpen] = useState(false);
  /** What is chosen, to be named on the row that opens how the app looks. */
  const themeChoice = useThemeChoice();
  const themeNameKey = themeChoice === 'system' ? 'system' : themeOf(themeChoice).nameKey;
  /**
   * How many pairs of files are waiting to be called one song or two.
   *
   * The row that asks is on the library's page and is only there when there
   * is something to ask, so nobody would go looking for it: the count is
   * said here, on the way to it.
   */
  const [pairs, setPairs] = useState(0);
  useFocusEffect(useCallback(() => {
    try {
      setPairs(sameSongs().length);
    } catch {
      setPairs(0);
    }
  }, []));
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
  const sides = usePageSides();
  const built = JukeboxAudio.buildTimestamp;
  const date = built ? new Date(built) : null;
  const said = t.settings.categories;

  /*
    First, because the language is the one setting somebody may have to
    find without being able to read the rest. Each language is written
    in itself for the same reason.
  */
  const speaking = (
    <View style={rows.card}>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        style={rows.row}
        onPress={() => setLanguagesOpen(true)}>
        <View style={rows.line}>
          <Text style={rows.title}>{t.settings.language.title}</Text>
          <View style={rows.choices}>
            <Text style={rows.value} numberOfLines={1}>
              {LANGUAGES.find((entry) => entry.id === language)?.name ?? language}
            </Text>
            <Text style={rows.chevron}>›</Text>
          </View>
        </View>
        <Text style={rows.muted}>{t.settings.language.note}</Text>
      </Pressable>
    </View>
  );
  /*
    The six, by how often each is gone to, in two halves so that sideways
    they can stand in two columns.
  */
  const former = (
    <>
      <CategoryRow href="/settings-look" title={t.settings.sections.look} note={said.look} value={t.themes[themeNameKey]} />
      <CategoryRow href="/settings-sound" title={t.settings.sections.sound} note={said.sound} />
      <CategoryRow href="/settings-player" title={t.settings.sections.player} note={said.player} />
    </>
  );
  const latter = (
    <>
      <CategoryRow
        href="/settings-library"
        title={t.settings.sections.library}
        note={said.library}
        value={pairs > 0 ? said.waiting(pairs) : undefined}
      />
      {/*
        A component of its own, because it says how the queue stands and so
        is drawn again as often as the queue is read — which this screen
        should not be.
      */}
      <DownloadsCategory />
      <CategoryRow href="/settings-data" title={t.settings.sections.data} note={said.data} />
    </>
  );

  return <View style={styles.screen}>
    <WithNowPlaying>
    <ScrollView
      // Clear of the clock by room in what is scrolled, not round the scroller: room given to the
      // scroller itself is taken off how far it will scroll, and the last row stopped short of its own edge.
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingLeft: sides.left + 20, paddingRight: sides.right + 20 },
      ]}>
      <Text style={styles.brand}>Jukebox</Text>
      <Text style={styles.built}>
        {date && Number.isFinite(date.getTime())
          ? t.settings.lastBuilt(t.format.dateTime(date))
          : t.settings.lastBuiltUnknown}
      </Text>
      {/*
        Upright it is one column of boxes, each category its own: short enough
        to be taken in, with a line or two under each name to choose by.
        Sideways the frame is a third as tall
        and one column cannot fit it, so there are two — the language over
        the first three categories, the other three over the last switch —
        and reading down one and then the other is still the same order.
      */}
      {landscape ? (
        <View style={[styles.groups, styles.groupsWide]}>
          <View style={styles.group}>
            {speaking}
            {former}
          </View>
          <View style={[styles.group, styles.beside]}>
            {latter}
          </View>
        </View>
      ) : (
        <View style={styles.groups}>
          {speaking}
          {former}
          {latter}
        </View>
      )}
    </ScrollView>
    </WithNowPlaying>
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
  </View>;
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  // Less at the foot than the pages have: there is nothing under the last card to keep clear of.
  content: { padding: 20, paddingBottom: 24 },
  brand: { color: c.text, fontSize: 28, fontWeight: '600', letterSpacing: -0.4 },
  built: { color: c.textFaint, fontSize: 12, marginTop: 4 },

  groups: { marginTop: 20 },
  // Side by side only where there is width for it.
  groupsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  group: { flex: 1, minWidth: 0 },
  // Between one card and the next, as on the themes' screen: there are no headings here to part them.
  after: { marginTop: 12 },
  // Each box brings the room above itself; the column that begins with one gives that room back, to start level with the other.
  beside: { marginTop: -12 },
}));
