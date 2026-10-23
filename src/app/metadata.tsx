import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { BlurArea, Frost, GlassScene, useFrosted, useOwnScene } from '../components/Frosted';
import { Image } from '../components/Picture';
import {
  ActivityIndicator,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { topGlass, useLaidOver } from '../components/UnderBars';

import {
  metadataSummary,
  readAllMetadata,
  readMetadata,
  type TrackMetadata,
} from '../lib/db/metadata';
import { SearchField } from '../components/SearchField';
import { useSelectionActions } from '../components/SelectionActions';
import { useTrackMenu } from '../components/useTrackMenu';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import {
  bulkLookupRunning,
  onBulkSaved,
  startBulkLookup,
  stopBulkLookup,
  useBulkLookup,
} from '../lib/metadata/bulk';
import { describeOutcome } from '../lib/metadata/outcome';
import { foldForMatch } from '../lib/metadata/text';
import { ensureAudioPermission, scanLibrary } from '../lib/media/library';
import { makeStyles, outlined, scene, useColours, usePressed } from '../lib/theme/index';
import { Behind } from '../lib/theme/Veil';
import { useAnnounce } from '../lib/ui/announce';
import type { Track } from '../lib/types';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

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

/**
 * Rows are all one height so a finger position can be turned into an index:
 * 78 at the ordinary size of writing, and taller as the writing is turned up.
 * The three lines of a row take some forty-seven points of it and grow with
 * the writing; at 78 whatever the setting, the third line was cut from about
 * one and a half times the size.
 */
const rowHeightFor = (fontScale: number) => Math.round(31 + 47 * Math.min(Math.max(fontScale, 1), 2));

/** Drags that begin over the checkboxes select; anywhere else scrolls. */
const CHECKBOX_COLUMN = 52;

/**
 * How long results are gathered before the list is told about them.
 *
 * A run writes in bursts — a cover going onto every track of a record is one
 * write per track in the same instant — and each telling walks the whole list.
 * A third of a second is short enough to read as "as it happens" and long
 * enough for a burst to be one walk.
 */
const SHOW_RESULTS_EVERY_MS = 300;

const keyOf = (row: Row) => row.track.id;

export default function MetadataScreen() {
  const { fontScale } = useWindowDimensions();
  const rowHeight = rowHeightFor(fontScale);
  // For the gesture's handlers, which are made once.
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState(() => metadataSummary());
  /*
    The run is the app's and not this screen's (`metadata/bulk.ts`): the
    library's offer to a newcomer starts the same one, and either way it
    carries on behind whatever screen is open. This shows it, and stops it.
  */
  const bulk = useBulkLookup();
  const progress = bulk.progress;
  const running = progress !== null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  /** What the last thing done to the selection came to, until the next. */
  const [note, setNote] = useState<string | null>(null);
  // Said aloud when it appears: it comes up where nobody's attention is, after a press in a sheet.
  useAnnounce(note);
  const router = useRouter();
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  /*
    In a theme of glass what is over the list — the counts, the buttons, the
    search — is laid over it, and the list runs on under it and is seen
    through it, beginning this far down what it scrolls.
  */
  const top = useLaidOver();
  // The list out of focus behind the top, where it is laid over it: see `Frosted`.
  const scene = useOwnScene();
  const frosted = useFrosted(top.laid ? scene.target : null);
  const topRoom = useRef(0);
  topRoom.current = top.height;
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.details.library;

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

  /*
    Results are shown as they are written rather than when the run ends, and
    only the rows they belong to are touched: every other row keeps the object
    it had, so the list has nothing to draw again for it. Reading the whole
    library afresh, which is what the end of the run does, is too much to do
    every few seconds under somebody's finger.

    Listened for for as long as the screen is open, whoever began the run.
  */
  useEffect(() => {
    const touched = new Set<string>();
    let showing: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      showing = null;
      const ids = new Set(touched);
      touched.clear();
      setRows((current) =>
        current
          ? current.map((row) =>
              ids.has(row.track.id)
                ? { track: row.track, metadata: readMetadata(row.track.id) ?? undefined }
                : row
            )
          : current
      );
    };
    const stop = onBulkSaved((ids) => {
      for (const id of ids) touched.add(id);
      if (showing == null) showing = setTimeout(show, SHOW_RESULTS_EVERY_MS);
    });
    return () => {
      stop();
      if (showing) clearTimeout(showing);
    };
  }, []);

  /*
    However a run ended — here, from Stop, or on its own behind another screen
    — the whole list is read again, once. A run already over when the screen
    opens is nothing to react to: the focus has just read everything.

    The selection is kept. It used to be let go of here, when a lookup was
    all there was to do with one; now the same tracks are as likely to want
    their lyrics or their covers next, and choosing them again is the work
    the selection was made to save.
  */
  const wasRunning = useRef(running);
  useEffect(() => {
    const ended = wasRunning.current && !running;
    wasRunning.current = running;
    if (running) setNote(null);
    if (!ended) return;
    void refresh();
  }, [running, refresh]);

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
    const y = pageY - listTop.current + scrollOffset.current - topRoom.current;
    const index = Math.floor(y / rowHeightRef.current);
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
      // One at a time: see `metadata/bulk.ts`, which turns a second away.
      if (bulkLookupRunning()) return;
      const tracks = subset ?? rowsRef.current.map((row) => row.track);
      if (tracks.length === 0) return;
      // The selection is let go of and the list read again when the run ends,
      // by the effect above that watches for it, wherever the run began.
      await startBulkLookup(tracks, rows?.map((row) => row.track));
    },
    [rows]
  );

  /** How the last run ended, when that is worth saying. Cleared by the next one. */
  const outcome = useMemo(
    () => (bulk.last ? describeOutcome(bulk.kind, bulk.last, t) : null),
    [bulk.kind, bulk.last, t]
  );

  /*
    The list picker and the eraser are the track menu's, so that a list added
    to and a file erased here are added to and erased as everywhere else —
    the queue included. The menu itself is never opened from this screen.
  */
  const menu = useTrackMenu({
    onChanged: () => void refresh(),
    onAdded: setNote,
  });

  /*
    Everything else that can be done to the selection (`SelectionActions`).
    After an edit the same tracks stay chosen, so that one thing can follow
    another; after a reset or a delete there is nothing left to act on.
  */
  const chosenIds = useMemo(() => [...selected], [selected]);
  const actions = useSelectionActions({
    trackIds: chosenIds,
    addToList: menu.addToList,
    erase: menu.erase,
    onChanged: (how) => {
      if (how === 'cleared') setSelected(new Set());
      void refresh();
    },
    onSaid: setNote,
  });

  /*
    Held between renders, so that a list which is only being counted over —
    the progress above it changes every few seconds for the length of a run —
    is handed the same thing to draw with and leaves its rows alone.
  */
  const selecting = selected.size > 0;
  const renderRow = useCallback(
    ({ item }: { item: Row }) => (
      <MetadataRow
        row={item}
        height={rowHeight}
        selecting={selecting}
        checked={selected.has(item.track.id)}
        onPress={() =>
          selecting
            ? toggle(item.track.id)
            : router.push({ pathname: '/details', params: { trackId: item.track.id, tab: 'tags' } })
        }
        onLongPress={() => toggle(item.track.id)}
      />
    ),
    [rowHeight, selected, selecting, toggle, router]
  );

  if (!rows) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={c.text} />
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
      <GlassScene scene={scene}>
      <Behind veiled={menu.veiled} style={styles.fill}>
      <View style={[styles.header, top.laid && styles.headerOver, frosted && styles.headerClear]} onLayout={top.onLayout}>
        {frosted && scene.target ? <Frost target={scene.target} edge="bottom" /> : null}
        {progress ? (
          <View style={styles.stack}>
            <Text style={styles.body}>
              {progress.offline
                ? said.nothingAnswered
                : bulk.album != null
                  ? said.lookingUpAlbum(bulk.album.name, progress.done, progress.total)
                  : progress.total === 0
                    ? said.lookingUp
                    : bulk.kind === 'covers'
                      ? t.details.selection.coversProgress(progress.done, progress.total)
                      : bulk.kind === 'lyrics'
                        ? t.details.selection.lyricsProgress(progress.done, progress.total)
                        : said.lookingUpProgress(progress.done, progress.total)}
            </Text>
            <Text style={styles.muted}>
              {bulk.kind === 'lyrics'
                ? t.details.selection.lyricsSoFar(progress.matched)
                : said.soFar(progress.matched, progress.covers)}
            </Text>
            {/* Beside the count and not instead of it: one service is being
                left alone for a minute while the other is still being asked. */}
            {progress.throttled ? <Text style={styles.muted}>{said.rateLimited}</Text> : null}
            <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={stopBulkLookup}>
              <Text style={styles.buttonLabel}>{said.stop}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.stack}>
            {note ?? outcome ? <Text style={styles.outcome}>{note ?? outcome}</Text> : null}
            <Text style={styles.muted}>
              {selected.size > 0
                ? said.selected(selected.size)
                : said.summary(summary.matched, summary.manual, summary.notFound, untried)}
            </Text>
            <View style={styles.actions}>
              {selected.size > 0 ? (
                <>
                  {/* The two most asked for, as buttons of their own; the rest,
                      these two included, are a press away under More. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint={t.details.selection.actions.lookUp.hint}
                    android_ripple={pressed}
                    style={styles.button}
                    onPress={() => actions.run('lookUp')}>
                    <Text style={styles.buttonLabel}>{t.details.lookUp}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint={t.details.selection.actions.edit.hint}
                    android_ripple={pressed}
                    style={styles.button}
                    onPress={() => actions.run('edit')}>
                    <Text style={styles.buttonLabel}>{t.common.edit}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint={t.details.selection.moreHint}
                    android_ripple={pressed}
                    style={styles.button}
                    onPress={actions.open}>
                    <Text style={styles.buttonLabel}>{t.details.selection.more}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={() => void run()}>
                  <Text style={styles.buttonLabel}>{said.lookUpMissing}</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={styles.button}
                onPress={() =>
                  setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.track.id)))
                }>
                <Text style={styles.buttonLabel}>{allSelected ? t.common.clear : t.common.selectAll}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>{said.hint}</Text>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={said.searchPlaceholder}
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
        {/* What scrolls under the counts and the buttons, which blur it: see `Frosted`. */}
        <BlurArea style={styles.fill}>
        <FlatList
                  removeClippedSubviews={CLIP_SUBVIEWS}
          data={visible}
          keyExtractor={keyOf}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={top.height > 0 ? { paddingTop: top.height } : undefined}
          getItemLayout={(_data, index) => ({ length: rowHeight, offset: top.height + rowHeight * index, index })}
          renderItem={renderRow}
        />
        </BlurArea>
      </View>
      </Behind>
      </GlassScene>
      {menu.element}
      {actions.element}
    </View>
  );
}

/**
 * Its own component so it can resolve its own cover: `useTrackArtwork` is a
 * hook, and a hook cannot be called from inside a render callback.
 */
function MetadataRow({
  row: { track, metadata },
  height,
  selecting,
  checked,
  onPress,
  onLongPress,
}: {
  row: Row;
  height: number;
  /** Whether rows are being ticked, when a tap ticks rather than opens. */
  selecting: boolean;
  checked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const artwork = useTrackArtwork(track);
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();

  return (
    <Pressable
      android_ripple={pressed}
      style={[styles.row, { height }]}
      onPress={onPress}
      onLongPress={onLongPress}
      /*
        A tick box while rows are being ticked, saying whether it is: the
        square is all that says so to the eye. Otherwise a tap opens the track,
        and ticking is the hold, which a screen reader is offered by name.
      */
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked } : undefined}
      accessibilityActions={selecting ? undefined : [{ name: 'longpress', label: t.library.albumActions.select.label }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress();
      }}>
      <View style={styles.checkColumn}>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <Text style={styles.checkMark} importantForAccessibility="no">✓</Text> : null}
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
              numberOfLines={1}
              accessibilityLabel={
                metadata.status === 'manual'
                  ? t.details.library.manualSpoken(metadata.artist ?? '', metadata.title ?? '')
                  : t.details.library.matchedSpoken(metadata.artist ?? '', metadata.title ?? '')
              }>
              → {metadata.artist} — {metadata.title}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {[metadata.genre, metadata.year, metadata.source].filter(Boolean).join(' · ') ||
                t.details.library.noGenre}
            </Text>
          </>
        ) : (
          <Text style={styles.unmatched}>
            {metadata?.status === 'not_found' ? t.details.library.noMatch : t.details.library.notLookedUp}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centered: { alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  listWrapper: { flex: 1 },
  header: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  // Over the list in a theme of glass; nothing at all in any other.
  headerOver: topGlass(c),
  /** Its fill left to `Frost`, which draws it over the blur. */
  headerClear: { backgroundColor: 'transparent' },
  stack: { gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  checkColumn: { width: CHECKBOX_COLUMN, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 14, fontWeight: '700', lineHeight: 16 },
  rowText: { flex: 1, gap: 3 },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  art: { width: 46, height: 46, borderRadius: 6, marginRight: 12 },
  artEmpty: { backgroundColor: c.surfaceRaised },
  title: { color: c.text, fontSize: 15 },
  matched: { color: c.success, fontSize: 13 },
  /** Distinct from a lookup result, because it is the one thing lookups respect. */
  manual: { color: c.warning, fontSize: 13 },
  detail: { color: c.textMuted, fontSize: 12 },
  unmatched: { color: c.textFaint, fontSize: 13 },
  body: { color: c.text, fontSize: 15 },
  muted: { color: c.textSecondary, fontSize: 13 },
  outcome: { color: c.warning, fontSize: 13, lineHeight: 19 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 17 },
  button: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...outlined(c),
  },
  buttonLabel: { color: c.text, fontSize: 14 },
}));
