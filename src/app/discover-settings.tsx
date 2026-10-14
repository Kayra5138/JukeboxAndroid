import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverSettings } from '../components/DiscoverSettings';
import { makeStyles, scene } from '../lib/theme/index';

/**
 * Discover's settings on a screen of their own, opened from the gear over
 * the list and from a row in Settings.
 *
 * They were a card in Settings once, a long way down it, and that was the
 * only way to them: to keep five songs ready in place of three meant leaving
 * the list, finding the card and coming back.
 */
export default function DiscoverSettingsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right, paddingBottom: 32 + insets.bottom },
        ]}>
        <DiscoverSettings standalone />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { paddingTop: 12 },
}));
