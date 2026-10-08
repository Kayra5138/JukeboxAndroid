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
  /**
   * How big the file is, in bytes, or null where the media store will not say.
   *
   * Optional because a build of the native module from before it was read does
   * not send it. Nothing shown is made from it: it is half of how a file is
   * recognised again once the store has given it a new id, the other half
   * being how long it runs.
   */
  size?: number | null;
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
  /**
   * ExoPlayer's name for what went wrong, which does not change with the
   * language: `ERROR_CODE_IO_FILE_NOT_FOUND`. Missing from an older build.
   */
  code?: string;
  /**
   * The same thing as a sentence fit to show, in the app's language: "This
   * file could not be found." Less exact than `message`, and readable.
   */
  text?: string;
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
  /**
   * The player was given a queue by something other than this app's own calls:
   * a car choosing a record, or a press of play on the widget putting the saved
   * queue back. Carries nothing, because there is nothing short to say — the
   * queue has to be read again, with `getQueueAsync` and `getStatusAsync`.
   *
   * Arrives ahead of the `onTrackChange` the same replacement causes. Never
   * sent by a native module that predates it, so it cannot be the only thing
   * relied on to notice.
   */
  onQueueReplaced: () => void;
};


/** The three shapes a band of the equalizer can be. */
export type EqualizerBandType = 'peak' | 'lowShelf' | 'highShelf';

/**
 * One band: a filter that turns the sound around `frequencyHz` up or down by
 * `gainDb`. A peak does it around that frequency and `q` is how narrowly; a
 * shelf does it to everything below, or above, and `q` is how sharp the
 * corner is.
 */
export type EqualizerBand = {
  type: EqualizerBandType;
  /** 20 to 20,000. */
  frequencyHz: number;
  /** Decibels, 20 either way. */
  gainDb: number;
  /** 0.1 to 10. */
  q: number;
};

/** A curve kept under a name. */
export type EqualizerPreset = {
  name: string;
  /** The level trim that goes with it, or null for the one worked out from the bands. */
  preampDb: number | null;
  bands: EqualizerBand[];
};

/**
 * The app's own equalizer, as it is set.
 *
 * The same on every phone, which the phone's equalizer never was: up to
 * twelve bands, each wherever it is put. The filtering is done in the
 * player's own audio chain.
 */
export type ParametricEqualizer = {
  bands: EqualizerBand[];
  /**
   * Level trim in decibels, or null for automatic: down by as much as the
   * bands' highest point goes up, so a boost has room and does not clip.
   */
  preampDb: number | null;
  /** The curves the user has kept. The starting points the screen offers are not among them. */
  presets: EqualizerPreset[];
  /**
   * Something to say once, about the phone's equalizer this took over from:
   * `carried` if what was set on it was brought across (and kept as a preset),
   * `lost` if it could not be. Read only, and gone after the next change.
   */
  notice?: 'carried' | 'lost' | null;
};

/**
 * The equalizer and the tone controls beside it, and what has been asked of
 * them.
 */
export type EqualizerState = {
  /** Whether the phone's effects are bound to a live audio session right now. */
  attached: boolean;
  /** The one switch, for the bands and the three controls below alike. */
  enabled: boolean;
  /**
   * The bands. Absent on a build of the native module from before the app had
   * an equalizer of its own, which is how the screen knows to say so.
   */
  parametric?: ParametricEqualizer;
  /** 0–1000, Android's own scale for both of these. */
  bass: number;
  virtualizer: number;
  /** Millibels — hundredths of a decibel — of make-up gain, 0 for none. */
  loudness: number;
  bassSupported: boolean;
  virtualizerSupported: boolean;
  maxLoudnessMb: number;
  /*
    What a native build from before sends instead of `parametric`: the phone's
    own equalizer, an index into its presets and a level per band in
    millibels. Nothing draws them now. They are only ever handed back as they
    came, so that moving the bass slider on such a build does not flatten
    bands the screen can no longer show.
  */
  preset?: number;
  bands?: number[];
  bandCount?: number;
};

/** The part of [EqualizerState] that is a choice rather than a fact. */
export type EqualizerSettings = Pick<
  EqualizerState,
  'enabled' | 'bass' | 'virtualizer' | 'loudness' | 'preset' | 'bands'
> & {
  /** Left out, the bands are left as they are. */
  parametric?: Omit<ParametricEqualizer, 'notice'>;
};

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

/**
 * Whether tracks are brought to one loudness as they play.
 *
 * One switch and nothing else. What each track is turned by is found by the
 * playback service from the files themselves — their ReplayGain tags, or a
 * measurement made on the phone and kept — and never passes through here.
 */
export type Loudness = {
  enabled: boolean;
};
