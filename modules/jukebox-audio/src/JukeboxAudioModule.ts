import { NativeModule, requireNativeModule } from 'expo';

import type {
  EqualizerSettings,
  EqualizerState,
  FolderEntry,
  JukeboxAudioEvents,
  LibraryTrack,
  Loudness,
  PermissionResponse,
  PlayerStatus,
  QueueEntry,
  QueueItem,
  RepeatMode,
  TransitionSettings,
  Transitions,
} from './JukeboxAudio.types';

/**
 * A song turned into something to play along to.
 *
 * Everything found in the recording, at one density. What makes the game easy
 * or hard is how long a tile is visible and how exactly a tap has to land, not
 * how much of this is shown — thinning a chart takes notes out of bars and
 * leaves something that no longer follows the music.
 */
export type Chart = {
  /** Bumped when the analysis changes, so old charts are made again. */
  version: number;
  durationMs: number;
  /**
   * The spacing of the grid the notes were laid on, in milliseconds.
   *
   * The board is drawn from this: a row is one step, so a tile is exactly as
   * tall as the time between two lines and rows meet without a gap. Nought for
   * a song with no pulse to find.
   */
  stepMs: number;
  notes: ChartNote[];
  /**
   * The stretches of the record with nothing in them, as `[startMs, endMs)`.
   *
   * Silence by the song's own standard rather than an absolute one: a long way
   * below its usual level, for long enough that it is a pause and not a breath.
   * The board puts no keys in them. Missing from a chart made before they were
   * looked for, which reads as a song with no pauses in it.
   */
  quiet?: QuietSpan[];
  /**
   * How loud the record is as it goes: one figure every `levelMs`, as a
   * percentage of the song's own usual level, so 100 is the song at its
   * ordinary loudness whatever the mastering.
   *
   * The board leaves a row empty where this drops well below its neighbours.
   * Missing from older charts and from a file of silence, which both read as a
   * song with nothing to ease off from.
   */
  levelMs?: number;
  levels?: number[];
  /**
   * Where each step of the grid falls in the recording, in milliseconds.
   *
   * Everything else in a chart is in grid time, where step `i` is at exactly
   * `i * stepMs`. A band does not play that evenly, and this is the way back:
   * `lines[i]` is the moment of the recording step `i` begins at. Absent or
   * empty for a song with no pulse, where grid time is the song's own.
   */
  lines?: number[];
  /** How many steps make a bar, and the step the first bar starts on. */
  barSteps?: number;
  barAt?: number;
  /**
   * The lane the song suggests for every quarter of a step, a digit each: from
   * the tune where there is one, and the same for every bar that is the same
   * music.
   */
  lanes?: string;
  /** How hard the music hits at every quarter of a step, `0` softest to `z` hardest. */
  accents?: string;
  /**
   * How loud every quarter of a step is against the passage it is in: `k` is
   * the level of its surroundings and `0` is nothing. Where the board finds
   * its rests, the same in every bar that is the same music.
   */
  ease?: string;
};

/** Where a pause starts and where the music comes back, in milliseconds. */
export type QuietSpan = [startMs: number, endMs: number];

/** One tile: when it lands, which of the four lanes, and how long it is held. */
export type ChartNote = {
  atMs: number;
  lane: number;
  /** Nought is a tap. Anything more has to be kept down for that long. */
  holdMs: number;
};

/**
 * A sleep timer, as the playback service is keeping it.
 *
 * Kept there and only reported here: it has to fire with the app swiped away
 * and the screen off, when there is no JavaScript to fire it.
 */
export type SleepTimer = {
  /** `off` is no timer at all, and what every other field is then is not news. */
  kind: 'off' | 'duration' | 'endOfTrack';
  /**
   * When a duration runs out, in the milliseconds `Date.now()` counts in.
   *
   * A moment rather than a time left, so that a countdown is arithmetic done
   * here once a second and not a question asked across the bridge once a
   * second. Null where there is nothing to count: the end of a track, or a
   * duration that has run out and is waiting for one.
   */
  endsAt: number | null;
  /** Whether a duration waits for the track to end rather than cutting it. */
  finishTrack: boolean;
  /** Whether the last half minute gets quieter. Never with `finishTrack`. */
  fade: boolean;
  /** The time is up and the track is being let finish; the next stop is its end. */
  finishing: boolean;
};

/** What to ask for. A new timer always takes the place of the old one. */
export type SleepTimerRequest =
  | {
      kind: 'duration';
      durationMs: number;
      /** When the time is up, wait for the track to end. */
      finishTrack: boolean;
      /** Left out, the music fades. */
      fade?: boolean;
    }
  | { kind: 'endOfTrack' };

type SleepTimerEvents = {
  /**
   * The timer was set, cancelled, fired, or ran out and began waiting for a
   * track to end. Not sent as it counts down. Never sent by a native module
   * that predates the timer.
   */
  onSleepTimerChange: (event: SleepTimer) => void;
};

declare class JukeboxAudioModule extends NativeModule<JukeboxAudioEvents & SleepTimerEvents> {
  readonly buildTimestamp?: string;
  downloadArtworkAsync?(url: string): Promise<string>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
  /**
   * Permission to post the media notification, separate because it fails
   * differently: without it the foreground service plays on with no controls
   * anywhere on screen. Always granted below Android 13.
   */
  getNotificationPermissionsAsync(): Promise<PermissionResponse>;
  requestNotificationPermissionsAsync(): Promise<PermissionResponse>;

  /**
   * Every track under `rootFolder`, recursively. `rootFolder` is a media store
   * relative path without a leading slash, e.g. `Music`.
   */
  queryTracksAsync(rootFolder: string): Promise<LibraryTrack[]>;
  /**
   * One track by media store id, without reading the rest of the library. Null
   * when there is no such track *or* when it sits outside `rootFolder`, which
   * is the same thing as far as a library rooted there is concerned.
   */
  queryTrackAsync(trackId: string, rootFolder: string): Promise<LibraryTrack | null>;
  /**
   * The play-along chart for a track, made from the recording if it has not
   * been made before.
   *
   * Slow the first time — it decodes the whole song and looks at every window
   * of it — and instant afterwards, because the answer is kept. Null for a file
   * the phone cannot open.
   */
  chartForAsync(trackId: string): Promise<Chart | null>;
  /**
   * Opens what a run will need while nobody is waiting on it.
   *
   * The mixer and the system server are both another process away and both
   * answer instantly the second time. Called when the game screen appears, so
   * that the first key of a song is not where the introductions happen.
   */
  prepareGame?(): void;
  /**
   * Whether a run is being played.
   *
   * The record is not touched either way; this only opens and closes the tap's
   * own audio track. Three attempts at answering a key with sound all failed
   * the same way — anything laid over a finished mix has to agree with it, and
   * anything done to its level is heard as a fault rather than as a response.
   */
  gameAudio?(on: boolean): void;
  /**
   * Something happened on the board, and which of three things it was.
   *
   * A knock, not a note: filtered noise, quiet, with no pitch and no lane.
   * `hit` is soft and dull, `empty` is short and brittle — a tap that found
   * nothing — and `lapse` falls away, which is the one that is heard as a key
   * escaping rather than as a finger landing. All three can be told apart
   * without looking up from the board.
   */
  knocked?(kind: 'hit' | 'empty' | 'lapse' | 'kept' | 'letgo'): void;
  /**
   * A key is being held down, or no longer is.
   *
   * A soft breath that loops for as long as a finger is on a hold. Switched
   * rather than played, because how long it lasts is up to the player. It ends
   * in one of the two knocks above: `kept`, which rises and is the only sound
   * on the board meant as a reward, or `letgo`, which is merely a finger
   * leaving the glass.
   */
  held?(on: boolean): void;
  /**
   * Folders under `rootFolder` that hold at least one track, with their counts,
   * busiest first. Reads only the path of each row, so this is a good deal
   * cheaper than scanning tracks and grouping them here.
   */
  queryFoldersAsync(rootFolder: string): Promise<FolderEntry[]>;
  /**
   * The cover stored inside the file, cached and returned as a `file://` uri.
   * Null when the file carries none. The only artwork source that resolves:
   * `LibraryTrack.artworkUri` is always null.
   */
  getEmbeddedArtworkAsync(trackId: string): Promise<string | null>;
  /**
   * Hand the whole queue to the player. Keeping it native is what gives the
   * notification working next/previous buttons and lets shuffle and repeat be
   * ExoPlayer's problem rather than ours.
   */
  setQueueAsync(tracks: QueueItem[], startIndex: number, autoPlay: boolean): Promise<void>;
  playAsync(): Promise<void>;
  pauseAsync(): Promise<void>;
  nextAsync(): Promise<void>;
  /** Restarts the current track unless it just started, then steps back. */
  previousAsync(): Promise<void>;
  skipToIndexAsync(index: number): Promise<void>;
  seekToAsync(seconds: number): Promise<void>;
  /** Insert into the live queue without interrupting playback. -1 appends. */
  insertIntoQueueAsync(track: QueueItem, index: number): Promise<void>;
  moveInQueueAsync(from: number, to: number): Promise<void>;
  removeFromQueueAsync(index: number): Promise<void>;
  setShuffleAsync(enabled: boolean): Promise<void>;
  /**
   * Rearranges the queue, leaving the current track playing and first. Answers
   * with the order the player ended up holding.
   *
   * @param order Ids for the rest of the queue, in the order to lay them out.
   *   What a shuffle should feel like is decided in JavaScript, where a track's
   *   artist is known and the rule can be tested; the player is told the answer
   *   rather than asked for one. Omitted asks for a plain shuffle.
   */
  shuffleQueueAsync(order?: string[]): Promise<{ items: QueueEntry[]; index: number }>;
  /**
   * Erases tracks from the device after the user agrees to it. Answers with
   * whether they did; a refusal is an ordinary outcome, not an error.
   */
  deleteTracksAsync(trackIds: string[]): Promise<boolean>;
  setRepeatModeAsync(mode: RepeatMode): Promise<void>;
  /**
   * Sets a sleep timer in place of any there was, and answers with it.
   *
   * When it fires the music is paused, not stopped: the queue and the place in
   * it are kept. An answer of `off` means it could not be kept -- no playback
   * service, a duration of nothing, or "end of track" with nothing loaded.
   */
  setSleepTimerAsync?(request: SleepTimerRequest): Promise<SleepTimer>;
  cancelSleepTimerAsync?(): Promise<SleepTimer>;
  getSleepTimerAsync?(): Promise<SleepTimer>;
  /**
   * ExoPlayer time-stretches, so `speed` changes tempo while keeping the
   * original pitch, and `pitch` moves independently of it. Both are clamped to
   * 0.25–4.
   */
  setPlaybackParamsAsync(speed: number, pitch: number): Promise<void>;
  getStatusAsync(): Promise<PlayerStatus>;
  /**
   * The queue the player is actually holding. A JavaScript reload throws away
   * the app's own copy while the foreground service keeps playing, and this is
   * the way back to it. Empty until the session connects.
   */
  getQueueAsync(): Promise<QueueEntry[]>;
  /**
   * Asks for a picture and keeps a copy of it, answering with where the copy
   * landed — or null if the user backed out.
   *
   * The copy is the point: a picked uri's read grant dies with the task, and
   * the file behind it is the user's to move or delete.
   */
  pickImageAsync?(): Promise<string | null>;
  /**
   * Puts the copy of the library the car reads into place.
   *
   * The copy is written beside the database as `car.next.db`; this renames it
   * to the name the playback service opens. Answers false if there was no new
   * copy to put in place.
   */
  publishCarCopyAsync?(): Promise<boolean>;
  /**
   * Saves a backup where the user chooses, through the system's own "save as".
   *
   * `document` is the backup, already written out as text; `pictures` are the
   * file names of the covers it refers to, which are looked for in the app's
   * artwork folder and nowhere else. Answers false if the user backed out.
   */
  exportBackupAsync?(name: string, document: string, pictures: string[]): Promise<boolean>;
  /**
   * Lets the user choose a backup and answers what it says, or null if they
   * backed out. Nothing on the phone has changed when this returns: the
   * pictures are unpacked to one side and wait for `adoptBackupArtworkAsync`.
   *
   * `artworkHome` is where a cover lives on this phone, ending in a slash, so
   * a reference in the backup can be pointed at it by adding the file name.
   */
  openBackupAsync?(): Promise<{ json: string; artworkHome: string } | null>;
  /** Moves the named pictures of the backup just opened into the artwork folder. */
  adoptBackupArtworkAsync?(names: string[]): Promise<void>;
  /**
   * Starts the app again from nothing, which is how everything held in memory
   * is made to agree with a database that has just been replaced under it.
   */
  restartAsync?(): Promise<void>;
  /**
   * The click of a detent, for something that snaps under a finger.
   *
   * Synchronous and unawaited on purpose: a haptic that arrives after a round
   * trip is not felt as the thing it was meant to accompany.
   */
  tick?(): void;
  /**
   * The same with weight behind it, for a key going down.
   *
   * A detent's tick is meant not to be noticed, which is right for a list
   * snapping under a thumb and wrong for a game, where the touch is the only
   * thing that answers immediately.
   */
  thump?(): void;
  /**
   * The equalizer and the tone controls, as they are set, in one read.
   *
   * Answers even with nothing playing: the bands are the app's own and are
   * always there to be set, and `attached` only says whether the phone's
   * effects have a player to act on yet.
   */
  getEqualizerAsync?(): Promise<EqualizerState>;
  /**
   * Stores the settings and applies them.
   *
   * All of them at once rather than one field per call, because they are one
   * document on disk — a per-field write would have to read, change and write
   * it back for every step of a drag. The player holds whatever it is sent
   * inside its limits, and changes what is heard without a click.
   *
   * Answers with the state that resulted.
   */
  setEqualizerAsync?(settings: EqualizerSettings): Promise<EqualizerState>;
  /**
   * Lets the user choose a text file and answers what is in it and what it
   * is called, or null if they backed out. For importing a headphone
   * correction saved from AutoEQ. Absent on a build from before the app's
   * own equalizer; pasting the text needs nothing from the native side.
   */
  pickTextFileAsync?(): Promise<{ text: string; name: string | null } | null>;
  /** How one track gives way to the next. Answers even with nothing playing. */
  getTransitionsAsync?(): Promise<Transitions>;
  /**
   * Stores the transition settings and hands them to the running player.
   *
   * Stored first and independently of playback: a widget press after the app
   * has been killed brings the service up with no JavaScript anywhere, and it
   * reads these off the disk.
   */
  setTransitionsAsync?(settings: TransitionSettings): Promise<Transitions>;
  /** Whether tracks are evened out in loudness. Answers even with nothing playing. */
  getLoudnessAsync?(): Promise<Loudness>;
  /**
   * Stores the switch and tells the running player.
   *
   * Stored first, like the transitions: the service that plays the next song
   * may be one started from the widget with no JavaScript anywhere. Absent on
   * a build from before the feature, where the switch is not offered.
   */
  setLoudnessAsync?(settings: Loudness): Promise<Loudness>;
  /**
   * Copies a picture the app has drawn into the gallery, and answers where it
   * landed. Needs no permission: from Android 10 an entry an app inserts into
   * MediaStore belongs to that app.
   */
  /** Everything the effects processor is set to, as one record. */
  getAudioEffectsAsync?(): Promise<AudioEffects>;
  /**
   * Stores the settings and leaves the players to pick them up.
   *
   * Nothing is handed to a running player: the processors read the record on
   * the next buffer, which is also how both of them — the main one and the
   * crossfade's second — stay in step without being told separately.
   */
  setAudioEffectsAsync?(settings: AudioEffects): Promise<AudioEffects>;
  /**
   * Three stops, dark to light, sharing the hue a cover is mostly made of.
   * Null where there is no picture to read, so the caller keeps its own.
   */
  coverColoursAsync?(path: string): Promise<string[] | null>;
  /**
   * The same three stops, and `main`: the cover's leading colour as it was
   * found, before the stops were made from it.
   *
   * The stops are never colourless — a grey cover's are a dull red, a grey
   * having no hue and nought being red's — which suits a gradient and misleads
   * anyone asking what colour a cover is. `main` is the one to ask that of.
   *
   * Absent on a build from before it was written, where `coverColoursAsync`
   * is all there is.
   */
  coverReadingAsync?(path: string): Promise<{ stops: string[]; main?: string | null } | null>;
  /**
   * The phone's own palette, the one Android 12 and later make from the
   * wallpaper, for the theme that follows it.
   *
   * Four tonal ramps — `accent1`, `accent2`, `neutral1`, `neutral2` — each
   * thirteen `#rrggbb` colours from white to black, in the order the system
   * numbers them: 0, 10, 50, 100, 200 and on to 900, 1000. Null before
   * Android 12, which has no such palette.
   *
   * Answers at once rather than with a promise, so it can be read before the
   * first frame is drawn. Optional because a build from before the app had
   * themes has no such function.
   */
  systemPalette?(): Record<string, string[]> | null;
  /**
   * Says which language the app is in, as a BCP-47 tag: `en`, `tr`.
   *
   * Everything drawn in Kotlin follows it — the notifications, the widget, a
   * car's screens, the reasons a download or a write to a file failed — and it
   * is remembered there, for when they are drawn with no JavaScript running.
   * A language the native side has no words for is English. Optional because
   * a build from before the app could change language has no such function.
   */
  setAppLanguage?(tag: string): void;
  saveImageAsync?(path: string): Promise<string>;
  /** Saves the picture, then offers it to whatever the reader picks. */
  shareImageAsync?(path: string): Promise<void>;
}

/** What the end-of-chain effects processor is doing to the sound. */
export type AudioEffects = {
  /** Level trim before anything else, in decibels. */
  preampDb: number;
  /** Nought folds the image to mono, one leaves it, above one widens it. */
  width: number;
  /** Negative left, positive right. */
  balance: number;
  swap: boolean;
  /** How much of each channel reaches the far ear, delayed and dulled. */
  crossfeed: number;
  /** How far the image swings, and how long one turn takes. */
  rotate: number;
  rotateSeconds: number;
  /**
   * Which of four treatments the record is played through.
   *
   * A character rather than a set of numbers: what makes the vintage one is
   * the bit depth and the hold rate and the roll-off after it together, and
   * three separate settings would be three ways to arrive at none of them.
   */
  voice: 'off' | 'robot' | 'vintage' | 'swirl' | 'chipmunk' | 'squeak';
  /** How much of that treatment is heard against the record it was made from. */
  voiceMix: number;
};

export default requireNativeModule<JukeboxAudioModule>('JukeboxAudio');
