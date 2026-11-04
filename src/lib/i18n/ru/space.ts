import { common } from './common.ts';
import { format } from './format.ts';
import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

const NB = ' ';
const months = (count: number) => counted(count, 'месяц', 'месяца', 'месяцев');
/* «Удалить» takes the accusative: «удалить 1 песню», «удалить 5 песен». */
const songsToDelete = (count: number) => counted(count, 'песню', 'песни', 'песен');
const times = (count: number) => counted(count, 'раз', 'раза', 'раз');

export const space: Strings['space'] = {
  title: 'Освободить место',
  rowNote: 'Песни, которые ты не слушаешь, пропускаешь или хранишь дважды, и самые большие файлы',
  note: 'Песни, которые можно удалить, чтобы освободить место на телефоне, у каждой указана причина. Отметь ненужные; Android ещё раз спросит, прежде чем что-либо удалить.',
  groups: {
    copy: 'Копии одной песни',
    skipped: 'Часто пропускаемые',
    neverPlayed: 'Ни разу не прослушанные',
    forgotten: 'Давно не прослушанные',
    large: 'Самые большие файлы',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)}${NB}МБ`,
  gigabytes: (gb) => `${format.decimal(gb, 1)}${NB}ГБ`,
  why: {
    copy: 'Другая копия этой песни остаётся и получает её прослушивания',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `Пропущена ${times(skips)}, в среднем через ${format.number(after)} с, ни разу не дослушана`
        : `Пропущена ${times(skips)}, в среднем через ${format.number(after)} с, дослушана ${times(heard)}`,
    neverPlayed: (added) => `Ни разу не прослушана, на телефоне с ${format.date(new Date(added))}`,
    forgotten: (last) => `Последний раз прослушана ${format.date(new Date(last))}`,
    large: 'Один из самых больших файлов',
  },
  listSeparator: ', ',
  inLists: (names) => `В плейлистах: ${names}`,
  showHint: 'Показывает или скрывает песни этой группы',
  tickGroup: (group) => `Все: ${group}`,
  delete: (count, size) => `Удалить ${songsToDelete(count)} (${size})`,
  freed: (count, size) => `Удалено: ${common.songs(count)}, освобождено ${size}.`,
  notDeleted: 'Ничего не удалено.',
  empty: 'Освобождать нечего: все песни слушали недавно, ни одну не пропускают часто, и ни одной нет дважды.',
  auto: {
    heading: 'Автоматически',
    title: 'Удалять непрослушанные загрузки',
    off: 'Выключено. Песни, которые Jukebox скачал сам, могут удаляться сами, если их давно никто не слушал. Файлы, попавшие на телефон иначе, не затрагиваются никогда.',
    after: (count) =>
      `Песни, которые Jukebox скачал сам, удаляются, если их не слушали ${months(count)}; проверка раз в день. Никогда — песня, которая сейчас играет, и файл, попавший на телефон иначе.`,
    months: 'Месяцев без прослушивания',
    monthCount: (count) => months(count),
    favorites: 'И песни из Избранного',
    lists: 'И песни из плейлистов',
  },
};
