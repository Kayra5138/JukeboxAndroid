import type { Strings } from '../en/index.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい', harder: '超むずかしい' },

  setup: {
    title: '曲に合わせてプレイ',
    noTrack: '曲を再生すると、その曲からタイルが作られます。',
    making: '曲を解析しています…',
    missing: 'この曲は解析できません。',
    record: (title, keys) => `${title ?? 'この曲'} — タイル${keys}枚`,
    latency:
      'ワイヤレスイヤホンでは音が遅れて届きます。タイルが音楽より遅れていると感じたら、合うまでこれを調整してください。',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: '最初からプレイ',
    starting: '開始しています…',
    screenReader:
      'このゲームは音楽に合わせてタップして遊びますが、TalkBackがそのタップを受け取ってしまいます。プレイするにはTalkBackを一時停止してください。',
  },

  hud: {
    score: (points) => `スコア${points}`,
  },

  pause: {
    title: '一時停止中',
    resume: '続ける',
    toMenu: 'メニューに戻る',
  },

  ending: {
    clean: 'パーフェクト',
    won: 'クリア',
    over: 'ゲームオーバー',
    lapse: 'タイルを見逃しました。',
    empty: '何もない場所をタップしました。',
    toTheEnd: '曲の最後までやり遂げました。',
    figures: (hit, total, held, best, percent) =>
      `${total}枚中${hit}枚${held > 0 ? ` · ロング${held}枚` : ''} · 最大コンボ${best} · ${percent}%`,
    again: 'もう一度',
  },
};
