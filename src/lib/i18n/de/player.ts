import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Öffnet den Player',
  },
  sheet: {
    nothingPlaying: 'Es läuft nichts.',
    heart: 'Herz',
    repeat: { off: 'Wiederholen', all: 'Alle wiederholen', one: 'Titel wiederholen' },
    back: (seconds) => oneOrMany(seconds, '1 Sekunde zurück', `${seconds} Sekunden zurück`),
    forward: (seconds) => oneOrMany(seconds, '1 Sekunde vor', `${seconds} Sekunden vor`),
    shuffleQueue: 'Warteschlange mischen',
    playbackSettings: 'Wiedergabeeinstellungen',
    lyrics: 'Songtext',
    translateLyrics: 'Songtext übersetzen',
    upNext: (count) => `Als Nächstes · ${format.number(count)}`,
    position: 'Wiedergabeposition',
    positionValue: (position, duration) => `${position} von ${duration}`,
  },
  queue: {
    remove: (title) => `${title} entfernen`,
    movedTo: (position, count) =>
      `Jetzt an Position ${format.number(position)} von ${format.number(count)}`,
    auto: {
      library: 'Ähnliche Songs · für dich ausgewählt',
      fresh: 'Neue Songs · aus Entdecken',
      mixed: 'Ähnlich und neu · für dich ausgewählt',
      remove: 'Entfernen',
      removeLabel: 'Die für dich ausgewählten Songs entfernen',
      removeHint: 'Bis du etwas anderes abspielst, kommen keine weiteren dazu.',
      notes: {
        offline: 'Keine Verbindung, deshalb kommen diese aus deiner Bibliothek.',
        wifi: 'Entdecken wartet auf WLAN, deshalb kommen diese aus deiner Bibliothek.',
        unavailable: 'Neue Songs brauchen den YouTube-Downloader, deshalb kommen diese aus deiner Bibliothek.',
        waiting: 'Neue Songs werden noch geladen; so lange springt deine Bibliothek ein.',
        random: 'Über diesen Song ist zu wenig bekannt, daher sind einige zufällig aus deiner Bibliothek.',
      },
    },
  },
  settings: {
    playback: 'Wiedergabe',
    backToNormal: 'Zurück zu normalem Tempo und normaler Tonhöhe',
    normal: 'Normal',
    speed: 'Tempo',
    pitch: 'Tonhöhe',
    pitchHint: 'Halbtöne nach oben oder unten; die Aufnahme läuft dabei weiter im oben eingestellten Tempo.',
    effects: 'Effekte',
    equalizer: { note: 'Bänder, Bass und Lautheit' },
    crossfade: { note: 'Wie ein Titel in den nächsten übergeht' },
    allEffects: { title: 'Alle Effekte', note: 'Breite, Crossfeed, Rotation und Pegel' },
  },
  sleepTimer: {
    title: 'Sleep-Timer',
    cancel: 'Sleep-Timer abbrechen',
    unsupported: 'Installiere die aktualisierte Android-Version, um den Sleep-Timer zu nutzen.',
    about: 'Pausiert die Musik nach einer Weile. Die letzte halbe Minute wird leiser.',
    pauseAfter: (minutes) =>
      oneOrMany(minutes, 'Nach 1 Minute pausieren', `Nach ${minutes} Minuten pausieren`),
    pauseAfterTyped: 'Nach einer selbst eingegebenen Zahl von Minuten pausieren',
    custom: 'Andere…',
    pauseAtEnd: 'Am Ende dieses Titels pausieren',
    endOfTrack: 'Titelende',
    finish: {
      title: 'Aktuellen Titel zu Ende spielen',
      note: 'Wenn die Zeit um ist, bis zum Ende des Songs warten, statt ihn auszublenden.',
      label: 'Aktuellen Titel zu Ende spielen, wenn der Sleep-Timer abläuft',
    },
    refused: (most) => `Eine ganze Zahl von Minuten, von 1 bis ${most}`,
    howMany: 'Nach wie vielen Minuten pausieren?',
    minutes: 'Minuten',
    start: 'Starten',
  },
  sleep: {
    endOfTrack: 'Pausiert am Ende dieses Titels',
    thenToTheEnd: (time) => `Noch ${time}, dann bis zum Ende des Titels`,
    fadingOut: (time) => `Wird ausgeblendet, noch ${time}`,
    pausesIn: (time) => `Pausiert in ${time}`,
  },
};
