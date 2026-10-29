import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * The back key, as one stack of things it can close.
 *
 * Anything that opens over what was there before — a selection, a search
 * typed into a list, a panel, a sheet, a drawer in a screen — says so while
 * it is open, and a press of back closes the one opened last: the way out is
 * the way in, backwards. Only when nothing is open does the press go on to
 * the navigator, which goes back a screen or leaves the app.
 *
 * One listener for all of them, rather than one each. Android asks its
 * listeners newest first, which is the order they were registered in and
 * not the order things were opened in: a screen's own listener, registered
 * when it was first drawn, would be asked before a player opened over it
 * later. Here the order is when each was opened.
 */
type Layer = { close: () => void };

const open: Layer[] = [];
let listening: { remove: () => void } | null = null;

function listen(): void {
  if (listening) return;
  listening = BackHandler.addEventListener('hardwareBackPress', () => {
    const top = open[open.length - 1];
    if (!top) return false;
    top.close();
    return true;
  });
}

/**
 * While [active], a press of back calls [close] instead of going anywhere,
 * unless something opened after it is open too. [close] is read when the
 * press comes, so it may change from one render to the next without the
 * layer losing its place.
 *
 * A screen's layer should be active only while the screen is in front
 * (`useIsFocused`): a selection left on a tab behind another is not what the
 * press is about.
 */
export function useBack(active: boolean, close: () => void): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!active) return;
    const layer: Layer = { close: () => latest.current() };
    open.push(layer);
    listen();
    return () => {
      const at = open.indexOf(layer);
      if (at >= 0) open.splice(at, 1);
    };
  }, [active]);
}
