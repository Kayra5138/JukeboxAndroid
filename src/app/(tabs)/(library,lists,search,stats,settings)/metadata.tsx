import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Artwork } from '../../../components/Artwork';
import { MediaRow, mediaRowHeight } from '../../../components/MediaRow';
import { LEADING, ROW_COVER, SPACE, TYPE } from '../../../lib/theme/measures';
import { useDragSelect } from '../../../lib/ui/useDragSelect';
import { ScreenState } from '../../../components/ScreenState';
import { useFocusEffect, useRouter, useIsFocused } from 'expo-router';
import { BlurArea, Frost, GlassScene, useFrosted, useOwnScene } from '../../../components/Frosted';
import {
  AppState,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { topGlass, useLaidOver, useUnderBars } from '../../../components/UnderBars';

import {
  metadataSummary,
  readAllMetadata,
  readMetadata,
  type TrackMetadata,
} from '../../../lib/db/metadata';
import { SearchField } from '../../../components/SearchField';
import { useSelectionActions } from '../../../components/SelectionActions';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { useT } from '../../../lib/i18n/index';
import { useTrackArtwork } from '../../../lib/media/artwork';
import { isStandIn } from '../../../lib/media/standIns';
import {
  bulkLookupRunning,
  onBulkSaved,
  startBulkLookup,
  stopBulkLookup,
  useBulkLookup,
} from '../../../lib/metadata/bulk';
import { describeOutcome } from '../../../lib/metadata/outcome';
import { foldForMatch } from '../../../lib/metadata/text';
import { ensureAudioPermission, scanLibrary } from '../../../lib/media/library';
import { readLibrary } from '../../../lib/library/index';
import { makeStyles, scene } from '../../../lib/theme/index';
import { Behind } from '../../../lib/theme/Veil';
import { useAnnounce } from '../../../lib/ui/announce';
import { haptic } from '../../../lib/ui/haptics';
import type { Track } from '../../../lib/types';
import { CLIP_SUBVIEWS } from '../../../lib/ui/lists';
import { useBack } from '../../../lib/ui/back';
import { isTape } from '../../../lib/tapes/tape';
import { Button } from '../../../components/Button';

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
 * a row of three lines (`MediaRow` `tall`), taller as the writing is turned
 * up, so that the third line is not cut at a larger size of writing.
 */
const rowHeightFor = (fontScale: number) => mediaRowHeight('tall', fontScale);


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

type Scanned = { of: unknown; tracks: Track[] };

/**
 * The library's songs with what is known of each, the files read afresh only
 * where the library has changed since [scanned]; null where they may not be
 * read, or could not be. Out here rather than in the screen, which the React
 * Compiler does not take with a question inside a `try`: the whole screen
 * went uncompiled for it.
 */
async function readRows(scanned: Scanned | null): Promise<{ rows: Row[]; scanned: Scanned; summary: ReturnType<typeof metadataSummary> } | null> {
  try {
    if (!(await ensureAudioPermission())) return null;
    const held = await readLibrary();
    const tracks = scanned?.of === held ? scanned.tracks : await scanLibrary();
    const known = readAllMetadata();
    return {
      // Songs only: a tape is never looked up nor tagged.
      rows: tracks.filter((track) => !isTape(track)).map((track) => ({ track, metadata: known.get(track.id) })),
      scanned: { of: held, tracks },
      summary: metadataSummary(),
    };
  } catch {
    return null;
  }
}

export default function MetadataScreen() {
  const { fontScale } = useWindowDimensions();
  const rowHeight = rowHeightFor(fontScale);
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
  const focused = useIsFocused();
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
  // The bar of what is playing is along the foot of every page of a tab (see the tabs' layout), laid over it in a theme of glass: kept clear of.
  const under = useUnderBars();
  // The list out of focus behind the top, where it is laid over it: see `Frosted`.
  const scene = useOwnScene();
  const frosted = useFrosted(top.laid ? scene.target : null);
  const t = useT();
  const styles = useStyles();
  const said = t.details.library;


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

  /*
    The files as they say themselves, which is what this screen shows beside
    what was found for them: read off the device again only when the library
    the whole app holds has changed, and not every time the screen is come
    back to. One that cannot be had is an empty list, and not a spinner for
    good.
  */
  const scanned = useRef<Scanned | null>(null);
  const refresh = useCallback(async () => {
    const read = await readRows(scanned.current);
    if (!read) {
      setRows((current) => current ?? []);
      return;
    }
    scanned.current = read.scanned;
    setRows(read.rows);
    setSummary(read.summary);
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
    // Felt only by somebody looking at it: a run that ends behind another screen, or with the app put away, is not.
    if (focused && AppState.currentState === 'active') haptic('results', 'confirm');
    void refresh();
  }, [running, refresh, focused]);

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

  /*
    Dragging down the column of boxes ticks a run of rows, from the first row
    touched (`useDragSelect`); starting on one already ticked unticks the run.
    Always on: it is how choosing begins here, as a long press is elsewhere.
  */
  // Taken apart, each by itself: read off the one object, everything on it was taken for a ref (as in the library).
  const { wrapperRef: dragWrapper, onWrapperLayout: onDragLayout, panHandlers: dragHandlers, onScroll: dragScroll, onWidth: dragWidth } = useDragSelect({
    ids: useMemo(() => visible.map((row) => row.track.id), [visible]),
    rowHeight,
    columns: 1,
    enabled: true,
    selected,
    onChange: setSelected,
    top: top.height,
  });


  const run = useCallback(
    async (subset?: Track[]) => {
      // One at a time: see `metadata/bulk.ts`, which turns a second away.
      if (bulkLookupRunning()) return;
      // Every row, but the tapes, when nobody chose: a book is not looked up as a song. One chosen by hand is.
      const tracks = subset ?? visible.map((row) => row.track).filter((track) => !isTape(track));
      if (tracks.length === 0) return;
      // The selection is let go of and the list read again when the run ends,
      // by the effect above that watches for it, wherever the run began.
      await startBulkLookup(tracks, rows?.map((row) => row.track));
    },
    [rows, visible]
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
  // Back lets go of a selection, then of a search, before it leaves the screen.
  useBack(query !== '' && focused, () => setQuery(''));
  useBack(selecting && focused, () => setSelected(new Set()));
  const renderRow = useCallback(
    ({ item }: { item: Row }) => (
      <MetadataRow
        row={item}
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
      <View style={styles.screen}>
        <ScreenState kind="loading" />
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
            <Button
              label={said.stop}
              kind="outline"
              shape="pill"
              size="small"
              onPress={stopBulkLookup}
            />
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
                  <Button
                    label={t.details.lookUp}
                    kind="outline"
                    shape="pill"
                    size="small"
                    accessibilityHint={t.details.selection.actions.lookUp.hint}
                    onPress={() => actions.run('lookUp')}
                  />
                  <Button
                    label={t.common.edit}
                    kind="outline"
                    shape="pill"
                    size="small"
                    accessibilityHint={t.details.selection.actions.edit.hint}
                    onPress={() => actions.run('edit')}
                  />
                  <Button
                    label={t.details.selection.more}
                    kind="outline"
                    shape="pill"
                    size="small"
                    accessibilityHint={t.details.selection.moreHint}
                    onPress={actions.open}
                  />
                </>
              ) : (
                <Button
                  label={said.lookUpMissing}
                  kind="outline"
                  shape="pill"
                  size="small"
                  onPress={() => void run()}
                />
              )}
              <Button
                label={allSelected ? t.common.clear : t.common.selectAll}
                kind="outline"
                shape="pill"
                size="small"
                onPress={() =>
                setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.track.id)))
                }
              />
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
        ref={dragWrapper}
        style={styles.listWrapper}
        // Page coordinates are what the gesture reports, so the list's own
        // corner in the window is needed to turn one into a row.
        onLayout={onDragLayout}
        {...dragHandlers}>
        {/* What scrolls under the counts and the buttons, which blur it: see `Frosted`. */}
        <BlurArea style={styles.fill}>
        <FlatList
                  removeClippedSubviews={CLIP_SUBVIEWS}
          data={visible}
          keyExtractor={keyOf}
          onScroll={(event) => dragScroll(event.nativeEvent.contentOffset.y)}
          onLayout={(event) => dragWidth(event.nativeEvent.layout.width)}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: top.height, paddingBottom: under.bottom }}
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
  selecting,
  checked,
  onPress,
  onLongPress,
}: {
  row: Row;
  /** Whether rows are being ticked, when a tap ticks rather than opens. */
  selecting: boolean;
  checked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  // Its cover, if it has one: not the paper sleeve that stands in for none.
  const drawn = useTrackArtwork(track);
  const artwork = isStandIn(drawn) ? null : drawn;
  const t = useT();
  const styles = useStyles();
  const found = metadata && metadata.status !== 'not_found' ? metadata : null;
  const spoken = found
    ? found.status === 'manual'
      ? t.details.library.manualSpoken(found.artist ?? '', found.title ?? '')
      : t.details.library.matchedSpoken(found.artist ?? '', found.title ?? '')
    : metadata?.status === 'not_found'
      ? t.details.library.noMatch
      : t.details.library.notLookedUp;
  const detail = found ? [found.genre, found.year, found.source].filter(Boolean).join(' · ') || t.details.library.noGenre : null;

  /*
    Its box always there, ready to be dragged down (`useDragSelect`); a tap
    opens the track until something is ticked, and ticking begins with a
    hold, which a screen reader is offered by name.
  */
  return (
    <MediaRow
      size="tall"
      check={checked}
      choosing={selecting}
      // The paper sleeve where there is none: never a blank, but not a cover to act on either.
      lead={<Artwork uri={artwork ?? drawn} size={ROW_COVER} />}
      title={track.title}
      subtitle={
        found ? (
          <Text style={found.status === 'manual' ? styles.manual : styles.matched}>
            → {found.artist} — {found.title}
          </Text>
        ) : (
          <Text style={styles.unmatched}>{spoken}</Text>
        )
      }
      detail={detail}
      accessibilityLabel={[track.title, spoken, detail].filter(Boolean).join(', ')}
      menu={false}
      holdLabel={t.library.albumActions.select.label}
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  fill: { flex: 1 },
  listWrapper: { flex: 1 },
  header: {
    padding: SPACE.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  // Over the list in a theme of glass; nothing at all in any other.
  headerOver: topGlass(c),
  /** Its fill left to `Frost`, which draws it over the blur. */
  headerClear: { backgroundColor: 'transparent' },
  stack: { gap: SPACE.s },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  matched: { color: c.success, fontSize: TYPE.small },
  /** Distinct from a lookup result, because it is the one thing lookups respect. */
  manual: { color: c.warning, fontSize: TYPE.small },
  unmatched: { color: c.textFaint, fontSize: TYPE.small },
  body: { color: c.text, fontSize: TYPE.body },
  muted: { color: c.textSecondary, fontSize: TYPE.small },
  outcome: { color: c.warning, fontSize: TYPE.small, lineHeight: LEADING.small },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint },
}));
