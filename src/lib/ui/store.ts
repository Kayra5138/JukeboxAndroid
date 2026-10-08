/**
 * One value that is held for the life of the app and can be watched.
 *
 * For the handful of choices that everything on screen depends on at once —
 * the language, the theme — and that have to be readable outside React as well
 * as inside it. A context would do the second half and not the first: a line
 * of text made in a module that is not a component has no tree to ask.
 *
 * Nothing here knows about React or the database, so whatever is built on it
 * can still be imported by a test. The shape is the one `useSyncExternalStore`
 * wants, which is how components come to be redrawn when the value changes.
 */
export type Store<T> = {
  get: () => T;
  set: (value: T) => void;
  /** Answers with the way to stop being told. */
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
