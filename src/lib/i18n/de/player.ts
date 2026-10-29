import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Öffnet den Player',
  },
  sheet: {
    nothingPlaying: 'Es läuft nichts.',
    heart: "Favorit",
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
  tape: {
    part: (at, of) => `Teil ${format.number(at)} von ${format.number(of)}`,
    /** For an episode of a followed show, in place of `part`. */
    episode: (at, of) => `Folge ${format.number(at)} von ${format.number(of)}`,
    previousPart: 'Vorheriger Teil',
    nextPart: 'Nächster Teil',
    parts: (count) => `Teile · ${format.number(count)}`,
    book: (percent, left) => `${format.number(percent)}${NNBSP}% des Ganzen · noch ${left}`,
    speed: (speed) => `Tempo ${speed}, tippen für das nächste`,
    sleep: 'Sleep-Timer',
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
    tape: {
      about: 'Pausiert nach einer Weile. Die letzte halbe Minute wird leiser.',
      pauseAtEnd: 'Am Ende dieses Teils pausieren',
      endOfTrack: 'Ende des Teils',
      finish: {
        title: 'Aktuellen Teil zu Ende spielen',
        note: 'Wenn die Zeit um ist, bis zum Ende des Teils warten, statt ihn auszublenden.',
        label: 'Aktuellen Teil zu Ende spielen, wenn der Sleep-Timer abläuft',
      },
    },
  },
  /** Places marked in a tape, each with a note: see `tapes/marks.ts`, `MarksSheet` and the Marks screen. */
  /** A tape's chapters: see `tapes/extras.ts` and `ChaptersSheet`. */
  /** A tape's captions, shown as a song's words are. */
  transcript: {
    heading: 'Transkript',
    show: 'Zeigen, was gesagt wird',
    none: 'Dieses Video hat keine Untertitel zum Mitlesen.',
  },
  chapters: {
    heading: (count) => `Kapitel · ${format.number(count)}`,
    untitled: (at) => `Kapitel ${format.number(at)}`,
    at: (at, of) => `Kapitel ${format.number(at)} von ${format.number(of)}`,
    sleepAtEnd: 'Am Ende dieses Kapitels anhalten',
    listHint: 'Listet die Kapitel',
  },
  marks: {
    screen: 'Markierungen',
    heading: 'Markierungen in dieser Kassette',
    add: 'Diese Stelle markieren',
    /** The player's button that opens the tape's marks: how many there are. */
    list: (count) => oneOrMany(count, 'Markierungen, bisher 1', `Markierungen, bisher ${format.number(count)}`),
    noteAt: (time) => `Markierung bei ${time}`,
    noteHint: 'Eine Notiz, was hier ist, wenn du magst. Du kannst sie auch leer lassen.',
    notePlaceholder: 'Was hier ist',
    save: 'Markieren',
    none: 'In dieser Kassette ist noch nichts markiert. Markiere eine Stelle mit der Taste neben dem Schlaftimer.',
    noneAnywhere: 'Noch nichts markiert. Während eine Kassette läuft, markierst du im Player eine Stelle und notierst, was dort ist; alle Markierungen erscheinen hier.',
    noNote: 'Keine Notiz',
    remove: (time) => `Markierung bei ${time} entfernen`,
    editNote: 'Notiz bearbeiten',
    goHint: 'Springt zu dieser Stelle',
    playHint: 'Spielt die Kassette ab dieser Stelle',
    howTo: 'Tippe auf eine Markierung, um dorthin zu springen, halte sie gedrückt, um die Notiz zu ändern.',
    all: 'Alle Markierungen',
    count: (count) => oneOrMany(count, '1 Markierung', `${format.number(count)} Markierungen`),
  },
  sleep: {
    endOfTrack: 'Pausiert am Ende dieses Titels',
    thenToTheEnd: (time) => `Noch ${time}, dann bis zum Ende des Titels`,
    fadingOut: (time) => `Wird ausgeblendet, noch ${time}`,
    pausesIn: (time) => `Pausiert in ${time}`,
    endOfChapter: 'Pausiert, wenn dieses Kapitel endet',
    chapterIn: (time) => `${time} bis zum Ende des Kapitels`,
    tape: {
      endOfTrack: 'Pausiert am Ende dieses Teils',
      thenToTheEnd: (time) => `Noch ${time}, dann bis zum Ende des Teils`,
    },
  },
};
