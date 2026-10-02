import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import JukeboxAudio, { type RepeatMode } from '../../../modules/jukebox-audio/index.ts';
import { readPlayerState, toggleCommand, type Hydration, type PlayerReading } from './hydrate.ts';
import {
  indexAfterInsert,
  indexAfterMove,
  indexAfterRemove,
  insertPlan,
  playNextPosition,
} from './queue.ts';
import {
  beginSession,
  finishSession,
  setSessionPlaying,
  type Session,
} from './session.ts';
import { artistKey, spreadShuffle } from '../media/shuffle.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { recordPlay, recordSkip } from '../db/history.ts';
import type { Track } from '../types.ts';

/** A track the player refused to start, or stopped part way through. */
export type PlaybackFailure = { trackId: string | null; message: string };

type PlayerActions = {
  /** Replace the queue with `tracks` and start playing at `startIndex`. */
  playQueue: (tracks: Track[], startIndex: number) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  /** By position, because the same track can appear in the queue twice. */
  skipToIndex: (index: number) => Promise<void>;
  /** Queue a track to follow the current one. */
  playNext: (track: Track) => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  moveInQueue: (from: number, to: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  /** Rearranges the queue, keeping what is playing where it is. */
  shuffleQueue: () => Promise<void>;
  cycleRepeat: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setPitch: (pitch: number) => Promise<void>;
};

type PlayerState = {
  current: Track | null;
  queue: Track[];
  /**
   * Position of the playing track in the queue. Carried alongside `current`
   * because the same track can appear twice, in which case its id no longer
   * says which of the entries is the one being played.
   */
  currentIndex: number;
  isPlaying: boolean;
  /**
   * Whether playback was asked for, as opposed to whether sound is coming out.
   *
   * A seek drops `isPlaying` for the moment it spends buffering, which is right
   * for counting listening time and wrong for a play button — it blinks to
   * "play" and back for something the listener never asked for.
   */
  playWhenReady: boolean;
  /**
   * True once the queue has been shuffled, until a different one replaces it.
   *
   * Not the player's shuffle mode. Shuffling rewrites the order of the queue
   * itself, so this says what happened to the list rather than which way it
   * will be read.
   */
  shuffled: boolean;
  repeat: RepeatMode;
  speed: number;
  pitch: number;
  /**
   * Why nothing is playing, when that is the reason. Cleared as soon as
   * anything plays again, so it describes the present rather than accumulating.
   */
  error: PlaybackFailure | null;
};

const REPEAT_CYCLE: RepeatMode[] = ['off', 'all', 'one'];

const CONNECT_POLL_MS = 200;
/**
 * How long to ask at that rate. Long enough that an ordinary connection is
 * always inside it, short enough that a tap is not left hanging on a session
 * that is never going to answer.
 */
const CONNECT_TIMEOUT_MS = 5_000;
/**
 * A session that has not answered by then is not necessarily gone — the
 * foreground service may well still be playing — so the asking continues at a
 * rate that costs nothing rather than concluding the player is empty.
 */
const RECONNECT_POLL_MS = 2_000;
/**
 * When to stop asking altogether on startup. The controller is built once and
 * never rebuilt, so past this there is genuinely nothing left to wait for. The
 * app stops asking; it still does not claim to know what the player holds.
 */
const CONNECT_GIVE_UP_MS = 60_000;
/**
 * How many times to read the status and the queue before settling for the
 * closest pair available. Disagreement means the service moved mid-read, which
 * a retry normally steps past; a player skipping faster than this can be read
 * is not a state worth chasing further.
 */
const SNAPSHOT_ATTEMPTS = 3;

/**
 * The shortest gap between two tellings of speed and pitch, in milliseconds.
 *
 * This was once a third of a second, to keep a finger crossing a slider from
 * wedging the player outright. That fault is fixed where it belongs — the
 * parameters no longer rebuild the audio pipeline at all — so the wait is back
 * to being about taste rather than safety: often enough that the slider feels
 * connected to what is coming out of the speaker, rarely enough that a gesture
 * is not a hundred calls across to the player.
 */
const PARAMS_GAP_MS = 120;

/**
 * Everything the player is willing to be told about a track.
 *
 * The last four are not needed to play it. They are sent so that reading the
 * queue back — which is the only way home after the JavaScript side is
 * reloaded — returns whole tracks rather than the handful of fields playback
 * happens to require.
 */
const toQueueItem = ({
  id,
  uri,
  title,
  artist,
  album,
  artworkUri,
  durationSec,
  trackNumber,
  filename,
  folder,
}: Track) => ({
  id,
  uri,
  title,
  artist,
  album,
  artworkUri,
  durationSec,
  trackNumber,
  filename,
  folder,
});

const ActionsContext = createContext<PlayerActions | null>(null);
const StateContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<Track[]>([]);
  const sessionRef = useRef<Session | null>(null);
  /**
   * `currentIndex` and `isPlaying` are mirrored into refs because both are read
   * from inside player event handlers and from action callbacks, where the
   * state value would be whichever one was captured when they were created.
   */
  const currentIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);

  const [current, setCurrent] = useState<Track | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playWhenReady, setPlayWhenReady] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [pitch, setPitchState] = useState(1);
  const [shuffled, setShuffled] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [error, setError] = useState<PlaybackFailure | null>(null);

  /**
   * Recording a listen must never take playback state down with it.
   *
   * This runs inside the track-change listener, ahead of the updates that keep
   * the interface following the player. A throw here — a constraint violation
   * was the real one — escaped the handler and left those updates unreached, so
   * the audio carried on while the app stopped noticing it, permanently.
   */
  /**
   * @param skipped Whether this listen ended because the listener moved on
   * from it. Only the track-change path can say so: the other reasons a listen
   * ends unfinished — the app closing, a file that would not open, the queue
   * being replaced — are not opinions about the track, and counting them as
   * such would make the skipped list a list of whatever was playing when
   * something else happened.
   */
  const flushSession = useCallback((completed: boolean, skipped = false) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    const play = finishSession(session, completed, Date.now());
    try {
      recordPlay(play);
    } catch (failure) {
      console.warn('Could not record a play', failure);
    }
    // Separately, so that failing to write one does not lose the other.
    if (skipped) {
      try {
        recordSkip(play);
      } catch (failure) {
        console.warn('Could not record a skip', failure);
      }
    }
  }, []);

  const startSession = useCallback((track: Track, playing: boolean) => {
    sessionRef.current = beginSession(track, playing, Date.now());
  }, []);

  const markPlaying = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const placeCurrent = useCallback((index: number, track: Track | null) => {
    currentIndexRef.current = track ? index : -1;
    setCurrentIndex(currentIndexRef.current);
    setCurrent(track);
  }, []);

  /** Follow the playing row through an edit made somewhere else in the queue. */
  const shiftCurrent = useCallback((to: (position: number) => number) => {
    if (currentIndexRef.current < 0) return;
    currentIndexRef.current = to(currentIndexRef.current);
    setCurrentIndex(currentIndexRef.current);
  }, []);

  const readPlayer = useCallback(
    (timeoutMs: number, abandoned?: () => boolean): Promise<PlayerReading> =>
      readPlayerState(
        {
          status: () => JukeboxAudio.getStatusAsync(),
          queue: () => JukeboxAudio.getQueueAsync(),
        },
        {
          timeoutMs,
          pollMs: (waited) => (waited < CONNECT_TIMEOUT_MS ? CONNECT_POLL_MS : RECONNECT_POLL_MS),
          abandoned,
          snapshotAttempts: SNAPSHOT_ATTEMPTS,
        }
      ),
    []
  );

  /**
   * Take the player's own state as the app's.
   *
   * The listen that was already in progress is unrecoverable — how much of it
   * had been heard died with the old JavaScript context — so it is counted from
   * here rather than guessed at.
   */
  const adopt = useCallback(
    (state: Hydration) => {
      flushSession(false);
      queueRef.current = state.queue;
      setQueue(state.queue);
      placeCurrent(state.currentIndex, state.current);
      markPlaying(state.isPlaying);
      setPlayWhenReady(state.playWhenReady);
      setRepeat(state.repeat);
      setSpeedState(state.speed);
      setPitchState(state.pitch);
      // The pair the next change will be built on has to be what the player is
      // actually holding, or the first nudge of one would send the other back
      // to where this provider happened to start. Recorded as told as well as
      // wanted: these values came from the player, so it already has them, and
      // leaving the record at a default would let a change back to that default
      // be dismissed as a repeat of something never actually said.
      params.current = { speed: state.speed, pitch: state.pitch };
      told.current = { speed: state.speed, pitch: state.pitch };
      if (state.current) startSession(state.current, state.isPlaying);
    },
    [flushSession, markPlaying, placeCurrent, startSession]
  );

  /**
   * Adopt whatever the player is already doing, or fall back to the stored
   * preferences when it is doing nothing.
   *
   * Also where the settings are read from, rather than from a state initialiser
   * during the first render: that made opening SQLite and running its
   * migrations the first thing between mounting and the first frame. Shuffle
   * and repeat are only ever shown by the player sheet, which needs a current
   * track to open at all, so they are settled well before anything displays
   * them.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Waiting for the session takes long enough for the user to have started
      // something themselves, and what they just chose outranks what survived.
      const abandoned = () => cancelled || queueRef.current.length > 0;
      const reading = await readPlayer(CONNECT_GIVE_UP_MS, abandoned);
      if (abandoned()) return;
      // A session that never answered has not reported an empty player; it has
      // reported nothing. The stored modes stay unwritten rather than being
      // forced onto playback nobody here can see.
      if (!reading.seen) return;

      if (reading.state) {
        adopt(reading.state);
        return;
      }

      const savedRepeat = (readSetting(SETTINGS.repeat) as RepeatMode | null) ?? 'off';
      setRepeat(savedRepeat);
      // The player's own shuffle is held off for good: the queue is shuffled by
      // rearranging it, and the two together would be a random walk over an
      // order that is already random.
      void JukeboxAudio.setShuffleAsync(false);
      void JukeboxAudio.setRepeatModeAsync(savedRepeat);
    })();

    return () => {
      cancelled = true;
    };
  }, [adopt, readPlayer]);

  useEffect(() => {
    const trackChange = JukeboxAudio.addListener('onTrackChange', (event) => {
      // Media3 tells us whether the outgoing track ended or was skipped, so the
      // history entry is exact rather than inferred.
      flushSession(event.completedPrevious, !event.completedPrevious);
      // The index is authoritative: with a repeated track the id alone cannot
      // say which entry started.
      const index =
        event.index >= 0
          ? event.index
          : queueRef.current.findIndex((candidate) => candidate.id === event.trackId);
      const track = queueRef.current[index] ?? null;
      placeCurrent(index, track);
      setError(null);
      // Media3 reports a track change when the queue is *set*, not only when one
      // begins, so a queue built by "add to queue" from nothing lands here with
      // the player paused. Opening the session as playing regardless billed wall
      // clock — as much of it as the app was left open for — to a track that
      // never produced a sample. `playWhenReady` is the player's own intent and
      // settles it; an older native module does not send it, and there the
      // mirrored playing state answers instead.
      if (track) startSession(track, isPlayingRef.current && event.playWhenReady !== false);
    });

    const stateChange = JukeboxAudio.addListener('onPlaybackStateChange', (event) => {
      const playing = event.isPlaying;
      setPlayWhenReady(event.playWhenReady);
      markPlaying(playing);
      if (playing) setError(null);
      const session = sessionRef.current;
      if (session) sessionRef.current = setSessionPlaying(session, playing, Date.now());
    });

    const queueEnded = JukeboxAudio.addListener('onQueueEnded', () => {
      flushSession(true);
      markPlaying(false);
    });

    /**
     * A file that has been deleted, a permission that has been revoked, a codec
     * the device does not have. The player is already stopped by the time this
     * arrives, and it is deliberately left that way: skipping on would race
     * through a whole folder of unreadable files in silence, whereas stopping
     * on the one that failed is the only way the reader learns which it was.
     */
    const failed = JukeboxAudio.addListener('onPlaybackError', (event) => {
      flushSession(false);
      markPlaying(false);
      setError({ trackId: event.trackId, message: event.message });
    });

    return () => {
      trackChange.remove();
      stateChange.remove();
      queueEnded.remove();
      failed.remove();
    };
  }, [flushSession, markPlaying, placeCurrent, startSession]);

  // A play in progress when the app closes is lost, which is preferable to
  // recording one that never happened.
  useEffect(() => () => flushSession(false), [flushSession]);

  const replaceQueue = useCallback(
    async (tracks: Track[], startIndex: number, autoPlay: boolean) => {
      flushSession(false);
      queueRef.current = tracks;
      setQueue(tracks);
      const track = tracks[startIndex] ?? null;
      placeCurrent(startIndex, track);
      // A new queue arrives in whatever order it was built in.
      setShuffled(false);
      setError(null);
      if (track) startSession(track, autoPlay);
      await JukeboxAudio.setQueueAsync(tracks.map(toQueueItem), startIndex, autoPlay);
    },
    [flushSession, placeCurrent, startSession]
  );

  const playQueue = useCallback(
    (tracks: Track[], startIndex: number) => replaceQueue(tracks, startIndex, true),
    [replaceQueue]
  );

  const toggle = useCallback(async () => {
    const status = await JukeboxAudio.getStatusAsync();
    if (toggleCommand(status) === 'pause') await JukeboxAudio.pauseAsync();
    else await JukeboxAudio.playAsync();
  }, []);

  const next = useCallback(() => JukeboxAudio.nextAsync(), []);
  const previous = useCallback(() => JukeboxAudio.previousAsync(), []);
  const seekTo = useCallback((seconds: number) => JukeboxAudio.seekToAsync(seconds), []);

  const skipToIndex = useCallback(async (index: number) => {
    if (index >= 0 && index < queueRef.current.length) {
      await JukeboxAudio.skipToIndexAsync(index);
    }
  }, []);

  /**
   * The player owns the queue, so these change it in place rather than
   * rebuilding it — playback keeps its position, and the notification's
   * next/previous stay in step with what the app shows. The copy held here is
   * updated to match so the interface does not have to wait for a round trip.
   *
   * The exception is an empty queue, which has to be set rather than added to:
   * see `insertPlan`. Nothing starts playing in that case, because reaching for
   * "play next" or "add to queue" is choosing not to press play.
   *
   * An empty copy is not proof of an empty player, though — it is also what the
   * app holds while the session is still connecting, and what it would hold for
   * good if the session never did. Replacing on that reading stops a queue that
   * is audibly playing, so the player is asked first.
   */
  const insertOne = useCallback(
    async (track: Track, where: 'next' | 'end') => {
      if (queueRef.current.length === 0) {
        const reading = await readPlayer(CONNECT_TIMEOUT_MS);
        if (reading.seen && reading.state) adopt(reading.state);
        // A session that never answers falls through to being replaced anyway.
        // There is no visible queue to lose in that case, and replacing is the
        // only path that hands the player a queue it is also told to prepare.
      }

      const plan = insertPlan(
        queueRef.current.length,
        where === 'next' ? playNextPosition(currentIndexRef.current) : -1
      );
      if (plan.replace) {
        await replaceQueue([track], 0, false);
        return;
      }
      const next = [...queueRef.current];
      next.splice(plan.index, 0, track);
      queueRef.current = next;
      setQueue(next);
      shiftCurrent((position) => indexAfterInsert(position, plan.index));
      await JukeboxAudio.insertIntoQueueAsync(toQueueItem(track), plan.index);
    },
    [adopt, readPlayer, replaceQueue, shiftCurrent]
  );

  /**
   * Insertions are run one after another. Checking an empty queue against the
   * player means waiting on a round trip before deciding what to do with it, and
   * two taps that both looked at an empty queue would each decide to replace it
   * — the second discarding the first.
   */
  const inserting = useRef<Promise<unknown>>(Promise.resolve());
  const insert = useCallback(
    (track: Track, where: 'next' | 'end') => {
      const done = inserting.current.then(
        () => insertOne(track, where),
        () => insertOne(track, where)
      );
      inserting.current = done.catch(() => undefined);
      return done;
    },
    [insertOne]
  );

  const playNext = useCallback((track: Track) => insert(track, 'next'), [insert]);
  const addToQueue = useCallback((track: Track) => insert(track, 'end'), [insert]);

  const moveInQueue = useCallback(
    async (from: number, to: number) => {
      const next = [...queueRef.current];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      queueRef.current = next;
      setQueue(next);
      shiftCurrent((position) => indexAfterMove(position, from, to));
      await JukeboxAudio.moveInQueueAsync(from, to);
    },
    [shiftCurrent]
  );

  const removeFromQueue = useCallback(
    async (index: number) => {
      const queueNow = queueRef.current;
      if (index < 0 || index >= queueNow.length) return;
      const playingRow = index === currentIndexRef.current;
      const next = queueNow.filter((_track, position) => position !== index);
      queueRef.current = next;
      setQueue(next);
      // The listen ends with the row. Left to the player, taking away the last
      // remaining row reaches the end of the queue rather than a track change,
      // and the removed track would be written down as one that played through.
      if (playingRow) flushSession(false);
      // Removing the playing row makes the player move on and say so, but the
      // title on screen must not go on naming a row that is no longer there
      // while that is in flight.
      if (currentIndexRef.current >= 0) {
        const moved = indexAfterRemove(currentIndexRef.current, index);
        placeCurrent(moved, next[moved] ?? null);
      }
      await JukeboxAudio.removeFromQueueAsync(index);
    },
    [flushSession, placeCurrent]
  );

  /*
    Speed and pitch are one pair to ExoPlayer, and are kept here as one pair.

    Held in a ref as well as in state because the two are set through separate
    callbacks: reading the other one out of a closure meant that changing pitch
    and then speed within a render sent the pitch the player already had, and
    quietly undid the change that had just been made.
  */
  const params = useRef({ speed: 1, pitch: 1 });
  const sending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentAt = useRef(0);

  /*
    What the player was last actually told, which is not what was last asked
    for. A pair it already has is not worth the cost of being given again, and
    the commonest duplicate is the worst-timed one: letting go of a slider
    reports the same value twice in a row, once as the last of the drag and
    once as the settling, so the sink is asked to rebuild while it is still
    draining the rebuild before it.
  */
  const told = useRef({ speed: 1, pitch: 1 });

  const tellPlayer = useCallback(() => {
    sending.current = null;
    const { speed, pitch } = params.current;
    if (speed === told.current.speed && pitch === told.current.pitch) return;

    told.current = { speed, pitch };
    sentAt.current = Date.now();
    void JukeboxAudio.setPlaybackParamsAsync(speed, pitch);
  }, []);

  /**
   * Asks for a pair, at a rate the audio pipeline can live with.
   *
   * Setting playback parameters is not a cheap assignment: the sink drains and
   * reconfigures around the new rate, with Sonic being switched into the chain
   * the moment either value leaves one. A finger crossing a slider asks for
   * thirty of those in a third of a second, and the player was seen to fall
   * over with `Unexpected runtime error` part way through — and stay fallen,
   * because the service outlives the app that a listener would restart.
   *
   * So the readout follows the finger and the player hears from us a dozen
   * times a second. The last value always arrives: a change while a send is
   * already queued rewrites what that send will carry rather than being
   * dropped.
   */
  const askPlayerFor = useCallback(
    (next: { speed: number; pitch: number }) => {
      params.current = next;
      if (sending.current) return;
      const since = Date.now() - sentAt.current;
      if (since >= PARAMS_GAP_MS) tellPlayer();
      else sending.current = setTimeout(tellPlayer, PARAMS_GAP_MS - since);
    },
    [tellPlayer]
  );

  // Nothing is worth sending to a player this provider is no longer talking to.
  useEffect(() => () => {
    if (sending.current) clearTimeout(sending.current);
  }, []);

  const setSpeed = useCallback(
    async (value: number) => {
      setSpeedState(value);
      askPlayerFor({ speed: value, pitch: params.current.pitch });
    },
    [askPlayerFor]
  );

  const setPitch = useCallback(
    async (value: number) => {
      setPitchState(value);
      askPlayerFor({ speed: params.current.speed, pitch: value });
    },
    [askPlayerFor]
  );

  /**
   * Rearranges the queue, and does it again on every press.
   *
   * The order is worked out here and the rearranging done in the player. Here,
   * because what a shuffle should feel like is a judgement — an artist ought
   * not to come round twice in a row — and only this side knows who made a
   * track; there, because removing and re-adding items around the one playing
   * is what leaves playback running.
   *
   * The player still answers with the order it ended up holding rather than
   * this assuming it got what it asked for. A queue can change underneath a
   * shuffle, and two sources of truth for what is playing is the bug this
   * already cost once.
   */
  const shuffleQueue = useCallback(async () => {
    const playing = queueRef.current[currentIndexRef.current];
    const order = spreadShuffle(
      queueRef.current.filter((track) => track !== playing),
      artistKey,
      playing ? artistKey(playing) : undefined
    );
    const { items: entries, index } = await JukeboxAudio.shuffleQueueAsync(
      order.map((track) => track.id)
    );
    const byId = new Map(queueRef.current.map((track) => [track.id, track]));
    /*
      Matched back to the library tracks so the rows keep everything the queue
      entries do not carry — tags and covers among them. Anything unmatched is
      dropped rather than guessed at; it cannot happen while the player holds
      what was given to it, and a placeholder row would be worse than a short
      list.
    */
    const reordered = entries
      .map((entry) => byId.get(entry.id))
      .filter((track): track is Track => track !== undefined);
    if (reordered.length === 0) return;

    queueRef.current = reordered;
    setQueue(reordered);
    /*
      Where the player says the track ended up, not where a shuffle usually
      puts it. It is normally the front, but a queue too short to shuffle comes
      back untouched — and assuming otherwise pointed the whole app at the wrong
      row: the wrong title everywhere, `play next` inserting ahead of what was
      playing, and removing the top row ending a listening session early.
    */
    const landed = index >= 0 && index < reordered.length ? index : 0;
    placeCurrent(landed, reordered[landed] ?? null);
    // Only a queue that actually moved is a shuffled one.
    setShuffled(reordered.length >= 3);
  }, [placeCurrent]);

  const cycleRepeat = useCallback(async () => {
    const mode = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(repeat) + 1) % REPEAT_CYCLE.length]!;
    setRepeat(mode);
    writeSetting(SETTINGS.repeat, mode);
    await JukeboxAudio.setRepeatModeAsync(mode);
  }, [repeat]);

  const actions = useMemo<PlayerActions>(
    () => ({
      playQueue,
      toggle,
      next,
      previous,
      seekTo,
      skipToIndex,
      playNext,
      addToQueue,
      moveInQueue,
      removeFromQueue,
      shuffleQueue,
      cycleRepeat,
      setSpeed,
      setPitch,
    }),
    [
      playQueue,
      toggle,
      next,
      previous,
      seekTo,
      skipToIndex,
      playNext,
      addToQueue,
      moveInQueue,
      removeFromQueue,
      shuffleQueue,
      cycleRepeat,
      setSpeed,
      setPitch,
    ]
  );

  const state = useMemo<PlayerState>(
    () => ({
      current,
      currentIndex,
      queue,
      isPlaying,
      playWhenReady,
      shuffled,
      repeat,
      speed,
      pitch,
      error,
    }),
    [current, currentIndex, queue, isPlaying, playWhenReady, shuffled, repeat, speed, pitch, error]
  );

  return (
    <ActionsContext value={actions}>
      <StateContext value={state}>{children}</StateContext>
    </ActionsContext>
  );
}

export function usePlayerActions(): PlayerActions {
  const value = use(ActionsContext);
  if (!value) throw new Error('usePlayerActions must be used inside <PlayerProvider>');
  return value;
}

export function usePlayerState(): PlayerState {
  const value = use(StateContext);
  if (!value) throw new Error('usePlayerState must be used inside <PlayerProvider>');
  return value;
}

/**
 * Playback position, polled rather than pushed.
 *
 * The player emits events for things that change rarely; position changes
 * constantly and only matters while something is on screen showing it. Polling
 * from the component that displays it means nothing runs when nothing is
 * watching — which matters here, because the app keeps playing in the
 * background for hours.
 */
export function usePlayerPosition(active = true): { positionSec: number; durationSec: number } {
  const [position, setPosition] = useState({ positionSec: 0, durationSec: 0 });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const read = async () => {
      const status = await JukeboxAudio.getStatusAsync();
      if (cancelled || !status.connected) return;
      setPosition({
        positionSec: status.positionSec ?? 0,
        durationSec: status.durationSec ?? 0,
      });
    };
    void read();
    /*
      Four times a second. The seek bar would be happy with half that, but the
      lyrics would not: this is how often the sung line can change, so at 500ms
      a line could light up a noticeable beat after it was sung. Only runs
      while something is on screen showing the position, which is why it can
      afford to be this often.
    */
    const timer = setInterval(() => void read(), 250);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  return position;
}
