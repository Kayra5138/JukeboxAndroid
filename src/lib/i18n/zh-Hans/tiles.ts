import type { Strings } from '../en/index.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: '简单', normal: '普通', hard: '困难', harder: '极难' },

  setup: {
    title: '跟着弹',
    noTrack: '先播放一首歌，琴键会根据它生成。',
    making: '正在聆听这首歌…',
    missing: '无法读取这首歌。',
    record: (title, keys) => `${title ? `“${title}”` : '这首歌'} — ${keys} 个琴键`,
    latency: '无线耳机的声音会有延迟。如果琴键跟不上音乐，请调整此项，直到两者同步。',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: '从头开始',
    starting: '正在开始…',
    screenReader: '这个游戏需要跟着音乐的节奏点按屏幕，而 TalkBack 会接管这些点按。请暂停 TalkBack 后再玩。',
  },

  hud: {
    score: (points) => `得分 ${points}`,
  },

  pause: {
    title: '已暂停',
    resume: '继续',
    toMenu: '返回菜单',
  },

  ending: {
    clean: '完美通关',
    won: '你成功了',
    over: '游戏结束',
    lapse: '漏掉了一个琴键。',
    empty: '这一下点空了。',
    toTheEnd: '一路弹到了这首歌的结尾。',
    figures: (hit, total, held, best, percent) =>
      `${total} 个琴键中击中 ${hit} 个${held > 0 ? ` · 长按 ${held} 个` : ''} · 最长连击 ${best} · ${percent}%`,
    again: '再来一次',
  },
};
