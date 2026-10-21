import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'Conectar ao ListenBrainz',
    note:
      'Opcional. O ListenBrainz pode manter um registro público do que você ouve. Nada é enviado a ele até você colar aqui seu token de usuário, e nada depois disso até você ativar o envio.',
    where: 'Seu token de usuário está em listenbrainz.org, nas configurações da sua conta.',
    openSite: 'Abrir listenbrainz.org/settings',
    promptHeading: 'Token de usuário do ListenBrainz',
    promptHint:
      'Copie de listenbrainz.org/settings e cole aqui. Ele fica neste celular e não entra nos backups.',
    placeholder: 'Token de usuário',
    confirm: 'Conectar',
    checking: 'Verificando o token…',
    invalid: 'O ListenBrainz não reconhece esse token. Nada foi salvo.',
    unreachable: 'Não foi possível acessar o ListenBrainz, então o token não pôde ser verificado. Nada foi salvo.',
  },

  connectedAs: (user) => `Conectado como ${user}`,
  revoked: (user) =>
    user
      ? `O ListenBrainz não aceita mais o token de ${user}, então nada está sendo enviado. Cole um novo para continuar. O que estava aguardando é mantido.`
      : 'O ListenBrainz não aceita mais o token, então nada está sendo enviado. Cole um novo para continuar. O que estava aguardando é mantido.',
  newToken: 'Colar um novo token',
  openListens: 'Ver suas reproduções no ListenBrainz',
  refused: (user, why) =>
    `O ListenBrainz reconhece o token${user ? ` de ${user}` : ''}, mas não aceitou nenhuma reprodução por ele${
      why ? `. A resposta foi: “${why}”.` : '.'
    } Nada foi enviado, e o token foi mantido. Depois de resolver isso no ListenBrainz, envie de novo.`,

  sending: {
    title: 'Enviar o que eu ouço',
    note:
      'De agora em diante, cada reprodução que o app registra — qualquer coisa além de 30 segundos — é enviada para sua conta do ListenBrainz, com o título, o artista e o álbum mostrados aqui.',
    hint: 'Envia novas reproduções ao ListenBrainz',
  },

  waiting: (count) =>
    oneOrMany(
      count,
      '1 reprodução aguardando envio',
      `${format.number(count)} reproduções aguardando envio`
    ),
  sendingNow: (count) =>
    oneOrMany(count, 'Enviando · falta 1 reprodução', `Enviando · faltam ${format.number(count)} reproduções`),
  lastSent: (when) => `Último envio: ${when}`,
  trouble: {
    offline: 'Não foi possível acessar o ListenBrainz. O que está aguardando é mantido e tentado de novo mais tarde.',
    busy: 'O ListenBrainz pediu menos solicitações. O que está aguardando é mantido e tentado de novo mais tarde.',
    server: 'O ListenBrainz está com problemas. O que está aguardando é mantido e tentado de novo mais tarde.',
    failed: 'O envio não funcionou desta vez. O que está aguardando é mantido e tentado de novo mais tarde.',
  },

  past: {
    title: 'Enviar reproduções antigas',
    start: 'Enviar',
    stop: 'Parar',
    unsent: (count) =>
      oneOrMany(
        count,
        '1 reprodução do seu histórico não foi enviada. O ListenBrainz a registra no dia em que foi ouvida.',
        `${format.number(count)} reproduções do seu histórico não foram enviadas. O ListenBrainz registra cada uma no dia em que foi ouvida.`
      ),
    allSent: 'Todo o seu histórico foi enviado.',
    nothing: 'Ainda não há nada no seu histórico.',
    progress: (count) =>
      oneOrMany(
        count,
        'Enviando seu histórico · falta 1 reprodução.',
        `Enviando seu histórico · faltam ${format.number(count)} reproduções. O envio continua enquanto o app estiver aberto e retoma de onde parou.`
      ),
    leftOut: (count) =>
      oneOrMany(
        count,
        '1 reprodução ficou de fora: ela não tem artista, ou o ListenBrainz não a aceitou. Defina um artista para a faixa e envie de novo.',
        `${format.number(count)} reproduções ficaram de fora: elas não têm artista, ou o ListenBrainz não as aceitou. Defina um artista para as faixas e envie de novo.`
      ),
    startLabel: 'Enviar reproduções antigas ao ListenBrainz',
    stopLabel: 'Parar de enviar reproduções antigas',
  },

  disconnect: {
    title: 'Desconectar',
    note: 'Esquece o token e quais reproduções foram enviadas. Nada que já está no ListenBrainz é removido.',
    question: (user) => `Desconectar a conta ${user}?`,
    consequence:
      'O token é esquecido, assim como o que estava aguardando e o que foi enviado. Seu histórico neste celular não é alterado, e nada no ListenBrainz é removido.',
  },
};
