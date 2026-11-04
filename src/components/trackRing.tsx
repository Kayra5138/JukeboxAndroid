import { useMemo } from 'react';

import {
  DiscIcon,
  HeartIcon,
  InfoIcon,
  LibraryIcon,
  ListAddIcon,
  ListsIcon,
  PencilIcon,
  PlayNextIcon,
  PlayOutlineIcon,
  QueueIcon,
  ShareIcon,
  SparkleIcon,
  TickIcon,
} from './Icons';
import type { PressIcon, PressRingFor } from './PressMenu';
import { offered, type TrackAction } from './TrackMenu';
import { useT } from '../lib/i18n/index';
import { favoritesShown, isFavorite } from '../lib/playlists/favorites';
import { markTape, tapePlaceNow } from '../lib/tapes/places';
import { isTape } from '../lib/tapes/tape';
import type { Track } from '../lib/types';
import type { PressChoice } from '../lib/ui/pressMenu';

/** A tape's mark, heard or not, which the ring does itself; beside what the menu does. */
type Slice = TrackAction | 'markTape';

/**
 * What each slice of a song's ring does, from straight up round clockwise:
 * see `pressMenu.ts`. The same on every screen, so that the hand learns it once.
 */
const SONG: readonly Slice[] = ['playNext', 'playSimilar', 'addToQueue', 'details', 'addToPlaylist', 'album', 'favorite', 'share'];

/**
 * A tape's: what it shares with a song in the same place as a song has it
 * (next, the queue, sharing), and the rest of what a tape's menu has round
 * them. The show or the folder is one slice, whichever the tape has; the
 * eighth is empty.
 */
const TAPE: readonly (Slice | 'seriesOrFolder' | null)[] = [
  'playNext',
  'playFromStart',
  'addToQueue',
  'tapeDetails',
  'seriesOrFolder',
  null,
  'markTape',
  'share',
];

const ICONS: Record<Exclude<Slice, 'favorite'>, (props: { size: number; color: string }) => React.ReactNode> = {
  playNext: PlayNextIcon,
  addToQueue: QueueIcon,
  playSimilar: SparkleIcon,
  playOnly: PlayOutlineIcon,
  playFromStart: PlayOutlineIcon,
  addToPlaylist: ListAddIcon,
  album: DiscIcon,
  tiles: SparkleIcon,
  details: PencilIcon,
  share: ShareIcon,
  shareFile: ShareIcon,
  delete: ShareIcon,
  keepListened: ListAddIcon,
  series: ListsIcon,
  tapeFolder: LibraryIcon,
  tapeDetails: InfoIcon,
  markTape: TickIcon,
};

const drawn =
  (Icon: (props: { size: number; color: string }) => React.ReactNode): PressIcon =>
  (colour) => <Icon size={24} color={colour} />;

/**
 * The ring a row of tracks opens when it is held, a song's or a tape's by
 * the track, for a screen with the track menu's [open] and [run]. [hidden] is
 * what that screen leaves out of the menu as well: its slice stands empty.
 */
export function useTrackRing(
  menu: { open: (track: Track, hidden?: readonly TrackAction[]) => void; run: (action: TrackAction, track: Track) => void },
  hidden?: readonly TrackAction[]
): PressRingFor<Track> {
  const t = useT();
  const { open, run } = menu;
  return useMemo(() => {
    const said = t.library.menu;
    const actionAt = (place: number, track: Track): Slice | null => {
      if (!isTape(track)) return SONG[place] ?? null;
      const slice = TAPE[place] ?? null;
      if (slice !== 'seriesOrFolder') return slice;
      return offered('series', track, hidden) ? 'series' : 'tapeFolder';
    };
    const choiceAt = (place: number, track: Track): PressChoice<PressIcon> | null => {
      const action = actionAt(place, track);
      if (!action) return null;
      if (action === 'markTape') {
        const heard = tapePlaceNow(track.id)?.finished === true;
        return { place, label: heard ? t.library.tapes.markUnplayed : t.library.tapes.markPlayed, icon: drawn(TickIcon) };
      }
      if (action === 'favorite') {
        if (!favoritesShown() || !offered('favorite', track, hidden)) return null;
        const on = isFavorite(track.id);
        return { place, label: said[on ? 'favoriteRemove' : 'favoriteAdd'].label, icon: (colour) => <HeartIcon size={24} color={colour} full={on} /> };
      }
      if (!offered(action, track, hidden)) return null;
      return { place, label: said[action].label, icon: drawn(ICONS[action]) };
    };
    return {
      title: (track) => track.title,
      choices: (track) =>
        Array.from({ length: 8 }, (_, place) => choiceAt(place, track)).filter((choice): choice is PressChoice<PressIcon> => choice != null),
      chose: (place, track) => {
        const action = actionAt(place, track);
        if (action === 'markTape') void markTape(track.id, tapePlaceNow(track.id)?.finished !== true, track.durationSec);
        else if (action) run(action, track);
      },
      stayed: (track) => open(track, hidden),
    };
  }, [hidden, open, run, t]);
}
