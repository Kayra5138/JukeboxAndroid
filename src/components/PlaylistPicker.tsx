import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextPrompt } from './TextPrompt';
import { useUnderBars } from './UnderBars';
import {
  addToPlaylist,
  createPlaylist,
  removeFromPlaylist,
  playlistMembers,
  playlists,
  type Playlist,
} from '../lib/db/playlists';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { byRecent, recentFrom, usedNow } from '../lib/playlists/recent';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';
import { scrimOf } from '../lib/theme/Veil';
import { haptic } from '../lib/ui/haptics';

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
  /*
    On a tab in a theme of glass the tab bar is laid over the foot of the
    screen, and this is laid over the screen: it stands on the bar, where it
    always stood, and not under it.
  */
  const under = useUnderBars();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const [lists, setLists] = useState<Playlist[]>([]);
  /** How many of the tracks each list already holds, by its id. */
  const [held, setHeld] = useState<Map<number, number>>(new Map());
  const [naming, setNaming] = useState(false);

  /*
    Lists that follow a tag are left out. Their membership is the tag's answer,
    so there is nowhere for a track to be put -- offering them would be
    offering a row that cannot do anything. The way to get a track into one is
    to give it the tag.
  */
  useEffect(() => {
    if (!visible) return;
    /*
      The one last put into first, and so on back, as somebody adding song
      after song to the same few lists wants them; then the rest, as the
      Lists tab orders them.
    */
    const recent = recentFrom(readSetting(SETTINGS.listsRecent));
    // Nor Favorites, which has a button of its own, the heart, and an entry of its own in the menu.
    setLists(byRecent(playlists().filter((list) => list.tag == null && list.kind !== 'favorites'), recent));
    const wanted = new Set(trackIds);
    const counts = new Map<number, number>();
    for (const [id, members] of playlistMembers()) {
      const count = members.reduce((sum, member) => (wanted.has(member) ? sum + 1 : sum), 0);
      if (count > 0) counts.set(id, count);
    }
    setHeld(counts);
  }, [visible, trackIds]);

  const put = useCallback(
    (id: number, name: string) => {
      writeSetting(SETTINGS.listsRecent, JSON.stringify(usedNow(recentFrom(readSetting(SETTINGS.listsRecent)), id)));
      /*
        A list that holds every one of them already is a list to take them
        out of: the tick, pressed again, comes off. One that holds only some
        is given the rest.
      */
      if ((held.get(id) ?? 0) >= trackIds.length) {
        for (const trackId of trackIds) removeFromPlaylist(id, trackId, Date.now());
        haptic('choices', 'toggleOff');
        onClose();
        onAdded(t.lists.picker.removed(trackIds.length, name));
        return;
      }
      const added = addToPlaylist(id, trackIds, Date.now());
      haptic('results', added === 0 ? 'reject' : 'confirm');
      onClose();
      onAdded(added === 0 ? t.lists.picker.already(name) : t.lists.picker.added(added, name));
    },
    [trackIds, held, onClose, onAdded, t]
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
      {/* Named, for a screen reader: in a sheet drawn over the screen rather than in a window
          of its own, touching outside it is one of the ways out, and it has to be findable. */}
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel={t.common.close}
        onPress={onClose}
      />
      <View style={[styles.sheet, { bottom: under.bottom, paddingBottom: insets.bottom + 18 }]}>
        <Text accessibilityRole="header" style={styles.heading}>{t.format.upper(t.lists.picker.heading(trackIds.length))}</Text>

        <ScrollView style={styles.scroll}>
          {lists.map((list) => (
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              key={list.id}
              style={styles.row}
              accessibilityLabel={
                held.get(list.id)
                  ? `${list.name}, ${
                      held.get(list.id)! >= trackIds.length
                        ? t.lists.picker.inIt(trackIds.length)
                        : t.lists.picker.someInIt(held.get(list.id)!, trackIds.length)
                    }`
                  : list.name
              }
              onPress={() => put(list.id, list.name)}>
              {/*
                A box at the head of every row, ticked for a list that holds
                all of these already and half-ticked for one that holds some:
                the picker reads as a list of where they are, and a tick is the
                same in every language. A screen reader is told in words, on
                the row.
              */}
              <Mark state={!held.get(list.id) ? 'none' : held.get(list.id)! >= trackIds.length ? 'all' : 'some'} />
              <Text style={held.get(list.id) ? [styles.name, styles.nameIn] : styles.name} numberOfLines={1}>
                {list.name}
              </Text>
              {held.get(list.id) && held.get(list.id)! < trackIds.length ? (
                <Text style={styles.share} importantForAccessibility="no">
                  {`${t.format.number(held.get(list.id)!)}/${t.format.number(trackIds.length)}`}
                </Text>
              ) : null}
              <Text style={styles.count}>{t.format.number(list.trackCount)}</Text>
            </Pressable>
          ))}
          {lists.length === 0 ? (
            <Text style={styles.empty}>{t.lists.picker.noLists}</Text>
          ) : null}
        </ScrollView>

        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.create} onPress={() => setNaming(true)}>
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
  nameIn: { fontWeight: '600' },
  share: { color: c.accent, fontSize: 12.5, fontWeight: '600' },
  mark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  markNone: { borderWidth: 1.5, borderColor: c.textFaint },
  markAll: { backgroundColor: c.accent },
  markSome: { borderWidth: 1.5, borderColor: c.accent },
  tick: { color: c.onAccent, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  dash: { width: 10, height: 2, borderRadius: 1, backgroundColor: c.accent },
  count: { color: c.textFaint, fontSize: 12.5 },
  empty: { color: c.textFaint, fontSize: 13, paddingVertical: 12 },
  create: { paddingTop: 16, paddingBottom: 4 },
  createLabel: { color: c.accent, fontSize: 15 },
}));

/** The box at the head of a row: empty, ticked, or half-ticked for a list that holds some of what is being added. */
function Mark({ state }: { state: 'none' | 'some' | 'all' }) {
  const styles = useStyles();
  return (
    <View
      importantForAccessibility="no"
      style={[styles.mark, state === 'all' ? styles.markAll : state === 'some' ? styles.markSome : styles.markNone]}>
      {state === 'all' ? <Text style={styles.tick}>✓</Text> : state === 'some' ? <View style={styles.dash} /> : null}
    </View>
  );
}
