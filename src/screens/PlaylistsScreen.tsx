import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingBar } from '../components/NowPlayingBar';
import { PlaylistCover } from '../components/PlaylistCover';
import { TextPrompt } from '../components/TextPrompt';
import { AUTO_LISTS } from '../lib/db/autoLists';
import {
  addToPlaylist,
  coverTrackIds,
  createPlaylist,
  playlists,
  type Playlist,
} from '../lib/db/playlists';
import { tagCounts, trackIdsWithTag, type TagCount } from '../lib/db/tags';
import { scanLibrary } from '../lib/media/library';
import { useLandscape } from '../lib/ui/layout';
import type { Track } from '../lib/types';

const ACCENT = '#7ab8ff';

/** Enough tags to pick from without the sheet becoming the tag screen. */
const TAG_CHOICES = 40;

/** How many covers a square holds, and so how many tracks are asked for. */
const COVER_TRACKS = 4;

const COVER_SIZE = 52;

export default function PlaylistsScreen() {
  const router = useRouter();
  const downloadRevision = useDownloadLibraryRevision();
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();

  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [naming, setNaming] = useState(false);
  const [fromTags, setFromTags] = useState(false);
  /** Which of the two a tag list will be. Following the tag is the one people
      mean more often, and it is also the one that cannot be got back to by
      hand once a copy has been taken. */
  const [live, setLive] = useState(true);
  /** The first few tracks of each list, for the covers. */
  const [covers, setCovers] = useState<Map<number, Track[]>>(new Map());

  const load = useCallback(() => {
    setLists(playlists());
    setTags(tagCounts().slice(0, TAG_CHOICES));
  }, []);

  /*
    The covers are loaded after the rows rather than with them. Reading the
    library is a trip to the media store, and the names and counts — which are
    what the screen is actually for — are already in hand without it.
  */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const library = await scanLibrary();
      if (cancelled) return;
      const byId = new Map(library.map((entry) => [entry.id, entry]));
      const resolved = new Map<number, Track[]>();
      for (const [id, trackIds] of coverTrackIds(COVER_TRACKS)) {
        resolved.set(
          id,
          trackIds.map((trackId) => byId.get(trackId)).filter((entry): entry is Track => entry != null)
        );
      }
      /*
        A list that follows a tag keeps no membership to read the first four
        out of, so they are asked of the tag instead. Without this every tag
        list wears the empty square, which reads as a list with nothing in it
        next to a count saying otherwise.
      */
      for (const list of lists ?? []) {
        if (!list.tag) continue;
        resolved.set(
          list.id,
          trackIdsWithTag(list.tag)
            .map((trackId) => byId.get(trackId))
            .filter((entry): entry is Track => entry != null)
            .slice(0, COVER_TRACKS)
        );
      }
      setCovers(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [lists]);

  // Reloaded on focus, so a list edited or emptied on the detail screen is
  // described correctly on the way back.
  useFocusEffect(useCallback(() => load(), [load, downloadRevision]));

  const create = useCallback(
    (name: string) => {
      const id = createPlaylist(name, Date.now());
      setNaming(false);
      load();
      router.push({ pathname: '/playlist', params: { id: String(id) } });
    },
    [load, router]
  );

  /**
   * A list made out of a tag, one of the two ways that can mean.
   *
   * `live` keeps the question: the list is read from the tag every time it is
   * opened, so tagging something next week puts it in, and nothing in it can
   * be reordered or taken out — those would each be answers the tag did not
   * give. Otherwise it is a copy, taken once: whatever carries the tag at this
   * moment comes across and from then on the two go their own ways, which is
   * what makes it arrangeable.
   *
   * Both are worth having and neither is the obvious default, which is why the
   * sheet asks rather than picks.
   */
  const createFromTag = useCallback(
    (tag: string, live: boolean) => {
      const now = Date.now();
      const id = live ? createPlaylist(tag, now, tag) : createPlaylist(tag, now);
      if (!live) addToPlaylist(id, trackIdsWithTag(tag), now);
      setFromTags(false);
      load();
      router.push({ pathname: '/playlist', params: { id: String(id) } });
    },
    [load, router]
  );

  if (!lists) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <View style={landscape ? styles.sideways : styles.upright}>
      <ScrollView
        style={styles.middle}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            /*
              Neither inset sideways. What touches the edges of the screen
              there is the rail on one side and the player's panel on the
              other, and both keep clear of whatever is at them; asking again
              here adds a second inset's worth of nothing to one side only,
              which is what left this sitting off-centre in a space it was
              supposed to be filling evenly.
            */
            paddingLeft: (landscape ? 0 : insets.left) + 20,
            paddingRight: (landscape ? 0 : insets.right) + 20,
            paddingBottom: insets.bottom + 32,
          },
        ]}>
        <View style={styles.newRow}>
          <Pressable style={styles.new} onPress={() => setNaming(true)}>
            <Text style={styles.newLabel}>New list</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setFromTags(true)}>
            <Text style={styles.secondaryLabel}>From a tag</Text>
          </Pressable>
        </View>

        {lists.length === 0 ? (
          <Text style={styles.empty}>
            Nothing yet. A list is an order you chose — which is the one thing
            tags cannot hold.
          </Text>
        ) : (
          <View style={landscape ? styles.grid : undefined}>
            {lists.map((list) => (
              <Pressable
                key={list.id}
                style={[styles.row, styles.withCover, landscape && styles.cell]}
                onPress={() =>
                  router.push({ pathname: '/playlist', params: { id: String(list.id) } })
                }>
                <PlaylistCover
                  tracks={covers.get(list.id) ?? []}
                  chosen={
                    (covers.get(list.id) ?? []).find(
                      (entry) => entry.id === list.coverTrackId
                    ) ?? null
                  }
                  picture={list.coverUri}
                  size={COVER_SIZE}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {list.name}
                  </Text>
                  <Text style={styles.rowDetail}>
                    {list.trackCount} {list.trackCount === 1 ? 'track' : 'tracks'}
                    {/* Worth saying on the row: the two look alike here and
                        behave differently once opened. */}
                    {list.tag ? ` · follows ${list.tag}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.section}>From your listening</Text>
        <View style={landscape ? styles.grid : undefined}>
          {AUTO_LISTS.map((list) => (
            <Pressable
              key={list.id}
              style={[styles.row, landscape && styles.cell]}
              onPress={() =>
                router.push({ pathname: '/playlist', params: { auto: list.id } })
              }>
              <Text style={styles.rowName} numberOfLines={1}>
                {list.name}
              </Text>
              <Text style={styles.rowDetail}>{list.hint}</Text>
            </Pressable>
          ))}
          {/*
            Beside the lists made from listening, because it is made the same
            way and from the same thing — the difference is only that it points
            outside the library rather than into it. Its own screen rather than
            a list, since nothing in it can be played.
          */}
          <Pressable
            style={[styles.row, landscape && styles.cell]}
            onPress={() => router.push('/discover')}>
            <Text style={styles.rowName} numberOfLines={1}>
              Discover
            </Text>
            <Text style={styles.rowDetail}>Music you do not have, from what you play</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Starting a track and being left looking at the list reads as the tap
          having gone nowhere. */}
      <NowPlayingBar column={landscape} />
      </View>

      <TextPrompt
        visible={naming}
        heading="Name the list"
        placeholder="List name"
        confirmLabel="Create"
        onSubmit={create}
        onClose={() => setNaming(false)}
      />

      {fromTags ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={() => setFromTags(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.sheetHeading}>Make a list from a tag</Text>
            <View style={styles.kinds}>
              {([true, false] as const).map((wantsLive) => (
                <Pressable
                  key={String(wantsLive)}
                  style={[styles.kind, wantsLive === live && styles.kindOn]}
                  onPress={() => setLive(wantsLive)}>
                  <Text style={[styles.kindLabel, wantsLive === live && styles.kindLabelOn]}>
                    {wantsLive ? 'Follows the tag' : 'A copy'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetHint}>
              {live
                ? 'Always whatever carries the tag. Tag something later and it appears here; nothing in it can be reordered or removed.'
                : 'Takes whatever carries the tag right now. The two go their own ways afterwards, so the list is yours to arrange.'}
            </Text>
            <ScrollView style={styles.tagScroll}>
              {tags.length === 0 ? (
                <Text style={styles.empty}>No tags yet. Look some tracks up first.</Text>
              ) : (
                tags.map((entry) => (
                  <Pressable
                    key={entry.tag}
                    style={styles.tagRow}
                    onPress={() => createFromTag(entry.tag, live)}>
                    <Text style={styles.tagName} numberOfLines={1}>
                      {entry.tag}
                    </Text>
                    <Text style={styles.rowDetail}>{entry.trackCount}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  /* Takes what the rail and the player leave, rather than only what it needs. */
  middle: { flex: 1, minWidth: 0 },
  content: { gap: 4 },

  newRow: { flexDirection: 'row', gap: 10, paddingBottom: 22 },
  new: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ededed',
    borderRadius: 11,
    paddingVertical: 13,
  },
  newLabel: { color: '#121212', fontSize: 15, fontWeight: '600' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 11,
    paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  secondaryLabel: { color: '#ededed', fontSize: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: '31%', minWidth: 200 },

  row: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    marginBottom: 8,
  },
  withCover: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { color: '#ededed', fontSize: 15.5 },
  rowDetail: { color: '#6a6a6a', fontSize: 12.5 },

  section: {
    color: '#5f5f5f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 26,
    paddingBottom: 12,
  },
  empty: { color: '#6a6a6a', fontSize: 13, lineHeight: 20, paddingVertical: 10 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000cc' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 6,
  },
  sheetHeading: { color: '#ededed', fontSize: 15, fontWeight: '600' },
  sheetHint: { color: '#5f5f5f', fontSize: 12, lineHeight: 18, paddingBottom: 8 },
  kinds: { flexDirection: 'row', backgroundColor: '#141414', borderRadius: 9, padding: 2, marginTop: 10 },
  kind: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 7 },
  kindOn: { backgroundColor: '#2e2e2e' },
  kindLabel: { color: '#7a7a7a', fontSize: 13 },
  kindLabelOn: { color: '#ededed', fontWeight: '600' },
  tagScroll: { flexGrow: 0 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#242424',
  },
  tagName: { color: '#ededed', fontSize: 14.5, flex: 1, minWidth: 0 },
});
