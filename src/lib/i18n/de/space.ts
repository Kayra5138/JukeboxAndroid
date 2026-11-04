import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const months = (count: number) => `${format.number(count)} ${oneOrMany(count, 'Monat', 'Monate')}`;
const times = (count: number) => oneOrMany(count, 'einmal', `${format.number(count)}-mal`);

export const space: Strings['space'] = {
  title: 'Speicher freigeben',
  rowNote: 'Songs, die du nie hörst, überspringst oder doppelt hast, und die größten Dateien',
  note: 'Songs, die gehen könnten, um auf dem Handy Platz zu schaffen, jeweils mit dem Grund. Hake die an, die weg sollen; Android fragt noch einmal, bevor etwas gelöscht wird.',
  groups: {
    copy: 'Kopien desselben Songs',
    skipped: 'Oft übersprungen',
    neverPlayed: 'Nie gespielt',
    forgotten: 'Lange nicht gespielt',
    large: 'Größte Dateien',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: 'Eine andere Kopie dieses Songs bleibt und bekommt seine Wiedergaben',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `${times(skips)} übersprungen, im Schnitt nach ${format.number(after)} s, nie zu Ende gehört`
        : `${times(skips)} übersprungen, im Schnitt nach ${format.number(after)} s, ${times(heard)} zu Ende gehört`,
    neverPlayed: (added) => `Nie gespielt, seit ${format.date(new Date(added))} auf dem Handy`,
    forgotten: (last) => `Zuletzt gespielt am ${format.date(new Date(last))}`,
    large: 'Eine der größten Dateien',
  },
  listSeparator: ', ',
  inLists: (names) => `In ${names}`,
  showHint: 'Zeigt oder verbirgt die Songs dieser Gruppe',
  tickGroup: (group) => `Alle aus ${group}`,
  delete: (count, size) => `${common.songs(count)} löschen (${size})`,
  freed: (count, size) => `${common.songs(count)} gelöscht, ${size} frei geworden.`,
  notDeleted: 'Es wurde nichts gelöscht.',
  empty: 'Nichts freizugeben: Jeder Song wurde in letzter Zeit gespielt, keiner wird oft übersprungen und keiner ist doppelt da.',
  auto: {
    heading: 'Von selbst',
    title: 'Ungehörte Downloads löschen',
    off: 'Aus. Songs, die Jukebox selbst heruntergeladen hat, können von selbst gelöscht werden, wenn sie eine Weile niemand gehört hat. Dateien, die auf anderem Weg kamen, werden nie angerührt.',
    after: (count) =>
      `Songs, die Jukebox selbst heruntergeladen hat, werden gelöscht, sobald ${months(count)} ohne Wiedergabe vergangen sind; geprüft wird einmal am Tag. Nie der Song, der gerade läuft, und nie eine Datei, die auf anderem Weg kam.`,
    months: 'Monate ohne Wiedergabe',
    monthCount: (count) => months(count),
    favorites: 'Auch Songs in den Favoriten',
    lists: 'Auch Songs in Listen',
  },
};
