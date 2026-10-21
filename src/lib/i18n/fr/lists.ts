import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Nomme la liste',
    placeholder: 'Nom de la liste',
    create: 'Créer',
  },

  screen: {
    newList: 'Nouvelle liste',
    fromTag: 'Depuis un tag',
    empty: 'Rien pour l’instant. Une liste, c’est un ordre que tu as choisi : la seule chose que les tags ne peuvent pas retenir.',
    followingTag: (count, tag) =>
      `${format.number(count)} ${one(count, 'titre', 'titres')} · suit le tag ${tag}`,
    fromListening: 'D’après tes écoutes',
    discover: 'Découvrir',
    discoverHint: 'De la musique que tu n’as pas, d’après ce que tu écoutes',

    tagSheet: {
      heading: 'Créer une liste depuis un tag',
      follows: 'Suit le tag',
      copy: 'Une copie',
      followsHint:
        'Toujours tout ce qui porte le tag. Tague quelque chose plus tard et il apparaîtra ici ; rien ne peut y être réordonné ni retiré.',
      copyHint:
        'Prend ce qui porte le tag en ce moment. Ensuite, chacun vit sa vie : la liste est à toi, tu l’organises comme tu veux.',
      noTags: 'Aucun tag pour l’instant. Recherche d’abord les infos de quelques titres.',
    },
  },

  auto: {
    mostPlayed: { name: 'Les plus écoutés', hint: 'Ce que tu réécoutes sans cesse' },
    recentlyFound: { name: 'Nouveautés du mois', hint: 'Écoutés pour la première fois depuis le début du mois' },
    forgotten: { name: 'Oubliés', hint: 'Très écoutés autrefois, plus du tout depuis six mois' },
    skipped: { name: 'Les plus zappés', hint: 'Ce que tu zappes sans arrêt' },
  },

  picker: {
    heading: (count) => `Ajouter ${format.number(count)} ${one(count, 'titre', 'titres')} à`,
    noLists: 'Aucune liste pour l’instant.',
    newList: 'Nouvelle liste…',
    already: (list) => `Déjà dans ${list}`,
    added: (count, list) =>
      `${format.number(count)} ${one(count, 'titre ajouté', 'titres ajoutés')} à ${list}`,
  },

  trackPicker: {
    heading: 'Ajouter des titres',
    search: 'Rechercher dans la bibliothèque',
    alreadyHere: 'Déjà dans cette liste',
    add: (count) => `Ajouter ${format.number(count)} ${one(count, 'titre', 'titres')}`,
  },

  list: {
    album: 'Album',
    artist: 'Artiste',
    folder: 'Dossier',
    list: 'Liste',

    everythingTagged: (tag) => `Tout ce qui porte actuellement le tag ${tag}`,
    away: (count) =>
      `${format.number(count)} ${one(count, 'autre n’est pas', 'autres ne sont pas')} dans la bibliothèque en ce moment`,

    addTracks: 'Ajouter des titres',
    cover: 'Pochette',
    deleteList: 'Supprimer la liste',

    albums: 'Albums',
    tracks: 'Titres',
    opensAlbum: 'Ouvre l’album',

    empty: {
      editable: 'Rien ici pour l’instant. Ajoute des titres ci-dessus, ou envoie-les ici depuis la bibliothèque.',
      tag: 'Rien ne porte encore ce tag. Ajoute-le à quelques titres et ils apparaîtront ici.',
      album: 'Ce disque n’est plus dans la bibliothèque.',
      artist: 'Plus rien dans la bibliothèque ne lui est crédité.',
      folder: 'Il n’y a plus rien dans ce dossier.',
      auto: 'Rien ne correspond pour l’instant. Écoute d’abord quelques morceaux.',
    },

    mightBelong: 'Pourrait aller ici',
    mightBelongHint:
      'D’après les tags sur lesquels la liste s’appuie déjà, pondérés pour qu’un tag rare compte plus qu’un tag que porte la moitié de la bibliothèque.',

    choosePicture: 'Choisir une image…',
    firstFour: 'Utiliser les quatre premières',

    renameHeading: 'Renommer la liste',
    deleteQuestion: (name) => `Supprimer la liste « ${name} » ?`,
    deleteHint: 'La liste disparaît. Les titres restent sur le téléphone.',
  },

  files: {
    importFiles: 'Importer des listes M3U…',
    exportAll: 'Exporter toutes les listes…',
    export: 'Exporter…',
    untitled: 'Liste importée',
    reading: 'Lecture des listes…',

    conflict: {
      heading: (name) => `Une liste « ${name} » existe déjà`,
      hint: 'Le fichier peut remplacer cette liste tout en gardant sa pochette, ou être ajouté comme une nouvelle liste.',
      replace: 'La remplacer',
      keepBoth: (name) => `Ajouter sous le nom « ${name} »`,
      skip: 'Ignorer ce fichier',
    },

    result: {
      heading: 'Importé',
      imported: (name, found, total) =>
        `Liste ${name} importée : ${format.number(found)} sur ${format.number(total)} ${one(found, 'trouvé', 'trouvés')}`,
      repeated: (count) =>
        one(
          count,
          'Un titre figurait plusieurs fois dans le fichier ; la liste ne le contient qu’une fois.',
          `${format.number(count)} titres figuraient plusieurs fois dans le fichier ; la liste ne contient chacun qu’une fois.`
        ),
      showMissing: (count) => `Voir ${one(count, 'le titre introuvable', `les ${format.number(count)} titres introuvables`)}`,
      hideMissing: 'Masquer',
      reasons: {
        notFound: 'Rien ne correspond dans la bibliothèque',
        ambiguous: 'Plusieurs titres correspondent',
        web: 'Une adresse web, pas un fichier',
      },
      tooBig: (file) => `${file} est trop gros pour être une liste.`,
      unreadable: (file) => `${file} n’a pas pu être lu comme une liste.`,
      empty: (file) => `${file} est vide.`,
      skipped: (file) => `${file} a été ignoré.`,
      encoding: (encoding) => `Lu en ${encoding}`,
      open: 'Ouvrir',
    },

    exportSheet: {
      heading: 'Exporter en liste M3U',
      headingAll: 'Exporter toutes les listes',
      phone: 'Chemins du téléphone',
      phoneHint:
        'Des chemins complets comme /storage/emulated/0/Music/…, que les autres lecteurs de ce téléphone comprennent, où que soit le fichier.',
      library: 'Relatifs au dossier de la bibliothèque',
      libraryHint:
        'Des chemins qui partent du dossier de la bibliothèque, pour un ordinateur qui a la même musique. Place le fichier à la racine de ce dossier.',
      save: 'Enregistrer…',
      chooseFolder: 'Choisir un dossier…',
      allHint:
        'Un fichier .m3u8 pour chacune de tes listes, dans le dossier de ton choix. Un fichier du même nom déjà présent est remplacé.',
    },

    saved: (name) => `Liste ${name} enregistrée au format M3U`,
    savedAll: (count, folder) =>
      `${format.number(count)} ${one(count, 'liste enregistrée', 'listes enregistrées')} dans ${folder}`,
    notSaved: (names) => `Non enregistré : ${names}`,
    leftOut: (count) =>
      one(
        count,
        'Un titre a été laissé de côté : il n’est pas dans le dossier de la bibliothèque en ce moment.',
        `${format.number(count)} titres ont été laissés de côté : ils ne sont pas dans le dossier de la bibliothèque en ce moment.`
      ),
    failed: (reason) => `Ça n’a pas marché : ${reason}`,
  },
};
