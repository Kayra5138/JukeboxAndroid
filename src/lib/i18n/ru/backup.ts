import { format } from './format.ts';
import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

export const backup: Strings['backup'] = {
  imported: 'Импорт завершён',
  importedBody:
    'Всё перенесено. Чтобы это увидеть, Jukebox нужно перезапустить: то, что сейчас на экране, было прочитано до импорта.',
  restart: 'Перезапустить Jukebox',

  question: 'Импортировать эту резервную копию?',
  made: (when, app) =>
    when
      ? `Создана ${when}${app ? ` в версии Jukebox ${app}` : ''}.`
      : `Резервная копия${app ? ` из версии Jukebox ${app}` : ''}.`,
  listens: (count) => counted(count, 'прослушивание', 'прослушивания', 'прослушиваний'),
  tagged: (count) => counted(count, 'песня с тегами', 'песни с тегами', 'песен с тегами'),
  withLyrics: (count) => counted(count, 'песня с текстом', 'песни с текстом', 'песен с текстом'),

  songs: (found, total) => {
    if (total === 0) return 'В ней не упомянуто ни одной песни.';
    const missing = total - found;
    /* «из» takes the genitive: «из 1 песни», «из 5 песен». */
    const here = `В твоей медиатеке есть ${format.number(found)} из ${counted(total, 'песни', 'песен', 'песен')} этой копии.`;
    return missing > 0
      ? `${here} Нет на этом телефоне: ${counted(missing, 'песня', 'песни', 'песен')}. Их прослушивания сохранятся, но теги, тексты и места в плейлистах не к чему привязать, и они будут пропущены.`
      : here;
  },

  importing: 'Импорт…',
  merge: 'Объединить',
  mergeHint: 'Добавить к тому, что уже есть. С телефона ничего не удаляется.',
  replace: 'Заменить',
  replaceHint: 'Удалить всё, что есть сейчас, и взять вместо этого резервную копию. Это нельзя отменить.',

  notABackup: 'Этот файл — не резервная копия Jukebox.',
  newer: 'Эта резервная копия создана более новой версией Jukebox. Обнови приложение, чтобы её прочитать.',
  needsBuildToExport: 'Чтобы экспортировать, установи обновлённую сборку для Android.',
  needsBuildToImport: 'Чтобы импортировать, установи обновлённую сборку для Android.',
};
