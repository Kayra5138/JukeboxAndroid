import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import type { Track } from '../types.ts';
import { thumbName } from './thumbs';

/**
 * The paper sleeves that stand in for covers there are none of: see
 * `StandIn.kt`, which draws them. One for each record, or for each song with
 * no record, the same file the widget, the notification and the car show.
 */

/**
 * Whether [uri] is one of these rather than a cover: for where what is drawn
 * is about the cover itself, as when a cover is chosen or taken off.
 */
export function isStandIn(uri: string | null | undefined): boolean {
  return uri != null && uri.includes('/stand-ins/');
}

/** How much of a sleeve's width its round label takes: `StandIn.kt` draws it 0.175 of it either side of the middle. */
export const STAND_IN_LABEL = 0.35;

/** Where the sleeves are, once known, and which are made. */
let folder: string | null = null;
const made = new Set<string>();
/** Sleeves being made, so that the tracks of one record ask once. */
const making = new Map<string, Promise<string | null>>();

/** Asked once, as the app starts: which sleeves are there already. */
const ready: Promise<void> = (async () => {
  try {
    const answer = await JukeboxAudio.standInsMadeAsync?.();
    if (!answer) return;
    folder = answer.dir.endsWith('/') ? answer.dir.slice(0, -1) : answer.dir;
    for (const name of answer.names) made.add(name);
  } catch {
    // None known, then: each is asked for as it is first wanted.
  }
})();

const plain = (text: string | null | undefined) => (text ?? '').trim().toLowerCase();

/**
 * Which record a sleeve is for, worked out exactly as `StandIn.identityOf`:
 * its name and whose it is, or failing a name the song's, and its genre.
 */
function identityOf(track: Track): string {
  const record = plain(track.album);
  const who = record
    ? `a\u0000${record}\u0000${plain(track.albumArtist) || plain(track.artist)}`
    : `t\u0000${plain(track.title)}\u0000${plain(track.artist)}`;
  return `${who}\u0000${plain(genreOf(track))}`;
}

/** The genre a track is filed under, where it is a track that knows: the label's colour. */
function genreOf(track: Track): string | null {
  const known = track as Track & { genre?: string | null; tags?: readonly string[] };
  return known.genre ?? known.tags?.[0] ?? null;
}

/** The sleeve for [track]'s record if it is made and known to be: at once, or null. */
export function standInNow(track: Track | null | undefined): string | null {
  if (!track || !folder) return null;
  const name = thumbName(identityOf(track));
  return made.has(name) ? `${folder}/${name}.jpg` : null;
}

/** The sleeve for [track]'s record, made if it is not yet; null where it cannot be. */
export function standInFor(track: Track): Promise<string | null> {
  const name = thumbName(identityOf(track));
  const already = making.get(name);
  if (already) return already;
  const asking = (async () => {
    await ready;
    if (folder && made.has(name)) return `${folder}/${name}.jpg`;
    const answer =
      (await JukeboxAudio.standInAsync?.(track.album, track.albumArtist ?? null, track.title, track.artist, genreOf(track)).catch(
        () => null
      )) ?? null;
    if (answer) made.add(name);
    return answer;
  })();
  making.set(name, asking);
  void asking.finally(() => making.delete(name));
  return asking;
}
