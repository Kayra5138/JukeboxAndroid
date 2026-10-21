import { common } from './common.ts';
import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

const filesCounted = (count: number) => `${format.number(count)} ${oneOrMany(count, 'file', 'files')}`;

/** The library tab and what it is made of: rows, albums, artists, folders. */
export const library = {
  /** The four ways of looking at it, as its switch and Settings name them. */
  views: {
    tracks: 'Tracks',
    albums: 'Albums',
    artists: 'Artists',
    folders: 'Folders',
  },

  /** Said by more than one of the files below. */
  nothingMatches: (query: string) => `Nothing matches “${query}”.`,
  noAlbums:
    'No albums yet. A record only appears once its tracks have been looked up — the folder a file sits in is not an album.',
  /** The way back, as a list's heading writes it. */
  back: '‹ Back',
  /** What a screen reader calls the long press on a track's row, anywhere one is shown. */
  trackMenu: 'Track options',
  /** The same for the long press on an album, in the list or in the rack. */
  albumMenu: 'Album options',

  /** `LibraryScreen`. */
  screen: {
    viewSwitch: 'Library view',
    /** What the box says it looks for, which is not the same thing in every view. */
    searchHints: {
      tracks: 'Search titles, artists and tags',
      albums: 'Search titles, artists and tags',
      artists: 'Search artists',
      folders: 'Search folders',
    },
    /** The small word over the order; the order itself has to fit a button 56 points wide. */
    sort: 'Sort',
    sortShort: { name: 'A–Z', added: 'Added', played: 'Played' },
    sortedBy: {
      name: 'Sorted by name',
      added: 'Sorted by when it was added',
      played: 'Sorted by when it was last played',
    },
    sortHint: 'Changes the order of the library',
    /**
     * The same button over artists and folders, which are asked other things:
     * how much of them there is, and (artists only) how much it is listened to.
     */
    groupSortShort: { name: 'A–Z', tracks: 'Tracks', played: 'Plays', added: 'New' },
    groupSortedBy: {
      name: 'Sorted by name',
      tracks: 'Sorted by number of tracks',
      played: 'Sorted by how much they are listened to',
      added: 'Sorted by what was added most recently',
    },

    selectTracks: 'Select tracks',
    stopSelecting: 'Stop selecting',
    /*
      Says what is being counted. Among albums, artists and folders the rows
      are not what is chosen — their tracks are — and a bare number beside a
      list of twelve artists would be read as a number of artists.
    */
    selected: (count: number) =>
      `${format.number(count)} ${oneOrMany(count, 'track', 'tracks')} selected`,
    addToList: 'Add to list',
    addTag: 'Add tag',
    writeToFiles: 'Write to files',
    writeToFilesSpoken: 'Write the details of the selected tracks into their files',

    /** The two panels a row uncovers when it is pulled aside. */
    swipePlayNext: 'Play next',
    /** Short, unlike the menu's: the panel is a pull wide, and a long line is cut off before it is read. */
    swipeQueue: 'Add to queue',
    /** Said once the whole of a list or album has been put at the end of the queue. */
    queuedAll: (count: number) => `${common.tracks(count)} added to the queue`,

    needsAccess: 'Jukebox needs access to the audio on this device.',
    nothingIn: (folder: string) => `Nothing in ${folder}.`,
    shuffleAll: 'Shuffle all',
    playsEverythingBelow: 'Jukebox plays everything below that folder, including subfolders.',
    chooseFolderInSettings: 'Choose your library folder in Settings.',

    folders: (count: number) => `${format.number(count)} ${oneOrMany(count, 'folder', 'folders')}`,
    noFolders: 'None of these tracks say which folder they are in.',
    shuffleTag: (tag: string) => `Shuffle “${tag}”`,
  },

  /** `BrowseRow`: one album, one artist or one folder. */
  row: {
    opensTracks: 'Opens its tracks',
    /** The same row while tracks are being chosen, when it is a tick box. */
    selectsTracks: 'Selects all of its tracks',
    /** What a screen reader calls the long press that starts choosing with this row. */
    select: 'Select its tracks',
  },

  /** `CoverFlow`: the rack of sleeves. */
  rack: {
    open: (album: string) => `Open ${album}`,
    openHint: 'Shows the tracks on the album',
    /** What pressing a record beside the one in front does, for a screen reader. */
    bringForward: 'Brings this record to the front',
  },

  /** `AlbumMenu`: what a held album offers. */
  albumActions: {
    select: { label: 'Select', hint: 'Its tracks, and then whatever else you tap' },
    rest: {
      label: 'Find the rest of this album',
      hint: 'The tracks on it that you do not have yet',
    },
    lookUp: {
      label: 'Look up this album',
      hint: 'Its details and cover, asked about the album as a whole',
    },
    cover: {
      label: 'Choose album cover',
      hint: 'A picture from your gallery, for every track on it',
    },
  },

  /** What the album's own page says about looking it up and giving it a cover. */
  albumTools: {
    lookingUp: (done: number, total: number) =>
      `Looking this album up… ${format.number(done)} of ${format.number(total)}`,
    stop: 'Stop looking up',
    /** Once it is over: how many tracks were found, and how many were given a cover. */
    lookedUp: (found: number, covers: number) =>
      found === 0 && covers === 0
        ? 'Nothing new was found for this album.'
        : covers === 0
          ? `Found details for ${common.tracks(found)}.`
          : found === 0
            ? `Found a cover for ${common.tracks(covers)}.`
            : `Found details for ${common.tracks(found)} and a cover for ${common.tracks(covers)}.`,
    offline: 'Nothing answered. Check the connection and try again.',
    failed: 'The lookup stopped unexpectedly.',
    coverChosen: (count: number) => `The cover is on ${common.tracks(count)} now.`,
  },

  /**
   * The screen `albumActions.rest` opens: every track of the album, the ones
   * here and the ones missing, and a way to download the missing ones.
   */
  rest: {
    looking: 'Looking the album up…',
    /** Which pressing the list was read off: how long it is and when it came out. */
    release: (count: number, year: number | null) =>
      year ? `${common.tracks(count)}, ${year}` : common.tracks(count),
    have: (have: number, total: number) =>
      `You have ${format.number(have)} of ${format.number(total)}.`,
    complete: 'You have the whole album.',
    rivals: 'More than one album goes by this name. This is the one your tracks fit best.',
    unsure:
      'None of your tracks were recognised on it, so nothing is ticked. Check that this is the right album first.',
    disc: (disc: number) => `Disc ${format.number(disc)}`,
    /** Said once the tracks already here have been given their places on the record. */
    ordered: (count: number) =>
      `Put ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')} in the album’s order.`,
    undoOrder: 'Undo',

    /** The same, while YouTube is asked: for its playlists, and then for what is on one. */
    lookingTube: 'Looking on YouTube…',
    readingTube: 'Reading the album…',
    /** Where the list on screen was read from. */
    source: {
      musicbrainz: 'Track list from MusicBrainz',
      youtube: (playlist: string, channel: string) =>
        `Track list from YouTube: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    /** The quiet link to the other of the two. */
    other: { youtube: 'Look on YouTube instead', musicbrainz: 'Use MusicBrainz instead' },
    onTrust:
      'Taken from YouTube’s album of this name. You have too few of its tracks to check it against, so look it over before downloading.',
    /** Under MusicBrainz's list, where YouTube was asked as well and had nothing to add. */
    tubeNotFound: 'No playlist on YouTube could be confirmed as this album.',

    /** A missing track's row, before there is a download to speak for it. */
    ticks: 'Ticked to be downloaded',
    waiting: 'Waiting its turn',
    searching: 'Finding it on YouTube…',
    noMatch: 'No recording that matches was found',
    searchFailed: 'The search did not go through',
    byHand: 'Search by hand',
    byHandLabel: (title: string) => `Search for ${title} by hand`,

    download: (count: number) =>
      `Download ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}`,
    nothingTicked: 'Tick the tracks to download',
    stop: 'Stop searching',

    failed: {
      unnamed:
        'This album cannot be looked up. It needs a name, and one artist that most of its tracks agree on.',
      notFound: 'MusicBrainz has no album by this name from this artist.',
      offline: 'MusicBrainz could not be reached. Check your connection and try again.',
      throttled: 'MusicBrainz asked to slow down. Give it a minute and try again.',
      failed: 'The album could not be looked up.',
      gone: 'This album is no longer in the library.',
      neither:
        'This album was not found. MusicBrainz does not list it, and no playlist on YouTube could be confirmed as it.',
      /** Said only when YouTube's failure has no sentence of its own. */
      tube: 'YouTube could not be asked for the album.',
      tooOld: 'This build of Jukebox cannot look albums up on YouTube. Install a newer Android build.',
    },
  },

  /** `TrackMenu`: everything that can be done to one track. */
  menu: {
    playNext: { label: 'Play next', hint: 'Straight after the current track' },
    addToQueue: { label: common.addToQueue, hint: 'At the end' },
    album: { label: 'Go to album', hint: 'The rest of the record, in order' },
    addToPlaylist: { label: 'Add to a list', hint: 'One of your lists, or a new one' },
    tiles: { label: 'Play piano tiles', hint: 'Keys falling in time with this record' },
    details: {
      label: 'View & edit details',
      hint: 'Names, cover, tags and lyrics, with a lookup for each',
    },
    /*
      Said in full. The same menu opens on a row of a list and a row of the
      queue, each of which has a cross that takes the row out and no more, and
      a bare "Delete" beside that could be read as the same thing.
    */
    delete: { label: 'Delete from phone', hint: 'Erases the file itself, not just this row' },
  },

  /** The screen the library folder is chosen on. */
  folders: {
    needsAccess:
      'Jukebox needs access to the audio on this device before it can list any folders.',
    note: 'Jukebox plays everything below the folder you pick, including subfolders. Choosing a subfolder is the way to leave ringtones and game audio out.',
    /** The row for the whole of the music folder; [path] is that folder. */
    everything: (path: string) => `${path}  (everything)`,
  },

  /**
   * The screen that leaves folders out of the library, opened from Settings →
   * Library, and that row of Settings.
   */
  leftOut: {
    /** The screen's title in the bar, and the row's name on Settings → Library. One short line. */
    title: 'Folders left out',
    /** Under the row's name on Settings → Library, while nothing is left out. Room for two lines. */
    none: 'None. Switch off folders of voice notes, recordings or ringtones.',
    /** The same while some are; [count] is never nought. One line. */
    some: (count: number) =>
      `${format.number(count)} ${oneOrMany(count, 'folder', 'folders')} left out of the library`,
    /** At the top of the screen, as much room as it needs. */
    note: 'A folder switched off is left out of the library, with every folder inside it. Nothing is deleted: its plays, tags and places in your lists are kept, and come back when it is switched on again.',
    /** Under a folder whose own switch is on but which is inside one switched off. One short line. */
    within: 'Left out with the folder it is in',
    /**
     * What a screen reader says for a folder's switch, in place of reading the
     * row: its path from the library folder, and how many tracks it holds.
     */
    spoken: (path: string, count: number) =>
      `${path}, ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}`,
    /** And what switching it does, said after. */
    hint: 'On, the folder is in the library; off, it is left out',
    /** In place of the list, where the library folder holds no folders with music in them. */
    empty: (root: string) => `There are no folders with music in them inside ${root}.`,
  },

  /** The choice on Settings → Library of leaving out files too short to be music. */
  shortFiles: {
    /** The row's name. One short line, with the choice beside it. */
    title: 'Hide short files',
    /** Under the row's name, and under the list of choices. Room for two lines. */
    note: 'Leaves out voice notes, ringtones and notification sounds by their length. Nothing is deleted.',
    /**
     * The row's value, beside its name: short. [seconds] is 10, 30 or 60;
     * nought is said with `common.off` instead.
     */
    under: (seconds: number) => `Under ${format.number(seconds)} s`,
    /** The same as a choice in the list the row opens, which has the room to say it in full. */
    shorterThan: (seconds: number) => `Shorter than ${format.number(seconds)} seconds`,
  },

  /**
   * Songs the library holds more than once: the Copies screen, its row on
   * Settings → Library, and the quiet line on the Library tab.
   */
  copies: {
    /** The screen's title in the bar, and the row's name on Settings → Library. One short line. */
    title: 'Copies of the same song',
    /**
     * Under the row's name on Settings → Library, and the line on the Library
     * tab. [count] is how many songs, never nought. One line.
     */
    some: (count: number) =>
      oneOrMany(count, '1 song is in your library more than once', `${format.number(count)} songs are in your library more than once`),
    /** Beside that line on the Library tab: the word that opens the screen. */
    review: 'Review',
    /** For a screen reader, what pressing the line does. */
    reviewHint: 'Opens the copies, to choose which to keep',
    /** At the top of the screen, as much room as it needs. */
    note: 'These files look like one recording saved more than once: the same name, or the same artist and title, and the same length to within two seconds. One copy of each is kept. Before the others are deleted, their listens, tags, lyrics and places in lists are moved to it.',
    empty: 'No song is in your library more than once.',
    /** The button over the list; [count] is how many songs. */
    cleanAll: (count: number) => `Clean up all ${format.number(count)}`,
    /** Asked in the screen before that: [files] is how many are deleted, [songs] how many keep one copy. */
    confirmAll: (files: number, songs: number) =>
      `Delete ${filesCounted(files)}? One copy of each of the ${format.number(songs)} ${oneOrMany(songs, 'song', 'songs')} is kept, and every deleted file’s listens, tags, lyrics and places in lists are moved to it first. Android asks once more before anything is deleted.`,
    /** The button that says yes to that. */
    confirm: (files: number) => `Delete ${filesCounted(files)}`,
    /** Under each song's copies; [count] is how many go. */
    deleteOthers: (count: number) =>
      oneOrMany(count, 'Delete the other copy', `Delete the other ${format.number(count)} copies`),
    /** Beside it: the files are different songs, and are not shown here again. */
    different: 'These are different',
    /** For a screen reader, the copies of one song as a choice. */
    choose: 'Which copy to keep',
    /** For a screen reader, what choosing a copy does. */
    keepHint: 'Keeps this copy and deletes the others',
    /** Over each copy: the one kept and the ones that go. One word each, shown in capitals. */
    keeps: 'Keep',
    goes: 'Delete',
    /** Under the copies: why the one kept was suggested. */
    why: {
      listens: 'Suggested because it has the most listens.',
      described: 'Suggested because it has details or a cover.',
      folder: 'Suggested because it is in the library folder.',
      larger: 'Suggested because it is the larger file.',
      older: 'Suggested because it is the older file.',
      alike: 'The copies are alike; any one will do.',
    },
    /** The same, once another copy has been chosen. */
    yourChoice: 'Kept as you chose.',
    /** What a copy has to its name, in as few words as say it. */
    holds: (copy: { listens: number; described: boolean; cover: boolean; outside: boolean }) => {
      const parts = [copy.listens > 0 ? oneOrMany(copy.listens, '1 listen', `${format.number(copy.listens)} listens`) : 'no listens'];
      if (copy.described) parts.push('details');
      if (copy.cover) parts.push('cover');
      if (copy.outside) parts.push('outside the library folder');
      return parts.join(' · ');
    },
    deleted: (count: number) => oneOrMany(count, '1 file deleted.', `${format.number(count)} files deleted.`),
    notDeleted: 'The files were not deleted. Their listens and the rest are with the copy kept now.',
    failed: (error: string) => `Some history could not be moved, and those files were left alone. ${error}`,
  },

  /**
   * Downloads that were filed under one song's name from a video whose title
   * names another: the Wrong downloads screen, its row on Settings → Library
   * and its line on the Library tab. Before the app was more careful, a video
   * could be taken for a song on its length alone.
   */
  wrong: {
    /** The screen's title in the bar, and the row's name on Settings → Library. One short line. */
    title: 'Downloads that may be the wrong song',
    /**
     * Under the row's name on Settings → Library, and the line on the Library
     * tab. [count] is how many files, never nought. One line.
     */
    some: (count: number) =>
      oneOrMany(count, '1 download may be another song than its name says', `${format.number(count)} downloads may be other songs than their names say`),
    /** Beside that line on the Library tab: the word that opens the screen. */
    review: 'Review',
    /** For a screen reader, what pressing the line does. */
    reviewHint: 'Opens those downloads, to put each one right',
    /** At the top of the screen, as much room as it needs. */
    note: 'Each of these was downloaded as one song and given that song’s name, but the video it came from is called something else, so it may be another song. Play it to hear which, then give it the video’s name, delete it, or say it is right as it is. Nothing is changed until you choose.',
    empty: 'No download looks like the wrong song.',
    /** Captions over the two names on each card, shown in capitals. */
    filedAs: 'Filed as',
    videoWas: 'The video was',
    /** Under the names: the file's length, like 3:42, and how often it has been listened to. */
    facts: (length: string, listens: number) =>
      `${length} · ${listens > 0 ? oneOrMany(listens, '1 listen', `${format.number(listens)} listens`) : 'no listens'}`,
    /** For a screen reader, what pressing the names does. */
    playHint: 'Plays this file',
    /** The three buttons on each card. Short; they share a row. */
    rename: 'Name it what it is',
    delete: 'Delete',
    right: 'It is right',
    /** The sheet that opens from the first, with the name taken from the video's title. */
    sheetNote: 'Taken from the video’s title. Change it if it is not quite right. It is saved as your own edit, which no lookup writes over.',
    titleField: 'Title',
    artistField: 'Artist',
    /** Said on the screen after each button has done its work. */
    renamed: (title: string) => `Renamed to “${title}”.`,
    deleted: 'Deleted.',
    notDeleted: 'The file was not deleted.',
    keptRight: 'Kept as it is. It will not be asked about again.',
    failed: (error: string) => `That could not be done. ${error}`,
  },
};
