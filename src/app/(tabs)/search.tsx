import { BlurArea, Frost, GlassScene, useFrosted, useOwnScene } from '../../components/Frosted';
import { usePageSides, WithNowPlaying } from '../../components/NowPlayingBar';
import { BarsOver, topGlass, useLaidOver, useUnderBars } from '../../components/UnderBars';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DiscoverPanel } from '../../components/DiscoverPanel';
import { QueueLink } from '../../components/downloads/QueueLink';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from '../../components/Picture';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../../components/Pressable';
import { Segmented } from '../../components/Segmented';
import { useT } from '../../lib/i18n/index';
import { hintKey, makeStyles, outlined, scene, useColours, usePressed } from '../../lib/theme/index';
import { useListColumns } from '../../lib/ui/layout';
import { youtubeError } from '../../lib/youtube/errors';
import { noteError } from '../../lib/support/errorLogStore';
import { downloads } from '../../lib/youtube/native';
import { useDownloads } from '../../lib/youtube/DownloadsProvider';
import { durationLabel, isActive, jobForVideo, statusLabel, type AudioFormat, type YouTubeVideo, type YouTubeResult } from '../../lib/youtube/types';
import { ownedVideos } from '../../lib/youtube/owned';
import { useLibraryTracks } from '../../lib/library/useLibrary';
import { CLIP_SUBVIEWS } from '../../lib/ui/lists';

const cache = new Map<string, { at: number; videos: YouTubeResult[] }>();

/** A playlist's entries or a search's results, whichever the tab is on. Only asked for where there is a build to ask. */
const lookUp = (playlist: boolean, text: string, id: string) =>
  playlist ? downloads!.playlistAsync(text, id) : downloads!.searchAsync(text, id);

export default function YouTubeScreen() {
  const { jobs, error, refresh, enqueue, enqueueBatch } = useDownloads();
  const libraryTracks = useLibraryTracks();
  const insets = useSafeAreaInsets();
  const sides = usePageSides();
  /*
    In a theme of glass the switches along the top are laid over what is
    below them, which runs on under them, and the bars at the foot over the
    foot of it: both lists keep clear of the two by that much.
  */
  const top = useLaidOver();
  // The results out of focus behind the row of modes, where it is laid over them: see `Frosted`.
  const scene = useOwnScene();
  const frosted = useFrosted(top.laid ? scene.target : null);
  const under = useUnderBars({ player: true });
  const columns = useListColumns();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.search;
  const params = useLocalSearchParams<{ mode?: string; q?: string }>();
  const [mode, setMode] = useState<'discover' | 'videos' | 'playlist'>('discover');
  useEffect(() => { if (params.mode === 'discover') setMode('discover'); }, [params.mode]);
  const [query, setQuery] = useState('');
  // A song another screen could not find a recording of, handed over to be
  // looked for by hand. Written into the box and left there: which of the
  // results is the right one is the part that needed a person.
  useEffect(() => { if (params.q) { setMode('videos'); setQuery(params.q); } }, [params.q]);
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const searchId = useRef<string | null>(null);
  const addingRef = useRef(false);
  useFocusEffect(useCallback(() => { void refresh(true); }, [refresh]));
  useEffect(() => () => {
    const id = searchId.current;
    searchId.current = null;
    if (id) void downloads?.cancelSearchAsync(id).catch(() => {});
  }, []);

  const stopSearch = () => {
    const id = searchId.current;
    searchId.current = null;
    setSearching(false);
    if (id) void downloads?.cancelSearchAsync(id).catch(() => {});
  };

  const search = async (override?: string) => {
    const text = (override ?? query).trim();
    if (override) setQuery(override);
    if (!text || !downloads) return;
    stopSearch();
    Keyboard.dismiss();
    setMessage(null);
    setSearched(false);
    setResults([]);
    const cacheKey = `${mode}:${text}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < 5 * 60_000) {
      setResults(cached.videos); setSearched(true); return;
    }
    const id = `search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    searchId.current = id;
    setSearching(true);
    // Chosen out here: the React Compiler cannot yet read a choice made
    // inside a `try`, and leaves the whole screen alone for one.
    const playlist = mode === 'playlist';
    try {
      const videos = await lookUp(playlist, text, id);
      // Superseded or stopped, and whoever did that has already tidied up.
      if (searchId.current !== id) return;
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { at: Date.now(), videos });
      setResults(videos);
      setSearched(true);
    } catch (failure) {
      if (searchId.current === id) {
        setMessage(youtubeError(failure, said.failed.search, t));
        noteError('search', failure);
      }
    }
    // After the catch and not in a `finally`, which the React Compiler will
    // not compile a component for having. Nothing above is thrown onwards, so
    // it says the same thing; the one way out early does its own tidying.
    if (searchId.current === id) { searchId.current = null; setSearching(false); }
  };

  const add = async (video: YouTubeVideo, choice: AudioFormat = format) => {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(video.id);
    setMessage(null);
    try {
      await enqueue(video, choice);
    }
    catch (failure) { setMessage(youtubeError(failure, said.failed.queue, t)); }
    addingRef.current = false;
    setAdding(null);
  };

  const addPlaylist = async () => {
    if (addingRef.current) return;
    const selected = results.slice(0, 500).filter((item): item is YouTubeVideo => item.kind !== 'playlist');
    if (!selected.length) return;
    addingRef.current = true;
    setAdding('playlist');
    setMessage(null);
    const name = selected[0].sourcePlaylist?.name ?? said.unnamedPlaylist;
    // What the library has already, from a computer or an older version, is put in the list and not fetched again.
    const here = ownedVideos(selected, libraryTracks);
    const done = here.size > 0 ? `${said.listCreated(name)} ${said.alreadyHave(here.size)}` : said.listCreated(name);
    try {
      await enqueueBatch(selected, format, here);
      setMessage(done);
    } catch (failure) { setMessage(youtubeError(failure, said.failed.queuePlaylist, t)); }
    addingRef.current = false;
    setAdding(null);
  };

  /** Which of the results the library has already, by a file no job of the queue's knows of. */
  const owned = ownedVideos(
    results.filter((item): item is YouTubeVideo => item.kind !== 'playlist'),
    libraryTracks
  );

  if (!downloads) return (
    <View style={styles.unavailable}>
      <Text style={styles.heading}>{said.unavailable.heading}</Text>
      <Text style={styles.muted}>{said.unavailable.body}</Text>
    </View>
  );

  return (
    <WithNowPlaying style={styles.screen}>
    <View style={[styles.inside, { paddingTop: insets.top, paddingLeft: sides.left, paddingRight: sides.right }]}>
      <GlassScene scene={scene}>
      <View
        style={[styles.modeRow, top.laid && [styles.modeRowOver, { top: insets.top, left: sides.left, right: sides.right }], frosted && styles.clear]}
        onLayout={top.onLayout}>
        {frosted && scene.target ? <Frost target={scene.target} edge="bottom" /> : null}
        {/*
          A tab apart from the two beside it, standing for a screen of its own
          rather than a way of searching: filled while it is open, and no wash
          under the finger, like the two it stands with.
        */}
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'discover' }}
          style={[styles.discoverTab, mode === 'discover' && styles.discoverOn]}
          onPress={() => { stopSearch(); setMode('discover'); }}>
          <Text style={mode === 'discover' ? styles.discoverLabelOn : styles.discoverLabel}>{said.modes.discover}</Text>
        </Pressable>
        <View style={styles.downloadModes}>
          <Text style={styles.downloadHeading}>{said.modes.download}</Text>
          {/*
            One tray with the choices inside it, rather than a row of separate
            pills: two pills side by side read as two buttons that happen to be
            near each other, and one tray as one setting with two positions.
            Without a mark while Discover is open, since neither is.
          */}
          <Segmented
            role="tab"
            options={[
              { value: 'videos', label: said.modes.videos },
              { value: 'playlist', label: said.modes.playlists },
            ]}
            value={mode === 'discover' ? null : mode}
            disabled={adding !== null}
            onChange={(choice) => { stopSearch(); setMode(choice); setResults([]); setSearched(false); setMessage(null); }}
          />
        </View>
      </View>
      {/* What scrolls under the row of modes, which blurs it: see `Frosted`. */}
      <BlurArea style={styles.fill}>
      <BarsOver top={top.height}>
      {mode === 'discover' ? <DiscoverPanel /> : <FlatList
              removeClippedSubviews={CLIP_SUBVIEWS}
        data={results.slice(0, 500)}
        // Remounted when the count changes: a list will not take a new
        // numColumns in place, and turning the phone is when it changes.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.resultColumns : undefined}
        keyExtractor={(video) => video.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: 20 + top.height, paddingBottom: 32 + under.bottom }]}
        ListHeaderComponent={<>
          <Text style={styles.intro}>{mode === 'playlist' ? said.intro.playlist : said.intro.videos}</Text>
          <View style={styles.searchRow}>
            <TextInput key={hintKey(c, mode === 'playlist' ? said.placeholder.playlist : said.placeholder.videos)}
              accessibilityLabel={mode === 'playlist' ? said.inputLabel.playlist : said.inputLabel.videos}
              style={styles.input} value={query} onChangeText={setQuery}
              placeholder={mode === 'playlist' ? said.placeholder.playlist : said.placeholder.videos} placeholderTextColor={c.textFaint}
              autoCapitalize="none" autoCorrect={false} maxLength={500}
              returnKeyType="search" onSubmitEditing={() => void search()} />
            <Pressable android_ripple={pressed} accessibilityRole="button" style={[styles.searchButton, !query.trim() && styles.searchButtonOff]}
              disabled={!query.trim()} onPress={() => void search()}>
              <Text style={!query.trim() ? styles.darkTextOff : styles.darkText}>{t.common.search}</Text>
            </Pressable>
          </View>
          <Segmented
            style={styles.formats}
            options={(['mp3', 'original'] as const).map((choice) => ({ value: choice, label: said.formats[choice] }))}
            value={format}
            onChange={setFormat}
          />
          <Text style={styles.hint}>{said.formatHint[format]}</Text>
          {message || error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.bad}>{message ?? youtubeError(error, said.failed.readReopen, t)}</Text> : null}
          {searching ? <View style={styles.searching}>
            <ActivityIndicator color={c.text} /><Text style={styles.muted}>{said.searching}</Text>
            <Pressable android_ripple={pressed} accessibilityRole="button" onPress={stopSearch} style={styles.smallButton}><Text style={styles.link}>{t.common.cancel}</Text></Pressable>
          </View> : null}
          {results.length ? <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.results(Math.min(results.length, 500)))}</Text> : null}
          {mode === 'playlist' && results.length > 0 && results[0].kind !== 'playlist' ? <>
            <Pressable android_ripple={pressed} accessibilityRole="button" disabled={adding !== null}
              style={[styles.batch, adding !== null && styles.disabled]} onPress={() => void addPlaylist()}>
              <Text style={styles.batchLabel}>{adding === 'playlist' ? said.addingPlaylist : said.downloadListed[format]}</Text>
            </Pressable>
            <Text style={styles.hint}>{said.listedHint}</Text>
          </> : null}
        </>}
        // The queue has a screen of its own; this is the way to it.
        ListFooterComponent={<QueueLink />}
        ListEmptyComponent={!searching ? <View style={styles.empty}>
          <Text style={styles.emptyText}>{searched ? said.empty.none : mode === 'playlist' ? said.empty.playlist : said.empty.videos}</Text>
        </View> : null}
        renderItem={({ item }) => {
          const playlist = item.kind === 'playlist';
          const job = playlist ? undefined : jobForVideo(jobs, item.id);
          // In the library already, by a file that came some other way: see `owned.ts`.
          const have = !playlist && !job && owned.has(item.id);
          const locked = have || (job && (isActive(job) || job.status === 'done'));
          return <View style={[styles.result, columns > 1 && styles.resultShared]}>
            {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" /> : <View style={[styles.thumbnail, styles.thumbnailEmpty]} />}
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.muted} numberOfLines={1}>{[item.channel, playlist ? said.playlist : durationLabel(item.duration)].filter(Boolean).join(' · ')}</Text>
              <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={playlist ? said.openPlaylistLabel(item.title) : said.downloadLabel(item.title)}
                disabled={!!locked || adding !== null} style={[styles.downloadButton, locked && styles.disabled]}
                onPress={() => item.kind === 'playlist' ? void search(item.url) : void add(item)}>
                <Text style={styles.link}>{playlist ? said.openPlaylist : adding === item.id ? said.adding : have ? said.inLibrary : locked && job ? statusLabel(job, t) : said.download[format]}</Text>
              </Pressable>
            </View>
          </View>;
        }}
      />}
      </BarsOver>
      </BlurArea>
      </GlassScene>
    </View>
    </WithNowPlaying>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  modeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  // Laid over the list in a theme of glass, with a little more room above its edge.
  modeRowOver: { ...topGlass(c), paddingBottom: 10 },
  /** Its fill left to `Frost`, which draws it over the blur. */
  clear: { backgroundColor: 'transparent' },
  fill: { flex: 1 },
  downloadModes: { flex: 1, maxWidth: 270, marginLeft: 'auto', gap: 5 },
  downloadHeading: { color: c.textFaint, fontSize: 10, textAlign: 'center', letterSpacing: 1 },
  screen: { flex: 1, ...scene(c) },
  inside: { flex: 1 },
  resultColumns: { gap: 8 },
  // Without this a row keeps its full width and the pair overflows the screen.
  resultShared: { flex: 1, minWidth: 0 },
  content: { padding: 20, paddingBottom: 32 },
  flex: { flex: 1, gap: 5 },
  heading: { color: c.text, fontSize: 25, fontWeight: '600', marginBottom: 8 },
  intro: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 16 },
  title: { color: c.text, fontSize: 14, fontWeight: '500' },
  muted: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  hint: { color: c.textFaint, fontSize: 11.5, lineHeight: 17, marginTop: 10, marginBottom: 4 },
  bad: { color: c.danger, fontSize: 12, lineHeight: 18, marginVertical: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: 12, color: c.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14.5, minHeight: 48, ...outlined(c) },
  searchButton: { backgroundColor: c.primary, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', minHeight: 48, ...outlined(c, c.primary) },
  // Dimmed rather than faded: a translucent white slab is still the brightest
  // thing on the screen, which is the wrong thing for a button that cannot
  // be pressed yet.
  searchButtonOff: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  darkTextOff: { color: c.textDisabled, fontWeight: '600' },
  darkText: { color: c.onPrimary, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  formats: { marginTop: 14 },
  // As tall as the tray beside it, whose chosen fill this is when Discover is open.
  discoverTab: { paddingHorizontal: 16, minHeight: 50, justifyContent: 'center', borderRadius: 12, ...outlined(c) },
  discoverOn: { backgroundColor: c.selected },
  discoverLabel: { color: c.textMuted, fontSize: 13.5 },
  discoverLabelOn: { color: c.onSelected, fontSize: 13.5, fontWeight: '600' },
  batch: { backgroundColor: c.surface, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 4, ...outlined(c) },
  batchLabel: { color: c.text, fontSize: 13.5, fontWeight: '600' },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  smallButton: { padding: 12, minHeight: 44, justifyContent: 'center' },
  link: { color: c.text, fontSize: 13, fontWeight: '500' },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 16, marginBottom: 10, marginLeft: 4 },
  result: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  thumbnail: { width: 112, height: 76, borderRadius: 8 },
  thumbnailEmpty: { backgroundColor: c.surfaceRaised },
  downloadButton: { alignSelf: 'flex-start', paddingVertical: 12, minHeight: 44 },
  empty: { paddingTop: 22, paddingBottom: 4, alignItems: 'center' },
  emptyText: { color: c.textFaint, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  unavailable: { flex: 1, ...scene(c), padding: 24, justifyContent: 'center', gap: 10 },
}));
