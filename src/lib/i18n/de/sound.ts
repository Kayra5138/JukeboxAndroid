import { comma, format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/*
  "Übersteuern" is clipping, "Vorverstärkung" the preamp, "Band" (plural
  "Bänder") one band of the equalizer, and "linear" is flat — the word German
  equalizers use for a curve that changes nothing.
*/
export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)}${NNBSP}%`,

  effects: {
    failures: {
      unsupported: 'Installiere die aktualisierte Android-Version, um Effekte zu nutzen.',
      unreadable: 'Die Effekte konnten nicht gelesen werden. Sie bleiben aus, bis es erneut versucht wird.',
      unsent: 'Diese Einstellung hat den Player nicht erreicht.',
    },
    title: 'Effekte',
    presets: {
      off: { name: 'Aus', hint: 'Die Aufnahme, wie sie ist' },
      mono: { name: 'Mono', hint: 'Auf beiden Ohren gleich – für einen einzelnen Ohrhörer' },
      wide: { name: 'Breit', hint: 'Die Seiten weiter nach außen' },
      headphones: { name: 'Kopfhörer', hint: 'Holt hart gepannte Mixe aus deinem Kopf' },
      '8d': { name: '8D', hint: 'Der Klang kreist langsam um dich' },
      karaoke: { name: 'Quasi-Karaoke', hint: 'Drängt die Mitte zurück' },
    },
    voices: {
      off: { name: 'Aus', hint: 'Die Aufnahme, wie sie ist' },
      robot: { name: 'Roboter', hint: 'Mit einem tiefen Ton moduliert – metallisch, glockenartig' },
      vintage: { name: 'Vintage', hint: 'Weniger Bits, ein gröberer Takt und die Höhen abgeschnitten' },
      swirl: { name: 'Wirbel', hint: 'Ein langsamer Schwenk, wie ein Jet, der vorüberfliegt' },
      chipmunk: { name: 'Helium', hint: 'Eine Quinte höher, das Tempo unverändert' },
      squeak: { name: 'Mehr Helium', hint: 'Eine ganze Oktave – kaum noch eine Stimme' },
    },
    ownSettings: 'Deine Einstellungen',
    howMuch: 'Stärke',
    voiceNote:
      'Jede Stimme behält die eigenen Obertöne der Aufnahme und verändert sie, sodass der Song darunter derselbe bleibt. Dreh die Stärke herunter, um mehr vom Original zu hören.',

    stereo: 'Stereo',
    width: 'Breite',
    mono: 'Mono',
    asRecorded: 'Original',
    balance: 'Balance',
    centre: 'Mitte',
    left: (percent) => `${percent}${NNBSP}% links`,
    right: (percent) => `${percent}${NNBSP}% rechts`,
    swap: { title: 'Kanäle tauschen', note: 'Links wird rechts. Für ein falsch verdrahtetes Kabel.' },

    headphones: 'Kopfhörer',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'Ein wenig von jedem Kanal erreicht das andere Ohr, verzögert und gedämpft, wie bei Lautsprechern. Das nimmt alten, hart gepannten Mixen die Anstrengung. Über Lautsprecher bringt es nichts.',

    rotation: 'Rotation',
    depth: 'Tiefe',
    turnTakes: 'Eine Runde dauert',
    seconds: (count) => `${comma(count)}${NNBSP}s`,
    rotationNote:
      'Was man 8D nennt: Der Klang kreist langsam um dich. Für Kopfhörer gedacht – über Lautsprecher schwankt nur die Lautstärke.',

    level: 'Pegel',
    preamp: 'Vorverstärkung',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Dreh das herunter, wenn Verbreitern oder der Equalizer etwas knacken lässt: So klingen die lautesten Spitzen, wenn ihnen der Platz ausgeht.',
  },

  transitions: {
    missing: 'Diese Version der App enthält noch keine Übergänge.',
    title: 'Überblenden',
    about: 'Ein Titel spielt weiter, während der nächste beginnt, sodass kein harter Schnitt zu hören ist.',
    betweenTracks: 'Zwischen Titeln',
    overlap: 'Überlappung',
    overlapNote:
      'Wie viel vom ausklingenden Titel der nächste überlagert. Bei null enden Titel ganz normal.',
    albums: {
      title: 'Alben zusammenhalten',
      note:
        'Kein Überblenden zwischen aufeinanderfolgenden Titeln eines Albums. Ein Live-Album oder alles, was durchgehend gemischt ist, soll genau diesen Übergang haben.',
    },
    others: {
      manualMs: {
        label: 'Überspringen',
        hint:
          'Weiter oder zurück per Taste. Halte es kurz – eine Taste, die spät reagiert, fühlt sich nicht mehr direkt an.',
      },
      pauseMs: {
        label: 'Pause und Fortsetzen',
        hint: 'Nimmt dem Anhalten und dem Wiederanlaufen die Härte.',
      },
      seekMs: {
        label: 'Spulen',
        hint: 'Nach dem Ziehen der Fortschrittsleiste, die sonst mitten in der Wellenform landet und knackt.',
      },
    },
    equalPower: {
      title: 'Equal-Power-Kurve',
      note:
        'Zwei Titel mit halber Lautstärke sind zusammen nicht halb so laut. Diese Kurve hält den Pegel über die ganze Überlappung; die gerade sackt in der Mitte ab.',
    },
    fewer: 'Weniger Einstellungen',
    more: 'Weitere Übergänge',
    reset: 'Auf Standard zurücksetzen',
    seconds: (written) => `${written}${NNBSP}s`,
  },

  equalizer: {
    missing: 'Diese Version der App enthält den Equalizer noch nicht.',
    title: 'Equalizer',
    attached: 'Formt, was gerade läuft.',
    saved: 'Gespeichert und angewendet, sobald etwas läuft.',
    carried:
      'Was im Equalizer des Geräts eingestellt war, wurde übernommen und ist unter Presets als „Geräte-Equalizer“ gespeichert. Es ist dieselbe Kurve, gebildet aus den Bändern dieses Equalizers, und sie lässt jetzt Platz für das, was sie anhebt – daher ist sie vielleicht etwas leiser als vorher.',
    lost:
      'Was im Equalizer des Geräts eingestellt war, konnte nicht übernommen werden: Seine Bänder ließen sich keinen Frequenzen zuordnen. Dieser Equalizer startet linear.',

    presets: 'Presets',
    saveAs: 'Speichern als…',
    rename: 'Umbenennen…',
    confirmDelete: (name) => `„${name}“ löschen?`,
    importAutoEq: 'AutoEQ importieren…',
    keptAs: (name) => `Gespeichert als „${name}“.`,
    renamedTo: (name) => `Umbenannt in „${name}“.`,

    bands: 'Bänder',
    noBands:
      'Keine Bänder, also linear: die Musik, wie sie aufgenommen wurde. Füge ein Band hinzu, wähle ein Preset oder importiere eine Korrektur für deine Kopfhörer.',
    addBand: 'Band hinzufügen',
    full: (most) => `Mehr als ${most} Bänder passen nicht.`,

    preamp: 'Vorverstärkung',
    automatic: 'Automatisch',
    byHand: 'Manuell',
    nothingBoosted: 'Nichts wird angehoben, also wird auch nichts abgesenkt, um Platz zu schaffen.',
    turnedDown: (by) =>
      `Alles wird um ${by} abgesenkt – so viel, wie der höchste Punkt der Kurve etwas anhebt. Diesen Spielraum braucht eine Anhebung, um nicht zu übersteuern.`,
    typeIt: (now) => `Eingeben · ${now}`,
    typePreamp: (now) => `Vorverstärkung eingeben, aktuell ${now}`,
    clipsAbove: (level) =>
      `Über ${level} können die lautesten Passagen übersteuern, was sich als Verzerrung anhört.`,
    lowEnough: 'Niedrig genug, dass nichts, was diese Kurve anhebt, übersteuert.',

    unbuilt:
      'Diese Version der App spielt noch über den Equalizer des Geräts, den dieser Bildschirm nicht mehr einstellt. Die Bänder kommen mit der nächsten Version; die Regler unten funktionieren wie bisher.',

    tone: 'Klang',
    bassBoost: 'Bass-Boost',
    surround: 'Surround',
    loudness: 'Lautheit',
    toneNote:
      'Diese drei sind die Effekte des Geräts und wirken nach den Bändern. Lautheit hebt eine leise Aufnahme an, ohne den Klang zu verändern. Zu weit aufgedreht übersteuert sie, was sich als Verzerrung der lauten Stellen anhört.',
    resetAll: 'Alles zurücksetzen',

    prompt: {
      keepCurveAs: 'Diese Kurve speichern als',
      keepCorrectionAs: 'Diese Korrektur speichern als',
      namePlaceholder: 'Ein Name, z. B. für welche Kopfhörer',
      keep: 'Speichern',
      aName: 'Ein Name',
      set: 'Übernehmen',
      preampHint: (least, most) => `In Dezibel, von ${comma(least)} bis ${comma(most)}.`,
      frequency: (band) => `Frequenz von Band ${band}`,
      frequencyHint: (least, most) =>
        `In Hertz, von ${least} bis ${most}. 1,2k wird als 1200 gelesen.`,
      gain: (band) => `Verstärkung von Band ${band}`,
      gainHint: (most) => `In Dezibel, von -${comma(most)} bis ${comma(most)}.`,
      q: (band) => `Q von Band ${band}`,
      qHint: (least, most) => `Von ${comma(least)} bis ${comma(most)}.`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'Linear',
      'More bass': 'Mehr Bass',
      'Less boom': 'Weniger Dröhnen',
      Warm: 'Warm',
      'Voices forward': 'Stimmen nach vorn',
      'More air': 'Mehr Luft',
      'Quiet listening': 'Leise hören',
    },
    myCurve: 'Meine Kurve',
  },

  band: {
    types: { peak: 'Peak', lowShelf: 'Tiefen-Shelf', highShelf: 'Höhen-Shelf' },
    said: (band, type, frequency, gain, q) => `Band ${band}: ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Schließt dieses Band',
    opens: 'Öffnet dieses Band zum Bearbeiten',
    kind: (band, type) => `Typ von Band ${band}: ${type}`,
    frequency: 'Frequenz',
    gain: 'Verstärkung',
    widthQ: 'Breite (Q)',
    cornerQ: 'Steilheit (Q)',
    peakHint: 'Ein höheres Q ist ein schmaleres Band: 1 ist etwas mehr als eine Oktave, 10 ein einzelner Ton.',
    shelfHint:
      'Ein Shelf hebt oder senkt alles auf einer Seite seiner Frequenz. Q bestimmt, wie scharf der Knick ist; 0,7 ist üblich.',
    typeIt: 'Eingeben',
    typeFrequency: (band, now) => `Frequenz von Band ${band} eingeben, aktuell ${now}`,
    typeGain: (band, now) => `Verstärkung von Band ${band} eingeben, aktuell ${now}`,
    typeQ: (band, now) => `Q von Band ${band} eingeben, aktuell ${now}`,
    remove: (band) => `Band ${band} entfernen`,
    removeThis: 'Dieses Band entfernen',
  },

  curve: {
    label: (said) => `Frequenzgang. ${said}`,
    flat: 'Linear: Nichts wird angehoben oder abgesenkt.',
    highest: (level, near) => `Höchster Wert ${level} bei etwa ${near}.`,
    lowest: (level, near) => `Tiefster Wert ${level} bei etwa ${near}.`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `Höchster Wert ${high} bei etwa ${highNear}, tiefster ${low} bei etwa ${lowNear}.`,
  },

  autoEq: {
    title: 'Aus AutoEQ importieren',
    about: 'Füge den Inhalt der ParametricEQ.txt eines Kopfhörers ein oder wähle die Datei.',
    textLabel: 'Der Text der ParametricEQ-Datei',
    chooseFile: 'Datei wählen…',

    graphic:
      'Das ist die GraphicEQ-Datei, die für eine andere Art von Equalizer gedacht ist. Die richtige ist ParametricEQ.txt.',
    noneSupported: 'Keiner der Filter in diesem Text ist von einer Art, die dieser Equalizer hat.',
    noneFound:
      'In diesem Text wurden keine Filter gefunden. Eine Zeile sollte so aussehen: „Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70“.',
    imported: (count) => oneOrMany(count, '1 Band importiert.', `${count} Bänder importiert.`),
    leftOut: (count, room) =>
      oneOrMany(
        count,
        `1 weiteres wurde weggelassen: Es ist nur Platz für ${room}.`,
        `${count} weitere wurden weggelassen: Es ist nur Platz für ${room}.`
      ),
    unsupported: (count) =>
      oneOrMany(
        count,
        '1 Filter war von einer Art, die dieser Equalizer nicht hat, und wurde übersprungen.',
        `${count} Filter waren von einer Art, die dieser Equalizer nicht hat, und wurden übersprungen.`
      ),
    adjusted: (count) =>
      oneOrMany(
        count,
        '1 lag außerhalb dessen, worauf sich ein Band einstellen lässt, und wurde angepasst.',
        `${count} lagen außerhalb dessen, worauf sich ein Band einstellen lässt, und wurden angepasst.`
      ),
  },
};
