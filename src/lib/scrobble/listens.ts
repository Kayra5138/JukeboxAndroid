/**
 * A listen, as ListenBrainz wants to be told about one.
 *
 * Nothing here talks to anything. It is the part of sending that is only
 * arithmetic and spelling -- what a row of history becomes, which rows are
 * worth offering, how many fit in one request -- kept apart from the database
 * and the network so that each of those decisions can be checked on a desk.
 */

/**
 * The service's own limits, as its documentation gives them
 * (listenbrainz.readthedocs.io, "Core" and "JSON documentation").
 *
 * They are written down so that the numbers actually used, below, can be seen
 * to sit well inside them.
 */
export const SERVICE_LIMITS = {
  /** MAX_LISTENS_PER_REQUEST. */
  listensPerRequest: 1000,
  /** MAX_LISTEN_PAYLOAD_SIZE, the whole body of one request. */
  bytesPerRequest: 10_240_000,
  /** MAX_LISTEN_SIZE, one listen within it. */
  bytesPerListen: 10_240,
  /** LISTEN_MINIMUM_TS: nothing is accepted as heard before October 2002. */
  earliestListen: 1_033_430_400,
  /** MAX_DURATION_MS_LIMIT: twenty-four days. */
  longestTrackMs: 2_073_600_000,
} as const;

/**
 * How much is put in one request.
 *
 * A fifth of what is allowed, and a twentieth by weight. A request this size
 * is answered in a moment on a phone's connection; one at the limit is ten
 * megabytes sent from a train, and when it fails nobody can say how much of it
 * arrived. Smaller requests also mean that stopping, or losing the network,
 * costs at most this many listens sent again.
 */
export const LISTENS_PER_REQUEST = 200;
export const BYTES_PER_REQUEST = 512_000;

/** What the body is wrapped in besides the listens, with room to spare. */
const ENVELOPE_BYTES = 64;

export type Listen = {
  listened_at: number;
  track_metadata: {
    artist_name: string;
    track_name: string;
    release_name?: string;
    additional_info: {
      media_player: string;
      submission_client: string;
      submission_client_version: string;
      duration_ms?: number;
    };
  };
};

/** `single` is one listen just heard; `import` is any number of older ones. */
export type ListenType = 'single' | 'import';

/** A row of history, as far as sending it is concerned. */
export type HeardPlay = {
  /** Milliseconds, as `plays.started_at` holds it. */
  startedAt: number;
  title: string;
  artist: string | null;
};

/**
 * What the app calls the track now: the file's tags with whatever was looked
 * up or corrected laid over them. Absent for a track that has left the library.
 */
export type ShownNames = {
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSec: number | null;
};

const said = (value: string | null | undefined): string | null => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
};

/**
 * One listen, or null where there is not enough to make one.
 *
 * The names are the ones on screen, so that what turns up on ListenBrainz is
 * what the user would recognise and a correction made here is a correction
 * there. A track that has since been deleted has nothing on screen, and goes
 * under what was written in the history when it was heard.
 *
 * Null for a track with no artist. The service will not take a listen without
 * one, and the alternatives are both worse than leaving it out: "Unknown
 * artist" is a real name over there that thousands of badly tagged files
 * already pile into, and a guess from the file name is a guess. Left out, the
 * listen is still in the history here, and is offered again once the track has
 * been given an artist.
 *
 * Null too for a moment the service refuses -- before it existed, or not yet
 * happened, which is a phone whose clock was wrong.
 */
export function buildListen(
  play: HeardPlay,
  shown: ShownNames | null | undefined,
  version: string,
  now: number = Date.now()
): Listen | null {
  const title = said(shown?.title) ?? said(play.title);
  const artist = said(shown?.artist) ?? said(play.artist);
  if (!title || !artist) return null;

  // When it started, which is what both the app and the service mean by when.
  const listenedAt = Math.floor(play.startedAt / 1000);
  if (!Number.isFinite(listenedAt)) return null;
  if (listenedAt < SERVICE_LIMITS.earliestListen || listenedAt > Math.floor(now / 1000)) return null;

  const listen: Listen = {
    listened_at: listenedAt,
    track_metadata: {
      artist_name: artist,
      track_name: title,
      additional_info: {
        media_player: 'Jukebox',
        submission_client: 'Jukebox',
        submission_client_version: version,
      },
    },
  };

  const album = said(shown?.album);
  if (album) listen.track_metadata.release_name = album;

  // Nought is the media store saying it does not know, not a length.
  const durationMs = Math.round((shown?.durationSec ?? 0) * 1000);
  if (durationMs > 0 && durationMs <= SERVICE_LIMITS.longestTrackMs) {
    listen.track_metadata.additional_info.duration_ms = durationMs;
  }

  // A title pasted in from a web page can be any length. One listen over the
  // limit takes the whole request down with it, so it is left out here.
  if (bytesOf(JSON.stringify(listen)) > SERVICE_LIMITS.bytesPerListen) return null;
  return listen;
}

/**
 * How many bytes a string is once it is on the wire.
 *
 * Counted by hand because the limit is in bytes and a string's length is not:
 * a Japanese title is three bytes a character. `TextEncoder` would say the
 * same and is not something Hermes can be relied on to have.
 */
export function bytesOf(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      // The first half of a pair; the two together are four bytes.
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Cuts a run of listens into requests, in order.
 *
 * By count and by weight, whichever is reached first. Nothing is dropped and
 * nothing is reordered: what comes out, laid end to end, is what went in. A
 * single item heavier than the limit still gets a request to itself rather
 * than vanishing -- {@link buildListen} has already refused anything the
 * service would, so that is only ever a limit set lower than a listen.
 */
export function chunk<T>(
  items: readonly T[],
  maxCount: number = LISTENS_PER_REQUEST,
  maxBytes: number = BYTES_PER_REQUEST,
  weigh: (item: T) => number = (item) => bytesOf(JSON.stringify(item))
): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let weight = ENVELOPE_BYTES;

  for (const item of items) {
    // One more for the comma between it and the last.
    const size = weigh(item) + 1;
    if (current.length > 0 && (current.length >= maxCount || weight + size > maxBytes)) {
      chunks.push(current);
      current = [];
      weight = ENVELOPE_BYTES;
    }
    current.push(item);
    weight += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** What has been set up, as far as deciding about one listen needs to know. */
export type Sending = {
  /** A token is held. */
  connected: boolean;
  /** "Send what I listen to" is on. */
  sending: boolean;
  /** When it was last turned on, in milliseconds; null if it never was. */
  since: number | null;
};

/**
 * Whether a listen that has just been recorded joins the queue.
 *
 * Only one that started after the switch was turned on. What was already
 * playing at that moment began before the user had said anything, and
 * everything earlier is history, which is sent when it is asked for and not
 * because a switch moved. The start is what is compared, not the end, so that
 * the line falls in the same place the service will file the listen.
 */
export function joinsQueue(setup: Sending, startedAt: number): boolean {
  if (!setup.connected || !setup.sending || setup.since == null) return false;
  return startedAt >= setup.since;
}

/**
 * The token in what was pasted, or null if there is none.
 *
 * A token is copied off a web page and arrives with whatever the page and the
 * clipboard wrapped it in: spaces, a line break, the word "Token" in front,
 * and characters that cannot be seen at all — a zero-width space is enough.
 * Any of those in a request header stops the request from being made, and a
 * request that was never made used to be reported as the service being out of
 * reach, with a perfectly good token on the clipboard.
 *
 * ListenBrainz hands out tokens in one shape, eight-four-four-four-twelve
 * hexadecimal digits, so the token is found in the text rather than the text
 * being cleaned around it.
 */
export function tokenIn(pasted: string): string | null {
  const found = pasted.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return found ? found[0] : null;
}
