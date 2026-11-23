import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The bar, the player itself, the queue, and the sleep timer. */
export const player = {
  bar: {
    opensPlayer: 'Opens the player',
    /** The line under the name on the bar, where it is set to say what comes next or how long is left: see `ui/miniPlayer.ts`. */
    upNext: (title: string) => `Next: ${title}`,
    lastInQueue: 'Last in the queue',
    timeLeft: (clock: string) => `${clock} left`,
  },
  /** The player itself; see `PlayerSheet`. */
  sheet: {
    nothingPlaying: 'Nothing playing.',
    heart: "Favorite",
    /** What the repeat button is called in each of its three states. */
    repeat: { off: 'Repeat', all: 'Repeat all', one: 'Repeat one' },
    back: (seconds: number) => oneOrMany(seconds, 'Back 1 second', `Back ${seconds} seconds`),
    forward: (seconds: number) =>
      oneOrMany(seconds, 'Forward 1 second', `Forward ${seconds} seconds`),
    shuffleQueue: 'Shuffle the queue',
    playbackSettings: 'Playback settings',
    lyrics: 'Lyrics',
    translateLyrics: 'Translate the lyrics',
    /** The heading over the queue, with how many tracks are in it. */
    upNext: (count: number) => `Up next · ${format.number(count)}`,
    /** What a screen reader calls the progress bar. */
    position: 'Playback position',
    /** Where the bar has got to, said aloud: [position] and [duration] are `1:23` and `3:45`. */
    positionValue: (position: string, duration: string) => `${position} of ${duration}`,
  },
  /** The player while a tape plays: see `PlayerSheet`. */
  tape: {
    /** Under the name: which part of its book or show this is, [at] of [of]. */
    part: (at: number, of: number) => `Part ${format.number(at)} of ${format.number(of)}`,
    /** For an episode of a followed show, in place of `part`. */
    episode: (at: number, of: number) => `Episode ${format.number(at)} of ${format.number(of)}`,
    previousPart: 'Previous part',
    nextPart: 'Next part',
    /** The heading over the parts in the queue. */
    parts: (count: number) => `Parts · ${format.number(count)}`,
    /** Under the bar, for a tape in parts: how far into the whole of it, and how long is left of it. */
    book: (percent: number, left: string) => `${format.number(percent)}% of the whole · ${left} left`,
    /** The speed button, read aloud: [speed] as it is shown, `1.2×`. */
    speed: (speed: string) => `Speed ${speed}, tap for the next`,
    sleep: 'Sleep timer',
  },
  queue: {
    /** [title] is the track's. */
    remove: (title: string) => `Remove ${title}`,
    /** Said aloud once a screen reader has moved a row: where it now stands, `3` of `12`. */
    movedTo: (position: number, count: number) =>
      `Now ${format.number(position)} of ${format.number(count)}`,
    /** The heading over the songs picked to keep the music going, by what they turned out to be; see `AutoplayDivider`. */
    auto: {
      library: 'Similar songs · picked for you',
      fresh: 'New songs · from Discover',
      mixed: 'Similar and new · picked for you',
      /** The button beside it, and what a screen reader calls it and adds. */
      remove: 'Remove',
      removeLabel: 'Remove the songs picked for you',
      removeHint: 'No more are added to this queue until you play something else.',
      /** One line under the heading, where new songs were wanted and the library stood in for them, or a similar queue was filled at random. */
      notes: {
        offline: 'No connection, so these are from your library.',
        wifi: 'Discover is waiting for Wi-Fi, so these are from your library.',
        unavailable: 'New songs need the YouTube downloader, so these are from your library.',
        waiting: 'New songs are still downloading; your library fills in meanwhile.',
        random: 'Too little is known about this song, so some of these are from your library at random.',
      },
    },
  },
  /** The sheet behind the gear; see `PlayerSettings`. */
  settings: {
    /** The tabs of the player's card of settings, from its gear: how it sounds, how it looks, when it stops. */
    tabs: { sound: 'Sound', look: 'Look', sleep: 'Sleep' },
    /** The chip that shows the rest of the effects beside the player, and the one that puts them away again. */
    moreEffects: 'More',
    fewerEffects: 'Fewer',
    playback: 'Playback',
    backToNormal: 'Back to normal speed and pitch',
    /** The button that undoes speed and pitch, and what a pitch of nought is written as. */
    normal: 'Normal',
    speed: 'Speed',
    pitch: 'Pitch',
    pitchHint: 'Semitones, up or down, with the recording still running at the speed above it.',
    effects: 'Effects',
    equalizer: { note: 'Bands, bass and loudness' },
    allEffects: { title: 'All effects', note: 'Width, crossfeed, rotation and level' },
    /** A tape's own jumps, for its book or show: see `tapes/ownJumps.ts`. */
    jumps: {
      heading: 'Jumps for this book or show',
      general: 'General',
      backToGeneral: 'Back to the jumps of all tapes',
      back: 'Jump back',
      forward: 'Jump forward',
      note: 'In seconds, for this book or show alone, and for a headset, the notification and the car too. Every other tape keeps the jumps in the tape settings.',
    },
  },
  /** Asking for a sleep timer, at the foot of that sheet. */
  sleepTimer: {
    title: 'Sleep timer',
    cancel: 'Cancel the sleep timer',
    unsupported: 'Install the updated Android build to use the sleep timer.',
    about: 'Pauses the music after a while. The last half minute gets quieter.',
    pauseAfter: (minutes: number) => `Pause after ${minutes} minutes`,
    pauseAfterTyped: 'Pause after a number of minutes you type',
    custom: 'Custom…',
    pauseAtEnd: 'Pause at the end of this track',
    endOfTrack: 'End of track',
    finish: {
      title: 'Let the current track finish',
      note: 'When the time is up, wait for the song to end instead of fading it out.',
      label: 'Let the current track finish when the sleep timer runs out',
    },
    /** A shake in the last minutes adds ten: see `sleep/ShakeToExtend.kt`. */
    shake: {
      title: 'Shake for ten more minutes',
      note: 'In the last three minutes, shake the phone to add ten minutes, even with the screen off. A short buzz says it worked.',
      label: 'Shake the phone in the last three minutes to add ten minutes to the sleep timer',
    },
    refused: (most: number) => `A whole number of minutes, from 1 to ${most}`,
    howMany: 'Pause after how many minutes?',
    minutes: 'Minutes',
    start: 'Start',
    /** The same, while a tape plays: a part, and not a song or the music. */
    tape: {
      about: 'Pauses after a while. The last half minute gets quieter.',
      pauseAtEnd: 'Pause at the end of this part',
      endOfTrack: 'End of part',
      finish: {
        title: 'Let the current part finish',
        note: 'When the time is up, wait for the part to end instead of fading it out.',
        label: 'Let the current part finish when the sleep timer runs out',
      },
    },
  },
  /** The one line that says what the sleep timer is doing; see `player/sleep.ts`. */
  /** Places marked in a tape, each with a note: see `tapes/marks.ts`, `MarksSheet` and the Marks screen. */
  /** A tape's chapters: see `tapes/extras.ts` and `ChaptersSheet`. */
  /** A tape's captions, shown as a song's words are. */
  transcript: {
    heading: 'Transcript',
    show: 'Show what is said',
    none: 'This video has no captions to follow.',
  },
  chapters: {
    heading: (count: number) => `Chapters · ${format.number(count)}`,
    untitled: (at: number) => `Chapter ${format.number(at)}`,
    at: (at: number, of: number) => `Chapter ${format.number(at)} of ${format.number(of)}`,
    sleepAtEnd: 'Stop at the end of this chapter',
    listHint: 'Lists the chapters',
  },
  marks: {
    screen: 'Marks',
    heading: 'Marks in this tape',
    add: 'Mark this place',
    /** The player's button that opens the tape's marks: how many there are. */
    list: (count: number) => oneOrMany(count, 'Marks, 1 so far', `Marks, ${format.number(count)} so far`),
    noteAt: (time: string) => `Mark at ${time}`,
    noteHint: 'A note of what is here, if you like. You can leave it empty.',
    notePlaceholder: 'What is here',
    save: 'Mark',
    none: 'Nothing marked in this tape yet. Mark a place with the button beside the sleep timer.',
    noneAnywhere: 'Nothing marked yet. While a tape plays, mark a place from the player and write a note of what is there; every mark shows up here.',
    noNote: 'No note',
    remove: (time: string) => `Remove the mark at ${time}`,
    editNote: 'Edit the note',
    goHint: 'Goes to this place',
    playHint: 'Plays the tape from this place',
    howTo: 'Press a mark to go to it, hold it to change its note.',
    all: 'All marks',
    count: (count: number) => oneOrMany(count, '1 mark', `${format.number(count)} marks`),
  },
  sleep: {
    endOfTrack: 'Pauses when this track ends',
    /** [time] is a countdown, `12:34`. */
    thenToTheEnd: (time: string) => `${time} left, then to the end of the track`,
    fadingOut: (time: string) => `Fading out, ${time} left`,
    pausesIn: (time: string) => `Pauses in ${time}`,
    /** The sleep timer set to the end of a tape's chapter: while it waits, paused, and the time to it while it plays. */
    endOfChapter: 'Pauses when this chapter ends',
    chapterIn: (time: string) => `${time} to the end of the chapter`,
    tape: {
      endOfTrack: 'Pauses when this part ends',
      thenToTheEnd: (time: string) => `${time} left, then to the end of the part`,
    },
  },
};
