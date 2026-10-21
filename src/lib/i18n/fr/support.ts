import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: 'Signaler un problème',
      note: 'Ouvre un ticket GitHub prérempli. Rien n’est envoyé tant que tu ne l’envoies pas.',
    },
    title: 'Signaler un problème',
    intro:
      'Rien ne quitte ton téléphone depuis cet écran. « Ouvrir GitHub » crée un nouveau ticket avec le texte ci-dessous déjà rempli ; tu peux le lire et le modifier là-bas, et il n’est envoyé que si tu l’envoies.',
    details: 'Ce qui va dans le ticket',
    detailsNote: 'La version et le téléphone vont dans leurs propres champs du formulaire, le reste dans le dernier. Tes morceaux ne sont jamais nommés.',
    errors: {
      title: 'Inclure les erreurs récentes',
      note:
        'Des problèmes que Jukebox a remarqués tout seul, comme un téléchargement ou une recherche qui a échoué. Les noms de morceaux, les adresses et les chemins de fichiers ont été retirés avant l’enregistrement.',
      none: 'Aucune erreur n’a été notée.',
      trimmed: 'Les erreurs les plus anciennes sont laissées hors du lien pour qu’il reste assez court pour s’ouvrir. « Copier » les inclut toutes.',
    },
    open: 'Ouvrir GitHub',
    openHint: 'Ouvre dans ton navigateur un nouveau ticket, rempli et pas encore envoyé',
    copy: 'Copier',
    copyNote: 'Pas de compte GitHub ? « Copier » met le même texte dans le presse-papiers, à coller dans un ticket ou un message.',
    copied: 'Copié',
    openFailed: 'Le lien n’a pas pu s’ouvrir. Copie le texte et colle-le plutôt dans un ticket.',
    copyFailed: 'Cette version de l’app ne peut pas utiliser le presse-papiers. Sélectionne le texte ci-dessus et copie-le à la main.',
  },

  update: {
    available: (version) => `Jukebox ${version} est disponible`,
    note: 'Si tu l’as installé avec Obtainium, la mise à jour t’y sera proposée. Sinon, touche ici pour ouvrir la page de la version et la télécharger.',
    hint: 'Ouvre la page de la version dans ton navigateur',
    tab: (settings) => `${settings}, une mise à jour est disponible`,
    heading: 'Mises à jour',
    check: {
      title: 'Chercher une nouvelle version de Jukebox',
      note: 'Au plus une fois par jour, quand tu ouvres l’app, Jukebox demande à GitHub quelle est la dernière version. Rien sur toi ni sur ta bibliothèque n’est envoyé, et rien n’est téléchargé.',
    },
  },
};
