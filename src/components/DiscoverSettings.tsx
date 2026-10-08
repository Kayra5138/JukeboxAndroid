import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useDiscover } from '../lib/discover/DiscoverProvider';
import { configureDiscover, undoDiscover } from '../lib/discover/engine';
import { scheduleDiscover } from '../lib/discover/background';
import { blockedSongs } from '../lib/discover/store';
import type { DiscoverSettings as Settings } from '../lib/discover/policy';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, switchColours, useColours, usePressed } from '../lib/theme/index';
export function DiscoverSettings() {
  const { settings, busy } = useDiscover();
  const [blocked, setBlocked] = useState<ReturnType<typeof blockedSongs>>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [error, setError] = useState('');
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.settings;
  const change = async (patch: Partial<Settings>) => {
    setError('');
    try { await configureDiscover({ ...settings, ...patch }); await scheduleDiscover(); }
    catch { setError(said.failed); }
  };
  return <View style={styles.section}>
    <Text style={styles.heading}>{t.format.upper(said.heading)}</Text>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.title}>{said.count}</Text><View style={styles.choices}>
        {[10,20,30,40].map(count => <Pressable android_ripple={pressed} key={count} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: settings.count === count }} onPress={() => void change({ count })} style={[styles.choice, settings.count === count && styles.selected]}><Text style={[styles.title, settings.count === count && styles.chosen]}>{count}</Text></Pressable>)}
      </View><Text style={styles.muted}>{said.countNote}</Text></View>
      <View style={styles.row}><Text style={styles.title}>{said.refresh}</Text><View style={styles.choices}>
        {[0,1,3,7,14,30].map(refreshDays => <Pressable android_ripple={pressed} key={refreshDays} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: settings.refreshDays === refreshDays }} onPress={() => void change({ refreshDays })} style={[styles.choice, settings.refreshDays === refreshDays && styles.selected]}><Text style={[styles.title, settings.refreshDays === refreshDays && styles.chosen]}>{refreshDays ? said.everyDays(refreshDays) : said.manual}</Text></Pressable>)}
      </View><Text style={styles.muted}>{said.refreshNote}</Text></View>
      <View style={styles.row}><View style={styles.line}><Text style={styles.title}>{said.auto}</Text><Switch disabled={busy} value={settings.autoDownload} {...switchColours(c, settings.autoDownload)} onValueChange={autoDownload => void change({ autoDownload })} /></View><Text style={styles.muted}>{said.autoNote}</Text></View>
      {/* About automatic downloads and nothing else, so with those off it is
          a switch for something that is not happening: shown, and not live. */}
      <View style={[styles.row, !settings.autoDownload && styles.off]}><View style={styles.line}><Text style={styles.title}>{said.wifi}</Text><Switch disabled={busy || !settings.autoDownload} accessibilityState={{ disabled: busy || !settings.autoDownload, checked: settings.wifiOnly }} value={settings.wifiOnly} {...switchColours(c, settings.wifiOnly)} onValueChange={wifiOnly => void change({ wifiOnly })} /></View><Text style={styles.muted}>{settings.autoDownload ? said.wifiNote : said.wifiNoteOff}</Text></View>
      <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row} onPress={() => { setBlocked(blockedSongs()); setShowBlocked(!showBlocked); }}><Text style={styles.title}>{said.excluded(showBlocked)}</Text></Pressable>
      {showBlocked && !blocked.length ? <Text style={[styles.muted, styles.row]}>{said.noneExcluded}</Text> : null}
      {showBlocked ? blocked.map(song => <View key={song.id} style={[styles.row, styles.line]}><View style={{ flex: 1 }}><Text style={styles.title}>{song.title}</Text><Text style={styles.muted}>{song.artist}</Text></View><Pressable android_ripple={pressed} accessibilityRole="button" style={styles.choice} onPress={() => void undoDiscover(song.id).then(() => setBlocked(blockedSongs()))}><Text style={styles.title}>{said.allowAgain}</Text></Pressable></View>) : null}
    </View>{error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}
const useStyles = makeStyles((c) => StyleSheet.create({
  section: { marginTop: 26 }, heading: { color: c.textFaint, fontSize: 11, letterSpacing: .8, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) }, row: { padding: 16, gap: 10, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: c.text, fontSize: 14, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: 12, lineHeight: 18 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 8, backgroundColor: c.surfaceRaised, ...outlined(c) }, selected: { backgroundColor: c.accentMuted, ...outlined(c, c.accent) }, off: { opacity: 0.45 },
  // The chosen one's words are heavier, so that it is not its colour alone that says which it is.
  chosen: { fontWeight: '600' }, error: { color: c.danger, fontSize: 12 },
}));
