import { NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Leicht', normal: 'Normal', hard: 'Schwer', harder: 'Extrem' },

  setup: {
    title: 'Mitspielen',
    noTrack: 'Starte einen Titel, dann werden die Tasten daraus gebaut.',
    making: 'Die Aufnahme wird angehört…',
    missing: 'Dieser Titel lässt sich nicht lesen.',
    record: (title, keys) =>
      `${title ?? 'Diese Aufnahme'} – ${keys} ${oneOrMany(keys, 'Taste', 'Tasten')}`,
    latency:
      'Bei kabellosen Kopfhörern kommt der Ton verspätet an. Wenn die Tasten der Musik hinterherhinken, verschieb das hier, bis beides zusammenpasst.',
    earlier: `−20${NNBSP}ms`,
    later: `+20${NNBSP}ms`,
    offset: (ms) => `${ms}${NNBSP}ms`,
    start: 'Von vorn spielen',
    starting: 'Startet…',
    screenReader:
      'Gespielt wird, indem du im Takt der Musik tippst, und TalkBack fängt diese Tipps ab. Pausiere TalkBack, um zu spielen.',
  },

  hud: {
    score: (points) => `Punktestand ${points}`,
  },

  pause: {
    title: 'Pausiert',
    resume: 'Weiter',
    toMenu: 'Zurück zum Menü',
  },

  ending: {
    clean: 'Fehlerfrei',
    won: 'Geschafft',
    over: 'Vorbei',
    lapse: 'Eine Taste ist dir entwischt.',
    empty: 'Der Tipp ging ins Leere.',
    toTheEnd: 'Bis zum Ende der Aufnahme.',
    figures: (hit, total, held, best, percent) =>
      `${hit} von ${total} ${oneOrMany(total, 'Taste', 'Tasten')}${held > 0 ? ` · ${held} gehalten` : ''} · beste Serie: ${best} · ${percent}${NNBSP}%`,
    again: 'Nochmal',
  },
};
