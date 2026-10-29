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
    look: 'Look & feel',
    sound: 'Sound',
    player: 'Player',
    tapes: 'Tapes',
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
    look: 'The theme, albums as a rack, motion, vibration, and which views the library offers.',
    sound: 'The equalizer and effects, even loudness, crossfade, and speed and pitch.',
    player: 'How far the jump buttons go, what plays when the queue runs out, and the language lyrics are translated into.',
    tapes: 'Smart rewind, how far a tape’s jump buttons go, and fetching podcasts on Wi‑Fi only.',
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
  /** The last row of the player's page: Favorites, with the heart that fills it, on or off. */
  favoritesShown: { title: "Favorites", note: "A list that is always there, newest first, filled by a heart on the player and by Add to Favorites in a song’s menu. Off, all three are hidden and what is in it waits." },
  /** Settings → Player: the button on the player that adds the song playing to a list. */
  listButton: {
    title: 'Add-to-list button',
    note:
      'A button on the player that puts the song playing into one of your lists, without going through its menu.',
  },
  /** How many similar songs a top-up adds, from the library and from Discover: Settings → Player. */
  autoplaySizes: { title: 'Similar songs at a time', library: 'From your library', fresh: 'New from Discover', note: 'How many are added each time the queue is topped up, for “Keep playing similar songs” and for a song tapped to play with similar ones. Each new song is a download. Mixed takes three quarters of each.' },
  /** What a tap on a track plays: Settings → Player, the choices offered for it, and the setup's step. */
  tap: {
    title: 'When a song is tapped',
    note: 'What plays after a song you tap on Tracks or in search results.',
    sheetNote: 'Play and Shuffle above an album or list, Shuffle all and Discover are not changed by this. Any song’s menu has “Play with similar songs” and “Play only this” for once.',
    list: { label: 'The rest of the list', note: 'The songs after it, in the order they are shown.' },
    shuffled: { label: 'The rest of the list, shuffled', note: 'This one first, then the others in the list in random order.' },
    similar: { label: 'Similar songs', note: 'This one, then a batch of songs like it, from your library or Discover as you choose. After those, the queue goes on as “Keep playing similar songs” says.' },
    only: { label: 'Only that song', note: 'Nothing after it, unless “Keep playing similar songs” adds some.' },
    source: { title: 'Similar songs from', note: 'Where the first songs after a tapped one come from. After them, “Keep playing similar songs” takes over.' },
    everywhere: { title: 'On albums and lists too', note: 'Also when a song is tapped on the page of an album, list, artist or folder. Off, those play in their own order.' },
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
  /** Which writing a song's name found in two is shown in: Settings → Look. */
  scriptNames: { title: 'Names in other writings', latin: 'Latin letters', original: 'Original', note: 'Where a lookup found a song\'s name in Latin letters as well as in its own writing (Japanese, Chinese, Korean), which the library shows. Songs looked up before this was added fill in when they are looked up again.' },
  /** Settings → Look → Vibration: see `ui/haptics.ts`. */
  haptics: {
    title: "Vibration",
    open: "How much the app vibrates under your finger, and how strongly.",
    mode: "Vibrate",
    modes: { off: "Off", essential: "Essential", all: "All", custom: "Custom" },
    modeNotes: {
      off: "The app does not vibrate at all.",
      essential: "Only where it says most: a hold taking, something you asked for working or not, and the game.",
      all: "Holds and drags, switches and choices, the stops on a slider, results, the player's buttons and the game.",
      custom: "Pick the kinds of moment below.",
    },
    strength: "Strength",
    strengthNote: "Felt as you let go. Phones whose motor cannot be made lighter or stronger keep their own strength.",
    groupsHeading: "What vibrates",
    groups: {
      holds: { title: "Holds and drags", note: "A long press taking, a row lifted to move it, a finger run down the checkboxes." },
      choices: { title: "Switches and choices", note: "Switches, the tabs of a choice, an option picked." },
      notches: { title: "Stops and steps", note: "Normal speed, 0 dB, the middle of a slider, the columns of a chart." },
      results: { title: "Results", note: "Something you asked for worked, or did not: found, written, added, imported." },
      player: { title: "Player buttons", note: "Play, skip, repeat, the heart, tapping a line of the lyrics." },
      fun: { title: "Game and fun", note: "The keys of Piano Tiles, and more." },
    },
    phone: "If touch feedback is off in the phone's own settings, the app does not vibrate either.",
  },
  /** Settings → Look: the three dots at the end of each row of tracks and of albums. */
  moreButton: {
    title: 'Three dots on each row',
    note:
      'At the end of every row of tracks and albums, opening the same menu a long press does. Holding a row works without them too.',
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
      tapes: 'Books, podcasts and long recordings from the Tapes folder inside the library folder, which play on from where you left them.',
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
      'Your listening history, lists, tags, lyrics and settings, the podcasts you follow, and where you are in each tape and what you marked in it, in one file you choose a place for. Not the music itself.',
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
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'Smart rewind',
      note: 'A tape played again after a while starts a little before where it was left, the longer away the further back: three seconds after a short break, half a minute after a day. Off, it plays on from exactly where it stopped.',
    },
    skipSilence: { title: 'Skip silence', note: 'Pauses in what is said are passed over, so a tape plays a little shorter. Music is never touched.' },
    voiceClarity: { title: 'Clearer voice', note: 'Rumble under a voice is let down and the part of it words are told apart by is lifted a little, over your equalizer. Only while a tape plays.' },
    skipSponsors: { title: 'Skip sponsors', note: 'In tapes from YouTube, the parts SponsorBlock’s listeners marked — a sponsor’s message, the channel’s own advertising, a request to subscribe — are passed over as they come.' },
    back: 'Jump back',
    forward: 'Jump forward',
    jumpNote: 'How far a tape’s two buttons either side of play go, in seconds. Music keeps its own, under Player.',
    podcasts: 'Podcasts',
    deletePlayed: {
      title: 'Delete heard episodes',
      off: 'Episodes of the podcasts you follow stay on the phone after you hear them.',
      after: (days: number) => oneOrMany(days, 'An episode of a podcast you follow is deleted a day after you hear it to the end, if the app fetched it. One you marked stays.', `An episode of a podcast you follow is deleted ${format.number(days)} days after you hear it to the end, if the app fetched it. One you marked stays.`),
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'Moving your podcasts',
      export: 'Save the podcasts you follow',
      exportNote: 'As an OPML file, which other podcast apps can read.',
      import: 'Follow podcasts from a file',
      importNote: 'An OPML file from another podcast app. Shows are followed without fetching anything by themselves; turn that on for each one on its own screen.',
      importing: (done: number, total: number) => `Reading ${format.number(done)} of ${format.number(total)}…`,
      imported: (followed: number, already: number, failed: number) => [oneOrMany(followed, 'Followed 1 podcast.', `Followed ${format.number(followed)} podcasts.`), already > 0 ? oneOrMany(already, '1 was followed already.', `${format.number(already)} were followed already.`) : '', failed > 0 ? oneOrMany(failed, '1 could not be read.', `${format.number(failed)} could not be read.`) : ''].filter(Boolean).join(' '),
      nothing: 'There are no podcasts in that file.',
      failed: 'That file could not be read or written.',
      none: 'You follow no podcasts yet.',
      saved: (count: number) => oneOrMany(count, 'Saved 1 podcast.', `Saved ${format.number(count)} podcasts.`),
    },
  },
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
