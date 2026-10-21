import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The settings tab. */
export const settings = {
  lastBuilt: (when: string) => `Last built: ${when}`,
  lastBuiltUnknown: 'Last built: available after installing the new APK',

  /**
   * The categories the tab is a menu of, each the name of a row there and the
   * title of the page it opens; and the two headings left inside those pages.
   */
  sections: {
    look: 'Look',
    sound: 'Sound',
    player: 'Player',
    library: 'Library',
    downloads: 'Downloads & Discover',
    data: 'Your data',
    views: 'Library views',
    experimental: 'Experimental',
  },
  /**
   * The line under each category on the tab: what is inside, or how things
   * stand there where that is worth more. Short enough for one line on a
   * narrow phone.
   */
  /**
   * The line or two under each category's name on the tab: what is behind it,
   * in words. Beside the name goes what is live, where anything is.
   */
  categories: {
    look: 'The theme, albums as a rack, motion, and which views the library offers.',
    sound: 'The equalizer and effects, even loudness, crossfade, and speed and pitch.',
    player: 'How far the jump buttons go, what plays when the queue runs out, and the language lyrics are translated into.',
    library: 'The folder your music is in, tags and covers, and files that may be the same song.',
    /** Beside Library's name: how many files are waiting to be called one song or two. */
    waiting: (count: number) => `${format.number(count)} to decide`,
    downloads: 'The download queue and its floating button, Discover, and keeping the YouTube downloader up to date.',
    data: 'Back everything up or bring a backup in, new-version checks, and ListenBrainz (experimental).',
  },

  language: {
    title: 'Language',
    note: 'The language the app speaks. It does not follow the phone’s.',
  },
  theme: {
    title: 'Theme',
    /** Under the row that opens the themes. */
    open: 'Colours, glass, or one of your own.',
    note: 'System follows the phone’s own light or dark setting.',
    /** The two themes System goes between. */
    pair: {
      light: 'In light mode',
      dark: 'In dark mode',
      note: 'The two themes System goes between, as the phone does.',
    },
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
  /** The last row of the player's page. What it turns on is not described anywhere else, on purpose. */
  heart: { title: 'Heart', note: 'A heart on the player. It keeps nothing.' },
  /** Settings → Player: the button on the player that adds the song playing to a list. */
  listButton: {
    title: 'Add-to-list button',
    note:
      'A button on the player that puts the song playing into one of your lists, without going through its menu.',
  },
  /** What plays when the queue is about to run out: Settings → Player, and the choices offered for it. */
  autoplay: {
    title: 'Keep playing similar songs',
    note: 'When the queue is nearly over, songs like the ones you were listening to are added to its end.',
    /** Under the list of choices: what holds whichever is chosen. */
    sheetNote: 'They are added a few songs before the end, so they play on like the rest of the queue, screen locked or not. Never while repeat is on.',
    off: {
      label: 'Off',
      note: 'Nothing is added. The music stops at the end of the queue.',
    },
    library: {
      label: 'From your library',
      note: 'Chosen by tags, artists and what you play together. Works offline.',
    },
    fresh: {
      label: 'New songs',
      note: 'Songs you do not have yet, found by Discover. Uses the network and downloads from YouTube like Discover, and keeps to its Wi-Fi setting.',
    },
    mixed: {
      label: 'Mixed',
      note: 'Two from your library, then one new song. The new ones use the network and YouTube downloads like Discover, and keep to its Wi-Fi setting.',
    },
  },
  downloads: {
    note: 'What is being downloaded, what is waiting and what has finished.',
    button: {
      title: 'Floating downloads button',
      note: 'A round button over the app while anything is being downloaded, and for a few minutes after. Tap it to see how far along it is.',
    },
    /** The look for a newer yt-dlp that the app makes by itself: see `lib/youtube/extractor.ts`. */
    check: {
      title: 'Look for a newer YouTube downloader',
      note: 'At most once a day, and only when you open Downloads or download something, Jukebox asks GitHub which yt-dlp is the latest. Nothing about you or your library is sent, and nothing is fetched until you say so.',
    },
  },
  /** Under the row that opens Discover's settings from the page of downloads. */
  discover: { note: 'How long the list is, how often it is made anew, and what has been turned away.' },
  still: {
    title: 'Hold the decoration still',
    note:
      'For a phone that drops frames. The player appears instead of rising, and the game stops lighting up around a life won or lost. The keys themselves still fall — that is the game, not decoration.',
  },
  /** Settings → Look: the three dots at the end of each row of tracks. */
  moreButton: {
    title: 'Three dots on each row',
    note:
      'At the end of every row of tracks, opening the same menu a long press does. Holding a row works without them too.',
  },
  /** Settings → Look: the tabs that can be taken off the bar. Their names are the tabs' own. */
  tabs: {
    title: 'Tabs',
    searchNote: 'Discover and YouTube downloads are on this tab, and go with it.',
    aside: 'Library and Settings are always there.',
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
