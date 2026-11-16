import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { SearchField } from '../SearchField';
import { Switch } from '../Switch';
import { useT } from '../../lib/i18n/index';
import { isChannelAddress, isFeedAddress } from '../../lib/podcasts/episodes';
import { channelFeedOf, searchChannels, searchShows, type FoundShow } from '../../lib/podcasts/feed';
import { podcastsWifiOnly, setPodcastsWifiOnly } from '../../lib/podcasts/refresh';
import { subscriptions, type Subscription } from '../../lib/podcasts/store';
import { makeStyles, outlined, switchColours, useColours, usePressed } from '../../lib/theme/index';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../lib/ui/lists';

/** A search's results, or the podcasts followed: one row either way. */
type Row = { feedUrl: string; title: string; author: string | null; image: string | null; followers?: number | null };
/** What the list shows: a show, a heading over a search's part, or the channels still being looked for. */
type Item = ({ kind: 'row' } & Row) | { kind: 'heading'; key: string; label: string } | { kind: 'looking'; key: string };

/** How many of the channels YouTube finds are shown: the nearest, which is where the one meant is. */
const CHANNELS_SHOWN = 5;

/**
 * The podcasts of the Add tapes screen: the ones followed, and a search of
 * Apple's directory — or a feed's own address, pasted — for more. A YouTube
 * channel's address is followed the same way, its videos its episodes, and
 * words searched for are looked for among YouTube's channels too, those
 * shown above the podcasts, few as they are. A podcast or a channel opens a
 * screen of its own, where it is followed and its episodes fetched.
 */
export function PodcastsPane() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const said = t.search.tapes.podcasts;
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<FoundShow[] | null>(null);
  /** The channels found for the same words: null while looked for, or where nothing was searched for. */
  const [channels, setChannels] = useState<Row[] | null>(null);
  const [channelsTrouble, setChannelsTrouble] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Subscription[]>(() => subscriptions());
  const [wifiOnly, setWifiOnly] = useState(() => podcastsWifiOnly());
  const asked = useRef(0);

  // Read again coming back from a podcast, which may have been followed or let go meanwhile, and from the tape settings, which have the Wi‑Fi switch too.
  useFocusEffect(useCallback(() => {
    setFollowed(subscriptions());
    setWifiOnly(podcastsWifiOnly());
  }, []));

  const open = (feedUrl: string) => router.push({ pathname: '/podcast', params: { feed: feedUrl } });

  // A YouTube channel's page, followed by the feed YouTube keeps of it, which is what stays the same.
  const openChannel = async (address: string) => {
    const turn = ++asked.current;
    setSearching(true);
    setMessage(null);
    try {
      const feed = await channelFeedOf(address);
      if (turn !== asked.current) return;
      if (feed) open(feed);
      else setMessage(said.notChannel);
    } catch {
      if (turn === asked.current) setMessage(said.notChannel);
    }
    if (turn === asked.current) setSearching(false);
  };

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    Keyboard.dismiss();
    if (isChannelAddress(text)) return void openChannel(text);
    if (isFeedAddress(text)) return open(text);
    const turn = ++asked.current;
    setSearching(true);
    setMessage(null);
    setFound(null);
    setChannels(null);
    setChannelsTrouble(false);
    // YouTube's, read by the extractor, take longer than Apple's: each is shown as it comes.
    void searchChannels(text).then(
      (some) => turn === asked.current && setChannels(some.slice(0, CHANNELS_SHOWN)),
      () => {
        if (turn !== asked.current) return;
        setChannels([]);
        setChannelsTrouble(true);
      }
    );
    try {
      const shows = await searchShows(text);
      if (turn !== asked.current) return;
      setFound(shows);
    } catch {
      if (turn === asked.current) {
        setFound([]);
        setMessage(said.searchFailed);
      }
    }
    if (turn === asked.current) setSearching(false);
  };

  const clear = () => {
    asked.current += 1;
    setFound(null);
    setChannels(null);
    setChannelsTrouble(false);
    setMessage(null);
    setSearching(false);
  };

  const searched = found != null || searching;
  const items: Item[] = !searched
    ? followed.map((show) => ({ kind: 'row', ...show }))
    : [
        ...(channels == null || channels.length > 0
          ? [{ kind: 'heading', key: 'channels', label: said.channelsHeading } as const]
          : []),
        ...(channels == null ? [{ kind: 'looking', key: 'looking' } as const] : channels.map((show) => ({ kind: 'row', ...show }) as const)),
        ...(found && found.length > 0 ? [{ kind: 'heading', key: 'podcasts', label: said.podcastsHeading } as const] : []),
        ...(found ?? []).map((show) => ({ kind: 'row', ...show }) as const),
      ];
  const nothing = found != null && found.length === 0 && channels != null && channels.length === 0 && !message;

  return (
    <FlatList
      removeClippedSubviews={CLIP_SUBVIEWS}
      windowSize={LIST_WINDOW}
      data={items}
      keyExtractor={(item) => (item.kind === 'row' ? item.feedUrl : item.key)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
      ListHeaderComponent={
        <>
          <Text style={styles.intro}>{said.intro}</Text>
          {/* Where podcasts can be had from, for whoever wonders where to look. */}
          <Text style={styles.sources}>{said.sources}</Text>
          <View style={styles.searchRow}>
            <SearchField
              style={styles.input}
              accessibilityLabel={said.placeholder}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (!text.trim()) clear();
              }}
              placeholder={said.placeholder}
              maxLength={500}
              onSubmitEditing={() => void search()}
            />
            <Pressable android_ripple={pressed} accessibilityRole="button" style={[styles.searchButton, !query.trim() && styles.searchButtonOff]}
              disabled={!query.trim()} onPress={() => void search()}>
              <Text style={!query.trim() ? styles.darkTextOff : styles.darkText}>{t.common.search}</Text>
            </Pressable>
          </View>
          {searching && found == null && channels == null ? <ActivityIndicator style={styles.searching} color={c.text} /> : null}
          {message ? <Text accessibilityRole="alert" style={styles.note}>{message}</Text> : null}
          {channelsTrouble ? <Text style={styles.note}>{said.channelsFailed}</Text> : null}
          {nothing ? <Text accessibilityRole="alert" style={styles.note}>{said.nothingFound}</Text> : null}
          {!searched ? (
            <>
              <View style={styles.card}>
                <View style={styles.line}>
                  <Text style={styles.rowTitle}>{said.wifiOnly}</Text>
                  <Switch
                    accessibilityLabel={said.wifiOnly}
                    value={wifiOnly}
                    onValueChange={(on) => {
                      setPodcastsWifiOnly(on);
                      setWifiOnly(on);
                    }}
                    {...switchColours(c, wifiOnly)}
                  />
                </View>
                <Text style={styles.muted}>{said.wifiOnlyNote}</Text>
              </View>
              <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.yours)}</Text>
              {followed.length === 0 ? <Text style={styles.muted}>{said.noneYet}</Text> : null}
            </>
          ) : null}
        </>
      }
      renderItem={({ item }) => {
        if (item.kind === 'heading') return <Text accessibilityRole="header" style={styles.section}>{t.format.upper(item.label)}</Text>;
        if (item.kind === 'looking') return <ActivityIndicator style={styles.looking} color={c.textMuted} />;
        const channel = item.followers !== undefined;
        const line = [item.author, item.followers != null ? said.subscribers(item.followers) : null].filter(Boolean).join(' · ');
        return (
          <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row} onPress={() => open(item.feedUrl)}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={[styles.cover, channel && styles.round]} contentFit="cover" />
            ) : (
              <View style={[styles.cover, styles.coverEmpty, channel && styles.round]} />
            )}
            <View style={styles.rowText}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {line ? <Text style={styles.muted} numberOfLines={1}>{line}</Text> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  content: { padding: 20 },
  intro: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  sources: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, borderRadius: 12, minHeight: 48 },
  searchButton: { backgroundColor: c.primary, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', minHeight: 48, ...outlined(c, c.primary) },
  searchButtonOff: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  darkTextOff: { color: c.textDisabled, fontWeight: '600' },
  darkText: { color: c.onPrimary, fontWeight: '600' },
  searching: { marginVertical: 16 },
  note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  card: { marginTop: 16, padding: 16, gap: 8, borderRadius: 14, backgroundColor: c.surface, ...outlined(c) },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { color: c.text, fontSize: 15, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  cover: { width: 56, height: 56, borderRadius: 8 },
  coverEmpty: { backgroundColor: c.surfaceRaised },
  // A channel's picture, round as YouTube shows it, to tell it from a podcast's.
  round: { borderRadius: 28 },
  looking: { marginVertical: 14, alignSelf: 'flex-start', marginLeft: 18 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 14.5, fontWeight: '500' },
}));
