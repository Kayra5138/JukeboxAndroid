import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: 'Choisis ta langue',
    note: 'Tu peux la changer à tout moment dans Paramètres.',
    go: 'Continuer',
    made:
      'Jukebox est développé par une seule personne. À part l’anglais, les langues ont été traduites par une IA et n’ont pas encore été relues par quelqu’un qui les parle. Si quelque chose sonne faux, signale-le sur GitHub.',
  },

  setup: {
    step: (at: number, of: number) =>
      `Étape ${format.number(at)} sur ${format.number(of)}`,
    skip: 'Passer',
    skipHint: 'Laisse le reste tel quel et ouvre Jukebox',
    back: 'Retour',
    next: 'Continuer',
    done: 'Terminé',
    update:
      'Quelques réglages, nouveaux dans cette version. Tu peux les changer à tout moment dans Paramètres.',
    folder: {
      heading: "Ton dossier de musique",
      note: "Le dossier où Jukebox lit ta musique et enregistre ses téléchargements.",
      jukebox: { label: (folder: string) => `Le dossier de Jukebox (${folder})`, note: "Seulement ce qui est dans ce dossier. Les téléchargements y sont enregistrés, et la musique que d’autres apps rangent dans Music reste à l’écart." },
      music: { label: (folder: string) => `Tout Music (${folder})`, note: "Tout ce qui est dans le dossier Music et ses sous-dossiers, comme avant." },
      current: "Le dossier choisi auparavant.",
      songs: (count: number) => `${format.number(count)} ${count === 1 ? 'morceau' : 'morceaux'}`,
      more: "Modifiable à tout moment dans Réglages → Bibliothèque → Dossier de la bibliothèque, où tout autre dossier peut aussi être choisi.",
    },
    look: {
      heading: 'Choisis une apparence',
      note: 'Touche-en un pour l’essayer.',
      more:
        'D’autres thèmes, et le choix des deux utilisés quand l’appli suit le système, sont dans Paramètres → Apparence.',
    },
    discover: {
      heading: 'Découvrir',
      note:
        'Découvrir trouve des morceaux que tu n’as pas encore, des artistes de ta bibliothèque et d’autres qui leur ressemblent, et les récupère sur YouTube quand tu les écoutes.',
      more:
        'La longueur de la liste, la fréquence à laquelle elle est renouvelée et le reste sont dans Paramètres de Découvrir.',
    },
  },

  offer: {
    heading: 'Trouver pochettes et infos ?',
    body: (count) =>
      `${format.number(count)} de tes morceaux ${one(count, 'n’a', 'n’ont')} pas encore été ${one(count, 'identifié', 'identifiés')}. Jukebox peut trouver ${one(count, 'sa pochette, son artiste et son album', 'leurs pochettes, artistes et albums')} dans MusicBrainz et le catalogue iTunes d’Apple.`,
    privacy:
      'Seuls les noms des morceaux leur sont envoyés, rien d’autre. La recherche tourne en arrière-plan pendant que tu écoutes, et peut se faire plus tard depuis Paramètres → Bibliothèque → Tags.',
    accept: 'Les trouver',
    decline: 'Plus tard',
  },

  progress: {
    starting: 'Recherche des pochettes et des infos…',
    counting: (done, total) =>
      `Recherche des pochettes et des infos · ${format.number(done)} sur ${format.number(total)}`,
    album: (album, done, total) =>
      `Recherche de « ${album} » · ${format.number(done)} sur ${format.number(total)}`,
    covers: (done, total) =>
      `Recherche des pochettes · ${format.number(done)} sur ${format.number(total)}`,
    lyrics: (done, total) =>
      `Recherche des paroles · ${format.number(done)} sur ${format.number(total)}`,
    hint: 'Ouvre l’écran Tags, où la recherche peut être suivie et arrêtée',
  },

  tips: {
    library:
      'Appuie longuement sur un morceau pour ouvrir son menu : l’ajouter à une liste, modifier ses infos ou le jouer en piano tiles. Fais glisser un morceau vers la droite pour le lire ensuite, ou vers la gauche pour l’ajouter à la file d’attente.',
    player:
      'Sous les commandes, le bouton des paroles les affiche au fil du morceau, et une fois qu’elles sont affichées, le bouton qui apparaît à côté les traduit. La roue dentée regroupe la vitesse et la tonalité, les effets et le minuteur de veille.',
    discover:
      'Découvrir trouve des morceaux que tu n’as pas encore. Tant que tu n’as pas beaucoup écouté, il part des artistes dont tu as le plus de morceaux, puis il apprend de ce que tu écoutes.',
    dismiss: 'Compris',
    dismissHint: 'Range cette astuce pour de bon',
  },

  settings: {
    title: 'Premier lancement',
    note:
      'Montre Jukebox comme au jour de son installation : les premiers réglages, la proposition de trouver les pochettes, et les astuces. Ta musique, tes listes et tes réglages restent tels quels.',
    again: 'Revoir',
  },

  discoverEarly:
    'Tant que tu n’as pas beaucoup écouté, Découvrir part des artistes dont tu as le plus de morceaux, puis apprend de ce que tu écoutes.',
};
