import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { useWrongDownloads } from '../lib/library/wrongDownloadsStore';
import { makeStyles, usePressed } from '../lib/theme/index';

/**
 * The line on the Library tab that says some downloads may be the wrong song,
 * and opens the screen where they are put right.
 *
 * Small writing and not a card, as the line about copies is: nothing has
 * been changed and nothing has to be done today. But it is said where the
 * library is, because a song that is another song is heard there, and a row
 * in Settings is not where anybody looks for that. Its own and not part of
 * the newcomer's offers and tips, which come and go on their own terms; and
 * only once the device has said what the library holds, so that a file
 * deleted since the last run is not counted.
 */
export function WrongDownloadsLine({ confirmed }: { confirmed: boolean }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const router = useRouter();
  const count = useWrongDownloads().length;
  if (!confirmed || count === 0) return null;
  const said = t.library.wrong;
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityLabel={said.some(count)}
      accessibilityHint={said.reviewHint}
      hitSlop={8}
      style={styles.line}
      onPress={() => router.push('/wrong-downloads')}>
      <Text style={styles.text} numberOfLines={2}>
        {said.some(count)}
        {' · '}
        <Text style={styles.link}>{said.review}</Text>
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  line: { paddingVertical: 2, borderRadius: 6 },
  text: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  link: { color: c.accent, fontWeight: '600' },
}));
