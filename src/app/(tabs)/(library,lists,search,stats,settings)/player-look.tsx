import { LookSettings } from '../../../components/PlayerSettings';
import { SettingsPage } from '../../../components/settings/rows';

/**
 * How the player looks: what stands where the cover is, for songs and for
 * tapes, what moves with the music round it, and a knock on the beat.
 * Opened from Settings → Look & feel, under the theme; the player has the
 * same as a tab of its own card of settings (`PlayerPanel`).
 */
export default function PlayerLookScreen() {
  return (
    <SettingsPage>
      <LookSettings />
    </SettingsPage>
  );
}
