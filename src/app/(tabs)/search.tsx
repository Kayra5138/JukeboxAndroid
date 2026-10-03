import { useCallback, useEffect, useRef, useState } from 'react';
import { DiscoverPanel } from '../../components/DiscoverPanel';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useListColumns } from '../../lib/ui/layout';
import { youtubeError } from '../../lib/youtube/errors';
import { downloads } from '../../lib/youtube/native';
import { useDownloads } from '../../lib/youtube/DownloadsProvider';
import { durationLabel, isActive, jobForVideo, statusLabel, type AudioFormat, type DownloadJob, type YouTubeVideo, type YouTubeResult } from '../../lib/youtube/types';

const cache = new Map<string, { at: number; videos: YouTubeResult[] }>();

export default function YouTubeScreen() {
  const { jobs, error, refresh, enqueue, enqueueBatch, cancel } = useDownloads();
  const insets = useSafeAreaInsets();
  const columns = useListColumns();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'discover' | 'videos' | 'playlist'>('discover');
  useEffect(() => { if (params.mode === 'discover') setMode('discover'); }, [params.mode]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [showQueue, setShowQueue] = useState(false);
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
    try {
      const videos = await (mode === 'playlist'
        ? downloads.playlistAsync(text, id)
        : downloads.searchAsync(text, id));
      if (searchId.current !== id) return;
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { at: Date.now(), videos });
      setResults(videos);
      setSearched(true);
    } catch (failure) {
      if (searchId.current === id) setMessage(youtubeError(failure, 'Search failed. Please retry.'));
    } finally {
      if (searchId.current === id) { searchId.current = null; setSearching(false); }
    }
  };

  const add = async (video: YouTubeVideo, choice: AudioFormat = format) => {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(video.id);
    setMessage(null);
    try {
      await enqueue(video, choice);
    }
    catch (failure) { setMessage(youtubeError(failure, 'Could not queue download.')); }
    finally { addingRef.current = false; setAdding(null); }
  };

  const addPlaylist = async () => {
    if (addingRef.current) return;
    const selected = results.slice(0, 500).filter((item): item is YouTubeVideo => item.kind !== 'playlist');
    if (!selected.length) return;
    addingRef.current = true;
    setAdding('playlist');
    setMessage(null);
    try {
      await enqueueBatch(selected, format);
      setMessage(`List created: ${selected[0].sourcePlaylist?.name ?? 'YouTube playlist'}. Downloaded tracks will appear in Lists.`);
    } catch (failure) { setMessage(youtubeError(failure, 'Could not queue playlist.')); }
    finally { addingRef.current = false; setAdding(null); }
  };

  const cancelJob = async (id: string) => {
    try { await cancel(id); }
    catch (failure) { setMessage(youtubeError(failure, 'Could not cancel download.')); }
  };

  const active = jobs.filter(isActive).reverse();
  const recent = jobs.filter((job) => !isActive(job)).slice(0, 5);

  const renderJob = (job: DownloadJob, index: number) => (
    <View key={job.id} style={[styles.job, index === 0 && styles.firstJob]}>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.title}>{job.video.title}</Text>
        <Text style={job.status === 'failed' ? styles.bad : styles.muted}>
          {statusLabel(job)} · {job.format === 'mp3' ? 'MP3' : 'Original'}
        </Text>
        {job.error ? <Text style={styles.bad}>{job.error}</Text> : null}
        {isActive(job) ? <View style={styles.progressTrack}>
          <View style={[styles.progress, { width: `${job.progress}%` }]} />
        </View> : null}
      </View>
      {isActive(job) ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${job.video.title}`}
          disabled={job.status === 'saving' || job.status === 'cancelling'}
          onPress={() => void cancelJob(job.id)} style={styles.smallButton}>
          <Text style={styles.muted}>{job.status === 'saving' || job.status === 'cancelling' ? '…' : 'Cancel'}</Text>
        </Pressable>
      ) : job.status !== 'done' ? (
        <Pressable accessibilityRole="button" disabled={adding !== null} style={styles.smallButton}
          onPress={() => void add(job.video, job.format)}><Text style={styles.link}>Retry</Text></Pressable>
      ) : null}
    </View>
  );

  if (!downloads) return (
    <View style={styles.unavailable}>
      <Text style={styles.heading}>YouTube needs a new app build</Text>
      <Text style={styles.muted}>Install the updated Android version to search and download music. Your library is still available.</Text>
    </View>
  );

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
      ]}>
      <View style={styles.modeRow}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'discover' }}
          style={[styles.discoverTab, mode === 'discover' && styles.segmentOn]}
          onPress={() => { stopSearch(); setMode('discover'); }}>
          <Text style={mode === 'discover' ? styles.segmentLabelOn : styles.segmentLabel}>Discover</Text>
        </Pressable>
        <View style={styles.downloadModes}>
          <Text style={styles.downloadHeading}>Download</Text>
          <View style={styles.segmented}>
            {(['videos', 'playlist'] as const).map(choice => <Pressable key={choice}
              accessibilityRole="tab" accessibilityState={{ selected: mode === choice }} disabled={adding !== null}
              style={[styles.segment, mode === choice && styles.segmentOn]}
              onPress={() => { stopSearch(); setMode(choice); setResults([]); setSearched(false); setMessage(null); }}>
              <Text style={mode === choice ? styles.segmentLabelOn : styles.segmentLabel}>{choice === 'videos' ? 'Videos' : 'Playlists'}</Text>
            </Pressable>)}
          </View>
        </View>
      </View>
      {mode === 'discover' ? <DiscoverPanel /> : <FlatList
        data={results.slice(0, 500)}
        // Remounted when the count changes: a list will not take a new
        // numColumns in place, and turning the phone is when it changes.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.resultColumns : undefined}
        keyExtractor={(video) => video.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <Text style={styles.intro}>{mode === 'playlist' ? 'Search for a playlist or paste its YouTube link. Open a result to preview and download its tracks. The first 500 playlist entries are checked.' : 'Search YouTube or paste a video link. Save the audio to your library.'}</Text>
          <View style={styles.searchRow}>
            <TextInput accessibilityLabel={mode === 'playlist' ? 'Playlist name or YouTube link' : 'Search YouTube or paste a video link'}
              style={styles.input} value={query} onChangeText={setQuery}
              placeholder={mode === 'playlist' ? 'Playlist name or YouTube link' : 'Song, artist or YouTube link'} placeholderTextColor="#777"
              autoCapitalize="none" autoCorrect={false} maxLength={500}
              returnKeyType="search" onSubmitEditing={() => void search()} />
            <Pressable accessibilityRole="button" style={[styles.searchButton, !query.trim() && styles.searchButtonOff]}
              disabled={!query.trim()} onPress={() => void search()}>
              <Text style={!query.trim() ? styles.darkTextOff : styles.darkText}>Search</Text>
            </Pressable>
          </View>
          <View style={[styles.segmented, styles.formats]}>
            {(['mp3', 'original'] as const).map((choice) => (
              <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: format === choice }}
                onPress={() => setFormat(choice)} style={[styles.segment, choice === format && styles.segmentOn]}>
                <Text style={choice === format ? styles.segmentLabelOn : styles.segmentLabel}>{choice === 'mp3' ? 'MP3' : 'Original audio'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{format === 'mp3' ? 'Converted to MP3 after downloading.' : 'Keeps the source audio codec where possible.'}</Text>
          {message || error ? <Text accessibilityRole="alert" style={styles.bad}>{message ?? youtubeError(error, 'Could not read downloads. Please reopen Search.')}</Text> : null}
          {searching ? <View style={styles.searching}>
            <ActivityIndicator color="#eee" /><Text style={styles.muted}>Searching YouTube…</Text>
            <Pressable accessibilityRole="button" onPress={stopSearch} style={styles.smallButton}><Text style={styles.link}>Cancel</Text></Pressable>
          </View> : null}
          {results.length ? <Text style={styles.section}>Results · {Math.min(results.length, 500)}</Text> : null}
          {mode === 'playlist' && results.length > 0 && results[0].kind !== 'playlist' ? <>
            <Pressable accessibilityRole="button" disabled={adding !== null}
              style={[styles.batch, adding !== null && styles.disabled]} onPress={() => void addPlaylist()}>
              <Text style={styles.batchLabel}>{adding === 'playlist' ? 'Adding playlist…' : `Download listed tracks · ${format === 'mp3' ? 'MP3' : 'Original audio'}`}</Text>
            </Pressable>
            <Text style={styles.hint}>Already downloaded or queued tracks are skipped. Private, deleted and live videos may be unavailable.</Text>
          </> : null}
        </>}
        ListFooterComponent={<>
          {active.length || recent.length ? <View style={styles.queue}>
            <Text style={styles.section}>Downloads{active.length ? ` · ${active.length} active` : ''}</Text>
            {/* One list, so the rule between rows knows which one is first. */}
            <View style={styles.card}>
              {[...(showQueue ? active : active.slice(0, 5)), ...recent].map(renderJob)}
            </View>
            {active.length > 5 ? <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => setShowQueue((value) => !value)}>
              <Text style={styles.link}>{showQueue ? 'Show fewer downloads' : `Show all ${active.length} downloads`}</Text>
            </Pressable> : null}
          </View> : null}
        </>}
        ListEmptyComponent={!searching ? <View style={styles.empty}>
          <Text style={styles.emptyText}>{searched ? 'No results found. Try a different search or link.' : mode === 'playlist' ? 'Search by playlist name or paste a playlist link.' : 'Search by song and artist to find the recording you want.'}</Text>
        </View> : null}
        renderItem={({ item }) => {
          const playlist = item.kind === 'playlist';
          const job = playlist ? undefined : jobForVideo(jobs, item.id);
          const locked = job && (isActive(job) || job.status === 'done');
          return <View style={[styles.result, columns > 1 && styles.resultShared]}>
            {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" /> : <View style={styles.thumbnail} />}
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.muted} numberOfLines={1}>{[item.channel, playlist ? 'Playlist' : durationLabel(item.duration)].filter(Boolean).join(' · ')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${playlist ? 'Open playlist' : 'Download'} ${item.title}`}
                disabled={!!locked || adding !== null} style={[styles.downloadButton, locked && styles.disabled]}
                onPress={() => item.kind === 'playlist' ? void search(item.url) : void add(item)}>
                <Text style={styles.link}>{playlist ? 'Open playlist' : adding === item.id ? 'Adding…' : locked ? statusLabel(job) : `Download ${format === 'mp3' ? 'MP3' : 'audio'}`}</Text>
              </Pressable>
            </View>
          </View>;
        }}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  discoverTab: { paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', borderRadius: 12 },
  downloadModes: { flex: 1, maxWidth: 270, marginLeft: 'auto', gap: 5 },
  downloadHeading: { color: '#777', fontSize: 10, textAlign: 'center', letterSpacing: 1 },
  screen: { flex: 1, backgroundColor: '#121212' },
  resultColumns: { gap: 8 },
  // Without this a row keeps its full width and the pair overflows the screen.
  resultShared: { flex: 1, minWidth: 0 },
  content: { padding: 20, paddingBottom: 32 },
  flex: { flex: 1, gap: 5 },
  heading: { color: '#f2f2f2', fontSize: 25, fontWeight: '600', marginBottom: 8 },
  intro: { color: '#7a7a7a', fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 16 },
  title: { color: '#eee', fontSize: 14, fontWeight: '500' },
  muted: { color: '#999', fontSize: 12, lineHeight: 18 },
  hint: { color: '#6a6a6a', fontSize: 11.5, lineHeight: 17, marginTop: 10, marginBottom: 4 },
  bad: { color: '#ff9b9b', fontSize: 12, lineHeight: 18, marginVertical: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, backgroundColor: '#1a1a1a', borderRadius: 12, color: '#ededed', paddingHorizontal: 14, paddingVertical: 13, fontSize: 14.5, minHeight: 48 },
  searchButton: { backgroundColor: '#ededed', paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', minHeight: 48 },
  // Dimmed rather than faded: a translucent white slab is still the brightest
  // thing on the screen, which is the wrong thing for a button that cannot
  // be pressed yet.
  searchButtonOff: { backgroundColor: '#242424' },
  darkTextOff: { color: '#6a6a6a', fontWeight: '600' },
  darkText: { color: '#121212', fontWeight: '600' },
  disabled: { opacity: 0.45 },
  /*
    One track with the choices inside it, rather than a row of separate pills.
    Two pills side by side read as two buttons that happen to be near each
    other; a single track reads as one setting with two positions, which is
    what both of these are.
  */
  segmented: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4, gap: 4 },
  formats: { marginTop: 14 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingVertical: 10, minHeight: 40 },
  segmentOn: { backgroundColor: '#2c2c2c' },
  segmentLabel: { color: '#8a8a8a', fontSize: 13.5, fontWeight: '500' },
  segmentLabelOn: { color: '#ededed', fontSize: 13.5, fontWeight: '600' },
  batch: { backgroundColor: '#1f1f1f', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 4 },
  batchLabel: { color: '#ededed', fontSize: 13.5, fontWeight: '600' },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  smallButton: { padding: 12, minHeight: 44, justifyContent: 'center' },
  link: { color: '#e0e0e0', fontSize: 13, fontWeight: '500' },
  queue: { marginBottom: 24, marginTop: 10 },
  section: { color: '#6a6a6a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden' },
  firstJob: { borderTopWidth: 0 },
  job: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2a2a' },
  progressTrack: { height: 3, backgroundColor: '#333', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  progress: { height: 3, backgroundColor: '#ddd' },
  result: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#262626' },
  thumbnail: { width: 112, height: 76, borderRadius: 8, backgroundColor: '#252525' },
  downloadButton: { alignSelf: 'flex-start', paddingVertical: 12, minHeight: 44 },
  empty: { paddingTop: 22, paddingBottom: 4, alignItems: 'center' },
  emptyText: { color: '#6a6a6a', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  unavailable: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center', gap: 10 },
});
