import { format } from './format.ts';
import { counted, plural } from './plural.ts';
import type { Strings } from '../en/index.ts';

const tracks = (count: number) => counted(count, 'трек', 'трека', 'треков');

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Название плейлиста',
    placeholder: 'Название',
    create: 'Создать',
  },

  screen: {
    newList: 'Новый плейлист',
    fromTag: 'Из тега',
    empty: 'Пока пусто. Плейлист — это порядок, который выбираешь ты, а как раз его теги и не умеют хранить.',
    followingTag: (count, tag) => `${tracks(count)} · по тегу «${tag}»`,
    fromListening: 'По твоим прослушиваниям',
    discover: 'Открытия',
    discoverHint: 'Музыка, которой у тебя нет, по тому, что ты слушаешь',

    tagSheet: {
      heading: 'Плейлист из тега',
      follows: 'Следит за тегом',
      copy: 'Копия',
      followsHint:
        'Всегда содержит всё, у чего есть этот тег. Отметишь что-то тегом позже — оно появится здесь; порядок менять и убирать треки нельзя.',
      copyHint:
        'Берёт всё, у чего есть этот тег сейчас. Дальше плейлист и тег живут каждый своей жизнью, и порядок в плейлисте — твой.',
      noTags: 'Тегов пока нет. Сначала найди сведения о нескольких треках.',
    },
  },

  auto: {
    mostPlayed: { name: 'Чаще всего', hint: 'То, к чему ты возвращаешься снова и снова' },
    recentlyFound: { name: 'Новое в этом месяце', hint: 'Впервые прозвучало с начала месяца' },
    forgotten: { name: 'Забытое', hint: 'Когда-то звучало часто, а последние полгода — нет' },
    skipped: { name: 'Чаще пропускаешь', hint: 'То, что ты раз за разом переключаешь' },
  },

  picker: {
    /* Over the lists, which finish the sentence in the accusative: «Добавить 2 трека в» + a list. */
    heading: (count) => `Добавить ${format.number(count)} ${plural(count, 'трек', 'трека', 'треков')} в`,
    noLists: 'Плейлистов пока нет.',
    newList: 'Новый плейлист…',
    already: (list) => `Уже в плейлисте «${list}»`,
    added: (count, list) => `Добавлено в «${list}»: ${tracks(count)}`,
  },

  trackPicker: {
    heading: 'Добавить треки',
    search: 'Поиск в медиатеке',
    alreadyHere: 'Уже в этом плейлисте',
    add: (count) => `Добавить ${tracks(count)}`,
  },

  list: {
    album: 'Альбом',
    artist: 'Исполнитель',
    folder: 'Папка',
    list: 'Плейлист',

    everythingTagged: (tag) => `Всё с тегом «${tag}» на данный момент`,
    /* With «нет» the count would have to go into the genitive; a label keeps it nominative. */
    away: (count) => `Сейчас вне медиатеки: ещё ${tracks(count)}`,

    addTracks: 'Добавить треки',
    cover: 'Обложка',
    deleteList: 'Удалить плейлист',

    albums: 'Альбомы',
    tracks: 'Треки',
    opensAlbum: 'Открывает альбом',

    empty: {
      editable: 'Здесь пока пусто. Добавь треки кнопкой выше или отправь их сюда из медиатеки.',
      tag: 'Пока ни у чего нет этого тега. Добавь его к нескольким трекам, и они появятся здесь.',
      album: 'Этого альбома больше нет в медиатеке.',
      artist: 'В медиатеке больше нет ничего этого исполнителя.',
      folder: 'В этой папке больше ничего нет.',
      auto: 'Сюда пока ничего не подходит. Сначала послушай что-нибудь.',
    },

    mightBelong: 'Может подойти',
    mightBelongHint:
      'Подобрано по тегам, на которых держится плейлист; редкий тег весит больше, чем тег, который есть у половины медиатеки.',

    choosePicture: 'Выбрать изображение…',
    firstFour: 'Первые четыре обложки',

    renameHeading: 'Переименовать плейлист',
    deleteQuestion: (name) => `Удалить плейлист «${name}»?`,
    deleteHint: 'Удалится только плейлист. Треки останутся на телефоне.',
  },

  files: {
    importFiles: 'Импортировать плейлисты M3U…',
    exportAll: 'Экспортировать все плейлисты…',
    export: 'Экспорт…',
    untitled: 'Импортированный плейлист',
    reading: 'Чтение плейлистов…',

    conflict: {
      heading: (name) => `Плейлист «${name}» уже есть`,
      hint: 'Файл может занять его место, сохранив обложку, или добавиться отдельным плейлистом.',
      replace: 'Заменить',
      keepBoth: (name) => `Добавить как «${name}»`,
      skip: 'Пропустить этот файл',
    },

    result: {
      heading: 'Импортировано',
      imported: (name, found, total) =>
        `Плейлист «${name}» импортирован: найдено ${format.number(found)} из ${format.number(total)}`,
      repeated: (count) =>
        count === 1
          ? 'Один трек был в файле дважды; в плейлисте он будет один раз.'
          : `Повторы в файле: ${tracks(count)}; в плейлисте каждый будет один раз.`,
      showMissing: (count) => `Показать ненайденные (${format.number(count)})`,
      hideMissing: 'Скрыть',
      reasons: {
        notFound: 'В медиатеке ничего не подходит',
        ambiguous: 'Подходит больше одного трека',
        web: 'Веб-адрес, а не файл',
      },
      tooBig: (file) => `Файл ${file} слишком большой для плейлиста.`,
      unreadable: (file) => `Не удалось прочитать файл ${file} как плейлист.`,
      empty: (file) => `В файле ${file} ничего нет.`,
      skipped: (file) => `Файл ${file} пропущен.`,
      encoding: (encoding) => `Прочитан в кодировке ${encoding}`,
      open: 'Открыть',
    },

    exportSheet: {
      heading: 'Экспорт в файл M3U',
      headingAll: 'Экспортировать все плейлисты',
      phone: 'Пути на телефоне',
      phoneHint:
        'Полные пути вида /storage/emulated/0/Music/…, которые понимают другие плееры на этом телефоне, куда бы ни положить файл.',
      library: 'От папки медиатеки',
      libraryHint:
        'Пути, начинающиеся внутри папки медиатеки, — для компьютера с той же музыкой. Положи файл в самый верх этой папки.',
      save: 'Сохранить…',
      chooseFolder: 'Выбрать папку…',
      allHint:
        'По файлу .m3u8 на каждый твой плейлист в выбранной папке. Файл с тем же именем, если он там уже есть, будет заменён.',
    },

    saved: (name) => `Плейлист «${name}» сохранён как файл M3U`,
    savedAll: (count, folder) => `Сохранено в папку ${folder}: ${counted(count, 'плейлист', 'плейлиста', 'плейлистов')}`,
    notSaved: (names) => `Не сохранено: ${names}`,
    leftOut: (count) =>
      `Не вошло: ${tracks(count)} — сейчас ${count === 1 ? 'его нет' : 'их нет'} в папке медиатеки.`,
    failed: (reason) => `Не получилось: ${reason}`,
  },
};
