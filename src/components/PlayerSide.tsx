import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Busy } from './Busy';
import { TickIcon } from './Icons';
import { Pressable } from './Pressable';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { RADIUS, TOUCH } from '../lib/theme/measures';

/*
  Keep and let go, at the two ends of the song's name in the player, for a
  song that is not the library's yet: one of Discover's (`PlayerDiscoverSide`)
  or one listened to from the Search tab (`PlayerListenSide`). The two drew
  the same boxes, each its own copy.

  The box the player's own small buttons have, 44 or, on its side where the
  player draws everything a sixth smaller, 40; reaching a little further is
  the 48 a finger is owed, without the name beside it giving up any room.
*/

/** A thing to do, drawn as something to press: filled, where the player's signs are bare. [busy] while it is being done. */
export function SideButton({
  small = false,
  label,
  busy = false,
  onPress,
  children,
}: {
  small?: boolean;
  label: string;
  busy?: boolean;
  onPress: () => void;
  /** Its mark. */
  children: ReactNode;
}) {
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      android_ripple={pressed}
      style={[small ? styles.small : styles.normal, styles.button]}
      hitSlop={small ? 4 : 2}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}>
      {busy ? <Busy size={16} color={c.textMuted} /> : children}
    </Pressable>
  );
}

/**
 * Kept: a tick where the button to keep it was, for as long as the song
 * plays; or, at the other end ([label] left out), its room kept and nothing
 * in it, so that the name stays where it was.
 */
export function SideKept({ small = false, label }: { small?: boolean; label?: string }) {
  const c = useColours();
  const styles = useStyles();
  const box = small ? styles.small : styles.normal;
  if (!label) return <View style={box} />;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={box}>
      <TickIcon size={18} color={c.success} />
    </View>
  );
}

/** On its side, a sixth smaller as the player draws everything then. */
const SMALL = Math.round(TOUCH.normal * 0.9);

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    normal: { width: TOUCH.normal, height: TOUCH.normal, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
    small: { width: SMALL, height: SMALL, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
    button: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  })
);
