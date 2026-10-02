/** A track as the Android media store knows it. */
export type LibraryTrack = {
  /** Media store `_ID`. Stable for as long as the file stays put. */
  id: string;
  /** `content://` uri, playable directly. */
  uri: string;
  title: string;
  artist: string | null;
  album: string | null;
  /**
   * Always null. The media store's album-art provider was never public API and
   * stopped resolving around Android 10, so the field is kept only so callers
   * have somewhere to hang a cover from elsewhere; `getEmbeddedArtworkAsync` is
   * the one source that works.
   */
  artworkUri: string | null;
  durationSec: number;
  trackNumber: number | null;
  filename: string | null;
  /** Media store relative path, e.g. `Music/Nirvana/Nevermind/`. */
  folder: string | null;
  /**
   * When the file arrived on the device, in milliseconds, or null where the
   * media store will not say.
   *
   * The store's own `DATE_ADDED`, which is when *it* first saw the file rather
   * than when the file was made — a difference that shows itself when a
   * collection is copied over from an old phone and every record claims to have
   * turned up the same afternoon. It is still the honest answer to "what is new
   * here", because from this device's point of view that is exactly when they
   * arrived, and it is the only such answer anything records at all.
   */
  addedAt: number | null;
};

/** A folder holding music, and how much of it. */
export type FolderEntry = {
  /** Media store relative path with no trailing slash, e.g. `Music/Nirvana`. */
  path: string;
  /** Tracks directly in this folder; subfolders are counted as their own entry. */
  trackCount: number;
};

export type PermissionResponse = {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  expires: 'never' | number;
};

export type RepeatMode = 'off' | 'one' | 'all';

export type TrackChangeEvent = {
  /** Media store id of the track now playing, or null when the queue cleared. */
  trackId: string | null;
  index: number;
  /**
   * True when the previous track reached its end rather than being skipped.
   * Media3 reports this directly, so listening history does not have to guess
   * from playback position.
   */
  completedPrevious: boolean;
  /**
   * Whether the player intends to play this track. False when a queue was
   * loaded without being started, which otherwise looks identical to a track
   * beginning — and a listen that never happened would accrue time from the
   * moment it was queued.
   */
  playWhenReady: boolean;
};

/** A track that failed to start or stopped part way through. */
export type PlaybackErrorEvent = {
  /** The track the player was on, or null when it had already moved off it. */
  trackId: string | null;
  /** ExoPlayer's own wording — a missing file, a codec, a lost permission. */
  message: string;
};

export type PlayerStatus = {
  /** False until the media session has finished connecting. */
  connected: boolean;
  isPlaying?: boolean;
  /** Whether playback was asked for, which a seek does not change. */
  playWhenReady?: boolean;
  isBuffering?: boolean;
  trackId?: string | null;
  index?: number;
  positionSec?: number;
  durationSec?: number | null;
  shuffle?: boolean;
  repeat?: RepeatMode;
  /** Tempo multiplier. Pitch is preserved unless `pitch` is changed too. */
  speed?: number;
  pitch?: number;
};

/**
 * What the player needs to build a queue entry.
 *
 * The last four are optional only because the player does not need them to
 * play: send them and `getQueueAsync` can hand back a whole track, leave them
 * out and it comes back with those fields null.
 */
export type QueueItem = Pick<
  LibraryTrack,
  'id' | 'uri' | 'title' | 'artist' | 'album' | 'artworkUri'
> &
  Partial<Pick<LibraryTrack, 'durationSec' | 'trackNumber' | 'filename' | 'folder'>>;

/**
 * A queue entry read back out of the player.
 *
 * Nullable where `LibraryTrack` is not, because this is only ever as complete
 * as what was handed to `setQueueAsync` — the media store is not consulted.
 */
export type QueueEntry = {
  id: string;
  uri: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  artworkUri: string | null;
  durationSec: number | null;
  trackNumber: number | null;
  filename: string | null;
  folder: string | null;
};

export type JukeboxAudioEvents = {
  onTrackChange: (event: TrackChangeEvent) => void;
  onPlaybackStateChange: (event: { isPlaying: boolean; playWhenReady: boolean }) => void;
  onQueueEnded: () => void;
  onPlaybackError: (event: PlaybackErrorEvent) => void;
};


/**
 * The device's equalizer, and what has been asked of it.
 *
 * The shape of the thing and the settings for it arrive together on purpose:
 * how many bands there are, and what range each one moves in, is up to the
 * device, and sliders drawn from one set of numbers holding another set's
 * values would be wrong in a way nothing later could fix.
 *
 * Gains are in millibels — hundredths of a decibel, the audio framework's own
 * unit — so `600` is +6 dB.
 */
export type EqualizerState = {
  /** Whether the effects are bound to a live audio session right now. */
  attached: boolean;
  bandCount: number;
  minMb: number;
  maxMb: number;
  /** Centre frequency of each band, in hertz. */
  centresHz: number[];
  /** The device's own named curves, in the order `preset` indexes them. */
  presets: string[];
  enabled: boolean;
  /** An index into `presets`, or -1 when the bands below are what is in force. */
  preset: number;
  bands: number[];
  /** 0–1000, Android's own scale for both of these. */
  bass: number;
  virtualizer: number;
  /** Millibels of make-up gain, 0 for none. */
  loudness: number;
  bassSupported: boolean;
  virtualizerSupported: boolean;
  maxLoudnessMb: number;
};

/** The part of [EqualizerState] that is a choice rather than a fact. */
export type EqualizerSettings = Pick<
  EqualizerState,
  'enabled' | 'preset' | 'bands' | 'bass' | 'virtualizer' | 'loudness'
>;

/**
 * How one track gives way to the next.
 *
 * Four durations rather than the single slider every streaming app offers,
 * because the useful lengths are nothing alike: six seconds of overlap between
 * two songs is a mix, and six seconds between pressing next and hearing
 * anything is a fault.
 *
 * All in milliseconds, each capped at its own ceiling. Zero switches that one
 * kind of transition off without touching the others.
 */
export type Transitions = {
  enabled: boolean;
  /** A track ending and the next beginning. The one people mean by crossfade. */
  autoMs: number;
  /** Next or previous, pressed. */
  manualMs: number;
  /** Pause and resume. */
  pauseMs: number;
  /** After a seek, which otherwise lands mid-waveform and clicks. */
  seekMs: number;
  /** Whether consecutive tracks of one album are left to run together. */
  skipSameAlbum: boolean;
  /** Equal power holds the loudness across an overlap; linear sags. */
  equalPower: boolean;
  /*
    A ceiling apiece, sent from the native side rather than written into the
    screen, so the sliders and the thing enforcing their limits cannot drift
    apart. Read only.
  */
  maxAutoMs: number;
  maxManualMs: number;
  maxPauseMs: number;
  maxSeekMs: number;
  /**
   * What a fresh install has, for the reset button.
   *
   * Sent up rather than written into the screen, so there is only one place
   * these numbers are decided. Deliberately without `enabled`: resetting the
   * settings is not the same as switching the feature off, and the switch is
   * above the block the button belongs to.
   */
  defaults: Omit<TransitionSettings, 'enabled'>;
};

/** The part of [Transitions] that is a choice rather than a fact. */
export type TransitionSettings = Omit<
  Transitions,
  'maxAutoMs' | 'maxManualMs' | 'maxPauseMs' | 'maxSeekMs' | 'defaults'
>;
