import { common } from './common.ts';
import { format } from './format.ts';
import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

const tracks = (count: number) => counted(count, 'трек', 'трека', 'треков');
/* «для» takes the genitive: «для 1 трека», «для 5 треков». */
const forTracks = (count: number) => counted(count, 'трека', 'треков', 'треков');
const NB = ' ';

export const library: Strings['library'] = {
  views: {
    tracks: 'Треки',
    albums: 'Альбомы',
    artists: 'Исполнители',
    folders: 'Папки',
    tapes: 'Кассеты',
  },

  tapes: {
    left: (minutes) => `осталось ${format.number(minutes)} мин`,
    played: 'Прослушано',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} мин`,
    add: 'Добавить кассеты',
    settings: 'Настройки кассет',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: 'Показать выпуски',
    hideEpisodes: 'Скрыть выпуски',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: 'О кассете',
      listening: 'Прослушивание',
      heard: 'Прослушано',
      notBegun: 'Ещё не начата',
      lastHeard: 'Последний раз',
      part: 'Часть',
      partOf: (at, of) => `${format.number(at)} из ${format.number(of)}`,
      speed: 'Скорость',
      marks: 'Закладки',
      source: 'Источник',
      from: 'Откуда',
      kinds: { youtube: 'Видео с YouTube', playlist: 'Плейлист YouTube', podcast: 'Выпуск подкаста', book: 'Книга с LibriVox', byHand: 'Положена в папку кассет вручную' },
      show: 'Передача',
      book: 'Книга',
      channel: 'Канал',
      list: 'Плейлист',
      published: 'Вышел',
      fetched: 'Загружена',
      chapters: 'Главы',
      skipped: 'Пропускается',
      skippedUnknown: 'Проверится при следующем воспроизведении',
      skippedOff: 'Выключено в настройках кассет',
      skippedTrouble: 'SponsorBlock недоступен; проверится снова при следующем воспроизведении',
      skippedNone: 'Ничего не отмечено',
      skippedSome: (count, seconds) => `${counted(count, 'часть', 'части', 'частей')} · ${format.number(seconds)} с`,
      address: 'Адрес',
      listAddress: 'Адрес плейлиста',
      openSeries: 'Открыть передачу',
      file: 'Файл',
      name: 'Имя',
      folder: 'Папка',
      format: 'Формат',
      size: 'Размер',
      megabytes: (mb) => `${format.number(mb)} МБ`,
      added: 'Появилась на телефоне',
      missing: 'Этой кассеты больше нет в медиатеке.',
    },
    seriesHeading: 'Подписки',
    singlesHeading: 'Кассеты',
    booksHeading: 'Книги',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: 'Все', series: 'Подписки', books: 'Книги', tapes: 'Кассеты' },
    seriesLine: (count, fresh) => `${counted(count, 'выпуск', 'выпуска', 'выпусков')}${fresh > 0 ? ` · новых: ${format.number(fresh)}` : ''}`,
    seriesNone: 'Выпуски ещё не скачаны',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${counted(count, 'часть', 'части', 'частей')}${fresh > 0 ? ` · не начато: ${format.number(fresh)}` : ''}`,
    count: (count) => counted(count, 'кассета', 'кассеты', 'кассет'),
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => `Выбрано: ${counted(count, 'кассета', 'кассеты', 'кассет')}`,
    empty: (folder) => `Положи аудиокниги, подкасты и длинные записи в папку Tapes внутри папки медиатеки (${folder}). Они появятся здесь, будут продолжаться с того места, где ты остановился, и не смешаются с музыкой.`,
    markPlayed: 'Отметить как прослушанное',
    markUnplayed: 'Отметить как непрослушанное',
  },

  nothingMatches: (query) => `По запросу «${query}» ничего не найдено.`,
  noAlbums:
    'Альбомов пока нет. Альбом появляется, только когда найдены сведения о его треках: папка, в которой лежит файл, альбомом не считается.',
  back: '‹ Назад',
  trackMenu: 'Действия с треком',
  albumMenu: 'Действия с альбомом',

  screen: {
    searchYouTube: (query: string) => `Искать «${query}» на YouTube`,
    viewSwitch: 'Раздел медиатеки',
    searchHints: {
      tracks: 'Треки, исполнители, теги',
      albums: 'Треки, исполнители, теги',
      artists: 'Поиск исполнителей',
      folders: 'Поиск папок',
      tapes: 'Искать кассеты, передачи и авторов',
    },
    sort: 'Порядок',
    /* The button is 56 points wide: «Недавние» is the longest that fits. */
    sortShort: { name: 'А–Я', added: 'Новые', played: 'Недавние' },
    sortedBy: {
      name: 'Сортировка по названию',
      added: 'Сортировка по дате добавления',
      played: 'Сортировка по дате последнего прослушивания',
    },
    sortHint: 'Меняет порядок в медиатеке',
    groupSortShort: { name: 'А–Я', tracks: 'Треки', played: 'Топ', added: 'Новые' },
    groupSortedBy: {
      name: 'Сортировка по названию',
      tracks: 'Сортировка по числу треков',
      played: 'Сортировка по числу прослушиваний',
      added: 'Сортировка: сначала недавно добавленные',
    },

    selectTracks: 'Выбрать треки',
    stopSelecting: 'Закончить выбор',
    /* A label and a figure, so that «выбран» never has to agree with the count. */
    selected: (count) => `Выбрано: ${tracks(count)}`,
    addToList: 'В плейлист',
    addTag: 'Добавить тег',
    writeToFiles: 'Записать в файлы',
    writeToFilesSpoken: 'Записать сведения выбранных треков в их файлы',

    swipePlayNext: 'Следующим',
    swipeQueue: 'В очередь',
    queuedAll: (count) => `Добавлено в очередь: ${common.tracks(count)}`,

    needsAccess: 'Приложению Jukebox нужен доступ к аудиофайлам на этом устройстве.',
    nothingIn: (folder) => `Папка пуста: ${folder}`,
    shuffleAll: 'Перемешать всё',
    playsEverythingBelow: 'Jukebox играет всё, что лежит в этой папке, включая вложенные папки.',
    chooseFolderInSettings: 'Выбери папку медиатеки в настройках.',

    folders: (count) => counted(count, 'папка', 'папки', 'папок'),
    noFolders: 'Ни у одного из этих треков не указано, в какой он папке.',
    shuffleTag: (tag) => `Перемешать «${tag}»`,
  },

  row: {
    opensTracks: 'Открывает треки',
    selectsTracks: 'Выбирает все треки',
    select: 'Выбрать треки',
  },

  rack: {
    open: (album) => `Открыть альбом «${album}»`,
    openHint: 'Показывает треки альбома',
    bringForward: 'Выдвигает этот альбом вперёд',
  },

  albumActions: {
    select: { label: 'Выбрать', hint: 'Его треки, а потом всё, на что ты нажмёшь' },
    rest: {
      label: 'Найти остальные треки альбома',
      hint: 'Треки альбома, которых у тебя ещё нет',
    },
    lookUp: {
      label: 'Найти сведения об альбоме',
      hint: 'Сведения и обложка — поиск сразу по всему альбому',
    },
    cover: {
      label: 'Выбрать обложку альбома',
      hint: 'Изображение из галереи — для всех его треков',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Поиск сведений об альбоме… ${format.number(done)} из ${format.number(total)}`,
    stop: 'Остановить поиск',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'Ничего нового для этого альбома не нашлось.'
        : covers === 0
          ? `Найдены сведения для ${forTracks(found)}.`
          : found === 0
            ? `Найдена обложка для ${forTracks(covers)}.`
            : `Найдены сведения для ${forTracks(found)} и обложка для ${forTracks(covers)}.`,
    offline: 'Сервисы не отвечают. Проверь подключение и попробуй ещё раз.',
    failed: 'Поиск неожиданно остановился.',
    coverChosen: (count) => `Обложка теперь стоит у треков: ${format.number(count)}.`,
  },

  rest: {
    looking: 'Поиск альбома…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) => `У тебя ${format.number(have)} из ${format.number(total)}.`,
    complete: 'У тебя есть весь альбом.',
    rivals: 'Альбомов с таким названием несколько. Этот лучше всего совпадает с твоими треками.',
    unsure:
      'Ни один из твоих треков не узнан в этом альбоме, поэтому ничего не отмечено. Сначала проверь, тот ли это альбом.',
    disc: (disc) => `Диск ${format.number(disc)}`,
    ordered: (count) => `Расставлено по порядку альбома: ${tracks(count)}.`,
    undoOrder: 'Отменить',

    lookingTube: 'Поиск на YouTube…',
    readingTube: 'Загрузка списка треков…',
    source: {
      musicbrainz: 'Список треков из MusicBrainz',
      youtube: (playlist, channel) =>
        `Список треков с YouTube: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Поискать на YouTube', musicbrainz: 'Взять из MusicBrainz' },
    onTrust:
      'Взято из альбома с таким названием на YouTube. Твоих треков из него слишком мало, чтобы сверить, так что просмотри список перед скачиванием.',
    tubeNotFound: 'Ни один плейлист на YouTube не удалось подтвердить как этот альбом.',

    ticks: 'Отмечен для скачивания',
    waiting: 'Ждёт своей очереди',
    searching: 'Поиск на YouTube…',
    noMatch: 'Подходящая запись не найдена',
    searchFailed: 'Поиск не удался',
    byHand: 'Найти вручную',
    byHandLabel: (title) => `Найти вручную: ${title}`,

    download: (count) => `Скачать ${tracks(count)}`,
    nothingTicked: 'Отметь треки для скачивания',
    stop: 'Остановить поиск',

    failed: {
      unnamed:
        'Этот альбом нельзя найти. Нужны название и исполнитель, указанный у большинства его треков.',
      notFound: 'В MusicBrainz нет альбома с таким названием у этого исполнителя.',
      offline: 'Не удалось связаться с MusicBrainz. Проверь подключение и попробуй снова.',
      throttled: 'MusicBrainz просит не спешить. Подожди минуту и попробуй снова.',
      failed: 'Не удалось найти альбом.',
      gone: 'Этого альбома больше нет в медиатеке.',
      neither:
        'Альбом не найден: в MusicBrainz его нет, и ни один плейлист на YouTube не удалось подтвердить как этот альбом.',
      tube: 'Не удалось запросить альбом у YouTube.',
      tooOld: 'Эта сборка Jukebox не умеет искать альбомы на YouTube. Установи более новую сборку для Android.',
    },
  },

  menu: {
    quickNext: 'Следующим',
    quickQueue: 'Очередь',
    quickList: 'Список',
    playNext: { label: 'Играть следующим', hint: 'Сразу после текущего трека' },
    keepListened: { label: 'Сохранить в медиатеку', hint: 'Копируется в медиатеку вместе с историей' },
    addToQueue: { label: common.addToQueue, hint: 'В конец' },
    playSimilar: { label: 'Слушать с похожими', hint: 'Сначала эта, потом подборка похожих песен' },
    playOnly: { label: 'Слушать только эту', hint: 'В очереди будет только эта песня' },
    playFromStart: { label: 'Слушать с начала', hint: 'Место, где ты остановился, забудется' },
    series: { label: 'Открыть передачу', hint: 'Её выпуски и как скачиваются новые' },
    tapeFolder: { label: 'Открыть папку', hint: 'Всё остальное в той же папке' },
    tapeDetails: { label: 'Подробности', hint: 'Сколько прослушано, откуда она и файл' },
    share: { label: 'Поделиться', hint: 'Отправляется как звук: чат проигрывает его на месте' },
    shareFile: { label: 'Отправить файлом', hint: 'Отправляется сам файл: чат сохраняет его как документ' },
    album: { label: 'Перейти к альбому', hint: 'Весь альбом, по порядку' },
    addToPlaylist: { label: 'Добавить в плейлист', hint: 'В один из твоих плейлистов или в новый' },
    favoriteAdd: { label: "В Избранное", hint: "Список, который наполняет сердечко, новые сверху" },
    favoriteRemove: { label: "Убрать из Избранного", hint: "Из списка, который наполняет сердечко" },
    tiles: { label: 'Играть в Piano Tiles', hint: 'Клавиши падают в такт этой песне' },
    details: {
      label: 'Сведения о треке',
      hint: 'Посмотреть и изменить названия, обложку, теги и текст — для каждого есть поиск',
    },
    delete: { label: 'Удалить с телефона', hint: 'Стирает сам файл, а не только эту строку' },
  },

  folders: {
    needsAccess:
      'Чтобы показать папки, приложению Jukebox нужен доступ к аудиофайлам на этом устройстве.',
    note: 'Jukebox играет всё, что лежит в выбранной папке, включая вложенные. Выбери вложенную папку, чтобы в медиатеку не попадали рингтоны и звуки игр.',
    everything: (path) => `${path}  (всё)`,
  },

  leftOut: {
    title: 'Исключённые папки',
    none: 'Нет. Отключи папки с голосовыми сообщениями, записями или рингтонами.',
    some: (count) => `Исключено из медиатеки: ${counted(count, 'папка', 'папки', 'папок')}`,
    note: 'Отключённая папка исключается из медиатеки вместе со всеми папками внутри неё. Ничего не удаляется: прослушивания, теги и места в плейлистах сохраняются и вернутся, когда папка снова будет включена.',
    within: 'Исключена вместе с папкой, в которой лежит',
    spoken: (path, count) => `${path}, ${tracks(count)}`,
    hint: 'Включена — папка в медиатеке; выключена — исключена из неё',
    empty: (root) => `В папке ${root} нет вложенных папок с музыкой.`,
  },

  shortFiles: {
    title: 'Скрывать короткие файлы',
    note: 'Убирает из медиатеки голосовые сообщения, рингтоны и звуки уведомлений по длительности. Ничего не удаляется.',
    under: (seconds) => `Короче ${format.number(seconds)}${NB}с`,
    // «короче 30 секунд»: after «короче» the count takes the genitive.
    shorterThan: (seconds) => `Короче ${counted(seconds, 'секунды', 'секунд', 'секунд')}`,
  },

  autoWrite: {
    heading: "В файлах",
    edits: { title: "Записывать сохранённое в файл", note: "Когда вы сохраняете сведения о треке, по одному или сразу для нескольких, они записываются и в файл, как кнопкой «Записать в файл». Для файлов, которые Jukebox не скачивал сам, Android сначала спрашивает." },
    lookups: { title: "Записывать найденное поиском в файл", note: "Сведения о треке, найденном поиском и не изменённом вами, записываются в файл. Загрузки Jukebox — сразу, даже в фоне. Остальные файлы ждут, и о них спрашивают вместе при следующем открытии приложения. Играющий трек ждёт следующего раза." },
  },
  copies: {
    title: 'Копии одной песни',
    some: (count) =>
      `Песен, которые есть в медиатеке больше одного раза: ${format.number(count)}`,
    review: 'Посмотреть',
    reviewHint: 'Открывает копии, чтобы выбрать, какую оставить',
    note: 'Эти файлы похожи на одну и ту же запись, сохранённую несколько раз: то же имя или тот же исполнитель и название, а длительность отличается не больше чем на две секунды. От каждой песни остаётся одна копия. Перед удалением остальных их прослушивания, теги, тексты и места в плейлистах переносятся к ней.',
    empty: 'Ни одной песни в медиатеке больше одного раза нет.',
    cleanAll: (count) => `Убрать все (${format.number(count)})`,
    confirmAll: (files, songs) =>
      `Удалить ${counted(files, 'файл', 'файла', 'файлов')}? От каждой песни (${format.number(songs)}) останется одна копия, а прослушивания, теги, тексты и места в плейлистах каждого удаляемого файла сначала перейдут к ней. Перед удалением Android спросит ещё раз.`,
    confirm: (files) => `Удалить ${counted(files, 'файл', 'файла', 'файлов')}`,
    deleteOthers: (count) =>
      count === 1 ? 'Удалить другую копию' : `Удалить остальные копии (${format.number(count)})`,
    different: 'Это разные песни',
    choose: 'Какую копию оставить',
    keepHint: 'Оставляет эту копию и удаляет остальные',
    keeps: 'Остаётся',
    goes: 'Удаляется',
    why: {
      listens: 'Предложена, потому что у неё больше всего прослушиваний.',
      described: 'Предложена, потому что у неё есть сведения или обложка.',
      folder: 'Предложена, потому что она в папке медиатеки.',
      larger: 'Предложена, потому что это файл побольше.',
      older: 'Предложена, потому что это более старый файл.',
      alike: 'Копии одинаковые, подойдёт любая.',
    },
    yourChoice: 'Останется выбранная тобой копия.',
    holds: (copy) => {
      const parts = [
        copy.listens > 0
          ? counted(copy.listens, 'прослушивание', 'прослушивания', 'прослушиваний')
          : 'нет прослушиваний',
      ];
      if (copy.described) parts.push('сведения');
      if (copy.cover) parts.push('обложка');
      if (copy.outside) parts.push('вне папки медиатеки');
      return parts.join(' · ');
    },
    deleted: (count) => `Удалено файлов: ${format.number(count)}.`,
    notDeleted: 'Файлы не удалены. Их прослушивания и всё остальное теперь у копии, которая остаётся.',
    failed: (error) => `Часть истории перенести не удалось, эти файлы не тронуты. ${error}`,
  },

  wrong: {
    title: 'Загрузки, которые могут быть не той песней',
    some: (count) =>
      `Загрузок, которые могут быть другой песней, чем говорит название: ${format.number(count)}`,
    review: 'Посмотреть',
    reviewHint: 'Открывает эти загрузки, чтобы исправить каждую',
    note: 'Каждая из них была скачана как определённая песня и получила её название, но видео, из которого она взята, называется иначе, так что это может быть другая песня. Включи её, чтобы услышать, а потом дай ей название видео, удали или подтверди, что всё верно. Пока ты не выберешь, ничего не меняется.',
    empty: 'Ни одна загрузка не похожа на не ту песню.',
    filedAs: 'Сохранено как',
    videoWas: 'Видео называлось',
    facts: (length, listens) =>
      `${length} · ${listens > 0 ? counted(listens, 'прослушивание', 'прослушивания', 'прослушиваний') : 'не прослушивалась'}`,
    playHint: 'Включает этот файл',
    rename: 'Назвать как есть',
    delete: 'Удалить',
    right: 'Всё верно',
    sheetNote: 'Взято из названия видео. Измени, если оно не совсем точное. Сохраняется как твоя правка, которую поиск не перезапишет.',
    titleField: 'Название',
    artistField: 'Исполнитель',
    renamed: (title) => `Переименовано в «${title}».`,
    deleted: 'Удалено.',
    notDeleted: 'Файл не удалён.',
    keptRight: 'Оставлено как есть. Больше не спросим.',
    failed: (error) => `Не получилось. ${error}`,
  },
};
