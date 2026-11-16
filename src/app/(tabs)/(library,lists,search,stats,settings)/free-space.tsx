import { useCallback, useState } from 'react';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NumberStepper } from '../../../components/NumberStepper';
import { Pressable } from '../../../components/Pressable';
import { useRows } from '../../../components/settings/rows';
import { Switch } from '../../../components/Switch';
import { footGlass, useLaidOver, useUnderBars } from '../../../components/UnderBars';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { useT } from '../../../lib/i18n/index';
import { mergeSongs } from '../../../lib/identity/index';
import { chooseKeep } from '../../../lib/library/copies';
import { useCopies } from '../../../lib/library/copiesStore';
import { useLibrary } from '../../../lib/library/useLibrary';
import type { EnrichedTrack } from '../../../lib/media/enriched';
import { libraryRoot } from '../../../lib/media/library';
import { autoDelete, setAutoDelete, type AutoDelete } from '../../../lib/space/auto';
import {
  AUTO_MONTHS_RANGE,
  bytesFreed,
  freeUpCandidates,
  LONG_AGO_MONTHS,
  type Candidate,
  type CopyGroup,
  type Group,
  type Listening,
  type Reason,
} from '../../../lib/space/candidates';
import { readListening, readLists, type ListsOf } from '../../../lib/space/read';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles, outlined, outlinedClip, outlineWidth, scene, switchColours, useColours, usePressed } from '../../../lib/theme/index';
import { useBack } from '../../../lib/ui/back';
import { haptic } from '../../../lib/ui/haptics';
import { CLIP_SUBVIEWS } from '../../../lib/ui/lists';

const NO_TRACKS: EnrichedTrack[] = [];

/** The history, or none where it cannot be read: the songs are then offered for their size and copies alone. */
function listeningNow(): Map<string, Listening> {
  try {
    return readListening();
  } catch {
    return new Map();
  }
}

/** The lists each song is in, or none where they cannot be read. */
function listsNow(): Map<string, ListsOf> {
  try {
    return readLists();
  } catch {
    return new Map();
  }
}

/** The deleting by itself as it is set, or off where the settings cannot be read. */
function autoNow(): AutoDelete {
  try {
    return autoDelete();
  } catch {
    return { on: false, months: LONG_AGO_MONTHS, favorites: false, lists: false };
  }
}

function rootNow(): string {
  try {
    return libraryRoot().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Whether a file sits in the library folder or below it. */
function inside(folder: string | null, root: string): boolean {
  const at = (folder ?? '').replace(/\/+$/, '');
  return at === root || at.startsWith(`${root}/`);
}

/**
 * Moves the history of each copy that is going to the copy kept, and says
 * which copies it was moved off, as the Copies screen does: only those may be
 * deleted, so a copy whose listens could not be moved stays with them.
 */
function moveHistories(chosen: readonly Candidate[]): string[] {
  const leaving: string[] = [];
  for (const candidate of chosen) {
    if (candidate.reason !== 'copy' || candidate.keep == null) {
      leaving.push(candidate.id);
      continue;
    }
    try {
      mergeSongs(candidate.id, candidate.keep);
      leaving.push(candidate.id);
    } catch (error) {
      console.warn('The history of a copy could not be moved to the copy kept', error);
    }
  }
  return leaving;
}

/**
 * The songs that could go to make room, in groups, for ticking and deleting;
 * and under them the switch for songs the app downloaded to go by themselves.
 *
 * Which songs and why is in `space/candidates.ts`. Deleting is Android's,
 * which asks once for however many files; a copy's listens go to the copy
 * kept before it is deleted, as on the Copies screen. Tapes are never here:
 * podcasts have a cleaning up of their own on the tapes' settings.
 */
export default function FreeSpaceScreen() {
  const t = useT();
  const said = t.space;
  const c = useColours();
  const styles = useStyles();
  const rows = useRows();
  const pressed = usePressed();
  // Sideways the cutout sits beside the screen, and a routed screen gets no horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  // In a theme of glass the screen's bar is over the top of the list, and the bar of what is ticked over its foot.
  const under = useUnderBars();
  const foot = useLaidOver();
  const library = useLibrary();
  const tracks = library.kind === 'library' ? library.tracks : NO_TRACKS;
  const copyGroups = useCopies();
  const { erase } = useTrackMenu();

  const [listening, setListening] = useState(() => listeningNow());
  const [lists, setLists] = useState(() => listsNow());
  const [root, setRoot] = useState(() => rootNow());
  const [auto, setAuto] = useState(() => autoNow());
  /** The groups opened to show their songs. All closed at first, so the foot of the screen is in reach. */
  const [open, setOpen] = useState<ReadonlySet<Reason>>(new Set());
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; bad: boolean } | null>(null);
  // Back takes back what is ticked before it leaves.
  const focused = useIsFocused();
  useBack(chosen.size > 0 && focused, () => setChosen(new Set()));

  const load = useCallback(() => {
    setListening(listeningNow());
    setLists(listsNow());
    setRoot(rootNow());
    setAuto(autoNow());
  }, []);
  useFocusEffect(load);

  const songs = tracks.filter((track) => !isTape(track));
  const byId = new Map(songs.map((track) => [track.id, track]));
  // Which copy of each song stays, as the Copies screen suggests it.
  const copies: CopyGroup[] = copyGroups.map((group) => ({
    ids: group.map((track) => track.id),
    keep: chooseKeep(
      group.map((track) => ({
        id: track.id,
        listens: listening.get(track.id)?.plays ?? 0,
        described: track.enriched,
        cover: track.artworkUri != null,
        inLibrary: inside(track.folder, root),
        durationSec: track.durationSec,
        size: track.size ?? null,
        addedAt: track.addedAt,
      }))
    ).keep,
  }));
  const groups = freeUpCandidates(songs, listening, copies, Date.now());
  const ticked = groups.flatMap((group) => group.candidates).filter((candidate) => chosen.has(candidate.id));
  const tickedBytes = bytesFreed(groups, chosen);

  /** A size as the screen says it: in gigabytes from one up, in megabytes below. */
  const size = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? said.gigabytes(mb / 1024) : said.megabytes(mb);
  };

  const toggle = (id: string) => {
    haptic('choices', chosen.has(id) ? 'toggleOff' : 'toggleOn');
    setChosen((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: Group) => {
    const all = group.candidates.every((candidate) => chosen.has(candidate.id));
    haptic('choices', all ? 'toggleOff' : 'toggleOn');
    setChosen((before) => {
      const next = new Set(before);
      for (const candidate of group.candidates) {
        if (all) next.delete(candidate.id);
        else next.add(candidate.id);
      }
      return next;
    });
  };

  const remove = async () => {
    if (ticked.length === 0 || busy) return;
    setResult(null);
    // The history first: deleting first would take each copy's listens and tags with it.
    const leaving = moveHistories(ticked);
    const freed = bytesFreed(groups, new Set(leaving));
    setBusy(true);
    // One request for all of them, so Android asks once.
    const gone = leaving.length > 0 && (await erase(leaving).catch(() => false));
    setBusy(false);
    if (gone) {
      haptic('results', 'confirm');
      setChosen(new Set());
      setResult({ text: said.freed(leaving.length, size(freed)), bad: false });
    } else {
      setResult({ text: said.notDeleted, bad: true });
    }
    load();
  };

  const change = (next: Partial<AutoDelete>) => {
    setAutoDelete(next);
    setAuto((before) => ({ ...before, ...next }));
  };

  /** Why a song is here, in words. */
  const why = (candidate: Candidate): string => {
    const heard = candidate.listening;
    if (candidate.reason === 'copy') return said.why.copy;
    if (candidate.reason === 'skipped') return said.why.skipped(heard.skips, heard.completed, Math.round(heard.skippedAfter ?? 0));
    if (candidate.reason === 'neverPlayed' && candidate.addedAt != null) return said.why.neverPlayed(candidate.addedAt);
    if (candidate.reason === 'forgotten' && heard.lastPlayedAt != null) return said.why.forgotten(heard.lastPlayedAt);
    return said.why.large;
  };

  /** The lists a song is in, Favorites first under its own name; null for none. */
  const listsLine = (id: string): string | null => {
    const held = lists.get(id);
    if (!held) return null;
    const names = [...(held.favorite ? [t.lists.favorites.name] : []), ...held.names];
    return names.length > 0 ? said.inLists(names.join(said.listSeparator)) : null;
  };

  const sections = groups.map((group) => ({
    key: group.reason,
    group,
    data: open.has(group.reason) ? group.candidates : [],
  }));

  return (
    <View style={[styles.screen, sides]}>
      <SectionList
        removeClippedSubviews={CLIP_SUBVIEWS}
        sections={sections}
        keyExtractor={(candidate) => candidate.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16 + under.top, paddingBottom: 32 + (chosen.size > 0 ? foot.height : insets.bottom) },
        ]}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>{said.note}</Text>
            {/* The deleting by itself first, its details shown faded while it is off, so what it would do is there to read. */}
            <Text accessibilityRole="header" style={rows.section}>{t.format.upper(said.auto.heading)}</Text>
            <View style={rows.card}>
              <View style={rows.row}>
                <View style={rows.line}>
                  <Text style={rows.title}>{said.auto.title}</Text>
                  <Switch
                    value={auto.on}
                    accessibilityLabel={said.auto.title}
                    onValueChange={(on) => change({ on })}
                    {...switchColours(c, auto.on)}
                  />
                </View>
                <Text style={rows.muted}>{auto.on ? said.auto.after(auto.months) : said.auto.off}</Text>
              </View>
              <View style={[!auto.on && styles.faded]} pointerEvents={auto.on ? 'auto' : 'none'}>
                <View style={rows.rule} />
                <View style={rows.row}>
                  <View style={rows.line}>
                    <Text style={rows.title}>{said.auto.months}</Text>
                    <NumberStepper
                      name={said.auto.months}
                      range={AUTO_MONTHS_RANGE}
                      value={auto.months}
                      label={said.auto.monthCount}
                      disabled={!auto.on}
                      onChange={(months) => change({ months })}
                    />
                  </View>
                </View>
                <View style={rows.rule} />
                <View style={rows.row}>
                  <View style={rows.line}>
                    <Text style={rows.title}>{said.auto.favorites}</Text>
                    <Switch
                      value={auto.favorites}
                      disabled={!auto.on}
                      accessibilityLabel={said.auto.favorites}
                      onValueChange={(favorites) => change({ favorites })}
                      {...switchColours(c, auto.favorites)}
                    />
                  </View>
                </View>
                <View style={rows.rule} />
                <View style={rows.row}>
                  <View style={rows.line}>
                    <Text style={rows.title}>{said.auto.lists}</Text>
                    <Switch
                      value={auto.lists}
                      disabled={!auto.on}
                      accessibilityLabel={said.auto.lists}
                      onValueChange={(on) => change({ lists: on })}
                      {...switchColours(c, auto.lists)}
                    />
                  </View>
                </View>
              </View>
            </View>
            {result ? (
              <Text
                accessibilityRole={result.bad ? 'alert' : undefined}
                accessibilityLiveRegion="polite"
                style={result.bad ? styles.trouble : styles.result}>
                {result.text}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          library.kind === 'loading' ? (
            <ActivityIndicator style={styles.loading} color={c.textMuted} />
          ) : (
            <Text style={styles.empty}>{said.empty}</Text>
          )
        }
        renderSectionHeader={({ section }) => {
          const { group } = section;
          const shown = open.has(group.reason);
          const all = group.candidates.every((candidate) => chosen.has(candidate.id));
          const some = !all && group.candidates.some((candidate) => chosen.has(candidate.id));
          const name = said.groups[group.reason];
          return (
            <View style={[styles.heading, shown && styles.headingOpen]}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityState={{ expanded: shown }}
                accessibilityHint={said.showHint}
                style={styles.headingText}
                onPress={() =>
                  setOpen((before) => {
                    const next = new Set(before);
                    if (next.has(group.reason)) next.delete(group.reason);
                    else next.add(group.reason);
                    return next;
                  })
                }>
                <Text style={styles.headingTitle}>{name}</Text>
                <Text style={styles.headingSize}>{said.groupSize(group.candidates.length, size(group.bytes))}</Text>
              </Pressable>
              <Text style={styles.chevron} importantForAccessibility="no">{shown ? '⌄' : '›'}</Text>
              {/* Every song in the group at once, with a dash where only some of it is ticked. */}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: all ? true : some ? 'mixed' : false }}
                accessibilityLabel={said.tickGroup(name)}
                style={styles.tick}
                onPress={() => toggleGroup(group)}>
                <View style={[styles.checkbox, (all || some) && styles.checkboxOn]}>
                  {all || some ? (
                    <Text style={styles.checkMark} importantForAccessibility="no">{all ? '✓' : '–'}</Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        }}
        renderSectionFooter={() => <View style={styles.groupEnd} />}
        renderItem={({ item, index, section }) => {
          const track = byId.get(item.id);
          const on = chosen.has(item.id);
          const inLists = listsLine(item.id);
          const last = index === section.data.length - 1;
          return (
            <Pressable
              android_ripple={pressed}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.row, last && styles.rowLast, on && styles.rowChosen]}
              onPress={() => toggle(item.id)}>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>
                {on ? <Text style={styles.checkMark} importantForAccessibility="no">✓</Text> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={2}>
                  {track?.title ?? item.id}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {item.bytes > 0
                    ? `${track?.artist ?? t.common.unknownArtist} · ${size(item.bytes)}`
                    : track?.artist ?? t.common.unknownArtist}
                </Text>
                <Text style={styles.why}>{why(item)}</Text>
                {inLists ? <Text style={styles.lists} numberOfLines={2}>{inLists}</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />
      {/* Under the list while anything is ticked. Android asks before anything goes, with the files' names. */}
      {chosen.size > 0 ? (
        <View
          style={[
            styles.bar,
            { paddingBottom: insets.bottom + 12 },
            foot.laid && [styles.barOver, { left: insets.left, right: insets.right }],
          ]}
          onLayout={foot.onLayout}>
          <View style={styles.actions}>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.button}
              onPress={() => setChosen(new Set())}>
              <Text style={styles.buttonLabel} numberOfLines={1}>{t.common.clear}</Text>
            </Pressable>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || ticked.length === 0 }}
              disabled={busy || ticked.length === 0}
              style={[styles.button, styles.dangerButton, styles.deleteButton]}
              onPress={() => void remove()}>
              {busy ? (
                <ActivityIndicator color={c.danger} />
              ) : (
                <Text style={[styles.buttonLabel, styles.dangerLabel]} numberOfLines={2}>
                  {said.delete(ticked.length, size(tickedBytes))}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { paddingHorizontal: 16 },
  note: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  result: { color: c.success, fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  trouble: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  loading: { paddingVertical: 32 },

  /*
    A group is a card: its heading the top of it, and its songs, while it is
    open, the rest, the last of them taking the card's lower corners.
  */
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    overflow: 'hidden',
    ...outlinedClip(c),
  },
  headingOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  headingText: { flex: 1, paddingLeft: 16, paddingVertical: 14, gap: 2 },
  headingTitle: { color: c.text, fontSize: 15.5, fontWeight: '600' },
  headingSize: { color: c.textMuted, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22, paddingHorizontal: 6 },
  groupEnd: { height: 12 },
  // A finger's size, round the box.
  tick: { width: 52, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 14, fontWeight: '700', lineHeight: 16 },

  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.surface,
    // The card's outline down either side, where the theme draws one, and a rule between each song.
    borderLeftWidth: outlineWidth(c),
    borderRightWidth: outlineWidth(c),
    borderColor: c.outline,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderBottomWidth: outlineWidth(c) },
  rowChosen: { backgroundColor: c.accentSoft },
  rowText: { flex: 1, gap: 2 },
  name: { color: c.text, fontSize: 15.5 },
  artist: { color: c.textSecondary, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  why: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  lists: { color: c.accent, fontSize: 12.5, lineHeight: 18 },

  faded: { opacity: 0.45 },

  bar: {
    paddingTop: 12,
    paddingHorizontal: 4,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  // Over the foot of the list in a theme of glass, which runs on under it.
  barOver: footGlass(c),
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
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
  deleteButton: { flex: 2 },
  dangerButton: { backgroundColor: c.dangerSoft, ...outlined(c, c.danger) },
  buttonLabel: { color: c.text, fontSize: 14.5, textAlign: 'center' },
  dangerLabel: { color: c.danger, fontWeight: '600' },
}));
