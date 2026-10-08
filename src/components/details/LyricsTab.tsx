import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useT } from '../../lib/i18n/index';
import { isSynced, parseLrc } from '../../lib/lyrics/lrc';
import { formatOffset, parseOffsetMs } from '../../lib/lyrics/offset';
import { FormScroll, TextField } from '../FormScroll';
import { TextPrompt } from '../TextPrompt';
import {
  fetchLyrics,
  findLyricsCandidates,
  type LyricsCandidate,
} from '../../lib/lyrics/lrclib';
import {
  clearLyrics,
  readLyrics,
  writeLyrics,
  writeLyricsOffset,
  writeManualLyrics,
  type StoredLyrics,
} from '../../lib/db/lyrics';
import { isAbortError } from '../../lib/metadata/http';
import { bareTitle } from '../../lib/metadata/text';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import type { Track } from '../../lib/types';

/** One nudge of the timings, in milliseconds. */
const STEP_MS = 250;

function seconds(value: number | null): string {
  if (value == null || value <= 0) return '—';
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * A track's words: reading them, correcting them, and finding them.
 *
 * The automatic path fails in three ways, and each has its answer here.
 * Timings that are right but early or late are shifted. A song whose words
 * were never found — usually because its recorded length disagrees with the
 * catalogue's, which the automatic match refuses on purpose — is searched for
 * by hand, with nothing ruled out. Anything left over is pasted in.
 *
 * And the words themselves are on the page to be changed: a wrong line or a
 * misheard word is fixed where it stands rather than by pasting the whole
 * song again.
 */
export function LyricsTab({ track }: { track: Track }) {
  const trackId = track.id;
  const [stored, setStored] = useState<StoredLyrics | null>(null);
  const [query, setQuery] = useState('');
  const [pasted, setPasted] = useState('');
  const [results, setResults] = useState<LyricsCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [typingOffset, setTypingOffset] = useState(false);
  /** The stored words as they are being edited. */
  const [edited, setEdited] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const search = useRef<AbortController | null>(null);
  const lookup = useRef<AbortController | null>(null);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.details.lyrics;

  useEffect(
    () => () => {
      search.current?.abort();
      lookup.current?.abort();
    },
    []
  );

  const refresh = useCallback(() => {
    if (trackId) setStored(readLyrics(trackId));
  }, [trackId]);

  // The timed text where there is one, since that is the one that carries
  // everything; the plain words otherwise.
  const storedText = stored?.synced ?? stored?.plain ?? '';

  // Whenever what is stored changes — a lookup, a search result chosen, a
  // paste — the box shows that, and not what was being typed over the old.
  useEffect(() => {
    setEdited(storedText);
  }, [storedText]);

  // Seeded with what the track calls itself, since that is what is being
  // looked for; the point of typing is to be able to change it.
  useEffect(() => {
    setQuery([track.artist, bareTitle(track.title, track.artist)].filter(Boolean).join(' '));
    setResults(null);
    setNote(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  /**
   * The automatic search, asked for by hand.
   *
   * The same one a play runs, strict about length and all, and here it is
   * allowed to replace words somebody chose: pressing the button is asking
   * for exactly that. Finding nothing leaves what is stored alone, though. A
   * miss is no reason to throw away the words there are.
   */
  const lookUp = useCallback(async () => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setLookingUp(true);
    setNote(null);
    try {
      const found = await fetchLyrics(
        {
          title: track.title,
          artist: track.artist,
          album: track.album,
          durationSec: track.durationSec,
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!found) {
        setNote(said.nothingMatched);
        return;
      }
      // Cleared first: the old row takes its shift and its translations with
      // it, and neither belongs to the words that are replacing it.
      clearLyrics(trackId);
      writeLyrics(trackId, found, Date.now());
      setResults(null);
      setNote(said.foundAndSaved);
      refresh();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setNote(t.details.searchFailed);
    } finally {
      if (!controller.signal.aborted) setLookingUp(false);
    }
  }, [track, trackId, refresh, t, said]);

  const saveEdited = useCallback(() => {
    const body = edited.trim();
    if (body.length === 0) return;
    // Timed or not is decided by what is in the box, the same as a paste.
    writeManualLyrics(
      trackId,
      { plain: isSynced(body) ? null : body, synced: isSynced(body) ? body : null },
      Date.now()
    );
    setNote(t.common.saved);
    refresh();
  }, [edited, trackId, refresh, t]);

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
      if (found.length === 0) setNote(said.nothingCameBack);
    } catch {
      if (!controller.signal.aborted) setNote(t.details.searchFailed);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [query, t, said]);

  const choose = useCallback(
    (candidate: LyricsCandidate) => {
      writeManualLyrics(trackId, candidate.lyrics, Date.now());
      setResults(null);
      setNote(t.common.saved);
      refresh();
    },
    [trackId, refresh, t]
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
    setNote(t.common.saved);
    refresh();
  }, [pasted, trackId, refresh, t]);

  const revert = useCallback(() => {
    clearLyrics(trackId);
    setResults(null);
    setNote(said.cleared);
    refresh();
  }, [trackId, refresh, said]);

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
        setNote(said.notSeconds);
        return;
      }
      writeLyricsOffset(trackId, milliseconds);
      setNote(null);
      refresh();
    },
    [trackId, refresh, said]
  );

  const timed = stored?.synced ? parseLrc(stored.synced).length : 0;
  const offset = stored?.offsetMs ?? 0;

  return (
    <View style={styles.screen}>
      <FormScroll contentContainerStyle={styles.content}>
        <Pressable
          android_ripple={pressed}
          style={[styles.action, lookingUp && styles.actionOff]}
          disabled={lookingUp}
          onPress={() => void lookUp()}>
          {lookingUp ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={styles.actionLabel}>{t.details.lookUp}</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>{said.lookUpHint}</Text>

        {note ? <Text style={styles.note}>{note}</Text> : null}

        <Text style={[styles.section, styles.sectionFirst]}>{t.format.upper(said.stored)}</Text>
        <Text style={styles.body}>
          {stored
            ? said.kept(Boolean(stored.synced), stored.source === 'manual', timed)
            : said.none}
        </Text>
        {stored?.source === 'manual' ? (
          // The only way back. A hand-made choice is deliberately left alone by
          // every lookup, so without this a wrong correction would be permanent.
          <Pressable android_ripple={pressed} style={styles.revert} onPress={revert}>
            <Text style={styles.revertLabel}>{said.forget}</Text>
          </Pressable>
        ) : null}

        {stored ? (
          <>
            <TextField
              style={[styles.input, styles.words]}
              value={edited}
              onChangeText={setEdited}
              multiline
              // A box of its own height that scrolls inside. It used to grow
              // with the words, and a song is taller than the screen: the
              // line being changed was then wherever it fell, usually under
              // the keyboard, and a field can only be moved clear as a whole.
              // Held to this height, the field keeps its own caret in view.
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              android_ripple={pressed}
              style={[
                styles.action,
                (edited.trim() === storedText.trim() || !edited.trim()) && styles.actionOff,
              ]}
              disabled={edited.trim() === storedText.trim() || !edited.trim()}
              onPress={saveEdited}>
              <Text style={styles.actionLabel}>{said.saveChanges}</Text>
            </Pressable>
            <Text style={styles.hint}>
              {timed > 0 ? said.timedHint : said.plainHint}
            </Text>
          </>
        ) : null}

        {timed > 0 ? (
          <>
            <Text style={styles.section}>{t.format.upper(said.timing)}</Text>
            <Text style={styles.hint}>{said.timingHint}</Text>
            <View style={styles.row}>
              <Pressable android_ripple={pressed} style={styles.step} onPress={() => nudge(-STEP_MS)}>
                <Text style={styles.stepLabel}>{said.earlier(STEP_MS / 1000)}</Text>
              </Pressable>
              {/* Nudging is for finding it; typing is for when you already
                  know. Four seconds out is sixteen taps otherwise. */}
              <Pressable onPress={() => setTypingOffset(true)}>
                <Text style={styles.offset}>{formatOffset(offset, t)}</Text>
              </Pressable>
              <Pressable android_ripple={pressed} style={styles.step} onPress={() => nudge(STEP_MS)}>
                <Text style={styles.stepLabel}>{said.later(STEP_MS / 1000)}</Text>
              </Pressable>
              {offset !== 0 ? (
                <Pressable android_ripple={pressed} style={styles.step} onPress={() => nudge(-offset)}>
                  <Text style={styles.stepLabel}>{said.reset}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>{t.format.upper(said.byHand)}</Text>
        <Text style={styles.hint}>{said.byHandHint}</Text>
        <TextField
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={said.queryPlaceholder}
          placeholderTextColor={c.textDisabled}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void runSearch()}
        />
        <Pressable
          android_ripple={pressed}
          style={[styles.action, (!query.trim() || searching) && styles.actionOff]}
          disabled={!query.trim() || searching}
          onPress={() => void runSearch()}>
          {searching ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={styles.actionLabel}>{t.common.search}</Text>
          )}
        </Pressable>

        {results?.map((candidate) => (
          <Pressable
            android_ripple={pressed}
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
                candidate.synced ? said.candidateTimed : said.candidatePlain,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.section}>{t.format.upper(said.paste)}</Text>
        <Text style={styles.hint}>{said.pasteHint}</Text>
        <TextField
          style={[styles.input, styles.paste]}
          value={pasted}
          onChangeText={setPasted}
          placeholder="[00:12.34] …"
          placeholderTextColor={c.textDisabled}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          android_ripple={pressed}
          style={[styles.action, !pasted.trim() && styles.actionOff]}
          disabled={!pasted.trim()}
          onPress={savePasted}>
          <Text style={styles.actionLabel}>{said.savePasted}</Text>
        </Pressable>
      </FormScroll>

      <TextPrompt
        visible={typingOffset}
        heading={said.offsetHeading}
        placeholder={said.offsetPlaceholder}
        initial={offset === 0 ? '' : String(offset / 1000)}
        onSubmit={setOffset}
        onClose={() => setTypingOffset(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 10 },
  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 22,
  },
  body: { color: c.text, fontSize: 14 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  step: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  stepLabel: { color: c.text, fontSize: 14 },
  offset: {
    color: c.accent,
    fontSize: 14,
    minWidth: 74,
    textAlign: 'center',
    // Reads as something to touch rather than as a readout.
    textDecorationLine: 'underline',
    paddingVertical: 9,
  },
  input: {
    color: c.text,
    fontSize: 15,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...outlined(c),
  },
  paste: { minHeight: 132, textAlignVertical: 'top' },
  words: { height: 260, textAlignVertical: 'top', lineHeight: 21 },
  sectionFirst: { paddingTop: 10 },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 44,
  },
  actionOff: { opacity: 0.35 },
  actionLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  note: { color: c.success, fontSize: 13 },
  revert: { alignSelf: 'flex-start', paddingVertical: 4 },
  revertLabel: { color: c.accent, fontSize: 13.5 },
  candidate: {
    gap: 3,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  candidateTitle: { color: c.text, fontSize: 14.5 },
  candidateMeta: { color: c.textFaint, fontSize: 12 },
}));
