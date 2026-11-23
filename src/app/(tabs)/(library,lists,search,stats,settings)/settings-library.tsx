import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { Text } from '../../../components/settings/Find';

import { OptionSheet } from '../../../components/OptionSheet';
import { Pressable } from '../../../components/Pressable';
import { SettingsPage, useRows, SwitchRow, LinkRow, Chevron } from '../../../components/settings/rows';
import { ShuffleSettingsRows } from '../../../components/ShuffleSettings';
import { useT } from '../../../lib/i18n/index';
import { pendingPairCount } from '../../../lib/identity/index';
import { useCopies } from '../../../lib/library/copiesStore';
import { useWrongDownloads } from '../../../lib/library/wrongDownloadsStore';
import { SHORTEST_CHOICES, type Shortest } from '../../../lib/library/hiding';
import { libraryHidingChanged } from '../../../lib/library/index';
import { useSetAsideIds } from '../../../lib/library/setAside';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { isTape } from '../../../lib/tapes/tape';
import { leftOutCount, libraryRoot, setShortestFiles, shortestFiles } from '../../../lib/media/library';
import { canWriteFiles } from '../../../lib/filetags';
import {
  setWriteEdits,
  setWriteLookups,
  useWriteEdits,
  useWriteLookups,
} from '../../../lib/filetags/auto';
import { usePressed } from '../../../lib/theme/index';
import { setListSuggestions, useListSuggestions } from '../../../lib/ui/listSuggestions';

/**
 * Where the music is and what is written in it: the folder, what is left out
 * of it, the tags, the files that may be one song under two names, and the
 * songs that are here twice.
 *
 * The folder, tags and same-song rows are the ones that were on the Settings
 * tab, as they were.
 */
export default function LibrarySettingsScreen() {
  const t = useT();
  const styles = useRows();
  const pressed = usePressed();
  const suggesting = useListSuggestions();
  const writeEdits = useWriteEdits();
  const writeLookups = useWriteLookups();
  /*
    Read as the screen is first drawn as well as each time it is come back
    to. Starting from placeholders and correcting them a moment later drew
    the whole screen twice on the way in.
  */
  const [folder, setFolder] = useState(() => libraryRoot());
  /** How many pairs of files are waiting to be called one song or two. */
  const [pairs, setPairs] = useState(0);
  /** Read on focus as well: the folders are switched on a screen of their own. */
  const [leftOut, setLeftOut] = useState(() => countLeftOut());
  const [shortest, setShortest] = useState(() => shortestFiles());
  const [choosingShortest, setChoosingShortest] = useState(false);
  /*
    The songs the library holds twice, worked out from the library itself
    and kept with it: the row comes and goes as files do, with nothing to
    count again on the way in.
  */
  const copies = useCopies().length;
  /** The downloads that may be another song than they are filed as: worked out from the jobs and the library, like the copies. */
  const wrong = useWrongDownloads().length;
  /** How many of the library's songs are set aside, worked out as the Tracks view works it out. */
  const library = useLibraryTracks();
  const songs = useMemo(() => library.filter((track) => !isTape(track)), [library]);
  const asideIds = useSetAsideIds(songs);
  const asideCount = asideIds.size === 0 ? 0 : songs.filter((track) => asideIds.has(track.id)).length;

  useFocusEffect(useCallback(() => {
    setFolder(libraryRoot());
    setLeftOut(countLeftOut());
    setShortest(shortestFiles());
    // Counted here and not kept anywhere, so the row is gone the moment the
    // last pair has been answered and this screen is come back to.
    try {
      setPairs(pendingPairCount());
    } catch {
      setPairs(0);
    }
  }, []));

  const shortLabel = (seconds: Shortest) =>
    seconds === 0 ? t.common.off : t.library.shortFiles.under(seconds);
  const shortSpoken = (seconds: Shortest) =>
    seconds === 0 ? t.common.off : t.library.shortFiles.shorterThan(seconds);

  return (
    <SettingsPage
      sheets={
        <OptionSheet
          page
          visible={choosingShortest}
          heading={t.library.shortFiles.title}
          note={t.library.shortFiles.note}
          options={SHORTEST_CHOICES.map((seconds) => ({ value: String(seconds), label: shortSpoken(seconds) }))}
          chosen={String(shortest)}
          onChoose={(value) => {
            const seconds = SHORTEST_CHOICES.find((choice) => String(choice) === value) ?? 0;
            setShortest(seconds);
            setShortestFiles(seconds);
            libraryHidingChanged();
          }}
          onClose={() => setChoosingShortest(false)}
        />
      }>
      <View style={styles.card}>
        <LinkRow
          title={t.nav.libraryFolder}
          hint={folder}
          href="/folders"
        />
        <View style={styles.rule} />
        {/*
          Under the folder, since it narrows what the folder holds; and a
          page of its own, since it is a switch for every folder in it.
        */}
        <LinkRow
          title={t.library.leftOut.title}
          hint={leftOut > 0 ? t.library.leftOut.some(leftOut) : t.library.leftOut.none}
          href="/left-out"
        />
        <View style={styles.rule} />
        {/*
          Beside what is left out, as the lighter of the two: kept in the
          library, out of Tracks and of shuffling everything.
        */}
        <LinkRow
          title={t.library.setAside.title}
          hint={asideCount > 0 ? t.library.setAside.some(asideCount) : t.library.setAside.none}
          href="/set-aside"
        />
        <View style={styles.rule} />
        {/*
          Four choices, which would fit as chips; but each needs a unit to
          be understood, and four of them beside a name this long would not
          fit a narrow phone at a large font. The row says which, and opens
          the list.
        */}
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={`${t.library.shortFiles.title}, ${shortSpoken(shortest)}`}
          accessibilityHint={t.library.shortFiles.note}
          style={styles.row}
          onPress={() => setChoosingShortest(true)}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.library.shortFiles.title}</Text>
            <View style={styles.choices}>
              <Text style={styles.value} numberOfLines={1}>
                {shortLabel(shortest)}
              </Text>
              <Chevron />
            </View>
          </View>
          <Text style={styles.muted}>{t.library.shortFiles.note}</Text>
        </Pressable>
        <View style={styles.rule} />
        <LinkRow
          title={t.nav.tags}
          hint={t.settings.tags.note}
          href="/metadata"
        />
        {/*
          Only there when there is something to decide. Most of the time
          there is not, and a row that opens an empty screen is a row
          somebody has to learn to ignore.
        */}
        {pairs > 0 ? (
          <>
            <View style={styles.rule} />
            <LinkRow
              title={t.nav.sameSong}
              hint={t.settings.sameSong.note(pairs)}
              href="/samesongs"
            />
          </>
        ) : null}
        {/*
          Beside it and not part of it. That one is about a file that may
          have taken another's place; this is two files both here, one of
          which can go. Only there, like it, while there is something to do.
        */}
        {copies > 0 ? (
          <>
            <View style={styles.rule} />
            <LinkRow
              title={t.library.copies.title}
              hint={t.library.copies.some(copies)}
              href="/duplicates"
            />
          </>
        ) : null}
        {/* The same, for files that may be another song altogether: there only while there are any. */}
        {wrong > 0 ? (
          <>
            <View style={styles.rule} />
            <LinkRow
              title={t.library.wrong.title}
              hint={t.library.wrong.some(wrong)}
              href="/wrong-downloads"
            />
          </>
        ) : null}
        {/*
          Always there, unlike the rows above it that come and go: what could go to make room
          is worth a look whether or not anything is here twice.
        */}
        <View style={styles.rule} />
        <LinkRow
          title={t.space.title}
          hint={t.space.rowNote}
          href="/free-space"
        />
      </View>

      {/* The shuffle button over the tracks, and the widget's and the car's with it. */}
      <Text accessibilityRole="header" style={[styles.section, styles.sectionAfter]}>
        {t.format.upper(t.library.shuffle.menu)}
      </Text>
      <View style={styles.card}>
        <ShuffleSettingsRows />
      </View>

      {/* The lists' pages: whether each says, under its songs, what else might belong in it. */}
      <Text accessibilityRole="header" style={[styles.section, styles.sectionAfter]}>
        {t.format.upper(t.nav.lists)}
      </Text>
      <View style={styles.card}>
        <SwitchRow
          title={t.settings.listSuggestions.title}
          hint={t.settings.listSuggestions.note}
          value={suggesting}
          onChange={setListSuggestions}
        />
      </View>

      {/*
        Writing into the files without the button for it. Only where the
        phone can write to files at all.
      */}
      {canWriteFiles() ? (
        <>
          <Text style={[styles.section, styles.sectionAfter]}>{t.format.upper(t.library.autoWrite.heading)}</Text>
          <View style={styles.card}>
            <SwitchRow
              title={t.library.autoWrite.edits.title}
              hint={t.library.autoWrite.edits.note}
              value={writeEdits}
              onChange={setWriteEdits}
            />
            <View style={styles.rule} />
            <SwitchRow
              title={t.library.autoWrite.lookups.title}
              hint={t.library.autoWrite.lookups.note}
              value={writeLookups}
              onChange={setWriteLookups}
            />
          </View>
        </>
      ) : null}
    </SettingsPage>
  );
}

/** How many folders are left out, or none where the settings cannot be read. */
function countLeftOut(): number {
  try {
    return leftOutCount();
  } catch {
    return 0;
  }
}
