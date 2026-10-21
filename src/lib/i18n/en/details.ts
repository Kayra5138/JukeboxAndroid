import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

const files = (count: number) => `${format.number(count)} ${oneOrMany(count, 'file', 'files')}`;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  albumArtist: 'album artist',
  genre: 'genre',
  year: 'year',
  track: 'track number',
  disc: 'disc number',
  cover: 'cover',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** A track's details and tags, and writing them into files. */
export const details = {
  /** The details screen itself: its three tabs, and a track that has gone. */
  screen: {
    tabs: { general: 'General', tags: 'Tags', lyrics: 'Lyrics' },
    missing:
      'That track is no longer in the library. It may have been deleted, moved, or left outside the folder Jukebox is reading.',
    goBack: 'Go back',
  },

  /** What more than one tab says. */
  lookUp: 'Look up',
  searchFailed: 'The search did not get through.',

  general: {
    fields: {
      title: 'Title',
      artist: 'Artist',
      album: 'Album',
      /** Whoever the whole record is by, which tells two records of one name apart. */
      albumArtist: 'Album artist',
      year: 'Release year',
      trackNumber: 'Track number',
      discNumber: 'Disc number',
    },
    notAYear: 'That is not a year.',
    notAPlace: 'A whole number, from 1 up.',

    chooseCoverLabel: 'Choose a cover from the gallery',
    noCover: 'No cover',
    chooseFromGallery: 'Choose from gallery',
    removeCover: 'Remove cover',
    keepCover: 'Keep the one it had',
    coverChosen: 'Cover chosen. Save to keep it.',

    lookUpHint:
      'Searches for the title and artist as they are written below, and fills in what it finds: names, album, year, place on the record and cover.',
    nothingFound: 'Nothing was found for that title and artist.',
    found: (sources: string[], withCover: boolean) =>
      `Found on ${sources.join(' and ')}${withCover ? ', cover included' : ''}. Check it, then save to keep it.`,

    discard: 'Discard my edit',
    saveHint:
      'What is saved here is kept as yours: looking the library up again will leave this track alone rather than write over it.',
    editGone: 'Your edit is gone. A lookup can fill this in again.',

    inFile: 'In the file',
    writeLabel: 'Write these details into the file',
    writeToFile: 'Write to file',
    saveFirst: 'Save first. Only what has been saved is written into the file.',
    writeHint:
      'Puts the title, artist, album, year, track and disc number as the library ' +
      'shows them, the first tag as the genre, and a cover saved here into the file ' +
      'itself, where other players and other devices will find them. Android asks ' +
      'before anything is changed. Whatever else the file holds is left as it is, ' +
      'and lyrics are not written.',
    cannotWrite: 'Only MP3 and FLAC files can be written to. The details of this one stay in the app.',
    nothingWritten: 'Nothing was written.',
    couldNotWrite: 'It could not be written.',

    listening: 'Listening',
    timesPlayed: 'Times played',
    playedToEnd: 'Played to the end',
    timeSpent: 'Time spent',
    firstPlayed: 'First played',
    lastPlayed: 'Last played',
    never: 'never',
    listenedSeconds: (seconds: number) =>
      oneOrMany(seconds, '1 second', `${format.number(seconds)} seconds`),
    listenedMinutes: (minutes: number) =>
      oneOrMany(minutes, '1 minute', `${format.number(minutes)} minutes`),
    listenedHours: (hours: number, minutes: number) => `${format.number(hours)}h ${minutes}m`,

    file: 'File',
    name: 'Name',
    folder: 'Folder',
    length: 'Length',
    detailsFrom: 'Details from',
    unknown: 'unknown',
    from: {
      notLookedUp: 'not looked up',
      yourEdit: 'your edit',
      notFound: 'not found',
      lookup: 'a lookup',
    },
  },

  tags: {
    lookUpHint:
      'Searches for this track\'s tags. The ones you typed stay; the ones a lookup brought before are replaced by what it finds now.',
    noneFound: 'No tags were found for this track.',
    found: (count: number, source: string) =>
      `${format.number(count)} from ${source}. Arrange them, then save to keep them.`,
    saveHint:
      'The first tag is the one counted as the genre. A tag you typed is kept as yours: no later lookup will remove it.',
  },

  /** The list of tags with its arrows, wherever it is drawn. */
  editor: {
    label: 'Tags',
    add: 'Add a tag',
    /** What a screen reader calls the arrows and the cross beside a tag; [tag] is the tag. */
    moveUp: (tag: string) => `Move ${tag} up`,
    moveDown: (tag: string) => `Move ${tag} down`,
    remove: (tag: string) => `Remove ${tag}`,
  },

  /** Asking for one tag to put on a run of tracks. */
  tagPrompt: {
    heading: (count: number) =>
      oneOrMany(count, 'Add a tag to 1 track', `Add a tag to ${format.number(count)} tracks`),
    placeholder: 'Tag',
  },

  lyrics: {
    lookUpHint:
      'Searches for this track\'s words the way playing it does, and replaces what is stored if it finds them.',
    nothingMatched: 'Nothing matched this track. The search below rules nothing out.',
    foundAndSaved: 'Found and saved.',
    nothingCameBack: 'Nothing came back for that.',
    cleared: 'Cleared. The next lookup will search again.',
    notSeconds: 'That is not a number of seconds.',

    stored: 'What is stored',
    none: 'None yet',
    /** What kind of words are kept and where they came from, with the count of timed lines if any. */
    kept: (timed: boolean, byHand: boolean, lines: number) =>
      `${timed ? 'Timed' : 'Plain text'}, ${byHand ? 'chosen by hand' : 'from LRCLIB'}` +
      (lines > 0 ? ` · ${oneOrMany(lines, '1 line', `${format.number(lines)} lines`)}` : ''),
    forget: 'Forget this and look again',
    saveChanges: 'Save changes',
    timedHint:
      'Each line keeps the time in front of it. Change the words and leave the brackets, or the line loses its place.',
    plainHint: 'Change anything. Saved words are kept as yours and no lookup replaces them.',

    timing: 'Timing',
    timingHint:
      'Shifts every line at once. Use it when the words are right but arrive early or late — open the player and nudge until they land, or tap the figure and type it. A positive shift makes the words arrive later.',
    earlier: (seconds: number) => `−${seconds}s`,
    later: (seconds: number) => `+${seconds}s`,
    /** How far the words have been moved; [written] is the seconds as this language writes them. */
    shiftedEarlier: (written: string) => `−${written}s`,
    shiftedLater: (written: string) => `+${written}s`,
    noShift: 'no shift',
    reset: 'Reset',
    offsetHeading: 'How far out are the words?',
    offsetPlaceholder: 'Seconds, e.g. 1.5 or -0.75',
    /** For a screen reader, on the figure of the shift, which is pressed to type one. */
    typeOffset: 'Type an exact shift',
    /** What a screen reader calls the box the stored words are edited in. */
    wordsField: 'Lyrics',

    byHand: 'Search by hand',
    byHandHint:
      'Nothing is ruled out here, unlike the automatic search — which refuses anything whose length disagrees, and is why some tracks never find their words.',
    queryPlaceholder: 'Artist and title',
    candidateTimed: 'timed',
    candidatePlain: 'plain',

    paste: 'Paste',
    pasteHint: 'Takes an LRC file or plain words. Timestamps make it a timed set.',
    savePasted: 'Save pasted',
  },

  /** The screen that looks the whole library up, a run of tracks at a time. */
  library: {
    coversSaved: (count: number) => `${format.number(count)} album covers added.`,
    stoppedOffline: (matched: number) =>
      `Nothing answered, so the run stopped after ${format.number(matched)} matched. Nothing was written for the rest — they are still waiting to be tried.`,
    /** One of the two services was down and the other was not. */
    serviceUnreachable: (service: string) =>
      `${service} could not be reached, so the run went on without it. What needed it was left as it was and will be tried next time.`,
    stoppedUnexpectedly: 'The lookup stopped unexpectedly.',

    nothingAnswered: 'Nothing answered. Stopping.',
    /** Shown under the count, which keeps moving: only the one service is being left alone. */
    rateLimited: 'One of the services asked for a pause. It will be asked again in a minute.',
    lookingUp: 'Looking up…',
    /** A track is done when its details and its cover are both settled. */
    lookingUpProgress: (done: number, total: number) =>
      `Looking up… ${format.number(done)} of ${format.number(total)} tracks done`,
    /** The same, while one album is being looked up as a whole. */
    lookingUpAlbum: (album: string, done: number, total: number) =>
      `Looking up “${album}”… ${format.number(done)} of ${format.number(total)} tracks done`,
    soFar: (matched: number, covers: number) =>
      `${format.number(matched)} matched, ${format.number(covers)} covers so far`,
    stop: 'Stop',
    /** The name of the notification a lookup shows while it goes on behind the screen, as Android's settings list it. */
    lookupChannel: 'Lookups',

    selected: (count: number) => `${format.number(count)} selected`,
    /** How the library stands. Tracks edited by hand are only mentioned when there are some. */
    summary: (matched: number, edited: number, notFound: number, untried: number) =>
      [
        `${format.number(matched)} matched`,
        edited > 0 ? `${format.number(edited)} edited` : null,
        `${format.number(notFound)} not found`,
        `${format.number(untried)} untried`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Reset',
    lookUpMissing: 'Look up missing',
    hint: 'Tap a track to correct it by hand. Drag down the checkboxes to select a run.',
    searchPlaceholder: 'Search these tracks',

    noGenre: 'no genre',
    noMatch: 'no match found',
    notLookedUp: 'not looked up yet',
    /**
     * What a screen reader says for the line under a title, which the eye
     * tells apart by colour alone: found by a lookup, or written in by hand.
     */
    matchedSpoken: (artist: string, title: string) => `Matched: ${artist} — ${title}`,
    manualSpoken: (artist: string, title: string) => `Set by hand: ${artist} — ${title}`,
  },

  /**
   * Everything that can be done to tracks chosen together: on the Tags
   * screen, and from the library's selection. One sheet in both places.
   */
  selection: {
    more: 'More…',
    /** For a screen reader, on the button that opens the sheet. */
    moreHint: 'Everything that can be done to the selected tracks',
    heading: (count: number) =>
      `${format.number(count)} ${oneOrMany(count, 'track', 'tracks')} selected`,
    /** The sheet's three parts: finding things out, changing them, and the rest. */
    sections: { find: 'Look up', change: 'Change', other: 'Other' },
    actions: {
      lookUp: {
        label: 'Look up details',
        hint: 'Forgets what was found for them before and looks them up again, covers included. Your own edits stay.',
      },
      covers: {
        label: 'Look up covers',
        hint: 'Covers only, for the ones without one. Nothing else is looked up again, and a cover you chose or took off stays as it is.',
      },
      lyrics: {
        label: 'Look up lyrics',
        hint: 'From the files and .lrc files first, then LRCLIB. Words you chose stay.',
      },
      edit: {
        label: 'Edit details together',
        hint: 'Artist, album artist, album or year, set on all of them at once',
      },
      addTag: { label: 'Add a tag', hint: 'One tag, put on all of them' },
      removeTag: { label: 'Remove a tag', hint: 'One of their tags, taken off all of them' },
      cover: { label: 'Choose a cover', hint: 'One picture from your gallery, for all of them' },
      write: {
        label: 'Write to files',
        hint: 'Puts the details the library shows into the files themselves. Android asks first.',
      },
      addToList: { label: 'Add to a list', hint: 'Puts them in one of your lists' },
      reset: {
        label: 'Reset',
        hint: 'Forgets what lookups found for them. Your own edits stay.',
      },
      delete: { label: 'Delete from phone', hint: 'Erases the files. Android asks first.' },
    },
    /** Under a lookup that cannot be started while another is going. */
    busy: 'Another lookup is under way. Wait for it to finish, or stop it.',

    editHeading: (count: number) =>
      `Edit ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}`,
    editHint:
      'Fill in only what should be the same on all of them. An empty box leaves each track as it is; to empty a field on all of them, tick the option under it. Titles, track and disc numbers are not touched.',
    /** In a box whose tracks do not all say the same thing. */
    keepEach: 'Each keeps its own',
    /** In a box whose field is empty on every track: on the one track, where only one is chosen. */
    empty: 'Empty',
    /**
     * Under each box, to empty that field on every track rather than leave
     * each its own. The artist cannot be emptied, only given back to what
     * each file says (see `CLEARS` in `metadata/edit.ts`).
     */
    clearOn: { remove: 'Remove from all', own: 'Use each file’s artist' },
    /** In a box whose field is being cleared, in place of what was typed. */
    cleared: { remove: 'Removed from all', own: 'Each file’s artist' },
    edited: (count: number) =>
      oneOrMany(
        count,
        'Saved. It is your edit now, and lookups leave it alone.',
        `Saved for ${format.number(count)} tracks. They are your edits now, and lookups leave them alone.`
      ),

    tagAdded: (tag: string, count: number) =>
      `“${tag}” is on ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')} now.`,
    removeTagHeading: (count: number) =>
      `Remove a tag from ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}`,
    /** A tag in the list to remove, with how many of the tracks carry it. */
    tagOption: (tag: string, count: number) => `${tag} · ${format.number(count)}`,
    noTags: 'None of these tracks has a tag.',
    tagRemoved: (tag: string, count: number) =>
      `“${tag}” is off ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}.`,

    resetQuestion: (count: number) =>
      `Reset ${format.number(count)} ${oneOrMany(count, 'track', 'tracks')}?`,
    resetBody:
      'What lookups found for them is forgotten, and they count as not looked up. Your own edits stay. This cannot be undone.',

    coversProgress: (done: number, total: number) =>
      `Looking for covers… ${format.number(done)} of ${format.number(total)} tracks done`,
    coversNone: 'No new covers were found.',
    lyricsProgress: (done: number, total: number) =>
      `Looking for lyrics… ${format.number(done)} of ${format.number(total)} tracks done`,
    lyricsSoFar: (found: number) => `${format.number(found)} found so far`,
    /** How a lyrics run ended: found for so many of those that had none, and how many already had some. */
    lyricsFound: (found: number, wanted: number, had: number) =>
      [
        wanted > 0 ? `Lyrics found for ${format.number(found)} of ${format.number(wanted)}.` : null,
        had > 0
          ? oneOrMany(had, '1 already had them.', `${format.number(had)} already had them.`)
          : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Nothing to look for: the words of these were chosen by hand.',
    lyricsOffline: 'LRCLIB could not be reached, so the run stopped. The rest can be tried again later.',
  },

  /** Writing a run of tracks into their files, and what became of each. */
  write: {
    heading: (count: number) => `Write details into ${files(count)}?`,
    body: (count: number) =>
      `${files(count)} will be changed: the title, artist, album, year, track ` +
      'and disc number, first tag as genre and saved cover the library shows for each ' +
      'go into the file itself. Android will ask you to allow it. Anything else in a ' +
      'file is left as it is.',
    noneHeading: 'None of these can be written to',
    noneBody: 'Only MP3 and FLAC files can be written to, and not the track that is playing.',
    /** What will be passed over. Only asked for when something will be. */
    skipping: (otherKind: number, playing: boolean) =>
      otherKind > 0 && playing
        ? `${files(otherKind)} of another kind will be skipped, and the track that is playing will be skipped.`
        : otherKind > 0
          ? `${files(otherKind)} of another kind will be skipped.`
          : 'The track that is playing will be skipped.',
    confirmLabel: (count: number) => `Write details into ${files(count)}`,
    confirm: 'Write',
    nothingWritten: 'Nothing was written.',
    couldNotStart: 'It could not be started.',

    writing: 'Writing to files',
    progressLabel: (done: number, total: number) => `${format.number(done)} of ${files(total)} written`,
    progress: (done: number, total: number) => `${format.number(done)} of ${format.number(total)}`,
    stopping: 'Stopping once this file is finished.',
    keepOpen: 'Each file is checked before the original is touched. Keep the app open.',
    stopLabel: 'Stop after the file being written',
    stop: 'Stop',
    stoppedShort: (count: number) => `Stopped with ${files(count)} not attempted.`,

    /** One file's outcome, as a line. */
    written: (changed: string[]) =>
      changed.length > 0
        ? `Written: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Written.',
    unchanged: 'Already says all of this. Left as it is.',
    skippedPlaying: 'Skipped: it is playing. Try again once it is not.',
    skippedFormat: 'Skipped: only MP3 and FLAC files can be written to.',
    failed: (reason: string) => `Failed: ${reason}`,
    noReason: 'It could not be written. The file has not been touched.',

    /** A whole run's outcome, as a heading. */
    summary: (counts: { written: number; unchanged: number; skipped: number; failed: number }) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`Wrote ${files(counts.written)}.`);
      if (counts.unchanged > 0) parts.push(`${files(counts.unchanged)} already matched.`);
      if (counts.skipped > 0) parts.push(`Skipped ${files(counts.skipped)}.`);
      if (counts.failed > 0) parts.push(`${files(counts.failed)} failed.`);
      return parts.length > 0 ? parts.join(' ') : 'Nothing to write.';
    },
  },

  /** The pairs of files that might be one song. */
  same: {
    note:
      'These look like one song under two files. Merging moves everything the first file has over to the second: its listens, tags, lyrics and places in lists. Keeping them apart leaves both as they are, and you are not asked about the pair again.',
    failed: (error: string) => `That could not be done, and nothing was changed. ${error}`,
    empty: 'Nothing left to decide.',
    from: 'From',
    into: 'Into',
    keepApart: 'Keep apart',
    merge: 'Merge',
    /** Choosing several pairs and answering them at once. */
    bulk: {
      /** On each pair, under its two buttons: the history moves, then the first file is erased. */
      mergeDelete: 'Merge, and delete the first file',
      /** In the bar, while a merge of several is being asked about. */
      deleteToo: 'Delete the first file of each pair as well',
      deleteNote: 'Android asks before anything is deleted.',
      notDeleted: 'The files were not deleted.',
      deleted: (count: number) => oneOrMany(count, '1 file deleted.', `${format.number(count)} files deleted.`),
      /** For a screen reader: the box on each pair. */
      choose: 'Choose this pair',
      chosen: (count: number) => oneOrMany(count, '1 pair chosen', `${format.number(count)} pairs chosen`),
      merge: (count: number) => `Merge ${format.number(count)}`,
      keepApart: (count: number) => `Keep ${format.number(count)} apart`,
      /** Asked before a merge of several, which cannot be undone. */
      confirm: (count: number) =>
        oneOrMany(
          count,
          'Merge 1 pair? The first file’s listens, tags, lyrics and places in lists move to the second, and cannot be split off again.',
          `Merge ${format.number(count)} pairs? In each, the first file’s listens, tags, lyrics and places in lists move to the second, and cannot be split off again.`
        ),
      done: (done: number, skipped: number) =>
        skipped > 0
          ? `${oneOrMany(done, '1 pair answered', `${format.number(done)} pairs answered`)}; ${oneOrMany(skipped, '1 was', `${format.number(skipped)} were`)} already settled by another.`
          : oneOrMany(done, '1 pair answered.', `${format.number(done)} pairs answered.`),
    },
    unknown: 'Unknown',
    noFileName: 'File name not known',
    /** What a file has to its name, in as few words as say it. */
    holds: (side: { listens: number; tags: number; lyrics: boolean; lists: number }) => {
      const parts: string[] = [];
      if (side.listens > 0) {
        parts.push(oneOrMany(side.listens, '1 listen', `${format.number(side.listens)} listens`));
      }
      if (side.tags > 0) parts.push(oneOrMany(side.tags, '1 tag', `${format.number(side.tags)} tags`));
      if (side.lyrics) parts.push('lyrics');
      if (side.lists > 0) {
        parts.push(oneOrMany(side.lists, 'in 1 list', `in ${format.number(side.lists)} lists`));
      }
      return parts.length > 0 ? parts.join(' · ') : 'Nothing yet';
    },
  },
};
