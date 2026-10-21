import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '../components/Pressable';
import { useUnderBars } from '../components/UnderBars';
import { useTrackMenu } from '../components/useTrackMenu';
import { playCounts } from '../lib/db/history';
import { useT } from '../lib/i18n/index';
import { mergeSongs } from '../lib/identity/index';
import { chooseKeep, type KeepReason, type Weighed } from '../lib/library/copies';
import { markNotCopies, useCopies } from '../lib/library/copiesStore';
import { libraryRoot } from '../lib/media/library';
import type { EnrichedTrack } from '../lib/media/enriched';
import { makeStyles, outlined, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

/** What a song's copies are known by on this screen: the ids of all of them, in the order found. */
const keyOf = (group: readonly EnrichedTrack[]) => group.map((track) => track.id).join(',');

/** Where the file is: its folder and its name, as much as the media store says. */
const whereabouts = (track: EnrichedTrack) => `${track.folder ?? ''}${track.filename ?? ''}`;

function clock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Whether a file sits in the library folder or below it. */
function inside(folder: string | null, root: string): boolean {
  const at = (folder ?? '').replace(/\/+$/, '');
  return at === root || at.startsWith(`${root}/`);
}

/** How many times each track has been listened to. None where the history cannot be read: the suggestion is only that. */
function readListens(): Map<string, number> {
  try {
    return new Map([...playCounts()].map(([id, counts]) => [id, counts.plays]));
  } catch {
    return new Map();
  }
}

function readRoot(): string {
  try {
    return libraryRoot().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * Moves the history of every copy that is going to the copy kept, and says
 * which copies it was moved off.
 *
 * Only those may be erased: a copy whose listens could not be moved is left
 * on the phone with them, rather than taking them with it. Each move is all
 * or nothing, so one that fails has changed nothing and the rest still go.
 */
function moveHistories(
  groups: readonly (readonly EnrichedTrack[])[],
  keepOf: (group: readonly EnrichedTrack[]) => string
): { leaving: string[]; failed: string | null } {
  const leaving: string[] = [];
  let failed: string | null = null;
  for (const group of groups) {
    const keep = keepOf(group);
    for (const copy of group) {
      if (copy.id === keep) continue;
      try {
        mergeSongs(copy.id, keep);
        leaving.push(copy.id);
      } catch (error) {
        failed ??= String(error);
      }
    }
  }
  return { leaving, failed };
}

/** Writes down that a group's files are different songs; what went wrong if it could not. */
function sayDifferent(ids: string[]): string | null {
  try {
    markNotCopies(ids);
    return null;
  } catch (error) {
    return String(error);
  }
}

/**
 * The songs the library holds more than once, for choosing which copy of
 * each to keep and deleting the rest.
 *
 * Every copy's history goes to the one kept before anything is deleted, so
 * the copy that goes takes nothing with it but the file. The deleting is
 * Android's, which asks first and once for however many files: a refusal
 * leaves every file where it was, with the history already together.
 *
 * Not the Same song? screen, and not in its way. That one asks about a file
 * that may have replaced another, and moves a history; merging a pair there
 * whose two files are both still here does not delete either, so the pair
 * is still listed here as a song with two copies.
 */
export default function DuplicatesScreen() {
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  // In a theme of glass the screen's bar is over the top of the list, which runs on under it.
  const under = useUnderBars();
  const t = useT();
  const said = t.library.copies;
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  /*
    Worked out from the library and kept with it, so the list is read again
    by itself when files are deleted: Android's yes makes the library look
    at the device again, and the songs no longer twice drop out.
  */
  const groups = useCopies();
  const { erase } = useTrackMenu();
  const [listens, setListens] = useState<Map<string, number>>(() => readListens());
  const [root, setRoot] = useState(() => readRoot());
  /** The copy chosen by hand for a song, by `keyOf`, where it is not the one suggested. */
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());
  /** Whether the cleaning up of every song is waiting for a yes. */
  const [asking, setAsking] = useState(false);
  /** While Android is asking, so that nothing is asked twice. */
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const load = useCallback(() => {
    setListens(readListens());
    setRoot(readRoot());
  }, []);
  useFocusEffect(load);

  const weigh = (track: EnrichedTrack): Weighed => ({
    id: track.id,
    listens: listens.get(track.id) ?? 0,
    described: track.enriched,
    cover: track.artworkUri != null,
    inLibrary: inside(track.folder, root),
    durationSec: track.durationSec,
    size: track.size ?? null,
    addedAt: track.addedAt,
  });

  /** Which copy of a song is kept, and why: the user's choice, or else the suggestion. */
  const decide = (group: readonly EnrichedTrack[]): { keep: string; reason: KeepReason | null } => {
    const suggestion = chooseKeep(group.map(weigh));
    const chosen = picked.get(keyOf(group));
    if (chosen != null && chosen !== suggestion.keep && group.some((track) => track.id === chosen)) {
      return { keep: chosen, reason: null };
    }
    return suggestion;
  };

  const clean = async (chosen: readonly (readonly EnrichedTrack[])[]) => {
    setAsking(false);
    setTrouble(null);
    setResult(null);
    // The history first: erasing first would take each copy's listens and tags with it.
    const { leaving, failed } = moveHistories(chosen, (group) => decide(group).keep);
    if (failed) setTrouble(said.failed(failed));
    if (leaving.length > 0) {
      setBusy(true);
      // One request for all of them, so Android asks once.
      const gone = await erase(leaving).catch(() => false);
      setBusy(false);
      setResult(gone ? said.deleted(leaving.length) : said.notDeleted);
    }
    load();
  };

  const different = (group: readonly EnrichedTrack[]) => {
    setAsking(false);
    setResult(null);
    const failed = sayDifferent(group.map((track) => track.id));
    setTrouble(failed ? said.failed(failed) : null);
  };

  const going = groups.reduce((sum, group) => sum + group.length - 1, 0);

  return (
    <View style={[styles.screen, sides]}>
      <FlatList
              removeClippedSubviews={CLIP_SUBVIEWS}
        data={groups}
        keyExtractor={keyOf}
        contentContainerStyle={[styles.content, { paddingTop: 16 + under.top, paddingBottom: 32 + insets.bottom }]}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>{said.note}</Text>
            {groups.length > 1 && !asking ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                style={[styles.button, styles.dangerButton, styles.cleanAll]}
                onPress={() => {
                  setResult(null);
                  setAsking(true);
                }}>
                <Text style={[styles.buttonLabel, styles.dangerLabel]}>{said.cleanAll(groups.length)}</Text>
              </Pressable>
            ) : null}
            {/*
              Asked here and not in a dialog of the app's own: the screen
              already shows what goes and what stays, and Android puts up
              its own question after this one, with the files' names in it.
            */}
            {asking ? (
              <View style={styles.ask}>
                <Text style={styles.askText} accessibilityLiveRegion="polite">
                  {said.confirmAll(going, groups.length)}
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    android_ripple={pressed}
                    accessibilityRole="button"
                    style={styles.button}
                    onPress={() => setAsking(false)}>
                    <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
                  </Pressable>
                  <Pressable
                    android_ripple={pressed}
                    accessibilityRole="button"
                    style={[styles.button, styles.dangerButton]}
                    onPress={() => void clean(groups)}>
                    <Text style={[styles.buttonLabel, styles.dangerLabel]} numberOfLines={1}>
                      {said.confirm(going)}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
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
        renderItem={({ item: group }) => {
          const { keep, reason } = decide(group);
          return (
            <View style={styles.card}>
              {/* One choice among the copies: whichever is ticked stays, and the rest go. */}
              <View accessibilityRole="radiogroup" accessibilityLabel={said.choose}>
                {group.map((track, index) => {
                  const kept = track.id === keep;
                  const where = whereabouts(track);
                  return (
                    <View key={track.id}>
                      {index > 0 ? <View style={styles.rule} /> : null}
                      <Pressable
                        android_ripple={pressed}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: kept }}
                        accessibilityLabel={`${track.title}, ${track.artist ?? t.common.unknownArtist}, ${where}`}
                        accessibilityHint={said.keepHint}
                        style={[styles.copy, kept && styles.copyKept]}
                        onPress={() => {
                          setAsking(false);
                          setPicked((before) => new Map(before).set(keyOf(group), track.id));
                        }}>
                        <View style={[styles.radio, kept && { borderColor: c.accent }]}>
                          {kept ? <View style={styles.radioDot} /> : null}
                        </View>
                        <View style={styles.copyText}>
                          <Text style={[styles.caption, kept ? styles.captionKept : styles.captionGoes]}>
                            {t.format.upper(kept ? said.keeps : said.goes)}
                          </Text>
                          <Text style={styles.name} numberOfLines={2}>
                            {track.title}
                          </Text>
                          <Text style={styles.artist} numberOfLines={1}>
                            {track.artist ?? t.common.unknownArtist}
                          </Text>
                          <Text style={styles.path} numberOfLines={2}>
                            {where}
                          </Text>
                          <Text style={styles.holds}>
                            {`${clock(track.durationSec)} · ${said.holds({
                              listens: listens.get(track.id) ?? 0,
                              described: track.enriched,
                              cover: track.artworkUri != null,
                              outside: !inside(track.folder, root),
                            })}`}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <View style={styles.rule} />
              <Text style={styles.why}>{reason ? said.why[reason] : said.yourChoice}</Text>
              <View style={styles.actions}>
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  style={styles.button}
                  onPress={() => different(group)}>
                  <Text style={styles.buttonLabel} numberOfLines={2}>
                    {said.different}
                  </Text>
                </Pressable>
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  accessibilityHint={t.details.same.bulk.deleteNote}
                  disabled={busy}
                  style={[styles.button, styles.dangerButton]}
                  onPress={() => void clean([group])}>
                  <Text style={[styles.buttonLabel, styles.dangerLabel]} numberOfLines={2}>
                    {said.deleteOthers(group.length - 1)}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { padding: 16, gap: 14 },
  note: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  result: { color: c.success, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  trouble: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  cleanAll: { alignSelf: 'flex-start', flex: 0, marginTop: 12 },
  ask: { marginTop: 12, backgroundColor: c.surface, borderRadius: 14, paddingTop: 14, ...outlined(c) },
  askText: { color: c.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 14 },

  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  copy: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  copyKept: { backgroundColor: c.accentSoft },
  copyText: { flex: 1, gap: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 2 },
  captionKept: { color: c.accent },
  captionGoes: { color: c.textFaint },
  name: { color: c.text, fontSize: 15.5 },
  artist: { color: c.textSecondary, fontSize: 13.5 },
  path: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  holds: { color: c.textSecondary, fontSize: 12.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  why: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 16, paddingTop: 10 },

  actions: { flexDirection: 'row', gap: 10, padding: 12 },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...outlined(c),
  },
  dangerButton: { backgroundColor: c.dangerSoft, ...outlined(c, c.danger) },
  buttonLabel: { color: c.text, fontSize: 14.5, textAlign: 'center' },
  dangerLabel: { color: c.danger, fontWeight: '600' },
}));
