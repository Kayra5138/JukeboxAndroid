import { useCallback, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { discoveredAt, discoveries, type Discovery } from '../lib/db/discover';
import { runDiscovery, type Progress } from '../lib/discover/run';
import { formatDateTime } from '../lib/format/date';
import { isAbortError, isNetworkError } from '../lib/metadata/http';
import { scanLibrary } from '../lib/media/library';

const ACCENT = '#7ab8ff';

/**
 * Music that is not on the phone.
 *
 * Every other screen in this app is about a library; this one is deliberately
 * about everything outside it, which is why the rows cannot be played and do
 * not pretend they can. A row is a name and a song to start with, and tapping
 * it goes looking — which is the only honest thing it could do.
 *
 * Kept off the tab bar and behind the lists, because it is not a daily errand:
 * the suggestions change when the listening does, which is weeks, not hours.
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [found, setFound] = useState<Discovery[]>([]);
  const [at, setAt] = useState<number | null>(null);
  const [working, setWorking] = useState<Progress | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const running = useRef<AbortController | null>(null);

  const read = useCallback(() => {
    setFound(discoveries());
    setAt(discoveredAt());
  }, []);

  useFocusEffect(
    useCallback(() => {
      read();
      // A run in flight when the screen goes has nowhere to put its answer and
      // nobody waiting for it, so it is stopped rather than left to finish.
      return () => running.current?.abort();
    }, [read])
  );

  const look = useCallback(async () => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setTrouble(null);
    setWorking({ done: 0, total: 1 });

    try {
      /*
        The library is read for the artists already owned, which is what the
        suggestions are stripped of. From the media store rather than from the
        listening history: a record owned and never played is still owned, and
        recommending it would be the app pointing at the user's own phone.
      */
      const library = await scanLibrary();
      await runDiscovery(library, Date.now(), setWorking, controller.signal);
      read();
    } catch (failure) {
      if (!isAbortError(failure)) {
        setTrouble(
          isNetworkError(failure)
            ? 'Could not reach the catalogues. Try again when you are back online.'
            : 'Something went wrong looking for music.'
        );
      }
    } finally {
      running.current = null;
      setWorking(null);
    }
  }, [read]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 },
        ]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.heading}>Discover</Text>
        <Text style={styles.blurb}>
          Artists whose listeners also play what you have been playing, with
          everything already on your phone taken out.
        </Text>

        <Pressable
          accessibilityRole="button"
          style={[styles.look, working != null && styles.looking]}
          disabled={working != null}
          onPress={() => void look()}>
          {working != null ? (
            <View style={styles.row}>
              <ActivityIndicator color="#121212" size="small" />
              <Text style={styles.lookLabel}>
                Looking… {Math.min(99, Math.round((working.done / Math.max(1, working.total)) * 100))}%
              </Text>
            </View>
          ) : (
            <Text style={styles.lookLabel}>{found.length ? 'Look again' : 'Find something new'}</Text>
          )}
        </Pressable>

        {trouble ? <Text style={styles.trouble}>{trouble}</Text> : null}

        {at != null ? (
          <Text style={styles.when}>Worked out {formatDateTime(new Date(at))}</Text>
        ) : null}

        {found.length === 0 && working == null ? (
          <Text style={styles.empty}>
            Nothing yet. This reads what you have listened to over the past year,
            so it wants a few weeks of history behind it to say anything useful.
          </Text>
        ) : null}

        {found.map((entry) => (
          <Suggestion key={entry.recordingMbid} entry={entry} />
        ))}

        {found.length > 0 ? (
          <Text style={styles.credit}>
            Suggestions from ListenBrainz, names from MusicBrainz, sleeves from
            the Cover Art Archive.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * One thing to go and listen to.
 *
 * Tapping it searches the web rather than doing anything inside the app,
 * because there is nothing inside the app to do: the track is, by definition,
 * one the library does not have. Handing the name to the phone is the whole of
 * what this screen can honestly offer, and it is also what somebody wants —
 * the next step after reading a recommendation is hearing it.
 */
function Suggestion({ entry }: { entry: Discovery }) {
  const sameName = entry.title === entry.artist;
  const query = sameName ? entry.artist : `${entry.artist} ${entry.title}`;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Look up ${query}`}
      style={styles.card}
      onPress={() => {
        void Linking.openURL(
          `https://duckduckgo.com/?q=${encodeURIComponent(`${query} song`)}`
        ).catch(() => {});
      }}>
      {entry.coverUrl ? (
        <Image source={{ uri: entry.coverUrl }} style={styles.cover} transition={120} />
      ) : (
        <View style={[styles.cover, styles.blank]} />
      )}
      <View style={styles.what}>
        <Text style={styles.artist} numberOfLines={1}>
          {entry.artist}
        </Text>
        {/* An artist with no song behind it says so rather than repeating its
            own name on the second line. */}
        <Text style={styles.song} numberOfLines={1}>
          {sameName ? 'Worth a listen' : entry.title}
        </Text>
        {entry.because ? (
          <Text style={styles.because} numberOfLines={1}>
            because you play {entry.because}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  content: { paddingHorizontal: 20, gap: 10 },

  back: { color: ACCENT, fontSize: 15, paddingVertical: 4 },
  heading: { color: '#f2f2f2', fontSize: 28, fontWeight: '700', marginTop: 4 },
  blurb: { color: '#7a7a7a', fontSize: 13.5, lineHeight: 20 },

  look: {
    backgroundColor: '#ededed',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  looking: { backgroundColor: '#9f9f9f' },
  lookLabel: { color: '#121212', fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  trouble: { color: '#d08a8a', fontSize: 13, lineHeight: 19 },
  when: { color: '#5a5a5a', fontSize: 11.5 },
  empty: { color: '#7a7a7a', fontSize: 13.5, lineHeight: 20, paddingTop: 18 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cover: { width: 54, height: 54, borderRadius: 7, backgroundColor: '#1d1d1d' },
  blank: { backgroundColor: '#1d1d1d' },
  what: { flex: 1, minWidth: 0 },
  artist: { color: '#ededed', fontSize: 15.5, fontWeight: '600' },
  song: { color: '#a8a8a8', fontSize: 13.5, marginTop: 1 },
  because: { color: '#5a5a5a', fontSize: 11.5, marginTop: 3 },

  credit: { color: '#4e4e4e', fontSize: 11, lineHeight: 17, paddingTop: 22 },
});
