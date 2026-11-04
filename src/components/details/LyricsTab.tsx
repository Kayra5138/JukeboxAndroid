import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CrossIcon } from '../Icons';
import { Pressable } from '../Pressable';

import { useT } from '../../lib/i18n/index';
import { isSynced, parseLrc } from '../../lib/lyrics/lrc';
import { formatOffset, parseOffsetMs } from '../../lib/lyrics/offset';
import { FormScroll, TextField } from '../FormScroll';
import { SearchField } from '../SearchField';
import { TextPrompt } from '../TextPrompt';
import {
  findLyricsCandidates,
  rankCandidates,
  sameLength,
  type LyricsCandidate,
} from '../../lib/lyrics/lrclib';
import {
  clearLyrics,
  isManual,
  readLyrics,
  writeLocalLyrics,
  writeLyricsOffset,
  writeManualLyrics,
  type StoredLyrics,
} from '../../lib/db/lyrics';
import { readLocalLyrics } from '../../lib/lyrics/device';
import type { LocalLyrics } from '../../lib/lyrics/local';
import { withoutPackaging } from '../../lib/metadata/credit';
import { bareTitle } from '../../lib/metadata/text';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import type { Track } from '../../lib/types';
import { useAnnounce } from '../../lib/ui/announce';
import { haptic } from '../../lib/ui/haptics';
import { useUnsavedBack } from './unsaved';

/** One nudge of the timings, in milliseconds. */
const STEP_MS = 250;

/** What is under the box of words and stays above the keyboard with it: the button and the gap before it. */
const SAVE_ROW = 56;

/** The figure of the shift is a line of text; this makes it a finger's height to press. */
const OFFSET_SLOP = { top: 12, bottom: 12 };

function seconds(value: number | null): string {
  if (value == null || value <= 0) return '—';
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * A track's words: finding them, and correcting them.
 *
 * Two things on the page, in the order they are wanted. The search at the top
 * looks everywhere at once — the song's file, a .lrc beside it, and LRCLIB
 * with nothing ruled out, which is the way round the automatic match's
 * refusing a song whose recorded length disagrees — and shows what it found,
 * the same length as the song first, to be chosen with a press.
 *
 * And one box for the words themselves. Correcting a line and pasting a whole
 * song are the same thing done to the same words, so it is the one box with
 * what is stored in it: the cross in its corner empties it for a paste, and
 * saving it empty takes the words away. They stay away, as anything somebody
 * chose stays, until the link under the box says otherwise.
 *
 * Timings that are right but early or late are shifted underneath.
 */
export function LyricsTab({ track }: { track: Track }) {
  const trackId = track.id;
  const [stored, setStored] = useState<StoredLyrics | null>(null);
  /** The words were taken away by hand, so there are none and no lookup is to bring them back. */
  const [removed, setRemoved] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LyricsCandidate[] | null>(null);
  /** The words on the phone itself, offered above what the search found. */
  const [onPhone, setOnPhone] = useState<LocalLyrics | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Said aloud when it appears: it comes up where nobody's attention is, after a press elsewhere.
  useAnnounce(note);
  const [typingOffset, setTypingOffset] = useState(false);
  /** The words as they are being edited. */
  const [edited, setEdited] = useState('');
  const search = useRef<AbortController | null>(null);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.details.lyrics;

  useEffect(
    () => () => {
      search.current?.abort();
    },
    []
  );

  const refresh = useCallback(() => {
    if (!trackId) return;
    const now = readLyrics(trackId);
    setStored(now);
    setRemoved(now == null && isManual(trackId));
  }, [trackId]);

  // The timed text where there is one, since that is the one that carries
  // everything; the plain words otherwise.
  const storedText = stored?.synced ?? stored?.plain ?? '';
  const changed = edited.trim() !== storedText.trim();

  // Whenever what is stored changes — a result chosen, the box saved — the
  // box shows that, and not what was being typed over the old.
  useEffect(() => {
    setEdited(storedText);
  }, [storedText]);
  // Words pasted in or edited and not kept are asked about on the way out.
  useUnsavedBack(changed, () => setEdited(storedText));

  // Seeded with what the track calls itself, as a lyrics site would have it,
  // since that is what is being looked for; the point of typing is to be able
  // to change it. Done while drawing, once for each track, rather than in an
  // effect that would have to pretend not to read the title: a title corrected
  // on another tab must not throw away what is being typed here.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seededFor !== trackId) {
    setSeededFor(trackId);
    setQuery([track.artist, withoutPackaging(bareTitle(track.title, track.artist))].filter(Boolean).join(' '));
    setResults(null);
    setOnPhone(null);
    setNote(null);
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  const closeResults = useCallback(() => {
    setResults(null);
    setOnPhone(null);
  }, []);

  /**
   * Looks everywhere there is to look, for a person to choose from. Nothing is
   * replaced until they do: what is stored stays if nothing here is any good,
   * and a miss is no reason to throw away the words there are.
   */
  const find = useCallback(async () => {
    search.current?.abort();
    const controller = new AbortController();
    search.current = controller;
    setSearching(true);
    setNote(null);
    const [local, found] = await Promise.all([
      readLocalLyrics(trackId).catch(() => null),
      findLyricsCandidates(query, controller.signal).catch(() => null),
    ]);
    if (controller.signal.aborted) return;
    setSearching(false);
    setOnPhone(local);
    setResults(rankCandidates(found ?? [], track.durationSec));
    const any = local != null || (found?.length ?? 0) > 0;
    haptic('results', any ? 'confirm' : 'reject');
    if (found == null) setNote(t.details.searchFailed);
    else if (!any) setNote(said.nothingCameBack);
  }, [query, track.durationSec, trackId, t, said]);

  const choose = useCallback(
    (candidate: LyricsCandidate) => {
      haptic('results', 'confirm');
      writeManualLyrics(trackId, candidate.lyrics, Date.now());
      closeResults();
      setNote(t.common.saved);
      refresh();
    },
    [trackId, closeResults, refresh, t]
  );

  const chooseOnPhone = useCallback(
    (local: LocalLyrics) => {
      haptic('results', 'confirm');
      // Cleared first, as for a lookup: a shift and translations made for
      // other words do not belong to these.
      clearLyrics(trackId);
      writeLocalLyrics(trackId, local, Date.now());
      closeResults();
      setNote(t.lyrics.found[local.source]);
      refresh();
    },
    [trackId, closeResults, refresh, t]
  );

  const save = useCallback(() => {
    const body = edited.trim();
    haptic('results', 'confirm');
    // Timed or not is decided by what is in the box, not by asking: words with
    // timestamps in them are timed whatever they are called. Nothing in it is
    // a choice too, kept as one so that the next play does not fetch them back.
    writeManualLyrics(
      trackId,
      { plain: body && !isSynced(body) ? body : null, synced: body && isSynced(body) ? body : null },
      Date.now()
    );
    setNote(body ? t.common.saved : said.removed);
    refresh();
  }, [edited, trackId, refresh, t, said]);

  const revert = useCallback(() => {
    clearLyrics(trackId);
    closeResults();
    setNote(said.cleared);
    refresh();
  }, [trackId, closeResults, refresh, said]);

  const nudge = useCallback(
    (milliseconds: number) => {
      haptic('choices', 'tick');
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
        haptic('results', 'reject');
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
  const found = (results?.length ?? 0) + (onPhone ? 1 : 0);

  return (
    <View style={styles.screen}>
      <FormScroll contentContainerStyle={styles.content} under={SAVE_ROW}>
        <View style={styles.finding}>
          <SearchField
            style={styles.grow}
            // Named for what the box is for; the hint says what to put in it,
            // and is gone once anything is typed.
            accessibilityLabel={said.find}
            value={query}
            onChangeText={setQuery}
            placeholder={said.queryPlaceholder}
            onSubmitEditing={() => void find()}
          />
          <Pressable
            accessibilityRole="button"
            android_ripple={pressed}
            style={[styles.action, styles.findButton, (!query.trim() || searching) && styles.actionOff]}
            disabled={!query.trim() || searching}
            onPress={() => void find()}>
            {searching ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.actionLabel}>{t.common.search}</Text>
            )}
          </Pressable>
        </View>

        {found > 0 ? (
          <View>
            <View style={styles.resultsHead}>
              <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.results(found))}</Text>
              <Pressable accessibilityRole="button" android_ripple={pressed} hitSlop={OFFSET_SLOP} onPress={closeResults}>
                <Text style={styles.link}>{t.common.close}</Text>
              </Pressable>
            </View>
            {onPhone ? (
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={styles.candidate}
                onPress={() => chooseOnPhone(onPhone)}>
                <Text style={styles.candidateTitle} numberOfLines={1}>
                  {said.onPhone[onPhone.source]}
                </Text>
                <Text style={styles.candidateMeta} numberOfLines={1}>
                  {onPhone.lyrics.synced ? said.candidateTimed : said.candidatePlain}
                </Text>
              </Pressable>
            ) : null}
            {results?.map((candidate) => (
              <Pressable
                accessibilityRole="button"
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
                    sameLength(candidate, track.durationSec) ? said.sameLength : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {note ? <Text style={styles.note}>{note}</Text> : null}

        <Text style={styles.status}>
          {stored
            ? stored.source === 'file' || stored.source === 'lrc'
              ? t.lyrics.stored(Boolean(stored.synced), stored.source, timed)
              : said.kept(Boolean(stored.synced), stored.source === 'manual', timed)
            : removed
              ? said.removedByHand
              : said.none}
        </Text>

        <View>
          <TextField
            style={[styles.input, styles.words]}
            accessibilityLabel={said.wordsField}
            value={edited}
            onChangeText={setEdited}
            placeholder={said.wordsPlaceholder}
            placeholderTextColor={c.textFaint}
            multiline
            // A box of its own height that scrolls inside. It used to grow
            // with the words, and a song is taller than the screen: the
            // line being changed was then wherever it fell, usually under
            // the keyboard, and a field can only be moved clear as a whole.
            // Held to this height, the field keeps its own caret in view.
            autoCapitalize="none"
            autoCorrect={false}
          />
          {edited.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={said.clearBox}
              android_ripple={pressed}
              hitSlop={8}
              style={styles.clear}
              onPress={() => setEdited('')}>
              <CrossIcon size={14} color={c.text} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.saving}>
          {changed ? (
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              style={styles.undo}
              onPress={() => setEdited(storedText)}>
              <Text style={styles.undoLabel}>{said.undo}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            android_ripple={pressed}
            style={[styles.action, styles.grow, !changed && styles.actionOff]}
            disabled={!changed}
            onPress={save}>
            <Text style={styles.actionLabel}>{changed && !edited.trim() ? said.removeWords : t.common.save}</Text>
          </Pressable>
        </View>
        {timed > 0 ? <Text style={styles.hint}>{said.timedHint}</Text> : null}
        {stored?.source === 'manual' || removed ? (
          // The only way back. A hand-made choice is deliberately left alone by
          // every lookup, so without this a wrong correction would be permanent.
          <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.revert} onPress={revert}>
            <Text style={styles.link}>{said.forget}</Text>
          </Pressable>
        ) : null}

        {timed > 0 ? (
          <>
            <Text accessibilityRole="header" style={[styles.section, styles.sectionApart]}>{t.format.upper(said.timing)}</Text>
            <Text style={styles.hint}>{said.timingHint}</Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.step} onPress={() => nudge(-STEP_MS)}>
                <Text style={styles.stepLabel}>{said.earlier(STEP_MS / 1000)}</Text>
              </Pressable>
              {/* Nudging is for finding it; typing is for when you already
                  know. Four seconds out is sixteen taps otherwise. */}
              <Pressable
                accessibilityRole="button"
                accessibilityHint={said.typeOffset}
                // A finger's height to aim at, though it is drawn as a figure.
                hitSlop={OFFSET_SLOP}
                onPress={() => setTypingOffset(true)}>
                <Text style={styles.offset}>{formatOffset(offset, t)}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.step} onPress={() => nudge(STEP_MS)}>
                <Text style={styles.stepLabel}>{said.later(STEP_MS / 1000)}</Text>
              </Pressable>
              {offset !== 0 ? (
                <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.step} onPress={() => nudge(-offset)}>
                  <Text style={styles.stepLabel}>{said.reset}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
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
  grow: { flex: 1 },
  finding: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  findButton: { paddingHorizontal: 16 },
  resultsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
  },
  sectionApart: { paddingTop: 22 },
  status: { color: c.textMuted, fontSize: 13, paddingTop: 6 },
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
  // Room down the right for the cross, so that a long line is not read through it. Short enough
  // to fit above the keyboard with the button that saves it.
  words: { height: 270, textAlignVertical: 'top', lineHeight: 21, paddingRight: 44 },
  clear: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
  },
  saving: { flexDirection: 'row', gap: 8 },
  undo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  undoLabel: { color: c.text, fontSize: 15 },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 44,
    ...outlined(c, c.primary),
  },
  actionOff: { opacity: 0.35 },
  actionLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  // Good news and bad both come here, so it is neither colour.
  note: { color: c.text, fontSize: 13 },
  revert: { alignSelf: 'flex-start', paddingVertical: 4 },
  link: { color: c.accent, fontSize: 13.5 },
  candidate: {
    gap: 3,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  candidateTitle: { color: c.text, fontSize: 14.5 },
  candidateMeta: { color: c.textFaint, fontSize: 12 },
}));
