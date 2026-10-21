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
    look: {
      heading: 'Wähle ein Design',
      note: 'Tipp eins an, um es auszuprobieren.',
      more:
        'Weitere Designs und welche zwei beim Folgen des Systems verwendet werden, findest du unter Einstellungen → Aussehen.',
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
      'Halte einen Song gedrückt, um sein Menü zu öffnen: zu einer Liste hinzufügen, Details bearbeiten oder als Piano Tiles spielen. Zieh einen Song nach rechts, um ihn als Nächstes zu spielen, oder nach links, um ihn zur Warteschlange hinzuzufügen.',
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
  },

  discoverEarly:
    'Solange du noch wenig gehört hast, geht Entdecken von den Künstlern aus, von denen du die meisten Songs hast, und lernt aus dem, was du abspielst.',
};
