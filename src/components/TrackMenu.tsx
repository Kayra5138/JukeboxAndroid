import { Modal, ScrollView, StyleSheet } from 'react-native';
import {
  CrossIcon,
  DiscIcon,
  FileIcon,
  HeartIcon,
  InfoIcon,
  KeysIcon,
  LibraryIcon,
  ListAddIcon,
  ListsIcon,
  MinusIcon,
  PencilIcon,
  PlayNextIcon,
  PlayOutlineIcon,
  PlusIcon,
  QueueIcon,
  ShareIcon,
  SparkleIcon,
  TickIcon,
  TrashIcon,
} from './Icons';
import { MenuEntry, MenuHeader, MenuQuick, type MenuIcon } from './MenuSheet';
import { Pressable } from './Pressable';

import { isDiscoverTrack, NOT_FOR_DISCOVER } from './discover/show';
import { useDiscoverActions, useDiscoverTrack } from '../lib/discover/DiscoverProvider';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
import type { Track } from '../lib/types';
import { setFavorite, useFavoritesShown, useIsFavorite } from '../lib/playlists/favorites';
import { markTape, useTapePlace } from '../lib/tapes/places';
import { isListened } from '../lib/listen/rules';
import { isTape } from '../lib/tapes/tape';
import { seriesOf } from '../lib/podcasts/series';
import { canShare } from '../lib/media/share';
import { haptic } from '../lib/ui/haptics';

export type TrackAction =
  | 'playNext'
  | 'addToQueue'
  | 'playSimilar'
  | 'playOnly'
  | 'addToPlaylist'
  | 'favorite'
  | 'album'
  | 'tiles'
  | 'details'
  | 'share'
  | 'shareFile'
  | 'delete'
  // A song listened to from the Search tab and not kept: see `lib/listen`.
  | 'keepListened'
  // A tape's own: see `TAPE_ACTIONS`.
  | 'playFromStart'
  | 'series'
  | 'tapeFolder'
  | 'tapeDetails';

/** A tape's mark, heard or not, which is done here and asks nobody; beside what the menu hands back. */
type Entry = TrackAction | 'markTape';

/** What is on the sheet: the most used across the top, under the song, and the rest in a list below them. */
type Layout = { quick: readonly TrackAction[]; rows: readonly Entry[] };

/**
 * What each says, and the words a screen reader adds, are `library.menu` in
 * the string tables under these same words. Favorites is the heart beside
 * the song's name, as on the player.
 */
const SONG_MENU: Layout = {
  quick: ['playNext', 'addToQueue', 'addToPlaylist', 'share'],
  rows: [
    'keepListened',
    // Once, whatever a tap on the row plays (`player/tap.ts`).
    'playSimilar',
    'playOnly',
    'album',
    'details',
    'tiles',
    // The file itself, to another app; see `media/share.ts`.
    'shareFile',
    'delete',
  ],
};

/**
 * A tape's, in place of a song's: from the top or on from where it was, after
 * the one playing or at the end, whether it has been heard, the series it is
 * an episode of or the folder it is in, and away. Nothing of a song's — a
 * list, Favorites, similar songs, the game, the record, a lookup of its
 * details — which a book or an episode is not.
 */
const TAPE_MENU: Layout = {
  quick: ['playFromStart', 'playNext', 'addToQueue', 'share'],
  rows: ['markTape', 'series', 'tapeFolder', 'tapeDetails', 'shareFile', 'delete'],
};

/** The shorter name an entry goes by across the top, where there is a quarter of the width for it. */
const QUICK_WORDS = { playNext: 'quickNext', addToQueue: 'quickQueue', addToPlaylist: 'quickList' } as const;

const ICONS: Partial<Record<Entry, MenuIcon>> = {
  keepListened: PlusIcon,
  playNext: PlayNextIcon,
  addToQueue: QueueIcon,
  playSimilar: SparkleIcon,
  playOnly: PlayOutlineIcon,
  playFromStart: PlayOutlineIcon,
  addToPlaylist: ListAddIcon,
  album: DiscIcon,
  details: PencilIcon,
  tiles: KeysIcon,
  share: ShareIcon,
  shareFile: FileIcon,
  delete: TrashIcon,
  markTape: TickIcon,
  series: ListsIcon,
  tapeFolder: LibraryIcon,
  tapeDetails: InfoIcon,
};

/**
 * Whether [action] can be done to [track], wherever it is offered: on this
 * sheet and in the ring a row opens when held (`trackRing.tsx`). [hidden] is
 * what the screen leaves out, the way back to where the reader already is.
 */
export function offered(action: TrackAction, track: Track, hidden?: readonly TrackAction[]): boolean {
  const tape = isTape(track);
  const series = tape && seriesOf(track) != null;
  const listened = isListened(track.id);
  return (
    !hidden?.includes(action) &&
    (action !== 'series' || series) &&
    (action !== 'tapeFolder' || (tape && !series)) &&
    (action !== 'keepListened' || listened) &&
    !(listened && (NOT_FOR_LISTENED as readonly TrackAction[]).includes(action)) &&
    // Only a file of the phone's library can be handed to another app.
    ((action !== 'share' && action !== 'shareFile') || canShare(track)) &&
    !(isDiscoverTrack(track.id) && (NOT_FOR_DISCOVER as readonly string[]).includes(action)) &&
    // Only where there is a record to go to. A track whose album nobody knows would lead to an empty screen.
    (action !== 'album' || Boolean(track.album?.trim()))
  );
}

/**
 * What cannot be done to a song listened to and not kept: its file is the
 * app's own and the library has no such song, so there is no record to go
 * to, no details to edit and no file of the library's to delete. Put in a
 * list or hearted, it is kept, and becomes one.
 */
const NOT_FOR_LISTENED = ['album', 'tiles', 'details', 'delete'] as const;

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
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(track !== null);
  const discover = isDiscoverTrack(track?.id);
  const favorite = useIsFavorite(track?.id);
  const favorites = useFavoritesShown();
  const artwork = useTrackArtwork(track);
  const tape = track != null && isTape(track);
  const hearted = t.library.menu[favorite ? 'favoriteRemove' : 'favoriteAdd'];
  const shown = (action: Entry): boolean =>
    track != null && (action === 'markTape' ? !discover : offered(action, track, hidden));
  const layout = tape ? TAPE_MENU : SONG_MENU;
  return (
    <Modal
      visible={track !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      {/* Not a stop for a screen reader, which would otherwise read the whole
          heading as one button that closes the menu. The back gesture closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        {track ? (
          // Taller than a landscape screen, so the sheet is bounded and scrolls rather than running off the bottom.
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
            <MenuHeader
              title={track.title}
              // A tape with nobody named is not a song by an unknown artist: it says nothing there.
              detail={track.artist || !isTape(track) ? (track.artist ?? t.common.unknownArtist) : null}
              picture={artwork}
              accessory={
                // As the player's: it fills or empties where it is, and the sheet stays for whatever else it was opened for.
                favorites && !tape && !discover ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={hearted.label}
                    accessibilityHint={hearted.hint}
                    accessibilityState={{ selected: favorite }}
                    android_ripple={pressed}
                    hitSlop={10}
                    style={styles.heart}
                    onPress={() => {
                      const on = !favorite;
                      setFavorite(track.id, on);
                      haptic('results', on ? 'confirm' : 'toggleOff');
                    }}>
                    <HeartIcon size={24} full={favorite} color={c.accent} />
                  </Pressable>
                ) : null
              }
            />

            <MenuQuick
              entries={layout.quick.filter(shown).map((action) => {
                const said = t.library.menu[action as Exclude<TrackAction, 'favorite'>];
                return {
                  key: action,
                  icon: ICONS[action]!,
                  short: action in QUICK_WORDS ? t.library.menu[QUICK_WORDS[action as keyof typeof QUICK_WORDS]] : said.label,
                  label: said.label,
                  hint: said.hint,
                  onPress: () => onSelect(action, track),
                };
              })}
            />

            {discover ? <DiscoverKeep trackId={track.id} onDone={onClose} /> : null}
            {layout.rows.filter(shown).map((action) => {
              if (action === 'markTape') return <TapeEntry key={action} track={track} onDone={onClose} />;
              const said = t.library.menu[action as Exclude<TrackAction, 'favorite'>];
              return (
                <MenuEntry
                  key={action}
                  icon={ICONS[action]!}
                  label={said.label}
                  hint={said.hint}
                  danger={action === 'delete'}
                  onPress={() => onSelect(action, track)}
                />
              );
            })}
            {discover ? <DiscoverEntries trackId={track.id} onDone={onClose} /> : null}
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/**
 * A tape marked as heard, so that it starts from the top next time and goes
 * to the foot of the tapes; or one heard, or part way through, marked as not
 * begun.
 */
function TapeEntry({ track, onDone }: { track: Track; onDone: () => void }) {
  const t = useT();
  const place = useTapePlace(track.id);
  const heard = place?.finished === true;
  return (
    <MenuEntry
      icon={TickIcon}
      label={heard ? t.library.tapes.markUnplayed : t.library.tapes.markPlayed}
      onPress={() => {
        void markTape(track.id, !heard, track.durationSec);
        onDone();
      }}
    />
  );
}

/**
 * Keeping a song of Discover's, first of what its menu lists: it is what
 * makes the rest of the library's entries possible.
 *
 * Its parts here are drawn only for such a track, so that it is the menu of a
 * Discover song that listens to Discover and not every screen that has a
 * menu. Nothing, for a song that has left the list since it was queued: kept
 * already, or one of a list that has been replaced.
 */
function DiscoverKeep({ trackId, onDone }: { trackId: string; onDone: () => void }) {
  const entry = useDiscoverTrack(trackId);
  const { keep } = useDiscoverActions();
  const t = useT();
  if (!entry) return null;
  const said = t.discover.menu;
  return (
    <MenuEntry
      icon={PlusIcon}
      label={entry.keeping ? t.discover.row.keeping : said.keep.label}
      hint={said.keep.hint}
      disabled={entry.keeping}
      onPress={() => {
        onDone();
        keep(entry.id);
      }}
    />
  );
}

/** And turning it or its artist away, last of it. */
function DiscoverEntries({ trackId, onDone }: { trackId: string; onDone: () => void }) {
  const entry = useDiscoverTrack(trackId);
  const { exclude, excludeArtist } = useDiscoverActions();
  const t = useT();
  if (!entry) return null;
  const said = t.discover.menu;
  const then = (act: (id: string) => void) => () => {
    onDone();
    act(entry.id);
  };
  return (
    <>
      <MenuEntry icon={MinusIcon} label={said.exclude.label} hint={said.exclude.hint} onPress={then(exclude)} />
      <MenuEntry icon={CrossIcon} label={said.neverArtist.label(entry.artist)} hint={said.neverArtist.hint} danger onPress={then(excludeArtist)} />
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
  heart: { padding: 6 },
}));
