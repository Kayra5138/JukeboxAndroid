import { counted, plural } from './plural.ts';
import type { Strings } from '../en/index.ts';

export const lyrics: Strings['lyrics'] = {
  none: 'Текст не найден.',
  translating: 'Перевод…',
  /*
    Read aloud, so the unit is a word that agrees with the figure: «на 21 секунду»,
    «на 25 секунд». A figure written with a decimal part, «83,0» included, takes «секунды».
  */
  seekTo: (seconds) => {
    const unit = /[,.]/.test(seconds)
      ? 'секунды'
      : plural(Number(seconds.replace(/\s/g, '')), 'секунду', 'секунды', 'секунд');
    return `Перемотать на ${seconds} ${unit}`;
  },

  translation: {
    romaji:
      'Это японские слова, записанные латиницей, а текста в оригинальной записи, который можно было бы перевести вместо них, не нашлось.',
    unsupported: 'Для этого языка перевода нет.',
    unavailable: 'Перевод недоступен на этом устройстве.',
    misaligned: 'Перевод не совпал со строками.',
    failed: 'Не удалось перевести.',
  },

  from: {
    file: 'Из файла',
    lrc: 'Из файла .lrc',
    lookup: 'Из LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Синхронизированный текст' : 'Обычный текст'}, ${from === 'file' ? 'из самого файла' : 'из файла .lrc рядом с ним'}` +
    (lines > 0 ? ` · ${counted(lines, 'строка', 'строки', 'строк')}` : ''),

  found: {
    file: 'Текст найден в самом файле и сохранён.',
    lrc: 'Текст найден в файле .lrc рядом с треком и сохранён.',
  },

  folders: {
    title: 'Читать файлы .lrc рядом с треками',
    note: 'Текст из файла .lrc с тем же именем, что и у трека, показывается раньше любого поиска в интернете. Android разрешает приложению читать такие файлы только из папки, которую выберешь ты, поэтому папка с твоей музыкой запрашивается один раз.',
    add: 'Добавить ещё папку',
    remove: 'Убрать',
    removeLabel: (folder) => `Не читать файлы .lrc в папке ${folder}`,
    elsewhere: 'Эта папка не на телефоне, поэтому треков из медиатеки в ней нет. Выбери папку на телефоне, где лежит твоя музыка.',
  },
};
