import { format } from './format.ts';
import { counted, plural } from './plural.ts';
import type { Strings } from '../en/index.ts';

const files = (count: number) => counted(count, 'файл', 'файла', 'файлов');
/** After «из», in the genitive: «из 1 файла», «из 5 файлов». */
const ofFiles = (count: number) => counted(count, 'файла', 'файлов', 'файлов');
const n = (count: number) => format.number(count);
/** Seconds handed over as a bare number, written with a decimal comma: «0,25». */
const secs = (value: number) => String(value).replace('.', ',');
const NB = ' ';

/** What a file's fields are called in a line that says which were written; in the nominative, after a colon. */
const FIELD_NAMES: Record<string, string> = {
  title: 'название',
  artist: 'исполнитель',
  album: 'альбом',
  albumArtist: 'исполнитель альбома',
  genre: 'жанр',
  year: 'год',
  track: 'номер трека',
  disc: 'номер диска',
  cover: 'обложка',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'Общее', tags: 'Теги', lyrics: 'Текст' },
    missing:
      'Этого трека больше нет в медиатеке. Возможно, его удалили, переместили или он оказался вне папки, которую читает Jukebox.',
    goBack: 'Назад',
  },

  lookUp: 'Найти',
  searchFailed: 'Поиск не удался.',

  general: {
    fields: {
      title: 'Название',
      artist: 'Исполнитель',
      album: 'Альбом',
      albumArtist: 'Исполнитель альбома',
      year: 'Год выпуска',
      trackNumber: 'Номер трека',
      discNumber: 'Номер диска',
    },
    notAYear: 'Это не год.',
    notAPlace: 'Целое число, от 1 и больше.',

    chooseCoverLabel: 'Выбрать обложку из галереи',
    noCover: 'Нет обложки',
    chooseFromGallery: 'Выбрать из галереи',
    removeCover: 'Убрать обложку',
    keepCover: 'Оставить прежнюю',
    coverChosen: 'Обложка выбрана. Сохрани, чтобы оставить её.',

    lookUpHint:
      'Ищет по названию и исполнителю в том виде, как они написаны ниже, и заполняет то, что найдёт: названия, альбом, год, место в альбоме и обложку.',
    nothingFound: 'По этому названию и исполнителю ничего не найдено.',
    found: (sources, withCover) =>
      `${sources.length > 1 ? 'Источники' : 'Источник'}: ${sources.join(' и ')}${
        withCover ? ', обложка тоже найдена' : ''
      }. Проверь и сохрани, чтобы оставить.`,

    discard: 'Отменить мою правку',
    saveHint:
      'Сохранённое здесь считается твоим: при повторном поиске сведений по медиатеке этот трек не будет перезаписан.',
    editGone: 'Твоя правка удалена. Поиск может снова заполнить эти поля.',

    inFile: 'В файле',
    writeLabel: 'Записать эти сведения в файл',
    writeToFile: 'Записать в файл',
    saveFirst: 'Сначала сохрани. В файл записывается только сохранённое.',
    writeHint:
      'Записывает в сам файл название, исполнителя, альбом, год, номер трека и диска ' +
      'в том виде, как их показывает медиатека, первый тег — как жанр, и сохранённую ' +
      'здесь обложку, чтобы их видели другие плееры и устройства. Android спросит ' +
      'разрешения, прежде чем что-либо изменить. Всё остальное в файле остаётся как ' +
      'есть, а текст песни не записывается.',
    cannotWrite: 'Записывать можно только в файлы MP3 и FLAC. Сведения об этом треке остаются в приложении.',
    nothingWritten: 'Ничего не записано.',
    couldNotWrite: 'Не удалось записать.',

    listening: 'Прослушивания',
    timesPlayed: 'Всего прослушиваний',
    playedToEnd: 'Дослушано до конца',
    timeSpent: 'Общее время',
    firstPlayed: 'Впервые',
    lastPlayed: 'Последний раз',
    never: 'никогда',
    listenedSeconds: (seconds) => counted(seconds, 'секунда', 'секунды', 'секунд'),
    listenedMinutes: (minutes) => counted(minutes, 'минута', 'минуты', 'минут'),
    listenedHours: (hours, minutes) => `${n(hours)}${NB}ч ${minutes}${NB}мин`,

    file: 'Файл',
    name: 'Имя',
    folder: 'Папка',
    length: 'Длительность',
    detailsFrom: 'Откуда сведения',
    unknown: 'неизвестно',
    from: {
      notLookedUp: 'поиск не выполнялся',
      yourEdit: 'твоя правка',
      notFound: 'не найдены',
      lookup: 'найдены поиском',
    },
  },

  tags: {
    lookUpHint:
      'Ищет теги для этого трека. Введённые вручную остаются; принесённые прошлым поиском заменяются найденными сейчас.',
    noneFound: 'Для этого трека теги не найдены.',
    found: (count, source) =>
      `${source}: ${counted(count, 'тег', 'тега', 'тегов')}. ${
        count === 1 ? 'Сохрани, чтобы оставить его.' : 'Расставь их по порядку и сохрани, чтобы оставить.'
      }`,
    saveHint:
      'Первый тег считается жанром. Тег, введённый вручную, считается твоим: никакой следующий поиск его не уберёт.',
  },

  editor: {
    label: 'Теги',
    add: 'Добавить тег',
    /* The tag after a colon, so that it is never declined. */
    moveUp: (tag) => `Переместить выше: ${tag}`,
    moveDown: (tag) => `Переместить ниже: ${tag}`,
    remove: (tag) => `Убрать тег: ${tag}`,
  },

  tagPrompt: {
    /* «к» takes the dative: «к 1 треку», «к 2 трекам», «к 5 трекам». */
    heading: (count) => `Добавить тег к ${counted(count, 'треку', 'трекам', 'трекам')}`,
    placeholder: 'Тег',
  },

  lyrics: {
    lookUpHint:
      'Ищет текст этого трека так же, как при воспроизведении, и заменяет сохранённый, если найдёт.',
    nothingMatched: 'Для этого трека ничего не подошло. Поиск ниже ничего не отсеивает.',
    foundAndSaved: 'Найдено и сохранено.',
    nothingCameBack: 'По этому запросу ничего не нашлось.',
    cleared: 'Удалено. Следующий поиск начнётся с нуля.',
    notSeconds: 'Это не число секунд.',

    stored: 'Сохранённый текст',
    none: 'Пока нет',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Синхронизированный текст' : 'Обычный текст'}, ${byHand ? 'выбран вручную' : 'из LRCLIB'}` +
      (lines > 0 ? ` · ${counted(lines, 'строка', 'строки', 'строк')}` : ''),
    forget: 'Забыть и поискать снова',
    saveChanges: 'Сохранить изменения',
    timedHint:
      'Перед каждой строкой стоит её время. Меняй слова, но не трогай скобки, иначе строка потеряет своё место.',
    plainHint: 'Меняй что угодно. Сохранённый текст считается твоим, и поиск его не заменит.',

    timing: 'Тайминг',
    timingHint:
      'Сдвигает все строки сразу. Пригодится, когда слова верные, но появляются раньше или позже — открой плеер и подвигай, пока не совпадут, или нажми на число и введи его. Положительный сдвиг заставляет слова появляться позже.',
    earlier: (seconds) => `−${secs(seconds)}${NB}с`,
    later: (seconds) => `+${secs(seconds)}${NB}с`,
    shiftedEarlier: (written) => `−${written}${NB}с`,
    shiftedLater: (written) => `+${written}${NB}с`,
    noShift: 'без сдвига',
    reset: 'Сбросить',
    offsetHeading: 'Насколько сдвинут текст?',
    offsetPlaceholder: 'Секунды, например 1,5 или -0,75',
    typeOffset: 'Ввести точный сдвиг',
    wordsField: 'Текст песни',

    byHand: 'Найти вручную',
    byHandHint:
      'Здесь ничего не отсеивается, в отличие от автоматического поиска: тот отбрасывает всё, что не совпадает по длительности, и поэтому для некоторых треков текст так и не находится.',
    queryPlaceholder: 'Исполнитель и название',
    candidateTimed: 'синхр.',
    candidatePlain: 'обычный',

    paste: 'Вставить',
    pasteHint: 'Принимает файл LRC или обычный текст. С метками времени текст становится синхронизированным.',
    savePasted: 'Сохранить вставленное',
  },

  library: {
    coversSaved: (count) => `Добавлено обложек альбомов: ${n(count)}.`,
    stoppedOffline: (matched) =>
      `Сервисы не ответили, и поиск остановлен. Найдено до остановки: ${n(matched)}. Для остальных ничего не записано — они ждут следующей попытки.`,
    serviceUnreachable: (service) =>
      `Не удалось связаться с ${service}, поэтому поиск продолжился без него. То, для чего он был нужен, осталось как было и будет проверено в следующий раз.`,
    stoppedUnexpectedly: 'Поиск неожиданно остановился.',

    nothingAnswered: 'Сервисы не отвечают. Поиск остановлен.',
    rateLimited: 'Один из сервисов попросил паузу. Через минуту к нему обратятся снова.',
    lookingUp: 'Поиск…',
    lookingUpProgress: (done, total) => `Поиск… готово ${n(done)} из ${counted(total, 'трека', 'треков', 'треков')}`,
    lookingUpAlbum: (album, done, total) =>
      `Поиск «${album}»… готово ${n(done)} из ${counted(total, 'трека', 'треков', 'треков')}`,
    soFar: (matched, covers) => `Пока найдено: ${n(matched)}, обложек: ${n(covers)}`,
    stop: 'Остановить',
    lookupChannel: 'Поиск сведений',

    selected: (count) => `Выбрано: ${n(count)}`,
    summary: (matched, edited, notFound, untried) =>
      [
        `Найдено: ${n(matched)}`,
        edited > 0 ? `изменено вручную: ${n(edited)}` : null,
        `не найдено: ${n(notFound)}`,
        `не проверено: ${n(untried)}`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Сбросить',
    lookUpMissing: 'Найти недостающее',
    hint: 'Нажми на трек, чтобы исправить его вручную. Проведи вниз по флажкам, чтобы выбрать несколько подряд.',
    searchPlaceholder: 'Поиск по этим трекам',

    noGenre: 'жанр не указан',
    noMatch: 'совпадений нет',
    notLookedUp: 'ещё не проверено',
    matchedSpoken: (artist, title) => `Найдено: ${artist} — ${title}`,
    manualSpoken: (artist, title) => `Указано вручную: ${artist} — ${title}`,
  },

  selection: {
    more: 'Ещё…',
    moreHint: 'Всё, что можно сделать с выбранными треками',
    heading: (count) => `Выбрано: ${counted(count, 'трек', 'трека', 'треков')}`,
    sections: { find: 'Найти', change: 'Изменить', other: 'Другое' },
    actions: {
      lookUp: {
        label: 'Найти сведения',
        hint: 'Забывает найденное для них раньше и ищет заново, вместе с обложками. Твои правки остаются.',
      },
      covers: {
        label: 'Найти обложки',
        hint: 'Только обложки — для треков без обложки. Больше ничего заново не ищется, а обложка, выбранная или убранная вручную, остаётся как есть.',
      },
      lyrics: {
        label: 'Найти тексты песен',
        hint: 'Сначала в файлах и .lrc, потом в LRCLIB. Тексты, выбранные вручную, остаются.',
      },
      edit: {
        label: 'Изменить сведения у всех сразу',
        hint: 'Исполнитель, исполнитель альбома, альбом или год — сразу для всех',
      },
      addTag: { label: 'Добавить тег', hint: 'Один тег — для всех' },
      removeTag: { label: 'Убрать тег', hint: 'Один из их тегов — убрать у всех' },
      cover: { label: 'Выбрать обложку', hint: 'Изображение из галереи — для всех' },
      write: {
        label: 'Записать в файлы',
        hint: 'Записывает сведения, которые показывает медиатека, в сами файлы. Android сначала спросит.',
      },
      addToList: { label: 'Добавить в плейлист', hint: 'Добавляет их в один из твоих плейлистов' },
      reset: {
        label: 'Сбросить',
        hint: 'Забывает то, что для них нашёл поиск. Твои правки остаются.',
      },
      delete: { label: 'Удалить с телефона', hint: 'Удаляет файлы. Android сначала спросит.' },
    },
    busy: 'Уже идёт другой поиск. Дождись его окончания или останови его.',

    editHeading: (count) => `Изменить сведения: ${counted(count, 'трек', 'трека', 'треков')}`,
    editHint:
      'Заполни только то, что должно быть одинаковым у всех. Пустое поле оставляет каждый трек как есть; чтобы очистить поле у всех, отметь пункт под ним. Названия, номера треков и дисков не меняются.',
    keepEach: 'У каждого своё',
    empty: 'Пусто',
    clearOn: { remove: 'Убрать у всех', own: 'Взять исполнителя из файла' },
    cleared: { remove: 'Будет убрано у всех', own: 'Исполнитель из файла каждого трека' },
    edited: (count) =>
      count === 1
        ? 'Сохранено. Теперь это твоя правка, и поиск её не трогает.'
        : `Сохранено. Треков: ${n(count)}. Теперь это твои правки, и поиск их не трогает.`,

    tagAdded: (tag, count) => `Тег «${tag}» теперь стоит у треков: ${n(count)}.`,
    removeTagHeading: (count) => `Убрать тег у треков: ${n(count)}`,
    tagOption: (tag, count) => `${tag} · ${n(count)}`,
    noTags: 'Ни у одного из этих треков нет тегов.',
    tagRemoved: (tag, count) => `Тег «${tag}» убран у треков: ${n(count)}.`,

    resetQuestion: (count) => `Сбросить найденное для треков: ${n(count)}?`,
    resetBody:
      'Всё, что поиск нашёл для них, забудется, и они снова будут считаться непроверенными. Твои правки остаются. Это нельзя отменить.',

    coversProgress: (done, total) =>
      `Поиск обложек… готово ${n(done)} из ${counted(total, 'трека', 'треков', 'треков')}`,
    coversNone: 'Новых обложек не найдено.',
    lyricsProgress: (done, total) =>
      `Поиск текстов… готово ${n(done)} из ${counted(total, 'трека', 'треков', 'треков')}`,
    lyricsSoFar: (found) => `Пока найдено: ${n(found)}`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0 ? `Тексты найдены: ${n(found)} из ${n(wanted)}.` : null,
        had > 0 ? `Уже были: ${n(had)}.` : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Искать нечего: тексты этих треков выбраны вручную.',
    lyricsOffline: 'LRCLIB недоступен, поэтому поиск остановлен. Остальное можно попробовать позже.',
  },

  write: {
    heading: (count) => `Записать сведения в ${files(count)}?`,
    body: (count) =>
      `${plural(count, 'Будет изменён', 'Будут изменены', 'Будет изменено')} ${files(count)}: ` +
      'название, исполнитель, альбом, год, номер трека и диска, первый тег как жанр и ' +
      'сохранённая обложка — всё, что медиатека показывает для каждого, — записываются ' +
      'в сам файл. Android попросит разрешения. Остальное содержимое файлов не меняется.',
    noneHeading: 'Ни в один из них записать нельзя',
    noneBody: 'Записывать можно только в файлы MP3 и FLAC, и не в тот трек, который сейчас играет.',
    skipping: (otherKind, playing) => {
      const others = `${plural(otherKind, 'Будет пропущен', 'Будут пропущены', 'Будет пропущено')} ${files(otherKind)} другого формата.`;
      if (otherKind > 0 && playing) return `${others} Трек, который сейчас играет, тоже будет пропущен.`;
      return otherKind > 0 ? others : 'Трек, который сейчас играет, будет пропущен.';
    },
    confirmLabel: (count) => `Записать сведения в ${files(count)}`,
    confirm: 'Записать',
    nothingWritten: 'Ничего не записано.',
    couldNotStart: 'Не удалось начать.',

    writing: 'Запись в файлы',
    progressLabel: (done, total) => `Записано ${n(done)} из ${ofFiles(total)}`,
    progress: (done, total) => `${n(done)} из ${n(total)}`,
    stopping: 'Запись остановится после этого файла.',
    keepOpen: 'Каждый файл проверяется до того, как будет изменён оригинал. Не закрывай приложение.',
    stopLabel: 'Остановиться после текущего файла',
    stop: 'Остановить',
    stoppedShort: (count) => `Остановлено. Не обработано: ${files(count)}.`,

    written: (changed) =>
      changed.length > 0
        ? `Записано: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Записано.',
    unchanged: 'Файл уже содержит всё это и оставлен без изменений.',
    skippedPlaying: 'Пропущен: трек сейчас играет. Попробуй снова, когда он перестанет играть.',
    skippedFormat: 'Пропущен: записывать можно только в файлы MP3 и FLAC.',
    failed: (reason) => `Ошибка: ${reason}`,
    noReason: 'Не удалось записать. Файл не изменён.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`Записано: ${files(counts.written)}.`);
      if (counts.unchanged > 0) parts.push(`Уже совпадали: ${files(counts.unchanged)}.`);
      if (counts.skipped > 0) parts.push(`Пропущено: ${files(counts.skipped)}.`);
      if (counts.failed > 0) parts.push(`С ошибкой: ${files(counts.failed)}.`);
      return parts.length > 0 ? parts.join(' ') : 'Записывать нечего.';
    },
  },

  same: {
    note:
      'Похоже, это одна песня в двух файлах. При объединении всё, что есть у первого файла, переносится ко второму: прослушивания, теги, текст и места в плейлистах. Если оставить их раздельно, оба останутся как есть, и об этой паре больше не спросят.',
    failed: (error) => `Не получилось, ничего не изменено. ${error}`,
    empty: 'Решать больше нечего.',
    from: 'Откуда',
    into: 'Куда',
    keepApart: 'Оставить раздельно',
    merge: 'Объединить',
    bulk: {
      mergeDelete: 'Объединить и удалить первый файл',
      deleteToo: 'Удалить и первый файл каждой пары',
      deleteNote: 'Android спросит, прежде чем что-то удалить.',
      notDeleted: 'Файлы не удалены.',
      deleted: (count) => `Удалено файлов: ${format.number(count)}.`,
      choose: 'Выбрать эту пару',
      chosen: (count) => `Выбрано пар: ${format.number(count)}`,
      merge: (count) => `Объединить: ${format.number(count)}`,
      keepApart: (count) => `Оставить раздельно: ${format.number(count)}`,
      confirm: (count) =>
        count === 1
          ? 'Объединить эту пару? Прослушивания, теги, текст и места в плейлистах первого файла перейдут ко второму, и разделить их снова будет нельзя.'
          : `Объединить выбранные пары (${format.number(count)})? В каждой прослушивания, теги, текст и места в плейлистах первого файла перейдут ко второму, и разделить их снова будет нельзя.`,
      done: (done, skipped) =>
        skipped > 0
          ? `Решено пар: ${format.number(done)}; уже решено другим ответом: ${format.number(skipped)}.`
          : `Решено пар: ${format.number(done)}.`,
    },
    unknown: 'Неизвестно',
    noFileName: 'Имя файла неизвестно',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) {
        parts.push(counted(side.listens, 'прослушивание', 'прослушивания', 'прослушиваний'));
      }
      if (side.tags > 0) parts.push(counted(side.tags, 'тег', 'тега', 'тегов'));
      if (side.lyrics) parts.push('текст');
      if (side.lists > 0) {
        /* «в» takes the prepositional: «в 1 плейлисте», «в 5 плейлистах». */
        parts.push(`в ${counted(side.lists, 'плейлисте', 'плейлистах', 'плейлистах')}`);
      }
      return parts.length > 0 ? parts.join(' · ') : 'Пока ничего';
    },
  },
};
