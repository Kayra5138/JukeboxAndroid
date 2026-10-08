import { useCallback, useEffect, useState } from 'react';

import JukeboxAudio, {
  type SleepTimer,
  type SleepTimerRequest,
} from '../../../modules/jukebox-audio/index.ts';
import { SLEEP_OFF } from './sleep.ts';

/** How long after its end a timer is given to report before it is asked. */
const OVERDUE_MS = 1_500;

/**
 * The sleep timer the playback service is keeping, and the time by which to
 * count it down.
 *
 * Read when [enabled] becomes true and then listened for, so nothing crosses
 * the bridge while it runs: the service says when the timer changes, and the
 * seconds in between are a clock ticking here. That clock only runs while
 * there is a moment to count towards and somebody looking.
 *
 * Every call is optional, the way the rest of the module's newer calls are. A
 * native build from before the timer has none of them, and then this reports
 * `supported` false and a timer that is off, which is the truth.
 */
export function useSleepTimer(enabled = true) {
  const [timer, setTimer] = useState<SleepTimer>(SLEEP_OFF);
  const [now, setNow] = useState(() => Date.now());
  const supported = typeof JukeboxAudio.setSleepTimerAsync === 'function';

  useEffect(() => {
    if (!enabled || !supported) return;
    let wanted = true;
    void JukeboxAudio.getSleepTimerAsync?.()
      .then((current) => {
        if (wanted) setTimer(current);
      })
      .catch(() => {});
    const changed = JukeboxAudio.addListener('onSleepTimerChange', setTimer);
    return () => {
      wanted = false;
      changed.remove();
    };
  }, [enabled, supported]);

  const endsAt = timer.endsAt;
  useEffect(() => {
    if (!enabled || endsAt === null) return;
    setNow(Date.now());
    const ticking = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(ticking);
  }, [enabled, endsAt]);

  /*
    A timer still showing nothing left well after its end is one whose news
    was missed. Asked once, when it becomes so: the service is the only thing
    that knows whether it fired, cleared, or is waiting for a track.
  */
  const overdue = enabled && endsAt !== null && now >= endsAt + OVERDUE_MS;
  useEffect(() => {
    if (!overdue) return;
    void JukeboxAudio.getSleepTimerAsync?.()
      .then(setTimer)
      .catch(() => {});
  }, [overdue]);

  const start = useCallback(async (request: SleepTimerRequest) => {
    try {
      const set = await JukeboxAudio.setSleepTimerAsync?.(request);
      if (set) setTimer(set);
    } catch (failure) {
      // Nothing was set, and the timer on screen still says what there is.
      // Said in the log, so that a timer that will not start has a reason.
      console.warn('The sleep timer could not be set', failure);
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      const left = await JukeboxAudio.cancelSleepTimerAsync?.();
      if (left) setTimer(left);
    } catch {
      // As above: whatever is running is still what is shown.
    }
  }, []);

  return { timer, now, supported, start, cancel };
}
