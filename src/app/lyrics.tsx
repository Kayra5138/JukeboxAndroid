import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSynced, parseLrc } from '../lib/lyrics/lrc';
import { formatOffset, parseOffsetMs } from '../lib/lyrics/offset';
import { TextPrompt } from '../components/TextPrompt';
import {
  findLyricsCandidates,
  type LyricsCandidate,
} from '../lib/lyrics/lrclib';
import {
  clearLyrics,
  readLyrics,
  writeLyricsOffset,
  writeManualLyrics,
  type StoredLyrics,
} from '../lib/db/lyrics';
import { findTrack } from '../lib/media/library';
import { bareTitle } from '../lib/metadata/text';
import type { Track } from '../lib/types';

/** One nudge of the timings, in milliseconds. */
const STEP_MS = 250;

function seconds(value: number | null): string {
  if (value == null || value <= 0) return '—';
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function describe(stored: StoredLyrics | null): string {
  if (!stored) return 'None yet';
  const shape = stored.synced ? 'Timed' : 'Plain text';
  const from = stored.source === 'manual' ? 'chosen by hand' : 'from LRCLIB';
  return `${shape}, ${from}`;
}

/**
 * Correcting a track's words by hand.
 *
 * Three things, because the automatic path fails in three ways. Timings that
 * are right but early or late are shifted. A song whose words were never found
 * — usually because its recorded length disagrees with the catalogue's, which
 * the automatic match refuses on purpose — is searched for by hand, with
 * nothing ruled out. Anything left over is pasted in.
 */
export default function LyricsScreen() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [track, setTrack] = useState<Track | null>(null);
  /** False until the library has been searched, so "missing" can be told from "not yet". */
  const [looked, setLooked] = useState(false);
  const [stored, setStored] = useState<StoredLyrics | null>(null);
  const [query, setQuery] = useState('');
  const [pasted, setPasted] = useState('');
  const [results, setResults] = useState<LyricsCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [typingOffset, setTypingOffset] = useState(false);
  const search = useRef<AbortController | null>(null);

  useEffect(() => () => search.current?.abort(), []);

  const refresh = useCallback(() => {
    if (trackId) setStored(readLyrics(trackId));
  }, [trackId]);

  useEffect(() => {
    void (async () => {
      const found = await findTrack(trackId);
      setTrack(found);
      setLooked(true);
      // Seeded with what the track calls itself, since that is what is being
      // looked for; the point of typing is to be able to change it.
      if (found) {
        setQuery(
          [found.artist, bareTitle(found.title, found.artist)].filter(Boolean).join(' ')
        );
      }
      refresh();
    })();
  }, [trackId, refresh]);

  const runSearch = useCallback(async () => {
    search.current?.abort();
    const controller = new AbortController();
    search.current = controller;

    setSearching(true);
    setNote(null);
    try {
      const found = await findLyricsCandidates(query, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      if (found.length === 0) setNote('Nothing came back for that.');
    } catch {
      if (!controller.signal.aborted) setNote('The search did not get through.');
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [query]);

  const choose = useCallback(
    (candidate: LyricsCandidate) => {
      writeManualLyrics(trackId, candidate.lyrics, Date.now());
      setResults(null);
      setNote('Saved.');
      refresh();
    },
    [trackId, refresh]
  );

  const savePasted = useCallback(() => {
    const body = pasted.trim();
    if (body.length === 0) return;
    // Timed or not is decided by what was pasted, not by asking: a paste with
    // timestamps in it is a timed set of lyrics whatever it is called.
    writeManualLyrics(
      trackId,
      { plain: isSynced(body) ? null : body, synced: isSynced(body) ? body : null },
      Date.now()
    );
    setPasted('');
    setNote('Saved.');
    refresh();
  }, [pasted, trackId, refresh]);

  const revert = useCallback(() => {
    clearLyrics(trackId);
    setResults(null);
    setNote('Cleared. The next lookup will search again.');
    refresh();
  }, [trackId, refresh]);

  const nudge = useCallback(
    (milliseconds: number) => {
      const next = (stored?.offsetMs ?? 0) + milliseconds;
      writeLyricsOffset(trackId, next);
      refresh();
    },
    [stored?.offsetMs, trackId, refresh]
  );

  const setOffset = useCallback(
    (typed: string) => {
      const milliseconds = parseOffsetMs(typed);
      setTypingOffset(false);
      if (milliseconds == null) {
        setNote('That is not a number of seconds.');
        return;
      }
      writeLyricsOffset(trackId, milliseconds);
      setNote(null);
      refresh();
    },
    [trackId, refresh]
  );

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        {looked ? (
          // A track can go between opening the menu and arriving here — deleted,
          // moved out of the library folder, the card pulled out. Spinning for
          // ever says nothing; this at least says what happened.
          <Text style={styles.body}>That track is no longer in the library.</Text>
        ) : (
          <ActivityIndicator color="#ededed" />
        )}
      </View>
    );
  }

  const timed = stored?.synced ? parseLrc(stored.synced).length : 0;
  const offset = stored?.offsetMs ?? 0;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {track.artist ?? 'Unknown artist'} · {seconds(track.durationSec)}
        </Text>

        <Text style={styles.section}>What is stored</Text>
        <Text style={styles.body}>
          {describe(stored)}
          {timed > 0 ? ` · ${timed} lines` : ''}
        </Text>
        {stored?.source === 'manual' ? (
          // The only way back. A hand-made choice is deliberately left alone by
          // every lookup, so without this a wrong correction would be permanent.
          <Pressable style={styles.revert} onPress={revert}>
            <Text style={styles.revertLabel}>Forget this and look again</Text>
          </Pressable>
        ) : null}

        {timed > 0 ? (
          <>
            <Text style={styles.section}>Timing</Text>
            <Text style={styles.hint}>
              Shifts every line at once. Use it when the words are right but
              arrive early or late — open the player and nudge until they land,
              or tap the figure and type it. A positive shift makes the words
              arrive later.
            </Text>
            <View style={styles.row}>
              <Pressable style={styles.step} onPress={() => nudge(-STEP_MS)}>
                <Text style={styles.stepLabel}>−{STEP_MS / 1000}s</Text>
              </Pressable>
              {/* Nudging is for finding it; typing is for when you already
                  know. Four seconds out is sixteen taps otherwise. */}
              <Pressable onPress={() => setTypingOffset(true)}>
                <Text style={styles.offset}>{formatOffset(offset)}</Text>
              </Pressable>
              <Pressable style={styles.step} onPress={() => nudge(STEP_MS)}>
                <Text style={styles.stepLabel}>+{STEP_MS / 1000}s</Text>
              </Pressable>
              {offset !== 0 ? (
                <Pressable style={styles.step} onPress={() => nudge(-offset)}>
                  <Text style={styles.stepLabel}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Search by hand</Text>
        <Text style={styles.hint}>
          Nothing is ruled out here, unlike the automatic search — which refuses
          anything whose length disagrees, and is why some tracks never find
          their words.
        </Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Artist and title"
          placeholderTextColor="#5f5f5f"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void runSearch()}
        />
        <Pressable
          style={[styles.action, (!query.trim() || searching) && styles.actionOff]}
          disabled={!query.trim() || searching}
          onPress={() => void runSearch()}>
          {searching ? (
            <ActivityIndicator color="#121212" />
          ) : (
            <Text style={styles.actionLabel}>Search</Text>
          )}
        </Pressable>

        {note ? <Text style={styles.note}>{note}</Text> : null}

        {results?.map((candidate) => (
          <Pressable
            key={candidate.id}
            style={styles.candidate}
            onPress={() => choose(candidate)}>
            <Text style={styles.candidateTitle} numberOfLines={1}>
              {candidate.title}
            </Text>
            <Text style={styles.candidateMeta} numberOfLines={1}>
              {[
                candidate.artist,
                candidate.album,
                seconds(candidate.durationSec),
                candidate.synced ? 'timed' : 'plain',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.section}>Paste</Text>
        <Text style={styles.hint}>
          Takes an LRC file or plain words. Timestamps make it a timed set.
        </Text>
        <TextInput
          style={[styles.input, styles.paste]}
          value={pasted}
          onChangeText={setPasted}
          placeholder="[00:12.34] …"
          placeholderTextColor="#5f5f5f"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.action, !pasted.trim() && styles.actionOff]}
          disabled={!pasted.trim()}
          onPress={savePasted}>
          <Text style={styles.actionLabel}>Save pasted</Text>
        </Pressable>

        <Pressable style={styles.done} onPress={() => router.back()}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </ScrollView>

      <TextPrompt
        visible={typingOffset}
        heading="How far out are the words?"
        placeholder="Seconds, e.g. 1.5 or -0.75"
        initial={offset === 0 ? '' : String(offset / 1000)}
        onSubmit={setOffset}
        onClose={() => setTypingOffset(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48, gap: 10 },
  title: { color: '#ededed', fontSize: 17, fontWeight: '600' },
  muted: { color: '#7a7a7a', fontSize: 13 },
  section: {
    color: '#5f5f5f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 22,
  },
  body: { color: '#ededed', fontSize: 14 },
  hint: { color: '#5f5f5f', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  step: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  stepLabel: { color: '#ededed', fontSize: 14 },
  offset: {
    color: '#7ab8ff',
    fontSize: 14,
    minWidth: 74,
    textAlign: 'center',
    // Reads as something to touch rather than as a readout.
    textDecorationLine: 'underline',
    paddingVertical: 9,
  },
  input: {
    color: '#ededed',
    fontSize: 15,
    backgroundColor: '#1c1c1c',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  paste: { minHeight: 132, textAlignVertical: 'top' },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ededed',
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 44,
  },
  actionOff: { opacity: 0.35 },
  actionLabel: { color: '#121212', fontSize: 15, fontWeight: '600' },
  note: { color: '#7ac48a', fontSize: 13 },
  revert: { alignSelf: 'flex-start', paddingVertical: 4 },
  revertLabel: { color: '#7ab8ff', fontSize: 13.5 },
  candidate: {
    gap: 3,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#242424',
  },
  candidateTitle: { color: '#ededed', fontSize: 14.5 },
  candidateMeta: { color: '#5f5f5f', fontSize: 12 },
  done: { alignItems: 'center', paddingTop: 26 },
  doneLabel: { color: '#7ab8ff', fontSize: 15 },
});
