import { common } from './common.ts';
import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';
import { pad2 } from '../write.ts';

const files = common.files;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: 'titre',
  artist: 'artiste',
  album: 'album',
  albumArtist: 'artiste de l’album',
  genre: 'genre',
  year: 'année',
  track: 'numéro de piste',
  disc: 'numéro de disque',
  cover: 'pochette',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/*
  « Titre » is both a track and the Title field, as in every French player;
  the track's position on its record is therefore « numéro de piste ».
*/
export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'Général', tags: 'Tags', lyrics: 'Paroles' },
    missing:
      'Ce titre n’est plus dans la bibliothèque. Il a peut-être été supprimé, déplacé, ou se trouve en dehors du dossier que lit Jukebox.',
    goBack: 'Retour',
  },

  lookUp: 'Rechercher',
  searchFailed: 'La recherche n’a pas abouti.',

  general: {
    fields: {
      title: 'Titre',
      artist: 'Artiste',
      album: 'Album',
      albumArtist: 'Artiste de l’album',
      year: 'Année de sortie',
      trackNumber: 'Numéro de piste',
      discNumber: 'Numéro de disque',
    },
    notAYear: 'Ce n’est pas une année.',
    notAPlace: 'Un nombre entier, à partir de 1.',

    chooseCoverLabel: 'Choisir une pochette dans la galerie',
    noCover: 'Pas de pochette',
    chooseFromGallery: 'Choisir dans la galerie',
    removeCover: 'Retirer la pochette',
    keepCover: 'Garder l’ancienne',
    coverChosen: 'Pochette choisie. Enregistre pour la garder.',

    lookUpHint:
      'Recherche le titre et l’artiste tels qu’ils sont écrits ci-dessous, et remplit ce qui est trouvé : noms, album, année, place sur le disque et pochette.',
    nothingFound: 'Rien n’a été trouvé pour ce titre et cet artiste.',
    found: (sources, withCover) =>
      `Infos trouvées sur ${sources.join(' et ')}${withCover ? ', pochette comprise' : ''}. Vérifie-les, puis enregistre pour les garder.`,

    discard: 'Annuler ma modification',
    saveHint:
      'Ce qui est enregistré ici est considéré comme venant de toi : une nouvelle recherche dans la bibliothèque laissera ce titre tel quel au lieu de l’écraser.',
    editGone: 'Ta modification a été supprimée. Une recherche peut de nouveau remplir ces champs.',

    inFile: 'Dans le fichier',
    writeLabel: 'Écrire ces infos dans le fichier',
    writeToFile: 'Écrire dans le fichier',
    saveFirst: 'Enregistre d’abord. Seul ce qui a été enregistré est écrit dans le fichier.',
    writeHint:
      'Écrit dans le fichier lui-même le titre, l’artiste, l’album, l’année, les numéros de piste ' +
      'et de disque tels que la bibliothèque les affiche, le premier tag comme genre et une pochette ' +
      'enregistrée ici, là où les autres lecteurs et appareils les trouveront. Android demande ' +
      'l’autorisation avant toute modification. Le reste du contenu du fichier n’est pas touché, ' +
      'et les paroles ne sont pas écrites.',
    cannotWrite: 'Seuls les fichiers MP3 et FLAC peuvent être modifiés. Les infos de celui-ci restent dans l’app.',
    nothingWritten: 'Rien n’a été écrit.',
    couldNotWrite: 'L’écriture a échoué.',

    listening: 'Écoute',
    timesPlayed: 'Nombre d’écoutes',
    playedToEnd: 'Écouté jusqu’au bout',
    timeSpent: 'Temps d’écoute',
    firstPlayed: 'Première écoute',
    lastPlayed: 'Dernière écoute',
    never: 'jamais',
    listenedSeconds: (seconds) => `${format.number(seconds)} ${one(seconds, 'seconde', 'secondes')}`,
    listenedMinutes: (minutes) => `${format.number(minutes)} ${one(minutes, 'minute', 'minutes')}`,
    listenedHours: (hours, minutes) => `${format.number(hours)} h ${pad2(minutes)}`,

    file: 'Fichier',
    name: 'Nom',
    folder: 'Dossier',
    length: 'Durée',
    detailsFrom: 'Source des infos',
    /* Said of a name, a folder and a length alike, so a word that has no gender. */
    unknown: 'indisponible',
    from: {
      notLookedUp: 'aucune recherche',
      yourEdit: 'ta modification',
      notFound: 'rien trouvé',
      lookup: 'une recherche',
    },
  },

  tags: {
    lookUpHint:
      'Recherche les tags de ce titre. Ceux que tu as saisis restent ; ceux qu’une recherche précédente avait apportés sont remplacés par ce qu’elle trouve maintenant.',
    noneFound: 'Aucun tag trouvé pour ce titre.',
    found: (count, source) =>
      `${format.number(count)} ${one(count, 'tag trouvé', 'tags trouvés')} sur ${source}. Organise-les, puis enregistre pour les garder.`,
    saveHint:
      'Le premier tag est celui qui compte comme genre. Un tag que tu as saisi est considéré comme le tien : aucune recherche ultérieure ne le retirera.',
  },

  editor: {
    label: 'Tags',
    add: 'Ajouter un tag',
    moveUp: (tag) => `Monter le tag ${tag}`,
    moveDown: (tag) => `Descendre le tag ${tag}`,
    remove: (tag) => `Retirer le tag ${tag}`,
  },

  tagPrompt: {
    heading: (count) =>
      `Ajouter un tag à ${format.number(count)} ${one(count, 'titre', 'titres')}`,
    placeholder: 'Tag',
  },

  lyrics: {
    lookUpHint:
      'Recherche les paroles de ce titre comme le fait la lecture, et remplace celles qui sont enregistrées si elle en trouve.',
    nothingMatched: 'Rien ne correspond à ce titre. La recherche ci-dessous n’écarte rien.',
    foundAndSaved: 'Trouvées et enregistrées.',
    nothingCameBack: 'Aucun résultat pour cette recherche.',
    cleared: 'Effacées. La prochaine recherche cherchera de nouveau.',
    notSeconds: 'Ce n’est pas un nombre de secondes.',

    stored: 'Paroles enregistrées',
    none: 'Aucune pour l’instant',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Synchronisées' : 'Non synchronisées'}, ${byHand ? 'choisies à la main' : 'issues de LRCLIB'}` +
      (lines > 0 ? ` · ${format.number(lines)} ${one(lines, 'ligne', 'lignes')}` : ''),
    forget: 'Oublier et chercher à nouveau',
    saveChanges: 'Enregistrer les modifications',
    timedHint:
      'Chaque ligne garde le temps placé devant elle. Modifie les mots mais laisse les crochets, sinon la ligne perd sa place.',
    plainHint: 'Modifie ce que tu veux. Les paroles enregistrées sont considérées comme les tiennes et aucune recherche ne les remplace.',

    timing: 'Synchronisation',
    timingHint:
      'Décale toutes les lignes à la fois. À utiliser quand les paroles sont justes mais arrivent trop tôt ou trop tard : ouvre le lecteur et ajuste jusqu’à ce qu’elles tombent juste, ou touche le chiffre pour le saisir. Un décalage positif fait arriver les paroles plus tard.',
    earlier: (seconds) => `−${seconds} s`,
    later: (seconds) => `+${seconds} s`,
    shiftedEarlier: (written) => `−${written} s`,
    shiftedLater: (written) => `+${written} s`,
    noShift: 'aucun décalage',
    reset: 'Réinitialiser',
    offsetHeading: 'De combien les paroles sont-elles décalées ?',
    offsetPlaceholder: 'En secondes, par ex. 1,5 ou -0,75',
    typeOffset: 'Saisir un décalage précis',
    wordsField: 'Paroles',

    byHand: 'Recherche manuelle',
    byHandHint:
      'Ici, rien n’est écarté, contrairement à la recherche automatique, qui refuse tout ce dont la durée ne correspond pas : c’est pour cela que certains titres ne trouvent jamais leurs paroles.',
    queryPlaceholder: 'Artiste et titre',
    candidateTimed: 'synchronisées',
    candidatePlain: 'texte seul',

    paste: 'Coller',
    pasteHint: 'Accepte un fichier LRC ou du texte simple. Avec des horodatages, les paroles sont synchronisées.',
    savePasted: 'Enregistrer le texte collé',
  },

  library: {
    coversSaved: (count) =>
      `${format.number(count)} ${one(count, 'pochette d’album ajoutée', 'pochettes d’album ajoutées')}.`,
    stoppedOffline: (matched) =>
      `Aucune réponse, la recherche s’est donc arrêtée après ${format.number(matched)} ${one(matched, 'titre identifié', 'titres identifiés')}. Rien n’a été écrit pour les autres : ils attendent toujours leur tour.`,
    serviceUnreachable: (service) =>
      `Impossible de joindre ${service}, la recherche a donc continué sans ce service. Ce qui en avait besoin est resté tel quel et sera retenté la prochaine fois.`,
    stoppedUnexpectedly: 'La recherche s’est arrêtée de façon inattendue.',

    nothingAnswered: 'Aucune réponse. Arrêt.',
    rateLimited: 'Un des services a demandé une pause. Il sera de nouveau sollicité dans une minute.',
    lookingUp: 'Recherche…',
    lookingUpProgress: (done, total) =>
      `Recherche… ${format.number(done)} ${one(done, 'titre traité', 'titres traités')} sur ${format.number(total)}`,
    lookingUpAlbum: (album, done, total) =>
      `Recherche de « ${album} »… ${format.number(done)} ${one(done, 'titre traité', 'titres traités')} sur ${format.number(total)}`,
    soFar: (matched, covers) =>
      `${format.number(matched)} ${one(matched, 'identifié', 'identifiés')}, ${format.number(covers)} ${one(covers, 'pochette', 'pochettes')} pour l’instant`,
    stop: 'Arrêter',
    lookupChannel: 'Recherches d’informations',

    selected: (count) => `${format.number(count)} ${one(count, 'sélectionné', 'sélectionnés')}`,
    summary: (matched, edited, notFound, untried) =>
      [
        `${format.number(matched)} ${one(matched, 'identifié', 'identifiés')}`,
        edited > 0 ? `${format.number(edited)} ${one(edited, 'modifié', 'modifiés')}` : null,
        `${format.number(notFound)} ${one(notFound, 'introuvable', 'introuvables')}`,
        `${format.number(untried)} non ${one(untried, 'essayé', 'essayés')}`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Réinitialiser',
    lookUpMissing: 'Compléter les infos',
    hint: 'Touche un titre pour le corriger à la main. Fais glisser le doigt vers le bas sur les cases pour en cocher une série.',
    searchPlaceholder: 'Rechercher dans ces titres',

    noGenre: 'pas de genre',
    noMatch: 'aucune correspondance',
    notLookedUp: 'pas encore recherché',
    matchedSpoken: (artist, title) => `Identifié : ${artist} — ${title}`,
    manualSpoken: (artist, title) => `Saisi à la main : ${artist} — ${title}`,
  },

  selection: {
    more: 'Plus…',
    moreHint: 'Tout ce qu’on peut faire avec les titres sélectionnés',
    heading: (count) =>
      `${format.number(count)} ${one(count, 'titre sélectionné', 'titres sélectionnés')}`,
    sections: { find: 'Rechercher', change: 'Modifier', other: 'Autres' },
    actions: {
      lookUp: {
        label: 'Rechercher les infos',
        hint: 'Oublie ce qui a été trouvé pour eux et les recherche à nouveau, pochettes comprises. Tes propres modifications restent.',
      },
      covers: {
        label: 'Rechercher les pochettes',
        hint: 'Seulement les pochettes, pour ceux qui n’en ont pas. Rien d’autre n’est recherché à nouveau, et une pochette que tu as choisie ou retirée reste telle quelle.',
      },
      lyrics: {
        label: 'Rechercher les paroles',
        hint: 'D’abord dans les fichiers et les .lrc, puis sur LRCLIB. Les paroles que tu as choisies restent.',
      },
      edit: {
        label: 'Modifier les infos ensemble',
        hint: 'Artiste, artiste de l’album, album ou année, pour tous d’un coup',
      },
      addTag: { label: 'Ajouter un tag', hint: 'Un tag, ajouté à tous' },
      removeTag: { label: 'Retirer un tag', hint: 'Un de leurs tags, retiré de tous' },
      cover: { label: 'Choisir une pochette', hint: 'Une image de ta galerie, pour tous' },
      write: {
        label: 'Écrire dans les fichiers',
        hint: 'Écrit dans les fichiers eux-mêmes les infos que la bibliothèque affiche. Android demande d’abord.',
      },
      addToList: { label: 'Ajouter à une liste', hint: 'Les met dans une de tes listes' },
      reset: {
        label: 'Réinitialiser',
        hint: 'Oublie ce que les recherches ont trouvé pour eux. Tes propres modifications restent.',
      },
      delete: { label: 'Supprimer du téléphone', hint: 'Efface les fichiers. Android demande d’abord.' },
    },
    busy: 'Une recherche est déjà en cours. Attends qu’elle se termine, ou arrête-la.',

    editHeading: (count) => `Modifier ${common.tracks(count)}`,
    editHint:
      'Ne remplis que ce qui doit être pareil pour tous. Une case vide laisse chaque titre tel quel ; pour vider un champ sur tous, coche l’option en dessous. Le nom de chaque titre et ses numéros de piste et de disque ne sont pas touchés.',
    keepEach: 'Chacun garde le sien',
    empty: 'Vide',
    clearOn: { remove: 'Retirer de tous', own: 'Prendre l’artiste de chaque fichier' },
    cleared: { remove: 'Sera retiré de tous', own: 'L’artiste de chaque fichier' },
    edited: (count) =>
      count === 1
        ? 'Enregistré. C’est maintenant ta modification, et les recherches n’y touchent plus.'
        : `Enregistré pour ${common.tracks(count)}. Ce sont maintenant tes modifications, et les recherches n’y touchent plus.`,

    tagAdded: (tag, count) => `« ${tag} » est maintenant sur ${common.tracks(count)}.`,
    removeTagHeading: (count) => `Retirer un tag de ${common.tracks(count)}`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'Aucun de ces titres n’a de tag.',
    tagRemoved: (tag, count) => `« ${tag} » a été retiré de ${common.tracks(count)}.`,

    resetQuestion: (count) => `Réinitialiser ${common.tracks(count)} ?`,
    resetBody:
      'Ce que les recherches ont trouvé pour eux est oublié, et ils comptent comme non recherchés. Tes propres modifications restent. C’est irréversible.',

    coversProgress: (done, total) =>
      `Recherche des pochettes… ${format.number(done)} ${one(done, 'titre traité', 'titres traités')} sur ${format.number(total)}`,
    coversNone: 'Aucune nouvelle pochette trouvée.',
    lyricsProgress: (done, total) =>
      `Recherche des paroles… ${format.number(done)} ${one(done, 'titre traité', 'titres traités')} sur ${format.number(total)}`,
    lyricsSoFar: (found) => `Trouvées pour l’instant : ${format.number(found)}`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0 ? `Paroles trouvées pour ${format.number(found)} sur ${format.number(wanted)}.` : null,
        had > 0
          ? had === 1
            ? '1 les avait déjà.'
            : `${format.number(had)} les avaient déjà.`
          : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Rien à chercher : tu as choisi toi-même les paroles de ces titres.',
    lyricsOffline:
      'LRCLIB est injoignable, la recherche s’est donc arrêtée. Le reste pourra être réessayé plus tard.',
  },

  write: {
    heading: (count) => `Écrire les infos dans ${files(count)} ?`,
    body: (count) =>
      `${files(count)} ${one(count, 'va être modifié', 'vont être modifiés')} : le titre, l’artiste, l’album, l’année, ` +
      'les numéros de piste et de disque, le premier tag comme genre et la pochette enregistrée, ' +
      'tels que la bibliothèque les affiche, sont écrits dans chaque fichier. Android te demandera ' +
      'l’autorisation. Le reste du contenu d’un fichier n’est pas touché.',
    noneHeading: 'Aucun de ces fichiers ne peut être modifié',
    noneBody: 'Seuls les fichiers MP3 et FLAC peuvent être modifiés, et pas le titre en cours de lecture.',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `${files(otherKind)} d’un autre format ${one(otherKind, 'sera ignoré', 'seront ignorés')}, ainsi que le titre en cours de lecture.`
        : otherKind > 0
          ? `${files(otherKind)} d’un autre format ${one(otherKind, 'sera ignoré', 'seront ignorés')}.`
          : 'Le titre en cours de lecture sera ignoré.',
    confirmLabel: (count) => `Écrire les infos dans ${files(count)}`,
    confirm: 'Écrire',
    nothingWritten: 'Rien n’a été écrit.',
    couldNotStart: 'Impossible de démarrer.',

    writing: 'Écriture dans les fichiers',
    progressLabel: (done, total) =>
      `${files(done)} ${one(done, 'écrit', 'écrits')} sur ${format.number(total)}`,
    progress: (done, total) => `${format.number(done)} sur ${format.number(total)}`,
    stopping: 'Arrêt une fois ce fichier terminé.',
    keepOpen: 'Chaque fichier est vérifié avant que l’original ne soit modifié. Garde l’app ouverte.',
    stopLabel: 'Arrêter après le fichier en cours d’écriture',
    stop: 'Arrêter',
    stoppedShort: (count) => `Arrêté : ${files(count)} non ${one(count, 'traité', 'traités')}.`,

    written: (changed) =>
      changed.length > 0
        ? `Écrit : ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Écrit.',
    unchanged: 'Contient déjà tout cela. Laissé tel quel.',
    skippedPlaying: 'Ignoré : en cours de lecture. Réessaie quand il ne le sera plus.',
    skippedFormat: 'Ignoré : seuls les fichiers MP3 et FLAC peuvent être modifiés.',
    failed: (reason) => `Échec : ${reason}`,
    noReason: 'L’écriture a échoué. Le fichier n’a pas été touché.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`${files(counts.written)} ${one(counts.written, 'écrit', 'écrits')}.`);
      if (counts.unchanged > 0) parts.push(`${files(counts.unchanged)} déjà à jour.`);
      if (counts.skipped > 0) parts.push(`${files(counts.skipped)} ${one(counts.skipped, 'ignoré', 'ignorés')}.`);
      if (counts.failed > 0) parts.push(`${files(counts.failed)} en échec.`);
      return parts.length > 0 ? parts.join(' ') : 'Rien à écrire.';
    },
  },

  same: {
    note:
      'On dirait un seul morceau sous deux fichiers. Fusionner transfère vers le second tout ce que possède le premier : ses écoutes, ses tags, ses paroles et sa place dans les listes. Les garder séparés laisse les deux tels quels, et cette paire ne te sera plus proposée.',
    failed: (error) => `L’opération a échoué et rien n’a été modifié. ${error}`,
    empty: 'Plus rien à trancher.',
    from: 'De',
    into: 'Vers',
    keepApart: 'Garder séparés',
    merge: 'Fusionner',
    bulk: {
      mergeDelete: 'Fusionner et supprimer le premier fichier',
      deleteToo: 'Supprimer aussi le premier fichier de chaque paire',
      deleteNote: 'Android demande avant toute suppression.',
      notDeleted: 'Les fichiers n’ont pas été supprimés.',
      deleted: (count) => `${format.number(count)} ${one(count, 'fichier supprimé', 'fichiers supprimés')}.`,
      choose: 'Choisir cette paire',
      chosen: (count) => `${format.number(count)} ${one(count, 'paire choisie', 'paires choisies')}`,
      merge: (count) => `Fusionner ${format.number(count)}`,
      keepApart: (count) => `Garder ${format.number(count)} séparées`,
      confirm: (count) =>
        one(
          count,
          'Fusionner 1 paire ? Les écoutes, tags, paroles et places dans les listes du premier fichier passent au second, sans retour possible.',
          `Fusionner ${format.number(count)} paires ? Dans chacune, les écoutes, tags, paroles et places dans les listes du premier fichier passent au second, sans retour possible.`
        ),
      done: (done, skipped) =>
        skipped > 0
          ? `${format.number(done)} ${one(done, 'paire traitée', 'paires traitées')} ; ${format.number(skipped)} ${one(skipped, 'était déjà réglée', 'étaient déjà réglées')} par une autre réponse.`
          : `${format.number(done)} ${one(done, 'paire traitée', 'paires traitées')}.`,
    },
    unknown: 'Inconnu',
    noFileName: 'Nom de fichier inconnu',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) parts.push(`${format.number(side.listens)} ${one(side.listens, 'écoute', 'écoutes')}`);
      if (side.tags > 0) parts.push(`${format.number(side.tags)} ${one(side.tags, 'tag', 'tags')}`);
      if (side.lyrics) parts.push('paroles');
      if (side.lists > 0) parts.push(`dans ${format.number(side.lists)} ${one(side.lists, 'liste', 'listes')}`);
      return parts.length > 0 ? parts.join(' · ') : 'Rien pour l’instant';
    },
  },
};
