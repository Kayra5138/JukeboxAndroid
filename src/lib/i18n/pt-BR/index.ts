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
 * Everything the app says, in Brazilian Portuguese, addressing the user as
 * "você" with the imperative of the third person ("Toque", "Escolha").
 *
 * Declared as a `Strings`, which is the shape of the English table: a line
 * missing here, or one here that English does not have, is a type error in the
 * area file it belongs to rather than a blank on somebody's screen.
 *
 * Glossary, so that one English word is one Portuguese word everywhere:
 *
 *   track            faixa                 song               música
 *   album / record   álbum (disco: Disc N) artist             artista
 *   list (playlist)  lista                 YouTube playlist   playlist
 *   queue            fila                  library            biblioteca
 *   tag              tag (a tag, as tags)  genre              gênero
 *   cover            capa                  lyrics             letra
 *   details          detalhes              look up / lookup   consultar / consulta
 *   search           buscar / busca        find (on YouTube)  procurar
 *   play             tocar                 pause / resume     pausar / retomar
 *   listen / play (a counted one)          reprodução
 *   shuffle (mode)   aleatório             shuffle (act)      embaralhar
 *   repeat           repetir               up next            a seguir
 *   crossfade        crossfade             equalizer          equalizador
 *   preset           predefinição          band               banda
 *   preamp           pré-amplificador      loudness (effect)  loudness
 *   even loudness    volume uniforme       pitch / speed      tom / velocidade
 *   effects          efeitos               tone (section)     timbre
 *   download         download / baixar     downloader         downloader
 *   Discover         Descobrir             keep (Discover)    salvar
 *   not this song    dispensar             block artist       bloquear
 *   preview          prévia                stats              estatísticas
 *   recap            retrospectiva         streak             sequência
 *   theme            tema                  glass themes       temas de vidro
 *   custom           personalizado         accent             destaque
 *   settings (tab)   Ajustes               settings (a value) ajustes
 *   write to file    gravar no arquivo     merge              mesclar
 *   delete (a file)  excluir               remove (a row)     remover
 *   phone            celular               device             aparelho
 *   build (of app)   versão                sleep timer        timer para dormir
 *   piano tiles      piano tiles           key (in the game)  tecla
 *   folder / file    pasta / arquivo       backup             backup
 */
export const ptBR: Strings = {
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
