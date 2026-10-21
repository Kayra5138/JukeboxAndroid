import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { coverRemovedIds, fillCovers } from '../db/metadata.ts';
import { libraryState, refreshLibrary, subscribeLibrary } from '../library/index.ts';
import { isEmbeddedPicture } from '../metadata/covers.ts';
import { planSpread, runSpread, type SpreadDeps } from '../metadata/spread.ts';
import { noteError } from '../support/errorLogStore.ts';
import { artworkChanged } from './artworkEvents.ts';

/**
 * Handing records' covers to their bare tracks, with the real library, the
 * real database and the real phone behind it. The rules are in
 * `metadata/spread.ts`; this is when they are applied.
 *
 * After anything that could have brought a cover, or a track to give one to:
 *
 *  - whenever the library changes, which is a lookup finishing, a download or
 *    a song kept from Discover arriving, a record or its artist renamed, a
 *    file found by a fresh look at the device — and, the first time the
 *    library is read in a run of the app, the whole of it, which is the
 *    repair of everything that went bare before this existed;
 *  - straight after a save on the details screen, for that track's record,
 *    rather than whenever the library is next looked at;
 *  - when somebody is looking at a record whose first track has no picture
 *    and a later one has one in its file, which is the one time a picture
 *    inside a file is kept and given (`useAlbumArtwork`).
 *
 * A pass over the whole library costs one grouping of it and nothing else
 * when every record is whole, which is what it nearly always finds. Files are
 * only asked about for tracks that something could be given to, what the
 * phone already knows about them is asked first, and only the files nobody
 * has opened before are opened.
 *
 * One pass at a time. Whatever is asked for while one is running is gathered
 * up and done by the next.
 */

/** A pass asked for: the records holding these tracks, or all of them; and whether files may give. */
type Wanted = { tracks: Set<string> | null; embedded: boolean };

let running: Promise<void> | null = null;
let waiting: Wanted | null = null;

function merge(into: Wanted | null, next: Wanted): Wanted {
  if (!into) return next;
  return {
    tracks: into.tracks && next.tracks ? new Set([...into.tracks, ...next.tracks]) : null,
    embedded: into.embedded || next.embedded,
  };
}

/** Which files carry a picture, with a build from before the phone could say all at once. */
const pictures: SpreadDeps['pictures'] = async (trackIds, open) => {
  if (JukeboxAudio.embeddedPicturesAsync) {
    const said = await JukeboxAudio.embeddedPicturesAsync(trackIds, open);
    return new Map(trackIds.map((id) => [id, said[id] ?? null]));
  }
  if (!open) return new Map(trackIds.map((id) => [id, null]));
  const answers = new Map<string, boolean | null>();
  for (const id of trackIds) {
    const uri = await JukeboxAudio.getEmbeddedArtworkAsync(id).catch(() => null);
    answers.set(id, isEmbeddedPicture(uri));
  }
  return answers;
};

const keepPicture: SpreadDeps['keepPicture'] = async (trackId) => {
  if (!JukeboxAudio.keepArtworkAsync) return null;
  const uri = await JukeboxAudio.getEmbeddedArtworkAsync(trackId).catch(() => null);
  if (!isEmbeddedPicture(uri)) return null;
  return JukeboxAudio.keepArtworkAsync(uri!);
};

async function pass(wanted: Wanted): Promise<void> {
  // So that what was saved a moment ago is in the tracks this reads.
  await refreshLibrary();
  const state = libraryState();
  if (state.kind !== 'library' || !state.confirmed) return;

  const plans = planSpread(state.tracks, {
    removed: coverRemovedIds(),
    only: wanted.tracks ?? undefined,
    embedded: wanted.embedded,
  });
  if (plans.length === 0) return;

  const filled = await runSpread(plans, {
    pictures,
    keepPicture,
    fill: fillCovers,
    // A full pass asked for behind this one will see everything this would.
    stopped: () => waiting != null && waiting.tracks == null && wanted.tracks != null,
  });
  if (filled.length > 0) {
    artworkChanged();
    await refreshLibrary();
  }
}

/**
 * Gives records' covers to their bare tracks: the records holding [trackIds],
 * or every record. [embedded] lets a record with no cover of the app's own
 * give the picture in one of its files.
 *
 * Never rejects; a pass that fails is written in the error log and the next
 * one tries again.
 */
export function spreadCovers(options: { trackIds?: Iterable<string>; embedded?: boolean } = {}): Promise<void> {
  waiting = merge(waiting, {
    tracks: options.trackIds ? new Set(options.trackIds) : null,
    embedded: options.embedded ?? false,
  });
  if (running) return running;
  running = (async () => {
    while (waiting) {
      const next = waiting;
      waiting = null;
      try {
        await pass(next);
      } catch (error) {
        noteError('lookup', error);
      }
    }
    running = null;
  })();
  return running;
}

/** How long the library is left to settle before a pass, after it changes. */
const SETTLE_MS = 2_500;

/**
 * Gives covers out whenever the library changes, for as long as the app
 * runs. Answers with how to stop.
 */
export function keepSpreadingCovers(): () => void {
  let seen: unknown = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const look = () => {
    const state = libraryState();
    if (state.kind !== 'library' || !state.confirmed || state.tracks === seen) return;
    seen = state.tracks;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void spreadCovers();
    }, SETTLE_MS);
  };
  const unsubscribe = subscribeLibrary(look);
  look();
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
