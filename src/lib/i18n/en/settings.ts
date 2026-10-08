import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The settings tab. */
export const settings = {
  lastBuilt: (when: string) => `Last built: ${when}`,
  lastBuiltUnknown: 'Last built: available after installing the new APK',

  sections: {
    app: 'App',
    library: 'Library',
    views: 'Library views',
    data: 'Your data',
    player: 'Player',
    experimental: 'Experimental',
  },

  language: {
    title: 'Language',
    note: 'The language the app speaks. It does not follow the phone’s.',
  },
  theme: {
    title: 'Theme',
    note: 'System follows the phone’s own light or dark setting.',
  },

  tags: { note: 'Track information and album covers' },
  rack: {
    title: 'Albums as a rack',
    note:
      'Holding the phone sideways, flick through sleeves instead of reading a list. Tap the one in front to open it.',
  },
  still: {
    title: 'Hold the decoration still',
    note:
      'For a phone that drops frames. The player appears instead of rising, and the game stops lighting up around a life won or lost. The keys themselves still fall — that is the game, not decoration.',
  },

  views: {
    notes: {
      tracks: 'Every song, one to a row.',
      albums: 'Records, put together from what the tags say.',
      artists: 'Everyone a song is credited to. A song by two artists is under both.',
      folders: 'The folders the files are kept in, below the library folder.',
    },
    onlyHint: 'The only view left on, so it stays on',
    toggleHint: 'Shows or hides this view in the library',
    asideOne: 'With one view on, the library shows it and has no switch. One always stays on.',
    asideMany: 'The library’s switch offers the ones that are on. One always stays on.',
  },

  sameSong: {
    note: (count: number) =>
      oneOrMany(
        count,
        'A file that looks like a song you already had under another file. Its history is kept apart until you say.',
        `${format.number(count)} files that look like a song you already had under another file. Its history is kept apart until you say.`
      ),
  },
  exportAll: {
    title: 'Export everything',
    note:
      'Your listening history, lists, tags, lyrics and settings, in one file you choose a place for. Not the music itself.',
    failed: 'The backup could not be saved.',
  },
  importBackup: {
    title: 'Import',
    note: 'Bring a backup in. You are shown what is in it and asked before anything changes.',
    failed: 'The import failed.',
    /** [reason] is a sentence of its own, full stop included. */
    refused: (reason: string) => `${reason} Nothing on this phone was changed.`,
  },

  playback: {
    title: 'Playback',
    /** [speed] is the figure alone, as the player gives it. */
    note: (speed: string) => `Speed and pitch · ${speed}×`,
  },
  equalizer: { note: 'Bands, bass, surround and loudness' },
  effects: { note: 'Width, crossfeed, rotation and level' },
  jump: {
    title: 'Jump by',
    note: 'How far the two buttons either side of play move through a track, in seconds.',
  },
  crossfade: { note: 'How one track gives way to the next' },
  loudness: {
    title: 'Even out loudness',
    note:
      'Quiet tracks come up and loud ones come down. An album played in order keeps its own quiet and loud.',
  },
  lyricsLanguage: {
    title: 'Translate lyrics into',
    note:
      'Lyrics are translated on the phone. Any language but English is reached through English, and downloads a second model the first time.',
  },
};
