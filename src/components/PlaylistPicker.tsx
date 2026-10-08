import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextPrompt } from './TextPrompt';
import {
  addToPlaylist,
  createPlaylist,
  playlists,
  type Playlist,
} from '../lib/db/playlists';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';
import { scrimOf } from '../lib/theme/Veil';

/**
 * Puts a run of tracks into a list.
 *
 * Takes track ids rather than tracks: everywhere this is opened from — one row
 * held down, a selection, the queue — already knows which ids it means, and the
 * list only ever stores ids anyway.
 *
 * Says how many were actually new rather than how many were sent. Adding an
 * album you half-added last week should report the half it added.
 */
export function PlaylistPicker({
  visible,
  trackIds,
  onClose,
  onAdded,
}: {
  visible: boolean;
  trackIds: string[];
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const [lists, setLists] = useState<Playlist[]>([]);
  const [naming, setNaming] = useState(false);

  /*
    Lists that follow a tag are left out. Their membership is the tag's answer,
    so there is nowhere for a track to be put -- offering them would be
    offering a row that cannot do anything. The way to get a track into one is
    to give it the tag.
  */
  useEffect(() => {
    if (visible) setLists(playlists().filter((list) => list.tag == null));
  }, [visible]);

  const put = useCallback(
    (id: number, name: string) => {
      const added = addToPlaylist(id, trackIds, Date.now());
      onClose();
      onAdded(added === 0 ? t.lists.picker.already(name) : t.lists.picker.added(added, name));
    },
    [trackIds, onClose, onAdded, t]
  );

  const create = useCallback(
    (name: string) => {
      setNaming(false);
      put(createPlaylist(name, Date.now()), name);
    },
    [put]
  );

  if (!visible && !naming) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <Text style={styles.heading}>{t.format.upper(t.lists.picker.heading(trackIds.length))}</Text>

        <ScrollView style={styles.scroll}>
          {lists.map((list) => (
            <Pressable
              android_ripple={pressed}
              key={list.id}
              style={styles.row}
              onPress={() => put(list.id, list.name)}>
              <Text style={styles.name} numberOfLines={1}>
                {list.name}
              </Text>
              <Text style={styles.count}>{t.format.number(list.trackCount)}</Text>
            </Pressable>
          ))}
          {lists.length === 0 ? (
            <Text style={styles.empty}>{t.lists.picker.noLists}</Text>
          ) : null}
        </ScrollView>

        <Pressable android_ripple={pressed} style={styles.create} onPress={() => setNaming(true)}>
          <Text style={styles.createLabel}>{t.lists.picker.newList}</Text>
        </Pressable>
      </View>

      <TextPrompt
        visible={naming}
        heading={t.lists.naming.heading}
        placeholder={t.lists.naming.placeholder}
        confirmLabel={t.lists.naming.create}
        onSubmit={create}
        onClose={() => setNaming(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimOf(c) },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
    ...outlined(c),
  },
  heading: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    paddingBottom: 10,
  },
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  name: { color: c.text, fontSize: 15, flex: 1, minWidth: 0 },
  count: { color: c.textFaint, fontSize: 12.5 },
  empty: { color: c.textFaint, fontSize: 13, paddingVertical: 12 },
  create: { paddingTop: 16, paddingBottom: 4 },
  createLabel: { color: c.accent, fontSize: 15 },
}));
