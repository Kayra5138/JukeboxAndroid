import { SwitchRow } from './settings/rows';

import { useT } from '../lib/i18n/index';
import { setFavoritesShown, useFavoritesShown } from '../lib/playlists/favorites';

/**
 * Favorites, on or off: the list among the lists, the heart on the player
 * that fills it, and the menu's entry for it, all at once. Off, what is in
 * the list stays in it for when it comes back.
 */
export function FavoritesSetting() {
  const shown = useFavoritesShown();
  const t = useT();
  return (
    <SwitchRow
      title={t.settings.favoritesShown.title}
      hint={t.settings.favoritesShown.note}
      value={shown}
      onChange={setFavoritesShown}
    />
  );
}
