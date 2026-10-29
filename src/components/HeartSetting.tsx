import { StyleSheet, Text, View } from 'react-native';
import { Switch } from './Switch';

import { useT } from '../lib/i18n/index';
import { makeStyles, switchColours, useColours } from '../lib/theme/index';
import { setFavoritesShown, useFavoritesShown } from '../lib/playlists/favorites';

/**
 * Favorites, on or off: the list among the lists, the heart on the player
 * that fills it, and the menu's entry for it, all at once. Off, what is in
 * the list stays in it for when it comes back.
 */
export function FavoritesSetting() {
  const shown = useFavoritesShown();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{t.settings.favoritesShown.title}</Text>
        <Switch
          value={shown}
          accessibilityLabel={t.settings.favoritesShown.title}
          onValueChange={setFavoritesShown}
          {...switchColours(c, shown)}
        />
      </View>
      <Text style={styles.muted}>{t.settings.favoritesShown.note}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  })
);
