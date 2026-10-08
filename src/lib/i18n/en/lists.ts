import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The lists tab, one list, and the pickers that add to them. */
export const lists = {
  /** Naming a list, wherever one is made. */
  naming: {
    heading: 'Name the list',
    placeholder: 'List name',
    create: 'Create',
  },

  /** `PlaylistsScreen`: the tab. */
  screen: {
    newList: 'New list',
    fromTag: 'From a tag',
    empty: 'Nothing yet. A list is an order you chose — which is the one thing tags cannot hold.',
    /** Under the name of a list that is read from a tag; [count] is how many it holds. */
    followingTag: (count: number, tag: string) =>
      `${format.number(count)} ${oneOrMany(count, 'track', 'tracks')} · follows ${tag}`,
    fromListening: 'From your listening',
    discover: 'Discover',
    discoverHint: 'Music you do not have, from what you play',

    tagSheet: {
      heading: 'Make a list from a tag',
      follows: 'Follows the tag',
      copy: 'A copy',
      followsHint:
        'Always whatever carries the tag. Tag something later and it appears here; nothing in it can be reordered or removed.',
      copyHint:
        'Takes whatever carries the tag right now. The two go their own ways afterwards, so the list is yours to arrange.',
      noTags: 'No tags yet. Look some tracks up first.',
    },
  },

  /** The lists nobody made, by the ids in `db/autoLists.ts`. */
  auto: {
    mostPlayed: { name: 'Most played', hint: 'What you keep coming back to' },
    recentlyFound: { name: 'New this month', hint: 'First heard since the start of the month' },
    forgotten: { name: 'Forgotten', hint: 'Played a lot once, and not for half a year' },
    skipped: { name: 'Skipped most', hint: 'What you keep pressing next on' },
  },

  /** `PlaylistPicker`: putting tracks into a list. */
  picker: {
    /** Over the lists to choose from, which finish the sentence. */
    heading: (count: number) =>
      oneOrMany(count, 'Add 1 track to', `Add ${format.number(count)} tracks to`),
    noLists: 'No lists yet.',
    newList: 'New list…',
    already: (list: string) => `Already in ${list}`,
    added: (count: number, list: string) =>
      oneOrMany(
        count,
        `1 track added to ${list}`,
        `${format.number(count)} tracks added to ${list}`
      ),
  },

  /** `TrackPicker`: a list going to fetch tracks. */
  trackPicker: {
    heading: 'Add tracks',
    search: 'Search the library',
    alreadyHere: 'Already in this list',
    add: (count: number) =>
      `Add ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}`,
  },

  /** The screen one list opens on: a list, a record, an artist, a folder. */
  list: {
    /** What each is called when what it was opened for is no longer there. */
    album: 'Album',
    artist: 'Artist',
    folder: 'Folder',
    list: 'List',

    everythingTagged: (tag: string) => `Everything tagged ${tag}, as it stands`,
    away: (count: number) =>
      oneOrMany(
        count,
        '1 more is not in the library right now',
        `${format.number(count)} more are not in the library right now`
      ),

    addTracks: 'Add tracks',
    cover: 'Cover',
    deleteList: 'Delete list',

    albums: 'Albums',
    tracks: 'Tracks',
    opensAlbum: 'Opens the album',

    empty: {
      editable: 'Nothing in here yet. Add tracks above, or send them here from the library.',
      tag: 'Nothing carries that tag yet. Add it to a few tracks and they will appear here.',
      album: 'That record is not in the library any more.',
      artist: 'Nothing in the library is credited to them any more.',
      folder: 'There is nothing in that folder any more.',
      auto: 'Nothing qualifies yet. Listen to a few things first.',
    },

    mightBelong: 'Might belong here',
    mightBelongHint:
      'Judged from the tags the list already leans on, weighted so a rare one counts for more than a tag half the library carries.',

    choosePicture: 'Choose a picture…',
    firstFour: 'Use the first four',

    renameHeading: 'Rename the list',
    deleteQuestion: (name: string) => `Delete “${name}”?`,
    deleteHint: 'The list goes. The tracks stay on the phone.',
  },
};
