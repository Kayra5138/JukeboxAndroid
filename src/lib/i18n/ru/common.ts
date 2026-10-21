import { format } from './format.ts';
import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

/*
  A noun after a number takes one of three forms in Russian — «1 трек»,
  «2 трека», «5 треков» — and `counted` chooses between them.
*/
export const common: Strings['common'] = {
  cancel: 'Отмена',
  save: 'Сохранить',
  done: 'Готово',
  ok: 'ОК',
  close: 'Закрыть',
  back: 'Назад',
  delete: 'Удалить',
  remove: 'Убрать',
  add: 'Добавить',
  edit: 'Изменить',
  rename: 'Переименовать',
  yes: 'Да',
  no: 'Нет',
  tryAgain: 'Попробовать снова',
  retry: 'Повторить',
  import: 'Импортировать',
  clear: 'Очистить',
  selectAll: 'Выбрать все',
  off: 'Выкл.',
  saved: 'Сохранено.',
  loading: 'Загрузка…',

  search: 'Поиск',
  clearSearch: 'Очистить поиск',

  play: 'Слушать',
  pause: 'Пауза',
  nextTrack: 'Следующий трек',
  previousTrack: 'Предыдущий трек',
  shuffle: 'Перемешать',
  addToQueue: 'Добавить в очередь',
  moveUp: 'Переместить выше',
  moveDown: 'Переместить ниже',

  unknownArtist: 'Неизвестный исполнитель',
  unknownAlbum: 'Неизвестный альбом',

  tracks: (count) => counted(count, 'трек', 'трека', 'треков'),
  songs: (count) => counted(count, 'песня', 'песни', 'песен'),
  albums: (count) => counted(count, 'альбом', 'альбома', 'альбомов'),
  artists: (count) => counted(count, 'исполнитель', 'исполнителя', 'исполнителей'),
  lists: (count) => counted(count, 'плейлист', 'плейлиста', 'плейлистов'),
  files: (count) => counted(count, 'файл', 'файла', 'файлов'),
  minutes: (count) => `${format.number(count)} мин`,
  hours: (count) => `${format.number(count)} ч`,

  fileUnreadable: 'Не удалось прочитать этот файл.',
  pictureFailed: 'Не удалось загрузить это изображение.',

  drawFailed: 'Не удалось отобразить этот экран.',
};
