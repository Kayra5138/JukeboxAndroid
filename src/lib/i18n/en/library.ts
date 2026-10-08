import { common } from './common.ts';
import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

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

    needsAccess: 'Jukebox needs access to the audio on this device.',
    nothingIn: (folder: string) => `Nothing in ${folder}.`,
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
};
