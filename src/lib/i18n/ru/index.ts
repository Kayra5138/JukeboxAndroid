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
  Everything the app says, in Russian.

  Address: «ты», as music apps commonly do — «Выбери папку», «твоя медиатека».
  A sentence never puts «ты» with a verb in the past tense, which would have
  to say whether the listener is a man or a woman («ты слушал/слушала»); the
  music or the file is made the subject instead, or the present is used. The
  app names its own work in progress with a noun, as Russian interfaces do,
  never in the first person: «Поиск на YouTube…», «Сохранение в медиатеку…».

  Typography: «ёлочки» for quotes, — for a dash, ё written throughout, a
  no-break space in numbers («12 345») and before short units («4 ч», «20 мс»).
  A count is followed by the noun in the form `plural.ts` chooses; where a
  verb or participle would also have to agree with it, the count is put after
  a label and a colon instead («Выбрано: 3 трека»). A name from the library
  (artist, title, list, tag) is never declined: it follows a colon, «как», or
  a noun it stands beside («плейлист «…»», «аккаунт …»).

  Glossary
    track                     трек
    song                      песня
    album                     альбом
    artist                    исполнитель
    record (as an album)      альбом / запись (a recording)
    queue                     очередь
    list, playlist            плейлист (the Lists tab: «Плейлисты»)
    Discover                  «Открытия»; its list is «подборка»
    Keep (Discover)           Сохранить (в медиатеку)
    Not this song (exclude)   Не предлагать; excluded songs: «убранные»
    library                   медиатека
    library view              раздел медиатеки
    folder                    папка
    tag                       тег
    genre                     жанр
    cover                     обложка
    lyrics                    текст песни, текст
    details (of a track)      сведения
    look up                   найти (сведения); lookup — поиск
    write to file             записать в файл
    listen (a play recorded)  прослушивание
    play (button)             Слушать
    shuffle                   перемешать
    repeat                    повтор
    crossfade                 плавный переход
    equalizer, band, preset   эквалайзер, полоса, пресет
    preamp                    предусиление
    clip (distort)            перегрузка, перегружаться
    crossfeed                 кроссфид
    pitch                     высота тона
    download (noun / verb)    загрузка, «Загрузки» (the screen) / скачать
    downloader (yt-dlp)       загрузчик YouTube
    preview (Deezer, 30 s)    превью
    sleep timer               таймер сна
    theme                     тема
    stats                     статистика
    recap                     итоги
    piano tiles               Piano Tiles (the game's own name); key — клавиша
    backup                    резервная копия
    merge                     объединить
    token (ListenBrainz)      токен
    build (of the app)        сборка
*/
export const ru: Strings = {
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
