import { useCallback, useSyncExternalStore } from 'react';

import { db, readSetting, SETTINGS, writeSetting } from '../db/index';
import { createTips, type Tip } from './tips';

/**
 * The newcomer's tips, with the settings table behind them. What decides who
 * sees one, and when, is in `tips.ts`.
 */
const tips = createTips({
  read: () => readSetting(SETTINGS.tips),
  write: (words) => writeSetting(SETTINGS.tips, words),
  listened: () => {
    const row = db().getFirstSync<{ n: number }>(
      'SELECT (SELECT COUNT(*) FROM plays) + (SELECT COUNT(*) FROM skips) AS n'
    );
    return Number(row?.n ?? 0);
  },
});

/*
  Not asked until something is subscribed and drawn, which is after the
  database has been opened by the screens anyway: the first asking may decide,
  and deciding is a count of the history.
*/
const shows = (tip: Tip) => {
  try {
    return tips.shows(tip);
  } catch {
    return false;
  }
};

/** Whether [tip] is to be shown now, and the one tap that puts it away. */
export function useTip(tip: Tip): { shown: boolean; dismiss: () => void } {
  const shown = useSyncExternalStore(tips.subscribe, () => shows(tip));
  const dismiss = useCallback(() => tips.dismiss(tip), [tip]);
  return { shown, dismiss };
}

/** Every tip once more, from Settings. */
export function showTipsAgain(): void {
  tips.again();
}
