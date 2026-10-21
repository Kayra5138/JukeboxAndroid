import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

/** [seconds] arrives already written, `83,5`; under 2 the unit is singular. */
const secondsIn = (seconds: string) =>
  Math.abs(Number(seconds.replace(/[\s  ]/g, '').replace(',', '.'))) < 2
    ? 'seconde'
    : 'secondes';

export const lyrics: Strings['lyrics'] = {
  none: 'Paroles introuvables.',
  translating: 'Traduction…',
  seekTo: (seconds) => `Aller à ${seconds} ${secondsIn(seconds)}`,

  translation: {
    romaji:
      'Ces paroles sont du japonais écrit en lettres latines, et aucune version dans l’écriture d’origine n’a été trouvée pour la traduire à la place.',
    unsupported: 'Pas de traduction pour cette langue.',
    unavailable: 'La traduction n’est pas disponible sur cet appareil.',
    misaligned: 'La traduction ne correspondait pas ligne à ligne.',
    failed: 'La traduction a échoué.',
  },

  from: {
    file: 'Depuis le fichier',
    lrc: 'Depuis un fichier .lrc',
    lookup: 'Depuis LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Synchronisées' : 'Non synchronisées'}, ${from === 'file' ? 'issues du fichier lui-même' : 'issues d’un fichier .lrc à côté'}` +
    (lines > 0 ? ` · ${format.number(lines)} ${one(lines, 'ligne', 'lignes')}` : ''),

  found: {
    file: 'Trouvées dans le fichier lui-même et enregistrées.',
    lrc: 'Trouvées dans un fichier .lrc à côté du morceau et enregistrées.',
  },

  folders: {
    title: 'Lire les fichiers .lrc à côté des morceaux',
    note: 'Les paroles d’un fichier .lrc qui porte le nom du morceau s’affichent avant toute recherche en ligne. Android ne laisse une app lire ces fichiers que dans un dossier que tu choisis : le dossier de ta musique t’est donc demandé une fois.',
    add: 'Ajouter un autre dossier',
    remove: 'Retirer',
    removeLabel: (folder) => `Ne plus lire les fichiers .lrc dans ${folder}`,
    elsewhere: 'Ce dossier n’est pas sur le téléphone, donc aucun de tes morceaux ne s’y trouve. Choisis le dossier du téléphone où est ta musique.',
  },
};
