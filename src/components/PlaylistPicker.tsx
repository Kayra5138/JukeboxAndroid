import { useCallback, useEffect, useState } from 'react';
import { LEADING, SPACE, TYPE, RADIUS } from '../lib/theme/measures';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { TextPrompt } from './TextPrompt';
import { MenuPage } from './MenuPage';
import {
  addToPlaylist,
  createPlaylist,
  removeFromPlaylist,
  playlistMembers,
  playlists,
  type Playlist,
} from '../lib/db/playlists';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { favorites, favoritesShown } from '../lib/playlists/favorites';
import { byRecent, recentFrom, usedNow } from '../lib/playlists/recent';
import { useT } from '../lib/i18n/index';
import { makeStyles, usePressed } from '../lib/theme/index';
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
  withFavorites = false,
}: {
  visible: boolean;
  trackIds: string[];
  onClose: () => void;
  onAdded: (message: string) => void;
  /** Favorites offered too, first: for a selection, which has no heart to press. */
  withFavorites?: boolean;
}) {
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
    /*
      Nor a smart list, whose rules say what is in it. Nor Favorites, for one
      song, which has a button of its own, the heart, and an entry of its own
      in the menu; for a selection, which has neither, Favorites comes first,
      where Favorites is on at all.
    */
    const pinned = withFavorites && favoritesShown() ? favorites() : null;
    const all = playlists();
    const first = all.filter((list) => list.id === pinned);
    setLists([...first, ...byRecent(all.filter((list) => list.tag == null && list.kind !== 'favorites' && list.kind !== 'smart'), recent)]);
    const wanted = new Set(trackIds);
    const counts = new Map<number, number>();
    for (const [id, members] of playlistMembers()) {
      const count = members.reduce((sum, member) => (wanted.has(member) ? sum + 1 : sum), 0);
      if (count > 0) counts.set(id, count);
    }
    setHeld(counts);
  }, [visible, trackIds, withFavorites]);

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

  return (
    <>
      {/* A page of its own in the tab, the bars where they are; a sheet in the player (`MenuPage`). */}
      <MenuPage visible={visible} title={t.lists.picker.heading(trackIds.length)} onClose={onClose}>
        {lists.map((list, index) => (
          <Pressable
            accessibilityRole="button"
            android_ripple={pressed}
            key={list.id}
            style={[styles.row, index > 0 && styles.ruled]}
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
        {lists.length === 0 ? <Text style={styles.empty}>{t.lists.picker.noLists}</Text> : null}
        <Pressable
          accessibilityRole="button"
          android_ripple={pressed}
          style={[styles.create, lists.length > 0 && styles.ruled]}
          onPress={() => setNaming(true)}>
          <Text style={styles.createLabel}>{t.lists.picker.newList}</Text>
        </Pressable>
      </MenuPage>

      <TextPrompt
        visible={naming}
        heading={t.lists.naming.heading}
        placeholder={t.lists.naming.placeholder}
        confirmLabel={t.lists.naming.create}
        onSubmit={create}
        onClose={() => setNaming(false)}
      />
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
  },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  name: { color: c.text, fontSize: TYPE.body, flex: 1, minWidth: 0 },
  nameIn: { fontWeight: '600' },
  share: { color: c.accent, fontSize: TYPE.hint, fontWeight: '600' },
  mark: { width: 22, height: 22, borderRadius: RADIUS.control, alignItems: 'center', justifyContent: 'center' },
  markNone: { borderWidth: 1.5, borderColor: c.textFaint },
  markAll: { backgroundColor: c.accent },
  markSome: { borderWidth: 1.5, borderColor: c.accent },
  tick: { color: c.onAccent, fontSize: TYPE.small, fontWeight: '800', lineHeight: LEADING.small },
  dash: { width: 10, height: 2, borderRadius: 1, backgroundColor: c.accent },
  count: { color: c.textFaint, fontSize: TYPE.hint },
  empty: { color: c.textFaint, fontSize: TYPE.small, paddingVertical: SPACE.m, paddingHorizontal: SPACE.l },
  create: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l },
  createLabel: { color: c.accent, fontSize: TYPE.body },
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
