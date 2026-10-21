import { format } from './format.ts';
import { de, one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

const listens = (count: number) => `${format.number(count)} ${one(count, 'écoute', 'écoutes')}`;

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'Connecter ListenBrainz',
    note:
      'Facultatif. ListenBrainz peut garder un historique public de ce que tu écoutes. Rien ne lui est envoyé tant que tu n’as pas collé ton jeton utilisateur ici, et rien ensuite tant que tu n’as pas activé l’envoi.',
    where: 'Ton jeton utilisateur se trouve sur listenbrainz.org, dans les paramètres de ton compte.',
    openSite: 'Ouvrir listenbrainz.org/settings',
    promptHeading: 'Jeton utilisateur ListenBrainz',
    promptHint:
      'Copie-le depuis listenbrainz.org/settings et colle-le ici. Il reste sur ce téléphone et n’est pas inclus dans les sauvegardes.',
    placeholder: 'Jeton utilisateur',
    confirm: 'Connecter',
    checking: 'Vérification du jeton…',
    invalid: 'ListenBrainz ne reconnaît pas ce jeton. Rien n’a été enregistré.',
    unreachable: 'Impossible de joindre ListenBrainz, le jeton n’a donc pas pu être vérifié. Rien n’a été enregistré.',
  },

  connectedAs: (user) => `Connecté en tant que ${user}`,
  revoked: (user) =>
    user
      ? `ListenBrainz n’accepte plus le jeton ${de(user)}, donc rien n’est envoyé. Colle un nouveau jeton pour continuer. Ce qui était en attente est conservé.`
      : 'ListenBrainz n’accepte plus le jeton, donc rien n’est envoyé. Colle un nouveau jeton pour continuer. Ce qui était en attente est conservé.',
  newToken: 'Coller un nouveau jeton',
  openListens: 'Voir tes écoutes sur ListenBrainz',
  refused: (user, why) =>
    `ListenBrainz reconnaît le jeton${user ? ` ${de(user)}` : ''}, mais refuse les écoutes de ce compte${
      why ? `. Message reçu : « ${why} ».` : '.'
    } Rien n’a été envoyé et le jeton est conservé. Une fois le problème réglé sur ListenBrainz, relance l’envoi.`,

  sending: {
    title: 'Envoyer ce que j’écoute',
    note:
      'Désormais, chaque écoute que l’app enregistre (tout ce qui dépasse 30 secondes) est envoyée à ton compte ListenBrainz, avec le titre, l’artiste et l’album affichés ici.',
    hint: 'Envoie les nouvelles écoutes à ListenBrainz',
  },

  waiting: (count) => `${listens(count)} en attente d’envoi`,
  sendingNow: (count) => `Envoi · encore ${listens(count)}`,
  lastSent: (when) => `Dernier envoi le ${when}`,
  trouble: {
    offline: 'Impossible de joindre ListenBrainz. Ce qui est en attente est conservé et sera réessayé plus tard.',
    busy: 'ListenBrainz a demandé moins de requêtes. Ce qui est en attente est conservé et sera réessayé plus tard.',
    server: 'ListenBrainz rencontre un problème. Ce qui est en attente est conservé et sera réessayé plus tard.',
    failed: 'L’envoi n’a pas marché cette fois. Ce qui est en attente est conservé et sera réessayé plus tard.',
  },

  past: {
    title: 'Envoyer les écoutes passées',
    start: 'Envoyer',
    stop: 'Arrêter',
    unsent: (count) =>
      count < 2
        ? `${listens(count)} de ton historique n’a pas été envoyée. ListenBrainz la classe au jour où elle a été écoutée.`
        : `${listens(count)} de ton historique n’ont pas été envoyées. ListenBrainz classe chacune au jour où elle a été écoutée.`,
    allSent: 'Tout ton historique a été envoyé.',
    nothing: 'Ton historique est encore vide.',
    progress: (count) =>
      count < 2
        ? `Envoi de ton historique · encore ${listens(count)}.`
        : `Envoi de ton historique · encore ${listens(count)}. L’envoi continue tant que l’app est ouverte, et reprend là où il s’était arrêté.`,
    leftOut: (count) =>
      count < 2
        ? `${listens(count)} n’a pas été envoyée : elle n’a pas d’artiste, ou ListenBrainz l’a refusée. Indique un artiste pour ce titre et relance l’envoi.`
        : `${listens(count)} n’ont pas été envoyées : elles n’ont pas d’artiste, ou ListenBrainz les a refusées. Indique un artiste pour ces titres et relance l’envoi.`,
    startLabel: 'Envoyer les écoutes passées à ListenBrainz',
    stopLabel: 'Arrêter l’envoi des écoutes passées',
  },

  disconnect: {
    title: 'Déconnecter',
    note: 'Oublie le jeton et la liste des écoutes envoyées. Rien de ce qui est déjà sur ListenBrainz n’est supprimé.',
    question: (user) => `Déconnecter le compte ${user} ?`,
    consequence:
      'Le jeton est oublié, tout comme ce qui était en attente et ce qui a été envoyé. Ton historique sur ce téléphone n’est pas touché, et rien n’est supprimé sur ListenBrainz.',
  },
};
