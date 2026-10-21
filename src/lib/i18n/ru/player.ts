import { format } from './format.ts';
import { plural } from './plural.ts';
import type { Strings } from '../en/index.ts';

/** After «на» and «через» the count is in the accusative: «на 1 секунду», «через 21 минуту». */
const seconds = (count: number) => `${count} ${plural(count, 'секунду', 'секунды', 'секунд')}`;
const minutes = (count: number) => `${count} ${plural(count, 'минуту', 'минуты', 'минут')}`;

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Открывает плеер',
  },
  sheet: {
    nothingPlaying: 'Ничего не играет.',
    heart: 'Сердечко',
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
      },
    },
  },
  settings: {
    playback: 'Воспроизведение',
    backToNormal: 'Вернуть обычные скорость и высоту тона',
    /* Both скорость and высота are feminine, so one word serves for either. */
    normal: 'Обычная',
    speed: 'Скорость',
    pitch: 'Высота тона',
    pitchHint: 'В полутонах, вверх или вниз; запись при этом играет со скоростью, заданной выше.',
    effects: 'Эффекты',
    equalizer: { note: 'Полосы, бас и усиление громкости' },
    crossfade: { note: 'Как один трек сменяется следующим' },
    allEffects: { title: 'Все эффекты', note: 'Ширина, кроссфид, вращение и уровень' },
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
    refused: (most) => `Целое число минут, от 1 до ${most}`,
    howMany: 'Через сколько минут поставить на паузу?',
    minutes: 'Минуты',
    start: 'Запустить',
  },
  sleep: {
    endOfTrack: 'Пауза в конце этого трека',
    thenToTheEnd: (time) => `Осталось ${time}, затем до конца трека`,
    fadingOut: (time) => `Звук стихает, осталось ${time}`,
    pausesIn: (time) => `Пауза через ${time}`,
  },
};
