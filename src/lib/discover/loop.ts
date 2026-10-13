/**
 * The turning of the handle: an event in, the state it makes, the things to
 * do about it out.
 *
 * `core.ts` says what an event comes to and `engine.ts` does the things. In
 * between is this, which is nothing but order and care: one event at a time
 * however they arrive, the state written down when it is a different state,
 * everybody watching told, and then the things done. It knows nothing of
 * Discover — it is handed the deciding and the doing — so that the part of
 * the engine most likely to go wrong in a way nobody sees can be run on a
 * desk, with a clock and a store that are whatever a test says they are.
 *
 * WHAT MUST NOT BE ABLE TO HAPPEN. Everything Discover does comes through
 * here, so anything that could stop here stops all of it until the app is
 * closed. An event that cannot be taken — the deciding threw — is dropped
 * and said so, and the next is taken. One watcher that throws does not keep
 * the others from being told. One thing that cannot be done does not keep
 * the rest from being done. And "an event is being taken" is never left
 * standing by any of them, which is what it was left as before: one
 * exception, and every tap after it was put in a queue nobody was reading.
 */
export type LoopParts<S, E, F> = {
  /** The state to start from. Asked for once, the first time it is needed. */
  boot: () => S;
  /** Events to take straight after starting, before anything else that is waiting. */
  first?: () => E[];
  reduce: (state: S, event: E, now: number) => { state: S; effects: F[] };
  /**
   * Writes down what differs between the state as it is and as it was last
   * written. Called only when the state is a different object. If it throws,
   * nothing is taken to have been written, and the next change is compared
   * with the same "last written" again.
   */
  persist: (state: S, written: S) => void;
  run: (effect: F) => void;
  now: () => number;
  /** After every round, whatever came of it: for setting the one timer. */
  settled?: (state: S) => void;
  warn?: (error: unknown) => void;
};

export type Loop<S, E> = {
  dispatch: (event: E) => void;
  /** The state, started if it had not been. */
  state: () => S;
  /** The state if there is one, and null where nothing has needed it yet. */
  peek: () => S | null;
  /** Told after every change. Answers with the way to stop being told. */
  subscribe: (listener: () => void) => () => void;
  watched: () => boolean;
};

export function createLoop<S, E, F>(parts: LoopParts<S, E, F>): Loop<S, E> {
  const warn = parts.warn ?? ((error: unknown) => console.warn(error));
  const listeners = new Set<() => void>();
  /** Events that arrived while one was being taken, in the order they came. */
  const waiting: E[] = [];
  let state: S | null = null;
  let written: S | null = null;
  let taking = false;

  function started(): S {
    if (state !== null) return state;
    const made = parts.boot();
    state = made;
    written = made;
    // Ahead of whatever is waiting: what they bring is what was so before anything was asked.
    if (parts.first) waiting.unshift(...parts.first());
    return made;
  }

  function carefully(work: () => void): void {
    try {
      work();
    } catch (error) {
      warn(error);
    }
  }

  function dispatch(event: E): void {
    waiting.push(event);
    if (taking) return;
    taking = true;
    const effects: F[] = [];
    let before: S | null = null;
    try {
      before = started();
      let next: E | undefined;
      while ((next = waiting.shift()) !== undefined) {
        const taken = next;
        carefully(() => {
          const out = parts.reduce(state as S, taken, parts.now());
          state = out.state;
          effects.push(...out.effects);
        });
      }
    } catch (error) {
      // It could not be started. Nothing that was waiting can be taken, and none of it is kept to pile up.
      waiting.length = 0;
      warn(error);
    } finally {
      taking = false;
    }
    const now = state;
    if (now === null) return;
    if (now !== before) {
      try {
        parts.persist(now, written as S);
        written = now;
      } catch (error) {
        // Not written this time. What is in memory is still right, and the next change writes all of it.
        warn(error);
      }
      for (const told of [...listeners]) carefully(told);
    }
    for (const effect of effects) carefully(() => parts.run(effect));
    carefully(() => parts.settled?.(now));
  }

  return {
    dispatch,
    state: started,
    peek: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    watched: () => listeners.size > 0,
  };
}
