import { format } from './format.ts';

/** Discover, and what is fetched from YouTube. */
export const discover = {
  panel: {
    heading: 'Made for your next listen',
    mix: (count: number) => `${format.number(count)} discoveries · half familiar, half new artists`,
    refresh: 'Refresh',
    about:
      'Based on your last 30 days. + keeps a song in Library. − removes it from future discoveries. Both make room for another song.',
    updated: (date: string) => `Updated ${date}`,
    preparing: 'Preparing Discover…',
    nextList: (ready: number, count: number) =>
      `Preparing the next list · ${format.number(ready)}/${format.number(count)} ready. Your current songs stay available until the new list is ready. Use Refresh to retry if preparation stalls.`,
    saved: (title: string) => `${title} saved to Library.`,
    restored: 'Song restored to Discover.',
    excludedUndo: 'Song excluded · Undo',

    /** A place in the list with no song in it yet. */
    finding: 'Finding your next song…',
    waitingToBeFound: 'A discovery is waiting to be found',
    place: (place: number, count: number) => `Place ${format.number(place)} of ${format.number(count)}`,

    /** One song, and why it is here. */
    playLabel: (title: string) => `Play ${title}`,
    keepLabel: (title: string) => `Keep ${title} in Library`,
    neverLabel: (title: string) => `Never recommend ${title} again`,
    familiar: (because: string) => `More from your artists · ${because}`,
    fresh: (because: string) => `A new artist · ${because}`,
    songPreparing: 'Preparing…',
    ready: 'Ready to play',
    waitingToDownload: 'Waiting to download',
    tapToDownload: 'Tap to download and play',
  },

  settings: {
    heading: 'Discover',
    count: 'Discovery songs',
    countNote: 'Half familiar artists, half new. Saved and excluded songs are replaced immediately.',
    refresh: 'Refresh list',
    everyDays: (days: number) => `${format.number(days)}d`,
    manual: 'Manual',
    refreshNote:
      'Android chooses when background work can run. An overdue refresh also runs when you reopen Jukebox. Unsaved discoveries are replaced; queued songs are kept until playback no longer needs them.',
    auto: 'Download automatically',
    autoNote: 'MP3 audio. When off, tap a song to download and start listening.',
    wifi: 'Automatic downloads on Wi-Fi only',
    wifiNote: 'Uses unmetered Wi-Fi. Downloads you start by tapping a song may use mobile data.',
    wifiNoteOff:
      'Turn on automatic downloads to choose this. Downloads you start by tapping a song may use mobile data.',
    excluded: (open: boolean) => `Excluded songs ${open ? '−' : '+'}`,
    noneExcluded: 'No excluded songs.',
    allowAgain: 'Allow again',
    failed: 'Could not update Discover settings. Please retry.',
  },

  /** What the work behind the list says while it is going on, and when it cannot go on. */
  engine: {
    checking: 'Checking Discover…',
    learning: (artist: string) => `Learning from ${artist}…`,
    exploring: (tags: string) => `Exploring ${tags}…`,
    findingSongs: (artist: string) => `Finding songs by ${artist}…`,
    findingAudio: (title: string) => `Finding audio: ${title}…`,
    waitingWifi: 'Waiting for unmetered Wi-Fi',
    waitingConnection: 'Waiting for a connection',

    noMatch: 'No matching studio recording was found. Another song is taking its place.',
    downloadFailed: 'This download could not finish. Please retry later.',
    failed: 'Discover could not finish. Please retry.',
    fileMissing: 'File missing. Tap to download again.',
    downloadStopped: 'Download stopped. Tap to retry.',
    notEnough: 'Not enough new songs are available yet. Your current list has been kept.',
    needsBuild: 'Install the updated APK to download Discover songs.',
    needsTaste: 'Add some music or listen to a few songs to build your Discover taste profile.',
    nothingFetched:
      'No recommendations could be fetched. Your current Discover list is kept; please retry later.',
    cancelled: 'Playback request cancelled.',
    changed: 'This recommendation has changed. Choose another song.',
    gone: 'This song is no longer in Discover.',
    tooLong: 'The download is taking too long. Please retry.',
    unavailable: 'The song is no longer available.',
  },
};
