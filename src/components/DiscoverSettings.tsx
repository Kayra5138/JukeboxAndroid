import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useDiscover } from '../lib/discover/DiscoverProvider';
import { configureDiscover, undoDiscover } from '../lib/discover/engine';
import { scheduleDiscover } from '../lib/discover/background';
import { blockedSongs } from '../lib/discover/store';
import type { DiscoverSettings as Settings } from '../lib/discover/policy';
export function DiscoverSettings() {
  const { settings, busy } = useDiscover();
  const [blocked, setBlocked] = useState<ReturnType<typeof blockedSongs>>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [error, setError] = useState('');
  const change = async (patch: Partial<Settings>) => {
    setError('');
    try { await configureDiscover({ ...settings, ...patch }); await scheduleDiscover(); }
    catch { setError('Could not update Discover settings. Please retry.'); }
  };
  return <View style={styles.section}>
    <Text style={styles.heading}>Discover</Text>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.title}>Discovery songs</Text><View style={styles.choices}>
        {[10,20,30,40].map(count => <Pressable key={count} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: settings.count === count }} onPress={() => void change({ count })} style={[styles.choice, settings.count === count && styles.selected]}><Text style={styles.title}>{count}</Text></Pressable>)}
      </View><Text style={styles.muted}>Half familiar artists, half new. Saved and excluded songs are replaced immediately.</Text></View>
      <View style={styles.row}><Text style={styles.title}>Refresh list</Text><View style={styles.choices}>
        {[0,1,3,7,14,30].map(refreshDays => <Pressable key={refreshDays} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: settings.refreshDays === refreshDays }} onPress={() => void change({ refreshDays })} style={[styles.choice, settings.refreshDays === refreshDays && styles.selected]}><Text style={styles.title}>{refreshDays ? `${refreshDays}d` : 'Manual'}</Text></Pressable>)}
      </View><Text style={styles.muted}>Android chooses when background work can run. An overdue refresh also runs when you reopen Jukebox. Unsaved discoveries are replaced; queued songs are kept until playback no longer needs them.</Text></View>
      <View style={styles.row}><View style={styles.line}><Text style={styles.title}>Download automatically</Text><Switch disabled={busy} value={settings.autoDownload} onValueChange={autoDownload => void change({ autoDownload })} /></View><Text style={styles.muted}>MP3 audio. When off, tap a song to download and start listening.</Text></View>
      {/* About automatic downloads and nothing else, so with those off it is
          a switch for something that is not happening: shown, and not live. */}
      <View style={[styles.row, !settings.autoDownload && styles.off]}><View style={styles.line}><Text style={styles.title}>Automatic downloads on Wi-Fi only</Text><Switch disabled={busy || !settings.autoDownload} accessibilityState={{ disabled: busy || !settings.autoDownload, checked: settings.wifiOnly }} value={settings.wifiOnly} onValueChange={wifiOnly => void change({ wifiOnly })} /></View><Text style={styles.muted}>{settings.autoDownload ? 'Uses unmetered Wi-Fi. Downloads you start by tapping a song may use mobile data.' : 'Turn on automatic downloads to choose this. Downloads you start by tapping a song may use mobile data.'}</Text></View>
      <Pressable accessibilityRole="button" style={styles.row} onPress={() => { setBlocked(blockedSongs()); setShowBlocked(!showBlocked); }}><Text style={styles.title}>Excluded songs {showBlocked ? '−' : '+'}</Text></Pressable>
      {showBlocked && !blocked.length ? <Text style={[styles.muted, styles.row]}>No excluded songs.</Text> : null}
      {showBlocked ? blocked.map(song => <View key={song.id} style={[styles.row, styles.line]}><View style={{ flex: 1 }}><Text style={styles.title}>{song.title}</Text><Text style={styles.muted}>{song.artist}</Text></View><Pressable accessibilityRole="button" style={styles.choice} onPress={() => void undoDiscover(song.id).then(() => setBlocked(blockedSongs()))}><Text style={styles.title}>Allow again</Text></Pressable></View>) : null}
    </View>{error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { marginTop: 26 }, heading: { color: '#777', fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden' }, row: { padding: 16, gap: 10, borderBottomColor: '#292929', borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: '#ededed', fontSize: 14, flexShrink: 1 },
  muted: { color: '#858585', fontSize: 12, lineHeight: 18 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 8, backgroundColor: '#252525' }, selected: { backgroundColor: '#405264' }, off: { opacity: 0.45 }, error: { color: '#ffaaaa', fontSize: 12 },
});
