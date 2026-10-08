import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { PlayIcon } from '../components/Icons';
import { useTrackMenu, WITHOUT_ALBUM } from '../components/useTrackMenu';
import { SearchField } from '../components/SearchField';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { SelectIcon } from '../components/Icons';
import { rackWanted, useLandscape, useListColumns } from '../lib/ui/layout';
import { useDragSelect } from '../lib/ui/useDragSelect';
import { TagPrompt } from '../components/TagPrompt';
import { WriteFilesSheet } from '../components/WriteFilesSheet';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { PlaylistCover } from '../components/PlaylistCover';
import { BROWSE_ROW_HEIGHT, BrowseRow } from '../components/BrowseRow';
import { AlbumListing } from '../components/AlbumListing';
import { CoverFlow, type Rack, type Sleeve } from '../components/CoverFlow';
import { albumsOf, type Album } from '../lib/media/albums';
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
import { creditReader } from '../lib/db/credits';
import { addTagToTracks } from '../lib/db/tags';
import { canWriteFiles } from '../lib/filetags';
import { SwipeRow } from '../components/SwipeRow';
import { TRACK_ROW_HEIGHT, TrackRow } from '../components/TrackRow';
import {
  ensureAudioPermission,
  ensureNotificationPermission,
  libraryRoot,
  scanLibrary,
} from '../lib/media/library';
import { withMetadata, type EnrichedTrack } from '../lib/media/merge';
import { search, searchNamed } from '../lib/media/search';
import {
  viewShown,
  viewsFrom,
  type LibraryView,
} from '../lib/media/views';
import {
  asSortOrder,
  nextSort,
  sortAlbums,
  sortTracks,
  type SortOrder,
} from '../lib/media/sort';
import { lastPlayedAt, playCounts } from '../lib/db/history';
import { artistKey, spreadShuffle } from '../lib/media/shuffle';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';

type Screen =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'library'; tracks: EnrichedTrack[] }
  | { kind: 'error'; message: string };

/** A stable empty library, so the searching below is not re-run over a new one. */
const NOTHING: EnrichedTrack[] = [];

/** The same, for a listening history that has not been read yet. */
const UNPLAYED: ReadonlyMap<string, number> = new Map();

/** The views on offer until the setting has been read, which is the ones it starts with. */
const OFFERED: LibraryView[] = viewsFrom(null);

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
  detail: string;
  tracks: EnrichedTrack[];
  cover: EnrichedTrack | null;
};

/** No headings, for the view that is a list of tracks and has none. */
const NO_HEADINGS: Heading[] = [];

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

export default function LibraryScreen() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const downloadRevision = useDownloadLibraryRevision();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
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
  /** The views the switch offers: the ones left on in Settings. */
  const [offered, setOffered] = useState<LibraryView[]>(OFFERED);
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
  const [opened, setOpened] = useState<{ album: Album; sleeve: Sleeve } | null>(null);
  const shelf = useRef<Rack>(null);
  const middle = useRef<View>(null);
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
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
  // choice that was just made there.
  useFocusEffect(
    useCallback(() => {
      setRack(rackWanted(landscape));
      setOffered(viewsFrom(readSetting(SETTINGS.libraryViews)));
    }, [landscape])
  );

  const view = viewShown(remembered, offered);
  const albumView = view === 'albums';
  /** Whether what is on screen is headings — albums, artists, folders — rather than tracks. */
  const grouped = view !== 'tracks';
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
    if (view === 'artists') {
      const next = nextArtistSort(artistSort);
      setArtistSort(next);
      writeSetting(SETTINGS.libraryArtistSort, next);
    } else if (view === 'folders') {
      const next = nextFolderSort(folderSort);
      setFolderSort(next);
      writeSetting(SETTINGS.libraryFolderSort, next);
    } else {
      chooseSort(nextSort(sort));
    }
  };
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
        : { short: t.library.screen.sortShort[sort], spoken: t.library.screen.sortedBy[sort] };
  const [tagging, setTagging] = useState(false);
  /**
   * The tracks being written into their files, or null when that is not open.
   *
   * The tracks themselves and not their ids, taken when the sheet is opened:
   * what is written is what the library showed at that moment, and the sheet
   * must not find the run changing under it while it works.
   */
  const [writingTo, setWritingTo] = useState<EnrichedTrack[] | null>(null);
  const columns = useListColumns();
  const { playQueue, playNext, addToQueue } = usePlayerActions();
  const { current } = usePlayerState();
  const router = useRouter();

  const library = screen.kind === 'library' ? screen.tracks : NOTHING;

  /*
    Folding the whole library is not something to do on every render. `search`
    normalises every title, artist, album and tag it looks at, and unmemoised it
    ran again for a menu opening or a track change as readily as for a keystroke.
  */
  const { tracks: found, matchedTags } = useMemo(
    () => search(library, query),
    [library, query]
  );

  /*
    Ordered after the search rather than before it, so the two compose: a query
    narrows the library and the order arranges whatever is left, which is what
    somebody searching an artist's name while sorted by what is new is asking
    for. Memoised for the same reason the search is — the comparison folds every
    title it looks at, and re-running it because a menu opened would fold the
    whole library again.
  */
  const results = useMemo(() => sortTracks(found, sort, played), [found, played, sort]);

  /*
    The records the search results belong to.

    Built from the results rather than from the whole library, so searching
    narrows the albums the same way it narrows the tracks — which is what
    anybody typing an artist's name into a library of albums expects.
  */
  const albums = useMemo(
    () => (albumView ? sortAlbums(albumsOf(results), sort, played) : []),
    [albumView, played, results, sort]
  );

  /**
   * Records whose name the query matched, for jumping straight to one.
   *
   * Only while browsing by track and only while searching. In the album view
   * the list is already the answer, and with no query every record in the
   * library would qualify.
   */
  const matchedAlbums = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (albumView || needle.length === 0) return [];
    return albumsOf(results)
      .filter((entry) => entry.key.includes(needle))
      .slice(0, 3);
  }, [albumView, query, results]);

  /*
    The whole library under its artists, and under its folders.

    From the library and not from the search results, unlike the records above.
    A record narrowed by a query is still that record; an artist built from the
    tracks a query happened to match would be the same name with a different
    count beside it on every keystroke. What is typed narrows the headings
    instead, by name, below.

    Only while it is the view being drawn. Reading every credit in the library
    is not free, and the other views have no use for the answer.
  */
  const artists = useMemo(
    // Told the language, for the one heading whose name is the app's own words.
    () => (view === 'artists' ? artistsOf(library, namesOn, t) : []),
    [library, namesOn, t, view]
  );
  const folders = useMemo(
    () => (view === 'folders' ? foldersOf(library, libraryRoot()) : []),
    [library, view]
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
  const shownHeadings = useMemo((): Heading[] => {
    if (view === 'tracks') return NO_HEADINGS;
    if (view === 'albums') {
      return albums.map((album) => ({
        id: album.key,
        title: album.name,
        detail: [album.artist, t.common.tracks(album.tracks.length), album.year]
          .filter(Boolean)
          .join(' · '),
        tracks: album.tracks,
        // One cover, not four: a record has its own, and the first track's is it.
        cover: album.tracks[0] ?? null,
      }));
    }
    if (view === 'artists') {
      return searchNamed(orderedArtists, query, (artist) => artist.name).map((artist) => ({
        id: artist.key,
        title: artist.name,
        detail: `${t.common.tracks(artist.tracks.length)} · ${t.common.albums(artist.albums.length)}`,
        tracks: artist.tracks,
        cover: artist.cover,
      }));
    }
    // The library folder itself has no path from itself, so it is looked for
    // by its name, which is what its row says.
    return searchNamed(orderedFolders, query, (folder) => folder.path || folder.name).map((folder) => ({
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
      cover: folder.tracks[0] ?? null,
    }));
  }, [albums, orderedArtists, orderedFolders, query, t, view]);

  // Read at press time, as the results are below, so the handlers every row is
  // given stay the same functions across a search or a change of order.
  const headingsRef = useRef(shownHeadings);
  headingsRef.current = shownHeadings;

  /*
    A tap opens the heading, and while tracks are being chosen it chooses the
    heading's instead — all of them, or none if all were already chosen.

    Holding one is how choosing starts from a row. Once it has started, holding
    does what a tap does, as it does on a track.
  */
  const onHeadingPress = useCallback(
    (id: string) => {
      if (!selecting) {
        router.push({
          pathname: '/playlist',
          params: view === 'albums' ? { album: id } : view === 'artists' ? { artist: id } : { folder: id },
        });
        return;
      }
      const under = headingsRef.current.find((heading) => heading.id === id)?.tracks;
      if (under) setSelected((held) => withGroupToggled(held, under));
    },
    [router, selecting, view]
  );

  const onHeadingHeld = useCallback((id: string) => {
    const under = headingsRef.current.find((heading) => heading.id === id)?.tracks;
    if (!under) return;
    // The box may be mid-word; what was typed has done its narrowing.
    Keyboard.dismiss();
    setSelecting(true);
    setSelected((held) => withGroupToggled(held, under));
  }, []);

  /*
    Each row is told its own answer — none, some, all — and not handed the
    set. The answer is worked out here for the rows the list is actually
    drawing, a few dozen of them, and since it is a plain value the memoised
    row whose answer has not changed is not drawn again; one tick redraws the
    row ticked and any other row sharing a track with it.
  */
  const renderHeading = useCallback(
    ({ item }: { item: Heading }) => (
      <BrowseRow
        id={item.id}
        title={item.title}
        detail={item.detail}
        tracks={item.tracks}
        cover={item.cover}
        shared={columns > 1}
        mark={selecting ? markOf(item.tracks, selected) : undefined}
        onPress={onHeadingPress}
        onLongPress={onHeadingHeld}
      />
    ),
    [columns, onHeadingHeld, onHeadingPress, selected, selecting]
  );

  /** Each matched tag with the tracks carrying it, gathered once per search. */
  const tagShuffles = useMemo(
    () =>
      matchedTags.slice(0, 3).map((tag) => ({
        tag,
        tracks: library.filter((track) => track.tags.includes(tag)),
      })),
    [library, matchedTags]
  );

  // Read at press time rather than closed over, so the row handlers below stay
  // the same functions across a search that changes what is on screen.
  const resultsRef = useRef(results);
  resultsRef.current = results;

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
      if (index >= 0) void start(resultsRef.current, index);
    },
    [selecting, start, toggleSelected]
  );

  /** Leaves the mode and forgets the run; one never outlives the other. */
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const load = useCallback(async () => {
    // The spinner is for having nothing to show, not for re-reading something
    // already on screen. Swapping the list out for it on every focus tore the
    // list down and rebuilt it at the top, losing the reader's place — which is
    // what made coming back from another tab start over.
    setScreen((shown) => (shown.kind === 'library' ? shown : { kind: 'loading' }));
    try {
      if (!(await ensureAudioPermission())) {
        setScreen({ kind: 'denied' });
        return;
      }
      setScreen({ kind: 'library', tracks: withMetadata(await scanLibrary()) });
      // With the library and not once: a lookup made on another screen may
      // have settled whether a credit is one artist or two.
      const reader = creditReader();
      setNamesOn(() => reader);
      // Re-read with the library rather than once, so a track played on another
      // screen and then returned from has moved by the time the list is seen
      // again — which is the whole point of ordering by it.
      setPlayed(lastPlayedAt());
      const listens = new Map<string, number>();
      for (const [id, count] of playCounts()) listens.set(id, count.plays);
      setCounts(listens);
    } catch (error) {
      setScreen({ kind: 'error', message: String(error) });
    }
  }, []);

  /*
    The long-press menu and the list picker behind it, which every screen that
    shows tracks has the same one of. The picker is borrowed for a whole
    selection as well, so what it did is said and the selection ended here.
  */
  const { open: openMenu, addToList, erase, element: menuElement } = useTrackMenu({
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

  // A selection is left as it is. It is tracks whichever view it was made in,
  // every view can show it and end it, and choosing an artist and then going to
  // the tracks to let two of them go is a thing worth being able to do.
  const chooseView = useCallback((next: LibraryView) => {
    setRemembered(next);
    writeSetting(SETTINGS.libraryView, next);
  }, []);

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
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
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
  const slot = viewsWidth
    ? {
        width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, viewsWidth] }),
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
        style={columns > 1 ? styles.swipeShared : undefined}
        enabled={!selecting}
        left={{
          label: t.library.screen.swipePlayNext,
          colour: c.accentSoft,
          tint: c.accent,
          onAct: () => void playNext(item),
        }}
        right={{
          label: t.common.addToQueue,
          colour: c.successSoft,
          tint: c.success,
          onAct: () => void addToQueue(item),
        }}>
        <TrackRow
          track={item}
          playing={item.id === current?.id}
          onPress={onRowPress}
          // The per-track menu would be reached by the same gesture that picks a
          // row, so while choosing it steps aside.
          onLongPress={selecting ? toggleSelected : openMenu}
          selectable={selecting}
          selected={selected.has(item.id)}
        />
      </SwipeRow>
    ),
    [addToQueue, c, columns, current?.id, onRowPress, openMenu, playNext, selected, selecting, styles, t, toggleSelected]
  );

  /*
    Where the list was left, so returning to the tab returns to the same place.

    Held in a ref rather than in state: it changes on every frame of a scroll
    and nothing on screen depends on it, so storing it in state would re-render
    the whole library to record a number only the list itself reads back.
  */
  const restoreTo = useRef(0);

  const drag = useDragSelect({
    ids: useMemo(() => results.map((track) => track.id), [results]),
    rowHeight: TRACK_ROW_HEIGHT,
    columns,
    enabled: selecting,
    selected,
    onChange: setSelected,
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
          : new Set(results.map((track) => track.id)),
    [grouped, results, selecting, shownHeadings]
  );
  const allChosen = useMemo(() => holdsAll(selected, shown), [selected, shown]);
  const selectAll = useCallback(() => setSelected(new Set(shown)), [shown]);

  const chosen = useCallback(
    () => library.filter((track) => selected.has(track.id)),
    [library, selected]
  );

  const queueSelected = useCallback(() => {
    for (const track of chosen()) void addToQueue(track);
    stopSelecting();
  }, [addToQueue, chosen, stopSelecting]);

  const tagSelected = useCallback(
    (tag: string) => {
      addTagToTracks([...selected], tag);
      setTagging(false);
      stopSelecting();
      void load();
    },
    [load, selected, stopSelecting]
  );

  /**
   * Erases the chosen tracks, once the system has asked and the user agreed.
   *
   * The selection is only cleared when something was actually deleted. Backing
   * out of the confirmation should leave the run intact, ready to be narrowed
   * or acted on differently, rather than making the user pick it all again.
   */
  const deleteSelected = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    // Through the menu's own way of erasing, which also takes the files out
    // of the queue and reloads this screen. Erased directly, a selection left
    // its rows standing in the queue, naming files the player could not open.
    if (await erase(ids)) stopSelecting();
  }, [erase, selected, stopSelecting]);

  // Re-read on focus so metadata gathered on the other screen shows up here.
  useFocusEffect(
    useCallback(() => {
      void load();
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
        <Pressable android_ripple={pressed} style={styles.button} onPress={() => void load()}>
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
  const views = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t.library.screen.viewSwitch}
      style={[styles.views, !stacked && viewsWidth ? { width: viewsWidth } : null]}
      // Only beside the box is there a width worth knowing: on a row of its
      // own the switch is as wide as the screen and is never moved aside.
      onLayout={stacked ? undefined : measureViews}>
      {offered.map((candidate) => (
        <Pressable
          android_ripple={pressed}
          key={candidate}
          accessibilityRole="tab"
          accessibilityLabel={t.library.views[candidate]}
          accessibilityState={{ selected: candidate === view }}
          style={[
            styles.view,
            stacked ? styles.viewWide : offered.length > 2 && styles.viewTight,
            candidate === view && styles.viewOn,
          ]}
          onPress={() => chooseView(candidate)}>
          <Text
            style={[styles.viewLabel, candidate === view && styles.viewLabelOn]}
            numberOfLines={1}>
            {t.library.views[candidate]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  // A switch with one position is not a choice, and is not drawn.
  const switchable = offered.length > 1;

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
      edges={landscape ? ['right'] : ['top', 'left', 'right']}>
      <View style={landscape ? styles.sideways : styles.upright}>
        <View
          ref={middle}
          // Asked where it is when a record opens, so it has to be a view of
          // its own to be found.
          collapsable={false}
          style={styles.middle}>
        {/*
          Everything a record opens over. While one is open none of it is
          there to be touched or read out: it is covered, and a screen reader
          finding its way to a search box underneath a list would be finding
          something nobody can see.
        */}
        <View
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
        ]}>
        {switchable && stacked ? views : null}
        <View style={styles.headerRow}>
        {/*
          Pulled aside while the box is being typed in, and put back when it is
          let go of. Upright, searching is the one thing on this screen that
          wants the whole width — a query is longer than anything else typed
          into a phone — and it is also the one time the switch is certainly
          not about to be pressed.
        */}
        {switchable && !stacked ? (
          <Animated.View style={[styles.viewsSlot, slot]}>{views}</Animated.View>
        ) : null}
        <View style={[styles.searchRow, styles.searchGrow]}>
          <View style={styles.searchGrow}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearching(true)}
              onBlur={() => setSearching(false)}
              placeholder={t.library.screen.searchHints[view]}
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
            onPress={() => (selecting ? stopSelecting() : setSelecting(true))}>
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
            <Text style={styles.bulkCount}>{t.library.screen.selected(selected.size)}</Text>
            <View style={styles.bulkActions}>
              <Pressable
                android_ripple={pressed}
                style={styles.bulkAction}
                onPress={allChosen ? () => setSelected(new Set()) : selectAll}>
                <Text style={styles.bulkLabel}>
                  {allChosen ? t.common.clear : t.common.selectAll}
                </Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={queueSelected}>
                <Text style={styles.bulkLabel}>{t.common.addToQueue}</Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => addToList([...selected])}>
                <Text style={styles.bulkLabel}>{t.library.screen.addToList}</Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => setTagging(true)}>
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
                onPress={() => setWritingTo(chosen())}>
                <Text style={styles.bulkLabel}>{t.library.screen.writeToFiles}</Text>
              </Pressable>
              ) : null}
              <Pressable
                android_ripple={pressed}
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => void deleteSelected()}>
                <Text style={styles.bulkDestructive}>{t.common.delete}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {/* The records have no line of their own to spend the height on, but
            they are given one for as long as there is something to say: a
            selection made among them can be added to a list like any other. */}
        {albumView && (note == null || racked) ? null : (
        <View style={styles.meta}>
          <Text style={styles.metaText} numberOfLines={1}>
            {/* Whatever the list picker last did is said here, since adding
                to a list otherwise looks like nothing happening. */}
            {note ??
              (view === 'artists'
                ? t.common.artists(shownHeadings.length)
                : view === 'folders'
                  ? `${libraryRoot()} · ${t.library.screen.folders(shownHeadings.length)}`
                  : `${libraryRoot()} · ${t.common.tracks(library.length)}`)}
          </Text>
        </View>
        )}
      </View>

      {racked ? (
        <CoverFlow ref={shelf} albums={albums} onOpen={openAlbum} />
      ) : grouped ? (
        <FlatList
          data={shownHeadings}
          // Remounted for the view as well as for the columns: the three share
          // this list, and one scrolled half way down is no place to start
          // reading the other from.
          key={`${view}-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
          keyExtractor={(heading) => heading.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          // Exact with one column and left to be measured with two, for the
          // reason given at length on the track list below.
          getItemLayout={
            columns > 1
              ? undefined
              : (_data, index) => ({
                  length: BROWSE_ROW_HEIGHT,
                  offset: BROWSE_ROW_HEIGHT * index,
                  index,
                })
          }
          initialNumToRender={12 * columns}
          windowSize={7}
          removeClippedSubviews={columns === 1}
          renderItem={renderHeading}
          ListEmptyComponent={
            albumView ? (
              <Text style={styles.muted}>{t.library.noAlbums}</Text>
            ) : (
              <Text style={styles.empty}>
                {query.trim()
                  ? t.library.nothingMatches(query)
                  : t.library.screen.noFolders}
              </Text>
            )
          }
        />
      ) : (
      <View
        style={styles.listWrapper}
        ref={drag.wrapperRef}
        // Page coordinates are what a gesture reports, so where the list sits
        // in the window is needed to turn one into a row and a column.
        onLayout={drag.onWrapperLayout}
        {...drag.panHandlers}>
      <FlatList
        data={results}
        onLayout={(event) => drag.onWidth(event.nativeEvent.layout.width)}
        /*
          Remounts the list when the count changes. React Native refuses to
          alter numColumns on an existing list, and turning the phone is exactly
          when it changes.
        */
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
        keyExtractor={(track) => track.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        onScroll={(event) => {
          restoreTo.current = event.nativeEvent.contentOffset.y;
          drag.onScroll(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        // Read once, when the list is built. Covers the case the guard above
        // cannot: the list being torn down while the screen around it lives on.
        contentOffset={{ x: 0, y: restoreTo.current }}
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
          columns > 1
            ? undefined
            : (_data, index) => ({
                length: TRACK_ROW_HEIGHT,
                offset: headerHeight + TRACK_ROW_HEIGHT * index,
                index,
              })
        }
        // Covers are read out of the files, so keep that to what is on screen.
        initialNumToRender={12 * columns}
        windowSize={7}
        // Left to the list to measure, clipping guesses at what is off screen
        // from the same frames, and guesses wrong in the same way.
        removeClippedSubviews={columns === 1}
        ListHeaderComponent={
          <View
            style={tagShuffles.length > 0 || matchedAlbums.length > 0 ? styles.tagActions : null}
            onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
            {matchedAlbums.map((entry) => (
              <Pressable
                android_ripple={pressed}
                key={`album:${entry.key}`}
                style={styles.tagAction}
                onPress={() =>
                  router.push({ pathname: '/playlist', params: { album: entry.key } })
                }>
                <View style={styles.albumActionIcon}>
                  <PlaylistCover tracks={entry.tracks} chosen={entry.tracks[0]} size={22} />
                </View>
                <Text style={styles.tagActionLabel} numberOfLines={1}>
                  {entry.name}
                </Text>
                <Text style={styles.tagActionCount}>{t.format.number(entry.tracks.length)}</Text>
              </Pressable>
            ))}
            {tagShuffles.map(({ tag, tracks: tagged }) => (
              <Pressable
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
        }
        ListEmptyComponent={<Text style={styles.empty}>{t.library.nothingMatches(query)}</Text>}
        renderItem={renderItem}
      />
      </View>
      )}
        </View>

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
            onPlay={playFrom}
            // Its own record is the one place "go to album" has nowhere to go.
            onLongPress={openFromAlbum}
            onClosed={closeAlbum}
          />
        ) : null}
        </View>
        {/* The bar becomes a panel down the right, so the middle keeps its
            width and the height goes to the list. */}
        <NowPlayingBar column={landscape} />
      </View>

      <TagPrompt
        visible={tagging}
        count={selected.size}
        onSubmit={tagSelected}
        onClose={() => setTagging(false)}
      />

      <WriteFilesSheet
        visible={writingTo != null}
        tracks={writingTo ?? []}
        playingId={current?.id ?? null}
        onClose={(wroteAny) => {
          setWritingTo(null);
          // Only when something was written. Backing out of the question, or
          // a run in which nothing changed, leaves the selection as it was to
          // be narrowed or acted on some other way.
          if (wroteAny) {
            stopSelecting();
            void load();
          }
        }}
      />

      {menuElement}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  middle: { flex: 1, minWidth: 0 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  // Each row takes an equal share of the width so the pair lines up.
  columnRow: { gap: 8 },
  swipeShared: { flex: 1, minWidth: 0 },
  listWrapper: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTight: { paddingBottom: 8 },
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
  views: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 9, padding: 2, ...outlined(c) },
  // As small as two legible words: it is read once on the way past and pressed
  // rarely, and every point it takes is one the search box does not get.
  view: { alignItems: 'center', paddingVertical: 7, paddingHorizontal: 11, borderRadius: 7 },
  // Three or four words beside the box, sideways: each gives up a little of
  // its margin so the box keeps a width worth typing in.
  viewTight: { paddingHorizontal: 8 },
  // On a row of its own, where the views share the width evenly instead of
  // each taking what its word needs.
  viewWide: { flex: 1 },
  viewOn: { backgroundColor: c.selected },
  viewLabel: { color: c.textMuted, fontSize: 12.5 },
  viewLabelOn: { color: c.onSelected, fontWeight: '600' },
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: 9,
    paddingVertical: 5,
    ...outlined(c),
  },
  sortLabel: { color: c.textFaint, fontSize: 8.5, letterSpacing: 1 },
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
  links: { flexDirection: 'row', gap: 16 },
  link: { color: c.accent, fontSize: 13 },

  list: { paddingBottom: 8 },
  tagActions: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
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
  tagActionCount: { color: c.textFaint, fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', padding: 32 },

  body: { color: c.text, fontSize: 16, textAlign: 'center' },
  muted: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: c.surfaceRaised, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, ...outlined(c) },
  buttonLabel: { color: c.text, fontSize: 15 },

}));
