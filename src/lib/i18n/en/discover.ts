import { format } from './format.ts';

/** Discover, and what is fetched from YouTube. */
export const discover = {
  panel: {
    heading: 'Made for your next listen',
    refresh: 'Refresh',
    updated: (date: string) => `Updated ${date}`,

    /** Why a song is here, for one kept from before the list said so itself: see `why.ts`. */
    familiar: (because: string) => `More from your artists · ${because}`,
    fresh: (because: string) => `A new artist · ${because}`,
  },

  /** The few lines over the list, and the line under them that says what the list is doing. */
  header: {
    notYet: 'No list yet',
    about: 'About Discover',
    settings: 'Discover settings',
    findMore: 'Find more',
    dismiss: 'Dismiss',
  },

  /** What Discover is, for whoever presses the "i": said once on a sheet, and not over the list every day. */
  about: {
    heading: 'About Discover',
    what:
      'Songs you do not have yet, chosen from what you played in the last 30 days: more from your artists, and artists close to them.',
    source:
      'What you play is read on this phone. The suggestions come from ListenBrainz and MusicBrainz, and a song’s audio is fetched from YouTube when it is to be played.',
    keep: 'Keep puts a song in your Library. It leaves the list, having been found.',
    exclude:
      'Not this song takes it off the list, and it is not recommended again. From the menu the same can be said of its artist.',
    room: 'Either way another song takes the place. Pull a row sideways to do the same, or hold it for more.',
  },

  /** One song's row: what is said on it where the state is not a mark, and what its buttons are called. */
  row: {
    keep: 'Keep in Library',
    exclude: 'Not this song',
    /** On the panel a row uncovers when pulled aside. Short: the panel is as wide as the pull. */
    swipeKeep: 'Keep',
    swipeExclude: 'Not this',
    willPlay: 'Plays when ready',
    /** On the row whose thirty seconds are being heard while the song itself is fetched. */
    preview: 'Preview · the song is on its way',
    previewStop: 'Stops the preview. The song still plays when it is ready',
    willKeep: 'To Library when ready',
    keeping: 'Saving to Library…',
    failed: 'Could not download · tap to retry',
    needsBuild: 'Needs the updated app',
    waitingWifi: 'Waiting for Wi-Fi · tap to download',
    noMatch: 'No recording found',
    percent: (percent: number) => `${format.number(percent)}%`,
    /** For a screen reader, which is told a song is being fetched and not each percent of it. */
    gettingReady: 'Being downloaded',
    hint: 'Plays the song, downloading it first if it has to be',
    nowPlaying: (title: string) => `Playing ${title}`,
    menu: 'Song options',
  },

  /** The sheet a long press on a row opens. */
  menu: {
    play: { label: 'Play', hint: 'Downloaded first, if it has to be' },
    keep: { label: 'Keep in Library', hint: 'Yours to keep, and off this list' },
    exclude: { label: 'Not this song', hint: 'Off the list, and not recommended again' },
    neverArtist: {
      label: (artist: string) => `Never ${artist}`,
      hint: 'Nothing by this artist is recommended again',
    },
    why: 'Why this song',
    seeds: (artists: string) => `From your listening to ${artists}`,
    tags: (tags: string) => `Tagged ${tags}`,
    freshArtist: 'An artist new to your library',
  },

  /** In place of the list when there is none, and at the foot of one that is short. */
  empty: {
    building: 'Putting your list together…',
    none: 'There is no list yet. Press Refresh, and Discover makes one from what you play.',
    findingMore: 'Finding more songs…',
    short: (missing: number) =>
      `${format.number(missing)} ${missing === 1 ? 'place is' : 'places are'} empty.`,
  },

  /** Keep and exclude where the song is heard: the player, and the bar of what is playing. */
  player: {
    kept: 'Saved to Library',
  },

  /** The strip at the foot of the screen while a preview is what is being heard. */
  preview: {
    label: 'Preview',
    note: 'The whole song starts when it is ready',
    stop: 'Stop the preview',
  },

  settings: {
    heading: 'Discover',
    /** Over the same settings on a screen of their own, reached from the list. */
    title: 'Discover settings',
    count: 'Discovery songs',
    countNote: 'Half familiar artists, half new. Saved and excluded songs are replaced immediately.',
    refresh: 'Refresh list',
    everyDays: (days: number) => `${format.number(days)}d`,
    manual: 'Manual',
    refreshNote:
      'Android chooses when background work can run. An overdue refresh also runs when you reopen Jukebox. Unsaved discoveries are replaced; queued songs are kept until playback no longer needs them.',
    ready: 'Keep the next songs ready',
    readyNone: 'None',
    readyNote:
      'Downloaded ahead so that a tap plays at once: the first of the list, or the ones after what is playing. With none, a song is fetched when you tap it.',
    wifi: 'Keep songs ready on Wi-Fi only',
    wifiNote: 'Uses unmetered Wi-Fi. A song you tap is downloaded on whatever connection there is.',
    preview: 'Play a preview while a song downloads',
    previewNote:
      'A tapped song that is not ready yet starts at once as a 30-second preview from Deezer, and the whole song takes over from its beginning when it is in. A preview is not counted as a listen.',
    /** Under the choice of which songs are looked for, which does not reach the list on show. */
    nextList: 'Your current list stays as it is. The next one is chosen this way.',
    excluded: 'Excluded songs',
    noneExcluded: 'No excluded songs.',
    allowAgain: 'Allow again',
    allowAgainLabel: (title: string) => `Allow ${title} again`,
    unblock: 'Unblock',
    unblockLabel: (artist: string) => `Unblock ${artist}`,
    failed: 'Could not update Discover settings. Please retry.',
  },

  /**
   * What one song on the list is doing, as a line under its name. Made when
   * the list is read and never kept with it, so a list built in one language
   * is read in another.
   */
  state: {
    idle: 'Tap to download and play',
    starting: 'Starting…',
    waitingFind: 'Waiting to be looked for',
    waitingDownload: 'Waiting to download',
    waitingRetry: 'Trying again in a moment',
    finding: 'Finding the recording…',
    preparing: 'Starting the download…',
    downloading: (percent: number) => `Downloading · ${format.number(percent)}%`,
    converting: 'Finishing…',
    saving: 'Almost ready…',
    ready: 'Ready to play',
    playing: 'Playing',
    willPlay: (doing: string) => `${doing} Plays when ready.`,
    preview: (doing: string) => `Playing a preview. ${doing}`,
    willKeep: (doing: string) => `${doing} Saved to Library when ready.`,
    keeping: 'Saving to Library…',
    noMatch: 'No recording of this was found. Another song is taking its place.',
    waitingWifi: 'Waiting for Wi-Fi · tap to download now',
  },

  /** Why a song has no file, by what went wrong and not by what was said at the time. */
  failure: {
    generic: 'This download could not finish.',
    fileMissing: 'The file is no longer on the phone.',
    stopped: 'The download was stopped.',
    needsBuild: 'Install the updated APK to download Discover songs.',
    retry: (reason: string) => `${reason} Tap to retry.`,
  },

  /** What is so of the list as a whole. One of these at a time, over the list. */
  status: {
    building: 'Looking for songs…',
    buildingArtists: (done: number, total: number) =>
      `Looking for songs · ${format.number(done)} of ${format.number(total)} artists`,
    preparing: (ready: number, target: number) =>
      `A new list is on its way · ${format.number(ready)} of ${format.number(target)} songs ready. Refresh again to see it now.`,
    offline: 'No connection. Your list is kept; new songs are looked for when there is one.',
    offlineEmpty: 'No connection. Discover makes your list when there is one.',
    noLibrary: 'Add some music to your library, and Discover has something to go on.',
    noTaste: 'Add some music or listen to a few songs, and Discover has something to go on.',
    unreachable: 'The recommendations could not be reached. Your list is kept; please retry later.',
    unreachableEmpty: 'The recommendations could not be reached. Please retry later.',
    exhausted: 'There are not enough new songs yet. Your list is kept as it is.',
    exhaustedEmpty: 'Nothing new to recommend yet. Listen to a little more and try again.',
    timedOut: 'Looking for songs took too long and was stopped. Please retry.',
    throttled: 'Discover has just looked. Try again in a minute.',
    failed: 'Discover could not finish. Please retry.',
    waitingWifi: 'The next songs are downloaded when there is Wi-Fi. Tap a song to download it now.',
    waitingConnection: 'The next songs are downloaded when there is a connection.',
    paused: 'Downloads are paused. Resume them to fetch songs.',
  },

  /** The last thing done, said once and taken down by itself. */
  notice: {
    kept: (title: string) => `${title} saved to Library.`,
    excluded: (title: string) => `${title} will not be recommended again.`,
    excludedArtist: (artist: string) => `${artist} will not be recommended again.`,
    restored: (title: string) => `${title} is back on the list.`,
    refreshed: 'Here is your new list.',
    keepFailed: (title: string) => `${title} could not be saved to Library. Please retry.`,
    undo: 'Undo',
  },

  /**
   * The two sentences the catalogue still throws, and is known by: see
   * `fault` in `engine.ts`. Nothing shows them; what is shown is `status`.
   */
  engine: {
    needsTaste: 'Add some music or listen to a few songs to build your Discover taste profile.',
    nothingFetched:
      'No recommendations could be fetched. Your current Discover list is kept; please retry later.',
  },

  /**
   * Which songs are looked for, and whose. Kept apart from `settings` and
   * `panel` because it is said by the part of Discover that chooses the songs
   * and placed by the part that draws them.
   */
  taste: {
    popularity: 'Song popularity',
    popularityKnown: 'Well-known',
    popularityAny: 'No preference',
    popularityDeep: 'Lesser-known',
    popularityNote:
      'Whether Discover leans toward well-known artists and their most played songs, or toward artists and songs fewer people have found. With no preference, a new artist is introduced by one of their best-known songs.',

    neverArtistLabel: (artist: string) => `Never recommend ${artist} again`,
    blockedArtists: 'Blocked artists',
    noneBlockedArtists: 'No blocked artists.',
    blockedArtistsNote:
      'Excluding a song also makes its artist less likely. Three excluded songs by one artist, and Discover leaves the artist out for six months.',
  },

  /** Why a song is on the list. */
  why: {
    moreFrom: (artist: string) => `More from ${artist}`,
    becauseYouPlay: (artists: string) => `Because you play ${artists}`,
    both: (first: string, second: string) => `${first} and ${second}`,
    like: (artist: string) => `Like ${artist}`,
    withGenre: (line: string, genre: string) => `${line} · ${genre}`,
    fromTags: (tags: string) => `From the ${tags} you play`,
    unexplained: 'Picked for you',
    veryNear: 'Very close to what you play',
    near: 'Close to what you play',
    farther: 'A step further out',
  },

  /** What gathering the songs says while it goes on, and when it comes to nothing. */
  gathering: {
    around: (artist: string, done: number, total: number) =>
      `Listening around ${artist} · ${format.number(done)} of ${format.number(total)} artists`,
    artists: (done: number, total: number) => `${format.number(done)} of ${format.number(total)} artists`,
    naming: 'Finding out what the songs are…',
    offline: 'No connection. Discover will look for new songs when there is one.',
    throttled: 'The recommendation service asked Discover to slow down. Please retry in a few minutes.',
    nothing: 'Nothing new was found this time. Your current Discover list is kept; please retry later.',
  },
};
