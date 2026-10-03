import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useDiscover, useDiscoverPlayback } from '../lib/discover/DiscoverProvider';
import { discoverError, keepDiscover, maintainDiscover, rejectDiscover, retryDiscoverFill, undoDiscover } from '../lib/discover/engine';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { useDownloads } from '../lib/youtube/DownloadsProvider';
import { statusLabel } from '../lib/youtube/types';
import type { Entry } from '../lib/discover/store';

export function DiscoverPanel() {
  const { snapshot, settings, busy, message, waiting, error, jobs } = useDiscover();
  const { play, stopPreparing } = useDiscoverPlayback();
  const { queue } = usePlayerState();
  const { removeFromQueue } = usePlayerActions();
  const { refresh } = useDownloads();
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<{ id: string; until: number } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now())); return () => clearTimeout(timer); }, [undo]);
  const act = async (entry: Entry, action: 'play' | 'save' | 'reject') => {
    setWorking(entry.recordingMbid); setNotice('');
    try {
      if (action === 'play') await play(entry.recordingMbid);
      else if (action === 'save') { await keepDiscover(entry.recordingMbid); await refresh(true); setNotice(`${entry.title} saved to Library.`); }
      else {
        // A rejected song leaves the playing queue too. Saved songs may finish playing.
        stopPreparing();
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].id === entry.track?.id) await removeFromQueue(i);
        setUndo({ id: entry.recordingMbid, until: Date.now() + 10_000 });
        await rejectDiscover(entry.recordingMbid);
      }
    } catch (e) { if (mounted.current) setNotice(discoverError(e)); }
    finally { if (mounted.current) setWorking(null); }
  };
  const rows: (Entry | null)[] = [...(snapshot?.entries ?? [])];
  while (rows.length < settings.count) rows.push(null);
  return <FlatList data={rows} keyExtractor={(item, index) => item?.recordingMbid ?? `pending-${index}`}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.headingRow}><View style={styles.flex}>
        <Text style={styles.heading}>Made for your next listen</Text>
        <Text style={styles.muted}>{settings.count} discoveries · half familiar, half new artists</Text>
      </View><Pressable accessibilityRole="button" disabled={busy || !!working} onPress={() => void maintainDiscover(true)} style={styles.button}><Text style={styles.text}>Refresh</Text></Pressable></View>
      <Text style={styles.muted}>Based on your last 30 days. + keeps a song in Library. − removes it from future discoveries. Both make room for another song.</Text>
      {snapshot?.refreshedAt ? <Text style={styles.muted}>Updated {new Date(snapshot.refreshedAt).toLocaleDateString()}</Text> : null}
      {busy ? <View style={styles.headingRow}><ActivityIndicator color="#ddd" /><Text style={styles.muted}>{message || 'Preparing Discover…'}</Text></View> : null}
      {snapshot?.pending ? <Text style={styles.muted}>Preparing the next list · {snapshot.pending.filter(e => e.track).length}/{settings.count} ready. Your current songs stay available until the new list is ready. Use Refresh to retry if preparation stalls.</Text> : null}
      {waiting ? <Text style={styles.muted}>{waiting}</Text> : null}
      {error || notice ? <Text accessibilityRole="alert" style={styles.error}>{notice || error}</Text> : null}
      {undo ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { void undoDiscover(undo.id, true); setUndo(null); setNotice('Song restored to Discover.'); }}><Text style={styles.text}>Song excluded · Undo</Text></Pressable> : null}
    </View>}
    renderItem={({ item, index }) => {
      if (!item) return <View style={styles.row}><View style={styles.cover} /><View style={styles.flex}><Text style={styles.text}>{busy ? 'Finding your next song…' : 'A discovery is waiting to be found'}</Text><Text style={styles.muted}>Place {index + 1} of {settings.count}</Text></View><Pressable accessibilityRole="button" disabled={busy} onPress={() => void retryDiscoverFill()} style={styles.button}><Text style={styles.text}>Retry</Text></Pressable></View>;
      const job = jobs.find(j => j.id === item.jobId);
      const downloading = working === item.recordingMbid;
      return <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.title}`} disabled={!!working || busy} onPress={() => void act(item, 'play')} style={styles.song}>
          {item.coverUrl || item.track?.artworkUri ? <Image source={{ uri: item.track?.artworkUri || item.coverUrl! }} style={styles.cover} /> : <View style={styles.cover} />}
          <View style={styles.flex}><Text numberOfLines={2} style={styles.text}>{item.title}</Text><Text numberOfLines={1} style={styles.muted}>{item.artist}</Text>
            <Text numberOfLines={2} style={styles.reason}>{item.familiar ? 'More from your artists' : 'A new artist'} · {item.because}</Text>
            <Text style={item.error ? styles.error : styles.muted}>{item.error || (downloading ? 'Preparing…' : item.track ? 'Ready to play' : job ? statusLabel(job) : settings.autoDownload ? 'Waiting to download' : 'Tap to download and play')}</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Keep ${item.title} in Library`} disabled={!!working || busy} style={styles.icon} onPress={() => void act(item, 'save')}><Text style={styles.symbol}>+</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Never recommend ${item.title} again`} disabled={!!working || busy} style={styles.icon} onPress={() => void act(item, 'reject')}><Text style={styles.symbol}>−</Text></Pressable>
      </View>;
    }} />;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 }, header: { gap: 12, paddingVertical: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heading: { color: '#eee', fontSize: 18, fontWeight: '600', marginBottom: 5 },
  flex: { flex: 1, minWidth: 0, gap: 3 }, text: { color: '#eee', fontSize: 14 }, muted: { color: '#929292', fontSize: 12, lineHeight: 18 },
  reason: { color: '#8ba6ba', fontSize: 11, lineHeight: 16 }, error: { color: '#ffaaaa', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292929', gap: 4 },
  song: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }, cover: { width: 52, height: 52, backgroundColor: '#252525', borderRadius: 8 },
  button: { padding: 12, minHeight: 44, justifyContent: 'center' }, icon: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' }, symbol: { color: '#ddd', fontSize: 25 },
});
