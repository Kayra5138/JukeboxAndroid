import { format } from './format.ts';
import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

/*
  The counts here are kept beside a label — «в очереди: 3», «скачивается: 2» —
  rather than made the subject of a verb, which would have to agree with each
  number in turn.
*/
const n = (count: number) => format.number(count);

export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Пауза · в очереди: ${n(waiting)}` : 'Пауза';
    if (underWay > 0 && waiting > 0) return `Скачивается: ${n(underWay)}, в очереди: ${n(waiting)}`;
    if (underWay > 0) return `Скачивается: ${n(underWay)}`;
    return waiting > 0 ? `В очереди: ${n(waiting)}` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Пауза, в очереди: ${n(waiting)}` : 'Пауза';
    if (underWay > 0 && waiting > 0) return `Скачивается: ${n(underWay)}, в очереди: ${n(waiting)}`;
    if (underWay > 0) return `Скачивается: ${n(underWay)}`;
    return waiting > 0 ? `В очереди: ${n(waiting)}` : 'Сейчас ничего не скачивается';
  },
  pausedNote: 'Новые загрузки не начнутся, пока ты не возобновишь очередь. То, что уже скачивается, докачается.',
  automaticNote: (count) =>
    count === 1
      ? 'Одна загрузка автоматическая: её запросил раздел «Открытия». Она ждёт, пока не скачается всё остальное.'
      : `Автоматических загрузок: ${n(count)}. Их запросил раздел «Открытия», и они ждут, пока не скачается всё остальное.`,

  pause: 'Пауза',
  resume: 'Продолжить',
  cancelAll: 'Отменить все',
  cancelAllQuestion: 'Отменить все загрузки?',
  cancelAllHint: 'Будет отменено всё, что ждёт в очереди и что скачивается сейчас. То, что уже в медиатеке, останется.',
  keep: 'Не отменять',

  sections: { now: 'Сейчас', next: 'Далее', history: 'История' },
  clear: 'Очистить',
  clearLabel: 'Очистить историю загрузок',

  source: {
    discover: 'Открытия',
    search: 'Поиск',
    album: (name) => `Альбом: ${name}`,
    playlist: (name) => `Плейлист: ${name}`,
  },
  automatic: 'Автоматически · ждёт остальных',
  retrying: (why) => (why ? `Повторная попытка · ${why}` : 'Повторная попытка'),

  doNext: 'Скачать следующим',
  doNextLabel: (title) => `Скачать следующим: ${title}`,
  cancelLabel: (title) => `Отменить: ${title}`,
  retryLabel: (title) => `Повторить: ${title}`,
  moveUp: 'Переместить выше',
  moveDown: 'Переместить ниже',

  empty: {
    heading: 'Загрузок пока нет',
    body: 'Здесь появится всё, что ты скачиваешь из поиска, из «Открытий» или чтобы дополнить альбом, — и то, что ещё ждёт своей очереди.',
  },
  unavailable: 'Чтобы скачивать музыку, установи новую сборку для Android.',
  readFailed: 'Не удалось прочитать список загрузок.',

  extractor: {
    heading: 'Загрузчик YouTube',
    version: (version) => `yt-dlp ${version}`,
    current: 'Последняя версия',
    available: (version) => `Доступна версия ${version}`,
    unchecked: 'Обновления ещё не проверялись',
    checked: (days) =>
      days === 0
        ? 'проверено сегодня'
        : days === 1
          ? 'проверено вчера'
          : `проверено ${counted(days, 'день', 'дня', 'дней')} назад`,
    check: 'Проверить обновления',
    checking: 'Проверка…',
    update: 'Обновить',
    waiting: 'Ожидание конца текущей загрузки…',
    downloading: (version, percent) => `Скачивание ${version} · ${n(percent)}%`,
    trying: 'Проверка новой версии…',
    restoring: 'Возврат к версии, встроенной в Jukebox…',
    updated: (version) => `Установлена версия ${version}. Неудавшиеся загрузки можно повторить.`,
    restore: (version) => `Вернуть встроенную в Jukebox версию ${version}`,
    checkFailed: 'Не удалось проверить обновления.',
    trouble: {
      network: 'Не удалось связаться с GitHub. Проверь подключение и попробуй снова.',
      answer: 'GitHub не прислал данных о выпуске. Попробуй позже.',
      checksum: 'Полученный файл не совпадает с указанным в выпуске. Ничего не изменено.',
      broken: 'Новая версия не работает на этом телефоне. Прежняя версия осталась на месте.',
      failed: 'Не удалось обновить. Прежняя версия осталась на месте.',
    },
    rowUpdate: 'Обновить',
    rowCheck: 'Проверить',
    rowUpdateLabel: (title) => `Обновить загрузчик YouTube, чтобы повторить: ${title}`,
    rowCheckLabel: (title) => `Проверить новую версию загрузчика YouTube, чтобы повторить: ${title}`,
  },

  button: {
    label: (state) => (state ? `Загрузки: ${state}` : 'Загрузки'),
    finished: 'готово',
    heading: 'Загрузки',
    idle: 'Сейчас ничего не скачивается',
    paused: 'Пауза',
    allDone: 'Всё готово',
    waiting: (count) => `В очереди: ${n(count)}`,
    done: (count) => `Готово: ${n(count)}`,
    failed: (count) => `С ошибкой: ${n(count)}`,
    open: 'Открыть загрузки',
  },
};
