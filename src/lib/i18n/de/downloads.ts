import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/* A count with its verb, which agrees with it: `1 wartet`, `3 warten`. */
const waits = (count: number) => `${format.number(count)} ${oneOrMany(count, 'wartet', 'warten')}`;
const runs = (count: number) => `${format.number(count)} ${oneOrMany(count, 'läuft', 'laufen')}`;
const fetched = (count: number) =>
  `${format.number(count)} ${oneOrMany(count, 'wird', 'werden')} heruntergeladen`;

export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Pausiert · ${waits(waiting)}` : 'Pausiert';
    if (underWay > 0 && waiting > 0) return `${runs(underWay)}, ${waits(waiting)}`;
    if (underWay > 0) return runs(underWay);
    return waiting > 0 ? waits(waiting) : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Pausiert, ${waits(waiting)}` : 'Pausiert';
    if (underWay > 0 && waiting > 0) return `${fetched(underWay)}, ${waits(waiting)}`;
    if (underWay > 0) return fetched(underWay);
    return waiting > 0 ? waits(waiting) : 'Es wird nichts heruntergeladen';
  },
  pausedNote: 'Nichts Neues wird gestartet, bis du fortsetzt. Was schon heruntergeladen wird, läuft zu Ende.',
  automaticNote: (count) =>
    count === 1
      ? 'Ein Download ist automatisch: Entdecken hat ihn angefordert. Er wartet, bis sonst nichts mehr geladen wird.'
      : `${format.number(count)} Downloads sind automatisch: Entdecken hat sie angefordert. Sie warten, bis sonst nichts mehr geladen wird.`,

  pause: 'Pausieren',
  resume: 'Fortsetzen',
  cancelAll: 'Alle abbrechen',
  cancelAllQuestion: 'Alle Downloads abbrechen?',
  cancelAllHint: 'Alles, was wartet oder gerade heruntergeladen wird, wird abgebrochen. Was schon in deiner Bibliothek ist, bleibt.',
  keep: 'Nicht abbrechen',

  sections: { now: 'Jetzt', next: 'Als Nächstes', history: 'Verlauf' },
  clear: 'Leeren',
  clearLabel: 'Download-Verlauf leeren',

  source: {
    discover: 'Entdecken',
    search: 'Suche',
    album: (name) => `Album: ${name}`,
    playlist: (name) => `Playlist: ${name}`,
  },
  automatic: 'Automatisch · wartet auf die anderen',
  retrying: (why) => (why ? `Neuer Versuch · ${why}` : 'Neuer Versuch'),

  doNext: 'Als Nächstes laden',
  doNextLabel: (title) => `${title} als Nächstes herunterladen`,
  cancelLabel: (title) => `${title} abbrechen`,
  retryLabel: (title) => `${title} erneut versuchen`,
  moveUp: 'Nach oben verschieben',
  moveDown: 'Nach unten verschieben',

  empty: {
    heading: 'Noch keine Downloads',
    body: 'Was du über die Suche, über Entdecken oder zum Vervollständigen eines Albums herunterlädst, steht hier – zusammen mit dem, was noch wartet.',
  },
  unavailable: 'Installiere eine neue Android-Version, um Musik herunterzuladen.',
  readFailed: 'Downloads konnten nicht gelesen werden.',

  extractor: {
    heading: 'YouTube-Downloader',
    version: (version) => `yt-dlp ${version}`,
    current: 'Aktuell',
    available: (version) => `${version} ist verfügbar`,
    unchecked: 'Noch nicht nach einer neueren Version gesucht',
    checked: (days) =>
      days === 0
        ? 'heute geprüft'
        : days === 1
          ? 'gestern geprüft'
          : `vor ${format.number(days)} Tagen geprüft`,
    check: 'Nach Update suchen',
    checking: 'Wird geprüft…',
    update: 'Aktualisieren',
    waiting: 'Wartet, bis der aktuelle Download fertig ist…',
    downloading: (version, percent) => `${version} wird geladen · ${format.number(percent)}${NNBSP}%`,
    trying: 'Neue Version wird getestet…',
    restoring: 'Die mitgelieferte Version wird wiederhergestellt…',
    updated: (version) => `${version} ist jetzt installiert. Fehlgeschlagene Downloads können erneut versucht werden.`,
    restore: (version) => `Zurück zu ${version}, der mitgelieferten Version`,
    checkFailed: 'Die Suche nach einem Update ist fehlgeschlagen.',
    trouble: {
      network: 'GitHub ist nicht erreichbar. Prüfe die Verbindung und versuch es erneut.',
      answer: 'GitHub hat kein Release geliefert. Versuch es später erneut.',
      checksum: 'Die empfangene Datei ist nicht die, die das Release angibt. Es wurde nichts geändert.',
      broken: 'Die neue Version läuft auf diesem Gerät nicht. Die bisherige ist weiterhin installiert.',
      failed: 'Aktualisierung fehlgeschlagen. Die bisherige Version ist weiterhin installiert.',
    },
    rowUpdate: 'Update',
    rowCheck: 'Prüfen',
    rowUpdateLabel: (title) => `YouTube-Downloader aktualisieren, um ${title} erneut zu versuchen`,
    rowCheckLabel: (title) => `Nach neuerem YouTube-Downloader suchen, um ${title} erneut zu versuchen`,
  },

  button: {
    label: (state) => (state ? `Downloads: ${state}` : 'Downloads'),
    finished: 'fertig',
    heading: 'Downloads',
    idle: 'Gerade wird nichts heruntergeladen',
    paused: 'Pausiert',
    allDone: 'Alle fertig',
    waiting: (count) => waits(count),
    done: (count) => `${format.number(count)} fertig`,
    failed: (count) => `${format.number(count)} fehlgeschlagen`,
    open: 'Downloads öffnen',
  },
};
