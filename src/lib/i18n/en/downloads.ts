import { format } from './format.ts';

/**
 * The queue of downloads: its screen, the row that opens it, and the button
 * that floats over the app. What state a single download is in is said by
 * the search tab's lines, which were there first; see `statusLabel`.
 */
export const downloads = {
  /**
   * The queue in a few words, for a row's value and a button's name: how many
   * are being fetched and how many wait. Empty when there is nothing to say,
   * and a row then says nothing.
   */
  short: (underWay: number, waiting: number, paused: boolean) => {
    if (paused) return waiting > 0 ? `Paused · ${format.number(waiting)} waiting` : 'Paused';
    if (underWay > 0 && waiting > 0) return `${format.number(underWay)} downloading, ${format.number(waiting)} waiting`;
    if (underWay > 0) return `${format.number(underWay)} downloading`;
    return waiting > 0 ? `${format.number(waiting)} waiting` : '';
  },
  /** The same as a sentence, over the queue's own screen. */
  state: (underWay: number, waiting: number, paused: boolean) => {
    if (paused) return waiting > 0 ? `Paused, ${format.number(waiting)} waiting` : 'Paused';
    if (underWay > 0 && waiting > 0) return `Downloading ${format.number(underWay)}, ${format.number(waiting)} waiting`;
    if (underWay > 0) return `Downloading ${format.number(underWay)}`;
    return waiting > 0 ? `${format.number(waiting)} waiting` : 'Nothing is being downloaded';
  },
  pausedNote: 'Nothing new is started until you resume. What is already being downloaded finishes.',
  /** Said once, over the list, where any of Discover’s own are waiting. */
  automaticNote: (count: number) =>
    count === 1
      ? 'One download is automatic: Discover asked for it. It waits until nothing else is being fetched.'
      : `${format.number(count)} downloads are automatic: Discover asked for them. They wait until nothing else is being fetched.`,

  pause: 'Pause',
  resume: 'Resume',
  cancelAll: 'Cancel all',
  cancelAllQuestion: 'Cancel every download?',
  cancelAllHint: 'Everything waiting and everything being downloaded is cancelled. What is already in your library stays.',
  /** The way out of that question that cancels nothing. */
  keep: 'Keep them',

  sections: { now: 'Now', next: 'Up next', history: 'History' },
  /** Removes the finished ones from this list, and nothing from the phone. */
  clear: 'Clear',
  clearLabel: 'Clear the history of downloads',

  source: {
    discover: 'Discover',
    search: 'Search',
    album: (name: string) => `Album: ${name}`,
    playlist: (name: string) => `Playlist: ${name}`,
  },
  /** In place of a waiting job’s state, on one of Discover’s own. */
  automatic: 'Automatic · waits for the others',

  doNext: 'Do this next',
  doNextLabel: (title: string) => `Download ${title} next`,
  cancelLabel: (title: string) => `Cancel ${title}`,
  retryLabel: (title: string) => `Retry ${title}`,
  /** What the handle at the end of a waiting row is for, said to a screen reader. */
  moveUp: 'Move up',
  moveDown: 'Move down',

  empty: {
    heading: 'No downloads yet',
    body: 'What you download from Search, from Discover or to complete an album is listed here, with what is still waiting its turn.',
  },
  unavailable: 'Install a new Android build to download music.',
  readFailed: 'Could not read downloads.',

  /** The button that floats over the app, and what it opens. */
  button: {
    label: (state: string) => (state ? `Downloads: ${state}` : 'Downloads'),
    finished: 'finished',
    heading: 'Downloads',
    idle: 'Nothing is being downloaded right now',
    paused: 'Paused',
    allDone: 'All finished',
    waiting: (count: number) => `${format.number(count)} waiting`,
    done: (count: number) => `${format.number(count)} done`,
    failed: (count: number) => `${format.number(count)} failed`,
    open: 'Open downloads',
  },
};
