import { format } from './format.ts';
import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Открытия',
    download: 'Скачать',
    videos: 'Видео',
    playlists: 'Плейлисты',
  },

  tapes: {
    intro:
      'Аудиокниги, подкасты, лекции и длинные записи с YouTube: скачиваются в папку Tapes твоей медиатеки и продолжаются с того места, где ты остановился. Найди или вставь ссылку на видео или плейлист — или на канал, чтобы подписаться на него.',
    placeholder: { videos: 'Название, передача или ссылка на YouTube', playlist: 'Книга, серия или ссылка на плейлист' },
    empty: { videos: 'Найди книгу, передачу, выступление или лекцию.', playlist: 'Найди плейлист, чтобы скачать его как одну кассету: книгу по частям или сезон передачи.' },
    downloadBook: (count) => `Скачать все (${format.number(count)}) как одну кассету`,
    bookHint: 'Они попадут в одну папку с названием плейлиста, пронумерованные по порядку, и будут играть друг за другом.',
    added: (name) => `Скачивается в Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: 'Подписаться', books: 'Книги', files: 'Телефон' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Книги, записи и лекции, которые уже есть на телефоне, копируются в папку ваших кассет. Выбранные файлы остаются на месте.',
      choose: 'Выбрать файлы',
      chooseOther: 'Выбрать другие файлы',
      folder: 'Имя папки',
      folderPlaceholder: 'Как называется книга или запись',
      folderNote: 'Они попадут в папку кассет медиатеки под этим именем, по порядку номеров.',
      copy: (count) => count === 1 ? 'Скопировать в кассеты' : `Скопировать в кассеты: ${format.number(count)}`,
      chosen: (count) => `Выбрано: ${counted(count, 'файл', 'файла', 'файлов')}`,
      copied: (done, of) => done === of ? `Скопировано в кассеты: ${counted(done, 'файл', 'файла', 'файлов')}.` : `Скопировано ${format.number(done)} из ${format.number(of)}; остальные не удалось прочитать.`,
      failed: 'Ни один файл не удалось скопировать.',
      pickFailed: 'Не удалось выбрать файлы.',
      toTapes: 'К кассетам',
    },
    books: {
      intro: 'Книги, перешедшие в общественное достояние, прочитанные вслух волонтёрами LibriVox и бесплатно хранящиеся в Internet Archive. Ищите по названию или автору или вставьте адрес записи на archive.org.',
      placeholder: 'Название, автор или ссылка на archive.org',
      nothingFound: 'Книги не найдены.',
      searchFailed: 'Не удалось выполнить поиск в Internet Archive.',
      anyLanguage: 'Все языки',
      popular: 'Самые слушаемые',
      bookFailed: 'Не удалось прочитать эту книгу из Internet Archive.',
      stats: (parts, minutes, here) => `${counted(parts, 'часть', 'части', 'частей')} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} ч ${format.number(minutes % 60)} мин` : `${format.number(minutes)} мин`}${here > 0 ? ` · на телефоне: ${format.number(here)}` : ''}`,
      fetchAll: 'Загрузить всю книгу',
      fetchRest: (count) => count === 1 ? 'Загрузить последнюю часть' : `Загрузить остальные: ${format.number(count)}`,
      size: (mb) => `Всего около ${format.number(mb)} МБ`,
      parts: (count) => counted(count, 'часть', 'части', 'частей'),
    },
    podcasts: {
      intro: 'Подпишитесь на подкаст или канал YouTube, и новые выпуски сами появятся в кассетах, — или откройте его и загрузите только нужные выпуски. Найдите или вставьте адрес ленты или канала.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'Чтобы слушать, подписываться не нужно: загрузите любой выпуск ниже. С подпиской новые придут сами.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Передача',
      sources: 'Откуда: любая передача из каталога подкастов Apple, где есть почти все подкасты с открытой лентой, включая большинство из Spotify; любой адрес ленты — с Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud и других; и каналы YouTube.',
      placeholder: 'Подкаст, канал или ссылка',
      searchFailed: 'Не удалось найти подкасты. Проверь подключение.',
      feedFailed: 'Не удалось прочитать ленту этого подкаста.',
      /** A feed asked for by a link from outside the app, before it is read: where it is, and whether to. */
      linkAsk: 'Открыть ленту по ссылке?',
      linkAskBody: (host: string) => `Ссылка просит прочитать ленту подкаста по адресу ${host}. Открывайте, только если доверяете источнику ссылки.`,
      linkOpen: 'Открыть',
      linkRefused: 'Эта ссылка указывает на адрес на этом телефоне или в вашей собственной сети, который ссылкам читать нельзя.',
      notChannel: 'Это не адрес канала YouTube, или канал не найден.',
      channelsHeading: 'Каналы YouTube',
      podcastsHeading: 'Подкасты',
      subscribers: (count) => counted(count, 'подписчик', 'подписчика', 'подписчиков'),
      channelsFailed: 'Не удалось найти каналы на YouTube.',
      nothingFound: 'Подкасты не найдены.',
      yours: 'Твои подкасты',
      noneYet: 'Ты пока не подписан ни на один подкаст.',
      wifiOnly: 'Новые выпуски только по Wi‑Fi',
      wifiOnlyNote: 'Выпуски подкастов, на которые ты подписан, сами скачиваются только по Wi‑Fi. Любой выпуск можно скачать вручную.',
      follow: 'Подписаться',
      following: 'Ты подписан',
      unfollow: 'Отписаться',
      autoDownload: 'Скачивать новейшие выпуски',
      autoDownloadNote: (keep) => keep === 1 ? 'Последний выпуск остаётся скачанным.' : `Последние ${counted(keep, 'выпуск', 'выпуска', 'выпусков')} остаются скачанными.`,
      keep: (count) => format.number(count),
      episodes: (count) => `Выпуски · ${format.number(count)}`,
      noEpisodes: 'В этой ленте нет выпусков с файлом.',
      download: 'Скачать',
      /** The button on an episode or a part, read aloud with what it fetches, in the order the language puts them. */
      downloadNamed: (title: string) => `Скачать ${title}`,
      continue: 'Продолжить',
      start: 'Начать',
      more: 'Ещё',
      less: 'Свернуть',
      stats: (total, here) => `${counted(total, 'выпуск', 'выпуска', 'выпусков')} · на телефоне: ${format.number(here)}`,
      play: 'Слушать',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Период', all: 'Все', week: 'За неделю', month: 'За месяц', quarter: 'За 3 месяца' },
      newest: 'Сначала новые',
      oldest: 'Сначала старые',
      noneThen: 'За это время выпусков нет.',
      fetchNext: 'Загружать следующие выпуски',
      fetchNextNote: (count) =>
        count === 1 ? 'Пока вы слушаете старый выпуск, загружается следующий, чтобы он был готов, когда этот закончится.' : `Пока вы слушаете старый выпуск, загружаются ${counted(count, 'следующий', 'следующих', 'следующих')}, чтобы очередной был готов к концу каждого.`,
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
  },
  unavailable: {
    heading: 'Для YouTube нужна новая сборка',
    body: 'Чтобы искать и скачивать музыку, установи обновлённую версию для Android. Медиатека по-прежнему доступна.',
    downloads: 'Чтобы скачивать с YouTube, установи новую сборку для Android.',
  },

  intro: {
    videos: 'Ищи на YouTube или вставь ссылку на видео. Звук сохранится в медиатеку.',
    playlist:
      'Найди плейлист или вставь ссылку на него с YouTube. Открой результат, чтобы просмотреть и скачать треки. Проверяются первые 500 записей плейлиста.',
  },
  inputLabel: {
    videos: 'Поиск на YouTube или ссылка на видео',
    playlist: 'Название плейлиста или ссылка на YouTube',
  },
  placeholder: {
    videos: 'Песня, исполнитель или ссылка',
    playlist: 'Название плейлиста или ссылка',
  },

  formats: { mp3: 'MP3', original: 'Исходный звук' },
  formatHint: {
    mp3: 'После скачивания конвертируется в MP3.',
    original: 'По возможности сохраняет исходный аудиокодек.',
  },

  searching: 'Поиск на YouTube…',
  results: (count) => `Результаты · ${format.number(count)}`,
  empty: {
    none: 'Ничего не найдено. Попробуй другой запрос или ссылку.',
    videos: 'Ищи по названию песни и исполнителю, чтобы найти нужную запись.',
    playlist: 'Ищи по названию плейлиста или вставь ссылку на него.',
  },

  playlist: 'Плейлист',
  backToResults: 'Назад к результатам',
  openPlaylistLabel: (title) => `Открыть плейлист «${title}»`,
  downloadLabel: (title) => `Скачать: ${title}`,
  adding: 'Добавление…',
  listenLabel: (title) => `Послушать «${title}», не сохраняя`,
  readying: 'Готовится…',
  listenDrop: 'Не сохранять',

  addingPlaylist: 'Добавление плейлиста…',
  downloadListed: {
    mp3: 'Скачать треки из списка · MP3',
    original: 'Скачать треки из списка · исходный звук',
  },
  listedHint:
    'Уже скачанные треки и треки в очереди пропускаются. Личные, удалённые видео и трансляции могут быть недоступны.',
  listCreated: (name) => `Плейлист «${name}» создан. Скачанные треки появятся в разделе «Плейлисты».`,
  inLibrary: 'В медиатеке',
  alreadyHave: (count) => `Уже были в медиатеке и не скачивались заново: ${format.number(count)}.`,
  unnamedPlaylist: 'Плейлист YouTube',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Исходный'}`,

  status: {
    finding: 'Поиск на YouTube',
    queued: 'В очереди',
    preparing: 'Подготовка…',
    downloading: (percent) => `Скачивание · ${percent}%`,
    converting: 'Конвертация звука…',
    saving: 'Добавление в медиатеку…',
    cancelling: 'Отмена…',
    cancelled: 'Отменено',
    failed: 'Не удалось скачать',
    done: 'В медиатеке',
    listened: 'Готово, не сохранено',
    missing: 'Файл удалён',
  },

  failed: {
    search: 'Поиск не удался. Попробуй ещё раз.',
    queue: 'Не удалось поставить загрузку в очередь.',
    queuePlaylist: 'Не удалось поставить плейлист в очередь.',
    cancel: 'Не удалось отменить загрузку.',
    read: 'Не удалось прочитать список загрузок.',
    readReopen: 'Не удалось прочитать список загрузок. Открой «Поиск» заново.',
  },

  errors: {
    playlistLink: 'Вставь ссылку на плейлист YouTube или ищи по названию плейлиста.',
    videoLink: 'Введи название песни или правильную ссылку на видео YouTube.',
    queueFull: 'Очередь загрузок заполнена. Подожди, пока часть треков скачается, и попробуй снова.',
    update: 'YouTube изменился, и загрузчик в этой версии пока не может с ним работать. Проверь, нет ли новой версии, в разделе «Загрузки» или обнови Jukebox.',
    unavailable: 'Это видео или плейлист недоступны. Попробуй другой общедоступный плейлист или другой запрос.',
    unreachable: 'Не удалось связаться с YouTube. Проверь подключение и попробуй снова.',
    refused: 'YouTube не смог выполнить этот запрос. Попробуй позже или выбери другой результат.',
  },
};
