import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: '言語を選択',
    note: 'あとから設定でいつでも変更できます。',
    go: '続ける',
    made:
      'Jukeboxは一人で開発しています。英語以外の言語はAIが翻訳したもので、その言語を話す人によるチェックはまだ受けていません。不自然な表現があれば、GitHubで教えてください。',
  },

  setup: {
    step: (at: number, of: number) =>
      `ステップ ${format.number(at)} / ${format.number(of)}`,
    skip: 'スキップ',
    skipHint: '残りはそのままにしてJukeboxを開きます',
    back: '戻る',
    next: '続ける',
    done: '完了',
    update:
      'このバージョンで追加された設定です。あとから設定でいつでも変更できます。',
    look: {
      heading: '外観を選択',
      note: 'タップすると試せます。',
      more:
        'ほかのテーマや、システムに合わせるときに使う2つのテーマは、設定 → 外観で選べます。',
    },
    discover: {
      heading: 'ディスカバー',
      note:
        'ディスカバーは、ライブラリのアーティストやそれに近いアーティストの、まだ持っていない曲を見つけ、再生するときにYouTubeから取得します。',
      more:
        'リストの曲数や更新の頻度などは、ディスカバーの設定で変更できます。',
    },
  },

  offer: {
    heading: 'ジャケットと曲の情報を取得しますか？',
    body: (count) =>
      `まだ情報を取得していない曲が${format.number(count)}曲あります。JukeboxはMusicBrainzとAppleのiTunesカタログから、ジャケット、アーティスト、アルバムの情報を探せます。`,
    privacy:
      'この2つのサービスに送信されるのは曲名だけで、それ以外は何も送信されません。取得は再生中もバックグラウンドで進みます。後から「設定 → ライブラリ → タグ」で行うこともできます。',
    accept: '取得する',
    decline: '後で',
  },

  progress: {
    starting: 'ジャケットと曲の情報を取得中…',
    counting: (done, total) =>
      `ジャケットと曲の情報を取得中 · ${format.number(total)}曲中${format.number(done)}曲`,
    album: (album, done, total) =>
      `「${album}」を取得中 · ${format.number(total)}曲中${format.number(done)}曲`,
    covers: (done, total) =>
      `ジャケットを取得中 · ${format.number(total)}曲中${format.number(done)}曲`,
    lyrics: (done, total) =>
      `歌詞を取得中 · ${format.number(total)}曲中${format.number(done)}曲`,
    hint: 'タグ画面を開きます。取得の進み具合の確認や停止ができます',
  },

  tips: {
    library:
      '曲を長押しするとメニューが開き、リストへの追加、詳細の編集、ピアノタイルでのプレイができます。曲を右にスワイプすると次に再生、左にスワイプするとキューに追加します。',
    player:
      '操作ボタンの下にある歌詞ボタンを押すと、曲に合わせて歌詞が表示されます。歌詞の表示中はその横に現れるボタンで翻訳できます。歯車からは、速度とピッチ、エフェクト、スリープタイマーを設定できます。',
    discover:
      'ディスカバーは、まだ持っていない曲を探します。しばらく再生するまでは、ライブラリに曲が多いアーティストを手がかりにし、再生した曲から好みを学んでいきます。',
    dismiss: 'わかりました',
    dismissHint: 'このヒントを今後表示しません',
  },

  settings: {
    title: '初回起動',
    note:
      '最初の設定、ジャケットと曲の情報を取得するかの確認、ヒントを、インストール直後と同じようにもう一度表示します。音楽、リスト、設定はそのまま残ります。',
    again: 'もう一度見る',
  },

  discoverEarly:
    'まだ再生した曲が少ないため、ディスカバーはライブラリに曲が多いアーティストを手がかりにし、再生した曲から好みを学んでいきます。',
};
