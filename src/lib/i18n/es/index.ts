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
 * Everything the app says, in Spanish.
 *
 * Written for Spain and readable across Latin America: "tú", never "vos" or
 * "vosotros"; Spain's spelling where the two differ ("vídeo", "melocotón"),
 * and the perfect for what just happened ("No se ha podido…"). Quotation
 * marks are «», the per cent sign follows a non-breaking space (`12 %`), and
 * a question or exclamation opens with ¿ or ¡.
 *
 * Glossary, used the same way in every file:
 *
 *   track            pista            (a file in the library; "Pistas" view)
 *   song             canción          (Discover, recap, backups)
 *   album / record   álbum / disco
 *   artist           artista
 *   library          biblioteca
 *   list             lista            (the app's own lists)
 *   playlist         playlist (la)    (only YouTube's)
 *   queue            cola
 *   play (button)    reproducir;  "playing" → sonando
 *   a play / listen  escucha          (as ListenBrainz says it in Spanish)
 *   shuffle          Aleatorio (button), mezclar (verb: "Mezclar todo")
 *   repeat           repetir
 *   tag              etiqueta;   look up → buscar (los datos)
 *   cover            portada
 *   lyrics           letra (singular, as Spanish says it)
 *   crossfade        fundido
 *   equalizer        ecualizador;  preset → preajuste;  preamp → preamplificador
 *   band / gain      banda / ganancia;  shelf → estante
 *   loudness (even)  igualar el volumen;  the phone's Loudness → realce de volumen
 *   download         descarga / descargar;  downloader → descargador
 *   Discover         Descubrir (the feature's name, capitalised)
 *   keep / exclude   guardar / descartar ("No me interesa" on the button)
 *   preview          avance
 *   theme            tema;  glass themes → temas de cristal
 *   recap            resumen;  stats → estadísticas
 *   piano tiles      piano tiles (the game's name);  key → tecla;  best run → mejor racha
 *   sleep timer      temporizador de apagado
 *   settings         ajustes
 *   backup           copia de seguridad
 *   token            token
 *   app              app
 *   Android build    versión actualizada de la app
 *   Wi-Fi            Wi-Fi (as Android writes it in Spanish)
 */
export const es: Strings = {
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
