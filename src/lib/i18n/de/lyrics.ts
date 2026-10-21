import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lyrics: Strings['lyrics'] = {
  none: 'Kein Songtext gefunden.',
  translating: 'Wird übersetzt…',
  seekTo: (seconds) => `Zu Sekunde ${seconds} springen`,

  translation: {
    romaji:
      'Das sind japanische Wörter in lateinischen Buchstaben, und es wurde keine Fassung in der Originalschrift gefunden, die sich stattdessen übersetzen ließe.',
    unsupported: 'Keine Übersetzung für diese Sprache.',
    unavailable: 'Übersetzen ist auf diesem Gerät nicht verfügbar.',
    misaligned: 'Die Übersetzung passte nicht zu den Zeilen.',
    failed: 'Übersetzung fehlgeschlagen.',
  },

  from: {
    file: 'Aus der Datei',
    lrc: 'Aus einer .lrc-Datei',
    lookup: 'Von LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Synchronisiert' : 'Nur Text'}, ${from === 'file' ? 'aus der Datei selbst' : 'aus einer .lrc-Datei daneben'}` +
    (lines > 0 ? ` · ${oneOrMany(lines, '1 Zeile', `${format.number(lines)} Zeilen`)}` : ''),

  found: {
    file: 'In der Datei selbst gefunden und gespeichert.',
    lrc: 'In einer .lrc-Datei neben dem Song gefunden und gespeichert.',
  },

  folders: {
    title: '.lrc-Dateien neben den Songs lesen',
    note: 'Songtexte aus einer .lrc-Datei mit demselben Namen wie der Song werden angezeigt, bevor online nachgeschlagen wird. Android erlaubt einer App, solche Dateien nur aus einem Ordner zu lesen, den du auswählst. Deshalb wirst du einmal nach dem Ordner mit deiner Musik gefragt.',
    add: 'Weiteren Ordner hinzufügen',
    remove: 'Entfernen',
    removeLabel: (folder) => `.lrc-Dateien in ${folder} nicht mehr lesen`,
    elsewhere: 'Dieser Ordner liegt nicht auf dem Gerät, also ist keiner deiner Songs darin. Wähl den Ordner auf dem Gerät, in dem deine Musik liegt.',
  },
};
