import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The bar, the player itself, the queue, and the sleep timer. */
export const player = {
  bar: {
    opensPlayer: 'Opens the player',
  },
  /** The player itself; see `PlayerSheet`. */
  sheet: {
    nothingPlaying: 'Nothing playing.',
    heart: 'Heart',
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
    playback: 'Playback',
    backToNormal: 'Back to normal speed and pitch',
    /** The button that undoes speed and pitch, and what a pitch of nought is written as. */
    normal: 'Normal',
    speed: 'Speed',
    pitch: 'Pitch',
    pitchHint: 'Semitones, up or down, with the recording still running at the speed above it.',
    effects: 'Effects',
    equalizer: { note: 'Bands, bass and loudness' },
    crossfade: { note: 'How one track gives way to the next' },
    allEffects: { title: 'All effects', note: 'Width, crossfeed, rotation and level' },
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
    refused: (most: number) => `A whole number of minutes, from 1 to ${most}`,
    howMany: 'Pause after how many minutes?',
    minutes: 'Minutes',
    start: 'Start',
  },
  /** The one line that says what the sleep timer is doing; see `player/sleep.ts`. */
  sleep: {
    endOfTrack: 'Pauses when this track ends',
    /** [time] is a countdown, `12:34`. */
    thenToTheEnd: (time: string) => `${time} left, then to the end of the track`,
    fadingOut: (time: string) => `Fading out, ${time} left`,
    pausesIn: (time: string) => `Pauses in ${time}`,
  },
};
