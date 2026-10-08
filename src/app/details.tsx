import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeneralTab } from '../components/details/GeneralTab';
import { LyricsTab } from '../components/details/LyricsTab';
import { TagsTab } from '../components/details/TagsTab';
import { useT } from '../lib/i18n/index';
import { findTrack } from '../lib/media/library';
import { withMetadata, type EnrichedTrack } from '../lib/media/merge';
import { makeStyles, outlined, scene, useColours, usePressed } from '../lib/theme/index';
import type { Track } from '../lib/types';

const TABS = ['general', 'tags', 'lyrics'] as const;

type Tab = (typeof TABS)[number];

/**
 * Everything known about one track, to read and to put right.
 *
 * One screen where there were four entries in the menu — view, edit, look up,
 * lyrics — which were four ways into the same question and made a person choose
 * between them before they had seen anything. The three tabs are the three
 * things a track has: what it is, what it is like, and its words. Each can be
 * looked up on its own, because a track with the right names and the wrong
 * words should not have its names searched for again to fix them.
 */
export default function DetailsScreen() {
  const router = useRouter();
  const { trackId, tab: wanted } = useLocalSearchParams<{ trackId: string; tab?: string }>();
  const [tab, setTab] = useState<Tab>(
    TABS.some((key) => key === wanted) ? (wanted as Tab) : 'general'
  );
  /** As the library reads the file, and the same with what is stored laid over it. */
  const [found, setFound] = useState<{ file: Track; shown: EnrichedTrack } | null>(null);
  /** True for a track that is not there to be found; otherwise what went wrong, as it was said. */
  const [gone, setGone] = useState<true | string | null>(null);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const file = await findTrack(trackId);
      if (!file) {
        setGone(true);
        return;
      }
      setGone(null);
      setFound({ file, shown: withMetadata([file])[0] ?? { ...file, genre: null, year: null, discNumber: null, tags: [], enriched: false } });
    } catch (error) {
      /*
        Asking the provider for a track can be refused, and reading the answer
        can fail on a database that will not open. Neither leaves anything to
        show, and without this the screen holds its spinner for as long as the
        reader is willing to wait at it.
      */
      setGone(String(error));
    }
  }, [trackId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (gone) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.gone}>{gone === true ? t.details.screen.missing : gone}</Text>
        <Pressable android_ripple={pressed} style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonLabel}>{t.details.screen.goBack}</Text>
        </Pressable>
      </View>
    );
  }

  if (!found) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  const { file, shown } = found;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.heading}>
        <Text style={styles.title} numberOfLines={1}>
          {shown.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {shown.artist ?? t.common.unknownArtist}
        </Text>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((key) => (
          <Pressable
            android_ripple={pressed}
            key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}>
            <Text style={tab === key ? styles.tabLabelOn : styles.tabLabel}>
              {t.details.screen.tabs[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/*
        All three stay mounted and the two not chosen are hidden. Unmounting
        them would throw away whatever was typed and not yet saved the moment
        somebody looked at another tab, and a search still running in one of
        them would come back to nothing.
      */}
      <View style={tab === 'general' ? styles.pane : styles.hidden}>
        <GeneralTab track={file} shown={shown} onChanged={() => void load()} />
      </View>
      <View style={tab === 'tags' ? styles.pane : styles.hidden}>
        <TagsTab track={shown} onChanged={() => void load()} />
      </View>
      <View style={tab === 'lyrics' ? styles.pane : styles.hidden}>
        <LyricsTab track={shown} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  gone: { color: c.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { backgroundColor: c.surfaceRaised, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, ...outlined(c) },
  buttonLabel: { color: c.text, fontSize: 15 },
  heading: { paddingHorizontal: 20, paddingTop: 14, gap: 3 },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  artist: { color: c.textMuted, fontSize: 13 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 3,
    ...outlined(c),
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  tabOn: { backgroundColor: c.primary },
  tabLabel: { color: c.textSecondary, fontSize: 14 },
  tabLabelOn: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },
  pane: { flex: 1 },
  hidden: { display: 'none' },
}));
