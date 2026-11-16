import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { BlurArea, Frost, GlassScene, useFrosted, useOwnScene } from '../components/Frosted';
import { Pressable } from '../components/Pressable';

import { LookIcon, MarksIcon, PlayIcon, PlusIcon, SearchIcon, SettingsIcon, ShuffleIcon } from '../components/Icons';
import { PressRing } from '../components/PressMenu';
import { useTrackRing } from '../components/trackRing';
import { useTrackMenu, WITHOUT_ALBUM } from '../components/useTrackMenu';
import { SearchField, type SearchBox } from '../components/SearchField';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { underGlass, Veiled } from '../lib/theme/Veil';
import { Behind } from '../lib/theme/Veil';
import { SelectIcon } from '../components/Icons';
import { useHiddenTabs } from '../lib/ui/tabs';
import { rackWanted, useLandscape, useListColumns } from '../lib/ui/layout';
import { useDragSelect } from '../lib/ui/useDragSelect';
import { haptic } from '../lib/ui/haptics';
import { useBackInFront } from '../lib/ui/back';
import { useTabOpen } from '../lib/ui/tabOpen';
import { useSelectionActions } from '../components/SelectionActions';
import { LibraryWelcome } from '../components/welcome/LibraryWelcome';
import { WrongDownloadsLine } from '../components/WrongDownloadsLine';
import { NowPlayingBar, usePageSides } from '../components/NowPlayingBar';
import { topGlass, useLaidOver, useUnderBars } from '../components/UnderBars';
import { PlaylistCover } from '../components/PlaylistCover';
import { BrowseRow, useBrowseRowHeight } from '../components/BrowseRow';
import { AlbumListing } from '../components/AlbumListing';
import { AlbumMenu, WITHOUT_SELECT, type AlbumAction } from '../components/AlbumMenu';
import { CoverFlow, type Rack, type Sleeve } from '../components/CoverFlow';
import { FastScroller, useFastScroll, type FastScroll } from '../components/FastScroller';
import { ZoomStack, type LevelApi, type StackApi } from '../components/looks/CoverGrid';
import { Curtain } from '../components/Curtain';
import { ArtistMap } from '../components/artists/ArtistMap';
import { asTrackLook, asZoom, nextTrackLook, TrackCover, type TrackLook } from '../components/looks/shared';
import { Shelves } from '../components/looks/Shelves';
import { latest, letterLabel, monthLabel } from '../lib/ui/fastLabels';
import { forgetAlbumColour, useAlbumColours } from '../lib/media/albumColours';
import { byColour } from '../lib/media/colourOrder';
import { RackFront } from '../components/RackFront';
import { setAside, useSetAside, useSetAsideIds } from '../lib/library/setAside';
import { albumsOf, findAlbum, nameOfKey, narrowAlbums, type Album } from '../lib/media/albums';
import { chooseRecordCover, lookUpRecord } from '../lib/metadata/albumActions';
import {
  artistsOf,
  asArtistSort,
  nextArtistSort,
  sortArtists,
  type ArtistSort,
  type NamesOn,
} from '../lib/media/artists';
import {
  asFolderSort,
  foldersOf,
  nextFolderSort,
  sortFolders,
  type FolderSort,
} from '../lib/media/folders';
import { holdsAll, markOf, tracksUnder, withGroupToggled } from '../lib/media/selection';
import { currentCreditReader } from '../lib/db/credits';
import { canWriteFiles } from '../lib/filetags';
import { Segmented } from '../components/Segmented';
import { SwipeRow } from '../components/SwipeRow';
import { TrackRow, useTrackRowHeight } from '../components/TrackRow';
import { refreshLibrary } from '../lib/library/index';
import { keepMap } from '../lib/library/reconcile';
import { useLibrary } from '../lib/library/useLibrary';
import { ensureNotificationPermission, libraryRoot } from '../lib/media/library';
import type { EnrichedTrack } from '../lib/media/merge';
import { search, searchNamed } from '../lib/media/search';
import { LIBRARY_VIEWS, viewShown, type LibraryView } from '../lib/media/views';
import {
  asSortOrder,
  nextSort,
  sortAlbums,
  sortTracks,
  type SortOrder,
} from '../lib/media/sort';
import { lastPlayedAt, playCounts } from '../lib/db/history';
import { artistKey, spreadShuffle } from '../lib/media/shuffle';
import { PressList, type PressListFor } from '../components/PressList';
import { useFavoritesShown } from '../lib/playlists/favorites';
import { ShuffleSourceSheet, useShuffleNames, useShuffleWords } from '../components/ShuffleSettings';
import {
  setShuffleSource,
  SHUFFLE_ALL,
  shuffleChoices,
  shuffleSource,
  shuffleTracks,
  sourceKey,
  sourceOfKey,
  type ShuffleSource,
} from '../lib/lists/shuffleSource';
import { usePlayTapped, type TapPlace } from '../lib/player/usePlayTapped';
import { currentTrack, playingTrack } from '../lib/player/current';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { motionReduced } from '../lib/ui/motion';
import { CLIP_SUBVIEWS, ROWS_KEPT } from '../lib/ui/lists';
import { followsScrolling } from '../lib/ui/moving';
import { useStartingOffset } from '../lib/ui/useStartingOffset';
import { backToTop, useTabReselect } from '../lib/ui/tabReselect';
import { useLibraryViews } from '../lib/ui/libraryViews';
import { downloads } from '../lib/youtube/native';
import { inRecordOrder, inSeriesOrder, orderTapes } from '../lib/tapes/order';
import { tapeQueueOf } from '../lib/tapes/play';
import { asTapeFilter, asTapeSort, nextTapeSort, type TapeFilter, type TapeSort } from '../lib/tapes/sort';
import { TapeItemRow } from '../components/tapes/TapeItemRow';
import { markTape, useTapePlaces } from '../lib/tapes/places';
import { useAllMarks } from '../lib/tapes/marks';
import { isTape } from '../lib/tapes/tape';
import { SeriesRow, type SeriesShow } from '../components/tapes/SeriesRow';
import { TAPE_FOLDERS } from '../lib/tapes/rule';
import { seriesByFolder, seriesOf } from '../lib/podcasts/series';
import { folderKey } from '../lib/media/folders';
import { subscriptions, type Subscription } from '../lib/podcasts/store';

/** A stable empty library, so the searching below is not re-run over a new one. */
const NOTHING: EnrichedTrack[] = [];

/** The same, for a listening history that has not been read yet. */
const UNPLAYED: ReadonlyMap<string, number> = new Map();

/** Nobody named, for the moment before the catalogues' verdicts have been read. */
const NOBODY: NamesOn = () => [];

/*
  What the box says it looks for is not the same thing in every view, and is
  `library.screen.searchHints` in the string tables.

  The first two search the tracks and show what they belong to. The other two
  are looked up by what they are called, and a box still offering titles and
  tags there would be promising a search that is not being run.
*/

/** No listens counted, for the same moment. */
const UNCOUNTED: ReadonlyMap<string, number> = new Map();

/** Nothing on screen to choose from, while nothing is being chosen. */
const NOTHING_SHOWN: ReadonlySet<string> = new Set();

/** One album, artist or folder, reduced to what its row draws. */
type Heading = {
  id: string;
  title: string;
  /** Whoever a record is by, drawn before [detail] and leading to them. */
  by?: string | null;
  detail: string;
  tracks: EnrichedTrack[];
  /** What the heading's one cover is found among: see `useAlbumArtwork`. */
  cover: EnrichedTrack[];
};

/** No headings, for the view that is a list of tracks and has none. */
const NO_HEADINGS: Heading[] = [];

/** The views that are lists of headings rather than of tracks. */
const GROUPED_VIEWS = ['albums', 'artists', 'folders'] as const;
/** The orders of the rack: by the colours of the covers, which it starts in, and the library's. */
const RACK_SORTS = ['colour', 'name', 'added', 'played'] as const;
type RackSort = (typeof RACK_SORTS)[number];
function asRackSort(value: string | null): RackSort {
  return (RACK_SORTS as readonly string[]).includes(value ?? '') ? (value as RackSort) : 'colour';
}
/** The views that can be pinched out into a wall of covers. */
type ZoomedView = 'tracks' | (typeof GROUPED_VIEWS)[number];

/** A list as the tab pressed again moves it. */
type Scrolls = { scrollToOffset: (to: { offset: number; animated: boolean }) => void };
/** Where a scroll comes to rest, as a list says it. */
type ScrollEnds = {
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const NO_TRACKS: EnrichedTrack[] = [];
/** Where a row's cover is in it, as `TrackRow` and `BrowseRow` draw it: so far in from the side, and so big. */
const ROW_SIDE = 16;
const ROW_COVER = 46;

// What a wall of covers is told of a song and of a heading: see `CoverGrid`.
const trackKey = (track: EnrichedTrack) => track.id;
const trackTitle = (track: EnrichedTrack) => track.title;
const trackArtist = (track: EnrichedTrack) => track.artist;
const trackCover = (track: EnrichedTrack, size: number) => <TrackCover track={track} size={size} />;
const sameTrack = (track: EnrichedTrack) => track;
const headingKey = (heading: Heading) => heading.id;
const headingTitle = (heading: Heading) => heading.title;
const headingBy = (heading: Heading) => heading.by;
const headingCover = (heading: Heading, size: number) => (
  <PlaylistCover tracks={heading.tracks} chosen={null} sleeve={heading.cover} size={size} />
);
const headingSleeve = (heading: Heading) => heading.cover[0];

/** A row of the tapes view: a heading over one of its two parts, a podcast followed, one of its episodes laid out under it, or a tape. */
type TapeRow =
  | { kind: 'heading'; id: string; title: string }
  | { kind: 'series'; id: string; show: SeriesShow; episodes: readonly EnrichedTrack[]; book?: boolean }
  | { kind: 'episode'; id: string; track: EnrichedTrack }
  | { kind: 'tape'; id: string; track: EnrichedTrack };
const NO_TAPE_ROWS: TapeRow[] = [];
const NO_TAPE_COUNTS = { series: 0, books: 0, tapes: 0 };

/** How many of [episodes] are ticked: all, some or none, for their show's tick box. */
function tickedOf(episodes: readonly EnrichedTrack[], selected: ReadonlySet<string>): 'all' | 'some' | 'none' {
  const ticked = episodes.filter((episode) => selected.has(episode.id)).length;
  return ticked === 0 ? 'none' : ticked === episodes.length ? 'all' : 'some';
}

/*
  How each order is named on the button, and how it is read out, are
  `library.screen.sortShort` and `library.screen.sortedBy` in the string tables
  — and `groupSortShort` and `groupSortedBy` for the artists and the folders,
  which are asked different things.

  The written form has to be short enough to sit beside the search box without
  taking anything from it, which rules out saying anything about *what* is
  being ordered — a reader can see that for themselves, since the list is right
  there. The spoken form is under no such pressure and says it properly.
*/

/**
 * Declared rather than measured, unlike the switch beside it.
 *
 * The switch says the same few words until Settings changes them, so it can
 * be measured once and pinned; this changes what it says on every tap, and a slot pinned to
 * the width of `A–Z` would wrap `Played` into a column of letters. Wide enough
 * for the longest of the three in any language the app speaks, and the same width for all of them so that the
 * search box does not breathe in and out as the order changes.
 */
const SORT_WIDTH = 56;
/** How tall the switch, the box and the buttons over the library are, all alike. */
const CONTROL_HEIGHT = 40;

/**
 * What the library is ordered and credited by, read again with the library:
 * who each credit names, and when each track was last played and how often,
 * so that a track played on another screen and then returned from has moved
 * by the time the list is seen again. Null where it could not be read: the
 * list is on screen either way, and it is asked for again on the next visit.
 *
 * Out here rather than in the screen, which the React Compiler does not take
 * with a loop inside a `try`.
 */
function readListening(): { reader: NamesOn; latest: Map<string, number>; listens: Map<string, number> } | null {
  try {
    const reader = currentCreditReader();
    const latest = lastPlayedAt();
    const listens = new Map<string, number>();
    for (const [id, count] of playCounts()) listens.set(id, count.plays);
    return { reader, latest, listens };
  } catch (error) {
    console.warn('The listening history could not be read for the library.', error);
    return null;
  }
}

/** The tapes' view, by a name the React Compiler reads as it reads the others' (`listOf`). */
const TAPES: LibraryView = 'tapes';

export default function LibraryScreen() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // Both grow with the size of writing; the lists below lay themselves out by them.
  const trackRowHeight = useTrackRowHeight();
  const browseRowHeight = useBrowseRowHeight();
  const downloadRevision = useDownloadLibraryRevision();
  /*
    The library is not this screen's own. It is read once for the whole app
    and held (`lib/library`), and what is drawn here is that: a reading which
    finds nothing new hands back the list already on screen, track for track,
    so coming back to this tab redraws nothing and builds nothing again.
  */
  const screen = useLibrary();
  const [query, setQuery] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);
  /*
    Selection is a mode rather than something a long press falls into: the long
    press already opens the track's own menu, and one gesture cannot sensibly do
    both. The button in the header is what turns the list from something to play
    into something to choose from.

    An album, an artist or a folder has no menu of its own, so there the long
    press is free and does start it — with that row's tracks chosen.

    What is chosen is tracks, in every view. The rows of the other three only
    report on it and choose their tracks wholesale (`media/selection.ts`), which
    is why a selection can be carried from one view into another and everything
    done to it below is the same whichever it was made in.
  */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /**
   * Which tracks the list picker is holding, or null when it is closed.
   *
   * Kept apart from `selected` because the picker is opened from two places
   * that mean different things — a single row held down, and a whole
   * selection — and the picker should not have to know which.
   */
  /**
   * The view last chosen, as it was written down — which is not always the one
   * drawn. See {@link viewShown}.
   */
  const [remembered, setRemembered] = useState<string | null>(null);
  /** The views the switch offers: the ones left on in Settings, or chosen in the setup. */
  const offered = useLibraryViews();
  /**
   * Who each track names, as the stats read it.
   *
   * Read with the library rather than when the artists are first asked for,
   * for the reason the listening history is: asking is a query, and the moment
   * of asking would be a tap on the switch.
   */
  const [namesOn, setNamesOn] = useState<NamesOn>(() => NOBODY);
  const [sort, setSort] = useState<SortOrder>('name');
  /** The artists' own order, and the folders': neither is the library's. */
  const [artistSort, setArtistSort] = useState<ArtistSort>('name');
  const [folderSort, setFolderSort] = useState<FolderSort>('name');
  // The tapes' own order: the ones being listened to first, by name, or by what came newest.
  const [tapeSort, setTapeSort] = useState<TapeSort>(() => asTapeSort(readSetting(SETTINGS.libraryTapeSort)));
  /** The artists as a map rather than a list: see `ArtistMap`. */
  const [artistMap, setArtistMap] = useState(() => readSetting(SETTINGS.artistLook) === 'map');
  /** The rack's own order: see where the records are put in it. */
  const [rackSort, setRackSort] = useState<RackSort>(() => asRackSort(readSetting(SETTINGS.rackSort)));
  /** How the Tracks view is drawn: the list, or one of the looks being tried out. */
  const [trackLook, setTrackLook] = useState<TrackLook>(() => asTrackLook(readSetting(SETTINGS.libraryTracksLook)));
  /** How far each view is pinched out into a wall of covers; 0, its list. */
  const [zooms, setZooms] = useState<Record<ZoomedView, number>>(() => ({
    tracks: asZoom(readSetting(`${SETTINGS.listZoom}:tracks`)),
    albums: asZoom(readSetting(`${SETTINGS.listZoom}:albums`)),
    artists: asZoom(readSetting(`${SETTINGS.listZoom}:artists`)),
    folders: asZoom(readSetting(`${SETTINGS.listZoom}:folders`)),
  }));
  // A view come to rest at another level, as a pinch leaves it: see `ZoomStack`.
  const setZoom = (kind: ZoomedView, level: number) => {
    setZooms((now) => ({ ...now, [kind]: level }));
    writeSetting(`${SETTINGS.listZoom}:${kind}`, String(level));
  };
  /**
   * When each track was last listened to, read alongside the library itself.
   *
   * Read even when nothing is being ordered by it, because the alternative is
   * reading it at the moment the order changes — which is a tap, and a query
   * between a finger going down and the list redrawing is exactly where a
   * stutter is noticed.
   */
  const [played, setPlayed] = useState<ReadonlyMap<string, number>>(UNPLAYED);
  /** How many times each has been listened to, which is what artists are ordered by. */
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(UNCOUNTED);
  /** Records as a rack of sleeves rather than as a list. Off unless asked for. */
  const [rack, setRack] = useState(false);
  /**
   * The record taken out of the rack, and where its sleeve was at the time.
   *
   * Held here and not by the rack, because what it opens into is drawn over
   * the header as well as over the rack, and outlives the rack if the phone is
   * turned upright while it is open.
   */
  const [opened, setOpened] = useState<{ album: Album; sleeve: Sleeve | null } | null>(null);
  const shelf = useRef<Rack>(null);
  const middle = useRef<View>(null);
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
  const sides = usePageSides();
  const glass = underGlass(c);
  const [note, setNote] = useState<string | null>(null);

  // Restored in an effect rather than in the first render: opening the
  // database is not something to do on the thread drawing a frame.
  useEffect(() => {
    setRemembered(readSetting(SETTINGS.libraryView));
    setSort(asSortOrder(readSetting(SETTINGS.librarySort)));
    setArtistSort(asArtistSort(readSetting(SETTINGS.libraryArtistSort)));
    setFolderSort(asFolderSort(readSetting(SETTINGS.libraryFolderSort)));
  }, []);

  // Read on focus rather than once, so coming back from Settings shows the
  // choice that was just made there. (The views are watched, and need no reading.)
  useFocusEffect(
    useCallback(() => {
      setRack(rackWanted(landscape));
    }, [landscape])
  );

  /*
    The view pressed, and the view drawn, which follows it a moment later.
    The switch shows the press at once; the list under it, a few hundred rows
    with covers, is drawn behind it without holding the switch up, and with a
    library of any size that was a hitch felt on every change of view.
  */
  const chosenView = viewShown(remembered, offered);
  const view = useDeferredValue(chosenView);
  const albumView = view === 'albums';
  /** Whether what is on screen is headings — albums, artists, folders — rather than tracks or tapes. */
  const grouped = view !== 'tracks' && view !== 'tapes';
  /**
   * Whether the records are on the rack just now.
   *
   * Not while tracks are being chosen. A sleeve seen edge-on has nowhere to
   * carry a tick box and no way of saying "some", so for as long as the choosing
   * lasts the records are the plain list, and the rack comes back when it ends.
   * Taking the selection button away instead would have been simpler and worse:
   * a selection begun in another view could then be carried in here and left
   * with nothing on screen to end it.
   */
  const racked = albumView && rack && !selecting;
  /*
    The record the rack last came to rest on, by its key: what it starts on
    when it is made again -- the phone turned, the rack sideways made a rack
    upright -- and, upright, whose tracks are under it.
  */
  const [rackKey, setRackKey] = useState<string | null>(null);
  /*
    The view a finger is on in the switch, not yet let go: made ready to be
    shown, out of sight, while it is down (see `Curtain`), so that letting go
    only shows it.
  */
  const [warmView, setWarmView] = useState<LibraryView | null>(null);
  const coolViews = useCallback(() => setWarmView(null), []);
  /*
    Ready, too, from the finger lifted until the view chosen is drawn: that
    comes a drawing later (see `view`), and left cold for the one between,
    all that was made ready was let go again.
  */
  const warming = (candidate: LibraryView) => warmView === candidate || (chosenView === candidate && view !== candidate);
  const screenSize = useWindowDimensions();
  /*
    In a theme of glass the search, the switch and the order are laid over
    the list, which runs on under them and is seen through them, and the
    tabs and the bar of what is playing over its foot: see `UnderBars`. Not
    over the rack, which is no list and has nothing to pass under them; it
    begins under the top as it always has.
  */
  const top = useLaidOver();
  /*
    Laid over the rack too, the rack keeping clear of it itself (see where
    it is drawn): the lists, standing under the rack, kept to the same room
    whichever view is in front. Laid over the lists and not over the rack,
    as it was, the room the lists had changed at every change to the rack
    and back, and every list and wall of covers was laid out again.
  */
  const over = top.laid;
  // The list out of focus behind the top, where it is laid over it: see `Frosted`. Over the rack, with the lists shut away, the glass is its tint alone (`FrostView`).
  const scene = useOwnScene();
  const target = scene.target;
  const frosted = useFrosted(over ? target : null);
  /*
    The room over the lists: how tall the top is as it stands over them,
    taken only from a laying out of it over them. Over the rack it is a line
    shorter (it has no count of records), and the lists, shut under it, keep
    the room they had; taken from the top as it was at each drawing, they
    were laid out again for the rack's top on the way back from it, and
    again for their own a moment later.
  */
  const laidTop = over ? top.height : 0;
  const [listTop, setListTop] = useState(0);
  const measureTop = (event: LayoutChangeEvent) => {
    top.onLayout?.(event);
    if (!racked) setListTop(Math.round(event.nativeEvent.layout.height * 10) / 10);
  };
  const topRoom = over ? listTop : 0;
  const under = useUnderBars({ player: true });

  // Written down for the same reason the view is: an order is chosen once and
  // then lived in, and having to choose it again on every launch would make it
  // a chore rather than a preference.
  const chooseSort = useCallback((order: SortOrder) => {
    setSort(order);
    writeSetting(SETTINGS.librarySort, order);
  }, []);

  /*
    The one button, stepping whichever order belongs to the view it is over.
    Tracks and records share theirs; artists and folders each keep their own,
    for the reason given where the settings are named.
  */
  const stepSort = () => {
    haptic('choices', 'tick');
    if (view === 'artists') {
      const next = nextArtistSort(artistSort);
      setArtistSort(next);
      writeSetting(SETTINGS.libraryArtistSort, next);
    } else if (view === 'folders') {
      const next = nextFolderSort(folderSort);
      setFolderSort(next);
      writeSetting(SETTINGS.libraryFolderSort, next);
    } else if (racked) {
      const next = RACK_SORTS[(RACK_SORTS.indexOf(rackSort) + 1) % RACK_SORTS.length] ?? 'colour';
      setRackSort(next);
      writeSetting(SETTINGS.rackSort, next);
    } else if (view === 'tapes') {
      const next = nextTapeSort(tapeSort);
      setTapeSort(next);
      writeSetting(SETTINGS.libraryTapeSort, next);
    } else {
      chooseSort(nextSort(sort));
    }
  };
  /*
    The button beside the switch: the records between their list and the
    rack, held the way the phone is now; the artists between their list and
    the map; the tracks through their looks. (Tried as the view's own name
    pressed again, it was nowhere anybody would look for it.)
  */
  const lookable = (kind: LibraryView) => kind === 'albums' || kind === 'tracks' || kind === 'artists';
  const stepLook = () => {
    haptic('choices', 'tick');
    if (view === 'albums') {
      const next = !rack;
      setRack(next);
      if (landscape) writeSetting(SETTINGS.coverFlow, next ? 'true' : 'false');
      else writeSetting(SETTINGS.coverFlowUpright, next ? 'true' : 'false');
    } else if (view === 'artists') {
      const next = !artistMap;
      setArtistMap(next);
      writeSetting(SETTINGS.artistLook, next ? 'map' : 'list');
    } else {
      const next = nextTrackLook(trackLook);
      setTrackLook(next);
      writeSetting(SETTINGS.libraryTracksLook, next);
    }
  };
  /** Which look a view is in: the picture on the button, and the word it is read out with. */
  const lookOf = (kind: LibraryView): 'list' | 'shelves' | 'rack' | 'map' =>
    kind === 'albums' ? (rack ? 'rack' : 'list') : kind === 'artists' ? (artistMap ? 'map' : 'list') : trackLook === 'shelves' ? 'shelves' : 'list';
  /** What the button says, and what it is read out as, in this view. */
  const sortShown =
    view === 'artists'
      ? {
          short: t.library.screen.groupSortShort[artistSort],
          spoken: t.library.screen.groupSortedBy[artistSort],
        }
      : view === 'folders'
        ? {
            short: t.library.screen.groupSortShort[folderSort],
            spoken: t.library.screen.groupSortedBy[folderSort],
          }
        : racked
          ? { short: t.library.screen.sortShort[rackSort], spoken: t.library.screen.sortedBy[rackSort] }
        : view === 'tapes'
          ? { short: t.library.screen.sortShort[tapeSort], spoken: t.library.screen.sortedBy[tapeSort] }
          : { short: t.library.screen.sortShort[sort], spoken: t.library.screen.sortedBy[sort] };
  const columns = useListColumns();
  /*
    How many to a row each view's list was last laid out with while it was
    in front: a list standing shut behind another keeps that until it comes
    to the front itself. Turned with the phone, every list standing behind
    the one in sight was made afresh, rows and all, for a width nobody was
    looking at, and the app took seconds to come round.
  */
  const [keptColumns, setKeptColumns] = useState<Partial<Record<LibraryView, number>>>({});
  const { playQueue, playNext, addToQueue, toggle } = usePlayerActions();
  // The same two functions for every row, which a remembered row needs.
  const playNextTrack = useCallback((track: EnrichedTrack) => void playNext(track), [playNext]);
  const queueTrack = useCallback((track: EnrichedTrack) => void addToQueue(track), [addToQueue]);
  /*
    What the shuffle button plays -- everything, or the list chosen for it
    (`lists/shuffleSource.ts`) -- shuffled the way the player shuffles a
    queue: spread so that an artist does not come up twice running, and not a
    plain draw. A list chosen for good that is no more is everything again.
  */
  const shuffleNames = useShuffleNames();
  const shuffleWords = useShuffleWords();
  const favoritesOn = useFavoritesShown();
  const [choosingShuffle, setChoosingShuffle] = useState(false);
  const router = useRouter();

  /*
    At the foot of a search, what is not in the library may be on YouTube:
    the same words searched for there, on the Search tab, at a press. Not
    while that tab is taken off the bar, which would send anybody who went
    there straight back here.
  */
  const searchTabShown = !useHiddenTabs().has('search');
  const wanted = query.trim();
  // Kept the same from one drawing to the next, as it goes to every list and wall: see `wallOf`.
  const searchElsewhere = useMemo(() =>
    wanted && searchTabShown && !selecting ? (
      <View style={styles.elsewhere}>
        <Pressable
          accessibilityRole="button"
          android_ripple={pressed}
          style={styles.tagAction}
          onPress={() => router.navigate({ pathname: '/search', params: { q: wanted, run: String(Date.now()) } })}>
          <View style={styles.elsewhereIcon}>
            <SearchIcon size={14} color={c.onPrimary} />
          </View>
          <Text style={styles.tagActionLabel} numberOfLines={2}>
            {t.library.screen.searchYouTube(wanted)}
          </Text>
        </Pressable>
      </View>
    ) : null, [c.onPrimary, pressed, router, searchTabShown, selecting, styles, t, wanted]);

  const library = screen.kind === 'library' ? screen.tracks : NOTHING;
  /*
    The music: the library without its tapes, which have a view of their own
    and are none of the others' business — not a track, not on a record, not
    an artist's, not shuffled in. See `lib/tapes`. The folders are drawn from
    the whole library, where the tapes folder is one folder among the rest.
  */
  const music = useMemo(() => library.filter((track) => !isTape(track)), [library]);
  /*
    The songs set aside (`library/setAside.ts`): kept out of the Tracks view
    and out of shuffling everything, and in every other view as they were.
  */
  const asideIds = useSetAsideIds(music);
  const asideRules = useSetAside();
  const shuffleFrom = (wanted: ShuffleSource) => {
    const { tracks, gone } = shuffleTracks(wanted, music, shuffleNames, asideIds);
    if (gone && sourceKey(wanted) === sourceKey(shuffleSource())) setShuffleSource(SHUFFLE_ALL);
    if (tracks.length === 0) return;
    void playQueue(spreadShuffle(tracks, artistKey), 0);
  };
  const shuffleAll = () => shuffleFrom(shuffleSource());
  // Held, the button offers everything it can play, for once, and at the foot a way to change what it plays.
  const shuffleMenu: PressListFor = {
    title: () => t.library.shuffle.menu,
    rows: () => {
      const chosen = sourceKey(shuffleSource());
      return [
        ...shuffleChoices(music, shuffleNames, favoritesOn, undefined, asideIds).map((choice) => ({
          key: choice.key,
          label: choice.name,
          detail: t.common.tracks(choice.count),
          checked: choice.key === chosen,
        })),
        { key: 'change', label: t.library.shuffle.change, apart: true },
      ];
    },
    choose: (key) => {
      if (key === 'change') setChoosingShuffle(true);
      else shuffleFrom(sourceOfKey(key));
    },
  };
  const asideCount = useMemo(() => (asideIds.size === 0 ? 0 : music.filter((track) => asideIds.has(track.id)).length), [asideIds, music]);

  /*
    The words looked for, a moment behind the box: typed quickly, the letters
    on their way are not each looked for in turn and drawn as a list nobody
    sees, and the box never waits on the list. See `useDeferredValue`.
  */
  const searched = useDeferredValue(query);
  /*
    Folding the whole library is not something to do on every render. `search`
    normalises every title, artist, album and tag it looks at, and unmemoised it
    ran again for a menu opening or a track change as readily as for a keystroke.
  */
  const { tracks: found, matchedTags } = useMemo(
    // With the words a nameless artist is drawn with, so that they find those tracks too.
    () => search(library, searched, [t.common.unknownArtist, 'Unknown artist']),
    [library, searched, t]
  );

  /*
    Ordered after the search rather than before it, so the two compose: a query
    narrows the library and the order arranges whatever is left, which is what
    somebody searching an artist's name while sorted by what is new is asking
    for. Memoised for the same reason the search is — the comparison folds every
    title it looks at, and re-running it because a menu opened would fold the
    whole library again.
  */
  const results = useMemo(
    () => sortTracks(found.filter((track) => !isTape(track)), sort, played),
    [found, played, sort]
  );
  /*
    What the Tracks view lists: the results less what is set aside. Only
    there: the records, the artists and the folders are narrowed by the
    results themselves, and keep every song they hold.
  */
  const listed = useMemo(
    () => (asideIds.size === 0 ? results : results.filter((track) => !asideIds.has(track.id))),
    [asideIds, results]
  );
  /** Where a track is filed in the order the tracks are in, for the fast scroller's bubble and the wall's headings. */
  const months = t.format.monthsShort;
  const sectionOf = useCallback(
    (track: EnrichedTrack) =>
      sort === 'added' ? monthLabel(track.addedAt, months) : sort === 'played' ? monthLabel(played.get(track.id), months) : letterLabel(track.title),
    [months, played, sort]
  );
  // Each list's scroll bar to take hold of: see `FastScroller`.
  const fastTracks = useFastScroll();
  const fastAlbums = useFastScroll();
  const fastArtists = useFastScroll();
  const fastFolders = useFastScroll();
  const fastOf: Record<'albums' | 'artists' | 'folders', FastScroll> = { albums: fastAlbums, artists: fastArtists, folders: fastFolders };

  /*
    The records the search results belong to.

    The library's own records, narrowed to the results, so searching narrows
    the albums the same way it narrows the tracks — which is what anybody
    typing an artist's name into a library of albums expects. Narrowed and not
    built from the results: which record a track is on can take the rest of
    the library to know, and a record must keep its key while it is searched.
  */
  const asked = searched.trim().length > 0;
  /*
    Kept once worked out rather than thrown away when the view changes, so
    going back to the albums, or to the artists below, does not sort the whole
    library into them again; worked out again only for a different library.
  */
  const [visited, setVisited] = useState<ReadonlySet<LibraryView>>(() => new Set());
  if (!visited.has(view)) setVisited(new Set([...visited, view]));
  const seenAlbums = visited.has('albums');
  const wantRecords = seenAlbums || asked;
  const records = useMemo(() => (wantRecords ? albumsOf(music) : []), [music, wantRecords]);
  const narrowed = useMemo(() => (seenAlbums ? narrowAlbums(records, results) : []), [records, results, seenAlbums]);
  /*
    The rack keeps an order of its own, by the colours of the covers unless
    another is chosen on it: a run of covers shading into one another is what
    a rack is for. The list keeps the library's.
  */
  const byColours = rack && seenAlbums && rackSort === 'colour';
  const albumColours = useAlbumColours(narrowed, byColours);
  /*
    The rack's records in the rack's order, kept whatever view is in front:
    the rack stands, shut, while another is (see where it is drawn), and an
    order that went with the view would have it put in order again, out of
    sight, at every change.
  */
  const rackAlbums = useMemo(() => {
    if (!seenAlbums || !rack) return [];
    if (rackSort !== 'colour') return sortAlbums(narrowed, rackSort, played);
    return byColour(sortAlbums(narrowed, 'name', played), (album) => albumColours.get(album.key));
  }, [albumColours, narrowed, played, rack, rackSort, seenAlbums]);
  // The list's, in the library's order: the list stands under the rack, and is not put in the rack's order and back with each change of view.
  const albums = useMemo(() => (seenAlbums ? sortAlbums(narrowed, sort, played) : []), [narrowed, played, seenAlbums, sort]);

  /**
   * Records whose name the query matched, for jumping straight to one.
   *
   * Only while browsing by track and only while searching. In the album view
   * the list is already the answer, and with no query every record in the
   * library would qualify.
   */
  const matchedAlbums = useMemo(() => {
    const needle = searched.trim().toLowerCase();
    if (albumView || needle.length === 0) return [];
    return narrowAlbums(records, results)
      // By its name: the key carries its artist as well.
      .filter((entry) => nameOfKey(entry.key).includes(needle))
      .slice(0, 3);
  }, [albumView, records, results, searched]);

  /*
    The whole library under its artists, and under its folders.

    From the library and not from the search results, unlike the records above.
    A record narrowed by a query is still that record; an artist built from the
    tracks a query happened to match would be the same name with a different
    count beside it on every keystroke. What is typed narrows the headings
    instead, by name, below.

    Only once the view has been drawn. Reading every credit in the library
    is not free, and somebody who never opens the artists has no use for the
    answer; once it has been, it is kept for coming back to.
  */
  const seenArtists = visited.has('artists');
  const seenFolders = visited.has('folders');
  const artists = useMemo(
    // Told the language, for the one heading whose name is the app's own words.
    () => (seenArtists ? artistsOf(music, namesOn, t) : []),
    [music, namesOn, t, seenArtists]
  );
  const folders = useMemo(
    () => (seenFolders ? foldersOf(library, libraryRoot()) : []),
    [library, seenFolders]
  );

  /*
    Put in order apart from the grouping, so that a tap on the button arranges
    a few hundred headings and does not read every credit in the library again.
  */
  const orderedArtists = useMemo(
    () => sortArtists(artists, artistSort, counts),
    [artistSort, artists, counts]
  );
  const orderedFolders = useMemo(() => sortFolders(folders, folderSort), [folderSort, folders]);

  /*
    What the rows of those two views draw, narrowed by the query — and the
    records' rows with them, which the query has already narrowed.

    Kept apart from the grouping so that typing folds a few hundred names and
    does not sort the library into them again. Put into one shape so the three
    views can share a list: a row does not care which of them it came from.
  */
  /*
    Each view's own, worked out once it has been opened and kept: the three
    lists stay standing under one another, so that going from one view to
    another shows one that is already there rather than building it again.
  */
  const albumHeadings = useMemo((): Heading[] => {
    if (!seenAlbums) return NO_HEADINGS;
    return albums.map((album) => ({
      id: album.key,
      title: album.name,
      by: album.artist,
      detail: [t.common.tracks(album.tracks.length), album.year].filter(Boolean).join(' · '),
      tracks: album.tracks,
      // One cover, not four: a record has its own, found among its tracks.
      cover: album.tracks,
    }));
  }, [albums, seenAlbums, t]);
  const artistHeadings = useMemo((): Heading[] => {
    if (!seenArtists) return NO_HEADINGS;
    return searchNamed(orderedArtists, searched, (artist) => artist.name).map((artist) => ({
      id: artist.key,
      title: artist.name,
      detail: `${t.common.tracks(artist.tracks.length)} · ${t.common.albums(artist.albums.length)}`,
      tracks: artist.tracks,
      cover: artist.sleeve,
    }));
  }, [orderedArtists, searched, seenArtists, t]);
  const folderHeadings = useMemo((): Heading[] => {
    if (!seenFolders) return NO_HEADINGS;
    // The library folder itself has no path from itself, so it is looked for
    // by its name, which is what its row says.
    return searchNamed(orderedFolders, searched, (folder) => folder.path || folder.name).map((folder) => ({
      id: folder.key,
      title: folder.name,
      // Where it is, for a folder that is not directly under the library's
      // own: `Live` on its own says nothing about whose.
      detail:
        folder.path && folder.path !== folder.name
          ? `${t.common.tracks(folder.tracks.length)} · ${folder.path}`
          : t.common.tracks(folder.tracks.length),
      tracks: folder.tracks,
      // One cover, as for a record. Four would be four files opened per row
      // to say nothing more about a folder than one does.
      cover: folder.tracks,
    }));
  }, [orderedFolders, searched, seenFolders, t]);
  const headingsOf: Record<(typeof GROUPED_VIEWS)[number], Heading[]> = useMemo(
    () => ({ albums: albumHeadings, artists: artistHeadings, folders: folderHeadings }),
    [albumHeadings, artistHeadings, folderHeadings]
  );
  const shownHeadings = grouped ? headingsOf[view] : NO_HEADINGS;
  /** What the fast scroller says of a heading, by the order its view is in. */
  const headingLabel = useCallback(
    (kind: (typeof GROUPED_VIEWS)[number], heading: Heading): string => {
      const order = kind === 'albums' ? sort : kind === 'artists' ? artistSort : folderSort;
      if (order === 'name') return letterLabel(heading.title);
      if (order === 'tracks') return t.format.number(heading.tracks.length);
      if (order === 'added') return monthLabel(latest(heading.tracks.map((track) => track.addedAt)), months);
      if (kind === 'artists') return `${t.format.number(heading.tracks.reduce((sum, track) => sum + (counts.get(track.id) ?? 0), 0))}×`;
      return monthLabel(latest(heading.tracks.map((track) => played.get(track.id))), months);
    },
    [artistSort, counts, folderSort, months, played, sort, t]
  );
  /** What a view of headings says where it has none, as a list and as a wall of covers alike. */
  const emptyOf = useMemo(() => {
    const of = (kind: (typeof GROUPED_VIEWS)[number]) =>
      kind === 'albums' ? (
        <Text style={styles.muted}>{t.library.noAlbums}</Text>
      ) : (
        <Text style={styles.empty}>
          {query.trim()
            ? t.library.nothingMatches(query)
            : t.library.screen.noFolders}
        </Text>
      );
    return { albums: of('albums'), artists: of('artists'), folders: of('folders') };
  }, [query, styles, t]);
  const tracksEmpty = useMemo(() => <Text style={styles.empty}>{t.library.nothingMatches(query)}</Text>, [query, styles, t]);
  const headingsEmpty = (kind: (typeof GROUPED_VIEWS)[number]) => emptyOf[kind];

  /*
    The tapes: the tracks the search left that are books, podcasts or long
    recordings, those part way through first. See `lib/tapes`.
  */
  const places = useTapePlaces();
  // Fetching them, on a phone that can fetch.
  const tapesFetchable = downloads != null;
  const seenTapes = visited.has('tapes');
  const tapeResults = useMemo(
    () => (seenTapes ? orderTapes(found.filter((track) => isTape(track)), places) : NO_TRACKS),
    [found, places, seenTapes]
  );
  const allTapes = useMemo(() => (seenTapes ? library.filter((track) => isTape(track)) : NO_TRACKS), [library, seenTapes]);

  /*
    The podcasts followed, each one row in place of its episodes, above the
    other tapes: a series is looked through and managed on its own screen.
    Read on coming back, since that screen may have followed or let one go.
  */
  const [followed, setFollowed] = useState<Subscription[]>([]);
  useFocusEffect(
    useCallback(() => {
      // After the tab is on the screen: see `load` below.
      const later = setTimeout(() => {
        try {
          // The same shows as before kept as they were: a new list of them is every row of the tapes laid out again.
          const now = subscriptions();
          setFollowed((before) => (JSON.stringify(before) === JSON.stringify(now) ? before : now));
        } catch {
          // No podcasts table yet: none followed.
        }
      }, 0);
      return () => clearTimeout(later);
    }, [])
  );
  const marksMade = useAllMarks().length > 0;
  // The followed shows whose episodes are laid out under them, by feed.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Which of the tapes view's parts are shown: all of them, or one.
  const [tapeFilter, setTapeFilter] = useState<TapeFilter>(() => asTapeFilter(readSetting(SETTINGS.libraryTapeFilter)));
  const tapeView = useMemo((): { rows: TapeRow[]; counts: Record<Exclude<TapeFilter, 'all'>, number>; shown: TapeFilter } => {
    if (!seenTapes) return { rows: NO_TAPE_ROWS, counts: NO_TAPE_COUNTS, shown: 'all' };
    const series = seriesByFolder(followed);
    const episodes = new Map<string, EnrichedTrack[]>();
    const singles: EnrichedTrack[] = [];
    for (const track of tapeResults) {
      const show = seriesOf(track, series);
      if (!show) singles.push(track);
      else episodes.set(show.feedUrl, [...(episodes.get(show.feedUrl) ?? []), track]);
    }
    const asked = searched.trim().toLocaleLowerCase();
    const shows = followed.filter((show) => !asked || episodes.has(show.feedUrl) || show.title.toLocaleLowerCase().includes(asked));
    // When any of [tracks] was last listened to, and when the newest of them came: what the orders go by.
    const heardAt = (tracks: readonly EnrichedTrack[]) => tracks.reduce((latest, track) => Math.max(latest, places.get(track.id)?.at ?? 0), 0);
    const addedAt = (tracks: readonly EnrichedTrack[]) => tracks.reduce((latest, track) => Math.max(latest, track.addedAt ?? 0), 0);
    type Unit = { title: string; added: number; heard: number; rows: TapeRow[] };
    /*
      Each part in the order chosen: by name, by what came newest, or — the
      first and usual — as the tapes are shown, the ones part way through
      first, the one listened to last at the top.
    */
    const ordered = (units: Unit[]) =>
      tapeSort === 'name'
        ? [...units].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
        : tapeSort === 'added'
          ? [...units].sort((a, b) => b.added - a.added)
          : units;
    /*
      The other tapes, a folder of several as one row — a book's parts, the
      videos of one channel — laid out under it when opened, and a tape on
      its own as itself. A folder whose files are numbered parts is a book,
      and goes with the books; one channel's videos go with the tapes. Not
      the Tapes folder itself: what is put loose in it is nothing's parts.
    */
    const folders = new Map<string, EnrichedTrack[]>();
    for (const track of singles) {
      const key = folderKey(track.folder ?? '').toLocaleLowerCase();
      folders.set(key, [...(folders.get(key) ?? []), track]);
    }
    const placed = new Set<string>();
    const books: Unit[] = [];
    const loose: Unit[] = [];
    for (const track of singles) {
      const folder = folderKey(track.folder ?? '');
      const key = folder.toLocaleLowerCase();
      const together = folders.get(key) ?? [];
      const name = folder.split('/').pop() ?? '';
      if (together.length < 2 || !name || (TAPE_FOLDERS as readonly string[]).includes(name.toLocaleLowerCase())) {
        loose.push({ title: track.title, added: track.addedAt ?? 0, heard: heardAt([track]), rows: [{ kind: 'tape', id: track.id, track }] });
        continue;
      }
      if (placed.has(key)) continue;
      placed.add(key);
      const parts = inSeriesOrder(together);
      const show: SeriesShow = { feedUrl: `folder:${folder}`, title: name, image: null };
      const row: TapeRow = { kind: 'series', id: `book:${key}`, show, episodes: parts, book: true };
      const rows = expanded.has(show.feedUrl) ? [row, ...parts.map((part): TapeRow => ({ kind: 'episode', id: part.id, track: part }))] : [row];
      const numbered = parts.some((part) => /^\d{1,4} - /.test(part.filename ?? ''));
      (numbered ? books : loose).push({ title: name, added: addedAt(parts), heard: heardAt(parts), rows });
    }
    const showUnits: Unit[] = shows.map((show) => {
      const here = episodes.get(show.feedUrl);
      const parts = here ? inSeriesOrder(here) : NO_TRACKS;
      const row: TapeRow = { kind: 'series', id: `series:${show.feedUrl}`, show, episodes: parts };
      // Laid out newest first, as its own screen lists them.
      const rows = expanded.has(show.feedUrl) ? [row, ...[...parts].reverse().map((track): TapeRow => ({ kind: 'episode', id: track.id, track }))] : [row];
      return { title: show.title, added: show.subscribedAt, heard: heardAt(parts), rows };
    });
    // Shows have no order of their own to begin with: the one listened to last first, then by name.
    const seriesOrdered =
      tapeSort === 'played'
        ? [...showUnits].sort((a, b) => b.heard - a.heard || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
        : ordered(showUnits);
    const all = [
      { key: 'series' as const, id: 'heading:series', title: t.library.tapes.seriesHeading, units: seriesOrdered },
      { key: 'books' as const, id: 'heading:books', title: t.library.tapes.booksHeading, units: ordered(books) },
      { key: 'tapes' as const, id: 'heading:singles', title: t.library.tapes.singlesHeading, units: ordered(loose) },
    ];
    const counts = { series: showUnits.length, books: books.length, tapes: loose.length };
    // The part chosen, while it has anything in it; all of them otherwise, so a filter never leaves the view empty.
    const shown: TapeFilter = tapeFilter !== 'all' && counts[tapeFilter] > 0 ? tapeFilter : 'all';
    const parts = all.filter((part) => part.units.length > 0 && (shown === 'all' || part.key === shown));
    /*
      In the order they were last listened to, all of them together: one
      list, the one listened to last at the top whatever it is, the parts
      not told apart — a show, a book and a tape each say by their row what
      they are, and the filter shows one kind alone. Those never listened to
      after, each kind as it is shown.
    */
    if (tapeSort === 'played' && shown === 'all' && parts.length > 1) {
      const together = parts.flatMap((part) => part.units);
      const rows = together
        .map((unit, at) => ({ unit, at }))
        .sort((a, b) => b.unit.heard - a.unit.heard || a.at - b.at)
        .flatMap(({ unit }) => unit.rows);
      return { rows, counts, shown };
    }
    // Headings only where there is more than one part to tell apart.
    const rows = parts.flatMap((part): TapeRow[] => [
      ...(parts.length > 1 ? [{ kind: 'heading', id: part.id, title: part.title } as const] : []),
      ...part.units.flatMap((unit) => unit.rows),
    ]);
    return { rows, counts, shown };
  }, [expanded, followed, places, searched, seenTapes, t, tapeFilter, tapeResults, tapeSort]);
  const tapeRows = tapeView.rows;
  const chooseTapeFilter = useCallback((next: TapeFilter) => {
    haptic('choices', 'click');
    setTapeFilter(next);
    writeSetting(SETTINGS.libraryTapeFilter, next);
  }, []);

  /*
    The parts of the tapes view to choose between, over the list: all of
    them, or the followed shows, the books or the other tapes alone, each
    saying how many it holds as the search leaves them. Only the parts with
    something in them, and none of it where there is only one part, which
    leaves nothing to choose.
  */
  const tapeFilters = (['series', 'books', 'tapes'] as const).filter((key) => tapeView.counts[key] > 0);
  const tapeFilterBar =
    tapeFilters.length > 1 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tapeFiltersOut} contentContainerStyle={styles.tapeFilters}>
        {(['all', ...tapeFilters] as const).map((key) => {
          const on = tapeView.shown === key;
          const count = key === 'all' ? tapeFilters.reduce((sum, one) => sum + tapeView.counts[one], 0) : tapeView.counts[key];
          return (
            <Pressable
              key={key}
              android_ripple={pressed}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t.library.tapes.filter[key]}, ${count}`}
              style={[styles.tapeFilter, on && styles.tapeFilterOn]}
              onPress={() => chooseTapeFilter(key)}>
              <Text style={on ? styles.tapeFilterLabelOn : styles.tapeFilterLabel}>{t.library.tapes.filter[key]}</Text>
              <Text style={on ? styles.tapeFilterCountOn : styles.tapeFilterCount}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    ) : null;
  const allTapesRef = useRef(allTapes);

  // Read at press time, as the results are below, so the handlers every row is
  // given stay the same functions across a search or a change of order.
  const headingsRef = useRef(shownHeadings);
  // And the view, for the same reason: the lists of every view opened are standing, and given the same handlers.
  const viewRef = useRef(view);
  /*
    Brought up to date as each drawing is put on the screen, before anything
    on it can be pressed: written while drawing, as they were, they kept the
    React Compiler off this whole screen, and every drawing of it drew every
    part of it again.
  */
  useLayoutEffect(() => {
    allTapesRef.current = allTapes;
    headingsRef.current = shownHeadings;
    viewRef.current = view;
  });

  /*
    A tap opens the heading, and while tracks are being chosen it chooses the
    heading's instead — all of them, or none if all were already chosen.

    Holding one is how choosing starts from a row. Once it has started, holding
    does what a tap does, as it does on a track.
  */
  const onHeadingPress = useCallback(
    (id: string) => {
      /*
        Sideways a record opens as it does from the rack, over the library and
        beside the tabs, and not as a screen of its own over all of it: the
        same record the same way, whichever way the albums are shown.
      */
      const record = !selecting && landscape && viewRef.current === 'albums' ? records.find((each) => each.key === id) : undefined;
      if (record) {
        Keyboard.dismiss();
        setOpened({ album: record, sleeve: null });
        return;
      }
      if (!selecting) {
        router.push({
          pathname: '/playlist',
          params:
            viewRef.current === 'albums'
              ? { album: id }
              : viewRef.current === 'artists'
                ? { artist: id }
                : { folder: id },
        });
        return;
      }
      const under = headingsRef.current.find((heading) => heading.id === id)?.tracks;
      if (under) setSelected((held) => withGroupToggled(held, under));
    },
    [landscape, records, router, selecting]
  );

  const chooseUnder = useCallback((id: string) => {
    const under = headingsRef.current.find((heading) => heading.id === id)?.tracks;
    if (!under) return;
    setSelecting(true);
    setSelected((held) => withGroupToggled(held, under));
  }, []);

  /*
    An album held down opens its menu, and choosing is the first thing on it.
    An artist or a folder still goes straight to choosing, having nothing else
    to offer — and so does an album once choosing has begun, when holding is
    only a slower tap.
  */
  const [albumMenu, setAlbumMenu] = useState<{
    key: string;
    name: string;
    by?: string | null;
    detail: string;
    covers: readonly EnrichedTrack[];
    /** Held in the rack, where there is nothing to choose with. */
    racked: boolean;
  } | null>(null);
  const closeAlbumMenu = useCallback(() => setAlbumMenu(null), []);

  const onHeadingHeld = useCallback(
    (id: string) => {
      // The box may be mid-word; what was typed has done its narrowing.
      Keyboard.dismiss();
      if (viewRef.current !== 'albums' || selecting) return chooseUnder(id);
      const heading = headingsRef.current.find((entry) => entry.id === id);
      if (heading) {
        setAlbumMenu({ key: id, name: heading.title, by: heading.by, detail: heading.detail, covers: heading.cover, racked: false });
      }
    },
    [chooseUnder, selecting]
  );

  const onSleeveHeld = useCallback(
    (album: Album) =>
      setAlbumMenu({
        key: album.key,
        name: album.name,
        by: album.artist,
        detail: t.common.tracks(album.tracks.length),
        covers: album.tracks,
        racked: true,
      }),
    [t]
  );

  const findRest = useCallback(
    (album: string) => router.push({ pathname: '/album-rest', params: { album } }),
    [router]
  );

  const runAlbumAction = (action: AlbumAction) => {
    const key = albumMenu?.key;
    setAlbumMenu(null);
    if (key == null) return;
    if (action === 'select') return chooseUnder(key);
    if (action === 'rest') return findRest(key);
    if (action === 'setAside' || action === 'bringBack') {
      haptic('results', action === 'setAside' ? 'confirm' : 'toggleOff');
      return setAside('album', key, action === 'setAside');
    }

    // The whole record, and not the part of it a search has narrowed the
    // list to: what is looked up or given a cover is the record.
    const record = findAlbum(albumsOf(music), key);
    if (!record) return;
    const say = (message: string) => {
      setNote(message);
      setTimeout(() => setNote(null), 2500);
    };
    // Its progress is the line under the library's count, as any lookup's is.
    if (action === 'lookUp') void lookUpRecord(record, library);
    else {
      chooseRecordCover(record).then(
        (chosen) => {
          if (chosen != null) {
            forgetAlbumColour(record.key);
            say(t.library.albumTools.coverChosen(chosen));
          }
        },
        (error: unknown) => say(error instanceof Error ? error.message : t.common.pictureFailed)
      );
    }
  };

  /*
    Each row is told its own answer — none, some, all — and not handed the
    set. The answer is worked out here for the rows the list is actually
    drawing, a few dozen of them, and since it is a plain value the memoised
    row whose answer has not changed is not drawn again; one tick redraws the
    row ticked and any other row sharing a track with it.
  */
  // And the one in front too, while the library's tab is not the one open.
  const tabOpen = useTabOpen();
  useEffect(() => {
    if (tabOpen && keptColumns[view] !== columns) setKeptColumns((kept) => ({ ...kept, [view]: columns }));
  }, [columns, keptColumns, tabOpen, view]);
  // A view not yet brought to the front keeps what the screen was first drawn with.
  const [firstColumns] = useState(columns);
  const columnsOf = (kind: LibraryView) => (kind === view && tabOpen ? columns : (keptColumns[kind] ?? firstColumns));
  const sharedAlbums = columnsOf('albums') > 1;
  const sharedArtists = columnsOf('artists') > 1;
  const sharedFolders = columnsOf('folders') > 1;
  const tracksColumns = columnsOf('tracks');

  // One for each view's list, so that changing view gives none of them a new one to draw its rows again with.
  const renderHeadingOf = useMemo(() => {
    const rowsOf = (records: boolean, shared: boolean) =>
      ({ item }: { item: Heading }) => (
        <BrowseRow
          id={item.id}
          title={item.title}
          by={item.by}
          detail={item.detail}
          tracks={item.tracks}
          cover={item.cover}
          shared={shared}
          mark={selecting ? markOf(item.tracks, selected) : undefined}
          held={records ? t.library.albumMenu : undefined}
          onPress={onHeadingPress}
          onLongPress={onHeadingHeld}
        />
      );
    return { albums: rowsOf(true, sharedAlbums), artists: rowsOf(false, sharedArtists), folders: rowsOf(false, sharedFolders) };
  }, [onHeadingHeld, onHeadingPress, selected, selecting, sharedAlbums, sharedArtists, sharedFolders, t]);

  /** Each matched tag with the tracks carrying it, gathered once per search. */
  const tagShuffles = useMemo(
    () =>
      matchedTags.slice(0, 3).map((tag) => ({
        tag,
        tracks: music.filter((track) => track.tags.includes(tag)),
      })),
    [music, matchedTags]
  );

  // Read at press time rather than closed over, so the row handlers below stay
  // the same functions across a search that changes what is on screen.
  const resultsRef = useRef(listed);
  useLayoutEffect(() => {
    resultsRef.current = listed;
  });

  const start = useCallback(
    async (tracks: EnrichedTrack[], index: number) => {
      // Asked here rather than at startup: this is the last moment before the
      // media notification would appear, and the first at which it means
      // anything to whoever is being asked.
      await ensureNotificationPermission();
      await playQueue(tracks, index);
    },
    [playQueue]
  );

  /** A row tapped: what that plays is a choice of its own (`player/tap.ts`). */
  const playTapped = usePlayTapped();
  const tap = useCallback(
    async (tracks: EnrichedTrack[], index: number, place: TapPlace) => {
      await ensureNotificationPermission();
      await playTapped(tracks, index, place);
    },
    [playTapped]
  );

  /**
   * A sleeve's place as the open record needs it: from the corner of the
   * library's own share of the window, which is what that record is drawn
   * over, rather than from the window's.
   */
  const fromMiddle = useCallback(
    (sleeve: Sleeve | null, then: (sleeve: Sleeve | null) => void) => {
      const frame = middle.current;
      if (!sleeve || !frame) return then(null);
      frame.measureInWindow((x, y) => then({ ...sleeve, x: sleeve.x - x, y: sleeve.y - y }));
    },
    []
  );

  /*
    The rack made again, at the record it was on, when its order changes --
    another order chosen, or the colours of the covers come in: otherwise it
    would stay where it was by number, in front of some other record.
  */
  const rackOrder = `${rackSort}:${byColours ? albumColours.size : 0}`;
  const rackIndex = useMemo(() => Math.max(0, rackAlbums.findIndex((album) => album.key === rackKey)), [rackAlbums, rackKey]);
  const settleRack = useCallback((index: number) => setRackKey(rackAlbums[index]?.key ?? null), [rackAlbums]);
  /*
    Upright the rack is as tall as it needs to be for sleeves the width
    allows, and never more than some two fifths of the screen: what is under
    it is the record's tracks.
  */
  const rackTall = Math.round(Math.min(screenSize.height * 0.42, screenSize.width * 0.74));

  const openAlbum = useCallback(
    (album: Album, where: Sleeve) =>
      fromMiddle(where, (sleeve) => {
        if (!sleeve) return;
        // The box may be mid-word, and a keyboard left up over a list with
        // nothing to type into is only in the way.
        Keyboard.dismiss();
        setOpened({ album, sleeve });
      }),
    [fromMiddle]
  );

  /*
    Where that sleeve is by the time the record is put back. The rack answers
    for itself, and has nothing to say if it has since been taken down or has
    another record in front; then there is nowhere to fly back to.
  */
  const openedKey = opened?.album.key ?? null;
  const sleeveNow = useCallback(
    (then: (sleeve: Sleeve | null) => void) => {
      if (!shelf.current || openedKey == null) return then(null);
      shelf.current.sleeveOf(openedKey, (sleeve) => fromMiddle(sleeve, then));
    },
    [fromMiddle, openedKey]
  );

  const closeAlbum = useCallback(() => setOpened(null), []);

  /*
    The open record, less whatever has been erased since it was opened.

    It was taken out of the rack as it stood then, and is not read again: the
    rack may have been narrowed by a search or taken down altogether since. But
    its menu can erase a file, and a row left standing for a track that no
    longer exists would be played, or erased, a second time. An emptied record
    is put back, there being nothing left on it to show.
  */
  const openedAlbum = useMemo(() => {
    if (!opened || screen.kind !== 'library') return opened?.album ?? null;
    const here = new Set(library.map((track) => track.id));
    const tracks = opened.album.tracks.filter((track) => here.has(track.id));
    return tracks.length === opened.album.tracks.length
      ? opened.album
      : { ...opened.album, tracks };
  }, [library, opened, screen.kind]);
  useEffect(() => {
    if (openedAlbum && openedAlbum.tracks.length === 0) setOpened(null);
  }, [openedAlbum]);

  const playFrom = useCallback(
    (tracks: EnrichedTrack[], index: number) => void start(tracks, index),
    [start]
  );
  const tapInAlbum = useCallback(
    (tracks: EnrichedTrack[], index: number) => void tap(tracks, index, 'page'),
    [tap]
  );

  const toggleSelected = useCallback((track: EnrichedTrack) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(track.id)) next.delete(track.id);
      else next.add(track.id);
      return next;
    });
  }, []);

  const onRowPress = useCallback(
    (track: EnrichedTrack) => {
      if (selecting) {
        toggleSelected(track);
        return;
      }
      const index = resultsRef.current.indexOf(track);
      if (index >= 0) void tap(resultsRef.current, index, 'tracks');
    },
    [selecting, tap, toggleSelected]
  );

  // A tape plays with the rest of its record after it, the parts of a book or a show's episodes in their order.
  const onTapePress = useCallback(
    (track: EnrichedTrack) => {
      if (selecting) {
        toggleSelected(track);
        return;
      }
      // The one playing is left where it is, and played on if it was paused: put on again, it would go back a little.
      if (track.id === currentTrack.get()) {
        if (playingTrack.get() == null) void toggle();
        return;
      }
      // An episode of a followed show plays with the rest of the show, in the order they came out; a part with its record.
      const { tracks, index } = tapeQueueOf(track, allTapesRef.current);
      void start(tracks, index);
    },
    [selecting, start, toggle, toggleSelected]
  );

  /** Leaves the mode and forgets the run; one never outlives the other. */
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  // Back ends a selection, as the button that began it would, rather than leaving the app with it.
  useBackInFront(selecting, stopSelecting);
  // And empties a search typed into the list: the keyboard is closed by the first press, the words by the next.
  useBackInFront(query !== '', () => setQuery(''));

  /*
    Asks for the library to be looked at again, and reads what this screen
    keeps for itself beside it. The looking is cheap and mostly finds nothing:
    see `lib/library/store.ts` for when it turns into a reading. [force] is
    for somebody pressing a button that says so.
  */
  const load = useCallback(async (force = false) => {
    await refreshLibrary(force);
    const read = readListening();
    if (!read) return;
    // With the library and not once: a lookup made on another screen may have
    // settled whether a credit is one artist or two.
    setNamesOn(() => read.reader);
    // Kept as the maps they were when they say what they said: the list is put
    // in order again for a new one, and a visit on which nothing was played in
    // between should cost no more than the asking.
    setPlayed((before) => keepMap(before, read.latest));
    setCounts((before) => keepMap(before, read.listens));
  }, []);

  /*
    A look at the device that failed while a library was on show leaves the
    library where it is, and says so here rather than taking the list away to
    say it: what is on screen was true a moment ago and very likely still is.
  */
  const failure = screen.kind === 'library' ? screen.failure : null;
  useEffect(() => {
    if (failure == null) return;
    setNote(failure);
    const gone = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(gone);
  }, [failure]);

  /*
    The long-press menu and the list picker behind it, which every screen that
    shows tracks has the same one of. The picker is borrowed for a whole
    selection as well, so what it did is said and the selection ended here.
  */
  const { open: openMenu, run: runMenu, addToList, erase, element: menuElement, veiled: menuVeiled } = useTrackMenu({
    onChanged: () => void load(),
    onAdded: (message) => {
      setNote(message);
      // Said once and then gone. A line that stays says the thing happened
      // just now, long after it did.
      setTimeout(() => setNote(null), 2500);
      if (selecting) stopSelecting();
    },
  });

  const openFromAlbum = useCallback(
    (track: EnrichedTrack) => openMenu(track, WITHOUT_ALBUM),
    [openMenu]
  );
  /*
    What the walls of covers are handed, kept the same from one drawing of
    this screen to the next. Made afresh each time, as they were, they had
    every wall -- every size of every view, standing behind its list -- lay
    out its rows again and draw each of them anew whenever anything here
    changed, the view chosen with it: a change of view waited a third of a
    second on walls nobody was looking at.
  */
  const wallOf = useMemo(() => {
    const of = (kind: (typeof GROUPED_VIEWS)[number]) => ({
      labelOf: (heading: Heading) => headingLabel(kind, heading),
      onPress: (heading: Heading) => onHeadingPress(heading.id),
      onLongPress: (heading: Heading) => onHeadingHeld(heading.id),
    });
    return { albums: of('albums'), artists: of('artists'), folders: of('folders') };
  }, [headingLabel, onHeadingHeld, onHeadingPress]);
  const wallTrackLongPress = useCallback((track: EnrichedTrack) => openMenu(track), [openMenu]);
  // What a tap on the row plays, as chosen in Settings, not always the list from there.
  const wallTrackPress = useCallback((_track: EnrichedTrack, index: number) => void tap(listed, index, 'tracks'), [listed, tap]);
  // A row held and slid from, with the finger never lifted: see `pressMenu.ts`. On a record's own page, without the way to it.
  const ring = useTrackRing({ open: openMenu, run: runMenu });
  const albumRing = useTrackRing({ open: openMenu, run: runMenu }, WITHOUT_ALBUM);

  // A selection is left as it is. It is tracks whichever view it was made in,
  // every view can show it and end it, and choosing an artist and then going to
  // the tracks to let two of them go is a thing worth being able to do. Not
  // between the music and the tapes, though: what can be done to the one is
  // nothing to do to the other, so going across ends it.
  const chooseView = useCallback(
    (next: LibraryView) => {
      if (selecting && (next === 'tapes') !== (view === 'tapes')) stopSelecting();
      setRemembered(next);
      writeSetting(SETTINGS.libraryView, next);
    },
    [selecting, stopSelecting, view]
  );

  /*
    The switch stepping aside for the search box.

    Its width has to be measured rather than declared, because it is the width
    of a few words in whatever font the phone ended up using. Measured once, on
    the layout that happens before anything animates: after that the view is
    being given a width, and reading it back would be reading the animation.
  */
  const [searching, setSearching] = useState(false);
  /*
    Once for each set of words, that is. The switch says whichever views are
    on offer, so the measurement is kept with the set it was taken of, and a
    different set coming back from Settings finds nothing measured for it and
    is laid out freely until it has been.
  */
  const offering = offered.join(',');
  const [measured, setMeasured] = useState({ of: '', width: 0 });
  const viewsWidth = measured.of === offering ? measured.width : 0;
  const measureViews = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (viewsWidth === 0 && width > 0) setMeasured({ of: offering, width });
    },
    [offering, viewsWidth]
  );

  /*
    Where the switch goes once it has more than two things to say.

    Two words fit beside the search box and four do not: upright they would
    leave the box narrower than its own placeholder. So past two the switch is
    given the row above to itself, across the whole width, where each view is
    also a bigger thing to hit. Sideways there is the width to keep it beside
    the box whatever it says, and no height to spend on a row for it.
  */
  const stacked = offered.length > 2 && !landscape;

  /*
    Only upright. Sideways the row is half again as wide and the box already
    has more than it can use, so there is nothing to be gained by taking the
    switch away — and rotating mid-search would otherwise strand it.
  */
  const aside = searching && !landscape;
  const [reveal] = useState(() => new Animated.Value(1));
  useEffect(() => {
    // Straight there where the decoration is to hold still.
    if (motionReduced()) {
      reveal.setValue(aside ? 0 : 1);
      return;
    }
    Animated.timing(reveal, {
      toValue: aside ? 0 : 1,
      duration: 190,
      easing: Easing.out(Easing.quad),
      // Width is a layout property, which the native driver cannot touch. One
      // small view for a fifth of a second is well within what JavaScript can
      // keep up with.
      useNativeDriver: false,
    }).start();
  }, [aside, reveal]);

  /*
    Nothing until the width is known, so the first layout is the one that
    measures. The gap to the search box is animated with it — left behind, it
    is ten points of nothing where the switch used to be.
  */
  // The switch and, where any view has another look, the view button beside it, as wide as the sort and a gap away.
  const slotWidth = viewsWidth + (offered.some(lookable) ? SORT_WIDTH + 6 : 0);
  const slot = viewsWidth
    ? {
        width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, slotWidth] }),
        marginRight: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
        opacity: reveal,
      }
    : null;

  /*
    The sort button leaves with the switch, and for the same reason: while a
    query is being typed the box wants everything it can get, and nobody
    reaches for the order of a list they are in the middle of narrowing.

    Its own width is known in advance, so unlike the switch it needs no
    measuring pass. The negative margin on the way out is the row's `gap`: a
    child collapsed to no width still has one on either side of it, and without
    taking one back there would be a dozen points of nothing where the button
    had been.
  */
  const sortSlot = {
    width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, SORT_WIDTH] }),
    marginRight: reveal.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
    opacity: reveal,
  };

  /*
    Two things worth doing to a row without opening anything, reached by
    pulling it aside: the pair of queue entries out of its menu, which is most
    of what that menu gets opened for.

    Held back while rows are being chosen — a sideways pull is what picks a run
    of them then, and one gesture cannot mean both.
  */
  const renderItem = useCallback(
    ({ item }: { item: EnrichedTrack }) => (
      <SwipeRow
        style={tracksColumns > 1 ? styles.swipeShared : undefined}
        enabled={!selecting}
        left={{
          label: t.library.screen.swipePlayNext,
          colour: c.accentSoft,
          tint: c.accent,
          onAct: () => void playNext(item),
        }}
        right={{
          label: t.library.screen.swipeQueue,
          colour: c.successSoft,
          tint: c.success,
          onAct: () => void addToQueue(item),
        }}>
        <PressRing ring={ring} item={item as EnrichedTrack} enabled={!selecting}>
        <TrackRow
          // Whether it is the one playing, it asks the player itself: told it here, every row was drawn again at each change of song.
          track={item}
          onPress={onRowPress}
          // The per-track menu would be reached by the same gesture that picks a
          // row, so while choosing it steps aside.
          onLongPress={selecting ? toggleSelected : openMenu}
          // The pull either way, as actions a screen reader can name; held
          // back while choosing, as the pull itself is.
          onPlayNext={selecting ? undefined : playNextTrack}
          onAddToQueue={selecting ? undefined : queueTrack}
          selectable={selecting}
          selected={selected.has(item.id)}
        />
        </PressRing>
      </SwipeRow>
    ),
    [addToQueue, c, tracksColumns, onRowPress, openMenu, playNext, playNextTrack, queueTrack, ring, selected, selecting, styles, t, toggleSelected]
  );

  const expandSeries = useCallback((show: SeriesShow) => {
    setExpanded((now) => {
      const next = new Set(now);
      if (next.has(show.feedUrl)) next.delete(show.feedUrl);
      else next.add(show.feedUrl);
      return next;
    });
  }, []);

  // A show ticked while choosing is all its episodes ticked, or all let go once every one of them was.
  const selectSeries = useCallback((episodes: readonly EnrichedTrack[]) => {
    setSelected((current) => {
      const next = new Set(current);
      const all = episodes.every((episode) => next.has(episode.id));
      for (const episode of episodes) {
        if (all) next.delete(episode.id);
        else next.add(episode.id);
      }
      return next;
    });
  }, []);

  // A show's button: the episode it offers paused where it is playing, played or played on otherwise.
  const playFromSeries = useCallback(
    (track: EnrichedTrack) => {
      if (track.id === playingTrack.get()) void toggle();
      else onTapePress(track);
    },
    [onTapePress, toggle]
  );

  // A followed show's own screen; a folder of tapes, its page, where it plays in its order.
  const openSeries = useCallback(
    (show: SeriesShow) =>
      show.feedUrl.startsWith('folder:')
        ? router.push({ pathname: '/playlist', params: { folder: show.feedUrl.slice('folder:'.length) } })
        : router.push({ pathname: '/podcast', params: { feed: show.feedUrl } }),
    [router]
  );

  // A tape's row: no pulling aside, since what is next in the queue is not how a book is listened to.
  const renderTape = useCallback(
    ({ item }: { item: TapeRow }) =>
      item.kind === 'heading' ? (
        <Text accessibilityRole="header" style={styles.tapesHeading}>{t.format.upper(item.title)}</Text>
      ) : item.kind === 'series' ? (
        <SeriesRow
          show={item.show}
          episodes={item.episodes}
          places={places}
          onPress={openSeries}
          onPlay={playFromSeries}
          expanded={expanded.has(item.show.feedUrl)}
          onExpand={expandSeries}
          book={item.book}
          selectable={selecting}
          selected={tickedOf(item.episodes, selected)}
          onSelect={() => selectSeries(item.episodes)}
        />
      ) : item.kind === 'episode' ? (
        // Set in under its show, as one of it.
        <View style={styles.tapeEpisode}>
          <PressRing ring={ring} item={item.track as EnrichedTrack} enabled={!selecting}>
          <TrackRow
            track={item.track}
            onPress={onTapePress}
            onLongPress={selecting ? toggleSelected : openMenu}
            selectable={selecting}
            selected={selected.has(item.track.id)}
          />
          </PressRing>
        </View>
      ) : (
        // A tape on its own, with a button that carries it on as a show's and a book's have.
        <PressRing ring={ring} item={item.track as EnrichedTrack} enabled={!selecting}>
        <TapeItemRow
          track={item.track}
          place={places.get(item.track.id) ?? null}
          onPress={onTapePress}
          onPlay={playFromSeries}
          onLongPress={selecting ? toggleSelected : openMenu}
          selectable={selecting}
          selected={selected.has(item.track.id)}
        />
        </PressRing>
      ),
    [expandSeries, expanded, onTapePress, openMenu, openSeries, playFromSeries, places, ring, selectSeries, selected, selecting, styles, t, toggleSelected]
  );

  /*
    Where the list was left, so returning to the tab returns to the same place.

    Held in a ref rather than in state: it changes on every frame of a scroll
    and nothing on screen depends on it, so storing it in state would re-render
    the whole library to record a number only the list itself reads back.
  */
  const restoreTo = useRef(0);
  const tracksStart = useStartingOffset(tracksColumns, () => restoreTo.current);

  /*
    Each view's list, and how far down the ones other than the tracks' were
    when they last came to rest: for the tab pressed again, which takes the
    one in front back to its top. Noted where a scroll ends rather than at
    every step of it, as nothing else needs it.
  */
  const lists = useRef<Partial<Record<LibraryView, Scrolls | null>>>({});
  const restedAt = useRef<Partial<Record<LibraryView, number>>>({});
  // Each view's stack of list and walls, for a wall on screen to be taken back to its top.
  const stacks = useRef<Partial<Record<ZoomedView, StackApi>>>({});
  // The artists' map's step back toward the whole of it: see `ArtistMap`.
  const mapBack = useRef<(() => boolean) | null>(null);
  const registerMap = useCallback((back: () => boolean) => {
    mapBack.current = back;
  }, []);
  const shuffleMap = useCallback((tracks: EnrichedTrack[]) => void start(spreadShuffle(tracks, artistKey), 0), [start]);
  const searchBox = useRef<SearchBox>(null);
  const tracksList = useCallback(
    (list: Scrolls | null) => {
      tracksStart.ref(list);
      lists.current.tracks = list;
    },
    [tracksStart]
  );
  const listOf = useMemo(() => {
    const refs: Partial<Record<LibraryView, (list: Scrolls | null) => void>> = {};
    const ends: Partial<Record<LibraryView, Omit<typeof followsScrolling, keyof ScrollEnds> & ScrollEnds>> = {};
    for (const kind of [...GROUPED_VIEWS, 'tapes'] as const) {
      refs[kind] = (list) => {
        lists.current[kind] = list;
      };
      const rest = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        restedAt.current[kind] = event.nativeEvent.contentOffset.y;
      };
      ends[kind] = {
        ...followsScrolling,
        onScrollEndDrag: (event) => {
          followsScrolling.onScrollEndDrag();
          rest(event);
        },
        onMomentumScrollEnd: (event) => {
          followsScrolling.onMomentumScrollEnd();
          rest(event);
        },
      };
    }
    return { refs, ends };
  }, []);

  /*
    The tab pressed again, a step back toward the start at each press: out of
    choosing, the record taken out put back, the list in front to its top,
    the search cleared, and then to the first of the views on offer -- the
    tracks, unless they are switched off -- and from there on to each of the
    others in turn and round again. Not into the search box, which it once
    ended in: the keyboard coming up for a press of the tab was not what
    anybody pressing it was after.
  */
  // The view a press of the tab last went to, so that the next goes on from it rather than back to the first.
  const cycledTo = useRef<LibraryView | null>(null);
  useTabReselect(() => {
    if (selecting) return stopSelecting();
    if (opened) return closeAlbum();
    // Seen from further off, the rack is brought back near first.
    if (racked && shelf.current?.nearer()) return;
    // The wall of covers in front, where one is, rather than the list put away behind it.
    const walled = view === 'tracks' ? trackLook !== 'shelves' && zooms.tracks > 0 : view !== 'tapes' && zooms[view] > 0;
    if (racked) {
      if (shelf.current?.toStart()) return;
    } else if (view === 'artists' && artistMap) {
      // The map as a whole again, and nobody chosen on it.
      if (mapBack.current?.()) return;
    } else if (walled) {
      if (stacks.current[view as ZoomedView]?.toTop()) return;
    } else {
      const at = view === 'tracks' ? restoreTo.current : (restedAt.current[view] ?? 0);
      if (backToTop(lists.current[view], at, Dimensions.get('window').height)) {
        if (view === 'tracks') restoreTo.current = 0;
        else restedAt.current[view] = 0;
        return;
      }
    }
    if (query) return setQuery('');
    if (offered.length < 2) return;
    const at = offered.indexOf(view);
    const next = view !== offered[0] && cycledTo.current !== view ? offered[0] : offered[(at + 1) % offered.length];
    if (!next) return;
    cycledTo.current = next;
    chooseView(next);
  });

  // Taken apart here, each by itself: read off the one object, everything on it was taken for a ref.
  const { wrapperRef: dragWrapper, onWrapperLayout: onDragLayout, panHandlers: dragHandlers, onScroll: dragScroll, onWidth: dragWidth } = useDragSelect({
    ids: useMemo(() => listed.map((track) => track.id), [listed]),
    rowHeight: trackRowHeight,
    columns: tracksColumns,
    enabled: selecting,
    selected,
    onChange: setSelected,
    top: topRoom,
  });
  // What the tracks' list does at each step it scrolls besides moving its scroll bar: see `onScroll` on it.
  useEffect(() => {
    fastTracks.also((event) => {
      const y = event.nativeEvent.contentOffset.y;
      restoreTo.current = y;
      dragScroll(y);
    });
    return () => fastTracks.also(null);
  });


  /*
    Everything the view is currently showing, not the whole library: the tracks
    the search left, or every track under every heading it left. Counted once
    each, since an artist's tracks are also another artist's.

    Only gathered while something is being chosen. It is asked for by the bar
    and by nothing else, and a set of the whole library built on every keystroke
    of a search would be work done for a button that is not on screen.
  */
  const shown = useMemo(
    () =>
      !selecting
        ? NOTHING_SHOWN
        : grouped
          ? tracksUnder(shownHeadings)
          : new Set((view === 'tapes' ? tapeResults : listed).map((track) => track.id)),
    [grouped, listed, selecting, shownHeadings, tapeResults, view]
  );
  const allChosen = useMemo(() => holdsAll(selected, shown), [selected, shown]);
  const selectAll = useCallback(() => setSelected(new Set(shown)), [shown]);

  const chosen = useCallback(
    () => library.filter((track) => selected.has(track.id)),
    [library, selected]
  );

  const queueSelected = useCallback(() => {
    const tracks = chosen();
    for (const track of view === 'tapes' ? inRecordOrder(tracks) : tracks) void addToQueue(track);
    stopSelecting();
  }, [addToQueue, chosen, stopSelecting, view]);

  // Tapes chosen are played one record after another, each in its order, and marked heard or not all at once.
  const playSelected = useCallback(() => {
    const tracks = inRecordOrder(chosen());
    stopSelecting();
    if (tracks.length > 0) void start(tracks, 0);
  }, [chosen, start, stopSelecting]);
  const markSelected = useCallback(
    (finished: boolean) => {
      const tracks = chosen();
      stopSelecting();
      void Promise.all(tracks.map((track) => markTape(track.id, finished, track.durationSec)));
    },
    [chosen, stopSelecting]
  );

  /*
    Tagging, writing to files, erasing and everything else the Tags screen
    can do to a selection, from the same sheet (`SelectionActions`), so that
    the two places cannot come to do them differently. Erasing goes through
    the track menu's own way, which takes the files out of the queue too.

    After an edit the selection stays, so that one thing can follow another
    on the same tracks; after a delete or a reset it is over. Backing out of
    Android's question about a delete leaves it as it was.
  */
  const chosenIds = useMemo(() => [...selected], [selected]);
  const actions = useSelectionActions({
    trackIds: chosenIds,
    addToList,
    erase,
    onChanged: (how) => {
      if (how === 'cleared') stopSelecting();
      void load();
    },
    onSaid: (line) => {
      setNote(line);
      // Longer than the list picker's line: these can be a sentence or two.
      setTimeout(() => setNote(null), 4000);
    },
    // Nothing else here says how a run ended; the line under the count only
    // follows it while it goes.
    sayRuns: true,
  });

  /*
    Re-read on focus so metadata gathered on the other screen shows up here:
    after the tab is on the screen rather than before. Asked in the same
    stroke as the tab was opened, the phone held the tab back until the
    asking was done.
  */
  useFocusEffect(
    useCallback(() => {
      const later = setTimeout(() => void load(), 0);
      return () => clearTimeout(later);
    }, [load, downloadRevision])
  );

  if (screen.kind === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (screen.kind === 'denied' || screen.kind === 'error') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.body}>
          {screen.kind === 'denied'
            ? t.library.screen.needsAccess
            : screen.message}
        </Text>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={() => void load(true)}>
          <Text style={styles.buttonLabel}>{t.common.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  if (screen.tracks.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.body}>{t.library.screen.nothingIn(libraryRoot())}</Text>
        <Text style={styles.muted}>{t.library.screen.playsEverythingBelow}</Text>
        <Text style={styles.muted}>{t.library.screen.chooseFolderInSettings}</Text>
      </View>
    );
  }

  /*
    Ways of looking at one library rather than separate collections, which is
    why this sits with the library and not in tabs of its own.

    Beside the search rather than above it, and small: it is read once on the
    way past and pressed rarely, while the box next to it is the reason most
    people come to this screen. A row of its own was a row of height spent on
    the lesser of the two — which it still is, and is only paid once there are
    more views on offer than fit beside the box; see `stacked`.
  */
  // Over the tracks, in the look that has them, while nothing is searched or chosen.
  /*
    What the walls ask of the lists they pinch out of: which entry is at a
    point of the list, and the list scrolled to put one there. Worked out
    from the rows' fixed height, as the lists lay themselves out.
  */
  const trackListApi: LevelApi = {
    entryAt: (x, y) => {
      const row = Math.floor((fastTracks.offset.get() + y - topRoom - headerHeight) / trackRowHeight);
      const column = tracksColumns > 1 ? Math.min(tracksColumns - 1, Math.floor(x / (screenSize.width / tracksColumns))) : 0;
      return Math.max(0, Math.min(listed.length - 1, row * tracksColumns + column));
    },
    bring: (entry, y) => {
      const offset = Math.max(0, topRoom + headerHeight + Math.floor(entry / tracksColumns) * trackRowHeight + trackRowHeight / 2 - y);
      lists.current.tracks?.scrollToOffset({ offset, animated: false });
      restoreTo.current = offset;
      fastTracks.offset.set(offset);
    },
    // The row's cover, as `TrackRow` lays it out: its own size, at the row's left, in the middle of its height.
    rectOf: (entry) => ({
      x: (entry % tracksColumns) * (screenSize.width / tracksColumns) + ROW_SIDE,
      y: topRoom + headerHeight + Math.floor(entry / tracksColumns) * trackRowHeight + (trackRowHeight - ROW_COVER) / 2 - fastTracks.offset.get(),
      w: ROW_COVER,
    }),
  };
  const headingListApi = (kind: (typeof GROUPED_VIEWS)[number]): LevelApi => ({
    entryAt: (x, y) => {
      const row = Math.floor((fastOf[kind].offset.get() + y - topRoom) / browseRowHeight);
      const column = columnsOf(kind) > 1 ? Math.min(columnsOf(kind) - 1, Math.floor(x / (screenSize.width / columnsOf(kind)))) : 0;
      return Math.max(0, Math.min(headingsOf[kind].length - 1, row * columnsOf(kind) + column));
    },
    bring: (entry, y) => {
      const offset = Math.max(0, topRoom + Math.floor(entry / columnsOf(kind)) * browseRowHeight + browseRowHeight / 2 - y);
      lists.current[kind]?.scrollToOffset({ offset, animated: false });
      restedAt.current[kind] = offset;
      fastOf[kind].offset.set(offset);
    },
    // As `BrowseRow` lays its picture out, the same as `TrackRow`'s.
    rectOf: (entry) => ({
      x: (entry % columnsOf(kind)) * (screenSize.width / columnsOf(kind)) + ROW_SIDE,
      y: topRoom + Math.floor(entry / columnsOf(kind)) * browseRowHeight + (browseRowHeight - ROW_COVER) / 2 - fastOf[kind].offset.get(),
      w: ROW_COVER,
    }),
  });
  const shelves =
    trackLook === 'shelves' && !asked && !selecting ? (
      <Shelves tracks={listed} counts={counts} played={played} onPlay={playFrom} onHold={openMenu} />
    ) : null;
  const views = (
    <Segmented
      role="tab"
      size="compact"
      accessibilityLabel={t.library.screen.viewSwitch}
      // On a row of its own, the views share the width evenly instead of each taking what its word needs.
      layout={stacked ? 'fill' : 'fit'}
      style={[styles.views, !stacked && viewsWidth ? { width: viewsWidth } : null]}
      optionStyle={!stacked && offered.length > 2 ? styles.viewTight : null}
      // Only beside the box is there a width worth knowing: on a row of its
      // own the switch is as wide as the screen and is never moved aside.
      onLayout={stacked ? undefined : measureViews}
      options={offered.map((candidate) => ({ value: candidate, label: t.library.views[candidate] }))}
      value={chosenView}
      onChange={chooseView}
      onPressIn={setWarmView}
      onPressOut={coolViews}
    />
  );
  // A switch with one position is not a choice, and is not drawn.
  const switchable = offered.length > 1;
  /*
    Beside the switch, how the view chosen is drawn: the word over it, as
    the order has, and a picture of its look under it; pressed, its other
    look. Standing, dimmed, over a view that has only the one, so that the
    switch does not change width from one view to the next.
  */
  const canLook = lookable(view) && !selecting;
  const lookButton = offered.some(lookable) ? (
    <Pressable
      android_ripple={canLook ? pressed : undefined}
      accessibilityRole="button"
      accessibilityLabel={canLook ? `${t.library.screen.view}: ${t.library.screen.looks[lookOf(view)]}` : t.library.screen.view}
      accessibilityHint={canLook ? t.library.screen.lookSwitch : undefined}
      accessibilityState={{ disabled: !canLook }}
      disabled={!canLook}
      style={[styles.sort, styles.lookButton, !canLook && styles.lookOff]}
      onPress={stepLook}>
      <Text style={styles.sortLabel}>{t.format.upper(t.library.screen.view)}</Text>
      <LookIcon look={canLook ? lookOf(view) : 'list'} size={15} color={c.text} />
    </Pressable>
  ) : null;

  return (
    <SafeAreaView
      style={styles.screen}
      /*
        No left edge while the tabs are down that side. The rail already keeps
        clear of the cutout, and asking again put a second inset's worth of
        empty grey between it and the screen — which on the album view was a
        strip of nothing beside the records.
      */
      /*
        Nor a top edge sideways. The panel down the right is meant to run the
        whole height of the window, the way it does on the Lists screen, and a
        safe area around everything stopped it under the clock instead — the
        two screens disagreed about where the same panel began. What needs
        keeping clear of the clock is the header, and that asks for itself.
      */
      /*
        Nor a right edge while the panel is down that side, for the reason
        there is no left one: the panel keeps clear of the edge itself.
      */
      edges={landscape ? (sides.right > 0 ? RIGHT_EDGE : NO_EDGES) : UPRIGHT_EDGES}>
      {/* All of the screen the list picker is laid over, when it is. */}
      <GlassScene scene={scene}>
      <Behind veiled={menuVeiled} style={landscape ? styles.sideways : styles.upright}>
        <View
          ref={middle}
          // Asked where it is when a record opens, so it has to be a view of
          // its own to be found.
          collapsable={false}
          /*
            Sideways, kept to itself: put out of focus under an open record, it
            spread past its own edge by as far as it was blurred, and a dark band
            of it showed down the side of the panel of what is playing.
          */
          style={[styles.middle, landscape && styles.middleKept]}>
        {/*
          Everything a record opens over. While one is open none of it is
          there to be touched or read out: it is covered, and a screen reader
          finding its way to a search box underneath a list would be finding
          something nobody can see.
        */}
        <Veiled
          // Out of focus under an open record, where screens are glass.
          blur={opened ? glass : 0}
          style={styles.upright}
          pointerEvents={opened ? 'none' : 'auto'}
          importantForAccessibility={opened ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={opened != null}>
      <View
        style={[
          styles.header,
          (racked || landscape) && styles.headerTight,
          // What the safe area used to do for the whole screen, asked for by
          // the one part of it that is actually under the clock.
          landscape && { paddingTop: insets.top + 8 },
          over && styles.headerOver,
          frosted && styles.headerClear,
        ]}
        onLayout={over ? measureTop : undefined}>
        {frosted && target ? <Frost target={target} edge="bottom" /> : null}
        {switchable && stacked ? (
          <View style={styles.viewsRow}>
            <View style={styles.viewsGrow}>{views}</View>
            {lookButton}
          </View>
        ) : null}
        <View style={styles.headerRow}>
        {/*
          Pulled aside while the box is being typed in, and put back when it is
          let go of. Upright, searching is the one thing on this screen that
          wants the whole width — a query is longer than anything else typed
          into a phone — and it is also the one time the switch is certainly
          not about to be pressed.
        */}
        {switchable && !stacked ? (
          <Animated.View style={[styles.viewsSlot, slot]}>
            <View style={styles.viewsRow}>
              {views}
              {lookButton}
            </View>
          </Animated.View>
        ) : null}
        <View style={[styles.searchRow, styles.searchGrow]}>
          <View style={styles.searchGrow}>
            <SearchField
              ref={searchBox}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearching(true)}
              onBlur={() => setSearching(false)}
              placeholder={t.library.screen.searchHints[view]}
              height={CONTROL_HEIGHT}
            />
          </View>
          {/*
            What the library is in order of, and the only way to change it.

            A word rather than a glyph. The three orders are not degrees of one
            thing that an arrow could point along, and an icon that has to be
            tapped before it means anything is no use to the reader who only
            wants to know where they are — which is most of the times this is
            looked at. Stacked over a label, because `Added` on its own reads
            as a filter, something the list has been reduced to; it is the
            small grey word above it that makes it an ordering. Stacking is
            also what fits it into less width than the two laid side by side
            would need, and the width here belongs to the search box.
          */}
          {/* Over the tapes too, which have orders of their own: see `tapes/sort.ts`. */}
          <Animated.View style={[styles.sortSlot, sortSlot]}>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityLabel={sortShown.spoken}
              accessibilityHint={t.library.screen.sortHint}
              style={styles.sort}
              onPress={stepSort}>
              <Text style={styles.sortLabel}>{t.format.upper(t.library.screen.sort)}</Text>
              <Text style={styles.sortValue} numberOfLines={1}>
                {sortShown.short}
              </Text>
            </Pressable>
          </Animated.View>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={
              selecting ? t.library.screen.stopSelecting : t.library.screen.selectTracks
            }
            accessibilityState={{ selected: selecting }}
            style={styles.selectButton}
            onPress={() => {
              haptic('choices', selecting ? 'toggleOff' : 'toggleOn');
              if (selecting) stopSelecting();
              else setSelecting(true);
            }}>
            <SelectIcon size={22} color={selecting ? c.accent : c.textMuted} />
          </Pressable>
        </View>
        </View>

        {/* Directly under the search box, where the run it acts on begins.
            Below that row rather than inside it: it is a second line of
            chrome, and in the row it became a third thing competing for the
            width with the switch and the box. */}
        {selecting ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkCount}>{(view === 'tapes' ? t.library.tapes.selected : t.library.screen.selected)(selected.size)}</Text>
            <View style={styles.bulkActions}>
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={styles.bulkAction}
                onPress={() => {
                  haptic('choices', 'click');
                  if (allChosen) setSelected(new Set());
                  else selectAll();
                }}>
                <Text style={styles.bulkLabel}>
                  {allChosen ? t.common.clear : t.common.selectAll}
                </Text>
              </Pressable>
              {view === 'tapes' ? (
                /*
                  A tape's, not a song's: played, queued, marked heard or
                  not, or deleted. Tapes are in no list, carry no tags and
                  are not looked up, so none of that is offered.
                */
                <>
                  <Pressable
                    accessibilityRole="button"
                    android_ripple={pressed}
                    style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                    disabled={selected.size === 0}
                    onPress={playSelected}>
                    <Text style={styles.bulkLabel}>{t.common.play}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    android_ripple={pressed}
                    style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                    disabled={selected.size === 0}
                    onPress={queueSelected}>
                    <Text style={styles.bulkLabel}>{t.common.addToQueue}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    android_ripple={pressed}
                    style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                    disabled={selected.size === 0}
                    onPress={() => markSelected(true)}>
                    <Text style={styles.bulkLabel}>{t.library.tapes.markPlayed}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    android_ripple={pressed}
                    style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                    disabled={selected.size === 0}
                    onPress={() => markSelected(false)}>
                    <Text style={styles.bulkLabel}>{t.library.tapes.markUnplayed}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    android_ripple={pressed}
                    style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                    disabled={selected.size === 0}
                    onPress={() => actions.run('delete')}>
                    <Text style={styles.bulkDestructive}>{t.common.delete}</Text>
                  </Pressable>
                </>
              ) : (
              <>
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={queueSelected}>
                <Text style={styles.bulkLabel}>{t.common.addToQueue}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => addToList([...selected], { favorites: true })}>
                <Text style={styles.bulkLabel}>{t.library.screen.addToList}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => actions.run('addTag')}>
                <Text style={styles.bulkLabel}>{t.library.screen.addTag}</Text>
              </Pressable>
              {/* Not offered where it cannot be done: Android 10, or a native
                  build from before it could. */}
              {canWriteFiles() ? (
              <Pressable
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                accessibilityRole="button"
                accessibilityLabel={t.library.screen.writeToFilesSpoken}
                onPress={() => actions.run('write')}>
                <Text style={styles.bulkLabel}>{t.library.screen.writeToFiles}</Text>
              </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => actions.run('delete')}>
                <Text style={styles.bulkDestructive}>{t.common.delete}</Text>
              </Pressable>
              {/* Everything, these included, from looking up to resetting. */}
              <Pressable
                accessibilityRole="button"
                accessibilityHint={t.details.selection.moreHint}
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={actions.open}>
                <Text style={styles.bulkLabel}>{t.details.selection.more}</Text>
              </Pressable>
              </>
              )}
            </View>
          </View>
        ) : null}
        {/* Every view says how much it holds, the records too; only the rack,
            sideways, has no room for the line unless there is a note to say. */}
        {racked && note == null ? null : (
        <View style={styles.meta}>
          <Text style={styles.metaText} numberOfLines={note != null ? 3 : 1}>
            {/* Whatever the list picker last did is said here, since adding
                to a list otherwise looks like nothing happening. */}
            {note ??
              (view === 'artists'
                ? t.common.artists(shownHeadings.length)
                : view === 'albums'
                  ? t.common.albums(shownHeadings.length)
                  : view === 'folders'
                    ? `${libraryRoot()} · ${t.library.screen.folders(shownHeadings.length)}`
                    : view === 'tapes'
                      ? t.library.tapes.count(tapeResults.length)
                      : `${libraryRoot()} · ${t.common.tracks(music.length - asideCount)}`)}
          </Text>
          {/*
            The whole library, in a new order, from the line that says how
            much of it there is. Only on the tracks, and not while a note is
            on the line or tracks are being ticked: then the line is saying
            something else, and this is not what a tap there would mean.
          */}
          {view === 'tracks' && note == null && !selecting && music.length > 1 ? (
            <PressList menu={shuffleMenu}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={shuffleWords.spoken}
                accessibilityHint={t.library.shuffle.note}
                hitSlop={8}
                style={styles.shuffleAll}
                onPress={shuffleAll}>
                <ShuffleIcon size={15} color={c.accent} />
                {shuffleWords.shown ? (
                  <Text style={[styles.shuffleAllLabel, styles.shuffleNamed]} numberOfLines={1}>
                    {shuffleWords.shown}
                  </Text>
                ) : (
                  // As tall as with words, so that the line it is on does not move when they go.
                  <Text style={[styles.shuffleAllLabel, styles.shuffleStrut]} importantForAccessibility="no">
                    {' '}
                  </Text>
                )}
              </Pressable>
            </PressList>
          ) : view === 'tapes' && note == null && !selecting ? (
            <View style={styles.tapeActions}>
              {/* Every place marked in a tape, once there is one. */}
              {marksMade ? (
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityLabel={t.player.marks.screen}
                  hitSlop={8}
                  style={styles.shuffleAll}
                  onPress={() => router.push('/marks')}>
                  <MarksIcon size={16} color={c.accent} />
                </Pressable>
              ) : null}
              {/* The tape settings, the same page as the Settings tab's. */}
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={t.library.tapes.settings}
                hitSlop={8}
                style={styles.shuffleAll}
                onPress={() => router.push('/settings-tapes')}>
                <SettingsIcon size={16} color={c.accent} />
              </Pressable>
              {/* More tapes, fetched: a screen of their own, opened from here and nowhere else. */}
              {tapesFetchable ? (
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={styles.shuffleAll}
                  onPress={() => router.push('/tapes-add')}>
                  <PlusIcon size={15} color={c.accent} />
                  <Text style={styles.shuffleAllLabel}>{t.library.tapes.add}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : note == null && !selecting ? (
            // Its room kept in the other views, unseen, so the line is as tall in all of them and the list under it starts in the same place.
            <View style={[styles.shuffleAll, styles.unseen]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
              <ShuffleIcon size={15} color={c.accent} />
              <Text style={styles.shuffleAllLabel}>{t.library.screen.shuffleAll}</Text>
            </View>
          ) : null}
        </View>
        )}
        {/* The offer to look the files up, a lookup under way, or the one tip:
            for a newcomer, and out of the way while tracks are being chosen. */}
        {/* The music's offer and tip, about songs: not over the tapes, which are not looked up and are not songs. */}
        {selecting || view === 'tapes' ? null : <LibraryWelcome tracks={music.length} confirmed={screen.confirmed} />}
        {/* Downloads that may be the wrong song: beside the copies line, and out of the way in the same way. */}
        {selecting ? null : <WrongDownloadsLine confirmed={screen.confirmed} />}
      </View>

      {/*
        What scrolls under the search and the bar of what is playing, which blur
        it: see `Frosted`. Not the rack, which goes under neither, and which
        kept for them was drawn twice over with every frame it moved.
      */}
      <View style={styles.listArea}>
      {/*
        The views' lists left standing under the rack, shut, rather than taken
        down: put up again whole each time the albums were left, they made
        every change of view to and from the rack a hitch.
      */}
      <Curtain shut={racked} warm={LIBRARY_VIEWS.some((candidate) => candidate !== 'albums' && warming(candidate))} style={styles.pane}>
      <BlurArea style={styles.listArea}>
        <>
          {/*
            Every view opened so far, standing, the one chosen on top and the
            others out of sight under it: going from one to another is then
            only a matter of which is seen, where building the list of a view
            again each time was a hitch felt on every change, the larger the
            library the more. Each keeps its place, too.
          */}
          {GROUPED_VIEWS.filter((kind) => visited.has(kind)).map((kind) => (
            <Curtain key={kind} shut={kind !== view || (kind === 'albums' && racked)} warm={warming(kind)} style={styles.pane}>
              {kind === 'artists' && artistMap && !selecting ? (
                <ArtistMap
                  register={registerMap}
                  artists={artists}
                  query={query}
                  top={topRoom}
                  bottom={under.bottom}
                  onOpen={onHeadingPress}
                  onShuffle={shuffleMap}
                />
              ) : (
              /*
                The list and the wall of covers it pinches out into, one over
                the other and pinched between as a gallery is: see `ZoomStack`.
              */
              <ZoomStack
                zoom={selecting ? 0 : zooms[kind]}
                onZoom={(level) => setZoom(kind, level)}
                enabled={!selecting}
                listApi={headingListApi(kind)}
                register={(api) => {
                  stacks.current[kind] = api;
                }}
                list={
              <View collapsable={false} style={styles.paneShown}>
              <Animated.FlatList
                        removeClippedSubviews={CLIP_SUBVIEWS}
                {...ROWS_KEPT}
                data={headingsOf[kind]}
                {...listOf.ends[kind]}
                ref={listOf.refs[kind]}
                // Where the scroll bar stands is followed from here natively: see `FastScroll`.
                onScroll={fastOf[kind].onScrollEvent}
                // The scroll bar beside it is the one: the list's own as well was two, never quite together.
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onLayout={fastOf[kind].onLayout}
                onContentSizeChange={fastOf[kind].onContentSizeChange}
                // Remounted when the columns change, which React Native will not alter on a list that is up.
                key={columnsOf(kind)}
                numColumns={columnsOf(kind)}
                columnWrapperStyle={columnsOf(kind) > 1 ? styles.columnRow : undefined}
                keyExtractor={(heading) => heading.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.list, { paddingTop: topRoom, paddingBottom: 8 + under.bottom }]}
                // Exact with one column and left to be measured with two, for the
                // reason given at length on the track list below.
                getItemLayout={
                  columnsOf(kind) > 1
                    ? undefined
                    : (_data, index) => ({
                        length: browseRowHeight,
                        offset: topRoom + browseRowHeight * index,
                        index,
                      })
                }
                initialNumToRender={12 * columnsOf(kind)}
                windowSize={7}
                renderItem={renderHeadingOf[kind]}
                ListFooterComponent={searchElsewhere}
                ListEmptyComponent={headingsEmpty(kind)}
              />
              <FastScroller
                fast={fastOf[kind]}
                count={Math.ceil(headingsOf[kind].length / columnsOf(kind))}
                labelAt={(index) => {
                  const heading = headingsOf[kind][index * columnsOf(kind)];
                  return heading ? headingLabel(kind, heading) : '';
                }}
                coverAt={(index) => headingsOf[kind][index * columnsOf(kind)]?.cover[0]}
                // Noted as where the list rests, as a scroll by the finger is when it ends: the tab pressed again goes back to the top from there.
                scrollTo={(offset) => {
                  restedAt.current[kind] = offset;
                  lists.current[kind]?.scrollToOffset({ offset, animated: false });
                }}
                indexAt={(offset) => offset / browseRowHeight}
                top={topRoom}
                bottom={under.bottom}
              />
              </View>
                }
                items={headingsOf[kind]}
                keyOf={headingKey}
                titleOf={headingTitle}
                detailOf={kind === 'albums' ? headingBy : undefined}
                labelOf={wallOf[kind].labelOf}
                renderCover={headingCover}
                sleeveOf={headingSleeve}
                footer={searchElsewhere}
                empty={headingsEmpty(kind)}
                top={topRoom}
                bottom={under.bottom}
                onPress={wallOf[kind].onPress}
                onLongPress={wallOf[kind].onLongPress}
              />
              )}
            </Curtain>
          ))}
          {visited.has('tracks') ? (
            <Curtain shut={view !== 'tracks'} warm={warming('tracks')} style={styles.pane}>
              {/*
                The list and its wall of covers, pinched between as a gallery
                is, as for the records, the artists and the folders above;
                not under the shelves, which are covers enough, and where a
                wall over them was more muddle than help.
              */}
              <ZoomStack
                zoom={selecting || trackLook === 'shelves' ? 0 : zooms.tracks}
                onZoom={(level) => setZoom('tracks', level)}
                enabled={!selecting && trackLook !== 'shelves'}
                listApi={trackListApi}
                register={(api) => {
                  stacks.current.tracks = api;
                }}
                list={
              <View collapsable={false} style={styles.paneShown}>
              <View
                style={styles.listWrapper}
                ref={dragWrapper}
                // Page coordinates are what a gesture reports, so where the list sits
                // in the window is needed to turn one into a row and a column.
                onLayout={onDragLayout}
                {...dragHandlers}>
              <Animated.FlatList
                      removeClippedSubviews={CLIP_SUBVIEWS}
                {...ROWS_KEPT}
                data={listed}
                {...followsScrolling}
                // The scroll bar beside it is the one: the list's own as well was two, never quite together.
                showsVerticalScrollIndicator={false}
                onLayout={(event) => {
                  dragWidth(event.nativeEvent.layout.width);
                  fastTracks.onLayout(event);
                }}
                onContentSizeChange={fastTracks.onContentSizeChange}
                /*
                  Remounts the list when the count changes. React Native refuses to
                  alter numColumns on an existing list, and turning the phone is exactly
                  when it changes.
                */
                key={tracksColumns}
                numColumns={tracksColumns}
                columnWrapperStyle={tracksColumns > 1 ? styles.columnRow : undefined}
                keyExtractor={(track) => track.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.list, { paddingTop: topRoom, paddingBottom: 8 + under.bottom }]}
                // Where the scroll bar stands is followed from here natively, and the rest told as well: see `tracksScrolled`.
                onScroll={fastTracks.onScrollEvent}
                scrollEventThrottle={16}
                // Covers the case the guard above cannot: the list being torn down while the screen
                // around it lives on. What it is given stays put while the list does: see `startingOffset`.
                ref={tracksList}
                contentOffset={tracksStart.contentOffset}
                /*
                  Measured rather than calculated once there is more than one column.

                  The header counts towards an offset, and with a single column the
                  arithmetic is exact: a row per item, each one lower than the last. Two
                  across breaks that. A pair shares one offset, so the offsets stop
                  increasing with the index — and the list finds the visible range by
                  searching those offsets, which only works while they rise. It settled
                  on the wrong window part way down and unmounted rows that were on
                  screen, which is why the middle of the list went blank while the two
                  ends, where the window is pinned, stayed put.

                  Letting it measure costs the exactness of scrolling to an index.
                  Nothing here does that: the place is restored from a pixel offset,
                  which is independent of this.
                */
                getItemLayout={
                  tracksColumns > 1
                    ? undefined
                    : (_data, index) => ({
                        length: trackRowHeight,
                        offset: topRoom + headerHeight + trackRowHeight * index,
                        index,
                      })
                }
                // Covers are read out of the files, so keep that to what is on screen.
                initialNumToRender={12 * tracksColumns}
                windowSize={7}
                // Left to the list to measure, clipping guesses at what is off screen
                // from the same frames, and guesses wrong in the same way.
                ListHeaderComponent={
                  <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
                  {shelves}
                  <View style={tagShuffles.length > 0 || matchedAlbums.length > 0 ? styles.tagActions : null}>
                    {matchedAlbums.map((entry) => (
                      <Pressable
                        accessibilityRole="button"
                        android_ripple={pressed}
                        key={`album:${entry.key}`}
                        style={styles.tagAction}
                        onPress={() =>
                          router.push({ pathname: '/playlist', params: { album: entry.key } })
                        }>
                        <View style={styles.albumActionIcon}>
                          <PlaylistCover tracks={entry.tracks} chosen={null} sleeve={entry.tracks} size={22} />
                        </View>
                        <Text style={styles.tagActionLabel} numberOfLines={1}>
                          {entry.name}
                        </Text>
                        <Text style={styles.tagActionCount}>{t.format.number(entry.tracks.length)}</Text>
                      </Pressable>
                    ))}
                    {tagShuffles.map(({ tag, tracks: tagged }) => (
                      <Pressable
                        accessibilityRole="button"
                        android_ripple={pressed}
                        key={tag}
                        style={styles.tagAction}
                        onPress={() => void start(spreadShuffle(tagged, artistKey), 0)}>
                        <View style={styles.tagActionIcon}>
                          <PlayIcon size={11} color={c.onPrimary} />
                        </View>
                        <Text style={styles.tagActionLabel} numberOfLines={1}>
                          {t.library.screen.shuffleTag(tag)}
                        </Text>
                        <Text style={styles.tagActionCount}>{t.format.number(tagged.length)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  </View>
                }
                ListEmptyComponent={tracksEmpty}
                ListFooterComponent={searchElsewhere}
                renderItem={renderItem}
              />
              </View>
              <FastScroller
                fast={fastTracks}
                count={Math.ceil(listed.length / tracksColumns)}
                labelAt={(index) => {
                  const track = listed[index * tracksColumns];
                  return track ? sectionOf(track) : '';
                }}
                coverAt={(index) => listed[index * tracksColumns]}
                scrollTo={(offset) => lists.current.tracks?.scrollToOffset({ offset, animated: false })}
                indexAt={(offset) => Math.max(0, offset - headerHeight) / trackRowHeight}
                top={topRoom}
                bottom={under.bottom}
              />
              </View>
                }
                items={listed}
                keyOf={trackKey}
                titleOf={trackTitle}
                detailOf={trackArtist}
                sectionOf={sectionOf}
                renderCover={trackCover}
                sleeveOf={sameTrack}
                footer={searchElsewhere}
                empty={tracksEmpty}
                top={topRoom}
                bottom={under.bottom}
                onPress={wallTrackPress}
                onLongPress={wallTrackLongPress}
              />
            </Curtain>
          ) : null}
          {seenTapes ? (
            <Curtain shut={view !== 'tapes'} warm={warming('tapes')} style={styles.pane}>
              <FlatList
                removeClippedSubviews={CLIP_SUBVIEWS}
                {...ROWS_KEPT}
                data={tapeRows}
                {...listOf.ends[TAPES]}
                ref={listOf.refs[TAPES]}
                keyExtractor={(row) => row.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.list, { paddingTop: topRoom, paddingBottom: 8 + under.bottom }]}
                initialNumToRender={12}
                windowSize={7}
                renderItem={renderTape}
                ListHeaderComponent={tapeFilterBar}
                ListEmptyComponent={
                  <Text style={styles.empty}>{query.trim() ? t.library.nothingMatches(query) : t.library.tapes.empty(`${libraryRoot()}/Tapes`)}</Text>
                }
              />
            </Curtain>
          ) : null}
        </>
      </BlurArea>
      </Curtain>
      {/*
        The rack, once the records have been seen with it on: made once and
        left standing, shut while another view is in front, as the lists are.
        Made afresh each time, it made going to the records a long wait.
      */}
      {rack && seenAlbums ? (
        <Curtain shut={!racked} warm={warming('albums')} style={[styles.pane, { paddingTop: laidTop }]}>
          {/* Two fingers draw the rack further off, to see more of it, and back near: see `CoverFlow`. */}
            {landscape ? (
              <CoverFlow key={rackOrder} ref={shelf} albums={rackAlbums} onOpen={openAlbum} onHold={onSleeveHeld} initial={rackIndex} onSettle={settleRack} />
            ) : (
              /*
                Upright, the same rack across the top, its name said under it
                rather than in it, and the tracks of the record it has come to
                rest on under that.
              */
              <>
                <View style={{ height: rackTall }}>
                  <CoverFlow
                    key={rackOrder}
                    ref={shelf}
                    albums={rackAlbums}
                    onOpen={openAlbum}
                    onHold={onSleeveHeld}
                    initial={rackIndex}
                    onSettle={settleRack}
                  />
                </View>
                <RackFront
                  album={rackAlbums[rackIndex] ?? null}
                  bottom={under.bottom}
                  onPlay={playFrom}
                  onTap={tapInAlbum}
                  onLongPress={openMenu}
                  ring={ring}
                />
              </>
            )}
        </Curtain>
      ) : null}
      </View>
        </Veiled>

        {/*
          The record a sleeve was tapped for, over the header and the rack and
          no further: the tabs and the player's panel are outside this view,
          so they stay where they are and go on working.

          Not tied to the rack being drawn. Turned upright with a record open,
          the rack gives way to the list of albums underneath and the record
          stays; closing it then lands on that list.
        */}
        {opened ? (
          <AlbumListing
            key={opened.album.key}
            album={openedAlbum ?? opened.album}
            sleeve={opened.sleeve}
            sleeveNow={sleeveNow}
            // Sideways nothing above this keeps clear of the clock; upright
            // the safe area around the screen already has.
            top={landscape ? insets.top : 0}
            bottom={under.bottom}
            side={landscape}
            onPlay={playFrom}
            onTap={tapInAlbum}
            ring={albumRing}
            // Its own record is the one place "go to album" has nowhere to go.
            onLongPress={openFromAlbum}
            onFindRest={findRest}
            onClosed={closeAlbum}
          />
        ) : null}
        </View>
        {/* The bar becomes a panel down the right, so the middle keeps its
            width and the height goes to the list. */}
        <NowPlayingBar column={landscape} />
      </Behind>
      </GlassScene>

      {actions.element}

      {menuElement}
      <AlbumMenu
        album={albumMenu}
        // Setting it aside or bringing it back, whichever applies; and in the rack, which has no boxes to tick, no Select.
        hidden={[...(albumMenu?.racked ? WITHOUT_SELECT : []), albumMenu && asideRules.album.has(albumMenu.key) ? 'setAside' : 'bringBack']}
        onSelect={runAlbumAction}
        onClose={closeAlbumMenu}
      />
      {/* From the foot of the list the shuffle button opens when held. */}
      <ShuffleSourceSheet visible={choosingShuffle} onClose={() => setChoosingShuffle(false)} />
    </SafeAreaView>
  );
}

const RIGHT_EDGE = ['right'] as const;
const NO_EDGES = [] as const;
const UPRIGHT_EDGES = ['top', 'left', 'right'] as const;

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  middle: { flex: 1, minWidth: 0 },
  middleKept: { overflow: 'hidden' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  // Each row takes an equal share of the width so the pair lines up.
  columnRow: { gap: 8 },
  swipeShared: { flex: 1, minWidth: 0 },
  listWrapper: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTight: { paddingBottom: 8 },
  // Over the list in a theme of glass; nothing at all in any other.
  headerOver: topGlass(c),
  /** Its fill left to `Frost`, which draws it over the blur. */
  headerClear: { backgroundColor: 'transparent' },
  /** Where the lists are: the room under the top, or all of it where the top is laid over them. */
  listArea: { flex: 1 },
  paneShown: { flex: 1 },
  /*
    Every view's the same room, one over another, the one in front open and
    the rest out of sight and out of reach but standing, shut (see `Curtain`):
    see where the views' lists are drawn. See-through, as they were, the map
    and every list were drawn again unseen with each frame of the scroll of
    the one in front, and the records' wall lost a frame in three; and the
    one in front laid out apart from the rest, each was laid out anew, its
    rows taken down and put up again, at every change of view.
  */
  pane: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  /*
    The slot clips; the switch inside is pinned to the width it measured.

    Clipping alone was not enough. A child of a view whose width is animating
    to nothing is still laid out against that width, so the two words wrapped
    into columns of letters on the way out and the header grew a centimetre
    taller — the box appeared to change height when what moved was the row
    above holding it down.
  */
  viewsSlot: { overflow: 'hidden', flexShrink: 0 },
  // Three or four words beside the box, sideways: each gives up a little of
  // its margin so the box keeps a width worth typing in.
  viewTight: { paddingHorizontal: 8 },
  // The cover stands in for the play button the tag rows carry, so the two
  // kinds of shortcut line up rather than each finding their own left edge.
  albumActionIcon: { width: 22, height: 22, borderRadius: 4, overflow: 'hidden' },
  searchGrow: { flex: 1 },
  // Clips the button on its way out, exactly as the switch's slot does; the
  // button inside keeps the width it was given so that nothing inside it
  // reflows while that is happening.
  sortSlot: { overflow: 'hidden', flexShrink: 0 },
  sort: {
    width: SORT_WIDTH,
    height: CONTROL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: 9,
    paddingVertical: 5,
    ...outlined(c),
  },
  sortLabel: { color: c.textFaint, fontSize: 8.5, letterSpacing: 1 },
  // The switch and the button beside it, as tall as each other.
  viewsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  viewsGrow: { flex: 1, minWidth: 0 },
  // No room of its own above and below: the switch beside it says how tall the two are.
  lookButton: { gap: 1, paddingVertical: 0 },
  views: { height: CONTROL_HEIGHT },
  lookOff: { opacity: 0.35 },
  sortValue: { color: c.text, fontSize: 12.5, fontWeight: '600' },
  selectButton: { padding: 8 },
  bulkBar: { gap: 8, paddingTop: 4 },
  bulkCount: { color: c.accent, fontSize: 12 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bulkAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  bulkDisabled: { opacity: 0.35 },
  bulkLabel: { color: c.text, fontSize: 13 },
  bulkDestructive: { color: c.danger, fontSize: 13 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metaText: { color: c.textFaint, fontSize: 12, flexShrink: 1 },
  shuffleAll: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  shuffleAllLabel: { color: c.accent, fontSize: 12.5 },
  // A list's name can be long; the line it shares has the count of tracks to keep.
  shuffleNamed: { flexShrink: 1, maxWidth: 160 },
  shuffleStrut: { width: 0, marginLeft: -5 },
  tapeActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tapeEpisode: { paddingLeft: 24 },
  tapeFiltersOut: { marginBottom: 4 },
  tapeFilters: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  tapeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surfaceRaised,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    overflow: 'hidden',
    ...outlinedClip(c),
  },
  tapeFilterOn: { backgroundColor: c.primary, ...outlinedClip(c, c.primary) },
  tapeFilterLabel: { color: c.textSecondary, fontSize: 13 },
  tapeFilterLabelOn: { color: c.onPrimary, fontSize: 13, fontWeight: '600' },
  tapeFilterCount: { color: c.textFaint, fontSize: 12, fontVariant: ['tabular-nums'] },
  tapeFilterCountOn: { color: c.onPrimary, fontSize: 12, opacity: 0.75, fontVariant: ['tabular-nums'] },
  unseen: { opacity: 0 },
  links: { flexDirection: 'row', gap: 16 },
  link: { color: c.accent, fontSize: 13 },

  list: { paddingBottom: 8 },
  tagActions: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tapesHeading: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  tagAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...outlined(c),
  },
  tagActionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagActionLabel: { color: c.text, fontSize: 14, flex: 1 },
  elsewhere: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  elsewhereIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagActionCount: { color: c.textFaint, fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', padding: 32 },

  body: { color: c.text, fontSize: 16, textAlign: 'center' },
  muted: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: c.surfaceRaised, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, ...outlined(c) },
  buttonLabel: { color: c.text, fontSize: 15 },

}));
