import { AccessibilityInfo, AppState, Platform } from 'react-native';

/*
  How long somebody has asked Android to be given to act on something that
  goes away by itself: Settings › Accessibility › Time to take action. Read
  as the app starts and each time it comes back to the front, where it may
  have been changed; nought where nothing was asked for.
*/
let asked = 0;

function read(): void {
  if (Platform.OS !== 'android') return;
  // Asked of nought, the answer is what was set, or nought.
  void AccessibilityInfo.getRecommendedTimeoutMillis(0)
    .then((ms) => {
      asked = Number.isFinite(ms) && ms > 0 ? ms : 0;
    })
    .catch(() => {});
}

let watching = false;

/** Starts keeping [actionTime] up to date. */
export function watchActionTime(): void {
  if (watching) return;
  watching = true;
  read();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') read();
  });
}

/** [ms], or longer where somebody has asked Android for more time to act. */
export function actionTime(ms: number): number {
  return Math.max(ms, asked);
}
