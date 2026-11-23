import { useCallback, useEffect, useState } from 'react';
import { LEADING, SPACE, TYPE } from '../../../lib/theme/measures';
import { ScreenState } from '../../../components/ScreenState';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../../components/Button';
import { Segmented } from '../../../components/Segmented';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnderBars } from '../../../components/UnderBars';

import { GeneralTab } from '../../../components/details/GeneralTab';
import { LyricsTab } from '../../../components/details/LyricsTab';
import { TagsTab } from '../../../components/details/TagsTab';
import { useUnsavedGuard } from '../../../components/details/unsaved';
import { useT } from '../../../lib/i18n/index';
import { findTrack } from '../../../lib/media/library';
import { oneWithMetadata, type EnrichedTrack } from '../../../lib/media/merge';
import { makeStyles, scene } from '../../../lib/theme/index';
import type { Track } from '../../../lib/types';
import { AlbumLink, ArtistLinks } from '../../../components/NameLinks';

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
  // Left with something typed and not saved on any tab, whichever way: asked about first.
  const unsavedAsk = useUnsavedGuard();
  const [tab, setTab] = useState<Tab>(
    TABS.some((key) => key === wanted) ? (wanted as Tab) : 'general'
  );
  /** As the library reads the file, and the same with what is stored laid over it. */
  const [found, setFound] = useState<{ file: Track; shown: EnrichedTrack } | null>(null);
  /** True for a track that is not there to be found; otherwise what went wrong, as it was said. */
  const [gone, setGone] = useState<true | string | null>(null);
  const t = useT();
  const styles = useStyles();
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  // The bar of what is playing is along the foot of every page of a tab (see the tabs' layout), laid over it in a theme of glass: kept clear of.
  const under = useUnderBars();

  const load = useCallback(async () => {
    try {
      const file = await findTrack(trackId);
      if (!file) {
        setGone(true);
        return;
      }
      setGone(null);
      setFound({ file, shown: oneWithMetadata(file) });
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
        <Button kind="secondary" label={t.details.screen.goBack} onPress={() => router.back()} />
      </View>
    );
  }

  if (!found) {
    return (
      <View style={styles.screen}>
        <ScreenState kind="loading" />
      </View>
    );
  }

  const { file, shown } = found;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: under.bottom }]}>
      <View style={styles.heading}>
        <Text style={styles.title} numberOfLines={1}>
          {shown.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          <ArtistLinks credit={shown.artist} />
        </Text>
      </View>

      <Segmented
        role="tab"
        style={styles.tabs}
        options={TABS.map((key) => ({ value: key, label: t.details.screen.tabs[key] }))}
        value={tab}
        onChange={setTab}
      />

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
      {unsavedAsk}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centered: { alignItems: 'center', justifyContent: 'center', gap: SPACE.l, padding: SPACE.xl },
  gone: { color: c.text, fontSize: TYPE.body, lineHeight: LEADING.body, textAlign: 'center' },
  heading: { paddingHorizontal: SPACE.l, paddingTop: SPACE.m, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  artist: { color: c.textMuted, fontSize: TYPE.small },
  tabs: { marginHorizontal: SPACE.l, marginTop: SPACE.m },
  pane: { flex: 1 },
  hidden: { display: 'none' },
}));
