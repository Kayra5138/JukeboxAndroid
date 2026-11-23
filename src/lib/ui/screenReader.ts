import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether a screen reader is on, as it is turned on and off. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((now) => {
        if (live) setOn(now);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  return on;
}
