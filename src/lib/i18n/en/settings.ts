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
    /** Under the row in Settings that opens the themes. */
    open: 'Colours, glass, or one of your own.',
    note: 'System follows the phone’s own light or dark setting.',
    /** The setting that draws a theme at random each time the app is opened. */
    shuffle: {
      title: 'A different theme each time',
      on: 'On',
      toggle: 'Pick one at random each time the app opens',
      note: 'Tick the themes to pick from. The one picked is the theme until the app is next opened, and you can still change it by hand in the meantime.',
      empty: 'Tick at least one theme for this to do anything.',
    },
  },
  /**
   * The theme somebody makes, and the screen it is made on. The three colours
   * are named for what they colour, not for what a designer would call them.
   */
  customTheme: {
    open: 'Custom theme colours',
    openNote: 'Pick a background and an accent for the Custom theme. Everything else is worked out from them.',
    preview: 'Preview',
    background: 'Background',
    accent: 'Accent',
    surface: 'Cards',
    automatic: 'Automatic',
    automaticNote: 'Worked out from the background',
    presets: 'Suggested colours',
    hue: 'Hue',
    saturation: 'Saturation',
    lightness: 'Lightness',
    degrees: (value: string) => `${value}°`,
    percent: (value: string) => `${value}%`,
    hex: 'Colour code',
    /** Said of a colour that could not be used as it was picked. */
    nudged: (colour: string) => `Shown as ${colour}, so that everything on it can be read.`,
    note:
      'The colours of the text are worked out from these, so that it can always be read. A colour you pick may be made a little lighter or darker for the same reason.',
    use: 'Use this theme',
    reset: 'Reset',
    /** The words in the picture of the app. They only have to look like a song. */
    sample: {
      title: 'Song title',
      line: 'Artist · Album',
      chip: 'Shuffle',
      button: 'Play',
    },
  },

  tags: { note: 'Track information and album covers' },
  rack: {
    title: 'Albums as a rack',
    note:
      'Holding the phone sideways, flick through sleeves instead of reading a list. Tap the one in front to open it.',
  },
  downloads: {
    note: 'What is being downloaded, what is waiting and what has finished.',
    button: {
      title: 'Floating downloads button',
      note: 'A round button over the app while anything is being downloaded, and for a few minutes after. Tap it to see how far along it is.',
    },
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
