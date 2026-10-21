import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';

import { OptionSheet } from '../components/OptionSheet';
import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import { useT } from '../lib/i18n/index';
import { sameSongs } from '../lib/identity/index';
import { useCopies } from '../lib/library/copiesStore';
import { useWrongDownloads } from '../lib/library/wrongDownloadsStore';
import { SHORTEST_CHOICES, type Shortest } from '../lib/library/hiding';
import { libraryHidingChanged } from '../lib/library/index';
import { leftOutCount, libraryRoot, setShortestFiles, shortestFiles } from '../lib/media/library';
import { usePressed } from '../lib/theme/index';

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

  useFocusEffect(useCallback(() => {
    setFolder(libraryRoot());
    setLeftOut(countLeftOut());
    setShortest(shortestFiles());
    // Counted here and not kept anywhere, so the row is gone the moment the
    // last pair has been answered and this screen is come back to.
    try {
      setPairs(sameSongs().length);
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
        <Link href="/folders" asChild>
          <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{t.nav.libraryFolder}</Text>
              <Text style={styles.chevron} importantForAccessibility="no">›</Text>
            </View>
            <Text style={styles.muted}>{folder}</Text>
          </Pressable>
        </Link>
        <View style={styles.rule} />
        {/*
          Under the folder, since it narrows what the folder holds; and a
          page of its own, since it is a switch for every folder in it.
        */}
        <Link href="/left-out" asChild>
          <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{t.library.leftOut.title}</Text>
              <Text style={styles.chevron} importantForAccessibility="no">›</Text>
            </View>
            <Text style={styles.muted}>
              {leftOut > 0 ? t.library.leftOut.some(leftOut) : t.library.leftOut.none}
            </Text>
          </Pressable>
        </Link>
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
              <Text style={styles.chevron} importantForAccessibility="no">›</Text>
            </View>
          </View>
          <Text style={styles.muted}>{t.library.shortFiles.note}</Text>
        </Pressable>
        <View style={styles.rule} />
        <Link href="/metadata" asChild>
          <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{t.nav.tags}</Text>
              <Text style={styles.chevron} importantForAccessibility="no">›</Text>
            </View>
            <Text style={styles.muted}>{t.settings.tags.note}</Text>
          </Pressable>
        </Link>
        {/*
          Only there when there is something to decide. Most of the time
          there is not, and a row that opens an empty screen is a row
          somebody has to learn to ignore.
        */}
        {pairs > 0 ? (
          <>
            <View style={styles.rule} />
            <Link href="/samesongs" asChild>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.sameSong}</Text>
                  <Text style={styles.chevron} importantForAccessibility="no">›</Text>
                </View>
                <Text style={styles.muted}>{t.settings.sameSong.note(pairs)}</Text>
              </Pressable>
            </Link>
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
            <Link href="/duplicates" asChild>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.library.copies.title}</Text>
                  <Text style={styles.chevron} importantForAccessibility="no">›</Text>
                </View>
                <Text style={styles.muted}>{t.library.copies.some(copies)}</Text>
              </Pressable>
            </Link>
          </>
        ) : null}
        {/* The same, for files that may be another song altogether: there only while there are any. */}
        {wrong > 0 ? (
          <>
            <View style={styles.rule} />
            <Link href="/wrong-downloads" asChild>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.library.wrong.title}</Text>
                  <Text style={styles.chevron} importantForAccessibility="no">›</Text>
                </View>
                <Text style={styles.muted}>{t.library.wrong.some(wrong)}</Text>
              </Pressable>
            </Link>
          </>
        ) : null}
      </View>
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
