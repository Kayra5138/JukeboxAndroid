import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: 'Problem melden',
      note: 'Öffnet ein GitHub-Issue mit bereits ausgefüllten Angaben. Gesendet wird erst, wenn du es abschickst.',
    },
    title: 'Problem melden',
    intro:
      'Von diesem Bildschirm aus verlässt nichts dein Gerät. „GitHub öffnen“ legt ein neues Issue an, in dem der Text unten schon steht; dort kannst du ihn lesen und ändern, und gesendet wird er nur, wenn du ihn abschickst.',
    details: 'Das kommt ins Issue',
    detailsNote: 'Version und Gerät kommen in eigene Felder des Formulars, der Rest ins letzte. Deine Songs werden nie genannt.',
    errors: {
      title: 'Letzte Fehler einfügen',
      note:
        'Probleme, die Jukebox selbst bemerkt hat, etwa ein Download oder eine Suche, die fehlgeschlagen ist. Songtitel, Adressen und Dateipfade wurden vor dem Speichern entfernt.',
      none: 'Es wurden keine Fehler festgehalten.',
      trimmed: 'Die ältesten Fehler fehlen im Link, damit er kurz genug zum Öffnen bleibt. „Kopieren“ enthält alle.',
    },
    open: 'GitHub öffnen',
    openHint: 'Öffnet im Browser ein neues, ausgefülltes Issue, das noch nicht gesendet ist',
    copy: 'Kopieren',
    copyNote: 'Kein GitHub-Konto? „Kopieren“ legt denselben Text in die Zwischenablage, zum Einfügen in ein Issue oder eine Nachricht.',
    copied: 'Kopiert',
    openFailed: 'Der Link ließ sich nicht öffnen. Kopier den Text und füg ihn stattdessen in ein Issue ein.',
    copyFailed: 'Diese Version der App kann die Zwischenablage nicht nutzen. Markier den Text oben und kopier ihn von Hand.',
  },

  update: {
    available: (version) => `Jukebox ${version} ist verfügbar`,
    note: 'Wenn du über Obtainium installiert hast, bietet es dir das Update dort an. Sonst tipp hier, um die Release-Seite zu öffnen und es herunterzuladen.',
    hint: 'Öffnet die Release-Seite im Browser',
    tab: (settings) => `${settings}, ein Update ist verfügbar`,
    heading: 'Updates',
    check: {
      title: 'Nach neuerer Jukebox-Version suchen',
      note: 'Höchstens einmal am Tag, wenn du die App öffnest, fragt Jukebox bei GitHub nach, welche Version die neueste ist. Dabei wird nichts über dich oder deine Bibliothek gesendet, und nichts wird heruntergeladen.',
    },
  },
};
