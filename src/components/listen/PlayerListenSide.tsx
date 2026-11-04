import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MinusIcon, PlusIcon, TickIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { dropListened, keepListened } from '../../lib/listen/index';
import { keptAs } from '../../lib/listen/kept';
import { isListened } from '../../lib/listen/rules';
import { usePlayerActions, usePlayerState } from '../../lib/player/PlayerProvider';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';

/**
 * Keep and let go, beside the name of a song listened to from the Search
 * tab and not kept, as a song of Discover's has them (`PlayerDiscoverSide`):
 * the plus copies it into the library, and a tick stands where it was for as
 * long as it plays; the minus takes it out of the queue, the next song on,
 * and lets its file go. Nothing for any other track.
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
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const { removeFromQueue } = usePlayerActions();
  const { currentIndex } = usePlayerState();
  const [busy, setBusy] = useState(false);
  // Kept here or anywhere else, by a heart or a list: read again as it is drawn, a look in a setting.
  const [keptNow, setKeptNow] = useState(false);
  if (!isListened(trackId)) return null;
  const kept = keptNow || keptAs(trackId) !== trackId;
  const box = small ? styles.sideSmall : styles.side;
  const slop = small ? 4 : 2;

  if (kept) {
    return side === 'keep' ? (
      <View accessible accessibilityRole="text" accessibilityLabel={t.discover.player.kept} style={box}>
        <TickIcon size={18} color={c.success} />
      </View>
    ) : (
      <View style={box} />
    );
  }

  if (side === 'drop') {
    return (
      <Pressable
        android_ripple={pressed}
        style={[box, styles.button]}
        hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={t.search.listenDrop}
        onPress={() => {
          haptic('results', 'reject');
          // Out of the queue first, the next song on, as the cross on its row does; then its file, no longer played from.
          void removeFromQueue(currentIndex).then(() => dropListened(trackId));
        }}>
        <MinusIcon size={18} />
      </Pressable>
    );
  }

  return (
    <Pressable
      android_ripple={pressed}
      style={[box, styles.button]}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={t.library.menu.keepListened.label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={() => {
        haptic('results', 'confirm');
        setBusy(true);
        void keepListened(trackId).then((done) => {
          setBusy(false);
          if (done) setKeptNow(true);
          else haptic('results', 'reject');
        });
      }}>
      {busy ? <ActivityIndicator size={16} color={c.textMuted} /> : <PlusIcon size={18} />}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // As Discover's are: the box of the player's own small buttons, filled, as something to press.
  side: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sideSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  button: { backgroundColor: c.surfaceRaised, ...outlined(c) },
}));
