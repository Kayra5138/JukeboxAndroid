import { useCallback, useMemo, useState } from 'react';
import { Image } from './Picture';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from './SearchField';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import { search } from '../lib/media/search';
import type { EnrichedTrack } from '../lib/media/merge';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';
import { scrimOf } from '../lib/theme/Veil';

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
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
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
          <Text style={styles.heading}>{t.lists.trackPicker.heading}</Text>
          <Pressable onPress={close}>
            <Text style={styles.link}>{t.common.done}</Text>
          </Pressable>
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t.lists.trackPicker.search}
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
            <Text style={styles.empty}>{t.library.nothingMatches(query)}</Text>
          }
        />

        <Pressable
          android_ripple={pressed}
          style={[styles.action, chosen.size === 0 && styles.actionOff]}
          disabled={chosen.size === 0}
          onPress={() => {
            onAdd([...chosen]);
            // The sheet stays open. Building a list is several searches, and
            // closing after each one would mean reopening for the next.
            setChosen(new Set());
            setQuery('');
          }}>
          <Text style={styles.actionLabel}>{t.lists.trackPicker.add(chosen.size)}</Text>
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
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();

  return (
    <Pressable android_ripple={pressed} style={styles.row} onPress={onPress} disabled={held}>
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
          {held ? t.lists.trackPicker.alreadyHere : (track.artist ?? t.common.unknownArtist)}
        </Text>
      </View>
      <View style={[styles.tick, (ticked || held) && styles.tickOn, held && styles.tickHeld]}>
        {ticked || held ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: scrimOf(c),
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '85%',
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 18,
    gap: 12,
    ...outlined(c),
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: c.text, fontSize: 16, fontWeight: '600' },
  link: { color: c.accent, fontSize: 14.5 },
  list: { flex: 1 },
  empty: { color: c.textFaint, fontSize: 13, paddingVertical: 18, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  art: { width: 42, height: 42, borderRadius: 6 },
  artEmpty: { backgroundColor: c.surfaceRaised },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: 14.5 },
  dim: { color: c.textMuted },
  artist: { color: c.textFaint, fontSize: 12 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: c.accent, borderColor: c.accent },
  tickHeld: { backgroundColor: c.borderStrong, borderColor: c.borderStrong },
  dot: { width: 9, height: 9, borderRadius: 2, backgroundColor: c.onAccent },

  action: {
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: 11,
    paddingVertical: 12,
    ...outlined(c, c.primary),
  },
  actionOff: { opacity: 0.35 },
  actionLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
}));
