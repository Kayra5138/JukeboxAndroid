import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: 'Wähle deine Sprache',
    note: 'Du kannst sie jederzeit in den Einstellungen ändern.',
    go: 'Weiter',
    made:
      'Jukebox wird von einer einzelnen Person entwickelt. Außer Englisch wurden alle Sprachen von einer KI übersetzt und noch von niemandem geprüft, der sie spricht. Wenn dir etwas falsch vorkommt, sag es gern auf GitHub.',
  },

  setup: {
    step: (at: number, of: number) =>
      `Schritt ${format.number(at)} von ${format.number(of)}`,
    skip: 'Überspringen',
    skipHint: 'Lässt den Rest, wie er ist, und öffnet Jukebox',
    back: 'Zurück',
    next: 'Weiter',
    done: 'Fertig',
    update:
      'Ein paar Einstellungen, neu in dieser Version. Du kannst sie jederzeit in den Einstellungen ändern.',
    folder: {
      heading: "Dein Musikordner",
      note: "Aus welchem Ordner Jukebox deine Musik liest und wohin es Downloads speichert.",
      jukebox: { label: (folder: string) => `Der eigene Ordner von Jukebox (${folder})`, note: "Nur, was in diesem Ordner liegt. Downloads werden hier gespeichert, und Musik anderer Apps in Music bleibt draußen." },
      music: { label: (folder: string) => `Ganz Music (${folder})`, note: "Alles im Ordner Music und in den Ordnern darin, wie bisher." },
      current: "Der zuvor gewählte Ordner.",
      songs: (count: number) => `${format.number(count)} ${count === 1 ? 'Titel' : 'Titel'}`,
      more: "Jederzeit änderbar unter Einstellungen → Bibliothek → Bibliotheksordner, wo auch jeder andere Ordner gewählt werden kann.",
    },
    look: {
      heading: 'Wähle ein Design',
      note: 'Tipp eins an, um es auszuprobieren.',
      more:
        'Weitere Designs und welche zwei beim Folgen des Systems verwendet werden, findest du unter Einstellungen → Aussehen & Gefühl.',
    },
    views: {
      heading: 'Was die Bibliothek zeigt',
      note: 'Die Ansichten deiner Musik, als Umschalter über der Bibliothek. Schalte die ein, die du möchtest.',
      more: 'Das kannst du jederzeit unter Einstellungen → Aussehen & Gefühl ändern.',
    },
    discover: {
      heading: 'Entdecken',
      note:
        'Entdecken findet Songs, die du noch nicht hast, von den Künstlern in deiner Bibliothek und ähnlichen, und holt sie von YouTube, wenn du sie abspielst.',
      more:
        'Wie lang die Liste ist, wie oft sie neu erstellt wird und mehr findest du in den Entdecken-Einstellungen.',
    },
  },

  offer: {
    heading: 'Cover und Details suchen?',
    body: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'deiner Songs wurde', 'deiner Songs wurden')} noch nicht nachgeschlagen. Jukebox kann Cover, Künstler und Alben bei MusicBrainz und im iTunes-Katalog von Apple finden.`,
    privacy:
      'An diese beiden werden nur die Namen der Songs gesendet, sonst nichts. Es läuft im Hintergrund, während du hörst, und lässt sich auch später unter Einstellungen → Bibliothek → Tags erledigen.',
    accept: 'Suchen',
    decline: 'Nicht jetzt',
  },

  progress: {
    starting: 'Cover und Details werden gesucht…',
    counting: (done, total) =>
      `Cover und Details werden gesucht · ${format.number(done)} von ${format.number(total)}`,
    album: (album, done, total) =>
      `„${album}“ wird nachgeschlagen · ${format.number(done)} von ${format.number(total)}`,
    covers: (done, total) =>
      `Cover werden gesucht · ${format.number(done)} von ${format.number(total)}`,
    lyrics: (done, total) =>
      `Songtexte werden gesucht · ${format.number(done)} von ${format.number(total)}`,
    hint: 'Öffnet den Bildschirm „Tags“, auf dem du das Nachschlagen verfolgen und stoppen kannst',
  },

  tips: {
    library:
      'Halte einen Song gedrückt, und unter deinem Finger öffnet sich ein Ring: Fahr mit dem Finger auf ein Feld und lass los. Lässt du los, ohne dich zu bewegen, öffnet sich das ganze Menü, Piano Tiles inklusive. Zieh einen Song nach rechts, um ihn als Nächstes zu spielen, oder nach links, um ihn zur Warteschlange hinzuzufügen.',
    player:
      'Unter den Steuerelementen blendet die Songtext-Taste den Text ein, während der Song läuft; sobald er zu sehen ist, übersetzt ihn die Taste, die daneben erscheint. Hinter dem Zahnrad findest du Tempo und Tonhöhe, Effekte und den Sleep-Timer.',
    discover:
      'Entdecken findet Songs, die du noch nicht hast. Bis du eine Weile gehört hast, geht es von den Künstlern aus, von denen du die meisten Songs hast, und lernt aus dem, was du abspielst.',
    dismiss: 'Verstanden',
    dismissHint: 'Blendet diesen Tipp dauerhaft aus',
  },

  settings: {
    title: 'Erster Start',
    note:
      'Zeigt Jukebox wie am ersten Tag: die ersten Einstellungen, das Angebot, Cover zu suchen, und die Tipps. Deine Musik, Listen und Einstellungen bleiben, wie sie sind.',
    again: 'Erneut zeigen',
    /** Asked before the first start is shown again: it takes over the screen. */
    ask: { title: 'Ersten Start erneut zeigen?', body: 'Die ersten Einstellungen, das Angebot, Cover zu suchen, und die Tipps kommen wieder. Deine Musik, Listen und Einstellungen bleiben, wie sie sind.' },
  },

  discoverEarly:
    'Solange du noch wenig gehört hast, geht Entdecken von den Künstlern aus, von denen du die meisten Songs hast, und lernt aus dem, was du abspielst.',
};
