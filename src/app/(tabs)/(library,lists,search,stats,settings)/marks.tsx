import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CrossIcon } from '../../../components/Icons';
import { Image } from '../../../components/Picture';
import { Pressable } from '../../../components/Pressable';
import { TextPrompt } from '../../../components/TextPrompt';
import { useT } from '../../../lib/i18n/index';
import { libraryState, refreshLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { useTrackArtwork } from '../../../lib/media/artwork';
import type { EnrichedTrack } from '../../../lib/media/merge';
import { usePlayerActions, usePlayerState } from '../../../lib/player/PlayerProvider';
import { removeMark, setMarkNote, useAllMarks, type TapeMark } from '../../../lib/tapes/marks';
import { partsOf } from '../../../lib/tapes/order';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles, scene, useColours, usePressed } from '../../../lib/theme/index';
import { haptic } from '../../../lib/ui/haptics';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../../lib/ui/lists';
import { durationLabel } from '../../../lib/youtube/types';

type Section = { key: string; track: EnrichedTrack; data: TapeMark[] };

/**
 * Every place marked in every tape, a tape at a time: the one marked last at
 * the top, its marks in the order they come in it. A mark pressed plays its
 * tape from there, the rest of its record after it; held, its note is written
 * again; its cross takes it away. A tape no longer in the library is not
 * shown, though its marks are kept for when it comes back.
 */
export default function MarksScreen() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const said = t.player.marks;
  const marks = useAllMarks();
  const library = useLibraryTracks();
  const { current, playWhenReady } = usePlayerState();
  const { playQueue, seekTo, toggle } = usePlayerActions();
  const [editing, setEditing] = useState<TapeMark | null>(null);
  /*
    Held, a mark's note is asked for as the finger comes up rather than while
    it is still down: the box opened under a finger that then lifted, and the
    lifting went to the window the box replaced, so the first press in the
    box, its Save, was taken as the end of that touch and did nothing.
  */
  const held = useRef<TapeMark | null>(null);

  // Opened before any screen has read the library: read it now.
  useEffect(() => {
    if (libraryState().kind !== 'library') void refreshLibrary();
  }, []);

  const tapes = useMemo(() => library.filter((track) => isTape(track)), [library]);
  const sections = useMemo((): Section[] => {
    const byId = new Map(tapes.map((track) => [track.id, track]));
    const grouped = new Map<string, TapeMark[]>();
    // Latest made first, so the first tape met is the one marked last.
    for (const mark of marks) {
      if (!byId.has(mark.trackId)) continue;
      grouped.set(mark.trackId, [...(grouped.get(mark.trackId) ?? []), mark]);
    }
    return [...grouped].map(([id, list]) => ({
      key: id,
      track: byId.get(id)!,
      data: list.sort((a, b) => a.positionSec - b.positionSec),
    }));
  }, [marks, tapes]);

  const play = async (track: EnrichedTrack, seconds: number) => {
    haptic('player', 'tick');
    if (current?.id !== track.id) {
      const { tracks, index } = partsOf(track, tapes);
      await playQueue(tracks, index);
    }
    await seekTo(seconds);
    // Gone to is to be heard: the tape playing but paused is played from the mark.
    if (current?.id === track.id && !playWhenReady) await toggle();
  };

  return (
    <View style={styles.screen}>
      <SectionList
        removeClippedSubviews={CLIP_SUBVIEWS}
        windowSize={LIST_WINDOW}
        sections={sections}
        keyExtractor={(mark) => String(mark.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        ListEmptyComponent={<Text style={styles.empty}>{said.noneAnywhere}</Text>}
        renderSectionHeader={({ section }) => <TapeHeading track={section.track} count={section.data.length} />}
        renderItem={({ item, section }) => (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityHint={said.playHint}
            accessibilityActions={[{ name: 'longpress', label: said.editNote }]}
            onAccessibilityAction={() => setEditing(item)}
            style={styles.row}
            onPress={() => void play(section.track, item.positionSec)}
            onLongPress={() => {
              held.current = item;
            }}
            onPressOut={() => {
              if (held.current) setEditing(held.current);
              held.current = null;
            }}>
            <Text style={styles.time}>{durationLabel(item.positionSec)}</Text>
            <View style={styles.rowText}>
              <Text style={[styles.note, !item.note && styles.noteNone]} numberOfLines={4}>{item.note ?? said.noNote}</Text>
              <Text style={styles.when}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityLabel={said.remove(durationLabel(item.positionSec))}
              hitSlop={8}
              style={styles.remove}
              onPress={() => {
                haptic('choices', 'toggleOff');
                removeMark(item.id);
              }}>
              <CrossIcon size={14} color={c.textMuted} />
            </Pressable>
          </Pressable>
        )}
        ListFooterComponent={sections.length > 0 ? <Text style={styles.hint}>{said.howTo}</Text> : null}
      />
      <TextPrompt
        visible={editing != null}
        heading={editing ? said.noteAt(durationLabel(editing.positionSec)) : ''}
        placeholder={said.notePlaceholder}
        initial={editing?.note ?? ''}
        optional
        onSubmit={(note) => {
          if (editing) setMarkNote(editing.id, note);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

/** A tape over its marks: its picture, its name and whose it is. */
function TapeHeading({ track, count }: { track: EnrichedTrack; count: number }) {
  const t = useT();
  const styles = useStyles();
  const artwork = useTrackArtwork(track);
  return (
    <View style={styles.heading} accessibilityRole="header">
      {artwork ? <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" /> : <View style={[styles.art, styles.artEmpty]} />}
      <View style={styles.headingText}>
        <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[track.artist, t.player.marks.count(count)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { paddingVertical: 8 },
  empty: { color: c.textMuted, fontSize: 14, lineHeight: 20, padding: 24, textAlign: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  art: { width: 44, height: 44, borderRadius: 6 },
  artEmpty: { backgroundColor: c.surface },
  headingText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: 15.5, fontWeight: '600' },
  subtitle: { color: c.textMuted, fontSize: 12.5 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 72, paddingRight: 12, paddingVertical: 10 },
  time: { color: c.accent, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 52, paddingTop: 1 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  note: { color: c.text, fontSize: 14.5, lineHeight: 20 },
  noteNone: { color: c.textFaint },
  when: { color: c.textFaint, fontSize: 11.5 },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingTop: 16 },
}));
