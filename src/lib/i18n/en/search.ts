import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The search tab. */
export const search = {
  modes: {
    discover: 'Discover',
    download: 'Download',
    videos: 'Videos',
    playlists: 'Playlists',
  },

  /** A build of the app from before it could fetch anything. */
  /** Fetching tapes, on their own screen opened from the tapes view: long things fetched into the Tapes folder. */
  tapes: {
    intro:
      'Books, podcasts, talks and long recordings from YouTube, fetched into the Tapes folder of your library and played on from where you left them. Search, or paste a link to a video or a playlist — or to a channel, to follow it.',
    placeholder: { videos: 'Title, show or YouTube link', playlist: 'Book, series or playlist link' },
    empty: { videos: 'Search for a book, a show, a talk or a lecture.', playlist: 'Search for a playlist to fetch as one tape: a book in parts, or a season of a show.' },
    /** Over a playlist's videos: all of them, as the parts of one tape, in the list's order. */
    downloadBook: (count: number) => `Download all ${format.number(count)} as one tape`,
    bookHint: 'They go into one folder named after the list, numbered in its order, and play on one into the next.',
    /** Said once something is on its way: [name] is the folder of the Tapes folder it goes in. */
    added: (name: string) => `On its way to Tapes/${name}`,
    /** Where tapes are fetched from, at the top of the screen. */
    sources: { youtube: 'YouTube', podcasts: 'Follow', books: 'Books', files: 'Phone' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Books, recordings and talks already on your phone, copied into a folder of your Tapes. The files you choose stay where they are.',
      choose: 'Choose files',
      chooseOther: 'Choose other files',
      folder: 'Folder name',
      folderPlaceholder: 'What the book or recording is called',
      folderNote: 'They go in the Tapes folder of your library under this name, in the order their names count.',
      copy: (count: number) => oneOrMany(count, 'Copy to Tapes', `Copy ${format.number(count)} files to Tapes`),
      chosen: (count: number) => oneOrMany(count, '1 file chosen', `${format.number(count)} files chosen`),
      copied: (done: number, of: number) => done === of ? oneOrMany(done, 'Copied to your Tapes.', `Copied ${format.number(done)} files to your Tapes.`) : `Copied ${format.number(done)} of ${format.number(of)} files to your Tapes; the rest could not be read.`,
      failed: 'None of the files could be copied.',
      pickFailed: 'The files could not be chosen.',
      toTapes: 'Go to Tapes',
    },
    books: {
      intro: 'Books out of copyright, read aloud by LibriVox’s volunteers and kept at the Internet Archive, free. Search by title or author, or paste the address of anything to listen to at archive.org.',
      placeholder: 'Title, author or archive.org link',
      nothingFound: 'No books found.',
      searchFailed: 'Could not search the Internet Archive.',
      /** The choice of books in every language, beside the languages themselves. */
      anyLanguage: 'Any language',
      popular: 'Most listened to',
      bookFailed: 'Could not read that book from the Internet Archive.',
      stats: (parts: number, minutes: number, here: number) => `${oneOrMany(parts, '1 part', `${format.number(parts)} parts`)} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} h ${format.number(minutes % 60)} min` : `${format.number(minutes)} min`}${here > 0 ? ` · ${format.number(here)} on the phone` : ''}`,
      fetchAll: 'Fetch the whole book',
      fetchRest: (count: number) => oneOrMany(count, 'Fetch the last part', `Fetch the other ${format.number(count)} parts`),
      size: (mb: number) => `About ${format.number(mb)} MB in all`,
      parts: (count: number) => oneOrMany(count, '1 part', `${format.number(count)} parts`),
    },
    podcasts: {
      intro: 'Follow a podcast or a YouTube channel and its new episodes come to your Tapes by themselves, or open one and fetch just the episodes you want. Search, or paste the address of a feed or a channel.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'No need to follow to listen: fetch any episode below. Follow, and new ones come by themselves.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Show',
      sources: 'Where from: any show in Apple’s podcast directory, which has nearly every podcast with a public feed, Spotify’s own included; any feed address, from Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud and the rest; and YouTube channels.',
      placeholder: 'Podcast or channel name, or a link',
      searchFailed: 'Could not search for podcasts. Check your connection.',
      feedFailed: 'Could not read that podcast’s feed.',
      /** A feed asked for by a link from outside the app, before it is read: where it is, and whether to. */
      linkAsk: 'Open a feed from a link?',
      linkAskBody: (host: string) => `A link asks to read the podcast feed at ${host}. Open it only if you trust where the link came from.`,
      linkOpen: 'Open',
      linkRefused: 'That link points at an address on this phone or your own network, which a link is not let read.',
      notChannel: 'That is not a YouTube channel’s address, or the channel could not be found.',
      /** Headings over a search's results: the channels YouTube found, and the podcasts Apple's directory did. */
      channelsHeading: 'YouTube channels',
      podcastsHeading: 'Podcasts',
      subscribers: (count: number) => oneOrMany(count, '1 subscriber', `${format.number(count)} subscribers`),
      channelsFailed: 'Could not search YouTube for channels.',
      nothingFound: 'No podcasts found.',
      yours: 'Your podcasts',
      noneYet: 'You follow no podcasts yet.',
      wifiOnly: 'New episodes on Wi‑Fi only',
      wifiOnlyNote: 'Episodes of the podcasts you follow are fetched by themselves only on Wi‑Fi. You can still fetch any episode by hand.',
      /** On the podcast's own screen. */
      follow: 'Follow',
      following: 'Following',
      unfollow: 'Stop following',
      autoDownload: 'Fetch newest episodes',
      autoDownloadNote: (keep: number) =>
        oneOrMany(keep, 'The newest episode is kept fetched.', `The newest ${format.number(keep)} episodes are kept fetched.`),
      keep: (count: number) => format.number(count),
      episodes: (count: number) => `Episodes · ${format.number(count)}`,
      noEpisodes: 'This feed has no episodes with a file.',
      download: 'Download',
      /** The button on an episode or a part, read aloud with what it fetches, in the order the language puts them. */
      downloadNamed: (title: string) => `Download ${title}`,
      /** The series' card that carries it on at one press: begun or not. */
      continue: 'Continue',
      start: 'Start',
      more: 'More',
      less: 'Less',
      stats: (total: number, here: number) => `${oneOrMany(total, '1 episode', `${format.number(total)} episodes`)} · ${format.number(here)} on the phone`,
      play: 'Play',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'When', all: 'All', week: 'Past week', month: 'Past month', quarter: 'Past 3 months' },
      newest: 'Newest first',
      oldest: 'Oldest first',
      noneThen: 'No episodes from this time.',
      fetchNext: 'Fetch next episodes',
      fetchNextNote: (count: number) =>
        oneOrMany(count, 'While you listen to an older episode, the one after it is fetched, so it is ready when this one ends.', `While you listen to an older episode, the ${format.number(count)} after it are fetched, so the next is ready as each one ends.`),
      /** Under an episode's name: when it came out and how long it is. */
      line: (date: string, length: string) => [date, length].filter(Boolean).join(' · '),
    },
  },
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
  /** Over the songs of a list opened from the results, and what the back key does there. */
  backToResults: 'Back to results',
  openPlaylistLabel: (title: string) => `Open playlist ${title}`,
  downloadLabel: (title: string) => `Download ${title}`,
  adding: 'Adding…',
  /** Listening without keeping: a result played at once, fetched into the app's own files, kept only when kept. See `lib/listen`. */
  listenLabel: (title: string) => `Listen to ${title} without keeping it`,
  readying: 'Getting it ready…',
  /** The minus beside a song listened to in the player: out of the queue, its file let go. */
  listenDrop: 'Don\'t keep it',

  /** A whole playlist at once. */
  addingPlaylist: 'Adding playlist…',
  downloadListed: {
    mp3: 'Download listed tracks · MP3',
    original: 'Download listed tracks · Original audio',
  },
  listedHint:
    'Already downloaded or queued tracks are skipped. Private, deleted and live videos may be unavailable.',
  listCreated: (name: string) => `List created: ${name}. Downloaded tracks will appear in Lists.`,
  /** On a result the library has a file of already, from a computer or an older version. */
  inLibrary: 'In your library',
  /** After a playlist is added: how many of it were not fetched, being here already. */
  alreadyHave: (count: number) =>
    oneOrMany(count, '1 song was already in your library and was not downloaded again.', `${format.number(count)} songs were already in your library and were not downloaded again.`),
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
    /** A song listened to that came in, in place of `done`: it is not in the library until it is kept. */
    listened: 'Ready to play, not kept',
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
    update: 'YouTube has changed and the downloader in this version cannot read it yet. Check for a newer one in Downloads, or update Jukebox.',
    unavailable: 'This video or playlist is unavailable. Try another public playlist or search.',
    unreachable: 'Could not reach YouTube. Check your connection and try again.',
    refused: 'YouTube could not complete this request. Try again later or choose another result.',
  },
};
