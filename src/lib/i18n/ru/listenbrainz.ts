import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

/*
  «Прослушивание» is neuter, so «осталось» agrees with every count after it.
  Elsewhere a count is put after a label and a colon, where it agrees with
  nothing. The account name is always left in the nominative: «аккаунт X».
*/
const listens = (count: number) => counted(count, 'прослушивание', 'прослушивания', 'прослушиваний');

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'Подключить ListenBrainz',
    note:
      'Необязательно. ListenBrainz может вести открытую запись того, что ты слушаешь. Туда ничего не отправляется, пока ты не вставишь сюда свой токен, а после — пока не включишь отправку.',
    where: 'Твой токен — на listenbrainz.org, в настройках аккаунта.',
    openSite: 'Открыть listenbrainz.org/settings',
    promptHeading: 'Токен ListenBrainz',
    promptHint:
      'Скопируй его на listenbrainz.org/settings и вставь сюда. Он хранится только на этом телефоне и не попадает в резервные копии.',
    placeholder: 'Токен пользователя',
    confirm: 'Подключить',
    checking: 'Проверка токена…',
    invalid: 'ListenBrainz не знает такого токена. Ничего не сохранено.',
    unreachable: 'Не удалось связаться с ListenBrainz, поэтому токен не проверен. Ничего не сохранено.',
  },

  connectedAs: (user) => `Аккаунт: ${user}`,
  revoked: (user) =>
    user
      ? `ListenBrainz больше не принимает токен аккаунта ${user}, поэтому ничего не отправляется. Вставь новый токен, чтобы продолжить. Всё, что ждало отправки, сохранено.`
      : 'ListenBrainz больше не принимает токен, поэтому ничего не отправляется. Вставь новый токен, чтобы продолжить. Всё, что ждало отправки, сохранено.',
  newToken: 'Вставить новый токен',
  openListens: 'Мои прослушивания на ListenBrainz',
  /*
    [why] is the service's own sentence, in English, quoted as it came. Russian
    puts the full stop after the closing quote, so the sentence's own is dropped.
  */
  refused: (user, why) =>
    `ListenBrainz распознаёт токен${user ? ` аккаунта ${user}` : ''}, но не принимает для него прослушивания${
      why ? `. Ответ сервиса: «${why.trim().replace(/\.$/, '')}»` : ''
    }. Ничего не отправлено, токен сохранён. Когда это будет исправлено на ListenBrainz, отправь снова.`,

  sending: {
    title: 'Отправлять мои прослушивания',
    note:
      'С этого момента каждое прослушивание, которое записывает приложение (всё, что дольше 30 секунд), отправляется в твой аккаунт ListenBrainz — с названием, исполнителем и альбомом, как они показаны здесь.',
    hint: 'Отправляет новые прослушивания в ListenBrainz',
  },

  waiting: (count) => `В очереди на отправку: ${listens(count)}`,
  sendingNow: (count) => `Отправка · осталось ${listens(count)}`,
  lastSent: (when) => `Последняя отправка: ${when}`,
  trouble: {
    offline: 'Не удалось связаться с ListenBrainz. Всё, что ждёт отправки, сохранено, попытка повторится позже.',
    busy: 'ListenBrainz просит отправлять реже. Всё, что ждёт отправки, сохранено, попытка повторится позже.',
    server: 'У ListenBrainz неполадки. Всё, что ждёт отправки, сохранено, попытка повторится позже.',
    failed: 'На этот раз отправить не удалось. Всё, что ждёт отправки, сохранено, попытка повторится позже.',
  },

  past: {
    title: 'Отправить прошлые прослушивания',
    start: 'Отправить',
    stop: 'Остановить',
    unsent: (count) =>
      count === 1
        ? 'Одно прослушивание из твоей истории ещё не отправлено. ListenBrainz запишет его на тот день, когда оно прозвучало.'
        : `Не отправлено из твоей истории: ${listens(count)}. ListenBrainz запишет каждое на тот день, когда оно прозвучало.`,
    allSent: 'Вся твоя история уже отправлена.',
    nothing: 'В твоей истории пока ничего нет.',
    progress: (count) =>
      count === 1
        ? 'Отправка истории · осталось 1 прослушивание.'
        : `Отправка истории · осталось ${listens(count)}. Она идёт, пока приложение открыто, и продолжится с того места, где остановилась.`,
    leftOut: (count) =>
      count === 1
        ? 'Одно прослушивание пропущено: у трека нет исполнителя, или ListenBrainz его не принял. Укажи исполнителя и отправь снова.'
        : `Пропущено: ${listens(count)}. У этих треков нет исполнителя, или ListenBrainz их не принял. Укажи исполнителей и отправь снова.`,
    startLabel: 'Отправить прошлые прослушивания в ListenBrainz',
    stopLabel: 'Остановить отправку прошлых прослушиваний',
  },

  disconnect: {
    title: 'Отключить',
    note: 'Забывает токен и то, какие прослушивания уже отправлены. Ничего на ListenBrainz не удаляется.',
    question: (user) => `Отключить аккаунт ${user}?`,
    consequence:
      'Токен будет забыт, как и то, что ждало отправки и что уже отправлено. История на этом телефоне не изменится, и ничего на ListenBrainz не удалится.',
  },
};
