import type { Strings } from '../en/index.ts';
import { backup } from './backup.ts';
import { common } from './common.ts';
import { details } from './details.ts';
import { discover } from './discover.ts';
import { downloads } from './downloads.ts';
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
import { support } from './support.ts';
import { themes } from './themes.ts';
import { tiles } from './tiles.ts';
import { welcome } from './welcome.ts';

/**
 * Everything the app says, in French.
 *
 * Declared as a `Strings`, which is the shape of the English table: a line
 * missing here, or one here that English does not have, is a type error in the
 * area file it belongs to rather than a blank on somebody's screen.
 *
 * Written with « tu », as casual apps are, and in words shared by France and
 * Canada wherever there is a choice. Typography is French: a narrow no-break
 * space (U+202F) before ; ! ? and inside « », a no-break space (U+00A0)
 * before : and between a number and its unit, and the apostrophe ’.
 * Counts go through `one` in `grammar.ts`, since French says « 0 titre ».
 *
 * Glossary, kept to everywhere:
 *   track            titre (« morceau » where English says song)
 *   song             morceau
 *   album / artist   album / artiste
 *   record           disque
 *   queue            file d’attente
 *   list             liste (the app's own); playlist only for YouTube's
 *   library          bibliothèque
 *   tag              tag (taguer, tagué)
 *   genre            genre
 *   cover            pochette
 *   lyrics           paroles
 *   crossfade        fondu enchaîné
 *   equalizer        égaliseur; band = bande; preset = préréglage
 *   preamp           préampli
 *   pitch            tonalité; speed = vitesse
 *   tone (section)   timbre
 *   effects          effets
 *   download         télécharger, téléchargement
 *   Discover         Découvrir (a name, used without article)
 *   shuffle          aléatoire (mode, chip); mélanger (the action)
 *   repeat           répéter
 *   play / pause     lire / pause
 *   play next        lire ensuite
 *   listen (a play)  écoute
 *   look up          rechercher (les infos); lookup = recherche
 *   details          infos
 *   write to file    écrire dans le fichier
 *   theme            thème; glass = verre
 *   recap            bilan
 *   stats            stats
 *   piano tiles      piano tiles (the game's own name); key = touche
 *   sleep timer      minuteur de veille
 *   settings         paramètres (the tab and its pages); réglage = one setting
 *   backup           sauvegarde; import = importer; merge = fusionner
 *   keep (Discover)  garder; exclude = exclure; block = bloquer
 *   preview          extrait
 *   user token       jeton utilisateur
 *   updated build    version Android à jour
 */
export const fr: Strings = {
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
  downloads,
  stats,
  details,
  sound,
  lyrics,
  discover,
  backup,
  tiles,
  listenbrainz,
  welcome,
  support,
};
