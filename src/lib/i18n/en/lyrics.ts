import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The lyrics, and their translation. */
export const lyrics = {
  none: 'No lyrics found.',
  translating: 'Translating…',
  /** [seconds] is where in the song, already written out: `83.5`. */
  seekTo: (seconds: string) => `Seek to ${seconds} seconds`,

  /** Why there is no translation, when that is worth saying; see `useTranslation`. */
  translation: {
    romaji:
      'These are Japanese words in Latin letters, and no entry in the original writing was found to translate instead.',
    unsupported: 'No translation for this language.',
    unavailable: 'Translation is not available on this device.',
    misaligned: 'The translation did not line up.',
    failed: 'Translation failed.',
  },

  /**
   * Where the words came from, in small print under the last line of the
   * player's lyrics. A short phrase on one line; nothing is said for words
   * somebody chose themselves.
   */
  from: {
    /** Read from the song's own file: its tags. */
    file: 'From the file',
    /** Read from a .lrc file kept beside the song. */
    lrc: 'From a .lrc file',
    lookup: 'From LRCLIB',
  },

  /**
   * "What is stored" on a track's Lyrics tab, for words read from the phone:
   * timed or not, where from, and the count of timed lines if any. The same
   * line as `details.lyrics.kept`, for the two places it does not cover.
   */
  stored: (timed: boolean, from: 'file' | 'lrc', lines: number) =>
    `${timed ? 'Timed' : 'Plain text'}, ${from === 'file' ? 'from the file itself' : 'from a .lrc file beside it'}` +
    (lines > 0 ? ` · ${oneOrMany(lines, '1 line', `${format.number(lines)} lines`)}` : ''),

  /** Under the Lyrics tab's Look up button, when the words were found on the phone. One sentence. */
  found: {
    file: 'Found in the file itself and saved.',
    lrc: 'Found in a .lrc file beside the song and saved.',
  },

  /** Settings → Player: reading .lrc files kept beside the songs. */
  folders: {
    /** The row's title, beside its switch. May wrap to two lines. */
    title: 'Read .lrc files next to songs',
    /** Under the title in small print; three lines or so on a phone. */
    note: 'Lyrics in a .lrc file named like the song are shown before anything is looked up online. Android lets an app read these only from a folder you choose, so you are asked once for the folder your music is in.',
    /** A link under the folders already chosen. */
    add: 'Add another folder',
    /** Beside each folder chosen, to stop reading it. One short word. */
    remove: 'Remove',
    /** What a screen reader says for that button; [folder] is the folder's name, `Music/J-Pop`. */
    removeLabel: (folder: string) => `Stop reading .lrc files in ${folder}`,
    /** Under the row, after a folder that is not on the phone was picked: a cloud drive, say. One or two lines. */
    elsewhere: 'That folder is not on this phone, so none of your songs are in it. Choose the folder on the phone where your music is.',
  },
};
