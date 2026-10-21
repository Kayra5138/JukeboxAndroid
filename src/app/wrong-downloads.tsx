import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '../components/Pressable';
import { useUnderBars } from '../components/UnderBars';
import { useTrackMenu } from '../components/useTrackMenu';
import { playCounts } from '../lib/db/history';
import { readMetadata, saveMetadata } from '../lib/db/metadata';
import { tagsFor } from '../lib/db/tags';
import { nameOfVideo, type Mistake } from '../lib/discover/verify';
import { useT } from '../lib/i18n/index';
import { refreshLibrary } from '../lib/library/index';
import { markRight, useWrongDownloads } from '../lib/library/wrongDownloadsStore';
import { artworkChanged } from '../lib/media/artworkEvents';
import type { EnrichedTrack } from '../lib/media/enriched';
import { scanLibrary } from '../lib/media/library';
import { fieldsOf, manualEntry } from '../lib/metadata/edit';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { makeStyles, outlined, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
import { durationLabel } from '../lib/youtube/types';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

type Name = { title: string; artist: string };

/** How many times each track has been listened to. None where the history cannot be read: it is only shown. */
function readListens(): Map<string, number> {
  try {
    return new Map([...playCounts()].map(([id, counts]) => [id, counts.plays]));
  } catch {
    return new Map();
  }
}

/**
 * Gives a track the name typed for it, as an edit of the user's own: the
 * same row the details screen's Save writes, so that no lookup writes over
 * it, with every other field what the track already showed. Read off the
 * file as it is, which is what an edit is made against. Answers what went
 * wrong, or null.
 */
async function rename(trackId: string, name: Name): Promise<string | null> {
  try {
    const track = (await scanLibrary()).find((file) => file.id === trackId);
    if (!track) return null;
    const kept = readMetadata(trackId);
    const fields = { ...fieldsOf(track, kept), title: name.title, artist: name.artist };
    saveMetadata(manualEntry(track, kept, fields, tagsFor(trackId)[0]?.tag ?? null));
    // Under another artist it may be on another record, with another cover.
    artworkChanged();
    void refreshLibrary();
    return null;
  } catch (error) {
    return String(error);
  }
}

/** Writes down that a file is right as it is; what went wrong if it could not. */
function sayRight(mistake: Mistake<EnrichedTrack>): string | null {
  try {
    markRight(mistake.track.id, mistake.job.video.id);
    return null;
  } catch (error) {
    return String(error);
  }
}

/**
 * The downloads in the library that may be another song than the one they
 * are filed as: see `discover/verify.ts` for which, and why there are any.
 *
 * Each is shown as what it is filed as against what its video was called,
 * and nothing is done to any of them until somebody says what: give it the
 * video's name, as an edit they can look over first; delete it, the way it
 * is deleted anywhere else, with Android asking; or say it is right, which
 * is remembered. A file renamed, deleted or said to be right drops out of
 * the list by itself, since the list is worked out from the library.
 *
 * Pressing the names plays the file, which is how anybody finds out.
 */
export default function WrongDownloadsScreen() {
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  const under = useUnderBars();
  const t = useT();
  const said = t.library.wrong;
  const styles = useStyles();
  const pressed = usePressed();
  const mistakes = useWrongDownloads();
  const { erase } = useTrackMenu();
  const { playQueue } = usePlayerActions();
  const [listens, setListens] = useState<Map<string, number>>(() => readListens());
  /** The file being named, and the name proposed for it. */
  const [naming, setNaming] = useState<{ mistake: Mistake<EnrichedTrack>; name: Name } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  useFocusEffect(useCallback(() => setListens(readListens()), []));

  const say = (done: string | null, failed: string | null) => {
    setResult(failed ? null : done);
    setTrouble(failed ? said.failed(failed) : null);
  };

  const remove = async (mistake: Mistake<EnrichedTrack>) => {
    setBusy(true);
    const gone = await erase([mistake.track.id]).catch(() => false);
    setBusy(false);
    say(gone ? said.deleted : said.notDeleted, null);
  };

  const save = async (name: Name) => {
    const target = naming;
    setNaming(null);
    if (!target) return;
    setBusy(true);
    const failed = await rename(target.mistake.track.id, name);
    setBusy(false);
    say(said.renamed(name.title), failed);
  };

  return (
    <View style={[styles.screen, sides]}>
      <FlatList
        removeClippedSubviews={CLIP_SUBVIEWS}
        data={mistakes}
        keyExtractor={(mistake) => mistake.track.id}
        contentContainerStyle={[styles.content, { paddingTop: 16 + under.top, paddingBottom: 32 + insets.bottom }]}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>{said.note}</Text>
            {result ? (
              <Text accessibilityLiveRegion="polite" style={styles.result}>
                {result}
              </Text>
            ) : null}
            {trouble ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.trouble}>
                {trouble}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>{said.empty}</Text>}
        renderItem={({ item: mistake }) => {
          const { track, job } = mistake;
          const artist = track.artist ?? t.common.unknownArtist;
          return (
            <View style={styles.card}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={`${said.filedAs}: ${track.title}, ${artist}. ${said.videoWas}: ${job.video.title}, ${job.video.channel}`}
                accessibilityHint={said.playHint}
                style={styles.names}
                onPress={() => void playQueue([track], 0)}>
                <Text style={styles.caption}>{t.format.upper(said.filedAs)}</Text>
                <Text style={styles.name} numberOfLines={2}>
                  {track.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {artist}
                </Text>
                <Text style={[styles.caption, styles.second]}>{t.format.upper(said.videoWas)}</Text>
                <Text style={styles.name} numberOfLines={2}>
                  {job.video.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {job.video.channel}
                </Text>
                <Text style={styles.facts}>
                  {said.facts(durationLabel(track.durationSec || job.video.duration), listens.get(track.id) ?? 0)}
                </Text>
              </Pressable>
              <View style={styles.rule} />
              <View style={styles.actions}>
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => {
                    setResult(null);
                    setNaming({ mistake, name: nameOfVideo(job.video, track.artist) });
                  }}>
                  <Text style={[styles.buttonLabel, styles.primaryLabel]} numberOfLines={2}>
                    {said.rename}
                  </Text>
                </Pressable>
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  style={styles.button}
                  onPress={() => say(said.keptRight, sayRight(mistake))}>
                  <Text style={styles.buttonLabel} numberOfLines={2}>
                    {said.right}
                  </Text>
                </Pressable>
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  accessibilityHint={t.details.same.bulk.deleteNote}
                  disabled={busy}
                  style={[styles.button, styles.dangerButton]}
                  onPress={() => void remove(mistake)}>
                  <Text style={[styles.buttonLabel, styles.dangerLabel]} numberOfLines={2}>
                    {said.delete}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <NameSheet
        visible={naming != null}
        proposed={naming?.name ?? null}
        onSave={(name) => void save(name)}
        onClose={() => setNaming(null)}
      />
    </View>
  );
}

/**
 * The name a file is about to be given, to be looked over and changed before
 * it is: what the video's title says is seldom quite what a catalogue would
 * call the song, and the user knows which song it is now that they have
 * heard it.
 */
function NameSheet({
  visible,
  proposed,
  onSave,
  onClose,
}: {
  visible: boolean;
  proposed: Name | null;
  onSave: (name: Name) => void;
  onClose: () => void;
}) {
  const t = useT();
  const said = t.library.wrong;
  const c = useColours();
  const styles = useSheetStyles();
  const pressed = usePressed();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  useWindowVeil(visible);

  // Filled as it opens, so the boxes are right from the first frame and not holding the last file's name.
  useEffect(() => {
    if (!visible || !proposed) return;
    setTitle(proposed.title);
    setArtist(proposed.artist);
  }, [visible, proposed]);

  const ready = title.trim().length > 0;
  const submit = () => {
    if (ready) onSave({ title: title.trim(), artist: artist.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* As in `TextPrompt`: neither the backdrop nor the sheet is a stop for a screen reader. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <Text accessibilityRole="header" style={styles.heading}>
            {said.rename}
          </Text>
          <Text style={styles.hint}>{said.sheetNote}</Text>
          <Text style={styles.label}>{said.titleField}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={c.textFaint}
            accessibilityLabel={said.titleField}
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={styles.label}>{said.artistField}</Text>
          <TextInput
            style={styles.input}
            value={artist}
            onChangeText={setArtist}
            placeholderTextColor={c.textFaint}
            accessibilityLabel={said.artistField}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
              <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              android_ripple={pressed}
              style={[styles.button, styles.confirm, !ready && styles.disabled]}
              disabled={!ready}
              onPress={submit}>
              <Text style={styles.confirmLabel}>{t.common.save}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { padding: 16, gap: 14 },
  note: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  result: { color: c.success, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  trouble: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 10 },

  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  names: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  caption: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 2 },
  second: { marginTop: 10 },
  name: { color: c.text, fontSize: 15.5 },
  artist: { color: c.textSecondary, fontSize: 13.5 },
  facts: { color: c.textMuted, fontSize: 12.5, marginTop: 8, fontVariant: ['tabular-nums'] },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  button: {
    flexGrow: 1,
    flexBasis: 90,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...outlined(c),
  },
  primaryButton: { backgroundColor: c.accentSoft, ...outlined(c, c.accent) },
  primaryLabel: { color: c.accent, fontWeight: '600' },
  dangerButton: { backgroundColor: c.dangerSoft, ...outlined(c, c.danger) },
  buttonLabel: { color: c.text, fontSize: 14.5, textAlign: 'center' },
  dangerLabel: { color: c.danger, fontWeight: '600' },
}));

const useSheetStyles = makeStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: scrimOf(c), alignItems: 'center', justifyContent: 'center', padding: 28 },
  sheet: { backgroundColor: c.surface, borderRadius: 14, padding: 18, gap: 10, alignSelf: 'stretch', ...outlined(c) },
  heading: { color: c.text, fontSize: 15, fontWeight: '600' },
  hint: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  label: { color: c.textSecondary, fontSize: 12.5, marginTop: 4 },
  input: {
    color: c.text,
    fontSize: 15,
    backgroundColor: c.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...outlined(c),
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  button: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  confirm: { backgroundColor: c.primary },
  confirmLabel: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.35 },
}));
