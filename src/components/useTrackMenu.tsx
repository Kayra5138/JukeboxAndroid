import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { BackHandler } from 'react-native';

import { PlaylistPicker } from './PlaylistPicker';
import { TrackMenu, type TrackAction } from './TrackMenu';
import { albumKey } from '../lib/media/albums';
import { deleteTracks } from '../lib/media/remove';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import type { Track } from '../lib/types';

/** For a row of a record's own page, where "go to album" would lead to itself. */
export const WITHOUT_ALBUM: readonly TrackAction[] = ['album'];

/**
 * The long-press menu of a track, for any screen that shows rows of them.
 *
 * It began as part of the library, which was the one place a row could be held
 * down. Every other list of tracks is the same tracks and is owed the same
 * menu, and four screens each keeping their own copy of what "delete" does
 * would be four that come to disagree about it.
 *
 * So the screen keeps nothing: it calls `open` from its rows and draws
 * `element` once, above everything of its own, and is told through
 * `onChanged` when what it is showing may no longer be true.
 *
 * The list picker comes with it, since one of the entries opens it — and is
 * offered to the screen as `addToList` too, so a screen that also adds a whole
 * selection to a list does not need a second picker for that.
 */
export function useTrackMenu({
  onChanged,
  onAdded,
  beforeLeaving,
}: {
  /** A file was erased, or a list gained a track: read again what is shown. */
  onChanged?: () => void;
  /** What the list picker did, in words, for a screen with somewhere to say it. */
  onAdded?: (message: string) => void;
  /**
   * Run before an entry that goes to another screen. For the player, which is
   * a layer over the navigator and has to get out of the way first, or the
   * screen arrives underneath it.
   */
  beforeLeaving?: () => void;
} = {}): {
  open: (track: Track, hidden?: readonly TrackAction[]) => void;
  addToList: (trackIds: string[]) => void;
  /**
   * Erases files the way the menu's own entry does, queue and all, for a
   * screen that has its own way of choosing them. Answers whether they went.
   */
  erase: (trackIds: string[]) => Promise<boolean>;
  element: ReactNode;
} {
  const router = useRouter();
  const { playNext, addToQueue, removeFromQueue } = usePlayerActions();
  const { queue } = usePlayerState();
  const [menu, setMenu] = useState<{ track: Track; hidden?: readonly TrackAction[] } | null>(
    null
  );
  const [addingTo, setAddingTo] = useState<string[] | null>(null);

  /*
    The latest of each, for work that finishes long after it was started: the
    system's own question about a delete can sit on screen for as long as the
    user likes, and the queue may have moved on by the time it is answered.
  */
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const hooks = useRef({ onChanged, onAdded, beforeLeaving });
  hooks.current = { onChanged, onAdded, beforeLeaving };

  // Stable, because rows are memoised and are handed this directly.
  const open = useCallback(
    (track: Track, hidden?: readonly TrackAction[]) => setMenu({ track, hidden }),
    []
  );
  const close = useCallback(() => setMenu(null), []);
  const addToList = useCallback((trackIds: string[]) => setAddingTo(trackIds), []);
  const closePicker = useCallback(() => setAddingTo(null), []);

  /**
   * Erases files, once the system has asked and been told yes.
   *
   * And takes them out of the queue, wherever they are waiting there. A queue entry
   * is a copy of the track made when it was queued, so the file going leaves
   * it standing: a row that names something the player can no longer open.
   * The playing one included — the row goes and the player moves on, as it
   * does when the cross on that row is pressed.
   *
   * From the far end backwards, so taking one out does not renumber the ones
   * still to go.
   */
  const erase = useCallback(
    async (trackIds: string[]): Promise<boolean> => {
      if (!(await deleteTracks(trackIds))) return false;
      hooks.current.onChanged?.();
      const gone = new Set(trackIds);
      const rows = queueRef.current
        .map((entry, row) => (gone.has(entry.id) ? row : -1))
        .filter((row) => row >= 0)
        .reverse();
      for (const row of rows) await removeFromQueue(row);
      return true;
    },
    [removeFromQueue]
  );

  const run = useCallback(
    (action: TrackAction, track: Track) => {
      setMenu(null);
      // Spelled out rather than built from `action`: a menu entry that is not a
      // route is then a type error here instead of a dead end at the tap.
      if (action === 'playNext') void playNext(track);
      else if (action === 'addToQueue') void addToQueue(track);
      else if (action === 'delete') void erase([track.id]);
      else if (action === 'addToPlaylist') setAddingTo([track.id]);
      else if (action === 'tiles') {
        hooks.current.beforeLeaving?.();
        // The name goes with it. The game shows what it is about to play before
        // the player has been told anything, and the name it should show is the
        // one on the row that was pressed -- tags corrected by hand included.
        router.push({ pathname: '/tiles', params: { track: track.id, title: track.title } });
      }
      else if (action === 'album') {
        const name = track.album?.trim();
        if (!name) return;
        hooks.current.beforeLeaving?.();
        router.push({ pathname: '/playlist', params: { album: albumKey(name) } });
      }
      else {
        hooks.current.beforeLeaving?.();
        router.push({ pathname: '/details', params: { trackId: track.id } });
      }
    },
    [addToQueue, erase, playNext, router]
  );

  /*
    The menu is a window of its own and the back button is its to answer. The
    picker is not: it is drawn in the screen, so a press would go to whatever
    is listening underneath — the record open over the rack, the player — and
    close that with the picker still standing on it.

    Listened for only while the picker is up, which also puts this after the
    screen's own listener; the last one registered is the first one asked.
  */
  useEffect(() => {
    if (addingTo == null) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setAddingTo(null);
      return true;
    });
    return () => listener.remove();
  }, [addingTo]);

  const element = (
    <>
      <TrackMenu
        track={menu?.track ?? null}
        hidden={menu?.hidden}
        onSelect={run}
        onClose={close}
      />
      <PlaylistPicker
        visible={addingTo != null}
        trackIds={addingTo ?? []}
        onClose={closePicker}
        onAdded={(message) => {
          setAddingTo(null);
          hooks.current.onAdded?.(message);
          // The list on screen may be the one that was just added to.
          hooks.current.onChanged?.();
        }}
      />
    </>
  );

  return { open, addToList, erase, element };
}
