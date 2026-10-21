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

/*
  Glossary, for whoever checks or extends this. The user is addressed with
  "du", as most German apps do now; imperatives drop the -e ("versuch es
  erneut", "hör", "schick").

  track ............ Titel (plural Titel; dative plural Titeln)
  song ............. Song, Songs
  album ............ Album, Alben
  artist ........... Künstler (plural Künstler; dative plural Künstlern)
  queue ............ Warteschlange; "up next" Als Nächstes; queue (verb) einreihen
  list (user's) .... Liste, Listen
  playlist (YouTube) Playlist, Playlists
  library .......... Bibliothek
  library folder ... Bibliotheksordner
  folder ........... Ordner
  file ............. Datei, Dateien
  tag .............. Tag, Tags (der Tag)
  cover ............ Cover
  lyrics ........... Songtext, Songtexte
  timed lyrics ..... synchronisiert
  look up / lookup . nachschlagen / Nachschlagen (as MusicBrainz Picard's German has it)
  matched .......... zugeordnet
  details .......... Details
  listen / play (n.) Wiedergabe, Wiedergaben (one word for both: a recorded play)
  listening history  Hörverlauf
  crossfade ........ Überblenden
  transition ....... Übergang
  equalizer ........ Equalizer
  preset ........... Preset (equalizer), Voreinstellung avoided as too long
  band ............. Band, Bänder
  preamp ........... Vorverstärkung
  gain ............. Verstärkung
  clip ............. übersteuern
  flat (curve) ..... linear
  loudness (effect)  Lautheit
  even loudness .... Lautstärke angleichen
  effects .......... Effekte
  speed / pitch .... Tempo / Tonhöhe
  download ......... Download, herunterladen (short: laden)
  Discover ......... Entdecken
  keep (Discover) .. behalten
  exclude .......... ablehnen
  block / unblock .. sperren / entsperren
  preview .......... Vorschau
  shuffle .......... zufällig (button "Zufällig"); shuffle the queue: mischen
  repeat ........... wiederholen
  sleep timer ...... Sleep-Timer
  theme ............ Design (as Android's German calls it)
  custom theme ..... eigenes Design; the theme named "Custom" is "Eigenes"
  glass themes ..... Glas
  recap ............ Rückblick
  stats ............ Statistik
  streak ........... Serie
  piano tiles ...... Piano Tiles (the game's own name); key Taste
  backup ........... Backup; import / export importieren / exportieren
  merge ............ zusammenführen
  phone ............ Gerät (as Android's German says it)
  Wi-Fi ............ WLAN
  install the updated Android build ... Installiere die aktualisierte Android-Version
  token ............ das Token
  Brand names are kept: Jukebox, YouTube, MusicBrainz, ListenBrainz, LRCLIB,
  Deezer, AutoEQ, yt-dlp, GitHub, MP3, FLAC.

  Typography: „…“ quotes; a narrow no-break space before % and units
  (`12 %`, `4 h 12 min`, `2,5 s`); a decimal comma; dates as `23.09.2026`.
*/

/**
 * Everything the app says, in German.
 *
 * Declared as a `Strings`, which is the shape of the English table: a line
 * missing here, or one here that English does not have, is a type error in the
 * area file it belongs to rather than a blank on somebody's screen.
 */
export const de: Strings = {
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
