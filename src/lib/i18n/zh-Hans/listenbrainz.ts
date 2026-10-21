import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: '连接 ListenBrainz',
    note: '可选功能。ListenBrainz 可以公开记录你听过的音乐。在你把用户令牌粘贴到这里之前，不会向它发送任何内容；粘贴之后，在你开启发送之前也不会发送。',
    where: '你的用户令牌位于 listenbrainz.org 的账户设置中。',
    openSite: '打开 listenbrainz.org/settings',
    promptHeading: 'ListenBrainz 用户令牌',
    promptHint: '从 listenbrainz.org/settings 复制并粘贴到这里。令牌只保存在这台手机上，不会包含在备份中。',
    placeholder: '用户令牌',
    confirm: '连接',
    checking: '正在验证令牌…',
    invalid: 'ListenBrainz 无法识别该令牌。未保存任何内容。',
    unreachable: '无法连接 ListenBrainz，因此无法验证令牌。未保存任何内容。',
  },

  connectedAs: (user) => `已连接为 ${user}`,
  revoked: (user) =>
    user
      ? `ListenBrainz 已不再接受 ${user} 的令牌，因此暂停发送。粘贴新令牌即可继续。等待发送的记录会保留。`
      : 'ListenBrainz 已不再接受该令牌，因此暂停发送。粘贴新令牌即可继续。等待发送的记录会保留。',
  newToken: '粘贴新令牌',
  openListens: '在 ListenBrainz 上查看你的收听记录',
  /*
    [why] is the service's own sentence, in English as it sent it, and is
    quoted as it came.
  */
  refused: (user, why) =>
    `ListenBrainz 认可${user ? ` ${user} 的` : '该'}令牌，但拒绝接收任何收听记录${
      why ? `。它的回复是：“${why}”` : ''
    }。未发送任何内容，令牌仍会保留。在 ListenBrainz 上解决该问题后，请重新发送。`,

  sending: {
    title: '发送我的收听记录',
    note: '从现在起，应用记录的每一次收听（超过 30 秒的播放）都会以这里显示的标题、艺人和专辑发送到你的 ListenBrainz 账户。',
    hint: '将新的收听记录发送到 ListenBrainz',
  },

  waiting: (count) => `${format.number(count)} 条收听记录等待发送`,
  sendingNow: (count) => `正在发送 · 还剩 ${format.number(count)} 条`,
  lastSent: (when) => `上次发送：${when}`,
  trouble: {
    offline: '无法连接 ListenBrainz。等待发送的记录会保留，稍后再试。',
    busy: 'ListenBrainz 要求减少请求。等待发送的记录会保留，稍后再试。',
    server: 'ListenBrainz 出现故障。等待发送的记录会保留，稍后再试。',
    failed: '本次发送未成功。等待发送的记录会保留，稍后再试。',
  },

  past: {
    title: '发送过往收听记录',
    start: '发送',
    stop: '停止',
    unsent: (count) =>
      `你的历史中有 ${format.number(count)} 条收听记录尚未发送。ListenBrainz 会按收听当天的日期归档。`,
    allSent: '你的所有历史记录均已发送。',
    nothing: '你的历史中还没有任何记录。',
    progress: (count) =>
      `正在发送历史记录 · 还剩 ${format.number(count)} 条。应用打开期间会持续发送，中断后会从上次的位置继续。`,
    leftOut: (count) =>
      `${format.number(count)} 条收听记录未能发送：缺少艺人信息，或 ListenBrainz 拒绝接收。为歌曲补充艺人信息后请重新发送。`,
    startLabel: '将过往收听记录发送到 ListenBrainz',
    stopLabel: '停止发送过往收听记录',
  },

  disconnect: {
    title: '断开连接',
    note: '清除令牌以及哪些记录已发送的信息。已在 ListenBrainz 上的内容不会被删除。',
    question: (user) => `断开与 ${user} 的连接？`,
    consequence:
      '令牌会被清除，等待发送和已发送的记录信息也会一并清除。这台手机上的收听历史不受影响，ListenBrainz 上的内容也不会被删除。',
  },
};
