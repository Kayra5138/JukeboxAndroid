import { backup } from './backup.ts';
import { common } from './common.ts';
import { details } from './details.ts';
import { discover } from './discover.ts';
import { format } from './format.ts';
import { languages } from './languages.ts';
import { library } from './library.ts';
import { listenbrainz } from './listenbrainz.ts';
import { lists } from './lists.ts';
import { lyrics } from './lyrics.ts';
import { nav } from './nav.ts';
import { player } from './player.ts';
import { search } from './search.ts';
import { settings } from './settings.ts';
import { sound } from './sound.ts';
import { stats } from './stats.ts';
import { themes } from './themes.ts';
import { tiles } from './tiles.ts';

/**
 * Everything the app says, in English.
 *
 * This is the table the others are held to. `Strings` is its shape, and every
 * other language is declared as one, so a line that is missing from a
 * translation, or one that is there and should not be, does not compile.
 *
 * A file to an area of the app, each a section of the table under its own
 * name, so that two people adding lines to different screens are never in the
 * same file. A line is either a plain string or a function that makes one from
 * what it is given — a whole sentence either way. A count, a name or a time
 * goes in as an argument and the language decides where it sits and what it
 * does to the words around it; nothing is ever assembled from fragments at the
 * place it is shown, because the next language will want them in another order.
 */
export const en = {
  format,
  common,
  nav,
  themes,
  languages,
  settings,
  player,
  library,
  lists,
  search,
  stats,
  details,
  sound,
  lyrics,
  discover,
  backup,
  tiles,
  listenbrainz,
};

export type Strings = typeof en;
