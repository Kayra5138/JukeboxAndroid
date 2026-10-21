import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const backup: Strings['backup'] = {
  imported: 'Importato',
  importedBody:
    'Tutto è stato importato. Per mostrarlo Jukebox deve riavviarsi: quello che vedi ora sullo schermo è stato letto prima dell’importazione.',
  restart: 'Riavvia Jukebox',

  question: 'Importare questo backup?',
  /* [when] is a date as `format.date` writes it, so "il 23/09/2026" reads naturally. */
  made: (when, app) =>
    when
      ? `Creato il ${when}${app ? ` con Jukebox ${app}` : ''}.`
      : app
        ? `Un backup creato con Jukebox ${app}.`
        : 'Un backup.',
  listens: (count) => `${format.number(count)} ${oneOrMany(count, 'ascolto', 'ascolti')}`,
  tagged: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'canzone con tag', 'canzoni con tag')}`,
  withLyrics: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'canzone con testo', 'canzoni con testo')}`,

  /*
    One song, or none of them here, would make "0 of 1" or "the other 5"
    awkward in Italian, so those cases are worded on their own.
  */
  songs: (found, total) => {
    if (total === 0) return 'Non contiene nessuna canzone.';
    const missing = total - found;
    const kept = (their: string, lyrics: string) =>
      `${their} ascolti vengono mantenuti, ma tag, ${lyrics} e posizioni nelle liste non hanno una canzone a cui collegarsi e vengono tralasciati.`;
    if (total === 1) {
      return found === 1
        ? 'L’unica canzone che contiene è nella tua libreria.'
        : `L’unica canzone che contiene non è su questo telefono. ${kept('I suoi', 'testo')}`;
    }
    if (found === 0) {
      return `Nessuna delle ${format.number(total)} canzoni che contiene è su questo telefono. ${kept('I loro', 'testi')}`;
    }
    if (missing === 0) {
      return total === 2
        ? 'Entrambe le canzoni che contiene sono nella tua libreria.'
        : `Tutte le ${format.number(total)} canzoni che contiene sono nella tua libreria.`;
    }
    const here = `${format.number(found)} delle ${format.number(total)} canzoni che contiene ${oneOrMany(found, 'è', 'sono')} nella tua libreria.`;
    return missing === 1
      ? `${here} L’altra non è su questo telefono. ${kept('I suoi', 'testo')}`
      : `${here} Le altre ${format.number(missing)} non sono su questo telefono. ${kept('I loro', 'testi')}`;
  },

  importing: 'Importazione…',
  merge: 'Unisci',
  mergeHint: 'Aggiunge il backup a ciò che c’è già. Niente viene rimosso da questo telefono.',
  replace: 'Sostituisci',
  replaceHint:
    'Elimina ciò che c’è ora e usa al suo posto il backup. L’operazione non può essere annullata.',

  notABackup: 'Questo file non è un backup di Jukebox.',
  newer: 'Questo backup è stato creato da una versione più recente di Jukebox. Aggiorna l’app per leggerlo.',
  needsBuildToExport: 'Installa la versione Android aggiornata per esportare.',
  needsBuildToImport: 'Installa la versione Android aggiornata per importare.',
};
