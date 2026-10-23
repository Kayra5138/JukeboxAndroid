import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations.ts';

let database: SQLiteDatabase | null = null;

/**
 * Opened lazily and kept for the life of the process.
 *
 * Opening it costs a schema check and, once, a migration, so the first caller
 * pays for all of them. Nothing should make that first caller a render: the
 * player provider reads its settings from an effect for exactly this reason.
 */
export function db(): SQLiteDatabase {
  if (database) return database;
  const opened = openDatabaseSync('jukebox.db');
  try {
    opened.execSync('PRAGMA journal_mode = WAL');
    migrate(opened);
  } catch (error) {
    // expo-sqlite hands back the same native connection for a path until it is
    // closed, so simply not keeping the reference would not undo anything: the
    // retry would land on this very handle, and it would still be holding the
    // file open and its write lock with it. Closing is what makes the next call
    // a genuinely fresh attempt.
    try {
      opened.closeSync();
    } catch {
      // Whatever went wrong closing, the migration failure is the one that
      // explains the state the user is in, so that is the one that propagates.
    }
    throw error;
  }
  database = opened;
  return database;
}

export function readSetting(key: string): string | null {
  const row = db().getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

/**
 * Writes a setting, and answers whether it was written.
 *
 * Never throws. Nearly every setting is written from a switch or a choice
 * somebody just made, in the handler of the press itself, where a throw is
 * an uncaught error; a database that will not take the write is the choice
 * not kept past this run, which is the lesser harm. Where a write has to
 * fail with what it is part of — inside a transaction — it is
 * {@link writeSettingOrThrow}.
 */
export function writeSetting(key: string, value: string): boolean {
  try {
    writeSettingOrThrow(key, value);
    return true;
  } catch (failure) {
    console.warn(`Could not keep the setting ${key}`, failure);
    return false;
  }
}

/** {@link writeSetting} that lets a failure through, for a write inside a transaction that must roll back with it. */
export function writeSettingOrThrow(key: string, value: string): void {
  db().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export const SETTINGS = {
  /**
   * Media store relative path the library is read from, without a trailing
   * slash. A setting rather than a constant because `Music` is often a mixed
   * bag — ringtones, game audio, voice memos — while the actual collection sits
   * in one folder below it.
   */
  libraryRoot: 'library:root',
  /**
   * The folders under the library folder that are left out of the library,
   * as a JSON list of whole media store paths without slashes at either end
   * (`["Music/WhatsApp"]`). Absent or unreadable, nothing is left out. See
   * `library/hiding.ts`; the car reads it too, from its copy.
   */
  libraryLeftOut: 'library:leftOut',
  /**
   * How short a file has to be, in seconds, to be left out of the library:
   * one of `'0' | '10' | '30' | '60'`, `'0'` for not at all. Absent is the
   * same as `'0'`, which is where every install starts.
   */
  libraryShortest: 'library:shortest',
  /**
   * The pairs of tracks the user has said are two songs and not one song
   * twice, as a JSON list of `pairKey` in `library/copies.ts` (`["12:7"]`).
   * Absent or unreadable, none: every pair that looks like a copy is shown
   * on the Copies screen. Ids and not names, so that a third file turning
   * up later is asked about afresh.
   */
  libraryNotCopies: 'library:notCopies',
  /**
   * The downloads in the library the user has said are the song they are
   * filed as, though their video's title names another, as a JSON list of
   * `rightKey` in `discover/verify.ts` (`["12:dQw4w9WgXcQ"]`). Absent or
   * unreadable, none: every such file is shown on the Wrong downloads screen.
   * The file and the video, so that the same file fetched again from another
   * video is asked about afresh.
   */
  libraryRightDownloads: 'library:rightDownloads',
  /**
   * The songs of Discover's whose file was found to be another song and let
   * go, to be looked for again, as a JSON list of recording ids, newest last.
   * A song that turns up here a second time is put away instead of being
   * looked for once more: see `mendWrongFinds` in `discover/engine.ts`.
   */
  discoverWrongMended: 'discover:wrongMended',
  /** `'true'` when playback order is shuffled. */
  shuffle: 'player:shuffle',
  /** One of `'off' | 'one' | 'all'`. */
  repeat: 'player:repeat',
  /** Which stretch of history the stats screen opens on. */
  statsPeriod: 'stats:period',
  /** Which reading of it: the one being lived, the one before, or the stretch up to now. */
  statsWhich: 'stats:which',
  /**
   * Which way the library was last being looked at: one of the views in
   * `media/views.ts`. Absent, or naming a view that has since been turned off,
   * the first one on offer is drawn instead.
   */
  libraryView: 'library:view',
  /**
   * The views the library's switch offers, as their names with commas between
   * — see `media/views.ts` for what an absent one means.
   */
  libraryViews: 'library:views',
  /**
   * One of `'name' | 'added' | 'played'` — see `media/sort.ts`.
   *
   * Kept for the library as a whole rather than per view. Tracks and records are
   * two ways of looking at one collection, and somebody who has said they want
   * to see what is new has said it about the collection, not about the shape it
   * happens to be drawn in.
   */
  librarySort: 'library:sort',
  /**
   * The order of the artists, and of the folders: `ArtistSort` in
   * `media/artists.ts` and `FolderSort` in `media/folders.ts`.
   *
   * Each its own, unlike the one above. These are not the collection drawn
   * another way but lists of other things, asked other questions — there is no
   * "most tracks" to ask of a track — so an answer given for one of them says
   * nothing about the others.
   */
  libraryArtistSort: 'library:sort:artists',
  libraryFolderSort: 'library:sort:folders',
  /**
   * `'true'` when records are browsed as a rack rather than as a list.
   *
   * Only a question sideways. The rack is records turned about a vertical axis
   * and seen from the side; upright the same shape has to stack instead, which
   * reads as a pile of slabs rather than a shelf, so there is no rack to offer
   * and the key is read only when the phone is on its side.
   */
  coverFlow: 'library:coverFlow:landscape',
  /**
   * `'true'` when the decoration should hold still.
   *
   * For a phone that cannot afford it. Everything this turns off is something
   * that was added to make a moment legible — the player rising rather than
   * appearing, a life swelling as it comes back, the board washed in colour
   * when one is lost — and on hardware that drops frames doing it, the moment
   * is less legible with the animation than without.
   *
   * Off by default, because most phones manage and the decoration is doing a
   * job. It is deliberately not tied to the system's own reduce-motion switch:
   * that one is an accessibility preference about vestibular discomfort, and
   * someone who turns it on has not thereby asked a game to look plainer.
   */
  reduceMotion: 'ui:reduceMotion',
  /** `'false'` when rows of tracks leave out the three dots that open their menu; anything else shows them. */
  moreButton: 'ui:moreButton',
  /** The tabs left off the bar, as JSON: `storedHidden` in `ui/tabChoice.ts`. Absent, every tab is there. */
  hiddenTabs: 'ui:hiddenTabs',
  /**
   * `'true'` while a round button floats over the app whenever something is
   * being downloaded; see `components/DownloadsButton.tsx`.
   *
   * Off unless asked for. It is drawn over whatever screen is open, and a
   * thing that turns up over somebody's library unbidden is in the way before
   * it is useful: the queue has a screen of its own for whoever goes looking.
   */
  downloadsButton: 'ui:downloadsButton',
  /** `'true'` where the player has its heart: see `lib/ui/heart.ts`. */
  heart: 'ui:heart',
  /** `'false'` where the player leaves out its add-to-list button; anything else shows it. */
  listButton: 'player:listButton',
  /**
   * `'false'` where the app is not to look for a newer yt-dlp by itself.
   * Anything else, and nothing at all, is yes: see `lib/youtube/extractor.ts`
   * for what the look is, and how rarely it is made.
   */
  extractorCheck: 'downloads:extractorCheck',
  /** What the last look found and when it was made, as `Known` in that file writes it. */
  extractorKnown: 'downloads:extractorKnown',
  /**
   * How late the sound is by the time it is heard, in milliseconds.
   *
   * Only the tiles game reads it, but what it describes belongs to the
   * listener's output rather than to the game: a Bluetooth speaker runs a
   * fifth of a second behind whatever is feeding it, and that is as true of
   * the next thing that has to line up with the ear as it is of this one.
   */
  tilesOffsetMs: 'tiles:offsetMs',
  /** One of the ids in `lib/tiles/game.ts`, so the last choice is offered first. */
  tilesDifficulty: 'tiles:difficulty',
  /**
   * How far the player's two jump buttons move, in seconds.
   *
   * Settable because the right step belongs to what is being listened to
   * rather than to the player. Ten seconds is a line of a song and most of a
   * spoken sentence; it is also nothing at all in a half-hour mix, where the
   * thing being looked for is a minute away.
   */
  jumpSeconds: 'player:jumpSeconds',
  sleepTimer: 'player:sleepTimer', // What the sleep timer was last set to; see `player/sleep.ts`.
  /**
   * What plays when the queue is about to run out: one of
   * `'off' | 'library' | 'fresh' | 'mixed'` — nothing, similar songs from the
   * library, new songs from Discover, or the two together. Absent or anything
   * else, `'off'`; see `player/autoplay/plan.ts`. A preference, and travels in
   * a backup.
   */
  autoplay: 'player:autoplay',
  /**
   * Which songs at the end of the queue were picked by the above, so that the
   * heading over them is still there after the app is closed and opened: the
   * ids of those songs in order, and whether the picks were taken out of the
   * queue that begins with `head`. As `TailNote` in `player/autoplay/tail.ts`
   * writes it. About this phone's queue, and so stays behind in a backup.
   */
  autoplayQueued: 'player:autoplay:queued',
  /**
   * How many songs each top-up adds, from the library and from Discover, as
   * `library,fresh`: see `BatchSizes` in `player/autoplay/plan.ts`. For the
   * end of any queue and for a queue begun as similar songs alike. Absent,
   * eight and four. A preference, and travels in a backup.
   */
  autoplaySizes: 'player:autoplay:sizes',
  /**
   * What a tap on a track plays: one of `'list' | 'shuffled' | 'similar' |
   * 'only'` — the list from that track on, the rest of it shuffled, similar
   * songs, or the track alone. Absent or anything else, `'list'`; see
   * `player/tap.ts`. A preference, and travels in a backup.
   */
  onTap: 'player:onTap',
  /**
   * `'1'` where the above holds on the pages of albums, lists, artists and
   * folders too, and not only on Tracks and in search results. Absent, it does
   * not: a record is mostly listened to in its order.
   */
  onTapEverywhere: 'player:onTapEverywhere',
  /**
   * Where the songs come from in a queue begun as similar songs to the one
   * tapped: `'library' | 'fresh' | 'mixed'`, as for the end of any queue
   * (`autoplay` above) but chosen apart from it. Absent or anything else,
   * `'library'`. A preference, and travels in a backup.
   */
  onTapSimilar: 'player:onTap:similar',
  /**
   * The language the app speaks, as the id of one in `i18n/languages.ts`.
   *
   * Chosen by hand and deliberately not taken from the phone: absent, the app
   * is in English whatever the phone is in.
   */
  language: 'ui:language',
  /**
   * `'system'`, or the id of a theme in `theme/registry.ts`. Absent, or naming
   * a theme that is no longer there, it is `'system'`.
   */
  theme: 'ui:theme',
  /**
   * The colours of the theme somebody made for themselves, as
   * `theme/custom.ts` writes them: the page, the accent and perhaps a card.
   * Kept whether or not that theme is the one chosen, so that going to
   * another and coming back finds it as it was left. Absent, its defaults.
   */
  customTheme: 'ui:theme:custom',
  /**
   * The theme following the phone uses while the phone is in its light mode,
   * and the one for its dark mode: a theme's id each. Absent, they are the
   * plain light theme and the plain dark one.
   */
  themeLight: 'ui:theme:light',
  themeDark: 'ui:theme:dark',
  /** `'true'` while the app opens in a theme drawn at random from `themeShufflePool`; see `theme/shuffle.ts`. */
  themeShuffle: 'ui:theme:shuffle',
  /** The ids of the themes that draw is made from, with commas between. Kept while the draw is off. */
  themeShufflePool: 'ui:theme:shufflePool',
  /**
   * The language lyrics are translated into, as the translator's tag for it.
   * Absent, English; see `lyrics/target.ts`.
   */
  lyricsTarget: 'lyrics:target',
  /**
   * The folders `.lrc` files are read from, beside the songs in them: a JSON
   * list of the system's address for each and a name to show, as
   * `writeFolders` in `lyrics/local.ts` writes it. Absent or empty, no `.lrc`
   * is read. Each was picked by the user once, with the system's folder
   * picker, which is the only way Android lets an app read a text file it did
   * not make; the grant itself is the system's and is checked at every read,
   * so a list restored onto another phone reads as no folders at all.
   */
  lyricsFolders: 'lyrics:folders',
  /**
   * How the library's offer to look its files up was answered: how often, when,
   * and whether with a yes. As `OfferKept` in `metadata/offer.ts` writes it.
   * Absent, it has never been asked.
   */
  lookupOffer: 'metadata:offer',
  /**
   * Whether this install shows the newcomer's tips, and which have been put
   * away: `TipsKept` in `ui/tips.ts`. Absent, it is decided the first time a
   * tip could show, from whether anything has been listened to.
   */
  tips: 'ui:tips',
  /**
   * Whether the first start's setup has been seen: `WelcomeKept` in
   * `ui/welcome.ts`. Absent, it is owed to a new install and written once it
   * is finished. Which version of the setup is `setupSeen`, below.
   */
  welcome: 'ui:welcome',
  /**
   * The setup version this install has seen through to the end, as a whole
   * number: `SETUP_VERSION` in `ui/welcome.ts`. Absent is nought, an install
   * from before the first start was more than the language. Somebody whose
   * number is lower than the app's is shown the newer screens once. About
   * this phone and what it has shown, so it stays behind in a backup.
   */
  setupSeen: 'ui:setup',
  /**
   * The last fifty things that went wrong, scrubbed of anything that could
   * be somebody's, for the report screen to show: `ErrorLog` in
   * `support/errorLog.ts`. Never sent anywhere by the app.
   */
  errorLog: 'support:errors',
  /**
   * `'false'` where the app is not to ask GitHub whether there is a newer
   * Jukebox. Anything else, and nothing at all, is yes: see
   * `support/update.ts` for what is asked, and how rarely.
   */
  updateCheck: 'support:updateCheck',
  /** What the last of those asks found and when it was made, as `UpdateKnown` in that file writes it. */
  updateKnown: 'support:updateKnown',
  /**
   * How a list written out as a playlist file names its songs: `'phone'`
   * for whole paths on the phone, `'library'` for paths from the library
   * folder down, for a computer. Absent or anything else, `'phone'`; see
   * `PathStyle` in `playlists/m3u/write.ts`. The last one chosen is offered
   * first, since somebody exporting for their PC does it again.
   */
  listFilePaths: 'lists:filePaths',
} as const;
