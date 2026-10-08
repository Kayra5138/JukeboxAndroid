import { format } from './format.ts';

/** The search tab. */
export const search = {
  modes: {
    discover: 'Discover',
    download: 'Download',
    videos: 'Videos',
    playlists: 'Playlists',
  },

  /** A build of the app from before it could fetch anything. */
  unavailable: {
    heading: 'YouTube needs a new app build',
    body: 'Install the updated Android version to search and download music. Your library is still available.',
    downloads: 'Install a new Android build to enable YouTube downloads.',
  },

  intro: {
    videos: 'Search YouTube or paste a video link. Save the audio to your library.',
    playlist:
      'Search for a playlist or paste its YouTube link. Open a result to preview and download its tracks. The first 500 playlist entries are checked.',
  },
  inputLabel: {
    videos: 'Search YouTube or paste a video link',
    playlist: 'Playlist name or YouTube link',
  },
  placeholder: {
    videos: 'Song, artist or YouTube link',
    playlist: 'Playlist name or YouTube link',
  },

  formats: { mp3: 'MP3', original: 'Original audio' },
  formatHint: {
    mp3: 'Converted to MP3 after downloading.',
    original: 'Keeps the source audio codec where possible.',
  },

  searching: 'Searching YouTube…',
  results: (count: number) => `Results · ${format.number(count)}`,
  empty: {
    none: 'No results found. Try a different search or link.',
    videos: 'Search by song and artist to find the recording you want.',
    playlist: 'Search by playlist name or paste a playlist link.',
  },

  /** One result, and what can be done with it. */
  playlist: 'Playlist',
  openPlaylist: 'Open playlist',
  openPlaylistLabel: (title: string) => `Open playlist ${title}`,
  downloadLabel: (title: string) => `Download ${title}`,
  download: { mp3: 'Download MP3', original: 'Download audio' },
  adding: 'Adding…',

  /** A whole playlist at once. */
  addingPlaylist: 'Adding playlist…',
  downloadListed: {
    mp3: 'Download listed tracks · MP3',
    original: 'Download listed tracks · Original audio',
  },
  listedHint:
    'Already downloaded or queued tracks are skipped. Private, deleted and live videos may be unavailable.',
  listCreated: (name: string) => `List created: ${name}. Downloaded tracks will appear in Lists.`,
  unnamedPlaylist: 'YouTube playlist',

  /** A download's state and what it is being saved as. */
  jobLine: (status: string, mp3: boolean) => `${status} · ${mp3 ? 'MP3' : 'Original'}`,

  status: {
    finding: 'Finding it on YouTube',
    queued: 'Queued',
    preparing: 'Preparing…',
    downloading: (percent: number) => `Downloading · ${percent}%`,
    converting: 'Converting audio…',
    saving: 'Adding to library…',
    cancelling: 'Cancelling…',
    cancelled: 'Cancelled',
    failed: 'Download failed',
    done: 'In library',
    missing: 'File removed',
  },

  /** What is said when nothing better is known about what went wrong. */
  failed: {
    search: 'Search failed. Please retry.',
    queue: 'Could not queue download.',
    queuePlaylist: 'Could not queue playlist.',
    cancel: 'Could not cancel download.',
    read: 'Could not read downloads.',
    readReopen: 'Could not read downloads. Please reopen Search.',
  },

  /** What YouTube's own failures are turned into; see `youtube/errors.ts`. */
  errors: {
    playlistLink: 'Paste a YouTube playlist link, or search by playlist name.',
    videoLink: 'Enter a song name or a valid YouTube video link.',
    queueFull: 'The download queue is full. Wait for some tracks to finish, then try again.',
    update: 'YouTube has changed and this version of Jukebox cannot read it yet. Update Jukebox.',
    unavailable: 'This video or playlist is unavailable. Try another public playlist or search.',
    unreachable: 'Could not reach YouTube. Check your connection and try again.',
    refused: 'YouTube could not complete this request. Try again later or choose another result.',
  },
};
