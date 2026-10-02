import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextPrompt } from './TextPrompt';
import {
  addToPlaylist,
  createPlaylist,
  playlists,
  type Playlist,
} from '../lib/db/playlists';

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
      onAdded(
        added === 0
          ? `Already in ${name}`
          : `${added} ${added === 1 ? 'track' : 'tracks'} added to ${name}`
      );
    },
    [trackIds, onClose, onAdded]
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
        <Text style={styles.heading}>
          Add {trackIds.length} {trackIds.length === 1 ? 'track' : 'tracks'} to
        </Text>

        <ScrollView style={styles.scroll}>
          {lists.map((list) => (
            <Pressable
              key={list.id}
              style={styles.row}
              onPress={() => put(list.id, list.name)}>
              <Text style={styles.name} numberOfLines={1}>
                {list.name}
              </Text>
              <Text style={styles.count}>{list.trackCount}</Text>
            </Pressable>
          ))}
          {lists.length === 0 ? (
            <Text style={styles.empty}>No lists yet.</Text>
          ) : null}
        </ScrollView>

        <Pressable style={styles.create} onPress={() => setNaming(true)}>
          <Text style={styles.createLabel}>New list…</Text>
        </Pressable>
      </View>

      <TextPrompt
        visible={naming}
        heading="Name the list"
        placeholder="List name"
        confirmLabel="Create"
        onSubmit={create}
        onClose={() => setNaming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000cc' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  heading: {
    color: '#8a8a8a',
    fontSize: 12,
    textTransform: 'uppercase',
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
    borderBottomColor: '#242424',
  },
  name: { color: '#ededed', fontSize: 15, flex: 1, minWidth: 0 },
  count: { color: '#5f5f5f', fontSize: 12.5 },
  empty: { color: '#6a6a6a', fontSize: 13, paddingVertical: 12 },
  create: { paddingTop: 16, paddingBottom: 4 },
  createLabel: { color: '#7ab8ff', fontSize: 15 },
});
