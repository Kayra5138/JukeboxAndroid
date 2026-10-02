import { db } from './index.ts';
import { nextPosition } from './tagPositions.ts';
import { canonicalLabel } from '../metadata/text.ts';

/**
 * Tags describe a track more honestly than a single genre can: the sources call
 * one song gothic, metal and japanese all at once, and which of those matters
 * depends on what you are looking for.
 *
 * They are ordered. Position 0 is whatever best describes the track — the
 * highest-voted label from the catalogues, or wherever the user dragged it.
 */
export type TagSource = 'musicbrainz' | 'itunes' | 'manual';

/**
 * Tags are held in one spelling, and that is settled here.
 *
 * Every write goes through `canonicalLabel` and every query is asked in it, so
 * `Rock`, `rock` and `ROCK` are one tag rather than three — the user types
 * whichever they like and the column never learns the difference. Doing it at
 * the door rather than at each comparison is what makes the comparisons
 * correct without having to remember: the primary key, `GROUP BY tag` and
 * `WHERE tag = ?` all then mean what they appear to, and none of them had to
 * be taught anything.
 *
 * Blank after canonicalising is not a tag. A row of one is invisible and
 * unremovable, since there is nothing to show and nothing to tap.
 */
function asTag(raw: string): string | null {
  const tag = canonicalLabel(raw);
  return tag.length > 0 ? tag : null;
}

export type Tag = { tag: string; position: number; source: TagSource };

/**
 * A tag being edited. The position is the index in the list rather than a
 * field, because the list is what the user is rearranging.
 */
export type TagEdit = Omit<Tag, 'position'>;

export function tagsFor(trackId: string): Tag[] {
  return db().getAllSync<Tag>(
    'SELECT tag, position, source FROM track_tags WHERE track_id = ? ORDER BY position',
    trackId
  );
}

/** Every track's tags at once, for building a library view without N queries. */
export function allTags(): Map<string, Tag[]> {
  const rows = db().getAllSync<Tag & { track_id: string }>(
    'SELECT track_id, tag, position, source FROM track_tags ORDER BY track_id, position'
  );
  const byTrack = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = byTrack.get(row.track_id) ?? [];
    list.push({ tag: row.tag, position: row.position, source: row.source });
    byTrack.set(row.track_id, list);
  }
  return byTrack;
}

/**
 * Replace a track's tags from a lookup, keeping anything the user added.
 *
 * Manual tags survive and stay in front: an edit is an answer, and re-running
 * enrichment should never quietly undo one.
 *
 * `source` says which catalogue answered, and is required: every caller knows
 * it, and a default would silently file Apple's labels under MusicBrainz.
 */
export function saveLookupTags(trackId: string, tags: string[], source: TagSource): void {
  const database = db();
  database.withTransactionSync(() => {
    const kept = database.getAllSync<{ tag: string; position: number }>(
      `SELECT tag, position FROM track_tags WHERE track_id = ? AND source = 'manual' ORDER BY position`,
      trackId
    );
    database.runSync(`DELETE FROM track_tags WHERE track_id = ? AND source != 'manual'`, trackId);

    const manual = new Set(kept.map((row) => row.tag));
    // Counting the manual tags instead only works if they are the first rows
    // of the list, and an edit does not leave them there: the user drags one
    // to the bottom, the lookup rows in front of it are the ones deleted just
    // above, and what survives sits at 0 and 5. A count starts the catalogue's
    // tags at 2 and walks them straight over that 5.
    let position = nextPosition(kept.map((row) => row.position));
    for (const raw of tags) {
      const tag = asTag(raw);
      // Both sides are canonical, so a tag the user typed as `Rock` does stop
      // a catalogue adding `rock` beside it.
      if (tag == null || manual.has(tag)) continue;
      database.runSync(
        'INSERT OR IGNORE INTO track_tags (track_id, tag, position, source) VALUES (?, ?, ?, ?)',
        trackId,
        tag,
        position,
        source
      );
      position += 1;
    }
  });
}

/**
 * Write the exact list the user arranged, in the order they arranged it.
 *
 * Each tag keeps the source it arrived with, and only the ones the user typed
 * come in as `manual`. Stamping the whole list `manual` meant that putting the
 * tags in a different order pinned them for good: `saveLookupTags` preserves a
 * manual row unconditionally, so no later lookup could ever replace a
 * MusicBrainz tag whose only crime was being moved down one place.
 */
export function saveManualTags(trackId: string, tags: TagEdit[]): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM track_tags WHERE track_id = ?', trackId);
    tags.forEach(({ tag: raw, source }, position) => {
      const tag = asTag(raw);
      if (tag == null) return;
      database.runSync(
        'INSERT OR IGNORE INTO track_tags (track_id, tag, position, source) VALUES (?, ?, ?, ?)',
        trackId,
        tag,
        position,
        source
      );
    });
  });
}

/**
 * Discard the tags the user typed, leaving whatever a lookup found.
 *
 * The other half of undoing an edit. Without it the manual rows outlive the
 * correction they came with, and because `saveLookupTags` never touches them a
 * later lookup cannot replace them either — so the edit stays half-reverted for
 * good.
 */
export function forgetManualTags(trackId: string): void {
  db().runSync(`DELETE FROM track_tags WHERE track_id = ? AND source = 'manual'`, trackId);
}

export type TagCount = { tag: string; trackCount: number };

/** Every tag in use, most common first — the basis for browsing by tag. */
export function tagCounts(): TagCount[] {
  return db().getAllSync<TagCount>(
    `SELECT tag, COUNT(*) AS trackCount
     FROM track_tags GROUP BY tag ORDER BY trackCount DESC, tag ASC`
  );
}

export function trackIdsWithTag(tag: string): string[] {
  const wanted = asTag(tag);
  if (wanted == null) return [];
  return db()
    .getAllSync<{ track_id: string }>('SELECT track_id FROM track_tags WHERE tag = ?', wanted)
    .map((row) => row.track_id);
}

/**
 * Adds one tag to several tracks, leaving the tags they already carry.
 *
 * Appended rather than written over: `saveManualTags` replaces a track's whole
 * list, which is right when the list is what is being edited and wrong here,
 * where the tag is being added to whatever is already there. It goes on the
 * end, since a tag applied in bulk is a label rather than the thing that best
 * describes any one track, and position is meant to say which is which.
 *
 * Tracks already carrying the tag are left untouched, whatever its source: a
 * lookup having found it first is not a reason to add it twice, and rewriting
 * it as manual would pin it against later lookups for no gain.
 */
export function addTagToTracks(trackIds: string[], tag: string): void {
  const cleaned = asTag(tag);
  if (cleaned == null || trackIds.length === 0) return;

  const database = db();
  database.withTransactionSync(() => {
    for (const trackId of trackIds) {
      const existing = database.getAllSync<{ position: number }>(
        'SELECT position FROM track_tags WHERE track_id = ?',
        trackId
      );
      const next = nextPosition(existing.map((row) => row.position));
      database.runSync(
        'INSERT OR IGNORE INTO track_tags (track_id, tag, position, source) VALUES (?, ?, ?, ?)',
        trackId,
        cleaned,
        next,
        'manual'
      );
    }
  });
}
