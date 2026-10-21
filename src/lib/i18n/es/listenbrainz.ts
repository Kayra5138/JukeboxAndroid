import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'Conectar ListenBrainz',
    note:
      'Opcional. ListenBrainz puede llevar un registro público de lo que escuchas. No se le envía nada hasta que pegues aquí tu token de usuario, y después tampoco hasta que actives el envío.',
    where: 'Tu token de usuario está en listenbrainz.org, en los ajustes de tu cuenta.',
    openSite: 'Abrir listenbrainz.org/settings',
    promptHeading: 'Token de usuario de ListenBrainz',
    promptHint:
      'Cópialo de listenbrainz.org/settings y pégalo aquí. Se queda en este teléfono y no se incluye en las copias de seguridad.',
    placeholder: 'Token de usuario',
    confirm: 'Conectar',
    checking: 'Comprobando el token…',
    invalid: 'ListenBrainz no reconoce ese token. No se ha guardado nada.',
    unreachable: 'No se ha podido conectar con ListenBrainz, así que no se ha podido comprobar el token. No se ha guardado nada.',
  },

  connectedAs: (user) => `Conectado como ${user}`,
  revoked: (user) =>
    user
      ? `ListenBrainz ya no acepta el token de ${user}, así que no se está enviando nada. Pega uno nuevo para continuar. Lo que estaba en espera se conserva.`
      : 'ListenBrainz ya no acepta el token, así que no se está enviando nada. Pega uno nuevo para continuar. Lo que estaba en espera se conserva.',
  newToken: 'Pegar un token nuevo',
  openListens: 'Ver tus escuchas en ListenBrainz',
  refused: (user, why) =>
    `ListenBrainz reconoce el token${user ? ` de ${user}` : ''}, pero no ha aceptado ninguna escucha con él${
      why ? `. Su respuesta: «${why.replace(/[\s.]+$/, '')}».` : '.'
    } No se ha enviado nada y el token se conserva. Cuando se resuelva en ListenBrainz, vuelve a enviar.`,

  sending: {
    title: 'Enviar lo que escucho',
    note:
      'A partir de ahora, cada escucha que registre la app (todo lo que pase de 30 segundos) se envía a tu cuenta de ListenBrainz, con el título, el artista y el álbum que se muestran aquí.',
    hint: 'Envía las escuchas nuevas a ListenBrainz',
  },

  waiting: (count) =>
    oneOrMany(count, '1 escucha pendiente de enviar', `${format.number(count)} escuchas pendientes de enviar`),
  sendingNow: (count) =>
    oneOrMany(count, 'Enviando · falta 1 escucha', `Enviando · faltan ${format.number(count)} escuchas`),
  lastSent: (when) => `Último envío: ${when}`,
  trouble: {
    offline: 'No se ha podido conectar con ListenBrainz. Lo pendiente se conserva y se volverá a intentar más tarde.',
    busy: 'ListenBrainz ha pedido menos solicitudes. Lo pendiente se conserva y se volverá a intentar más tarde.',
    server: 'ListenBrainz tiene problemas. Lo pendiente se conserva y se volverá a intentar más tarde.',
    failed: 'Esta vez no se ha podido enviar. Lo pendiente se conserva y se volverá a intentar más tarde.',
  },

  past: {
    title: 'Enviar escuchas anteriores',
    start: 'Enviar',
    stop: 'Detener',
    unsent: (count) =>
      oneOrMany(
        count,
        'Hay 1 escucha en tu historial sin enviar. ListenBrainz la registra en el día en que se escuchó.',
        `Hay ${format.number(count)} escuchas en tu historial sin enviar. ListenBrainz registra cada una en el día en que se escuchó.`
      ),
    allSent: 'Ya se ha enviado todo tu historial.',
    nothing: 'Aún no hay nada en tu historial.',
    progress: (count) =>
      oneOrMany(
        count,
        'Enviando tu historial · falta 1 escucha.',
        `Enviando tu historial · faltan ${format.number(count)} escuchas. Sigue mientras la app está abierta y retoma donde lo dejó.`
      ),
    leftOut: (count) =>
      oneOrMany(
        count,
        'Se ha dejado fuera 1 escucha: no tiene artista o ListenBrainz no la ha aceptado. Ponle un artista a la pista y vuelve a enviar.',
        `Se han dejado fuera ${format.number(count)} escuchas: no tienen artista o ListenBrainz no las ha aceptado. Ponles un artista a las pistas y vuelve a enviar.`
      ),
    startLabel: 'Enviar escuchas anteriores a ListenBrainz',
    stopLabel: 'Dejar de enviar escuchas anteriores',
  },

  disconnect: {
    title: 'Desconectar',
    note: 'Olvida el token y qué escuchas se enviaron. No se elimina nada de lo que ya está en ListenBrainz.',
    question: (user) => `¿Desconectar de ${user}?`,
    consequence:
      'Se olvida el token, y también lo que estaba pendiente y lo que se envió. Tu historial en este teléfono no se toca, y no se elimina nada de ListenBrainz.',
  },
};
