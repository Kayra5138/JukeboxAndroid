import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'プレーヤーを開きます',
  },
  sheet: {
    nothingPlaying: '再生中の曲はありません。',
    heart: 'ハート',
    repeat: { off: 'リピート', all: '全曲リピート', one: '1曲リピート' },
    back: (seconds) => `${seconds}秒戻る`,
    forward: (seconds) => `${seconds}秒進む`,
    shuffleQueue: 'キューをシャッフル',
    playbackSettings: '再生設定',
    lyrics: '歌詞',
    translateLyrics: '歌詞を翻訳',
    upNext: (count) => `次に再生 · ${format.number(count)}`,
    position: '再生位置',
    /* Read aloud: 「1:23、全体3:45」. */
    positionValue: (position, duration) => `${position}、全体${duration}`,
  },
  queue: {
    remove: (title) => `${title}をキューから外す`,
    movedTo: (position, count) =>
      `${format.number(count)}曲中${format.number(position)}番目に移動しました`,
    auto: {
      library: '似た曲 · あなたへのおすすめ',
      fresh: '新しい曲 · ディスカバーから',
      mixed: '似た曲と新しい曲 · あなたへのおすすめ',
      remove: '外す',
      removeLabel: 'おすすめの曲をキューから外す',
      removeHint: 'ほかの曲を再生するまで、このキューには追加されません。',
      notes: {
        offline: '接続がないため、ライブラリの曲です。',
        wifi: 'ディスカバーがWi-Fiを待っているため、ライブラリの曲です。',
        unavailable: '新しい曲にはYouTubeダウンローダーが必要なため、ライブラリの曲です。',
        waiting: '新しい曲はまだダウンロード中です。その間はライブラリの曲を再生します。',
        random: 'この曲の情報が少ないため、一部はライブラリからランダムに選びました。',
      },
    },
  },
  settings: {
    playback: '再生',
    backToNormal: '速度とピッチを元に戻す',
    normal: '標準',
    speed: '速度',
    pitch: 'ピッチ',
    pitchHint: '半音単位で上下します。再生速度は上の設定のまま変わりません。',
    effects: 'エフェクト',
    equalizer: { note: 'バンド、低音、ラウドネス' },
    crossfade: { note: '曲から次の曲へのつなぎ方' },
    allEffects: { title: 'すべてのエフェクト', note: '広がり、クロスフィード、回転、レベル' },
  },
  sleepTimer: {
    title: 'スリープタイマー',
    cancel: 'スリープタイマーを解除',
    unsupported: 'スリープタイマーを使うには、更新版のAndroidアプリをインストールしてください。',
    about: '一定時間後に音楽を一時停止します。最後の30秒は徐々に音量が下がります。',
    pauseAfter: (minutes) => `${minutes}分後に一時停止`,
    pauseAfterTyped: '入力した分数の後に一時停止',
    custom: 'カスタム…',
    pauseAtEnd: 'この曲の終わりで一時停止',
    endOfTrack: '曲の終わり',
    finish: {
      title: '再生中の曲を最後まで再生',
      note: '時間になったら、フェードアウトせずに曲が終わるまで待ちます。',
      label: 'スリープタイマー終了時に再生中の曲を最後まで再生',
    },
    refused: (most) => `1〜${most}の整数（分）を入力してください`,
    howMany: '何分後に一時停止しますか？',
    minutes: '分',
    start: '開始',
  },
  sleep: {
    endOfTrack: 'この曲が終わったら一時停止',
    thenToTheEnd: (time) => `残り${time}、その後この曲の終わりまで`,
    fadingOut: (time) => `フェードアウト中、残り${time}`,
    pausesIn: (time) => `${time}後に一時停止`,
  },
};
