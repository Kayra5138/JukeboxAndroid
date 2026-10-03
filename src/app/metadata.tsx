import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  forgetMetadata,
  metadataSummary,
  readAllMetadata,
  type TrackMetadata,
} from '../lib/db/metadata';
import { SearchField } from '../components/SearchField';
import { useTrackArtwork } from '../lib/media/artwork';
import { enrichLibrary, type EnrichProgress } from '../lib/metadata/enrich';
import { foldForMatch } from '../lib/metadata/text';
import { ensureAudioPermission, scanLibrary } from '../lib/media/library';
import type { Track } from '../lib/types';

type Row = { track: Track; metadata: TrackMetadata | undefined };

/**
 * Matched against what the row shows: the file's own title and artist, and
 * whatever a lookup has since found. Folded, so that on this screen as
 * everywhere else a Turkish dotless `ı` is not a different letter from `i`.
 */
function rowMatches(row: Row, folded: string): boolean {
  return foldForMatch(
    [
      row.track.title,
      row.track.artist,
      row.metadata?.title,
      row.metadata?.artist,
      row.metadata?.album,
      row.metadata?.genre,
    ]
      .filter(Boolean)
      .join(' ')
  ).includes(folded);
}

/** Rows are a fixed height so a finger position can be turned into an index. */
const ROW_HEIGHT = 78;

/** Drags that begin over the checkboxes select; anywhere else scrolls. */
const CHECKBOX_COLUMN = 52;

export default function MetadataScreen() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState(() => metadataSummary());
  const [progress, setProgress] = useState<EnrichProgress | null>(null);
  /** How the last run ended, when that is worth saying. Cleared by the next one. */
  const [outcome, setOutcome] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };

  // Mirrors for the gesture handler, which is created once and would otherwise
  // close over stale state.
  const rowsRef = useRef<Row[]>([]);
  const selectedRef = useRef<Set<string>>(new Set());
  selectedRef.current = selected;

  const wrapperRef = useRef<View>(null);
  const listTop = useRef(0);
  const listLeft = useRef(0);
  const scrollOffset = useRef(0);
  const dragAnchor = useRef<number | null>(null);
  const dragDeselects = useRef(false);
  const selectionBeforeDrag = useRef<Set<string>>(new Set());

  /*
    What the list is actually showing. Everything downstream works from this
    rather than from the full set: the drag-to-select turns a finger position
    into a row index, so it has to count the rows on screen, and a run started
    while a search is narrowing the list should cover what the reader can see.
  */
  const visible = useMemo(() => {
    const folded = foldForMatch(query.trim());
    if (!folded) return rows ?? [];
    return (rows ?? []).filter((row) => rowMatches(row, folded));
  }, [rows, query]);

  rowsRef.current = visible;

  const refresh = useCallback(async () => {
    if (!(await ensureAudioPermission())) return;
    const tracks = await scanLibrary();
    const known = readAllMetadata();
    setRows(tracks.map((track) => ({ track, metadata: known.get(track.id) })));
    setSummary(metadataSummary());
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Re-read on focus so an edit made on the other screen shows up on return.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const indexAtY = useCallback((pageY: number) => {
    const y = pageY - listTop.current + scrollOffset.current;
    const index = Math.floor(y / ROW_HEIGHT);
    return Math.min(Math.max(index, 0), rowsRef.current.length - 1);
  }, []);

  /*
    Measured across the window, like the vertical half above it.

    Not `locationX`: that is relative to whichever view the finger actually
    landed on, which here is the innermost — a checkbox, or a title that begins
    52 points in. Touching the first few characters of a title therefore read as
    a locationX of nearly nothing and started selecting.
  */
  const startsOverCheckboxes = useCallback(
    (pageX: number) => pageX - listLeft.current < CHECKBOX_COLUMN,
    []
  );

  /**
   * One responder for the whole list rather than per-row touch handlers: in
   * React Native the view where a gesture begins keeps the responder, so a row
   * never hears about a finger that started on its neighbour. Position maps to
   * an index instead, which is why the rows are a fixed height.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          startsOverCheckboxes(event.nativeEvent.pageX),
        onMoveShouldSetPanResponder: (event) =>
          startsOverCheckboxes(event.nativeEvent.pageX),
        onPanResponderGrant: (event) => {
          const index = indexAtY(event.nativeEvent.pageY);
          const id = rowsRef.current[index]?.track.id;
          if (!id) return;
          dragAnchor.current = index;
          // Dragging from a selected row clears the run instead, which is what
          // every other list with checkboxes does.
          dragDeselects.current = selectedRef.current.has(id);
          selectionBeforeDrag.current = new Set(selectedRef.current);
          toggle(id);
        },
        onPanResponderMove: (event) => {
          const anchor = dragAnchor.current;
          if (anchor == null) return;
          const current = indexAtY(event.nativeEvent.pageY);
          const [start, end] = anchor <= current ? [anchor, current] : [current, anchor];

          const next = new Set(selectionBeforeDrag.current);
          for (let i = start; i <= end; i += 1) {
            const id = rowsRef.current[i]?.track.id;
            if (!id) continue;
            if (dragDeselects.current) next.delete(id);
            else next.add(id);
          }
          setSelected(next);
        },
        onPanResponderRelease: () => {
          dragAnchor.current = null;
        },
        onPanResponderTerminate: () => {
          dragAnchor.current = null;
        },
      }),
    [indexAtY, startsOverCheckboxes, toggle]
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const run = useCallback(
    async (subset?: Track[]) => {
      /*
        One at a time. Two runs share the module-level clock the rate limiting
        is measured against, so a second one started while the first is still
        going doubles the request rate against both services — and only the
        second is reachable from Stop, because it has overwritten the first's
        controller and left that loop running with nothing to call it off.
      */
      if (abortRef.current) return;
      const tracks = subset ?? rowsRef.current.map((row) => row.track);
      if (tracks.length === 0) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setOutcome(null);
      /*
        Started without a total. Only the enrichment knows how many of these
        have not been tried before, and seeding this with all of them made the
        count read "1 of 5000" until the first real progress arrived and turned
        it into "1 of 37".
      */
      setProgress({ done: 0, total: 0, matched: 0, throttled: false });
      try {
        const result = await enrichLibrary(tracks, setProgress, controller.signal);
        if (result.coversSaved) setOutcome(`${result.coversSaved} album covers saved for offline use.`);
        if (result.stopped === 'offline') {
          setOutcome(
            `Nothing answered, so the run stopped after ${result.matched} matched. Nothing was written for the rest — they are still waiting to be tried.`
          );
        }
      } catch (error) {
        // Enrichment is documented never to reject, but a press handler is the
        // wrong place to find out that changed.
        setOutcome(error instanceof Error ? error.message : 'The lookup stopped unexpectedly.');
      } finally {
        abortRef.current = null;
        setProgress(null);
        setSelected(new Set());
        await refresh();
      }
    },
    [refresh]
  );

  const resetSelected = useCallback(async () => {
    forgetMetadata([...selected]);
    setSelected(new Set());
    await refresh();
  }, [selected, refresh]);

  const lookUpSelected = useCallback(async () => {
    // Checked here as well as in `run`, because forgetting first and then being
    // turned away would throw the results of a previous lookup out for nothing.
    if (abortRef.current) return;
    const chosen = rowsRef.current
      .filter((row) => selected.has(row.track.id))
      .map((row) => row.track);
    // Forget first, so tracks already tried are retried rather than skipped.
    forgetMetadata(chosen.map((track) => track.id));
    await run(chosen);
  }, [selected, run]);

  if (!rows) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#f2f2f2" />
      </View>
    );
  }

  /*
    The summary counts every row in the metadata table, including tracks since
    deleted from the disk or left outside the current root, so it can describe
    more tracks than the library holds. Clamped rather than corrected: the
    figure the reader wants is how many are still to do, and a negative one is
    only ever noise about files that are no longer here.
  */
  const untried = Math.max(
    0,
    rows.length - summary.matched - summary.notFound - summary.manual
  );
  const allSelected = selected.size === visible.length && visible.length > 0;

  return (
    <View style={[styles.screen, sides]}>
      <View style={styles.header}>
        {progress ? (
          <View style={styles.stack}>
            <Text style={styles.body}>
              {progress.offline
                ? 'Nothing answered. Stopping.'
                : progress.throttled
                  ? 'Rate limited, waiting a minute…'
                  : progress.total === 0
                    ? 'Looking up…'
                    : `${progress.phase === 'artwork' ? 'Album covers' : 'Looking up'} ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`}
            </Text>
            <Text style={styles.muted}>{progress.matched} matched so far</Text>
            <Pressable style={styles.button} onPress={() => abortRef.current?.abort()}>
              <Text style={styles.buttonLabel}>Stop</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.stack}>
            {outcome ? <Text style={styles.outcome}>{outcome}</Text> : null}
            <Text style={styles.muted}>
              {selected.size > 0
                ? `${selected.size} selected`
                : [
                    `${summary.matched} matched`,
                    summary.manual > 0 ? `${summary.manual} edited` : null,
                    `${summary.notFound} not found`,
                    `${untried} untried`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </Text>
            <View style={styles.actions}>
              {selected.size > 0 ? (
                <>
                  <Pressable style={styles.button} onPress={() => void lookUpSelected()}>
                    <Text style={styles.buttonLabel}>Look up</Text>
                  </Pressable>
                  <Pressable style={styles.button} onPress={() => void resetSelected()}>
                    <Text style={styles.buttonLabel}>Reset</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.button} onPress={() => void run()}>
                  <Text style={styles.buttonLabel}>Look up missing</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.button}
                onPress={() =>
                  setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.track.id)))
                }>
                <Text style={styles.buttonLabel}>{allSelected ? 'Clear' : 'Select all'}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Tap a track to correct it by hand. Drag down the checkboxes to select
              a run.
            </Text>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search these tracks"
            />
          </View>
        )}
      </View>

      <View
        ref={wrapperRef}
        style={styles.listWrapper}
        // Page coordinates are what the gesture reports, so the list's own
        // corner in the window is needed to turn one into a row and a column.
        onLayout={() =>
          wrapperRef.current?.measureInWindow((x, y) => {
            listLeft.current = x;
            listTop.current = y;
          })
        }
        {...panResponder.panHandlers}>
        <FlatList
          data={visible}
          keyExtractor={(row) => row.track.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_data, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
          renderItem={({ item }) => (
            <MetadataRow
              row={item}
              checked={selected.has(item.track.id)}
              onPress={() =>
                selected.size > 0
                  ? toggle(item.track.id)
                  : router.push({ pathname: '/details', params: { trackId: item.track.id, tab: 'tags' } })
              }
              onLongPress={() => toggle(item.track.id)}
            />
          )}
        />
      </View>
    </View>
  );
}

/**
 * Its own component so it can resolve its own cover: `useTrackArtwork` is a
 * hook, and a hook cannot be called from inside a render callback.
 */
function MetadataRow({
  row: { track, metadata },
  checked,
  onPress,
  onLongPress,
}: {
  row: Row;
  checked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const artwork = useTrackArtwork(track);

  return (
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.checkColumn}>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      </View>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" />
      ) : (
        <View style={[styles.art, styles.artEmpty]} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        {metadata && metadata.status !== 'not_found' ? (
          <>
            <Text
              style={metadata.status === 'manual' ? styles.manual : styles.matched}
              numberOfLines={1}>
              → {metadata.artist} — {metadata.title}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {[metadata.genre, metadata.year, metadata.source].filter(Boolean).join(' · ') ||
                'no genre'}
            </Text>
          </>
        ) : (
          <Text style={styles.unmatched}>
            {metadata?.status === 'not_found' ? 'no match found' : 'not looked up yet'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  listWrapper: { flex: 1 },
  header: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  stack: { gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e1e1e',
  },
  checkColumn: { width: CHECKBOX_COLUMN, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#5a5a5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#7ab8ff', borderColor: '#7ab8ff' },
  checkMark: { color: '#121212', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  rowText: { flex: 1, gap: 3 },
  art: { width: 46, height: 46, borderRadius: 6, marginRight: 12, backgroundColor: '#1c1c1c' },
  artEmpty: { backgroundColor: '#1c1c1c' },
  title: { color: '#f2f2f2', fontSize: 15 },
  matched: { color: '#7bd88f', fontSize: 13 },
  /** Distinct from a lookup result, because it is the one thing lookups respect. */
  manual: { color: '#e8c46a', fontSize: 13 },
  detail: { color: '#6f9e7c', fontSize: 12 },
  unmatched: { color: '#6a6a6a', fontSize: 13 },
  body: { color: '#f2f2f2', fontSize: 15 },
  muted: { color: '#9a9a9a', fontSize: 13 },
  outcome: { color: '#e8c46a', fontSize: 13, lineHeight: 19 },
  hint: { color: '#6a6a6a', fontSize: 12, lineHeight: 17 },
  button: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonLabel: { color: '#f2f2f2', fontSize: 14 },
});
