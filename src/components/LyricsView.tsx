import { useScreenReader } from '../lib/ui/screenReader';
import { LEADING, SPACE, TYPE, RADIUS } from '../lib/theme/measures';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Busy } from './Busy';
import { LocateIcon } from './Icons';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import { lineAt, parseLrc } from '../lib/lyrics/lrc';
import type { LyricsState } from '../lib/lyrics/useLyrics';
import { useTranslation } from '../lib/lyrics/useTranslation';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';
import { motionReduced } from '../lib/ui/motion';

const LINE_HEIGHT = 34;

/** Room above the words for the one line kept over the one being sung. */
const TOP_PADDING = LINE_HEIGHT;

/**
 * How far below the top of the view the line being sung is held.
 *
 * One row, which is where it already sat while every line was one row tall.
 * Expressed as a distance to the line itself rather than as "under the one
 * before it", because the line before it is not always one row: anchoring to
 * something whose height varies moves the sung line around with it, and the
 * whole point is that it should not move.
 */
const SUNG_AT = LINE_HEIGHT;

/**
 * The words, following the song when the timings are there and sitting still
 * when they are not.
 *
 * Timed lyrics are scrolled by the player's position rather than by hand: the
 * line being sung is held as the second one down, with what has just gone
 * above it and the rest of the verse below.
 */
export function LyricsView({
  state,
  positionSec,
  height,
  onSeek,
  trackId,
  translated,
  noneText,
}: {
  state: LyricsState;
  positionSec: number;
  height: number;
  onSeek: (seconds: number) => void;
  trackId: string | null;
  /** Whether to show a translation beneath each line. */
  translated: boolean;
  /** What is said where there are no words: a song's lyrics unless told otherwise, as a tape's captions are. */
  noneText?: string;
}) {
  const t = useT();
  const styles = useStyles();
  const c = useColours();
  const pressed = usePressed();
  const scroll = useRef<ScrollView>(null);
  const shown = useRef(-1);
  /** Which words these are, counted: what a measurement is asked about may be gone by the time it answers. */
  const wordsNow = useRef(0);
  /*
    The words themselves, as one view, so a line can be measured against the
    thing the scroll offset is counted from. Every bit of padding lives inside
    it rather than on the scroll view's own content container, which makes a
    line's position within this view the scroll offset that puts it at the top
    — no arithmetic in between to get wrong.
  */
  const body = useRef<View>(null);
  const rows = useRef<(View | null)[]>([]);
  /*
    Whether the words go along with the song. Not once they are scrolled by
    hand: somebody reading on ahead, or back, was taken back to the sung line
    the moment the song came to the next one. A button says how to have them
    follow again, and a line pressed, which goes there in the song, does too.
  */
  const [following, setFollowing] = useState(true);

  const synced = state.lyrics?.synced ?? null;
  const lines = useMemo(() => (synced ? parseLrc(synced) : []), [synced]);
  /*
    The stored shift is applied here rather than to the timings themselves, so
    the original stays intact and the correction stays adjustable. A positive
    shift means the words should arrive later, which is the same as asking
    where the song was a moment ago.
  */
  const offsetSec = (state.lyrics?.offsetMs ?? 0) / 1000;
  const shifted = positionSec - offsetSec;
  const active = lines.length > 0 ? lineAt(lines, shifted) : -1;

  /*
    Plain lyrics are split the same way the timed ones are, so both shapes hand
    the translator a list of lines and get a list back in step with it.
  */
  const plainLines = useMemo(
    () => (synced ? [] : (state.lyrics?.plain ?? '').split(/\r?\n/)),
    [synced, state.lyrics?.plain]
  );
  const sourceLines = useMemo(
    () => (lines.length > 0 ? lines.map((line) => line.text) : plainLines),
    [lines, plainLines]
  );
  // The timings go along for one case: romanised words, whose translation is
  // made from another entry of the song and has to be laid against these.
  const sourceTimes = useMemo(
    () => (lines.length > 0 ? lines.map((line) => line.at) : null),
    [lines]
  );
  const translation = useTranslation(trackId, sourceLines, translated, undefined, sourceTimes);

  /*
    The line being sung is held a fixed distance down the view, whatever the
    lines above it turned out to be.

    Measured when the scroll is made rather than remembered from when the line
    was laid out. Remembering is where this went wrong before: a measurement
    that had not arrived yet was stood in for by counting one row per line, and
    a line long enough to wrap is two rows, so every wrap above the sung line
    left the guess one row short. The error was never taken back — the line was
    marked as done the moment it was scrolled to, and the real measurement
    arriving afterwards was refused — so it built up line by line until the
    words being sung had walked off the bottom of the view.

    Asking at the moment of use cannot be stale and has nothing to accumulate.
  */
  const anchorToActive = useCallback((index: number) => {
    // Back before the first line, by a seek: the top is where the words are then.
    if (index < 0) {
      if (shown.current >= 0) {
        shown.current = -1;
        scroll.current?.scrollTo({ y: 0, animated: !motionReduced() });
      }
      return;
    }
    if (index === shown.current) return;

    const list = scroll.current;
    const frame = body.current;
    const row = rows.current[index];
    if (!list || !frame || !row) return;

    const asked = wordsNow.current;
    row.measureLayout(
      frame,
      (_x, y) => {
        // The answer to a question about words that have since gone: see below.
        if (asked !== wordsNow.current) return;
        /*
          Marked as done only once the scroll has actually gone out. Anything
          that stops it — the view not mounted, a measurement that failed — is
          left for the next tick to try again, which is the difference between
          a moment's delay and the words never moving again.
        */
        shown.current = index;
        // Held still, the sung line is put in its place rather than brought there.
        list.scrollTo({ y: Math.max(0, y - SUNG_AT), animated: !motionReduced() });
      },
      () => {
        // Nothing to do: the next tick asks again.
      }
    );
  }, []);

  /*
    A new song, or new words for it, starts at the top rather than wherever the
    last one was.

    On the song as well as the timed text, which is the same for two songs
    with none, and ahead of what follows the sung line, so that a line asked
    for against the old position does not land after this has gone to the top.
    A measurement can be on its way when this runs, and its answer would take
    the words straight back down until the first line was sung: hence
    `wordsNow`, which it is held against.

    Keyed on the timed text and not on the plain as well, which is not
    rendered at all when there are timings — and that field arrives a moment
    after the timed one does, so this ran a second time just after the lines
    had been measured and threw every measurement away. Nothing refills them:
    a layout that has not changed does not call back, so the words stopped
    following for the rest of the song.
  */
  useEffect(() => {
    wordsNow.current += 1;
    shown.current = -1;
    scroll.current?.scrollTo({ y: 0, animated: false });
    // A new song's words follow it, whatever was being read of the last one's.
    setFollowing(true);
  }, [trackId, synced]);

  /*
    Not with a screen reader, which moves through the words by its own
    gestures and not by a drag, so nothing here would hear that it had taken
    them: words that moved by themselves would pull the line being read out
    from under it. The button to follow is there for whoever wants it.
  */
  const reader = useScreenReader();
  useEffect(() => {
    if (reader) setFollowing(false);
  }, [reader, trackId, synced]);

  /*
    Runs on the position as well as on the line, so that a failed attempt is
    retried on the next tick rather than on the next line.

    That distinction is the whole bug. Anchoring can fail for perfectly
    ordinary reasons — the line above has not been measured, the list has not
    mounted, a touch cancelled the animation — and depending only on `active`
    meant the next chance to recover came when the song moved on. On a long
    line that is half a minute of lyrics sitting still, which is exactly what
    following "going away" looked like.

    Cheap to run: `anchorToActive` returns immediately once the line it is
    given is the one already shown, which it is on all but the first tick.
  */
  useEffect(() => {
    if (following) anchorToActive(active);
  }, [active, following, positionSec, height, translation.lines, anchorToActive]);

  /** Following the song again, from the line it is on now. */
  const follow = () => {
    haptic('player', 'tick');
    shown.current = -1;
    setFollowing(true);
  };

  /*
    A translation appearing or going puts a second row under every line, so
    where the sung line has to be scrolled to has changed even though the song
    has not moved. Forgetting which line was last scrolled to is enough to have
    it placed again on the next tick; there is nothing else left to forget.
  */
  useEffect(() => {
    shown.current = -1;
  }, [translation.lines]);

  if (state.looking) {
    return (
      <View style={[styles.centred, { height }]}>
        <Busy color={c.textFaint} />
      </View>
    );
  }

  if (!state.lyrics) {
    return (
      <View style={[styles.centred, { height }]}>
        <Text style={styles.none}>{noneText ?? t.lyrics.none}</Text>
      </View>
    );
  }

  // Said once, above the words, rather than in place of them: a translation
  // that is still arriving or will not arrive is no reason to hide the song.
  const aside = translation.working
    ? t.lyrics.translating
    : translated
      ? translation.note
      : null;

  /*
    Where the words came from, under the last of them: the song's own file, a
    .lrc beside it, or LRCLIB. Below rather than above so that it costs the
    words nothing while they are being followed, and so that nothing above the
    sung line changes height when it appears. Words somebody chose themselves
    need no saying where they came from.
  */
  const source = state.lyrics.source;
  const origin =
    source === 'file' || source === 'lrc' || source === 'lookup' ? t.lyrics.from[source] : null;

  if (lines.length === 0) {
    return (
      <ScrollView ref={scroll} style={{ height }} contentContainerStyle={styles.plainBody}>
        {aside ? <Text style={styles.aside}>{aside}</Text> : null}
        {plainLines.map((line, index) => (
          <View key={index}>
            <Text style={styles.plain}>{line}</Text>
            {translation.lines?.[index]?.trim() ? (
              <Text style={styles.plainTranslated}>{translation.lines[index]}</Text>
            ) : null}
          </View>
        ))}
        {origin ? <Text style={styles.origin}>{origin}</Text> : null}
      </ScrollView>
    );
  }

  return (
    <View style={{ height }}>
    <ScrollView
      ref={scroll}
      style={{ height }}
      showsVerticalScrollIndicator={false}
      // Taken by the finger: the words stay where they are put until asked to follow again.
      onScrollBeginDrag={() => setFollowing(false)}>
      <View
        ref={body}
        /*
          Kept as a view of its own on Android, which would otherwise fold a
          plain one into its parent to save a step — and a view that is not
          there cannot be measured against.
        */
        collapsable={false}
        style={{
          paddingTop: TOP_PADDING,
          // Deep enough for the closing lines to still reach the sung line's
          // place rather than stopping short at the end of the scroll.
          paddingBottom: Math.max(height - SUNG_AT - LINE_HEIGHT, LINE_HEIGHT),
        }}
        // The words have been re-laid out — a translation has arrived, the
        // view has been resized, a line has wrapped differently — so wherever
        // the sung line was put is no longer where it belongs.
        onLayout={() => {
          shown.current = -1;
        }}>
        {aside ? <Text style={styles.aside}>{aside}</Text> : null}
        {lines.map((line, index) => {
          const rendering = translation.lines?.[index]?.trim();
          return (
            <View
              key={`${line.at}:${index}`}
              // Held as the pair, not as the original alone: with a translation
              // underneath, the line the song is on is two rows tall, and
              // measuring only the first would place it by half of itself.
              ref={(node) => {
                rows.current[index] = node;
              }}
              collapsable={false}>
              {/*
                The words are what a screen reader says, with the line's
                translation after them, and the jump to that moment of the song
                is the hint. Named for the jump alone, as it once was, every
                line was "seek to so many seconds" and the words themselves
                could not be heard at all.
              */}
              <Text
                accessibilityRole="button"
                accessibilityLabel={rendering ? `${line.text}. ${rendering}` : line.text}
                accessibilityHint={t.lyrics.seekTo(t.format.decimal(line.at + offsetSec, 1))}
                accessibilityState={{ selected: index === active }}
                onPress={() => {
                  haptic('player', 'tick');
                  onSeek(line.at + offsetSec);
                  setFollowing(true);
                }}
                style={[styles.line, index === active && styles.lineNow]}>
                {line.text}
              </Text>
              {rendering ? (
                <Text
                  // Already said with the line above it.
                  importantForAccessibility="no"
                  onPress={() => {
                    haptic('player', 'tick');
                    onSeek(line.at + offsetSec);
                    setFollowing(true);
                  }}
                  style={[styles.translated, index === active && styles.translatedNow]}>
                  {rendering}
                </Text>
              ) : null}
            </View>
          );
        })}
        {origin ? <Text style={styles.origin}>{origin}</Text> : null}
      </View>
    </ScrollView>
    {/*
      In the corner across from the translation's button, its like: a map's
      "where you are", back to where the song is. Named for a screen reader.
    */}
    {following ? null : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.lyrics.follow}
        android_ripple={pressed}
        hitSlop={6}
        style={styles.follow}
        onPress={follow}>
        <LocateIcon size={18} color={c.text} />
      </Pressable>
    )}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
  none: { color: c.textFaint, fontSize: TYPE.small },
  line: {
    color: c.textFaint,
    fontSize: TYPE.heading,
    lineHeight: LINE_HEIGHT,
    textAlign: 'center',
    paddingHorizontal: SPACE.s,
  },
  lineNow: { color: c.text, fontWeight: '600' },
  // The faintest colour still meant to be read: a translation is read, and
  // the colour for what cannot be pressed came to less than three to one.
  translated: {
    color: c.textFaint,
    fontSize: TYPE.small,
    lineHeight: LEADING.small,
    textAlign: 'center',
    paddingHorizontal: SPACE.s,
    paddingBottom: SPACE.xs,
  },
  translatedNow: { color: c.accent },
  aside: { color: c.textFaint, fontSize: TYPE.hint, textAlign: 'center', paddingBottom: SPACE.s },
  origin: { color: c.textFaint, fontSize: TYPE.label, textAlign: 'center', paddingTop: SPACE.l },
  plainBody: { paddingVertical: SPACE.s },
  // Over the words, top left, while they are not following the song: as the translation's button is, top right (`PlayerSheet`).
  follow: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    ...outlined(c),
  },
  plain: { color: c.textSecondary, fontSize: TYPE.body, lineHeight: LEADING.body, textAlign: 'center' },
  plainTranslated: {
    color: c.textFaint,
    fontSize: TYPE.small,
    lineHeight: 20,
    textAlign: 'center',
    paddingBottom: SPACE.xs,
  },
}));
