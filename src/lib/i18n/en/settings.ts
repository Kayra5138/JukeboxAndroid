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
    miniPlayer: 'Mini player',
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
    look: 'The theme, motion, vibration, and which views the library offers.',
    sound: 'The equalizer and effects, even loudness, crossfade, and speed and pitch.',
    player: 'How far the jump buttons go, what plays when the queue runs out, and the language lyrics are translated into.',
    miniPlayer: 'What the bar of what is playing shows, its buttons, and how it looks and is handled.',
    tapes: 'Smart rewind, how far a tape’s jump buttons go, and fetching podcasts on Wi‑Fi only.',
    library: 'The folder your music is in, tags and covers, and files that may be the same song.',
    /** Beside Library's name: how many files are waiting to be called one song or two. */
    waiting: (count: number) => `${format.number(count)} to decide`,
    downloads: 'The download queue and its floating button, Discover, and keeping the YouTube downloader up to date.',
    data: 'Back everything up or bring a backup in, new-version checks, and ListenBrainz (experimental).',
  },

  /** Finding a setting by a word it is shown with, on any page however far in: the field over Settings and its page. */
  /** Settings → Look & feel: whether the bar to take hold of beside a long list is there always, while it moves, or never. */
  scrollBar: { title: 'Scroll bar', note: 'The bar beside a long list, to take hold of and go a long way at once.', always: 'Always', moving: 'While scrolling', never: 'Never' },
  /** Settings → Library: whether a list's page says what else might belong in it. */
  listSuggestions: { title: 'Suggestions under a list', note: 'Under a list\'s songs, others from the library that might belong in it, judged from the tags the list leans on.' },
  /** Settings → Look & feel: whether a song taken out can be had back for a moment after. */
  undoOffers: { title: 'Undo after taking out', note: 'For a few seconds after a song is taken out of a list, let go from the player or turned away in Discover, a button to have it back.' },
  search: {
    open: 'Search settings',
    title: 'Search settings',
    placeholder: 'A word from any setting',
    none: (query: string) => `Nothing in Settings says “${query}”.`,
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
    /** How long a song listened to from the Search tab and not kept stays: see `lib/listen`. */
    listen: { title: 'Songs listened to and not kept', note: 'Deleted this many days after they were fetched, unless you keep them: heart one, put it in a list, or keep it from its menu.', days: (days: number) => oneOrMany(days, '1 day', `${format.number(days)} days`)  },
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
  /** What stands where the cover is in the player: Settings → Player. See `ui/coverLook.ts`. */
  /** Settings → Look & feel, under the theme: the row that opens how the player looks. */
  playerLook: { title: 'Player look', open: 'What stands where the cover is, and what moves with the music.' },
  coverLook: {
    songs: 'Songs',
    tapes: 'Tapes',
    cover: 'Cover',
    record: 'Record',
    cassette: 'Cassette',
    note: 'What stands in the player where the cover is. A record turns while it plays; a cassette winds its tape from one reel to the other as the part goes on. Neither turns while Hold the decoration still is on.',
    tonearm: 'Tonearm',
    tonearmNote: 'An arm over the record, its needle going in from the edge toward the label as the song goes on.',
    motion: 'With the music',
    none: 'Nothing',
    spectrum: 'Spectrum',
    ripple: 'Ripples',
    breathe: 'Breathing',
    scope: 'Oscilloscope',
    motionNote: 'What moves with the music round it, in time with what you hear, through headphones as well. Only while it plays and the player is open.',
    punch: 'Punch',
    spectrogram: 'Spectrogram',
    sparks: 'Sparks',
    aurora: 'Aurora',
    notes: {
      spectrum: 'Bars of how loud each pitch is; spokes round a record.',
      ripple: 'Rings going out from the edge on each beat.',
      breathe: 'Grows a little with the music, a glow behind it.',
      punch: 'Jumps a little larger on each beat and settles back.',
      scope: 'The line of the sound itself.',
      spectrogram: 'The last few seconds of every pitch, flowing past.',
      sparks: 'Sparks thrown off its edge on each beat, across the player.',
      aurora: 'Clouds of the cover\'s own colours behind the whole player, each swelling with a part of the sound.',
    },
  },
  still: {
    title: 'Hold the decoration still',
    note:
      'For a phone that drops frames. Pages and sheets open without animation, covers do not fade in, the record and the visualisers stand still, and glass is drawn without blur.',
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
    strengthNote: "Felt as you let go. 100% is the recommended; past it the same touches are made heavier, and past 200% the motor is driven as hard as it goes. Phones whose motor cannot be made lighter or stronger keep their own strength until then.",
    /** Beside the strength where it is the one the app comes with and suggests. */
    recommended: "recommended",
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
  /** Settings → Mini player: see `ui/miniPlayer.ts`. */
  miniPlayer: {
    shows: 'What it shows',
    progress: {
      title: 'Progress',
      none: 'None',
      line: 'Line',
      fill: 'Fill',
      note: 'How far into the song it is: a thin line along its foot, or the whole bar filling as the song goes on.',
    },
    line: {
      title: 'Under the name',
      artist: 'Artist',
      album: 'Album',
      both: 'Artist and album',
      left: 'Time left',
      next: 'Up next',
      note: 'What the second line on it says.',
    },
    cover: {
      title: 'Cover',
      square: 'Square',
      round: 'Round',
      record: 'Record',
      note: 'A record turns while the song plays.',
    },
    buttons: {
      title: 'Buttons',
      aside: 'Up to four, in the order they are shown here.',
      names: {
        previous: 'Previous',
        playPause: 'Play and pause',
        next: 'Next',
        back: 'Jump back',
        forward: 'Jump forward',
        heart: 'Favorite',
        shuffle: 'Shuffle',
        repeat: 'Repeat',
      },
    },
    handling: 'Touch',
    swipe: {
      title: 'Swipe for another song',
      note: 'Pulled sideways it goes to the song before or after. Off, it only opens the player.',
    },
    hold: {
      title: 'Holding it opens',
      none: 'Nothing',
      menu: 'The song’s menu',
      queue: 'The queue',
      lyrics: 'The lyrics',
      note: 'What a long press on the song in it does.',
    },
    look: 'Look',
    floating: {
      title: 'Floating',
      note: 'Rounded and clear of the edges, rather than across the whole width.',
    },
    tint: {
      title: 'Cover colour',
      note: 'Washed with the colour of the cover of what is playing.',
    },
    leftHanded: {
      title: 'Left-handed',
      note: 'The buttons on the left and the song on the right.',
    },
  },
  /** Settings → Look: the tabs that can be taken off the bar. Their names are the tabs' own. */
  tabs: {
    title: 'Tabs',
    /** Under each tab's name: what is on it. */
    notes: {
      library: 'Your tracks, albums, artists, tapes and folders.',
      lists: 'Your playlists, smart lists and favourites.',
      search: 'Discover and downloading from YouTube. Turn this tab off and both are hidden with it.',
      stats: 'What you have listened to, and your listening reports.',
      settings: 'How the app looks, sounds and behaves.',
    },
    aside: 'Library and Settings are always there.',
    names: 'Names under the icons',
    namesNote: 'Off, the bar shows its icons alone and is a little lower. Sideways it always does.',
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
  /** Backups made by themselves into a folder chosen once: see `backup/auto.ts`. */
  autoBackup: {
    title: 'Back up automatically',
    off: 'The same file as Export everything, saved by itself every day or every week into a folder you choose.',
    folder: 'Folder',
    /** For a folder whose name its app does not say. */
    folderUnnamed: 'Chosen folder',
    chooseOther: 'Choose another folder',
    lost: 'Jukebox can no longer reach this folder: it was moved or deleted, or the permission was taken back. Choose it again to go on backing up.',
    chooseAgain: 'Choose the folder again',
    every: 'How often',
    daily: 'Every day',
    weekly: 'Every week',
    keep: 'Backups kept',
    keepNote: (count: number) =>
      oneOrMany(
        count,
        'Only the newest is kept in the folder and older ones are deleted. Nothing else in the folder is touched.',
        `The newest ${format.number(count)} are kept in the folder and older ones are deleted. Nothing else in the folder is touched.`
      ),
    /** [when] is a date and time. */
    last: (when: string) => `Last backup: ${when}.`,
    never: 'No backup made yet.',
    failed: 'The last backup could not be made. It is tried again next time.',
    now: 'Back up now',
    made: 'Backed up.',
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
