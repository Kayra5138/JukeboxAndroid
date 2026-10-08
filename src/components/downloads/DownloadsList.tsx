import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type CellRendererProps,
  type GestureResponderEvent,
} from 'react-native';

import { FinishedRow, NowRow, SectionHeading, sizesFor, WaitingRow, type Sizes } from './rows';
import { useT } from '../../lib/i18n/index';
import { rowShift } from '../../lib/player/queue';
import { edgePull, withinScroll } from '../../lib/ui/autoScroll';
import { dropOf, listOf, type QueueItem } from '../../lib/youtube/queueView';
import type { DownloadJob } from '../../lib/youtube/types';

type Drag = { from: number | null; to: number | null; step: number };

const DragContext = createContext<Drag>({ from: null, to: null, step: 0 });

/**
 * The slot a line of the list sits in, and how far it slides while a waiting
 * row is dragged past it.
 *
 * The queue of what is playing over again, see `QueueList`: the row in the
 * hand is hidden here and drawn as a copy over the list, its slot is left
 * standing, and the rows between where it was and where it will land slide
 * one over. By context, because the component a list builds its cells with
 * is part of the element's type and a new one would rebuild every row.
 */
function Cell({ index, style, children, onLayout }: CellRendererProps<QueueItem>) {
  const { from, to, step } = use(DragContext);
  const shift = from !== null && to !== null ? rowShift(index, from, to) : 0;
  return (
    <View
      onLayout={onLayout}
      style={[style, from === index && styles.hidden, shift !== 0 && { transform: [{ translateY: shift * step }] }]}>
      {children}
    </View>
  );
}

/** How tall a line of the list is, by what it is. */
function heightOf(item: QueueItem, sizes: Sizes): number {
  return item.kind === 'heading' ? sizes.heading : item.kind === 'now' ? sizes.now : sizes.row;
}

/** How often the list is nudged while a row is held at an edge. */
const PULL_TICK_MS = 16;

/**
 * How long a new order is shown on the screen's own say-so once the phone
 * has been told of it. The phone is read again every second while anything
 * waits, so by then it has answered, and what it says is what is shown.
 */
const TRUST_MS = 1500;

/**
 * Everything on the downloads screen below its heading: what is being
 * fetched, what waits — which can be dragged into another order — and what
 * has finished.
 *
 * One list. The history is as long as everything ever downloaded, and a list
 * inside a scroll view is as tall as all it holds, so every row of it would
 * be drawn at once.
 *
 * The dragging is the queue's, from `QueueList`, with the same parts: a hold
 * on the handle lifts a row and turns the list's scrolling off before
 * anything has moved, the finger's place on the screen becomes a place in
 * the list through the fixed height of a row, and holding the row at an edge
 * pulls the list past it. Written again and not shared because that one is
 * a list of tracks through and through, and is not to be disturbed.
 *
 * Two things are different here. Only some of the rows can be moved, and
 * only among themselves — the ones asked for by hand that are still waiting
 * — so a landing place is held to where those are. And the list changes
 * under the finger, since the queue goes on being worked through: when what
 * is in the hand is no longer where it was picked up from, it is put down.
 */
export function DownloadsList({
  all,
  header,
  empty,
  edge,
  onCancel,
  onRetry,
  onMove,
  onClear,
}: {
  all: readonly DownloadJob[];
  header: ReactNode;
  /** Shown under the header when there is no job of any kind. */
  empty: ReactNode;
  /** The room to leave at the sides and the foot for what is not screen. */
  edge: { left: number; right: number; bottom: number };
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onMove: (id: string, beforeId: string | null) => Promise<void>;
  onClear: () => void;
}) {
  const t = useT();
  const { fontScale } = useWindowDimensions();
  const sizes = sizesFor(fontScale);

  /* The order somebody has just made, shown until the phone has had its say. */
  const [order, setOrder] = useState<string[] | null>(null);
  const { items, movable } = listOf(all, order);
  const starts: number[] = [];
  let length = 0;
  for (const item of items) {
    starts.push(length);
    length += heightOf(item, sizes);
  }

  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [liftedTop, setLiftedTop] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));

  const fromRef = useRef<number | null>(null);
  const toRef = useRef<number | null>(null);
  const heldId = useRef<string | null>(null);
  /* Whether the drag has been given the gesture yet, which takes a first movement. */
  const taken = useRef(false);
  const grabbedAt = useRef(0);
  const fingerAt = useRef(0);
  const scrolled = useRef(0);
  const grabbedScroll = useRef(0);
  const frame = useRef<View>(null);
  const frameTop = useRef(0);
  const viewport = useRef(0);
  const content = useRef(0);
  const headerRef = useRef(0);
  const pulling = useRef<ReturnType<typeof setInterval> | null>(null);
  const scroll = useRef<FlatList<QueueItem>>(null);
  /*
    What the list is showing, for the handlers: they are handed to the rows
    once and never made again, or every row would be drawn again each time
    the phone was read, and so they cannot hold any of this themselves.
  */
  const latest = useRef({ items, movable, starts, step: sizes.row, onMove });
  useEffect(() => {
    latest.current = { items, movable, starts, step: sizes.row, onMove };
  });

  const stopPulling = () => {
    if (pulling.current) clearInterval(pulling.current);
    pulling.current = null;
  };

  // Never writes the offset back to nought; see `QueueList` for the frame
  // that would show. It is zeroed when the next row is picked up.
  const clearDrag = () => {
    stopPulling();
    fromRef.current = null;
    toRef.current = null;
    heldId.current = null;
    setFrom(null);
    setTo(null);
  };

  /** Puts the lifted row under the finger and works out what it is over. */
  const place = () => {
    const start = fromRef.current;
    if (start === null) return;
    const { movable: range, step } = latest.current;
    // The copy answers to the finger alone; which slot it is over is a
    // question about the list, and there the list's own travel counts too.
    const travelled = fingerAt.current - grabbedAt.current;
    offset.setValue(travelled);
    const carried = travelled + (scrolled.current - grabbedScroll.current);
    const landing = Math.min(
      Math.max(start + Math.round(carried / step), range.first),
      range.first + range.count - 1
    );
    if (landing !== toRef.current) {
      toRef.current = landing;
      setTo(landing);
    }
  };

  /** Scrolls the list while the row is held near an edge, on a timer: a finger held still sends nothing. */
  const pullFrom = (at: number) => {
    if (edgePull(at, frameTop.current, viewport.current) === 0) return stopPulling();
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

  /**
   * Puts the waiting row at one place in the list at another: on the screen
   * at once, and on the phone as "before this one", which is how the phone
   * is told.
   */
  const reorder = (start: number, landing: number) => {
    const { items: shown, movable: range, onMove: tell } = latest.current;
    const ids = shown.slice(range.first, range.first + range.count).map((item) => item.key);
    const drop = dropOf(ids, start - range.first, landing - range.first);
    if (!drop) return;
    const next = drop.order;
    setOrder(next);
    const settle = () => setTimeout(() => setOrder((held) => (held === next ? null : held)), TRUST_MS);
    void tell(drop.id, drop.beforeId).then(settle, settle);
  };

  const [lift] = useState(() => (id: string, pageY: number) => {
    const { items: shown, movable: range, starts: tops } = latest.current;
    const index = shown.findIndex((item) => item.kind === 'waiting' && item.key === id);
    if (index < range.first || index >= range.first + range.count) return;
    // Asked for as the drag begins and not when the list was laid out, which
    // may have been while the screen was still sliding in.
    frame.current?.measureInWindow((_x, y) => {
      frameTop.current = y;
    });
    grabbedAt.current = pageY;
    fingerAt.current = pageY;
    grabbedScroll.current = scrolled.current;
    setLiftedTop(headerRef.current + (tops[index] ?? 0) - scrolled.current);
    fromRef.current = index;
    toRef.current = index;
    heldId.current = id;
    taken.current = false;
    offset.setValue(0);
    setFrom(index);
    setTo(index);
  });

  const [front] = useState(() => (id: string) => {
    const { items: shown, movable: range } = latest.current;
    const index = shown.findIndex((item) => item.kind === 'waiting' && item.key === id);
    if (index > range.first) reorder(index, range.first);
  });

  const [nudge] = useState(() => (id: string, by: number) => {
    const { items: shown, movable: range } = latest.current;
    const index = shown.findIndex((item) => item.kind === 'waiting' && item.key === id);
    const landing = index + by;
    if (index >= range.first && landing >= range.first && landing < range.first + range.count) reorder(index, landing);
  });

  /*
    A handle held and let go without the finger having moved at all. The
    gesture only comes to this list at a first movement, so no release would
    ever arrive here and the row would stay in the air with the list unable
    to scroll. The handle says it has been let go; if the drag had taken the
    gesture by then, that is the handle losing it, and nothing to do.
  */
  const [letGo] = useState(() => () => {
    if (fromRef.current !== null && !taken.current) clearDrag();
  });

  const drop = () => {
    const start = fromRef.current;
    const landing = toRef.current;
    // In one batch with the end of the drag, so that the row is drawn once,
    // already in its new place.
    if (start !== null && landing !== null && start !== landing) reorder(start, landing);
    clearDrag();
  };

  /*
    The queue moved on while a row was in the hand: the job that was being
    fetched finished and the next began, or the held one was cancelled from
    the notification. The places the drag was counting in are no longer the
    list's, so the row is put down where it was. It can be picked up again.
  */
  const held = from !== null ? items[from] : undefined;
  const adrift = from !== null && (held?.kind !== 'waiting' || from < movable.first || from >= movable.first + movable.count);
  const heldKey = held?.key;
  useEffect(() => {
    if (fromRef.current === null) return;
    // `clearDrag` is not asked after: it touches only refs and setters.
    if (adrift || heldKey !== heldId.current) clearDrag();
  }, [adrift, heldKey]);

  // A timer outliving the list it scrolls would be reaching for nothing.
  useEffect(
    () => () => {
      if (pulling.current) clearInterval(pulling.current);
    },
    []
  );

  const said = t.downloads;

  return (
    /*
      The gesture is taken here, round the list, and only once a row is in
      the hand. Granting it is also what takes it away from the scroll view
      for good: see the long note in `QueueList`, which this follows to the
      letter except that the handlers are the view's own and not a
      PanResponder's, which is the same handlers under another name.
    */
    <View
      ref={frame}
      style={styles.fill}
      onMoveShouldSetResponder={() => fromRef.current !== null}
      onResponderTerminationRequest={() => false}
      // True is "keep the native side out of it", as a PanResponder answers.
      onResponderGrant={() => {
        taken.current = true;
        return true;
      }}
      onResponderMove={(event: GestureResponderEvent) => {
        if (fromRef.current === null) return;
        // The raw place of the finger and not a travelled distance, which
        // has been seen to jump backwards in the middle of a drag.
        fingerAt.current = event.nativeEvent.pageY;
        place();
        pullFrom(fingerAt.current);
      }}
      onResponderRelease={drop}
      onResponderTerminate={clearDrag}>
      <DragContext value={{ from, to, step: sizes.row }}>
        <FlatList
          ref={scroll}
          data={items}
          keyExtractor={(item) => item.key}
          CellRendererComponent={Cell}
          scrollEnabled={from === null}
          contentContainerStyle={{
            paddingLeft: edge.left,
            paddingRight: edge.right,
            paddingBottom: edge.bottom + 32,
          }}
          ListHeaderComponent={
            <View
              onLayout={(event) => {
                headerRef.current = event.nativeEvent.layout.height;
                setHeaderHeight(event.nativeEvent.layout.height);
              }}>
              {header}
            </View>
          }
          ListEmptyComponent={<>{empty}</>}
          getItemLayout={(_data, index) => ({
            length: items[index] ? heightOf(items[index], sizes) : 0,
            offset: headerHeight + (starts[index] ?? length),
            index,
          })}
          initialNumToRender={12}
          windowSize={7}
          onScroll={(event) => {
            scrolled.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onLayout={(event) => {
            viewport.current = event.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_width, height) => {
            content.current = height;
          }}
          renderItem={({ item, index }) =>
            item.kind === 'heading' ? (
              <SectionHeading
                title={t.format.upper(said.sections[item.section])}
                height={sizes.heading}
                // Clearing is the history's and nothing else's: what is
                // waiting is cancelled, a row at a time or all at once above.
                action={item.section === 'history' ? said.clear : undefined}
                actionLabel={said.clearLabel}
                onAction={item.section === 'history' ? onClear : undefined}
              />
            ) : item.kind === 'now' ? (
              <NowRow job={item.job} height={sizes.now} onCancel={onCancel} />
            ) : item.kind === 'waiting' ? (
              <WaitingRow
                job={item.job}
                height={sizes.row}
                next={item.next}
                lifted={from === index}
                onLift={lift}
                onFront={front}
                onStep={nudge}
                onLetGo={letGo}
                onCancel={onCancel}
              />
            ) : (
              <FinishedRow job={item.job} height={sizes.row} onRetry={onRetry} />
            )
          }
        />
      </DragContext>

      {/* The row in the hand, drawn over the list and not in it: the list is
          entitled to stop drawing a row that has been scrolled far away. */}
      {from !== null && held?.kind === 'waiting' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.held,
            { top: liftedTop, left: edge.left, right: edge.right, height: sizes.row, transform: [{ translateY: offset }] },
          ]}>
          <WaitingRow job={held.job} height={sizes.row} next={held.next} lifted />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /* Left standing so the rows around it still have somewhere to slide to. */
  hidden: { opacity: 0 },
  held: { position: 'absolute', zIndex: 2, elevation: 2 },
});
