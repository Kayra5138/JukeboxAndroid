import { memo, startTransition, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { SPACE, TYPE } from '../../lib/theme/measures';
import { Animated as Native, Dimensions, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Curtain } from '../Curtain';
import { FastScroller, useFastScroll } from '../FastScroller';
import { WALL_COLUMNS } from './shared';
import { CLIP_SUBVIEWS, ROWS_KEPT } from '../../lib/ui/lists';
import { backToTop } from '../../lib/ui/tabReselect';
import type { EnrichedTrack } from '../../lib/media/merge';
import { makeStyles } from '../../lib/theme/index';
import { useScreenReader } from '../../lib/ui/screenReader';

/**
 * A list pinched out: the same entries in the same order as covers, three,
 * five or eight to a row, under headings of whatever they are filed by where
 * the list has any. Three to a row still has each one's name under its
 * cover; past that it is covers alone, the whole list a few screens long,
 * for what is known by its cover.
 *
 * Any list's: songs, records, artists, folders. A touch does what a touch on
 * the row does, and a long press what holding the row does.
 */
type Row<T> =
  | { kind: 'head'; key: string; label: string }
  | { kind: 'row'; key: string; label: string; cells: { item: T; at: number }[] };

const PAD = 12;
const GAP = 6;
/** Between the covers of the walls of thirteen and twenty-one, where six would be half a cover. */
const NARROW_GAP = 2;
/** From how many to a row the covers are too small to be pressed one by one: the row is pressed, and where. */
const DENSE = 13;

type GridProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  titleOf: (item: T) => string;
  detailOf?: (item: T) => string | null | undefined;
  /** The heading an entry is filed under, where the list is divided by any. */
  sectionOf?: (item: T) => string;
  /** What the fast scroller says of an entry, and where in the list it is, where there are no headings to say it. */
  labelOf?: (item: T, at: number) => string;
  renderCover: (item: T, size: number) => ReactNode;
  /** A song whose cover stands for the entry, in the fast scroller's bubble. */
  sleeveOf?: (item: T) => EnrichedTrack | null | undefined;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  /** In place of the covers where there are none, as the list says it. */
  empty?: ReactElement | null;
  top: number;
  bottom: number;
  onPress: (item: T, index: number) => void;
  onLongPress?: (item: T, index: number) => void;
  /** What a screen reader calls the long press, where there is one. */
  holdLabel?: string;
};

/*
  What each stack's levels can be asked, by the stack: held out here rather
  than in a ref, being written after each level is drawn and read only as a
  pinch begins, nothing React has to know of.
*/
const askers = new WeakMap<object, Record<number, LevelApi | undefined>>();
function askersOf(token: object): Record<number, LevelApi | undefined> {
  let held = askers.get(token);
  if (!held) {
    held = {};
    askers.set(token, held);
  }
  return held;
}

/** Where an entry's picture is on screen in a level, as it is scrolled now: its left, its top and its width. */
/*
  For each stack, since the fingers came down: the entry under them, how far
  down they are, the levels scrolled into line and where the entry's picture
  is in each. Kept here on the JavaScript side, as `askers` is: a shared
  value set there and read straight back gave what it was before.
*/
type Lined = { entry: number; y: number; brought: Set<number>; places: (PictureRect | null)[] };
const linedOf = new WeakMap<object, Lined>();
/** The timer that puts each stack's levels away again once the fingers are off. */
const sleepers = new WeakMap<object, ReturnType<typeof setTimeout>>();
/** The level each stack last told of, for one told of from outside to be known from it. */
const toldOf = new WeakMap<object, number>();

export type PictureRect = { x: number; y: number; w: number };

/** What a level of the stack can be asked, in its own measure from its top left corner. */
export type LevelApi = {
  /** The entry at a point of it as it is scrolled now. */
  entryAt: (x: number, y: number) => number;
  /** Scrolled so that [entry] is at [y], its middle there. */
  bring: (entry: number, y: number) => void;
  /** Where [entry]'s picture is: see {@link PictureRect}. */
  rectOf: (entry: number) => PictureRect | null;
  /** Back to its top, as the tab pressed again takes it; false where it is there already. */
  toTop?: () => boolean;
};

/** What a stack can be asked from outside: the wall on screen back to its top, for the tab pressed again. */
export type StackApi = { toTop: () => boolean };

/** The levels there are after the list: the walls, one for each of {@link WALL_COLUMNS} after its nought. */
const LAST_LEVEL = WALL_COLUMNS.length - 1;

/** How far the fingers go, apart or together, for the first step of a pinch: about an eighth, so that it answers at once. */
const STEP_AT = 1.12;
/** And for each step after it in the same pinch: about a quarter, so that one is not gone past by the fingers going on. */
const STEP_ON = 1.25;
/** How long one level takes to give way to the next. */
const SWITCH_MS = 230;

/**
 * A list and the wall of covers it pinches out into, three, five and eight
 * to a row, one over another and pinched between as the phone's own gallery
 * is: nothing moves while the fingers are short of a step, and as soon as
 * they have gone far enough the next level comes, there and then, as many
 * steps in one pinch as the fingers go.
 *
 * Each step is the one entry under the fingers held in sight from the one
 * level to the next: its picture goes from where it is in the one to where it
 * is in the other, growing or shrinking, and each level is drawn as if that
 * picture carried it -- the one going fading as it goes, the one coming
 * coming up through it -- so that the eye stays on the entry it was on. Every
 * level is put, as the fingers come down, with that entry under them (`line`).
 * The way of it is react-native-zoom-grid's (MIT), made to step as the phone's
 * gallery does rather than follow the fingers.
 *
 * The list is the caller's ([list], with [listApi] to ask of it); the walls
 * are drawn here, from the same entries in the same order.
 */
export function ZoomStack<T>({
  zoom,
  onZoom,
  enabled = true,
  list,
  listApi,
  register,
  ...grid
}: GridProps<T> & {
  /** The level it rests at: 0, the list, or one of {@link WALL_COLUMNS} after it. */
  zoom: number;
  /** Told the level it has come to, at each step. */
  onZoom: (level: number) => void;
  enabled?: boolean;
  list: ReactNode;
  listApi?: LevelApi;
  /** Handed what it can be asked, after every drawing: see {@link StackApi}. */
  register?: (api: StackApi) => void;
}) {
  // What each level can be asked, and the rest kept apart from React: see `askers` and `linedOf`.
  const [token] = useState(() => ({}));
  // The level being left and the one being gone to, and how far between: at rest the two are one.
  const leaving = useSharedValue(zoom);
  const coming = useSharedValue(zoom);
  const progress = useSharedValue(1);
  /*
    Where the entry's picture is in every level, found as the fingers come
    down, so that a step can begin the moment it is taken, without waiting
    on anything to be asked; null until it is known, when a step only fades.
  */
  const rects = useSharedValue<(PictureRect | null)[] | null>(null);
  // Where the entry's picture is in each of the two, as the step begins.
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromW = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  const toW = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  // The pinch's own measure when the last step was taken.
  const base = useSharedValue(1);
  // Whether this pinch has taken a step yet.
  const stepped = useSharedValue(false);
  /*
    Told of a level from outside -- tracks being chosen, which are chosen
    from the list -- it is put there at once. One it has come to itself it
    has already.
  */
  useEffect(() => {
    // The level it last told of, come back to it: by then the fingers may have gone on to another.
    const told = toldOf.get(token);
    toldOf.set(token, zoom);
    if (told === undefined || told === zoom) return;
    cancelAnimation(progress);
    leaving.set(zoom);
    coming.set(zoom);
    progress.set(1);
  }, [coming, leaving, progress, token, zoom]);

  /*
    The walls drawn: the one at rest and those either side of it, ready for
    a pinch to bring up, and as a pinch steps on, those either side of the
    one it has come to, for a pinch that goes on through two or three.

    Not all of them, a moment after the stack was put up, as they once were:
    that was some two thousand covers for every list and page with a stack,
    the walls of thirteen and twenty-one alone more than fifteen hundred,
    each with its picture to be found and made small, for walls most people
    never pinch out to; and a page that cannot be pinched (`enabled` false)
    put them up as well. Those a pinch went out to are put away again once
    the fingers are off and the walls have gone back to sleep, all but the
    one at rest and its two.
  */
  const [walls, setWalls] = useState<ReadonlySet<number>>(() => new Set());
  const [awake, setAwake] = useState<ReadonlySet<number>>(() => new Set());
  const near = (level: number, of: number) => level >= 1 && level <= LAST_LEVEL && Math.abs(level - of) <= 1;
  const wanted = (enabled ? [zoom - 1, zoom, zoom + 1] : [zoom]).filter((level) => level >= 1 && level <= LAST_LEVEL && !walls.has(level));
  const spare = awake.size === 0 ? [...walls].filter((level) => level !== zoom && !(enabled && near(level, zoom))) : [];
  if (wanted.length > 0 || spare.length > 0) setWalls(new Set([...walls, ...wanted].filter((level) => !spare.includes(level))));
  /*
    How tall the header is (the shelves over the tracks): drawn on the level
    at rest alone, and on the others a space as tall, so that every level has
    its entries where the one at rest has them.
  */
  const [headerSpace, setHeaderSpace] = useState(0);

  /*
    The levels drawn besides the one at rest: none, until two fingers are
    down, and then those a step could go to. Standing behind it unseen but
    drawn, every level was drawn again with each frame of a scroll -- the
    records' wall lost two frames in five -- where one shut away (see
    `Curtain`), standing and laid out as ever, costs nothing.
  */
  const away = (level: number) => zoom !== level && !awake.has(level);
  /*
    What the walls shut away are drawn from: what the list was when they last
    caught up, and caught up with it only once it has been still a moment,
    and then as something that can wait (a transition), or as soon as they
    are woken. Handed every change as it came, every wall standing behind the
    list drew itself again and put up a new screen of covers at every letter
    typed into the search, most of half a second a letter on a fast phone,
    for walls nobody could see.
  */
  const [settled, setSettled] = useState(grid);
  const unsettled = changedFrom(settled, grid);
  useEffect(() => {
    if (!unsettled) return;
    const later = setTimeout(() => startTransition(() => setSettled(grid)), SETTLE_MS);
    return () => clearTimeout(later);
  });
  const wake = (level: number) => {
    if (unsettled) setSettled(grid);
    const timer = sleepers.get(token);
    if (timer) clearTimeout(timer);
    sleepers.delete(token);
    const around = [level - 1, level, level + 1].filter((one) => one >= 0 && one <= LAST_LEVEL);
    setAwake((now) => (around.every((one) => now.has(one)) ? now : new Set([...now, ...around])));
    // Put up as well where they are not yet: the walls either side of the one a step has come to.
    const up = around.filter((one) => one >= 1);
    setWalls((now) => (up.every((one) => now.has(one)) ? now : new Set([...now, ...up])));
  };
  // Once the fingers are off and any step has run its course.
  const sleepSoon = () => {
    const timer = sleepers.get(token);
    if (timer) clearTimeout(timer);
    sleepers.set(
      token,
      setTimeout(() => {
        sleepers.delete(token);
        setAwake((now) => (now.size === 0 ? now : new Set()));
      }, SWITCH_MS + 250)
    );
  };
  useEffect(
    () => () => {
      const timer = sleepers.get(token);
      if (timer) clearTimeout(timer);
    },
    [token]
  );
  /*
    As the fingers come down: the entry under them in the level on screen,
    and the levels either side scrolled to have it at the same height, and
    each level's next one as a step is taken. Only those: every level
    scrolled at once had each fill a new screen of covers, and the steps
    waited on them.
  */
  const ready = (level: number) => {
    const lined = linedOf.get(token);
    if (!lined) return;
    wake(level);
    const apis = askersOf(token);
    if (listApi) apis[0] = listApi;
    for (const other of [level - 1, level, level + 1]) {
      if (other < 0 || other > LAST_LEVEL) continue;
      if (!lined.brought.has(other)) {
        apis[other]?.bring(lined.entry, lined.y);
        lined.brought.add(other);
      }
      lined.places[other] = apis[other]?.rectOf(lined.entry) ?? null;
    }
    rects.set([...lined.places]);
  };
  const line = (x: number, y: number, level: number) => {
    const apis = askersOf(token);
    if (listApi) apis[0] = listApi;
    const here = apis[level];
    if (!here) return;
    linedOf.set(token, { entry: here.entryAt(x, y), y, brought: new Set([level]), places: WALL_COLUMNS.map(() => null) });
    ready(level);
  };
  // The list's top is the list's own business, and its screen's.
  useEffect(() => {
    register?.({ toTop: () => (zoom > 0 ? (askersOf(token)[zoom]?.toTop?.() ?? false) : false) });
  });
  const arrive = (level: number) => {
    toldOf.set(token, level);
    onZoom(level);
  };
  const pinch = Gesture.Pinch()
    .enabled(enabled)
    // Woken as the second finger comes down, a frame or two before the pinch is sure enough to begin.
    .onTouchesDown((event) => {
      'worklet';
      if (event.numberOfTouches >= 2) runOnJS(wake)(coming.get());
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(sleepSoon)();
    })
    .onStart((event) => {
      'worklet';
      base.set(event.scale);
      stepped.set(false);
      rects.set(null);
      runOnJS(line)(event.focalX, event.focalY, coming.get());
    })
    .onUpdate((event) => {
      'worklet';
      const ratio = event.scale / base.get();
      const now = coming.get();
      const at = stepped.get() ? STEP_ON : STEP_AT;
      let next = now;
      if (ratio <= 1 / at && now < LAST_LEVEL) next = now + 1;
      else if (ratio >= at && now > 0) next = now - 1;
      if (next === now) return;
      base.set(event.scale);
      stepped.set(true);
      // Begun here and now, on the thread that draws: a step waiting to be told its places came a few frames late, after the new level had already been put up whole.
      const all = rects.get();
      const was = all?.[now] ?? null;
      const will = all?.[next] ?? null;
      cancelAnimation(progress);
      fromX.set(was?.x ?? 0);
      fromY.set(was?.y ?? 0);
      fromW.set(was && will ? was.w : 0);
      toX.set(will?.x ?? 0);
      toY.set(will?.y ?? 0);
      toW.set(was && will ? will.w : 0);
      leaving.set(now);
      coming.set(next);
      progress.set(0);
      runOnJS(ready)(next);
      progress.set(
        withTiming(1, { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          'worklet';
          if (finished) {
            leaving.set(next);
            runOnJS(arrive)(next);
          }
        })
      );
    });

  const measure = (event: LayoutChangeEvent) => {
    width.set(event.nativeEvent.layout.width);
    height.set(event.nativeEvent.layout.height);
  };
  /*
    Each level drawn as if carried by the entry's picture: at rest, the one
    at rest as it is and the rest not at all; between two, the picture where
    it has got to on its way and how big, and each of the two moved and
    grown about it to have its own picture there, the one fading as the
    other comes.
  */
  const levelStyle = (level: number, from: number, to: number, p: number) => {
    'worklet';
    if (from === to || p >= 1) {
      return { opacity: level === to ? 1 : 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    }
    if (level !== from && level !== to) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    const ownX = level === from ? fromX.get() : toX.get();
    const ownY = level === from ? fromY.get() : toY.get();
    const ownW = level === from ? fromW.get() : toW.get();
    const fade = level === from ? 1 - p : p;
    // Nothing to carry it (an entry neither has a picture for): the two fade, and nothing moves.
    if (ownW <= 0 || fromW.get() <= 0 || toW.get() <= 0) {
      return { opacity: fade, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    }
    const nowX = fromX.get() + (toX.get() - fromX.get()) * p;
    const nowY = fromY.get() + (toY.get() - fromY.get()) * p;
    const nowW = fromW.get() + (toW.get() - fromW.get()) * p;
    const scale = nowW / ownW;
    const middleX = width.get() / 2;
    const middleY = height.get() / 2;
    return {
      opacity: fade,
      transform: [
        { translateX: nowX - middleX - scale * (ownX - middleX) },
        { translateY: nowY - middleY - scale * (ownY - middleY) },
        { scale },
      ],
    };
  };
  /*
    The three it turns on read here and handed on: a style is drawn again
    only for what its own function reads, not what one it calls does, and
    read in there alone the step stood still till it was over.
  */
  const style0 = useAnimatedStyle(() => levelStyle(0, leaving.get(), coming.get(), progress.get()));
  const style1 = useAnimatedStyle(() => levelStyle(1, leaving.get(), coming.get(), progress.get()));
  const style2 = useAnimatedStyle(() => levelStyle(2, leaving.get(), coming.get(), progress.get()));
  const style3 = useAnimatedStyle(() => levelStyle(3, leaving.get(), coming.get(), progress.get()));
  const style4 = useAnimatedStyle(() => levelStyle(4, leaving.get(), coming.get(), progress.get()));
  const style5 = useAnimatedStyle(() => levelStyle(5, leaving.get(), coming.get(), progress.get()));
  // One for each of WALL_COLUMNS: a hook cannot be called in a loop.
  const styles = [style0, style1, style2, style3, style4, style5];

  return (
    <GestureDetector gesture={pinch}>
      <View collapsable={false} style={gridStyles.box} onLayout={measure}>
        <Animated.View
          style={[gridStyles.level, styles[0]]}
          pointerEvents={zoom === 0 ? 'auto' : 'none'}
          importantForAccessibility={zoom === 0 ? 'auto' : 'no-hide-descendants'}>
          <Curtain shut={away(0)} style={gridStyles.fill}>
            {list}
          </Curtain>
        </Animated.View>
        {[...walls].sort().map((level) => (
          <Animated.View
            key={level}
            style={[gridStyles.level, styles[level]]}
            pointerEvents={zoom === level ? 'auto' : 'none'}
            importantForAccessibility={zoom === level ? 'auto' : 'no-hide-descendants'}>
            <Curtain shut={away(level)} style={gridStyles.fill}>
              <GridLevel
                {...(away(level) ? settled : grid)}
                columns={WALL_COLUMNS[level] ?? 3}
                shown={zoom === level}
                headerSpace={headerSpace}
                onHeader={setHeaderSpace}
                token={token}
                level={level}
              />
            </Curtain>
          </Animated.View>
        ))}
      </View>
    </GestureDetector>
  );
}

/** How long the list is to be still before the walls shut away behind it catch up with it: see `settled`. */
const SETTLE_MS = 2000;

/** Whether any of [now]'s props is another than [before]'s. */
function changedFrom(before: object, now: object): boolean {
  const was = before as Record<string, unknown>;
  const is = now as Record<string, unknown>;
  const keys = Object.keys(is);
  if (keys.length !== Object.keys(was).length) return true;
  return keys.some((key) => was[key] !== is[key]);
}

/*
  Drawn again only for what is its own changing: the screens over these
  are drawn again for every little thing, and every wall standing behind
  its list drew its rows anew each time, a change of view waiting on them.
*/
const GridLevel = memo(GridLevelOf) as typeof GridLevelOf;

function GridLevelOf<T>({
  items,
  keyOf,
  titleOf,
  detailOf,
  sectionOf,
  labelOf,
  renderCover,
  sleeveOf,
  header: givenHeader,
  footer,
  empty,
  top,
  bottom,
  onPress,
  onLongPress,
  holdLabel,
  columns,
  shown,
  headerSpace,
  onHeader,
  token,
  level,
}: GridProps<T> & {
  columns: number;
  /** Whether it is the level at rest, which alone has the header and the scroll bar. */
  shown: boolean;
  /** How tall the header is, for the space it stands in on a level not at rest. */
  headerSpace: number;
  onHeader: (height: number) => void;
  /** The stack it is a level of, and which: what it can be asked is told there (see `askers`). */
  token: object;
  level: number;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<Row<T>>>(null);
  /*
    The header -- the shelves over the tracks -- only on the level at rest:
    on every level standing ready behind it as well, it was drawn as many
    times over, a few hundred covers each, for nothing.
  */
  const header = givenHeader ? (
    shown ? (
      <View onLayout={(event) => onHeader(event.nativeEvent.layout.height)}>{givenHeader}</View>
    ) : (
      <View style={{ height: headerSpace }} />
    )
  ) : null;
  const fast = useFastScroll();
  const named = columns <= 3;

  const { rows, rowOf } = useMemo(() => {
    const out: Row<T>[] = [];
    // Which row each entry is in, by its place in the list.
    const where: number[] = [];
    let section: string | null = null;
    let cells: { item: T; at: number }[] = [];
    const flush = () => {
      const first = cells[0];
      if (first) {
        for (const one of cells) where[one.at] = out.length;
        out.push({ kind: 'row', key: `r${first.at}`, label: section ?? labelOf?.(first.item, first.at) ?? '', cells });
      }
      cells = [];
    };
    items.forEach((item, at) => {
      if (sectionOf) {
        const here = sectionOf(item);
        if (here !== section) {
          flush();
          section = here;
          out.push({ kind: 'head', key: `h${at}`, label: here });
        }
      }
      cells.push({ item, at });
      if (cells.length === columns) flush();
    });
    flush();
    return { rows: out, rowOf: where };
  }, [columns, items, labelOf, sectionOf]);

  /*
    Not with a screen reader on: a row that is one press, the cover picked
    by where across it the finger lands, is no cover at all to a reader,
    which presses the middle of what it has chosen. Each cover its own, then,
    small as they are.
  */
  const reader = useScreenReader();
  const dense = columns >= DENSE && !reader;
  const gap = dense ? NARROW_GAP : GAP;
  const cell = width > 0 ? (width - PAD * 2 - gap * (columns - 1)) / columns : 0;
  // The names under each cover as tall as the phone's size of type makes them: kept at the size for the usual one, larger names ran into the row below.
  const { fontScale } = useWindowDimensions();
  const lines = Math.min(fontScale, 2);
  const rowHeight = cell + (named ? Math.ceil((detailOf ? 40 : 24) * lines) : gap);
  const headHeight = columns >= 8 ? 34 : 42;
  // The header's height where there is one (not once something is searched, which takes the shelves away).
  const headed = givenHeader ? headerSpace : 0;
  const offsets = useMemo(() => {
    const out: number[] = [];
    let y = top + headed;
    for (const row of rows) {
      out.push(y);
      y += row.kind === 'head' ? headHeight : rowHeight;
    }
    return out;
  }, [headHeight, headed, rows, rowHeight, top]);

  /** The row at a point of the content: the last to begin at or above it. */
  const rowAtContent = (y: number) => {
    let low = 0;
    let high = offsets.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((offsets[middle] ?? 0) <= y) low = middle;
      else high = middle - 1;
    }
    return low;
  };
  /** The row at a scroll offset: the one under the bars at the top. */
  const rowAt = (offset: number) => rowAtContent(offset + top);

  /** Which cover of a row a point across it is on. */
  const cellAt = (x: number) => Math.max(0, Math.min(columns - 1, Math.floor((x - PAD) / Math.max(1, cell + gap))));

  const api: LevelApi = {
    entryAt: (x, y) => {
      let index = rowAtContent(fast.offset.get() + y);
      while (rows[index]?.kind === 'head' && index < rows.length - 1) index += 1;
      const row = rows[index];
      if (row?.kind !== 'row') return 0;
      const column = Math.min(row.cells.length - 1, cellAt(x));
      return row.cells[column]?.at ?? 0;
    },
    bring: (entry, y) => {
      const index = rowOf[Math.max(0, Math.min(rowOf.length - 1, entry))] ?? 0;
      const offset = Math.max(0, (offsets[index] ?? 0) + rowHeight / 2 - y);
      list.current?.scrollToOffset({ offset, animated: false });
      fast.offset.set(offset);
    },
    toTop: () => {
      if (!backToTop(list.current, fast.offset.get(), Dimensions.get('window').height)) return false;
      fast.offset.set(0);
      return true;
    },
    rectOf: (entry) => {
      const index = rowOf[entry];
      const row = index == null ? undefined : rows[index];
      if (row?.kind !== 'row' || index == null || cell <= 0) return null;
      const column = row.cells.findIndex((one) => one.at === entry);
      return { x: PAD + Math.max(0, column) * (cell + gap), y: (offsets[index] ?? 0) - fast.offset.get(), w: cell };
    },
  };
  // Told the stack after every drawing, so that what it asks is of the rows as they are now.
  useEffect(() => {
    askersOf(token)[level] = api;
  });
  // And forgotten once the wall is put away: see `walls`.
  useEffect(
    () => () => {
      const apis = askersOf(token);
      if (apis[level] != null) delete apis[level];
    },
    [level, token]
  );

  return (
    <View style={gridStyles.fill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <RowsList
          ref={list}
          data={rows}
          // As every list in the app: Android's own default here is the "addViewAt" crash (`lib/ui/lists.ts`).
          removeClippedSubviews={CLIP_SUBVIEWS}
          {...ROWS_KEPT}
          keyExtractor={(row) => row.key}
          contentContainerStyle={{ paddingTop: top, paddingBottom: bottom + 12 }}
          ListHeaderComponent={header}
          ListFooterComponent={footer ?? null}
          ListEmptyComponent={empty ?? null}
          getItemLayout={(_data, index) => ({
            length: rows[index]?.kind === 'head' ? headHeight : rowHeight,
            offset: offsets[index] ?? 0,
            index,
          })}
          // A screen's worth: some two and a bit widths down.
          initialNumToRender={Math.max(4, Math.ceil((width * 2.2) / Math.max(1, rowHeight)))}
          // Behind, only round what is in sight: each is scrolled as the fingers come down, and a wide window filled anew each time held the step up.
          windowSize={shown ? (dense ? 3 : 5) : 2}
          maxToRenderPerBatch={shown ? 10 : 40}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Where the scroll bar stands is followed from here natively: see `FastScroll`.
          onScroll={fast.onScrollEvent}
          onLayout={fast.onLayout}
          onContentSizeChange={fast.onContentSizeChange}
          scrollEventThrottle={16}
          renderItem={({ item: row }) =>
            row.kind === 'head' ? (
              <View style={[styles.head, { height: headHeight }]}>
                <Text style={[styles.headText, columns >= 8 && styles.headSmall]}>{row.label}</Text>
              </View>
            ) : dense ? (
              /*
                Hundreds of covers to a screen: one press for the row, and
                the cover where it was, and no more to each cover than its
                picture.
              */
              <Pressable
                style={[styles.row, { height: rowHeight, gap }]}
                onPress={(event) => {
                  const one = row.cells[cellAt(event.nativeEvent.locationX)];
                  if (one) onPress(one.item, one.at);
                }}
                onLongPress={
                  onLongPress
                    ? (event) => {
                        const one = row.cells[cellAt(event.nativeEvent.locationX)];
                        if (one) onLongPress(one.item, one.at);
                      }
                    : undefined
                }>
                {row.cells.map(({ item }) => (
                  /*
                    Nothing in a cover for a finger to land on: where it is
                    across the row is read against the row, and a touch that
                    landed in a cover was told where it was in that cover,
                    which was always somewhere in the row's first.
                  */
                  <View key={keyOf(item)} style={{ width: cell }} pointerEvents="none">
                    {renderCover(item, cell)}
                  </View>
                ))}
              </Pressable>
            ) : (
              <View style={[styles.row, { height: rowHeight }]}>
                {row.cells.map(({ item, at }) => (
                  <Pressable
                    key={keyOf(item)}
                    style={({ pressed }) => [{ width: cell }, pressed && styles.pressed]}
                    accessibilityRole="button"
                    // Named even where the wall is too close for names under the covers.
                    accessibilityLabel={[titleOf(item), detailOf?.(item)].filter(Boolean).join(', ')}
                    accessibilityActions={onLongPress && holdLabel ? [{ name: 'longpress', label: holdLabel }] : undefined}
                    onAccessibilityAction={
                      onLongPress &&
                      ((event) => {
                        if (event.nativeEvent.actionName === 'longpress') onLongPress(item, at);
                      })
                    }
                    onPress={() => onPress(item, at)}
                    onLongPress={onLongPress ? () => onLongPress(item, at) : undefined}>
                    {renderCover(item, cell)}
                    {named ? (
                      <>
                        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={2}>
                          {titleOf(item)}
                        </Text>
                        {detailOf ? (
                          <Text style={styles.detail} numberOfLines={1} maxFontSizeMultiplier={2}>
                            {detailOf(item) ?? ''}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )
          }
        />
      ) : null}
      {shown ? (
        <FastScroller
          fast={fast}
          count={rows.length}
          labelAt={(index) => rows[index]?.label ?? ''}
          coverAt={
            sleeveOf
              ? (index) => {
                  const row = rows[index]?.kind === 'row' ? rows[index] : rows[index + 1];
                  const first = row?.kind === 'row' ? row.cells[0] : undefined;
                  return first ? sleeveOf(first.item) : null;
                }
              : undefined
          }
          scrollTo={(offset) => list.current?.scrollToOffset({ offset, animated: false })}
          indexAt={rowAt}
          top={top}
          bottom={bottom}
        />
      ) : null}
    </View>
  );
}

/*
  A list whose scrolling the scroll bar follows natively (see `FastScroll`):
  React Native's own animated list, told it is the plain one, which its
  typings cannot say of a list of rows of any kind.
*/
const RowsList = Native.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

const gridStyles = StyleSheet.create({
  // A level grown past its edges as it goes is cut there, not drawn over what is above the list.
  box: { flex: 1, overflow: 'hidden' },
  level: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  fill: { flex: 1 },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    head: { justifyContent: 'flex-end', paddingHorizontal: PAD, paddingBottom: SPACE.xs },
    headText: { color: c.text, fontSize: TYPE.head, fontWeight: '800' },
    headSmall: { fontSize: TYPE.heading },
    row: { flexDirection: 'row', gap: GAP, paddingHorizontal: PAD },
    pressed: { opacity: 0.6 },
    title: { color: c.text, fontSize: TYPE.hint, fontWeight: '600', marginTop: SPACE.xs },
    detail: { color: c.textMuted, fontSize: TYPE.label },
  })
);
