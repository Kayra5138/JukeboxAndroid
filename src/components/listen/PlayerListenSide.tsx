import { useState } from 'react';

import { MinusIcon, PlusIcon } from '../Icons';
import { SideButton, SideKept } from '../PlayerSide';
import { useT } from '../../lib/i18n/index';
import { dropListened, keepListened } from '../../lib/listen/index';
import { keptAs } from '../../lib/listen/kept';
import { isListened } from '../../lib/listen/rules';
import { usePlayerActions, usePlayerState } from '../../lib/player/PlayerProvider';
import { haptic } from '../../lib/ui/haptics';
import { offerUndo } from '../../lib/ui/undo';

/**
 * Keep and let go, beside the name of a song listened to from the Search
 * tab and not kept, as a song of Discover's has them (`PlayerDiscoverSide`):
 * the plus copies it into the library, and a tick stands where it was for as
 * long as it plays; the minus takes it out of the queue, the next song on,
 * and lets its file go. Nothing for any other track.
 *
 * Drawn under the song's id (`key`): what it holds is the one song's, and
 * drawn on for the next, the tick of one kept stood on the next as well, and
 * that one, with no plus to keep it, went when its days ran out.
 */
export function PlayerListenSide({
  trackId,
  side,
  small = false,
}: {
  trackId: string;
  side: 'keep' | 'drop';
  /** On its side the player draws everything a sixth smaller. */
  small?: boolean;
}) {
  const t = useT();
  const { removeFromQueue, playNext, next } = usePlayerActions();
  const { currentIndex, current } = usePlayerState();
  const [busy, setBusy] = useState(false);
  // Kept here or anywhere else, by a heart or a list: read again as it is drawn, a look in a setting.
  const [keptNow, setKeptNow] = useState(false);
  if (!isListened(trackId)) return null;
  const kept = keptNow || keptAs(trackId) !== trackId;
  if (kept) return <SideKept small={small} label={side === 'keep' ? t.discover.player.kept : undefined} />;

  if (side === 'drop') {
    return (
      <SideButton
        small={small}
        label={t.search.listenDrop}
        onPress={() => {
          haptic('results', 'reject');
          // Out of the queue first, the next song on, as the cross on its row does; then its file, no longer played from:
          // but not until the offer of it back has run out (`lib/ui/undo.ts`), the file being the one thing that cannot be had back.
          const track = current;
          void removeFromQueue(currentIndex).then(() =>
            offerUndo(
              t.common.undone.letGo(track?.title ?? ''),
              () => {
                if (!track) return;
                // Back in the queue where it was, and playing again.
                void playNext(track).then(() => next());
              },
              () => void dropListened(trackId)
            )
          );
        }}>
        <MinusIcon size={18} />
      </SideButton>
    );
  }

  return (
    <SideButton
      small={small}
      label={t.library.menu.keepListened.label}
      busy={busy}
      onPress={() => {
        haptic('results', 'confirm');
        setBusy(true);
        void keepListened(trackId).then((done) => {
          setBusy(false);
          if (done) setKeptNow(true);
          else haptic('results', 'reject');
        });
      }}>
      <PlusIcon size={18} />
    </SideButton>
  );
}
