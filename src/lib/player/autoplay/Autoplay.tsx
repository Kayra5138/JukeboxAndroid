import { useEffect } from 'react';

import JukeboxAudio from '../../../../modules/jukebox-audio/index.ts';
import { subscribeDiscover } from '../../discover/engine';
import { usePlayerActions, usePlayerState } from '../PlayerProvider';
import {
  attachAutoplay, autoplayDiscoverChanged, autoplayPlayerChanged, autoplayQueueEnded, autoplaySleepChanged, autoplayTrackChanged,
} from './controller';

/**
 * Joins the keeping-going of the music to the player.
 *
 * Draws nothing and decides nothing: what the player is doing is told to the
 * controller, and what the controller wants of the player is done through the
 * player's own actions. The same shape as `DiscoverProvider`, and for the
 * same reason — this is how a component's view of the player reaches code
 * that is not a component, and it goes on reaching it with the screen off.
 */
export function Autoplay() {
  const { queue, currentIndex, repeat, autoFrom, autoDismissed, keepSimilar, queueId, onLoan } = usePlayerState();
  const { appendAuto, skipToIndex } = usePlayerActions();

  useEffect(() => {
    autoplayPlayerChanged({ queue, queueId, currentIndex, repeat, autoFrom, dismissed: autoDismissed, similar: keepSimilar, onLoan });
  }, [queue, queueId, currentIndex, repeat, autoFrom, autoDismissed, keepSimilar, onLoan]);

  useEffect(() => {
    const detach = attachAutoplay({
      append: appendAuto,
      playFrom: async (index) => {
        await skipToIndex(index);
        await JukeboxAudio.playAsync().catch((failure: unknown) => console.warn('The player would not play on', failure));
      },
    });
    // Heard here as well as by the player's provider, which only notes that the music stopped.
    const ended = JukeboxAudio.addListener('onQueueEnded', autoplayQueueEnded);
    const changed = JukeboxAudio.addListener('onTrackChange', autoplayTrackChanged);
    // The sleep timer, so that the end of the queue it caused is not taken for the queue running out.
    const slept = JukeboxAudio.addListener('onSleepTimerChange', autoplaySleepChanged);
    void JukeboxAudio.getSleepTimerAsync?.().then(autoplaySleepChanged).catch(() => {});
    const unsubscribe = subscribeDiscover(autoplayDiscoverChanged);
    return () => {
      unsubscribe();
      slept.remove();
      changed.remove();
      ended.remove();
      detach();
    };
  }, [appendAuto, skipToIndex]);

  return null;
}
