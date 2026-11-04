import { createStore } from './store.ts';

/**
 * Whether a long list is being scrolled: the finger on it, or the list still
 * running on after the finger left it.
 *
 * For work that redraws a great deal and can as well wait a moment, which is
 * the colours of a record taking over the whole app: asked for at the moment
 * a song starts, which is often when somebody is scrolling, it was every row
 * drawn again under the finger, and the list caught.
 */
const moving = createStore(false);

/** How long after the finger leaves a list it may yet run on: the list says within this if it does. */
const RUNS_ON_MS = 150;

/** However long a list seems to be moving, what waits for it waits no longer: one taken off the screen mid-run never says it stopped. */
const LONGEST_WAIT_MS = 15_000;

let stopping: ReturnType<typeof setTimeout> | null = null;

function stopped(): void {
  if (stopping != null) clearTimeout(stopping);
  stopping = null;
  moving.set(false);
}

function going(): void {
  if (stopping != null) clearTimeout(stopping);
  stopping = null;
  moving.set(true);
}

/** Spread on a list long enough to be scrolled for a while. */
export const followsScrolling = {
  onScrollBeginDrag: going,
  onMomentumScrollBegin: going,
  onMomentumScrollEnd: stopped,
  onScrollEndDrag: () => {
    if (stopping != null) clearTimeout(stopping);
    stopping = setTimeout(stopped, RUNS_ON_MS);
  },
};

/**
 * Runs [work] once no list is moving: at once, where none is. Answers with
 * how to call it off.
 */
export function whenStill(work: () => void): () => void {
  if (!moving.get()) {
    work();
    return () => {};
  }
  let waiting = true;
  const finish = () => {
    if (!waiting) return;
    waiting = false;
    unsubscribe();
    clearTimeout(limit);
    work();
  };
  const unsubscribe = moving.subscribe(() => {
    if (!moving.get()) finish();
  });
  const limit = setTimeout(finish, LONGEST_WAIT_MS);
  return () => {
    waiting = false;
    unsubscribe();
    clearTimeout(limit);
  };
}
