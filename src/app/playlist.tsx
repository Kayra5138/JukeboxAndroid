import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumTools } from '../components/AlbumTools';
import { LIST_COVER_SIZE, ListHeading } from '../components/ListHeading';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { useUnderBars } from '../components/UnderBars';
import { PlaylistCover } from '../components/PlaylistCover';
import { QueueList } from '../components/QueueList';
import { TextPrompt } from '../components/TextPrompt';
import { TrackPicker } from '../components/TrackPicker';
import { useTrackMenu, WITHOUT_ALBUM } from '../components/useTrackMenu';
import { useListFiles } from '../components/useListFiles';
import { AUTO_LISTS, autoListTrackIds, type AutoListId } from '../lib/db/autoLists';
import { playCounts } from '../lib/db/history';
import {
  addToPlaylist,
  deletePlaylist,
  playlist,
  playlistTrackIds,
  removeFromPlaylist,
  renamePlaylist,
  reorderPlaylist,
  setPlaylistCover,
  setPlaylistImage,
} from '../lib/db/playlists';
import { allTags, tagCounts } from '../lib/db/tags';
import { creditReader } from '../lib/db/credits';
import { useT } from '../lib/i18n/index';
import { albumsOf, findAlbum, type Album } from '../lib/media/albums';
import { artistsOf } from '../lib/media/artists';
import { foldersOf } from '../lib/media/folders';
import JukeboxAudio from '../../modules/jukebox-audio';
import { readLibrary } from '../lib/library/index';
import { useLibraryTracks } from '../lib/library/useLibrary';
import { libraryRoot } from '../lib/media/library';
import type { EnrichedTrack } from '../lib/media/merge';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { suggestForPlaylist, type Candidate, type Suggestion } from '../lib/playlists/suggest';
import { makeStyles, outlined, scene, useColours, usePressed } from '../lib/theme/index';
import { Behind, scrimOf } from '../lib/theme/Veil';
import { useLandscape } from '../lib/ui/layout';
import { useAnnounce } from '../lib/ui/announce';

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
};

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
  const insets = useSafeAreaInsets();
  // In a theme of glass the bar of what is playing is laid over the foot of the list, which runs on under it.
  const under = useUnderBars({ player: true });
  const landscape = useLandscape();
  const t = useT();
  const c = useColours();
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
      const found = findAlbum(albumsOf(library), album, from);
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
      const found = artistsOf(library, creditReader(), t).find(
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
      const found = foldersOf(library, libraryRoot()).find(
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
      // Said rather than left to be wondered about: a list that is shorter
      // than it was should say where the rest went, and that it is not gone.
      hint: tag
        ? t.lists.list.everythingTagged(tag)
        : away > 0
          ? t.lists.list.away(away)
          : null,
      // A chosen cover only counts while its track is still in the list.
      // Otherwise removing that track would leave the list wearing a picture
      // of something it no longer contains.
      cover: ordered.find((track) => track.id === details?.coverTrackId) ?? null,
      picture: details?.coverUri ?? null,
      tracks: ordered,
      albums: [],
      // Nothing to suggest for a list that fills itself.
      suggestions: tag ? [] : suggestions(ordered, library),
    });
  }, [album, artist, auto, folder, from, listId, t]);

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
  const held = useLibraryTracks();
  useEffect(() => {
    if (asking.current > 0 || madeFrom.current === null || madeFrom.current === held) return;
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
  const sheetOpen = choosingCover || confirmingDelete || adding;
  useEffect(() => {
    if (!sheetOpen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setChoosingCover(false);
      setConfirmingDelete(false);
      setAdding(false);
      return true;
    });
    return () => listener.remove();
  }, [sheetOpen]);

  const tracks = data?.tracks ?? [];

  const play = useCallback(
    (startIndex: number) => void playQueue(tracks, startIndex),
    [playQueue, tracks]
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
    void playQueue(order, 0);
  }, [playQueue, tracks]);

  /*
    Only when there is nothing to show instead, as in the library. A list
    already on screen stays there through a re-reading that failed: it is what
    was true a moment ago, and the next return to the screen asks again.
  */
  if (!data && failed) {
    return (
      <View style={[styles.screen, styles.centred, styles.failed]}>
        <Text style={styles.failedBody}>{failed}</Text>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.failedButton} onPress={() => void load()}>
          <Text style={styles.failedLabel}>{t.common.tryAgain}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.backLabel}>{t.library.back}</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={c.text} />
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
  const editable = stored && data.tag == null;
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

  return (
    <View style={styles.screen}>
      {/* Sideways the player runs down the right, so the record keeps the
          width and the height goes to its tracks.

          And everything the sheets below are laid over, which is the whole
          of the screen but them. */}
      <Behind
        veiled={choosingCover || adding || confirmingDelete || menu.veiled}
        style={landscape ? styles.sideways : styles.upright}>
      {/*
        The queue's list, reused whole. It was written to be a reorderable
        list of tracks with a remove on each row, which is exactly what this
        is — the only thing queue-specific about it was its name.

        It is also the screen's scroller, with everything else on the screen
        riding inside it. The other way round — this list inside a scroll view
        — mounted every row of a five hundred track list at once, each one
        opening a file for its cover.

        The sides are kept clear out here rather than in the header, so the
        rows and the copy of a row being dragged are kept clear with it.
      */}
      <View style={[styles.upright, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <QueueList
          // On a plate, where screens are glass: the page's own body, with what it was opened over round it.
          plate
          queue={tracks}
          // Nothing in a list is "the playing one"; the mark column stays empty.
          currentIndex={-1}
          onSelect={play}
          // On a record's own page "go to album" would open this page again.
          onLongPress={(index) => {
            const track = tracks[index];
            if (track) menu.open(track, album ? WITHOUT_ALBUM : undefined);
          }}
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
                  removeFromPlaylist(listId, track.id, Date.now());
                  void load();
                }
              : undefined
          }
          header={
            // The screen has no navigation header of its own, so nothing else
            // is keeping it out from under the clock.
            <View style={{ paddingTop: insets.top }}>
              {/* Shared with the record a sleeve in the rack opens into, so
                  the two cannot come to look like different things. */}
              <ListHeading
                onBack={() => router.back()}
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
                hint={data.hint}
                note={
                  note ? (
                    <Pressable accessibilityRole="button" onPress={() => setNote(null)}>
                      <Text style={styles.note}>{note}</Text>
                    </Pressable>
                  ) : null
                }
                onPlay={() => play(0)}
                onShuffle={shuffle}>
                {/* Adding the whole of it to the queue is the heading's third button now. */}
                <View style={styles.links}>
                  {album ? (
                    <Pressable
                      style={styles.linkHit}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({ pathname: '/album-rest', params: { album: data.record?.key ?? album } })
                      }>
                      <Text style={styles.link}>{t.library.albumActions.rest.label}</Text>
                    </Pressable>
                  ) : null}
                  {data.record ? <AlbumTools album={data.record} /> : null}
                  {exportable ? (
                    <Pressable style={styles.linkHit} accessibilityRole="button" onPress={() => files.exportList(exportable)}>
                      <Text style={styles.link}>{t.lists.files.export}</Text>
                    </Pressable>
                  ) : null}
                  {stored ? (
                    <>
                      {editable ? (
                        <Pressable style={styles.linkHit} accessibilityRole="button" onPress={() => setAdding(true)}>
                          <Text style={styles.link}>{t.lists.list.addTracks}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable style={styles.linkHit} accessibilityRole="button" onPress={() => setRenaming(true)}>
                        <Text style={styles.link}>{t.common.rename}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.linkHit}
                        accessibilityRole="button"
                        disabled={tracks.length === 0}
                        onPress={() => setChoosingCover(true)}>
                        <Text style={[styles.link, tracks.length === 0 && styles.actionOff]}>
                          {t.lists.list.cover}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.linkHit} accessibilityRole="button" onPress={() => setConfirmingDelete(true)}>
                        <Text style={styles.destructive}>{t.lists.list.deleteList}</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>

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
                    <Text accessibilityRole="header" style={styles.section}>{t.format.upper(t.lists.list.albums)}</Text>
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
                    <Text accessibilityRole="header" style={styles.section}>{t.format.upper(t.lists.list.tracks)}</Text>
                  </>
                ) : null}
              </ListHeading>

              {tracks.length === 0 ? (
                <Text style={styles.empty}>
                  {editable
                    ? t.lists.list.empty.editable
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
            </View>
          }
          footer={
            <View style={{ paddingBottom: insets.bottom + 32 + under.bottom }}>
              {data.suggestions.length > 0 ? (
                <View style={styles.suggested}>
                  <Text accessibilityRole="header" style={styles.section}>{t.format.upper(t.lists.list.mightBelong)}</Text>
                  <Text style={styles.hint}>{t.lists.list.mightBelongHint}</Text>
                  {data.suggestions.map((entry) => (
                    <Pressable
                      accessibilityRole="button"
                      android_ripple={pressed}
                      key={entry.track.id}
                      style={styles.suggestion}
                      onPress={() => {
                        if (listId == null) return;
                        addToPlaylist(listId, [entry.track.id], Date.now());
                        void load();
                      }}>
                      <View style={styles.suggestionText}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {entry.track.title}
                        </Text>
                        <Text style={styles.suggestionWhy} numberOfLines={1}>
                          {[entry.track.artist, entry.reasons.join(' · ')]
                            .filter(Boolean)
                            .join(' — ')}
                        </Text>
                      </View>
                      <Text style={styles.add}>{t.common.add}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          }
        />
      </View>

      <NowPlayingBar column={landscape} />
      </Behind>

      {choosingCover ? (
        <View style={styles.layer}>
          {/* Named, for a screen reader: in a sheet drawn over the screen rather than in a window
              of its own, touching outside it is one of the ways out, and it has to be findable. */}
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            onPress={() => setChoosingCover(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <Text style={styles.sheetHeading}>{t.format.upper(t.lists.list.cover)}</Text>
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              style={styles.coverChoice}
              onPress={() => {
                void (async () => {
                  setChoosingCover(false);
                  try {
                    const picked = await JukeboxAudio.pickImageAsync?.();
                    // Null is the user backing out, which is not a failure and
                    // must not clear the cover they already had.
                    if (picked && listId != null) setPlaylistImage(listId, picked);
                  } catch (error) {
                    // Said rather than swallowed. A sheet that closes and
                    // changes nothing is indistinguishable from one that was
                    // cancelled, which is how this came to look broken.
                    setNote(error instanceof Error ? error.message : t.common.pictureFailed);
                  }
                  void load();
                })();
              }}>
              <Text style={styles.link}>{t.lists.list.choosePicture}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              style={styles.coverChoice}
              onPress={() => {
                if (listId != null) setPlaylistCover(listId, null);
                setChoosingCover(false);
                void load();
              }}>
              <Text style={styles.link}>{t.lists.list.firstFour}</Text>
            </Pressable>
            <ScrollView style={styles.coverScroll}>
              {tracks.map((track) => (
                <Pressable
                  accessibilityRole="button"
                  android_ripple={pressed}
                  key={track.id}
                  style={styles.coverChoice}
                  onPress={() => {
                    if (listId != null) setPlaylistCover(listId, track.id);
                    setChoosingCover(false);
                    void load();
                  }}>
                  <PlaylistCover tracks={[track]} chosen={track} size={40} />
                  <Text style={styles.coverName} numberOfLines={1}>
                    {track.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

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

      {confirmingDelete ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Not a stop for a screen reader: Cancel is right below it, and says so. */}
          <Pressable style={styles.backdrop} accessible={false} onPress={() => setConfirmingDelete(false)} />
          <View style={styles.confirm}>
            <Text style={styles.confirmHeading}>{t.lists.list.deleteQuestion(data.name)}</Text>
            <Text style={styles.hint}>{t.lists.list.deleteHint}</Text>
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.confirmButton} onPress={() => setConfirmingDelete(false)}>
                <Text style={styles.link}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={styles.confirmButton}
                onPress={() => {
                  if (listId != null) deletePlaylist(listId);
                  router.back();
                }}>
                <Text style={styles.destructive}>{t.common.delete}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {menu.element}
      {files.element}
    </View>
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

  const tags = allTags();
  const plays = playCounts();
  const counts = new Map(tagCounts().map((entry) => [entry.tag, entry.trackCount]));

  const candidate = (track: EnrichedTrack): Candidate => ({
    trackId: track.id,
    tags: (tags.get(track.id) ?? []).map((entry) => entry.tag),
    artist: track.artist,
    plays: plays.get(track.id)?.plays ?? 0,
    completed: plays.get(track.id)?.completed ?? 0,
  });

  const held = new Set(members.map((track) => track.id));
  const found: Suggestion[] = suggestForPlaylist({
    members: members.map(candidate),
    candidates: library.filter((track) => !held.has(track.id)).map(candidate),
    libraryTagCounts: counts,
    libraryTotal: library.length,
    limit: SUGGESTIONS,
  });

  const byId = new Map(library.map((track) => [track.id, track]));
  return found
    .map((entry) => ({ track: byId.get(entry.trackId), reasons: entry.reasons }))
    .filter((entry): entry is { track: EnrichedTrack; reasons: string[] } => entry.track != null);
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  centred: { alignItems: 'center', justifyContent: 'center' },
  failed: { gap: 16, padding: 24 },
  failedBody: { color: c.text, fontSize: 16, textAlign: 'center' },
  failedButton: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...outlined(c),
  },
  failedLabel: { color: c.text, fontSize: 15 },

  backLabel: { color: c.accent, fontSize: 16 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  note: { color: c.danger, fontSize: 12.5, paddingTop: 4 },

  actionOff: { opacity: 0.35 },

  /*
    Each a finger's height, though drawn as a line of words: as words alone a
    press had sixteen points to land on. The room above them was sixteen and
    is now inside the first row of them, so they sit where they did.
  */
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  linkHit: { minHeight: 48, justifyContent: 'center' },
  link: { color: c.accent, fontSize: 13.5 },
  destructive: { color: c.danger, fontSize: 13.5 },

  empty: { color: c.textFaint, fontSize: 13, lineHeight: 20, paddingHorizontal: 20 },

  records: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 10 },
  // As wide as its sleeve and no wider, so a long name wraps under its own
  // cover instead of pushing the next one along.
  record: { width: RECORD_SIZE, gap: 4 },
  recordName: { color: c.text, fontSize: 12.5, lineHeight: 16, paddingTop: 3 },
  recordYear: { color: c.textFaint, fontSize: 11.5, fontVariant: ['tabular-nums'] },

  suggested: { paddingHorizontal: 20, paddingTop: 10, gap: 4 },
  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 28,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  suggestionText: { flex: 1, minWidth: 0, gap: 2 },
  suggestionTitle: { color: c.text, fontSize: 14.5 },
  suggestionWhy: { color: c.textFaint, fontSize: 12 },
  add: { color: c.accent, fontSize: 13.5 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimOf(c) },
  confirm: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '35%',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 20,
    gap: 10,
    ...outlined(c),
  },
  confirmHeading: { color: c.text, fontSize: 15.5, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 6 },
  confirmButton: { paddingHorizontal: 14, paddingVertical: 9 },

  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  sheetHeading: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    paddingBottom: 6,
  },
  coverScroll: { flexGrow: 0 },
  coverChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  coverName: { color: c.text, fontSize: 14.5, flex: 1, minWidth: 0 },
}));
