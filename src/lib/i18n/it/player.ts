import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Apre il lettore',
  },
  sheet: {
    nothingPlaying: 'Nessuna riproduzione in corso.',
    heart: 'Cuore',
    repeat: { off: 'Ripeti', all: 'Ripeti tutto', one: 'Ripeti brano' },
    back: (seconds) => oneOrMany(seconds, 'Indietro di 1 secondo', `Indietro di ${seconds} secondi`),
    forward: (seconds) => oneOrMany(seconds, 'Avanti di 1 secondo', `Avanti di ${seconds} secondi`),
    shuffleQueue: 'Mescola la coda',
    playbackSettings: 'Impostazioni di riproduzione',
    lyrics: 'Testo',
    translateLyrics: 'Traduci il testo',
    upNext: (count) => `In coda · ${format.number(count)}`,
    position: 'Posizione di riproduzione',
    positionValue: (position, duration) => `${position} di ${duration}`,
  },
  queue: {
    remove: (title) => `Rimuovi ${title}`,
    movedTo: (position, count) =>
      `Ora in posizione ${format.number(position)} di ${format.number(count)}`,
    auto: {
      library: 'Canzoni simili · scelte per te',
      fresh: 'Canzoni nuove · da Scopri',
      mixed: 'Simili e nuove · scelte per te',
      remove: 'Rimuovi',
      removeLabel: 'Rimuovi le canzoni scelte per te',
      removeHint: 'Non ne vengono aggiunte altre a questa coda finché non avvii qualcos’altro.',
      notes: {
        offline: 'Nessuna connessione, quindi vengono dalla tua libreria.',
        wifi: 'Scopri aspetta il Wi-Fi, quindi vengono dalla tua libreria.',
        unavailable: 'Le canzoni nuove richiedono il downloader di YouTube, quindi vengono dalla tua libreria.',
        waiting: 'Le canzoni nuove si stanno ancora scaricando; nel frattempo suona la tua libreria.',
      },
    },
  },
  settings: {
    playback: 'Riproduzione',
    backToNormal: 'Ripristina velocità e tonalità normali',
    normal: 'Normale',
    speed: 'Velocità',
    pitch: 'Tonalità',
    pitchHint: 'In semitoni, verso l’alto o verso il basso, con la registrazione che resta alla velocità impostata sopra.',
    effects: 'Effetti',
    equalizer: { note: 'Bande, bassi e loudness' },
    crossfade: { note: 'Come un brano lascia il posto al successivo' },
    allEffects: { title: 'Tutti gli effetti', note: 'Ampiezza, crossfeed, rotazione e livello' },
  },
  sleepTimer: {
    title: 'Timer di spegnimento',
    cancel: 'Annulla il timer di spegnimento',
    unsupported: 'Installa la versione Android aggiornata per usare il timer di spegnimento.',
    about: 'Mette in pausa la musica dopo un po’. Nell’ultimo mezzo minuto il volume si abbassa.',
    pauseAfter: (minutes) => `Pausa dopo ${minutes} minuti`,
    pauseAfterTyped: 'Pausa dopo un numero di minuti a tua scelta',
    custom: 'Personalizzato…',
    pauseAtEnd: 'Pausa alla fine di questo brano',
    endOfTrack: 'Fine del brano',
    finish: {
      title: 'Lascia finire il brano in corso',
      note: 'Allo scadere del tempo, aspetta che la canzone finisca invece di sfumarla.',
      label: 'Lascia finire il brano in corso allo scadere del timer di spegnimento',
    },
    refused: (most) => `Un numero intero di minuti, da 1 a ${most}`,
    howMany: 'Pausa dopo quanti minuti?',
    minutes: 'Minuti',
    start: 'Avvia',
  },
  sleep: {
    endOfTrack: 'Pausa alla fine di questo brano',
    thenToTheEnd: (time) => `Ancora ${time}, poi fino alla fine del brano`,
    fadingOut: (time) => `Dissolvenza in corso, ancora ${time}`,
    pausesIn: (time) => `Pausa tra ${time}`,
  },
};
