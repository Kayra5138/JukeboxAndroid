import { useCallback, useRef, useState } from 'react';
import { LEADING, RADIUS, SPACE, TYPE, PAGE } from '../../lib/theme/measures';
import { Note } from '../Note';
import { SectionLabel } from '../settings/rows';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { Busy } from '../Busy';

import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { SearchField } from '../SearchField';
import { Switch } from '../Switch';
import { useT } from '../../lib/i18n/index';
import { isChannelAddress, isFeedAddress } from '../../lib/podcasts/episodes';
import { channelFeedOf, searchChannels, searchShows, type FoundShow } from '../../lib/podcasts/feed';
import { podcastsWifiOnly, setPodcastsWifiOnly } from '../../lib/podcasts/refresh';
import { subscriptions, type Subscription } from '../../lib/podcasts/store';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../lib/ui/lists';
import { usePageRoom } from '../Page';

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
/**
 * [query] and [onQuery], where given, are the words typed kept by the screen
 * round it, so that they are still there when another source is chosen and
 * this one again: the same words looked for in each.
 */
export function PodcastsPane({ query: shared, onQuery }: { query?: string; onQuery?: (query: string) => void } = {}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // The tab bar and the bar of what is playing, in a theme of glass laid over the foot of the list.
  // The page's room, under the choice of where tapes come from, which stands over it (see `PageScroll`'s [head]).
  const room = usePageRoom();
  const router = useRouter();
  const said = t.search.tapes.podcasts;
  const [own, setOwn] = useState('');
  const query = shared ?? own;
  const setQuery = onQuery ?? setOwn;
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
      contentContainerStyle={{ ...room, paddingTop: PAGE.top }}
      ListHeaderComponent={
        <>
          <Text style={styles.intro}>{said.intro}</Text>
          {/* Where podcasts can be had from, for whoever wonders where to look. */}
          <Text style={styles.sources}>{said.sources}</Text>
          <SearchField
            accessibilityLabel={said.placeholder}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (!text.trim()) clear();
            }}
            placeholder={said.placeholder}
            maxLength={500}
            go={{ label: t.common.search, onPress: () => void search() }}
          />
          {searching && found == null && channels == null ? <Busy style={styles.searching} color={c.text} /> : null}
          {message ? <Note style={styles.noteRoom}>{message}</Note> : null}
          {channelsTrouble ? <Text style={styles.note}>{said.channelsFailed}</Text> : null}
          {nothing ? <Note style={styles.noteRoom}>{said.nothingFound}</Note> : null}
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
                  />
                </View>
                <Text style={styles.muted}>{said.wifiOnlyNote}</Text>
              </View>
              <SectionLabel>{said.yours}</SectionLabel>
              {followed.length === 0 ? <Text style={styles.muted}>{said.noneYet}</Text> : null}
            </>
          ) : null}
        </>
      }
      renderItem={({ item }) => {
        if (item.kind === 'heading') return <SectionLabel>{item.label}</SectionLabel>;
        if (item.kind === 'looking') return <Busy style={styles.looking} color={c.textMuted} />;
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
  intro: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small, marginBottom: SPACE.s },
  sources: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginBottom: SPACE.l },
  searching: { marginVertical: SPACE.l },
  note: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.m },
  noteRoom: { marginTop: SPACE.m },
  card: { marginTop: SPACE.l, padding: SPACE.l, gap: SPACE.s, borderRadius: RADIUS.card, backgroundColor: c.surface, ...outlined(c) },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m },
  rowTitle: { color: c.text, fontSize: TYPE.body, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.s },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  cover: { width: 56, height: 56, borderRadius: RADIUS.cover },
  coverEmpty: { backgroundColor: c.surfaceRaised },
  // A channel's picture, round as YouTube shows it, to tell it from a podcast's.
  round: { borderRadius: RADIUS.pill },
  looking: { marginVertical: SPACE.m, alignSelf: 'flex-start', marginLeft: SPACE.l },
  rowText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.body, fontWeight: '500' },
}));
