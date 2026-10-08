import type { PlayerStatus, QueueEntry, RepeatMode } from '../../../modules/jukebox-audio/index.ts';
import type { Track } from '../types.ts';

/**
 * Getting the app's view of playback back after the JavaScript context is
 * thrown away.
 *
 * The foreground service outlives it — a development reload, or Android
 * reclaiming the JavaScript side while the service keeps the notification and
 * the audio alive. What comes back has an empty queue and nothing playing,
 * which is not merely incomplete: the next track change resolves its index
 * against that empty queue, finds nothing, and clears the interface outright
 * while the music is still going.
 */

/**
 * Whether the play/pause button should play or pause, from what the player says
 * rather than from the app's copy of what it was last seen doing.
 *
 * The same principle as the rest of this file, applied to one button: audio
 * focus lost to a phone call, or the notification's own button pressed while an
 * update was still crossing the bridge, both leave the two disagreeing, and the
 * side holding the audio is the side that is right. An unconnected session has
 * not said anything yet, and the sensible reading of a press then is "start".
 */
export function toggleCommand(status: PlayerStatus): 'play' | 'pause' {
  return status.isPlaying ? 'pause' : 'play';
}

export type Hydration = {
  queue: Track[];
  current: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  /** What was asked for, which survives a seek's moment of buffering. */
  playWhenReady: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  speed: number;
  pitch: number;
};

/** What came back from asking the player what it is doing. */
export type PlayerReading =
  /** The session never answered. Nothing it may be holding can be seen at all. */
  | { seen: false }
  /** It answered. `state` is null when the player is genuinely holding nothing. */
  | { seen: true; state: Hydration | null };

/**
 * Whether two readings of the player, taken either side of reading its queue,
 * describe the same moment.
 *
 * The status and the queue are separate hops onto the main thread with a round
 * trip through JavaScript between them, and the service can move on in that gap
 * — leaving an index paired with a queue it was not read alongside, which names
 * the wrong track as current and then bills that track for the listening.
 *
 * A queue edited without the index moving is not caught here and does not need
 * to be: both versions answer the same at that position, which is all the
 * pairing is for.
 */
export function sameMoment(before: PlayerStatus, after: PlayerStatus): boolean {
  return (
    before.connected === after.connected &&
    (before.index ?? -1) === (after.index ?? -1) &&
    (before.trackId ?? null) === (after.trackId ?? null)
  );
}

/** Where a reported change of track falls in the app's own copy of the queue. */
export type Landing = {
  index: number;
  track: Track | null;
  /**
   * False when the copy cannot be what the player is holding, and so has
   * nothing to say about what started. The answer then is to read the player
   * again, not to show whatever happens to sit at that position.
   */
  trusted: boolean;
};

/**
 * Which of the app's rows a track change is about.
 *
 * The player reports a position and an id, and the position is looked up in a
 * copy of the queue kept on this side. That copy is right for as long as this
 * app is the only thing setting queues, and it is not: a car sets them, and so
 * does a press of play on the widget after the app was put away. The position
 * is then a position in a list this side has never seen, and believing it
 * names the wrong track everywhere — on screen, in the history, and as the row
 * every queue edit is measured from.
 *
 * So the position is believed only where the id agrees with it. It still
 * outranks the id where both fit, because a track queued twice cannot be told
 * apart by id alone. A player old enough not to send a position is answered by
 * id, as it always was.
 */
export function landingOf(queue: Track[], index: number, trackId: string | null): Landing {
  // Nothing is playing: the queue was emptied. Not a disagreement.
  if (trackId === null) return { index: -1, track: null, trusted: true };

  const at = index >= 0 ? queue[index] : undefined;
  if (at && at.id === trackId) return { index, track: at, trusted: true };

  if (index < 0) {
    const found = queue.findIndex((candidate) => candidate.id === trackId);
    if (found >= 0) return { index: found, track: queue[found]!, trusted: true };
  }
  return { index: -1, track: null, trusted: false };
}

/** What to do with the app's copy of the queue, given what the player holds. */
export type Reconciliation =
  /** They agree, or the player has nothing to say. */
  | { kind: 'keep' }
  /** The same queue, with a different row playing than the app thought. */
  | { kind: 'move'; index: number }
  /** A different queue. The player's replaces the copy. */
  | { kind: 'adopt' };

/**
 * Compares the app's copy of the queue with the player's own.
 *
 * Adopting is the last resort and not the default, because it costs something:
 * a queue read back out of the player is only what was handed to it, and the
 * rows it makes are poorer than the library tracks the app is holding. Where
 * the two lists are the same tracks in the same order the copy is kept, and at
 * most the playing row is corrected.
 *
 * An empty player is left alone as well. It is what a stopped service answers
 * with, and clearing a queue off the screen because the thing that plays it
 * has gone away for the moment would be taking it from the one place it is
 * still held.
 */
export function reconcile(
  queue: Track[],
  currentIndex: number,
  theirs: Hydration | null
): Reconciliation {
  if (!theirs) return { kind: 'keep' };

  const same =
    queue.length === theirs.queue.length &&
    queue.every((track, position) => track.id === theirs.queue[position]!.id);
  if (!same) return { kind: 'adopt' };

  // A player that cannot say which row it is on has nothing to correct with.
  return theirs.currentIndex < 0 || theirs.currentIndex === currentIndex
    ? { kind: 'keep' }
    : { kind: 'move', index: theirs.currentIndex };
}

/** The two reads of the player this needs, so it can be exercised without one. */
export type PlayerReads = {
  status: () => Promise<PlayerStatus>;
  queue: () => Promise<QueueEntry[]>;
};

export type ReadOptions = {
  /** How long to keep asking for the session to answer at all. */
  timeoutMs: number;
  /** How long to wait before asking again, given how long the asking has gone on. */
  pollMs: (waitedMs: number) => number;
  /** True once the answer has stopped mattering — an unmount, or the user starting something. */
  abandoned?: () => boolean;
  /** Reads of status and queue to pair up before settling for the closest available. */
  snapshotAttempts?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Everything the player is doing, or the fact that it will not say.
 *
 * Silence is not an empty player, and the caller is given the difference rather
 * than a single ambiguous answer. Collapsing the two is what let a session that
 * connected a fraction late be met with an app that had already thrown away its
 * only record of the queue still audible through it and written its own stored
 * shuffle and repeat over the modes that queue was playing under.
 */
export async function readPlayerState(
  reads: PlayerReads,
  {
    timeoutMs,
    pollMs,
    abandoned = () => false,
    snapshotAttempts = 3,
    now = Date.now,
    sleep = (ms) => new Promise((resume) => setTimeout(resume, ms)),
  }: ReadOptions
): Promise<PlayerReading> {
  const startedAt = now();
  let status = await reads.status();

  while (!status.connected) {
    const waited = now() - startedAt;
    if (abandoned() || waited >= timeoutMs) return { seen: false };
    await sleep(pollMs(waited));
    if (abandoned()) return { seen: false };
    status = await reads.status();
  }

  for (let attempt = 1; ; attempt += 1) {
    const entries = await reads.queue();
    const after = await reads.status();
    // Losing the session mid-read leaves nothing worth reporting: the empty
    // queue that comes back alongside is the absence of an answer, not one.
    if (!after.connected) return { seen: false };
    if (sameMoment(status, after) || attempt >= snapshotAttempts) {
      // The later reading is the one taken closest to the queue.
      return { seen: true, state: hydrationFrom(after, entries) };
    }
    status = after;
  }
}

/**
 * A queue entry is only ever as complete as what was handed to the player, so
 * every field is nullable coming back. In practice `uri` never is — the player
 * cannot hold an item without one — and dropping an entry would shift every
 * index after it out of step with the player, so a missing one is filled rather
 * than skipped.
 */
function toTrack(entry: QueueEntry): Track {
  return {
    id: entry.id,
    uri: entry.uri ?? '',
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    artworkUri: entry.artworkUri,
    durationSec: entry.durationSec ?? 0,
    trackNumber: entry.trackNumber,
    filename: entry.filename,
    folder: entry.folder,
    // Never handed to the player, because nothing about playing a track depends
    // on when its file turned up. A recovered queue is a queue, not a library
    // listing, and null here says so rather than inventing a date for it.
    addedAt: null,
  };
}

/**
 * What the player says it is doing, as the app's own state — or null when there
 * is nothing to recover, which is the ordinary case of a cold start.
 *
 * The player is believed over the stored preferences for shuffle and repeat: if
 * a queue survived, so did the modes it is being played under, and showing the
 * settings the app last wrote down instead would describe a different playback
 * than the one the user can hear.
 */
export function hydrationFrom(status: PlayerStatus, entries: QueueEntry[]): Hydration | null {
  if (!status.connected || entries.length === 0) return null;

  const queue = entries.map(toTrack);
  // The index is authoritative where it is usable: with a track queued twice,
  // its id alone cannot say which of the entries is the one playing.
  const byIndex = status.index ?? -1;
  const index =
    byIndex >= 0 && byIndex < queue.length
      ? byIndex
      : queue.findIndex((track) => track.id === status.trackId);
  const current = queue[index] ?? null;

  return {
    queue,
    current,
    currentIndex: current ? index : -1,
    isPlaying: status.isPlaying ?? false,
    // Falls back to isPlaying for a player that predates the field.
    playWhenReady: status.playWhenReady ?? status.isPlaying ?? false,
    shuffle: status.shuffle ?? false,
    repeat: status.repeat ?? 'off',
    speed: status.speed ?? 1,
    pitch: status.pitch ?? 1,
  };
}
