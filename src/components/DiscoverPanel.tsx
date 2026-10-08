import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useDiscover, useDiscoverPlayback } from '../lib/discover/DiscoverProvider';
import { discoverError, discoverSaid, keepDiscover, maintainDiscover, rejectDiscover, retryDiscoverFill, undoDiscover } from '../lib/discover/engine';
import { useT } from '../lib/i18n/index';
import { makeStyles, useColours, usePressed } from '../lib/theme/index';
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
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.panel;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now())); return () => clearTimeout(timer); }, [undo]);
  const act = async (entry: Entry, action: 'play' | 'save' | 'reject') => {
    setWorking(entry.recordingMbid); setNotice('');
    try {
      if (action === 'play') await play(entry.recordingMbid);
      else if (action === 'save') { await keepDiscover(entry.recordingMbid); await refresh(true); setNotice(said.saved(entry.title)); }
      else {
        // A rejected song leaves the playing queue too. Saved songs may finish playing.
        stopPreparing();
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].id === entry.track?.id) await removeFromQueue(i);
        setUndo({ id: entry.recordingMbid, until: Date.now() + 10_000 });
        await rejectDiscover(entry.recordingMbid);
      }
    } catch (e) { if (mounted.current) setNotice(discoverError(e, t)); }
    finally { if (mounted.current) setWorking(null); }
  };
  const rows: (Entry | null)[] = [...(snapshot?.entries ?? [])];
  while (rows.length < settings.count) rows.push(null);
  return <FlatList data={rows} keyExtractor={(item, index) => item?.recordingMbid ?? `pending-${index}`}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.headingRow}><View style={styles.flex}>
        <Text style={styles.heading}>{said.heading}</Text>
        <Text style={styles.muted}>{said.mix(settings.count)}</Text>
      </View><Pressable android_ripple={pressed} accessibilityRole="button" disabled={busy || !!working} onPress={() => void maintainDiscover(true)} style={styles.button}><Text style={styles.text}>{said.refresh}</Text></Pressable></View>
      <Text style={styles.muted}>{said.about}</Text>
      {snapshot?.refreshedAt ? <Text style={styles.muted}>{said.updated(t.format.date(new Date(snapshot.refreshedAt)))}</Text> : null}
      {busy ? <View style={styles.headingRow}><ActivityIndicator color={c.text} /><Text style={styles.muted}>{message || said.preparing}</Text></View> : null}
      {snapshot?.pending ? <Text style={styles.muted}>{said.nextList(snapshot.pending.filter(e => e.track).length, settings.count)}</Text> : null}
      {waiting ? <Text style={styles.muted}>{waiting}</Text> : null}
      {error || notice ? <Text accessibilityRole="alert" style={styles.error}>{discoverSaid(notice || error, t)}</Text> : null}
      {undo ? <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.button} onPress={() => { void undoDiscover(undo.id, true); setUndo(null); setNotice(said.restored); }}><Text style={styles.text}>{said.excludedUndo}</Text></Pressable> : null}
    </View>}
    renderItem={({ item, index }) => {
      if (!item) return <View style={styles.row}><View style={[styles.cover, styles.coverEmpty]} /><View style={styles.flex}><Text style={styles.text}>{busy ? said.finding : said.waitingToBeFound}</Text><Text style={styles.muted}>{said.place(index + 1, settings.count)}</Text></View><Pressable android_ripple={pressed} accessibilityRole="button" disabled={busy} onPress={() => void retryDiscoverFill()} style={styles.button}><Text style={styles.text}>{t.common.retry}</Text></Pressable></View>;
      const job = jobs.find(j => j.id === item.jobId);
      const downloading = working === item.recordingMbid;
      return <View style={styles.row}>
        <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={said.playLabel(item.title)} disabled={!!working || busy} onPress={() => void act(item, 'play')} style={styles.song}>
          {item.coverUrl || item.track?.artworkUri ? <Image source={{ uri: item.track?.artworkUri || item.coverUrl! }} style={styles.cover} /> : <View style={[styles.cover, styles.coverEmpty]} />}
          <View style={styles.flex}><Text numberOfLines={2} style={styles.text}>{item.title}</Text><Text numberOfLines={1} style={styles.muted}>{item.artist}</Text>
            <Text numberOfLines={2} style={styles.reason}>{item.familiar ? said.familiar(item.because) : said.fresh(item.because)}</Text>
            <Text style={item.error ? styles.error : styles.muted}>{item.error ? discoverSaid(item.error, t) : downloading ? said.songPreparing : item.track ? said.ready : job ? statusLabel(job, t) : settings.autoDownload ? said.waitingToDownload : said.tapToDownload}</Text>
          </View>
        </Pressable>
        <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={said.keepLabel(item.title)} disabled={!!working || busy} style={styles.icon} onPress={() => void act(item, 'save')}><Text style={styles.symbol}>+</Text></Pressable>
        <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={said.neverLabel(item.title)} disabled={!!working || busy} style={styles.icon} onPress={() => void act(item, 'reject')}><Text style={styles.symbol}>−</Text></Pressable>
      </View>;
    }} />;
}
const useStyles = makeStyles((c) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 }, header: { gap: 12, paddingVertical: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heading: { color: c.text, fontSize: 18, fontWeight: '600', marginBottom: 5 },
  flex: { flex: 1, minWidth: 0, gap: 3 }, text: { color: c.text, fontSize: 14 }, muted: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  reason: { color: c.textFaint, fontSize: 11, lineHeight: 16 }, error: { color: c.danger, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, gap: 4 },
  song: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }, cover: { width: 52, height: 52, borderRadius: 8 }, coverEmpty: { backgroundColor: c.surfaceRaised },
  button: { padding: 12, minHeight: 44, justifyContent: 'center' }, icon: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' }, symbol: { color: c.text, fontSize: 25 },
}));
