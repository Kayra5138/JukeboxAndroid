import {
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Image } from './Picture';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type CellRendererProps,
  type GestureResponderEvent,
} from 'react-native';

import { PlayIcon } from './Icons';
import { MoreButton } from './MoreButton';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import { dividerAt, queueIndex, queueMove, shownIndex } from '../lib/player/autoplay/section';
import { indexAfterMove, indexAfterRemove, rowShift } from '../lib/player/queue';
import { laid, makeStyles, outlined, useColours, withAlpha } from '../lib/theme/index';
import { glassOf } from '../lib/theme/Veil';
import { announce } from '../lib/ui/announce';
import { edgePull, withinScroll } from '../lib/ui/autoScroll';
import type { Track } from '../lib/types';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

/**
 * How tall a row is: 56 at the phone's ordinary size of writing, and taller as
 * that size is turned up. The two lines of a row take some thirty-one points
 * of it, and those grow with the writing while the rest does not; a row that
 * stayed 56 cut its second line in half from a little over 1.8 times the size.
 *
 * One height for every row all the same, worked out from the setting rather
 * than measured, because the list lays itself out by arithmetic and a drag
 * finds the slot under the finger the same way. Held to twice the size, which
 * is as large as Android's setting goes.
 */
export function queueRowHeight(fontScale: number): number {
  const scale = Math.min(Math.max(fontScale, 1), 2);
  return Math.round(25 + 31 * scale);
}

/** That height, for the rows and the slots they stand in; see `queueRowHeight`. */
const RowHeightContext = createContext(queueRowHeight(1));

/**
 * One row, drawn again only when something about that row changed.
 *
 * The list above it is drawn again far more often than any row has reason to
 * be: once for every slot a dragged row crosses, and once whenever the player
 * moves on. Each of those used to redraw every row in the window, because every
 * row was handed functions made for it on the spot and so never looked the same
 * twice. The row is told where it is instead and given the list's own handlers,
 * which do not change, and says its position back when it calls them.
 */
const QueueRow = memo(function QueueRow({
  track,
  index,
  playing,
  lifted,
  onPress,
  onLift,
  onMenu,
  onRemove,
  onStep,
  first,
  last,
}: {
  track: Track;
  index: number;
  playing: boolean;
  lifted: boolean;
  /** Moves the row one place, for a screen reader; absent where the list has no order of its own. */
  onStep?: (index: number, by: 1 | -1) => void;
  /** Whether the row is at either end, where one of the two moves has nowhere to go. */
  first?: boolean;
  last?: boolean;
  onPress: (index: number) => void;
  /** Absent on a list that holds no order of its own; the row cannot be lifted. */
  onLift?: (index: number, pageY: number) => void;
  /** Absent where the screen has no menu for a track; see the row's two holds. */
  onMenu?: (index: number) => void;
  /** Absent when nothing can be taken out; the cross is not drawn. */
  onRemove?: (index: number) => void;
}) {
  const artwork = useTrackArtwork(track);
  const t = useT();
  const styles = useStyles();
  const height = use(RowHeightContext);

  /*
    Two things a held row can mean, and one finger to say it with.

    Holding a row used to lift it, anywhere on the row, because there was
    nothing else a hold could be. Now there is the track's menu, which is what
    a hold means on every other row of tracks in the app — so the row's body
    opens the menu, after the same wait as in the library, and lifting is the
    handle's: the mark at the end that was always drawn to say "this moves".
    They are two pressables, one inside the other, and a touch belongs to the
    innermost one it lands on, so neither can be mistaken for the other and
    there is no moment at which both are waiting.

    Where the screen has no menu the whole row lifts, as it always did.
  */
  const liftFrom = onLift
    ? (event: GestureResponderEvent) => onLift(index, event.nativeEvent.pageY)
    : undefined;

  return (
    <Pressable
      style={[styles.row, { height }, lifted && styles.rowLifted]}
      accessibilityRole="button"
      accessibilityState={{ selected: playing }}
      // A long press is not something a screen reader's user can be expected
      // to find by trying. Named, it is in the reader's own list of actions —
      // and so is moving the row, which by hand is a drag by the handle and
      // which a reader has no way to do at all.
      accessibilityActions={[
        ...(onMenu ? [{ name: 'longpress', label: t.library.trackMenu }] : []),
        ...(onStep && !first ? [{ name: 'moveUp', label: t.common.moveUp }] : []),
        ...(onStep && !last ? [{ name: 'moveDown', label: t.common.moveDown }] : []),
      ]}
      onAccessibilityAction={(event) => {
        const name = event.nativeEvent.actionName;
        if (name === 'longpress') onMenu?.(index);
        else if (name === 'moveUp') onStep?.(index, -1);
        else if (name === 'moveDown') onStep?.(index, 1);
      }}
      onPress={() => onPress(index)}
      onLongPress={onMenu ? () => onMenu(index) : liftFrom}
      delayLongPress={onMenu ? undefined : LIFT_AFTER_MS}>
      <View style={styles.mark}>{playing ? <PlayIcon size={8} /> : null}</View>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" />
      ) : (
        <View style={[styles.art, styles.artEmpty]} />
      )}
      <View style={styles.text}>
        <Text style={[styles.title, playing && styles.titlePlaying]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist ?? t.common.unknownArtist}
        </Text>
      </View>
      {/*
        Both only where they lead somewhere. A record's running order and a
        list read from a tag are not anybody's arrangement, and a cross that
        does nothing and a handle that will not lift are two promises the
        screen cannot keep.
      */}
      {onMenu ? <MoreButton onPress={() => onMenu(index)} /> : null}
      {onRemove ? (
        <Pressable
          style={styles.remove}
          accessibilityRole="button"
          // Named with the track: every row has one of these, and "remove"
          // alone does not say what from.
          accessibilityLabel={t.player.queue.remove(track.title)}
          onPress={() => onRemove(index)}
          // The cross is a small mark in a tall row. Reached for and missed,
          // it plays the track instead.
          hitSlop={REMOVE_SLOP}>
          <Text style={styles.removeLabel}>×</Text>
        </Pressable>
      ) : null}
      {onLift && onMenu ? (
        <Pressable
          // Tapped, it is still part of the row. Only the hold is its own.
          onPress={() => onPress(index)}
          onLongPress={liftFrom}
          delayLongPress={LIFT_AFTER_MS}
          // The mark is a few points wide in a row a finger's height tall, and
          // a hold that misses it now opens a menu instead of doing nothing.
          hitSlop={GRIP_SLOP}
          // The row says everything there is to say; this is how it is moved
          // by hand, which is not something to stop at on the way past.
          accessible={false}>
          <Text style={styles.grip} importantForAccessibility="no">≡</Text>
        </Pressable>
      ) : onLift ? (
        <Text style={styles.grip} importantForAccessibility="no">≡</Text>
      ) : null}
    </Pressable>
  );
});

/** How long a hold has to last before it lifts a row. Shorter than a menu's. */
const LIFT_AFTER_MS = 220;

/** Out to the row's own edges, and no further left than the cross's own reach. */
const GRIP_SLOP = { top: 18, bottom: 18, left: 2, right: 16 };

/*
  The cross is a few points wide; this brings what will take a press for it to
  48 each way. Further to the left than the right, because to the right is the
  handle, and the two are not to reach for the same spot.
*/
const REMOVE_SLOP = { top: 10, bottom: 10, left: 16, right: 10 };

/** What the copy in the hand does when pressed, which it cannot be. */
const nothing = () => {};

type Drag = { from: number | null; to: number | null };

/**
 * The heading over the picked songs, as a row of the list.
 *
 * A row like any other as far as the list is concerned, and as tall: the list
 * lays itself out, and a drag finds the slot under the finger, by multiplying
 * a row's number by one height, and a heading of another height would put
 * every row after it in the wrong place. It is never lifted. The rows on
 * screen are told apart from the queue's positions by `section.ts`.
 */
const DIVIDER = { divider: true } as const;
type Row = Track | typeof DIVIDER;
const isDivider = (row: Row): row is typeof DIVIDER => 'divider' in row;

/** How often the list is nudged while a row is held at an edge. */
const PULL_TICK_MS = 16;

const DragContext = createContext<Drag>({ from: null, to: null });

/**
 * How many rows there are where they are to stand on a plate, and nought
 * where they are not.
 *
 * A page of glass with rows written straight onto it has nothing of its own:
 * the rows hang in front of whatever is behind, out of focus, and read as
 * part of it. A plate under them is what makes the page a thing with the
 * list on it. The list is drawn a row at a time, so the plate is too: every
 * row brings its own strip of it, the first and last with the corners, and
 * strips that touch are one sheet.
 */
const PlateContext = createContext(0);

/**
 * The slot a row sits in, and how far it slides while another row is dragged.
 *
 * The row being dragged is not drawn here at all — it is hidden, and a copy is
 * drawn over the list instead. It used to be this cell, translated, which
 * worked until the list began scrolling underneath a drag: a cell far enough
 * outside the viewport is unmounted by the list, and the row vanished from
 * under the finger while its drop went on working perfectly.
 *
 * Its slot is still left standing, and that is what makes the layout come out.
 * Everything between the row's old place and its new one slides one over,
 * closing the gap it came from and opening the one it will land in.
 *
 * The drag arrives by context because the component a list builds its cells
 * with is part of the element type: hand it a new function when the drag moves
 * and every row is unmounted and rebuilt, which blanks the covers.
 */
function QueueCell({ index, style, children, ...rest }: CellRendererProps<Row>) {
  const { from, to } = use(DragContext);
  const styles = useStyles();
  const dragging = from === index;
  const shift = from !== null && to !== null ? rowShift(index, from, to) : 0;
  const rows = use(PlateContext);
  const height = use(RowHeightContext);
  const plate = rows > 0 ? [styles.plate, index === 0 && styles.plateTop, index === rows - 1 && styles.plateFoot] : null;

  // `onFocusCapture` is not forwarded: it exists to highlight separators around
  // a focused row, and there are no separators here.
  return (
    <Animated.View
      onLayout={rest.onLayout}
      style={[
        style,
        { height },
        plate,
        dragging && styles.hidden,
        shift !== 0 && { transform: [{ translateY: shift * height }] },
      ]}>
      {children}
    </Animated.View>
  );
}

/**
 * The queue: scrollable, and reorderable by holding a row and dragging it —
 * by its handle, where holding the row itself opens a menu instead.
 *
 * Scrolling and dragging both want the same vertical gesture, and on Android a
 * scroll view claims one natively — once it has, JavaScript cannot take it
 * back. They are kept apart in time instead: the long press that lifts a row
 * disables scrolling before any movement happens, so the scroll view never
 * enters the contest and the drag is uncontested for as long as it lasts.
 *
 * Virtualised, because the queue is however much of the library was playing —
 * tapping one track in a large one hands the whole filtered list over, and
 * every row opens its own file looking for a cover. The drag survives that
 * because none of it depends on the rows existing: a finger position becomes an
 * index through the fixed row height, and the rows it passes are the ones on
 * screen, which are exactly the ones a window keeps mounted.
 *
 * `header` and `footer` scroll with the rows, for a screen that has more on it
 * than the list. They go inside rather than the list going inside a scroll
 * view with them: a list within a scroll view is as tall as everything it
 * holds, so all of it counts as on screen and every row is mounted at once.
 */
export function QueueList({
  queue,
  currentIndex,
  onSelect,
  onMove,
  onRemove,
  onLongPress,
  header,
  footer,
  plate = false,
  divider,
  inset = 0,
  foot = 0,
}: {
  queue: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  /** Both absent on a list whose order and membership are not the user's. */
  onMove?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  /**
   * A row held down, for the screen's menu of that track. Where there is one,
   * a row is lifted by its handle and not by its body.
   */
  onLongPress?: (index: number) => void;
  header?: ReactNode;
  footer?: ReactNode;
  /** Stand the rows on a plate, where screens are glass: see `PlateContext`. Nothing in any other theme. */
  plate?: boolean;
  /**
   * A heading drawn above the row at queue position `at`, the height of a
   * row: the songs picked to keep the music going. Every position handed back
   * is the queue's, never a row's on screen.
   */
  divider?: { at: number; element: ReactNode };
  /**
   * How much of the list's top a heading of glass is laid over, so that the
   * rows can pass under it and still start clear of it at rest; see
   * `UnderBars`. Nought, and nothing changed, where nothing is.
   */
  inset?: number;
  /**
   * The same at the list's foot: how much of its bottom a bar of glass is
   * laid over, so that the rows pass under it and the last of them can still
   * be scrolled clear of it. Nought, and nothing changed, where nothing is.
   */
  foot?: number;
}) {
  const styles = useStyles();
  const c = useColours();
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const offset = useRef(new Animated.Value(0)).current;
  const fromRef = useRef<number | null>(null);
  const toRef = useRef<number | null>(null);
  const grabbedAt = useRef(0);
  const scroll = useRef<FlatList<Row>>(null);
  /*
    The rows on screen: the queue, and the heading among it where there is
    one. Everything below that counts rows — the drag, the scroll, the slots —
    counts these; everything that leaves the list is turned back into a queue
    position first.
  */
  const shownDivider = divider ? dividerAt(divider.at, queue.length) : -1;
  const rows = useMemo<Row[]>(
    () => (shownDivider < 0 ? queue : [...queue.slice(0, shownDivider), DIVIDER, ...queue.slice(shownDivider)]),
    [queue, shownDivider]
  );
  /*
    What the list is showing, and where it is on the screen.

    The drag used to assume neither could change while a finger was down, which
    was true only because the list could not move. Now that holding a row at an
    edge scrolls it, both the row's position and the slot it is over have to be
    worked out against a list that is moving underneath.
  */
  const scrolled = useRef(0);
  const grabbedScroll = useRef(0);
  const frame = useRef<View>(null);
  const frameTop = useRef(0);
  const fingerAt = useRef(0);
  const pulling = useRef<ReturnType<typeof setInterval> | null>(null);
  const anchored = useRef(false);
  const viewport = useRef(0);
  const content = useRef(0);
  const lengthRef = useRef(rows.length);
  lengthRef.current = rows.length;
  const { fontScale } = useWindowDimensions();
  const rowHeight = queueRowHeight(fontScale);
  // Read by the responder, which is made once and would otherwise keep the
  // height of the size of writing the list was first drawn at.
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;
  const currentRef = useRef(currentIndex);
  currentRef.current = currentIndex;
  /*
    How much sits above the first row. A row's place is its number times the
    row height only when the rows start at the top, and under a header they do
    not: the list needs it to know where a row is without drawing it, and the
    copy in the hand needs it to be drawn where the row was.

    In state for the list, which has to be told again when it changes, and in a
    ref for the handlers, which are made once.
  */
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef(0);
  /*
    The room kept over everything for a heading laid over the list, which
    every row's place starts below just as it does below a header. Not a part
    of the header, since that is measured and this is told; a ref for the
    handlers as well.
  */
  const insetRef = useRef(inset);
  insetRef.current = inset;
  const footRef = useRef(foot);
  footRef.current = foot;
  /* The latest of what the screen passed in, for the same handlers. */
  const handlers = useRef({ onSelect, onRemove, onLongPress, onMove, count: queue.length, divider: shownDivider });
  handlers.current = { onSelect, onRemove, onLongPress, onMove, count: queue.length, divider: shownDivider };

  /*
    Where the playing row is about to be renumbered to by an edit made here.

    Editing the queue moves that number without the player going anywhere: take
    a row out above the playing one and the same track carries on, one position
    lower. The reader is somewhere else entirely when they do it — scrolled down
    to prune the tail — and anchoring on that would drag them back to the
    playing track on every deletion, which is the last thing wanted from an ×.
  */
  const expected = useRef<number | null>(null);

  const expectIndex = (next: number) => {
    // Only what will actually arrive as a change, or the prediction outlives
    // the edit and swallows a later anchor that happens to land on it.
    if (next !== currentRef.current) expected.current = next;
  };

  /*
    Note what this does *not* do: it never writes the offset back to zero.
    `Animated.Value.setValue` goes straight to the native view, outside React's
    commit, so the row would jump back to its old slot immediately while the
    reordered queue only arrived with the next commit — a visible frame later.
    Ending the drag here instead drops the row's `transform` altogether, which
    React applies in the same commit as everything else. The offset is zeroed
    when the next row is picked up.
  */
  const clearDrag = () => {
    stopPulling();
    fromRef.current = null;
    toRef.current = null;
    setFrom(null);
    setTo(null);
  };

  const stopPulling = () => {
    if (pulling.current) clearInterval(pulling.current);
    pulling.current = null;
  };

  /**
   * Puts the lifted row under the finger and works out what it is over.
   *
   * Both from the same figure: how far the row has travelled through the
   * *list*, which is what the finger has done plus what the list has done
   * underneath it. Measuring only the finger would leave the row sliding away
   * from it as soon as the list started moving, and the row would be dropped
   * somewhere other than where it appeared to be.
   */
  const place = () => {
    const start = fromRef.current;
    if (start === null) return;
    /*
      Two different questions, and the list's own movement only answers one.

      The copy drawn over the list follows the finger and nothing else: it was
      lifted off the list, so the list sliding underneath does not carry it.
      Which slot it is *over*, though, is a question about the list, and there
      the distance the list has travelled counts as much as the finger's.
    */
    const travelled = fingerAt.current - grabbedAt.current;
    offset.setValue(travelled);
    const carried = travelled + (scrolled.current - grabbedScroll.current);
    const landing = Math.min(
      Math.max(start + Math.round(carried / rowHeightRef.current), 0),
      lengthRef.current - 1
    );
    if (landing !== toRef.current) {
      toRef.current = landing;
      setTo(landing);
    }
  };

  /**
   * Scrolls the list while the row is held near an edge.
   *
   * On a timer rather than driven by the finger: the request is to keep going
   * while it is held there, and a finger held still sends no events at all.
   *
   * The offset is advanced from this side's own figure instead of waiting to be
   * told what it became. `onScroll` is throttled, so reading it back would
   * sometimes answer with the position two ticks ago and step twice over the
   * same ground.
   */
  const pullFrom = (at: number) => {
    // The edges are those of what can be seen: a finger over the heading laid
    // over the top, or the bar laid over the foot, is over rows that cannot,
    // and is pulling towards them.
    const seen = () => viewport.current - insetRef.current - footRef.current;
    const step = edgePull(at, frameTop.current + insetRef.current, seen());
    if (step === 0) return stopPulling();
    if (pulling.current) return;
    pulling.current = setInterval(() => {
      const speed = edgePull(fingerAt.current, frameTop.current + insetRef.current, seen());
      if (speed === 0 || fromRef.current === null) return stopPulling();
      const next = withinScroll(scrolled.current + speed, content.current, viewport.current);
      if (next === scrolled.current) return;
      scrolled.current = next;
      scroll.current?.scrollToOffset({ offset: next, animated: false });
      place();
    }, PULL_TICK_MS);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => fromRef.current !== null,
        // A lifted row keeps the gesture until the finger lifts. Without this
        // the scroll view is free to ask for it back mid-drag, and the default
        // answer is yes — the drag ends and the row drops back where it began.
        onPanResponderTerminationRequest: () => false,
        /*
          This reaches the list's ancestors, not the list. Granting the
          responder calls `requestDisallowInterceptTouchEvent(true)` on the
          parent of the view the handlers sit on (SurfaceMountingManager
          .setJSResponder → JSResponderHandler), and that flag only travels
          upwards — the scroll view is now a descendant of that view and is no
          longer covered. It stays on because the sheet above still is.

          The scroll view is covered by the other half of the same grant: a
          React view group intercepts touches from its own children while it is
          the JS responder, block or no block, so the gesture leaves the scroll
          view as soon as the responder is granted here.

          Neither reaches back before the grant, and nor did either arrangement
          before: the window between the long press and `scrollEnabled={false}`
          reaching native is held by nothing. Read off the 0.86 sources and not
          watched on a phone — it wants a drag on hardware to settle.
        */
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (event) => {
          if (fromRef.current === null) return;
          /*
            The raw touch coordinate rather than `gestureState.dy`. That figure
            is accumulated from a history of touch samples, and it was observed
            jumping backwards part way through an unbroken downward drag —
            taking the row with it, back to where the drag began. The finger's
            position on the screen cannot do that.
          */
          fingerAt.current = event.nativeEvent.pageY;
          place();
          pullFrom(fingerAt.current);
        },
        onPanResponderRelease: () => {
          const start = fromRef.current;
          const landing = toRef.current;
          if (start === null || landing === null) return clearDrag();
          // Rows on screen, as a move in the queue: the heading is in the one and not the other.
          const move = queueMove(start, landing, handlers.current.divider);
          if (!move) return clearDrag();

          // A drag past the playing row renumbers it; the reader is looking at
          // the row they just dropped and is owed no scroll.
          const playing = currentRef.current;
          if (playing >= 0) expectIndex(indexAfterMove(playing, move.from, move.to));

          /*
            The reorder and the end of the drag have to reach the screen
            together. `onMove` reorders the queue synchronously, so calling it
            here puts both in the same batch and the row is drawn once, already
            in its new place.

            Ending the drag any later — even in a layout effect waiting for the
            reordered queue — leaves one frame rendered with the new order but
            the old drag positions, which paints the lifted row's highlight on
            whichever row inherited its index and leaves a gap where it was.
            React Native draws on its own thread, so there is no ordering that
            reliably hides such a frame; it has to not exist.
          */
          onMove?.(move.from, move.to);
          clearDrag();
        },
        onPanResponderTerminate: clearDrag,
      }),
    // clearDrag and expectIndex only touch refs and setters, all stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offset, onMove]
  );

  /**
   * Where the held copy is drawn from, in the frame's own coordinates.
   *
   * Fixed when the row is picked up. The list's position drops out of it
   * entirely — the copy answers to the finger — so this is simply where the
   * row was at that moment, and the finger's travel is added on top.
   */
  const [liftedTop, setLiftedTop] = useState(0);

  const lift = useCallback((index: number, pageY: number) => {
    /*
      Where the list is on the screen, asked for as the drag begins rather than
      when the list was laid out.

      It lives in a sheet that slides up from the bottom of the window, and a
      measurement taken at layout is of wherever that sheet happened to be
      mid-animation — it came back as 1396 against a window 851 tall, so every
      finger looked as though it were above the list and the pull was always
      upwards, against a list already at the top, which is to say nothing moved.
      By the time a row is being lifted the sheet has long settled.
    */
    frame.current?.measureInWindow((_x, y) => { frameTop.current = y; });
    grabbedAt.current = pageY;
    fingerAt.current = pageY;
    grabbedScroll.current = scrolled.current;
    setLiftedTop(insetRef.current + headerRef.current + index * rowHeightRef.current - scrolled.current);
    fromRef.current = index;
    toRef.current = index;
    offset.setValue(0);
    setFrom(index);
    setTo(index);
    // Refs, setters and an animated value, none of which is ever replaced.
  }, [offset]);

  // A row says its number on screen; the screen is told the queue's.
  const select = useCallback((row: number) => {
    const index = queueIndex(row, handlers.current.divider);
    if (index >= 0) handlers.current.onSelect(index);
  }, []);

  const menu = useCallback((row: number) => {
    const index = queueIndex(row, handlers.current.divider);
    // A hold that lands as a drag is ending, or with a row still in the hand,
    // belongs to the drag.
    if (fromRef.current === null && index >= 0) handlers.current.onLongPress?.(index);
  }, []);

  const remove = useCallback((row: number) => {
    const index = queueIndex(row, handlers.current.divider);
    if (index < 0) return;
    // Only a row above the playing one renumbers it, so only that case needs
    // predicting. Removing the playing row leaves the index where it is —
    // except when it was the last row, and then the jump to nothing is worth
    // following.
    if (index < currentRef.current) {
      expectIndex(indexAfterRemove(currentRef.current, index));
    }
    handlers.current.onRemove?.(index);
    // expectIndex only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    A row moved one place by a screen reader, which cannot drag. The same move
    a drag ends in, with the same care for the playing row's number, and then
    said aloud: the reader's attention stays where the row was, which now holds
    a different track, so where the moved one went has to be told.
  */
  const t = useT();
  const step = useCallback(
    (row: number, by: 1 | -1) => {
      const { onMove: move, count } = handlers.current;
      // One place in the queue, whatever stands between on screen.
      const index = queueIndex(row, handlers.current.divider);
      if (index < 0) return;
      const landing = index + by;
      if (!move || landing < 0 || landing >= count) return;
      const playing = currentRef.current;
      if (playing >= 0) expectIndex(indexAfterMove(playing, index, landing));
      move(index, landing);
      announce(t.player.queue.movedTo(landing + 1, count));
    },
    // expectIndex only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  // A timer outliving the list it scrolls would be reaching for a ref nobody
  // is reading any more.
  useEffect(() => () => stopPulling(), []);

  /**
   * Open on the track being played; the rest of the queue is a scroll away.
   *
   * The room kept for a heading laid over the list does not come into it: it
   * moves the row and the top of what can be seen alike.
   */
  const anchorToCurrent = (animated: boolean) => {
    if (fromRef.current !== null) return;
    scroll.current?.scrollToOffset({
      offset: Math.max(0, headerRef.current + (shownIndex(currentIndex, shownDivider) - 1) * rowHeight),
      animated,
    });
  };

  /*
    Anchoring needs both a list to scroll and somewhere to scroll it. The queue
    starts closed, so the rows exist long before the viewport has any height —
    waiting only on the content would scroll a list that is nought pixels tall
    and leave it at the top once it opened.
  */
  const anchorWhenReady = () => {
    if (anchored.current || viewport.current <= 0 || content.current <= 0) return;
    anchored.current = true;
    anchorToCurrent(false);
  };

  // Only a change the player made moves the list. An edit made here has said in
  // advance where it renumbers the playing row to, and that is not a move.
  useEffect(() => {
    const ours = expected.current === currentIndex;
    expected.current = null;
    if (!ours && anchored.current) anchorToCurrent(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  /*
    Keyed by which appearance of the track this is rather than by position, so
    reordering does not change any row's identity. Position would: every row
    between the two ends of a move gets a new key, the list rebuilds it, and its
    cover blanks out while it is fetched again. Repeated tracks trade places
    among themselves, which is unnoticeable because they are the same track.
  */
  const keys = useMemo(() => {
    const seen = new Map<string, number>();
    return rows.map((row) => {
      if (isDivider(row)) return 'picked';
      const nth = seen.get(row.id) ?? 0;
      seen.set(row.id, nth + 1);
      return `${row.id}#${nth}`;
    });
  }, [rows]);

  return (
    /*
      The responder wraps the list rather than sitting inside it. A gesture is
      offered to every view above the one it started on, so a lifted row's drag
      still arrives here; the scroll view it now passes through on the way is
      the one already turned off.
    */
    <View
      ref={frame}
      style={styles.fill}
      {...responder.panHandlers}>
      <RowHeightContext value={rowHeight}>
      <DragContext value={{ from, to }}>
      <PlateContext value={plate && glassOf(c) > 0 ? rows.length : 0}>
        <FlatList
                  removeClippedSubviews={CLIP_SUBVIEWS}
          ref={scroll}
          data={rows}
          keyExtractor={(_track, index) => keys[index] ?? String(index)}
          CellRendererComponent={QueueCell}
          scrollEnabled={from === null}
          contentContainerStyle={
            inset > 0 || foot > 0
              ? [styles.list, inset > 0 && { paddingTop: inset }, foot > 0 && { paddingBottom: LIST_FOOT + foot }]
              : styles.list
          }
          ListHeaderComponent={
            header ? (
              <View
                onLayout={(event) => {
                  headerRef.current = event.nativeEvent.layout.height;
                  setHeaderHeight(headerRef.current);
                }}>
                {header}
              </View>
            ) : null
          }
          ListFooterComponent={footer ? <>{footer}</> : null}
          getItemLayout={(_data, index) => ({
            length: rowHeight,
            offset: inset + headerHeight + rowHeight * index,
            index,
          })}
          /*
            Covers are read out of the files, so keep that to what is on screen.
            Rows are not clipped away as they leave it, the way the library's
            are: a lifted row is drawn outside the slot it still occupies, and
            clipping goes by the slot.
          */
          initialNumToRender={12}
          windowSize={5}
          onScroll={(event) => {
            scrolled.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onLayout={(event) => {
            viewport.current = event.nativeEvent.layout.height;
            anchorWhenReady();
          }}
          onContentSizeChange={(_width, contentHeight) => {
            content.current = contentHeight;
            anchorWhenReady();
          }}
          renderItem={({ item, index }) => {
            if (isDivider(item)) return <View style={{ height: rowHeight }}>{divider?.element}</View>;
            const position = queueIndex(index, shownDivider);
            return (
              <QueueRow
                track={item}
                index={index}
                playing={position === currentIndex}
                lifted={from === index}
                onPress={select}
                onLift={onMove ? lift : undefined}
                onStep={onMove ? step : undefined}
                first={position === 0}
                last={position === queue.length - 1}
                onMenu={onLongPress ? menu : undefined}
                onRemove={onRemove ? remove : undefined}
              />
            );
          }}
        />
      </PlateContext>
      </DragContext>

      {/*
        The row in the hand, drawn over the list rather than inside it.

        Outside the list because the list is entitled to unmount any row far
        enough off screen, and a drag that scrolls takes the held row exactly
        there. Its own slot stays where it was and stays empty; this is what
        the finger is actually carrying.
      */}
      {from !== null && rows[from] && !isDivider(rows[from]) ? (
        <Animated.View
          pointerEvents="none"
          // A copy of a row the list still has; a screen reader is told of that one.
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.held,
            { top: liftedTop, height: rowHeight, transform: [{ translateY: offset }] },
          ]}>
          <QueueRow
            track={rows[from]}
            index={from}
            playing={queueIndex(from, shownDivider) === currentIndex}
            lifted
            onPress={nothing}
          />
        </Animated.View>
      ) : null}
      </RowHeightContext>
    </View>
  );
}

/** The room under the last row, so that it is not hard against whatever ends the list. */
const LIST_FOOT = 24;

const useStyles = makeStyles((c) => StyleSheet.create({
  /* Left standing so the rows around it still have somewhere to slide to. */
  hidden: { opacity: 0 },
  held: { position: 'absolute', left: 0, right: 0, zIndex: 2, elevation: 2 },
  fill: { flex: 1 },
  list: { paddingBottom: LIST_FOOT },
  /*
    A strip of the plate: the colour a raised card comes to on the page, most
    of the way to solid, so that it is plainly in front of what is behind and
    still lets the light of it through; and a line of light down each side.
  */
  plate: {
    marginHorizontal: 10,
    backgroundColor: withAlpha(laid(c.surfaceRaised, c.bg), 0.66),
    borderColor: c.borderStrong,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  plateTop: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: StyleSheet.hairlineWidth },
  plateFoot: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  /*
    One flat colour, whatever the theme writes its surfaces in. The rows it is
    carried over go on sliding about underneath, and through a fill of glass
    every one of them would be read through the row in the hand.
  */
  rowLifted: { backgroundColor: laid(c.surfaceRaised, c.bg), borderRadius: 8, ...outlined(c) },
  mark: { width: 12, alignItems: 'center' },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  art: { width: 36, height: 36, borderRadius: 4 },
  artEmpty: { backgroundColor: c.surfaceRaised },
  text: { flex: 1, gap: 1 },
  title: { color: c.textSecondary, fontSize: 14 },
  titlePlaying: { color: c.text },
  artist: { color: c.textFaint, fontSize: 11.5 },
  remove: { paddingHorizontal: 6, paddingVertical: 4 },
  removeLabel: { color: c.textFaint, fontSize: 18, lineHeight: 20 },
  grip: { color: c.textDisabled, fontSize: 18, paddingHorizontal: 4 },
}));
