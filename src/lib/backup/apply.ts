import {
  emptyTables,
  type BackupTrack,
  type Cell,
  type Row,
  type TableName,
  type Tables,
} from './format.ts';

/**
 * Turning what a backup says into what this phone should hold.
 *
 * Two steps, both of them arithmetic on rows with no database in sight. First
 * the backup is re-addressed: every song id in it is replaced by the id that
 * song has here. Then, if the phone already has something, the two are merged
 * by rules that say which of two versions of the same thing is kept.
 */

const fold = (value: Cell | undefined) =>
  typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';

/** FNV-1a, which is enough to give the same song the same name twice. */
function hash(value: string): string {
  let state = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    state ^= value.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }
  return (state >>> 0).toString(16).padStart(8, '0');
}

/**
 * The file name of a picture kept in the app's own artwork folder, or null.
 *
 * Only a bare name is ever taken from a backup. The reference inside it is a
 * path on the phone that wrote it, and following a path out of a file somebody
 * handed over is how an import ends up reading whatever it is pointed at.
 */
export function artworkName(uri: Cell | undefined): string | null {
  if (typeof uri !== 'string') return null;
  const match = /^file:\/\/.*\/album-artwork\/([A-Za-z0-9._-]{1,160})$/.exec(uri);
  if (!match || match[1]!.startsWith('.')) return null;
  return match[1]!;
}

/**
 * Where a picture is on this phone.
 *
 * One of the app's own becomes the same file name in this phone's artwork
 * folder. A picture on the web is kept as it is, if it is asked for securely.
 * Anything else -- a path into another app, a scheme nobody recognises -- is
 * dropped: the cover goes missing, which is a small loss and the right one.
 */
function picture(uri: Cell | undefined, artworkHome: string): string | null {
  const name = artworkName(uri);
  if (name) return artworkHome + name;
  return typeof uri === 'string' && uri.startsWith('https://') ? uri : null;
}

/** Every song id the tables mention. */
export function referencedIds(tables: Tables): Set<string> {
  const ids = new Set<string>();
  for (const name of Object.keys(tables) as TableName[]) {
    for (const row of tables[name]) {
      if (typeof row.track_id === 'string') ids.add(row.track_id);
      if (typeof row.cover_track_id === 'string') ids.add(row.cover_track_id);
    }
  }
  return ids;
}

/** The names of every picture of the app's own that the tables point at. */
export function referencedArtwork(tables: Tables): string[] {
  const names = new Set<string>();
  for (const row of tables.track_metadata) {
    const name = artworkName(row.artwork_url);
    if (name) names.add(name);
  }
  for (const row of tables.playlists) {
    const name = artworkName(row.cover_uri);
    if (name) names.add(name);
  }
  return [...names].sort();
}

export type Remapped = {
  tables: Tables;
  /** Rows that had to be left out because their song is not on this phone. */
  dropped: number;
};

/**
 * The backup's tables with every song id replaced by this phone's.
 *
 * A song that is not here is treated in one of two ways, by what the row is.
 *
 * A listen is kept. It happened, it carries its own title and artist, and the
 * hours it adds up to are the same hours whether or not the file is still
 * around -- which is how the app already treats a song that was deleted. It is
 * filed under an id made from the song's own description, never the backup's
 * number: that number is another phone's, and here it may well be the id of a
 * different song, which would then inherit a stranger's history.
 *
 * Everything else is dropped. A tag, a lyric or a place in a list is a thing
 * said about a song, and with no song to say it about there is nowhere to put
 * it and nothing that would ever read it.
 */
export function remapTables(
  tables: Tables,
  to: Map<string, string>,
  tracks: BackupTrack[],
  artworkHome: string
): Remapped {
  const described = new Map(tracks.map((track) => [track.id, track]));
  const absent = (id: string, row: Row) => {
    const track = described.get(id);
    const name = fold(track?.filename ?? row.filename);
    const song = `${fold(track?.title ?? row.title)}\u0000${fold(track?.artist ?? row.artist)}`;
    return `absent:${hash(name || song)}`;
  };

  const out = emptyTables();
  // Catalogue recording ids are portable; no device track id needs remapping.
  out.discover_exclusions = tables.discover_exclusions.map(row => ({ ...row }));
  let dropped = 0;

  for (const name of ['plays', 'skips'] as const) {
    for (const row of tables[name]) {
      const id = row.track_id as string;
      out[name].push({ ...row, track_id: to.get(id) ?? absent(id, row) });
    }
  }

  for (const name of ['track_metadata', 'track_tags', 'track_lyrics', 'lyric_translations'] as const) {
    for (const row of tables[name]) {
      const id = to.get(row.track_id as string);
      if (!id) {
        dropped++;
        continue;
      }
      const moved: Row = { ...row, track_id: id };
      if (name === 'track_metadata') moved.artwork_url = picture(row.artwork_url, artworkHome);
      out[name].push(moved);
    }
  }

  const lists = new Set<Cell>();
  for (const row of tables.playlists) {
    lists.add(row.id!);
    out.playlists.push({
      ...row,
      cover_track_id:
        typeof row.cover_track_id === 'string' ? (to.get(row.cover_track_id) ?? null) : null,
      cover_uri: picture(row.cover_uri, artworkHome),
    });
  }
  for (const row of tables.playlist_tracks) {
    const id = to.get(row.track_id as string);
    if (!id || !lists.has(row.playlist_id!)) {
      dropped++;
      continue;
    }
    out.playlist_tracks.push({ ...row, track_id: id });
  }

  return { tables: consolidate(out), dropped };
}

/** How much a metadata row is to be believed: written by hand, found, or not found. */
const standing = (row: Row) => (row.status === 'manual' ? 2 : row.status === 'matched' ? 1 : 0);

/**
 * Which of two rows about the same song's details is kept.
 *
 * What somebody typed beats what a catalogue said, and what a catalogue said
 * beats having looked and found nothing. Between two of the same standing the
 * newer is kept, and on a dead heat the one already here -- so merging a backup
 * into the phone it came from changes nothing.
 */
function betterDetails(here: Row, there: Row): Row {
  const a = standing(here);
  const b = standing(there);
  if (b !== a) return b > a ? there : here;
  return (there.fetched_at as number) > (here.fetched_at as number) ? there : here;
}

const hasWords = (row: Row) => (row.plain != null && row.plain !== '') || (row.synced != null && row.synced !== '');

/** The same for lyrics: corrected by hand, then actually having words, then newer. */
function betterLyrics(here: Row, there: Row): Row {
  const a = here.source === 'manual' ? 1 : 0;
  const b = there.source === 'manual' ? 1 : 0;
  if (b !== a) return b > a ? there : here;
  if (hasWords(here) !== hasWords(there)) return hasWords(there) ? there : here;
  return (there.fetched_at as number) > (here.fetched_at as number) ? there : here;
}

const newerTranslation = (here: Row, there: Row) =>
  (there.translated_at as number) > (here.translated_at as number) ? there : here;

/** Rows that are one thing each, with a rule for which of two is kept. */
function oneOfEach(
  here: Row[],
  there: Row[],
  key: (row: Row) => string,
  better: (here: Row, there: Row) => Row
): Row[] {
  const kept = new Map<string, Row>();
  for (const row of [...here, ...there]) {
    const at = key(row);
    const already = kept.get(at);
    kept.set(at, already ? better(already, row) : row);
  }
  return [...kept.values()];
}

/**
 * Listens from both, with a listen counted once.
 *
 * A listen is the moment it began, to the millisecond, and nothing else. Not
 * the song's id: that is exactly what an import changes. A listen to a song
 * that has since been deleted comes back filed under a made-up id, and one to
 * a file that was moved comes back under the file's new id, and going by id
 * either would be taken for a second listen and counted twice. Going by the
 * moment, merging a backup into the phone it was made on adds nothing, however
 * much of the music has gone or moved since.
 *
 * Everything here is kept as it is, whatever it looks like. The backup adds
 * only as many listens at a moment as it has beyond what is already here.
 */
function everyListen(here: Row[], there: Row[]): Row[] {
  const held = new Map<Cell, number>();
  for (const row of here) held.set(row.started_at!, (held.get(row.started_at!) ?? 0) + 1);

  const out = [...here];
  for (const row of there) {
    const left = held.get(row.started_at!) ?? 0;
    if (left > 0) held.set(row.started_at!, left - 1);
    else out.push(row);
  }
  // Stable, so that what was here keeps its order among listens begun together.
  return out.sort((a, b) => (a.started_at as number) - (b.started_at as number));
}

const byPosition = (a: Row, b: Row) => (a.position as number) - (b.position as number);

/**
 * A song's tags from both, the ones already here first and in their order.
 *
 * Order is the point of a tag list -- the first is the one the song is filed
 * under -- so what is here is never rearranged. What the other side adds goes
 * on the end.
 */
function everyTag(here: Row[], there: Row[]): Row[] {
  const bySong = new Map<string, Row[]>();
  const taken = new Set<string>();
  for (const row of [...here].sort(byPosition).concat([...there].sort(byPosition))) {
    const id = row.track_id as string;
    const at = `${id}\u0000${row.tag}`;
    if (taken.has(at)) continue;
    taken.add(at);
    const list = bySong.get(id);
    if (list) list.push(row);
    else bySong.set(id, [row]);
  }
  const out: Row[] = [];
  for (const list of bySong.values()) {
    // Renumbered from the first position this song already used, so a list that
    // counted from nought goes on counting from nought.
    const first = Math.min(...list.map((row) => row.position as number));
    list.forEach((row, index) => out.push({ ...row, position: first + index }));
  }
  return out;
}

/** A list's songs from both, each once, what is here keeping its place. */
function everyEntry(here: Row[], there: Row[]): Row[] {
  const byList = new Map<Cell, Row[]>();
  const taken = new Set<string>();
  for (const row of [...here].sort(byPosition).concat([...there].sort(byPosition))) {
    const at = `${row.playlist_id}\u0000${row.track_id}`;
    if (taken.has(at)) continue;
    taken.add(at);
    const list = byList.get(row.playlist_id!);
    if (list) list.push(row);
    else byList.set(row.playlist_id!, [row]);
  }
  const out: Row[] = [];
  for (const list of byList.values()) {
    const first = Math.min(...list.map((row) => row.position as number));
    list.forEach((row, index) => out.push({ ...row, position: first + index }));
  }
  return out;
}

/** The tables that are keyed by a song, merged. Lists are a separate matter. */
function mergeKeyed(here: Tables, there: Tables): Omit<Tables, 'playlists' | 'playlist_tracks'> {
  return {
    discover_exclusions: oneOfEach(here.discover_exclusions, there.discover_exclusions, row => row.id as string,
      (a, b) => a.reason === 'blocked' ? a : b.reason === 'blocked' ? b : a.until_at == null ? a : b.until_at == null ? b : (a.until_at as number) >= (b.until_at as number) ? a : b),
    plays: everyListen(here.plays, there.plays),
    skips: everyListen(here.skips, there.skips),
    track_metadata: oneOfEach(
      here.track_metadata,
      there.track_metadata,
      (row) => row.track_id as string,
      betterDetails
    ),
    track_tags: everyTag(here.track_tags, there.track_tags),
    track_lyrics: oneOfEach(
      here.track_lyrics,
      there.track_lyrics,
      (row) => row.track_id as string,
      betterLyrics
    ),
    lyric_translations: oneOfEach(
      here.lyric_translations,
      there.lyric_translations,
      (row) => `${row.track_id}\u0000${row.target}`,
      newerTranslation
    ),
  };
}

/**
 * One set of tables with nothing said twice.
 *
 * Needed after re-addressing, because two songs in a backup can turn out to be
 * the same song here, and then there are two rows where the database allows
 * one. The lists themselves are left as they are: two lists with the same name
 * in one backup are two lists somebody made, not a duplicate.
 */
export function consolidate(tables: Tables): Tables {
  return {
    ...mergeKeyed(emptyTables(), tables),
    playlists: tables.playlists,
    playlist_tracks: everyEntry([], tables.playlist_tracks),
  };
}

/**
 * What the phone holds after a backup is merged into it.
 *
 * Listens are added together. For anything there can only be one of -- a
 * song's details, its lyrics, a translation -- the better of the two is kept by
 * the rules above. Tags and list entries are pooled.
 *
 * A list in the backup is poured into a list here when the two have the same
 * name and are the same kind (both plain, or both following the same tag), and
 * is otherwise added as a list of its own. A list here takes in at most one
 * from the backup, so two lists called the same thing in the backup do not both
 * end up in whichever one happened to be here.
 */
export function mergeTables(here: Tables, there: Tables): Tables {
  const kind = (row: Row) => `${fold(row.name)}\u0000${row.tag ?? ''}`;

  const lists = here.playlists.map((row) => ({ ...row }));
  const free = new Map<string, Row[]>();
  for (const row of lists) {
    const at = kind(row);
    const list = free.get(at);
    if (list) list.push(row);
    else free.set(at, [row]);
  }

  let next = lists.reduce((most, row) => Math.max(most, row.id as number), 0) + 1;
  const becomes = new Map<Cell, number>();
  for (const row of [...there.playlists].sort((a, b) => (a.id as number) - (b.id as number))) {
    const mine = free.get(kind(row))?.shift();
    if (mine) {
      becomes.set(row.id!, mine.id as number);
      mine.updated_at = Math.max(mine.updated_at as number, row.updated_at as number);
      // A cover somebody chose here is not replaced by one chosen elsewhere.
      if (mine.cover_uri == null && mine.cover_track_id == null) {
        mine.cover_uri = row.cover_uri ?? null;
        mine.cover_track_id = row.cover_track_id ?? null;
      }
    } else {
      const id = next++;
      becomes.set(row.id!, id);
      lists.push({ ...row, id });
    }
  }

  const theirs = there.playlist_tracks.map((row) => ({
    ...row,
    playlist_id: becomes.get(row.playlist_id!) ?? null,
  }));

  return {
    ...mergeKeyed(here, there),
    playlists: lists,
    playlist_tracks: everyEntry(
      here.playlist_tracks,
      theirs.filter((row) => row.playlist_id != null)
    ),
  };
}

/** What a backup holds, for telling somebody before anything is done with it. */
export type Summary = {
  songs: number;
  found: number;
  listens: number;
  lists: number;
  tagged: number;
  lyrics: number;
};

export function summarise(tables: Tables, to: Map<string, string>): Summary {
  const ids = referencedIds(tables);
  let found = 0;
  for (const id of ids) if (to.has(id)) found++;
  return {
    songs: ids.size,
    found,
    listens: tables.plays.length,
    lists: tables.playlists.length,
    tagged: new Set(tables.track_tags.map((row) => row.track_id)).size,
    lyrics: tables.track_lyrics.filter(hasWords).length,
  };
}
