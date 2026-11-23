import { format } from './format.ts';
import { plural } from './plural.ts';
import type { Strings } from '../en/index.ts';

/** After «на» and «через» the count is in the accusative: «на 1 секунду», «через 21 минуту». */
const seconds = (count: number) => `${count} ${plural(count, 'секунду', 'секунды', 'секунд')}`;
const minutes = (count: number) => `${count} ${plural(count, 'минуту', 'минуты', 'минут')}`;

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Открывает плеер',
    upNext: (title: string) => `Далее: ${title}`,
    lastInQueue: 'Последний в очереди',
    timeLeft: (clock: string) => `Осталось ${clock}`,
  },
  sheet: {
    nothingPlaying: 'Ничего не играет.',
    heart: "В избранном",
    repeat: { off: 'Повтор', all: 'Повторять все', one: 'Повторять трек' },
    back: (count) => `Назад на ${seconds(count)}`,
    forward: (count) => `Вперёд на ${seconds(count)}`,
    shuffleQueue: 'Перемешать очередь',
    playbackSettings: 'Настройки воспроизведения',
    lyrics: 'Текст песни',
    translateLyrics: 'Перевести текст',
    upNext: (count) => `Далее · ${format.number(count)}`,
    position: 'Позиция воспроизведения',
    positionValue: (position, duration) => `${position} из ${duration}`,
  },
  tape: {
    part: (at, of) => `Часть ${format.number(at)} из ${format.number(of)}`,
    /** For an episode of a followed show, in place of `part`. */
    episode: (at, of) => `Выпуск ${format.number(at)} из ${format.number(of)}`,
    previousPart: 'Предыдущая часть',
    nextPart: 'Следующая часть',
    parts: (count) => `Части · ${format.number(count)}`,
    book: (percent, left) => `${format.number(percent)}% целого · осталось ${left}`,
    speed: (speed) => `Скорость ${speed}, нажми для следующей`,
    sleep: 'Таймер сна',
  },
  queue: {
    /* The title stays in the nominative after the colon: a name cannot be declined. */
    remove: (title) => `Убрать из очереди: ${title}`,
    movedTo: (position, count) => `Теперь на месте ${format.number(position)} из ${format.number(count)}`,
    auto: {
      library: 'Похожие песни · подобраны для тебя',
      fresh: 'Новые песни · из «Открытий»',
      mixed: 'Похожие и новые · подобраны для тебя',
      remove: 'Убрать',
      removeLabel: 'Убрать песни, подобранные для тебя',
      removeHint: 'Новые не добавятся в эту очередь, пока ты не включишь что-то другое.',
      notes: {
        offline: 'Нет подключения, поэтому это песни из медиатеки.',
        wifi: '«Открытия» ждут Wi-Fi, поэтому это песни из медиатеки.',
        unavailable: 'Для новых песен нужен загрузчик YouTube, поэтому это песни из медиатеки.',
        waiting: 'Новые песни ещё загружаются; пока играют песни из медиатеки.',
        random: 'Об этой песне известно слишком мало, поэтому часть выбрана из медиатеки случайно.',
      },
    },
  },
  settings: {
    tabs: { sound: 'Звук', look: 'Вид', sleep: 'Сон' },
    moreEffects: 'Ещё',
    fewerEffects: 'Меньше',
    playback: 'Воспроизведение',
    backToNormal: 'Вернуть обычные скорость и высоту тона',
    /* Both скорость and высота are feminine, so one word serves for either. */
    normal: 'Обычная',
    speed: 'Скорость',
    pitch: 'Высота тона',
    pitchHint: 'В полутонах, вверх или вниз; запись при этом играет со скоростью, заданной выше.',
    effects: 'Эффекты',
    equalizer: { note: 'Полосы, бас и усиление громкости' },
    allEffects: { title: 'Все эффекты', note: 'Ширина, кроссфид, вращение и уровень' },
    jumps: {
      heading: 'Перемотка для этой книги или передачи',
      general: 'Общая',
      backToGeneral: 'Вернуть перемотку всех кассет',
      back: 'Назад на',
      forward: 'Вперёд на',
      note: 'В секундах, только для этой книги или передачи, в том числе с гарнитуры, из уведомления и в машине. Остальные кассеты перематываются как в настройках кассет.',
    },
  },
  sleepTimer: {
    title: 'Таймер сна',
    cancel: 'Отменить таймер сна',
    unsupported: 'Чтобы пользоваться таймером сна, установи обновлённую сборку для Android.',
    about: 'Ставит музыку на паузу через заданное время. Последние полминуты звук постепенно стихает.',
    pauseAfter: (count) => `Пауза через ${minutes(count)}`,
    pauseAfterTyped: 'Пауза через указанное число минут',
    custom: 'Своё…',
    pauseAtEnd: 'Пауза в конце этого трека',
    endOfTrack: 'Конец трека',
    finish: {
      title: 'Доиграть текущий трек',
      note: 'Когда время выйдет, дождаться конца песни, а не приглушать её.',
      label: 'Доиграть текущий трек, когда таймер сна истечёт',
    },
    shake: {
      title: 'Встряхнуть — ещё десять минут',
      note: 'В последние три минуты встряхни телефон, чтобы добавить десять минут, даже с выключенным экраном. Короткая вибрация подтвердит.',
      label: 'Встряхни телефон в последние три минуты, чтобы добавить к таймеру сна десять минут',
    },
    refused: (most) => `Целое число минут, от 1 до ${most}`,
    howMany: 'Через сколько минут поставить на паузу?',
    minutes: 'Минуты',
    start: 'Запустить',
    tape: {
      about: 'Ставит на паузу через заданное время. Последние полминуты звук постепенно стихает.',
      pauseAtEnd: 'Пауза в конце этой части',
      endOfTrack: 'Конец части',
      finish: {
        title: 'Доиграть текущую часть',
        note: 'Когда время выйдет, дождаться конца части, а не приглушать её.',
        label: 'Доиграть текущую часть, когда таймер сна истечёт',
      },
    },
  },
  /** Places marked in a tape, each with a note: see `tapes/marks.ts`, `MarksSheet` and the Marks screen. */
  /** A tape's chapters: see `tapes/extras.ts` and `ChaptersSheet`. */
  /** A tape's captions, shown as a song's words are. */
  transcript: {
    heading: 'Текст',
    show: 'Показать, что говорится',
    none: 'У этого видео нет субтитров.',
  },
  chapters: {
    heading: (count) => `Главы · ${format.number(count)}`,
    untitled: (at) => `Глава ${format.number(at)}`,
    at: (at, of) => `Глава ${format.number(at)} из ${format.number(of)}`,
    sleepAtEnd: 'Остановить в конце этой главы',
    listHint: 'Показывает список глав',
  },
  marks: {
    screen: 'Закладки',
    heading: 'Закладки в этой кассете',
    add: 'Отметить это место',
    /** The player's button that opens the tape's marks: how many there are. */
    list: (count) => `Закладки: ${format.number(count)}`,
    noteAt: (time) => `Закладка на ${time}`,
    noteHint: 'Заметка о том, что здесь, если хотите. Можно оставить пустой.',
    notePlaceholder: 'Что здесь',
    save: 'Отметить',
    none: 'В этой кассете пока нет закладок. Отметьте место кнопкой рядом с таймером сна.',
    noneAnywhere: 'Закладок пока нет. Пока играет кассета, отметьте место в плеере и запишите, что там; все закладки появятся здесь.',
    noNote: 'Без заметки',
    remove: (time) => `Удалить закладку на ${time}`,
    editNote: 'Изменить заметку',
    goHint: 'Переходит к этому месту',
    playHint: 'Включает кассету с этого места',
    howTo: 'Нажмите на закладку, чтобы перейти к ней, или удерживайте, чтобы изменить заметку.',
    all: 'Все закладки',
    count: (count) => `${format.number(count)} ${plural(count, 'закладка', 'закладки', 'закладок')}`,
  },
  sleep: {
    endOfTrack: 'Пауза в конце этого трека',
    thenToTheEnd: (time) => `Осталось ${time}, затем до конца трека`,
    fadingOut: (time) => `Звук стихает, осталось ${time}`,
    pausesIn: (time) => `Пауза через ${time}`,
    endOfChapter: 'Пауза в конце этой главы',
    chapterIn: (time) => `${time} до конца главы`,
    tape: {
      endOfTrack: 'Пауза в конце этой части',
      thenToTheEnd: (time) => `Осталось ${time}, затем до конца части`,
    },
  },
};
