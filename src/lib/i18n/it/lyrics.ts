import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lyrics: Strings['lyrics'] = {
  none: 'Nessun testo trovato.',
  translating: 'Traduzione…',
  seekTo: (seconds) => `Vai a ${seconds} secondi`,

  translation: {
    romaji:
      'Sono parole giapponesi in caratteri latini, e non è stata trovata una versione nella scrittura originale da tradurre al loro posto.',
    unsupported: 'Nessuna traduzione per questa lingua.',
    unavailable: 'La traduzione non è disponibile su questo dispositivo.',
    misaligned: 'La traduzione non corrisponde alle righe.',
    failed: 'Traduzione non riuscita.',
  },

  from: {
    file: 'Dal file',
    lrc: 'Da un file .lrc',
    lookup: 'Da LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Sincronizzato' : 'Testo semplice'}, ${from === 'file' ? 'dal file stesso' : 'da un file .lrc accanto'}` +
    (lines > 0 ? ` · ${oneOrMany(lines, '1 riga', `${format.number(lines)} righe`)}` : ''),

  found: {
    file: 'Trovato nel file stesso e salvato.',
    lrc: 'Trovato in un file .lrc accanto al brano e salvato.',
  },

  folders: {
    title: 'Leggi i file .lrc accanto ai brani',
    note: 'Il testo di un file .lrc con lo stesso nome del brano viene mostrato prima di qualsiasi ricerca online. Android permette a un’app di leggere questi file solo da una cartella scelta da te, quindi ti viene chiesta una volta la cartella in cui si trova la tua musica.',
    add: 'Aggiungi un’altra cartella',
    remove: 'Rimuovi',
    removeLabel: (folder) => `Smetti di leggere i file .lrc in ${folder}`,
    elsewhere: 'Questa cartella non è sul telefono, quindi nessuno dei tuoi brani si trova lì. Scegli la cartella del telefono in cui si trova la tua musica.',
  },
};
