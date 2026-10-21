import type { EnrichedTrack } from '../media/enriched.ts';
import type { Track } from '../types.ts';
import { decodeLibrary, encodeLibrary } from './cache.ts';
import { shownTracks, type Hiding } from './hiding.ts';
import { keepIdentity } from './reconcile.ts';

/**
 * The library, read once and shown everywhere.
 *
 * Every screen that lists tracks used to read the whole of it for itself, on
 * every visit: all the rows out of the media store and across to JavaScript,
 * both of the app's own tables in full, the one laid over the other. What came
 * of it was nearly always the library that was already on screen, made again
 * out of new objects, so everything drawn from it was drawn again as well.
 *
 * Here it is read by one reader and held, and the screens are told when it
 * changes. Looking again is still asked for as freely as before — on every
 * visit, after everything the app does to a file — but looking is now two
 * small questions, and the reading only follows when one of them says so:
 *
 *  - whether the files are as they were, which the media store answers with a
 *    short string made from the rows without sending them ({@link
 *    LibraryDeps.stamp});
 *  - whether the app's own tables have been written to, which the database
 *    answers with a count ({@link LibraryDeps.overlay}).
 *
 * What is held is never trusted further than that. A first look in the life
 * of the process reads everything whatever the questions say, since nothing
 * held from before can be vouched for; so does a look that is forced, and a
 * look for which either question cannot be answered. What was written down
 * for the next start ({@link LibraryDeps.kept}) is shown only until that
 * first reading comes back, and says so for as long ({@link
 * LibraryState.confirmed}).
 *
 * Everything this touches is handed in, so that the deciding can be tested
 * without a phone: `index.ts` is where the real media store and the real
 * database are put behind it.
 */

export type LibraryState =
  /** Nothing to show yet, and still asking. */
  | { kind: 'loading' }
  /** The app may not read audio. */
  | { kind: 'denied' }
  /** The library could not be read, and there was none on show to keep. */
  | { kind: 'error'; message: string }
  | {
      kind: 'library';
      tracks: EnrichedTrack[];
      /**
       * False while this is only what was written down the last time the app
       * ran, and the device has not yet said it is still so. True from the
       * first reading that came back, and from then on.
       */
      confirmed: boolean;
      /**
       * Why the last look at the device did not finish, or null when it did.
       *
       * The tracks are then the ones from the last look that did: a library
       * that was true a moment ago is a better thing to leave on screen than
       * an error where it was, and the next look clears this or says it again.
       */
      failure: string | null;
    };

export type LibraryDeps = {
  /** Whether the app may read audio, asking for leave where it can still be asked. */
  permitted(): Promise<boolean>;
  /** The folder the library is read from, as it is set at this moment. */
  root(): string;
  /** Every track under [root], off the device. */
  scan(root: string): Promise<Track[]>;
  /**
   * Something that stays the same for as long as {@link scan} would answer the
   * same, or null when that cannot be said — which is taken to mean it would
   * not.
   */
  stamp(root: string): Promise<string | null>;
  /**
   * What is left out of the library of what the device has under [root]:
   * folders switched off and files too short to be music (`hiding.ts`), or
   * null where nothing is. Asked on every look, and cheap to ask.
   *
   * Applied to what the device said and not asked of the device, so that
   * what is read and written down stays the whole of the folder. Changing
   * what is left out is then a look like any other: the device need not be
   * read again, nothing written down is out of date, and letting a folder
   * back in brings it back on the spot. A throw is taken as nothing left out.
   */
  hiding?(): Hiding | null;
  /** The tracks with what the app knows about them laid over. */
  merge(tracks: Track[]): EnrichedTrack[];
  /**
   * Something that moves whenever what {@link merge} reads has been written
   * to, or null when that cannot be said.
   */
  overlay(): number | null;
  /**
   * The library as last written down, for the next start of the app: read as
   * the words that were written, and null when there are none. Any of the
   * three may throw, and a throw is a library not kept and nothing more.
   */
  kept: {
    read(): string | null;
    write(words: string): void;
    clear(): void;
  };
  /**
   * Does [work] once whatever is being drawn has been. Writing the library
   * down is for the next start of the app and nobody is waiting on it, while
   * the list it describes is on its way to the screen at that very moment.
   */
  later(work: () => void): void;
};

export type LibraryStore = {
  state(): LibraryState;
  /** Told after every change of {@link state}. Answers with how to stop being told. */
  subscribe(listener: () => void): () => void;
  /**
   * Looks at the device again, and reads the library if it has changed.
   *
   * [force] reads it whether or not it seems to have. Never rejects: what
   * went wrong is in the state. Settles once a look that began after the call
   * has finished, so whoever waits for it then reads a state at least as new
   * as their asking.
   */
  refresh(force?: boolean): Promise<void>;
};

const LOADING: LibraryState = { kind: 'loading' };
const DENIED: LibraryState = { kind: 'denied' };

export function createLibraryStore(deps: LibraryDeps): LibraryStore {
  let state: LibraryState = LOADING;
  const listeners = new Set<() => void>();

  /**
   * What the device last said, and of which folder. Null until it has said
   * anything in this process — what was written down by an earlier one is
   * [written], and is not this.
   */
  let device: { root: string; tracks: Track[]; stamp: string | null } | null = null;
  /**
   * What the tracks on show were put together from: the device's tracks, and
   * the count {@link LibraryDeps.overlay} gave at the time. While both still
   * hold, putting them together again would make the same thing.
   */
  let mergedFrom: Track[] | null = null;
  let mergedAt: number | null = null;
  /** What is written down for the next start, as far as is known: the tracks and their folder. */
  let written: { root: string; tracks: Track[] } | null = null;
  /**
   * The tracks last let into the library, what they were let in from, and
   * by which rule. While the device's list and the rule are both the same,
   * so is what is let in, and it is the same list, so that it can be told
   * from {@link mergedFrom} without being merged again.
   */
  let letIn: { from: Track[]; key: string | null; tracks: Track[] } | null = null;

  const publish = (next: LibraryState) => {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };

  /** The tracks on show, or none. */
  const shown = (): EnrichedTrack[] => (state.kind === 'library' ? state.tracks : []);

  /** Of the device's [tracks], the ones the library shows. */
  const shownOf = (tracks: Track[]): Track[] => {
    const hiding = deps.hiding ? quietly(deps.hiding) : null;
    const key = hiding?.key ?? null;
    if (letIn && letIn.from === tracks && letIn.key === key) return letIn.tracks;
    let shown = tracks;
    try {
      shown = shownTracks(tracks, hiding);
    } catch {
      // A rule that cannot be applied leaves nothing out. A library with too
      // much in it is a nuisance; one with songs missing for no reason is not
      // something anybody can put right.
    }
    // Another rule that lets in the same tracks — a folder switched off that
    // holds nothing — lets in the same list, and nothing is merged again.
    if (letIn && letIn.from === tracks && sameEntries(letIn.tracks, shown)) shown = letIn.tracks;
    letIn = { from: tracks, key, tracks: shown };
    return shown;
  };

  /** Puts [tracks] on show, as the same objects wherever they say what is already there. */
  const show = (tracks: Track[], confirmed: boolean) => {
    // Asked before the tables are read and not after, so a write that lands
    // in between is one the next look still finds.
    const count = quietly(deps.overlay);
    const merged = keepIdentity(shown(), deps.merge(tracks));
    mergedFrom = tracks;
    mergedAt = count;
    settle(merged, confirmed);
  };

  /**
   * Says the library is [tracks], without a failure. Says nothing at all when
   * that is already what is said: a look that found everything as it was
   * should not so much as wake the screens.
   */
  const settle = (tracks: EnrichedTrack[], confirmed: boolean) => {
    if (
      state.kind === 'library' &&
      state.tracks === tracks &&
      state.confirmed === confirmed &&
      state.failure === null
    ) {
      return;
    }
    publish({ kind: 'library', tracks, confirmed, failure: null });
  };

  /** Writes down what the device said, if it is not what is written down already. */
  const keep = (root: string, tracks: Track[]) => {
    if (written?.root === root && written.tracks === tracks) return;
    try {
      // An empty library is not kept. It is shown, because it is what the
      // device said; but it is also what a card taken out looks like, and a
      // start that opens on nothing teaches less than one that opens on a
      // spinner for the moment it takes to ask.
      if (tracks.length === 0) deps.kept.clear();
      else deps.kept.write(encodeLibrary(root, tracks));
      written = { root, tracks };
    } catch {
      // Not kept this time. The next reading that differs tries again.
      written = null;
    }
  };

  const look = async (force: boolean) => {
    try {
      // The spinner is for having nothing to show. A library on screen stays
      // there while it is looked at again, and keeps the reader's place.
      if (state.kind !== 'library') publish(LOADING);

      if (!(await deps.permitted())) {
        // Nothing held is shown without leave to read it, and nothing held is
        // believed afterwards either.
        device = null;
        mergedFrom = null;
        publish(DENIED);
        return;
      }

      const root = deps.root();

      if (device === null && state.kind !== 'library') {
        const before = quietly(() => decodeLibrary(deps.kept.read(), root));
        if (before) {
          written = { root, tracks: before };
          show(shownOf(before), false);
        }
      }

      // Before the reading, so that a file changing while it is read makes
      // the next stamp differ from this one instead of agreeing with a
      // reading that missed it.
      const stamp = await deps.stamp(root).catch(() => null);
      const read =
        force || device === null || device.root !== root || stamp === null || stamp !== device.stamp;

      if (read) {
        const scanned = await deps.scan(root);
        // Made out of the tracks already held wherever it says the same, so
        // that a reading which found nothing new is the held list itself and
        // is neither merged again nor written down again.
        const before =
          device?.root === root ? device.tracks : written?.root === root ? written.tracks : [];
        const tracks = keepIdentity(before, scanned);
        device = { root, tracks, stamp };
        deps.later(() => keep(root, tracks));
      }
      if (device === null) return;

      const shown = shownOf(device.tracks);
      const count = quietly(deps.overlay);
      if (
        state.kind === 'library' &&
        shown === mergedFrom &&
        count !== null &&
        count === mergedAt
      ) {
        settle(state.tracks, true);
      } else {
        show(shown, true);
      }
    } catch (error) {
      const message = String(error);
      if (state.kind === 'library') {
        if (state.failure !== message) publish({ ...state, failure: message });
      } else {
        publish({ kind: 'error', message });
      }
    }
  };

  let running: Promise<void> | null = null;
  /** Asked for while a look was under way: whether to look once more after it, and how hard. */
  let again: { force: boolean } | null = null;

  const asked = () => again;

  const refresh = (force = false): Promise<void> => {
    if (running) {
      // A look already begun may have asked its questions before whatever
      // prompted this one happened, so it is not an answer to it.
      again = { force: force || (again?.force ?? false) };
      return running;
    }
    // Marked as running before the first look begins and not after: a look
    // tells the screens as it goes, and a screen told may ask to look again
    // on the spot.
    let done!: () => void;
    const run = new Promise<void>((resolve) => {
      done = resolve;
    });
    running = run;
    void (async () => {
      let next: { force: boolean } | null = { force };
      while (next) {
        again = null;
        // A look says what went wrong in the state. Anything that gets past
        // that is a listener's own trouble, and must not leave this waiting
        // for good.
        await look(next.force).catch(() => undefined);
        next = asked();
      }
      running = null;
      done();
    })();
    return run;
  };

  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
  };
}

/** The answer, or null where asking threw. */
function quietly<T>(ask: () => T | null): T | null {
  try {
    return ask();
  } catch {
    return null;
  }
}

/** Whether two lists hold the very same objects in the same order. */
function sameEntries<T>(left: readonly T[], right: readonly T[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((entry, at) => entry === right[at]);
}
