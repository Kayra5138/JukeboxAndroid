import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AlertIcon, MinusIcon, PlusIcon, TickIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { useDiscoverNotice } from './hooks';
import { noticeAbout } from './show';
import { useDiscoverActions, useDiscoverTrack, type DiscoverEntryView } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';

/**
 * Keep and exclude where a song is heard.
 *
 * A song of Discover's is judged while it plays, and that is in the player
 * or with the bar of what is playing at the foot of some other screen. The
 * two things to say about it were on its row in the list, which meant
 * leaving the player, going to Search, finding the row and pressing there.
 *
 * Everything here is a small part of its own that listens for the one song,
 * and draws nothing at all for a track that is not Discover's. The player
 * and the bar hand it the playing track's id and know nothing more about it.
 */

type Playing = {
  /** The song of the list that is playing, or null: it is not one, or no longer. */
  entry: DiscoverEntryView | null;
  /** It was one, and has been kept: said in place of the buttons for as long as it plays. */
  kept: boolean;
  /** A keep of it that failed, in words. */
  failed: string | null;
};

/**
 * What there is to offer about the track the player has on.
 *
 * A song that is kept leaves the list at once and is then, as far as the
 * list goes, any other track: the buttons go. That it was kept is said by a
 * notice, which names the song by the list's id for it and not the file's,
 * and is gone in six seconds — so the song this file was is remembered, the
 * notice matched to it, and the answer held for as long as the track plays.
 * Buttons that vanished and left nothing would read as the press having
 * been lost; a tick that vanished six seconds later would shift the name
 * beside it for no reason anybody pressed for.
 */
function usePlaying(trackId: string): Playing {
  const entry = useDiscoverTrack(trackId);
  const notice = useDiscoverNotice();
  const [seen, setSeen] = useState<{ trackId: string; id: string; kept: boolean } | null>(null);

  let now = seen && seen.trackId === trackId ? seen : null;
  if (entry && now?.id !== entry.id) {
    now = { trackId, id: entry.id, kept: false };
    setSeen(now);
  } else if (now && !now.kept && !entry && noticeAbout(notice, now.id)?.kind === 'kept') {
    now = { ...now, kept: true };
    setSeen(now);
  }

  const about = noticeAbout(notice, entry?.id ?? null);
  return {
    entry,
    kept: !entry && !!now?.kept,
    failed: (about?.kind === 'keepFailed' && about.text) || null,
  };
}

/**
 * One of the two buttons in the player: keep at the left of the song's name
 * and exclude at its right.
 *
 * Beside the name, in the height the name already has, and not on a line of
 * their own. The player works out once how tall its queue may be pulled,
 * from what is left under its controls, and a line that came with one song
 * and went with the next would leave that figure wrong for every song after.
 * Here they take width from the title, which only shortens it.
 *
 * Both sides keep their room while either has something in it, so the name
 * between them stays in the middle. For any other track neither is there
 * and the name has the whole width, as it always had.
 *
 * Drawn alike, as the round buttons of the player are, and told apart by
 * the sign on them: the plus and the minus a row of the list has.
 */
export function PlayerDiscoverSide({
  trackId,
  side,
  small = false,
}: {
  trackId: string;
  side: 'keep' | 'exclude';
  /** On its side the player draws everything a sixth smaller, and the name is not as tall. */
  small?: boolean;
}) {
  const { entry, kept, failed } = usePlaying(trackId);
  const { keep, exclude } = useDiscoverActions();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover;
  if (!entry && !kept) return null;
  const box = small ? styles.sideSmall : styles.side;

  if (!entry) {
    // Kept: a tick where the button was, for as long as the song plays, and its room kept at the other end.
    return side === 'keep' ? (
      <View accessible accessibilityRole="text" accessibilityLabel={said.player.kept} style={box}>
        <TickIcon size={18} color={c.success} />
      </View>
    ) : (
      <View style={box} />
    );
  }

  if (side === 'exclude') {
    return (
      <Pressable
        android_ripple={pressed}
        style={[box, styles.button]}
        accessibilityRole="button"
        accessibilityLabel={said.row.exclude}
        onPress={() => exclude(entry.id)}>
        <MinusIcon size={18} />
      </Pressable>
    );
  }

  const keeping = entry.keeping;
  return (
    <Pressable
      android_ripple={pressed}
      style={[box, styles.button]}
      accessibilityRole="button"
      // A keep that failed is said here, where it was asked for; pressing again is trying again.
      accessibilityLabel={failed ?? said.row.keep}
      accessibilityState={{ busy: keeping, disabled: keeping }}
      disabled={keeping}
      onPress={() => keep(entry.id)}>
      {keeping ? (
        <ActivityIndicator size={16} color={c.textMuted} />
      ) : failed ? (
        <AlertIcon size={18} color={c.danger} />
      ) : (
        <PlusIcon size={18} />
      )}
    </Pressable>
  );
}

/**
 * The way to take back a song just turned away, with the player's small
 * buttons for the ten seconds it is offered.
 *
 * Not beside the name: the song that was excluded has given way to the
 * next by then, and the name is the next one's.
 */
export function PlayerDiscoverUndo() {
  const notice = useDiscoverNotice();
  const { undo } = useDiscoverActions();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  if (!notice || notice.kind !== 'excluded' || !notice.canUndo) return null;
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      // Which song, for somebody who cannot see that the one playing has changed.
      accessibilityLabel={`${notice.text} ${t.discover.notice.undo}`}
      style={styles.undo}
      onPress={undo}>
      <Text style={styles.undoLabel}>{t.discover.notice.undo}</Text>
    </Pressable>
  );
}

/**
 * Keep, on the bar of what is playing: one small button with the bar's
 * others, for a song liked while looking at something else. Excluding is
 * left to the player, a tap away: a bar that could throw away what is
 * playing at the brush of a thumb is not one to scroll a list above.
 */
export function PlayingKeep({
  trackId,
  style,
  hitSlop,
}: {
  trackId: string;
  /** The bar's own style for one of its controls, so this is one of them. */
  style: object;
  hitSlop: { top: number; bottom: number; left: number; right: number };
}) {
  const { entry, kept } = usePlaying(trackId);
  const { keep } = useDiscoverActions();
  const t = useT();
  const c = useColours();
  const pressed = usePressed();
  if (kept) {
    return (
      <View accessible accessibilityLabel={t.discover.player.kept} style={style}>
        <TickIcon size={18} color={c.success} />
      </View>
    );
  }
  if (!entry) return null;
  return (
    <Pressable
      android_ripple={pressed}
      style={style}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={t.discover.row.keep}
      accessibilityState={{ busy: entry.keeping, disabled: entry.keeping }}
      disabled={entry.keeping}
      onPress={() => keep(entry.id)}>
      {entry.keeping ? <ActivityIndicator size={16} color={c.textMuted} /> : <PlusIcon size={18} />}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // The box the player's own small buttons have, so these are two more of them.
  side: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sideSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  /*
    Filled, where those are bare. A bare sign is a state, lit or not; these
    are things to do, and are drawn as something to press.
  */
  button: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  undo: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  undoLabel: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
}));
