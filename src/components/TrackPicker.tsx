import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from './SearchField';
import { useTrackArtwork } from '../lib/media/artwork';
import { search } from '../lib/media/search';
import type { EnrichedTrack } from '../lib/media/merge';

const ACCENT = '#7ab8ff';

/**
 * Picking tracks out of the library to put somewhere.
 *
 * Opened from a list, which is the other half of adding to one: the library
 * screen can send a track to a list, and this lets a list go and fetch them —
 * which is what somebody who has just made an empty list is trying to do, and
 * who would otherwise have to leave it, find each track, and come back.
 *
 * Several at once, because that is how a list gets made. Tracks already in it
 * are shown and marked rather than hidden: a list of search results with
 * silent gaps in it looks like a broken search.
 */
export function TrackPicker({
  visible,
  library,
  already,
  onClose,
  onAdd,
}: {
  visible: boolean;
  library: EnrichedTrack[];
  /** Ids the list already holds, shown ticked and not counted again. */
  already: Set<string>;
  onClose: () => void;
  onAdd: (trackIds: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const results = useMemo(() => search(library, query).tracks, [library, query]);

  const toggle = useCallback((id: string) => {
    setChosen((held) => {
      const next = new Set(held);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setQuery('');
    setChosen(new Set());
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={styles.layer}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.head}>
          <Text style={styles.heading}>Add tracks</Text>
          <Pressable onPress={close}>
            <Text style={styles.link}>Done</Text>
          </Pressable>
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search the library"
        />

        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(track) => track.id}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          renderItem={({ item }) => (
            <Row
              track={item}
              held={already.has(item.id)}
              ticked={chosen.has(item.id)}
              onPress={() => toggle(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing matches “{query}”.</Text>
          }
        />

        <Pressable
          style={[styles.action, chosen.size === 0 && styles.actionOff]}
          disabled={chosen.size === 0}
          onPress={() => {
            onAdd([...chosen]);
            // The sheet stays open. Building a list is several searches, and
            // closing after each one would mean reopening for the next.
            setChosen(new Set());
            setQuery('');
          }}>
          <Text style={styles.actionLabel}>
            Add {chosen.size} {chosen.size === 1 ? 'track' : 'tracks'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  track,
  held,
  ticked,
  onPress,
}: {
  track: EnrichedTrack;
  held: boolean;
  ticked: boolean;
  onPress: () => void;
}) {
  const artwork = useTrackArtwork(track);

  return (
    <Pressable style={styles.row} onPress={onPress} disabled={held}>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" />
      ) : (
        <View style={[styles.art, styles.artEmpty]} />
      )}
      <View style={styles.text}>
        <Text style={[styles.title, held && styles.dim]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {held ? 'Already in this list' : (track.artist ?? 'Unknown artist')}
        </Text>
      </View>
      <View style={[styles.tick, (ticked || held) && styles.tickOn, held && styles.tickHeld]}>
        {ticked || held ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000cc',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '85%',
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: '#ededed', fontSize: 16, fontWeight: '600' },
  link: { color: ACCENT, fontSize: 14.5 },
  list: { flex: 1 },
  empty: { color: '#6a6a6a', fontSize: 13, paddingVertical: 18, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  art: { width: 42, height: 42, borderRadius: 6 },
  artEmpty: { backgroundColor: '#262626' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: '#ededed', fontSize: 14.5 },
  dim: { color: '#7a7a7a' },
  artist: { color: '#6a6a6a', fontSize: 12 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#4a4a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  tickHeld: { backgroundColor: '#3a3a3a', borderColor: '#3a3a3a' },
  dot: { width: 9, height: 9, borderRadius: 2, backgroundColor: '#121212' },

  action: {
    alignItems: 'center',
    backgroundColor: '#ededed',
    borderRadius: 11,
    paddingVertical: 12,
  },
  actionOff: { opacity: 0.35 },
  actionLabel: { color: '#121212', fontSize: 15, fontWeight: '600' },
});
