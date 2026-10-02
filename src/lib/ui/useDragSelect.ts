import { useCallback, useMemo, useRef } from 'react';
import { PanResponder, type View } from 'react-native';

/** How far in from a row's left edge the checkbox reaches. */
export const CHECKBOX_COLUMN = 52;

export type DragSelect = {
  /** Spread onto the view wrapping the list. */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  /** Give this to the wrapper so the gesture knows where the list begins. */
  wrapperRef: React.RefObject<View | null>;
  onWrapperLayout: () => void;
  onScroll: (offsetY: number) => void;
  onWidth: (width: number) => void;
};

/**
 * Dragging down a column of checkboxes to select a run of rows.
 *
 * One responder for the whole list rather than a handler per row: in React
 * Native the view a gesture begins in keeps it, so a row never hears about a
 * finger that started on its neighbour. Position is turned into an index
 * instead, which is why the rows have to be a fixed height.
 *
 * The gesture is claimed only when it starts over a checkbox. Anywhere else the
 * list scrolls, which is the whole reason a drag can select at all — the two
 * would otherwise be the same gesture over the same pixels.
 */
export function useDragSelect({
  ids,
  rowHeight,
  columns,
  enabled,
  selected,
  onChange,
}: {
  /** In the order they are drawn, so an index can be found from a position. */
  ids: string[];
  rowHeight: number;
  columns: number;
  enabled: boolean;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}): DragSelect {
  const wrapperRef = useRef<View | null>(null);
  const listTop = useRef(0);
  const listLeft = useRef(0);
  const listWidth = useRef(0);
  const scrollOffset = useRef(0);

  const anchor = useRef<number | null>(null);
  const deselects = useRef(false);
  const before = useRef<Set<string>>(new Set());

  // Mirrors for the responder, which is built once and would otherwise close
  // over whatever these were at the time.
  const idsRef = useRef(ids);
  const selectedRef = useRef(selected);
  const enabledRef = useRef(enabled);
  const columnsRef = useRef(columns);
  idsRef.current = ids;
  selectedRef.current = selected;
  enabledRef.current = enabled;
  columnsRef.current = columns;

  const onWrapperLayout = useCallback(() => {
    wrapperRef.current?.measureInWindow((x, y) => {
      listLeft.current = x;
      listTop.current = y;
    });
  }, []);

  const onScroll = useCallback((offsetY: number) => {
    scrollOffset.current = offsetY;
  }, []);

  const onWidth = useCallback((width: number) => {
    listWidth.current = width;
  }, []);

  const indexAt = useCallback((pageX: number, pageY: number) => {
    const across = columnsRef.current;
    const row = Math.floor((pageY - listTop.current + scrollOffset.current) / rowHeight);
    const columnWidth = (listWidth.current || 1) / across;
    const column = Math.min(
      Math.max(Math.floor((pageX - listLeft.current) / columnWidth), 0),
      across - 1
    );
    const index = row * across + column;
    return Math.min(Math.max(index, 0), idsRef.current.length - 1);
  }, [rowHeight]);

  /**
   * True when a touch lands on a checkbox rather than on the rest of a row.
   *
   * Measured across the window and taken back to the column the finger is over,
   * so the second column's checkboxes are as good a handle as the first's.
   */
  const overCheckbox = useCallback((pageX: number) => {
    const across = columnsRef.current;
    const columnWidth = (listWidth.current || 1) / across;
    const withinColumn = (pageX - listLeft.current) % columnWidth;
    return withinColumn >= 0 && withinColumn < CHECKBOX_COLUMN;
  }, []);

  const panHandlers = useMemo(() => {
    const apply = (to: number) => {
      const from = anchor.current;
      if (from === null) return;
      const [start, end] = from <= to ? [from, to] : [to, from];
      const next = new Set(before.current);
      for (let i = start; i <= end; i += 1) {
        const id = idsRef.current[i];
        if (!id) continue;
        if (deselects.current) next.delete(id);
        else next.add(id);
      }
      onChange(next);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (event) =>
        enabledRef.current && overCheckbox(event.nativeEvent.pageX),
      onMoveShouldSetPanResponder: (event) =>
        enabledRef.current && overCheckbox(event.nativeEvent.pageX),
      onPanResponderGrant: (event) => {
        const index = indexAt(event.nativeEvent.pageX, event.nativeEvent.pageY);
        const id = idsRef.current[index];
        if (!id) return;
        anchor.current = index;
        // Starting on something already chosen clears the run instead, which is
        // what every other list with checkboxes does.
        deselects.current = selectedRef.current.has(id);
        before.current = new Set(selectedRef.current);
        apply(index);
      },
      onPanResponderMove: (event) =>
        apply(indexAt(event.nativeEvent.pageX, event.nativeEvent.pageY)),
      onPanResponderRelease: () => {
        anchor.current = null;
      },
      onPanResponderTerminate: () => {
        anchor.current = null;
      },
    }).panHandlers;
  }, [indexAt, onChange, overCheckbox]);

  return { panHandlers, wrapperRef, onWrapperLayout, onScroll, onWidth };
}
