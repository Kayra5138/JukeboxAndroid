import { common } from './common.ts';
import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

const months = (count: number) => `${format.number(count)} ${oneOrMany(count, 'month', 'months')}`;

/** The Free up space screen, opened from Settings → Library, and its deleting by itself. */
export const space = {
  /** The screen's title in the bar, and the row's name on Settings → Library. One short line. */
  title: 'Free up space',
  /** Under the row's name on Settings → Library. One line. */
  rowNote: 'Songs you never play, skip or have twice, and the largest files',
  /** At the top of the screen, as much room as it needs. */
  note: 'Songs that could go to make room on the phone, each with why. Tick the ones you want gone; Android asks once more before anything is deleted.',
  /** Each group's name, over the songs in it. */
  groups: {
    copy: 'Copies of the same song',
    skipped: 'Skipped often',
    neverPlayed: 'Never played',
    forgotten: 'Not played for a long time',
    large: 'Largest files',
  },
  /** Under each group's name: [count] songs, never nought, and [size] what they would free, as `megabytes` or `gigabytes` says it. */
  groupSize: (count: number, size: string) => `${common.songs(count)} · ${size}`,
  /** A size, in megabytes and in gigabytes, a tenth at most. */
  megabytes: (mb: number) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb: number) => `${format.decimal(gb, 1)} GB`,
  /** Under each song, why it is there. */
  why: {
    /** A copy whose listens go to the copy kept, before it is deleted. */
    copy: 'Another copy of this song stays, and gets its listens',
    /** [skips] times skipped early, [after] seconds in on average, and [heard] times heard to the end. */
    skipped: (skips: number, heard: number, after: number) =>
      heard === 0
        ? `Skipped ${format.number(skips)} times, about ${format.number(after)} s in, never heard to the end`
        : `Skipped ${format.number(skips)} times, about ${format.number(after)} s in, heard to the end ${oneOrMany(heard, 'once', `${format.number(heard)} times`)}`,
    /** [added] is when the phone first saw it, in milliseconds. */
    neverPlayed: (added: number) => `Never played, on the phone since ${format.date(new Date(added))}`,
    /** [last] is when it was last listened to, in milliseconds. */
    forgotten: (last: number) => `Last played on ${format.date(new Date(last))}`,
    large: 'One of the largest files',
  },
  /** What goes between the names of two lists in `inLists`. */
  listSeparator: ', ',
  /** Under a song in lists: [names] are the lists, Favorites among them under its own name, never none, joined by `listSeparator`. */
  inLists: (names: string) => `In ${names}`,
  /** For a screen reader, what pressing a group's name does. */
  showHint: 'Shows or hides the songs in this group',
  /** For a screen reader, the box beside a group's name that ticks every song in it. */
  tickGroup: (group: string) => `All of ${group}`,
  /** The button under the list while anything is ticked: [count] songs, [size] what they free. */
  delete: (count: number, size: string) => `Delete ${common.songs(count)} (${size})`,
  /** Said after: [count] songs deleted, [size] freed. */
  freed: (count: number, size: string) => `${common.songs(count)} deleted, ${size} freed.`,
  /** Said where Android was told no, or could not delete them. */
  notDeleted: 'Nothing was deleted.',
  /** Where no song fits any group. */
  empty: 'Nothing to free up: every song has been played lately, none is skipped often, and none is here twice.',
  /** The deleting by itself, at the foot of the screen. */
  auto: {
    /** Over its card, shown in capitals. */
    heading: 'By itself',
    title: 'Delete unplayed downloads',
    /** Under the switch while it is off. */
    off: 'Off. Songs Jukebox downloaded itself can be deleted by themselves once nobody has listened to them for a while. Files that came any other way are never touched.',
    /** Under it while on: [count] is how many months. */
    after: (count: number) =>
      `Songs Jukebox downloaded itself are deleted once ${months(count)} have gone by without a listen, looked at once a day. Never the song playing, and never a file that came any other way.`,
    /** The stepper's name, for a screen reader and over the box a number is typed into. */
    months: 'Months without a listen',
    /** What the stepper shows of its number: so many months. */
    monthCount: (count: number) => months(count),
    favorites: 'Also songs in Favorites',
    lists: 'Also songs in lists',
  },
};
