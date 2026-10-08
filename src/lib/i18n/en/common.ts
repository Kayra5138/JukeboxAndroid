import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/**
 * Words that many screens say the same way.
 *
 * Kept short on purpose. A word belongs here when it is the same word wherever
 * it appears — Cancel, Save, a count of tracks — and not merely when two
 * screens happen to use the same English for different things, which the next
 * language may well need two wordings for.
 */
export const common = {
  cancel: 'Cancel',
  save: 'Save',
  done: 'Done',
  ok: 'OK',
  close: 'Close',
  back: 'Back',
  delete: 'Delete',
  remove: 'Remove',
  add: 'Add',
  edit: 'Edit',
  rename: 'Rename',
  yes: 'Yes',
  no: 'No',
  tryAgain: 'Try again',
  /** On a button beside one thing that failed, where `tryAgain` ends a sentence about it. */
  retry: 'Retry',
  import: 'Import',
  clear: 'Clear',
  selectAll: 'Select all',
  /** A setting that is not on, and the choice that turns one off. */
  off: 'Off',
  saved: 'Saved.',
  loading: 'Loading…',

  search: 'Search',
  clearSearch: 'Clear the search',

  play: 'Play',
  pause: 'Pause',
  nextTrack: 'Next track',
  previousTrack: 'Previous track',
  shuffle: 'Shuffle',
  addToQueue: 'Add to queue',

  unknownArtist: 'Unknown artist',
  unknownAlbum: 'Unknown album',

  tracks: (count: number) => `${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}`,
  songs: (count: number) => `${format.number(count)} ${oneOrMany(count, 'song', 'songs')}`,
  albums: (count: number) => `${format.number(count)} ${oneOrMany(count, 'album', 'albums')}`,
  artists: (count: number) => `${format.number(count)} ${oneOrMany(count, 'artist', 'artists')}`,
  lists: (count: number) => `${format.number(count)} ${oneOrMany(count, 'list', 'lists')}`,
  files: (count: number) => `${format.number(count)} ${oneOrMany(count, 'file', 'files')}`,
  minutes: (count: number) => `${format.number(count)} min`,
  hours: (count: number) => `${format.number(count)} h`,

  fileUnreadable: 'That file could not be read.',
  pictureFailed: 'That picture would not load.',

  /** What the screen that catches a failed draw says; see `ErrorBoundary`. */
  drawFailed: 'Something went wrong drawing this screen.',
};
