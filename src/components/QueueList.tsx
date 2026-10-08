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
import { Image } from 'expo-image';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type CellRendererProps,
  type GestureResponderEvent,
} from 'react-native';

import { PlayIcon } from './Icons';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import { indexAfterMove, indexAfterRemove, rowShift } from '../lib/player/queue';
import { makeStyles, outlined } from '../lib/theme/index';
import { edgePull, withinScroll } from '../lib/ui/autoScroll';
import type { Track } from '../lib/types';

export const QUEUE_ROW_HEIGHT = 56;

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
}: {
  track: Track;
  index: number;
  playing: boolean;
  lifted: boolean;
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
      style={[styles.row, lifted && styles.rowLifted]}
      accessibilityRole="button"
      accessibilityState={{ selected: playing }}
      // A long press is not something a screen reader's user can be expected
      // to find by trying. Named, it is in the reader's own list of actions.
      accessibilityActions={onMenu ? [{ name: 'longpress', label: t.library.trackMenu }] : undefined}
      onAccessibilityAction={
        onMenu
          ? (event) => {
              if (event.nativeEvent.actionName === 'longpress') onMenu(index);
            }
          : undefined
      }
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
          <Text style={styles.grip}>≡</Text>
        </Pressable>
      ) : onLift ? (
        <Text style={styles.grip}>≡</Text>
      ) : null}
    </Pressable>
  );
});

/** How long a hold has to last before it lifts a row. Shorter than a menu's. */
const LIFT_AFTER_MS = 220;

/** Out to the row's own edges, and no further left than the cross's own reach. */
const GRIP_SLOP = { top: 18, bottom: 18, left: 2, right: 16 };

const REMOVE_SLOP = { top: 8, bottom: 8, left: 12, right: 10 };

/** What the copy in the hand does when pressed, which it cannot be. */
const nothing = () => {};

type Drag = { from: number | null; to: number | null };

/** How often the list is nudged while a row is held at an edge. */
const PULL_TICK_MS = 16;

const DragContext = createContext<Drag>({ from: null, to: null });

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
function QueueCell({ index, style, children, ...rest }: CellRendererProps<Track>) {
  const { from, to } = use(DragContext);
  const styles = useStyles();
  const dragging = from === index;
  const shift = from !== null && to !== null ? rowShift(index, from, to) : 0;

  // `onFocusCapture` is not forwarded: it exists to highlight separators around
  // a focused row, and there are no separators here.
  return (
    <Animated.View
      onLayout={rest.onLayout}
      style={[
        style,
        styles.slot,
        dragging && styles.hidden,
        shift !== 0 && { transform: [{ translateY: shift * QUEUE_ROW_HEIGHT }] },
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
}) {
  const styles = useStyles();
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const offset = useRef(new Animated.Value(0)).current;
  const fromRef = useRef<number | null>(null);
  const toRef = useRef<number | null>(null);
  const grabbedAt = useRef(0);
  const scroll = useRef<FlatList<Track>>(null);
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
  const lengthRef = useRef(queue.length);
  lengthRef.current = queue.length;
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
  /* The latest of what the screen passed in, for the same handlers. */
  const handlers = useRef({ onSelect, onRemove, onLongPress });
  handlers.current = { onSelect, onRemove, onLongPress };

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
      Math.max(start + Math.round(carried / QUEUE_ROW_HEIGHT), 0),
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
    const step = edgePull(at, frameTop.current, viewport.current);
    if (step === 0) return stopPulling();
    if (pulling.current) return;
    pulling.current = setInterval(() => {
      const speed = edgePull(fingerAt.current, frameTop.current, viewport.current);
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
          if (start === landing) return clearDrag();

          // A drag past the playing row renumbers it; the reader is looking at
          // the row they just dropped and is owed no scroll.
          const playing = currentRef.current;
          if (playing >= 0) expectIndex(indexAfterMove(playing, start, landing));

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
          onMove?.(start, landing);
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
    setLiftedTop(headerRef.current + index * QUEUE_ROW_HEIGHT - scrolled.current);
    fromRef.current = index;
    toRef.current = index;
    offset.setValue(0);
    setFrom(index);
    setTo(index);
    // Refs, setters and an animated value, none of which is ever replaced.
  }, [offset]);

  const select = useCallback((index: number) => handlers.current.onSelect(index), []);

  const menu = useCallback((index: number) => {
    // A hold that lands as a drag is ending, or with a row still in the hand,
    // belongs to the drag.
    if (fromRef.current === null) handlers.current.onLongPress?.(index);
  }, []);

  const remove = useCallback((index: number) => {
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

  // A timer outliving the list it scrolls would be reaching for a ref nobody
  // is reading any more.
  useEffect(() => () => stopPulling(), []);

  /** Open on the track being played; the rest of the queue is a scroll away. */
  const anchorToCurrent = (animated: boolean) => {
    if (fromRef.current !== null) return;
    scroll.current?.scrollToOffset({
      offset: Math.max(0, headerRef.current + (currentIndex - 1) * QUEUE_ROW_HEIGHT),
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
    return queue.map((track) => {
      const nth = seen.get(track.id) ?? 0;
      seen.set(track.id, nth + 1);
      return `${track.id}#${nth}`;
    });
  }, [queue]);

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
      <DragContext value={{ from, to }}>
        <FlatList
          ref={scroll}
          data={queue}
          keyExtractor={(_track, index) => keys[index] ?? String(index)}
          CellRendererComponent={QueueCell}
          scrollEnabled={from === null}
          contentContainerStyle={styles.list}
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
            length: QUEUE_ROW_HEIGHT,
            offset: headerHeight + QUEUE_ROW_HEIGHT * index,
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
          renderItem={({ item, index }) => (
            <QueueRow
              track={item}
              index={index}
              playing={index === currentIndex}
              lifted={from === index}
              onPress={select}
              onLift={onMove ? lift : undefined}
              onMenu={onLongPress ? menu : undefined}
              onRemove={onRemove ? remove : undefined}
            />
          )}
        />
      </DragContext>

      {/*
        The row in the hand, drawn over the list rather than inside it.

        Outside the list because the list is entitled to unmount any row far
        enough off screen, and a drag that scrolls takes the held row exactly
        there. Its own slot stays where it was and stays empty; this is what
        the finger is actually carrying.
      */}
      {from !== null && queue[from] ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.held,
            { top: liftedTop, height: QUEUE_ROW_HEIGHT, transform: [{ translateY: offset }] },
          ]}>
          <QueueRow
            track={queue[from]}
            index={from}
            playing={from === currentIndex}
            lifted
            onPress={nothing}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  /* Left standing so the rows around it still have somewhere to slide to. */
  hidden: { opacity: 0 },
  held: { position: 'absolute', left: 0, right: 0, zIndex: 2, elevation: 2 },
  fill: { flex: 1 },
  list: { paddingBottom: 24 },
  slot: { height: QUEUE_ROW_HEIGHT },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: QUEUE_ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  rowLifted: { backgroundColor: c.surfaceRaised, borderRadius: 8, ...outlined(c) },
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
