import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { isDiscoverTrack, NOT_FOR_DISCOVER } from './discover/show';
import { useDiscoverActions, useDiscoverTrack } from '../lib/discover/DiscoverProvider';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
import type { Track } from '../lib/types';

export type TrackAction =
  | 'playNext'
  | 'addToQueue'
  | 'addToPlaylist'
  | 'album'
  | 'tiles'
  | 'details'
  | 'delete';

/**
 * In the order the sheet shows them. What each says, and the line under it,
 * are `library.menu` in the string tables under these same words.
 */
const ACTIONS: readonly TrackAction[] = [
  'playNext',
  'addToQueue',
  'album',
  'addToPlaylist',
  'tiles',
  'details',
  'delete',
];

/**
 * Everything that can be done to one track, from a long press on its row.
 *
 * Any track, not only one out of the library: the play queue holds what the
 * player was handed, and its rows open this too.
 *
 * `hidden` is for the entries that would lead back to where the reader already
 * is — "go to album" on a row of that album's own page.
 *
 * A song of Discover's is such a track — the queue has them — and is not one
 * of the library's until it is kept. What goes by the library is left out
 * for it (see `NOT_FOR_DISCOVER`), and what can be done to a song of
 * Discover's is put in: keeping it, which is what makes the rest possible,
 * and turning it or its artist away.
 */
export function TrackMenu({
  track,
  hidden,
  onSelect,
  onClose,
}: {
  track: Track | null;
  hidden?: readonly TrackAction[];
  onSelect: (action: TrackAction, track: Track) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(track !== null);
  const discover = isDiscoverTrack(track?.id);
  return (
    <Modal
      visible={track !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {track ? (
          // Six actions and a heading are taller than a landscape screen, so the
          // sheet is bounded and scrolls rather than running off the bottom.
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>
                {track.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {track.artist ?? t.common.unknownArtist}
              </Text>
            </View>

            {ACTIONS.filter(
              // Only where there is a record to go to. A track whose album
              // nobody knows would lead to an empty screen.
              (action) =>
                !hidden?.includes(action) &&
                !(discover && (NOT_FOR_DISCOVER as readonly TrackAction[]).includes(action)) &&
                (action !== 'album' || Boolean(track.album?.trim()))
            ).map((action) => (
              <Pressable
                android_ripple={pressed}
                key={action}
                style={styles.action}
                onPress={() => onSelect(action, track)}>
                <Text style={action === 'delete' ? styles.destructive : styles.actionLabel}>
                  {t.library.menu[action].label}
                </Text>
                <Text style={styles.actionHint}>{t.library.menu[action].hint}</Text>
              </Pressable>
            ))}
            {discover ? <DiscoverEntries trackId={track.id} onDone={onClose} /> : null}
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/**
 * The entries a song of Discover's has in place of the library's.
 *
 * A part of its own, drawn only for such a track, so that it is the menu of
 * a Discover song that listens to Discover and not every screen that has a
 * menu. Nothing, for a song that has left the list since it was queued:
 * kept already, or one of a list that has been replaced.
 */
function DiscoverEntries({ trackId, onDone }: { trackId: string; onDone: () => void }) {
  const entry = useDiscoverTrack(trackId);
  const { keep, exclude, excludeArtist } = useDiscoverActions();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  if (!entry) return null;
  const said = t.discover.menu;
  const then = (act: (id: string) => void) => () => {
    onDone();
    act(entry.id);
  };
  return (
    <>
      <Pressable
        android_ripple={pressed}
        accessibilityState={{ disabled: entry.keeping }}
        disabled={entry.keeping}
        style={styles.action}
        onPress={then(keep)}>
        <Text style={styles.actionLabel}>{said.keep.label}</Text>
        <Text style={styles.actionHint}>{entry.keeping ? t.discover.row.keeping : said.keep.hint}</Text>
      </Pressable>
      <Pressable android_ripple={pressed} style={styles.action} onPress={then(exclude)}>
        <Text style={styles.actionLabel}>{said.exclude.label}</Text>
        <Text style={styles.actionHint}>{said.exclude.hint}</Text>
      </Pressable>
      <Pressable android_ripple={pressed} style={styles.action} onPress={then(excludeArtist)}>
        <Text style={styles.destructive} numberOfLines={1}>
          {said.neverArtist.label(entry.artist)}
        </Text>
        <Text style={styles.actionHint}>{said.neverArtist.hint}</Text>
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    flexGrow: 0,
    ...outlined(c),
  },
  sheetBody: { paddingBottom: 28 },
  header: {
    gap: 3,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '600' },
  artist: { color: c.textMuted, fontSize: 13 },
  action: { paddingHorizontal: 20, paddingVertical: 13, gap: 2 },
  actionLabel: { color: c.text, fontSize: 15 },
  destructive: { color: c.danger, fontSize: 15 },
  actionHint: { color: c.textFaint, fontSize: 12 },
}));
