import { Artwork } from '../../../components/Artwork';
import { Note } from '../../../components/Note';
import { TextButton } from '../../../components/Button';
import { MediaPage, SectionLabel, type HeadLink } from '../../../components/MediaPage';
import { MediaRow } from '../../../components/MediaRow';
import { LEADING, PAGE, ROW_COVER_COMPACT, SPACE, TYPE } from '../../../lib/theme/measures';
import { ScreenState } from '../../../components/ScreenState';
import { useDownloadLibraryRevision } from '../../../lib/youtube/DownloadsProvider';
import { ConfirmSheet } from '../../../components/ConfirmSheet';
import { MenuEntry } from '../../../components/MenuSheet';
import { OnAPage } from '../../../components/OnAPage';
import { usePageRoom } from '../../../components/Page';
import { ListsIcon, PictureIcon } from '../../../components/Icons';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../../lib/ui/lists';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter, useIsFocused } from 'expo-router';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurArea, GlassScene } from '../../../components/Frosted';
import { Pressable } from '../../../components/Pressable';

import { useAlbumTools } from '../../../components/AlbumTools';
import { LIST_COVER_SIZE, ListHeading } from '../../../components/ListHeading';
import { useSetAsideLink } from '../../../components/SetAsideLink';
import { AlbumBy } from '../../../components/NameLinks';
import { PlaylistCover } from '../../../components/PlaylistCover';
import { QueueList } from '../../../components/QueueList';
import { ZoomStack } from '../../../components/looks/CoverGrid';
import { asZoom, TrackCover, WALL_COLUMNS } from '../../../components/looks/shared';
import { TextPrompt } from '../../../components/TextPrompt';
import { TrackPicker } from '../../../components/TrackPicker';
import { useTrackMenu, WITHOUT_ALBUM } from '../../../components/useTrackMenu';
import { useListFiles } from '../../../components/useListFiles';
import { AUTO_LISTS, autoListTrackIds, type AutoListId } from '../../../lib/db/autoLists';
import { playCounts } from '../../../lib/db/history';
import {
  addToPlaylist,
  deletePlaylist,
  markListPlayed,
  playlist,
  playlistTrackIds,
  putBackInPlaylist,
  removeFromPlaylist,
  renamePlaylist,
  reorderPlaylist,
  setPlaylistCover,
  setPlaylistImage,
} from '../../../lib/db/playlists';
import { tagCounts } from '../../../lib/db/tags';
import { readSetting, SETTINGS, writeSetting } from '../../../lib/db/index';
import { useT } from '../../../lib/i18n/index';
import { findAlbum, type Album } from '../../../lib/media/albums';
import JukeboxAudio from '../../../../modules/jukebox-audio';
import { readLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { libraryRoot } from '../../../lib/media/library';
import { useTrackArtwork } from '../../../lib/media/artwork';
import type { EnrichedTrack } from '../../../lib/media/merge';
import { usePlayerActions } from '../../../lib/player/PlayerProvider';
import { usePlayTapped } from '../../../lib/player/usePlayTapped';
import { grouped } from '../../../lib/media/grouped';
import { moveOnto } from '../../../lib/playlists/members';
import { suggestForPlaylist, type Candidate, type Suggestion } from '../../../lib/playlists/suggest';
import { useListSuggestions } from '../../../lib/ui/listSuggestions';
import { offerUndo } from '../../../lib/ui/undo';
import { makeStyles, scene, usePressed } from '../../../lib/theme/index';
import { useAnnounce } from '../../../lib/ui/announce';
import { useBack } from '../../../lib/ui/back';
import { backTo, useTrailLength } from '../../../lib/ui/pageTrail';
import { haptic } from '../../../lib/ui/haptics';
import { isTape } from '../../../lib/tapes/tape';
import { smartListTracks } from '../../../lib/lists/smartLive';
import { useTrackRing } from '../../../components/trackRing';

/** How many suggestions are worth showing before the section becomes a list. */
const SUGGESTIONS = 8;

/**
 * A sleeve in an artist's row of records.
 *
 * Three of them and the two gaps between fit the narrowest phone this is
 * likely to meet, inside the header's own margins; anything wider fits more.
 * Declared rather than worked out from the window, because the header is not
 * always the window's width — sideways the player takes a share of it — and a
 * size that wraps is right at any width without having to be told which.
 */
const RECORD_SIZE = 96;

type Loaded = {
  name: string;
  /** Set when the list is a live reading of a tag rather than chosen tracks. */
  tag: string | null;
  hint: string | null;
  /** The track whose cover was chosen, if one was and it is still here. */
  cover: EnrichedTrack | null;
  /** A picture chosen from the phone. */
  picture: string | null;
  tracks: EnrichedTrack[];
  /**
   * The records an artist's tracks are on, and empty for every other kind of
   * list: only an artist is something that has records.
   */
  albums: Album[];
  suggestions: { track: EnrichedTrack; reasons: string[] }[];
  /** The record, when the list is one; what is done to it as a whole is done to this. */
  record?: Album | null;
  /**
   * The tracks one cover is found among, for a record or an artist: see
   * `useAlbumArtwork`. Absent for a list, which shows its first four.
   */
  sleeve?: EnrichedTrack[] | null;
  /** Favorites, which can be renamed and emptied but not deleted. */
  favorites?: boolean;
  /** A smart list, whose songs are what its rules let in today: see `lists/smart.ts`. */
  smart?: boolean;
};

/**
 * A picture from the gallery made [listId]'s cover. Answers with what went
 * wrong, to be said, or null where nothing did. Out here rather than in the
 * screen, which the React Compiler does not take with a question inside a
 * `try`: the whole page went uncompiled for it.
 */
async function pickListPicture(listId: number | null, failedWords: string): Promise<string | null> {
  if (!JukeboxAudio.pickImageAsync) return null;
  try {
    const picked = await JukeboxAudio.pickImageAsync();
    // Null is the user backing out, which is not a failure and
    // must not clear the cover they already had.
    if (picked && listId != null) setPlaylistImage(listId, picked);
    return null;
  } catch (error) {
    // Said rather than swallowed. A sheet that closes and
    // changes nothing is indistinguishable from one that was
    // cancelled, which is how this came to look broken.
    return error instanceof Error ? error.message : failedWords;
  }
}

export default function PlaylistScreen() {
  const { id, auto, album, track: from, artist, folder } = useLocalSearchParams<{
    id?: string;
    auto?: AutoListId;
    /** A record's key, as `media/albums.ts` makes them. */
    album?: string;
    /**
     * The track a record was opened from, which says which of two records of
     * one name is meant when the key alone cannot (see `findAlbum`).
     */
    track?: string;
    /** An artist's key, as `media/artists.ts` makes them. */
    artist?: string;
    /** A folder's path, as `media/folders.ts` keys them. */
    folder?: string;
  }>();
  const router = useRouter();
  const downloadRevision = useDownloadLibraryRevision();
  const navigation = useNavigation();
  const t = useT();
  // What might belong in it, under its songs, unless that was turned off.
  const suggesting = useListSuggestions();
  const styles = useStyles();
  const pressed = usePressed();
  const { playQueue } = usePlayerActions();

  const listId = id ? Number(id) : null;
  const [data, setData] = useState<Loaded | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [choosingCover, setChoosingCover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Said aloud when it appears: it comes up where nobody's attention is, after a press elsewhere.
  useAnnounce(note);
  /** Why the last reading of the list did not finish, when it did not. */
  const [failed, setFailed] = useState<string | null>(null);
  /** The whole library, kept for the picker rather than scanned again for it. */
  const [library, setLibrary] = useState<EnrichedTrack[]>([]);

  /*
    The library is the one held for the whole app (`lib/library`), looked at
    again for each reading of the list and read off the device only when it
    has changed. Which library the list was last made from is remembered, so
    that one arriving later can be told from the one already drawn.
  */
  const madeFrom = useRef<EnrichedTrack[] | null>(null);
  const asking = useRef(0);

  const read = useCallback(async () => {
    asking.current += 1;
    const library = await readLibrary().then(
      (tracks) => {
        asking.current -= 1;
        return tracks;
      },
      (failure: unknown) => {
        asking.current -= 1;
        throw failure;
      }
    );
    madeFrom.current = library;
    const byId = new Map(library.map((track) => [track.id, track]));
    setLibrary(library);

    /*
      A record, which is a list nobody made: the tracks say which one they
      belong to and in what order, so there is nothing to store and nothing to
      keep in step. Read-only for the same reason the listening lists are —
      the order is the record's, not a choice to be edited.
    */
    if (album) {
      const found = findAlbum(grouped.albums(library), album, from);
      setData({
        name: found?.name ?? t.lists.list.album,
        tag: null,
        hint: found ? [found.artist, found.year].filter(Boolean).join(' · ') || null : null,
        cover: null,
        picture: null,
        tracks: found?.tracks ?? [],
        albums: [],
        suggestions: [],
        record: found,
        sleeve: found?.tracks ?? null,
      });
      return;
    }

    /*
      Two more lists nobody made, and read-only for the reason the record is.
      An artist's is everything the credits put them on, read the way the
      stats read a credit, so the song two people share is here for both of
      them; a folder's is whatever files sit directly in it.
    */
    if (artist) {
      // Told the language, for the one heading whose name is the app's own
      // words: the tracks that name nobody.
      const found = grouped.artists(library, t).find(
        (candidate) => candidate.key === artist
      );
      setData({
        name: found?.name ?? t.lists.list.artist,
        tag: null,
        hint: null,
        cover: null,
        picture: null,
        tracks: found?.tracks ?? [],
        albums: found?.albums ?? [],
        suggestions: [],
        // A record's sleeve where they have one, found among its tracks.
        sleeve: found?.sleeve ?? null,
      });
      return;
    }

    if (folder) {
      const found = grouped.folders(library, libraryRoot()).find(
        (candidate) => candidate.key === folder
      );
      setData({
        name: found?.name ?? t.lists.list.folder,
        tag: null,
        // Where it is, as seen from the library folder — unless that is only
        // its own name over again, or it is the library folder itself.
        hint: found && found.path && found.path !== found.name ? found.path : null,
        // No one cover: a folder is not a record, and the first four of
        // whatever is in it say more about it than the first one would.
        cover: null,
        picture: null,
        tracks: found?.tracks ?? [],
        albums: [],
        suggestions: [],
      });
      return;
    }

    if (auto) {
      // A route can be opened with anything; only a list there is has a name.
      const entry = AUTO_LISTS.includes(auto) ? t.lists.auto[auto] : null;
      const ordered = autoListTrackIds(auto, Date.now())
        .map((trackId) => byId.get(trackId))
        .filter((track): track is EnrichedTrack => track != null);

      setData({
        name: entry?.name ?? t.lists.list.list,
        tag: null,
        hint: entry?.hint ?? null,
        cover: null,
        picture: null,
        tracks: ordered,
        albums: [],
        suggestions: [],
      });
      return;
    }

    if (listId == null) return;

    const details = playlist(listId);

    /*
      A smart list is worked out from its rules, every time, against the
      library as it is now and the history as it stands: nothing was written
      down for it, so it cannot be out of date. In the order its rules ask
      for, which is the one thing about its order anybody chose.
    */
    if (details?.kind === 'smart') {
      const found = smartListTracks(library, details.rules);
      setData({
        name: details.name,
        tag: null,
        smart: true,
        hint: t.smart.hint,
        cover: found.find((track) => track.id === details.coverTrackId) ?? null,
        picture: details.coverUri,
        tracks: found,
        albums: [],
        // Nothing to suggest for a list that fills itself.
        suggestions: [],
      });
      return;
    }

    /*
      A list that is a standing question about a tag is read from the tag,
      every time. Nothing was written down for it, so there is nothing that
      can be out of date: a track tagged this morning is in it now.

      In the library's own order, because the tag has none of its own to offer
      and the order here should be the order the library shows. Choosing one
      would be pretending the list had been arranged.
    */
    const tag = details?.tag ?? null;
    /*
      Membership is kept by media store id, and an id does not resolve while
      its file is outside the library: the folder narrowed, a card out, the
      permission withdrawn. Those members are left out of what is shown and
      left in the list. Dropping them here once emptied every list of a
      library whose folder had been changed for an afternoon, and widening it
      again brought nothing back. Only erasing the file takes a track off.
    */
    const members = tag ? [] : playlistTrackIds(listId);
    const ordered = tag
      ? library.filter((track) => track.tags.includes(tag))
      : members
          .map((trackId) => byId.get(trackId))
          .filter((track): track is EnrichedTrack => track != null);
    const away = members.length - ordered.length;

    setData({
      name: details?.name ?? t.lists.list.list,
      tag,
      favorites: details?.kind === 'favorites',
      // Said rather than left to be wondered about: a list that is shorter
      // than it was should say where the rest went, and that it is not gone.
      hint: tag
        ? t.lists.list.everythingTagged(tag)
        : away > 0
          ? t.lists.list.away(away)
          : details?.kind === 'favorites'
            ? t.lists.favorites.kept
            : null,
      // A chosen cover only counts while its track is still in the list.
      // Otherwise removing that track would leave the list wearing a picture
      // of something it no longer contains.
      cover: ordered.find((track) => track.id === details?.coverTrackId) ?? null,
      picture: details?.coverUri ?? null,
      tracks: ordered,
      albums: [],
      // Nothing to suggest for a list that fills itself.
      suggestions: tag || !suggesting ? [] : suggestions(ordered, library),
    });
  }, [album, artist, auto, folder, from, listId, suggesting, t]);

  /*
    Reading the list can fail: the media store can refuse, and the lists come
    out of a database. Uncaught, a failure on the way in left the spinner
    turning for good, with no way to ask again.
  */
  const load = useCallback(async () => {
    setFailed(null);
    try {
      await read();
    } catch (error) {
      setFailed(String(error));
    }
  }, [read]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, downloadRevision])
  );

  /*
    And read again when the library changes under the list without this
    screen having asked: the app brought back to the front to find a file
    gone, or the first true reading of the device arriving behind the copy the
    app opened on. Not while a reading of the list is waiting for the library
    itself, which is that same change on its way here by the other road.
  */
  /*
    Nor while the page is not in front: under another, or in a tab not open.
    Each reading scores the whole library for what might belong here, and
    did so at every download that landed, for a page nobody was looking at;
    coming back to it reads it anyway (above).
  */
  const focused = useIsFocused();
  // Read when the library changes, and not when the page comes back, which reads it already.
  const inFront = useRef(focused);
  useEffect(() => {
    inFront.current = focused;
  }, [focused]);
  const held = useLibraryTracks();
  useEffect(() => {
    if (!inFront.current || asking.current > 0 || madeFrom.current === null || madeFrom.current === held) return;
    void load();
  }, [held, load]);

  /*
    The same menu a row in the library opens. Whatever it changes — a file
    erased, this very list added to — is read again here; what comes back from
    the details screen is read by the return to this one.
  */
  const menu = useTrackMenu({
    onChanged: () => void load(),
    onAdded: setNote,
  });
  // A row held and slid from, with the finger never lifted: see `pressMenu.ts`. On a record's own page, without the way to it.
  const ring = useTrackRing(menu);
  const albumRing = useTrackRing(menu, WITHOUT_ALBUM);

  /*
    Writing the list out as a playlist file. Its sheets are windows of their
    own; nothing here changes, so there is nothing to read again after.
  */
  const files = useListFiles();

  /*
    The back gesture closes whichever sheet of this screen's own is open,
    rather than leaving the screen from under it. It is the way out that a
    screen reader's user reaches for first, and left to the navigator it took
    them back to the lists with the sheet they were in never closed.

    Registered after the menu's, so a list picker the menu opened is the
    first thing back closes.
  */
  /*
    Back, from a page a name opened in place of another: to that one again,
    in its place, before it is to wherever the first of them was opened from.
    See `ui/pageTrail.ts`.
  */
  const trailed = useTrailLength() > 0;
  const back = () => {
    const to = backTo();
    if (to) router.replace({ pathname: '/playlist', params: to });
    else router.back();
  };
  useBack(trailed && focused, back);
  /*
    And from the bar's own arrow, which goes back by the navigator: kept to
    the trail the same way. Only going back is turned aside; the page put in
    this one's place by `back` itself is let through.
  */
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        const kind = event.data.action.type;
        if (kind !== 'GO_BACK' && kind !== 'POP') return;
        const to = backTo();
        if (!to) return;
        event.preventDefault();
        router.replace({ pathname: '/playlist', params: to });
      }),
    [navigation, router]
  );

  const tracks = data?.tracks ?? [];

  // Playing a list someone made brings it to the top of the Lists tab.
  const played = useCallback(() => {
    if (listId != null) markListPlayed(listId, Date.now());
  }, [listId]);

  const play = useCallback(
    (startIndex: number) => {
      played();
      void playQueue(tracks, startIndex);
    },
    [playQueue, played, tracks]
  );
  // A row tapped: the list from it, unless Settings → Player says otherwise for pages like this one.
  const playTapped = usePlayTapped();
  /*
    A folder of tapes — a book's parts, a show's episodes — is played in its
    order from the one tapped, whatever a tap does to a page of songs, and is
    not shuffled.
  */
  const tapesHere = folder != null && tracks.length > 0 && tracks.every((track) => isTape(track));
  /*
    The links under the head that are more than a press: looking a record up,
    and setting the whole of it aside (`library/setAside.ts`). Asked for here,
    above the screens drawn while the list is still being read.
  */
  const albumTools = useAlbumTools(data?.record ?? null);
  const setAsideLink = useSetAsideLink(
    tapesHere ? null : album ? 'album' : artist ? 'artist' : folder ? 'folder' : listId != null ? 'list' : null,
    album ? (data?.record?.key ?? album) : (artist ?? folder ?? (listId != null ? String(listId) : null))
  );
  const tap = useCallback(
    (startIndex: number) => {
      played();
      if (tapesHere) void playQueue(tracks, startIndex);
      else void playTapped(tracks, startIndex, 'page');
    },
    [playQueue, playTapped, played, tapesHere, tracks]
  );

  const shuffle = useCallback(() => {
    if (tracks.length === 0) return;
    // Shuffled here rather than by the player's shuffle, so the queue itself
    // is in the new order — which is what the queue screen then shows.
    const order = [...tracks];
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    played();
    void playQueue(order, 0);
  }, [playQueue, played, tracks]);

  /*
    The page's songs pinched out into a wall of covers, and back. Not on a
    record's own page, where every cover would be the record's. Asked for
    here, above the screens drawn while the list is still being read: a hook
    after them is one the first drawing never reached.
  */
  const zoomable = !album;
  const [zoom, setZoom] = useState(() => asZoom(readSetting(`${SETTINGS.listZoom}:page`)));
  // Come to rest at another level, as a pinch leaves it: see `ZoomStack`.
  const zoomTo = (level: number) => {
    setZoom(level);
    writeSetting(`${SETTINGS.listZoom}:page`, String(level));
  };

  /*
    Only when there is nothing to show instead, as in the library. A list
    already on screen stays there through a re-reading that failed: it is what
    was true a moment ago, and the next return to the screen asks again.
  */
  /*
    What kind of list it is, over the page, as every page of a thing says
    what it is in its bar ("Album", "Show"), the name being written large
    just under it. Until the list is read, what it was opened as.
  */
  const kind = album
    ? t.nav.album
    : artist
      ? t.nav.artist
      : folder
        ? t.nav.folder
        : data?.smart
          ? t.nav.smartList
          : data?.tag
            ? t.nav.tag
            : t.nav.list;
  const titled = <Stack.Screen options={{ title: kind }} />;

  if (!data) {
    return (
      <View style={styles.screen}>
        {titled}
        {failed ? <ScreenState kind="error" text={failed} onRetry={() => void load()} /> : <ScreenState kind="loading" />}
      </View>
    );
  }

  /*
    Two questions, not one. A list read from a tag is still the user's list --
    their name, their cover, theirs to delete. What is not theirs is what is
    in it: that is the tag's answer, and adding, removing or reordering would
    each quietly contradict the thing they asked for.
  */
  const stored = listId != null;
  const editable = stored && data.tag == null && !data.smart;
  /*
    What can be written out as a playlist: a list somebody made, and one
    made from listening, as it stands today. A record, an artist or a folder
    is already its files, in an order the files themselves give.
  */
  const exportable =
    !files.available
      ? null
      : listId != null
        ? ({ kind: 'list', id: listId } as const)
        : auto && AUTO_LISTS.includes(auto)
          ? ({ kind: 'auto', id: auto, name: data.name } as const)
          : null;

  /*
    Shared with the record a sleeve in the rack opens into, so the two cannot
    come to look like different things. Sideways, down a column of its own
    beside the tracks, as that record has it; upright, at the top of them.
  */
  const links: HeadLink[] = [
    ...(album
      ? [
          {
            label: t.library.albumActions.rest.label,
            onPress: () => router.push({ pathname: '/album-rest', params: { album: data.record?.key ?? album } }),
          },
        ]
      : []),
    ...(albumTools.link ? [albumTools.link] : []),
    ...(setAsideLink ? [setAsideLink] : []),
    ...(exportable ? [{ label: t.lists.files.export, onPress: () => files.exportList(exportable) }] : []),
    ...(stored
      ? [
          ...(editable ? [{ label: t.lists.list.addTracks, onPress: () => setAdding(true) }] : []),
          // What a smart list holds is changed by changing what it asks for.
          ...(data.smart && listId != null
            ? [{ label: t.smart.editRules, onPress: () => router.push({ pathname: '/smart-list', params: { id: String(listId) } }) }]
            : []),
          { label: t.common.rename, onPress: () => setRenaming(true) },
          { label: t.lists.list.cover, disabled: tracks.length === 0, onPress: () => setChoosingCover(true) },
          // Favorites has no Delete: the heart has to have somewhere to put a song.
          ...(data.favorites ? [] : [{ label: t.lists.list.deleteList, tone: 'danger' as const, onPress: () => setConfirmingDelete(true) }]),
        ]
      : []),
  ];

  const heading = (side: boolean) => (
    <ListHeading
      side={side}
      cover={
        <Pressable
          disabled={!stored || tracks.length === 0}
          // A picture and nothing else, so it is named for what a press does.
          accessibilityRole="button"
          accessibilityLabel={t.lists.list.cover}
          onPress={() => setChoosingCover(true)}>
          <PlaylistCover
            tracks={tracks}
            chosen={data.cover}
            picture={data.picture}
            sleeve={data.sleeve}
            size={LIST_COVER_SIZE}
          />
        </Pressable>
      }
      name={data.name}
      tracks={tracks}
      // A record's artists lead to them; any other list says what it says.
      hint={data.record ? <AlbumBy artist={data.record.artist} year={data.record.year} /> : data.hint}
      note={
        note ? (
          <Pressable accessibilityRole="button" onPress={() => setNote(null)}>
            <Note tone="bad" style={styles.note}>{note}</Note>
          </Pressable>
        ) : null
      }
      onPlay={() => play(0)}
      onShuffle={tapesHere ? undefined : shuffle}
      // Adding the whole of it to the queue is the heading's third button.
      links={links}>
      {albumTools.status}

      {/*
        An artist's records, above their tracks.

        In the header and not a list of its own, so the screen keeps
        one scroller and the tracks under it stay virtualised. It is
        not virtualised itself and does not need to be: these are
        one artist's records, a handful, where the tracks can be
        hundreds.

        Each opens the whole record, not the artist's part of it. A
        guest on one song of twelve is shown the sleeve because that
        song is on it, and what a sleeve opens is the record.
      */}
      {data.albums.length > 0 ? (
        <>
          <SectionLabel>{t.lists.list.albums}</SectionLabel>
          <View style={styles.records}>
            {data.albums.map((entry) => (
              <Pressable
                android_ripple={pressed}
                key={entry.key}
                accessibilityRole="button"
                accessibilityLabel={
                  entry.year ? `${entry.name}, ${entry.year}` : entry.name
                }
                accessibilityHint={t.lists.list.opensAlbum}
                style={styles.record}
                onPress={() =>
                  router.push({ pathname: '/playlist', params: { album: entry.key } })
                }>
                <PlaylistCover
                  tracks={entry.tracks}
                  chosen={null}
                  sleeve={entry.tracks}
                  size={RECORD_SIZE}
                />
                <Text style={styles.recordName} numberOfLines={2}>
                  {entry.name}
                </Text>
                {entry.year ? <Text style={styles.recordYear}>{entry.year}</Text> : null}
              </Pressable>
            ))}
          </View>
          {/* Only needed because something now stands between the
              buttons and the rows they play. */}
          <SectionLabel>{t.lists.list.tracks}</SectionLabel>
        </>
      ) : null}
    </ListHeading>
  );

  // Said where the rows would be, when there are none.
  const nothing = (
    <>
      {tracks.length === 0 ? (
        <Text style={styles.empty}>
          {editable
            ? t.lists.list.empty.editable
            : data.smart
              ? t.smart.empty
            : data.tag
              ? t.lists.list.empty.tag
            : album
              ? t.lists.list.empty.album
            : artist
              ? t.lists.list.empty.artist
            : folder
              ? t.lists.list.empty.folder
              : t.lists.list.empty.auto}
        </Text>
      ) : null}
    </>
  );
  // Under the songs, before the page's foot: songs that might belong, at the sides as rows are.
  const mightBelong = (
    <>
      {/* Not where they were turned off: Settings → Library. */}
      {suggesting && data.suggestions.length > 0 ? (
        <View style={styles.suggested}>
          <View style={styles.suggestedHead}>
            <SectionLabel>{t.lists.list.mightBelong}</SectionLabel>
            <Text style={styles.hint}>{t.lists.list.mightBelongHint}</Text>
          </View>
          {data.suggestions.map((entry) => (
            <Suggested
              key={entry.track.id}
              track={entry.track}
              reasons={entry.reasons}
              onAdd={() => {
                if (listId == null) return;
                addToPlaylist(listId, [entry.track.id], Date.now());
                void load();
              }}
            />
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <MediaPage
      head={heading}
      above={nothing}
      veiled={menu.veiled}
      /*
        The queue's list, reused whole. It was written to be a reorderable
        list of tracks with a remove on each row, which is exactly what this
        is — the only thing queue-specific about it was its name.

        It is also the page's scroller, with the head (upright) and the songs
        that might belong riding inside it. The other way round — this list
        inside a scroll view — mounted every row of a five hundred track list
        at once, each one opening a file for its cover.
      */
      rows={({ header, footer }) => {
        const foot = (
          <>
            {mightBelong}
            {footer}
          </>
        );
        return (
          // The tracks an area the bar of what is playing blurs, in a theme of glass: see `Frosted`.
          <GlassScene>
            <BlurArea style={styles.upright}>
              {/* The list and its wall of covers, pinched between as a gallery is: see `ZoomStack`. Not on a record's page. */}
              <ZoomStack
                zoom={zoomable ? zoom : 0}
                onZoom={zoomTo}
                enabled={zoomable}
                list={
                  <View collapsable={false} style={styles.shownPane}>
                    <QueueList
                      // On a plate, where screens are glass: the page's own body, with what it was opened over round it.
                      plate
                      queue={tracks}
                      // No place in a list is "the one playing"; the song playing is marked where it is in it all the same.
                      currentIndex={-1}
                      marksPlaying
                      onSelect={tap}
                      // On a record's own page "go to album" would open this page again.
                      onLongPress={(index) => {
                        const track = tracks[index];
                        if (track) menu.open(track, album ? WITHOUT_ALBUM : undefined);
                      }}
                      ring={album ? albumRing : ring}
                      /*
                        Left off entirely where there is nothing to arrange. A record's
                        running order is the record's, an artist's tracks and a folder's
                        files are whatever the library holds of them, an auto list is
                        read out of what was listened to, and a tag list is the tag's
                        answer -- none of them is an arrangement anybody made, so none of
                        them should offer a handle to change one.
                      */
                      onMove={
                        editable && listId != null
                          ? (from, to) => {
                              // By id: the rows are only the members on show, so a row
                              // number is not a position in the list.
                              const moved = tracks[from];
                              const target = tracks[to];
                              if (!moved || !target) return;
                              // Shown where it was let go at once: drawn back where it was
                              // until the list was read again, the row jumped twice.
                              const order = moveOnto(tracks.map((track) => track.id), moved.id, target.id);
                              if (order) {
                                const byId = new Map(tracks.map((track) => [track.id, track]));
                                setData((held) => (held ? { ...held, tracks: order.map((id) => byId.get(id)!) } : held));
                              }
                              reorderPlaylist(listId, moved.id, target.id, Date.now());
                              void load();
                            }
                          : undefined
                      }
                      onRemove={
                        editable && listId != null
                          ? (index) => {
                              const track = tracks[index];
                              if (!track) return;
                              // Where it was, so that taking the offer puts that one song
                              // back there and leaves alone whatever else changed since.
                              const place = removeFromPlaylist(listId, track.id, Date.now());
                              void load();
                              if (!place) return;
                              offerUndo(t.common.undone.removedFromList(track.title), () => {
                                putBackInPlaylist(listId, track.id, place, Date.now());
                                void load();
                              });
                            }
                          : undefined
                      }
                      header={header}
                      footer={foot}
                    />
                  </View>
                }
                items={tracks}
                keyOf={(track) => track.id}
                titleOf={(track) => track.title}
                detailOf={(track) => track.artist}
                renderCover={(track, size) => <TrackCover track={track} size={size} />}
                sleeveOf={(track) => track}
                labelOf={(_track, at) => String(at + 1)}
                header={header}
                footer={foot}
                top={0}
                bottom={0}
                onPress={(_track, index) => tap(index)}
                onLongPress={(track) => menu.open(track, album ? WITHOUT_ALBUM : undefined)}
                holdLabel={t.library.trackMenu}
              />
            </BlurArea>
          </GlassScene>
        );
      }}
      sheets={
        <>
          <CoverPage
            visible={choosingCover}
            tracks={tracks}
            onClose={() => setChoosingCover(false)}
            onPicture={() => {
              void (async () => {
                setChoosingCover(false);
                const failed = await pickListPicture(listId, t.common.pictureFailed);
                if (failed != null) setNote(failed);
                void load();
              })();
            }}
            onChosen={(track) => {
              if (listId != null) setPlaylistCover(listId, track?.id ?? null);
              setChoosingCover(false);
              void load();
            }}
          />

          <TrackPicker
            visible={adding}
            library={library}
            already={new Set(tracks.map((track) => track.id))}
            onClose={() => setAdding(false)}
            onAdd={(trackIds) => {
              if (listId == null) return;
              addToPlaylist(listId, trackIds, Date.now());
              void load();
            }}
          />

          <TextPrompt
            visible={renaming}
            heading={t.lists.list.renameHeading}
            placeholder={t.lists.naming.placeholder}
            initial={data.name}
            onSubmit={(name) => {
              if (listId != null) renamePlaylist(listId, name, Date.now());
              setRenaming(false);
              void load();
            }}
            onClose={() => setRenaming(false)}
          />

          {/* A small question, on the app's own card over the page and short of the bars (`Floating`). */}
          <ConfirmSheet
            visible={confirmingDelete}
            title={t.lists.list.deleteQuestion(data.name)}
            body={t.lists.list.deleteHint}
            confirmLabel={t.common.delete}
            danger
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={() => {
              if (listId != null) {
                deletePlaylist(listId);
                haptic('results', 'confirm');
              }
              router.back();
            }}
          />

          {menu.element}
          {files.element}
        </>
      }
    />
  );
}

/**
 * What a list's cover is to be: a picture from the phone, the first four of
 * its songs' covers, or one song's. A page of its own in the tab, the bars
 * where they are, its songs the page's own list (`OnAPage`, bare): they can
 * be hundreds, and were a short box of them scrolled inside the page.
 */
function CoverPage({
  visible,
  tracks,
  onClose,
  onPicture,
  onChosen,
}: {
  visible: boolean;
  tracks: EnrichedTrack[];
  onClose: () => void;
  onPicture: () => void;
  /** A song's cover, or null for the first four. */
  onChosen: (track: EnrichedTrack | null) => void;
}) {
  const t = useT();
  return (
    <OnAPage visible={visible} title={t.lists.list.cover} onClose={onClose} bare>
      <CoverChoices tracks={tracks} onPicture={onPicture} onChosen={onChosen} />
    </OnAPage>
  );
}

function CoverChoices({
  tracks,
  onPicture,
  onChosen,
}: {
  tracks: EnrichedTrack[];
  onPicture: () => void;
  onChosen: (track: EnrichedTrack | null) => void;
}) {
  const t = useT();
  // The rows to the page's sides, as a list's are (`MediaRow`); the room over and under them the page's.
  const room = usePageRoom({ edge: true });
  return (
    <FlatList
      removeClippedSubviews={CLIP_SUBVIEWS}
      windowSize={LIST_WINDOW}
      initialNumToRender={12}
      data={tracks}
      keyExtractor={(track) => track.id}
      contentContainerStyle={room}
      ListHeaderComponent={
        <>
          <MenuEntry icon={PictureIcon} label={t.lists.list.choosePicture} onPress={onPicture} />
          <MenuEntry icon={ListsIcon} label={t.lists.list.firstFour} onPress={() => onChosen(null)} />
        </>
      }
      renderItem={({ item: track }) => (
        <MediaRow
          size="compact"
          lead={<TrackCover track={track} size={ROW_COVER_COMPACT} />}
          title={track.title}
          subtitle={track.artist ?? undefined}
          onPress={() => onChosen(track)}
        />
      )}
    />
  );
}

/** A song that might belong in the list, with its cover, and a tap to add it. */
function Suggested({ track, reasons, onAdd }: { track: EnrichedTrack; reasons: string[]; onAdd: () => void }) {
  const t = useT();
  const artwork = useTrackArtwork(track);
  // A close-set row, as songs to pick are; pressed anywhere, it goes into the list.
  return (
    <MediaRow
      size="compact"
      lead={<Artwork uri={artwork} size={ROW_COVER_COMPACT} />}
      title={track.title}
      subtitle={[track.artist, reasons.join(' · ')].filter(Boolean).join(' — ')}
      onPress={onAdd}
      trailing={<TextButton label={t.common.add} strong onPress={onAdd} />}
    />
  );
}

/**
 * Builds the suggestion engine's inputs out of the library and the database.
 *
 * All four reads are whole-library rather than per track: the engine scores
 * every candidate at once, and asking per track would make opening a list cost
 * one query per song in the collection.
 */
function suggestions(
  members: EnrichedTrack[],
  library: EnrichedTrack[]
): { track: EnrichedTrack; reasons: string[] }[] {
  if (members.length === 0) return [];
  /*
    The same songs in the same library suggest the same: a list read again
    for a song moved in it or a cover chosen for it is not scored again.
  */
  const asked = members.map((track) => track.id).sort().join('\u0000');
  if (lastSuggested && lastSuggested.library === library && lastSuggested.asked === asked) return lastSuggested.found;

  const plays = playCounts();
  const counts = new Map(tagCounts().map((entry) => [entry.tag, entry.trackCount]));

  const candidate = (track: EnrichedTrack): Candidate => ({
    trackId: track.id,
    // Each track carries its tags already: the whole table is not read again for them.
    tags: track.tags,
    artist: track.artist,
    plays: plays.get(track.id)?.plays ?? 0,
    completed: plays.get(track.id)?.completed ?? 0,
  });

  const held = new Set(members.map((track) => track.id));
  const found: Suggestion[] = suggestForPlaylist({
    members: members.map(candidate),
    // Songs, and never a tape: a book or an episode is in no list.
    candidates: library.filter((track) => !held.has(track.id) && !isTape(track)).map(candidate),
    libraryTagCounts: counts,
    libraryTotal: library.length,
    limit: SUGGESTIONS,
  });

  const byId = new Map(library.map((track) => [track.id, track]));
  const shown = found
    .map((entry) => ({ track: byId.get(entry.trackId), reasons: entry.reasons }))
    .filter((entry): entry is { track: EnrichedTrack; reasons: string[] } => entry.track != null);
  lastSuggested = { library, asked, found: shown };
  return shown;
}

/** The last suggestions worked out, and for what. */
let lastSuggested: { library: EnrichedTrack[]; asked: string; found: { track: EnrichedTrack; reasons: string[] }[] } | null = null;

const useStyles = makeStyles((c) => StyleSheet.create({
  shownPane: { flex: 1 },
  hiddenPane: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0 },
  screen: { flex: 1, ...scene(c) },
  upright: { flex: 1 },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small },
  note: { paddingTop: SPACE.xs },

  actionOff: { opacity: 0.35 },


  empty: { color: c.textFaint, fontSize: TYPE.small, lineHeight: LEADING.small },

  records: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.m, paddingTop: SPACE.s },
  // As wide as its sleeve and no wider, so a long name wraps under its own
  // cover instead of pushing the next one along.
  record: { width: RECORD_SIZE, gap: SPACE.xs },
  recordName: { color: c.text, fontSize: TYPE.hint, lineHeight: LEADING.hint, paddingTop: SPACE.xxs },
  recordYear: { color: c.textFaint, fontSize: TYPE.label, fontVariant: ['tabular-nums'] },

  // The label and its note at the page's margins; the songs to its sides, as rows of a list are.
  suggested: { paddingTop: SPACE.s, gap: SPACE.xs },
  suggestedHead: { paddingHorizontal: PAGE.side, gap: SPACE.xs, paddingBottom: SPACE.s },
}));
