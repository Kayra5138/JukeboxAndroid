import { WithNowPlaying } from '../../../components/NowPlayingBar';
import { TabTitle, usePageRoom } from '../../../components/Page';
import { SearchField } from '../../../components/SearchField';
import { CARD_GAP, SPACE, TYPE } from '../../../lib/theme/measures';
import { useCallback, useDeferredValue, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused, useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BlurArea, ClockGlass, GlassScene } from '../../../components/Frosted';
import { FindIn, Text } from '../../../components/settings/Find';
import { SearchResults } from '../../../components/settings/SearchResults';
import { searchSettings, wayTo, type SettingsHit } from '../../../lib/settings/search';
import { useBack } from '../../../lib/ui/back';
import { Pressable } from '../../../components/Pressable';
import JukeboxAudio from '../../../../modules/jukebox-audio';
import Constants from 'expo-constants';
import { ConfirmSheet } from '../../../components/ConfirmSheet';
import { OptionSheet } from '../../../components/OptionSheet';
import { DownloadsCategory } from '../../../components/downloads/SettingsRows';
import { CategoryRow, useRows, Chevron } from '../../../components/settings/rows';
import { UpdateRow } from '../../../components/support/UpdateRows';
import { chooseLanguage, LANGUAGES, useLanguage, useT } from '../../../lib/i18n/index';
import { pendingPairCount } from '../../../lib/identity/index';
import { useLandscape } from '../../../lib/ui/layout';
import { startOver } from '../../../lib/ui/welcomeStore';
import { makeStyles, scene, usePressed, useThemeChoice } from '../../../lib/theme/index';
import { themeOf } from '../../../lib/theme/registry';
import { useLibraryViews } from '../../../lib/ui/libraryViews';
import { useTopOnReselect } from '../../../lib/ui/tabReselect';

/**
 * Settings, as a menu of what there is to set.
 *
 * It was every setting on one page, and the longest screen in the app: what
 * was wanted was found by scrolling past everything that was not. Now the
 * tab is six categories, in the order they are gone to, and each opens a
 * page of its own holding the rows that were here. Two things are still done
 * on the tab itself: the language, first, and the first start again, last.
 * Two more come and go or lead elsewhere: word of a newer version, under the
 * version it is newer than, and the way to report a problem, near the end.
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
  // Whether the first start again is being asked about: see the last row.
  const [askingStart, setAskingStart] = useState(false);
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
      setPairs(pendingPairCount());
    } catch {
      setPairs(0);
    }
  }, []));
  const landscape = useLandscape();
  // The skeleton every page has, for the page a tab opens on: see `usePageRoom`.
  const room = usePageRoom({ root: true });
  const built = JukeboxAudio.buildTimestamp;
  const version = Constants.expoConfig?.version;
  const date = built ? new Date(built) : null;
  const said = t.settings.categories;
  const views = useLibraryViews();

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
            <Chevron />
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
      <CategoryRow href="/settings-miniplayer" title={t.settings.sections.miniPlayer} note={said.miniPlayer} />
      {/* Only while the library offers tapes: there is nothing for it to set otherwise. */}
      {views.includes('tapes') ? <CategoryRow href="/settings-tapes" title={t.settings.sections.tapes} note={said.tapes} /> : null}
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
      {/*
        A way to say something is wrong, from inside the app and with the
        details somebody would otherwise be asked for. Its screen shows all of
        what would be sent before anything is, and sends nothing itself.
      */}
      <CategoryRow href="/report" title={t.support.report.row.title} note={t.support.report.row.note} />
      {/*
        Last, being the least often wanted: the app as it was on its first
        start, setup, offer and tips. For whoever wants the tour
        again, put a tip away unread, or is handing the phone to somebody new.
      */}
      <View style={[rows.card, styles.after]}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityHint={t.welcome.settings.note}
          style={rows.row}
          // Asked first: it takes the whole screen over, and one touch too many on a row this low brought it up unasked.
          onPress={() => setAskingStart(true)}>
          <View style={rows.line}>
            <Text style={rows.title}>{t.welcome.settings.title}</Text>
            <Text style={rows.value} numberOfLines={1}>{t.welcome.settings.again}</Text>
          </View>
          <Text style={rows.muted}>{t.welcome.settings.note}</Text>
        </Pressable>
      </View>
    </>
  );

  /*
    Any setting by a word it is shown with, however far in it is
    (`lib/settings/search.ts`): what is found stands in place of the
    categories while anything is typed, as the library's search does with
    its lists, and opens the page it is on with the word marked there
    (`FindIn`), by way of the pages it is in.
  */
  const [query, setQuery] = useState('');
  // Looked a moment behind the field: a letter typed is never held up by it.
  const looked = useDeferredValue(query);
  const searching = looked.trim().length > 0;
  const hits = searching ? searchSettings(t, looked) : [];
  const router = useRouter();
  const open = (hit: SettingsHit) => {
    if (hit.page === 'settings') {
      // On this page: the categories back, and the one found marked among them.
      setQuery('');
      router.setParams({ find: hit.text });
      return;
    }
    const way = wayTo(hit.page);
    way.forEach((page, index) => {
      const last = index === way.length - 1;
      router.push((last && !hit.isPage ? { pathname: `/${page}`, params: { find: hit.text } } : `/${page}`) as Href);
    });
  };
  // Back, and the tab pressed again, take the search away before anything else, as in the library.
  const focused = useIsFocused();
  useBack(query.length > 0 && focused, () => setQuery(''));

  // Its tab pressed again: back to the top of it, and then the search away.
  const backUp = useTopOnReselect(() => setQuery(''));
  // And for a row looked for from the search to be scrolled to: see `FindIn`.
  const findScroller = useRef<ScrollView | null>(null);

  return <View style={styles.screen}>
    <WithNowPlaying>
    <FindIn scroller={findScroller}>
    {/* The page an area the glass behind the clock blurs: see `ClockGlass`. */}
    <GlassScene>
    <BlurArea style={styles.fill}>
    <ScrollView
      {...backUp}
      // A result tapped with the keyboard up opens at the first touch, rather than only putting the keyboard away.
      keyboardShouldPersistTaps="handled"
      ref={(view) => {
        findScroller.current = view;
        backUp.ref(view);
      }}
      contentContainerStyle={room}>
      <TabTitle title={t.nav.settings} />
      {/* Word of a newer version, at the top while there is one. */}
      <UpdateRow />
      {/* Settings searched: see `open` above. */}
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t.settings.search.open}
        accessibilityLabel={t.settings.search.title}
      />
      {searching ? (
        <View style={styles.groups}>
          <SearchResults hits={hits} query={looked.trim()} onOpen={open} />
        </View>
      ) : null}
      {/*
        Upright it is one column of boxes, each category its own: short enough
        to be taken in, with a line or two under each name to choose by.
        Sideways the frame is a third as tall
        and one column cannot fit it, so there are two — the language over
        the first three categories, the other three over the last switch —
        and reading down one and then the other is still the same order.
      */}
      {searching ? null : landscape ? (
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
      {/*
        Which build this is, at the foot, with the name of the app: what an
        issue asks for, and a number that needs no words.
      */}
      {searching ? null : (
        <Text style={styles.built} selectable>
          {`Jukebox ${version ?? ''} · `}
          {date && Number.isFinite(date.getTime()) ? t.settings.lastBuilt(t.format.dateTime(date)) : t.settings.lastBuiltUnknown}
        </Text>
      )}
    </ScrollView>
    </BlurArea>
    <ClockGlass />
    </GlassScene>
    </FindIn>
    </WithNowPlaying>
    {/*
      Each language written in itself, as it was when they were chips: this
      is the one setting somebody may have to find without being able to
      read the rest. A list and not chips, because two fit beside the word
      Language and the third would not.
    */}
    <ConfirmSheet
      visible={askingStart}
      title={t.welcome.settings.ask.title}
      body={t.welcome.settings.ask.body}
      confirmLabel={t.welcome.settings.again}
      onConfirm={startOver}
      onCancel={() => setAskingStart(false)}
    />
    <OptionSheet
      page
      visible={languagesOpen}
      heading={t.settings.language.title}
      note={`${t.settings.language.note} ${t.welcome.language.made}`}
      options={LANGUAGES.map((entry) => ({ value: entry.id, label: entry.name }))}
      chosen={language}
      onChoose={chooseLanguage}
      onClose={() => setLanguagesOpen(false)}
    />
  </View>;
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  fill: { flex: 1 },
  built: { color: c.textMuted, fontSize: TYPE.hint, textAlign: 'center', marginTop: CARD_GAP },

  groups: { marginTop: CARD_GAP },
  // Side by side only where there is width for it.
  groupsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xl },
  group: { flex: 1, minWidth: 0 },
  // Between one card and the next, as on the themes' screen: there are no headings here to part them.
  after: { marginTop: SPACE.m },
  // Each box brings the room above itself; the column that begins with one gives that room back, to start level with the other.
  beside: { marginTop: -SPACE.m },
}));
