import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingBar } from '../components/NowPlayingBar';
import { PlaylistCover } from '../components/PlaylistCover';
import { QueueList } from '../components/QueueList';
import { TextPrompt } from '../components/TextPrompt';
import { TrackPicker } from '../components/TrackPicker';
import { AUTO_LISTS, autoListTrackIds, type AutoListId } from '../lib/db/autoLists';
import { playCounts } from '../lib/db/history';
import {
  addToPlaylist,
  deletePlaylist,
  forgetMissingTracks,
  playlist,
  playlistTrackIds,
  removeFromPlaylist,
  renamePlaylist,
  reorderPlaylist,
  setPlaylistCover,
  setPlaylistImage,
} from '../lib/db/playlists';
import { allTags, tagCounts } from '../lib/db/tags';
import { albumsOf } from '../lib/media/albums';
import JukeboxAudio from '../../modules/jukebox-audio';
import { scanLibrary } from '../lib/media/library';
import { withMetadata, type EnrichedTrack } from '../lib/media/merge';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { suggestForPlaylist, type Candidate, type Suggestion } from '../lib/playlists/suggest';
import { formatDuration } from '../lib/stats/period';
import { useLandscape } from '../lib/ui/layout';

const ACCENT = '#7ab8ff';

/** How many suggestions are worth showing before the section becomes a list. */
const SUGGESTIONS = 8;

const COVER_SIZE = 96;

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
  suggestions: { track: EnrichedTrack; reasons: string[] }[];
};

export default function PlaylistScreen() {
  const { id, auto, album } = useLocalSearchParams<{
    id?: string;
    auto?: AutoListId;
    album?: string;
  }>();
  const router = useRouter();
  const downloadRevision = useDownloadLibraryRevision();
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const { playQueue, addToQueue } = usePlayerActions();

  const listId = id ? Number(id) : null;
  const [data, setData] = useState<Loaded | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [choosingCover, setChoosingCover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** The whole library, kept for the picker rather than scanned again for it. */
  const [library, setLibrary] = useState<EnrichedTrack[]>([]);

  const load = useCallback(async () => {
    const library = withMetadata(await scanLibrary());
    const byId = new Map(library.map((track) => [track.id, track]));
    setLibrary(library);

    /*
      A record, which is a list nobody made: the tracks say which one they
      belong to and in what order, so there is nothing to store and nothing to
      keep in step. Read-only for the same reason the listening lists are —
      the order is the record's, not a choice to be edited.
    */
    if (album) {
      const found = albumsOf(library).find((candidate) => candidate.key === album);
      setData({
        name: found?.name ?? 'Album',
        tag: null,
        hint: found ? [found.artist, found.year].filter(Boolean).join(' · ') || null : null,
        cover: found?.tracks[0] ?? null,
        picture: null,
        tracks: found?.tracks ?? [],
        suggestions: [],
      });
      return;
    }

    if (auto) {
      const entry = AUTO_LISTS.find((candidate) => candidate.id === auto);
      const ordered = autoListTrackIds(auto, Date.now())
        .map((trackId) => byId.get(trackId))
        .filter((track): track is EnrichedTrack => track != null);

      setData({
        name: entry?.name ?? 'List',
        tag: null,
        hint: entry?.hint ?? null,
        cover: null,
        picture: null,
        tracks: ordered,
        suggestions: [],
      });
      return;
    }

    if (listId == null) return;

    /*
      Membership is kept by media store id, and an id stops resolving once its
      file is gone. Cleared against the library that was just scanned, so a
      list does not quietly fill up with entries that can never play — and so
      the count on the previous screen means something.
    */
    forgetMissingTracks(new Set(byId.keys()));

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
    const ordered = tag
      ? library.filter((track) => track.tags.includes(tag))
      : playlistTrackIds(listId)
          .map((trackId) => byId.get(trackId))
          .filter((track): track is EnrichedTrack => track != null);

    setData({
      name: details?.name ?? 'List',
      tag,
      hint: tag ? `Everything tagged ${tag}, as it stands` : null,
      // A chosen cover only counts while its track is still in the list.
      // Otherwise removing that track would leave the list wearing a picture
      // of something it no longer contains.
      cover: ordered.find((track) => track.id === details?.coverTrackId) ?? null,
      picture: details?.coverUri ?? null,
      tracks: ordered,
      // Nothing to suggest for a list that fills itself.
      suggestions: tag ? [] : suggestions(ordered, library),
    });
  }, [album, auto, listId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, downloadRevision])
  );

  const tracks = data?.tracks ?? [];
  const total = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.durationSec ?? 0), 0),
    [tracks]
  );

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

  if (!data) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color="#ededed" />
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

  return (
    <View style={styles.screen}>
      {/* Sideways the player runs down the right, so the record keeps the
          width and the height goes to its tracks. */}
      <View style={landscape ? styles.sideways : styles.upright}>
      <ScrollView
        contentContainerStyle={{
          // The screen has no navigation header of its own, so nothing else is
          // keeping it out from under the clock.
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom + 32,
        }}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backLabel}>‹ Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.identity}>
            <Pressable
              disabled={!stored || tracks.length === 0}
              onPress={() => setChoosingCover(true)}>
              <PlaylistCover
                tracks={tracks}
                chosen={data.cover}
                picture={data.picture}
                size={COVER_SIZE}
              />
            </Pressable>
            <View style={styles.identityText}>
              <Text style={styles.name} numberOfLines={3}>
                {data.name}
              </Text>
              <Text style={styles.detail}>
                {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
                {total > 0 ? ` · ${formatDuration(total)}` : ''}
              </Text>
              {data.hint ? <Text style={styles.hint}>{data.hint}</Text> : null}
          {note ? (
            <Pressable onPress={() => setNote(null)}>
              <Text style={styles.note}>{note}</Text>
            </Pressable>
          ) : null}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.action, tracks.length === 0 && styles.actionOff]}
              disabled={tracks.length === 0}
              onPress={() => play(0)}>
              <Text style={styles.actionLabel}>Play</Text>
            </Pressable>
            <Pressable
              style={[styles.secondary, tracks.length === 0 && styles.actionOff]}
              disabled={tracks.length === 0}
              onPress={shuffle}>
              <Text style={styles.secondaryLabel}>Shuffle</Text>
            </Pressable>
          </View>

          <View style={styles.links}>
            <Pressable
              disabled={tracks.length === 0}
              onPress={() => tracks.forEach((track) => void addToQueue(track))}>
              <Text style={[styles.link, tracks.length === 0 && styles.actionOff]}>
                Add to queue
              </Text>
            </Pressable>
            {stored ? (
              <>
                {editable ? (
                  <Pressable onPress={() => setAdding(true)}>
                    <Text style={styles.link}>Add tracks</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setRenaming(true)}>
                  <Text style={styles.link}>Rename</Text>
                </Pressable>
                <Pressable
                  disabled={tracks.length === 0}
                  onPress={() => setChoosingCover(true)}>
                  <Text style={[styles.link, tracks.length === 0 && styles.actionOff]}>
                    Cover
                  </Text>
                </Pressable>
                <Pressable onPress={() => setConfirmingDelete(true)}>
                  <Text style={styles.destructive}>Delete list</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {tracks.length === 0 ? (
          <Text style={styles.empty}>
            {editable
              ? 'Nothing in here yet. Add tracks above, or send them here from the library.'
              : data.tag
                ? 'Nothing carries that tag yet. Add it to a few tracks and they will appear here.'
              : album
                ? 'That record is not in the library any more.'
                : 'Nothing qualifies yet. Listen to a few things first.'}
          </Text>
        ) : (
          /*
            The queue's list, reused whole. It was written to be a reorderable
            list of tracks with a remove on each row, which is exactly what this
            is — the only thing queue-specific about it was its name.
          */
          <QueueList
            queue={tracks}
            // Nothing in a list is "the playing one"; the mark column stays empty.
            currentIndex={-1}
            onSelect={play}
            /*
              Left off entirely where there is nothing to arrange. A record's
              running order is the record's, an auto list is read out of what
              was listened to, and a tag list is the tag's answer -- none of
              the three is an arrangement anybody made, so none of them should
              offer a handle to change one.
            */
            onMove={
              editable && listId != null
                ? (from, to) => {
                    reorderPlaylist(listId, from, to, Date.now());
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
          />
        )}

        {data.suggestions.length > 0 ? (
          <View style={styles.suggested}>
            <Text style={styles.section}>Might belong here</Text>
            <Text style={styles.hint}>
              Judged from the tags the list already leans on, weighted so a rare
              one counts for more than a tag half the library carries.
            </Text>
            {data.suggestions.map((entry) => (
              <Pressable
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
                <Text style={styles.add}>Add</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <NowPlayingBar column={landscape} />
      </View>

      {choosingCover ? (
        <View style={styles.layer}>
          <Pressable style={styles.backdrop} onPress={() => setChoosingCover(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <Text style={styles.sheetHeading}>Cover</Text>
            <Pressable
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
                    setNote(error instanceof Error ? error.message : 'That picture would not load.');
                  }
                  void load();
                })();
              }}>
              <Text style={styles.link}>Choose a picture…</Text>
            </Pressable>
            <Pressable
              style={styles.coverChoice}
              onPress={() => {
                if (listId != null) setPlaylistCover(listId, null);
                setChoosingCover(false);
                void load();
              }}>
              <Text style={styles.link}>Use the first four</Text>
            </Pressable>
            <ScrollView style={styles.coverScroll}>
              {tracks.map((track) => (
                <Pressable
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
        heading="Rename the list"
        placeholder="List name"
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
          <Pressable style={styles.backdrop} onPress={() => setConfirmingDelete(false)} />
          <View style={styles.confirm}>
            <Text style={styles.confirmHeading}>Delete “{data.name}”?</Text>
            <Text style={styles.hint}>
              The list goes. The tracks stay on the phone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmButton} onPress={() => setConfirmingDelete(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmButton}
                onPress={() => {
                  if (listId != null) deletePlaylist(listId);
                  router.back();
                }}>
                <Text style={styles.destructive}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  centred: { alignItems: 'center', justifyContent: 'center' },

  back: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  backLabel: { color: ACCENT, fontSize: 16 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, gap: 5 },
  identity: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  identityText: { flex: 1, minWidth: 0, gap: 5 },
  name: { color: '#f2f2f2', fontSize: 22, fontWeight: '600' },
  detail: { color: '#8a8a8a', fontSize: 13 },
  hint: { color: '#5f5f5f', fontSize: 12, lineHeight: 18 },
  note: { color: '#d08a8a', fontSize: 12.5, paddingTop: 4 },

  actions: { flexDirection: 'row', gap: 10, paddingTop: 16 },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ededed',
    borderRadius: 11,
    paddingVertical: 12,
  },
  actionLabel: { color: '#121212', fontSize: 15, fontWeight: '600' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 11,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  secondaryLabel: { color: '#ededed', fontSize: 15 },
  actionOff: { opacity: 0.35 },

  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, paddingTop: 16 },
  link: { color: ACCENT, fontSize: 13.5 },
  destructive: { color: '#d08a8a', fontSize: 13.5 },

  empty: { color: '#6a6a6a', fontSize: 13, lineHeight: 20, paddingHorizontal: 20 },

  suggested: { paddingHorizontal: 20, paddingTop: 10, gap: 4 },
  section: {
    color: '#5f5f5f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 28,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#242424',
  },
  suggestionText: { flex: 1, minWidth: 0, gap: 2 },
  suggestionTitle: { color: '#ededed', fontSize: 14.5 },
  suggestionWhy: { color: '#6a6a6a', fontSize: 12 },
  add: { color: ACCENT, fontSize: 13.5 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000cc' },
  confirm: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '35%',
    backgroundColor: '#1c1c1c',
    borderRadius: 14,
    padding: 20,
    gap: 10,
  },
  confirmHeading: { color: '#ededed', fontSize: 15.5, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 6 },
  confirmButton: { paddingHorizontal: 14, paddingVertical: 9 },

  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  sheetHeading: {
    color: '#8a8a8a',
    fontSize: 12,
    textTransform: 'uppercase',
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
    borderBottomColor: '#242424',
  },
  coverName: { color: '#ededed', fontSize: 14.5, flex: 1, minWidth: 0 },
});
