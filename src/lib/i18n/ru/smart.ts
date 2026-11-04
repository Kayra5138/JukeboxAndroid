import { format } from './format.ts';
import { counted, plural } from './plural.ts';
import type { Strings } from '../en/index.ts';

const songs = (count: number) => counted(count, 'песня', 'песни', 'песен');

export const smart: Strings['smart'] = {
  newList: 'Новый умный плейлист',
  sign: 'Умный плейлист',
  detail: (count) => `${songs(count)} · умный`,
  hint: 'Песни, которые сейчас подходят под его правила',
  editRules: 'Изменить правила',
  empty: 'Сейчас ни одна песня не подходит под эти правила. Измени их или послушай что-нибудь и загляни снова.',

  editor: {
    newTitle: 'Новый умный плейлист',
    editTitle: 'Изменить правила',
    name: 'Название',
    namePlaceholder: 'Название плейлиста',
    match: 'Песня должна подходить под',
    all: 'Все правила',
    any: 'Любое правило',
    rules: 'Правила',
    noRules: 'Правил пока нет, поэтому сюда попадают все песни.',
    addRule: 'Добавить правило',
    removeRule: (at) => `Удалить правило ${format.number(at)}`,
    chooseField: 'О чём спрашивает правило',
    asksAbout: (field) => `Спрашивает: ${field}`,
    chooseTag: 'Выбрать…',
    tagSheet: 'Выбери тег',
    noTags: 'Тегов пока нет.',
    textPlaceholder: 'Введи имя',
    tagPlaceholder: 'Введи тег',
    valueOf: (field, op) => `${field} ${op}`,
    fromOf: (field) => `${field}, от`,
    toOf: (field) => `${field}, до`,
    and: 'и',
    limit: 'Сколько',
    limitOff: 'Все',
    limitOn: 'Не больше',
    order: 'Порядок',
    matching: (count) => `${plural(count, 'Подходит', 'Подходят', 'Подходят')} ${songs(count)}`,
    matchingKept: (count, kept) =>
      `${plural(count, 'Подходит', 'Подходят', 'Подходят')} ${songs(count)}; в плейлисте останется ${format.number(kept)}`,
    save: 'Сохранить',
    create: 'Создать',
    problems: {
      name: 'Дай плейлисту название.',
      text: 'Введи, что искать.',
      value: 'Это число вне допустимого диапазона.',
      range: 'Второе число меньше первого.',
      rule: (at) => `Правило ${format.number(at)} не дописано.`,
    },
  },

  fields: {
    tag: 'Тег',
    artist: 'Исполнитель',
    albumArtist: 'Исполнитель альбома',
    album: 'Альбом',
    genre: 'Жанр',
    title: 'Название',
    year: 'Год',
    added: 'Добавлена',
    plays: 'Прослушиваний',
    lastPlayed: 'Последнее прослушивание',
    skips: 'Пропусков',
    length: 'Длительность',
  },

  ops: {
    is: 'это',
    isNot: 'не',
    contains: 'содержит',
    notContains: 'не содержит',
    between: 'от и до',
    year: { more: 'после', less: 'до' },
    count: { more: 'больше', less: 'меньше' },
    length: { more: 'дольше', less: 'короче' },
    within: 'за последние',
    before: 'больше чем … назад',
    never: 'никогда',
  },

  units: {
    days: (count) => counted(count, 'день', 'дня', 'дней'),
    minutes: (count) => `${format.number(count)} мин`,
    times: (count) => counted(count, 'раз', 'раза', 'раз'),
    songs,
  },

  orders: {
    random: 'Случайно',
    mostPlayed: 'Чаще всего',
    leastPlayed: 'Реже всего',
    newest: 'Недавно добавленные',
    oldest: 'Давно добавленные',
    title: 'Название',
  },
};
