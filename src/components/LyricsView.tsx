import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { lineAt, parseLrc } from '../lib/lyrics/lrc';
import type { LyricsState } from '../lib/lyrics/useLyrics';
import { useTranslation } from '../lib/lyrics/useTranslation';

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
}: {
  state: LyricsState;
  positionSec: number;
  height: number;
  onSeek: (seconds: number) => void;
  trackId: string | null;
  /** Whether to show a translation beneath each line. */
  translated: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const shown = useRef(-1);
  /*
    The words themselves, as one view, so a line can be measured against the
    thing the scroll offset is counted from. Every bit of padding lives inside
    it rather than on the scroll view's own content container, which makes a
    line's position within this view the scroll offset that puts it at the top
    — no arithmetic in between to get wrong.
  */
  const body = useRef<View>(null);
  const rows = useRef<(View | null)[]>([]);

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
  const translation = useTranslation(trackId, sourceLines, translated);

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
    if (index < 0 || index === shown.current) return;

    const list = scroll.current;
    const frame = body.current;
    const row = rows.current[index];
    if (!list || !frame || !row) return;

    row.measureLayout(
      frame,
      (_x, y) => {
        /*
          Marked as done only once the scroll has actually gone out. Anything
          that stops it — the view not mounted, a measurement that failed — is
          left for the next tick to try again, which is the difference between
          a moment's delay and the words never moving again.
        */
        shown.current = index;
        list.scrollTo({ y: Math.max(0, y - SUNG_AT), animated: true });
      },
      () => {
        // Nothing to do: the next tick asks again.
      }
    );
  }, []);

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
    anchorToActive(active);
  }, [active, positionSec, height, translation.lines, anchorToActive]);

  /*
    A new set of lyrics starts at the top rather than wherever the last one was.

    Keyed on the timed text alone. It used to watch the plain text as well,
    which is not rendered at all when there are timings — and that field
    arrives a moment after the timed one does, so this ran a second time just
    after the lines had been measured and threw every measurement away. Nothing
    refills them: a layout that has not changed does not call back, so the
    words stopped following for the rest of the song.
  */
  useEffect(() => {
    shown.current = -1;
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [synced]);

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
        <ActivityIndicator color="#5f5f5f" />
      </View>
    );
  }

  if (!state.lyrics) {
    return (
      <View style={[styles.centred, { height }]}>
        <Text style={styles.none}>No lyrics found.</Text>
      </View>
    );
  }

  // Said once, above the words, rather than in place of them: a translation
  // that is still arriving or will not arrive is no reason to hide the song.
  const aside = translation.working
    ? 'Translating…'
    : translated
      ? translation.note
      : null;

  if (lines.length === 0) {
    return (
      <ScrollView style={{ height }} contentContainerStyle={styles.plainBody}>
        {aside ? <Text style={styles.aside}>{aside}</Text> : null}
        {plainLines.map((line, index) => (
          <View key={index}>
            <Text style={styles.plain}>{line}</Text>
            {translation.lines?.[index]?.trim() ? (
              <Text style={styles.plainTranslated}>{translation.lines[index]}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scroll} style={{ height }} showsVerticalScrollIndicator={false}>
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
              <Text
                accessibilityRole="button"
                accessibilityLabel={`Seek to ${(line.at + offsetSec).toFixed(1)} seconds`}
                onPress={() => onSeek(line.at + offsetSec)}
                style={[styles.line, index === active && styles.lineNow]}>
                {line.text}
              </Text>
              {rendering ? (
                <Text
                  onPress={() => onSeek(line.at + offsetSec)}
                  style={[styles.translated, index === active && styles.translatedNow]}>
                  {rendering}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
  none: { color: '#5f5f5f', fontSize: 13 },
  line: {
    color: '#5a5a5a',
    fontSize: 16,
    lineHeight: LINE_HEIGHT,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  lineNow: { color: '#ededed', fontWeight: '600' },
  translated: {
    color: '#4a4a4a',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  translatedNow: { color: '#8fa8c4' },
  aside: { color: '#5f5f5f', fontSize: 12, textAlign: 'center', paddingBottom: 10 },
  plainBody: { paddingVertical: 8 },
  plain: { color: '#c8c8c8', fontSize: 15, lineHeight: 26, textAlign: 'center' },
  plainTranslated: {
    color: '#6a6a6a',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
