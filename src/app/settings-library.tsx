import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';

import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import { useT } from '../lib/i18n/index';
import { sameSongs } from '../lib/identity/index';
import { libraryRoot } from '../lib/media/library';
import { usePressed } from '../lib/theme/index';

/**
 * Where the music is and what is written in it: the folder, the tags, and
 * the files that may be one song under two names.
 *
 * The rows are the ones that were on the Settings tab, as they were.
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

  useFocusEffect(useCallback(() => {
    setFolder(libraryRoot());
    // Counted here and not kept anywhere, so the row is gone the moment the
    // last pair has been answered and this screen is come back to.
    try {
      setPairs(sameSongs().length);
    } catch {
      setPairs(0);
    }
  }, []));

  return (
    <SettingsPage>
      <View style={styles.card}>
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
        <Link href="/metadata" asChild>
          <Pressable android_ripple={pressed} style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{t.nav.tags}</Text>
              <Text style={styles.chevron}>›</Text>
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
              <Pressable android_ripple={pressed} style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.nav.sameSong}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.muted}>{t.settings.sameSong.note(pairs)}</Text>
              </Pressable>
            </Link>
          </>
        ) : null}
      </View>
    </SettingsPage>
  );
}
