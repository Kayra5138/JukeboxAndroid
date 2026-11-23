import { SwitchRow } from './settings/rows';

import { useT } from '../lib/i18n/index';
import { setListButtonWanted, useListButtonWanted } from '../lib/ui/listButton';

/** A row of the player's settings: whether the player has its add-to-list button. */
export function ListButtonSetting() {
  const wanted = useListButtonWanted();
  const t = useT();
  return (
    <SwitchRow
      title={t.settings.listButton.title}
      hint={t.settings.listButton.note}
      value={wanted}
      onChange={setListButtonWanted}
    />
  );
}
